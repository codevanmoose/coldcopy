import { createServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import {
  PipedriveOAuthConfig,
  PipedriveOAuthTokens,
  PipedriveAuthError,
  PipedriveIntegration,
} from './types';

const PIPEDRIVE_OAUTH_URL = 'https://oauth.pipedrive.com/oauth/authorize';
const PIPEDRIVE_TOKEN_URL = 'https://oauth.pipedrive.com/oauth/token';

export class PipedriveAuth {
  private config: PipedriveOAuthConfig;
  private encryptionKey: string;

  constructor(config?: Partial<PipedriveOAuthConfig>) {
    this.config = {
      clientId: config?.clientId || process.env.PIPEDRIVE_CLIENT_ID!,
      clientSecret: config?.clientSecret || process.env.PIPEDRIVE_CLIENT_SECRET!,
      redirectUri: config?.redirectUri || process.env.PIPEDRIVE_REDIRECT_URI!,
      scopes: config?.scopes || [
        'deals:read',
        'deals:write',
        'persons:read',
        'persons:write',
        'organizations:read',
        'organizations:write',
        'activities:read',
        'activities:write',
        'pipelines:read',
        'stages:read',
        'users:read',
        'base'
      ],
      authUrl: config?.authUrl || PIPEDRIVE_OAUTH_URL,
      tokenUrl: config?.tokenUrl || PIPEDRIVE_TOKEN_URL,
    };

    this.encryptionKey = process.env.ENCRYPTION_KEY || process.env.NEXTAUTH_SECRET || '';
    if (!this.encryptionKey) {
      throw new Error('ENCRYPTION_KEY or NEXTAUTH_SECRET must be set for secure token storage');
    }
  }

  /**
   * Generate OAuth authorization URL
   */
  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: this.config.scopes.join(' '),
      state,
    });

    return `${this.config.authUrl}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access tokens
   */
  async exchangeCodeForTokens(code: string): Promise<PipedriveOAuthTokens> {
    const response = await fetch(this.config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        redirect_uri: this.config.redirectUri,
        code,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'invalid_request' }));
      throw new PipedriveAuthError(
        error.error_description || error.error || 'Failed to exchange code for tokens',
        error.error
      );
    }

    const data = await response.json();
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
      token_type: data.token_type || 'Bearer',
      scope: data.scope,
    };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<PipedriveOAuthTokens> {
    const response = await fetch(this.config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'invalid_grant' }));
      throw new PipedriveAuthError(
        error.error_description || error.error || 'Failed to refresh access token',
        error.error
      );
    }

    const data = await response.json();
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token || refreshToken, // Keep old refresh token if new one not provided
      expires_in: data.expires_in,
      token_type: data.token_type || 'Bearer',
      scope: data.scope,
    };
  }

  /**
   * Get company info to verify connection and get company domain
   */
  async getCompanyInfo(accessToken: string): Promise<{ companyDomain: string; companyId: number }> {
    // First, get user info to get company ID
    const userResponse = await fetch('https://api.pipedrive.com/v1/users/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!userResponse.ok) {
      throw new PipedriveAuthError('Failed to get user info');
    }

    const userData = await userResponse.json();
    if (!userData.success) {
      throw new PipedriveAuthError('Failed to get user info: ' + userData.error);
    }

    const companyId = userData.data.company_id;
    const companyDomain = userData.data.company_domain;

    if (!companyDomain) {
      throw new PipedriveAuthError('Could not determine company domain');
    }

    return {
      companyDomain,
      companyId,
    };
  }

  /**
   * Encrypt sensitive data for storage
   */
  private encrypt(text: string): string {
    const algorithm = 'aes-256-gcm';
    const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(algorithm, key);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  }

  /**
   * Decrypt sensitive data from storage
   */
  private decrypt(encryptedText: string): string {
    const algorithm = 'aes-256-gcm';
    const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
    
    const parts = encryptedText.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    
    const decipher = crypto.createDecipher(algorithm, key);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Save integration to database with encrypted tokens
   */
  async saveIntegration(
    workspaceId: string,
    tokens: PipedriveOAuthTokens,
    companyDomain: string
  ): Promise<PipedriveIntegration> {
    const supabase = createServerClient(cookies());

    const expiresAt = tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null;

    const { data, error } = await supabase
      .from('pipedrive_integrations')
      .upsert({
        workspace_id: workspaceId,
        company_domain: companyDomain,
        access_token: this.encrypt(tokens.access_token),
        refresh_token: tokens.refresh_token ? this.encrypt(tokens.refresh_token) : null,
        expires_at: expiresAt?.toISOString(),
        token_type: tokens.token_type,
        scopes: tokens.scope ? tokens.scope.split(' ') : this.config.scopes,
      })
      .select()
      .single();

    if (error) {
      throw new PipedriveAuthError('Failed to save integration: ' + error.message);
    }

    return {
      ...data,
      accessToken: tokens.access_token, // Return decrypted for immediate use
      refreshToken: tokens.refresh_token,
    };
  }

  /**
   * Get integration from database with decrypted tokens
   */
  async getIntegration(workspaceId: string): Promise<PipedriveIntegration | null> {
    const supabase = createServerClient(cookies());

    const { data, error } = await supabase
      .from('pipedrive_integrations')
      .select('*')
      .eq('workspace_id', workspaceId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new PipedriveAuthError('Failed to get integration: ' + error.message);
    }

    try {
      return {
        ...data,
        accessToken: this.decrypt(data.access_token),
        refreshToken: data.refresh_token ? this.decrypt(data.refresh_token) : null,
      };
    } catch (decryptError) {
      throw new PipedriveAuthError('Failed to decrypt stored tokens: ' + (decryptError as Error).message);
    }
  }

  /**
   * Get valid access token (refresh if needed)
   */
  async getValidAccessToken(workspaceId: string): Promise<string> {
    const integration = await this.getIntegration(workspaceId);
    if (!integration) {
      throw new PipedriveAuthError('No Pipedrive integration found');
    }

    // If using API token fallback, return it directly
    if (integration.apiToken) {
      return integration.apiToken;
    }

    if (!integration.expiresAt) {
      // If no expiration time, assume token is still valid
      return integration.accessToken;
    }

    const now = new Date();
    const expiresAt = new Date(integration.expiresAt);

    // Refresh if token expires in less than 5 minutes
    if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
      if (!integration.refreshToken) {
        throw new PipedriveAuthError('Access token expired and no refresh token available');
      }

      try {
        const tokens = await this.refreshAccessToken(integration.refreshToken);
        await this.saveIntegration(workspaceId, tokens, integration.companyDomain);
        return tokens.access_token;
      } catch (refreshError) {
        throw new PipedriveAuthError('Failed to refresh access token: ' + (refreshError as Error).message);
      }
    }

    return integration.accessToken;
  }

  /**
   * Disconnect integration
   */
  async disconnect(workspaceId: string): Promise<void> {
    const supabase = createServerClient(cookies());

    const { error } = await supabase
      .from('pipedrive_integrations')
      .delete()
      .eq('workspace_id', workspaceId);

    if (error) {
      throw new PipedriveAuthError('Failed to disconnect integration: ' + error.message);
    }

    // Also delete related data
    await Promise.all([
      supabase.from('pipedrive_field_mappings').delete().eq('workspace_id', workspaceId),
      supabase.from('pipedrive_sync_status').delete().eq('workspace_id', workspaceId),
      supabase.from('pipedrive_activity_log').delete().eq('workspace_id', workspaceId),
      supabase.from('pipedrive_stage_history').delete().eq('workspace_id', workspaceId),
      supabase.from('sync_conflicts').delete().eq('workspace_id', workspaceId).eq('entity_type', 'pipedrive'),
    ]);
  }

  /**
   * Verify webhook request signature (if Pipedrive provides webhook signatures)
   */
  verifyWebhookSignature(
    signature: string,
    webhookSecret: string,
    requestBody: string
  ): boolean {
    try {
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(requestBody)
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch (error) {
      return false;
    }
  }

  /**
   * Validate webhook origin (check if request comes from Pipedrive IPs)
   */
  validateWebhookOrigin(clientIP: string): boolean {
    // Pipedrive webhook IP ranges (example - should be updated with actual ranges)
    const allowedRanges = [
      '185.166.142.0/24',
      '185.166.143.0/24'
    ];

    // In a real implementation, you would check if clientIP is within these ranges
    // This is a simplified example
    return true; // Implement proper IP range validation
  }

  /**
   * Set API token as fallback authentication method
   */
  async setApiToken(workspaceId: string, apiToken: string, companyDomain: string): Promise<void> {
    const supabase = createServerClient(cookies());

    const { error } = await supabase
      .from('pipedrive_integrations')
      .upsert({
        workspace_id: workspaceId,
        company_domain: companyDomain,
        access_token: '', // Empty for API token auth
        api_token: this.encrypt(apiToken),
        token_type: 'API',
        scopes: [], // API tokens have full access
      });

    if (error) {
      throw new PipedriveAuthError('Failed to save API token: ' + error.message);
    }
  }

  /**
   * Test connection to Pipedrive API
   */
  async testConnection(workspaceId: string): Promise<boolean> {
    try {
      const accessToken = await this.getValidAccessToken(workspaceId);
      const companyInfo = await this.getCompanyInfo(accessToken);
      return !!companyInfo.companyDomain;
    } catch (error) {
      return false;
    }
  }
}