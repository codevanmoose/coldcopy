import { createClient } from '@/lib/supabase/client'

export interface TwitterProfile {
  id: string
  username: string
  displayName: string
  bio?: string
  profileImageUrl?: string
  bannerImageUrl?: string
  location?: string
  website?: string
  followersCount: number
  followingCount: number
  tweetCount: number
  verified: boolean
  createdAt: Date
  metrics?: {
    engagement_rate: number
    avg_retweets: number
    avg_likes: number
  }
}

export interface TwitterTweet {
  id: string
  text: string
  authorId: string
  authorUsername: string
  authorName: string
  createdAt: Date
  publicMetrics: {
    retweetCount: number
    likeCount: number
    replyCount: number
    quoteCount: number
    impressionCount?: number
  }
  mediaAttachments?: Array<{
    type: 'photo' | 'video' | 'animated_gif'
    url: string
    previewImageUrl?: string
  }>
  referencedTweets?: Array<{
    type: 'retweeted' | 'quoted' | 'replied_to'
    id: string
  }>
  entities?: {
    mentions?: Array<{ username: string; id: string }>
    hashtags?: Array<{ tag: string }>
    urls?: Array<{ url: string; expandedUrl: string; displayUrl: string }>
  }
}

export interface TwitterDirectMessage {
  id: string
  conversationId: string
  senderId: string
  recipientId: string
  text: string
  mediaAttachments?: Array<{
    type: string
    url: string
  }>
  createdAt: Date
  status: 'sent' | 'delivered' | 'read' | 'failed'
}

export interface TwitterCampaign {
  id: string
  workspaceId: string
  name: string
  description?: string
  status: 'draft' | 'active' | 'paused' | 'completed'
  targetAudience: {
    keywords?: string[]
    hashtags?: string[]
    mentions?: string[]
    followersOf?: string[]
    locations?: string[]
    languages?: string[]
    minFollowers?: number
    maxFollowers?: number
    verifiedOnly?: boolean
  }
  actions: Array<{
    type: 'follow' | 'like' | 'retweet' | 'reply' | 'dm' | 'mention'
    template?: string
    probability: number // 0-1
    delay?: number // minutes
  }>
  limits: {
    dailyFollows: number
    dailyLikes: number
    dailyRetweets: number
    dailyReplies: number
    dailyDMs: number
  }
  analytics: {
    profilesTargeted: number
    actionsPerformed: number
    followsGained: number
    likesReceived: number
    retweetsReceived: number
    repliesReceived: number
    dmsReplied: number
    engagementRate: number
  }
  createdAt: Date
  updatedAt: Date
}

export interface TwitterAutomationRule {
  id: string
  workspaceId: string
  name: string
  trigger: {
    type: 'mention' | 'dm_received' | 'new_follower' | 'tweet_liked' | 'tweet_retweeted' | 'keyword_match'
    conditions?: {
      keywords?: string[]
      userCriteria?: any
      minFollowers?: number
      verified?: boolean
    }
  }
  actions: Array<{
    type: 'follow' | 'like' | 'retweet' | 'reply' | 'dm' | 'add_to_list'
    template?: string
    delay?: number
    parameters?: any
  }>
  isActive: boolean
  createdAt: Date
}

export interface TwitterListMonitoring {
  id: string
  workspaceId: string
  listId: string
  listName: string
  monitoringType: 'mentions' | 'tweets' | 'engagement'
  keywords?: string[]
  actions: Array<{
    type: 'follow' | 'like' | 'retweet' | 'reply' | 'dm'
    template?: string
    conditions?: any
  }>
  isActive: boolean
}

export class TwitterService {
  private supabase = createClient()
  private apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.coldcopy.cc'

  async getAuthUrl(workspaceId: string, redirectUri: string): Promise<string> {
    const response = await fetch(`${this.apiBaseUrl}/twitter/auth/url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await this.getToken()}`,
      },
      body: JSON.stringify({
        workspace_id: workspaceId,
        redirect_uri: redirectUri,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to get Twitter auth URL')
    }

    const data = await response.json()
    return data.authUrl
  }

  async handleAuthCallback(
    workspaceId: string,
    oauthToken: string,
    oauthVerifier: string
  ): Promise<{ success: boolean; profile?: TwitterProfile }> {
    const response = await fetch(`${this.apiBaseUrl}/twitter/auth/callback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await this.getToken()}`,
      },
      body: JSON.stringify({
        workspace_id: workspaceId,
        oauth_token: oauthToken,
        oauth_verifier: oauthVerifier,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to complete Twitter authentication')
    }

    return response.json()
  }

  async searchUsers(
    workspaceId: string,
    criteria: {
      query?: string
      keywords?: string[]
      location?: string
      minFollowers?: number
      maxFollowers?: number
      verified?: boolean
      hasProfileImage?: boolean
      language?: string
      limit?: number
    }
  ): Promise<{ users: TwitterProfile[]; nextToken?: string }> {
    const response = await fetch(`${this.apiBaseUrl}/twitter/users/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await this.getToken()}`,
      },
      body: JSON.stringify({
        workspace_id: workspaceId,
        ...criteria,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to search Twitter users')
    }

    return response.json()
  }

  async searchTweets(
    workspaceId: string,
    criteria: {
      query?: string
      keywords?: string[]
      hashtags?: string[]
      mentions?: string[]
      fromUsers?: string[]
      language?: string
      hasMedia?: boolean
      minRetweets?: number
      minLikes?: number
      startTime?: Date
      endTime?: Date
      limit?: number
    }
  ): Promise<{ tweets: TwitterTweet[]; nextToken?: string }> {
    const response = await fetch(`${this.apiBaseUrl}/twitter/tweets/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await this.getToken()}`,
      },
      body: JSON.stringify({
        workspace_id: workspaceId,
        ...criteria,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to search Twitter tweets')
    }

    return response.json()
  }

  async getUserProfile(workspaceId: string, username: string): Promise<TwitterProfile> {
    const response = await fetch(`${this.apiBaseUrl}/twitter/users/${username}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${await this.getToken()}`,
      },
    })

    if (!response.ok) {
      throw new Error('Failed to get Twitter user profile')
    }

    return response.json()
  }

  async followUser(workspaceId: string, userId: string): Promise<{ success: boolean }> {
    const response = await fetch(`${this.apiBaseUrl}/twitter/users/${userId}/follow`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await this.getToken()}`,
      },
      body: JSON.stringify({
        workspace_id: workspaceId,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to follow Twitter user')
    }

    return response.json()
  }

  async unfollowUser(workspaceId: string, userId: string): Promise<{ success: boolean }> {
    const response = await fetch(`${this.apiBaseUrl}/twitter/users/${userId}/unfollow`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await this.getToken()}`,
      },
      body: JSON.stringify({
        workspace_id: workspaceId,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to unfollow Twitter user')
    }

    return response.json()
  }

  async likeTweet(workspaceId: string, tweetId: string): Promise<{ success: boolean }> {
    const response = await fetch(`${this.apiBaseUrl}/twitter/tweets/${tweetId}/like`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await this.getToken()}`,
      },
      body: JSON.stringify({
        workspace_id: workspaceId,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to like tweet')
    }

    return response.json()
  }

  async retweetTweet(workspaceId: string, tweetId: string): Promise<{ success: boolean }> {
    const response = await fetch(`${this.apiBaseUrl}/twitter/tweets/${tweetId}/retweet`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await this.getToken()}`,
      },
      body: JSON.stringify({
        workspace_id: workspaceId,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to retweet')
    }

    return response.json()
  }

  async replyToTweet(
    workspaceId: string,
    tweetId: string,
    text: string,
    mediaIds?: string[]
  ): Promise<TwitterTweet> {
    const response = await fetch(`${this.apiBaseUrl}/twitter/tweets/${tweetId}/reply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await this.getToken()}`,
      },
      body: JSON.stringify({
        workspace_id: workspaceId,
        text,
        media_ids: mediaIds,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to reply to tweet')
    }

    return response.json()
  }

  async sendDirectMessage(
    workspaceId: string,
    recipientId: string,
    text: string,
    mediaId?: string
  ): Promise<TwitterDirectMessage> {
    const response = await fetch(`${this.apiBaseUrl}/twitter/direct-messages/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await this.getToken()}`,
      },
      body: JSON.stringify({
        workspace_id: workspaceId,
        recipient_id: recipientId,
        text,
        media_id: mediaId,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to send direct message')
    }

    return response.json()
  }

  async getDirectMessages(
    workspaceId: string,
    conversationId?: string,
    limit = 50
  ): Promise<TwitterDirectMessage[]> {
    const params = new URLSearchParams({
      workspace_id: workspaceId,
      limit: limit.toString(),
    })

    if (conversationId) {
      params.append('conversation_id', conversationId)
    }

    const response = await fetch(`${this.apiBaseUrl}/twitter/direct-messages?${params}`, {
      headers: {
        'Authorization': `Bearer ${await this.getToken()}`,
      },
    })

    if (!response.ok) {
      throw new Error('Failed to get direct messages')
    }

    return response.json()
  }

  async createCampaign(
    workspaceId: string,
    campaign: Omit<TwitterCampaign, 'id' | 'analytics' | 'createdAt' | 'updatedAt'>
  ): Promise<TwitterCampaign> {
    const response = await fetch(`${this.apiBaseUrl}/twitter/campaigns`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await this.getToken()}`,
      },
      body: JSON.stringify({
        workspace_id: workspaceId,
        ...campaign,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to create Twitter campaign')
    }

    return response.json()
  }

  async getCampaigns(workspaceId: string): Promise<TwitterCampaign[]> {
    const response = await fetch(
      `${this.apiBaseUrl}/twitter/campaigns?workspace_id=${workspaceId}`,
      {
        headers: {
          'Authorization': `Bearer ${await this.getToken()}`,
        },
      }
    )

    if (!response.ok) {
      throw new Error('Failed to get Twitter campaigns')
    }

    return response.json()
  }

  async updateCampaign(
    workspaceId: string,
    campaignId: string,
    updates: Partial<TwitterCampaign>
  ): Promise<TwitterCampaign> {
    const response = await fetch(`${this.apiBaseUrl}/twitter/campaigns/${campaignId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await this.getToken()}`,
      },
      body: JSON.stringify({
        workspace_id: workspaceId,
        ...updates,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to update Twitter campaign')
    }

    return response.json()
  }

  async startCampaign(workspaceId: string, campaignId: string): Promise<{ success: boolean }> {
    const response = await fetch(`${this.apiBaseUrl}/twitter/campaigns/${campaignId}/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await this.getToken()}`,
      },
      body: JSON.stringify({
        workspace_id: workspaceId,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to start Twitter campaign')
    }

    return response.json()
  }

  async pauseCampaign(workspaceId: string, campaignId: string): Promise<{ success: boolean }> {
    const response = await fetch(`${this.apiBaseUrl}/twitter/campaigns/${campaignId}/pause`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await this.getToken()}`,
      },
      body: JSON.stringify({
        workspace_id: workspaceId,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to pause Twitter campaign')
    }

    return response.json()
  }

  async getCampaignAnalytics(
    workspaceId: string,
    campaignId: string,
    timeRange?: { start: Date; end: Date }
  ): Promise<any> {
    const params = new URLSearchParams({
      workspace_id: workspaceId,
    })

    if (timeRange) {
      params.append('start_date', timeRange.start.toISOString())
      params.append('end_date', timeRange.end.toISOString())
    }

    const response = await fetch(
      `${this.apiBaseUrl}/twitter/campaigns/${campaignId}/analytics?${params}`,
      {
        headers: {
          'Authorization': `Bearer ${await this.getToken()}`,
        },
      }
    )

    if (!response.ok) {
      throw new Error('Failed to get Twitter campaign analytics')
    }

    return response.json()
  }

  async createAutomationRule(
    workspaceId: string,
    rule: Omit<TwitterAutomationRule, 'id' | 'createdAt'>
  ): Promise<TwitterAutomationRule> {
    const response = await fetch(`${this.apiBaseUrl}/twitter/automation/rules`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await this.getToken()}`,
      },
      body: JSON.stringify({
        workspace_id: workspaceId,
        ...rule,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to create Twitter automation rule')
    }

    return response.json()
  }

  async getAutomationRules(workspaceId: string): Promise<TwitterAutomationRule[]> {
    const response = await fetch(
      `${this.apiBaseUrl}/twitter/automation/rules?workspace_id=${workspaceId}`,
      {
        headers: {
          'Authorization': `Bearer ${await this.getToken()}`,
        },
      }
    )

    if (!response.ok) {
      throw new Error('Failed to get Twitter automation rules')
    }

    return response.json()
  }

  async getDailyLimits(workspaceId: string): Promise<{
    follows: { count: number; limit: number }
    likes: { count: number; limit: number }
    retweets: { count: number; limit: number }
    replies: { count: number; limit: number }
    dms: { count: number; limit: number }
  }> {
    const response = await fetch(
      `${this.apiBaseUrl}/twitter/limits?workspace_id=${workspaceId}`,
      {
        headers: {
          'Authorization': `Bearer ${await this.getToken()}`,
        },
      }
    )

    if (!response.ok) {
      throw new Error('Failed to get Twitter daily limits')
    }

    return response.json()
  }

  async getFollowers(
    workspaceId: string,
    userId?: string,
    limit = 100
  ): Promise<{ users: TwitterProfile[]; nextToken?: string }> {
    const params = new URLSearchParams({
      workspace_id: workspaceId,
      limit: limit.toString(),
    })

    if (userId) {
      params.append('user_id', userId)
    }

    const response = await fetch(`${this.apiBaseUrl}/twitter/followers?${params}`, {
      headers: {
        'Authorization': `Bearer ${await this.getToken()}`,
      },
    })

    if (!response.ok) {
      throw new Error('Failed to get followers')
    }

    return response.json()
  }

  async getFollowing(
    workspaceId: string,
    userId?: string,
    limit = 100
  ): Promise<{ users: TwitterProfile[]; nextToken?: string }> {
    const params = new URLSearchParams({
      workspace_id: workspaceId,
      limit: limit.toString(),
    })

    if (userId) {
      params.append('user_id', userId)
    }

    const response = await fetch(`${this.apiBaseUrl}/twitter/following?${params}`, {
      headers: {
        'Authorization': `Bearer ${await this.getToken()}`,
      },
    })

    if (!response.ok) {
      throw new Error('Failed to get following')
    }

    return response.json()
  }

  async monitorMentions(
    workspaceId: string,
    keywords?: string[]
  ): Promise<{ tweets: TwitterTweet[] }> {
    const response = await fetch(`${this.apiBaseUrl}/twitter/monitoring/mentions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await this.getToken()}`,
      },
      body: JSON.stringify({
        workspace_id: workspaceId,
        keywords,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to monitor mentions')
    }

    return response.json()
  }

  private async getToken(): Promise<string> {
    const { data: { session } } = await this.supabase.auth.getSession()
    return session?.access_token || ''
  }
}

// Export singleton instance
export const twitterService = new TwitterService()