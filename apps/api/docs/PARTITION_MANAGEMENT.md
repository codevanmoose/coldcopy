# Email Events Partition Management

This document describes the comprehensive partition management system implemented for the `email_events` table in ColdCopy. The system provides automatic monthly partitioning, maintenance, monitoring, and cleanup capabilities.

## Overview

The email_events table is partitioned by month using PostgreSQL's `PARTITION BY RANGE (created_at)` feature. This improves query performance, enables efficient data archival, and reduces maintenance overhead as the table grows to millions of records.

## Architecture

### Components

1. **Database Functions** (`002_enhanced_email_events_partitioning.sql`)
   - Partition creation functions
   - Automated maintenance procedures
   - Cleanup and archival functions
   - Monitoring views and statistics

2. **Python Partition Manager** (`utils/partition_manager.py`)
   - `EmailEventsPartitionManager` class
   - Async partition operations
   - Health checking and statistics
   - Error handling and logging

3. **API Endpoints** (`routers/partitions.py`)
   - Admin-only partition management endpoints
   - Real-time monitoring and statistics
   - Manual maintenance triggers

4. **Celery Tasks** (`workers/partition_tasks.py`)
   - Scheduled partition maintenance
   - Automated cleanup
   - Health monitoring
   - Statistics generation

5. **Monitoring System** (`utils/partition_monitoring.py`)
   - Proactive health monitoring
   - Alert generation
   - Performance tracking
   - Growth analysis

## Database Schema

### Partitioned Table Structure

```sql
CREATE TABLE email_events (
    id UUID DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL,
    campaign_id UUID NOT NULL,
    lead_id UUID NOT NULL,
    campaign_lead_id UUID REFERENCES campaign_leads(id) ON DELETE CASCADE,
    event_type email_event_type NOT NULL,
    email_id TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);
```

### Partition Naming Convention

Partitions follow the naming pattern: `email_events_YYYY_MM`

Examples:
- `email_events_2024_01` (January 2024)
- `email_events_2024_02` (February 2024)
- `email_events_2024_12` (December 2024)

### Indexes

Each partition automatically gets these optimized indexes:

```sql
-- Workspace and time-based queries
CREATE INDEX email_events_YYYY_MM_workspace_created_idx 
ON email_events_YYYY_MM (workspace_id, created_at DESC);

-- Campaign analytics
CREATE INDEX email_events_YYYY_MM_campaign_event_idx 
ON email_events_YYYY_MM (campaign_id, event_type, created_at DESC);

-- Lead tracking
CREATE INDEX email_events_YYYY_MM_lead_event_idx 
ON email_events_YYYY_MM (lead_id, event_type, created_at DESC);

-- Event filtering
CREATE INDEX email_events_YYYY_MM_event_type_idx 
ON email_events_YYYY_MM (event_type, created_at DESC) 
WHERE event_type IN ('open', 'click', 'delivery', 'bounce');

-- Webhook processing
CREATE INDEX email_events_YYYY_MM_external_id_idx 
ON email_events_YYYY_MM (external_id) 
WHERE external_id IS NOT NULL;
```

## Core Functions

### Database Functions

#### `create_email_events_partition(start_date, end_date)`
Creates a new monthly partition with optimized indexes.

```sql
SELECT create_email_events_partition('2024-03-01', '2024-04-01');
```

#### `maintain_email_events_partitions()`
Creates partitions for the next 6 months automatically.

```sql
SELECT maintain_email_events_partitions();
```

#### `cleanup_old_email_events_partitions(retention_months)`
Removes partitions older than the specified retention period.

```sql
SELECT * FROM cleanup_old_email_events_partitions(12); -- 12 months retention
```

#### `get_email_events_partition_stats()`
Returns comprehensive statistics for all partitions.

```sql
SELECT * FROM get_email_events_partition_stats();
```

### Python API

#### EmailEventsPartitionManager

```python
from utils.partition_manager import EmailEventsPartitionManager

# Initialize manager
manager = EmailEventsPartitionManager(db_session)

# Create a partition
await manager.create_partition(
    datetime(2024, 4, 1), 
    datetime(2024, 5, 1)
)

# Maintain partitions (create 6 months ahead)
result = await manager.maintain_partitions(months_ahead=6)

# Cleanup old partitions
result = await manager.cleanup_old_partitions(retention_months=12)

# Get partition statistics
stats = await manager.get_partition_stats()

# Check system health
health = await manager.check_partition_health()
```

## API Endpoints

All partition management endpoints require admin privileges and are under `/api/system/partitions/`.

### GET `/stats`
Returns detailed statistics for all partitions.

**Response:**
```json
[
  {
    "name": "email_events_2024_03",
    "period": "2024_03",
    "record_count": 150000,
    "size_mb": 256.5,
    "oldest_record": "2024-03-01T00:00:00Z",
    "newest_record": "2024-03-31T23:59:59Z"
  }
]
```

### GET `/health`
Returns partition system health status.

**Response:**
```json
{
  "status": "healthy",
  "issues": [],
  "recommendations": [],
  "partition_count": 15,
  "total_size_mb": 2048.5,
  "oldest_partition": "email_events_2023_01",
  "newest_partition": "email_events_2024_09"
}
```

### POST `/maintain`
Triggers partition maintenance.

**Parameters:**
- `months_ahead` (default: 6) - Number of months to create ahead

**Response:**
```json
{
  "success": true,
  "created_partitions": ["email_events_2024_07", "email_events_2024_08"],
  "dropped_partitions": [],
  "errors": [],
  "execution_time_ms": 1500
}
```

### POST `/cleanup`
Triggers partition cleanup.

**Parameters:**
- `retention_months` (default: 12) - Number of months to retain

**Response:**
```json
{
  "success": true,
  "created_partitions": [],
  "dropped_partitions": [["email_events_2022_12", 50000]],
  "errors": [],
  "execution_time_ms": 2500
}
```

### GET `/summary`
Returns comprehensive partition system summary.

## Scheduled Tasks

### Celery Tasks

The system includes automated Celery tasks for maintenance:

#### Weekly Partition Maintenance
```python
# Creates partitions 6 months ahead
"maintain-partitions-weekly": {
    "task": "partition_tasks.maintain_partitions",
    "schedule": 604800.0,  # 7 days
    "args": (6,),
}
```

#### Monthly Partition Cleanup
```python
# Removes partitions older than 12 months
"cleanup-partitions-monthly": {
    "task": "partition_tasks.cleanup_old_partitions", 
    "schedule": 2592000.0,  # 30 days
    "args": (12,),
}
```

#### Daily Health Check
```python
# Monitors partition system health
"health-check-daily": {
    "task": "partition_tasks.health_check",
    "schedule": 86400.0,  # 24 hours
}
```

#### Daily Statistics Generation
```python
# Generates and caches partition statistics
"generate-statistics-daily": {
    "task": "partition_tasks.generate_statistics",
    "schedule": 86400.0,  # 24 hours
}
```

### Manual Task Triggers

```python
from workers.partition_tasks import (
    trigger_partition_maintenance,
    trigger_partition_cleanup,
    trigger_health_check
)

# Trigger maintenance manually
task = trigger_partition_maintenance(months_ahead=6)

# Trigger cleanup manually
task = trigger_partition_cleanup(retention_months=12)

# Trigger health check
task = trigger_health_check()
```

## Monitoring and Alerting

### PartitionMonitor

The monitoring system provides proactive health checks:

```python
from utils.partition_monitoring import PartitionMonitor, PartitionAlerting

monitor = PartitionMonitor(partition_manager)

# Run comprehensive health check
alerts = await monitor.run_comprehensive_check()

# Get monitoring summary
summary = await monitor.get_monitoring_summary()
```

### Alert Types

The system monitors for:

1. **Oversized Partitions** (Warning)
   - Partitions larger than 5GB
   - Recommendation: Archive old data

2. **High Record Count** (Warning)
   - Partitions with > 10M records
   - Recommendation: Monitor performance

3. **Missing Current Partition** (Critical)
   - No partition for current month
   - Recommendation: Create immediately

4. **Insufficient Future Partitions** (Warning)
   - Less than 2 future partitions
   - Recommendation: Run maintenance

5. **High Growth Rate** (Info)
   - Month-over-month growth > 50%
   - Recommendation: Capacity planning

6. **Old Partitions** (Info)
   - Partitions older than 13 months
   - Recommendation: Consider archival

### Alert Handlers

```python
from utils.partition_monitoring import PartitionAlerting, log_alert_handler

alerting = PartitionAlerting()
alerting.add_handler(log_alert_handler)
# alerting.add_handler(email_alert_handler)  # When configured

await alerting.send_alerts(alerts)
```

## Performance Considerations

### Query Optimization

With partitioning, queries are automatically pruned to relevant partitions when using time-based filters:

```sql
-- Efficient: Only scans March 2024 partition
SELECT COUNT(*) FROM email_events 
WHERE created_at >= '2024-03-01' 
  AND created_at < '2024-04-01'
  AND workspace_id = 'workspace-123';

-- Less efficient: Scans all partitions
SELECT COUNT(*) FROM email_events 
WHERE workspace_id = 'workspace-123';
```

### Index Strategy

Each partition has specialized indexes for common query patterns:

1. **Workspace-based queries**: `(workspace_id, created_at DESC)`
2. **Campaign analytics**: `(campaign_id, event_type, created_at DESC)`
3. **Lead tracking**: `(lead_id, event_type, created_at DESC)`
4. **Event filtering**: `(event_type, created_at DESC)`
5. **Webhook processing**: `(external_id)`

### Best Practices

1. **Always include time filters** in queries when possible
2. **Use workspace_id** in WHERE clauses for better partition pruning
3. **Monitor partition sizes** regularly
4. **Archive old data** before partitions become too large
5. **Test query performance** on representative data sets

## Maintenance Operations

### Regular Maintenance

1. **Weekly**: Run partition maintenance to ensure future partitions exist
2. **Monthly**: Review partition sizes and performance
3. **Quarterly**: Evaluate retention policies and cleanup old data
4. **Annually**: Review partitioning strategy and thresholds

### Emergency Procedures

#### Missing Current Partition
```python
# Create current month partition immediately
from datetime import datetime
current_month = datetime.now().replace(day=1)
next_month = current_month + timedelta(days=32)
next_month = next_month.replace(day=1)

await manager.create_partition(current_month, next_month)
```

#### Partition Corruption
```sql
-- Detach corrupted partition
ALTER TABLE email_events DETACH PARTITION email_events_2024_03;

-- Recreate partition
SELECT create_email_events_partition('2024-03-01', '2024-04-01');

-- Restore data from backup if available
```

#### Performance Issues
```sql
-- Check partition sizes
SELECT * FROM get_email_events_partition_stats() 
ORDER BY size_mb DESC;

-- Analyze query performance
EXPLAIN (ANALYZE, BUFFERS) 
SELECT COUNT(*) FROM email_events 
WHERE created_at >= '2024-03-01' 
  AND workspace_id = 'workspace-123';
```

## Monitoring Dashboard

### Key Metrics

1. **Partition Count**: Total number of active partitions
2. **Total Size**: Combined size of all partitions
3. **Growth Rate**: Month-over-month size increase
4. **Health Status**: Overall system health (healthy/warning/critical)
5. **Active Alerts**: Current monitoring alerts

### Health Thresholds

- **Healthy**: All checks pass, sufficient future partitions
- **Warning**: Non-critical issues (large partitions, growth rate)
- **Critical**: Missing current partition, system errors
- **Error**: Monitoring system failures

## Troubleshooting

### Common Issues

#### 1. Partition Creation Fails
```
ERROR: relation "email_events_2024_04" already exists
```
**Solution**: Check if partition already exists, verify date ranges

#### 2. Query Performance Degradation
**Symptoms**: Slow queries on email_events table
**Solution**: 
- Verify query includes time filters
- Check if partition pruning is working
- Analyze index usage with EXPLAIN

#### 3. Disk Space Issues
**Symptoms**: Database running out of space
**Solution**:
- Run partition cleanup
- Archive old partitions
- Adjust retention policies

#### 4. Missing Partitions
**Symptoms**: Queries fail with "no partition found"
**Solution**:
- Run partition maintenance
- Create missing partitions manually
- Check scheduled task status

### Diagnostic Commands

```python
# Check system health
health = await manager.check_partition_health()

# Get detailed statistics
stats = await manager.get_partition_stats()

# Review maintenance logs
logs = await get_partition_maintenance_log(limit=100)

# Run comprehensive monitoring
alerts = await monitor.run_comprehensive_check()
```

## Configuration

### Environment Variables

```env
# Partition retention (months)
PARTITION_RETENTION_MONTHS=12

# Future partition creation (months ahead)
PARTITION_MONTHS_AHEAD=6

# Monitoring thresholds
PARTITION_MAX_SIZE_GB=5
PARTITION_MAX_RECORDS=10000000
```

### Celery Configuration

```python
# Task routing
CELERY_TASK_ROUTES = {
    'partition_tasks.*': {'queue': 'partition_maintenance'},
}

# Task timeouts
CELERY_TASK_TIME_LIMIT = 1800  # 30 minutes
CELERY_TASK_SOFT_TIME_LIMIT = 1500  # 25 minutes
```

## Migration Guide

### Enabling Partitioning

If migrating from a non-partitioned email_events table:

1. **Backup existing data**
2. **Run the migration script** (`002_enhanced_email_events_partitioning.sql`)
3. **Create initial partitions** for existing data
4. **Migrate data** to appropriate partitions
5. **Set up scheduled tasks**
6. **Configure monitoring**

### Updating Partition Strategy

To change partition interval (e.g., weekly instead of monthly):

1. **Stop new data ingestion**
2. **Create new partition structure**
3. **Migrate existing data**
4. **Update application code**
5. **Restart services**

## Security

### Access Control

- All partition management functions require **superuser** or **partition_admin** role
- API endpoints require **admin** user privileges
- Celery tasks run with **system** privileges

### Audit Logging

All partition operations are logged in `partition_maintenance_log`:

```sql
SELECT operation_type, partition_name, success, created_at 
FROM partition_maintenance_log 
ORDER BY created_at DESC;
```

## Performance Benchmarks

### Expected Performance

| Operation | Records | Time | Memory |
|-----------|---------|------|--------|
| Partition Creation | - | <1s | <10MB |
| Query (1 month) | 1M | <100ms | <50MB |
| Query (1 year) | 12M | <500ms | <200MB |
| Cleanup (1 partition) | 1M | <30s | <100MB |

### Scaling Limits

- **Maximum partitions**: 1000+ (tested)
- **Records per partition**: 10M (recommended max)
- **Partition size**: 5GB (recommended max)
- **Concurrent queries**: Limited by PostgreSQL configuration

---

For additional support or questions about partition management, refer to the API documentation or contact the development team.