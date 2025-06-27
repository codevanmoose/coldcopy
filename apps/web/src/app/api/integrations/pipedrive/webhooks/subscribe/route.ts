import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import crypto from 'crypto';
import { z } from 'zod';

// Webhook subscription schema
const WebhookSubscriptionSchema = z.object({
  event_action: z.enum(['added', 'updated', 'deleted', 'merged']),
  event_object: z.enum(['person', 'organization', 'deal', 'activity', 'user']),
});

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Generate webhook secret
function generateWebhookSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Create webhook subscription in Pipedrive
async function createPipedriveWebhook(
  accessToken: string,
  companyDomain: string,
  eventAction: string,
  eventObject: string,
  subscriptionUrl: string
): Promise<{ id: number }> {
  const response = await fetch(
    `https://${companyDomain}.pipedrive.com/api/v1/webhooks`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subscription_url: subscriptionUrl,
        event_action: eventAction,
        event_object: eventObject,
        version: '1.0',
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to create webhook: ${error.error || response.statusText}`);
  }

  const data = await response.json();
  return { id: data.data.id };
}

// Subscribe to webhook events
export async function POST(request: NextRequest) {
  try {
    // Get session
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { event_action, event_object } = WebhookSubscriptionSchema.parse(body);

    // Get workspace and Pipedrive integration
    const { data: workspaceUser, error: workspaceError } = await supabase
      .from('workspace_users')
      .select('workspace_id, role')
      .eq('user_id', session.user.id)
      .single();

    if (workspaceError || !workspaceUser) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    if (!['owner', 'admin'].includes(workspaceUser.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { workspace_id } = workspaceUser;

    // Get Pipedrive integration
    const { data: integration, error: integrationError } = await supabase
      .from('pipedrive_integrations')
      .select('*')
      .eq('workspace_id', workspace_id)
      .single();

    if (integrationError || !integration) {
      return NextResponse.json({ error: 'Pipedrive not connected' }, { status: 400 });
    }

    // Check if webhook already exists
    const { data: existingWebhook } = await supabase
      .from('pipedrive_webhooks')
      .select('id')
      .eq('workspace_id', workspace_id)
      .eq('event_action', event_action)
      .eq('event_object', event_object)
      .single();

    if (existingWebhook) {
      return NextResponse.json({ 
        message: 'Webhook already subscribed',
        webhook_id: existingWebhook.id 
      });
    }

    // Generate or get webhook secret
    let webhookSecret: string;
    const { data: secretData } = await supabase
      .from('pipedrive_webhook_signatures')
      .select('webhook_secret')
      .eq('workspace_id', workspace_id)
      .eq('is_active', true)
      .single();

    if (secretData) {
      webhookSecret = secretData.webhook_secret;
    } else {
      // Create new webhook secret
      webhookSecret = generateWebhookSecret();
      const { error: secretError } = await supabase
        .from('pipedrive_webhook_signatures')
        .insert({
          workspace_id,
          webhook_secret: webhookSecret,
        });

      if (secretError) {
        throw new Error(`Failed to create webhook secret: ${secretError.message}`);
      }
    }

    // Create webhook URL with workspace ID
    const webhookUrl = new URL(
      `/api/integrations/pipedrive/webhooks?workspace_id=${workspace_id}`,
      process.env.NEXT_PUBLIC_APP_URL!
    ).toString();

    // Create webhook in Pipedrive
    const webhook = await createPipedriveWebhook(
      integration.access_token,
      integration.company_domain,
      event_action,
      event_object,
      webhookUrl
    );

    // Store webhook configuration
    const { data: webhookData, error: webhookError } = await supabase
      .from('pipedrive_webhooks')
      .insert({
        workspace_id,
        pipedrive_webhook_id: webhook.id,
        event_action,
        event_object,
        subscription_url: webhookUrl,
        version: '1.0',
        active: true,
      })
      .select()
      .single();

    if (webhookError) {
      // Try to delete webhook from Pipedrive
      await fetch(
        `https://${integration.company_domain}.pipedrive.com/api/v1/webhooks/${webhook.id}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${integration.access_token}`,
          },
        }
      ).catch(console.error);

      throw new Error(`Failed to store webhook: ${webhookError.message}`);
    }

    // Create default routing rules for this webhook
    const routingRules = [
      {
        workspace_id,
        event_action,
        event_object,
        handler_name: `sync_${event_object}_${event_action}`,
        handler_config: {
          enabled: true,
          sync_fields: true,
          update_activities: true,
        },
        priority: 5,
        is_active: true,
      }
    ];

    await supabase
      .from('pipedrive_webhook_routes')
      .insert(routingRules);

    return NextResponse.json({
      message: 'Webhook subscribed successfully',
      webhook_id: webhookData.id,
      pipedrive_webhook_id: webhook.id,
      event: `${event_object}.${event_action}`,
    });

  } catch (error) {
    console.error('Subscribe webhook error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to subscribe webhook' },
      { status: 500 }
    );
  }
}

// List webhook subscriptions
export async function GET(request: NextRequest) {
  try {
    // Get session
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get workspace
    const { data: workspaceUser, error: workspaceError } = await supabase
      .from('workspace_users')
      .select('workspace_id')
      .eq('user_id', session.user.id)
      .single();

    if (workspaceError || !workspaceUser) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    // Get webhook subscriptions
    const { data: webhooks, error } = await supabase
      .from('pipedrive_webhooks')
      .select(`
        *,
        pipedrive_webhook_routes (
          id,
          handler_name,
          handler_config,
          priority,
          is_active
        )
      `)
      .eq('workspace_id', workspaceUser.workspace_id)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch webhooks: ${error.message}`);
    }

    // Get webhook status
    const { data: statusData } = await supabase
      .from('pipedrive_webhook_status')
      .select('*')
      .eq('workspace_id', workspaceUser.workspace_id);

    const status = statusData?.[0] || null;

    return NextResponse.json({
      webhooks: webhooks || [],
      status: {
        is_healthy: status?.is_healthy ?? true,
        last_event_at: status?.last_event_at,
        last_error_at: status?.last_error_at,
        consecutive_failures: status?.consecutive_failures || 0,
      },
    });

  } catch (error) {
    console.error('List webhooks error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list webhooks' },
      { status: 500 }
    );
  }
}