-- 011_enrichment_schema.sql
-- Comprehensive database schema for lead enrichment system

-- 1. Enrichment providers table
CREATE TABLE IF NOT EXISTS enrichment_providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL CHECK (type IN (
        'email_finder',
        'company_data',
        'social_profiles',
        'contact_info',
        'technographics',
        'firmographics',
        'intent_data',
        'news_monitoring'
    )),
    api_endpoint TEXT,
    api_key_required BOOLEAN DEFAULT true,
    rate_limits JSONB DEFAULT '{
        "requests_per_minute": 60,
        "requests_per_hour": 1000,
        "requests_per_day": 10000
    }'::jsonb,
    cost_per_request DECIMAL(10, 4) DEFAULT 0.0000,
    is_active BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}'::jsonb, -- Additional provider-specific configuration
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. Enrichment requests table
CREATE TABLE IF NOT EXISTS enrichment_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    provider_id UUID NOT NULL REFERENCES enrichment_providers(id),
    request_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending',
        'processing',
        'completed',
        'failed',
        'cancelled',
        'rate_limited'
    )),
    priority INTEGER DEFAULT 5 CHECK (priority BETWEEN 1 AND 10), -- 1 = highest, 10 = lowest
    input_data JSONB NOT NULL,
    output_data JSONB,
    error_message TEXT,
    error_code TEXT,
    credits_used DECIMAL(10, 4) DEFAULT 0.0000,
    processing_time_ms INTEGER,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

-- 3. Enriched data table
CREATE TABLE IF NOT EXISTS enriched_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    data_type TEXT NOT NULL CHECK (data_type IN (
        'email',
        'phone',
        'company_info',
        'social_profiles',
        'job_history',
        'technologies',
        'funding',
        'news',
        'intent_signals',
        'contact_info',
        'demographics'
    )),
    provider_id UUID NOT NULL REFERENCES enrichment_providers(id),
    data JSONB NOT NULL,
    confidence_score DECIMAL(3, 2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
    verification_status TEXT DEFAULT 'unverified' CHECK (verification_status IN (
        'unverified',
        'verified',
        'invalid',
        'outdated'
    )),
    verified_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    source_url TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 4. Enrichment credits table
CREATE TABLE IF NOT EXISTS enrichment_credits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    provider_id UUID REFERENCES enrichment_providers(id) ON DELETE CASCADE,
    credits_available DECIMAL(12, 4) DEFAULT 0.0000,
    credits_used DECIMAL(12, 4) DEFAULT 0.0000,
    credits_allocated DECIMAL(12, 4) DEFAULT 0.0000, -- Total credits allocated
    last_reset_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    reset_period TEXT DEFAULT 'monthly' CHECK (reset_period IN (
        'daily',
        'weekly',
        'monthly',
        'quarterly',
        'yearly',
        'never'
    )),
    auto_refill BOOLEAN DEFAULT false,
    auto_refill_amount DECIMAL(12, 4),
    auto_refill_threshold DECIMAL(12, 4),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(workspace_id, provider_id)
);

-- 5. Enrichment cache table
CREATE TABLE IF NOT EXISTS enrichment_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cache_key TEXT NOT NULL UNIQUE, -- Hash of query parameters
    provider_id UUID NOT NULL REFERENCES enrichment_providers(id) ON DELETE CASCADE,
    query_type TEXT NOT NULL,
    query_params JSONB NOT NULL,
    cached_data JSONB NOT NULL,
    hit_count INTEGER DEFAULT 0,
    last_accessed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ NOT NULL
);

-- Additional tables for better organization

-- 6. Enrichment field mappings
CREATE TABLE IF NOT EXISTS enrichment_field_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    provider_id UUID NOT NULL REFERENCES enrichment_providers(id),
    provider_field TEXT NOT NULL,
    lead_field TEXT NOT NULL,
    transform_function TEXT, -- Optional transformation logic
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(workspace_id, provider_id, provider_field)
);

-- 7. Enrichment webhooks for async processing
CREATE TABLE IF NOT EXISTS enrichment_webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES enrichment_requests(id) ON DELETE CASCADE,
    webhook_url TEXT NOT NULL,
    webhook_secret TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'acknowledged', 'failed')),
    attempts INTEGER DEFAULT 0,
    last_attempt_at TIMESTAMPTZ,
    response_data JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_enrichment_requests_workspace_id ON enrichment_requests(workspace_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_requests_lead_id ON enrichment_requests(lead_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_requests_status ON enrichment_requests(status) WHERE status IN ('pending', 'processing');
CREATE INDEX IF NOT EXISTS idx_enrichment_requests_created_at ON enrichment_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enrichment_requests_priority_status ON enrichment_requests(priority, status) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_enriched_data_workspace_id ON enriched_data(workspace_id);
CREATE INDEX IF NOT EXISTS idx_enriched_data_lead_id ON enriched_data(lead_id);
CREATE INDEX IF NOT EXISTS idx_enriched_data_data_type ON enriched_data(data_type);
CREATE INDEX IF NOT EXISTS idx_enriched_data_expires_at ON enriched_data(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_enriched_data_lead_type ON enriched_data(lead_id, data_type);

CREATE INDEX IF NOT EXISTS idx_enrichment_credits_workspace_provider ON enrichment_credits(workspace_id, provider_id);

CREATE INDEX IF NOT EXISTS idx_enrichment_cache_expires_at ON enrichment_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_enrichment_cache_provider_id ON enrichment_cache(provider_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_cache_last_accessed ON enrichment_cache(last_accessed_at);

-- Enable Row Level Security
ALTER TABLE enrichment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE enriched_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrichment_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrichment_field_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrichment_webhooks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for workspace isolation

-- Enrichment requests policies
CREATE POLICY "Users can view their workspace enrichment requests"
    ON enrichment_requests FOR SELECT
    TO authenticated
    USING (workspace_id IN (
        SELECT workspace_id FROM workspace_users WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can create enrichment requests for their workspace"
    ON enrichment_requests FOR INSERT
    TO authenticated
    WITH CHECK (workspace_id IN (
        SELECT workspace_id FROM workspace_users WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can update their workspace enrichment requests"
    ON enrichment_requests FOR UPDATE
    TO authenticated
    USING (workspace_id IN (
        SELECT workspace_id FROM workspace_users WHERE user_id = auth.uid()
    ));

-- Enriched data policies
CREATE POLICY "Users can view their workspace enriched data"
    ON enriched_data FOR SELECT
    TO authenticated
    USING (workspace_id IN (
        SELECT workspace_id FROM workspace_users WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can create enriched data for their workspace"
    ON enriched_data FOR INSERT
    TO authenticated
    WITH CHECK (workspace_id IN (
        SELECT workspace_id FROM workspace_users WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can update their workspace enriched data"
    ON enriched_data FOR UPDATE
    TO authenticated
    USING (workspace_id IN (
        SELECT workspace_id FROM workspace_users WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can delete their workspace enriched data"
    ON enriched_data FOR DELETE
    TO authenticated
    USING (workspace_id IN (
        SELECT workspace_id FROM workspace_users WHERE user_id = auth.uid()
    ));

-- Enrichment credits policies
CREATE POLICY "Users can view their workspace credits"
    ON enrichment_credits FOR SELECT
    TO authenticated
    USING (workspace_id IN (
        SELECT workspace_id FROM workspace_users WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can update their workspace credits"
    ON enrichment_credits FOR UPDATE
    TO authenticated
    USING (workspace_id IN (
        SELECT workspace_id FROM workspace_users 
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    ));

-- Field mappings policies
CREATE POLICY "Users can view their workspace field mappings"
    ON enrichment_field_mappings FOR SELECT
    TO authenticated
    USING (workspace_id IN (
        SELECT workspace_id FROM workspace_users WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can manage their workspace field mappings"
    ON enrichment_field_mappings FOR ALL
    TO authenticated
    USING (workspace_id IN (
        SELECT workspace_id FROM workspace_users 
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    ));

-- Webhooks policies
CREATE POLICY "Users can view webhooks for their requests"
    ON enrichment_webhooks FOR SELECT
    TO authenticated
    USING (request_id IN (
        SELECT id FROM enrichment_requests 
        WHERE workspace_id IN (
            SELECT workspace_id FROM workspace_users WHERE user_id = auth.uid()
        )
    ));

-- Functions for credit management

-- Function to check if workspace has sufficient credits
CREATE OR REPLACE FUNCTION check_enrichment_credits(
    p_workspace_id UUID,
    p_provider_id UUID,
    p_required_credits DECIMAL
) RETURNS BOOLEAN AS $$
DECLARE
    v_available_credits DECIMAL;
BEGIN
    SELECT credits_available INTO v_available_credits
    FROM enrichment_credits
    WHERE workspace_id = p_workspace_id 
    AND (provider_id = p_provider_id OR provider_id IS NULL)
    ORDER BY provider_id NULLS LAST
    LIMIT 1;
    
    RETURN COALESCE(v_available_credits, 0) >= p_required_credits;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to deduct credits
CREATE OR REPLACE FUNCTION deduct_enrichment_credits(
    p_workspace_id UUID,
    p_provider_id UUID,
    p_credits_to_deduct DECIMAL
) RETURNS BOOLEAN AS $$
DECLARE
    v_success BOOLEAN := false;
BEGIN
    UPDATE enrichment_credits
    SET 
        credits_available = credits_available - p_credits_to_deduct,
        credits_used = credits_used + p_credits_to_deduct,
        updated_at = CURRENT_TIMESTAMP
    WHERE workspace_id = p_workspace_id 
    AND (provider_id = p_provider_id OR provider_id IS NULL)
    AND credits_available >= p_credits_to_deduct;
    
    GET DIAGNOSTICS v_success = ROW_COUNT > 0;
    RETURN v_success;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to add credits
CREATE OR REPLACE FUNCTION add_enrichment_credits(
    p_workspace_id UUID,
    p_provider_id UUID,
    p_credits_to_add DECIMAL
) RETURNS VOID AS $$
BEGIN
    INSERT INTO enrichment_credits (workspace_id, provider_id, credits_available, credits_allocated)
    VALUES (p_workspace_id, p_provider_id, p_credits_to_add, p_credits_to_add)
    ON CONFLICT (workspace_id, provider_id) 
    DO UPDATE SET 
        credits_available = enrichment_credits.credits_available + p_credits_to_add,
        credits_allocated = enrichment_credits.credits_allocated + p_credits_to_add,
        updated_at = CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reset credits based on period
CREATE OR REPLACE FUNCTION reset_enrichment_credits() RETURNS VOID AS $$
BEGIN
    -- Daily reset
    UPDATE enrichment_credits
    SET 
        credits_available = credits_allocated,
        credits_used = 0,
        last_reset_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE reset_period = 'daily' 
    AND last_reset_at < CURRENT_DATE;
    
    -- Weekly reset
    UPDATE enrichment_credits
    SET 
        credits_available = credits_allocated,
        credits_used = 0,
        last_reset_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE reset_period = 'weekly' 
    AND last_reset_at < CURRENT_DATE - INTERVAL '7 days';
    
    -- Monthly reset
    UPDATE enrichment_credits
    SET 
        credits_available = credits_allocated,
        credits_used = 0,
        last_reset_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE reset_period = 'monthly' 
    AND last_reset_at < CURRENT_DATE - INTERVAL '1 month';
    
    -- Quarterly reset
    UPDATE enrichment_credits
    SET 
        credits_available = credits_allocated,
        credits_used = 0,
        last_reset_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE reset_period = 'quarterly' 
    AND last_reset_at < CURRENT_DATE - INTERVAL '3 months';
    
    -- Yearly reset
    UPDATE enrichment_credits
    SET 
        credits_available = credits_allocated,
        credits_used = 0,
        last_reset_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE reset_period = 'yearly' 
    AND last_reset_at < CURRENT_DATE - INTERVAL '1 year';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to auto-refill credits when threshold is reached
CREATE OR REPLACE FUNCTION auto_refill_credits() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.auto_refill = true 
    AND NEW.auto_refill_threshold IS NOT NULL 
    AND NEW.auto_refill_amount IS NOT NULL
    AND NEW.credits_available <= NEW.auto_refill_threshold THEN
        NEW.credits_available := NEW.credits_available + NEW.auto_refill_amount;
        NEW.credits_allocated := NEW.credits_allocated + NEW.auto_refill_amount;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to clean expired cache entries
CREATE OR REPLACE FUNCTION clean_expired_cache() RETURNS VOID AS $$
BEGIN
    DELETE FROM enrichment_cache
    WHERE expires_at < CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update cache hit count
CREATE OR REPLACE FUNCTION update_cache_hit(p_cache_key TEXT) RETURNS JSONB AS $$
DECLARE
    v_cached_data JSONB;
BEGIN
    UPDATE enrichment_cache
    SET 
        hit_count = hit_count + 1,
        last_accessed_at = CURRENT_TIMESTAMP
    WHERE cache_key = p_cache_key
    AND expires_at > CURRENT_TIMESTAMP
    RETURNING cached_data INTO v_cached_data;
    
    RETURN v_cached_data;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create enrichment request with credit check
CREATE OR REPLACE FUNCTION create_enrichment_request(
    p_workspace_id UUID,
    p_lead_id UUID,
    p_provider_id UUID,
    p_request_type TEXT,
    p_input_data JSONB,
    p_priority INTEGER DEFAULT 5
) RETURNS UUID AS $$
DECLARE
    v_request_id UUID;
    v_provider_cost DECIMAL;
    v_has_credits BOOLEAN;
BEGIN
    -- Get provider cost
    SELECT cost_per_request INTO v_provider_cost
    FROM enrichment_providers
    WHERE id = p_provider_id AND is_active = true;
    
    IF v_provider_cost IS NULL THEN
        RAISE EXCEPTION 'Provider not found or inactive';
    END IF;
    
    -- Check credits
    v_has_credits := check_enrichment_credits(p_workspace_id, p_provider_id, v_provider_cost);
    
    IF NOT v_has_credits THEN
        RAISE EXCEPTION 'Insufficient credits for enrichment request';
    END IF;
    
    -- Create request
    INSERT INTO enrichment_requests (
        workspace_id, lead_id, provider_id, request_type, 
        input_data, priority, credits_used
    ) VALUES (
        p_workspace_id, p_lead_id, p_provider_id, p_request_type,
        p_input_data, p_priority, v_provider_cost
    ) RETURNING id INTO v_request_id;
    
    -- Deduct credits
    PERFORM deduct_enrichment_credits(p_workspace_id, p_provider_id, v_provider_cost);
    
    RETURN v_request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers

-- Trigger for auto-refill
CREATE TRIGGER trigger_auto_refill_credits
    BEFORE UPDATE ON enrichment_credits
    FOR EACH ROW
    EXECUTE FUNCTION auto_refill_credits();

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_enrichment_providers_updated_at
    BEFORE UPDATE ON enrichment_providers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_enriched_data_updated_at
    BEFORE UPDATE ON enriched_data
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_enrichment_credits_updated_at
    BEFORE UPDATE ON enrichment_credits
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Scheduled jobs (to be set up with pg_cron or external scheduler)
-- 1. Run clean_expired_cache() every hour
-- 2. Run reset_enrichment_credits() every day at midnight

-- Insert default providers
INSERT INTO enrichment_providers (name, type, api_endpoint, cost_per_request, rate_limits) VALUES
    ('Hunter.io', 'email_finder', 'https://api.hunter.io/v2', 0.0050, '{"requests_per_minute": 60, "requests_per_hour": 500, "requests_per_day": 2000}'::jsonb),
    ('Clearbit', 'company_data', 'https://company.clearbit.com/v2', 0.0100, '{"requests_per_minute": 100, "requests_per_hour": 1000, "requests_per_day": 10000}'::jsonb),
    ('Apollo.io', 'contact_info', 'https://api.apollo.io/v1', 0.0080, '{"requests_per_minute": 60, "requests_per_hour": 600, "requests_per_day": 5000}'::jsonb),
    ('ZoomInfo', 'firmographics', 'https://api.zoominfo.com/v1', 0.0200, '{"requests_per_minute": 30, "requests_per_hour": 300, "requests_per_day": 3000}'::jsonb),
    ('Builtwith', 'technographics', 'https://api.builtwith.com/v1', 0.0150, '{"requests_per_minute": 30, "requests_per_hour": 300, "requests_per_day": 2000}'::jsonb)
ON CONFLICT (name) DO NOTHING;

-- Grant necessary permissions
GRANT SELECT ON enrichment_providers TO authenticated;
GRANT ALL ON enrichment_requests TO authenticated;
GRANT ALL ON enriched_data TO authenticated;
GRANT SELECT, UPDATE ON enrichment_credits TO authenticated;
GRANT SELECT, INSERT, UPDATE ON enrichment_cache TO authenticated;
GRANT ALL ON enrichment_field_mappings TO authenticated;
GRANT SELECT ON enrichment_webhooks TO authenticated;

-- Comments for documentation
COMMENT ON TABLE enrichment_providers IS 'Stores information about third-party data enrichment providers';
COMMENT ON TABLE enrichment_requests IS 'Tracks all enrichment API requests with status and results';
COMMENT ON TABLE enriched_data IS 'Stores enriched data for leads with expiration and confidence scores';
COMMENT ON TABLE enrichment_credits IS 'Manages credit allocation and usage per workspace and provider';
COMMENT ON TABLE enrichment_cache IS 'Caches enrichment results to reduce API calls and costs';
COMMENT ON TABLE enrichment_field_mappings IS 'Maps provider fields to lead fields for automatic data updates';
COMMENT ON TABLE enrichment_webhooks IS 'Handles webhook callbacks for asynchronous enrichment processing';