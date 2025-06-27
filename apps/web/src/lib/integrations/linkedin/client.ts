import { LinkedInAuth } from './auth';

// LinkedIn API endpoints
const LINKEDIN_API_BASE = 'https://api.linkedin.com/v2';
const LINKEDIN_REST_API_BASE = 'https://api.linkedin.com/rest';

export interface LinkedInMessage {
  recipientUrn: string; // URN of the recipient
  subject?: string; // For InMails
  body: string;
  messageType: 'MESSAGE' | 'INMAIL';
}

export interface LinkedInConnectionRequest {
  recipientUrn: string;
  message: string; // Connection request note
}

export interface LinkedInProfile {
  id: string;
  vanityName?: string;
  localizedFirstName: string;
  localizedLastName: string;
  localizedHeadline?: string;
  profilePicture?: {
    displayImage: string;
  };
  publicProfileUrl?: string;
}

export interface LinkedInSearchResult {
  profiles: LinkedInProfile[];
  paging: {
    start: number;
    count: number;
    total: number;
  };
}

export class LinkedInClient {
  private workspaceId: string;
  
  constructor(workspaceId: string) {
    this.workspaceId = workspaceId;
  }
  
  /**
   * Get authenticated headers
   */
  private async getHeaders(): Promise<HeadersInit> {
    const accessToken = await LinkedInAuth.getValidAccessToken(this.workspaceId);
    
    if (!accessToken) {
      throw new Error('LinkedIn integration not connected or token expired');
    }
    
    return {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-RestLi-Protocol-Version': '2.0.0',
      'LinkedIn-Version': '202401',
    };
  }
  
  /**
   * Get current user's profile
   */
  async getCurrentUserProfile(): Promise<LinkedInProfile> {
    const headers = await this.getHeaders();
    
    const response = await fetch(`${LINKEDIN_API_BASE}/userinfo`, {
      headers,
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch profile: ${response.statusText}`);
    }
    
    return response.json();
  }
  
  /**
   * Search for LinkedIn profiles
   */
  async searchProfiles(query: string, limit: number = 10): Promise<LinkedInSearchResult> {
    const headers = await this.getHeaders();
    
    // Note: LinkedIn's search API is restricted and requires special permissions
    // This is a placeholder for when proper search access is granted
    const params = new URLSearchParams({
      q: 'people',
      keywords: query,
      count: limit.toString(),
    });
    
    const response = await fetch(`${LINKEDIN_REST_API_BASE}/search?${params}`, {
      headers,
    });
    
    if (!response.ok) {
      throw new Error(`Search failed: ${response.statusText}`);
    }
    
    return response.json();
  }
  
  /**
   * Get profile by ID or public identifier
   */
  async getProfile(identifier: string): Promise<LinkedInProfile> {
    const headers = await this.getHeaders();
    
    const response = await fetch(`${LINKEDIN_REST_API_BASE}/people/${identifier}`, {
      headers,
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch profile: ${response.statusText}`);
    }
    
    return response.json();
  }
  
  /**
   * Send a message to a LinkedIn member
   */
  async sendMessage(message: LinkedInMessage): Promise<{ id: string }> {
    const headers = await this.getHeaders();
    
    const payload = {
      recipients: [message.recipientUrn],
      subject: message.subject,
      body: {
        text: message.body,
      },
      messageType: message.messageType,
    };
    
    const response = await fetch(`${LINKEDIN_REST_API_BASE}/messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to send message: ${error}`);
    }
    
    const result = await response.json();
    return { id: result.id };
  }
  
  /**
   * Send a connection request
   */
  async sendConnectionRequest(request: LinkedInConnectionRequest): Promise<{ id: string }> {
    const headers = await this.getHeaders();
    
    const payload = {
      invitations: [{
        invitee: request.recipientUrn,
        message: request.message,
      }],
    };
    
    const response = await fetch(`${LINKEDIN_REST_API_BASE}/invitations`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to send connection request: ${error}`);
    }
    
    const result = await response.json();
    return { id: result.value[0].id };
  }
  
  /**
   * Get connections list
   */
  async getConnections(start: number = 0, count: number = 50): Promise<{
    connections: LinkedInProfile[];
    paging: { start: number; count: number; total: number };
  }> {
    const headers = await this.getHeaders();
    
    const params = new URLSearchParams({
      start: start.toString(),
      count: count.toString(),
    });
    
    const response = await fetch(`${LINKEDIN_REST_API_BASE}/connections?${params}`, {
      headers,
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch connections: ${response.statusText}`);
    }
    
    return response.json();
  }
  
  /**
   * Get conversation messages
   */
  async getConversation(conversationId: string): Promise<{
    messages: Array<{
      id: string;
      createdAt: number;
      body: { text: string };
      from: { member: string };
    }>;
  }> {
    const headers = await this.getHeaders();
    
    const response = await fetch(`${LINKEDIN_REST_API_BASE}/conversations/${conversationId}/events`, {
      headers,
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch conversation: ${response.statusText}`);
    }
    
    return response.json();
  }
  
  /**
   * Check rate limits
   */
  async checkRateLimits(): Promise<{
    dailyLimit: number;
    dailyUsed: number;
    resetTime: Date;
  }> {
    const headers = await this.getHeaders();
    
    // LinkedIn returns rate limit info in headers
    const response = await fetch(`${LINKEDIN_API_BASE}/userinfo`, {
      headers,
    });
    
    const dailyLimit = parseInt(response.headers.get('X-RateLimit-Limit') || '1000');
    const dailyUsed = parseInt(response.headers.get('X-RateLimit-Used') || '0');
    const resetTimestamp = parseInt(response.headers.get('X-RateLimit-Reset') || '0');
    
    return {
      dailyLimit,
      dailyUsed,
      resetTime: new Date(resetTimestamp * 1000),
    };
  }
  
  /**
   * Batch profile enrichment
   */
  async batchEnrichProfiles(profileIds: string[]): Promise<LinkedInProfile[]> {
    const headers = await this.getHeaders();
    
    // LinkedIn supports batch operations for efficiency
    const params = new URLSearchParams({
      ids: profileIds.join(','),
    });
    
    const response = await fetch(`${LINKEDIN_REST_API_BASE}/people?${params}`, {
      headers,
    });
    
    if (!response.ok) {
      throw new Error(`Batch enrichment failed: ${response.statusText}`);
    }
    
    const result = await response.json();
    return result.results;
  }
}