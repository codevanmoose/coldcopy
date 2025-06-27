// Sales Intelligence Types

export type SignalType = 
  | 'website_visit'
  | 'content_download'
  | 'competitor_research'
  | 'funding_announced'
  | 'leadership_change'
  | 'tech_stack_change'
  | 'hiring_surge'
  | 'expansion_news'
  | 'partnership_announcement'
  | 'product_launch'
  | 'social_engagement'
  | 'search_intent';

export type ProviderType =
  | 'website_tracking'
  | 'intent_data'
  | 'news_monitoring'
  | 'funding_data'
  | 'technographics'
  | 'social_signals';

export type RecommendedAction = 
  | 'reach_out_now'
  | 'nurture'
  | 'monitor'
  | 'disqualify';

export type RecommendedChannel = 
  | 'email'
  | 'linkedin'
  | 'phone'
  | 'multi_channel';

export type ScoreTrend = 'rising' | 'stable' | 'falling';

export interface IntentSignal {
  id: string;
  workspace_id: string;
  lead_id?: string;
  company_domain?: string;
  signal_type: SignalType;
  signal_source: string;
  signal_strength: number;
  title?: string;
  description?: string;
  url?: string;
  metadata?: Record<string, any>;
  signal_date: string;
  detected_at: string;
  expires_at?: string;
  processed: boolean;
  processed_at?: string;
  campaign_triggered: boolean;
  created_at: string;
}

export interface IntentScore {
  id: string;
  workspace_id: string;
  lead_id: string;
  overall_score: number;
  engagement_score: number;
  fit_score: number;
  timing_score: number;
  signal_count: number;
  recent_signal_count: number;
  strongest_signal_type?: string;
  strongest_signal_strength?: number;
  score_trend?: ScoreTrend;
  previous_score?: number;
  score_change?: number;
  recommended_action: RecommendedAction;
  recommended_channel: RecommendedChannel;
  recommended_message_type?: string;
  calculated_at: string;
  updated_at: string;
}

export interface WebsiteVisitor {
  id: string;
  workspace_id: string;
  visitor_id: string;
  ip_address?: string;
  company_domain?: string;
  company_name?: string;
  lead_id?: string;
  page_url: string;
  page_title?: string;
  referrer_url?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  time_on_page?: number;
  scroll_depth?: number;
  clicks?: any[];
  user_agent?: string;
  device_type?: string;
  browser?: string;
  country?: string;
  region?: string;
  city?: string;
  session_id: string;
  is_new_visitor: boolean;
  visited_at: string;
}

export interface CompanyTechStack {
  id: string;
  workspace_id: string;
  company_domain: string;
  technology_name: string;
  category: string;
  subcategory?: string;
  detected_via?: string;
  confidence_score?: number;
  is_active: boolean;
  first_detected: string;
  last_verified: string;
  removed_at?: string;
  is_new: boolean;
  is_removed: boolean;
  created_at: string;
  updated_at: string;
}

export interface CompanyEvent {
  id: string;
  workspace_id: string;
  company_domain: string;
  event_type: 
    | 'funding_round'
    | 'acquisition'
    | 'ipo'
    | 'leadership_change'
    | 'product_launch'
    | 'partnership'
    | 'expansion'
    | 'award'
    | 'earnings_report'
    | 'layoffs'
    | 'other';
  title: string;
  description?: string;
  url?: string;
  source: string;
  event_date: string;
  amount?: number;
  metadata?: Record<string, any>;
  relevance_score: number;
  created_at: string;
}

export interface IntentTrigger {
  id: string;
  workspace_id: string;
  name: string;
  description?: string;
  is_active: boolean;
  conditions: TriggerCondition[];
  campaign_id?: string;
  assign_to_user_id?: string;
  add_tags?: string[];
  send_notification: boolean;
  max_triggers_per_day: number;
  triggers_today: number;
  last_reset_at: string;
  created_at: string;
  updated_at: string;
}

export interface TriggerCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'in' | 'not_in' | 'contains';
  value: any;
}

export interface IntentProvider {
  id: string;
  name: string;
  provider_type: ProviderType;
  api_endpoint?: string;
  is_active: boolean;
  config?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// API Request/Response Types
export interface SignalDetectionRequest {
  workspace_id: string;
  lead_ids?: string[];
  company_domains?: string[];
  providers?: string[];
  lookback_days?: number;
}

export interface BuyingSignalAlert {
  lead_id: string;
  lead_name: string;
  company_name?: string;
  signal_type: SignalType;
  signal_strength: number;
  title: string;
  description: string;
  recommended_action: RecommendedAction;
  recommended_message?: string;
  detected_at: string;
}

export interface IntentDashboardMetrics {
  hot_leads: number;
  total_signals_today: number;
  average_intent_score: number;
  top_signal_types: Array<{
    type: SignalType;
    count: number;
    average_strength: number;
  }>;
  score_distribution: Array<{
    range: string;
    count: number;
  }>;
  trending_companies: Array<{
    domain: string;
    name: string;
    score: number;
    trend: ScoreTrend;
    recent_signals: number;
  }>;
}

export interface WebsiteTrackingConfig {
  tracking_id: string;
  domain: string;
  track_anonymous: boolean;
  track_identified: boolean;
  capture_utm: boolean;
  capture_referrer: boolean;
  capture_page_views: boolean;
  capture_clicks: boolean;
  capture_forms: boolean;
}

export interface IntentCampaignConfig {
  trigger_id: string;
  campaign_template_id: string;
  personalization_fields: string[];
  delay_minutes?: number;
  skip_weekends?: boolean;
  max_sends_per_day?: number;
}