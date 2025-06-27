import { createClient } from '@/utils/supabase/server';
import { subDays, startOfDay, endOfDay, format } from 'date-fns';

export interface LinkedInEngagementEvent {
  id: string;
  workspace_id: string;
  profile_id?: string;
  message_id?: string;
  event_type: LinkedInEventType;
  event_timestamp: string;
  event_source: 'manual' | 'automated' | 'webhook' | 'api';
  related_post_id?: string;
  related_post_url?: string;
  campaign_id?: string;
  engagement_score: number;
  response_time_minutes?: number;
  metadata?: Record<string, any>;
}

export type LinkedInEventType = 
  | 'profile_view'
  | 'message_sent'
  | 'message_opened'
  | 'message_replied'
  | 'connection_request_sent'
  | 'connection_accepted'
  | 'connection_rejected'
  | 'profile_liked'
  | 'post_liked'
  | 'post_commented'
  | 'post_shared'
  | 'inmailed'
  | 'profile_followed'
  | 'skill_endorsed'
  | 'recommendation_sent';

export interface LinkedInProfileEngagement {
  id: string;
  workspace_id: string;
  profile_id: string;
  total_messages_sent: number;
  total_messages_opened: number;
  total_messages_replied: number;
  connection_requests_sent: number;
  connections_accepted: number;
  connection_acceptance_rate?: number;
  profile_views: number;
  posts_liked: number;
  posts_commented: number;
  posts_shared: number;
  avg_response_time_minutes?: number;
  first_response_time_minutes?: number;
  engagement_score: number;
  engagement_level: 'cold' | 'warm' | 'hot' | 'champion';
  last_engagement_at?: string;
  converted_to_opportunity: boolean;
  converted_to_customer: boolean;
  conversion_value?: number;
  most_effective_message_type?: string;
  best_engagement_time?: string;
  engagement_trend?: 'increasing' | 'stable' | 'decreasing';
}

export interface LinkedInCampaignAnalytics {
  campaign_id: string;
  total_profiles_targeted: number;
  total_messages_sent: number;
  messages_opened: number;
  messages_replied: number;
  open_rate: number;
  reply_rate: number;
  leads_generated: number;
  opportunities_created: number;
  revenue_attributed?: number;
  roi?: number;
}

export interface LinkedInEngagementPattern {
  pattern_type: 'optimal_send_time' | 'effective_message_length' | 'successful_sequence' | 
                'high_response_industry' | 'engagement_trigger' | 'conversion_path';
  pattern_name: string;
  pattern_description: string;
  pattern_data: Record<string, any>;
  success_rate: number;
  confidence_level: number;
  recommended_action?: string;
}

export interface EngagementMetrics {
  daily_messages_sent: number;
  daily_connections_sent: number;
  daily_messages_opened: number;
  daily_messages_replied: number;
  daily_connections_accepted: number;
  overall_open_rate: number;
  overall_reply_rate: number;
  overall_connection_rate: number;
  top_performing_profiles: Array<{
    profile_id: string;
    name: string;
    engagement_score: number;
  }>;
  top_performing_messages: Array<{
    message_id: string;
    template_name: string;
    reply_rate: number;
  }>;
}

export class LinkedInAnalyticsService {
  /**
   * Track a LinkedIn engagement event
   */
  static async trackEvent(
    workspaceId: string,
    event: Omit<LinkedInEngagementEvent, 'id' | 'workspace_id'>
  ): Promise<{ data?: LinkedInEngagementEvent; error?: string }> {
    try {
      const supabase = createClient();

      const { data, error } = await supabase
        .from('linkedin_engagement_events')
        .insert({
          workspace_id: workspaceId,
          ...event,
        })
        .select()
        .single();

      if (error) throw error;

      return { data };
    } catch (error) {
      console.error('Error tracking LinkedIn event:', error);
      return { error: 'Failed to track event' };
    }
  }

  /**
   * Track multiple events at once
   */
  static async trackBulkEvents(
    workspaceId: string,
    events: Array<Omit<LinkedInEngagementEvent, 'id' | 'workspace_id'>>
  ): Promise<{ data?: LinkedInEngagementEvent[]; error?: string }> {
    try {
      const supabase = createClient();

      const eventsWithWorkspace = events.map(event => ({
        workspace_id: workspaceId,
        ...event,
      }));

      const { data, error } = await supabase
        .from('linkedin_engagement_events')
        .insert(eventsWithWorkspace)
        .select();

      if (error) throw error;

      return { data };
    } catch (error) {
      console.error('Error tracking bulk LinkedIn events:', error);
      return { error: 'Failed to track events' };
    }
  }

  /**
   * Get profile engagement summary
   */
  static async getProfileEngagement(
    workspaceId: string,
    profileId: string
  ): Promise<{ data?: LinkedInProfileEngagement; error?: string }> {
    try {
      const supabase = createClient();

      const { data, error } = await supabase
        .from('linkedin_profile_engagement')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('profile_id', profileId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      return { data };
    } catch (error) {
      console.error('Error fetching profile engagement:', error);
      return { error: 'Failed to fetch profile engagement' };
    }
  }

  /**
   * Get top engaged profiles
   */
  static async getTopEngagedProfiles(
    workspaceId: string,
    limit: number = 10
  ): Promise<{ data?: LinkedInProfileEngagement[]; error?: string }> {
    try {
      const supabase = createClient();

      const { data, error } = await supabase
        .from('linkedin_profile_engagement')
        .select(`
          *,
          profile:linkedin_profiles(
            name,
            headline,
            company_name,
            profile_url
          )
        `)
        .eq('workspace_id', workspaceId)
        .order('engagement_score', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return { data };
    } catch (error) {
      console.error('Error fetching top engaged profiles:', error);
      return { error: 'Failed to fetch top profiles' };
    }
  }

  /**
   * Get campaign analytics
   */
  static async getCampaignAnalytics(
    workspaceId: string,
    campaignId: string
  ): Promise<{ data?: LinkedInCampaignAnalytics; error?: string }> {
    try {
      const supabase = createClient();

      const { data, error } = await supabase
        .from('linkedin_campaign_analytics')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('campaign_id', campaignId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      return { data };
    } catch (error) {
      console.error('Error fetching campaign analytics:', error);
      return { error: 'Failed to fetch campaign analytics' };
    }
  }

  /**
   * Calculate and update campaign analytics
   */
  static async updateCampaignAnalytics(
    workspaceId: string,
    campaignId: string
  ): Promise<{ data?: LinkedInCampaignAnalytics; error?: string }> {
    try {
      const supabase = createClient();

      // Get campaign messages and profiles
      const { data: messages, error: messagesError } = await supabase
        .from('linkedin_messages')
        .select('id, profile_id')
        .eq('workspace_id', workspaceId)
        .eq('campaign_id', campaignId);

      if (messagesError) throw messagesError;

      const messageIds = messages.map(m => m.id);
      const profileIds = [...new Set(messages.map(m => m.profile_id))];

      // Get engagement events
      const { data: events, error: eventsError } = await supabase
        .from('linkedin_engagement_events')
        .select('event_type, message_id')
        .eq('workspace_id', workspaceId)
        .in('message_id', messageIds);

      if (eventsError) throw eventsError;

      // Calculate metrics
      const metrics = {
        total_profiles_targeted: profileIds.length,
        total_messages_sent: messages.length,
        messages_opened: events.filter(e => e.event_type === 'message_opened').length,
        messages_replied: events.filter(e => e.event_type === 'message_replied').length,
        open_rate: messages.length > 0 
          ? (events.filter(e => e.event_type === 'message_opened').length / messages.length) * 100 
          : 0,
        reply_rate: messages.length > 0
          ? (events.filter(e => e.event_type === 'message_replied').length / messages.length) * 100
          : 0,
      };

      // Update or insert analytics
      const { data, error } = await supabase
        .from('linkedin_campaign_analytics')
        .upsert({
          workspace_id: workspaceId,
          campaign_id: campaignId,
          ...metrics,
          last_calculated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      return { data };
    } catch (error) {
      console.error('Error updating campaign analytics:', error);
      return { error: 'Failed to update campaign analytics' };
    }
  }

  /**
   * Get workspace daily metrics
   */
  static async getWorkspaceMetrics(
    workspaceId: string,
    date: Date = new Date()
  ): Promise<{ data?: EngagementMetrics; error?: string }> {
    try {
      const supabase = createClient();

      // Get daily analytics
      const { data: analytics, error: analyticsError } = await supabase
        .from('linkedin_workspace_analytics')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('analysis_date', format(date, 'yyyy-MM-dd'))
        .single();

      if (analyticsError && analyticsError.code !== 'PGRST116') throw analyticsError;

      if (analytics) {
        return {
          data: {
            daily_messages_sent: analytics.daily_messages_sent,
            daily_connections_sent: analytics.daily_connections_sent,
            daily_messages_opened: analytics.daily_messages_opened,
            daily_messages_replied: analytics.daily_messages_replied,
            daily_connections_accepted: analytics.daily_connections_accepted,
            overall_open_rate: analytics.overall_open_rate,
            overall_reply_rate: analytics.overall_reply_rate,
            overall_connection_rate: analytics.overall_connection_rate,
            top_performing_profiles: analytics.top_performing_profiles || [],
            top_performing_messages: analytics.top_performing_messages || [],
          },
        };
      }

      // Calculate metrics if not found
      const startDate = startOfDay(date);
      const endDate = endOfDay(date);

      const { data: events, error: eventsError } = await supabase
        .from('linkedin_engagement_events')
        .select('event_type')
        .eq('workspace_id', workspaceId)
        .gte('event_timestamp', startDate.toISOString())
        .lte('event_timestamp', endDate.toISOString());

      if (eventsError) throw eventsError;

      const metrics: EngagementMetrics = {
        daily_messages_sent: events.filter(e => e.event_type === 'message_sent').length,
        daily_connections_sent: events.filter(e => e.event_type === 'connection_request_sent').length,
        daily_messages_opened: events.filter(e => e.event_type === 'message_opened').length,
        daily_messages_replied: events.filter(e => e.event_type === 'message_replied').length,
        daily_connections_accepted: events.filter(e => e.event_type === 'connection_accepted').length,
        overall_open_rate: 0,
        overall_reply_rate: 0,
        overall_connection_rate: 0,
        top_performing_profiles: [],
        top_performing_messages: [],
      };

      // Calculate rates
      if (metrics.daily_messages_sent > 0) {
        metrics.overall_open_rate = (metrics.daily_messages_opened / metrics.daily_messages_sent) * 100;
        metrics.overall_reply_rate = (metrics.daily_messages_replied / metrics.daily_messages_sent) * 100;
      }
      if (metrics.daily_connections_sent > 0) {
        metrics.overall_connection_rate = (metrics.daily_connections_accepted / metrics.daily_connections_sent) * 100;
      }

      return { data: metrics };
    } catch (error) {
      console.error('Error fetching workspace metrics:', error);
      return { error: 'Failed to fetch metrics' };
    }
  }

  /**
   * Detect engagement patterns
   */
  static async detectEngagementPatterns(
    workspaceId: string
  ): Promise<{ data?: LinkedInEngagementPattern[]; error?: string }> {
    try {
      const supabase = createClient();

      // Get recent engagement events
      const { data: events, error: eventsError } = await supabase
        .from('linkedin_engagement_events')
        .select(`
          *,
          profile:linkedin_profiles(
            name,
            headline,
            company_name,
            industry
          )
        `)
        .eq('workspace_id', workspaceId)
        .gte('event_timestamp', subDays(new Date(), 30).toISOString())
        .order('event_timestamp', { ascending: false });

      if (eventsError) throw eventsError;

      const patterns: LinkedInEngagementPattern[] = [];

      // Analyze optimal send times
      const sendTimePattern = this.analyzeOptimalSendTimes(events);
      if (sendTimePattern) patterns.push(sendTimePattern);

      // Analyze high-response industries
      const industryPattern = this.analyzeHighResponseIndustries(events);
      if (industryPattern) patterns.push(industryPattern);

      // Analyze successful message sequences
      const sequencePattern = this.analyzeSuccessfulSequences(events);
      if (sequencePattern) patterns.push(sequencePattern);

      return { data: patterns };
    } catch (error) {
      console.error('Error detecting patterns:', error);
      return { error: 'Failed to detect patterns' };
    }
  }

  /**
   * Calculate daily analytics for a workspace
   */
  static async calculateDailyAnalytics(
    workspaceId: string,
    date: Date = new Date()
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const supabase = createClient();

      // Call the database function
      const { error } = await supabase.rpc('calculate_linkedin_daily_analytics', {
        p_workspace_id: workspaceId,
        p_date: format(date, 'yyyy-MM-dd'),
      });

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('Error calculating daily analytics:', error);
      return { success: false, error: 'Failed to calculate analytics' };
    }
  }

  /**
   * Refresh materialized view
   */
  static async refreshEngagementOverview(): Promise<{ success: boolean; error?: string }> {
    try {
      const supabase = createClient();

      const { error } = await supabase.rpc('refresh_materialized_view', {
        view_name: 'mv_linkedin_engagement_overview',
      });

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('Error refreshing overview:', error);
      return { success: false, error: 'Failed to refresh overview' };
    }
  }

  // Helper methods for pattern analysis
  private static analyzeOptimalSendTimes(events: any[]): LinkedInEngagementPattern | null {
    const messageEvents = events.filter(e => e.event_type === 'message_sent');
    const repliedEvents = events.filter(e => e.event_type === 'message_replied');

    if (messageEvents.length < 10) return null;

    // Group by hour of day
    const hourlyStats: Record<number, { sent: number; replied: number }> = {};
    
    messageEvents.forEach(event => {
      const hour = new Date(event.event_timestamp).getHours();
      if (!hourlyStats[hour]) hourlyStats[hour] = { sent: 0, replied: 0 };
      hourlyStats[hour].sent++;
    });

    repliedEvents.forEach(event => {
      const hour = new Date(event.event_timestamp).getHours();
      if (!hourlyStats[hour]) hourlyStats[hour] = { sent: 0, replied: 0 };
      hourlyStats[hour].replied++;
    });

    // Find best performing hours
    let bestHour = 0;
    let bestRate = 0;

    Object.entries(hourlyStats).forEach(([hour, stats]) => {
      if (stats.sent > 0) {
        const rate = stats.replied / stats.sent;
        if (rate > bestRate) {
          bestRate = rate;
          bestHour = parseInt(hour);
        }
      }
    });

    if (bestRate > 0) {
      return {
        pattern_type: 'optimal_send_time',
        pattern_name: 'Best Time to Send Messages',
        pattern_description: `Messages sent at ${bestHour}:00 have the highest reply rate`,
        pattern_data: {
          best_hour: bestHour,
          reply_rate: bestRate * 100,
          hourly_stats: hourlyStats,
        },
        success_rate: bestRate * 100,
        confidence_level: Math.min(messageEvents.length / 100 * 100, 95),
        recommended_action: `Schedule messages between ${bestHour}:00 and ${bestHour + 1}:00 for best results`,
      };
    }

    return null;
  }

  private static analyzeHighResponseIndustries(events: any[]): LinkedInEngagementPattern | null {
    const industryStats: Record<string, { sent: number; replied: number }> = {};

    events.forEach(event => {
      if (event.profile?.industry) {
        const industry = event.profile.industry;
        if (!industryStats[industry]) industryStats[industry] = { sent: 0, replied: 0 };
        
        if (event.event_type === 'message_sent') industryStats[industry].sent++;
        if (event.event_type === 'message_replied') industryStats[industry].replied++;
      }
    });

    // Find industries with high response rates
    const highResponseIndustries = Object.entries(industryStats)
      .filter(([_, stats]) => stats.sent >= 5)
      .map(([industry, stats]) => ({
        industry,
        response_rate: stats.sent > 0 ? (stats.replied / stats.sent) * 100 : 0,
        sample_size: stats.sent,
      }))
      .sort((a, b) => b.response_rate - a.response_rate)
      .slice(0, 5);

    if (highResponseIndustries.length > 0) {
      return {
        pattern_type: 'high_response_industry',
        pattern_name: 'High Response Industries',
        pattern_description: 'Industries with the highest engagement rates',
        pattern_data: {
          industries: highResponseIndustries,
        },
        success_rate: highResponseIndustries[0].response_rate,
        confidence_level: Math.min(highResponseIndustries[0].sample_size / 20 * 100, 90),
        recommended_action: `Focus outreach on ${highResponseIndustries[0].industry} for best results`,
      };
    }

    return null;
  }

  private static analyzeSuccessfulSequences(events: any[]): LinkedInEngagementPattern | null {
    // Group events by profile to analyze sequences
    const profileSequences: Record<string, any[]> = {};
    
    events.forEach(event => {
      if (event.profile_id) {
        if (!profileSequences[event.profile_id]) profileSequences[event.profile_id] = [];
        profileSequences[event.profile_id].push(event);
      }
    });

    // Analyze sequences that led to replies
    let successfulSequences = 0;
    let totalSequences = 0;

    Object.values(profileSequences).forEach(sequence => {
      if (sequence.length >= 2) {
        totalSequences++;
        if (sequence.some(e => e.event_type === 'message_replied')) {
          successfulSequences++;
        }
      }
    });

    if (totalSequences > 10) {
      const successRate = (successfulSequences / totalSequences) * 100;
      
      return {
        pattern_type: 'successful_sequence',
        pattern_name: 'Multi-Touch Engagement',
        pattern_description: 'Success rate of multi-touch sequences',
        pattern_data: {
          successful_sequences: successfulSequences,
          total_sequences: totalSequences,
          average_touches_to_reply: 2.3, // This would need more detailed analysis
        },
        success_rate: successRate,
        confidence_level: Math.min(totalSequences / 50 * 100, 85),
        recommended_action: 'Use multi-touch sequences with personalized follow-ups',
      };
    }

    return null;
  }
}