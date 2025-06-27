import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Event handlers by type
const eventHandlers: Record<string, (event: any, workspace: string) => Promise<void>> = {
  'person.added': handlePersonAdded,
  'person.updated': handlePersonUpdated,
  'person.deleted': handlePersonDeleted,
  'deal.added': handleDealAdded,
  'deal.updated': handleDealUpdated,
  'deal.deleted': handleDealDeleted,
  'activity.added': handleActivityAdded,
  'activity.updated': handleActivityUpdated,
  'activity.deleted': handleActivityDeleted,
};

// Person event handlers
async function handlePersonAdded(event: any, workspaceId: string) {
  const person = event.current;
  
  // Check if lead already exists
  const { data: existingLead } = await supabase
    .from('leads')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('email', person.email?.[0]?.value)
    .single();

  if (existingLead) {
    // Update sync status
    await supabase
      .from('pipedrive_sync_status')
      .upsert({
        workspace_id: workspaceId,
        entity_type: 'person',
        entity_id: existingLead.id,
        pipedrive_id: person.id,
        last_synced_at: new Date().toISOString(),
        sync_hash: JSON.stringify(person),
        status: 'synced',
      });
    return;
  }

  // Create new lead
  const { data: newLead, error } = await supabase
    .from('leads')
    .insert({
      workspace_id: workspaceId,
      email: person.email?.[0]?.value || '',
      first_name: person.first_name || '',
      last_name: person.last_name || '',
      company: person.org_name || '',
      phone: person.phone?.[0]?.value || '',
      metadata: {
        pipedrive_id: person.id,
        pipedrive_data: person,
      },
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create lead: ${error.message}`);
  }

  // Create sync status
  await supabase
    .from('pipedrive_sync_status')
    .insert({
      workspace_id: workspaceId,
      entity_type: 'person',
      entity_id: newLead.id,
      pipedrive_id: person.id,
      last_synced_at: new Date().toISOString(),
      sync_hash: JSON.stringify(person),
      status: 'synced',
    });
}

async function handlePersonUpdated(event: any, workspaceId: string) {
  const person = event.current;
  const previous = event.previous;

  // Find lead by Pipedrive ID
  const { data: syncStatus } = await supabase
    .from('pipedrive_sync_status')
    .select('entity_id, sync_hash')
    .eq('workspace_id', workspaceId)
    .eq('entity_type', 'person')
    .eq('pipedrive_id', person.id)
    .single();

  if (!syncStatus) {
    // Person not synced yet, add it
    await handlePersonAdded(event, workspaceId);
    return;
  }

  // Check if there's a conflict (lead was also updated in ColdCopy)
  const currentHash = JSON.stringify(person);
  if (syncStatus.sync_hash !== JSON.stringify(previous)) {
    // Conflict detected
    await supabase
      .from('pipedrive_sync_conflicts')
      .insert({
        workspace_id: workspaceId,
        entity_type: 'person',
        entity_id: syncStatus.entity_id,
        pipedrive_id: person.id,
        conflict_type: 'concurrent_update',
        coldcopy_data: {}, // Would need to fetch current lead data
        pipedrive_data: person,
      });
    return;
  }

  // Update lead
  const { error } = await supabase
    .from('leads')
    .update({
      email: person.email?.[0]?.value || '',
      first_name: person.first_name || '',
      last_name: person.last_name || '',
      company: person.org_name || '',
      phone: person.phone?.[0]?.value || '',
      metadata: {
        pipedrive_id: person.id,
        pipedrive_data: person,
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', syncStatus.entity_id);

  if (error) {
    throw new Error(`Failed to update lead: ${error.message}`);
  }

  // Update sync status
  await supabase
    .from('pipedrive_sync_status')
    .update({
      last_synced_at: new Date().toISOString(),
      sync_hash: currentHash,
      status: 'synced',
    })
    .eq('workspace_id', workspaceId)
    .eq('entity_type', 'person')
    .eq('pipedrive_id', person.id);
}

async function handlePersonDeleted(event: any, workspaceId: string) {
  const personId = event.meta.id;

  // Find lead by Pipedrive ID
  const { data: syncStatus } = await supabase
    .from('pipedrive_sync_status')
    .select('entity_id')
    .eq('workspace_id', workspaceId)
    .eq('entity_type', 'person')
    .eq('pipedrive_id', personId)
    .single();

  if (!syncStatus) {
    return; // Person was not synced
  }

  // Soft delete lead
  await supabase
    .from('leads')
    .update({
      deleted_at: new Date().toISOString(),
      metadata: supabase.raw(`metadata || '{"deleted_from_pipedrive": true}'::jsonb`),
    })
    .eq('id', syncStatus.entity_id);

  // Update sync status
  await supabase
    .from('pipedrive_sync_status')
    .update({
      status: 'deleted',
      last_synced_at: new Date().toISOString(),
    })
    .eq('workspace_id', workspaceId)
    .eq('entity_type', 'person')
    .eq('pipedrive_id', personId);
}

// Deal event handlers
async function handleDealAdded(event: any, workspaceId: string) {
  const deal = event.current;

  // Log deal creation
  await supabase
    .from('pipedrive_activity_log')
    .insert({
      workspace_id: workspaceId,
      pipedrive_deal_id: deal.id,
      pipedrive_person_id: deal.person_id,
      activity_type: 'deal_created',
      activity_data: deal,
    });

  // Update stage history
  if (deal.stage_id) {
    await supabase
      .from('pipedrive_stage_history')
      .insert({
        workspace_id: workspaceId,
        deal_id: deal.id,
        stage_id: deal.stage_id,
        changed_at: new Date().toISOString(),
        probability: deal.probability || 0,
        deal_value: deal.value || 0,
      });
  }
}

async function handleDealUpdated(event: any, workspaceId: string) {
  const deal = event.current;
  const previous = event.previous;

  // Check if stage changed
  if (previous.stage_id !== deal.stage_id) {
    // Calculate duration in previous stage
    const { data: lastStageChange } = await supabase
      .from('pipedrive_stage_history')
      .select('changed_at')
      .eq('workspace_id', workspaceId)
      .eq('deal_id', deal.id)
      .order('changed_at', { ascending: false })
      .limit(1)
      .single();

    const duration = lastStageChange
      ? new Date().getTime() - new Date(lastStageChange.changed_at).getTime()
      : null;

    // Insert new stage history
    await supabase
      .from('pipedrive_stage_history')
      .insert({
        workspace_id: workspaceId,
        deal_id: deal.id,
        stage_id: deal.stage_id,
        previous_stage_id: previous.stage_id,
        changed_at: new Date().toISOString(),
        duration_in_stage: duration ? `${duration} milliseconds` : null,
        changed_by_user_id: event.meta.user_id,
        probability: deal.probability || 0,
        deal_value: deal.value || 0,
      });

    // Check for stage mapping triggers
    const { data: stageMapping } = await supabase
      .from('pipedrive_stage_mappings')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('pipedrive_stage_id', deal.stage_id)
      .single();

    if (stageMapping?.trigger_actions) {
      // Queue triggered actions
      for (const action of stageMapping.trigger_actions) {
        await supabase
          .from('pipedrive_sync_queue')
          .insert({
            workspace_id: workspaceId,
            operation: 'update',
            entity_type: 'deal',
            entity_id: deal.id,
            pipedrive_id: deal.id,
            data: {
              action: action.type,
              params: action.params,
              deal,
            },
            priority: 8,
          });
      }
    }
  }

  // Log deal update
  await supabase
    .from('pipedrive_activity_log')
    .insert({
      workspace_id: workspaceId,
      pipedrive_deal_id: deal.id,
      pipedrive_person_id: deal.person_id,
      activity_type: 'deal_updated',
      activity_data: {
        current: deal,
        previous,
        changed_fields: Object.keys(deal).filter(
          key => JSON.stringify(deal[key]) !== JSON.stringify(previous[key])
        ),
      },
    });
}

async function handleDealDeleted(event: any, workspaceId: string) {
  const dealId = event.meta.id;

  // Log deal deletion
  await supabase
    .from('pipedrive_activity_log')
    .insert({
      workspace_id: workspaceId,
      pipedrive_deal_id: dealId,
      activity_type: 'deal_deleted',
      activity_data: event.previous || {},
    });
}

// Activity event handlers
async function handleActivityAdded(event: any, workspaceId: string) {
  const activity = event.current;

  await supabase
    .from('pipedrive_activity_log')
    .insert({
      workspace_id: workspaceId,
      pipedrive_person_id: activity.person_id,
      pipedrive_deal_id: activity.deal_id,
      activity_type: `activity_${activity.type}_created`,
      activity_data: activity,
    });
}

async function handleActivityUpdated(event: any, workspaceId: string) {
  const activity = event.current;

  await supabase
    .from('pipedrive_activity_log')
    .insert({
      workspace_id: workspaceId,
      pipedrive_person_id: activity.person_id,
      pipedrive_deal_id: activity.deal_id,
      activity_type: `activity_${activity.type}_updated`,
      activity_data: activity,
    });
}

async function handleActivityDeleted(event: any, workspaceId: string) {
  const activityId = event.meta.id;

  await supabase
    .from('pipedrive_activity_log')
    .insert({
      workspace_id: workspaceId,
      activity_type: 'activity_deleted',
      activity_data: { activity_id: activityId },
    });
}

// Process webhook events from queue
export async function POST(request: NextRequest) {
  try {
    // This endpoint should be called by a cron job or background worker
    // For now, we'll require authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const startTime = Date.now();
    let processedCount = 0;
    let failedCount = 0;

    // Get pending webhook events
    const { data: events, error } = await supabase
      .from('pipedrive_webhook_events')
      .select('*')
      .eq('processing_status', 'pending')
      .order('created_at', { ascending: true })
      .limit(50);

    if (error) {
      throw new Error(`Failed to fetch webhook events: ${error.message}`);
    }

    // Process each event
    for (const event of events || []) {
      try {
        // Update status to processing
        await supabase
          .from('pipedrive_webhook_events')
          .update({ processing_status: 'processing' })
          .eq('id', event.id);

        // Get handler
        const handlerKey = `${event.event_object}.${event.event_action}`;
        const handler = eventHandlers[handlerKey];

        if (!handler) {
          console.warn(`No handler for event type: ${handlerKey}`);
          await supabase
            .from('pipedrive_webhook_events')
            .update({ 
              processing_status: 'skipped',
              error_message: `No handler for event type: ${handlerKey}`,
            })
            .eq('id', event.id);
          continue;
        }

        // Process event
        await handler(event, event.workspace_id);

        // Mark as completed
        await supabase
          .from('pipedrive_webhook_events')
          .update({ 
            processing_status: 'completed',
            processed_at: new Date().toISOString(),
          })
          .eq('id', event.id);

        processedCount++;

        // Update metrics
        await supabase.rpc('update_pipedrive_sync_metrics', {
          p_workspace_id: event.workspace_id,
          p_entity_type: event.event_object,
          p_events_processed: 1,
          p_processing_time_ms: Date.now() - startTime,
        });

      } catch (error) {
        console.error(`Error processing event ${event.id}:`, error);
        failedCount++;

        // Mark as failed and schedule retry
        await supabase
          .from('pipedrive_webhook_events')
          .update({
            processing_status: 'failed',
            error_message: error instanceof Error ? error.message : 'Unknown error',
            retry_count: event.retry_count + 1,
            next_retry_at: new Date(Date.now() + Math.pow(2, event.retry_count) * 60000).toISOString(),
          })
          .eq('id', event.id);

        // Update metrics
        await supabase.rpc('update_pipedrive_sync_metrics', {
          p_workspace_id: event.workspace_id,
          p_entity_type: event.event_object,
          p_events_failed: 1,
        });
      }
    }

    const processingTime = Date.now() - startTime;

    return NextResponse.json({
      processed: processedCount,
      failed: failedCount,
      processing_time_ms: processingTime,
    });

  } catch (error) {
    console.error('Process webhook events error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process events' },
      { status: 500 }
    );
  }
}

// Retry failed events
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Reset failed events for retry
    const { data: events, error } = await supabase
      .from('pipedrive_webhook_events')
      .update({
        processing_status: 'pending',
        retry_count: 0,
        next_retry_at: null,
      })
      .eq('processing_status', 'failed')
      .lte('retry_count', 3)
      .select();

    if (error) {
      throw new Error(`Failed to reset events: ${error.message}`);
    }

    return NextResponse.json({
      message: 'Failed events reset for retry',
      count: events?.length || 0,
    });

  } catch (error) {
    console.error('Retry events error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to retry events' },
      { status: 500 }
    );
  }
}