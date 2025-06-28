# ColdCopy Database Infrastructure

## Overview

This directory contains all database migration, optimization, and maintenance scripts for ColdCopy's PostgreSQL database hosted on Supabase.

## Database Architecture

### Core Design Principles
- **Multi-tenancy**: All tables include workspace_id for data isolation
- **Performance**: Partitioned tables, materialized views, and optimized indexes
- **Scalability**: Designed for millions of records with sub-second query times
- **GDPR Compliance**: Built-in audit trails and data retention policies

### Key Features
1. **Table Partitioning**: email_events partitioned by month
2. **Materialized Views**: Pre-computed analytics for instant dashboards
3. **Composite Indexes**: 50+ indexes optimized for common queries
4. **Row-Level Security**: Automatic workspace isolation
5. **Connection Pooling**: PgBouncer configuration for high concurrency

## Migration Order

Migrations must be run in the following order:

### Phase 1: Core Tables (100-199)
```bash
100_auth_and_workspaces.sql         # Authentication and workspace foundation
101_leads_and_campaigns.sql         # Lead management and campaigns
102_hubspot_field_mappings.sql      # HubSpot integration
103_email_infrastructure.sql        # Email sending and tracking
104_linkedin_integration.sql        # LinkedIn OAuth and messaging
105_sales_intelligence.sql          # Intent signals and scoring
106_email_deliverability.sql        # Deliverability monitoring
107_twitter_integration.sql         # Twitter/X integration
108_smart_reply_suggestions.sql     # AI-powered replies
109_performance_optimizations.sql   # Indexes and query optimization
110_gdpr_compliance.sql            # GDPR tables and policies
111_ai_meeting_scheduler.sql       # Meeting scheduling
112_linkedin_engagement_analytics.sql # LinkedIn analytics
113_salesforce_integration.sql     # Salesforce sync
```

### Phase 2: Performance Optimizations (200-299)
```bash
201_analytics_materialized_views.sql    # Analytics views
202_partitioning_setup.sql             # Table partitioning
203_connection_pooling.sql             # PgBouncer config
204_cache_tables.sql                   # Redis cache tables
```

### Phase 3: Advanced Features (300-399)
```bash
301_materialized_views.sql             # Additional views
302_advanced_analytics_functions.sql   # Analytics functions
303_multi_channel_campaigns.sql        # Multi-channel support
304_workflow_automation.sql            # Workflow engine
```

## Running Migrations

### Using Supabase CLI
```bash
# Run all migrations
supabase db push

# Run specific migration
supabase db push --include-all

# Reset database (CAUTION: Destroys all data)
supabase db reset
```

### Manual Migration
```sql
-- Connect to database
psql $DATABASE_URL

-- Run migration
\i infrastructure/database/migrations/100_auth_and_workspaces.sql
```

## Performance Optimization

### 1. Table Partitioning
Email events are partitioned by month for optimal performance:
```sql
-- Partitions are automatically created 3 months in advance
-- Old partitions can be archived after 12 months
```

### 2. Materialized Views
Refresh schedule:
- Campaign Analytics: Every hour
- Workspace Usage: Daily at 2 AM UTC
- Lead Engagement: Every 6 hours
- Email Deliverability: Every 2 hours

### 3. Index Optimization
Key indexes for performance:
```sql
-- Multi-tenant queries
CREATE INDEX idx_[table]_workspace_created ON [table](workspace_id, created_at DESC);

-- Status filtering
CREATE INDEX idx_[table]_workspace_status ON [table](workspace_id, status);

-- Email lookups
CREATE INDEX idx_leads_workspace_email ON leads(workspace_id, email);
```

### 4. Connection Pooling (PgBouncer)
```ini
[databases]
coldcopy = host=db.supabase.co port=6543 dbname=postgres

[pools]
default_pool_size = 25
max_client_conn = 100
pool_mode = transaction
```

## Maintenance Scripts

### Daily Maintenance
```bash
# Run vacuum analyze
./scripts/daily_maintenance.sh

# Refresh materialized views
./scripts/refresh_views.sh

# Clean old partitions
./scripts/partition_cleanup.sh
```

### Weekly Maintenance
```bash
# Full vacuum (during low traffic)
./scripts/weekly_vacuum.sh

# Index rebuild
./scripts/reindex.sh

# Statistics update
./scripts/update_stats.sh
```

## Monitoring Queries

### Check Table Sizes
```sql
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Check Slow Queries
```sql
SELECT 
  query,
  calls,
  total_time,
  mean_time,
  max_time
FROM pg_stat_statements
WHERE mean_time > 100
ORDER BY mean_time DESC
LIMIT 20;
```

### Check Index Usage
```sql
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE idx_scan = 0
AND schemaname NOT IN ('pg_catalog', 'information_schema');
```

## Backup Strategy

### Automated Backups
- **Frequency**: Daily at 3 AM UTC
- **Retention**: 30 days standard, 1 year for compliance
- **Location**: Digital Ocean Spaces
- **Encryption**: AES-256

### Manual Backup
```bash
# Full backup
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Compressed backup
pg_dump $DATABASE_URL | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz

# Specific tables
pg_dump $DATABASE_URL -t workspaces -t users > users_backup.sql
```

### Restore Procedure
```bash
# Full restore
psql $DATABASE_URL < backup.sql

# Compressed restore
gunzip -c backup.sql.gz | psql $DATABASE_URL

# Point-in-time recovery
pg_restore -d $DATABASE_URL -t specific_table backup.dump
```

## Scaling Considerations

### Current Limits
- **Connections**: 100 concurrent (via PgBouncer)
- **Storage**: 100GB allocated
- **CPU**: 4 cores
- **RAM**: 16GB

### When to Scale
- Query response time > 200ms (p95)
- Connection pool exhaustion
- Storage > 80% utilized
- CPU usage > 70% sustained

### Scaling Options
1. **Vertical**: Upgrade Supabase plan
2. **Read Replicas**: For analytics queries
3. **Archival**: Move old data to cold storage
4. **Caching**: Increase Redis cache usage

## Security

### Access Control
- All access through Supabase Auth
- Service role key for backend only
- RLS policies enforce workspace isolation

### Encryption
- Data encrypted at rest (AES-256)
- SSL/TLS for all connections
- Sensitive fields encrypted in application

### Audit Trail
- All data modifications logged
- User actions tracked
- Compliance with GDPR Article 30

## Support

### Common Issues
1. **Slow Queries**: Check indexes and run ANALYZE
2. **Connection Errors**: Verify PgBouncer is running
3. **Migration Failures**: Check for lock conflicts
4. **Storage Issues**: Archive old partitions

### Resources
- Supabase Dashboard: https://app.supabase.com/project/[project-id]
- PostgreSQL Docs: https://www.postgresql.org/docs/
- Monitoring: Grafana dashboard at monitoring.coldcopy.cc