import { TwitterAuthService } from './auth';
import {
  TwitterApiUser,
  TwitterApiTweet,
  TwitterApiDM,
  TwitterSearchFilters,
  TwitterProfile,
} from './types';

// Twitter API v1.1 endpoints
const TWITTER_API_BASE = 'https://api.twitter.com/1.1';
const TWITTER_API_V2_BASE = 'https://api.twitter.com/2';

export class TwitterApiClient {
  private authService: TwitterAuthService;
  private accessToken: string;
  private accessTokenSecret: string;

  constructor(accessToken: string, accessTokenSecret: string) {
    this.authService = new TwitterAuthService();
    this.accessToken = accessToken;
    this.accessTokenSecret = accessTokenSecret;
  }

  /**
   * Make authenticated request to Twitter API
   */
  private async makeRequest<T>(
    url: string,
    method: string = 'GET',
    data?: any
  ): Promise<T> {
    const headers = this.authService.getAuthHeaders(
      url,
      method,
      this.accessToken,
      this.accessTokenSecret,
      data
    );

    const options: RequestInit = {
      method,
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
    };

    if (data && method !== 'GET') {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.errors?.[0]?.message || response.statusText);
    }

    return response.json();
  }

  /**
   * Get authenticated user's profile
   */
  async getProfile(): Promise<TwitterApiUser> {
    const url = `${TWITTER_API_BASE}/account/verify_credentials.json?include_entities=false`;
    return this.makeRequest<TwitterApiUser>(url);
  }

  /**
   * Get user profile by username
   */
  async getUserByUsername(username: string): Promise<TwitterApiUser> {
    const url = `${TWITTER_API_BASE}/users/show.json?screen_name=${username}`;
    return this.makeRequest<TwitterApiUser>(url);
  }

  /**
   * Get user profile by ID
   */
  async getUserById(userId: string): Promise<TwitterApiUser> {
    const url = `${TWITTER_API_BASE}/users/show.json?user_id=${userId}`;
    return this.makeRequest<TwitterApiUser>(url);
  }

  /**
   * Send direct message
   */
  async sendDirectMessage(
    recipientId: string,
    text: string
  ): Promise<TwitterApiDM> {
    const url = `${TWITTER_API_BASE}/direct_messages/events/new.json`;
    const data = {
      event: {
        type: 'message_create',
        message_create: {
          target: {
            recipient_id: recipientId,
          },
          message_data: {
            text,
          },
        },
      },
    };

    return this.makeRequest<TwitterApiDM>(url, 'POST', data);
  }

  /**
   * Get direct messages (conversations)
   */
  async getDirectMessages(count: number = 50): Promise<any> {
    const url = `${TWITTER_API_BASE}/direct_messages/events/list.json?count=${count}`;
    return this.makeRequest(url);
  }

  /**
   * Post a tweet
   */
  async postTweet(text: string, inReplyTo?: string): Promise<TwitterApiTweet> {
    const url = `${TWITTER_API_BASE}/statuses/update.json`;
    const data = {
      status: text,
      ...(inReplyTo && { in_reply_to_status_id: inReplyTo }),
    };

    return this.makeRequest<TwitterApiTweet>(url, 'POST', data);
  }

  /**
   * Search tweets
   */
  async searchTweets(
    query: string,
    filters?: TwitterSearchFilters,
    maxResults: number = 100
  ): Promise<TwitterApiTweet[]> {
    let searchQuery = query;

    // Apply filters
    if (filters) {
      if (filters.keywords?.length) {
        searchQuery += ` ${filters.keywords.join(' OR ')}`;
      }
      if (filters.hashtags?.length) {
        searchQuery += ` ${filters.hashtags.map(tag => `#${tag}`).join(' OR ')}`;
      }
      if (filters.from_user) {
        searchQuery += ` from:${filters.from_user}`;
      }
      if (filters.to_user) {
        searchQuery += ` to:${filters.to_user}`;
      }
      if (filters.min_retweets) {
        searchQuery += ` min_retweets:${filters.min_retweets}`;
      }
      if (filters.min_likes) {
        searchQuery += ` min_faves:${filters.min_likes}`;
      }
      if (filters.has_media) {
        searchQuery += ` filter:media`;
      }
      if (filters.has_links) {
        searchQuery += ` filter:links`;
      }
      if (filters.language) {
        searchQuery += ` lang:${filters.language}`;
      }
      if (filters.since) {
        searchQuery += ` since:${filters.since}`;
      }
      if (filters.until) {
        searchQuery += ` until:${filters.until}`;
      }
    }

    const url = `${TWITTER_API_BASE}/search/tweets.json?q=${encodeURIComponent(
      searchQuery
    )}&count=${maxResults}&result_type=recent`;

    const response = await this.makeRequest<{ statuses: TwitterApiTweet[] }>(url);
    return response.statuses;
  }

  /**
   * Search users
   */
  async searchUsers(query: string, count: number = 20): Promise<TwitterApiUser[]> {
    const url = `${TWITTER_API_BASE}/users/search.json?q=${encodeURIComponent(
      query
    )}&count=${count}`;
    return this.makeRequest<TwitterApiUser[]>(url);
  }

  /**
   * Follow a user
   */
  async followUser(userId: string): Promise<TwitterApiUser> {
    const url = `${TWITTER_API_BASE}/friendships/create.json`;
    const data = { user_id: userId, follow: true };
    return this.makeRequest<TwitterApiUser>(url, 'POST', data);
  }

  /**
   * Unfollow a user
   */
  async unfollowUser(userId: string): Promise<TwitterApiUser> {
    const url = `${TWITTER_API_BASE}/friendships/destroy.json`;
    const data = { user_id: userId };
    return this.makeRequest<TwitterApiUser>(url, 'POST', data);
  }

  /**
   * Like a tweet
   */
  async likeTweet(tweetId: string): Promise<TwitterApiTweet> {
    const url = `${TWITTER_API_BASE}/favorites/create.json`;
    const data = { id: tweetId };
    return this.makeRequest<TwitterApiTweet>(url, 'POST', data);
  }

  /**
   * Unlike a tweet
   */
  async unlikeTweet(tweetId: string): Promise<TwitterApiTweet> {
    const url = `${TWITTER_API_BASE}/favorites/destroy.json`;
    const data = { id: tweetId };
    return this.makeRequest<TwitterApiTweet>(url, 'POST', data);
  }

  /**
   * Retweet
   */
  async retweet(tweetId: string): Promise<TwitterApiTweet> {
    const url = `${TWITTER_API_BASE}/statuses/retweet/${tweetId}.json`;
    return this.makeRequest<TwitterApiTweet>(url, 'POST');
  }

  /**
   * Get followers
   */
  async getFollowers(
    userId?: string,
    cursor: string = '-1',
    count: number = 200
  ): Promise<{ users: TwitterApiUser[]; next_cursor_str: string }> {
    const url = `${TWITTER_API_BASE}/followers/list.json?${
      userId ? `user_id=${userId}` : 'screen_name=self'
    }&cursor=${cursor}&count=${count}&skip_status=true`;
    return this.makeRequest(url);
  }

  /**
   * Get following
   */
  async getFollowing(
    userId?: string,
    cursor: string = '-1',
    count: number = 200
  ): Promise<{ users: TwitterApiUser[]; next_cursor_str: string }> {
    const url = `${TWITTER_API_BASE}/friends/list.json?${
      userId ? `user_id=${userId}` : 'screen_name=self'
    }&cursor=${cursor}&count=${count}&skip_status=true`;
    return this.makeRequest(url);
  }

  /**
   * Get relationship status
   */
  async getRelationship(targetUserId: string): Promise<any> {
    const url = `${TWITTER_API_BASE}/friendships/show.json?target_id=${targetUserId}`;
    return this.makeRequest(url);
  }

  /**
   * Get rate limit status
   */
  async getRateLimitStatus(resources?: string[]): Promise<any> {
    const url = `${TWITTER_API_BASE}/application/rate_limit_status.json${
      resources ? `?resources=${resources.join(',')}` : ''
    }`;
    return this.makeRequest(url);
  }

  /**
   * Convert Twitter API user to our profile format
   */
  static convertToProfile(
    apiUser: TwitterApiUser,
    workspaceId: string
  ): Partial<TwitterProfile> {
    return {
      workspace_id: workspaceId,
      twitter_user_id: apiUser.id_str,
      username: apiUser.screen_name,
      display_name: apiUser.name,
      bio: apiUser.description,
      location: apiUser.location,
      website: apiUser.url,
      profile_image_url: apiUser.profile_image_url_https,
      profile_banner_url: apiUser.profile_banner_url,
      followers_count: apiUser.followers_count,
      following_count: apiUser.friends_count,
      tweet_count: apiUser.statuses_count,
      listed_count: apiUser.listed_count,
      verified: apiUser.verified,
      profile_data: apiUser,
      last_enriched_at: new Date().toISOString(),
    };
  }
}