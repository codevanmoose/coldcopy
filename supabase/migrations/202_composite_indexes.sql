-- Composite Indexes for Multi-tenant Query Optimization
-- These indexes are specifically designed for common query patterns in a multi-tenant SaaS

-- ============================================
-- LEADS TABLE INDEXES
-- ============================================

-- Primary search patterns
CREATE INDEX IF NOT EXISTS idx_leads_workspace_email ON leads(workspace_id, email);
CREATE INDEX IF NOT EXISTS idx_leads_workspace_company ON leads(workspace_id, company) WHERE company IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_workspace_status ON leads(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_leads_workspace_created ON leads(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_workspace_updated ON leads(workspace_id, updated_at DESC);

-- Search and filter combinations
CREATE INDEX IF NOT EXISTS idx_leads_workspace_status_created ON leads(workspace_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_workspace_company_status ON leads(workspace_id, company, status) WHERE company IS NOT NULL;

-- Full text search optimization
CREATE INDEX IF NOT EXISTS idx_leads_search_gin ON leads USING gin(
    to_tsvector('english', 
        COALESCE(email, '') || ' ' || 
        COALESCE(first_name, '') || ' ' || 
        COALESCE(last_name, '') || ' ' || 
        COALESCE(company, '')
    )
);

-- Enrichment queries
CREATE INDEX IF NOT EXISTS idx_leads_workspace_enriched ON leads(workspace_id, id) 
    WHERE enrichment_data IS NOT NULL;

-- ============================================
-- CAMPAIGNS TABLE INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_campaigns_workspace_status ON campaigns(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_campaigns_workspace_created ON campaigns(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaigns_workspace_name ON campaigns(workspace_id, name);
CREATE INDEX IF NOT EXISTS idx_campaigns_workspace_status_created ON campaigns(workspace_id, status, created_at DESC);

-- Active campaigns query
CREATE INDEX IF NOT EXISTS idx_campaigns_active ON campaigns(workspace_id, id) 
    WHERE status = 'active' AND deleted_at IS NULL;

-- ============================================
-- CAMPAIGN_EMAILS TABLE INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_campaign_emails_campaign_lead ON campaign_emails(campaign_id, lead_id);
CREATE INDEX IF NOT EXISTS idx_campaign_emails_lead_sent ON campaign_emails(lead_id, sent_at DESC) WHERE sent_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_campaign_emails_workspace_sent ON campaign_emails(workspace_id, sent_at DESC) WHERE sent_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_campaign_emails_message_id ON campaign_emails(message_id) WHERE message_id IS NOT NULL;

-- Scheduled emails query
CREATE INDEX IF NOT EXISTS idx_campaign_emails_scheduled ON campaign_emails(scheduled_at, id) 
    WHERE sent_at IS NULL AND scheduled_at IS NOT NULL;

-- ============================================
-- EMAIL_MESSAGES (Team Inbox) INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_email_messages_workspace_created ON email_messages(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_messages_workspace_lead ON email_messages(workspace_id, lead_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_workspace_campaign ON email_messages(workspace_id, campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_workspace_thread ON email_messages(workspace_id, thread_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_messages_workspace_status ON email_messages(workspace_id, status, created_at DESC);

-- Unread messages query
CREATE INDEX IF NOT EXISTS idx_email_messages_unread ON email_messages(workspace_id, created_at DESC) 
    WHERE status = 'unread';

-- ============================================
-- WORKSPACE_MEMBERS TABLE INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members(user_id, workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace_status ON workspace_members(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace_role ON workspace_members(workspace_id, role) WHERE status = 'active';

-- ============================================
-- SUBSCRIPTIONS TABLE INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_subscriptions_workspace_status ON subscriptions(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_active ON subscriptions(workspace_id) 
    WHERE status = 'active' AND canceled_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_subscriptions_trial_ending ON subscriptions(trial_end_date) 
    WHERE status = 'trialing' AND trial_end_date IS NOT NULL;

-- ============================================
-- USAGE_RECORDS TABLE INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_usage_records_workspace_period ON usage_records(workspace_id, billing_period_start DESC);
CREATE INDEX IF NOT EXISTS idx_usage_records_workspace_metric ON usage_records(workspace_id, metric_name, billing_period_start DESC);

-- ============================================
-- AI_USAGE_LOGS TABLE INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_ai_usage_workspace_created ON ai_usage_logs(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_workspace_model ON ai_usage_logs(workspace_id, model, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_workspace_month ON ai_usage_logs(workspace_id, date_trunc('month', created_at) DESC);

-- ============================================
-- ENRICHMENT_REQUESTS TABLE INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_enrichment_workspace_status ON enrichment_requests(workspace_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enrichment_workspace_lead ON enrichment_requests(workspace_id, lead_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_workspace_provider ON enrichment_requests(workspace_id, provider, created_at DESC);

-- Pending enrichments query
CREATE INDEX IF NOT EXISTS idx_enrichment_pending ON enrichment_requests(created_at) 
    WHERE status = 'pending';

-- ============================================
-- AUDIT_LOGS TABLE INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_audit_workspace_created ON audit_logs(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_workspace_user ON audit_logs(workspace_id, user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_workspace_action ON audit_logs(workspace_id, action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_workspace_resource ON audit_logs(workspace_id, resource_type, resource_id);

-- ============================================
-- HUBSPOT INTEGRATION INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_hubspot_mappings_workspace_object ON hubspot_object_mappings(workspace_id, object_type);
CREATE INDEX IF NOT EXISTS idx_hubspot_mappings_workspace_coldcopy ON hubspot_object_mappings(workspace_id, object_type, coldcopy_id);
CREATE INDEX IF NOT EXISTS idx_hubspot_mappings_workspace_hubspot ON hubspot_object_mappings(workspace_id, object_type, hubspot_id);

CREATE INDEX IF NOT EXISTS idx_hubspot_sync_jobs_workspace_status ON hubspot_sync_jobs(workspace_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hubspot_sync_jobs_active ON hubspot_sync_jobs(workspace_id, created_at DESC) 
    WHERE status IN ('pending', 'syncing');

-- ============================================
-- GDPR COMPLIANCE INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_consent_records_workspace_lead ON consent_records(workspace_id, lead_id, consent_type);
CREATE INDEX IF NOT EXISTS idx_consent_records_workspace_status ON consent_records(workspace_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_data_requests_workspace_status ON data_subject_requests(workspace_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_data_requests_pending ON data_subject_requests(status, deadline) 
    WHERE status IN ('pending', 'processing');

-- ============================================
-- PERFORMANCE MONITORING INDEXES
-- ============================================

-- Create a table to track index usage
CREATE TABLE IF NOT EXISTS index_usage_stats (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    schemaname TEXT NOT NULL,
    tablename TEXT NOT NULL,
    indexname TEXT NOT NULL,
    idx_scan BIGINT,
    idx_tup_read BIGINT,
    idx_tup_fetch BIGINT,
    size_bytes BIGINT,
    captured_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Function to capture index usage statistics
CREATE OR REPLACE FUNCTION capture_index_usage_stats()
RETURNS void AS $$
BEGIN
    INSERT INTO index_usage_stats (schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch, size_bytes)
    SELECT 
        schemaname,
        tablename,
        indexname,
        idx_scan,
        idx_tup_read,
        idx_tup_fetch,
        pg_relation_size(indexrelid) as size_bytes
    FROM pg_stat_user_indexes
    WHERE schemaname = 'public';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- QUERY PERFORMANCE HELPERS
-- ============================================

-- Function to analyze table statistics
CREATE OR REPLACE FUNCTION analyze_all_tables()
RETURNS void AS $$
DECLARE
    table_record RECORD;
BEGIN
    FOR table_record IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('ANALYZE %I', table_record.tablename);
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Run initial statistics gathering
SELECT analyze_all_tables();

-- ============================================
-- BTREE DEDUPLICATION (PostgreSQL 13+)
-- ============================================

-- Enable btree deduplication for frequently duplicated values
ALTER INDEX idx_leads_workspace_status SET (deduplicate_items = on);
ALTER INDEX idx_campaigns_workspace_status SET (deduplicate_items = on);
ALTER INDEX idx_email_events_event_type SET (deduplicate_items = on);
ALTER INDEX idx_workspace_members_workspace_status SET (deduplicate_items = on);

-- ============================================
-- PARTIAL INDEXES FOR COMMON FILTERS
-- ============================================

-- Hot leads (recently engaged)
CREATE INDEX IF NOT EXISTS idx_leads_hot ON leads(workspace_id, updated_at DESC) 
    WHERE status = 'verified' 
    AND last_contacted_at > CURRENT_DATE - INTERVAL '7 days';

-- Active team members
CREATE INDEX IF NOT EXISTS idx_members_active ON workspace_members(workspace_id, user_id) 
    WHERE status = 'active';

-- Recent email events (last 30 days)
CREATE INDEX IF NOT EXISTS idx_email_events_recent ON email_events(workspace_id, event_type, created_at DESC) 
    WHERE created_at > CURRENT_DATE - INTERVAL '30 days';

-- Unprocessed webhooks
CREATE INDEX IF NOT EXISTS idx_email_webhooks_unprocessed ON email_webhook_events(created_at) 
    WHERE processed = false;

-- ============================================
-- GRANT PERMISSIONS
-- ============================================

GRANT EXECUTE ON FUNCTION capture_index_usage_stats() TO service_role;
GRANT EXECUTE ON FUNCTION analyze_all_tables() TO service_role;