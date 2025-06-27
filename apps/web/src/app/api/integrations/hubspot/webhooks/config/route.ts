import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { HubSpotClient } from '@/lib/integrations/hubspot/client';
import { HubSpotAuth } from '@/lib/integrations/hubspot/auth';
import { z } from 'zod';

// Webhook subscription schema
const webhookConfigSchema = z.object({
  subscriptions: z.array(z.object({
    eventType: z.string(),
    propertyName: z.string().optional(),
    enabled: z.boolean(),
  })),
});

// Available webhook subscriptions
const AVAILABLE_SUBSCRIPTIONS = [
  // Contact events
  { eventType: 'contact.creation', description: 'When a contact is created' },
  { eventType: 'contact.deletion', description: 'When a contact is deleted' },
  { eventType: 'contact.merge', description: 'When contacts are merged' },
  { eventType: 'contact.propertyChange', propertyName: 'email', description: 'When email changes' },
  { eventType: 'contact.propertyChange', propertyName: 'firstname', description: 'When first name changes' },
  { eventType: 'contact.propertyChange', propertyName: 'lastname', description: 'When last name changes' },
  { eventType: 'contact.propertyChange', propertyName: 'company', description: 'When company changes' },
  { eventType: 'contact.propertyChange', propertyName: 'lifecyclestage', description: 'When lifecycle stage changes' },
  
  // Company events
  { eventType: 'company.creation', description: 'When a company is created' },
  { eventType: 'company.deletion', description: 'When a company is deleted' },
  { eventType: 'company.propertyChange', propertyName: 'name', description: 'When company name changes' },
  
  // Deal events
  { eventType: 'deal.creation', description: 'When a deal is created' },
  { eventType: 'deal.deletion', description: 'When a deal is deleted' },
  { eventType: 'deal.propertyChange', propertyName: 'dealstage', description: 'When deal stage changes' },
  { eventType: 'deal.propertyChange', propertyName: 'amount', description: 'When deal amount changes' },
  
  // Engagement events
  { eventType: 'engagement.creation', description: 'When an engagement is created' },
];

// GET webhook configuration
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient(cookies());
    
    // Check authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get workspace
    const workspaceId = request.headers.get('x-workspace-id');
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID required' }, { status: 400 });
    }

    // Check permissions
    const { data: member } = await supabase
      .from('workspace_users')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single();

    if (!member || !['owner', 'admin'].includes(member.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Get integration
    const { data: integration } = await supabase
      .from('integrations')
      .select('id, settings')
      .eq('workspace_id', workspaceId)
      .eq('provider', 'hubspot')
      .eq('is_active', true)
      .single();

    if (!integration) {
      return NextResponse.json({ error: 'HubSpot integration not found' }, { status: 404 });
    }

    // Get current webhook subscriptions
    const { data: subscriptions } = await supabase
      .from('hubspot_webhook_subscriptions')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('is_active', true);

    // Format response
    const activeSubscriptions = subscriptions?.map(sub => ({
      id: sub.id,
      eventType: sub.event_type,
      propertyName: sub.property_name,
      enabled: sub.is_active,
      createdAt: sub.created_at,
    })) || [];

    return NextResponse.json({
      webhookUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/hubspot/webhooks`,
      availableSubscriptions: AVAILABLE_SUBSCRIPTIONS,
      activeSubscriptions,
    });
  } catch (error) {
    console.error('Get webhook config error:', error);
    return NextResponse.json(
      { error: 'Failed to get webhook configuration' },
      { status: 500 }
    );
  }
}

// POST update webhook configuration
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient(cookies());
    
    // Check authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get workspace
    const workspaceId = request.headers.get('x-workspace-id');
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID required' }, { status: 400 });
    }

    // Check permissions
    const { data: member } = await supabase
      .from('workspace_users')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single();

    if (!member || !['owner', 'admin'].includes(member.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Parse request body
    const body = await request.json();
    const { subscriptions } = webhookConfigSchema.parse(body);

    // Get integration and credentials
    const { data: integration } = await supabase
      .from('integrations')
      .select('id, provider_account_id')
      .eq('workspace_id', workspaceId)
      .eq('provider', 'hubspot')
      .eq('is_active', true)
      .single();

    if (!integration) {
      return NextResponse.json({ error: 'HubSpot integration not found' }, { status: 404 });
    }

    const auth = new HubSpotAuth();
    const accessToken = await auth.getValidAccessToken(workspaceId);
    const client = new HubSpotClient(accessToken);

    // Get or create webhook app
    const appId = await getOrCreateWebhookApp(client, integration.provider_account_id);

    // Update subscriptions in HubSpot
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/hubspot/webhooks`;
    
    // Delete existing subscriptions
    const existingSubscriptions = await client.get(`/webhooks/v3/${appId}/subscriptions`);
    for (const sub of existingSubscriptions.results || []) {
      await client.delete(`/webhooks/v3/${appId}/subscriptions/${sub.id}`);
    }

    // Create new subscriptions
    for (const sub of subscriptions) {
      if (sub.enabled) {
        const subscriptionData: any = {
          eventType: sub.eventType,
          active: true,
        };
        
        if (sub.propertyName) {
          subscriptionData.propertyName = sub.propertyName;
        }
        
        await client.post(`/webhooks/v3/${appId}/subscriptions`, subscriptionData);
      }
    }

    // Update local database
    // Deactivate all existing subscriptions
    await supabase
      .from('hubspot_webhook_subscriptions')
      .update({ is_active: false })
      .eq('workspace_id', workspaceId);

    // Insert new active subscriptions
    const newSubscriptions = subscriptions
      .filter(sub => sub.enabled)
      .map(sub => ({
        workspace_id: workspaceId,
        event_type: sub.eventType,
        property_name: sub.propertyName,
        is_active: true,
      }));

    if (newSubscriptions.length > 0) {
      await supabase
        .from('hubspot_webhook_subscriptions')
        .insert(newSubscriptions);
    }

    return NextResponse.json({
      success: true,
      message: 'Webhook configuration updated',
      activeSubscriptions: newSubscriptions.length,
    });
  } catch (error) {
    console.error('Update webhook config error:', error);
    return NextResponse.json(
      { error: 'Failed to update webhook configuration' },
      { status: 500 }
    );
  }
}

// Get or create webhook app in HubSpot
async function getOrCreateWebhookApp(
  client: HubSpotClient,
  portalId: string
): Promise<string> {
  // Check if app already exists
  const apps = await client.get('/webhooks/v3/apps');
  
  const existingApp = apps.results?.find(
    (app: any) => app.name === 'ColdCopy Integration'
  );
  
  if (existingApp) {
    return existingApp.id;
  }
  
  // Create new app
  const newApp = await client.post('/webhooks/v3/apps', {
    name: 'ColdCopy Integration',
    description: 'ColdCopy email automation integration',
  });
  
  return newApp.id;
}