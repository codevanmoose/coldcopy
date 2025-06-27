-- Pipedrive Conflict Resolution System Schema
-- This migration adds comprehensive database support for conflict detection and resolution

-- Conflict history table
CREATE TABLE IF NOT EXISTS pipedrive_conflict_history (
    id TEXT PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('person', 'organization', 'deal', 'activity')),
    entity_id TEXT NOT NULL,
    conflict_type TEXT NOT NULL CHECK (conflict_type IN ('field_conflict', 'deletion_conflict', 'creation_conflict', 'relationship_conflict', 'merge_conflict', 'schema_conflict')),
    conflict_severity TEXT NOT NULL CHECK (conflict_severity IN ('low', 'medium', 'high', 'critical')),
    conflict_hash TEXT NOT NULL,
    detected_at TIMESTAMPTZ NOT NULL,
    resolved_at TIMESTAMPTZ DEFAULT NULL,
    resolution JSONB NOT NULL DEFAULT '{}'::jsonb,
    local_snapshot JSONB NOT NULL,
    remote_snapshot JSONB NOT NULL,
    final_snapshot JSONB DEFAULT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Optimistic locks table
CREATE TABLE IF NOT EXISTS pipedrive_optimistic_locks (
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    locked_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    locked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    lock_token TEXT UNIQUE NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    PRIMARY KEY (entity_type, entity_id)
);

-- Conflict resolution rules
CREATE TABLE IF NOT EXISTS pipedrive_conflict_resolution_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    enabled BOOLEAN NOT NULL DEFAULT true,
    priority INTEGER NOT NULL DEFAULT 0,
    entity_type TEXT CHECK (entity_type IN ('person', 'organization', 'deal', 'activity', 'all')),
    conflict_type TEXT CHECK (conflict_type IN ('field_conflict', 'deletion_conflict', 'creation_conflict', 'relationship_conflict', 'merge_conflict', 'schema_conflict', 'all')),
    field_patterns TEXT[] DEFAULT '{}',
    conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
    resolution_strategy TEXT NOT NULL CHECK (resolution_strategy IN ('latest_wins', 'pipedrive_wins', 'coldcopy_wins', 'field_level_merge', 'ai_resolution', 'manual', 'custom')),
    merge_config JSONB DEFAULT '{}'::jsonb,
    requires_approval BOOLEAN NOT NULL DEFAULT false,
    approval_roles TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Field-level conflict rules
CREATE TABLE IF NOT EXISTS pipedrive_field_conflict_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('person', 'organization', 'deal', 'activity')),
    field_name TEXT NOT NULL,
    field_type TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    resolution_strategy TEXT NOT NULL CHECK (resolution_strategy IN ('accept_local', 'accept_remote', 'merge', 'ai_resolve', 'manual')),
    merge_type TEXT CHECK (merge_type IN ('concatenate', 'average', 'sum', 'latest', 'earliest', 'union', 'intersection')),
    merge_config JSONB DEFAULT '{}'::jsonb,
    validation_rules JSONB DEFAULT '[]'::jsonb,
    transformation_rules JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(workspace_id, entity_type, field_name)
);

-- Manual conflict reviews
CREATE TABLE IF NOT EXISTS pipedrive_conflict_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    conflict_history_id TEXT NOT NULL REFERENCES pipedrive_conflict_history(id) ON DELETE CASCADE,
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_review', 'resolved', 'escalated', 'cancelled')),
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    resolution_notes TEXT,
    resolved_data JSONB DEFAULT NULL,
    resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_at TIMESTAMPTZ DEFAULT NULL,
    resolved_at TIMESTAMPTZ DEFAULT NULL
);

-- Conflict review comments
CREATE TABLE IF NOT EXISTS pipedrive_conflict_review_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id UUID NOT NULL REFERENCES pipedrive_conflict_reviews(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    comment TEXT NOT NULL,
    attachments JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- AI resolution suggestions
CREATE TABLE IF NOT EXISTS pipedrive_ai_resolution_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    conflict_history_id TEXT NOT NULL REFERENCES pipedrive_conflict_history(id) ON DELETE CASCADE,
    model_version TEXT NOT NULL,
    prompt TEXT NOT NULL,
    response JSONB NOT NULL,
    confidence DECIMAL(5,4) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    suggestions JSONB NOT NULL DEFAULT '[]'::jsonb,
    resolved_data JSONB DEFAULT NULL,
    tokens_used INTEGER NOT NULL DEFAULT 0,
    processing_time_ms INTEGER NOT NULL,
    accepted BOOLEAN DEFAULT NULL,
    feedback TEXT DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Conflict resolution metrics
CREATE TABLE IF NOT EXISTS pipedrive_conflict_resolution_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    entity_type TEXT NOT NULL,
    total_conflicts INTEGER NOT NULL DEFAULT 0,
    auto_resolved INTEGER NOT NULL DEFAULT 0,
    manual_resolved INTEGER NOT NULL DEFAULT 0,
    ai_resolved INTEGER NOT NULL DEFAULT 0,
    unresolved INTEGER NOT NULL DEFAULT 0,
    avg_resolution_time_ms BIGINT DEFAULT NULL,
    conflict_types JSONB NOT NULL DEFAULT '{}'::jsonb,
    field_frequencies JSONB NOT NULL DEFAULT '{}'::jsonb,
    resolution_strategies JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(workspace_id, period_start, period_end, entity_type)
);

-- Sync conflict prevention rules
CREATE TABLE IF NOT EXISTS pipedrive_sync_conflict_prevention (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('person', 'organization', 'deal', 'activity')),
    prevention_type TEXT NOT NULL CHECK (prevention_type IN ('field_lock', 'sync_window', 'version_check', 'rate_limit')),
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Conflict resolution templates
CREATE TABLE IF NOT EXISTS pipedrive_conflict_resolution_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    entity_types TEXT[] NOT NULL DEFAULT '{}',
    conflict_types TEXT[] NOT NULL DEFAULT '{}',
    resolution_rules JSONB NOT NULL DEFAULT '[]'::jsonb,
    merge_strategies JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_pipedrive_conflict_history_workspace ON pipedrive_conflict_history(workspace_id);
CREATE INDEX IF NOT EXISTS idx_pipedrive_conflict_history_entity ON pipedrive_conflict_history(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_pipedrive_conflict_history_detected_at ON pipedrive_conflict_history(detected_at);
CREATE INDEX IF NOT EXISTS idx_pipedrive_conflict_history_conflict_type ON pipedrive_conflict_history(conflict_type);
CREATE INDEX IF NOT EXISTS idx_pipedrive_conflict_history_severity ON pipedrive_conflict_history(conflict_severity);
CREATE INDEX IF NOT EXISTS idx_pipedrive_conflict_history_resolved ON pipedrive_conflict_history(resolved_at) WHERE resolved_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pipedrive_optimistic_locks_token ON pipedrive_optimistic_locks(lock_token);
CREATE INDEX IF NOT EXISTS idx_pipedrive_optimistic_locks_expires ON pipedrive_optimistic_locks(expires_at);

CREATE INDEX IF NOT EXISTS idx_pipedrive_conflict_resolution_rules_workspace ON pipedrive_conflict_resolution_rules(workspace_id, enabled);
CREATE INDEX IF NOT EXISTS idx_pipedrive_conflict_resolution_rules_priority ON pipedrive_conflict_resolution_rules(priority DESC);

CREATE INDEX IF NOT EXISTS idx_pipedrive_field_conflict_rules_workspace ON pipedrive_field_conflict_rules(workspace_id);
CREATE INDEX IF NOT EXISTS idx_pipedrive_field_conflict_rules_entity_field ON pipedrive_field_conflict_rules(entity_type, field_name);

CREATE INDEX IF NOT EXISTS idx_pipedrive_conflict_reviews_workspace_status ON pipedrive_conflict_reviews(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_pipedrive_conflict_reviews_assigned ON pipedrive_conflict_reviews(assigned_to) WHERE assigned_to IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pipedrive_ai_resolution_suggestions_workspace ON pipedrive_ai_resolution_suggestions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_pipedrive_ai_resolution_suggestions_confidence ON pipedrive_ai_resolution_suggestions(confidence DESC);

CREATE INDEX IF NOT EXISTS idx_pipedrive_conflict_resolution_metrics_workspace_period ON pipedrive_conflict_resolution_metrics(workspace_id, period_start, period_end);

-- Create updated_at triggers
CREATE TRIGGER update_pipedrive_conflict_resolution_rules_updated_at 
    BEFORE UPDATE ON pipedrive_conflict_resolution_rules 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pipedrive_field_conflict_rules_updated_at 
    BEFORE UPDATE ON pipedrive_field_conflict_rules 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pipedrive_sync_conflict_prevention_updated_at 
    BEFORE UPDATE ON pipedrive_sync_conflict_prevention 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pipedrive_conflict_resolution_templates_updated_at 
    BEFORE UPDATE ON pipedrive_conflict_resolution_templates 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Cleanup function for expired locks
CREATE OR REPLACE FUNCTION cleanup_expired_pipedrive_locks() RETURNS void AS $$
BEGIN
    DELETE FROM pipedrive_optimistic_locks 
    WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup (requires pg_cron extension)
-- SELECT cron.schedule('cleanup-pipedrive-locks', '*/5 * * * *', 'SELECT cleanup_expired_pipedrive_locks();');

-- Function to calculate conflict resolution metrics
CREATE OR REPLACE FUNCTION calculate_pipedrive_conflict_metrics(
    p_workspace_id UUID,
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ
) RETURNS void AS $$
DECLARE
    v_entity_type TEXT;
BEGIN
    -- Calculate metrics for each entity type
    FOR v_entity_type IN SELECT DISTINCT entity_type FROM pipedrive_conflict_history 
        WHERE workspace_id = p_workspace_id 
        AND detected_at BETWEEN p_start_date AND p_end_date
    LOOP
        INSERT INTO pipedrive_conflict_resolution_metrics (
            workspace_id,
            period_start,
            period_end,
            entity_type,
            total_conflicts,
            auto_resolved,
            manual_resolved,
            ai_resolved,
            unresolved,
            avg_resolution_time_ms,
            conflict_types,
            field_frequencies,
            resolution_strategies
        )
        SELECT 
            p_workspace_id,
            p_start_date,
            p_end_date,
            v_entity_type,
            COUNT(*),
            COUNT(*) FILTER (WHERE resolution->>'strategy' IN ('latest_wins', 'pipedrive_wins', 'coldcopy_wins', 'field_level_merge')),
            COUNT(*) FILTER (WHERE resolution->>'strategy' = 'manual'),
            COUNT(*) FILTER (WHERE resolution->>'strategy' = 'ai_resolution'),
            COUNT(*) FILTER (WHERE resolved_at IS NULL),
            AVG(EXTRACT(EPOCH FROM (resolved_at - detected_at)) * 1000)::BIGINT,
            jsonb_object_agg(conflict_type, conflict_count) FILTER (WHERE conflict_type IS NOT NULL),
            jsonb_object_agg(field_name, field_count) FILTER (WHERE field_name IS NOT NULL),
            jsonb_object_agg(strategy, strategy_count) FILTER (WHERE strategy IS NOT NULL)
        FROM (
            SELECT 
                conflict_type,
                COUNT(*) as conflict_count,
                resolution->>'strategy' as strategy,
                COUNT(*) as strategy_count,
                unnest(array(SELECT jsonb_array_elements_text(resolution->'conflictedFields'))) as field_name,
                COUNT(*) as field_count
            FROM pipedrive_conflict_history
            WHERE workspace_id = p_workspace_id 
            AND entity_type = v_entity_type
            AND detected_at BETWEEN p_start_date AND p_end_date
            GROUP BY conflict_type, resolution->>'strategy', field_name
        ) as metrics_data
        ON CONFLICT (workspace_id, period_start, period_end, entity_type) 
        DO UPDATE SET
            total_conflicts = EXCLUDED.total_conflicts,
            auto_resolved = EXCLUDED.auto_resolved,
            manual_resolved = EXCLUDED.manual_resolved,
            ai_resolved = EXCLUDED.ai_resolved,
            unresolved = EXCLUDED.unresolved,
            avg_resolution_time_ms = EXCLUDED.avg_resolution_time_ms,
            conflict_types = EXCLUDED.conflict_types,
            field_frequencies = EXCLUDED.field_frequencies,
            resolution_strategies = EXCLUDED.resolution_strategies,
            created_at = now();
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Row Level Security policies
ALTER TABLE pipedrive_conflict_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipedrive_optimistic_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipedrive_conflict_resolution_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipedrive_field_conflict_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipedrive_conflict_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipedrive_conflict_review_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipedrive_ai_resolution_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipedrive_conflict_resolution_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipedrive_sync_conflict_prevention ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipedrive_conflict_resolution_templates ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can access their workspace conflict data" ON pipedrive_conflict_history 
    FOR ALL USING (user_has_workspace_access(workspace_id));

CREATE POLICY "Users can access their locks" ON pipedrive_optimistic_locks 
    FOR ALL USING (locked_by = auth.uid());

CREATE POLICY "Users can access their workspace conflict rules" ON pipedrive_conflict_resolution_rules 
    FOR ALL USING (user_has_workspace_access(workspace_id));

CREATE POLICY "Users can access their workspace field rules" ON pipedrive_field_conflict_rules 
    FOR ALL USING (user_has_workspace_access(workspace_id));

CREATE POLICY "Users can access their workspace reviews" ON pipedrive_conflict_reviews 
    FOR ALL USING (user_has_workspace_access(workspace_id));

CREATE POLICY "Users can access review comments" ON pipedrive_conflict_review_comments 
    FOR ALL USING (EXISTS (
        SELECT 1 FROM pipedrive_conflict_reviews r 
        WHERE r.id = review_id 
        AND user_has_workspace_access(r.workspace_id)
    ));

CREATE POLICY "Users can access their workspace AI suggestions" ON pipedrive_ai_resolution_suggestions 
    FOR ALL USING (user_has_workspace_access(workspace_id));

CREATE POLICY "Users can access their workspace metrics" ON pipedrive_conflict_resolution_metrics 
    FOR ALL USING (user_has_workspace_access(workspace_id));

CREATE POLICY "Users can access their workspace prevention rules" ON pipedrive_sync_conflict_prevention 
    FOR ALL USING (user_has_workspace_access(workspace_id));

CREATE POLICY "Users can access their workspace templates" ON pipedrive_conflict_resolution_templates 
    FOR ALL USING (user_has_workspace_access(workspace_id));