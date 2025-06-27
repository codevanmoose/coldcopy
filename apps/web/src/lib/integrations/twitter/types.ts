// Twitter/X Integration Types

export interface TwitterIntegration {
  id: string;
  workspace_id: string;
  access_token: string;
  access_token_secret: string;
  twitter_user_id: string;
  username: string;
  display_name?: string;
  profile_image_url?: string;
  verified: boolean;
  followers_count: number;
  is_active: boolean;
  daily_dm_limit: number;
  daily_tweet_limit: number;
  daily_follow_limit: number;
  auto_follow_back: boolean;
  created_at: string;
  updated_at: string;
  last_sync_at?: string;
}

export interface TwitterProfile {
  id: string;
  workspace_id: string;
  lead_id?: string;
  twitter_user_id: string;
  username: string;
  display_name?: string;
  bio?: string;
  location?: string;
  website?: string;
  profile_image_url?: string;
  banner_url?: string;
  followers_count: number;
  following_count: number;
  tweet_count: number;
  listed_count: number;
  verified: boolean;
  is_following: boolean;
  follows_us: boolean;
  dm_conversation_id?: string;
  last_dm_sent_at?: string;
  last_dm_received_at?: string;
  last_tweet_at?: string;
  profile_data?: any;
  topics?: string[];
  last_enriched_at?: string;
  created_at: string;
  updated_at: string;
}

export interface TwitterMessage {
  id: string;
  workspace_id: string;
  campaign_id?: string;
  lead_id: string;
  profile_id: string;
  message_type: 'dm' | 'tweet' | 'reply' | 'quote';
  content: string;
  twitter_message_id?: string;
  twitter_conversation_id?: string;
  in_reply_to_id?: string;
  status: 'draft' | 'scheduled' | 'sent' | 'delivered' | 'read' | 'failed';
  sent_at?: string;
  delivered_at?: string;
  read_at?: string;
  error_message?: string;
  retry_count: number;
  ai_generated: boolean;
  ai_model?: string;
  ai_tokens_used?: number;
  created_at: string;
  updated_at: string;
}

export interface TwitterEngagement {
  id: string;
  workspace_id: string;
  profile_id?: string;
  engagement_type: 'follow' | 'unfollow' | 'like' | 'retweet' | 'reply' | 'quote' | 'dm_open' | 'profile_view' | 'link_click';
  tweet_id?: string;
  tweet_url?: string;
  content?: string;
  metadata?: any;
  engaged_at: string;
}

export interface TwitterSearch {
  id: string;
  workspace_id: string;
  name: string;
  search_query: string;
  is_active: boolean;
  filters?: {
    min_followers?: number;
    max_followers?: number;
    verified_only?: boolean;
    has_bio?: boolean;
    location?: string;
    language?: string;
  };
  auto_follow: boolean;
  auto_like: boolean;
  auto_dm: boolean;
  dm_template?: string;
  daily_action_limit: number;
  actions_today: number;
  last_reset_at: string;
  total_results_found: number;
  total_actions_taken: number;
  created_at: string;
  updated_at: string;
}

export interface TwitterAnalytics {
  id: string;
  workspace_id: string;
  analysis_date: string;
  total_dms_sent: number;
  total_dms_delivered: number;
  total_dms_read: number;
  total_replies_received: number;
  new_followers: number;
  lost_followers: number;
  net_follower_growth: number;
  tweets_sent: number;
  likes_given: number;
  retweets_made: number;
  dm_open_rate: number;
  dm_response_rate: number;
  follower_conversion_rate: number;
  created_at: string;
}

// API Types
export interface TwitterAuthConfig {
  consumer_key: string;
  consumer_secret: string;
  access_token: string;
  access_token_secret: string;
}

export interface TwitterApiUser {
  id_str: string;
  screen_name: string;
  name: string;
  description?: string;
  location?: string;
  url?: string;
  profile_image_url_https?: string;
  profile_banner_url?: string;
  followers_count: number;
  friends_count: number;
  statuses_count: number;
  listed_count: number;
  verified: boolean;
  created_at: string;
}

export interface TwitterApiTweet {
  id_str: string;
  text: string;
  user: TwitterApiUser;
  created_at: string;
  retweet_count: number;
  favorite_count: number;
  reply_count?: number;
  quote_count?: number;
  in_reply_to_status_id_str?: string;
  in_reply_to_user_id_str?: string;
  entities?: {
    urls?: Array<{ url: string; expanded_url: string }>;
    hashtags?: Array<{ text: string }>;
    user_mentions?: Array<{ screen_name: string; id_str: string }>;
  };
}

export interface TwitterApiDM {
  id: string;
  created_timestamp: string;
  message_create: {
    target: { recipient_id: string };
    message_data: {
      text: string;
      entities?: any;
    };
  };
}

export interface TwitterSearchFilters {
  keywords?: string[];
  hashtags?: string[];
  from_user?: string;
  to_user?: string;
  min_retweets?: number;
  min_likes?: number;
  has_media?: boolean;
  has_links?: boolean;
  is_reply?: boolean;
  language?: string;
  since?: string;
  until?: string;
}

export interface TwitterCampaignConfig {
  message_templates: string[];
  follow_before_dm: boolean;
  wait_time_minutes?: number;
  personalization_fields?: string[];
  exclude_verified?: boolean;
  exclude_protected?: boolean;
  min_follower_count?: number;
  max_follower_count?: number;
}

export interface TwitterRateLimits {
  dm_per_day: number;
  dm_per_hour: number;
  tweets_per_day: number;
  follows_per_day: number;
  follows_per_hour: number;
  likes_per_hour: number;
  searches_per_15min: number;
}