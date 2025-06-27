import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConflictResolver } from '../conflict-resolution';
import { 
  mockSupabaseClient, 
  mockFetch,
  createMockPerson,
  createMockDeal,
  createMockActivity,
  createConflictScenario,
  createApiResponse,
  testConfig
} from './test-utils';
import { testData } from './test.config';

describe('Pipedrive Conflict Resolution', () => {
  let conflictResolver: ConflictResolver;

  beforeEach(() => {
    vi.clearAllMocks();
    conflictResolver = new ConflictResolver({
      config: testConfig,
      supabaseClient: mockSupabaseClient,
      workspaceId: testData.workspace.id
    });
  });

  describe('Conflict Detection', () => {
    it('should detect conflicts when both sides modified', async () => {
      const lastSync = new Date('2024-01-01T10:00:00Z');
      
      const localPerson = {
        id: 'local-123',
        pipedrive_id: 123,
        name: 'John Doe - Local Update',
        email: 'john.local@example.com',
        updated_at: '2024-01-01T12:00:00Z',
        workspace_id: testData.workspace.id
      };

      const remotePerson = createMockPerson({
        id: 123,
        name: 'John Doe - Remote Update',
        email: [{ value: 'john.remote@example.com', primary: true }],
        update_time: '2024-01-01T11:30:00Z'
      });

      // Mock local data
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: localPerson,
        error: null
      });

      // Mock remote data
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createApiResponse(remotePerson)
      });

      const conflict = await conflictResolver.detectConflict(
        'person',
        localPerson.id,
        lastSync
      );

      expect(conflict).toBeTruthy();
      expect(conflict.type).toBe('both_modified');
      expect(conflict.fields).toContainEqual(
        expect.objectContaining({
          field: 'name',
          localValue: 'John Doe - Local Update',
          remoteValue: 'John Doe - Remote Update'
        })
      );
    });

    it('should not detect conflict when only one side modified', async () => {
      const lastSync = new Date('2024-01-01T10:00:00Z');
      
      const localPerson = {
        id: 'local-123',
        pipedrive_id: 123,
        name: 'John Doe',
        updated_at: '2024-01-01T09:00:00Z' // Before last sync
      };

      const remotePerson = createMockPerson({
        id: 123,
        name: 'John Doe - Updated',
        update_time: '2024-01-01T11:00:00Z' // After last sync
      });

      mockSupabaseClient.single.mockResolvedValueOnce({
        data: localPerson,
        error: null
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createApiResponse(remotePerson)
      });

      const conflict = await conflictResolver.detectConflict(
        'person',
        localPerson.id,
        lastSync
      );

      expect(conflict).toBeNull();
    });

    it('should detect field-level conflicts', async () => {
      const scenario = createConflictScenario(
        {
          id: 'local-123',
          name: 'Same Name',
          email: 'different.local@example.com',
          phone: '+1111111111',
          updated_at: '2024-01-01T12:00:00Z'
        },
        {
          id: 123,
          name: 'Same Name',
          email: [{ value: 'different.remote@example.com', primary: true }],
          phone: [{ value: '+2222222222', primary: true }],
          update_time: '2024-01-01T11:30:00Z'
        },
        new Date('2024-01-01T10:00:00Z')
      );

      mockSupabaseClient.single.mockResolvedValueOnce({
        data: scenario.local,
        error: null
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createApiResponse(scenario.remote)
      });

      const conflict = await conflictResolver.detectConflict(
        'person',
        scenario.local.id,
        scenario.lastSync
      );

      expect(conflict.fields).toHaveLength(2); // email and phone
      expect(conflict.fields).not.toContainEqual(
        expect.objectContaining({ field: 'name' })
      );
    });

    it('should handle nested object conflicts', async () => {
      const localDeal = {
        id: 'local-456',
        pipedrive_id: 456,
        title: 'Enterprise Deal',
        value: 100000,
        custom_fields: {
          campaign_id: 'camp-123',
          lead_score: 85
        },
        updated_at: '2024-01-01T12:00:00Z'
      };

      const remoteDeal = createMockDeal({
        id: 456,
        title: 'Enterprise Deal',
        value: 120000,
        'abc123': 'camp-456', // campaign_id field
        'def456': 90, // lead_score field
        update_time: '2024-01-01T11:30:00Z'
      });

      mockSupabaseClient.single.mockResolvedValueOnce({
        data: localDeal,
        error: null
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createApiResponse(remoteDeal)
      });

      const conflict = await conflictResolver.detectConflict(
        'deal',
        localDeal.id,
        new Date('2024-01-01T10:00:00Z')
      );

      expect(conflict.fields).toContainEqual(
        expect.objectContaining({
          field: 'value',
          localValue: 100000,
          remoteValue: 120000
        })
      );
    });
  });

  describe('Resolution Strategies', () => {
    it('should resolve with local-wins strategy', async () => {
      const conflict = {
        type: 'both_modified',
        entityType: 'person',
        localId: 'local-123',
        remoteId: 123,
        fields: [
          {
            field: 'name',
            localValue: 'Local Name',
            remoteValue: 'Remote Name'
          }
        ],
        local: {
          id: 'local-123',
          pipedrive_id: 123,
          name: 'Local Name'
        },
        remote: {
          id: 123,
          name: 'Remote Name'
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createApiResponse(createMockPerson({
          id: 123,
          name: 'Local Name'
        }))
      });

      const resolution = await conflictResolver.resolve(
        conflict,
        'local_wins'
      );

      expect(resolution.strategy).toBe('local_wins');
      expect(resolution.result.name).toBe('Local Name');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/persons/123'),
        expect.objectContaining({
          method: 'PUT',
          body: expect.stringContaining('Local Name')
        })
      );
    });

    it('should resolve with remote-wins strategy', async () => {
      const conflict = {
        type: 'both_modified',
        entityType: 'person',
        localId: 'local-123',
        remoteId: 123,
        fields: [
          {
            field: 'email',
            localValue: 'local@example.com',
            remoteValue: 'remote@example.com'
          }
        ],
        local: {
          id: 'local-123',
          email: 'local@example.com'
        },
        remote: {
          id: 123,
          email: [{ value: 'remote@example.com', primary: true }]
        }
      };

      mockSupabaseClient.from.mockReturnValue({
        ...mockSupabaseClient,
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null })
        })
      });

      const resolution = await conflictResolver.resolve(
        conflict,
        'remote_wins'
      );

      expect(resolution.strategy).toBe('remote_wins');
      expect(mockSupabaseClient.update).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'remote@example.com'
        })
      );
    });

    it('should resolve with merge strategy', async () => {
      const conflict = {
        type: 'both_modified',
        entityType: 'person',
        localId: 'local-123',
        remoteId: 123,
        fields: [
          {
            field: 'name',
            localValue: 'John Doe (CEO)',
            remoteValue: 'John Doe'
          },
          {
            field: 'phone',
            localValue: null,
            remoteValue: '+1234567890'
          }
        ],
        local: {
          id: 'local-123',
          name: 'John Doe (CEO)',
          phone: null,
          updated_at: '2024-01-01T12:00:00Z'
        },
        remote: {
          id: 123,
          name: 'John Doe',
          phone: [{ value: '+1234567890', primary: true }],
          update_time: '2024-01-01T11:00:00Z'
        }
      };

      // Mock merge result update to Pipedrive
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createApiResponse(createMockPerson({
          id: 123,
          name: 'John Doe (CEO)',
          phone: [{ value: '+1234567890', primary: true }]
        }))
      });

      // Mock merge result update to local
      mockSupabaseClient.from.mockReturnValue({
        ...mockSupabaseClient,
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null })
        })
      });

      const resolution = await conflictResolver.resolve(
        conflict,
        'merge'
      );

      expect(resolution.strategy).toBe('merge');
      expect(resolution.result.name).toBe('John Doe (CEO)'); // Keep local (more info)
      expect(resolution.result.phone).toBeTruthy(); // Take remote (has value)
    });

    it('should use custom merge rules', async () => {
      const mergeRules = {
        person: {
          name: 'prefer_longer',
          email: 'prefer_local',
          phone: 'prefer_remote',
          lead_score: 'prefer_higher'
        }
      };

      conflictResolver.setMergeRules(mergeRules);

      const conflict = {
        type: 'both_modified',
        entityType: 'person',
        fields: [
          {
            field: 'name',
            localValue: 'John',
            remoteValue: 'John Doe'
          },
          {
            field: 'lead_score',
            localValue: 75,
            remoteValue: 85
          }
        ],
        local: { name: 'John', lead_score: 75 },
        remote: { name: 'John Doe', lead_score: 85 }
      };

      const merged = conflictResolver.applyMergeRules(conflict);

      expect(merged.name).toBe('John Doe'); // Longer
      expect(merged.lead_score).toBe(85); // Higher
    });

    it('should handle manual resolution', async () => {
      const conflict = {
        id: 'conflict-123',
        type: 'both_modified',
        entityType: 'deal',
        localId: 'local-789',
        remoteId: 789,
        fields: [
          {
            field: 'value',
            localValue: 100000,
            remoteValue: 120000
          }
        ]
      };

      // Store conflict for manual review
      mockSupabaseClient.from.mockReturnValue({
        ...mockSupabaseClient,
        insert: vi.fn().mockResolvedValue({ 
          data: { id: 'conflict-123' }, 
          error: null 
        })
      });

      const stored = await conflictResolver.storeForManualReview(conflict);

      expect(stored.id).toBe('conflict-123');
      expect(mockSupabaseClient.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'pending',
          conflict_data: conflict
        })
      );
    });
  });

  describe('Batch Conflict Resolution', () => {
    it('should detect conflicts for multiple entities', async () => {
      const entities = [
        { id: 'local-1', pipedrive_id: 1, updated_at: '2024-01-01T12:00:00Z' },
        { id: 'local-2', pipedrive_id: 2, updated_at: '2024-01-01T12:00:00Z' },
        { id: 'local-3', pipedrive_id: 3, updated_at: '2024-01-01T09:00:00Z' }
      ];

      // Mock local data
      mockSupabaseClient.select.mockResolvedValueOnce({
        data: entities,
        error: null
      });

      // Mock remote data with conflicts for entities 1 and 2
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createApiResponse([
          createMockPerson({ 
            id: 1, 
            update_time: '2024-01-01T11:30:00Z' 
          }),
          createMockPerson({ 
            id: 2, 
            update_time: '2024-01-01T11:45:00Z' 
          }),
          createMockPerson({ 
            id: 3, 
            update_time: '2024-01-01T08:00:00Z' 
          })
        ])
      });

      const conflicts = await conflictResolver.detectBatchConflicts(
        'person',
        entities.map(e => e.id),
        new Date('2024-01-01T10:00:00Z')
      );

      expect(conflicts).toHaveLength(2);
      expect(conflicts[0].localId).toBe('local-1');
      expect(conflicts[1].localId).toBe('local-2');
    });

    it('should resolve multiple conflicts with same strategy', async () => {
      const conflicts = [
        {
          type: 'both_modified',
          entityType: 'person',
          localId: 'local-1',
          remoteId: 1,
          fields: [{ field: 'name', localValue: 'Local 1', remoteValue: 'Remote 1' }]
        },
        {
          type: 'both_modified',
          entityType: 'person',
          localId: 'local-2',
          remoteId: 2,
          fields: [{ field: 'email', localValue: 'local2@example.com', remoteValue: 'remote2@example.com' }]
        }
      ];

      // Mock resolution updates
      for (const conflict of conflicts) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => createApiResponse(
            createMockPerson({ id: conflict.remoteId })
          )
        });
      }

      const resolutions = await conflictResolver.resolveBatch(
        conflicts,
        'local_wins'
      );

      expect(resolutions).toHaveLength(2);
      expect(resolutions.every(r => r.strategy === 'local_wins')).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should handle mixed resolution strategies', async () => {
      const conflicts = [
        {
          id: 'conflict-1',
          type: 'both_modified',
          entityType: 'person',
          localId: 'local-1',
          remoteId: 1,
          priority: 'high'
        },
        {
          id: 'conflict-2',
          type: 'both_modified',
          entityType: 'deal',
          localId: 'local-2',
          remoteId: 2,
          priority: 'low'
        }
      ];

      const strategies = {
        'conflict-1': 'local_wins',
        'conflict-2': 'remote_wins'
      };

      // Mock different resolution approaches
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createApiResponse(createMockPerson({ id: 1 }))
      });

      mockSupabaseClient.from.mockReturnValue({
        ...mockSupabaseClient,
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null })
        })
      });

      const resolutions = await conflictResolver.resolveBatchMixed(
        conflicts,
        strategies
      );

      expect(resolutions[0].strategy).toBe('local_wins');
      expect(resolutions[1].strategy).toBe('remote_wins');
    });
  });

  describe('Conflict Prevention', () => {
    it('should use optimistic locking', async () => {
      const person = {
        id: 'local-123',
        pipedrive_id: 123,
        name: 'John Doe',
        version: 5,
        updated_at: '2024-01-01T10:00:00Z'
      };

      // Mock get with version
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createApiResponse({
          ...createMockPerson({ id: 123 }),
          version: 5
        })
      });

      // Mock update with version check
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createApiResponse({
          ...createMockPerson({ id: 123, name: 'John Doe Updated' }),
          version: 6
        })
      });

      const updated = await conflictResolver.updateWithOptimisticLock(
        'person',
        person,
        { name: 'John Doe Updated' }
      );

      expect(updated.version).toBe(6);
      expect(mockFetch).toHaveBeenLastCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'If-Match': '5'
          })
        })
      );
    });

    it('should handle version mismatch', async () => {
      const person = {
        id: 'local-123',
        pipedrive_id: 123,
        version: 5
      };

      // Mock version mismatch error
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 412, // Precondition Failed
        json: async () => ({
          error: 'Version mismatch',
          current_version: 7
        })
      });

      await expect(
        conflictResolver.updateWithOptimisticLock(
          'person',
          person,
          { name: 'Updated' }
        )
      ).rejects.toThrow('Version mismatch');
    });

    it('should implement field-level locking', async () => {
      const updates = {
        name: 'Updated Name',
        email: 'updated@example.com'
      };

      // Lock fields
      await conflictResolver.lockFields('person', 123, ['name', 'email']);

      // Try to update locked fields from another session
      const anotherResolver = new ConflictResolver({
        config: testConfig,
        supabaseClient: mockSupabaseClient,
        workspaceId: testData.workspace.id,
        sessionId: 'different-session'
      });

      await expect(
        anotherResolver.updateWithFieldLock('person', 123, updates)
      ).rejects.toThrow('Fields are locked');
    });
  });

  describe('Conflict History', () => {
    it('should track conflict resolution history', async () => {
      const conflict = {
        id: 'conflict-123',
        type: 'both_modified',
        entityType: 'person',
        localId: 'local-123',
        remoteId: 123,
        fields: [
          {
            field: 'name',
            localValue: 'Local Name',
            remoteValue: 'Remote Name'
          }
        ]
      };

      mockSupabaseClient.from.mockReturnValue({
        ...mockSupabaseClient,
        insert: vi.fn().mockResolvedValue({ data: null, error: null })
      });

      await conflictResolver.recordResolution(conflict, {
        strategy: 'manual',
        resolvedBy: 'user-123',
        resolution: { name: 'Manually Chosen Name' },
        notes: 'Chose name based on customer preference'
      });

      expect(mockSupabaseClient.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          conflict_id: 'conflict-123',
          strategy: 'manual',
          resolved_by: 'user-123',
          notes: expect.any(String)
        })
      );
    });

    it('should analyze conflict patterns', async () => {
      const history = [
        { entity_type: 'person', field: 'name', strategy: 'local_wins', created_at: '2024-01-01' },
        { entity_type: 'person', field: 'name', strategy: 'local_wins', created_at: '2024-01-02' },
        { entity_type: 'person', field: 'email', strategy: 'remote_wins', created_at: '2024-01-03' },
        { entity_type: 'deal', field: 'value', strategy: 'merge', created_at: '2024-01-04' },
        { entity_type: 'deal', field: 'value', strategy: 'merge', created_at: '2024-01-05' }
      ];

      mockSupabaseClient.select.mockResolvedValueOnce({
        data: history,
        error: null
      });

      const patterns = await conflictResolver.analyzeConflictPatterns();

      expect(patterns).toMatchObject({
        byEntity: {
          person: 3,
          deal: 2
        },
        byField: {
          name: 2,
          email: 1,
          value: 2
        },
        byStrategy: {
          local_wins: 2,
          remote_wins: 1,
          merge: 2
        },
        recommendations: expect.arrayContaining([
          expect.objectContaining({
            entity: 'person',
            field: 'name',
            suggestedStrategy: 'local_wins'
          })
        ])
      });
    });
  });

  describe('Real-time Conflict Detection', () => {
    it('should detect conflicts during real-time sync', async () => {
      const change = {
        entity: 'person',
        id: 123,
        field: 'name',
        oldValue: 'John Doe',
        newValue: 'John Doe Updated',
        timestamp: new Date()
      };

      // Check if local version was also modified
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: {
          pipedrive_id: 123,
          name: 'John Doe Local Update',
          updated_at: new Date(Date.now() - 5000) // 5 seconds ago
        },
        error: null
      });

      const hasConflict = await conflictResolver.checkRealTimeConflict(change);

      expect(hasConflict).toBe(true);
    });

    it('should queue real-time conflicts for resolution', async () => {
      const conflicts = [
        { entity: 'person', id: 1, detected_at: new Date() },
        { entity: 'deal', id: 2, detected_at: new Date() }
      ];

      mockSupabaseClient.from.mockReturnValue({
        ...mockSupabaseClient,
        insert: vi.fn().mockResolvedValue({ data: null, error: null })
      });

      await conflictResolver.queueConflicts(conflicts);

      expect(mockSupabaseClient.insert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            status: 'queued',
            priority: expect.any(String)
          })
        ])
      );
    });
  });
});