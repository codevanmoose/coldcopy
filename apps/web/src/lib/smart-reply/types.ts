// Smart Reply Types

export type MessageSentiment = 'positive' | 'negative' | 'neutral' | 'mixed';

export type MessageIntent = 
  | 'question'
  | 'complaint'
  | 'interest'
  | 'objection'
  | 'meeting_request'
  | 'pricing_inquiry'
  | 'feature_request'
  | 'support_request'
  | 'unsubscribe'
  | 'other';

export type SuggestionType = 
  | 'quick_reply'
  | 'detailed_response'
  | 'follow_up'
  | 'objection_handling'
  | 'meeting_proposal'
  | 'closing';

export type ReplyTone = 
  | 'professional'
  | 'friendly'
  | 'casual'
  | 'formal'
  | 'enthusiastic';

export type ConversationStage = 
  | 'initial_contact'
  | 'qualification'
  | 'discovery'
  | 'proposal'
  | 'negotiation'
  | 'closing'
  | 'closed_won'
  | 'closed_lost';

export type ReplyOutcome = 
  | 'meeting_scheduled'
  | 'positive_response'
  | 'requested_info'
  | 'objection_raised'
  | 'not_interested'
  | 'unsubscribed'
  | 'no_response';

export interface MessageAnalysis {
  id: string;
  workspace_id: string;
  message_id: string;
  message_type: 'email' | 'linkedin' | 'twitter';
  message_content: string;
  sender_name?: string;
  sender_email?: string;
  sentiment: MessageSentiment;
  sentiment_score: number;
  intent: MessageIntent;
  intent_confidence: number;
  topics: string[];
  entities: {
    people?: string[];
    companies?: string[];
    dates?: string[];
    locations?: string[];
    products?: string[];
  };
  conversation_summary?: string;
  previous_interactions: number;
  analysis_model: string;
  analysis_tokens_used: number;
  created_at: string;
  updated_at: string;
}

export interface ReplySuggestion {
  id: string;
  workspace_id: string;
  analysis_id: string;
  suggestion_type: SuggestionType;
  content: string;
  tone: ReplyTone;
  personalization_used: string[];
  relevance_score: number;
  personalization_score: number;
  was_selected: boolean;
  was_edited: boolean;
  final_content?: string;
  selected_at?: string;
  ai_model: string;
  ai_tokens_used: number;
  generation_time_ms: number;
  created_at: string;
}

export interface ReplyTemplate {
  id: string;
  workspace_id: string;
  category: string;
  intent?: MessageIntent;
  name: string;
  description?: string;
  template_content: string;
  variables: string[];
  times_used: number;
  success_rate?: number;
  last_used_at?: string;
  is_active: boolean;
  requires_approval: boolean;
  created_at: string;
  updated_at: string;
}

export interface ConversationContext {
  id: string;
  workspace_id: string;
  lead_id?: string;
  conversation_thread_id: string;
  channel: 'email' | 'linkedin' | 'twitter';
  message_count: number;
  last_message_at?: string;
  conversation_stage?: ConversationStage;
  pain_points: string[];
  objectives: string[];
  budget_mentioned: boolean;
  timeline_mentioned: boolean;
  decision_makers: string[];
  competitors_mentioned: string[];
  overall_sentiment?: MessageSentiment;
  sentiment_trend?: 'improving' | 'declining' | 'stable';
  summary?: string;
  next_steps?: string;
  created_at: string;
  updated_at: string;
}

export interface ReplyPerformance {
  id: string;
  workspace_id: string;
  suggestion_id?: string;
  sent_message_id: string;
  sent_message_type: 'email' | 'linkedin' | 'twitter';
  sent_content: string;
  got_response: boolean;
  response_time_hours?: number;
  response_sentiment?: MessageSentiment;
  outcome?: ReplyOutcome;
  led_to_opportunity: boolean;
  led_to_deal: boolean;
  deal_value?: number;
  created_at: string;
}

// Request/Response types for API
export interface AnalyzeMessageRequest {
  workspace_id: string;
  message_id: string;
  message_type: 'email' | 'linkedin' | 'twitter';
  message_content: string;
  sender_name?: string;
  sender_email?: string;
  conversation_thread_id?: string;
  include_suggestions?: boolean;
  suggestion_count?: number;
}

export interface GenerateSuggestionsRequest {
  workspace_id: string;
  analysis_id: string;
  suggestion_types?: SuggestionType[];
  tones?: ReplyTone[];
  max_suggestions?: number;
  use_templates?: boolean;
}

export interface SmartReplyResponse {
  analysis: MessageAnalysis;
  suggestions: ReplySuggestion[];
  context?: ConversationContext;
  recommended_suggestion_id?: string;
}