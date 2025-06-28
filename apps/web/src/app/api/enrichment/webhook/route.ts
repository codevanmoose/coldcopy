import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { JobQueueManager, getJobStatus } from '@/lib/enrichment/job-processor'
import { headers } from 'next/headers'
import crypto from 'crypto'

// ====================================
// Webhook Payload Types
// ====================================

interface WebhookPayload {
  jobId?: string
  providerId: string
  event: 'job.completed' | 'job.failed' | 'job.progress' | 'job.started'
  data: any
  timestamp: string
  signature?: string
}

interface ProgressUpdate {
  jobId: string
  progress: number // 0-100
  stage: string
  message?: string
  estimatedCompletion?: string
}

interface CompletionNotification {
  jobId: string
  result: any
  processingTime: number
  creditsUsed: number
}

interface FailureNotification {
  jobId: string
  error: {
    message: string
    code: string
    retryable: boolean
  }
  processingTime: number
}

// ====================================
// Webhook Signature Verification
// ====================================

function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  try {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex')
    
    const providedSignature = signature.replace('sha256=', '')
    
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(providedSignature, 'hex')
    )
  } catch (error) {
    return false
  }
}

// ====================================
// Provider-specific Webhook Handlers
// ====================================

class ClearbitWebhookHandler {
  static async handle(payload: any): Promise<void> {
    const { person_id, company_id, status, data } = payload
    
    if (status === 'completed') {
      // Handle Clearbit completion
      await this.handleCompletion(person_id || company_id, data)
    } else if (status === 'failed') {
      // Handle Clearbit failure
      await this.handleFailure(person_id || company_id, payload.error)
    }
  }

  private static async handleCompletion(id: string, data: any): Promise<void> {
    // Process Clearbit data format
    const processedData = {
      email: data.email,
      firstName: data.name?.givenName,
      lastName: data.name?.familyName,
      title: data.employment?.title,
      company: data.employment?.name,
      domain: data.employment?.domain,
      linkedin: data.linkedin?.handle,
      twitter: data.twitter?.handle,
      phone: data.phone
    }

    // Update job with result
    await this.updateJobResult(id, processedData)
  }

  private static async handleFailure(id: string, error: any): Promise<void> {
    await this.updateJobError(id, {
      message: error.message || 'Clearbit enrichment failed',
      code: error.type || 'CLEARBIT_ERROR',
      retryable: error.retryable !== false
    })
  }

  private static async updateJobResult(externalId: string, result: any): Promise<void> {
    const supabase = createClient()
    const queueManager = new JobQueueManager(supabase)
    
    // Find job by external ID
    const { data: jobs } = await supabase
      .from('enrichment_jobs')
      .select('id')
      .eq('payload->external_id', externalId)
      .eq('status', 'in_progress')
    
    if (jobs && jobs.length > 0) {
      await queueManager.updateJobStatus(jobs[0].id, 'completed', result)
    }
  }

  private static async updateJobError(externalId: string, error: any): Promise<void> {
    const supabase = createClient()
    const queueManager = new JobQueueManager(supabase)
    
    // Find job by external ID
    const { data: jobs } = await supabase
      .from('enrichment_jobs')
      .select('id')
      .eq('payload->external_id', externalId)
      .eq('status', 'in_progress')
    
    if (jobs && jobs.length > 0) {
      await queueManager.updateJobStatus(jobs[0].id, 'failed', undefined, error)
    }
  }
}

class HunterWebhookHandler {
  static async handle(payload: any): Promise<void> {
    const { request_id, status, data, error } = payload
    
    if (status === 'success') {
      await this.handleSuccess(request_id, data)
    } else if (status === 'error') {
      await this.handleError(request_id, error)
    }
  }

  private static async handleSuccess(requestId: string, data: any): Promise<void> {
    const processedData = {
      email: data.email,
      confidence: data.confidence,
      sources: data.sources,
      firstName: data.first_name,
      lastName: data.last_name,
      position: data.position,
      company: data.company,
      linkedin: data.linkedin_url,
      twitter: data.twitter
    }

    await this.updateJobResult(requestId, processedData)
  }

  private static async handleError(requestId: string, error: any): Promise<void> {
    await this.updateJobError(requestId, {
      message: error.details || 'Hunter enrichment failed',
      code: error.code || 'HUNTER_ERROR',
      retryable: error.code !== 'no_email_found'
    })
  }

  private static async updateJobResult(externalId: string, result: any): Promise<void> {
    const supabase = createClient()
    const queueManager = new JobQueueManager(supabase)
    
    const { data: jobs } = await supabase
      .from('enrichment_jobs')
      .select('id')
      .eq('payload->request_id', externalId)
      .eq('status', 'in_progress')
    
    if (jobs && jobs.length > 0) {
      await queueManager.updateJobStatus(jobs[0].id, 'completed', result)
    }
  }

  private static async updateJobError(externalId: string, error: any): Promise<void> {
    const supabase = createClient()
    const queueManager = new JobQueueManager(supabase)
    
    const { data: jobs } = await supabase
      .from('enrichment_jobs')
      .select('id')
      .eq('payload->request_id', externalId)
      .eq('status', 'in_progress')
    
    if (jobs && jobs.length > 0) {
      await queueManager.updateJobStatus(jobs[0].id, 'failed', undefined, error)
    }
  }
}

class ApolloWebhookHandler {
  static async handle(payload: any): Promise<void> {
    const { webhook_id, event_type, data } = payload
    
    switch (event_type) {
      case 'person_enriched':
        await this.handlePersonEnriched(webhook_id, data)
        break
      case 'company_enriched':
        await this.handleCompanyEnriched(webhook_id, data)
        break
      case 'enrichment_failed':
        await this.handleEnrichmentFailed(webhook_id, data)
        break
    }
  }

  private static async handlePersonEnriched(webhookId: string, data: any): Promise<void> {
    const processedData = {
      email: data.email,
      firstName: data.first_name,
      lastName: data.last_name,
      title: data.title,
      company: data.organization?.name,
      linkedin: data.linkedin_url,
      phone: data.phone_numbers?.[0]?.sanitized_number,
      confidence: data.email_status === 'verified' ? 0.95 : 0.7
    }

    await this.updateJobResult(webhookId, processedData)
  }

  private static async handleCompanyEnriched(webhookId: string, data: any): Promise<void> {
    const processedData = {
      name: data.name,
      domain: data.website_url,
      industry: data.industry,
      size: data.estimated_num_employees,
      description: data.short_description,
      founded: data.founded_year,
      revenue: data.estimated_annual_revenue,
      technologies: data.technologies?.map((t: any) => t.name)
    }

    await this.updateJobResult(webhookId, processedData)
  }

  private static async handleEnrichmentFailed(webhookId: string, data: any): Promise<void> {
    await this.updateJobError(webhookId, {
      message: data.error_message || 'Apollo enrichment failed',
      code: data.error_code || 'APOLLO_ERROR',
      retryable: data.retryable !== false
    })
  }

  private static async updateJobResult(externalId: string, result: any): Promise<void> {
    const supabase = createClient()
    const queueManager = new JobQueueManager(supabase)
    
    const { data: jobs } = await supabase
      .from('enrichment_jobs')
      .select('id')
      .eq('payload->webhook_id', externalId)
      .eq('status', 'in_progress')
    
    if (jobs && jobs.length > 0) {
      await queueManager.updateJobStatus(jobs[0].id, 'completed', result)
    }
  }

  private static async updateJobError(externalId: string, error: any): Promise<void> {
    const supabase = createClient()
    const queueManager = new JobQueueManager(supabase)
    
    const { data: jobs } = await supabase
      .from('enrichment_jobs')
      .select('id')
      .eq('payload->webhook_id', externalId)
      .eq('status', 'in_progress')
    
    if (jobs && jobs.length > 0) {
      await queueManager.updateJobStatus(jobs[0].id, 'failed', undefined, error)
    }
  }
}

// ====================================
// Real-time Updates
// ====================================

async function sendRealtimeUpdate(
  workspaceId: string,
  jobId: string,
  event: string,
  data: any
): Promise<void> {
  const supabase = createClient()
  
  // Send real-time update to frontend
  await supabase.channel('enrichment_updates').send({
    type: 'broadcast',
    event: 'job_update',
    payload: {
      workspaceId,
      jobId,
      event,
      data,
      timestamp: new Date().toISOString()
    }
  })
}

async function sendProgressUpdate(
  workspaceId: string,
  update: ProgressUpdate
): Promise<void> {
  await sendRealtimeUpdate(workspaceId, update.jobId, 'progress', update)
}

async function sendCompletionNotification(
  workspaceId: string,
  notification: CompletionNotification
): Promise<void> {
  await sendRealtimeUpdate(workspaceId, notification.jobId, 'completed', notification)
}

async function sendFailureNotification(
  workspaceId: string,
  notification: FailureNotification
): Promise<void> {
  await sendRealtimeUpdate(workspaceId, notification.jobId, 'failed', notification)
}

// ====================================
// Main Webhook Handler
// ====================================

export async function POST(request: NextRequest) {
  try {
    const headersList = headers()
    const userAgent = headersList.get('user-agent') || ''
    const signature = headersList.get('x-webhook-signature') || headersList.get('x-hub-signature-256') || ''
    const providerId = headersList.get('x-provider-id') || request.nextUrl.searchParams.get('provider') || 'unknown'

    // Get request body
    const body = await request.text()
    let payload: any

    try {
      payload = JSON.parse(body)
    } catch (error) {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
    }

    // Verify webhook signature if required
    const webhookSecret = process.env[`${providerId.toUpperCase()}_WEBHOOK_SECRET`]
    if (webhookSecret && signature) {
      const isValid = verifyWebhookSignature(body, signature, webhookSecret)
      if (!isValid) {
        return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 })
      }
    }

    // Log webhook for debugging
    console.log(`Received webhook from ${providerId}:`, payload)

    // Route to appropriate handler based on provider
    switch (providerId.toLowerCase()) {
      case 'clearbit':
        await ClearbitWebhookHandler.handle(payload)
        break
      case 'hunter':
        await HunterWebhookHandler.handle(payload)
        break
      case 'apollo':
        await ApolloWebhookHandler.handle(payload)
        break
      default:
        // Generic webhook handler
        await handleGenericWebhook(payload)
    }

    return NextResponse.json({ success: true, received: true })

  } catch (error: any) {
    console.error('Webhook processing error:', error)
    
    return NextResponse.json({ 
      error: 'Webhook processing failed',
      message: error.message 
    }, { status: 500 })
  }
}

// ====================================
// Generic Webhook Handler
// ====================================

async function handleGenericWebhook(payload: WebhookPayload): Promise<void> {
  const supabase = createClient()
  
  switch (payload.event) {
    case 'job.started':
      if (payload.jobId) {
        const job = await getJobStatus(payload.jobId)
        if (job) {
          await sendRealtimeUpdate(job.workspaceId, payload.jobId, 'started', payload.data)
        }
      }
      break

    case 'job.progress':
      if (payload.jobId) {
        const job = await getJobStatus(payload.jobId)
        if (job) {
          await sendProgressUpdate(job.workspaceId, {
            jobId: payload.jobId,
            progress: payload.data.progress || 0,
            stage: payload.data.stage || 'processing',
            message: payload.data.message,
            estimatedCompletion: payload.data.estimatedCompletion
          })
        }
      }
      break

    case 'job.completed':
      if (payload.jobId) {
        const job = await getJobStatus(payload.jobId)
        if (job) {
          const queueManager = new JobQueueManager(supabase)
          await queueManager.updateJobStatus(payload.jobId, 'completed', payload.data)
          
          await sendCompletionNotification(job.workspaceId, {
            jobId: payload.jobId,
            result: payload.data,
            processingTime: payload.data.processingTime || 0,
            creditsUsed: payload.data.creditsUsed || 0
          })
        }
      }
      break

    case 'job.failed':
      if (payload.jobId) {
        const job = await getJobStatus(payload.jobId)
        if (job) {
          const queueManager = new JobQueueManager(supabase)
          await queueManager.updateJobStatus(payload.jobId, 'failed', undefined, {
            message: payload.data.error?.message || 'Job failed',
            code: payload.data.error?.code || 'UNKNOWN_ERROR'
          })
          
          await sendFailureNotification(job.workspaceId, {
            jobId: payload.jobId,
            error: payload.data.error,
            processingTime: payload.data.processingTime || 0
          })
        }
      }
      break
  }
}

// ====================================
// Health Check Endpoint
// ====================================

export async function GET(request: NextRequest) {
  try {
    const providerId = request.nextUrl.searchParams.get('provider')
    
    if (providerId) {
      // Provider-specific health check
      return NextResponse.json({
        status: 'healthy',
        provider: providerId,
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      })
    }

    // General webhook health check
    return NextResponse.json({
      status: 'healthy',
      service: 'enrichment-webhook',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    })

  } catch (error: any) {
    return NextResponse.json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

// ====================================
// Webhook Registration Helper
// ====================================

// NOTE: This function should be moved to a separate utility file
// as Next.js API routes only allow HTTP method exports
/*
async function registerWebhook(
  providerId: string,
  events: string[],
  jobId?: string
): Promise<{ webhookUrl: string; webhookId?: string }> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const webhookUrl = `${baseUrl}/api/enrichment/webhook?provider=${providerId}`
  
  // Store webhook registration in database for tracking
  const supabase = createClient()
  await supabase.from('enrichment_webhooks').insert({
    provider_id: providerId,
    webhook_url: webhookUrl,
    events,
    job_id: jobId,
    created_at: new Date().toISOString(),
    is_active: true
  })

  return { webhookUrl }
}
*/