-- ====================================
-- White-Label Database Schema
-- ====================================
-- Comprehensive schema for white-label functionality including
-- custom domains, branding, email templates, client portals, and settings

-- ====================================
-- 1. WHITE_LABEL_DOMAINS TABLE
-- ====================================
-- Manages custom domains and subdomains for white-label instances
CREATE TABLE IF NOT EXISTS white_label_domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    domain TEXT NOT NULL, -- e.g., 'mycustom.com'
    subdomain TEXT, -- e.g., 'app' for 'app.mycustom.com'
    full_domain TEXT GENERATED ALWAYS AS (
        CASE 
            WHEN subdomain IS NOT NULL AND subdomain != '' 
            THEN subdomain || '.' || domain
            ELSE domain
        END
    ) STORED,
    
    -- SSL and verification status
    ssl_status TEXT NOT NULL DEFAULT 'pending' CHECK (ssl_status IN (
        'pending',
        'provisioning',
        'active',
        'expired',
        'failed',
        'disabled'
    )),
    verification_status TEXT NOT NULL DEFAULT 'pending' CHECK (verification_status IN (
        'pending',
        'verifying',
        'verified',
        'failed',
        'expired'
    )),
    
    -- DNS configuration
    dns_records JSONB DEFAULT '{
        "cname": null,
        "a_records": [],
        "txt_records": [],
        "mx_records": [],
        "verification_token": null
    }'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    verified_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ, -- SSL certificate expiry
    last_checked_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    -- Status flags
    is_active BOOLEAN DEFAULT false,
    is_primary BOOLEAN DEFAULT false, -- Only one primary domain per workspace
    
    -- Metadata
    notes TEXT, -- Admin notes about the domain
    config JSONB DEFAULT '{}'::jsonb, -- Additional configuration
    
    -- Constraints
    UNIQUE(workspace_id, domain, subdomain),
    UNIQUE(full_domain)
);

-- ====================================
-- 2. WHITE_LABEL_BRANDING TABLE
-- ====================================
-- Stores branding customizations for workspaces or specific domains
CREATE TABLE IF NOT EXISTS white_label_branding (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    domain_id UUID REFERENCES white_label_domains(id) ON DELETE CASCADE, -- NULL for global workspace branding
    
    -- Visual branding
    logo_url TEXT,
    favicon_url TEXT,
    primary_color TEXT DEFAULT '#3b82f6', -- Hex color code
    secondary_color TEXT DEFAULT '#1e40af',
    accent_color TEXT DEFAULT '#f59e0b',
    background_color TEXT DEFAULT '#ffffff',
    text_color TEXT DEFAULT '#1f2937',
    
    -- Typography
    font_family TEXT DEFAULT 'Inter, system-ui, sans-serif',
    font_url TEXT, -- For custom fonts (Google Fonts, etc.)
    
    -- Custom styling
    custom_css TEXT, -- Custom CSS overrides
    theme_config JSONB DEFAULT '{
        "borderRadius": "0.5rem",
        "spacing": "1rem",
        "shadows": true,
        "animations": true
    }'::jsonb,
    
    -- Company information
    company_name TEXT NOT NULL,
    company_description TEXT,
    company_address TEXT,
    company_phone TEXT,
    company_website TEXT,
    
    -- Footer and legal
    footer_text TEXT,
    copyright_text TEXT,
    support_email TEXT,
    privacy_url TEXT,
    terms_url TEXT,
    cookie_policy_url TEXT,
    
    -- Social links
    social_links JSONB DEFAULT '{
        "twitter": null,
        "linkedin": null,
        "facebook": null,
        "instagram": null,
        "youtube": null
    }'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    -- Only one branding config per workspace-domain combination
    UNIQUE(workspace_id, domain_id)
);

-- ====================================
-- 3. WHITE_LABEL_EMAIL_TEMPLATES TABLE
-- ====================================
-- Customizable email templates for different types of communications
CREATE TABLE IF NOT EXISTS white_label_email_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    
    -- Template identification
    template_type TEXT NOT NULL CHECK (template_type IN (
        'welcome',
        'password_reset',
        'email_verification',
        'invitation',
        'lead_notification',
        'campaign_complete',
        'weekly_report',
        'monthly_report',
        'payment_receipt',
        'trial_expiring',
        'subscription_cancelled',
        'custom'
    )),
    template_name TEXT NOT NULL, -- Human-readable name
    template_key TEXT, -- Unique key for custom templates
    
    -- Email content
    subject TEXT NOT NULL,
    html_content TEXT NOT NULL,
    text_content TEXT, -- Plain text version
    preheader TEXT, -- Email preview text
    
    -- Template variables and configuration
    variables JSONB DEFAULT '{
        "user_name": "{{user_name}}",
        "company_name": "{{company_name}}",
        "workspace_name": "{{workspace_name}}",
        "action_url": "{{action_url}}",
        "support_email": "{{support_email}}"
    }'::jsonb,
    
    -- Email settings
    from_name TEXT,
    from_email TEXT,
    reply_to TEXT,
    cc_emails TEXT[],
    bcc_emails TEXT[],
    
    -- Status and metadata
    is_active BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false, -- System default template
    version INTEGER DEFAULT 1,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMPTZ,
    
    -- Unique constraint for template types per workspace
    UNIQUE(workspace_id, template_type, template_key)
);

-- ====================================
-- 4. WHITE_LABEL_CLIENT_PORTALS TABLE
-- ====================================
-- Manages client portal access for leads/customers
CREATE TABLE IF NOT EXISTS white_label_client_portals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE, -- The lead/client
    
    -- Portal access
    portal_url TEXT NOT NULL, -- Unique portal URL slug
    access_token TEXT NOT NULL UNIQUE, -- JWT or secure token for access
    login_token TEXT, -- One-time login token
    
    -- Permissions and features
    permissions JSONB DEFAULT '{
        "view_campaigns": true,
        "view_analytics": false,
        "download_reports": false,
        "update_profile": true,
        "view_invoices": false,
        "manage_team": false
    }'::jsonb,
    
    -- Portal customization
    custom_welcome_message TEXT,
    allowed_features TEXT[] DEFAULT ARRAY['dashboard', 'campaigns', 'profile'],
    theme_override JSONB, -- Override workspace theme for this portal
    
    -- Status and security
    is_active BOOLEAN DEFAULT true,
    login_attempts INTEGER DEFAULT 0,
    last_login_attempt_at TIMESTAMPTZ,
    is_locked BOOLEAN DEFAULT false,
    locked_until TIMESTAMPTZ,
    
    -- Timestamps
    expires_at TIMESTAMPTZ DEFAULT (CURRENT_TIMESTAMP + INTERVAL '1 year'),
    last_accessed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    -- Notifications
    email_notifications BOOLEAN DEFAULT true,
    notification_frequency TEXT DEFAULT 'weekly' CHECK (notification_frequency IN (
        'immediate', 'daily', 'weekly', 'monthly', 'never'
    )),
    
    -- Unique portal URL per workspace
    UNIQUE(workspace_id, portal_url)
);

-- ====================================
-- 5. WHITE_LABEL_SETTINGS TABLE
-- ====================================
-- Global white-label settings and feature flags per workspace
CREATE TABLE IF NOT EXISTS white_label_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    
    -- Feature flags
    feature_flags JSONB DEFAULT '{
        "custom_domains": true,
        "client_portals": true,
        "custom_email_templates": true,
        "white_label_reports": true,
        "api_access": false,
        "sso_integration": false,
        "advanced_analytics": false,
        "webhook_endpoints": false
    }'::jsonb,
    
    -- Navigation and UI customization
    custom_navigation JSONB DEFAULT '{
        "items": [
            {"label": "Dashboard", "path": "/dashboard", "icon": "home"},
            {"label": "Campaigns", "path": "/campaigns", "icon": "mail"},
            {"label": "Analytics", "path": "/analytics", "icon": "chart"},
            {"label": "Settings", "path": "/settings", "icon": "settings"}
        ],
        "logo_text": null,
        "show_breadcrumbs": true,
        "show_user_menu": true
    }'::jsonb,
    
    -- Branding control
    hide_coldcopy_branding BOOLEAN DEFAULT false,
    hide_powered_by BOOLEAN DEFAULT false,
    custom_footer_text TEXT,
    show_support_chat BOOLEAN DEFAULT true,
    
    -- Page customizations
    custom_login_page JSONB DEFAULT '{
        "enabled": false,
        "background_image": null,
        "welcome_title": "Welcome Back",
        "welcome_subtitle": "Sign in to your account",
        "show_registration": true,
        "custom_css": null
    }'::jsonb,
    
    custom_dashboard JSONB DEFAULT '{
        "welcome_message": "Welcome to your dashboard",
        "default_widgets": ["recent_campaigns", "analytics_overview", "quick_actions"],
        "layout": "grid",
        "show_getting_started": true
    }'::jsonb,
    
    -- Integration settings
    webhook_endpoints JSONB DEFAULT '{
        "campaign_complete": null,
        "lead_updated": null,
        "portal_access": null,
        "payment_received": null
    }'::jsonb,
    
    -- Security settings
    security_config JSONB DEFAULT '{
        "session_timeout": 3600,
        "require_2fa": false,
        "allowed_ip_ranges": [],
        "password_policy": {
            "min_length": 8,
            "require_uppercase": true,
            "require_numbers": true,
            "require_symbols": false
        }
    }'::jsonb,
    
    -- Email settings
    email_config JSONB DEFAULT '{
        "smtp_host": null,
        "smtp_port": 587,
        "smtp_username": null,
        "smtp_password": null,
        "use_tls": true,
        "default_from_email": null,
        "default_from_name": null
    }'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    -- Only one settings record per workspace
    UNIQUE(workspace_id)
);

-- ====================================
-- INDEXES FOR PERFORMANCE
-- ====================================

-- Domain lookups (most frequent queries)
CREATE INDEX IF NOT EXISTS idx_white_label_domains_full_domain ON white_label_domains(full_domain);
CREATE INDEX IF NOT EXISTS idx_white_label_domains_workspace_active ON white_label_domains(workspace_id, is_active);
CREATE INDEX IF NOT EXISTS idx_white_label_domains_ssl_status ON white_label_domains(ssl_status) WHERE ssl_status IN ('pending', 'provisioning');
CREATE INDEX IF NOT EXISTS idx_white_label_domains_verification_status ON white_label_domains(verification_status) WHERE verification_status IN ('pending', 'verifying');
CREATE INDEX IF NOT EXISTS idx_white_label_domains_expires_at ON white_label_domains(expires_at) WHERE expires_at IS NOT NULL;

-- Branding lookups  
CREATE INDEX IF NOT EXISTS idx_white_label_branding_workspace_domain ON white_label_branding(workspace_id, domain_id);

-- Email template lookups
CREATE INDEX IF NOT EXISTS idx_white_label_email_templates_workspace_type ON white_label_email_templates(workspace_id, template_type);
CREATE INDEX IF NOT EXISTS idx_white_label_email_templates_active ON white_label_email_templates(is_active) WHERE is_active = true;

-- Client portal lookups
CREATE INDEX IF NOT EXISTS idx_white_label_client_portals_workspace_client ON white_label_client_portals(workspace_id, client_id);
CREATE INDEX IF NOT EXISTS idx_white_label_client_portals_portal_url ON white_label_client_portals(portal_url);
CREATE INDEX IF NOT EXISTS idx_white_label_client_portals_access_token ON white_label_client_portals(access_token);
CREATE INDEX IF NOT EXISTS idx_white_label_client_portals_expires_at ON white_label_client_portals(expires_at);
CREATE INDEX IF NOT EXISTS idx_white_label_client_portals_active ON white_label_client_portals(is_active) WHERE is_active = true;

-- ====================================
-- ROW LEVEL SECURITY (RLS)
-- ====================================

-- Enable RLS on all tables
ALTER TABLE white_label_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE white_label_branding ENABLE ROW LEVEL SECURITY;
ALTER TABLE white_label_email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE white_label_client_portals ENABLE ROW LEVEL SECURITY;
ALTER TABLE white_label_settings ENABLE ROW LEVEL SECURITY;

-- Domains policies
CREATE POLICY "Users can view their workspace domains"
    ON white_label_domains FOR SELECT
    TO authenticated
    USING (workspace_id IN (
        SELECT workspace_id FROM workspace_users WHERE user_id = auth.uid()
    ));

CREATE POLICY "Admin users can manage their workspace domains"
    ON white_label_domains FOR ALL
    TO authenticated
    USING (workspace_id IN (
        SELECT workspace_id FROM workspace_users 
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    ));

-- Branding policies
CREATE POLICY "Users can view their workspace branding"
    ON white_label_branding FOR SELECT
    TO authenticated
    USING (workspace_id IN (
        SELECT workspace_id FROM workspace_users WHERE user_id = auth.uid()
    ));

CREATE POLICY "Admin users can manage their workspace branding"
    ON white_label_branding FOR ALL
    TO authenticated
    USING (workspace_id IN (
        SELECT workspace_id FROM workspace_users 
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    ));

-- Email templates policies
CREATE POLICY "Users can view their workspace email templates"
    ON white_label_email_templates FOR SELECT
    TO authenticated
    USING (workspace_id IN (
        SELECT workspace_id FROM workspace_users WHERE user_id = auth.uid()
    ));

CREATE POLICY "Admin users can manage their workspace email templates"
    ON white_label_email_templates FOR ALL
    TO authenticated
    USING (workspace_id IN (
        SELECT workspace_id FROM workspace_users 
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    ));

-- Client portals policies
CREATE POLICY "Users can view their workspace client portals"
    ON white_label_client_portals FOR SELECT
    TO authenticated
    USING (workspace_id IN (
        SELECT workspace_id FROM workspace_users WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can manage their workspace client portals"
    ON white_label_client_portals FOR ALL
    TO authenticated
    USING (workspace_id IN (
        SELECT workspace_id FROM workspace_users 
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'member')
    ));

-- Allow clients to access their own portal data
CREATE POLICY "Clients can view their own portal"
    ON white_label_client_portals FOR SELECT
    TO authenticated
    USING (client_id IN (
        SELECT id FROM leads 
        WHERE email = (
            SELECT email FROM auth.users WHERE id = auth.uid()
        )
    ));

-- Settings policies
CREATE POLICY "Users can view their workspace settings"
    ON white_label_settings FOR SELECT
    TO authenticated
    USING (workspace_id IN (
        SELECT workspace_id FROM workspace_users WHERE user_id = auth.uid()
    ));

CREATE POLICY "Admin users can manage their workspace settings"
    ON white_label_settings FOR ALL
    TO authenticated
    USING (workspace_id IN (
        SELECT workspace_id FROM workspace_users 
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    ));

-- ====================================
-- FUNCTIONS
-- ====================================

-- Function to verify domain ownership via DNS
CREATE OR REPLACE FUNCTION verify_domain_ownership(
    p_domain_id UUID,
    p_verification_method TEXT DEFAULT 'txt'
) RETURNS BOOLEAN AS $$
DECLARE
    v_domain_record RECORD;
    v_verification_token TEXT;
    v_success BOOLEAN := false;
BEGIN
    -- Get domain record
    SELECT * INTO v_domain_record
    FROM white_label_domains
    WHERE id = p_domain_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Domain not found';
    END IF;
    
    -- Generate verification token if not exists
    v_verification_token := COALESCE(
        (v_domain_record.dns_records->>'verification_token'),
        encode(gen_random_bytes(32), 'hex')
    );
    
    -- Update verification token in DNS records
    UPDATE white_label_domains
    SET 
        dns_records = jsonb_set(
            dns_records,
            '{verification_token}',
            to_jsonb(v_verification_token)
        ),
        verification_status = 'verifying',
        last_checked_at = CURRENT_TIMESTAMP
    WHERE id = p_domain_id;
    
    -- Here you would implement actual DNS verification logic
    -- For now, we'll simulate verification after a delay
    -- In production, this would be handled by a background job
    
    RETURN v_success;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to provision SSL certificate
CREATE OR REPLACE FUNCTION provision_ssl_certificate(
    p_domain_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    v_domain_record RECORD;
    v_success BOOLEAN := false;
BEGIN
    -- Get domain record
    SELECT * INTO v_domain_record
    FROM white_label_domains
    WHERE id = p_domain_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Domain not found';
    END IF;
    
    -- Check if domain is verified
    IF v_domain_record.verification_status != 'verified' THEN
        RAISE EXCEPTION 'Domain must be verified before SSL provisioning';
    END IF;
    
    -- Update SSL status to provisioning
    UPDATE white_label_domains
    SET 
        ssl_status = 'provisioning',
        last_checked_at = CURRENT_TIMESTAMP
    WHERE id = p_domain_id;
    
    -- Here you would implement actual SSL provisioning logic
    -- Integration with Let's Encrypt, Cloudflare, etc.
    
    RETURN v_success;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to generate client portal access
CREATE OR REPLACE FUNCTION generate_client_portal_access(
    p_workspace_id UUID,
    p_client_id UUID,
    p_portal_url TEXT DEFAULT NULL,
    p_expires_in_days INTEGER DEFAULT 365
) RETURNS UUID AS $$
DECLARE
    v_portal_id UUID;
    v_portal_url TEXT;
    v_access_token TEXT;
BEGIN
    -- Generate portal URL if not provided
    v_portal_url := COALESCE(
        p_portal_url,
        'client-' || encode(gen_random_bytes(8), 'hex')
    );
    
    -- Generate secure access token
    v_access_token := encode(gen_random_bytes(32), 'base64');
    
    -- Create or update portal access
    INSERT INTO white_label_client_portals (
        workspace_id,
        client_id,
        portal_url,
        access_token,
        expires_at
    ) VALUES (
        p_workspace_id,
        p_client_id,
        v_portal_url,
        v_access_token,
        CURRENT_TIMESTAMP + (p_expires_in_days || ' days')::INTERVAL
    )
    ON CONFLICT (workspace_id, portal_url)
    DO UPDATE SET
        access_token = EXCLUDED.access_token,
        expires_at = EXCLUDED.expires_at,
        is_active = true,
        updated_at = CURRENT_TIMESTAMP
    RETURNING id INTO v_portal_id;
    
    RETURN v_portal_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to validate portal access
CREATE OR REPLACE FUNCTION validate_portal_access(
    p_portal_url TEXT,
    p_access_token TEXT
) RETURNS TABLE (
    portal_id UUID,
    workspace_id UUID,
    client_id UUID,
    permissions JSONB,
    is_valid BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cp.id,
        cp.workspace_id,
        cp.client_id,
        cp.permissions,
        (cp.is_active 
         AND cp.expires_at > CURRENT_TIMESTAMP 
         AND NOT cp.is_locked) as is_valid
    FROM white_label_client_portals cp
    WHERE cp.portal_url = p_portal_url
    AND cp.access_token = p_access_token;
    
    -- Update last accessed timestamp
    UPDATE white_label_client_portals
    SET 
        last_accessed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE portal_url = p_portal_url
    AND access_token = p_access_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to render email template with variables
CREATE OR REPLACE FUNCTION render_email_template(
    p_workspace_id UUID,
    p_template_type TEXT,
    p_variables JSONB DEFAULT '{}'::jsonb
) RETURNS TABLE (
    subject TEXT,
    html_content TEXT,
    text_content TEXT,
    from_name TEXT,
    from_email TEXT
) AS $$
DECLARE
    v_template RECORD;
    v_branding RECORD;
    v_rendered_subject TEXT;
    v_rendered_html TEXT;
    v_rendered_text TEXT;
    v_var_key TEXT;
    v_var_value TEXT;
BEGIN
    -- Get template
    SELECT * INTO v_template
    FROM white_label_email_templates
    WHERE workspace_id = p_workspace_id
    AND template_type = p_template_type
    AND is_active = true
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Email template not found for type: %', p_template_type;
    END IF;
    
    -- Get branding information
    SELECT * INTO v_branding
    FROM white_label_branding
    WHERE workspace_id = p_workspace_id
    AND domain_id IS NULL
    LIMIT 1;
    
    -- Start with template content
    v_rendered_subject := v_template.subject;
    v_rendered_html := v_template.html_content;
    v_rendered_text := COALESCE(v_template.text_content, '');
    
    -- Replace branding variables
    IF v_branding IS NOT NULL THEN
        v_rendered_subject := REPLACE(v_rendered_subject, '{{company_name}}', COALESCE(v_branding.company_name, ''));
        v_rendered_html := REPLACE(v_rendered_html, '{{company_name}}', COALESCE(v_branding.company_name, ''));
        v_rendered_html := REPLACE(v_rendered_html, '{{support_email}}', COALESCE(v_branding.support_email, ''));
        v_rendered_html := REPLACE(v_rendered_html, '{{primary_color}}', COALESCE(v_branding.primary_color, '#3b82f6'));
        v_rendered_text := REPLACE(v_rendered_text, '{{company_name}}', COALESCE(v_branding.company_name, ''));
    END IF;
    
    -- Replace custom variables
    FOR v_var_key, v_var_value IN
        SELECT key, value
        FROM jsonb_each_text(p_variables)
    LOOP
        v_rendered_subject := REPLACE(v_rendered_subject, '{{' || v_var_key || '}}', v_var_value);
        v_rendered_html := REPLACE(v_rendered_html, '{{' || v_var_key || '}}', v_var_value);
        v_rendered_text := REPLACE(v_rendered_text, '{{' || v_var_key || '}}', v_var_value);
    END LOOP;
    
    RETURN QUERY SELECT
        v_rendered_subject,
        v_rendered_html,
        v_rendered_text,
        COALESCE(v_template.from_name, v_branding.company_name),
        COALESCE(v_template.from_email, v_branding.support_email);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get domain configuration by URL
CREATE OR REPLACE FUNCTION get_domain_config(
    p_domain TEXT
) RETURNS TABLE (
    workspace_id UUID,
    domain_id UUID,
    is_active BOOLEAN,
    branding JSONB,
    settings JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d.workspace_id,
        d.id as domain_id,
        d.is_active,
        to_jsonb(b.*) as branding,
        s.feature_flags || s.custom_navigation || s.custom_login_page || s.custom_dashboard as settings
    FROM white_label_domains d
    LEFT JOIN white_label_branding b ON b.workspace_id = d.workspace_id 
        AND (b.domain_id = d.id OR b.domain_id IS NULL)
    LEFT JOIN white_label_settings s ON s.workspace_id = d.workspace_id
    WHERE d.full_domain = p_domain
    AND d.is_active = true
    AND d.verification_status = 'verified'
    ORDER BY b.domain_id NULLS LAST
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ====================================
-- TRIGGERS
-- ====================================

-- Trigger to ensure only one primary domain per workspace
CREATE OR REPLACE FUNCTION enforce_single_primary_domain()
RETURNS TRIGGER AS $$
BEGIN
    -- If setting a domain as primary, unset other primary domains in the workspace
    IF NEW.is_primary = true THEN
        UPDATE white_label_domains
        SET is_primary = false
        WHERE workspace_id = NEW.workspace_id
        AND id != NEW.id
        AND is_primary = true;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_enforce_single_primary_domain
    BEFORE INSERT OR UPDATE ON white_label_domains
    FOR EACH ROW
    WHEN (NEW.is_primary = true)
    EXECUTE FUNCTION enforce_single_primary_domain();

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to all relevant tables
CREATE TRIGGER update_white_label_branding_updated_at
    BEFORE UPDATE ON white_label_branding
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_white_label_email_templates_updated_at
    BEFORE UPDATE ON white_label_email_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_white_label_client_portals_updated_at
    BEFORE UPDATE ON white_label_client_portals
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_white_label_settings_updated_at
    BEFORE UPDATE ON white_label_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger to auto-generate portal URL
CREATE OR REPLACE FUNCTION auto_generate_portal_url()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.portal_url IS NULL OR NEW.portal_url = '' THEN
        NEW.portal_url := 'client-' || encode(gen_random_bytes(8), 'hex');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_generate_portal_url
    BEFORE INSERT ON white_label_client_portals
    FOR EACH ROW
    EXECUTE FUNCTION auto_generate_portal_url();

-- ====================================
-- DNS RECORD TEMPLATES
-- ====================================

-- Function to generate DNS record templates
CREATE OR REPLACE FUNCTION generate_dns_records(
    p_domain TEXT,
    p_subdomain TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_full_domain TEXT;
    v_dns_records JSONB;
BEGIN
    v_full_domain := CASE 
        WHEN p_subdomain IS NOT NULL AND p_subdomain != '' 
        THEN p_subdomain || '.' || p_domain
        ELSE p_domain
    END;
    
    v_dns_records := jsonb_build_object(
        'cname', jsonb_build_object(
            'name', CASE WHEN p_subdomain IS NOT NULL THEN p_subdomain ELSE '@' END,
            'value', 'coldcopy-proxy.herokuapp.com',
            'ttl', 300,
            'type', 'CNAME'
        ),
        'a_records', jsonb_build_array(
            jsonb_build_object(
                'name', '@',
                'value', '192.168.1.100',
                'ttl', 300,
                'type', 'A'
            )
        ),
        'txt_records', jsonb_build_array(
            jsonb_build_object(
                'name', '_coldcopy-verification',
                'value', 'coldcopy-verification=' || encode(gen_random_bytes(32), 'hex'),
                'ttl', 300,
                'type', 'TXT'
            )
        ),
        'mx_records', jsonb_build_array(),
        'verification_token', encode(gen_random_bytes(32), 'hex')
    );
    
    RETURN v_dns_records;
END;
$$ LANGUAGE plpgsql;

-- ====================================
-- DEFAULT DATA SEEDING
-- ====================================

-- Function to create default branding for a workspace
CREATE OR REPLACE FUNCTION create_default_branding(
    p_workspace_id UUID,
    p_company_name TEXT
) RETURNS UUID AS $$
DECLARE
    v_branding_id UUID;
BEGIN
    INSERT INTO white_label_branding (
        workspace_id,
        company_name,
        support_email,
        footer_text
    ) VALUES (
        p_workspace_id,
        p_company_name,
        'support@' || LOWER(REPLACE(p_company_name, ' ', '')) || '.com',
        '© ' || EXTRACT(YEAR FROM CURRENT_DATE) || ' ' || p_company_name || '. All rights reserved.'
    ) RETURNING id INTO v_branding_id;
    
    RETURN v_branding_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create default email templates for a workspace
CREATE OR REPLACE FUNCTION create_default_email_templates(
    p_workspace_id UUID
) RETURNS VOID AS $$
BEGIN
    -- Welcome email template
    INSERT INTO white_label_email_templates (
        workspace_id,
        template_type,
        template_name,
        subject,
        html_content,
        text_content
    ) VALUES (
        p_workspace_id,
        'welcome',
        'Welcome Email',
        'Welcome to {{company_name}}!',
        '<html><body><h1>Welcome to {{company_name}}!</h1><p>Hi {{user_name}},</p><p>Welcome to your new account. We''re excited to have you on board!</p><p><a href="{{action_url}}" style="background-color: {{primary_color}}; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Get Started</a></p><p>If you have any questions, please contact us at {{support_email}}.</p><p>Best regards,<br>The {{company_name}} Team</p></body></html>',
        'Welcome to {{company_name}}!\n\nHi {{user_name}},\n\nWelcome to your new account. We''re excited to have you on board!\n\nGet started: {{action_url}}\n\nIf you have any questions, please contact us at {{support_email}}.\n\nBest regards,\nThe {{company_name}} Team'
    );
    
    -- Password reset template
    INSERT INTO white_label_email_templates (
        workspace_id,
        template_type,
        template_name,
        subject,
        html_content,
        text_content
    ) VALUES (
        p_workspace_id,
        'password_reset',
        'Password Reset',
        'Reset Your Password - {{company_name}}',
        '<html><body><h1>Reset Your Password</h1><p>Hi {{user_name}},</p><p>You requested to reset your password. Click the button below to set a new password:</p><p><a href="{{action_url}}" style="background-color: {{primary_color}}; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a></p><p>This link will expire in 24 hours. If you didn''t request this reset, please ignore this email.</p><p>Best regards,<br>The {{company_name}} Team</p></body></html>',
        'Reset Your Password\n\nHi {{user_name}},\n\nYou requested to reset your password. Click the link below to set a new password:\n\n{{action_url}}\n\nThis link will expire in 24 hours. If you didn''t request this reset, please ignore this email.\n\nBest regards,\nThe {{company_name}} Team'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create default white-label settings
CREATE OR REPLACE FUNCTION create_default_settings(
    p_workspace_id UUID
) RETURNS UUID AS $$
DECLARE
    v_settings_id UUID;
BEGIN
    INSERT INTO white_label_settings (workspace_id)
    VALUES (p_workspace_id)
    RETURNING id INTO v_settings_id;
    
    RETURN v_settings_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ====================================
-- GRANT PERMISSIONS
-- ====================================

GRANT SELECT, INSERT, UPDATE ON white_label_domains TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON white_label_branding TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON white_label_email_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON white_label_client_portals TO authenticated;
GRANT SELECT, INSERT, UPDATE ON white_label_settings TO authenticated;

-- ====================================
-- COMMENTS FOR DOCUMENTATION
-- ====================================

COMMENT ON TABLE white_label_domains IS 'Manages custom domains and SSL certificates for white-label instances';
COMMENT ON TABLE white_label_branding IS 'Stores visual branding and company information for workspace customization';
COMMENT ON TABLE white_label_email_templates IS 'Customizable email templates with variable substitution support';
COMMENT ON TABLE white_label_client_portals IS 'Manages secure client portal access for leads and customers';
COMMENT ON TABLE white_label_settings IS 'Global white-label settings and feature flags per workspace';

COMMENT ON FUNCTION verify_domain_ownership(UUID, TEXT) IS 'Initiates domain ownership verification via DNS records';
COMMENT ON FUNCTION provision_ssl_certificate(UUID) IS 'Provisions SSL certificate for verified custom domains';
COMMENT ON FUNCTION generate_client_portal_access(UUID, UUID, TEXT, INTEGER) IS 'Creates secure client portal access tokens';
COMMENT ON FUNCTION validate_portal_access(TEXT, TEXT) IS 'Validates client portal access and returns permissions';
COMMENT ON FUNCTION render_email_template(UUID, TEXT, JSONB) IS 'Renders email templates with variable substitution';
COMMENT ON FUNCTION get_domain_config(TEXT) IS 'Retrieves complete domain configuration including branding and settings';