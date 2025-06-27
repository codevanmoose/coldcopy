#!/usr/bin/env node

import { JobProcessor, DEFAULT_WORKER_CONFIG, WorkerConfig } from './job-processor'
import { enrichmentService } from './enrichment-service'

// ====================================
// Worker Process Management
// ====================================

class WorkerManager {
  private processors: JobProcessor[] = []
  private isShuttingDown = false
  private shutdownPromise: Promise<void> | null = null

  constructor(private config: {
    workerCount: number
    workerConfig: WorkerConfig
  }) {}

  async start(): Promise<void> {
    console.log(`Starting ${this.config.workerCount} worker processes...`)

    // Initialize enrichment service with providers
    await this.initializeEnrichmentService()

    // Start worker processes
    for (let i = 0; i < this.config.workerCount; i++) {
      const processor = new JobProcessor(this.config.workerConfig)
      this.processors.push(processor)
      await processor.start()
      console.log(`Worker ${i + 1} started`)
    }

    // Set up graceful shutdown handlers
    this.setupShutdownHandlers()

    console.log(`All ${this.config.workerCount} workers started successfully`)
  }

  async stop(): Promise<void> {
    if (this.isShuttingDown) {
      return this.shutdownPromise!
    }

    this.isShuttingDown = true
    this.shutdownPromise = this.performShutdown()
    return this.shutdownPromise
  }

  private async performShutdown(): Promise<void> {
    console.log('Shutting down workers...')

    // Stop all processors concurrently
    await Promise.all(
      this.processors.map((processor, index) => {
        console.log(`Stopping worker ${index + 1}...`)
        return processor.stop()
      })
    )

    console.log('All workers stopped successfully')
  }

  private setupShutdownHandlers(): void {
    // Handle various shutdown signals
    const signals = ['SIGINT', 'SIGTERM', 'SIGUSR2']
    
    signals.forEach((signal) => {
      process.on(signal, async () => {
        console.log(`Received ${signal}, shutting down gracefully...`)
        await this.stop()
        process.exit(0)
      })
    })

    // Handle uncaught exceptions
    process.on('uncaughtException', async (error) => {
      console.error('Uncaught exception:', error)
      await this.stop()
      process.exit(1)
    })

    // Handle unhandled promise rejections
    process.on('unhandledRejection', async (reason, promise) => {
      console.error('Unhandled promise rejection:', reason)
      await this.stop()
      process.exit(1)
    })
  }

  private async initializeEnrichmentService(): Promise<void> {
    try {
      // Load and register enrichment providers
      await enrichmentService.loadProvidersFromDatabase()
      console.log('Enrichment providers loaded successfully')
    } catch (error) {
      console.error('Failed to initialize enrichment service:', error)
      throw error
    }
  }

  getStatus(): {
    isShuttingDown: boolean
    workerCount: number
    processors: Array<{
      workerId: string
      health: any
      currentLoad: number
    }>
  } {
    return {
      isShuttingDown: this.isShuttingDown,
      workerCount: this.processors.length,
      processors: this.processors.map(processor => ({
        workerId: processor.getHealth().workerId,
        health: processor.getHealth(),
        currentLoad: processor.getCurrentLoad()
      }))
    }
  }
}

// ====================================
// Configuration
// ====================================

function getWorkerConfig(): WorkerConfig {
  return {
    maxConcurrentJobs: parseInt(process.env.MAX_CONCURRENT_JOBS || '10'),
    pollInterval: parseInt(process.env.POLL_INTERVAL || '1000'),
    healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000'),
    gracefulShutdownTimeout: parseInt(process.env.GRACEFUL_SHUTDOWN_TIMEOUT || '30000'),
    retryConfig: {
      baseDelay: parseInt(process.env.RETRY_BASE_DELAY || '1000'),
      maxDelay: parseInt(process.env.RETRY_MAX_DELAY || '300000'),
      backoffMultiplier: parseFloat(process.env.RETRY_BACKOFF_MULTIPLIER || '2')
    },
    rateLimit: {
      requestsPerSecond: parseInt(process.env.RATE_LIMIT_PER_SECOND || '10'),
      requestsPerMinute: parseInt(process.env.RATE_LIMIT_PER_MINUTE || '100'),
      requestsPerHour: parseInt(process.env.RATE_LIMIT_PER_HOUR || '1000')
    }
  }
}

function getWorkerCount(): number {
  const cpuCount = require('os').cpus().length
  const defaultWorkerCount = Math.max(1, Math.floor(cpuCount / 2))
  return parseInt(process.env.WORKER_COUNT || defaultWorkerCount.toString())
}

// ====================================
// Health Check Server (for Vercel health checks)
// ====================================

async function startHealthCheckServer(workerManager: WorkerManager): Promise<void> {
  const http = require('http')
  const port = parseInt(process.env.HEALTH_CHECK_PORT || '3001')

  const server = http.createServer((req: any, res: any) => {
    if (req.url === '/health') {
      const status = workerManager.getStatus()
      
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        status: status.isShuttingDown ? 'shutting_down' : 'healthy',
        timestamp: new Date().toISOString(),
        workers: status.processors.map(p => ({
          id: p.workerId,
          status: p.health.status,
          load: p.currentLoad,
          uptime: p.health.uptime,
          processedJobs: p.health.processedJobs
        }))
      }))
    } else if (req.url === '/metrics') {
      const status = workerManager.getStatus()
      
      // Prometheus-style metrics
      const metrics = [
        `# HELP enrichment_workers_total Total number of workers`,
        `# TYPE enrichment_workers_total gauge`,
        `enrichment_workers_total ${status.workerCount}`,
        ``,
        `# HELP enrichment_worker_load Current load per worker`,
        `# TYPE enrichment_worker_load gauge`,
        ...status.processors.map(p => 
          `enrichment_worker_load{worker_id="${p.workerId}"} ${p.currentLoad}`
        ),
        ``,
        `# HELP enrichment_worker_processed_jobs_total Total jobs processed by worker`,
        `# TYPE enrichment_worker_processed_jobs_total counter`,
        ...status.processors.map(p => 
          `enrichment_worker_processed_jobs_total{worker_id="${p.workerId}"} ${p.health.processedJobs}`
        )
      ].join('\n')

      res.writeHead(200, { 'Content-Type': 'text/plain' })
      res.end(metrics)
    } else {
      res.writeHead(404)
      res.end('Not Found')
    }
  })

  server.listen(port, () => {
    console.log(`Health check server listening on port ${port}`)
  })
}

// ====================================
// Main Entry Point
// ====================================

async function main(): Promise<void> {
  console.log('ColdCopy Enrichment Worker Manager')
  console.log('==================================')

  // Validate environment
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    console.error('Missing required environment variables: SUPABASE_URL, SUPABASE_ANON_KEY')
    process.exit(1)
  }

  const workerConfig = getWorkerConfig()
  const workerCount = getWorkerCount()

  console.log('Configuration:')
  console.log(`- Worker Count: ${workerCount}`)
  console.log(`- Max Concurrent Jobs: ${workerConfig.maxConcurrentJobs}`)
  console.log(`- Poll Interval: ${workerConfig.pollInterval}ms`)
  console.log(`- Rate Limit: ${workerConfig.rateLimit.requestsPerSecond}/s, ${workerConfig.rateLimit.requestsPerMinute}/m, ${workerConfig.rateLimit.requestsPerHour}/h`)
  console.log('')

  const workerManager = new WorkerManager({
    workerCount,
    workerConfig
  })

  try {
    // Start health check server
    await startHealthCheckServer(workerManager)
    
    // Start worker processes
    await workerManager.start()
    
    // Keep the process running
    process.stdin.resume()
    
  } catch (error) {
    console.error('Failed to start worker manager:', error)
    process.exit(1)
  }
}

// ====================================
// Utility Functions for Serverless
// ====================================

export async function createServerlessWorker(): Promise<JobProcessor> {
  const config = getWorkerConfig()
  
  // Reduce resources for serverless environment
  config.maxConcurrentJobs = 5
  config.pollInterval = 2000
  config.gracefulShutdownTimeout = 15000
  
  const processor = new JobProcessor(config)
  await processor.start()
  
  return processor
}

export async function processJobsOnce(maxJobs = 10): Promise<number> {
  const processor = await createServerlessWorker()
  let processedCount = 0
  
  try {
    // Process jobs for a limited time in serverless environment
    const timeout = new Promise(resolve => setTimeout(resolve, 25000)) // 25 seconds max
    const processJobs = async () => {
      // This would need to be implemented in the JobProcessor
      // as a method to process a specific number of jobs
      return processedCount
    }
    
    processedCount = await Promise.race([processJobs(), timeout]) as number
    
  } finally {
    await processor.stop()
  }
  
  return processedCount
}

// ====================================
// Run if called directly
// ====================================

if (require.main === module) {
  main().catch((error) => {
    console.error('Worker process failed:', error)
    process.exit(1)
  })
}

export { WorkerManager }