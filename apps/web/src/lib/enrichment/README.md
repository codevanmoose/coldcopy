# ColdCopy Enrichment Job Processing System

A comprehensive background job processing system for handling lead enrichment tasks with support for Vercel serverless functions and traditional server deployments.

## Features

### 🚀 Job Queue Management
- **Priority-based processing** (1=highest, 5=lowest priority)
- **Concurrency control** with configurable max concurrent jobs
- **Exponential backoff retry** mechanism with dead letter queue
- **Scheduled job execution** for delayed processing
- **Job tagging** for organization and filtering

### 🔄 Worker System
- **Background workers** that process enrichment requests
- **Rate limiting** per provider to respect API limits
- **Health monitoring** with heartbeat tracking
- **Graceful shutdown** handling for safe deployments
- **Auto-scaling** support for multiple worker processes

### 📊 Job Types
- **Single lead enrichment** - Process individual leads
- **Batch lead enrichment** - Process multiple leads efficiently
- **Email validation** - Validate email addresses
- **Company data updates** - Enrich company information
- **Social profile discovery** - Find social media profiles

### 📈 Monitoring & Observability
- **Real-time job tracking** with status updates
- **Performance metrics** (throughput, success rate, etc.)
- **Error rate monitoring** with detailed error tracking
- **Queue depth monitoring** to prevent bottlenecks
- **Worker health checks** for system reliability

### 🔗 Webhook Integration
- **Progress updates** via webhooks for real-time UI updates
- **Result notifications** when jobs complete
- **Provider webhook handling** for async enrichment services
- **Custom webhook URLs** for external integrations

## Architecture

### Core Components

1. **JobQueueManager** - Manages job queuing, dequeuing, and status updates
2. **JobProcessor** - Worker processes that execute jobs
3. **RateLimiter** - Enforces API rate limits per provider
4. **WorkerManager** - Orchestrates multiple worker processes

### Database Schema

The system uses PostgreSQL with the following key tables:

- `enrichment_jobs` - Stores job definitions, status, and results
- `enrichment_workers` - Tracks worker health and performance
- `enrichment_webhooks` - Manages webhook configurations

## Deployment Options

### 1. Vercel Serverless (Recommended)

The system is designed to work efficiently with Vercel's serverless functions:

```typescript
// vercel.json
{
  "crons": [
    {
      "path": "/api/enrichment/process",
      "schedule": "* * * * *"
    }
  ],
  "functions": {
    "src/app/api/enrichment/process/route.ts": {
      "maxDuration": 30
    }
  }
}
```

**Benefits:**
- ✅ Auto-scaling based on load
- ✅ No server management required
- ✅ Built-in monitoring and logging
- ✅ Cost-effective for variable workloads

**Limitations:**
- ⚠️ 30-second execution limit per function
- ⚠️ Cold starts may add latency
- ⚠️ Stateless execution (no persistent workers)

### 2. Traditional Server Deployment

For high-volume or long-running jobs, deploy dedicated worker processes:

```bash
# Start worker processes
npm run worker:start

# Or using PM2 for production
pm2 start ecosystem.config.js
```

**Benefits:**
- ✅ Persistent worker processes
- ✅ No execution time limits
- ✅ Better performance for high-volume processing
- ✅ Full control over resources

## Usage Examples

### Enqueue a Single Lead Enrichment

```typescript
import { enqueueJob } from '@/lib/enrichment/job-processor'

const jobId = await enqueueJob(
  'single_lead_enrichment',
  workspaceId,
  {
    leadId: 'lead_123',
    providerId: 'clearbit',
    enrichmentTypes: ['email', 'company', 'social'],
    inputData: {
      firstName: 'John',
      lastName: 'Doe',
      company: 'Acme Corp'
    }
  },
  {
    priority: 2,
    maxRetries: 3,
    webhookUrl: 'https://app.example.com/webhook/enrichment',
    tags: ['lead_enrichment', 'clearbit']
  }
)
```

### Batch Lead Enrichment

```typescript
const jobId = await enqueueJob(
  'batch_lead_enrichment',
  workspaceId,
  {
    leadIds: ['lead_1', 'lead_2', 'lead_3'],
    providerId: 'hunter',
    enrichmentTypes: ['email'],
    inputData: {
      'lead_1': { firstName: 'John', lastName: 'Doe', company: 'Acme' },
      'lead_2': { firstName: 'Jane', lastName: 'Smith', company: 'Tech Co' }
    }
  },
  {
    priority: 3,
    maxRetries: 2,
    tags: ['batch_processing', 'email_finder']
  }
)
```

### Email Validation

```typescript
const jobId = await enqueueJob(
  'email_validation',
  workspaceId,
  {
    emails: ['john@example.com', 'jane@company.com'],
    providerId: 'hunter'
  },
  {
    priority: 1,
    tags: ['email_validation']
  }
)
```

## API Endpoints

### Job Management

```typescript
// Create a new job
POST /api/enrichment/jobs
{
  "type": "single_lead_enrichment",
  "payload": { ... },
  "priority": 2,
  "webhookUrl": "https://example.com/webhook"
}

// Get job status
GET /api/enrichment/jobs/{jobId}

// List jobs with filtering
GET /api/enrichment/jobs?status=completed&type=batch_lead_enrichment

// Update job
PUT /api/enrichment/jobs/{jobId}
{
  "priority": 1,
  "webhookUrl": "https://new-webhook.com"
}

// Cancel job
DELETE /api/enrichment/jobs/{jobId}

// Retry failed job
POST /api/enrichment/jobs/{jobId}/retry

// Bulk operations
POST /api/enrichment/jobs/bulk
{
  "jobIds": ["job1", "job2"],
  "action": "cancel"
}

// Get metrics
GET /api/enrichment/jobs/metrics
```

### Webhook Handling

```typescript
// Provider webhooks
POST /api/enrichment/webhook?provider=clearbit
{
  "person_id": "123",
  "status": "completed",
  "data": { ... }
}

// Generic job updates
POST /api/enrichment/webhook
{
  "jobId": "job_123",
  "event": "job.completed",
  "data": { ... }
}
```

### Serverless Processing

```typescript
// Trigger job processing (for cron jobs)
POST /api/enrichment/process
{
  "maxJobs": 10,
  "timeout": 25000
}

// Health check
GET /api/enrichment/process
```

## React Components

### Job Status Dashboard

```typescript
import JobStatus from '@/components/enrichment/job-status'

function EnrichmentDashboard() {
  return (
    <JobStatus 
      workspaceId={workspaceId}
      onJobUpdate={(job) => {
        console.log('Job updated:', job)
      }}
    />
  )
}
```

The `JobStatus` component provides:
- Real-time job status updates
- Metrics dashboard
- Job filtering and searching
- Retry and cancel actions
- Detailed job information

## Configuration

### Environment Variables

```bash
# Required
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# Worker Configuration
WORKER_COUNT=2                    # Number of worker processes
MAX_CONCURRENT_JOBS=10           # Max jobs per worker
POLL_INTERVAL=1000               # Polling interval in ms
HEALTH_CHECK_INTERVAL=30000      # Health check interval in ms
GRACEFUL_SHUTDOWN_TIMEOUT=30000  # Shutdown timeout in ms

# Retry Configuration
RETRY_BASE_DELAY=1000           # Base retry delay in ms
RETRY_MAX_DELAY=300000          # Max retry delay in ms
RETRY_BACKOFF_MULTIPLIER=2      # Exponential backoff multiplier

# Rate Limiting
RATE_LIMIT_PER_SECOND=10        # Requests per second
RATE_LIMIT_PER_MINUTE=100       # Requests per minute
RATE_LIMIT_PER_HOUR=1000        # Requests per hour

# Serverless
CRON_SECRET=your_cron_secret    # Secret for cron job authentication
HEALTH_CHECK_PORT=3001          # Health check server port

# Provider Secrets
CLEARBIT_WEBHOOK_SECRET=secret
HUNTER_WEBHOOK_SECRET=secret
APOLLO_WEBHOOK_SECRET=secret
```

### Worker Configuration

```typescript
import { createJobProcessor, DEFAULT_WORKER_CONFIG } from '@/lib/enrichment/job-processor'

const processor = createJobProcessor({
  ...DEFAULT_WORKER_CONFIG,
  maxConcurrentJobs: 15,
  rateLimit: {
    requestsPerSecond: 20,
    requestsPerMinute: 200,
    requestsPerHour: 2000
  }
})
```

## Monitoring

### Health Checks

The system provides comprehensive health monitoring:

```bash
# Worker health status
curl http://localhost:3001/health

# Prometheus metrics
curl http://localhost:3001/metrics

# Job metrics via API
curl /api/enrichment/jobs/metrics
```

### Real-time Updates

Subscribe to real-time job updates using Supabase realtime:

```typescript
const supabase = createClient()

supabase
  .channel('enrichment_updates')
  .on('broadcast', { event: 'job_update' }, (payload) => {
    console.log('Job update:', payload)
  })
  .subscribe()
```

## Error Handling

The system includes comprehensive error handling:

1. **Automatic Retries** - Failed jobs are automatically retried with exponential backoff
2. **Dead Letter Queue** - Jobs that exceed max retries are moved to dead letter status
3. **Provider Fallbacks** - Can automatically try alternative providers
4. **Graceful Degradation** - System continues operating even if some components fail

## Performance Optimization

### Database Indexes

The system includes optimized indexes for common query patterns:

```sql
-- Job querying
CREATE INDEX idx_enrichment_jobs_workspace_status ON enrichment_jobs (workspace_id, status);
CREATE INDEX idx_enrichment_jobs_status_priority ON enrichment_jobs (status, priority);

-- Performance monitoring
CREATE INDEX idx_enrichment_jobs_completed_performance ON enrichment_jobs (completed_at, started_at) WHERE status = 'completed';
```

### Caching

- **Memory caching** for frequently accessed data
- **Database result caching** for enrichment data
- **Provider response caching** to avoid duplicate API calls

### Rate Limiting

Intelligent rate limiting per provider:
- Respects individual provider limits
- Prevents API quota exhaustion
- Automatic retry with backoff

## Security

- **Row Level Security (RLS)** for multi-tenant data isolation
- **Webhook signature verification** for secure provider integration
- **API authentication** for all endpoints
- **Input validation** using Zod schemas

## Best Practices

1. **Use batch processing** for multiple leads to improve efficiency
2. **Set appropriate priorities** based on business requirements
3. **Configure webhooks** for real-time status updates
4. **Monitor queue depth** to prevent bottlenecks
5. **Use tags** for job organization and filtering
6. **Test with small batches** before scaling up

## Troubleshooting

### Common Issues

1. **Jobs stuck in pending** - Check worker health and restart if needed
2. **High error rates** - Verify provider API keys and rate limits
3. **Slow processing** - Increase worker count or adjust concurrency
4. **Memory issues** - Monitor worker memory usage and restart periodically

### Debugging

Enable debug logging:

```typescript
// Set environment variable
DEBUG=enrichment:*

// Or enable in code
console.log('Job processing debug info:', jobDetails)
```

## Migration

To set up the database schema:

```sql
-- Run the migration
\i src/lib/supabase/migrations/012_job_processor_schema.sql

-- Verify tables were created
\dt enrichment_*
```

## Contributing

When adding new job types:

1. Add the type to the `JobType` enum
2. Implement the processor in `JobProcessor`
3. Add API validation schemas
4. Update the UI components
5. Add tests and documentation