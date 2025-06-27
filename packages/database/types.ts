export type UserRole = 'super_admin' | 'workspace_admin' | 'campaign_manager' | 'outreach_specialist';
export type CampaignStatus = 'draft' | 'scheduled' | 'active' | 'paused' | 'completed';
export type EmailEventType = 'sent' | 'delivered' | 'opened' | 'clicked' | 'replied' | 'bounced' | 'unsubscribed';
export type LeadStatus = 'new' | 'contacted' | 'replied' | 'qualified' | 'unqualified' | 'unsubscribed';

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  domain?: string;
  settings: Record<string, any>;
  branding: {
    logo?: string;
    primaryColor?: string;
    favicon?: string;
    customCss?: string;
  };
  ai_tokens_balance: number;
  ai_tokens_purchased: number;
  ai_tokens_used: number;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  workspace_id: string;
  email: string;
  full_name?: string;
  role: UserRole;
  avatar_url?: string;
  settings: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface Campaign {
  id: string;
  workspace_id: string;
  created_by: string;
  name: string;
  status: CampaignStatus;
  settings: {
    daily_limit?: number;
    timezone?: string;
    reply_detection?: boolean;
    track_opens?: boolean;
    track_clicks?: boolean;
  };
  sequence_steps: SequenceStep[];
  scheduling: {
    start_date?: string;
    end_date?: string;
    send_days?: number[];
    send_hours?: { start: number; end: number };
  };
  created_at: string;
  updated_at: string;
  scheduled_at?: string;
  completed_at?: string;
}

export interface SequenceStep {
  id: string;
  type: 'initial' | 'follow_up';
  delay_days: number;
  subject: string;
  body_text: string;
  body_html?: string;
  variables: string[];
}

export interface Lead {
  id: string;
  workspace_id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  company?: string;
  title?: string;
  industry?: string;
  status: LeadStatus;
  enrichment_data: {
    company_size?: number;
    industry?: string;
    technologies?: string[];
    social_profiles?: Record<string, string>;
    website?: string;
    phone?: string;
    location?: {
      city?: string;
      state?: string;
      country?: string;
    };
  };
  custom_fields: Record<string, any>;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface CampaignLead {
  id: string;
  campaign_id: string;
  lead_id: string;
  status: string;
  current_step: number;
  scheduled_at?: string;
  last_contacted_at?: string;
  created_at: string;
}

export interface EmailEvent {
  id: string;
  workspace_id: string;
  campaign_id: string;
  lead_id: string;
  campaign_lead_id?: string;
  event_type: EmailEventType;
  email_id?: string;
  metadata: Record<string, any>;
  created_at: string;
}

export interface EmailThread {
  id: string;
  workspace_id: string;
  campaign_id: string;
  lead_id: string;
  subject: string;
  status: string;
  assigned_to?: string;
  locked_by?: string;
  locked_at?: string;
  created_at: string;
  updated_at: string;
}

export interface EmailMessage {
  id: string;
  thread_id: string;
  from_email: string;
  to_email: string;
  subject?: string;
  body_text?: string;
  body_html?: string;
  direction: 'inbound' | 'outbound';
  message_id?: string;
  in_reply_to?: string;
  created_at: string;
}

export interface AITokenUsage {
  id: string;
  workspace_id: string;
  user_id: string;
  model: string;
  tokens_used: number;
  cost_cents?: number;
  metadata: Record<string, any>;
  created_at: string;
}

export interface EmailTemplate {
  id: string;
  workspace_id: string;
  created_by: string;
  name: string;
  subject: string;
  body_text?: string;
  body_html?: string;
  variables: string[];
  is_shared: boolean;
  created_at: string;
  updated_at: string;
}

export interface LeadEngagementSummary {
  lead_id: string;
  workspace_id: string;
  email: string;
  lead_status: LeadStatus;
  campaigns_count: number;
  emails_sent: number;
  emails_opened: number;
  emails_clicked: number;
  emails_replied: number;
  last_activity_at?: string;
}