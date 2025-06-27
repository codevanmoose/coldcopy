-- 016_gdpr_compliance_schema.sql
-- Comprehensive GDPR compliance database schema
-- This migration adds tables and functions for GDPR compliance including consent management,
-- data subject requests, privacy policies, and audit trails

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Consent Records Table
-- Tracks all consent given by data subjects
CREATE TABLE consent_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    consent_type VARCHAR(50) NOT NULL CHECK (consent_type IN (
        'marketing',
        'tracking',
        'data_processing',
        'cookies',
        'profiling',
        'third_party_sharing',
        'newsletter',
        'product_updates'
    )),
    status VARCHAR(20) NOT NULL CHECK (status IN ('granted', 'withdrawn', 'pending', 'expired')),
    method VARCHAR(20) NOT NULL CHECK (method IN ('explicit', 'implicit', 'imported', 'opt_out', 'opt_in')),
    ip_address INET,
    user_agent TEXT,
    consent_text TEXT, -- The exact text shown to the user
    version VARCHAR(20) NOT NULL, -- Version of consent/policy
    source VARCHAR(100), -- Where consent was collected (e.g., 'signup_form', 'email_preference_center')
    withdrawal_reason TEXT,
    parent_consent_id UUID REFERENCES consent_records(id), -- For tracking consent updates
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. Data Processing Activities Table
-- Documents all data processing activities (Article 30 GDPR)
CREATE TABLE data_processing_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    activity_name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    purpose TEXT[] NOT NULL, -- Array of processing purposes
    legal_basis VARCHAR(50) NOT NULL CHECK (legal_basis IN (
        'consent',
        'contract',
        'legal_obligation',
        'vital_interests',
        'public_task',
        'legitimate_interests'
    )),
    legal_basis_details TEXT,
    data_categories TEXT[] NOT NULL, -- Categories of personal data
    data_sources TEXT[], -- Where data comes from
    recipients TEXT[], -- Who receives the data
    third_countries TEXT[], -- Countries outside EU where data is transferred
    retention_period VARCHAR(100) NOT NULL,
    security_measures TEXT[] NOT NULL,
    risk_level VARCHAR(20) CHECK (risk_level IN ('low', 'medium', 'high')),
    dpia_required BOOLEAN DEFAULT false, -- Data Protection Impact Assessment required
    dpia_completed_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES auth.users(id)
);

-- 3. Data Subject Requests Table
-- Manages GDPR data subject requests (Articles 15-22)
CREATE TABLE data_subject_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    request_type VARCHAR(30) NOT NULL CHECK (request_type IN (
        'access',           -- Article 15
        'rectification',    -- Article 16
        'erasure',          -- Article 17 (Right to be forgotten)
        'portability',      -- Article 20
        'restriction',      -- Article 18
        'objection',        -- Article 21
        'automated_decision' -- Article 22
    )),
    requester_email VARCHAR(255) NOT NULL,
    requester_name VARCHAR(255),
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending',
        'verifying',
        'in_progress',
        'completed',
        'rejected',
        'expired'
    )),
    priority VARCHAR(10) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    verification_method VARCHAR(30) CHECK (verification_method IN ('email', 'id_document', 'phone', 'other')),
    verification_token TEXT,
    verified_at TIMESTAMPTZ,
    verification_attempts INTEGER DEFAULT 0,
    request_details JSONB DEFAULT '{}'::jsonb, -- Additional request-specific details
    response_data JSONB, -- Data provided in response
    response_format VARCHAR(20) CHECK (response_format IN ('json', 'csv', 'pdf', 'xml')),
    response_sent_at TIMESTAMPTZ,
    response_method VARCHAR(20) CHECK (response_method IN ('email', 'api', 'download', 'mail')),
    rejection_reason TEXT,
    internal_notes TEXT,
    assigned_to UUID REFERENCES auth.users(id),
    completed_by UUID REFERENCES auth.users(id),
    completed_at TIMESTAMPTZ,
    deadline TIMESTAMPTZ, -- Legal deadline (usually 30 days from request)
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 4. Privacy Policies Table
-- Stores versions of privacy policies
CREATE TABLE privacy_policies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    version VARCHAR(20) NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    summary TEXT, -- Plain language summary
    changes_summary TEXT, -- What changed from previous version
    effective_date DATE NOT NULL,
    language VARCHAR(10) NOT NULL DEFAULT 'en',
    policy_type VARCHAR(30) CHECK (policy_type IN ('privacy_policy', 'cookie_policy', 'terms_of_service', 'data_processing_agreement')),
    is_active BOOLEAN DEFAULT false,
    requires_consent BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES auth.users(id),
    approved_by UUID REFERENCES auth.users(id),
    approved_at TIMESTAMPTZ,
    UNIQUE(workspace_id, version, language, policy_type)
);

-- 5. Data Retention Policies Table
-- Defines how long different types of data should be retained
CREATE TABLE data_retention_policies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    data_type VARCHAR(100) NOT NULL,
    description TEXT,
    table_name VARCHAR(100), -- Specific table if applicable
    retention_days INTEGER NOT NULL CHECK (retention_days >= 0),
    deletion_strategy VARCHAR(20) NOT NULL CHECK (deletion_strategy IN (
        'soft_delete',
        'anonymize',
        'pseudonymize',
        'hard_delete',
        'archive'
    )),
    anonymization_fields TEXT[], -- Fields to anonymize if strategy is 'anonymize'
    legal_basis_for_retention TEXT,
    is_active BOOLEAN DEFAULT true,
    last_execution_at TIMESTAMPTZ,
    next_execution_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(workspace_id, data_type)
);

-- 6. Enhanced Audit Logs Table for GDPR
-- Comprehensive audit trail for all data access and modifications
CREATE TABLE gdpr_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    action VARCHAR(100) NOT NULL,
    action_category VARCHAR(50) CHECK (action_category IN (
        'data_access',
        'data_modification',
        'data_deletion',
        'consent_management',
        'data_export',
        'user_rights',
        'security_event'
    )),
    resource_type VARCHAR(100) NOT NULL,
    resource_id UUID,
    resource_identifier TEXT, -- Human-readable identifier
    data_categories TEXT[], -- What types of personal data were accessed/modified
    purpose TEXT, -- Why the action was performed
    legal_basis VARCHAR(50),
    changes JSONB, -- Before/after values for modifications
    ip_address INET,
    user_agent TEXT,
    session_id TEXT,
    risk_score INTEGER CHECK (risk_score BETWEEN 0 AND 100),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 7. Suppression List Enhancements
-- Enhanced suppression list for email marketing compliance
CREATE TABLE IF NOT EXISTS suppression_list (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    suppression_type VARCHAR(30) NOT NULL CHECK (suppression_type IN (
        'unsubscribe',
        'bounce',
        'complaint',
        'manual',
        'gdpr_request',
        'invalid'
    )),
    reason TEXT,
    source VARCHAR(100), -- Where the suppression came from
    campaign_id UUID REFERENCES campaigns(id),
    is_global BOOLEAN DEFAULT false, -- Applies to all workspaces
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(workspace_id, email)
);

-- 8. Unsubscribe Reasons Table
-- Track why users unsubscribe for improvement
CREATE TABLE unsubscribe_reasons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    lead_id UUID REFERENCES leads(id),
    reason_category VARCHAR(50) CHECK (reason_category IN (
        'too_frequent',
        'not_relevant',
        'never_signed_up',
        'privacy_concerns',
        'other'
    )),
    reason_details TEXT,
    feedback TEXT,
    campaign_id UUID REFERENCES campaigns(id),
    unsubscribe_token TEXT,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 9. Cookie Consent Management
CREATE TABLE cookie_consents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    visitor_id TEXT NOT NULL, -- Anonymous visitor ID
    consent_id TEXT UNIQUE NOT NULL, -- Unique consent identifier
    necessary BOOLEAN DEFAULT true,
    functional BOOLEAN DEFAULT false,
    analytics BOOLEAN DEFAULT false,
    marketing BOOLEAN DEFAULT false,
    consent_given_at TIMESTAMPTZ,
    consent_withdrawn_at TIMESTAMPTZ,
    ip_address INET,
    user_agent TEXT,
    consent_version VARCHAR(20),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 10. Data Portability Requests
CREATE TABLE data_portability_exports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID NOT NULL REFERENCES data_subject_requests(id) ON DELETE CASCADE,
    export_format VARCHAR(20) NOT NULL CHECK (export_format IN ('json', 'csv', 'xml')),
    file_path TEXT,
    file_size BIGINT,
    checksum TEXT,
    encryption_key_id TEXT,
    download_count INTEGER DEFAULT 0,
    max_downloads INTEGER DEFAULT 3,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_consent_records_workspace_lead ON consent_records(workspace_id, lead_id);
CREATE INDEX idx_consent_records_status ON consent_records(status) WHERE status = 'granted';
CREATE INDEX idx_consent_records_type ON consent_records(consent_type);
CREATE INDEX idx_consent_records_expires_at ON consent_records(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_consent_records_created_at ON consent_records(created_at);

CREATE INDEX idx_data_processing_activities_workspace ON data_processing_activities(workspace_id);
CREATE INDEX idx_data_processing_activities_active ON data_processing_activities(is_active);

CREATE INDEX idx_data_subject_requests_workspace ON data_subject_requests(workspace_id);
CREATE INDEX idx_data_subject_requests_status ON data_subject_requests(status);
CREATE INDEX idx_data_subject_requests_type ON data_subject_requests(request_type);
CREATE INDEX idx_data_subject_requests_email ON data_subject_requests(requester_email);
CREATE INDEX idx_data_subject_requests_deadline ON data_subject_requests(deadline);

CREATE INDEX idx_privacy_policies_workspace ON privacy_policies(workspace_id);
CREATE INDEX idx_privacy_policies_active ON privacy_policies(workspace_id, is_active) WHERE is_active = true;
CREATE INDEX idx_privacy_policies_effective_date ON privacy_policies(effective_date);

CREATE INDEX idx_retention_policies_workspace ON data_retention_policies(workspace_id);
CREATE INDEX idx_retention_policies_next_execution ON data_retention_policies(next_execution_at) WHERE is_active = true;

CREATE INDEX idx_gdpr_audit_logs_workspace ON gdpr_audit_logs(workspace_id);
CREATE INDEX idx_gdpr_audit_logs_user ON gdpr_audit_logs(user_id);
CREATE INDEX idx_gdpr_audit_logs_resource ON gdpr_audit_logs(resource_type, resource_id);
CREATE INDEX idx_gdpr_audit_logs_created_at ON gdpr_audit_logs(created_at);
CREATE INDEX idx_gdpr_audit_logs_category ON gdpr_audit_logs(action_category);

CREATE INDEX idx_suppression_list_workspace_email ON suppression_list(workspace_id, email);
CREATE INDEX idx_suppression_list_email ON suppression_list(email);

CREATE INDEX idx_unsubscribe_reasons_workspace ON unsubscribe_reasons(workspace_id);
CREATE INDEX idx_unsubscribe_reasons_category ON unsubscribe_reasons(reason_category);

CREATE INDEX idx_cookie_consents_workspace ON cookie_consents(workspace_id);
CREATE INDEX idx_cookie_consents_visitor ON cookie_consents(visitor_id);
CREATE INDEX idx_cookie_consents_consent_id ON cookie_consents(consent_id);

-- Enable Row Level Security
ALTER TABLE consent_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_processing_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_subject_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE privacy_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_retention_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE gdpr_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppression_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE unsubscribe_reasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE cookie_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_portability_exports ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Consent Records
CREATE POLICY "Users can view their workspace consent records" ON consent_records
    FOR SELECT TO authenticated
    USING (workspace_id IN (
        SELECT workspace_id FROM workspace_users WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can manage their workspace consent records" ON consent_records
    FOR ALL TO authenticated
    USING (workspace_id IN (
        SELECT workspace_id FROM workspace_users 
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'member')
    ));

-- Data Processing Activities
CREATE POLICY "Users can view their workspace processing activities" ON data_processing_activities
    FOR SELECT TO authenticated
    USING (workspace_id IN (
        SELECT workspace_id FROM workspace_users WHERE user_id = auth.uid()
    ));

CREATE POLICY "Admins can manage processing activities" ON data_processing_activities
    FOR ALL TO authenticated
    USING (workspace_id IN (
        SELECT workspace_id FROM workspace_users 
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    ));

-- Data Subject Requests
CREATE POLICY "Users can view their workspace data requests" ON data_subject_requests
    FOR SELECT TO authenticated
    USING (workspace_id IN (
        SELECT workspace_id FROM workspace_users WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can manage data requests" ON data_subject_requests
    FOR ALL TO authenticated
    USING (workspace_id IN (
        SELECT workspace_id FROM workspace_users 
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'member')
    ));

-- Privacy Policies
CREATE POLICY "Users can view their workspace policies" ON privacy_policies
    FOR SELECT TO authenticated
    USING (workspace_id IN (
        SELECT workspace_id FROM workspace_users WHERE user_id = auth.uid()
    ));

CREATE POLICY "Admins can manage policies" ON privacy_policies
    FOR ALL TO authenticated
    USING (workspace_id IN (
        SELECT workspace_id FROM workspace_users 
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    ));

-- Data Retention Policies
CREATE POLICY "Users can view retention policies" ON data_retention_policies
    FOR SELECT TO authenticated
    USING (workspace_id IN (
        SELECT workspace_id FROM workspace_users WHERE user_id = auth.uid()
    ));

CREATE POLICY "Admins can manage retention policies" ON data_retention_policies
    FOR ALL TO authenticated
    USING (workspace_id IN (
        SELECT workspace_id FROM workspace_users 
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    ));

-- GDPR Audit Logs (read-only for users)
CREATE POLICY "Users can view their workspace audit logs" ON gdpr_audit_logs
    FOR SELECT TO authenticated
    USING (workspace_id IN (
        SELECT workspace_id FROM workspace_users 
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    ));

-- Suppression List
CREATE POLICY "Users can view their workspace suppression list" ON suppression_list
    FOR SELECT TO authenticated
    USING (workspace_id IN (
        SELECT workspace_id FROM workspace_users WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can manage suppression list" ON suppression_list
    FOR ALL TO authenticated
    USING (workspace_id IN (
        SELECT workspace_id FROM workspace_users 
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'member')
    ));

-- Service role policies
CREATE POLICY "Service role full access" ON consent_records
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access" ON data_processing_activities
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access" ON data_subject_requests
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access" ON privacy_policies
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access" ON data_retention_policies
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access" ON gdpr_audit_logs
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access" ON suppression_list
    FOR ALL USING (auth.role() = 'service_role');

-- Functions

-- Function to record consent
CREATE OR REPLACE FUNCTION record_consent(
    p_workspace_id UUID,
    p_lead_id UUID,
    p_consent_type VARCHAR(50),
    p_status VARCHAR(20),
    p_method VARCHAR(20),
    p_version VARCHAR(20),
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_consent_text TEXT DEFAULT NULL,
    p_source VARCHAR(100) DEFAULT NULL,
    p_expires_days INTEGER DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_consent_id UUID;
    v_previous_consent_id UUID;
BEGIN
    -- Find previous consent of same type
    SELECT id INTO v_previous_consent_id
    FROM consent_records
    WHERE workspace_id = p_workspace_id
        AND lead_id = p_lead_id
        AND consent_type = p_consent_type
        AND status = 'granted'
    ORDER BY created_at DESC
    LIMIT 1;

    -- Insert new consent record
    INSERT INTO consent_records (
        workspace_id, lead_id, consent_type, status, method,
        version, ip_address, user_agent, consent_text, source,
        parent_consent_id, expires_at
    ) VALUES (
        p_workspace_id, p_lead_id, p_consent_type, p_status, p_method,
        p_version, p_ip_address, p_user_agent, p_consent_text, p_source,
        v_previous_consent_id,
        CASE WHEN p_expires_days IS NOT NULL 
            THEN CURRENT_TIMESTAMP + (p_expires_days || ' days')::INTERVAL 
            ELSE NULL 
        END
    ) RETURNING id INTO v_consent_id;

    -- Log the action
    INSERT INTO gdpr_audit_logs (
        workspace_id, action, action_category, resource_type,
        resource_id, data_categories, purpose, ip_address, user_agent
    ) VALUES (
        p_workspace_id, 
        'consent_' || p_status,
        'consent_management',
        'consent_record',
        v_consent_id,
        ARRAY[p_consent_type],
        'Record consent for ' || p_consent_type,
        p_ip_address,
        p_user_agent
    );

    RETURN v_consent_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if consent is valid
CREATE OR REPLACE FUNCTION check_consent(
    p_workspace_id UUID,
    p_lead_id UUID,
    p_consent_type VARCHAR(50)
) RETURNS BOOLEAN AS $$
DECLARE
    v_has_consent BOOLEAN;
BEGIN
    SELECT EXISTS(
        SELECT 1
        FROM consent_records
        WHERE workspace_id = p_workspace_id
            AND lead_id = p_lead_id
            AND consent_type = p_consent_type
            AND status = 'granted'
            AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
        ORDER BY created_at DESC
        LIMIT 1
    ) INTO v_has_consent;

    RETURN v_has_consent;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create data subject request
CREATE OR REPLACE FUNCTION create_data_subject_request(
    p_workspace_id UUID,
    p_request_type VARCHAR(30),
    p_requester_email VARCHAR(255),
    p_requester_name VARCHAR(255) DEFAULT NULL,
    p_lead_id UUID DEFAULT NULL,
    p_request_details JSONB DEFAULT '{}'::jsonb
) RETURNS UUID AS $$
DECLARE
    v_request_id UUID;
    v_deadline TIMESTAMPTZ;
BEGIN
    -- Calculate deadline (30 days as per GDPR)
    v_deadline := CURRENT_TIMESTAMP + INTERVAL '30 days';

    -- Insert request
    INSERT INTO data_subject_requests (
        workspace_id, request_type, requester_email, requester_name,
        lead_id, request_details, deadline, verification_token
    ) VALUES (
        p_workspace_id, p_request_type, p_requester_email, p_requester_name,
        p_lead_id, p_request_details, v_deadline, 
        encode(gen_random_bytes(32), 'hex')
    ) RETURNING id INTO v_request_id;

    -- Log the request
    INSERT INTO gdpr_audit_logs (
        workspace_id, action, action_category, resource_type,
        resource_id, purpose
    ) VALUES (
        p_workspace_id,
        'data_subject_request_created',
        'user_rights',
        'data_subject_request',
        v_request_id,
        'New ' || p_request_type || ' request from ' || p_requester_email
    );

    RETURN v_request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to add email to suppression list
CREATE OR REPLACE FUNCTION add_to_suppression_list(
    p_workspace_id UUID,
    p_email VARCHAR(255),
    p_suppression_type VARCHAR(30),
    p_reason TEXT DEFAULT NULL,
    p_source VARCHAR(100) DEFAULT NULL,
    p_campaign_id UUID DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    INSERT INTO suppression_list (
        workspace_id, email, suppression_type, reason, source, campaign_id
    ) VALUES (
        p_workspace_id, p_email, p_suppression_type, p_reason, p_source, p_campaign_id
    ) ON CONFLICT (workspace_id, email) 
    DO UPDATE SET
        suppression_type = p_suppression_type,
        reason = COALESCE(p_reason, suppression_list.reason),
        source = COALESCE(p_source, suppression_list.source),
        metadata = suppression_list.metadata || 
            jsonb_build_object('updated_at', CURRENT_TIMESTAMP);

    -- Log the suppression
    INSERT INTO gdpr_audit_logs (
        workspace_id, action, action_category, resource_type,
        resource_identifier, purpose
    ) VALUES (
        p_workspace_id,
        'email_suppressed',
        'data_modification',
        'suppression_list',
        p_email,
        'Added to suppression list: ' || p_suppression_type
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if email is suppressed
CREATE OR REPLACE FUNCTION is_email_suppressed(
    p_workspace_id UUID,
    p_email VARCHAR(255)
) RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS(
        SELECT 1
        FROM suppression_list
        WHERE (workspace_id = p_workspace_id OR is_global = true)
            AND email = p_email
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to export lead data for portability
CREATE OR REPLACE FUNCTION export_lead_data(
    p_lead_id UUID,
    p_workspace_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_lead_data JSONB;
    v_consent_data JSONB;
    v_enriched_data JSONB;
    v_campaign_data JSONB;
    v_event_data JSONB;
BEGIN
    -- Get lead basic data
    SELECT to_jsonb(l) INTO v_lead_data
    FROM leads l
    WHERE l.id = p_lead_id AND l.workspace_id = p_workspace_id;

    -- Get consent records
    SELECT jsonb_agg(to_jsonb(c)) INTO v_consent_data
    FROM consent_records c
    WHERE c.lead_id = p_lead_id AND c.workspace_id = p_workspace_id;

    -- Get enriched data
    SELECT jsonb_agg(to_jsonb(e)) INTO v_enriched_data
    FROM enriched_data e
    WHERE e.lead_id = p_lead_id AND e.workspace_id = p_workspace_id;

    -- Get campaign emails
    SELECT jsonb_agg(jsonb_build_object(
        'campaign_name', c.name,
        'subject', ce.subject,
        'sent_at', ce.sent_at,
        'opened_at', ce.opened_at,
        'clicked_at', ce.clicked_at,
        'replied_at', ce.replied_at
    )) INTO v_campaign_data
    FROM campaign_emails ce
    JOIN campaigns c ON c.id = ce.campaign_id
    WHERE ce.lead_id = p_lead_id AND c.workspace_id = p_workspace_id;

    -- Get email events
    SELECT jsonb_agg(to_jsonb(ee)) INTO v_event_data
    FROM email_events ee
    WHERE ee.lead_id = p_lead_id;

    -- Combine all data
    RETURN jsonb_build_object(
        'lead', v_lead_data,
        'consent_records', COALESCE(v_consent_data, '[]'::jsonb),
        'enriched_data', COALESCE(v_enriched_data, '[]'::jsonb),
        'campaign_history', COALESCE(v_campaign_data, '[]'::jsonb),
        'email_events', COALESCE(v_event_data, '[]'::jsonb),
        'exported_at', CURRENT_TIMESTAMP,
        'format_version', '1.0'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to anonymize lead data
CREATE OR REPLACE FUNCTION anonymize_lead_data(
    p_lead_id UUID,
    p_workspace_id UUID
) RETURNS VOID AS $$
BEGIN
    -- Update lead with anonymized data
    UPDATE leads
    SET 
        email = 'anonymized-' || id || '@example.com',
        first_name = 'ANONYMIZED',
        last_name = 'USER',
        phone = NULL,
        company = 'ANONYMIZED COMPANY',
        title = NULL,
        linkedin_url = NULL,
        twitter_url = NULL,
        website = NULL,
        custom_fields = '{}'::jsonb,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_lead_id AND workspace_id = p_workspace_id;

    -- Log the anonymization
    INSERT INTO gdpr_audit_logs (
        workspace_id, user_id, action, action_category,
        resource_type, resource_id, purpose
    ) VALUES (
        p_workspace_id, auth.uid(), 'lead_anonymized', 'data_modification',
        'lead', p_lead_id, 'Lead data anonymized per GDPR request'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to process data retention policies
CREATE OR REPLACE FUNCTION process_data_retention_policies() RETURNS INTEGER AS $$
DECLARE
    v_policy RECORD;
    v_deleted_count INTEGER := 0;
    v_total_deleted INTEGER := 0;
BEGIN
    FOR v_policy IN 
        SELECT * FROM data_retention_policies 
        WHERE is_active = true 
            AND (next_execution_at IS NULL OR next_execution_at <= CURRENT_TIMESTAMP)
    LOOP
        CASE v_policy.deletion_strategy
            WHEN 'soft_delete' THEN
                -- Example for leads table
                IF v_policy.table_name = 'leads' THEN
                    UPDATE leads
                    SET deleted_at = CURRENT_TIMESTAMP
                    WHERE workspace_id = v_policy.workspace_id
                        AND created_at < CURRENT_TIMESTAMP - (v_policy.retention_days || ' days')::INTERVAL
                        AND deleted_at IS NULL;
                    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
                END IF;

            WHEN 'anonymize' THEN
                -- Example for leads table
                IF v_policy.table_name = 'leads' THEN
                    UPDATE leads
                    SET 
                        email = 'anonymized-' || id || '@example.com',
                        first_name = 'ANONYMIZED',
                        last_name = 'USER',
                        phone = NULL,
                        company = 'ANONYMIZED',
                        custom_fields = '{}'::jsonb
                    WHERE workspace_id = v_policy.workspace_id
                        AND created_at < CURRENT_TIMESTAMP - (v_policy.retention_days || ' days')::INTERVAL;
                    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
                END IF;

            WHEN 'hard_delete' THEN
                -- Example for email_events table
                IF v_policy.table_name = 'email_events' THEN
                    DELETE FROM email_events
                    WHERE created_at < CURRENT_TIMESTAMP - (v_policy.retention_days || ' days')::INTERVAL
                        AND lead_id IN (
                            SELECT id FROM leads WHERE workspace_id = v_policy.workspace_id
                        );
                    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
                END IF;
        END CASE;

        v_total_deleted := v_total_deleted + v_deleted_count;

        -- Update policy execution time
        UPDATE data_retention_policies
        SET 
            last_execution_at = CURRENT_TIMESTAMP,
            next_execution_at = CURRENT_TIMESTAMP + INTERVAL '1 day'
        WHERE id = v_policy.id;

        -- Log the retention action
        INSERT INTO gdpr_audit_logs (
            workspace_id, action, action_category, resource_type,
            purpose, changes
        ) VALUES (
            v_policy.workspace_id,
            'retention_policy_executed',
            'data_deletion',
            v_policy.table_name,
            'Automated data retention: ' || v_policy.deletion_strategy,
            jsonb_build_object(
                'policy_id', v_policy.id,
                'records_affected', v_deleted_count,
                'retention_days', v_policy.retention_days
            )
        );
    END LOOP;

    RETURN v_total_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record cookie consent
CREATE OR REPLACE FUNCTION record_cookie_consent(
    p_workspace_id UUID,
    p_visitor_id TEXT,
    p_necessary BOOLEAN DEFAULT true,
    p_functional BOOLEAN DEFAULT false,
    p_analytics BOOLEAN DEFAULT false,
    p_marketing BOOLEAN DEFAULT false,
    p_version VARCHAR(20) DEFAULT '1.0',
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
) RETURNS TEXT AS $$
DECLARE
    v_consent_id TEXT;
BEGIN
    v_consent_id := encode(gen_random_bytes(16), 'hex');

    INSERT INTO cookie_consents (
        workspace_id, visitor_id, consent_id, necessary, functional,
        analytics, marketing, consent_given_at, ip_address, user_agent,
        consent_version
    ) VALUES (
        p_workspace_id, p_visitor_id, v_consent_id, p_necessary, p_functional,
        p_analytics, p_marketing, CURRENT_TIMESTAMP, p_ip_address, p_user_agent,
        p_version
    ) ON CONFLICT (consent_id) DO NOTHING;

    RETURN v_consent_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_consent_records_updated_at
    BEFORE UPDATE ON consent_records
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_data_processing_activities_updated_at
    BEFORE UPDATE ON data_processing_activities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_data_subject_requests_updated_at
    BEFORE UPDATE ON data_subject_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_data_retention_policies_updated_at
    BEFORE UPDATE ON data_retention_policies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cookie_consents_updated_at
    BEFORE UPDATE ON cookie_consents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger to check consent expiration
CREATE OR REPLACE FUNCTION check_consent_expiration() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.expires_at IS NOT NULL AND NEW.expires_at < CURRENT_TIMESTAMP THEN
        NEW.status := 'expired';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_consent_expiration
    BEFORE INSERT OR UPDATE ON consent_records
    FOR EACH ROW EXECUTE FUNCTION check_consent_expiration();

-- Views for easier data access

-- View for active consents
CREATE OR REPLACE VIEW active_consents AS
SELECT DISTINCT ON (workspace_id, lead_id, consent_type)
    workspace_id,
    lead_id,
    consent_type,
    status,
    method,
    version,
    created_at,
    expires_at
FROM consent_records
WHERE status = 'granted'
    AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
ORDER BY workspace_id, lead_id, consent_type, created_at DESC;

-- View for pending data subject requests
CREATE OR REPLACE VIEW pending_data_requests AS
SELECT 
    dsr.*,
    EXTRACT(DAY FROM (deadline - CURRENT_TIMESTAMP)) AS days_until_deadline
FROM data_subject_requests dsr
WHERE status IN ('pending', 'verifying', 'in_progress')
    AND deadline > CURRENT_TIMESTAMP
ORDER BY deadline ASC;

-- View for data processing register (Article 30 GDPR)
CREATE OR REPLACE VIEW data_processing_register AS
SELECT 
    dpa.*,
    w.name AS workspace_name,
    u.email AS created_by_email
FROM data_processing_activities dpa
JOIN workspaces w ON w.id = dpa.workspace_id
LEFT JOIN auth.users u ON u.id = dpa.created_by
WHERE dpa.is_active = true
ORDER BY dpa.workspace_id, dpa.created_at DESC;

-- Grant permissions
GRANT SELECT ON active_consents TO authenticated;
GRANT SELECT ON pending_data_requests TO authenticated;
GRANT SELECT ON data_processing_register TO authenticated;

-- Insert sample data retention policies
INSERT INTO data_retention_policies (workspace_id, data_type, table_name, retention_days, deletion_strategy, description)
SELECT 
    w.id,
    'email_events',
    'email_events',
    365,
    'hard_delete',
    'Delete email tracking events after 1 year'
FROM workspaces w
ON CONFLICT DO NOTHING;

INSERT INTO data_retention_policies (workspace_id, data_type, table_name, retention_days, deletion_strategy, description)
SELECT 
    w.id,
    'audit_logs',
    'gdpr_audit_logs',
    730,
    'hard_delete',
    'Delete audit logs after 2 years'
FROM workspaces w
ON CONFLICT DO NOTHING;

-- Comments for documentation
COMMENT ON TABLE consent_records IS 'Stores all consent records for GDPR compliance including marketing, tracking, and data processing consents';
COMMENT ON TABLE data_processing_activities IS 'Register of processing activities as required by Article 30 of GDPR';
COMMENT ON TABLE data_subject_requests IS 'Manages all GDPR data subject requests including access, rectification, erasure, and portability';
COMMENT ON TABLE privacy_policies IS 'Version control for privacy policies, cookie policies, and terms of service';
COMMENT ON TABLE data_retention_policies IS 'Configurable data retention and deletion policies for GDPR compliance';
COMMENT ON TABLE gdpr_audit_logs IS 'Comprehensive audit trail for all data access and modifications for GDPR accountability';
COMMENT ON TABLE suppression_list IS 'Email suppression list for unsubscribes, bounces, and GDPR requests';
COMMENT ON TABLE cookie_consents IS 'Tracks cookie consent choices for website visitors';
COMMENT ON FUNCTION record_consent IS 'Records a new consent with full audit trail';
COMMENT ON FUNCTION create_data_subject_request IS 'Creates a new GDPR data subject request with automatic deadline calculation';
COMMENT ON FUNCTION export_lead_data IS 'Exports all data related to a lead for data portability requests';
COMMENT ON FUNCTION anonymize_lead_data IS 'Anonymizes personal data while maintaining referential integrity';
COMMENT ON FUNCTION process_data_retention_policies IS 'Processes all active data retention policies - should be run daily';