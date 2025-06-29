export type UserRole = 'super_admin' | 'workspace_admin' | 'workspace_member'

export interface User {
  id: string
  email: string
  name?: string
  avatar_url?: string
  role: UserRole
  workspace_id?: string
  created_at: string
  updated_at: string
}

export interface Workspace {
  id: string
  name: string
  domain?: string
  logo_url?: string
  primary_color?: string
  secondary_color?: string
  sender_name?: string
  sender_email?: string
  ai_provider?: 'openai' | 'anthropic'
  ai_model?: string
  ai_temperature?: number
  ai_tokens_balance: number
  ai_tokens_purchased: number
  ai_tokens_used: number
  created_at: string
  updated_at: string
}

export interface Lead {
  id: string
  workspace_id: string
  email: string
  first_name?: string
  last_name?: string
  name?: string
  company?: string
  title?: string
  industry?: string
  location?: string
  website?: string
  linkedin_url?: string
  twitter_url?: string
  phone?: string
  status: 'new' | 'contacted' | 'responded' | 'qualified' | 'converted' | 'lost'
  score?: number
  tags: string[]
  notes?: string
  last_contacted_at?: string
  created_at: string
  updated_at: string
}

export interface Campaign {
  id: string
  workspace_id: string
  name: string
  type: 'one_time' | 'sequence'
  status: 'draft' | 'active' | 'paused' | 'completed' | 'archived'
  from_name: string
  from_email: string
  subject: string
  body_html: string
  body_text: string
  sequence_steps?: any[]
  schedule_config?: any
  lead_filters?: any
  total_recipients: number
  emails_sent: number
  emails_opened: number
  emails_clicked: number
  emails_replied: number
  scheduled_at?: string
  started_at?: string
  completed_at?: string
  created_at: string
  updated_at: string
}

export interface EmailEvent {
  id: string
  workspace_id: string
  campaign_id?: string
  lead_id?: string
  email_id: string
  event_type: 'sent' | 'delivered' | 'opened' | 'clicked' | 'replied' | 'bounced' | 'complained' | 'unsubscribed'
  metadata?: any
  created_at: string
}

export interface WorkspaceMember {
  id: string
  workspace_id: string
  user_id: string
  role: 'workspace_admin' | 'workspace_member'
  created_at: string
  updated_at: string
}