import { HubSpotAuth } from '../auth';
import { HubSpotOAuthConfig, HubSpotAuthError } from '../types';
import { createServerClient } from '@/lib/supabase/server';

// Mock dependencies
jest.mock('@/lib/supabase/server');
jest.mock('next/headers', () => ({
  cookies: jest.fn(() => ({
    get: jest.fn(),
    set: jest.fn(),
  })),
}));

// Mock fetch globally
global.fetch = jest.fn();

describe('HubSpotAuth', () => {
  let hubspotAuth: HubSpotAuth;
  let mockSupabase: any;
  let mockFetch: jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mocked fetch
    mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

    // Mock Supabase client
    mockSupabase = {
      auth: {
        getUser: jest.fn(),
      },
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      upsert: jest.fn().mockReturnThis(),
    };

    (createServerClient as jest.Mock).mockReturnValue(mockSupabase);

    // Initialize HubSpotAuth with test config
    const config: Partial<HubSpotOAuthConfig> = {
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      redirectUri: 'https://app.coldcopy.com/api/integrations/hubspot/callback',
      scopes: ['crm.objects.contacts.read', 'crm.objects.contacts.write'],
    };
    
    hubspotAuth = new HubSpotAuth(config);
  });

  describe('OAuth Authorization Flow', () => {
    it('should generate correct authorization URL', () => {
      // Arrange
      const state = 'workspace-123:user-456:random-state';

      // Act
      const authUrl = hubspotAuth.getAuthorizationUrl(state);

      // Assert
      const url = new URL(authUrl);
      expect(url.hostname).toBe('app.hubspot.com');
      expect(url.pathname).toBe('/oauth/authorize');
      expect(url.searchParams.get('client_id')).toBe('test-client-id');
      expect(url.searchParams.get('redirect_uri')).toBe('https://app.coldcopy.com/api/integrations/hubspot/callback');
      expect(url.searchParams.get('scope')).toBe('crm.objects.contacts.read crm.objects.contacts.write');
      expect(url.searchParams.get('state')).toBe(state);
    });

    it('should handle authorization URL with custom scopes', () => {
      // Arrange
      const customConfig: Partial<HubSpotOAuthConfig> = {
        clientId: 'custom-client',
        scopes: ['crm.objects.companies.read', 'timeline'],
      };
      const customAuth = new HubSpotAuth(customConfig);
      const state = 'test-state';

      // Act
      const authUrl = customAuth.getAuthorizationUrl(state);

      // Assert
      const url = new URL(authUrl);
      expect(url.searchParams.get('scope')).toBe('crm.objects.companies.read timeline');
    });
  });

  describe('Token Exchange', () => {
    it('should exchange authorization code for tokens successfully', async () => {
      // Arrange
      const code = 'auth-code-123';
      const mockTokenResponse = {
        access_token: 'access-token-abc',
        refresh_token: 'refresh-token-xyz',
        expires_in: 21600,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse,
      } as Response);

      // Act
      const tokens = await hubspotAuth.exchangeCodeForTokens(code);

      // Assert
      expect(tokens).toEqual({
        accessToken: 'access-token-abc',
        refreshToken: 'refresh-token-xyz',
        expiresIn: 21600,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.hubapi.com/oauth/v1/token',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: expect.stringContaining('grant_type=authorization_code'),
        })
      );
    });

    it('should handle token exchange errors', async () => {
      // Arrange
      const code = 'invalid-code';
      const errorResponse = {
        status: 'error',
        message: 'Invalid authorization code',
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => errorResponse,
      } as Response);

      // Act & Assert
      await expect(hubspotAuth.exchangeCodeForTokens(code))
        .rejects
        .toThrow(HubSpotAuthError);
    });

    it('should handle network errors during token exchange', async () => {
      // Arrange
      const code = 'auth-code-123';
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      // Act & Assert
      await expect(hubspotAuth.exchangeCodeForTokens(code))
        .rejects
        .toThrow('Network error');
    });
  });

  describe('Token Refresh', () => {
    it('should refresh access token successfully', async () => {
      // Arrange
      const refreshToken = 'refresh-token-xyz';
      const mockRefreshResponse = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 21600,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockRefreshResponse,
      } as Response);

      // Act
      const tokens = await hubspotAuth.refreshAccessToken(refreshToken);

      // Assert
      expect(tokens).toEqual({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresIn: 21600,
      });
    });

    it('should handle refresh token errors', async () => {
      // Arrange
      const refreshToken = 'expired-refresh-token';
      const errorResponse = {
        status: 'error',
        message: 'Invalid refresh token',
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => errorResponse,
      } as Response);

      // Act & Assert
      await expect(hubspotAuth.refreshAccessToken(refreshToken))
        .rejects
        .toThrow(HubSpotAuthError);
    });

    it('should retry refresh on temporary failure', async () => {
      // Arrange
      const refreshToken = 'refresh-token-xyz';
      const successResponse = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 21600,
      };

      // First call fails with 503, second succeeds
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          json: async () => ({ message: 'Service unavailable' }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => successResponse,
        } as Response);

      // Act
      const tokens = await hubspotAuth.refreshAccessToken(refreshToken);

      // Assert
      expect(tokens).toEqual({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresIn: 21600,
      });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Integration Management', () => {
    it('should save integration successfully', async () => {
      // Arrange
      const workspaceId = 'workspace-123';
      const tokens = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 21600,
      };
      const hubId = 'hub-123';

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      mockSupabase.single.mockResolvedValue({
        data: {
          id: 'integration-123',
          workspace_id: workspaceId,
          hub_id: hubId,
          access_token: 'encrypted-access-token',
          refresh_token: 'encrypted-refresh-token',
          expires_at: expect.any(Date),
        },
        error: null,
      });

      // Act
      const integration = await hubspotAuth.saveIntegration(workspaceId, tokens, hubId);

      // Assert
      expect(integration).toBeDefined();
      expect(integration.id).toBe('integration-123');
      expect(mockSupabase.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          workspace_id: workspaceId,
          hub_id: hubId,
          access_token: expect.any(String),
          refresh_token: expect.any(String),
          expires_at: expect.any(Date),
        })
      );
    });

    it('should get integration for workspace', async () => {
      // Arrange
      const workspaceId = 'workspace-123';
      const mockIntegration = {
        id: 'integration-123',
        workspace_id: workspaceId,
        hub_id: 'hub-123',
        access_token: 'encrypted-token',
        refresh_token: 'encrypted-refresh',
        expires_at: new Date(Date.now() + 3600000),
      };

      mockSupabase.single.mockResolvedValue({
        data: mockIntegration,
        error: null,
      });

      // Act
      const integration = await hubspotAuth.getIntegration(workspaceId);

      // Assert
      expect(integration).toBeDefined();
      expect(integration?.id).toBe('integration-123');
      expect(mockSupabase.from).toHaveBeenCalledWith('hubspot_integrations');
      expect(mockSupabase.eq).toHaveBeenCalledWith('workspace_id', workspaceId);
    });

    it('should return null when no integration exists', async () => {
      // Arrange
      const workspaceId = 'workspace-456';
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      });

      // Act
      const integration = await hubspotAuth.getIntegration(workspaceId);

      // Assert
      expect(integration).toBeNull();
    });

    it('should delete integration successfully', async () => {
      // Arrange
      const workspaceId = 'workspace-123';
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: null,
      });

      // Act
      await hubspotAuth.deleteIntegration(workspaceId);

      // Assert
      expect(mockSupabase.delete).toHaveBeenCalled();
      expect(mockSupabase.eq).toHaveBeenCalledWith('workspace_id', workspaceId);
    });
  });

  describe('Token Validation', () => {
    it('should validate non-expired token as valid', async () => {
      // Arrange
      const integration = {
        id: 'integration-123',
        workspace_id: 'workspace-123',
        access_token: 'valid-token',
        expires_at: new Date(Date.now() + 3600000), // 1 hour from now
      };

      mockSupabase.single.mockResolvedValue({
        data: integration,
        error: null,
      });

      // Act
      const isValid = await hubspotAuth.isTokenValid('workspace-123');

      // Assert
      expect(isValid).toBe(true);
    });

    it('should validate expired token as invalid', async () => {
      // Arrange
      const integration = {
        id: 'integration-123',
        workspace_id: 'workspace-123',
        access_token: 'expired-token',
        expires_at: new Date(Date.now() - 3600000), // 1 hour ago
      };

      mockSupabase.single.mockResolvedValue({
        data: integration,
        error: null,
      });

      // Act
      const isValid = await hubspotAuth.isTokenValid('workspace-123');

      // Assert
      expect(isValid).toBe(false);
    });

    it('should handle token validation errors', async () => {
      // Arrange
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      // Act
      const isValid = await hubspotAuth.isTokenValid('workspace-123');

      // Assert
      expect(isValid).toBe(false);
    });
  });

  describe('Auto Token Refresh', () => {
    it('should auto-refresh expired token', async () => {
      // Arrange
      const workspaceId = 'workspace-123';
      const expiredIntegration = {
        id: 'integration-123',
        workspace_id: workspaceId,
        access_token: 'expired-token',
        refresh_token: 'refresh-token',
        expires_at: new Date(Date.now() - 3600000), // expired
      };

      const newTokens = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 21600,
      };

      mockSupabase.single
        .mockResolvedValueOnce({ data: expiredIntegration, error: null })
        .mockResolvedValueOnce({ data: { ...expiredIntegration, ...newTokens }, error: null });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => newTokens,
      } as Response);

      // Act
      const token = await hubspotAuth.getValidAccessToken(workspaceId);

      // Assert
      expect(token).toBe('new-access-token');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/oauth/v1/token'),
        expect.any(Object)
      );
      expect(mockSupabase.update).toHaveBeenCalled();
    });

    it('should throw error when refresh fails', async () => {
      // Arrange
      const workspaceId = 'workspace-123';
      const expiredIntegration = {
        id: 'integration-123',
        workspace_id: workspaceId,
        access_token: 'expired-token',
        refresh_token: 'invalid-refresh-token',
        expires_at: new Date(Date.now() - 3600000),
      };

      mockSupabase.single.mockResolvedValue({ data: expiredIntegration, error: null });
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Invalid refresh token' }),
      } as Response);

      // Act & Assert
      await expect(hubspotAuth.getValidAccessToken(workspaceId))
        .rejects
        .toThrow(HubSpotAuthError);
    });
  });

  describe('Scope Management', () => {
    it('should check if integration has required scopes', async () => {
      // Arrange
      const integration = {
        id: 'integration-123',
        workspace_id: 'workspace-123',
        scopes: ['crm.objects.contacts.read', 'crm.objects.contacts.write'],
      };

      mockSupabase.single.mockResolvedValue({ data: integration, error: null });

      // Act
      const hasScopes = await hubspotAuth.hasRequiredScopes(
        'workspace-123',
        ['crm.objects.contacts.read']
      );

      // Assert
      expect(hasScopes).toBe(true);
    });

    it('should return false when missing required scopes', async () => {
      // Arrange
      const integration = {
        id: 'integration-123',
        workspace_id: 'workspace-123',
        scopes: ['crm.objects.contacts.read'],
      };

      mockSupabase.single.mockResolvedValue({ data: integration, error: null });

      // Act
      const hasScopes = await hubspotAuth.hasRequiredScopes(
        'workspace-123',
        ['crm.objects.contacts.write', 'crm.objects.deals.read']
      );

      // Assert
      expect(hasScopes).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle HubSpot API errors with proper error codes', async () => {
      // Arrange
      const code = 'auth-code-123';
      const errorResponse = {
        status: 'error',
        message: 'Invalid client credentials',
        category: 'VALIDATION_ERROR',
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => errorResponse,
      } as Response);

      // Act & Assert
      try {
        await hubspotAuth.exchangeCodeForTokens(code);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(HubSpotAuthError);
        expect((error as HubSpotAuthError).message).toBe('Invalid client credentials');
        expect((error as HubSpotAuthError).code).toBe('VALIDATION_ERROR');
      }
    });

    it('should handle rate limiting', async () => {
      // Arrange
      const refreshToken = 'refresh-token';
      
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Headers({
          'Retry-After': '60',
        }),
        json: async () => ({ message: 'Rate limit exceeded' }),
      } as Response);

      // Act & Assert
      await expect(hubspotAuth.refreshAccessToken(refreshToken))
        .rejects
        .toThrow('Rate limit exceeded');
    });
  });
});