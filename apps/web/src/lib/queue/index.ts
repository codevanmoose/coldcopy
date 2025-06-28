import Queue, { Job, JobOptions } from 'bull';
import Redis from 'ioredis';

// Redis configuration for Bull
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
};

// Create Redis connections for Bull
const createRedisClient = () => new Redis(redisConfig);

// Queue instances
export const emailQueue = new Queue('email', {
  createClient: createRedisClient,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 500,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
});

export const enrichmentQueue = new Queue('enrichment', {
  createClient: createRedisClient,
  defaultJobOptions: {
    removeOnComplete: 50,
    removeOnFail: 100,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  },
});

export const aiQueue = new Queue('ai', {
  createClient: createRedisClient,
  defaultJobOptions: {
    removeOnComplete: 50,
    removeOnFail: 100,
    attempts: 2,
    backoff: {
      type: 'fixed',
      delay: 10000,
    },
    timeout: 120000, // 2 minutes
  },
});

export const analyticsQueue = new Queue('analytics', {
  createClient: createRedisClient,
  defaultJobOptions: {
    removeOnComplete: 10,
    removeOnFail: 50,
    attempts: 1,
  },
});

export const integrationQueue = new Queue('integration', {
  createClient: createRedisClient,
  defaultJobOptions: {
    removeOnComplete: 50,
    removeOnFail: 200,
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 10000,
    },
  },
});

export const maintenanceQueue = new Queue('maintenance', {
  createClient: createRedisClient,
  defaultJobOptions: {
    removeOnComplete: 10,
    removeOnFail: 50,
    attempts: 1,
  },
});

// Job types
export enum JobType {
  // Email jobs
  SEND_EMAIL = 'send-email',
  SEND_BULK_EMAIL = 'send-bulk-email',
  PROCESS_WEBHOOK = 'process-webhook',
  WARM_EMAIL = 'warm-email',
  
  // Enrichment jobs
  ENRICH_LEAD = 'enrich-lead',
  BATCH_ENRICH = 'batch-enrich',
  VERIFY_EMAIL = 'verify-email',
  COMPANY_ENRICH = 'company-enrich',
  
  // AI jobs
  GENERATE_EMAIL_CONTENT = 'generate-email-content',
  ANALYZE_SENTIMENT = 'analyze-sentiment',
  GENERATE_SMART_REPLY = 'generate-smart-reply',
  EXTRACT_MEETING_INTENT = 'extract-meeting-intent',
  
  // Analytics jobs
  CALCULATE_CAMPAIGN_STATS = 'calculate-campaign-stats',
  REFRESH_ANALYTICS = 'refresh-analytics',
  GENERATE_REPORT = 'generate-report',
  EXPORT_DATA = 'export-data',
  
  // Integration jobs
  SYNC_HUBSPOT = 'sync-hubspot',
  SYNC_SALESFORCE = 'sync-salesforce',
  SYNC_LINKEDIN = 'sync-linkedin',
  SYNC_CALENDAR = 'sync-calendar',
  
  // Maintenance jobs
  CLEANUP_OLD_DATA = 'cleanup-old-data',
  OPTIMIZE_IMAGES = 'optimize-images',
  BACKUP_DATA = 'backup-data',
  CACHE_WARMING = 'cache-warming',
}

// Job priority levels
export enum JobPriority {
  CRITICAL = 1,
  HIGH = 5,
  NORMAL = 10,
  LOW = 20,
  BACKGROUND = 50,
}

// Helper to add jobs with proper typing
export async function addJob<T = any>(
  queue: Queue,
  type: JobType,
  data: T,
  options?: JobOptions
): Promise<Job<T>> {
  return queue.add(type, data, {
    ...options,
    attempts: options?.attempts ?? queue.defaultJobOptions.attempts,
    backoff: options?.backoff ?? queue.defaultJobOptions.backoff,
  });
}

// Bulk job addition
export async function addBulkJobs<T = any>(
  queue: Queue,
  jobs: Array<{ type: JobType; data: T; options?: JobOptions }>
): Promise<Job<T>[]> {
  const bulkJobs = jobs.map(job => ({
    name: job.type,
    data: job.data,
    opts: job.options,
  }));
  
  return queue.addBulk(bulkJobs);
}

// Get queue metrics
export async function getQueueMetrics(queue: Queue) {
  const [
    waiting,
    active,
    completed,
    failed,
    delayed,
    paused,
  ] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
    queue.getPausedCount(),
  ]);

  return {
    name: queue.name,
    waiting,
    active,
    completed,
    failed,
    delayed,
    paused,
    total: waiting + active + delayed + paused,
  };
}

// Get all queue metrics
export async function getAllQueueMetrics() {
  const queues = [
    emailQueue,
    enrichmentQueue,
    aiQueue,
    analyticsQueue,
    integrationQueue,
    maintenanceQueue,
  ];

  const metrics = await Promise.all(
    queues.map(queue => getQueueMetrics(queue))
  );

  return metrics;
}

// Clean completed jobs
export async function cleanCompletedJobs(queue: Queue, grace: number = 0) {
  const jobs = await queue.getCompleted();
  const toRemove = jobs.filter(
    job => Date.now() - job.finishedOn! > grace
  );
  
  await Promise.all(toRemove.map(job => job.remove()));
  
  return toRemove.length;
}

// Clean failed jobs
export async function cleanFailedJobs(queue: Queue, grace: number = 86400000) {
  const jobs = await queue.getFailed();
  const toRemove = jobs.filter(
    job => Date.now() - job.finishedOn! > grace
  );
  
  await Promise.all(toRemove.map(job => job.remove()));
  
  return toRemove.length;
}

// Retry failed jobs
export async function retryFailedJobs(queue: Queue) {
  const jobs = await queue.getFailed();
  
  await Promise.all(jobs.map(job => job.retry()));
  
  return jobs.length;
}

// Pause/Resume queue
export async function pauseQueue(queue: Queue) {
  await queue.pause();
}

export async function resumeQueue(queue: Queue) {
  await queue.resume();
}

// Queue event handlers
export function setupQueueEvents(queue: Queue) {
  queue.on('completed', (job, result) => {
    console.log(`Job ${job.id} completed in queue ${queue.name}`);
  });

  queue.on('failed', (job, err) => {
    console.error(`Job ${job.id} failed in queue ${queue.name}:`, err);
  });

  queue.on('stalled', (job) => {
    console.warn(`Job ${job.id} stalled in queue ${queue.name}`);
  });

  queue.on('error', (error) => {
    console.error(`Queue ${queue.name} error:`, error);
  });

  queue.on('waiting', (jobId) => {
    console.log(`Job ${jobId} waiting in queue ${queue.name}`);
  });

  queue.on('active', (job) => {
    console.log(`Job ${job.id} active in queue ${queue.name}`);
  });

  queue.on('progress', (job, progress) => {
    console.log(`Job ${job.id} progress in queue ${queue.name}: ${progress}%`);
  });
}

// Setup all queue events
export function setupAllQueueEvents() {
  const queues = [
    emailQueue,
    enrichmentQueue,
    aiQueue,
    analyticsQueue,
    integrationQueue,
    maintenanceQueue,
  ];

  queues.forEach(queue => setupQueueEvents(queue));
}

// Export all queues
export const queues = {
  email: emailQueue,
  enrichment: enrichmentQueue,
  ai: aiQueue,
  analytics: analyticsQueue,
  integration: integrationQueue,
  maintenance: maintenanceQueue,
};