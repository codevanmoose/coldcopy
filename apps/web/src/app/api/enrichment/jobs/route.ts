import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { 
  JobQueueManager, 
  enqueueJob, 
  getJobStatus, 
  getJobMetrics,
  JobType, 
  JobPriority,
  Job
} from '@/lib/enrichment/job-processor'
import { z } from 'zod'

// ====================================
// Request Schemas
// ====================================

const createJobSchema = z.object({
  type: z.enum([
    'single_lead_enrichment',
    'batch_lead_enrichment', 
    'email_validation',
    'company_data_update',
    'social_profile_discovery'
  ]),
  payload: z.record(z.any()),
  priority: z.number().min(1).max(5).optional().default(3),
  maxRetries: z.number().min(0).max(10).optional().default(3),
  webhookUrl: z.string().url().optional(),
  tags: z.array(z.string()).optional(),
  scheduledAt: z.string().datetime().optional()
})

const updateJobSchema = z.object({
  status: z.enum(['pending', 'queued', 'in_progress', 'completed', 'failed', 'retrying', 'dead_letter']).optional(),
  priority: z.number().min(1).max(5).optional(),
  webhookUrl: z.string().url().optional(),
  tags: z.array(z.string()).optional()
})

const queryJobsSchema = z.object({
  status: z.enum(['pending', 'queued', 'in_progress', 'completed', 'failed', 'retrying', 'dead_letter']).optional(),
  type: z.enum([
    'single_lead_enrichment',
    'batch_lead_enrichment',
    'email_validation', 
    'company_data_update',
    'social_profile_discovery'
  ]).optional(),
  priority: z.number().min(1).max(5).optional(),
  tags: z.array(z.string()).optional(),
  limit: z.number().min(1).max(100).optional().default(50),
  offset: z.number().min(0).optional().default(0),
  sortBy: z.enum(['created_at', 'updated_at', 'priority', 'status']).optional().default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc')
})

// ====================================
// Helper Functions
// ====================================

async function getUserWorkspace(request: NextRequest) {
  const supabase = createClient()
  
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    throw new Error('Unauthorized')
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('workspace_id')
    .eq('id', user.id)
    .single()
  
  if (profileError || !profile?.workspace_id) {
    throw new Error('Workspace not found')
  }

  return { user, workspaceId: profile.workspace_id }
}

async function validateJobAccess(jobId: string, workspaceId: string): Promise<Job> {
  const job = await getJobStatus(jobId)
  
  if (!job) {
    throw new Error('Job not found')
  }
  
  if (job.workspaceId !== workspaceId) {
    throw new Error('Access denied')
  }
  
  return job
}

// ====================================
// Create Job Endpoint
// ====================================

export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await getUserWorkspace(request)
    
    // Parse and validate request body
    const body = await request.json()
    const validatedData = createJobSchema.parse(body)
    
    // Create job
    const jobId = await enqueueJob(
      validatedData.type as JobType,
      workspaceId,
      validatedData.payload,
      {
        priority: validatedData.priority as JobPriority,
        maxRetries: validatedData.maxRetries,
        webhookUrl: validatedData.webhookUrl,
        tags: validatedData.tags,
        scheduledAt: validatedData.scheduledAt ? new Date(validatedData.scheduledAt) : undefined
      }
    )

    // Get created job details
    const job = await getJobStatus(jobId)
    
    return NextResponse.json({
      success: true,
      jobId,
      job: {
        id: job?.id,
        type: job?.type,
        status: job?.status,
        priority: job?.priority,
        createdAt: job?.createdAt,
        scheduledAt: job?.scheduledAt
      }
    }, { status: 201 })

  } catch (error: any) {
    console.error('Create job error:', error)
    
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    if (error.message === 'Workspace not found') {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Invalid request data',
        details: error.errors 
      }, { status: 400 })
    }

    return NextResponse.json({ 
      error: 'Failed to create job',
      message: error.message 
    }, { status: 500 })
  }
}

// ====================================
// Query Jobs Endpoint
// ====================================

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await getUserWorkspace(request)
    
    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const queryParams = {
      status: searchParams.get('status'),
      type: searchParams.get('type'),
      priority: searchParams.get('priority') ? parseInt(searchParams.get('priority')!) : undefined,
      tags: searchParams.get('tags') ? searchParams.get('tags')!.split(',') : undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0,
      sortBy: searchParams.get('sortBy') || 'created_at',
      sortOrder: searchParams.get('sortOrder') || 'desc'
    }
    
    const validatedParams = queryJobsSchema.parse(queryParams)
    
    // Get jobs from queue manager
    const queueManager = new JobQueueManager()
    const jobs = await queueManager.getJobs(
      workspaceId,
      validatedParams.status,
      validatedParams.limit,
      validatedParams.offset
    )
    
    // Filter and sort jobs based on query parameters
    let filteredJobs = jobs
    
    if (validatedParams.type) {
      filteredJobs = filteredJobs.filter(job => job.type === validatedParams.type)
    }
    
    if (validatedParams.priority) {
      filteredJobs = filteredJobs.filter(job => job.priority === validatedParams.priority)
    }
    
    if (validatedParams.tags && validatedParams.tags.length > 0) {
      filteredJobs = filteredJobs.filter(job => 
        job.tags && job.tags.some(tag => validatedParams.tags!.includes(tag))
      )
    }
    
    // Sort jobs
    filteredJobs.sort((a, b) => {
      let aValue: any, bValue: any
      
      switch (validatedParams.sortBy) {
        case 'created_at':
          aValue = a.createdAt.getTime()
          bValue = b.createdAt.getTime()
          break
        case 'updated_at':
          aValue = a.updatedAt.getTime()
          bValue = b.updatedAt.getTime()
          break
        case 'priority':
          aValue = a.priority
          bValue = b.priority
          break
        case 'status':
          aValue = a.status
          bValue = b.status
          break
        default:
          aValue = a.createdAt.getTime()
          bValue = b.createdAt.getTime()
      }
      
      return validatedParams.sortOrder === 'asc' ? 
        (aValue > bValue ? 1 : -1) : 
        (aValue < bValue ? 1 : -1)
    })
    
    // Transform jobs for response
    const transformedJobs = filteredJobs.map(job => ({
      id: job.id,
      type: job.type,
      status: job.status,
      priority: job.priority,
      payload: job.payload,
      result: job.result,
      error: job.error,
      retryCount: job.retryCount,
      maxRetries: job.maxRetries,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      tags: job.tags,
      processingTime: job.completedAt && job.startedAt ? 
        job.completedAt.getTime() - job.startedAt.getTime() : null
    }))
    
    return NextResponse.json({
      success: true,
      jobs: transformedJobs,
      pagination: {
        limit: validatedParams.limit,
        offset: validatedParams.offset,
        total: filteredJobs.length,
        hasMore: filteredJobs.length === validatedParams.limit
      }
    })

  } catch (error: any) {
    console.error('Query jobs error:', error)
    
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    if (error.message === 'Workspace not found') {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Invalid query parameters',
        details: error.errors 
      }, { status: 400 })
    }

    return NextResponse.json({ 
      error: 'Failed to query jobs',
      message: error.message 
    }, { status: 500 })
  }
}

// ====================================
// Single Job Operations
// ====================================

// Get specific job
export async function getJobHandler(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { workspaceId } = await getUserWorkspace(request)
    const jobId = params.id
    
    const job = await validateJobAccess(jobId, workspaceId)
    
    return NextResponse.json({
      success: true,
      job: {
        id: job.id,
        type: job.type,
        status: job.status,
        priority: job.priority,
        payload: job.payload,
        result: job.result,
        error: job.error,
        retryCount: job.retryCount,
        maxRetries: job.maxRetries,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        webhookUrl: job.webhookUrl,
        tags: job.tags,
        processingTime: job.completedAt && job.startedAt ? 
          job.completedAt.getTime() - job.startedAt.getTime() : null
      }
    })

  } catch (error: any) {
    console.error('Get job error:', error)
    
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    if (error.message === 'Job not found' || error.message === 'Access denied') {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    return NextResponse.json({ 
      error: 'Failed to get job',
      message: error.message 
    }, { status: 500 })
  }
}

// Update job
export async function updateJobHandler(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { workspaceId } = await getUserWorkspace(request)
    const jobId = params.id
    
    await validateJobAccess(jobId, workspaceId)
    
    // Parse and validate request body
    const body = await request.json()
    const validatedData = updateJobSchema.parse(body)
    
    const supabase = createClient()
    const queueManager = new JobQueueManager(supabase)
    
    // Update job
    const updates: any = {
      updated_at: new Date().toISOString()
    }
    
    if (validatedData.status) {
      updates.status = validatedData.status
    }
    
    if (validatedData.priority) {
      updates.priority = validatedData.priority
    }
    
    if (validatedData.webhookUrl) {
      updates.webhook_url = validatedData.webhookUrl
    }
    
    if (validatedData.tags) {
      updates.tags = validatedData.tags
    }
    
    const { error } = await supabase
      .from('enrichment_jobs')
      .update(updates)
      .eq('id', jobId)
    
    if (error) {
      throw new Error(`Failed to update job: ${error.message}`)
    }
    
    // Get updated job
    const updatedJob = await getJobStatus(jobId)
    
    return NextResponse.json({
      success: true,
      job: {
        id: updatedJob?.id,
        type: updatedJob?.type,
        status: updatedJob?.status,
        priority: updatedJob?.priority,
        updatedAt: updatedJob?.updatedAt
      }
    })

  } catch (error: any) {
    console.error('Update job error:', error)
    
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    if (error.message === 'Job not found' || error.message === 'Access denied') {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Invalid request data',
        details: error.errors 
      }, { status: 400 })
    }

    return NextResponse.json({ 
      error: 'Failed to update job',
      message: error.message 
    }, { status: 500 })
  }
}

// Cancel job
export async function cancelJobHandler(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { workspaceId } = await getUserWorkspace(request)
    const jobId = params.id
    
    const job = await validateJobAccess(jobId, workspaceId)
    
    // Only allow cancellation of pending, queued, or retrying jobs
    if (!['pending', 'queued', 'retrying'].includes(job.status)) {
      return NextResponse.json({ 
        error: 'Job cannot be cancelled',
        reason: `Job is ${job.status}` 
      }, { status: 400 })
    }
    
    const supabase = createClient()
    const queueManager = new JobQueueManager(supabase)
    
    await queueManager.updateJobStatus(jobId, 'failed', undefined, {
      message: 'Job cancelled by user',
      code: 'USER_CANCELLED'
    })
    
    return NextResponse.json({
      success: true,
      message: 'Job cancelled successfully'
    })

  } catch (error: any) {
    console.error('Cancel job error:', error)
    
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    if (error.message === 'Job not found' || error.message === 'Access denied') {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    return NextResponse.json({ 
      error: 'Failed to cancel job',
      message: error.message 
    }, { status: 500 })
  }
}

// Retry job
export async function retryJobHandler(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { workspaceId } = await getUserWorkspace(request)
    const jobId = params.id
    
    const job = await validateJobAccess(jobId, workspaceId)
    
    // Only allow retry of failed or dead letter jobs
    if (!['failed', 'dead_letter'].includes(job.status)) {
      return NextResponse.json({ 
        error: 'Job cannot be retried',
        reason: `Job is ${job.status}` 
      }, { status: 400 })
    }
    
    const supabase = createClient()
    
    // Reset job status and retry count
    const { error } = await supabase
      .from('enrichment_jobs')
      .update({
        status: 'pending',
        retry_count: 0,
        updated_at: new Date().toISOString(),
        error_message: null,
        error_code: null,
        error_stack: null
      })
      .eq('id', jobId)
    
    if (error) {
      throw new Error(`Failed to retry job: ${error.message}`)
    }
    
    return NextResponse.json({
      success: true,
      message: 'Job queued for retry'
    })

  } catch (error: any) {
    console.error('Retry job error:', error)
    
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    if (error.message === 'Job not found' || error.message === 'Access denied') {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    return NextResponse.json({ 
      error: 'Failed to retry job',
      message: error.message 
    }, { status: 500 })
  }
}

// ====================================
// Metrics Endpoint
// ====================================

export async function getMetricsHandler(request: NextRequest) {
  try {
    const { workspaceId } = await getUserWorkspace(request)
    
    // Get overall metrics
    const metrics = await getJobMetrics()
    
    // Get workspace-specific metrics
    const supabase = createClient()
    const { data: workspaceMetrics } = await supabase.rpc('get_workspace_job_metrics', {
      p_workspace_id: workspaceId
    })
    
    return NextResponse.json({
      success: true,
      metrics: {
        ...metrics,
        workspace: workspaceMetrics || {}
      }
    })

  } catch (error: any) {
    console.error('Get metrics error:', error)
    
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json({ 
      error: 'Failed to get metrics',
      message: error.message 
    }, { status: 500 })
  }
}

// ====================================
// Bulk Operations
// ====================================

export async function bulkCancelHandler(request: NextRequest) {
  try {
    const { workspaceId } = await getUserWorkspace(request)
    
    const body = await request.json()
    const { jobIds, status } = body
    
    if (!Array.isArray(jobIds) || jobIds.length === 0) {
      return NextResponse.json({ error: 'Job IDs required' }, { status: 400 })
    }
    
    const supabase = createClient()
    const queueManager = new JobQueueManager(supabase)
    
    const results = []
    
    for (const jobId of jobIds) {
      try {
        await validateJobAccess(jobId, workspaceId)
        
        if (status) {
          await queueManager.updateJobStatus(jobId, status)
        } else {
          await queueManager.updateJobStatus(jobId, 'failed', undefined, {
            message: 'Job cancelled by user',
            code: 'USER_CANCELLED'
          })
        }
        
        results.push({ jobId, success: true })
      } catch (error: any) {
        results.push({ jobId, success: false, error: error.message })
      }
    }
    
    return NextResponse.json({
      success: true,
      results
    })

  } catch (error: any) {
    console.error('Bulk cancel error:', error)
    
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json({ 
      error: 'Bulk operation failed',
      message: error.message 
    }, { status: 500 })
  }
}