import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { headers } from 'next/headers';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Verify cron secret
function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = headers().get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || !authHeader) {
    return false;
  }

  const token = authHeader.replace('Bearer ', '');
  return token === cronSecret;
}

// Process webhook events
async function processWebhookEvents(): Promise<{
  processed: number;
  failed: number;
  errors: string[];
}> {
  const results = {
    processed: 0,
    failed: 0,
    errors: [] as string[],
  };

  try {
    // Get pending events that need processing
    const { data: events, error } = await supabase
      .from('pipedrive_webhook_events')
      .select('*')
      .or('processing_status.eq.pending,and(processing_status.eq.failed,retry_count.lt.3,next_retry_at.lte.now())')
      .order('created_at', { ascending: true })
      .limit(100);

    if (error) {
      throw new Error(`Failed to fetch webhook events: ${error.message}`);
    }

    // Process each event
    for (const event of events || []) {
      try {
        // Call the webhook processing endpoint internally
        const response = await fetch(
          new URL('/api/integrations/pipedrive/webhooks/process', process.env.NEXT_PUBLIC_APP_URL!),
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.INTERNAL_API_KEY}`,
            },
            body: JSON.stringify({ event_id: event.id }),
          }
        );

        if (response.ok) {
          results.processed++;
        } else {
          results.failed++;
          results.errors.push(`Event ${event.id}: ${response.statusText}`);
        }
      } catch (error) {
        results.failed++;
        results.errors.push(`Event ${event.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  } catch (error) {
    results.errors.push(`Batch processing error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return results;
}

// Process sync queue
async function processSyncQueue(): Promise<{
  processed: number;
  failed: number;
}> {
  let processed = 0;
  let failed = 0;

  try {
    // Get items from sync queue
    const { data: queueItems } = await supabase.rpc('get_next_pipedrive_sync_items', {
      p_limit: 50,
    });

    if (!queueItems || queueItems.length === 0) {
      return { processed, failed };
    }

    // Group by workspace to process efficiently
    const itemsByWorkspace = queueItems.reduce((acc, item) => {
      if (!acc[item.workspace_id]) {
        acc[item.workspace_id] = [];
      }
      acc[item.workspace_id].push(item);
      return acc;
    }, {} as Record<string, any[]>);

    // Process each workspace's items
    for (const [workspaceId, items] of Object.entries(itemsByWorkspace)) {
      try {
        // Call the sync endpoint internally
        const response = await fetch(
          new URL('/api/integrations/pipedrive/sync/bidirectional', process.env.NEXT_PUBLIC_APP_URL!),
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.INTERNAL_API_KEY}`,
              'X-Workspace-ID': workspaceId,
            },
            body: JSON.stringify({ queue_items: items }),
          }
        );

        if (response.ok) {
          processed += items.length;
        } else {
          failed += items.length;
        }
      } catch (error) {
        failed += items.length;
      }
    }
  } catch (error) {
    console.error('Sync queue processing error:', error);
  }

  return { processed, failed };
}

// Clean up old data
async function cleanupOldData(): Promise<{
  webhook_events_deleted: number;
  expired_locks_released: number;
  old_metrics_deleted: number;
}> {
  const results = {
    webhook_events_deleted: 0,
    expired_locks_released: 0,
    old_metrics_deleted: 0,
  };

  try {
    // Delete old processed webhook events (older than 30 days)
    const { count: eventsDeleted } = await supabase
      .from('pipedrive_webhook_events')
      .delete()
      .eq('processing_status', 'completed')
      .lt('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .select('count');

    results.webhook_events_deleted = eventsDeleted || 0;

    // Release expired locks
    const expiredLocks = await supabase.rpc('cleanup_expired_pipedrive_locks');
    results.expired_locks_released = expiredLocks || 0;

    // Delete old sync metrics (older than 90 days)
    const { count: metricsDeleted } = await supabase
      .from('pipedrive_sync_metrics')
      .delete()
      .lt('metric_date', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .select('count');

    results.old_metrics_deleted = metricsDeleted || 0;

  } catch (error) {
    console.error('Cleanup error:', error);
  }

  return results;
}

// Health check for webhooks
async function performHealthCheck(): Promise<void> {
  try {
    // Get all active webhook configurations
    const { data: webhooks } = await supabase
      .from('pipedrive_webhooks')
      .select('workspace_id')
      .eq('active', true)
      .limit(100);

    const workspaceIds = [...new Set(webhooks?.map(w => w.workspace_id) || [])];

    // Check health for each workspace
    for (const workspaceId of workspaceIds) {
      // Get recent event activity
      const { data: recentEvents } = await supabase
        .from('pipedrive_webhook_events')
        .select('created_at')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      const lastEventTime = recentEvents?.created_at ? new Date(recentEvents.created_at) : null;
      const isHealthy = lastEventTime && (Date.now() - lastEventTime.getTime()) < 24 * 60 * 60 * 1000;

      // Update webhook status
      await supabase
        .from('pipedrive_webhook_status')
        .upsert({
          workspace_id: workspaceId,
          webhook_url: new URL('/api/integrations/pipedrive/webhooks', process.env.NEXT_PUBLIC_APP_URL!).toString(),
          is_healthy: isHealthy,
          health_check_at: new Date().toISOString(),
          last_event_at: lastEventTime?.toISOString(),
        });
    }
  } catch (error) {
    console.error('Health check error:', error);
  }
}

// Main cron handler
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    if (!verifyCronSecret(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const startTime = Date.now();
    const results = {
      webhook_processing: { processed: 0, failed: 0, errors: [] as string[] },
      sync_queue: { processed: 0, failed: 0 },
      cleanup: { webhook_events_deleted: 0, expired_locks_released: 0, old_metrics_deleted: 0 },
      health_check: 'pending',
      duration_ms: 0,
    };

    // Process webhook events
    results.webhook_processing = await processWebhookEvents();

    // Process sync queue
    results.sync_queue = await processSyncQueue();

    // Clean up old data
    results.cleanup = await cleanupOldData();

    // Perform health check
    await performHealthCheck();
    results.health_check = 'completed';

    results.duration_ms = Date.now() - startTime;

    // Log cron execution
    await supabase
      .from('cron_logs')
      .insert({
        job_name: 'pipedrive_webhooks',
        status: 'success',
        details: results,
        executed_at: new Date().toISOString(),
      });

    return NextResponse.json({
      success: true,
      ...results,
    });

  } catch (error) {
    console.error('Cron job error:', error);

    // Log error
    await supabase
      .from('cron_logs')
      .insert({
        job_name: 'pipedrive_webhooks',
        status: 'error',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
        executed_at: new Date().toISOString(),
      });

    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Cron job failed' 
      },
      { status: 500 }
    );
  }
}

// Manual trigger for testing
export async function POST(request: NextRequest) {
  try {
    // This endpoint requires authentication for manual testing
    const authHeader = headers().get('authorization');
    if (!authHeader || !authHeader.includes(process.env.INTERNAL_API_KEY!)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request to determine which job to run
    const body = await request.json();
    const { job } = body;

    let result: any;

    switch (job) {
      case 'process_webhooks':
        result = await processWebhookEvents();
        break;
      case 'process_sync':
        result = await processSyncQueue();
        break;
      case 'cleanup':
        result = await cleanupOldData();
        break;
      case 'health_check':
        await performHealthCheck();
        result = { message: 'Health check completed' };
        break;
      default:
        return NextResponse.json({ error: 'Invalid job type' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      job,
      result,
    });

  } catch (error) {
    console.error('Manual trigger error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Manual trigger failed' },
      { status: 500 }
    );
  }
}