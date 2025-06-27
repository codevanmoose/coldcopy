// LinkedIn Integration Types

export interface LinkedInIntegration {
  id: string;
  workspace_id: string;
  access_token: string;
  refresh_token?: string;
  expires_at: string;
  linkedin_user_id: string;
  profile_url?: string;
  full_name?: string;
  email?: string;
  is_active: boolean;
  sync_enabled: boolean;
  daily_connection_limit: number;
  daily_message_limit: number;
  scopes: string[];
  created_at: string;
  updated_at: string;
  last_sync_at?: string;
}

export interface LinkedInProfile {
  id: string;
  workspace_id: string;
  lead_id?: string;
  linkedin_user_id: string;
  profile_url: string;
  public_identifier?: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  headline?: string;
  summary?: string;
  location_name?: string;
  location_country?: string;
  industry?: string;
  current_company?: string;
  current_title?: string;
  current_company_linkedin_url?: string;
  connection_degree?: number;
  is_connected: boolean;
  connected_at?: string;
  last_message_sent_at?: string;
  last_message_received_at?: string;
  connection_request_sent_at?: string;
  profile_data?: any;
  last_enriched_at?: string;
  created_at: string;
  updated_at: string;
}

export interface LinkedInMessage {
  id: string;
  workspace_id: string;
  campaign_id?: string;
  lead_id: string;
  profile_id: string;
  message_type: 'connection_request' | 'inmail' | 'message';
  subject?: string;
  content: string;
  linkedin_message_id?: string;
  linkedin_conversation_id?: string;
  status: 'draft' | 'scheduled' | 'sent' | 'delivered' | 'read' | 'replied' | 'failed';
  sent_at?: string;
  delivered_at?: string;
  read_at?: string;
  replied_at?: string;
  error_message?: string;
  retry_count: number;
  ai_generated: boolean;
  ai_model?: string;
  ai_tokens_used?: number;
  created_at: string;
  updated_at: string;
}

export interface LinkedInSyncJob {
  id: string;
  workspace_id: string;
  job_type: 'profile_sync' | 'message_sync' | 'connection_sync';
  status: 'pending' | 'running' | 'completed' | 'failed';
  total_items: number;
  processed_items: number;
  successful_items: number;
  failed_items: number;
  config?: any;
  errors?: any[];
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface LinkedInWebhookEvent {
  id: string;
  workspace_id: string;
  event_type: string;
  event_id: string;
  payload: any;
  processed: boolean;
  processed_at?: string;
  error_message?: string;
  created_at: string;
}

// API Types
export interface LinkedInConnectionSettings {
  dailyConnectionLimit: number;
  dailyMessageLimit: number;
  connectionRequestTemplate?: string;
  autoAcceptConnections: boolean;
  syncEnabled: boolean;
}

export interface LinkedInCampaignSettings {
  messageType: 'connection_request' | 'inmail' | 'message';
  connectionRequestNote?: string;
  followUpSequence?: LinkedInFollowUp[];
  targetAudience?: LinkedInTargetAudience;
  schedulingOptions?: LinkedInSchedulingOptions;
}

export interface LinkedInFollowUp {
  delayDays: number;
  condition: 'no_reply' | 'no_connection' | 'opened_not_replied';
  messageTemplate: string;
}

export interface LinkedInTargetAudience {
  industries?: string[];
  jobTitles?: string[];
  companySize?: string[];
  locations?: string[];
  connectionDegree?: number[];
  keywords?: string[];
}

export interface LinkedInSchedulingOptions {
  timezone: string;
  sendDays: number[]; // 0-6 (Sunday-Saturday)
  sendStartHour: number; // 0-23
  sendEndHour: number; // 0-23
  messagesPerDay: number;
  connectionsPerDay: number;
}

export interface LinkedInEngagementMetrics {
  connectionRequestsSent: number;
  connectionRequestsAccepted: number;
  messagesSent: number;
  messagesDelivered: number;
  messagesRead: number;
  messagesReplied: number;
  profileViews: number;
  clickThroughRate: number;
  responseRate: number;
  connectionAcceptanceRate: number;
}

export interface LinkedInSearchFilters {
  keywords?: string;
  firstName?: string;
  lastName?: string;
  title?: string;
  company?: string;
  school?: string;
  industry?: string[];
  location?: string[];
  currentCompany?: boolean;
  connectionDegree?: number[];
  profileLanguage?: string[];
}

export interface LinkedInBulkAction {
  action: 'send_connection' | 'send_message' | 'enrich_profile' | 'sync_profile';
  profileIds: string[];
  template?: string;
  customFields?: Record<string, any>;
}

// Response types
export interface LinkedInApiResponse<T> {
  data: T;
  success: boolean;
  error?: string;
  message?: string;
}

export interface LinkedInPaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

export interface LinkedInRateLimitInfo {
  endpoint: string;
  limit: number;
  remaining: number;
  resetAt: string;
}

// Webhook types
export interface LinkedInWebhookPayload {
  eventType: 'message_received' | 'connection_accepted' | 'profile_viewed' | 'message_read';
  timestamp: string;
  data: {
    profileId?: string;
    messageId?: string;
    conversationId?: string;
    content?: string;
    metadata?: Record<string, any>;
  };
}