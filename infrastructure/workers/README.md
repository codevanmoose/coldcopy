# ColdCopy Background Workers Infrastructure

## Overview

ColdCopy uses background workers to handle time-consuming tasks asynchronously, ensuring the main application remains responsive. The worker system is built using Bull Queue (Redis-based) for Node.js compatibility with our Next.js stack.

## Architecture

### Queue System
- **Bull Queue** - Redis-backed job queue for Node.js
- **Redis** - Message broker and job storage
- **Workers** - Separate processes handling specific job types
- **Monitoring** - Bull Dashboard for queue visualization

### Job Types

1. **Email Jobs**
   - `send-email` - Send individual emails via SES
   - `send-bulk-email` - Batch email sending
   - `process-webhook` - Handle email event webhooks
   - `warm-email` - Email warm-up campaigns

2. **Enrichment Jobs**
   - `enrich-lead` - Fetch data from enrichment providers
   - `batch-enrich` - Bulk lead enrichment
   - `verify-email` - Email verification
   - `company-enrich` - Company data enrichment

3. **AI Jobs**
   - `generate-email-content` - AI email generation
   - `analyze-sentiment` - Sentiment analysis
   - `generate-smart-reply` - Reply suggestions
   - `extract-meeting-intent` - Meeting detection

4. **Analytics Jobs**
   - `calculate-campaign-stats` - Update campaign metrics
   - `refresh-analytics` - Refresh materialized views
   - `generate-report` - Create PDF reports
   - `export-data` - Data export jobs

5. **Integration Jobs**
   - `sync-hubspot` - HubSpot bidirectional sync
   - `sync-salesforce` - Salesforce sync
   - `sync-linkedin` - LinkedIn data sync
   - `sync-calendar` - Calendar integration

6. **Maintenance Jobs**
   - `cleanup-old-data` - Data retention
   - `optimize-images` - Image optimization
   - `backup-data` - Backup operations
   - `cache-warming` - Pre-load cache

## Implementation

### Queue Configuration
```typescript
// lib/queue/config.ts
import Queue from 'bull';
import Redis from 'ioredis';

const redisConfig = {
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: 3,
};

// Create queues
export const emailQueue = new Queue('email', { redis: redisConfig });
export const enrichmentQueue = new Queue('enrichment', { redis: redisConfig });
export const aiQueue = new Queue('ai', { redis: redisConfig });
export const analyticsQueue = new Queue('analytics', { redis: redisConfig });
export const integrationQueue = new Queue('integration', { redis: redisConfig });
export const maintenanceQueue = new Queue('maintenance', { redis: redisConfig });

// Queue options
export const defaultJobOptions = {
  removeOnComplete: 100,
  removeOnFail: 500,
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000,
  },
};
```

### Worker Process
```typescript
// workers/email-worker.ts
import { emailQueue } from '../lib/queue/config';
import { sendEmail } from '../lib/email/send';

emailQueue.process('send-email', async (job) => {
  const { to, subject, html, campaignId } = job.data;
  
  // Update job progress
  job.progress(10);
  
  // Send email
  const result = await sendEmail({ to, subject, html });
  
  job.progress(90);
  
  // Record metrics
  await recordEmailSent(campaignId, result);
  
  job.progress(100);
  
  return result;
});

// Error handling
emailQueue.on('failed', (job, err) => {
  console.error(`Job ${job.id} failed:`, err);
  // Send to error tracking
});
```

## Deployment

### Option 1: Separate Worker Containers

```yaml
# docker-compose.yml
services:
  worker-email:
    build:
      context: .
      dockerfile: Dockerfile.worker
    command: node workers/email-worker.js
    environment:
      - WORKER_TYPE=email
      - REDIS_URL=${REDIS_URL}
    depends_on:
      - redis
    restart: unless-stopped
    deploy:
      replicas: 2

  worker-enrichment:
    build:
      context: .
      dockerfile: Dockerfile.worker
    command: node workers/enrichment-worker.js
    environment:
      - WORKER_TYPE=enrichment
      - REDIS_URL=${REDIS_URL}
    depends_on:
      - redis
    restart: unless-stopped

  worker-ai:
    build:
      context: .
      dockerfile: Dockerfile.worker
    command: node workers/ai-worker.js
    environment:
      - WORKER_TYPE=ai
      - REDIS_URL=${REDIS_URL}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
    depends_on:
      - redis
    restart: unless-stopped
```

### Option 2: Digital Ocean App Platform Workers

```yaml
# app.yaml addition
workers:
  - name: email-worker
    github:
      branch: main
      repo: codevanmoose/coldcopy
    source_dir: /
    run_command: node apps/web/workers/email-worker.js
    instance_count: 2
    instance_size_slug: basic-xxs
    envs:
      - key: WORKER_TYPE
        value: email
      - key: REDIS_URL
        value: ${redis.REDIS_URL}

  - name: enrichment-worker
    github:
      branch: main
      repo: codevanmoose/coldcopy
    source_dir: /
    run_command: node apps/web/workers/enrichment-worker.js
    instance_count: 1
    instance_size_slug: basic-xs
    envs:
      - key: WORKER_TYPE
        value: enrichment
      - key: REDIS_URL
        value: ${redis.REDIS_URL}
```

### Option 3: Standalone Droplets

```bash
# Deploy workers on separate droplets
doctl compute droplet create worker-1 \
  --image ubuntu-22-04-x64 \
  --size s-2vcpu-2gb \
  --region nyc1 \
  --ssh-keys [your-key-id] \
  --user-data-file worker-setup.sh
```

## Worker Configuration

### Concurrency Settings
```typescript
// Email worker - Lower concurrency due to rate limits
emailQueue.concurrency = 5;

// Enrichment worker - Higher concurrency
enrichmentQueue.concurrency = 20;

// AI worker - Limited by API rate limits
aiQueue.concurrency = 3;

// Analytics worker - CPU intensive
analyticsQueue.concurrency = 2;
```

### Priority Queues
```typescript
// Add high-priority job
await emailQueue.add('send-email', data, {
  priority: 1, // Higher number = higher priority
  delay: 0,
});

// Add low-priority job
await analyticsQueue.add('generate-report', data, {
  priority: 10,
  delay: 60000, // Delay 1 minute
});
```

### Rate Limiting
```typescript
// Configure rate limiting
emailQueue.process('send-email', 100, '1m', async (job) => {
  // Process max 100 jobs per minute
});

// Or use limiter
const limiter = new Bottleneck({
  maxConcurrent: 5,
  minTime: 200, // 200ms between operations
});
```

## Monitoring

### Bull Dashboard
```typescript
// apps/web/pages/admin/queues.tsx
import { createBullBoard } from '@bull-board/api';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import { ExpressAdapter } from '@bull-board/express';

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [
    new BullAdapter(emailQueue),
    new BullAdapter(enrichmentQueue),
    new BullAdapter(aiQueue),
    new BullAdapter(analyticsQueue),
  ],
  serverAdapter,
});

// Use in Express app
app.use('/admin/queues', serverAdapter.getRouter());
```

### Metrics Collection
```typescript
// Collect queue metrics
async function collectQueueMetrics() {
  const metrics = await Promise.all([
    emailQueue.getJobCounts(),
    enrichmentQueue.getJobCounts(),
    aiQueue.getJobCounts(),
  ]);
  
  // Send to monitoring
  await prometheus.gauge('queue_waiting', metrics[0].waiting);
  await prometheus.gauge('queue_active', metrics[0].active);
  await prometheus.gauge('queue_completed', metrics[0].completed);
  await prometheus.gauge('queue_failed', metrics[0].failed);
}
```

## Error Handling

### Retry Strategy
```typescript
const jobOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000,
  },
  removeOnComplete: true,
  removeOnFail: false,
};

// Custom retry logic
emailQueue.on('failed', async (job, err) => {
  if (job.attemptsMade < job.opts.attempts) {
    // Will retry automatically
    console.log(`Job ${job.id} failed, retrying...`);
  } else {
    // Final failure
    await handleFinalFailure(job, err);
  }
});
```

### Dead Letter Queue
```typescript
// Move failed jobs to DLQ after max retries
async function handleFinalFailure(job, error) {
  await deadLetterQueue.add('failed-job', {
    originalQueue: job.queue.name,
    jobData: job.data,
    error: error.message,
    failedAt: new Date(),
  });
  
  // Notify admins
  await notifyAdmins({
    type: 'job-failure',
    job: job.id,
    error: error.message,
  });
}
```

## Scaling Strategies

### Horizontal Scaling
```yaml
# Scale workers based on queue size
rules:
  - metric: queue_size
    queue: email
    threshold: 1000
    action: scale_up
    max_workers: 10
    
  - metric: queue_size
    queue: email
    threshold: 100
    action: scale_down
    min_workers: 2
```

### Vertical Scaling
- Email workers: 2GB RAM (handling attachments)
- AI workers: 4GB RAM (model loading)
- Analytics workers: 8GB RAM (data processing)
- Others: 1GB RAM

### Queue Sharding
```typescript
// Shard by workspace for better distribution
const queueShard = hash(workspaceId) % 4;
const queue = queues[`email-${queueShard}`];
await queue.add('send-email', data);
```

## Performance Optimization

### Batch Processing
```typescript
// Process emails in batches
emailQueue.process('send-bulk-email', async (job) => {
  const { emails } = job.data;
  const batchSize = 100;
  
  for (let i = 0; i < emails.length; i += batchSize) {
    const batch = emails.slice(i, i + batchSize);
    await sendBatch(batch);
    
    // Update progress
    job.progress((i / emails.length) * 100);
  }
});
```

### Caching
```typescript
// Cache frequently accessed data
const cachedEnrichment = await cache.get(`enrichment:${email}`);
if (cachedEnrichment) {
  return cachedEnrichment;
}

// Process and cache
const result = await enrichEmail(email);
await cache.set(`enrichment:${email}`, result, { ttl: 86400 });
```

## Security

### Job Authentication
```typescript
// Add auth token to sensitive jobs
await aiQueue.add('generate-content', {
  ...data,
  auth: {
    workspaceId,
    userId,
    timestamp: Date.now(),
    signature: generateSignature(data),
  },
});

// Verify in worker
aiQueue.process('generate-content', async (job) => {
  if (!verifySignature(job.data)) {
    throw new Error('Invalid job signature');
  }
  // Process job
});
```

### Data Encryption
```typescript
// Encrypt sensitive job data
const encryptedData = encrypt(sensitiveData);
await queue.add('process-sensitive', { encrypted: encryptedData });

// Decrypt in worker
const decryptedData = decrypt(job.data.encrypted);
```

## Cost Optimization

### Worker Sizing
| Worker Type | Recommended Size | Monthly Cost |
|-------------|-----------------|--------------|
| Email | 2 vCPU, 2GB RAM | $12 |
| Enrichment | 1 vCPU, 1GB RAM | $6 |
| AI | 2 vCPU, 4GB RAM | $24 |
| Analytics | 4 vCPU, 8GB RAM | $48 |
| Integration | 1 vCPU, 2GB RAM | $12 |
| Maintenance | 1 vCPU, 1GB RAM | $6 |

Total: ~$108/month for basic setup

### Auto-scaling Rules
```javascript
// Scale based on queue depth
if (queueSize > 1000 && activeWorkers < maxWorkers) {
  scaleUp();
} else if (queueSize < 100 && activeWorkers > minWorkers) {
  scaleDown();
}
```

## Maintenance

### Health Checks
```typescript
// Worker health endpoint
app.get('/health', async (req, res) => {
  const health = {
    status: 'ok',
    queues: await getQueueHealth(),
    redis: await checkRedisConnection(),
    memory: process.memoryUsage(),
    uptime: process.uptime(),
  };
  
  res.json(health);
});
```

### Log Aggregation
```typescript
// Structured logging
import winston from 'winston';

const logger = winston.createLogger({
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'worker.log' }),
  ],
});

// Log job events
queue.on('completed', (job) => {
  logger.info('Job completed', {
    jobId: job.id,
    queue: job.queue.name,
    duration: job.finishedOn - job.processedOn,
  });
});
```

## Troubleshooting

### Common Issues

1. **Jobs stuck in queue**
   ```bash
   # Check Redis connection
   redis-cli ping
   
   # Check queue status
   node scripts/check-queues.js
   
   # Clear stuck jobs
   node scripts/clear-stuck-jobs.js
   ```

2. **High memory usage**
   ```bash
   # Check worker memory
   ps aux | grep node
   
   # Restart workers
   pm2 restart all
   ```

3. **Slow processing**
   - Check Redis latency
   - Review job complexity
   - Scale workers horizontally
   - Optimize batch sizes

## Next Steps

1. Choose deployment strategy
2. Configure worker processes
3. Set up monitoring dashboard
4. Configure auto-scaling
5. Test job processing
6. Document job types
7. Set up alerts