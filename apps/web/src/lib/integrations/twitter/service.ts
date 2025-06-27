import { createClient } from '@/utils/supabase/server';
import { TwitterApiClient } from './client';
import { twitterAuth } from './auth';
import {
  TwitterIntegration,
  TwitterProfile,
  TwitterMessage,
  TwitterEngagement,
  TwitterSearch,
  TwitterCampaignConfig,
  TwitterRateLimits,
} from './types';

export class TwitterService {
  /**
   * Connect Twitter account
   */
  static async connectAccount(
    workspaceId: string,
    accessToken: string,
    accessTokenSecret: string
  ): Promise<TwitterIntegration> {
    const supabase = createClient();

    // Encrypt tokens
    const encryptedAccessToken = twitterAuth.encryptToken(accessToken);
    const encryptedAccessTokenSecret = twitterAuth.encryptToken(accessTokenSecret);

    // Get user profile from Twitter
    const client = new TwitterApiClient(accessToken, accessTokenSecret);
    const profile = await client.getProfile();

    // Save integration
    const { data, error } = await supabase
      .from('twitter_integrations')
      .upsert({
        workspace_id: workspaceId,
        access_token: encryptedAccessToken,
        access_token_secret: encryptedAccessTokenSecret,
        twitter_user_id: profile.id_str,
        username: profile.screen_name,
        display_name: profile.name,
        profile_image_url: profile.profile_image_url_https,
        verified: profile.verified,
        followers_count: profile.followers_count,
        is_active: true,
        last_sync_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Disconnect Twitter account
   */
  static async disconnectAccount(workspaceId: string): Promise<void> {
    const supabase = createClient();

    const { error } = await supabase
      .from('twitter_integrations')
      .update({ is_active: false })
      .eq('workspace_id', workspaceId);

    if (error) throw error;
  }

  /**
   * Get Twitter integration
   */
  static async getIntegration(
    workspaceId: string
  ): Promise<TwitterIntegration | null> {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('twitter_integrations')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('is_active', true)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  /**
   * Get API client for workspace
   */
  static async getApiClient(workspaceId: string): Promise<TwitterApiClient> {
    const integration = await this.getIntegration(workspaceId);
    if (!integration) {
      throw new Error('Twitter integration not found');
    }

    const accessToken = twitterAuth.decryptToken(integration.access_token);
    const accessTokenSecret = twitterAuth.decryptToken(
      integration.access_token_secret
    );

    return new TwitterApiClient(accessToken, accessTokenSecret);
  }

  /**
   * Search and import Twitter profiles
   */
  static async searchAndImportProfiles(
    workspaceId: string,
    query: string,
    filters?: any
  ): Promise<TwitterProfile[]> {
    const supabase = createClient();
    const client = await this.getApiClient(workspaceId);

    // Search users
    const users = await client.searchUsers(query, 50);

    // Convert to profiles and save
    const profiles = users.map(user =>
      TwitterApiClient.convertToProfile(user, workspaceId)
    );

    const { data, error } = await supabase
      .from('twitter_profiles')
      .upsert(profiles, {
        onConflict: 'workspace_id,twitter_user_id',
      })
      .select();

    if (error) throw error;
    return data;
  }

  /**
   * Send direct message
   */
  static async sendDirectMessage(
    workspaceId: string,
    profileId: string,
    content: string,
    campaignId?: string
  ): Promise<TwitterMessage> {
    const supabase = createClient();
    const client = await this.getApiClient(workspaceId);

    // Get profile
    const { data: profile, error: profileError } = await supabase
      .from('twitter_profiles')
      .select('*')
      .eq('id', profileId)
      .single();

    if (profileError) throw profileError;

    // Create message record
    const { data: message, error: messageError } = await supabase
      .from('twitter_messages')
      .insert({
        workspace_id: workspaceId,
        campaign_id: campaignId,
        lead_id: profile.lead_id,
        profile_id: profileId,
        message_type: 'dm',
        content,
        status: 'sending',
      })
      .select()
      .single();

    if (messageError) throw messageError;

    try {
      // Send via Twitter API
      const dm = await client.sendDirectMessage(
        profile.twitter_user_id,
        content
      );

      // Update message status
      const { data: updated, error: updateError } = await supabase
        .from('twitter_messages')
        .update({
          twitter_message_id: dm.id,
          status: 'sent',
          sent_at: new Date().toISOString(),
        })
        .eq('id', message.id)
        .select()
        .single();

      if (updateError) throw updateError;

      // Track engagement
      await this.trackEngagement(
        workspaceId,
        profileId,
        'dm_open',
        { message_id: dm.id }
      );

      return updated;
    } catch (error) {
      // Update message with error
      await supabase
        .from('twitter_messages')
        .update({
          status: 'failed',
          error_message: error.message,
        })
        .eq('id', message.id);

      throw error;
    }
  }

  /**
   * Post tweet
   */
  static async postTweet(
    workspaceId: string,
    content: string,
    inReplyTo?: string
  ): Promise<TwitterMessage> {
    const supabase = createClient();
    const client = await this.getApiClient(workspaceId);

    // Create message record
    const { data: message, error: messageError } = await supabase
      .from('twitter_messages')
      .insert({
        workspace_id: workspaceId,
        message_type: inReplyTo ? 'reply' : 'tweet',
        content,
        in_reply_to_id: inReplyTo,
        status: 'sending',
      })
      .select()
      .single();

    if (messageError) throw messageError;

    try {
      // Post via Twitter API
      const tweet = await client.postTweet(content, inReplyTo);

      // Update message status
      const { data: updated, error: updateError } = await supabase
        .from('twitter_messages')
        .update({
          twitter_message_id: tweet.id_str,
          status: 'sent',
          sent_at: new Date().toISOString(),
        })
        .eq('id', message.id)
        .select()
        .single();

      if (updateError) throw updateError;
      return updated;
    } catch (error) {
      // Update message with error
      await supabase
        .from('twitter_messages')
        .update({
          status: 'failed',
          error_message: error.message,
        })
        .eq('id', message.id);

      throw error;
    }
  }

  /**
   * Follow user
   */
  static async followUser(
    workspaceId: string,
    profileId: string
  ): Promise<void> {
    const supabase = createClient();
    const client = await this.getApiClient(workspaceId);

    // Get profile
    const { data: profile, error: profileError } = await supabase
      .from('twitter_profiles')
      .select('*')
      .eq('id', profileId)
      .single();

    if (profileError) throw profileError;

    // Follow via API
    await client.followUser(profile.twitter_user_id);

    // Update profile
    await supabase
      .from('twitter_profiles')
      .update({ is_following: true })
      .eq('id', profileId);

    // Track engagement
    await this.trackEngagement(workspaceId, profileId, 'follow');
  }

  /**
   * Track engagement
   */
  static async trackEngagement(
    workspaceId: string,
    profileId: string,
    engagementType: string,
    metadata?: any
  ): Promise<void> {
    const supabase = createClient();

    await supabase.from('twitter_engagements').insert({
      workspace_id: workspaceId,
      profile_id: profileId,
      engagement_type: engagementType,
      metadata,
    });
  }

  /**
   * Create search monitor
   */
  static async createSearchMonitor(
    workspaceId: string,
    name: string,
    query: string,
    config: Partial<TwitterSearch>
  ): Promise<TwitterSearch> {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('twitter_searches')
      .insert({
        workspace_id: workspaceId,
        name,
        search_query: query,
        ...config,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Run search monitor
   */
  static async runSearchMonitor(searchId: string): Promise<void> {
    const supabase = createClient();

    // Get search config
    const { data: search, error: searchError } = await supabase
      .from('twitter_searches')
      .select('*')
      .eq('id', searchId)
      .single();

    if (searchError) throw searchError;
    if (!search.is_active) return;

    // Check daily limits
    if (search.actions_today >= search.daily_action_limit) return;

    const client = await this.getApiClient(search.workspace_id);

    // Search tweets
    const tweets = await client.searchTweets(
      search.search_query,
      search.filters,
      20
    );

    let actionsPerformed = 0;

    for (const tweet of tweets) {
      if (actionsPerformed >= search.daily_action_limit - search.actions_today) {
        break;
      }

      // Import profile
      const profile = TwitterApiClient.convertToProfile(
        tweet.user,
        search.workspace_id
      );

      const { data: savedProfile } = await supabase
        .from('twitter_profiles')
        .upsert(profile, {
          onConflict: 'workspace_id,twitter_user_id',
        })
        .select()
        .single();

      if (savedProfile) {
        // Auto-follow
        if (search.auto_follow && !savedProfile.is_following) {
          await this.followUser(search.workspace_id, savedProfile.id);
          actionsPerformed++;
        }

        // Auto-like
        if (search.auto_like) {
          await client.likeTweet(tweet.id_str);
          await this.trackEngagement(
            search.workspace_id,
            savedProfile.id,
            'like',
            { tweet_id: tweet.id_str }
          );
          actionsPerformed++;
        }

        // Auto-DM
        if (search.auto_dm && search.dm_template) {
          await this.sendDirectMessage(
            search.workspace_id,
            savedProfile.id,
            search.dm_template
          );
          actionsPerformed++;
        }
      }
    }

    // Update search stats
    await supabase
      .from('twitter_searches')
      .update({
        actions_today: search.actions_today + actionsPerformed,
        total_actions_taken: search.total_actions_taken + actionsPerformed,
        total_results_found: search.total_results_found + tweets.length,
      })
      .eq('id', searchId);
  }

  /**
   * Get rate limits
   */
  static async getRateLimits(workspaceId: string): Promise<TwitterRateLimits> {
    const client = await this.getApiClient(workspaceId);
    const limits = await client.getRateLimitStatus([
      'statuses',
      'direct_messages',
      'friendships',
      'search',
    ]);

    return {
      dm_per_day: 1000,
      dm_per_hour: 50,
      tweets_per_day: 2400,
      follows_per_day: 400,
      follows_per_hour: 20,
      likes_per_hour: 1000,
      searches_per_15min: limits.resources?.search?.'/search/tweets'?.limit || 180,
    };
  }

  /**
   * Sync follower data
   */
  static async syncFollowerData(workspaceId: string): Promise<void> {
    const supabase = createClient();
    const client = await this.getApiClient(workspaceId);
    const integration = await this.getIntegration(workspaceId);

    if (!integration) return;

    // Get current follower count
    const profile = await client.getProfile();
    const previousCount = integration.followers_count;
    const currentCount = profile.followers_count;

    // Update integration
    await supabase
      .from('twitter_integrations')
      .update({
        followers_count: currentCount,
        last_sync_at: new Date().toISOString(),
      })
      .eq('workspace_id', workspaceId);

    // Update analytics
    const today = new Date().toISOString().split('T')[0];
    await supabase
      .from('twitter_analytics')
      .upsert({
        workspace_id: workspaceId,
        analysis_date: today,
        new_followers: Math.max(0, currentCount - previousCount),
        lost_followers: Math.max(0, previousCount - currentCount),
        net_follower_growth: currentCount - previousCount,
      })
      .eq('workspace_id', workspaceId)
      .eq('analysis_date', today);
  }
}