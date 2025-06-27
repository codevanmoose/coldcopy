import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

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

    // Get sync job ID from query params
    const searchParams = request.nextUrl.searchParams;
    const syncJobId = searchParams.get('jobId');

    // Verify user has access to workspace
    const { data: member } = await supabase
      .from('workspace_users')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single();

    if (!member) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get integration
    const { data: integration } = await supabase
      .from('integrations')
      .select('id, sync_status, last_sync_at, last_sync_attempt_at')
      .eq('workspace_id', workspaceId)
      .eq('provider', 'hubspot')
      .eq('is_active', true)
      .single();

    if (!integration) {
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 });
    }

    if (syncJobId) {
      // Get specific sync job status
      const { data: syncJob, error } = await supabase
        .from('sync_jobs')
        .select(`
          id,
          sync_type,
          status,
          progress,
          records_processed,
          records_failed,
          records_skipped,
          error_details,
          started_at,
          completed_at,
          created_at,
          sync_job_logs (
            id,
            level,
            message,
            details,
            created_at
          )
        `)
        .eq('id', syncJobId)
        .eq('workspace_id', workspaceId)
        .single();

      if (error || !syncJob) {
        return NextResponse.json({ error: 'Sync job not found' }, { status: 404 });
      }

      // Calculate duration and estimate
      let duration = null;
      let estimatedTimeRemaining = null;
      
      if (syncJob.started_at) {
        const startTime = new Date(syncJob.started_at).getTime();
        const endTime = syncJob.completed_at 
          ? new Date(syncJob.completed_at).getTime() 
          : Date.now();
        duration = Math.round((endTime - startTime) / 1000); // seconds

        // Estimate remaining time for running jobs
        if (syncJob.status === 'running' && syncJob.progress > 0) {
          const progressRate = duration / syncJob.progress;
          estimatedTimeRemaining = Math.round(progressRate * (100 - syncJob.progress));
        }
      }

      return NextResponse.json({
        syncJob: {
          id: syncJob.id,
          syncType: syncJob.sync_type,
          status: syncJob.status,
          progress: syncJob.progress || 0,
          recordsProcessed: syncJob.records_processed || 0,
          recordsFailed: syncJob.records_failed || 0,
          recordsSkipped: syncJob.records_skipped || 0,
          errorDetails: syncJob.error_details,
          startedAt: syncJob.started_at,
          completedAt: syncJob.completed_at,
          createdAt: syncJob.created_at,
          duration,
          estimatedTimeRemaining,
          logs: syncJob.sync_job_logs?.slice(-50) || [], // Last 50 logs
        },
      });
    } else {
      // Get overall sync status and recent jobs
      const { data: recentJobs } = await supabase
        .from('sync_jobs')
        .select(`
          id,
          sync_type,
          status,
          progress,
          records_processed,
          records_failed,
          started_at,
          completed_at,
          created_at
        `)
        .eq('integration_id', integration.id)
        .order('created_at', { ascending: false })
        .limit(10);

      // Get current active sync
      const activeSync = recentJobs?.find(job => ['pending', 'running'].includes(job.status));

      // Calculate sync statistics
      const completedSyncs = recentJobs?.filter(job => job.status === 'completed') || [];
      const failedSyncs = recentJobs?.filter(job => job.status === 'failed') || [];
      
      let avgSyncDuration = 0;
      if (completedSyncs.length > 0) {
        const durations = completedSyncs
          .filter(job => job.started_at && job.completed_at)
          .map(job => {
            const start = new Date(job.started_at!).getTime();
            const end = new Date(job.completed_at!).getTime();
            return (end - start) / 1000; // seconds
          });
        
        if (durations.length > 0) {
          avgSyncDuration = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
        }
      }

      return NextResponse.json({
        integration: {
          syncStatus: integration.sync_status,
          lastSyncAt: integration.last_sync_at,
          lastSyncAttemptAt: integration.last_sync_attempt_at,
        },
        activeSync: activeSync ? {
          id: activeSync.id,
          syncType: activeSync.sync_type,
          status: activeSync.status,
          progress: activeSync.progress || 0,
          recordsProcessed: activeSync.records_processed || 0,
          startedAt: activeSync.started_at,
        } : null,
        statistics: {
          totalSyncs: recentJobs?.length || 0,
          completedSyncs: completedSyncs.length,
          failedSyncs: failedSyncs.length,
          avgSyncDuration,
          successRate: recentJobs && recentJobs.length > 0
            ? Math.round((completedSyncs.length / recentJobs.length) * 100)
            : 0,
        },
        recentJobs: recentJobs?.map(job => ({
          id: job.id,
          syncType: job.sync_type,
          status: job.status,
          recordsProcessed: job.records_processed || 0,
          recordsFailed: job.records_failed || 0,
          startedAt: job.started_at,
          completedAt: job.completed_at,
          createdAt: job.created_at,
        })) || [],
      });
    }
  } catch (error) {
    console.error('Sync status error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sync status' },
      { status: 500 }
    );
  }
}