import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { PipedriveClient } from '@/lib/integrations/pipedrive/client';
import { BulkSyncService, type BulkSyncOptions, type BulkSyncProgress } from '@/lib/integrations/pipedrive/bulk-sync';
import { z } from 'zod';

// Request validation schemas
const bulkSyncRequestSchema = z.object({
  data: z.object({
    persons: z.array(z.any()).optional(),
    organizations: z.array(z.any()).optional(),
    deals: z.array(z.any()).optional(),
    activities: z.array(z.any()).optional(),
  }),
  options: z.object({
    workspaceId: z.string(),
    batchSize: z.number().optional(),
    maxConcurrency: z.number().optional(),
    retryAttempts: z.number().optional(),
    retryDelay: z.number().optional(),
    validateData: z.boolean().optional(),
    detectDuplicates: z.boolean().optional(),
    dryRun: z.boolean().optional(),
    continueOnError: z.boolean().optional(),
    duplicateStrategy: z.enum(['skip', 'update', 'merge']).optional(),
    syncEntities: z.object({
      persons: z.boolean(),
      organizations: z.boolean(),
      deals: z.boolean(),
      activities: z.boolean(),
    }).optional(),
  }),
});

// Store for active sync jobs (in production, use Redis or database)
const activeSyncJobs = new Map<string, {
  service: BulkSyncService;
  status: string;
  progress: any;
  workspaceId: string;
  userId: string;
}>();

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const workspaceId = request.nextUrl.searchParams.get('workspaceId');
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID required' }, { status: 400 });
    }

    // Verify user has access to workspace
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single();

    if (!member) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get sync jobs from database
    const { data: syncJobs, error } = await supabase
      .from('pipedrive_sync_jobs')
      .select(`
        *,
        created_by:users!created_by_id (
          id,
          email,
          full_name
        )
      `)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      throw error;
    }

    // Merge with active jobs
    const jobs = syncJobs?.map(job => {
      const activeJob = activeSyncJobs.get(job.id);
      return {
        id: job.id,
        workspaceId: job.workspace_id,
        status: activeJob?.status || job.status,
        createdAt: job.created_at,
        startedAt: job.started_at,
        completedAt: job.completed_at,
        source: job.source,
        totalRecords: job.total_records || 0,
        processedRecords: job.processed_records || 0,
        successfulRecords: job.successful_records || 0,
        failedRecords: job.failed_records || 0,
        duplicateRecords: job.duplicate_records || 0,
        result: job.result,
        error: job.error,
        createdBy: {
          id: job.created_by.id,
          name: job.created_by.full_name || job.created_by.email,
          email: job.created_by.email,
        },
      };
    }) || [];

    return NextResponse.json({ jobs });
  } catch (error) {
    console.error('Error fetching sync jobs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sync jobs' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = bulkSyncRequestSchema.parse(body);

    const { workspaceId } = validatedData.options;

    // Verify user has access to workspace
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single();

    if (!member || !['admin', 'owner'].includes(member.role)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get Pipedrive integration
    const { data: integration } = await supabase
      .from('pipedrive_integrations')
      .select('*')
      .eq('workspace_id', workspaceId)
      .single();

    if (!integration) {
      return NextResponse.json(
        { error: 'Pipedrive integration not found' },
        { status: 404 }
      );
    }

    // Create sync job record
    const { data: syncJob, error: createError } = await supabase
      .from('pipedrive_sync_jobs')
      .insert({
        workspace_id: workspaceId,
        status: 'pending',
        source: 'manual',
        total_records: Object.values(validatedData.data).reduce(
          (sum, arr) => sum + (arr?.length || 0),
          0
        ),
        created_by_id: user.id,
        options: validatedData.options,
      })
      .select()
      .single();

    if (createError || !syncJob) {
      throw createError || new Error('Failed to create sync job');
    }

    // Initialize Pipedrive client and bulk sync service
    const client = new PipedriveClient(
      integration.access_token,
      integration.company_domain
    );
    const bulkSyncService = new BulkSyncService(client);

    // Store active job
    activeSyncJobs.set(syncJob.id, {
      service: bulkSyncService,
      status: 'running',
      progress: {},
      workspaceId,
      userId: user.id,
    });

    // Update job status to running
    await supabase
      .from('pipedrive_sync_jobs')
      .update({
        status: 'running',
        started_at: new Date().toISOString(),
      })
      .eq('id', syncJob.id);

    // Progress callback
    const progressCallback = async (progress: BulkSyncProgress) => {
      const activeJob = activeSyncJobs.get(syncJob.id);
      if (activeJob) {
        activeJob.progress[progress.entityType] = progress;
      }

      // Update database periodically
      if (progress.processed % 10 === 0) {
        await supabase
          .from('pipedrive_sync_jobs')
          .update({
            processed_records: Object.values(activeJob?.progress || {})
              .reduce((sum: number, p: any) => sum + (p.processed || 0), 0),
            successful_records: Object.values(activeJob?.progress || {})
              .reduce((sum: number, p: any) => sum + (p.successful || 0), 0),
            failed_records: Object.values(activeJob?.progress || {})
              .reduce((sum: number, p: any) => sum + (p.failed || 0), 0),
            duplicate_records: Object.values(activeJob?.progress || {})
              .reduce((sum: number, p: any) => sum + (p.duplicates || 0), 0),
          })
          .eq('id', syncJob.id);
      }
    };

    // Start sync in background
    bulkSyncService
      .startBulkSync(validatedData.data, {
        ...validatedData.options,
        progressCallback,
      })
      .then(async (result) => {
        // Update job with result
        await supabase
          .from('pipedrive_sync_jobs')
          .update({
            status: result.success ? 'completed' : 'failed',
            completed_at: new Date().toISOString(),
            processed_records: result.summary.total,
            successful_records: result.summary.successful,
            failed_records: result.summary.failed,
            duplicate_records: result.summary.duplicates,
            result: result,
          })
          .eq('id', syncJob.id);

        // Clean up active job
        activeSyncJobs.delete(syncJob.id);
      })
      .catch(async (error) => {
        // Update job with error
        await supabase
          .from('pipedrive_sync_jobs')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            error: error.message,
          })
          .eq('id', syncJob.id);

        // Clean up active job
        activeSyncJobs.delete(syncJob.id);
      });

    return NextResponse.json({
      jobId: syncJob.id,
      status: 'started',
      message: 'Bulk sync started successfully',
    });
  } catch (error) {
    console.error('Error starting bulk sync:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to start bulk sync' },
      { status: 500 }
    );
  }
}

// Progress endpoint for Server-Sent Events
export async function GET_PROGRESS(request: NextRequest) {
  const syncId = request.nextUrl.pathname.split('/').pop();
  const workspaceId = request.nextUrl.searchParams.get('workspaceId');

  if (!syncId || !workspaceId) {
    return NextResponse.json(
      { error: 'Sync ID and Workspace ID required' },
      { status: 400 }
    );
  }

  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  // Send progress updates
  const interval = setInterval(async () => {
    const activeJob = activeSyncJobs.get(syncId);
    
    if (activeJob && activeJob.workspaceId === workspaceId) {
      const data = {
        type: 'progress',
        progress: activeJob.progress,
        status: activeJob.status,
      };
      
      await writer.write(
        encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
      );
    } else {
      // Job completed or not found
      clearInterval(interval);
      await writer.close();
    }
  }, 1000);

  // Clean up on disconnect
  request.signal.addEventListener('abort', () => {
    clearInterval(interval);
    writer.close();
  });

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}