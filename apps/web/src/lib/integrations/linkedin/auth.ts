import { createServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';

// LinkedIn OAuth configuration
const LINKEDIN_CLIENT_ID = process.env.LINKEDIN_CLIENT_ID!;
const LINKEDIN_CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET!;
const LINKEDIN_REDIRECT_URI = process.env.LINKEDIN_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/linkedin/callback`;

// LinkedIn OAuth URLs
const LINKEDIN_AUTH_URL = 'https://www.linkedin.com/oauth/v2/authorization';
const LINKEDIN_TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
const LINKEDIN_PROFILE_URL = 'https://api.linkedin.com/v2/userinfo';

// Required scopes for LinkedIn integration
const LINKEDIN_SCOPES = [
  'openid',
  'profile', 
  'email',
  'w_member_social', // Post shares and send messages
  'r_basicprofile',
  'r_organization_social', // Read organization data
];

interface LinkedInTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  scope: string;
  token_type: string;
}

interface LinkedInProfile {
  sub: string; // LinkedIn user ID
  email: string;
  email_verified: boolean;
  name: string;
  given_name: string;
  family_name: string;
  locale: string;
  picture: string;
}

export class LinkedInAuth {
  /**
   * Generate LinkedIn OAuth authorization URL
   */
  static async getAuthorizationUrl(workspaceId: string, userId: string): Promise<string> {
    const cookieStore = cookies();
    const supabase = createServerClient(cookieStore);
    
    // Generate state token for CSRF protection
    const state = crypto.randomBytes(32).toString('hex');
    
    // Store state in database
    const { error } = await supabase
      .from('auth_states')
      .insert({
        state,
        provider: 'linkedin',
        workspace_id: workspaceId,
        user_id: userId,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
      });
      
    if (error) {
      console.error('Error storing auth state:', error);
      throw new Error('Failed to initialize LinkedIn authentication');
    }
    
    // Build authorization URL
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: LINKEDIN_CLIENT_ID,
      redirect_uri: LINKEDIN_REDIRECT_URI,
      state,
      scope: LINKEDIN_SCOPES.join(' '),
    });
    
    return `${LINKEDIN_AUTH_URL}?${params.toString()}`;
  }
  
  /**
   * Exchange authorization code for access tokens
   */
  static async exchangeCodeForTokens(code: string): Promise<LinkedInTokenResponse> {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: LINKEDIN_CLIENT_ID,
      client_secret: LINKEDIN_CLIENT_SECRET,
      redirect_uri: LINKEDIN_REDIRECT_URI,
    });
    
    const response = await fetch(LINKEDIN_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error('LinkedIn token exchange failed:', error);
      throw new Error('Failed to exchange authorization code');
    }
    
    return response.json();
  }
  
  /**
   * Get LinkedIn user profile
   */
  static async getUserProfile(accessToken: string): Promise<LinkedInProfile> {
    const response = await fetch(LINKEDIN_PROFILE_URL, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error('Failed to fetch LinkedIn profile:', error);
      throw new Error('Failed to fetch LinkedIn profile');
    }
    
    return response.json();
  }
  
  /**
   * Save LinkedIn integration to database
   */
  static async saveIntegration(
    workspaceId: string,
    tokens: LinkedInTokenResponse,
    profile: LinkedInProfile
  ) {
    const cookieStore = cookies();
    const supabase = createServerClient(cookieStore);
    
    // Calculate token expiration
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
    
    // Encrypt tokens
    const encryptedAccessToken = await this.encryptToken(tokens.access_token);
    const encryptedRefreshToken = tokens.refresh_token 
      ? await this.encryptToken(tokens.refresh_token)
      : null;
    
    // Save or update integration
    const { error } = await supabase
      .from('linkedin_integrations')
      .upsert({
        workspace_id: workspaceId,
        access_token: encryptedAccessToken,
        refresh_token: encryptedRefreshToken,
        expires_at: expiresAt,
        linkedin_user_id: profile.sub,
        full_name: profile.name,
        email: profile.email,
        scopes: tokens.scope.split(' '),
        is_active: true,
      }, {
        onConflict: 'workspace_id',
      });
      
    if (error) {
      console.error('Error saving LinkedIn integration:', error);
      throw new Error('Failed to save LinkedIn integration');
    }
    
    // Create audit log entry
    await supabase
      .from('audit_logs')
      .insert({
        workspace_id: workspaceId,
        action: 'linkedin_integration_connected',
        resource_type: 'integration',
        resource_id: workspaceId,
        metadata: {
          linkedin_user_id: profile.sub,
          email: profile.email,
        },
      });
  }
  
  /**
   * Get valid access token (refresh if needed)
   */
  static async getValidAccessToken(workspaceId: string): Promise<string | null> {
    const cookieStore = cookies();
    const supabase = createServerClient(cookieStore);
    
    // Get integration
    const { data: integration, error } = await supabase
      .from('linkedin_integrations')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('is_active', true)
      .single();
      
    if (error || !integration) {
      return null;
    }
    
    // Check if token is expired (with 5-minute buffer)
    const expiresAt = new Date(integration.expires_at);
    const now = new Date();
    const buffer = 5 * 60 * 1000; // 5 minutes
    
    if (expiresAt.getTime() - buffer > now.getTime()) {
      // Token is still valid
      return this.decryptToken(integration.access_token);
    }
    
    // Token needs refresh
    if (!integration.refresh_token) {
      // LinkedIn doesn't always provide refresh tokens
      // User needs to re-authenticate
      await this.disconnect(workspaceId);
      return null;
    }
    
    try {
      const newTokens = await this.refreshAccessToken(integration.refresh_token);
      
      // Update tokens in database
      const encryptedAccessToken = await this.encryptToken(newTokens.access_token);
      const newExpiresAt = new Date(Date.now() + newTokens.expires_in * 1000).toISOString();
      
      await supabase
        .from('linkedin_integrations')
        .update({
          access_token: encryptedAccessToken,
          expires_at: newExpiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq('workspace_id', workspaceId);
        
      return newTokens.access_token;
    } catch (error) {
      console.error('Failed to refresh LinkedIn token:', error);
      await this.disconnect(workspaceId);
      return null;
    }
  }
  
  /**
   * Refresh access token
   */
  static async refreshAccessToken(refreshToken: string): Promise<LinkedInTokenResponse> {
    const decryptedRefreshToken = await this.decryptToken(refreshToken);
    
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: decryptedRefreshToken,
      client_id: LINKEDIN_CLIENT_ID,
      client_secret: LINKEDIN_CLIENT_SECRET,
    });
    
    const response = await fetch(LINKEDIN_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });
    
    if (!response.ok) {
      throw new Error('Failed to refresh LinkedIn access token');
    }
    
    return response.json();
  }
  
  /**
   * Disconnect LinkedIn integration
   */
  static async disconnect(workspaceId: string): Promise<void> {
    const cookieStore = cookies();
    const supabase = createServerClient(cookieStore);
    
    // Soft delete - set is_active to false
    const { error } = await supabase
      .from('linkedin_integrations')
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('workspace_id', workspaceId);
      
    if (error) {
      console.error('Error disconnecting LinkedIn:', error);
      throw new Error('Failed to disconnect LinkedIn integration');
    }
    
    // Create audit log entry
    await supabase
      .from('audit_logs')
      .insert({
        workspace_id: workspaceId,
        action: 'linkedin_integration_disconnected',
        resource_type: 'integration',
        resource_id: workspaceId,
      });
  }
  
  /**
   * Encrypt sensitive tokens
   */
  private static async encryptToken(token: string): Promise<string> {
    const algorithm = 'aes-256-gcm';
    const key = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex');
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    
    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  }
  
  /**
   * Decrypt sensitive tokens
   */
  private static async decryptToken(encryptedToken: string): Promise<string> {
    const algorithm = 'aes-256-gcm';
    const key = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex');
    
    const parts = encryptedToken.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}