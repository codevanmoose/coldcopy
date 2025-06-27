# Composite Indexes Optimization Guide

This document explains the composite index strategy implemented for ColdCopy to optimize query performance in a multi-tenant SaaS environment.

## Overview

The composite indexes migration adds strategic multi-column indexes following the pattern `(workspace_id, created_at DESC)` to enable efficient tenant isolation and time-based queries. This is crucial for a multi-tenant application where almost every query includes a workspace filter.

## Index Strategy

### Primary Pattern: Workspace + Time
```sql
CREATE INDEX idx_table_workspace_created 
ON table_name(workspace_id, created_at DESC);
```
- **Purpose**: Optimizes the most common query pattern in multi-tenant apps
- **Benefits**: 
  - Instant workspace filtering
  - Efficient time-based sorting
  - Covers both WHERE and ORDER BY clauses

### Secondary Pattern: Workspace + Status + Time
```sql
CREATE INDEX idx_table_workspace_status_created 
ON table_name(workspace_id, status, created_at DESC);
```
- **Purpose**: Optimizes filtered list queries
- **Benefits**: 
  - Filters by workspace AND status efficiently
  - Maintains time ordering
  - Perfect for dashboard queries

### Tertiary Pattern: Workspace + Foreign Key + Time
```sql
CREATE INDEX idx_table_workspace_fk_created 
ON table_name(workspace_id, foreign_key_id, created_at DESC);
```
- **Purpose**: Optimizes JOIN queries within a workspace
- **Benefits**: 
  - Efficient joins while maintaining tenant isolation
  - Reduces need for separate foreign key indexes

## Implemented Indexes by Table

### Core Tables

#### Users
- `idx_users_workspace_created`: User listings by workspace
- `idx_users_workspace_role`: Filter users by role
- `idx_users_email_lower`: Case-insensitive email lookups

#### Campaigns
- `idx_campaigns_workspace_created`: Campaign listings
- `idx_campaigns_workspace_status_created`: Filter by status
- `idx_campaigns_workspace_scheduled`: Scheduled campaigns

#### Leads
- `idx_leads_workspace_created`: Lead listings
- `idx_leads_workspace_status_created`: Lead status filtering
- `idx_leads_workspace_email`: Email lookups within workspace
- `idx_leads_workspace_search`: Composite search index

#### Email Events
- Indexes created per partition automatically
- Covers workspace, campaign, lead, and event type queries

### Specialized Indexes

#### Covering Index for Email Queue
```sql
CREATE INDEX idx_campaign_leads_campaign_status_scheduled 
ON campaign_leads(campaign_id, status, scheduled_at) 
INCLUDE (lead_id, email_id)
WHERE status IN ('pending', 'scheduled');
```
- **Purpose**: Optimizes email sending queue queries
- **INCLUDE clause**: Avoids table lookups for common columns
- **Partial index**: Only indexes relevant rows

#### Search Index
```sql
CREATE INDEX idx_leads_workspace_search 
ON leads(workspace_id, LOWER(email), LOWER(first_name), LOWER(last_name));
```
- **Purpose**: Fast case-insensitive searching
- **Benefits**: Single index scan for multi-field searches

## Performance Monitoring

### Index Usage Analysis
```sql
-- Check index usage statistics
SELECT * FROM analyze_index_usage('campaigns');

-- Find missing index opportunities  
SELECT * FROM suggest_missing_indexes(1000);

-- Maintain indexes (reindex bloated ones)
SELECT * FROM maintain_indexes();
```

### API Endpoints

#### GET `/api/system/database/indexes/usage`
Returns detailed index usage statistics:
```json
{
  "table_name": "campaigns",
  "index_name": "idx_campaigns_workspace_created",
  "index_size": "45 MB",
  "scan_count": 158420,
  "status": "optimal"
}
```

#### GET `/api/system/database/indexes/recommendations`
Provides index creation recommendations:
```json
{
  "table_name": "messages",
  "columns": ["conversation_id", "created_at"],
  "reason": "High sequential scan ratio (85%) with 50000 scans",
  "priority": "high",
  "create_statement": "CREATE INDEX CONCURRENTLY idx_messages_conversation_created ON messages (conversation_id, created_at DESC);"
}
```

#### GET `/api/system/database/optimization/report`
Generates comprehensive optimization report with:
- Index usage analysis
- Table scan patterns
- Slow query identification
- Bloat detection
- Maintenance recommendations

## Best Practices

### 1. Query Writing
Always include workspace_id as the first condition:
```sql
-- Good: Uses composite index efficiently
SELECT * FROM campaigns 
WHERE workspace_id = ? 
  AND created_at > ?
ORDER BY created_at DESC;

-- Bad: Can't use composite index effectively
SELECT * FROM campaigns 
WHERE created_at > ?
  AND workspace_id = ?;
```

### 2. Index Maintenance
- Monitor unused indexes monthly
- Reindex bloated indexes (>20% bloat)
- Update statistics regularly with ANALYZE
- Use CONCURRENTLY for production operations

### 3. New Table Guidelines
When creating new tables, always add:
1. Primary key index (automatic)
2. Composite index on (workspace_id, created_at DESC)
3. Foreign key indexes
4. Status/type filtering indexes if applicable

### 4. Monitoring Thresholds
- **Unused Index**: 0 scans in 30 days
- **Bloated Index**: >20% wasted space
- **Missing Index**: Sequential scan ratio >50% with >1000 scans
- **Slow Query**: Mean execution time >100ms

## Impact Metrics

### Expected Improvements
- **Query Speed**: 10-100x faster for workspace-scoped queries
- **Resource Usage**: 50-80% reduction in CPU for list queries  
- **Scalability**: Linear performance as data grows
- **Cache Efficiency**: Better buffer cache utilization

### Monitoring Dashboard
Track these KPIs:
1. Average query time by endpoint
2. Sequential scan ratio per table
3. Index hit rate
4. Cache hit ratio
5. Slow query count

## Troubleshooting

### High Sequential Scans
```sql
-- Identify tables with high sequential scans
SELECT * FROM suggest_missing_indexes(1000);
```

### Slow Queries
```sql
-- Find queries not using indexes
EXPLAIN (ANALYZE, BUFFERS) 
SELECT ... FROM table WHERE ...;
```

### Index Bloat
```bash
# Check for bloated indexes
GET /api/system/database/indexes/bloat?bloat_threshold=0.2

# Reindex bloated index
REINDEX INDEX CONCURRENTLY index_name;
```

### Missing Indexes
Use the index monitor to identify missing indexes:
```python
monitor = IndexMonitor(db)
recommendations = await monitor.get_index_recommendations()
```

## Migration Rollback

If needed, the migration can be rolled back:
```sql
-- Run the rollback script at the end of 004_composite_indexes_optimization.sql
-- This will drop all created indexes
```

## Future Optimizations

1. **Partial Indexes**: Create filtered indexes for common WHERE conditions
2. **Expression Indexes**: Index computed columns or expressions
3. **GIN/GiST Indexes**: For full-text search and JSONB queries
4. **Index-Only Scans**: Add INCLUDE columns for covering indexes
5. **Parallel Index Builds**: Use multiple workers for faster index creation

---

For questions or issues with index performance, check the optimization report at `/api/system/database/optimization/report` or contact the development team.