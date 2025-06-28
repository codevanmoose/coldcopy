# ColdCopy Database Migration Guide

## Phase 2.1: Database Migration & Optimization

This guide covers running migrations and setting up database optimizations for ColdCopy on Supabase.

## Prerequisites

1. **Supabase CLI** installed:
   ```bash
   npm install -g supabase
   ```

2. **PostgreSQL client** installed:
   ```bash
   # macOS
   brew install postgresql

   # Ubuntu/Debian
   sudo apt-get install postgresql-client
   ```

3. **Environment variables** configured:
   ```bash
   export SUPABASE_PROJECT_ID=zicipvpablahehxstbfr
   export DATABASE_URL=postgresql://postgres:[password]@db.zicipvpablahehxstbfr.supabase.co:6543/postgres
   ```

## Step 1: Connect to Supabase

```bash
# Login to Supabase
supabase login

# Link to your project
cd /path/to/coldcopy
supabase link --project-ref $SUPABASE_PROJECT_ID
```

## Step 2: Run Initial Migrations

### Option A: Using Supabase CLI (Recommended)
```bash
# Run all migrations
supabase db push

# Check migration status
supabase db migrations list
```

### Option B: Manual Migration
```bash
# Connect to database
psql $DATABASE_URL

# Run migrations in order
\i supabase/migrations/100_auth_and_workspaces.sql
\i supabase/migrations/101_leads_and_campaigns.sql
\i supabase/migrations/102_hubspot_field_mappings.sql
# ... continue for all migrations
```

## Step 3: Apply Database Optimizations

```bash
# Run the optimization script
psql $DATABASE_URL < infrastructure/database/optimize_database.sql
```

This will:
- ✓ Create table partitions for email_events
- ✓ Build materialized views for analytics
- ✓ Add 50+ optimized indexes
- ✓ Set up performance monitoring
- ✓ Configure automated maintenance

## Step 4: Verify Partitioning

```sql
-- Check partitions were created
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE tablename LIKE 'email_events_%'
ORDER BY tablename;
```

Expected output:
```
 schemaname |        tablename         |  size
------------+-------------------------+--------
 public     | email_events_2024_01    | 0 bytes
 public     | email_events_2024_02    | 0 bytes
 public     | email_events_2024_03    | 0 bytes
 ...
```

## Step 5: Verify Materialized Views

```sql
-- Check materialized views
SELECT 
    matviewname,
    pg_size_pretty(pg_total_relation_size(matviewname::regclass)) as size,
    hasindexes
FROM pg_matviews
WHERE schemaname = 'public';
```

Expected views:
- campaign_analytics_mv
- workspace_usage_analytics_mv
- lead_engagement_scores_mv
- email_deliverability_metrics_mv

## Step 6: Configure PgBouncer (Optional)

If using external PgBouncer:

1. **Install PgBouncer**:
   ```bash
   # Ubuntu/Debian
   sudo apt-get install pgbouncer

   # macOS
   brew install pgbouncer
   ```

2. **Configure**:
   ```bash
   sudo cp infrastructure/database/pgbouncer.ini /etc/pgbouncer/
   sudo vim /etc/pgbouncer/pgbouncer.ini
   # Update connection details
   ```

3. **Create userlist**:
   ```bash
   echo '"postgres" "md5<hash_of_password>"' | sudo tee /etc/pgbouncer/userlist.txt
   ```

4. **Start PgBouncer**:
   ```bash
   sudo systemctl start pgbouncer
   sudo systemctl enable pgbouncer
   ```

## Step 7: Set Up Monitoring

### Enable pg_stat_statements
```sql
-- In Supabase SQL editor
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Configure settings
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
ALTER SYSTEM SET pg_stat_statements.track = 'all';
```

### Create monitoring dashboard
```sql
-- Create a view for easy monitoring
CREATE VIEW monitoring.dashboard AS
SELECT 
    'Active Connections' as metric,
    count(*) as value
FROM pg_stat_activity
WHERE state = 'active'
UNION ALL
SELECT 
    'Database Size',
    pg_database_size(current_database())::bigint
UNION ALL
SELECT 
    'Cache Hit Ratio',
    round(sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) * 100)::bigint
FROM pg_statio_user_tables;
```

## Step 8: Schedule Maintenance

### Using Supabase Cron
```sql
-- Schedule view refresh (requires pg_cron)
SELECT cron.schedule(
    'refresh-views',
    '0 * * * *',  -- Every hour
    $$SELECT refresh_all_materialized_views();$$
);

-- Schedule partition creation
SELECT cron.schedule(
    'create-partitions',
    '0 2 * * *',  -- Daily at 2 AM
    $$SELECT create_monthly_partitions('email_events', CURRENT_DATE, 3);$$
);
```

### Using External Scheduler
Add to crontab:
```bash
# Refresh views every hour
0 * * * * /path/to/infrastructure/database/scripts/refresh_views.sh

# Daily maintenance at 2 AM
0 2 * * * /path/to/infrastructure/database/scripts/daily_maintenance.sh
```

## Step 9: Performance Testing

### Test query performance
```sql
-- Enable timing
\timing on

-- Test workspace isolation query
EXPLAIN ANALYZE
SELECT * FROM leads 
WHERE workspace_id = 'test-workspace-id' 
ORDER BY created_at DESC 
LIMIT 100;

-- Test email events query (partitioned)
EXPLAIN ANALYZE
SELECT * FROM email_events
WHERE created_at >= NOW() - INTERVAL '7 days'
AND workspace_id = 'test-workspace-id';
```

### Expected performance:
- Simple queries: < 10ms
- Complex analytics: < 100ms
- Materialized views: < 5ms

## Step 10: Backup Configuration

### Enable Point-in-Time Recovery
In Supabase Dashboard:
1. Go to Settings → Database
2. Enable Point-in-Time Recovery
3. Set retention period (7-30 days)

### Manual backup script
```bash
#!/bin/bash
# Save as backup_database.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="coldcopy_backup_$DATE.sql"

# Create backup
pg_dump $DATABASE_URL \
  --no-owner \
  --no-privileges \
  --exclude-table-data='*.email_events_20*' \
  > $BACKUP_FILE

# Compress
gzip $BACKUP_FILE

# Upload to cloud storage (optional)
# aws s3 cp $BACKUP_FILE.gz s3://coldcopy-backups/
```

## Troubleshooting

### Common Issues

1. **Migration fails with "already exists"**
   ```sql
   -- Check existing objects
   \dt
   \dm  -- materialized views
   \di  -- indexes
   ```

2. **Slow queries after migration**
   ```sql
   -- Update statistics
   ANALYZE;
   
   -- Check missing indexes
   SELECT * FROM pg_stat_user_tables 
   WHERE n_tup_ins + n_tup_upd + n_tup_del > 1000 
   AND NOT EXISTS (
     SELECT 1 FROM pg_indexes 
     WHERE tablename = pg_stat_user_tables.relname
   );
   ```

3. **Materialized view refresh fails**
   ```sql
   -- Check for locks
   SELECT * FROM pg_locks WHERE NOT granted;
   
   -- Rebuild view
   DROP MATERIALIZED VIEW IF EXISTS view_name CASCADE;
   -- Then recreate
   ```

4. **Partition not created**
   ```sql
   -- Manually create partition
   SELECT create_monthly_partitions('email_events', '2024-01-01'::date, 12);
   ```

## Performance Benchmarks

After optimization, you should see:

| Query Type | Target | Maximum |
|------------|--------|---------|
| Simple SELECT | < 10ms | 50ms |
| JOIN queries | < 50ms | 200ms |
| Analytics queries | < 100ms | 500ms |
| Materialized views | < 5ms | 20ms |
| Bulk inserts (1000 rows) | < 100ms | 500ms |

## Next Steps

After completing database migration:

1. ✓ Run performance tests
2. ✓ Set up monitoring alerts
3. ✓ Document query patterns
4. ✓ Schedule regular maintenance
5. ✓ Proceed to Phase 2.2: API Server Setup

## Rollback Procedure

If issues occur:

```sql
-- Restore from backup
psql $DATABASE_URL < backup.sql

-- Or use Supabase point-in-time recovery
-- Go to Dashboard → Backups → Restore
```

## Sign-off Checklist

- [ ] All migrations completed successfully
- [ ] Partitions created for next 3 months
- [ ] Materialized views created and populated
- [ ] Indexes created and being used
- [ ] Performance meets benchmarks
- [ ] Monitoring configured
- [ ] Backup tested
- [ ] Documentation updated

**Completed by**: _________________
**Date**: _________________
**Duration**: _________________