# Database Optimization Guide

## Overview

This guide covers the comprehensive database optimizations implemented for ColdCopy, including table partitioning, materialized views, composite indexes, and connection pooling.

## 1. Table Partitioning

### Email Events Partitioning

The `email_events` table is partitioned by month to handle millions of records efficiently:

```sql
-- Partitioned by created_at column
-- Automatically creates monthly partitions
-- Retains 12 months of data
-- Archives older data before deletion
```

**Benefits:**
- Query performance: Only relevant partitions are scanned
- Maintenance: Old data can be dropped quickly
- Parallel operations: Different partitions can be processed simultaneously

### Partition Management

The `partition_manager.py` service handles:
- Automatic creation of future partitions (3 months ahead)
- Cleanup of old partitions (configurable retention)
- Performance monitoring and recommendations

**Usage:**
```python
from partition_manager import get_partition_manager

manager = await get_partition_manager(DATABASE_URL)
await manager.maintain_all_partitions()
```

## 2. Materialized Views

Four materialized views optimize common analytics queries:

### Campaign Analytics
- **Refresh**: Hourly
- **Purpose**: Campaign performance metrics
- **Includes**: Delivery rates, open rates, click rates, reply rates

### Workspace Usage Analytics
- **Refresh**: Daily
- **Purpose**: Workspace-level usage statistics
- **Includes**: Lead counts, campaign counts, email volume, AI usage

### Lead Engagement Scores
- **Refresh**: Every 6 hours
- **Purpose**: Lead scoring and segmentation
- **Includes**: Engagement score (0-100), engagement level, interaction history

### Email Deliverability Metrics
- **Refresh**: Every 2 hours
- **Purpose**: Monitor email sending health
- **Includes**: Bounce rates, complaint rates, reputation score

**Manual Refresh:**
```sql
-- Refresh specific view
REFRESH MATERIALIZED VIEW CONCURRENTLY campaign_analytics;

-- Or use the functions
SELECT refresh_campaign_analytics();
```

## 3. Composite Indexes

Over 50 composite indexes optimize multi-tenant queries:

### Key Index Patterns

1. **Workspace Isolation**: All queries include workspace_id first
   ```sql
   CREATE INDEX idx_leads_workspace_email ON leads(workspace_id, email);
   ```

2. **Status Filtering**: Common status-based queries
   ```sql
   CREATE INDEX idx_campaigns_workspace_status ON campaigns(workspace_id, status);
   ```

3. **Time-based Queries**: Recent data access patterns
   ```sql
   CREATE INDEX idx_email_events_workspace_created ON email_events(workspace_id, created_at DESC);
   ```

4. **Partial Indexes**: Specific query optimization
   ```sql
   CREATE INDEX idx_leads_hot ON leads(workspace_id, updated_at DESC) 
   WHERE status = 'verified' AND last_contacted_at > CURRENT_DATE - INTERVAL '7 days';
   ```

### Index Monitoring

Track index usage with:
```sql
SELECT * FROM index_usage_stats ORDER BY captured_at DESC;
```

## 4. Connection Pooling with PgBouncer

### Pool Configuration

Four separate pools optimize different workloads:

1. **Web Pool** (Transaction mode)
   - Size: 25 connections
   - Purpose: Fast web requests
   - Mode: Returns connection after each transaction

2. **Analytics Pool** (Session mode)
   - Size: 10 connections
   - Purpose: Long-running analytics queries
   - Mode: Holds connection for entire session

3. **Jobs Pool** (Session mode)
   - Size: 15 connections
   - Purpose: Background job processing
   - Mode: Maintains state across operations

4. **Admin Pool** (Session mode)
   - Size: 5 connections
   - Purpose: Maintenance operations
   - Mode: Dedicated admin access

### Deployment

```bash
# Start PgBouncer
cd infrastructure/pgbouncer
docker-compose up -d

# Monitor connections
psql -h localhost -p 6432 -U pgbouncer_admin pgbouncer -c "SHOW POOLS"
```

### Application Configuration

Update your database URLs:
```env
# Web application
DATABASE_URL=postgresql://user:pass@pgbouncer:6432/coldcopy_web

# Analytics queries
ANALYTICS_DATABASE_URL=postgresql://user:pass@pgbouncer:6432/coldcopy_analytics

# Background jobs
JOBS_DATABASE_URL=postgresql://user:pass@pgbouncer:6432/coldcopy_jobs
```

## 5. Query Optimization Tips

### Use Materialized Views

Instead of:
```sql
-- Slow: Calculates on every request
SELECT COUNT(*) as total_opens 
FROM email_events 
WHERE campaign_id = ? AND event_type = 'opened';
```

Use:
```sql
-- Fast: Pre-calculated
SELECT opened_count 
FROM campaign_analytics 
WHERE campaign_id = ?;
```

### Leverage Partitioning

Always include time constraints:
```sql
-- Good: Uses partition pruning
SELECT * FROM email_events 
WHERE created_at >= '2024-01-01' 
AND created_at < '2024-02-01';

-- Bad: Scans all partitions
SELECT * FROM email_events 
WHERE event_type = 'opened';
```

### Index-Friendly Queries

Order columns by selectivity:
```sql
-- Good: Matches index order
SELECT * FROM leads 
WHERE workspace_id = ? 
AND status = 'verified' 
ORDER BY created_at DESC;

-- Bad: Can't use index efficiently
SELECT * FROM leads 
WHERE status = 'verified' 
AND workspace_id = ?;
```

## 6. Monitoring & Maintenance

### Daily Tasks (Automated)
- Refresh daily materialized views
- Analyze table statistics
- Monitor connection pool usage

### Monthly Tasks (Automated)
- Create new partitions
- Drop old partitions
- Review index usage
- Optimize tables

### Performance Monitoring

```sql
-- Check partition sizes
SELECT * FROM get_partition_info('email_events');

-- Analyze partition performance
SELECT * FROM analyze_partition_performance('email_events');

-- View slow queries
SELECT * FROM pg_stat_statements 
WHERE mean_exec_time > 100 
ORDER BY mean_exec_time DESC;
```

## 7. Troubleshooting

### High Connection Count
- Check pool statistics: `SHOW POOLS`
- Review long-running queries: `SELECT * FROM pg_stat_activity`
- Adjust pool sizes in pgbouncer.ini

### Slow Queries
- Check query plan: `EXPLAIN ANALYZE <query>`
- Verify indexes are used: `SET enable_seqscan = off`
- Update table statistics: `ANALYZE table_name`

### Partition Issues
- List partitions: `\d+ email_events`
- Check constraints: `SELECT * FROM pg_constraint`
- Manually create partition if needed

## 8. Best Practices

1. **Always include workspace_id** in queries for tenant isolation
2. **Use appropriate connection pool** based on workload type
3. **Leverage materialized views** for analytics dashboards
4. **Add time constraints** to queries on partitioned tables
5. **Monitor index usage** and remove unused indexes
6. **Keep statistics updated** with regular ANALYZE
7. **Use CONCURRENTLY** for index/view operations in production

## Performance Gains

Expected improvements from these optimizations:
- **Email event queries**: 10-100x faster with partitioning
- **Analytics dashboards**: 50-500x faster with materialized views
- **Connection overhead**: 80% reduction with pooling
- **Multi-tenant queries**: 5-20x faster with composite indexes
- **Maintenance operations**: 90% faster partition drops vs DELETE