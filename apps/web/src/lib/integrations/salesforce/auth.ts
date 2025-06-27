import { createClient } from '@/utils/supabase/server';
import crypto from 'crypto';
import {
  SalesforceAuthRequest,
  SalesforceAuthResponse,
  SalesforceConnectionConfig,
} from './types';

const SALESFORCE_AUTH_URL = 'https://login.salesforce.com/services/oauth2/authorize';
const SALESFORCE_TOKEN_URL = 'https://login.salesforce.com/services/oauth2/token';
const SALESFORCE_SANDBOX_AUTH_URL = 'https://test.salesforce.com/services/oauth2/authorize';
const SALESFORCE_SANDBOX_TOKEN_URL = 'https://test.salesforce.com/services/oauth2/token';

export class SalesforceAuth {
  private config: SalesforceConnectionConfig;
  private encryptionKey: string;

  constructor(config: SalesforceConnectionConfig) {
    this.config = config;
    this.encryptionKey = process.env.ENCRYPTION_KEY!;
    
    if (!this.encryptionKey) {
      throw new Error('ENCRYPTION_KEY environment variable is required');
    }
  }

  /**
   * Get the authorization URL for Salesforce OAuth
   */
  getAuthorizationUrl(state: string): string {
    const baseUrl = this.config.sandbox ? SALESFORCE_SANDBOX_AUTH_URL : SALESFORCE_AUTH_URL;
    
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.client_id,
      redirect_uri: this.config.redirect_uri,
      scope: 'api refresh_token offline_access',
      state,
      prompt: 'consent',
    });

    return `${baseUrl}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(authRequest: SalesforceAuthRequest): Promise<SalesforceAuthResponse> {
    const tokenUrl = this.config.sandbox ? SALESFORCE_SANDBOX_TOKEN_URL : SALESFORCE_TOKEN_URL;

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.config.client_id,
      client_secret: this.config.client_secret,
      code: authRequest.code,
      redirect_uri: authRequest.redirect_uri,
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Salesforce token exchange failed: ${error}`);
    }

    const data = await response.json();
    return data as SalesforceAuthResponse;
  }

  /**
   * Refresh an access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<SalesforceAuthResponse> {
    const tokenUrl = this.config.sandbox ? SALESFORCE_SANDBOX_TOKEN_URL : SALESFORCE_TOKEN_URL;

    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: this.config.client_id,
      client_secret: this.config.client_secret,
      refresh_token: refreshToken,
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Salesforce token refresh failed: ${error}`);
    }

    const data = await response.json();
    return data as SalesforceAuthResponse;
  }

  /**
   * Revoke access token
   */
  async revokeToken(token: string): Promise<void> {
    const revokeUrl = this.config.sandbox 
      ? 'https://test.salesforce.com/services/oauth2/revoke'
      : 'https://login.salesforce.com/services/oauth2/revoke';

    const response = await fetch(revokeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `token=${encodeURIComponent(token)}`,
    });

    if (!response.ok && response.status !== 200) {
      const error = await response.text();
      throw new Error(`Failed to revoke Salesforce token: ${error}`);
    }
  }

  /**
   * Encrypt sensitive tokens for storage
   */
  encryptToken(token: string): string {
    const algorithm = 'aes-256-gcm';
    const key = Buffer.from(this.encryptionKey, 'base64');
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    
    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  }

  /**
   * Decrypt tokens from storage
   */
  decryptToken(encryptedToken: string): string {
    const algorithm = 'aes-256-gcm';
    const key = Buffer.from(this.encryptionKey, 'base64');
    
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

  /**
   * Store Salesforce integration in database
   */
  async storeIntegration(
    workspaceId: string,
    authResponse: SalesforceAuthResponse,
    userInfo: any
  ): Promise<{ data?: any; error?: string }> {
    try {
      const supabase = createClient();

      // Encrypt tokens
      const encryptedAccessToken = this.encryptToken(authResponse.access_token);
      const encryptedRefreshToken = this.encryptToken(authResponse.refresh_token);

      // Calculate expiration time (Salesforce tokens typically expire in 2 hours)
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 2);

      const { data, error } = await supabase
        .from('salesforce_integrations')
        .upsert({
          workspace_id: workspaceId,
          instance_url: authResponse.instance_url,
          access_token: encryptedAccessToken,
          refresh_token: encryptedRefreshToken,
          expires_at: expiresAt.toISOString(),
          salesforce_user_id: userInfo.user_id,
          salesforce_org_id: userInfo.organization_id,
          salesforce_username: userInfo.username,
          salesforce_email: userInfo.email,
          api_version: this.config.api_version || 'v59.0',
        })
        .select()
        .single();

      if (error) throw error;

      return { data };
    } catch (error) {
      console.error('Error storing Salesforce integration:', error);
      return { error: 'Failed to store integration' };
    }
  }

  /**
   * Get user info from Salesforce
   */
  async getUserInfo(accessToken: string, instanceUrl: string): Promise<any> {
    const response = await fetch(`${instanceUrl}/services/oauth2/userinfo`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get Salesforce user info: ${error}`);
    }

    return response.json();
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(
    payload: string,
    signature: string,
    secret: string
  ): boolean {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload, 'utf8');
    const expectedSignature = hmac.digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Generate a webhook secret
   */
  generateWebhookSecret(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Check if token is expired
   */
  isTokenExpired(expiresAt: string): boolean {
    return new Date(expiresAt) <= new Date();
  }

  /**
   * Get valid access token (refresh if needed)
   */
  async getValidAccessToken(
    workspaceId: string
  ): Promise<{ accessToken?: string; instanceUrl?: string; error?: string }> {
    try {
      const supabase = createClient();

      // Get integration
      const { data: integration, error } = await supabase
        .from('salesforce_integrations')
        .select('*')
        .eq('workspace_id', workspaceId)
        .single();

      if (error || !integration) {
        return { error: 'Salesforce integration not found' };
      }

      // Decrypt access token
      let accessToken = this.decryptToken(integration.access_token);

      // Check if token is expired
      if (this.isTokenExpired(integration.expires_at)) {
        // Refresh token
        const refreshToken = this.decryptToken(integration.refresh_token);
        const newTokens = await this.refreshAccessToken(refreshToken);

        // Update tokens in database
        const encryptedAccessToken = this.encryptToken(newTokens.access_token);
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 2);

        await supabase
          .from('salesforce_integrations')
          .update({
            access_token: encryptedAccessToken,
            expires_at: expiresAt.toISOString(),
          })
          .eq('id', integration.id);

        accessToken = newTokens.access_token;
      }

      return {
        accessToken,
        instanceUrl: integration.instance_url,
      };
    } catch (error) {
      console.error('Error getting valid access token:', error);
      return { error: 'Failed to get valid access token' };
    }
  }
}