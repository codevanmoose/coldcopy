-- HubSpot Field Mappings
-- Stores custom field mappings between ColdCopy and HubSpot

CREATE TABLE hubspot_field_mappings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    object_type VARCHAR(50) NOT NULL CHECK (object_type IN ('contacts', 'companies', 'deals', 'activities')),
    
    -- Field information
    coldcopy_field VARCHAR(255) NOT NULL,
    hubspot_field VARCHAR(255) NOT NULL,
    
    -- Sync configuration
    direction VARCHAR(20) NOT NULL DEFAULT 'bidirectional' CHECK (direction IN ('to_hubspot', 'from_hubspot', 'bidirectional')),
    is_required BOOLEAN NOT NULL DEFAULT false,
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    
    -- Transform configuration
    transform_function TEXT, -- Optional JavaScript function for data transformation
    validation_rules JSONB DEFAULT '{}', -- Custom validation rules
    
    -- Metadata
    sync_priority INTEGER DEFAULT 100, -- Lower number = higher priority
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(workspace_id, object_type, coldcopy_field),
    UNIQUE(workspace_id, object_type, hubspot_field)
);

-- Indexes for performance
CREATE INDEX idx_hubspot_field_mappings_workspace ON hubspot_field_mappings(workspace_id);
CREATE INDEX idx_hubspot_field_mappings_object_type ON hubspot_field_mappings(workspace_id, object_type);
CREATE INDEX idx_hubspot_field_mappings_enabled ON hubspot_field_mappings(workspace_id, object_type, is_enabled);

-- RLS policies
ALTER TABLE hubspot_field_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace isolation for field mappings" ON hubspot_field_mappings
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id 
            FROM workspace_members 
            WHERE user_id = auth.uid()
        )
    );

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_hubspot_field_mappings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_hubspot_field_mappings_updated_at
    BEFORE UPDATE ON hubspot_field_mappings
    FOR EACH ROW
    EXECUTE FUNCTION update_hubspot_field_mappings_updated_at();

-- Insert default field mappings for common objects
INSERT INTO hubspot_field_mappings (workspace_id, object_type, coldcopy_field, hubspot_field, direction, is_required)
SELECT 
    w.id as workspace_id,
    'contacts' as object_type,
    mapping.coldcopy_field,
    mapping.hubspot_field,
    mapping.direction,
    mapping.is_required
FROM workspaces w
CROSS JOIN (
    VALUES 
        ('email', 'email', 'bidirectional', true),
        ('first_name', 'firstname', 'bidirectional', false),
        ('last_name', 'lastname', 'bidirectional', false),
        ('company', 'company', 'bidirectional', false),
        ('job_title', 'jobtitle', 'bidirectional', false),
        ('phone', 'phone', 'bidirectional', false),
        ('website', 'website', 'bidirectional', false)
) AS mapping(coldcopy_field, hubspot_field, direction, is_required)
WHERE EXISTS (
    SELECT 1 FROM hubspot_connections hc 
    WHERE hc.workspace_id = w.id AND hc.is_active = true
);

-- Default company mappings
INSERT INTO hubspot_field_mappings (workspace_id, object_type, coldcopy_field, hubspot_field, direction, is_required)
SELECT 
    w.id as workspace_id,
    'companies' as object_type,
    mapping.coldcopy_field,
    mapping.hubspot_field,
    mapping.direction,
    mapping.is_required
FROM workspaces w
CROSS JOIN (
    VALUES 
        ('name', 'name', 'bidirectional', true),
        ('domain', 'domain', 'bidirectional', false),
        ('industry', 'industry', 'bidirectional', false),
        ('phone', 'phone', 'bidirectional', false),
        ('city', 'city', 'bidirectional', false),
        ('description', 'description', 'bidirectional', false)
) AS mapping(coldcopy_field, hubspot_field, direction, is_required)
WHERE EXISTS (
    SELECT 1 FROM hubspot_connections hc 
    WHERE hc.workspace_id = w.id AND hc.is_active = true
);

-- Default deal mappings
INSERT INTO hubspot_field_mappings (workspace_id, object_type, coldcopy_field, hubspot_field, direction, is_required)
SELECT 
    w.id as workspace_id,
    'deals' as object_type,
    mapping.coldcopy_field,
    mapping.hubspot_field,
    mapping.direction,
    mapping.is_required
FROM workspaces w
CROSS JOIN (
    VALUES 
        ('dealname', 'dealname', 'to_hubspot', true),
        ('amount', 'amount', 'bidirectional', false),
        ('dealstage', 'dealstage', 'bidirectional', false),
        ('closedate', 'closedate', 'bidirectional', false),
        ('dealtype', 'dealtype', 'to_hubspot', false)
) AS mapping(coldcopy_field, hubspot_field, direction, is_required)
WHERE EXISTS (
    SELECT 1 FROM hubspot_connections hc 
    WHERE hc.workspace_id = w.id AND hc.is_active = true
);

-- Function to get field mappings for sync operations
CREATE OR REPLACE FUNCTION get_hubspot_field_mappings(
    p_workspace_id UUID,
    p_object_type VARCHAR(50),
    p_direction VARCHAR(20) DEFAULT NULL
)
RETURNS TABLE (
    coldcopy_field VARCHAR(255),
    hubspot_field VARCHAR(255),
    direction VARCHAR(20),
    is_required BOOLEAN,
    transform_function TEXT,
    validation_rules JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        hfm.coldcopy_field,
        hfm.hubspot_field,
        hfm.direction,
        hfm.is_required,
        hfm.transform_function,
        hfm.validation_rules
    FROM hubspot_field_mappings hfm
    WHERE hfm.workspace_id = p_workspace_id
      AND hfm.object_type = p_object_type
      AND hfm.is_enabled = true
      AND (p_direction IS NULL OR hfm.direction IN (p_direction, 'bidirectional'))
    ORDER BY hfm.sync_priority ASC, hfm.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_hubspot_field_mappings(UUID, VARCHAR, VARCHAR) TO authenticated;