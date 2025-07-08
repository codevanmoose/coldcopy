-- Create campaigns table
CREATE TABLE IF NOT EXISTS public.campaigns (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL DEFAULT 'sequence' CHECK (type IN ('sequence', 'one-off', 'drip')),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed', 'archived')),
    timezone TEXT NOT NULL DEFAULT 'UTC',
    schedule_settings JSONB DEFAULT '{}',
    daily_limit INTEGER DEFAULT 50,
    total_leads INTEGER DEFAULT 0,
    sent_count INTEGER DEFAULT 0,
    open_count INTEGER DEFAULT 0,
    click_count INTEGER DEFAULT 0,
    reply_count INTEGER DEFAULT 0,
    bounce_count INTEGER DEFAULT 0,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

-- Create campaign_emails table (for email sequences)
CREATE TABLE IF NOT EXISTS public.campaign_emails (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
    sequence_number INTEGER NOT NULL,
    name TEXT,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    delay_days INTEGER DEFAULT 0,
    delay_hours INTEGER DEFAULT 0,
    condition_type TEXT DEFAULT 'always' CHECK (condition_type IN ('always', 'no_reply', 'no_open', 'opened', 'clicked')),
    condition_value TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(campaign_id, sequence_number)
);

-- Create campaign_leads table (junction table for campaigns and leads)
CREATE TABLE IF NOT EXISTS public.campaign_leads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'unsubscribed', 'bounced')),
    current_sequence INTEGER DEFAULT 0,
    next_email_at TIMESTAMPTZ,
    last_email_at TIMESTAMPTZ,
    email_count INTEGER DEFAULT 0,
    open_count INTEGER DEFAULT 0,
    click_count INTEGER DEFAULT 0,
    replied BOOLEAN DEFAULT false,
    replied_at TIMESTAMPTZ,
    unsubscribed_at TIMESTAMPTZ,
    bounced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(campaign_id, lead_id)
);

-- Create campaign_events table
CREATE TABLE IF NOT EXISTS public.campaign_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
    campaign_lead_id UUID REFERENCES public.campaign_leads(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    email_id UUID,
    event_type TEXT NOT NULL CHECK (event_type IN ('sent', 'delivered', 'opened', 'clicked', 'replied', 'bounced', 'unsubscribed', 'complained')),
    event_data JSONB DEFAULT '{}',
    occurred_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_campaigns_workspace_id ON public.campaigns(workspace_id);
CREATE INDEX idx_campaigns_status ON public.campaigns(status);
CREATE INDEX idx_campaigns_created_at ON public.campaigns(created_at DESC);

CREATE INDEX idx_campaign_emails_campaign_id ON public.campaign_emails(campaign_id);
CREATE INDEX idx_campaign_emails_sequence ON public.campaign_emails(campaign_id, sequence_number);

CREATE INDEX idx_campaign_leads_campaign_id ON public.campaign_leads(campaign_id);
CREATE INDEX idx_campaign_leads_lead_id ON public.campaign_leads(lead_id);
CREATE INDEX idx_campaign_leads_status ON public.campaign_leads(status);
CREATE INDEX idx_campaign_leads_next_email ON public.campaign_leads(next_email_at);

CREATE INDEX idx_campaign_events_campaign_id ON public.campaign_events(campaign_id);
CREATE INDEX idx_campaign_events_lead_id ON public.campaign_events(lead_id);
CREATE INDEX idx_campaign_events_type ON public.campaign_events(event_type);
CREATE INDEX idx_campaign_events_occurred ON public.campaign_events(occurred_at DESC);

-- Enable RLS
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_events ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for campaigns
CREATE POLICY "Users can view campaigns in their workspace" ON public.campaigns
    FOR SELECT
    USING (
        workspace_id IN (
            SELECT workspace_id 
            FROM public.workspace_members 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create campaigns in their workspace" ON public.campaigns
    FOR INSERT
    WITH CHECK (
        workspace_id IN (
            SELECT workspace_id 
            FROM public.workspace_members 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update campaigns in their workspace" ON public.campaigns
    FOR UPDATE
    USING (
        workspace_id IN (
            SELECT workspace_id 
            FROM public.workspace_members 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can delete campaigns" ON public.campaigns
    FOR DELETE
    USING (
        workspace_id IN (
            SELECT workspace_id 
            FROM public.workspace_members 
            WHERE user_id = auth.uid()
            AND role IN ('super_admin', 'workspace_admin')
        )
    );

-- Create RLS policies for campaign_emails
CREATE POLICY "Users can view campaign emails" ON public.campaign_emails
    FOR SELECT
    USING (
        campaign_id IN (
            SELECT id FROM public.campaigns
            WHERE workspace_id IN (
                SELECT workspace_id 
                FROM public.workspace_members 
                WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can manage campaign emails" ON public.campaign_emails
    FOR ALL
    USING (
        campaign_id IN (
            SELECT id FROM public.campaigns
            WHERE workspace_id IN (
                SELECT workspace_id 
                FROM public.workspace_members 
                WHERE user_id = auth.uid()
            )
        )
    );

-- Create RLS policies for campaign_leads
CREATE POLICY "Users can view campaign leads" ON public.campaign_leads
    FOR SELECT
    USING (
        campaign_id IN (
            SELECT id FROM public.campaigns
            WHERE workspace_id IN (
                SELECT workspace_id 
                FROM public.workspace_members 
                WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can manage campaign leads" ON public.campaign_leads
    FOR ALL
    USING (
        campaign_id IN (
            SELECT id FROM public.campaigns
            WHERE workspace_id IN (
                SELECT workspace_id 
                FROM public.workspace_members 
                WHERE user_id = auth.uid()
            )
        )
    );

-- Create RLS policies for campaign_events
CREATE POLICY "Users can view campaign events" ON public.campaign_events
    FOR SELECT
    USING (
        campaign_id IN (
            SELECT id FROM public.campaigns
            WHERE workspace_id IN (
                SELECT workspace_id 
                FROM public.workspace_members 
                WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "System can create campaign events" ON public.campaign_events
    FOR INSERT
    WITH CHECK (true); -- Events are created by the system

-- Create updated_at triggers
CREATE TRIGGER update_campaigns_updated_at
    BEFORE UPDATE ON public.campaigns
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaign_emails_updated_at
    BEFORE UPDATE ON public.campaign_emails
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaign_leads_updated_at
    BEFORE UPDATE ON public.campaign_leads
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();