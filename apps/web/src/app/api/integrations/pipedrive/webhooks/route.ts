import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { z } from 'zod';

// Webhook event schema
const PipedriveWebhookEventSchema = z.object({
  v: z.number().optional(),
  matches_filters: z.object({
    current: z.array(z.any()).optional(),
    previous: z.array(z.any()).optional(),
  }).optional(),
  meta: z.object({
    v: z.number(),
    action: z.enum(['added', 'updated', 'deleted', 'merged']),
    object: z.enum(['person', 'organization', 'deal', 'activity', 'user', 'note', 'file', 'product', 'stage']),
    id: z.number(),
    company_id: z.number(),
    user_id: z.number(),
    host: z.string(),
    timestamp: z.number(),
    timestamp_micro: z.number(),
    permitted_user_ids: z.array(z.number()).optional(),
    trans_pending: z.boolean().optional(),
    is_bulk_update: z.boolean().optional(),
    pipedrive_service_name: z.string().optional(),
    change_source: z.string().optional(),
    matches_filters: z.object({
      current: z.array(z.any()).optional(),
      previous: z.array(z.any()).optional(),
    }).optional(),
  }),
  retry_object: z.any().optional(),
  current: z.any().optional(),
  previous: z.any().optional(),
  event: z.string().optional(),
  retry: z.number().optional(),
});

type PipedriveWebhookEvent = z.infer<typeof PipedriveWebhookEventSchema>;

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Verify webhook signature
async function verifyWebhookSignature(
  request: NextRequest,
  body: string,
  workspaceId: string
): Promise<boolean> {
  const signature = request.headers.get('x-pipedrive-signature');
  if (!signature) {
    console.error('Missing webhook signature');
    return false;
  }

  try {
    // Get active webhook secret for workspace
    const { data: secretData, error } = await supabase
      .from('pipedrive_webhook_signatures')
      .select('webhook_secret')
      .eq('workspace_id', workspaceId)
      .eq('is_active', true)
      .single();

    if (error || !secretData) {
      console.error('Failed to get webhook secret:', error);
      return false;
    }

    // Calculate expected signature
    const hmac = crypto.createHmac('sha256', secretData.webhook_secret);
    hmac.update(body);
    const expectedSignature = hmac.digest('hex');

    // Compare signatures
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch (error) {
    console.error('Error verifying webhook signature:', error);
    return false;
  }
}

// Get workspace ID from webhook URL or headers
async function getWorkspaceId(request: NextRequest): Promise<string | null> {
  // Try to get from URL query params
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get('workspace_id');
  
  if (workspaceId) {
    return workspaceId;
  }

  // Try to get from custom header
  const customWorkspaceId = request.headers.get('x-workspace-id');
  if (customWorkspaceId) {
    return customWorkspaceId;
  }

  return null;
}

// Process webhook event
async function processWebhookEvent(
  event: PipedriveWebhookEvent,
  workspaceId: string
): Promise<void> {
  const eventId = `${event.meta.company_id}-${event.meta.object}-${event.meta.id}-${event.meta.timestamp_micro}`;
  
  try {
    // Check for duplicate event
    const { data: existingEvent } = await supabase
      .from('pipedrive_webhook_events')
      .select('id')
      .eq('event_id', eventId)
      .single();

    if (existingEvent) {
      console.log(`Duplicate event ${eventId}, skipping`);
      return;
    }

    // Store webhook event
    const { error: insertError } = await supabase
      .from('pipedrive_webhook_events')
      .insert({
        workspace_id: workspaceId,
        event_id: eventId,
        event_action: event.meta.action,
        event_object: event.meta.object,
        object_id: event.meta.id,
        retry_object: event.retry_object,
        current_data: event.current || {},
        previous_data: event.previous || null,
        meta_data: event.meta,
        user_id: event.meta.user_id,
        company_id: event.meta.company_id,
        event_time: new Date(event.meta.timestamp * 1000).toISOString(),
        processing_status: 'pending',
      });

    if (insertError) {
      throw new Error(`Failed to store webhook event: ${insertError.message}`);
    }

    // Update sync metrics
    await supabase.rpc('update_pipedrive_sync_metrics', {
      p_workspace_id: workspaceId,
      p_entity_type: event.meta.object,
      p_events_received: 1,
    });

    // Update webhook status
    await supabase
      .from('pipedrive_webhook_status')
      .upsert({
        workspace_id: workspaceId,
        webhook_url: new URL('/api/integrations/pipedrive/webhooks', process.env.NEXT_PUBLIC_APP_URL!).toString(),
        last_event_at: new Date().toISOString(),
        consecutive_failures: 0,
        is_healthy: true,
      });

  } catch (error) {
    console.error(`Error processing webhook event ${eventId}:`, error);
    throw error;
  }
}

// Main webhook handler
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Get workspace ID
    const workspaceId = await getWorkspaceId(request);
    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Missing workspace_id' },
        { status: 400 }
      );
    }

    // Read request body
    const body = await request.text();
    
    // Verify signature
    const isValidSignature = await verifyWebhookSignature(request, body, workspaceId);
    if (!isValidSignature) {
      console.error('Invalid webhook signature for workspace:', workspaceId);
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    // Parse webhook event
    let event: PipedriveWebhookEvent;
    try {
      const parsedBody = JSON.parse(body);
      event = PipedriveWebhookEventSchema.parse(parsedBody);
    } catch (error) {
      console.error('Invalid webhook payload:', error);
      return NextResponse.json(
        { error: 'Invalid payload' },
        { status: 400 }
      );
    }

    // Process the event asynchronously
    processWebhookEvent(event, workspaceId).catch(error => {
      console.error('Background processing error:', error);
      // Update webhook status on failure
      supabase
        .from('pipedrive_webhook_status')
        .upsert({
          workspace_id: workspaceId,
          webhook_url: new URL('/api/integrations/pipedrive/webhooks', process.env.NEXT_PUBLIC_APP_URL!).toString(),
          last_error_at: new Date().toISOString(),
          last_error_message: error.message,
          consecutive_failures: 1, // This would need to be incremented properly
          is_healthy: false,
        })
        .catch(statusError => console.error('Failed to update webhook status:', statusError));
    });

    // Return immediate success response
    const processingTime = Date.now() - startTime;
    return NextResponse.json(
      { 
        status: 'accepted',
        event_id: `${event.meta.company_id}-${event.meta.object}-${event.meta.id}-${event.meta.timestamp_micro}`,
        processing_time_ms: processingTime
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Webhook handler error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspace_id');

    if (!workspaceId) {
      return NextResponse.json({
        status: 'healthy',
        message: 'Webhook endpoint is running',
      });
    }

    // Get webhook status for specific workspace
    const { data: status, error } = await supabase
      .from('pipedrive_webhook_status')
      .select('*')
      .eq('workspace_id', workspaceId)
      .single();

    if (error && error.code !== 'PGRST116') { // Not found error
      throw error;
    }

    return NextResponse.json({
      status: status?.is_healthy ? 'healthy' : 'unhealthy',
      last_event_at: status?.last_event_at,
      last_error_at: status?.last_error_at,
      last_error_message: status?.last_error_message,
      consecutive_failures: status?.consecutive_failures || 0,
    });

  } catch (error) {
    console.error('Health check error:', error);
    return NextResponse.json(
      { status: 'error', error: 'Failed to check health' },
      { status: 500 }
    );
  }
}