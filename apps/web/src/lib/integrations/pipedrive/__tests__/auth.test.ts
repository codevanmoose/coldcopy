import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  PipedriveAuth, 
  exchangeCodeForTokens, 
  refreshAccessToken,
  validateWebhookSignature,
  getAuthorizationUrl,
  revokeTokens
} from '../auth';
import { 
  mockSupabaseClient, 
  mockFetch, 
  createMockOAuthTokens,
  testConfig 
} from './test-utils';
import { TEST_ENV } from './test.config';
import crypto from 'crypto';

describe('Pipedrive Authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockClear();
  });

  describe('OAuth2 Flow', () => {
    it('should generate correct authorization URL', () => {
      const state = 'test-state-123';
      const redirectUri = 'https://app.example.com/auth/callback';
      const clientId = 'test-client-id';
      
      const url = getAuthorizationUrl({
        clientId,
        redirectUri,
        state,
        scope: ['read', 'write']
      });

      expect(url).toContain('https://oauth.pipedrive.com/oauth/authorize');
      expect(url).toContain(`client_id=${clientId}`);
      expect(url).toContain(`redirect_uri=${encodeURIComponent(redirectUri)}`);
      expect(url).toContain(`state=${state}`);
      expect(url).toContain('scope=read%20write');
    });

    it('should exchange authorization code for tokens', async () => {
      const mockTokens = createMockOAuthTokens();
      const code = 'test-auth-code';
      const clientId = 'test-client-id';
      const clientSecret = 'test-client-secret';
      const redirectUri = 'https://app.example.com/auth/callback';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockTokens
      });

      const tokens = await exchangeCodeForTokens({
        code,
        clientId,
        clientSecret,
        redirectUri
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://oauth.pipedrive.com/oauth/token',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json'
          },
          body: expect.stringContaining('grant_type=authorization_code')
        })
      );

      expect(tokens).toEqual(mockTokens);
    });

    it('should handle token exchange errors', async () => {
      const code = 'invalid-code';
      const clientId = 'test-client-id';
      const clientSecret = 'test-client-secret';
      const redirectUri = 'https://app.example.com/auth/callback';

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: 'invalid_grant',
          error_description: 'Invalid authorization code'
        })
      });

      await expect(
        exchangeCodeForTokens({
          code,
          clientId,
          clientSecret,
          redirectUri
        })
      ).rejects.toThrow('Invalid authorization code');
    });

    it('should refresh access token', async () => {
      const mockTokens = createMockOAuthTokens();
      const refreshToken = 'test-refresh-token';
      const clientId = 'test-client-id';
      const clientSecret = 'test-client-secret';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockTokens
      });

      const tokens = await refreshAccessToken({
        refreshToken,
        clientId,
        clientSecret
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://oauth.pipedrive.com/oauth/token',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('grant_type=refresh_token')
        })
      );

      expect(tokens).toEqual(mockTokens);
    });

    it('should handle refresh token expiry', async () => {
      const refreshToken = 'expired-refresh-token';
      const clientId = 'test-client-id';
      const clientSecret = 'test-client-secret';

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          error: 'invalid_token',
          error_description: 'Refresh token expired'
        })
      });

      await expect(
        refreshAccessToken({
          refreshToken,
          clientId,
          clientSecret
        })
      ).rejects.toThrow('Refresh token expired');
    });

    it('should revoke tokens', async () => {
      const token = 'test-access-token';
      const clientId = 'test-client-id';
      const clientSecret = 'test-client-secret';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true })
      });

      await revokeTokens({
        token,
        clientId,
        clientSecret
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://oauth.pipedrive.com/oauth/revoke',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining(`token=${token}`)
        })
      );
    });
  });

  describe('Token Management', () => {
    let auth: PipedriveAuth;

    beforeEach(() => {
      auth = new PipedriveAuth({
        ...testConfig,
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        redirectUri: 'https://app.example.com/auth/callback',
        supabaseClient: mockSupabaseClient
      });
    });

    it('should store tokens in database', async () => {
      const tokens = createMockOAuthTokens();
      const workspaceId = 'test-workspace-id';
      const userId = 'test-user-id';

      mockSupabaseClient.from.mockReturnValue({
        ...mockSupabaseClient,
        upsert: vi.fn().mockResolvedValue({ data: null, error: null })
      });

      await auth.storeTokens({
        workspaceId,
        userId,
        tokens
      });

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('pipedrive_connections');
      expect(mockSupabaseClient.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          workspace_id: workspaceId,
          user_id: userId,
          access_token: expect.any(String), // Should be encrypted
          refresh_token: expect.any(String), // Should be encrypted
          expires_at: expect.any(Date)
        })
      );
    });

    it('should retrieve and decrypt tokens', async () => {
      const workspaceId = 'test-workspace-id';
      const encryptedTokens = {
        access_token: 'encrypted-access-token',
        refresh_token: 'encrypted-refresh-token',
        expires_at: new Date(Date.now() + 3600000)
      };

      mockSupabaseClient.single.mockResolvedValue({
        data: {
          ...encryptedTokens,
          workspace_id: workspaceId
        },
        error: null
      });

      const tokens = await auth.getTokens(workspaceId);

      expect(tokens).toBeDefined();
      expect(tokens.access_token).toBeTruthy();
      expect(tokens.refresh_token).toBeTruthy();
    });

    it('should auto-refresh expired tokens', async () => {
      const workspaceId = 'test-workspace-id';
      const expiredTokens = {
        access_token: 'expired-access-token',
        refresh_token: 'valid-refresh-token',
        expires_at: new Date(Date.now() - 3600000) // Expired 1 hour ago
      };

      mockSupabaseClient.single.mockResolvedValue({
        data: expiredTokens,
        error: null
      });

      const newTokens = createMockOAuthTokens();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => newTokens
      });

      const tokens = await auth.getValidTokens(workspaceId);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/oauth/token'),
        expect.objectContaining({
          body: expect.stringContaining('grant_type=refresh_token')
        })
      );

      expect(tokens.access_token).toBe(newTokens.access_token);
    });

    it('should handle concurrent token refresh requests', async () => {
      const workspaceId = 'test-workspace-id';
      const expiredTokens = {
        access_token: 'expired-access-token',
        refresh_token: 'valid-refresh-token',
        expires_at: new Date(Date.now() - 3600000)
      };

      mockSupabaseClient.single.mockResolvedValue({
        data: expiredTokens,
        error: null
      });

      const newTokens = createMockOAuthTokens();
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => newTokens
      });

      // Simulate concurrent requests
      const requests = Array(5).fill(null).map(() => 
        auth.getValidTokens(workspaceId)
      );

      const results = await Promise.all(requests);

      // Should only refresh once
      expect(mockFetch).toHaveBeenCalledTimes(1);
      
      // All results should be the same
      results.forEach(result => {
        expect(result.access_token).toBe(newTokens.access_token);
      });
    });
  });

  describe('Webhook Signature Validation', () => {
    it('should validate correct webhook signature', () => {
      const secret = 'webhook-secret-123';
      const payload = JSON.stringify({ event: 'person.added', data: {} });
      const timestamp = Math.floor(Date.now() / 1000).toString();
      
      const signature = crypto
        .createHmac('sha256', secret)
        .update(`${timestamp}.${payload}`)
        .digest('hex');

      const isValid = validateWebhookSignature({
        signature: `t=${timestamp},v1=${signature}`,
        payload,
        secret
      });

      expect(isValid).toBe(true);
    });

    it('should reject invalid webhook signature', () => {
      const secret = 'webhook-secret-123';
      const payload = JSON.stringify({ event: 'person.added', data: {} });
      const timestamp = Math.floor(Date.now() / 1000).toString();
      
      const isValid = validateWebhookSignature({
        signature: `t=${timestamp},v1=invalid-signature`,
        payload,
        secret
      });

      expect(isValid).toBe(false);
    });

    it('should reject expired webhook signature', () => {
      const secret = 'webhook-secret-123';
      const payload = JSON.stringify({ event: 'person.added', data: {} });
      const oldTimestamp = (Math.floor(Date.now() / 1000) - 3600).toString(); // 1 hour old
      
      const signature = crypto
        .createHmac('sha256', secret)
        .update(`${oldTimestamp}.${payload}`)
        .digest('hex');

      const isValid = validateWebhookSignature({
        signature: `t=${oldTimestamp},v1=${signature}`,
        payload,
        secret,
        tolerance: 300 // 5 minute tolerance
      });

      expect(isValid).toBe(false);
    });

    it('should handle malformed signature header', () => {
      const secret = 'webhook-secret-123';
      const payload = JSON.stringify({ event: 'person.added', data: {} });

      expect(() => {
        validateWebhookSignature({
          signature: 'invalid-format',
          payload,
          secret
        });
      }).toThrow('Invalid signature format');
    });
  });

  describe('API Key Authentication', () => {
    it('should validate API key format', () => {
      const validKey = 'a1b2c3d4e5f6789012345678901234567890abcd';
      const invalidKeys = [
        'too-short',
        'invalid-characters-!@#$',
        '',
        null,
        undefined
      ];

      expect(PipedriveAuth.isValidApiKey(validKey)).toBe(true);
      
      invalidKeys.forEach(key => {
        expect(PipedriveAuth.isValidApiKey(key)).toBe(false);
      });
    });

    it('should add API key to request headers', () => {
      const apiKey = 'test-api-key';
      const headers = new Headers();
      
      PipedriveAuth.addApiKeyToHeaders(headers, apiKey);
      
      expect(headers.get('Authorization')).toBe(`Bearer ${apiKey}`);
    });

    it('should create authenticated client with API key', () => {
      const auth = new PipedriveAuth({
        ...testConfig,
        apiKey: 'test-api-key'
      });

      const client = auth.createAuthenticatedClient();
      
      expect(client).toBeDefined();
      expect(client.defaults.headers['Authorization']).toBe('Bearer test-api-key');
    });
  });

  describe('Session Management', () => {
    let auth: PipedriveAuth;

    beforeEach(() => {
      auth = new PipedriveAuth({
        ...testConfig,
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        supabaseClient: mockSupabaseClient
      });
    });

    it('should check if workspace is connected', async () => {
      const workspaceId = 'test-workspace-id';

      mockSupabaseClient.single.mockResolvedValue({
        data: {
          workspace_id: workspaceId,
          access_token: 'valid-token',
          expires_at: new Date(Date.now() + 3600000)
        },
        error: null
      });

      const isConnected = await auth.isConnected(workspaceId);
      
      expect(isConnected).toBe(true);
    });

    it('should disconnect workspace', async () => {
      const workspaceId = 'test-workspace-id';

      mockSupabaseClient.delete.mockReturnValue({
        ...mockSupabaseClient,
        eq: vi.fn().mockResolvedValue({ error: null })
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true })
      });

      await auth.disconnect(workspaceId);

      expect(mockSupabaseClient.delete).toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/oauth/revoke'),
        expect.any(Object)
      );
    });

    it('should handle token encryption and decryption', () => {
      const plainToken = 'test-token-123';
      const encryptionKey = 'test-encryption-key';

      const encrypted = auth.encryptToken(plainToken, encryptionKey);
      expect(encrypted).not.toBe(plainToken);
      expect(encrypted).toMatch(/^[a-f0-9]+:[a-f0-9]+$/);

      const decrypted = auth.decryptToken(encrypted, encryptionKey);
      expect(decrypted).toBe(plainToken);
    });
  });
});