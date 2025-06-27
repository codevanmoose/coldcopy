import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PipedriveClient } from '../client';
import { 
  mockFetch, 
  mockRedisClient,
  simulateRateLimit,
  simulateApiError,
  createApiResponse,
  createPaginatedResponse,
  testConfig,
  useMockTimers
} from './test-utils';
import { PipedriveError, RateLimitError, NetworkError } from '../errors';

describe('Pipedrive API Client', () => {
  let client: PipedriveClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockClear();
    client = new PipedriveClient({
      ...testConfig,
      redis: mockRedisClient
    });
  });

  describe('Request Building', () => {
    it('should build correct request URL with parameters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createApiResponse({ id: 1 })
      });

      await client.get('/persons', {
        start: 0,
        limit: 50,
        filter_id: 123,
        sort: 'name ASC'
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/persons?start=0&limit=50&filter_id=123&sort=name%20ASC'),
        expect.any(Object)
      );
    });

    it('should add authentication headers', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createApiResponse({})
      });

      await client.get('/persons');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': `Bearer ${testConfig.apiKey}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          })
        })
      );
    });

    it('should handle different HTTP methods', async () => {
      const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
      const testData = { name: 'Test' };

      for (const method of methods) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => createApiResponse({})
        });

        await client.request(method, '/test', testData);

        expect(mockFetch).toHaveBeenLastCalledWith(
          expect.any(String),
          expect.objectContaining({
            method,
            ...(method !== 'GET' && method !== 'DELETE' 
              ? { body: JSON.stringify(testData) }
              : {})
          })
        );
      }
    });
  });

  describe('Rate Limiting', () => {
    it('should respect rate limits', async () => {
      const maxRequests = 5;
      const windowMs = 1000;

      client = new PipedriveClient({
        ...testConfig,
        rateLimit: { maxRequests, windowMs },
        redis: mockRedisClient
      });

      mockRedisClient.incr.mockResolvedValue(1);
      mockRedisClient.expire.mockResolvedValue(1);
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => createApiResponse({})
      });

      // Make requests up to the limit
      for (let i = 0; i < maxRequests; i++) {
        mockRedisClient.incr.mockResolvedValueOnce(i + 1);
        await client.get('/test');
      }

      // Next request should be rate limited
      mockRedisClient.incr.mockResolvedValueOnce(maxRequests + 1);
      await expect(client.get('/test')).rejects.toThrow(RateLimitError);
    });

    it('should handle 429 responses', async () => {
      simulateRateLimit(mockFetch);

      await expect(client.get('/test')).rejects.toThrow(RateLimitError);
    });

    it('should implement exponential backoff', async () => {
      const timers = useMockTimers();
      
      // First two attempts fail
      simulateApiError(mockFetch, 503);
      simulateApiError(mockFetch, 503);
      
      // Third attempt succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createApiResponse({ success: true })
      });

      const promise = client.get('/test');

      // Fast-forward through retries
      await timers.advanceTime(1000); // First retry
      await timers.advanceTime(2000); // Second retry

      const result = await promise;
      expect(result.data).toEqual({ success: true });
      
      timers.cleanup();
    });

    it('should use sliding window rate limiting', async () => {
      const timers = useMockTimers();
      const maxRequests = 3;
      const windowMs = 10000;

      client = new PipedriveClient({
        ...testConfig,
        rateLimit: { maxRequests, windowMs },
        redis: mockRedisClient
      });

      mockRedisClient.zadd.mockResolvedValue(1);
      mockRedisClient.zrange.mockResolvedValue([]);
      mockRedisClient.zrem.mockResolvedValue(0);
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => createApiResponse({})
      });

      // Make 3 requests
      for (let i = 0; i < maxRequests; i++) {
        await client.get('/test');
      }

      // Advance time by half the window
      await timers.advanceTime(windowMs / 2);

      // Should still be rate limited
      mockRedisClient.zrange.mockResolvedValueOnce(
        Array(maxRequests).fill(Date.now().toString())
      );
      await expect(client.get('/test')).rejects.toThrow(RateLimitError);

      // Advance past the window
      await timers.advanceTime(windowMs);

      // Should be able to make requests again
      mockRedisClient.zrange.mockResolvedValueOnce([]);
      await expect(client.get('/test')).resolves.toBeDefined();

      timers.cleanup();
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors with proper error details', async () => {
      simulateApiError(mockFetch, 400, 'Invalid request parameters');

      try {
        await client.get('/test');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(PipedriveError);
        expect(error.statusCode).toBe(400);
        expect(error.message).toContain('Invalid request parameters');
      }
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network failure'));

      await expect(client.get('/test')).rejects.toThrow(NetworkError);
    });

    it('should retry on transient errors', async () => {
      // First attempt fails with 503
      simulateApiError(mockFetch, 503);
      
      // Second attempt succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createApiResponse({ id: 1 })
      });

      const result = await client.get('/test');
      
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result.data).toEqual({ id: 1 });
    });

    it('should not retry on client errors', async () => {
      simulateApiError(mockFetch, 400, 'Bad request');

      await expect(client.get('/test')).rejects.toThrow();
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should handle timeout errors', async () => {
      const timers = useMockTimers();
      
      mockFetch.mockImplementationOnce(() => 
        new Promise(resolve => setTimeout(resolve, 30000))
      );

      const promise = client.get('/test', {}, { timeout: 5000 });
      
      await timers.advanceTime(5001);
      
      await expect(promise).rejects.toThrow('Request timeout');
      
      timers.cleanup();
    });
  });

  describe('Pagination', () => {
    it('should handle paginated responses', async () => {
      const items = Array.from({ length: 150 }, (_, i) => ({ id: i + 1 }));
      
      // First page
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createPaginatedResponse(
          items.slice(0, 100),
          0,
          100,
          true
        )
      });

      // Second page
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createPaginatedResponse(
          items.slice(100, 150),
          100,
          100,
          false
        )
      });

      const allItems = await client.getAllPages('/items');
      
      expect(allItems).toHaveLength(150);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should respect pagination limits', async () => {
      const items = Array.from({ length: 500 }, (_, i) => ({ id: i + 1 }));
      
      for (let i = 0; i < 5; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => createPaginatedResponse(
            items.slice(i * 100, (i + 1) * 100),
            i * 100,
            100,
            i < 4
          )
        });
      }

      const allItems = await client.getAllPages('/items', { maxItems: 250 });
      
      expect(allItems).toHaveLength(250);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should handle pagination with custom parameters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createPaginatedResponse([], 0, 50, false)
      });

      await client.get('/items', {
        start: 100,
        limit: 50,
        filter_id: 123
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('start=100&limit=50&filter_id=123'),
        expect.any(Object)
      );
    });
  });

  describe('Response Caching', () => {
    it('should cache GET requests', async () => {
      const responseData = { id: 1, name: 'Test' };
      
      mockRedisClient.get.mockResolvedValueOnce(null);
      mockRedisClient.set.mockResolvedValueOnce('OK');
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createApiResponse(responseData)
      });

      // First request - cache miss
      const result1 = await client.get('/persons/1', {}, { cache: true });
      
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockRedisClient.set).toHaveBeenCalled();
      expect(result1.data).toEqual(responseData);

      // Second request - cache hit
      mockRedisClient.get.mockResolvedValueOnce(
        JSON.stringify(createApiResponse(responseData))
      );
      
      const result2 = await client.get('/persons/1', {}, { cache: true });
      
      expect(mockFetch).toHaveBeenCalledTimes(1); // No additional fetch
      expect(result2.data).toEqual(responseData);
    });

    it('should not cache non-GET requests', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => createApiResponse({})
      });

      await client.post('/persons', { name: 'Test' });
      
      expect(mockRedisClient.set).not.toHaveBeenCalled();
    });

    it('should invalidate cache on mutations', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => createApiResponse({})
      });

      mockRedisClient.del.mockResolvedValue(1);

      await client.put('/persons/1', { name: 'Updated' });
      
      expect(mockRedisClient.del).toHaveBeenCalledWith(
        expect.stringContaining('persons:1')
      );
    });

    it('should handle cache errors gracefully', async () => {
      mockRedisClient.get.mockRejectedValueOnce(new Error('Redis error'));
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createApiResponse({ id: 1 })
      });

      const result = await client.get('/persons/1', {}, { cache: true });
      
      expect(result.data).toEqual({ id: 1 });
      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe('Request Queuing', () => {
    it('should queue requests when rate limited', async () => {
      const timers = useMockTimers();
      
      client = new PipedriveClient({
        ...testConfig,
        rateLimit: { maxRequests: 1, windowMs: 1000 },
        redis: mockRedisClient
      });

      mockRedisClient.incr.mockResolvedValueOnce(1);
      mockRedisClient.incr.mockResolvedValueOnce(2);
      mockRedisClient.incr.mockResolvedValueOnce(1);
      
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => createApiResponse({})
      });

      // First request goes through
      await client.get('/test1');
      
      // Second request should be queued
      const promise2 = client.get('/test2');
      
      // Advance time to reset rate limit
      await timers.advanceTime(1100);
      
      await promise2;
      
      expect(mockFetch).toHaveBeenCalledTimes(2);
      
      timers.cleanup();
    });

    it('should process queued requests in order', async () => {
      const timers = useMockTimers();
      const results: number[] = [];
      
      client = new PipedriveClient({
        ...testConfig,
        rateLimit: { maxRequests: 1, windowMs: 500 },
        redis: mockRedisClient
      });

      // Mock rate limit checks
      mockRedisClient.incr
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(1);

      // Mock API responses
      for (let i = 1; i <= 3; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => createApiResponse({ order: i })
        });
      }

      // Make 3 requests rapidly
      const promises = [1, 2, 3].map(i => 
        client.get(`/test${i}`).then(r => results.push(r.data.order))
      );

      // Process queue with time advances
      await timers.advanceTime(0);
      await timers.advanceTime(600);
      await timers.advanceTime(600);

      await Promise.all(promises);
      
      expect(results).toEqual([1, 2, 3]);
      
      timers.cleanup();
    });
  });

  describe('Bulk Operations', () => {
    it('should batch multiple requests', async () => {
      const ids = [1, 2, 3, 4, 5];
      const batchResponse = ids.map(id => ({ id, name: `Person ${id}` }));

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createApiResponse(batchResponse)
      });

      const results = await client.batchGet('/persons', ids);
      
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('ids=1,2,3,4,5'),
        expect.any(Object)
      );
      expect(results).toEqual(batchResponse);
    });

    it('should handle large batches with chunking', async () => {
      const ids = Array.from({ length: 150 }, (_, i) => i + 1);
      
      // Mock responses for 3 chunks (50 items each)
      for (let i = 0; i < 3; i++) {
        const chunkIds = ids.slice(i * 50, (i + 1) * 50);
        const chunkResponse = chunkIds.map(id => ({ id }));
        
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => createApiResponse(chunkResponse)
        });
      }

      const results = await client.batchGet('/persons', ids, { chunkSize: 50 });
      
      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(results).toHaveLength(150);
    });
  });

  describe('Request Interceptors', () => {
    it('should support request interceptors', async () => {
      const interceptor = vi.fn((config) => ({
        ...config,
        headers: {
          ...config.headers,
          'X-Custom-Header': 'test-value'
        }
      }));

      client.addRequestInterceptor(interceptor);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createApiResponse({})
      });

      await client.get('/test');

      expect(interceptor).toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Custom-Header': 'test-value'
          })
        })
      );
    });

    it('should support response interceptors', async () => {
      const interceptor = vi.fn((response) => ({
        ...response,
        data: { ...response.data, intercepted: true }
      }));

      client.addResponseInterceptor(interceptor);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createApiResponse({ id: 1 })
      });

      const result = await client.get('/test');

      expect(interceptor).toHaveBeenCalled();
      expect(result.data).toEqual({ id: 1, intercepted: true });
    });
  });
});