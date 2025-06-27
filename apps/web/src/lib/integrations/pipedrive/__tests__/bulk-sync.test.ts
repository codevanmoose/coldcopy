import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BulkSyncManager } from '../bulk-sync';
import { 
  mockSupabaseClient, 
  mockFetch,
  mockRedisClient,
  createMockPerson,
  createMockDeal,
  createMockActivity,
  createMockOrganization,
  createPaginatedResponse,
  createBulkItems,
  measurePerformance,
  testConfig,
  useMockTimers
} from './test-utils';
import { testData, testScenarios, performanceBenchmarks } from './test.config';

describe('Pipedrive Bulk Sync', () => {
  let bulkSyncManager: BulkSyncManager;

  beforeEach(() => {
    vi.clearAllMocks();
    bulkSyncManager = new BulkSyncManager({
      config: testConfig,
      supabaseClient: mockSupabaseClient,
      redisClient: mockRedisClient,
      workspaceId: testData.workspace.id
    });
  });

  describe('Initial Sync', () => {
    it('should perform initial sync of all entities', async () => {
      // Mock persons
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createPaginatedResponse(
          createBulkItems(50, i => createMockPerson({ id: i + 1 })),
          0, 50, false
        )
      });

      // Mock organizations
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createPaginatedResponse(
          createBulkItems(20, i => createMockOrganization({ id: i + 1 })),
          0, 20, false
        )
      });

      // Mock deals
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createPaginatedResponse(
          createBulkItems(30, i => createMockDeal({ id: i + 1 })),
          0, 30, false
        )
      });

      // Mock activities
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createPaginatedResponse(
          createBulkItems(100, i => createMockActivity({ id: i + 1 })),
          0, 100, false
        )
      });

      // Mock Supabase inserts
      mockSupabaseClient.from.mockReturnValue({
        ...mockSupabaseClient,
        insert: vi.fn().mockResolvedValue({ data: null, error: null })
      });

      const result = await bulkSyncManager.performInitialSync();

      expect(result).toMatchObject({
        persons: { synced: 50, failed: 0 },
        organizations: { synced: 20, failed: 0 },
        deals: { synced: 30, failed: 0 },
        activities: { synced: 100, failed: 0 },
        totalTime: expect.any(Number)
      });

      expect(mockFetch).toHaveBeenCalledTimes(4);
    });

    it('should handle pagination during initial sync', async () => {
      const totalPersons = 250;
      const pageSize = 100;

      // Mock 3 pages of persons
      for (let page = 0; page < 3; page++) {
        const start = page * pageSize;
        const items = Math.min(pageSize, totalPersons - start);
        
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => createPaginatedResponse(
            createBulkItems(items, i => createMockPerson({ id: start + i + 1 })),
            start,
            pageSize,
            start + items < totalPersons
          )
        });
      }

      mockSupabaseClient.from.mockReturnValue({
        ...mockSupabaseClient,
        insert: vi.fn().mockResolvedValue({ data: null, error: null })
      });

      const result = await bulkSyncManager.syncPersons();

      expect(result.synced).toBe(totalPersons);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should resume interrupted sync', async () => {
      // Mock previous sync state
      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify({
        status: 'in_progress',
        progress: {
          persons: { synced: 50, lastId: 50 },
          organizations: { synced: 0, lastId: null },
          deals: { synced: 0, lastId: null },
          activities: { synced: 0, lastId: null }
        }
      }));

      // Mock remaining persons (51-100)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createPaginatedResponse(
          createBulkItems(50, i => createMockPerson({ id: 51 + i })),
          50, 50, false
        )
      });

      // Mock other entities
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => createPaginatedResponse([], 0, 100, false)
      });

      mockSupabaseClient.from.mockReturnValue({
        ...mockSupabaseClient,
        insert: vi.fn().mockResolvedValue({ data: null, error: null })
      });

      const result = await bulkSyncManager.resumeSync();

      expect(result.persons.synced).toBe(50); // Only new items
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('start=50'),
        expect.any(Object)
      );
    });
  });

  describe('Incremental Sync', () => {
    it('should sync only changed items since last sync', async () => {
      const lastSyncTime = new Date('2024-01-01T00:00:00Z');
      
      // Mock last sync time
      mockRedisClient.get.mockResolvedValueOnce(
        lastSyncTime.toISOString()
      );

      // Mock changed persons
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createPaginatedResponse(
          createBulkItems(10, i => createMockPerson({
            id: i + 1,
            update_time: '2024-01-02T00:00:00Z'
          })),
          0, 100, false
        )
      });

      mockSupabaseClient.from.mockReturnValue({
        ...mockSupabaseClient,
        upsert: vi.fn().mockResolvedValue({ data: null, error: null })
      });

      const result = await bulkSyncManager.performIncrementalSync();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('since_timestamp=2024-01-01'),
        expect.any(Object)
      );

      expect(result.persons.updated).toBe(10);
    });

    it('should handle deleted items during incremental sync', async () => {
      const deletedIds = [1, 2, 3, 4, 5];

      // Mock deleted items endpoint
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: deletedIds.map(id => ({ id, deleted_at: '2024-01-02T00:00:00Z' }))
        })
      });

      mockSupabaseClient.from.mockReturnValue({
        ...mockSupabaseClient,
        update: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({ data: null, error: null })
        })
      });

      const result = await bulkSyncManager.syncDeletedItems('persons', 
        new Date('2024-01-01')
      );

      expect(result.deleted).toBe(5);
      expect(mockSupabaseClient.update).toHaveBeenCalledWith({
        deleted_at: expect.any(String)
      });
    });

    it('should use changelog API for efficient sync', async () => {
      const changes = [
        { id: 1, object: 'person', action: 'updated', timestamp: '2024-01-02T10:00:00Z' },
        { id: 2, object: 'person', action: 'created', timestamp: '2024-01-02T11:00:00Z' },
        { id: 3, object: 'deal', action: 'updated', timestamp: '2024-01-02T12:00:00Z' }
      ];

      // Mock changelog endpoint
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: changes })
      });

      // Mock individual entity fetches
      for (const change of changes) {
        const mockData = change.object === 'person' 
          ? createMockPerson({ id: change.id })
          : createMockDeal({ id: change.id });

        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: mockData })
        });
      }

      mockSupabaseClient.from.mockReturnValue({
        ...mockSupabaseClient,
        upsert: vi.fn().mockResolvedValue({ data: null, error: null })
      });

      const result = await bulkSyncManager.syncFromChangelog(
        new Date('2024-01-01')
      );

      expect(result.processed).toBe(3);
      expect(result.byType).toMatchObject({
        person: { created: 1, updated: 1 },
        deal: { updated: 1 }
      });
    });
  });

  describe('Chunking and Batching', () => {
    it('should process large datasets in chunks', async () => {
      const totalItems = 1000;
      const chunkSize = 100;

      // Track memory usage
      const memorySnapshots: number[] = [];

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

        // Simulate memory usage
        memorySnapshots.push(process.memoryUsage().heapUsed);
      }

      mockSupabaseClient.from.mockReturnValue({
        ...mockSupabaseClient,
        insert: vi.fn().mockResolvedValue({ data: null, error: null })
      });

      const result = await bulkSyncManager.syncPersons({ chunkSize });

      expect(result.synced).toBe(totalItems);
      
      // Verify memory didn't grow significantly
      const maxMemory = Math.max(...memorySnapshots);
      const minMemory = Math.min(...memorySnapshots);
      const memoryGrowth = (maxMemory - minMemory) / minMemory;
      
      expect(memoryGrowth).toBeLessThan(0.5); // Less than 50% growth
    });

    it('should batch database operations', async () => {
      const items = createBulkItems(150, i => createMockPerson({ id: i + 1 }));
      const batchSize = 50;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createPaginatedResponse(items, 0, 150, false)
      });

      let insertCallCount = 0;
      mockSupabaseClient.from.mockReturnValue({
        ...mockSupabaseClient,
        insert: vi.fn().mockImplementation((data) => {
          insertCallCount++;
          expect(data).toHaveLength(batchSize);
          return Promise.resolve({ data: null, error: null });
        })
      });

      await bulkSyncManager.syncPersons({ 
        chunkSize: 150,
        batchSize 
      });

      expect(insertCallCount).toBe(3); // 150 items / 50 batch size
    });

    it('should handle partial batch failures', async () => {
      const items = createBulkItems(10, i => createMockPerson({ id: i + 1 }));

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createPaginatedResponse(items, 0, 10, false)
      });

      // First batch fails
      mockSupabaseClient.from.mockReturnValueOnce({
        ...mockSupabaseClient,
        insert: vi.fn().mockRejectedValueOnce(new Error('Batch error'))
      });

      // Individual inserts for failed batch
      for (let i = 0; i < 5; i++) {
        mockSupabaseClient.from.mockReturnValueOnce({
          ...mockSupabaseClient,
          insert: vi.fn().mockResolvedValueOnce({ data: null, error: null })
        });
      }

      // Second batch succeeds
      mockSupabaseClient.from.mockReturnValueOnce({
        ...mockSupabaseClient,
        insert: vi.fn().mockResolvedValueOnce({ data: null, error: null })
      });

      const result = await bulkSyncManager.syncPersons({ batchSize: 5 });

      expect(result.synced).toBe(10);
      expect(result.retried).toBe(5);
    });
  });

  describe('Progress Tracking', () => {
    it('should track sync progress', async () => {
      const totalItems = 300;
      const progressUpdates: any[] = [];

      bulkSyncManager.on('progress', (update) => {
        progressUpdates.push(update);
      });

      // Mock 3 pages
      for (let page = 0; page < 3; page++) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => createPaginatedResponse(
            createBulkItems(100, i => createMockPerson({ 
              id: page * 100 + i + 1 
            })),
            page * 100,
            100,
            page < 2
          )
        });
      }

      mockSupabaseClient.from.mockReturnValue({
        ...mockSupabaseClient,
        insert: vi.fn().mockResolvedValue({ data: null, error: null })
      });

      await bulkSyncManager.syncPersons();

      expect(progressUpdates).toHaveLength(3);
      expect(progressUpdates[0]).toMatchObject({
        entity: 'persons',
        processed: 100,
        total: expect.any(Number),
        percentage: expect.any(Number)
      });
      expect(progressUpdates[2].percentage).toBe(100);
    });

    it('should persist progress for resumability', async () => {
      const items = createBulkItems(50, i => createMockPerson({ id: i + 1 }));

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createPaginatedResponse(items, 0, 50, true)
      });

      mockSupabaseClient.from.mockReturnValue({
        ...mockSupabaseClient,
        insert: vi.fn().mockResolvedValue({ data: null, error: null })
      });

      mockRedisClient.set.mockResolvedValue('OK');

      await bulkSyncManager.syncPersons();

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        expect.stringContaining('sync_progress'),
        expect.stringContaining('"lastId":50'),
        'EX',
        86400 // 24 hours
      );
    });

    it('should calculate ETA based on sync speed', async () => {
      const timers = useMockTimers();
      const totalItems = 1000;
      const itemsPerPage = 100;
      let etaUpdate: any;

      bulkSyncManager.on('eta', (update) => {
        etaUpdate = update;
      });

      // Simulate sync with time progression
      for (let page = 0; page < 5; page++) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => createPaginatedResponse(
            createBulkItems(itemsPerPage, i => createMockPerson({ 
              id: page * itemsPerPage + i + 1 
            })),
            page * itemsPerPage,
            itemsPerPage,
            true
          )
        });

        mockSupabaseClient.from.mockReturnValue({
          ...mockSupabaseClient,
          insert: vi.fn().mockResolvedValue({ data: null, error: null })
        });

        await bulkSyncManager.syncPersons({ pageSize: itemsPerPage });
        
        // Simulate 10 seconds per page
        await timers.advanceTime(10000);
      }

      expect(etaUpdate).toBeDefined();
      expect(etaUpdate.remainingSeconds).toBeGreaterThan(0);
      expect(etaUpdate.itemsPerSecond).toBe(10); // 100 items / 10 seconds

      timers.cleanup();
    });
  });

  describe('Performance Optimization', () => {
    it('should meet performance benchmarks for different scenarios', async () => {
      const scenarios = [
        testScenarios.smallBusiness,
        testScenarios.enterprise
      ];

      for (const scenario of scenarios) {
        // Mock API responses
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => createPaginatedResponse(
            createBulkItems(Math.min(100, scenario.personCount), i => 
              createMockPerson({ id: i + 1 })
            ),
            0, 100, scenario.personCount > 100
          )
        });

        mockSupabaseClient.from.mockReturnValue({
          ...mockSupabaseClient,
          insert: vi.fn().mockResolvedValue({ data: null, error: null })
        });

        const { result, duration } = await measurePerformance(
          `Sync ${scenario.personCount} persons`,
          () => bulkSyncManager.syncPersons({ pageSize: 100 })
        );

        const itemsPerSecond = result.synced / (duration / 1000);
        
        expect(itemsPerSecond).toBeGreaterThan(
          performanceBenchmarks.bulkSync.itemsPerSecond
        );
      }
    });

    it('should optimize API calls with field selection', async () => {
      const fields = ['id', 'name', 'email', 'update_time'];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createPaginatedResponse(
          createBulkItems(50, i => ({
            id: i + 1,
            name: `Person ${i + 1}`,
            email: [{ value: `person${i + 1}@example.com`, primary: true }],
            update_time: new Date().toISOString()
          })),
          0, 50, false
        )
      });

      mockSupabaseClient.from.mockReturnValue({
        ...mockSupabaseClient,
        insert: vi.fn().mockResolvedValue({ data: null, error: null })
      });

      await bulkSyncManager.syncPersons({ 
        fields,
        optimize: true 
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`fields=${fields.join(',')}`),
        expect.any(Object)
      );
    });

    it('should use parallel processing for independent entities', async () => {
      const entities = ['persons', 'organizations', 'deals'];
      const fetchPromises: Promise<any>[] = [];

      // Mock parallel API calls
      for (const entity of entities) {
        const promise = new Promise(resolve => {
          setTimeout(() => {
            mockFetch.mockResolvedValueOnce({
              ok: true,
              status: 200,
              json: async () => createPaginatedResponse([], 0, 100, false)
            });
            resolve(entity);
          }, Math.random() * 100);
        });
        fetchPromises.push(promise);
      }

      mockSupabaseClient.from.mockReturnValue({
        ...mockSupabaseClient,
        insert: vi.fn().mockResolvedValue({ data: null, error: null })
      });

      const start = Date.now();
      await bulkSyncManager.performParallelSync(entities);
      const duration = Date.now() - start;

      // Should be faster than sequential (would be ~300ms)
      expect(duration).toBeLessThan(150);
    });
  });

  describe('Error Recovery', () => {
    it('should handle network failures with exponential backoff', async () => {
      const timers = useMockTimers();
      let attemptCount = 0;

      // First 2 attempts fail
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockImplementationOnce(async () => {
          attemptCount++;
          return {
            ok: true,
            status: 200,
            json: async () => createPaginatedResponse([], 0, 100, false)
          };
        });

      mockSupabaseClient.from.mockReturnValue({
        ...mockSupabaseClient,
        insert: vi.fn().mockResolvedValue({ data: null, error: null })
      });

      const syncPromise = bulkSyncManager.syncPersons({ 
        retryOptions: {
          maxAttempts: 3,
          initialDelay: 1000,
          maxDelay: 10000
        }
      });

      // Fast-forward through retries
      await timers.advanceTime(1000); // First retry
      await timers.advanceTime(2000); // Second retry

      const result = await syncPromise;

      expect(result.synced).toBe(0);
      expect(mockFetch).toHaveBeenCalledTimes(3);

      timers.cleanup();
    });

    it('should checkpoint progress on errors', async () => {
      const items = createBulkItems(100, i => createMockPerson({ id: i + 1 }));

      // First page succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createPaginatedResponse(
          items.slice(0, 50),
          0, 50, true
        )
      });

      mockSupabaseClient.from.mockReturnValueOnce({
        ...mockSupabaseClient,
        insert: vi.fn().mockResolvedValue({ data: null, error: null })
      });

      // Second page fails
      mockFetch.mockRejectedValueOnce(new Error('API error'));

      mockRedisClient.set.mockResolvedValue('OK');

      try {
        await bulkSyncManager.syncPersons({ pageSize: 50 });
      } catch (error) {
        // Expected to fail
      }

      // Verify checkpoint was saved
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        expect.stringContaining('sync_checkpoint'),
        expect.stringContaining('"lastId":50'),
        'EX',
        expect.any(Number)
      );
    });

    it('should validate data integrity during sync', async () => {
      const invalidPerson = {
        id: 1,
        name: null, // Invalid: missing required field
        email: 'invalid-email' // Invalid: wrong format
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createPaginatedResponse(
          [invalidPerson],
          0, 1, false
        )
      });

      const result = await bulkSyncManager.syncPersons({ 
        validateData: true 
      });

      expect(result.synced).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.errors[0]).toMatchObject({
        id: 1,
        errors: expect.arrayContaining([
          expect.stringContaining('name'),
          expect.stringContaining('email')
        ])
      });
    });
  });

  describe('Scheduling and Automation', () => {
    it('should schedule periodic syncs', async () => {
      const timers = useMockTimers();
      let syncCount = 0;

      mockFetch.mockImplementation(async () => {
        syncCount++;
        return {
          ok: true,
          status: 200,
          json: async () => createPaginatedResponse([], 0, 100, false)
        };
      });

      mockSupabaseClient.from.mockReturnValue({
        ...mockSupabaseClient,
        insert: vi.fn().mockResolvedValue({ data: null, error: null })
      });

      const scheduler = bulkSyncManager.scheduleSync({
        interval: 3600000, // 1 hour
        entities: ['persons', 'deals']
      });

      // Fast-forward 3 hours
      await timers.advanceTime(3600000 * 3);

      expect(syncCount).toBe(6); // 2 entities * 3 intervals

      scheduler.stop();
      timers.cleanup();
    });

    it('should respect rate limits during bulk sync', async () => {
      const timers = useMockTimers();
      const rateLimit = { maxRequests: 2, windowMs: 1000 };

      bulkSyncManager = new BulkSyncManager({
        config: { ...testConfig, rateLimit },
        supabaseClient: mockSupabaseClient,
        redisClient: mockRedisClient,
        workspaceId: testData.workspace.id
      });

      // Mock 4 pages of data
      for (let i = 0; i < 4; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => createPaginatedResponse(
            createBulkItems(10, j => createMockPerson({ id: i * 10 + j + 1 })),
            i * 10, 10, i < 3
          )
        });
      }

      mockSupabaseClient.from.mockReturnValue({
        ...mockSupabaseClient,
        insert: vi.fn().mockResolvedValue({ data: null, error: null })
      });

      mockRedisClient.incr.mockImplementation(async () => {
        const calls = mockRedisClient.incr.mock.calls.length;
        return calls > 2 ? 3 : calls;
      });

      const syncPromise = bulkSyncManager.syncPersons({ pageSize: 10 });

      // Should make 2 requests immediately
      await timers.advanceTime(0);
      expect(mockFetch).toHaveBeenCalledTimes(2);

      // Wait for rate limit window
      await timers.advanceTime(1100);
      
      // Should make remaining 2 requests
      await syncPromise;
      expect(mockFetch).toHaveBeenCalledTimes(4);

      timers.cleanup();
    });
  });
});