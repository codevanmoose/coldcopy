import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { z } from 'zod';

// Unsubscribe schema
const UnsubscribeSchema = z.object({
  webhook_id: z.string().uuid(),
});

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Delete webhook from Pipedrive
async function deletePipedriveWebhook(
  accessToken: string,
  companyDomain: string,
  webhookId: number
): Promise<void> {
  const response = await fetch(
    `https://${companyDomain}.pipedrive.com/api/v1/webhooks/${webhookId}`,
    {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok && response.status !== 404) {
    const error = await response.json();
    throw new Error(`Failed to delete webhook: ${error.error || response.statusText}`);
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get session
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { webhook_id } = UnsubscribeSchema.parse(body);

    // Get workspace
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

    // Get webhook details
    const { data: webhook, error: webhookError } = await supabase
      .from('pipedrive_webhooks')
      .select('*')
      .eq('id', webhook_id)
      .eq('workspace_id', workspace_id)
      .single();

    if (webhookError || !webhook) {
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
    }

    // Get Pipedrive integration
    const { data: integration, error: integrationError } = await supabase
      .from('pipedrive_integrations')
      .select('*')
      .eq('workspace_id', workspace_id)
      .single();

    if (integrationError || !integration) {
      return NextResponse.json({ error: 'Pipedrive not connected' }, { status: 400 });
    }

    // Delete webhook from Pipedrive
    try {
      await deletePipedriveWebhook(
        integration.access_token,
        integration.company_domain,
        webhook.pipedrive_webhook_id
      );
    } catch (error) {
      console.error('Failed to delete webhook from Pipedrive:', error);
      // Continue with local deletion even if Pipedrive deletion fails
    }

    // Delete webhook from database
    const { error: deleteError } = await supabase
      .from('pipedrive_webhooks')
      .delete()
      .eq('id', webhook_id)
      .eq('workspace_id', workspace_id);

    if (deleteError) {
      throw new Error(`Failed to delete webhook: ${deleteError.message}`);
    }

    // Delete associated routing rules
    await supabase
      .from('pipedrive_webhook_routes')
      .delete()
      .eq('workspace_id', workspace_id)
      .eq('event_action', webhook.event_action)
      .eq('event_object', webhook.event_object);

    return NextResponse.json({
      message: 'Webhook unsubscribed successfully',
      webhook_id,
    });

  } catch (error) {
    console.error('Unsubscribe webhook error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to unsubscribe webhook' },
      { status: 500 }
    );
  }
}

// Unsubscribe from all webhooks
export async function DELETE(request: NextRequest) {
  try {
    // Get session
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get workspace
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

    // Get all webhooks
    const { data: webhooks, error: webhooksError } = await supabase
      .from('pipedrive_webhooks')
      .select('*')
      .eq('workspace_id', workspace_id);

    if (webhooksError) {
      throw new Error(`Failed to fetch webhooks: ${webhooksError.message}`);
    }

    // Get Pipedrive integration
    const { data: integration } = await supabase
      .from('pipedrive_integrations')
      .select('*')
      .eq('workspace_id', workspace_id)
      .single();

    // Delete each webhook from Pipedrive
    if (integration && webhooks) {
      const deletePromises = webhooks.map(webhook =>
        deletePipedriveWebhook(
          integration.access_token,
          integration.company_domain,
          webhook.pipedrive_webhook_id
        ).catch(error => {
          console.error(`Failed to delete webhook ${webhook.id} from Pipedrive:`, error);
        })
      );

      await Promise.all(deletePromises);
    }

    // Delete all webhooks from database
    const { error: deleteError } = await supabase
      .from('pipedrive_webhooks')
      .delete()
      .eq('workspace_id', workspace_id);

    if (deleteError) {
      throw new Error(`Failed to delete webhooks: ${deleteError.message}`);
    }

    // Delete all routing rules
    await supabase
      .from('pipedrive_webhook_routes')
      .delete()
      .eq('workspace_id', workspace_id);

    return NextResponse.json({
      message: 'All webhooks unsubscribed successfully',
      count: webhooks?.length || 0,
    });

  } catch (error) {
    console.error('Unsubscribe all webhooks error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to unsubscribe webhooks' },
      { status: 500 }
    );
  }
}