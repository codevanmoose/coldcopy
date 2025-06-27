import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Get webhook monitoring data
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

    const { workspace_id } = workspaceUser;

    // Get time range from query params
    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('range') || '24h';
    const entityType = searchParams.get('entity_type');

    // Calculate time filter
    let timeFilter = new Date();
    switch (timeRange) {
      case '1h':
        timeFilter.setHours(timeFilter.getHours() - 1);
        break;
      case '24h':
        timeFilter.setHours(timeFilter.getHours() - 24);
        break;
      case '7d':
        timeFilter.setDate(timeFilter.getDate() - 7);
        break;
      case '30d':
        timeFilter.setDate(timeFilter.getDate() - 30);
        break;
      default:
        timeFilter.setHours(timeFilter.getHours() - 24);
    }

    // Get webhook event statistics
    let eventQuery = supabase
      .from('pipedrive_webhook_events')
      .select('event_action, event_object, processing_status, count(*)')
      .eq('workspace_id', workspace_id)
      .gte('created_at', timeFilter.toISOString());

    if (entityType) {
      eventQuery = eventQuery.eq('event_object', entityType);
    }

    const { data: eventStats } = await eventQuery.group('event_action, event_object, processing_status');

    // Get recent events
    let recentQuery = supabase
      .from('pipedrive_webhook_events')
      .select('*')
      .eq('workspace_id', workspace_id)
      .gte('created_at', timeFilter.toISOString())
      .order('created_at', { ascending: false })
      .limit(100);

    if (entityType) {
      recentQuery = recentQuery.eq('event_object', entityType);
    }

    const { data: recentEvents } = await recentQuery;

    // Get failed events
    const { data: failedEvents } = await supabase
      .from('pipedrive_webhook_events')
      .select('*')
      .eq('workspace_id', workspace_id)
      .eq('processing_status', 'failed')
      .order('created_at', { ascending: false })
      .limit(50);

    // Get sync metrics
    const { data: syncMetrics } = await supabase
      .from('pipedrive_sync_metrics')
      .select('*')
      .eq('workspace_id', workspace_id)
      .gte('created_at', timeFilter.toISOString())
      .order('metric_date', { ascending: false });

    // Get webhook health status
    const { data: webhookStatus } = await supabase
      .from('pipedrive_webhook_status')
      .select('*')
      .eq('workspace_id', workspace_id)
      .single();

    // Calculate summary statistics
    const totalEvents = eventStats?.reduce((sum, stat) => sum + parseInt(stat.count), 0) || 0;
    const processedEvents = eventStats?.filter(s => s.processing_status === 'completed')
      .reduce((sum, stat) => sum + parseInt(stat.count), 0) || 0;
    const failedEventsCount = eventStats?.filter(s => s.processing_status === 'failed')
      .reduce((sum, stat) => sum + parseInt(stat.count), 0) || 0;
    const pendingEvents = eventStats?.filter(s => s.processing_status === 'pending')
      .reduce((sum, stat) => sum + parseInt(stat.count), 0) || 0;

    // Calculate processing rate
    const timeRangeHours = {
      '1h': 1,
      '24h': 24,
      '7d': 168,
      '30d': 720,
    }[timeRange] || 24;

    const processingRate = processedEvents / timeRangeHours;

    // Get active sync locks
    const { data: activeLocks } = await supabase
      .from('pipedrive_sync_locks')
      .select('*')
      .eq('workspace_id', workspace_id)
      .is('released_at', null)
      .gt('expires_at', new Date().toISOString());

    return NextResponse.json({
      summary: {
        total_events: totalEvents,
        processed_events: processedEvents,
        failed_events: failedEventsCount,
        pending_events: pendingEvents,
        processing_rate: processingRate.toFixed(2) + ' events/hour',
        webhook_health: webhookStatus?.is_healthy ? 'healthy' : 'unhealthy',
        active_locks: activeLocks?.length || 0,
      },
      event_stats: eventStats || [],
      recent_events: recentEvents || [],
      failed_events: failedEvents || [],
      sync_metrics: syncMetrics || [],
      webhook_status: webhookStatus,
      time_range: timeRange,
    });

  } catch (error) {
    console.error('Monitor webhook error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get monitoring data' },
      { status: 500 }
    );
  }
}

// Real-time monitoring via Server-Sent Events
export async function POST(request: NextRequest) {
  try {
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

    const { workspace_id } = workspaceUser;

    // Create SSE response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        // Send initial data
        controller.enqueue(encoder.encode('data: {"type": "connected"}\n\n'));

        // Set up real-time subscription
        const subscription = supabase
          .channel(`pipedrive-webhooks-${workspace_id}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'pipedrive_webhook_events',
              filter: `workspace_id=eq.${workspace_id}`,
            },
            (payload) => {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({
                  type: 'new_event',
                  event: payload.new,
                })}\n\n`)
              );
            }
          )
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'pipedrive_webhook_events',
              filter: `workspace_id=eq.${workspace_id}`,
            },
            (payload) => {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({
                  type: 'event_updated',
                  event: payload.new,
                })}\n\n`)
              );
            }
          )
          .subscribe();

        // Send heartbeat every 30 seconds
        const heartbeatInterval = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(': heartbeat\n\n'));
          } catch (error) {
            clearInterval(heartbeatInterval);
          }
        }, 30000);

        // Clean up on close
        request.signal.addEventListener('abort', () => {
          clearInterval(heartbeatInterval);
          subscription.unsubscribe();
          controller.close();
        });
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('Real-time monitoring error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to start monitoring' },
      { status: 500 }
    );
  }
}