import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { 
  createWorkflowTriggerService, 
  EmailEngagementEvent,
  EmailEngagementEventType 
} from '@/lib/integrations/hubspot/workflows';

// This endpoint can be called by your email tracking system
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient(cookies());
    
    // Verify API key or webhook signature
    const apiKey = request.headers.get('X-API-Key');
    if (!apiKey) {
      return NextResponse.json({ error: 'API key required' }, { status: 401 });
    }

    // Validate API key (you should implement proper validation)
    // For now, we'll use a simple check
    if (apiKey !== process.env.INTERNAL_API_KEY) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const body = await request.json();
    const { 
      workspaceId,
      eventType,
      emailId,
      campaignId,
      leadId,
      leadEmail,
      metadata = {}
    } = body;

    // Validate required fields
    if (!workspaceId || !eventType || !emailId || !campaignId || !leadId || !leadEmail) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate event type
    const validEventTypes: EmailEngagementEventType[] = [
      'email_sent',
      'email_opened',
      'email_clicked',
      'email_replied',
      'email_bounced',
      'email_unsubscribed'
    ];

    if (!validEventTypes.includes(eventType)) {
      return NextResponse.json(
        { error: 'Invalid event type' },
        { status: 400 }
      );
    }

    // Get HubSpot contact ID if available
    const { data: syncStatus } = await supabase
      .from('hubspot_sync_status')
      .select('hubspot_id')
      .eq('workspace_id', workspaceId)
      .eq('entity_type', 'contact')
      .eq('entity_id', leadId)
      .single();

    // Create engagement event
    const event: EmailEngagementEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      workspaceId,
      eventType,
      emailId,
      campaignId,
      leadId,
      leadEmail,
      hubspotContactId: syncStatus?.hubspot_id,
      timestamp: new Date(),
      metadata
    };

    // Process the event
    const service = createWorkflowTriggerService(workspaceId);
    await service.processEngagementEvent(event);

    // Log the event
    await supabase
      .from('email_events')
      .insert({
        workspace_id: workspaceId,
        email_id: emailId,
        campaign_id: campaignId,
        lead_id: leadId,
        event_type: eventType,
        metadata,
        created_at: new Date().toISOString()
      });

    return NextResponse.json({ 
      success: true,
      eventId: event.id,
      message: 'Engagement event processed successfully'
    });
  } catch (error) {
    console.error('Error processing engagement event:', error);
    return NextResponse.json(
      { error: 'Failed to process engagement event' },
      { status: 500 }
    );
  }
}

// Batch process multiple events
export async function PUT(request: NextRequest) {
  try {
    const supabase = createServerClient(cookies());
    
    // Verify API key
    const apiKey = request.headers.get('X-API-Key');
    if (!apiKey || apiKey !== process.env.INTERNAL_API_KEY) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const body = await request.json();
    const { workspaceId, events } = body;

    if (!workspaceId || !Array.isArray(events)) {
      return NextResponse.json(
        { error: 'Invalid request format' },
        { status: 400 }
      );
    }

    const service = createWorkflowTriggerService(workspaceId);
    const results = [];

    for (const eventData of events) {
      try {
        // Get HubSpot contact ID
        const { data: syncStatus } = await supabase
          .from('hubspot_sync_status')
          .select('hubspot_id')
          .eq('workspace_id', workspaceId)
          .eq('entity_type', 'contact')
          .eq('entity_id', eventData.leadId)
          .single();

        const event: EmailEngagementEvent = {
          id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          workspaceId,
          eventType: eventData.eventType,
          emailId: eventData.emailId,
          campaignId: eventData.campaignId,
          leadId: eventData.leadId,
          leadEmail: eventData.leadEmail,
          hubspotContactId: syncStatus?.hubspot_id,
          timestamp: new Date(eventData.timestamp || Date.now()),
          metadata: eventData.metadata || {}
        };

        await service.processEngagementEvent(event);
        
        results.push({
          eventId: event.id,
          status: 'success'
        });
      } catch (error: any) {
        results.push({
          eventId: eventData.emailId,
          status: 'failed',
          error: error.message
        });
      }
    }

    // Log batch events
    const eventInserts = events.map(eventData => ({
      workspace_id: workspaceId,
      email_id: eventData.emailId,
      campaign_id: eventData.campaignId,
      lead_id: eventData.leadId,
      event_type: eventData.eventType,
      metadata: eventData.metadata || {},
      created_at: new Date(eventData.timestamp || Date.now()).toISOString()
    }));

    await supabase
      .from('email_events')
      .insert(eventInserts);

    const successCount = results.filter(r => r.status === 'success').length;
    const failedCount = results.filter(r => r.status === 'failed').length;

    return NextResponse.json({ 
      success: true,
      processed: results.length,
      successful: successCount,
      failed: failedCount,
      results
    });
  } catch (error) {
    console.error('Error batch processing engagement events:', error);
    return NextResponse.json(
      { error: 'Failed to batch process engagement events' },
      { status: 500 }
    );
  }
}