-- Composite Indexes Optimization Migration
-- This migration adds composite indexes on (workspace_id, created_at) and other critical column combinations
-- to optimize query performance for multi-tenant queries and time-based filtering

BEGIN;

-- =====================================================
-- COMPOSITE INDEX STRATEGY
-- =====================================================
-- Primary pattern: (workspace_id, created_at DESC) for tenant isolation + time queries
-- Secondary patterns: (workspace_id, status, created_at) for filtered lists
-- Tertiary patterns: (workspace_id, foreign_key, created_at) for joined queries

-- =====================================================
-- CORE TABLES
-- =====================================================

-- WORKSPACES TABLE
-- Already has primary key on id, add activity tracking indexes
CREATE INDEX IF NOT EXISTS idx_workspaces_plan_created 
ON workspaces(plan, created_at DESC) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_workspaces_domain 
ON workspaces(domain) 
WHERE deleted_at IS NULL AND domain IS NOT NULL;

-- USERS TABLE
-- Multi-tenant user queries
CREATE INDEX IF NOT EXISTS idx_users_workspace_created 
ON users(workspace_id, created_at DESC) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_users_workspace_role 
ON users(workspace_id, role, created_at DESC) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_users_email_lower 
ON users(LOWER(email)) 
WHERE deleted_at IS NULL;

-- =====================================================
-- CAMPAIGN TABLES
-- =====================================================

-- CAMPAIGNS TABLE
CREATE INDEX IF NOT EXISTS idx_campaigns_workspace_created 
ON campaigns(workspace_id, created_at DESC) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_campaigns_workspace_status_created 
ON campaigns(workspace_id, status, created_at DESC) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_campaigns_workspace_scheduled 
ON campaigns(workspace_id, scheduled_at DESC) 
WHERE deleted_at IS NULL AND scheduled_at IS NOT NULL;

-- CAMPAIGN_LEADS TABLE
CREATE INDEX IF NOT EXISTS idx_campaign_leads_campaign_created 
ON campaign_leads(campaign_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_campaign_leads_lead_created 
ON campaign_leads(lead_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_campaign_leads_campaign_status 
ON campaign_leads(campaign_id, status, created_at DESC);

-- Add covering index for email sending queries
CREATE INDEX IF NOT EXISTS idx_campaign_leads_campaign_status_scheduled 
ON campaign_leads(campaign_id, status, scheduled_at) 
INCLUDE (lead_id, email_id)
WHERE status IN ('pending', 'scheduled');

-- =====================================================
-- LEAD TABLES
-- =====================================================

-- LEADS TABLE
CREATE INDEX IF NOT EXISTS idx_leads_workspace_created 
ON leads(workspace_id, created_at DESC) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_leads_workspace_status_created 
ON leads(workspace_id, status, created_at DESC) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_leads_workspace_email 
ON leads(workspace_id, email) 
WHERE deleted_at IS NULL;

-- Composite index for lead search
CREATE INDEX IF NOT EXISTS idx_leads_workspace_search 
ON leads(workspace_id, LOWER(email), LOWER(first_name), LOWER(last_name)) 
WHERE deleted_at IS NULL;

-- LEAD_ENRICHMENT TABLE
CREATE INDEX IF NOT EXISTS idx_lead_enrichment_lead_provider 
ON lead_enrichment(lead_id, provider, enriched_at DESC);

CREATE INDEX IF NOT EXISTS idx_lead_enrichment_workspace_enriched 
ON lead_enrichment(workspace_id, enriched_at DESC);

-- =====================================================
-- EMAIL TABLES
-- =====================================================

-- EMAIL_ACCOUNTS TABLE
CREATE INDEX IF NOT EXISTS idx_email_accounts_workspace_created 
ON email_accounts(workspace_id, created_at DESC) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_email_accounts_workspace_provider_status 
ON email_accounts(workspace_id, provider, status) 
WHERE deleted_at IS NULL;

-- EMAIL_TEMPLATES TABLE
CREATE INDEX IF NOT EXISTS idx_email_templates_workspace_created 
ON email_templates(workspace_id, created_at DESC) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_email_templates_workspace_category 
ON email_templates(workspace_id, category, created_at DESC) 
WHERE deleted_at IS NULL;

-- EMAIL_EVENTS TABLE (already partitioned, indexes per partition)
-- Note: These indexes are created on each partition by the partition creation function

-- =====================================================
-- CONVERSATION TABLES
-- =====================================================

-- CONVERSATIONS TABLE
CREATE INDEX IF NOT EXISTS idx_conversations_workspace_updated 
ON conversations(workspace_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversations_workspace_status_updated 
ON conversations(workspace_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversations_lead_updated 
ON conversations(lead_id, updated_at DESC);

-- Composite index for inbox queries
CREATE INDEX IF NOT EXISTS idx_conversations_workspace_assigned_status 
ON conversations(workspace_id, assigned_to, status, updated_at DESC);

-- MESSAGES TABLE
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created 
ON messages(conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_workspace_created 
ON messages(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_external_id 
ON messages(external_id) 
WHERE external_id IS NOT NULL;

-- =====================================================
-- INTEGRATION TABLES
-- =====================================================

-- CRM_INTEGRATIONS TABLE
CREATE INDEX IF NOT EXISTS idx_crm_integrations_workspace_provider 
ON crm_integrations(workspace_id, provider, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_crm_integrations_workspace_active 
ON crm_integrations(workspace_id, is_active) 
WHERE is_active = true;

-- CRM_FIELD_MAPPINGS TABLE
CREATE INDEX IF NOT EXISTS idx_crm_field_mappings_integration_entity 
ON crm_field_mappings(integration_id, entity_type);

-- CRM_SYNC_LOGS TABLE
CREATE INDEX IF NOT EXISTS idx_crm_sync_logs_integration_created 
ON crm_sync_logs(integration_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_crm_sync_logs_integration_status_created 
ON crm_sync_logs(integration_id, status, created_at DESC);

-- =====================================================
-- AI/TOKEN TABLES
-- =====================================================

-- AI_GENERATIONS TABLE
CREATE INDEX IF NOT EXISTS idx_ai_generations_workspace_created 
ON ai_generations(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_generations_workspace_model_created 
ON ai_generations(workspace_id, model, created_at DESC);

-- TOKEN_USAGE TABLE
CREATE INDEX IF NOT EXISTS idx_token_usage_workspace_date 
ON token_usage(workspace_id, usage_date DESC);

CREATE INDEX IF NOT EXISTS idx_token_usage_workspace_model_date 
ON token_usage(workspace_id, model, usage_date DESC);

-- =====================================================
-- BILLING TABLES
-- =====================================================

-- SUBSCRIPTIONS TABLE
CREATE INDEX IF NOT EXISTS idx_subscriptions_workspace_status 
ON subscriptions(workspace_id, status) 
WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_subscriptions_workspace_created 
ON subscriptions(workspace_id, created_at DESC);

-- INVOICES TABLE
CREATE INDEX IF NOT EXISTS idx_invoices_workspace_created 
ON invoices(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_invoices_workspace_status_due 
ON invoices(workspace_id, status, due_date) 
WHERE status IN ('pending', 'overdue');

-- =====================================================
-- AUDIT/MONITORING TABLES
-- =====================================================

-- AUDIT_LOGS TABLE
CREATE INDEX IF NOT EXISTS idx_audit_logs_workspace_created 
ON audit_logs(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_workspace_user_created 
ON audit_logs(workspace_id, user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_workspace_action_created 
ON audit_logs(workspace_id, action, created_at DESC);

-- API_USAGE TABLE
CREATE INDEX IF NOT EXISTS idx_api_usage_workspace_date 
ON api_usage(workspace_id, usage_date DESC);

CREATE INDEX IF NOT EXISTS idx_api_usage_workspace_endpoint_date 
ON api_usage(workspace_id, endpoint, usage_date DESC);

-- =====================================================
-- SETTINGS/CONFIG TABLES
-- =====================================================

-- WORKSPACE_SETTINGS TABLE
CREATE INDEX IF NOT EXISTS idx_workspace_settings_workspace_key 
ON workspace_settings(workspace_id, key);

-- FEATURE_FLAGS TABLE
CREATE INDEX IF NOT EXISTS idx_feature_flags_workspace_flag 
ON feature_flags(workspace_id, flag_key) 
WHERE is_enabled = true;

-- =====================================================
-- GDPR COMPLIANCE TABLES
-- =====================================================

-- CONSENT_RECORDS TABLE
CREATE INDEX IF NOT EXISTS idx_consent_records_workspace_lead 
ON consent_records(workspace_id, lead_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_consent_records_workspace_type_status 
ON consent_records(workspace_id, consent_type, status) 
WHERE status = 'granted';

-- DATA_SUBJECT_REQUESTS TABLE
CREATE INDEX IF NOT EXISTS idx_data_subject_requests_workspace_status 
ON data_subject_requests(workspace_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_data_subject_requests_workspace_deadline 
ON data_subject_requests(workspace_id, deadline) 
WHERE status IN ('pending', 'processing');

-- SUPPRESSION_LIST TABLE
CREATE INDEX IF NOT EXISTS idx_suppression_list_workspace_email 
ON suppression_list(workspace_id, email);

CREATE INDEX IF NOT EXISTS idx_suppression_list_workspace_type 
ON suppression_list(workspace_id, suppression_type, created_at DESC);

-- =====================================================
-- PERFORMANCE MONITORING
-- =====================================================

-- Create a function to analyze index usage
CREATE OR REPLACE FUNCTION analyze_index_usage(table_pattern TEXT DEFAULT '%')
RETURNS TABLE(
    schemaname TEXT,
    tablename TEXT,
    indexname TEXT,
    index_size TEXT,
    idx_scan BIGINT,
    idx_tup_read BIGINT,
    idx_tup_fetch BIGINT,
    unused BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.schemaname,
        s.tablename,
        s.indexname,
        pg_size_pretty(pg_relation_size(s.indexrelid)) AS index_size,
        s.idx_scan,
        s.idx_tup_read,
        s.idx_tup_fetch,
        CASE 
            WHEN s.idx_scan = 0 THEN true 
            ELSE false 
        END AS unused
    FROM pg_stat_user_indexes s
    JOIN pg_index i ON s.indexrelid = i.indexrelid
    WHERE s.tablename LIKE table_pattern
      AND NOT i.indisprimary  -- Exclude primary keys
    ORDER BY s.schemaname, s.tablename, s.indexname;
END;
$$ LANGUAGE plpgsql;

-- Create a function to get missing index suggestions
CREATE OR REPLACE FUNCTION suggest_missing_indexes(min_seq_scans INT DEFAULT 1000)
RETURNS TABLE(
    schemaname TEXT,
    tablename TEXT,
    seq_scan BIGINT,
    seq_tup_read BIGINT,
    idx_scan BIGINT,
    seq_scan_ratio NUMERIC,
    table_size TEXT,
    recommendation TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.schemaname,
        s.tablename,
        s.seq_scan,
        s.seq_tup_read,
        s.idx_scan,
        CASE 
            WHEN (s.seq_scan + s.idx_scan) > 0 
            THEN ROUND((s.seq_scan::NUMERIC / (s.seq_scan + s.idx_scan)) * 100, 2)
            ELSE 0
        END AS seq_scan_ratio,
        pg_size_pretty(pg_total_relation_size(s.schemaname||'.'||s.tablename)) AS table_size,
        CASE 
            WHEN s.seq_scan > min_seq_scans AND s.seq_scan > s.idx_scan 
            THEN 'Consider adding indexes on frequently queried columns'
            ELSE 'Index usage appears optimal'
        END AS recommendation
    FROM pg_stat_user_tables s
    WHERE s.seq_scan > min_seq_scans
    ORDER BY s.seq_scan DESC;
END;
$$ LANGUAGE plpgsql;

-- Create index maintenance function
CREATE OR REPLACE FUNCTION maintain_indexes()
RETURNS TABLE(
    operation TEXT,
    details TEXT
) AS $$
BEGIN
    -- Reindex bloated indexes
    FOR r IN 
        SELECT 
            schemaname,
            tablename,
            indexname
        FROM pg_stat_user_indexes
        WHERE pg_relation_size(indexrelid) > 100 * 1024 * 1024  -- 100MB
    LOOP
        BEGIN
            EXECUTE format('REINDEX INDEX CONCURRENTLY %I.%I', r.schemaname, r.indexname);
            RETURN QUERY SELECT 'REINDEX', format('Reindexed %s.%s', r.schemaname, r.indexname);
        EXCEPTION WHEN OTHERS THEN
            RETURN QUERY SELECT 'ERROR', format('Failed to reindex %s.%s: %s', r.schemaname, r.indexname, SQLERRM);
        END;
    END LOOP;
    
    -- Update statistics
    RETURN QUERY SELECT 'ANALYZE', 'Updated table statistics';
    ANALYZE;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- INDEX DOCUMENTATION
-- =====================================================

-- Add comments to document index purposes
COMMENT ON INDEX idx_campaigns_workspace_created IS 
'Primary index for workspace-scoped campaign listings ordered by creation time';

COMMENT ON INDEX idx_campaigns_workspace_status_created IS 
'Optimizes filtering campaigns by status within a workspace';

COMMENT ON INDEX idx_leads_workspace_search IS 
'Composite index for fast lead searching by email, first name, or last name';

COMMENT ON INDEX idx_conversations_workspace_assigned_status IS 
'Optimizes inbox queries filtering by assignment and status';

COMMENT ON INDEX idx_campaign_leads_campaign_status_scheduled IS 
'Covering index for email sending queue queries';

-- =====================================================
-- STATISTICS UPDATE
-- =====================================================

-- Update table statistics for query planner
ANALYZE;

-- Log index creation completion
INSERT INTO system_migrations_log (
    migration_name,
    execution_time_ms,
    status,
    details
) VALUES (
    '004_composite_indexes_optimization',
    0, -- Will be updated by migration runner
    'completed',
    jsonb_build_object(
        'indexes_created', (
            SELECT COUNT(*) 
            FROM pg_indexes 
            WHERE schemaname = 'public' 
            AND indexname LIKE 'idx_%'
        ),
        'tables_affected', (
            SELECT COUNT(DISTINCT tablename) 
            FROM pg_indexes 
            WHERE schemaname = 'public' 
            AND indexname LIKE 'idx_%'
        )
    )
);

COMMIT;

-- =====================================================
-- ROLLBACK SCRIPT (Save separately)
-- =====================================================
/*
-- To rollback this migration, run:

BEGIN;

-- Drop all indexes created by this migration
DROP INDEX IF EXISTS idx_workspaces_plan_created;
DROP INDEX IF EXISTS idx_workspaces_domain;
DROP INDEX IF EXISTS idx_users_workspace_created;
DROP INDEX IF EXISTS idx_users_workspace_role;
DROP INDEX IF EXISTS idx_users_email_lower;
DROP INDEX IF EXISTS idx_campaigns_workspace_created;
DROP INDEX IF EXISTS idx_campaigns_workspace_status_created;
DROP INDEX IF EXISTS idx_campaigns_workspace_scheduled;
DROP INDEX IF EXISTS idx_campaign_leads_campaign_created;
DROP INDEX IF EXISTS idx_campaign_leads_lead_created;
DROP INDEX IF EXISTS idx_campaign_leads_campaign_status;
DROP INDEX IF EXISTS idx_campaign_leads_campaign_status_scheduled;
DROP INDEX IF EXISTS idx_leads_workspace_created;
DROP INDEX IF EXISTS idx_leads_workspace_status_created;
DROP INDEX IF EXISTS idx_leads_workspace_email;
DROP INDEX IF EXISTS idx_leads_workspace_search;
DROP INDEX IF EXISTS idx_lead_enrichment_lead_provider;
DROP INDEX IF EXISTS idx_lead_enrichment_workspace_enriched;
DROP INDEX IF EXISTS idx_email_accounts_workspace_created;
DROP INDEX IF EXISTS idx_email_accounts_workspace_provider_status;
DROP INDEX IF EXISTS idx_email_templates_workspace_created;
DROP INDEX IF EXISTS idx_email_templates_workspace_category;
DROP INDEX IF EXISTS idx_conversations_workspace_updated;
DROP INDEX IF EXISTS idx_conversations_workspace_status_updated;
DROP INDEX IF EXISTS idx_conversations_lead_updated;
DROP INDEX IF EXISTS idx_conversations_workspace_assigned_status;
DROP INDEX IF EXISTS idx_messages_conversation_created;
DROP INDEX IF EXISTS idx_messages_workspace_created;
DROP INDEX IF EXISTS idx_messages_external_id;
DROP INDEX IF EXISTS idx_crm_integrations_workspace_provider;
DROP INDEX IF EXISTS idx_crm_integrations_workspace_active;
DROP INDEX IF EXISTS idx_crm_field_mappings_integration_entity;
DROP INDEX IF EXISTS idx_crm_sync_logs_integration_created;
DROP INDEX IF EXISTS idx_crm_sync_logs_integration_status_created;
DROP INDEX IF EXISTS idx_ai_generations_workspace_created;
DROP INDEX IF EXISTS idx_ai_generations_workspace_model_created;
DROP INDEX IF EXISTS idx_token_usage_workspace_date;
DROP INDEX IF EXISTS idx_token_usage_workspace_model_date;
DROP INDEX IF EXISTS idx_subscriptions_workspace_status;
DROP INDEX IF EXISTS idx_subscriptions_workspace_created;
DROP INDEX IF EXISTS idx_invoices_workspace_created;
DROP INDEX IF EXISTS idx_invoices_workspace_status_due;
DROP INDEX IF EXISTS idx_audit_logs_workspace_created;
DROP INDEX IF EXISTS idx_audit_logs_workspace_user_created;
DROP INDEX IF EXISTS idx_audit_logs_workspace_action_created;
DROP INDEX IF EXISTS idx_api_usage_workspace_date;
DROP INDEX IF EXISTS idx_api_usage_workspace_endpoint_date;
DROP INDEX IF EXISTS idx_workspace_settings_workspace_key;
DROP INDEX IF EXISTS idx_feature_flags_workspace_flag;
DROP INDEX IF EXISTS idx_consent_records_workspace_lead;
DROP INDEX IF EXISTS idx_consent_records_workspace_type_status;
DROP INDEX IF EXISTS idx_data_subject_requests_workspace_status;
DROP INDEX IF EXISTS idx_data_subject_requests_workspace_deadline;
DROP INDEX IF EXISTS idx_suppression_list_workspace_email;
DROP INDEX IF EXISTS idx_suppression_list_workspace_type;

-- Drop utility functions
DROP FUNCTION IF EXISTS analyze_index_usage(TEXT);
DROP FUNCTION IF EXISTS suggest_missing_indexes(INT);
DROP FUNCTION IF EXISTS maintain_indexes();

COMMIT;
*/