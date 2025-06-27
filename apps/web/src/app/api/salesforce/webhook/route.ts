import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { SalesforceAuth } from '@/lib/integrations/salesforce/auth';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('x-salesforce-signature');
    const workspaceId = request.headers.get('x-workspace-id');

    if (!signature || !workspaceId) {
      return NextResponse.json(
        { error: 'Missing required headers' },
        { status: 400 }
      );
    }

    const supabase = createClient();

    // Get integration to verify webhook secret
    const { data: integration, error: integrationError } = await supabase
      .from('salesforce_integrations')
      .select('webhook_secret')
      .eq('workspace_id', workspaceId)
      .single();

    if (integrationError || !integration || !integration.webhook_secret) {
      return NextResponse.json(
        { error: 'Integration not found' },
        { status: 404 }
      );
    }

    // Verify webhook signature
    const auth = new SalesforceAuth({
      client_id: process.env.SALESFORCE_CLIENT_ID!,
      client_secret: process.env.SALESFORCE_CLIENT_SECRET!,
      redirect_uri: process.env.SALESFORCE_REDIRECT_URI!,
    });

    const isValid = auth.verifyWebhookSignature(
      body,
      signature,
      integration.webhook_secret
    );

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    // Parse webhook payload
    const payload = JSON.parse(body);
    
    // Handle different webhook event types
    if (payload.sobject) {
      // Object change event
      const { sobject, event, recordId } = payload;
      
      // Store webhook event
      const { data: webhookEvent, error: webhookError } = await supabase
        .from('salesforce_webhook_events')
        .insert({
          workspace_id: workspaceId,
          event_type: event.type,
          object_type: sobject,
          salesforce_id: recordId,
          change_type: event.type.toLowerCase(),
          payload: payload,
          event_date: new Date().toISOString(),
        })
        .select()
        .single();

      if (webhookError) {
        console.error('Error storing webhook event:', webhookError);
        return NextResponse.json(
          { error: 'Failed to store webhook event' },
          { status: 500 }
        );
      }

      // Process the webhook event
      await processWebhookEvent(workspaceId, webhookEvent.id, payload);
    } else if (payload.data) {
      // Platform event or streaming API event
      const events = Array.isArray(payload.data) ? payload.data : [payload.data];
      
      for (const event of events) {
        await supabase
          .from('salesforce_webhook_events')
          .insert({
            workspace_id: workspaceId,
            event_type: event.type || 'platform_event',
            object_type: event.sobject || 'Unknown',
            salesforce_id: event.recordId || event.Id,
            change_type: event.changeType || 'updated',
            payload: event,
            replay_id: event.replayId,
            event_date: event.createdDate || new Date().toISOString(),
          });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Salesforce webhook error:', error);
    return NextResponse.json(
      { error: 'Failed to process webhook' },
      { status: 500 }
    );
  }
}

async function processWebhookEvent(
  workspaceId: string,
  eventId: string,
  payload: any
): Promise<void> {
  const supabase = createClient();

  try {
    // Add to sync queue for processing
    await supabase.rpc('process_salesforce_webhook', {
      p_workspace_id: workspaceId,
      p_event_type: payload.event.type,
      p_object_type: payload.sobject,
      p_salesforce_id: payload.recordId,
      p_change_type: payload.event.type.toLowerCase(),
      p_payload: payload,
    });

    // Mark webhook as processed
    await supabase
      .from('salesforce_webhook_events')
      .update({
        processed: true,
        processed_at: new Date().toISOString(),
      })
      .eq('id', eventId);
  } catch (error) {
    console.error('Error processing webhook event:', error);
    
    // Update webhook with error
    await supabase
      .from('salesforce_webhook_events')
      .update({
        processing_error: String(error),
      })
      .eq('id', eventId);
  }
}

// Salesforce requires a GET endpoint for webhook verification
export async function GET(request: NextRequest) {
  // Return challenge for webhook verification
  const searchParams = request.nextUrl.searchParams;
  const challenge = searchParams.get('hub.challenge');
  const mode = searchParams.get('hub.mode');
  const verifyToken = searchParams.get('hub.verify_token');

  if (mode === 'subscribe' && verifyToken === process.env.SALESFORCE_WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  return NextResponse.json({ status: 'ok' });
}