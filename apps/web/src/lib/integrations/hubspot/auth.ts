import { createServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import {
  HubSpotOAuthConfig,
  HubSpotOAuthTokens,
  HubSpotAuthError,
  HubSpotIntegration,
} from './types';

const HUBSPOT_OAUTH_URL = 'https://app.hubspot.com/oauth/authorize';
const HUBSPOT_TOKEN_URL = 'https://api.hubapi.com/oauth/v1/token';

export class HubSpotAuth {
  private config: HubSpotOAuthConfig;

  constructor(config?: Partial<HubSpotOAuthConfig>) {
    this.config = {
      clientId: config?.clientId || process.env.HUBSPOT_CLIENT_ID!,
      clientSecret: config?.clientSecret || process.env.HUBSPOT_CLIENT_SECRET!,
      redirectUri: config?.redirectUri || process.env.HUBSPOT_REDIRECT_URI!,
      scopes: config?.scopes || [
        'crm.objects.contacts.read',
        'crm.objects.contacts.write',
        'crm.objects.companies.read',
        'crm.objects.companies.write',
        'crm.objects.deals.read',
        'crm.objects.deals.write',
        'sales-email-read',
        'timeline',
      ],
    };
  }

  /**
   * Generate OAuth authorization URL
   */
  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: this.config.scopes.join(' '),
      state,
    });

    return `${HUBSPOT_OAUTH_URL}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access tokens
   */
  async exchangeCodeForTokens(code: string): Promise<HubSpotOAuthTokens> {
    const response = await fetch(HUBSPOT_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
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
      const error = await response.json();
      throw new HubSpotAuthError(
        error.message || 'Failed to exchange code for tokens',
        error.error
      );
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<HubSpotOAuthTokens> {
    const response = await fetch(HUBSPOT_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new HubSpotAuthError(
        error.message || 'Failed to refresh access token',
        error.error
      );
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    };
  }

  /**
   * Get account info to verify connection
   */
  async getAccountInfo(accessToken: string): Promise<{ portalId: string }> {
    const response = await fetch('https://api.hubapi.com/oauth/v1/access-tokens/' + accessToken, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new HubSpotAuthError('Failed to get account info');
    }

    const data = await response.json();
    return {
      portalId: data.hub_id.toString(),
    };
  }

  /**
   * Save integration to database
   */
  async saveIntegration(
    workspaceId: string,
    tokens: HubSpotOAuthTokens,
    hubId: string
  ): Promise<HubSpotIntegration> {
    const supabase = createServerClient(cookies());

    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + tokens.expiresIn);

    const { data, error } = await supabase
      .from('hubspot_integrations')
      .upsert({
        workspace_id: workspaceId,
        hub_id: hubId,
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        expires_at: expiresAt.toISOString(),
        scopes: this.config.scopes,
      })
      .select()
      .single();

    if (error) {
      throw new HubSpotAuthError('Failed to save integration: ' + error.message);
    }

    return data;
  }

  /**
   * Get integration from database
   */
  async getIntegration(workspaceId: string): Promise<HubSpotIntegration | null> {
    const supabase = createServerClient(cookies());

    const { data, error } = await supabase
      .from('hubspot_integrations')
      .select('*')
      .eq('workspace_id', workspaceId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new HubSpotAuthError('Failed to get integration: ' + error.message);
    }

    return data;
  }

  /**
   * Get valid access token (refresh if needed)
   */
  async getValidAccessToken(workspaceId: string): Promise<string> {
    const integration = await this.getIntegration(workspaceId);
    if (!integration) {
      throw new HubSpotAuthError('No HubSpot integration found');
    }

    const now = new Date();
    const expiresAt = new Date(integration.expiresAt);

    // Refresh if token expires in less than 5 minutes
    if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
      const tokens = await this.refreshAccessToken(integration.refreshToken);
      await this.saveIntegration(workspaceId, tokens, integration.hubId);
      return tokens.accessToken;
    }

    return integration.accessToken;
  }

  /**
   * Disconnect integration
   */
  async disconnect(workspaceId: string): Promise<void> {
    const supabase = createServerClient(cookies());

    const { error } = await supabase
      .from('hubspot_integrations')
      .delete()
      .eq('workspace_id', workspaceId);

    if (error) {
      throw new HubSpotAuthError('Failed to disconnect integration: ' + error.message);
    }

    // Also delete related data
    await Promise.all([
      supabase.from('hubspot_field_mappings').delete().eq('workspace_id', workspaceId),
      supabase.from('hubspot_sync_status').delete().eq('workspace_id', workspaceId),
      supabase.from('hubspot_activity_log').delete().eq('workspace_id', workspaceId),
    ]);
  }

  /**
   * Verify webhook request signature
   */
  verifyWebhookSignature(
    signature: string,
    clientSecret: string,
    requestBody: string
  ): boolean {
    const crypto = require('crypto');
    const hash = crypto
      .createHash('sha256')
      .update(clientSecret + requestBody)
      .digest('hex');

    return hash === signature;
  }
}