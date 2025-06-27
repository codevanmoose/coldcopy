import { createClient } from '@/lib/supabase/client'
import { SupabaseClient } from '@supabase/supabase-js'
import { enrichmentService } from './enrichment-service'
import { EnrichmentRequest, EnrichmentResult } from './enrichment-service'

// ====================================
// Job Types and Interfaces
// ====================================

export type JobType = 
  | 'single_lead_enrichment'
  | 'batch_lead_enrichment'
  | 'email_validation'
  | 'company_data_update'
  | 'social_profile_discovery'

export type JobStatus = 
  | 'pending'
  | 'queued'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'retrying'
  | 'dead_letter'

export type JobPriority = 1 | 2 | 3 | 4 | 5 // 1 = highest, 5 = lowest

export interface Job {
  id: string
  workspaceId: string
  type: JobType
  priority: JobPriority
  status: JobStatus
  payload: Record<string, any>
  result?: any
  error?: {
    message: string
    code: string
    stack?: string
  }
  retryCount: number
  maxRetries: number
  createdAt: Date
  updatedAt: Date
  scheduledAt?: Date
  startedAt?: Date
  completedAt?: Date
  webhookUrl?: string
  tags?: string[]
}

export interface WorkerConfig {
  maxConcurrentJobs: number
  pollInterval: number
  healthCheckInterval: number
  gracefulShutdownTimeout: number
  retryConfig: {
    baseDelay: number
    maxDelay: number
    backoffMultiplier: number
  }
  rateLimit: {
    requestsPerSecond: number
    requestsPerMinute: number
    requestsPerHour: number
  }
}

export interface JobMetrics {
  totalJobs: number
  pendingJobs: number
  runningJobs: number
  completedJobs: number
  failedJobs: number
  deadLetterJobs: number
  averageProcessingTime: number
  successRate: number
  throughput: number
  errorRate: number
  queueDepth: number
}

export interface WorkerHealth {
  workerId: string
  status: 'healthy' | 'degraded' | 'unhealthy'
  lastHeartbeat: Date
  uptime: number
  processedJobs: number
  currentLoad: number
  memoryUsage: number
  version: string
}

// ====================================
// Job Queue Manager
// ====================================

export class JobQueueManager {
  private supabase: SupabaseClient
  private memoryQueue: Map<JobPriority, Job[]> = new Map()
  private isShuttingDown = false

  constructor(supabase?: SupabaseClient) {
    this.supabase = supabase || createClient()
    
    // Initialize priority queues
    for (let i = 1; i <= 5; i++) {
      this.memoryQueue.set(i as JobPriority, [])
    }
  }

  // Add job to queue
  async enqueue(job: Omit<Job, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const jobId = crypto.randomUUID()
    const now = new Date()

    const fullJob: Job = {
      id: jobId,
      createdAt: now,
      updatedAt: now,
      ...job
    }

    // Store in database
    const { error } = await this.supabase
      .from('enrichment_jobs')
      .insert({
        id: fullJob.id,
        workspace_id: fullJob.workspaceId,
        type: fullJob.type,
        priority: fullJob.priority,
        status: fullJob.status,
        payload: fullJob.payload,
        retry_count: fullJob.retryCount,
        max_retries: fullJob.maxRetries,
        created_at: fullJob.createdAt.toISOString(),
        updated_at: fullJob.updatedAt.toISOString(),
        scheduled_at: fullJob.scheduledAt?.toISOString(),
        webhook_url: fullJob.webhookUrl,
        tags: fullJob.tags
      })

    if (error) {
      throw new Error(`Failed to enqueue job: ${error.message}`)
    }

    // Add to memory queue for faster processing
    const priorityQueue = this.memoryQueue.get(fullJob.priority)!
    priorityQueue.push(fullJob)

    return jobId
  }

  // Get next job to process (priority-based)
  async dequeue(): Promise<Job | null> {
    if (this.isShuttingDown) {
      return null
    }

    // Check memory queues first (priority order)
    for (let priority = 1; priority <= 5; priority++) {
      const queue = this.memoryQueue.get(priority as JobPriority)!
      const job = queue.shift()
      if (job && job.status === 'pending') {
        return job
      }
    }

    // Fallback to database query
    const { data: jobs, error } = await this.supabase
      .from('enrichment_jobs')
      .select('*')
      .in('status', ['pending', 'queued'])
      .or('scheduled_at.is.null,scheduled_at.lte.now()')
      .order('priority', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(1)

    if (error || !jobs || jobs.length === 0) {
      return null
    }

    const jobData = jobs[0]
    return this.mapDatabaseJobToJob(jobData)
  }

  // Update job status
  async updateJobStatus(
    jobId: string, 
    status: JobStatus, 
    result?: any, 
    error?: Job['error']
  ): Promise<void> {
    const updates: any = {
      status,
      updated_at: new Date().toISOString()
    }

    if (result) {
      updates.result = result
    }

    if (error) {
      updates.error_message = error.message
      updates.error_code = error.code
      updates.error_stack = error.stack
    }

    if (status === 'in_progress') {
      updates.started_at = new Date().toISOString()
    } else if (status === 'completed' || status === 'failed' || status === 'dead_letter') {
      updates.completed_at = new Date().toISOString()
    }

    const { error: updateError } = await this.supabase
      .from('enrichment_jobs')
      .update(updates)
      .eq('id', jobId)

    if (updateError) {
      throw new Error(`Failed to update job status: ${updateError.message}`)
    }
  }

  // Retry failed job with exponential backoff
  async retryJob(jobId: string, config: WorkerConfig): Promise<void> {
    const { data: jobData, error } = await this.supabase
      .from('enrichment_jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    if (error || !jobData) {
      throw new Error(`Job not found: ${jobId}`)
    }

    const job = this.mapDatabaseJobToJob(jobData)

    if (job.retryCount >= job.maxRetries) {
      // Move to dead letter queue
      await this.updateJobStatus(jobId, 'dead_letter')
      return
    }

    // Calculate exponential backoff delay
    const delay = Math.min(
      config.retryConfig.baseDelay * Math.pow(config.retryConfig.backoffMultiplier, job.retryCount),
      config.retryConfig.maxDelay
    )

    const scheduledAt = new Date(Date.now() + delay)

    await this.supabase
      .from('enrichment_jobs')
      .update({
        status: 'pending',
        retry_count: job.retryCount + 1,
        scheduled_at: scheduledAt.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId)
  }

  // Get job by ID
  async getJob(jobId: string): Promise<Job | null> {
    const { data, error } = await this.supabase
      .from('enrichment_jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    if (error || !data) {
      return null
    }

    return this.mapDatabaseJobToJob(data)
  }

  // Get jobs by workspace and status
  async getJobs(
    workspaceId: string,
    status?: JobStatus,
    limit = 100,
    offset = 0
  ): Promise<Job[]> {
    let query = this.supabase
      .from('enrichment_jobs')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error || !data) {
      return []
    }

    return data.map(job => this.mapDatabaseJobToJob(job))
  }

  // Get queue metrics
  async getMetrics(): Promise<JobMetrics> {
    const { data, error } = await this.supabase.rpc('get_job_metrics')

    if (error) {
      throw new Error(`Failed to get metrics: ${error.message}`)
    }

    return data || {
      totalJobs: 0,
      pendingJobs: 0,
      runningJobs: 0,
      completedJobs: 0,
      failedJobs: 0,
      deadLetterJobs: 0,
      averageProcessingTime: 0,
      successRate: 0,
      throughput: 0,
      errorRate: 0,
      queueDepth: 0
    }
  }

  // Clean up old completed jobs
  async cleanup(olderThanDays = 30): Promise<number> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays)

    const { count, error } = await this.supabase
      .from('enrichment_jobs')
      .delete()
      .in('status', ['completed', 'failed'])
      .lt('completed_at', cutoffDate.toISOString())

    if (error) {
      throw new Error(`Cleanup failed: ${error.message}`)
    }

    return count || 0
  }

  // Graceful shutdown
  async shutdown(): Promise<void> {
    this.isShuttingDown = true
    this.memoryQueue.clear()
  }

  private mapDatabaseJobToJob(data: any): Job {
    return {
      id: data.id,
      workspaceId: data.workspace_id,
      type: data.type,
      priority: data.priority,
      status: data.status,
      payload: data.payload,
      result: data.result,
      error: data.error_message ? {
        message: data.error_message,
        code: data.error_code,
        stack: data.error_stack
      } : undefined,
      retryCount: data.retry_count,
      maxRetries: data.max_retries,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      scheduledAt: data.scheduled_at ? new Date(data.scheduled_at) : undefined,
      startedAt: data.started_at ? new Date(data.started_at) : undefined,
      completedAt: data.completed_at ? new Date(data.completed_at) : undefined,
      webhookUrl: data.webhook_url,
      tags: data.tags
    }
  }
}

// ====================================
// Rate Limiter
// ====================================

export class RateLimiter {
  private requestCounts = new Map<string, {
    second: number
    minute: number
    hour: number
    secondReset: number
    minuteReset: number
    hourReset: number
  }>()

  async checkRateLimit(
    providerId: string,
    config: WorkerConfig['rateLimit']
  ): Promise<{ allowed: boolean; retryAfter?: number }> {
    const now = Date.now()
    const key = providerId

    let counts = this.requestCounts.get(key)
    if (!counts) {
      counts = {
        second: 0,
        minute: 0,
        hour: 0,
        secondReset: now + 1000,
        minuteReset: now + 60000,
        hourReset: now + 3600000
      }
      this.requestCounts.set(key, counts)
    }

    // Reset counters if needed
    if (now >= counts.secondReset) {
      counts.second = 0
      counts.secondReset = now + 1000
    }
    if (now >= counts.minuteReset) {
      counts.minute = 0
      counts.minuteReset = now + 60000
    }
    if (now >= counts.hourReset) {
      counts.hour = 0
      counts.hourReset = now + 3600000
    }

    // Check limits
    if (counts.second >= config.requestsPerSecond) {
      return { allowed: false, retryAfter: counts.secondReset - now }
    }
    if (counts.minute >= config.requestsPerMinute) {
      return { allowed: false, retryAfter: counts.minuteReset - now }
    }
    if (counts.hour >= config.requestsPerHour) {
      return { allowed: false, retryAfter: counts.hourReset - now }
    }

    // Increment counters
    counts.second++
    counts.minute++
    counts.hour++

    return { allowed: true }
  }

  cleanup(): void {
    const now = Date.now()
    for (const [key, counts] of this.requestCounts.entries()) {
      if (now > counts.hourReset) {
        this.requestCounts.delete(key)
      }
    }
  }
}

// ====================================
// Job Processor (Worker)
// ====================================

export class JobProcessor {
  private workerId: string
  private supabase: SupabaseClient
  private queueManager: JobQueueManager
  private rateLimiter: RateLimiter
  private config: WorkerConfig
  private isRunning = false
  private isShuttingDown = false
  private currentJobs = new Set<string>()
  private health: WorkerHealth
  private startTime: Date

  constructor(config: WorkerConfig, supabase?: SupabaseClient) {
    this.workerId = `worker-${crypto.randomUUID()}`
    this.supabase = supabase || createClient()
    this.queueManager = new JobQueueManager(this.supabase)
    this.rateLimiter = new RateLimiter()
    this.config = config
    this.startTime = new Date()
    
    this.health = {
      workerId: this.workerId,
      status: 'healthy',
      lastHeartbeat: new Date(),
      uptime: 0,
      processedJobs: 0,
      currentLoad: 0,
      memoryUsage: 0,
      version: '1.0.0'
    }
  }

  // Start the worker
  async start(): Promise<void> {
    if (this.isRunning) {
      return
    }

    this.isRunning = true
    console.log(`Starting job processor ${this.workerId}`)

    // Start main processing loop
    this.startProcessingLoop()

    // Start health monitoring
    this.startHealthMonitoring()

    // Start cleanup tasks
    this.startCleanupTasks()

    // Register worker in database
    await this.registerWorker()
  }

  // Stop the worker gracefully
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return
    }

    console.log(`Stopping job processor ${this.workerId}`)
    this.isShuttingDown = true

    // Wait for current jobs to complete
    const shutdownPromise = new Promise<void>((resolve) => {
      const checkInterval = setInterval(() => {
        if (this.currentJobs.size === 0) {
          clearInterval(checkInterval)
          resolve()
        }
      }, 100)
    })

    // Wait with timeout
    await Promise.race([
      shutdownPromise,
      new Promise(resolve => setTimeout(resolve, this.config.gracefulShutdownTimeout))
    ])

    this.isRunning = false
    await this.unregisterWorker()
    await this.queueManager.shutdown()

    console.log(`Job processor ${this.workerId} stopped`)
  }

  // Main processing loop
  private startProcessingLoop(): void {
    const processJobs = async () => {
      if (this.isShuttingDown) {
        return
      }

      try {
        // Check if we can process more jobs
        if (this.currentJobs.size >= this.config.maxConcurrentJobs) {
          return
        }

        // Get next job
        const job = await this.queueManager.dequeue()
        if (!job) {
          return
        }

        // Check rate limits
        const rateCheck = await this.rateLimiter.checkRateLimit(
          job.payload.providerId || 'default',
          this.config.rateLimit
        )

        if (!rateCheck.allowed) {
          // Reschedule job
          setTimeout(() => {
            this.queueManager.enqueue({
              ...job,
              status: 'pending',
              scheduledAt: new Date(Date.now() + (rateCheck.retryAfter || 1000))
            })
          }, rateCheck.retryAfter || 1000)
          return
        }

        // Process job
        this.processJob(job)
      } catch (error) {
        console.error('Processing loop error:', error)
      }
    }

    // Start processing interval
    setInterval(processJobs, this.config.pollInterval)
  }

  // Process individual job
  private async processJob(job: Job): Promise<void> {
    this.currentJobs.add(job.id)
    
    try {
      await this.queueManager.updateJobStatus(job.id, 'in_progress')
      
      let result: any
      
      switch (job.type) {
        case 'single_lead_enrichment':
          result = await this.processSingleLeadEnrichment(job)
          break
        case 'batch_lead_enrichment':
          result = await this.processBatchLeadEnrichment(job)
          break
        case 'email_validation':
          result = await this.processEmailValidation(job)
          break
        case 'company_data_update':
          result = await this.processCompanyDataUpdate(job)
          break
        case 'social_profile_discovery':
          result = await this.processSocialProfileDiscovery(job)
          break
        default:
          throw new Error(`Unknown job type: ${job.type}`)
      }

      await this.queueManager.updateJobStatus(job.id, 'completed', result)
      
      // Send webhook if configured
      if (job.webhookUrl) {
        await this.sendWebhook(job.webhookUrl, {
          jobId: job.id,
          status: 'completed',
          result
        })
      }

      this.health.processedJobs++
    } catch (error: any) {
      console.error(`Job ${job.id} failed:`, error)
      
      await this.queueManager.updateJobStatus(job.id, 'failed', undefined, {
        message: error.message,
        code: error.code || 'UNKNOWN_ERROR',
        stack: error.stack
      })

      // Retry if possible
      if (job.retryCount < job.maxRetries) {
        await this.queueManager.retryJob(job.id, this.config)
      }

      // Send webhook for failure
      if (job.webhookUrl) {
        await this.sendWebhook(job.webhookUrl, {
          jobId: job.id,
          status: 'failed',
          error: {
            message: error.message,
            code: error.code || 'UNKNOWN_ERROR'
          }
        })
      }
    } finally {
      this.currentJobs.delete(job.id)
      this.updateHealth()
    }
  }

  // Job processors for different types
  private async processSingleLeadEnrichment(job: Job): Promise<any> {
    const { leadId, workspaceId, providerId, enrichmentTypes } = job.payload
    
    const results = []
    for (const enrichmentType of enrichmentTypes) {
      const request: EnrichmentRequest = {
        workspaceId,
        leadId,
        providerId,
        requestType: enrichmentType,
        inputData: job.payload.inputData,
        priority: job.priority
      }
      
      const result = await enrichmentService.enrichLead(request)
      results.push(result)
    }
    
    return results
  }

  private async processBatchLeadEnrichment(job: Job): Promise<any> {
    const { leadIds, workspaceId, providerId, enrichmentTypes } = job.payload
    
    const requests: EnrichmentRequest[] = []
    for (const leadId of leadIds) {
      for (const enrichmentType of enrichmentTypes) {
        requests.push({
          workspaceId,
          leadId,
          providerId,
          requestType: enrichmentType,
          inputData: job.payload.inputData[leadId] || {},
          priority: job.priority
        })
      }
    }
    
    return await enrichmentService.enrichBatch({
      requests,
      maxConcurrency: 3,
      stopOnError: false
    })
  }

  private async processEmailValidation(job: Job): Promise<any> {
    const { emails, providerId } = job.payload
    
    const results = []
    for (const email of emails) {
      const result = await enrichmentService.validateEmail(email, providerId)
      results.push({ email, ...result })
    }
    
    return results
  }

  private async processCompanyDataUpdate(job: Job): Promise<any> {
    const { companies, providerId } = job.payload
    
    const results = []
    for (const company of companies) {
      const result = await enrichmentService.getCompanyInfo(company, providerId)
      results.push({ company, result })
    }
    
    return results
  }

  private async processSocialProfileDiscovery(job: Job): Promise<any> {
    const { contacts, providerId } = job.payload
    
    const results = []
    for (const contact of contacts) {
      const request: EnrichmentRequest = {
        workspaceId: job.workspaceId,
        providerId,
        requestType: 'social_profiles',
        inputData: contact,
        priority: job.priority
      }
      
      const result = await enrichmentService.enrichLead(request)
      results.push(result)
    }
    
    return results
  }

  // Send webhook notification
  private async sendWebhook(url: string, payload: any): Promise<void> {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': `ColdCopy-JobProcessor/${this.health.version}`
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        throw new Error(`Webhook failed: ${response.status} ${response.statusText}`)
      }
    } catch (error) {
      console.error('Webhook error:', error)
      // Don't throw - webhook failures shouldn't fail the job
    }
  }

  // Health monitoring
  private startHealthMonitoring(): void {
    setInterval(() => {
      this.updateHealth()
      this.updateHeartbeat()
    }, this.config.healthCheckInterval)
  }

  private updateHealth(): void {
    const now = new Date()
    this.health.lastHeartbeat = now
    this.health.uptime = now.getTime() - this.startTime.getTime()
    this.health.currentLoad = this.currentJobs.size / this.config.maxConcurrentJobs
    this.health.memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024 // MB

    // Determine health status
    if (this.health.currentLoad > 0.9) {
      this.health.status = 'degraded'
    } else if (this.health.currentLoad > 0.95) {
      this.health.status = 'unhealthy'
    } else {
      this.health.status = 'healthy'
    }
  }

  private async updateHeartbeat(): Promise<void> {
    try {
      await this.supabase
        .from('enrichment_workers')
        .upsert({
          worker_id: this.workerId,
          status: this.health.status,
          last_heartbeat: this.health.lastHeartbeat.toISOString(),
          uptime: this.health.uptime,
          processed_jobs: this.health.processedJobs,
          current_load: this.health.currentLoad,
          memory_usage: this.health.memoryUsage,
          version: this.health.version
        })
    } catch (error) {
      console.error('Heartbeat update failed:', error)
    }
  }

  // Cleanup tasks
  private startCleanupTasks(): void {
    // Rate limiter cleanup
    setInterval(() => {
      this.rateLimiter.cleanup()
    }, 60000) // Every minute

    // Job cleanup
    setInterval(async () => {
      try {
        const cleaned = await this.queueManager.cleanup(7) // Keep jobs for 7 days
        if (cleaned > 0) {
          console.log(`Cleaned up ${cleaned} old jobs`)
        }
      } catch (error) {
        console.error('Cleanup error:', error)
      }
    }, 3600000) // Every hour
  }

  // Worker registration
  private async registerWorker(): Promise<void> {
    await this.supabase
      .from('enrichment_workers')
      .insert({
        worker_id: this.workerId,
        status: this.health.status,
        last_heartbeat: this.health.lastHeartbeat.toISOString(),
        uptime: 0,
        processed_jobs: 0,
        current_load: 0,
        memory_usage: this.health.memoryUsage,
        version: this.health.version
      })
  }

  private async unregisterWorker(): Promise<void> {
    await this.supabase
      .from('enrichment_workers')
      .delete()
      .eq('worker_id', this.workerId)
  }

  // Public getters
  getHealth(): WorkerHealth {
    return { ...this.health }
  }

  getCurrentLoad(): number {
    return this.currentJobs.size / this.config.maxConcurrentJobs
  }
}

// ====================================
// Default Configuration
// ====================================

export const DEFAULT_WORKER_CONFIG: WorkerConfig = {
  maxConcurrentJobs: 10,
  pollInterval: 1000, // 1 second
  healthCheckInterval: 30000, // 30 seconds
  gracefulShutdownTimeout: 30000, // 30 seconds
  retryConfig: {
    baseDelay: 1000, // 1 second
    maxDelay: 300000, // 5 minutes
    backoffMultiplier: 2
  },
  rateLimit: {
    requestsPerSecond: 10,
    requestsPerMinute: 100,
    requestsPerHour: 1000
  }
}

// ====================================
// Utility Functions
// ====================================

export function createJobProcessor(config?: Partial<WorkerConfig>): JobProcessor {
  const fullConfig = { ...DEFAULT_WORKER_CONFIG, ...config }
  return new JobProcessor(fullConfig)
}

export async function enqueueJob(
  type: JobType,
  workspaceId: string,
  payload: Record<string, any>,
  options: {
    priority?: JobPriority
    maxRetries?: number
    webhookUrl?: string
    tags?: string[]
    scheduledAt?: Date
  } = {}
): Promise<string> {
  const queueManager = new JobQueueManager()
  
  return await queueManager.enqueue({
    workspaceId,
    type,
    priority: options.priority || 3,
    status: 'pending',
    payload,
    retryCount: 0,
    maxRetries: options.maxRetries || 3,
    webhookUrl: options.webhookUrl,
    tags: options.tags,
    scheduledAt: options.scheduledAt
  })
}

export async function getJobStatus(jobId: string): Promise<Job | null> {
  const queueManager = new JobQueueManager()
  return await queueManager.getJob(jobId)
}

export async function getJobMetrics(): Promise<JobMetrics> {
  const queueManager = new JobQueueManager()
  return await queueManager.getMetrics()
}