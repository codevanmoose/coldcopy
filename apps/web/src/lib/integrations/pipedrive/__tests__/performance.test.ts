import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { performance } from 'perf_hooks';
import { 
  PipedriveClient,
  BulkSyncManager,
  ActivityTimeline,
  WebhookManager
} from '../index';
import { 
  mockSupabaseClient, 
  mockFetch,
  mockRedisClient,
  createBulkItems,
  createMockPerson,
  createMockDeal,
  createMockActivity,
  createPaginatedResponse,
  createWebhookEvent,
  measurePerformance,
  testConfig
} from './test-utils';
import { testScenarios, performanceBenchmarks } from './test.config';

describe('Pipedrive Integration Performance Tests', () => {
  let client: PipedriveClient;
  let bulkSync: BulkSyncManager;
  let memoryBaseline: number;

  beforeEach(() => {
    vi.clearAllMocks();
    global.gc && global.gc(); // Force garbage collection if available
    memoryBaseline = process.memoryUsage().heapUsed;
    
    client = new PipedriveClient({
      ...testConfig,
      redis: mockRedisClient
    });
    
    bulkSync = new BulkSyncManager({
      config: testConfig,
      supabaseClient: mockSupabaseClient,
      redisClient: mockRedisClient,
      workspaceId: 'test-workspace'
    });
  });

  afterEach(() => {
    global.gc && global.gc();
  });

  describe('API Call Performance', () => {
    it('should meet response time SLA for single requests', async () => {
      const iterations = 100;
      const responseTimes: number[] = [];

      for (let i = 0; i < iterations; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ 
            success: true, 
            data: createMockPerson({ id: i + 1 }) 
          })
        });

        const { duration } = await measurePerformance(
          `API Call ${i}`,
          () => client.get(`/persons/${i + 1}`)
        );

        responseTimes.push(duration);
      }

      const p50 = responseTimes.sort((a, b) => a - b)[Math.floor(iterations * 0.5)];
      const p95 = responseTimes.sort((a, b) => a - b)[Math.floor(iterations * 0.95)];
      const p99 = responseTimes.sort((a, b) => a - b)[Math.floor(iterations * 0.99)];

      expect(p50).toBeLessThan(performanceBenchmarks.apiCall.p50);
      expect(p95).toBeLessThan(performanceBenchmarks.apiCall.p95);
      expect(p99).toBeLessThan(performanceBenchmarks.apiCall.p99);
    });

    it('should handle concurrent requests efficiently', async () => {
      const concurrentRequests = 50;
      
      // Mock all responses
      for (let i = 0; i < concurrentRequests; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ 
            success: true, 
            data: createMockPerson({ id: i + 1 }) 
          })
        });
      }

      const startTime = performance.now();
      
      const promises = Array.from({ length: concurrentRequests }, (_, i) =>
        client.get(`/persons/${i + 1}`)
      );

      await Promise.all(promises);
      
      const totalDuration = performance.now() - startTime;
      const avgTimePerRequest = totalDuration / concurrentRequests;

      expect(avgTimePerRequest).toBeLessThan(100); // Should benefit from concurrency
    });

    it('should implement efficient request batching', async () => {
      const ids = Array.from({ length: 1000 }, (_, i) => i + 1);
      const batchSize = 100;
      
      let apiCallCount = 0;
      mockFetch.mockImplementation(async () => {
        apiCallCount++;
        const start = (apiCallCount - 1) * batchSize;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: ids.slice(start, start + batchSize).map(id => 
              createMockPerson({ id })
            )
          })
        };
      });

      const { duration } = await measurePerformance(
        'Batch fetch 1000 persons',
        () => client.batchGet('/persons', ids, { batchSize })
      );

      expect(apiCallCount).toBe(10); // 1000 / 100
      expect(duration).toBeLessThan(1000); // Should complete in under 1 second
    });
  });

  describe('Bulk Sync Performance', () => {
    it('should sync large datasets within performance targets', async () => {
      const scenario = testScenarios.enterprise;
      const pageSize = 500;
      const totalPages = Math.ceil(scenario.personCount / pageSize);

      // Mock paginated responses
      for (let page = 0; page < totalPages; page++) {
        const start = page * pageSize;
        const count = Math.min(pageSize, scenario.personCount - start);
        
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => createPaginatedResponse(
            createBulkItems(count, i => createMockPerson({ 
              id: start + i + 1 
            })),
            start,
            pageSize,
            page < totalPages - 1
          )
        });
      }

      // Mock bulk inserts
      mockSupabaseClient.from.mockReturnValue({
        ...mockSupabaseClient,
        insert: vi.fn().mockResolvedValue({ data: null, error: null })
      });

      const { result, duration } = await measurePerformance(
        `Sync ${scenario.personCount} persons`,
        () => bulkSync.syncPersons({ pageSize })
      );

      const itemsPerSecond = result.synced / (duration / 1000);
      
      expect(itemsPerSecond).toBeGreaterThan(
        performanceBenchmarks.bulkSync.itemsPerSecond
      );
      expect(result.synced).toBe(scenario.personCount);
    });

    it('should maintain memory efficiency during large syncs', async () => {
      const totalItems = 50000;
      const chunkSize = 1000;
      const memorySnapshots: number[] = [];

      // Track memory during sync
      const originalSyncPersons = bulkSync.syncPersons.bind(bulkSync);
      bulkSync.syncPersons = async function(options) {
        const interval = setInterval(() => {
          memorySnapshots.push(process.memoryUsage().heapUsed);
        }, 100);

        try {
          const result = await originalSyncPersons(options);
          return result;
        } finally {
          clearInterval(interval);
        }
      };

      // Mock responses
      for (let i = 0; i < totalItems / chunkSize; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => createPaginatedResponse(
            createBulkItems(chunkSize, j => createMockPerson({ 
              id: i * chunkSize + j + 1 
            })),
            i * chunkSize,
            chunkSize,
            i < (totalItems / chunkSize) - 1
          )
        });
      }

      mockSupabaseClient.from.mockReturnValue({
        ...mockSupabaseClient,
        insert: vi.fn().mockResolvedValue({ data: null, error: null })
      });

      await bulkSync.syncPersons({ 
        pageSize: chunkSize,
        streamMode: true 
      });

      // Analyze memory usage
      const maxMemory = Math.max(...memorySnapshots);
      const avgMemory = memorySnapshots.reduce((a, b) => a + b, 0) / memorySnapshots.length;
      const memoryGrowth = (maxMemory - memoryBaseline) / 1024 / 1024; // MB

      expect(memoryGrowth).toBeLessThan(performanceBenchmarks.bulkSync.maxMemoryMB);
      expect(avgMemory).toBeLessThan(maxMemory * 0.8); // Memory should be released
    });

    it('should optimize database operations', async () => {
      const items = createBulkItems(5000, i => createMockPerson({ id: i + 1 }));
      const batchSize = 500;
      
      let dbOperationCount = 0;
      let totalDbTime = 0;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createPaginatedResponse(items, 0, 5000, false)
      });

      mockSupabaseClient.from.mockReturnValue({
        ...mockSupabaseClient,
        insert: vi.fn().mockImplementation(async (data) => {
          dbOperationCount++;
          const start = performance.now();
          
          // Simulate DB operation time based on batch size
          await new Promise(resolve => setTimeout(resolve, data.length * 0.1));
          
          totalDbTime += performance.now() - start;
          return { data: null, error: null };
        })
      });

      await bulkSync.syncPersons({ 
        pageSize: 5000,
        batchSize 
      });

      expect(dbOperationCount).toBe(10); // 5000 / 500
      expect(totalDbTime / dbOperationCount).toBeLessThan(100); // Avg <100ms per batch
    });
  });

  describe('Webhook Processing Performance', () => {
    it('should process webhooks with low latency', async () => {
      const webhookManager = new WebhookManager({
        config: testConfig,
        supabaseClient: mockSupabaseClient,
        redisClient: mockRedisClient,
        workspaceId: 'test-workspace'
      });

      const webhookCount = 1000;
      const processingTimes: number[] = [];

      mockSupabaseClient.from.mockReturnValue({
        ...mockSupabaseClient,
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null })
        })
      });

      for (let i = 0; i < webhookCount; i++) {
        const event = createWebhookEvent(
          i % 3 === 0 ? 'added' : i % 3 === 1 ? 'updated' : 'deleted',
          'person',
          createMockPerson({ id: i + 1 })
        );

        const { duration } = await measurePerformance(
          `Process webhook ${i}`,
          () => webhookManager.processWebhook(event)
        );

        processingTimes.push(duration);
      }

      const avgProcessingTime = processingTimes.reduce((a, b) => a + b, 0) / webhookCount;
      const maxProcessingTime = Math.max(...processingTimes);

      expect(avgProcessingTime).toBeLessThan(
        performanceBenchmarks.webhookProcessing.maxLatencyMs
      );
      expect(maxProcessingTime).toBeLessThan(
        performanceBenchmarks.webhookProcessing.maxLatencyMs * 2
      );
    });

    it('should handle webhook bursts efficiently', async () => {
      const webhookManager = new WebhookManager({
        config: testConfig,
        supabaseClient: mockSupabaseClient,
        redisClient: mockRedisClient,
        workspaceId: 'test-workspace'
      });

      const burstSize = 500;
      const events = createBulkItems(burstSize, i => 
        createWebhookEvent('added', 'person', createMockPerson({ id: i + 1 }))
      );

      mockSupabaseClient.from.mockReturnValue({
        ...mockSupabaseClient,
        insert: vi.fn().mockResolvedValue({ data: null, error: null })
      });

      const startTime = performance.now();
      
      // Process all webhooks concurrently
      await Promise.all(
        events.map(event => webhookManager.processWebhook(event))
      );

      const totalDuration = performance.now() - startTime;
      const throughput = burstSize / (totalDuration / 1000); // webhooks per second

      expect(throughput).toBeGreaterThan(100); // Should handle >100 webhooks/second
    });
  });

  describe('Activity Timeline Performance', () => {
    it('should retrieve large timelines efficiently', async () => {
      const activityTimeline = new ActivityTimeline({
        config: testConfig,
        supabaseClient: mockSupabaseClient,
        workspaceId: 'test-workspace'
      });

      const personId = 123;
      const activityCount = 10000;
      const pageSize = 500;

      // Mock paginated activity responses
      for (let page = 0; page < activityCount / pageSize; page++) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => createPaginatedResponse(
            createBulkItems(pageSize, i => createMockActivity({
              id: page * pageSize + i + 1,
              person_id: personId
            })),
            page * pageSize,
            pageSize,
            page < (activityCount / pageSize) - 1
          )
        });
      }

      const { result, duration } = await measurePerformance(
        `Get ${activityCount} activities`,
        () => activityTimeline.getPersonTimeline(personId, { includeAll: true })
      );

      expect(result).toHaveLength(activityCount);
      expect(duration).toBeLessThan(5000); // Should complete in under 5 seconds
    });

    it('should bulk create activities efficiently', async () => {
      const activityTimeline = new ActivityTimeline({
        config: testConfig,
        supabaseClient: mockSupabaseClient,
        workspaceId: 'test-workspace'
      });

      const activities = createBulkItems(2000, i => ({
        type: 'email',
        subject: `Email ${i + 1}`,
        personId: (i % 100) + 1,
        done: true
      }));

      let apiCallCount = 0;
      mockFetch.mockImplementation(async () => {
        apiCallCount++;
        return {
          ok: true,
          status: 201,
          json: async () => ({
            success: true,
            data: createMockActivity()
          })
        };
      });

      const { duration } = await measurePerformance(
        'Bulk create 2000 activities',
        () => activityTimeline.bulkCreateActivities(activities, {
          batchSize: 100,
          parallel: true,
          maxConcurrent: 10
        })
      );

      expect(apiCallCount).toBe(20); // 2000 / 100
      expect(duration).toBeLessThan(10000); // Should complete in under 10 seconds
    });
  });

  describe('Search and Filtering Performance', () => {
    it('should perform complex searches efficiently', async () => {
      const searchCriteria = {
        term: 'enterprise',
        filters: {
          minValue: 50000,
          maxValue: 500000,
          stages: [2, 3, 4, 5],
          owners: [1, 2, 3, 4, 5],
          dateRange: {
            start: '2024-01-01',
            end: '2024-12-31'
          },
          customFields: {
            industry: ['technology', 'finance', 'healthcare'],
            leadScore: { min: 70, max: 100 }
          }
        },
        includeRelated: ['person', 'organization', 'activities']
      };

      // Mock search results
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createPaginatedResponse(
          createBulkItems(1000, i => createMockDeal({ 
            id: i + 1,
            title: `Enterprise Deal ${i + 1}`
          })),
          0, 1000, false
        )
      });

      // Mock related data fetches
      for (let i = 0; i < 3; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: [] })
        });
      }

      const { result, duration } = await measurePerformance(
        'Complex deal search',
        () => client.searchDeals(searchCriteria)
      );

      expect(result.deals).toHaveLength(1000);
      expect(duration).toBeLessThan(3000); // Should complete in under 3 seconds
    });
  });

  describe('Caching Performance', () => {
    it('should improve response times with caching', async () => {
      const iterations = 100;
      const cacheHitTimes: number[] = [];
      const cacheMissTimes: number[] = [];

      // First pass - cache misses
      for (let i = 0; i < iterations; i++) {
        mockRedisClient.get.mockResolvedValueOnce(null);
        mockRedisClient.set.mockResolvedValueOnce('OK');
        
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ 
            success: true, 
            data: createMockPerson({ id: i + 1 }) 
          })
        });

        const { duration } = await measurePerformance(
          `Cache miss ${i}`,
          () => client.get(`/persons/${i + 1}`, {}, { cache: true })
        );

        cacheMissTimes.push(duration);
      }

      // Second pass - cache hits
      for (let i = 0; i < iterations; i++) {
        mockRedisClient.get.mockResolvedValueOnce(
          JSON.stringify({ 
            success: true, 
            data: createMockPerson({ id: i + 1 }) 
          })
        );

        const { duration } = await measurePerformance(
          `Cache hit ${i}`,
          () => client.get(`/persons/${i + 1}`, {}, { cache: true })
        );

        cacheHitTimes.push(duration);
      }

      const avgCacheMissTime = cacheMissTimes.reduce((a, b) => a + b, 0) / iterations;
      const avgCacheHitTime = cacheHitTimes.reduce((a, b) => a + b, 0) / iterations;
      const cacheSpeedup = avgCacheMissTime / avgCacheHitTime;

      expect(cacheSpeedup).toBeGreaterThan(10); // Cache hits should be 10x+ faster
      expect(avgCacheHitTime).toBeLessThan(5); // Cache hits should be <5ms
    });
  });

  describe('Resource Optimization', () => {
    it('should optimize connection pooling', async () => {
      const concurrentOperations = 100;
      const connectionMetrics = {
        created: 0,
        reused: 0,
        active: 0,
        peak: 0
      };

      // Override fetch to track connections
      const originalFetch = mockFetch;
      mockFetch.mockImplementation(async (...args) => {
        connectionMetrics.active++;
        connectionMetrics.peak = Math.max(connectionMetrics.peak, connectionMetrics.active);
        
        if (connectionMetrics.created < 10) {
          connectionMetrics.created++;
        } else {
          connectionMetrics.reused++;
        }

        const result = await originalFetch(...args);
        connectionMetrics.active--;
        return result;
      });

      // Mock responses
      for (let i = 0; i < concurrentOperations; i++) {
        originalFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: {} })
        });
      }

      // Execute concurrent operations
      await Promise.all(
        Array.from({ length: concurrentOperations }, (_, i) =>
          client.get(`/test/${i}`)
        )
      );

      expect(connectionMetrics.created).toBeLessThanOrEqual(
        performanceBenchmarks.bulkSync.maxConcurrentRequests
      );
      expect(connectionMetrics.reused).toBeGreaterThan(
        concurrentOperations - connectionMetrics.created
      );
      expect(connectionMetrics.peak).toBeLessThanOrEqual(
        performanceBenchmarks.bulkSync.maxConcurrentRequests
      );
    });

    it('should implement efficient data streaming', async () => {
      const streamSize = 100000; // 100k records
      const chunkSize = 1000;
      let processedCount = 0;
      let peakMemory = memoryBaseline;

      // Create a streaming processor
      const streamProcessor = async function* () {
        for (let i = 0; i < streamSize / chunkSize; i++) {
          mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => createPaginatedResponse(
              createBulkItems(chunkSize, j => createMockPerson({ 
                id: i * chunkSize + j + 1 
              })),
              i * chunkSize,
              chunkSize,
              i < (streamSize / chunkSize) - 1
            )
          });

          const response = await client.get('/persons', {
            start: i * chunkSize,
            limit: chunkSize
          });

          yield response.data;

          // Track memory
          const currentMemory = process.memoryUsage().heapUsed;
          peakMemory = Math.max(peakMemory, currentMemory);
        }
      };

      const startTime = performance.now();

      // Process stream
      for await (const chunk of streamProcessor()) {
        processedCount += chunk.length;
        
        // Simulate processing delay
        await new Promise(resolve => setImmediate(resolve));
      }

      const duration = performance.now() - startTime;
      const throughput = processedCount / (duration / 1000);
      const memoryGrowth = (peakMemory - memoryBaseline) / 1024 / 1024; // MB

      expect(processedCount).toBe(streamSize);
      expect(throughput).toBeGreaterThan(10000); // >10k records/second
      expect(memoryGrowth).toBeLessThan(100); // <100MB memory growth
    });
  });
});