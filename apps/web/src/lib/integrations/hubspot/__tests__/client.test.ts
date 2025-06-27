import { HubSpotClient } from '../client';
import { HubSpotAuth } from '../auth';
import {
  HubSpotAuthError,
  HubSpotRateLimitError,
  HubSpotValidationError,
  HubSpotApiError,
} from '../types';

// Mock dependencies
jest.mock('../auth');

// Mock fetch globally
global.fetch = jest.fn();

describe('HubSpotClient', () => {
  let hubspotClient: HubSpotClient;
  let mockAuth: jest.Mocked<HubSpotAuth>;
  let mockFetch: jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mocked fetch
    mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

    // Mock HubSpot auth
    mockAuth = {
      getValidAccessToken: jest.fn(),
      refreshAccessToken: jest.fn(),
      getIntegration: jest.fn(),
    } as any;

    (HubSpotAuth as jest.Mock).mockImplementation(() => mockAuth);

    hubspotClient = new HubSpotClient('workspace-123');
  });

  describe('Authentication', () => {
    it('should include access token in requests', async () => {
      // Arrange
      const accessToken = 'valid-access-token';
      mockAuth.getValidAccessToken.mockResolvedValue(accessToken);

      const mockResponse = {
        id: 'contact-123',
        properties: { email: 'test@example.com' },
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse,
        headers: new Headers(),
      } as Response);

      // Act
      await hubspotClient.get('/crm/v3/objects/contacts/123');

      // Assert
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.hubapi.com/crm/v3/objects/contacts/123',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': `Bearer ${accessToken}`,
          }),
        })
      );
    });

    it('should refresh token on 401 error and retry', async () => {
      // Arrange
      const expiredToken = 'expired-token';
      const newToken = 'new-access-token';
      
      mockAuth.getValidAccessToken
        .mockResolvedValueOnce(expiredToken)
        .mockResolvedValueOnce(newToken);

      const mockResponse = {
        id: 'contact-123',
        properties: { email: 'test@example.com' },
      };

      // First call returns 401, second succeeds
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          json: async () => ({
            status: 'error',
            message: 'Invalid or expired token',
            category: 'UNAUTHORIZED',
          }),
          headers: new Headers(),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockResponse,
          headers: new Headers(),
        } as Response);

      // Act
      const result = await hubspotClient.get('/crm/v3/objects/contacts/123');

      // Assert
      expect(result).toEqual(mockResponse);
      expect(mockAuth.getValidAccessToken).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenCalledTimes(2);
      
      // Verify second call uses new token
      expect(mockFetch).toHaveBeenNthCalledWith(2,
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': `Bearer ${newToken}`,
          }),
        })
      );
    });

    it('should throw AuthError when token refresh fails', async () => {
      // Arrange
      const expiredToken = 'expired-token';
      mockAuth.getValidAccessToken.mockResolvedValue(expiredToken);
      mockAuth.getValidAccessToken.mockRejectedValueOnce(
        new HubSpotAuthError('Refresh token expired')
      );

      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({
          status: 'error',
          message: 'Invalid or expired token',
        }),
        headers: new Headers(),
      } as Response);

      // Act & Assert
      await expect(hubspotClient.get('/crm/v3/objects/contacts/123'))
        .rejects
        .toThrow(HubSpotAuthError);
    });
  });

  describe('Rate Limiting', () => {
    it('should handle rate limiting with retry-after header', async () => {
      // Arrange
      const accessToken = 'valid-token';
      mockAuth.getValidAccessToken.mockResolvedValue(accessToken);

      const mockResponse = {
        id: 'contact-123',
        properties: { email: 'test@example.com' },
      };

      // First call rate limited, second succeeds
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          headers: new Headers({
            'Retry-After': '2',
            'X-HubSpot-RateLimit-Remaining': '0',
          }),
          json: async () => ({
            status: 'error',
            message: 'Rate limit exceeded',
            category: 'RATE_LIMITS',
          }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockResponse,
          headers: new Headers(),
        } as Response);

      // Mock setTimeout to avoid actual delay in tests
      jest.useFakeTimers();

      // Act
      const resultPromise = hubspotClient.get('/crm/v3/objects/contacts/123');
      
      // Fast-forward time
      jest.advanceTimersByTime(2000);

      const result = await resultPromise;

      // Assert
      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledTimes(2);

      jest.useRealTimers();
    });

    it('should throw RateLimitError when max retries exceeded', async () => {
      // Arrange
      const accessToken = 'valid-token';
      mockAuth.getValidAccessToken.mockResolvedValue(accessToken);

      // Always return rate limit error
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        headers: new Headers({
          'Retry-After': '60',
        }),
        json: async () => ({
          status: 'error',
          message: 'Rate limit exceeded',
          category: 'RATE_LIMITS',
        }),
      } as Response);

      // Act & Assert
      await expect(hubspotClient.get('/crm/v3/objects/contacts/123'))
        .rejects
        .toThrow(HubSpotRateLimitError);
    });

    it('should respect rate limit headers for proactive throttling', async () => {
      // Arrange
      const accessToken = 'valid-token';
      mockAuth.getValidAccessToken.mockResolvedValue(accessToken);

      const mockResponse = { id: 'contact-123' };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({
          'X-HubSpot-RateLimit-Remaining': '1',
          'X-HubSpot-RateLimit-IntervalMilliseconds': '10000',
        }),
        json: async () => mockResponse,
      } as Response);

      // Act
      const result = await hubspotClient.get('/crm/v3/objects/contacts/123');

      // Assert
      expect(result).toEqual(mockResponse);
      // Should track rate limit state for future requests
      expect(hubspotClient.getRateLimitStatus()).toEqual({
        remaining: 1,
        resetTime: expect.any(Number),
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle validation errors', async () => {
      // Arrange
      const accessToken = 'valid-token';
      mockAuth.getValidAccessToken.mockResolvedValue(accessToken);

      const errorResponse: HubSpotApiError = {
        status: 'error',
        message: 'Invalid input',
        correlationId: 'correlation-123',
        category: 'VALIDATION_ERROR',
        errors: [
          {
            message: 'Email is required',
            in: 'email',
            code: 'REQUIRED',
          },
          {
            message: 'Invalid email format',
            in: 'email',
            code: 'INVALID_FORMAT',
          },
        ],
      };

      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => errorResponse,
        headers: new Headers(),
      } as Response);

      // Act & Assert
      try {
        await hubspotClient.post('/crm/v3/objects/contacts', {
          properties: { firstname: 'John' }, // Missing email
        });
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(HubSpotValidationError);
        expect((error as HubSpotValidationError).message).toBe('Invalid input');
        expect((error as HubSpotValidationError).errors).toEqual(errorResponse.errors);
      }
    });

    it('should handle not found errors', async () => {
      // Arrange
      const accessToken = 'valid-token';
      mockAuth.getValidAccessToken.mockResolvedValue(accessToken);

      const errorResponse = {
        status: 'error',
        message: 'Contact not found',
        category: 'OBJECT_NOT_FOUND',
        correlationId: 'correlation-456',
      };

      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => errorResponse,
        headers: new Headers(),
      } as Response);

      // Act & Assert
      await expect(hubspotClient.get('/crm/v3/objects/contacts/nonexistent'))
        .rejects
        .toThrow('Contact not found');
    });

    it('should handle server errors with retries', async () => {
      // Arrange
      const accessToken = 'valid-token';
      mockAuth.getValidAccessToken.mockResolvedValue(accessToken);

      const mockResponse = { id: 'contact-123' };

      // First two calls fail with 503, third succeeds
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          json: async () => ({ message: 'Service unavailable' }),
          headers: new Headers(),
        } as Response)
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          json: async () => ({ message: 'Service unavailable' }),
          headers: new Headers(),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockResponse,
          headers: new Headers(),
        } as Response);

      // Act
      const result = await hubspotClient.get('/crm/v3/objects/contacts/123');

      // Assert
      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should not retry on client errors (4xx)', async () => {
      // Arrange
      const accessToken = 'valid-token';
      mockAuth.getValidAccessToken.mockResolvedValue(accessToken);

      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          status: 'error',
          message: 'Bad request',
          category: 'VALIDATION_ERROR',
        }),
        headers: new Headers(),
      } as Response);

      // Act & Assert
      await expect(hubspotClient.get('/crm/v3/objects/contacts/invalid'))
        .rejects
        .toThrow('Bad request');

      expect(mockFetch).toHaveBeenCalledTimes(1); // No retry
    });

    it('should handle network errors with retries', async () => {
      // Arrange
      const accessToken = 'valid-token';
      mockAuth.getValidAccessToken.mockResolvedValue(accessToken);

      const mockResponse = { id: 'contact-123' };

      // First call network error, second succeeds
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockResponse,
          headers: new Headers(),
        } as Response);

      // Act
      const result = await hubspotClient.get('/crm/v3/objects/contacts/123');

      // Assert
      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Request Methods', () => {
    beforeEach(() => {
      const accessToken = 'valid-token';
      mockAuth.getValidAccessToken.mockResolvedValue(accessToken);
    });

    it('should make GET requests correctly', async () => {
      // Arrange
      const mockResponse = {
        id: 'contact-123',
        properties: { email: 'test@example.com' },
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse,
        headers: new Headers(),
      } as Response);

      // Act
      const result = await hubspotClient.get('/crm/v3/objects/contacts/123', {
        properties: 'email,firstname,lastname',
      });

      // Assert
      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.hubapi.com/crm/v3/objects/contacts/123?properties=email%2Cfirstname%2Clastname',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': 'Bearer valid-token',
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should make POST requests correctly', async () => {
      // Arrange
      const requestData = {
        properties: {
          email: 'new@example.com',
          firstname: 'New',
          lastname: 'Contact',
        },
      };

      const mockResponse = {
        id: 'contact-456',
        properties: requestData.properties,
        createdAt: '2024-01-15T10:00:00Z',
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => mockResponse,
        headers: new Headers(),
      } as Response);

      // Act
      const result = await hubspotClient.post('/crm/v3/objects/contacts', requestData);

      // Assert
      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.hubapi.com/crm/v3/objects/contacts',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer valid-token',
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify(requestData),
        })
      );
    });

    it('should make PATCH requests correctly', async () => {
      // Arrange
      const updateData = {
        properties: {
          firstname: 'Updated',
          lastname: 'Name',
        },
      };

      const mockResponse = {
        id: 'contact-123',
        properties: {
          email: 'existing@example.com',
          firstname: 'Updated',
          lastname: 'Name',
        },
        updatedAt: '2024-01-15T11:00:00Z',
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse,
        headers: new Headers(),
      } as Response);

      // Act
      const result = await hubspotClient.patch('/crm/v3/objects/contacts/123', updateData);

      // Assert
      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.hubapi.com/crm/v3/objects/contacts/123',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify(updateData),
        })
      );
    });

    it('should make DELETE requests correctly', async () => {
      // Arrange
      mockFetch.mockResolvedValue({
        ok: true,
        status: 204,
        text: async () => '',
        headers: new Headers(),
      } as Response);

      // Act
      await hubspotClient.delete('/crm/v3/objects/contacts/123');

      // Assert
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.hubapi.com/crm/v3/objects/contacts/123',
        expect.objectContaining({
          method: 'DELETE',
          headers: expect.objectContaining({
            'Authorization': 'Bearer valid-token',
          }),
        })
      );
    });
  });

  describe('Request Configuration', () => {
    beforeEach(() => {
      const accessToken = 'valid-token';
      mockAuth.getValidAccessToken.mockResolvedValue(accessToken);
    });

    it('should handle custom headers', async () => {
      // Arrange
      const customHeaders = {
        'X-Custom-Header': 'custom-value',
        'X-Request-ID': 'request-123',
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({}),
        headers: new Headers(),
      } as Response);

      // Act
      await hubspotClient.get('/crm/v3/objects/contacts', {}, { headers: customHeaders });

      // Assert
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer valid-token',
            'Content-Type': 'application/json',
            'X-Custom-Header': 'custom-value',
            'X-Request-ID': 'request-123',
          }),
        })
      );
    });

    it('should handle request timeout', async () => {
      // Arrange
      const timeoutMs = 5000;

      // Mock AbortController
      const mockAbortController = {
        abort: jest.fn(),
        signal: { aborted: false },
      };
      global.AbortController = jest.fn(() => mockAbortController) as any;

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({}),
        headers: new Headers(),
      } as Response);

      // Act
      await hubspotClient.get('/crm/v3/objects/contacts', {}, { timeout: timeoutMs });

      // Assert
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          signal: mockAbortController.signal,
        })
      );
    });

    it('should handle query parameters correctly', async () => {
      // Arrange
      const queryParams = {
        limit: 100,
        properties: ['email', 'firstname', 'lastname'],
        archived: false,
        'sort': 'createdate',
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ results: [] }),
        headers: new Headers(),
      } as Response);

      // Act
      await hubspotClient.get('/crm/v3/objects/contacts', queryParams);

      // Assert
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.hubapi.com/crm/v3/objects/contacts?limit=100&properties=email%2Cfirstname%2Clastname&archived=false&sort=createdate',
        expect.any(Object)
      );
    });

    it('should handle array query parameters', async () => {
      // Arrange
      const queryParams = {
        properties: ['email', 'firstname', 'lastname'],
        associations: ['companies', 'deals'],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({}),
        headers: new Headers(),
      } as Response);

      // Act
      await hubspotClient.get('/crm/v3/objects/contacts/123', queryParams);

      // Assert
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('properties=email%2Cfirstname%2Clastname'),
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('associations=companies%2Cdeals'),
        expect.any(Object)
      );
    });
  });

  describe('Response Handling', () => {
    beforeEach(() => {
      const accessToken = 'valid-token';
      mockAuth.getValidAccessToken.mockResolvedValue(accessToken);
    });

    it('should handle empty responses', async () => {
      // Arrange
      mockFetch.mockResolvedValue({
        ok: true,
        status: 204,
        text: async () => '',
        headers: new Headers(),
      } as Response);

      // Act
      const result = await hubspotClient.delete('/crm/v3/objects/contacts/123');

      // Assert
      expect(result).toBeUndefined();
    });

    it('should handle non-JSON responses', async () => {
      // Arrange
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => 'Plain text response',
        json: async () => {
          throw new Error('Not JSON');
        },
        headers: new Headers({ 'Content-Type': 'text/plain' }),
      } as Response);

      // Act
      const result = await hubspotClient.get('/some/text/endpoint');

      // Assert
      expect(result).toBe('Plain text response');
    });

    it('should parse JSON responses correctly', async () => {
      // Arrange
      const mockData = {
        id: 'contact-123',
        properties: {
          email: 'test@example.com',
          createdate: '2024-01-15T10:00:00.000Z',
        },
        createdAt: '2024-01-15T10:00:00.000Z',
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockData,
        headers: new Headers({ 'Content-Type': 'application/json' }),
      } as Response);

      // Act
      const result = await hubspotClient.get('/crm/v3/objects/contacts/123');

      // Assert
      expect(result).toEqual(mockData);
    });
  });

  describe('Batch Requests', () => {
    beforeEach(() => {
      const accessToken = 'valid-token';
      mockAuth.getValidAccessToken.mockResolvedValue(accessToken);
    });

    it('should handle batch requests with proper rate limiting', async () => {
      // Arrange
      const batchSize = 100;
      const requests = Array(250).fill(null).map((_, i) => ({
        path: `/crm/v3/objects/contacts/contact-${i}`,
        method: 'GET' as const,
      }));

      const mockBatchResponse = {
        results: Array(100).fill(null).map((_, i) => ({
          id: `contact-${i}`,
          status: 200,
          body: { id: `contact-${i}`, properties: {} },
        })),
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockBatchResponse,
        headers: new Headers({
          'X-HubSpot-RateLimit-Remaining': '50',
        }),
      } as Response);

      // Act
      const results = await hubspotClient.batch(requests, { batchSize });

      // Assert
      expect(mockFetch).toHaveBeenCalledTimes(3); // 100 + 100 + 50
      expect(results).toHaveLength(3);
    });

    it('should handle batch request failures gracefully', async () => {
      // Arrange
      const requests = [
        { path: '/crm/v3/objects/contacts/valid', method: 'GET' as const },
        { path: '/crm/v3/objects/contacts/invalid', method: 'GET' as const },
      ];

      const mockBatchResponse = {
        results: [
          {
            id: 'valid',
            status: 200,
            body: { id: 'contact-valid', properties: {} },
          },
          {
            id: 'invalid',
            status: 404,
            body: {
              status: 'error',
              message: 'Contact not found',
            },
          },
        ],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 207, // Multi-status
        json: async () => mockBatchResponse,
        headers: new Headers(),
      } as Response);

      // Act
      const results = await hubspotClient.batch(requests);

      // Assert
      expect(results[0].results[0].status).toBe(200);
      expect(results[0].results[1].status).toBe(404);
    });
  });

  describe('Request Logging', () => {
    beforeEach(() => {
      const accessToken = 'valid-token';
      mockAuth.getValidAccessToken.mockResolvedValue(accessToken);
    });

    it('should log requests in debug mode', async () => {
      // Arrange
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      process.env.NODE_ENV = 'development';

      const clientWithDebug = new HubSpotClient('workspace-123', { debug: true });

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({}),
        headers: new Headers(),
      } as Response);

      // Act
      await clientWithDebug.get('/crm/v3/objects/contacts/123');

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('HubSpot API Request:'),
        expect.any(Object)
      );

      consoleSpy.mockRestore();
    });

    it('should not log requests in production', async () => {
      // Arrange
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      process.env.NODE_ENV = 'production';

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({}),
        headers: new Headers(),
      } as Response);

      // Act
      await hubspotClient.get('/crm/v3/objects/contacts/123');

      // Assert
      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('Circuit Breaker', () => {
    beforeEach(() => {
      const accessToken = 'valid-token';
      mockAuth.getValidAccessToken.mockResolvedValue(accessToken);
    });

    it('should open circuit breaker after consecutive failures', async () => {
      // Arrange
      const clientWithCircuitBreaker = new HubSpotClient('workspace-123', {
        circuitBreaker: {
          failureThreshold: 3,
          resetTimeoutMs: 60000,
        },
      });

      // Mock consecutive failures
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ message: 'Internal server error' }),
        headers: new Headers(),
      } as Response);

      // Act & Assert
      // First 3 requests should attempt to reach the API
      for (let i = 0; i < 3; i++) {
        await expect(clientWithCircuitBreaker.get('/crm/v3/objects/contacts/123'))
          .rejects
          .toThrow();
      }

      // 4th request should fail immediately due to open circuit
      await expect(clientWithCircuitBreaker.get('/crm/v3/objects/contacts/123'))
        .rejects
        .toThrow('Circuit breaker is open');

      expect(mockFetch).toHaveBeenCalledTimes(3); // Should not call on 4th attempt
    });

    it('should close circuit breaker after successful request', async () => {
      // Arrange
      const clientWithCircuitBreaker = new HubSpotClient('workspace-123', {
        circuitBreaker: {
          failureThreshold: 2,
          resetTimeoutMs: 1000,
        },
      });

      // Mock failures followed by success
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({ message: 'Error 1' }),
          headers: new Headers(),
        } as Response)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({ message: 'Error 2' }),
          headers: new Headers(),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ id: 'contact-123' }),
          headers: new Headers(),
        } as Response);

      // Act
      // First 2 requests fail, opening circuit
      await expect(clientWithCircuitBreaker.get('/crm/v3/objects/contacts/123'))
        .rejects
        .toThrow();
      await expect(clientWithCircuitBreaker.get('/crm/v3/objects/contacts/123'))
        .rejects
        .toThrow();

      // Wait for reset timeout
      jest.useFakeTimers();
      jest.advanceTimersByTime(1000);

      // Next request should succeed and close circuit
      const result = await clientWithCircuitBreaker.get('/crm/v3/objects/contacts/123');

      // Assert
      expect(result).toEqual({ id: 'contact-123' });
      expect(mockFetch).toHaveBeenCalledTimes(3);

      jest.useRealTimers();
    });
  });
});