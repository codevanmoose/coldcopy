// Sentiment Analysis Types

export type SentimentLevel = 
  | 'very_positive'
  | 'positive'
  | 'neutral'
  | 'negative'
  | 'very_negative';

export type SentimentTrend = 
  | 'improving'
  | 'stable'
  | 'declining'
  | 'volatile';

export type EngagementLevel = 
  | 'high'
  | 'medium'
  | 'low'
  | 'declining';

export type RiskLevel = 
  | 'none'
  | 'low'
  | 'medium'
  | 'high'
  | 'critical';

export type AlertType = 
  | 'negative_sentiment'
  | 'sentiment_decline'
  | 'high_risk'
  | 'churn_risk'
  | 'escalation_needed'
  | 'opportunity_detected'
  | 'positive_momentum'
  | 'engagement_drop';

export type AlertSeverity = 'info' | 'warning' | 'critical';
export type AlertStatus = 'active' | 'acknowledged' | 'resolved' | 'ignored';
export type ResponseTimeTrend = 'faster' | 'stable' | 'slower';
export type UrgencyLevel = 'none' | 'low' | 'medium' | 'high' | 'critical';

export interface ConversationThread {
  id: string;
  workspace_id: string;
  lead_id?: string;
  thread_key: string;
  channel: 'email' | 'linkedin' | 'twitter' | 'multi';
  subject?: string;
  participants: Array<{
    email: string;
    name?: string;
    role?: string;
  }>;
  primary_contact_email?: string;
  primary_contact_name?: string;
  message_count: number;
  first_message_at?: string;
  last_message_at?: string;
  last_analyzed_at?: string;
  overall_sentiment?: SentimentLevel;
  sentiment_score?: number;
  sentiment_confidence?: number;
  sentiment_trend?: SentimentTrend;
  sentiment_history: Array<{
    timestamp: string;
    score: number;
    sentiment: SentimentLevel;
  }>;
  response_time_avg_hours?: number;
  response_time_trend?: ResponseTimeTrend;
  engagement_level?: EngagementLevel;
  turning_points: Array<{
    message_id: string;
    timestamp: string;
    from_sentiment?: SentimentLevel;
    to_sentiment: SentimentLevel;
    change: number;
  }>;
  positive_peaks: Array<{
    message_id: string;
    timestamp: string;
    score: number;
  }>;
  negative_valleys: Array<{
    message_id: string;
    timestamp: string;
    score: number;
  }>;
  risk_level?: RiskLevel;
  risk_factors: string[];
  churn_probability?: number;
  opportunity_score?: number;
  buying_signals: string[];
  next_best_action?: string;
  is_active: boolean;
  archived_at?: string;
  created_at: string;
  updated_at: string;
}

export interface MessageSentiment {
  id: string;
  workspace_id: string;
  thread_id: string;
  message_id: string;
  message_type: 'email' | 'linkedin' | 'twitter';
  sender_email?: string;
  sender_name?: string;
  is_from_lead: boolean;
  message_content: string;
  message_timestamp: string;
  sentiment: SentimentLevel;
  sentiment_score: number;
  confidence: number;
  emotions: {
    joy?: number;
    anger?: number;
    fear?: number;
    sadness?: number;
    surprise?: number;
    disgust?: number;
  };
  dominant_emotion?: string;
  tone: {
    professional?: number;
    casual?: number;
    formal?: number;
    friendly?: number;
    assertive?: number;
  };
  politeness_score?: number;
  urgency_level?: UrgencyLevel;
  key_phrases: string[];
  topics: string[];
  entities: {
    people?: string[];
    companies?: string[];
    locations?: string[];
    dates?: string[];
    money?: string[];
  };
  detected_intents: string[];
  buying_signals: string[];
  risk_signals: string[];
  messages_before: number;
  sentiment_change_from_previous?: number;
  is_turning_point: boolean;
  analyzed_by: string;
  analysis_version: string;
  tokens_used: number;
  created_at: string;
}

export interface SentimentAlert {
  id: string;
  workspace_id: string;
  thread_id: string;
  alert_type: AlertType;
  severity: AlertSeverity;
  title: string;
  description: string;
  recommended_action?: string;
  triggered_by?: string;
  trigger_value?: number;
  threshold_value?: number;
  status: AlertStatus;
  acknowledged_by?: string;
  acknowledged_at?: string;
  resolved_at?: string;
  resolution_notes?: string;
  auto_action_taken: boolean;
  auto_action_details?: any;
  created_at: string;
  updated_at: string;
}

export interface SentimentRule {
  id: string;
  workspace_id: string;
  name: string;
  description?: string;
  rule_type: 'threshold' | 'pattern' | 'keyword' | 'trend';
  conditions: {
    sentiment_threshold?: number;
    trend_duration_hours?: number;
    keywords?: string[];
    patterns?: string[];
    risk_level?: RiskLevel;
  };
  alert_enabled: boolean;
  alert_severity: AlertSeverity;
  notification_channels: string[];
  auto_response_enabled: boolean;
  auto_response_template?: string;
  auto_assign_to?: string;
  is_active: boolean;
  cooldown_hours: number;
  created_at: string;
  updated_at: string;
}

export interface SentimentBenchmark {
  id: string;
  industry?: string;
  conversation_stage?: string;
  channel?: string;
  avg_sentiment_score: number;
  positive_threshold: number;
  negative_threshold: number;
  avg_response_time_hours: number;
  fast_response_threshold_hours: number;
  slow_response_threshold_hours: number;
  avg_message_count: number;
  high_engagement_threshold: number;
  low_engagement_threshold: number;
  avg_positive_conversion_rate: number;
  avg_sentiment_at_conversion: number;
  updated_at: string;
}

// Request/Response types
export interface AnalyzeConversationRequest {
  workspace_id: string;
  thread_key: string;
  channel: 'email' | 'linkedin' | 'twitter';
  messages: Array<{
    id: string;
    content: string;
    sender_email?: string;
    sender_name?: string;
    is_from_lead: boolean;
    timestamp: string;
  }>;
  lead_id?: string;
  subject?: string;
}

export interface SentimentAnalysisResponse {
  thread: ConversationThread;
  messages: MessageSentiment[];
  alerts: SentimentAlert[];
  recommendations: {
    next_best_action?: string;
    suggested_response_tone?: string;
    risk_mitigation?: string;
    opportunity_actions?: string[];
  };
}

export interface SentimentDashboardData {
  overall_metrics: {
    total_threads: number;
    avg_sentiment_score: number;
    positive_percentage: number;
    negative_percentage: number;
    at_risk_count: number;
  };
  trend_data: Array<{
    date: string;
    positive: number;
    neutral: number;
    negative: number;
    avg_score: number;
  }>;
  risk_distribution: Array<{
    level: RiskLevel;
    count: number;
  }>;
  top_issues: Array<{
    thread_id: string;
    lead_name: string;
    issue: string;
    severity: AlertSeverity;
  }>;
}