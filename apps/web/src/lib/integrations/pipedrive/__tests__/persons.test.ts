import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PersonSync } from '../persons';
import { 
  mockSupabaseClient, 
  mockFetch,
  createMockPerson,
  createMockField,
  createApiResponse,
  createPaginatedResponse,
  testConfig
} from './test-utils';
import { testData } from './test.config';

describe('Pipedrive Person Sync', () => {
  let personSync: PersonSync;

  beforeEach(() => {
    vi.clearAllMocks();
    personSync = new PersonSync({
      config: testConfig,
      supabaseClient: mockSupabaseClient,
      workspaceId: testData.workspace.id
    });
  });

  describe('Person CRUD Operations', () => {
    it('should create a person', async () => {
      const personData = {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '+1234567890',
        organization: 'Acme Corp'
      };

      const mockPerson = createMockPerson({
        id: 123,
        name: personData.name,
        email: [{ value: personData.email, primary: true }],
        phone: [{ value: personData.phone, primary: true }]
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => createApiResponse(mockPerson)
      });

      const result = await personSync.createPerson(personData);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/persons'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining(personData.name)
        })
      );

      expect(result).toMatchObject({
        id: mockPerson.id,
        name: mockPerson.name
      });
    });

    it('should update a person', async () => {
      const personId = 123;
      const updates = {
        name: 'Jane Doe',
        email: 'jane@example.com'
      };

      const updatedPerson = createMockPerson({
        id: personId,
        ...updates,
        email: [{ value: updates.email, primary: true }]
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createApiResponse(updatedPerson)
      });

      const result = await personSync.updatePerson(personId, updates);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/persons/${personId}`),
        expect.objectContaining({
          method: 'PUT',
          body: expect.stringContaining(updates.name)
        })
      );

      expect(result.name).toBe(updates.name);
    });

    it('should delete a person', async () => {
      const personId = 123;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createApiResponse({ id: personId })
      });

      await personSync.deletePerson(personId);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/persons/${personId}`),
        expect.objectContaining({
          method: 'DELETE'
        })
      );
    });

    it('should get a person by ID', async () => {
      const personId = 123;
      const mockPerson = createMockPerson({ id: personId });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createApiResponse(mockPerson)
      });

      const result = await personSync.getPerson(personId);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/persons/${personId}`),
        expect.any(Object)
      );

      expect(result).toMatchObject({
        id: personId
      });
    });

    it('should search persons', async () => {
      const searchTerm = 'john';
      const mockPersons = [
        createMockPerson({ name: 'John Doe' }),
        createMockPerson({ name: 'John Smith' })
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createApiResponse(mockPersons)
      });

      const results = await personSync.searchPersons(searchTerm);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/persons/search?term=${searchTerm}`),
        expect.any(Object)
      );

      expect(results).toHaveLength(2);
    });
  });

  describe('Field Mapping', () => {
    it('should map ColdCopy fields to Pipedrive fields', async () => {
      const customFields = testData.customFields.person;
      
      // Mock custom fields response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createApiResponse(
          customFields.map(f => createMockField(f))
        )
      });

      const fieldMap = await personSync.getFieldMapping();

      expect(fieldMap).toHaveProperty('lead_source');
      expect(fieldMap).toHaveProperty('lead_score');
      expect(fieldMap).toHaveProperty('last_contacted');
    });

    it('should create missing custom fields', async () => {
      const existingFields = [createMockField({ key: 'lead_source' })];
      
      // Mock get fields - only lead_source exists
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createApiResponse(existingFields)
      });

      // Mock create field for lead_score
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => createApiResponse(
          createMockField({ key: 'lead_score', name: 'Lead Score' })
        )
      });

      await personSync.ensureCustomFields([
        { key: 'lead_source', name: 'Lead Source', type: 'varchar' },
        { key: 'lead_score', name: 'Lead Score', type: 'double' }
      ]);

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenLastCalledWith(
        expect.stringContaining('/personFields'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('lead_score')
        })
      );
    });

    it('should transform data with custom field mapping', async () => {
      const fieldMap = {
        lead_source: 'abc123',
        lead_score: 'def456',
        last_contacted: 'ghi789'
      };

      const coldCopyData = {
        name: 'Test Person',
        email: 'test@example.com',
        leadSource: 'Website',
        leadScore: 85,
        lastContacted: '2024-01-15'
      };

      const transformed = personSync.transformToPipedriveFormat(
        coldCopyData,
        fieldMap
      );

      expect(transformed).toMatchObject({
        name: coldCopyData.name,
        email: coldCopyData.email,
        [fieldMap.lead_source]: coldCopyData.leadSource,
        [fieldMap.lead_score]: coldCopyData.leadScore,
        [fieldMap.last_contacted]: coldCopyData.lastContacted
      });
    });

    it('should handle array fields correctly', () => {
      const data = {
        name: 'Test Person',
        emails: ['primary@example.com', 'secondary@example.com'],
        phones: ['+1234567890', '+0987654321']
      };

      const transformed = personSync.transformToPipedriveFormat(data);

      expect(transformed.email).toEqual([
        { value: data.emails[0], primary: true },
        { value: data.emails[1], primary: false }
      ]);

      expect(transformed.phone).toEqual([
        { value: data.phones[0], primary: true },
        { value: data.phones[1], primary: false }
      ]);
    });
  });

  describe('Bulk Sync Operations', () => {
    it('should sync multiple persons in batches', async () => {
      const persons = Array.from({ length: 150 }, (_, i) => ({
        name: `Person ${i}`,
        email: `person${i}@example.com`
      }));

      // Mock batch create responses
      for (let i = 0; i < 3; i++) {
        const batchStart = i * 50;
        const batchEnd = Math.min((i + 1) * 50, persons.length);
        const batchPersons = persons.slice(batchStart, batchEnd)
          .map((p, idx) => createMockPerson({
            id: batchStart + idx + 1,
            name: p.name,
            email: [{ value: p.email, primary: true }]
          }));

        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => createApiResponse(batchPersons)
        });
      }

      const results = await personSync.bulkCreatePersons(persons);

      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(results).toHaveLength(150);
      expect(results[0]).toHaveProperty('id');
    });

    it('should handle bulk sync errors gracefully', async () => {
      const persons = [
        { name: 'Valid Person', email: 'valid@example.com' },
        { name: 'Invalid Person', email: 'invalid-email' },
        { name: 'Another Valid', email: 'another@example.com' }
      ];

      // First person succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => createApiResponse(createMockPerson({ id: 1 }))
      });

      // Second person fails
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Invalid email format' })
      });

      // Third person succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => createApiResponse(createMockPerson({ id: 3 }))
      });

      const results = await personSync.bulkCreatePersons(persons, {
        continueOnError: true
      });

      expect(results.successful).toHaveLength(2);
      expect(results.failed).toHaveLength(1);
      expect(results.failed[0]).toMatchObject({
        index: 1,
        error: expect.stringContaining('Invalid email')
      });
    });

    it('should deduplicate persons before sync', async () => {
      const persons = [
        { name: 'John Doe', email: 'john@example.com' },
        { name: 'John Doe', email: 'john@example.com' }, // Duplicate
        { name: 'Jane Doe', email: 'jane@example.com' }
      ];

      // Mock search for existing persons
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createApiResponse([
          createMockPerson({ 
            id: 100,
            email: [{ value: 'john@example.com', primary: true }] 
          })
        ])
      });

      // Only create Jane (John already exists)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => createApiResponse(createMockPerson({ id: 101 }))
      });

      const results = await personSync.bulkCreatePersons(persons, {
        skipDuplicates: true
      });

      expect(results.created).toHaveLength(1);
      expect(results.skipped).toHaveLength(2);
    });
  });

  describe('Two-way Sync', () => {
    it('should sync persons from Pipedrive to ColdCopy', async () => {
      const pipedrivePersons = [
        createMockPerson({ id: 1, name: 'Person 1' }),
        createMockPerson({ id: 2, name: 'Person 2' })
      ];

      // Mock paginated response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createPaginatedResponse(pipedrivePersons, 0, 100, false)
      });

      // Mock Supabase upserts
      mockSupabaseClient.from.mockReturnValue({
        ...mockSupabaseClient,
        upsert: vi.fn().mockResolvedValue({ data: null, error: null })
      });

      await personSync.syncFromPipedrive({
        since: new Date('2024-01-01')
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/persons'),
        expect.any(Object)
      );

      expect(mockSupabaseClient.upsert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            pipedrive_id: 1,
            name: 'Person 1'
          })
        ])
      );
    });

    it('should sync persons from ColdCopy to Pipedrive', async () => {
      const coldCopyLeads = [
        {
          id: 'lead-1',
          name: 'New Lead 1',
          email: 'lead1@example.com',
          pipedrive_id: null
        },
        {
          id: 'lead-2', 
          name: 'Existing Lead',
          email: 'lead2@example.com',
          pipedrive_id: 123
        }
      ];

      // Mock Supabase query
      mockSupabaseClient.select.mockResolvedValue({
        data: coldCopyLeads,
        error: null
      });

      // Mock create for new lead
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => createApiResponse(createMockPerson({ id: 456 }))
      });

      // Mock update for existing lead
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createApiResponse(createMockPerson({ id: 123 }))
      });

      await personSync.syncToPipedrive();

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenNthCalledWith(1,
        expect.stringContaining('/persons'),
        expect.objectContaining({ method: 'POST' })
      );
      expect(mockFetch).toHaveBeenNthCalledWith(2,
        expect.stringContaining('/persons/123'),
        expect.objectContaining({ method: 'PUT' })
      );
    });

    it('should handle sync conflicts', async () => {
      const lastSyncTime = new Date('2024-01-01T10:00:00Z');
      
      const coldCopyLead = {
        id: 'lead-1',
        name: 'Lead Name - ColdCopy',
        email: 'lead@example.com',
        pipedrive_id: 123,
        updated_at: '2024-01-01T11:00:00Z'
      };

      const pipedrivePerson = createMockPerson({
        id: 123,
        name: 'Lead Name - Pipedrive',
        update_time: '2024-01-01T11:30:00Z'
      });

      // Mock getting ColdCopy lead
      mockSupabaseClient.single.mockResolvedValue({
        data: coldCopyLead,
        error: null
      });

      // Mock getting Pipedrive person
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createApiResponse(pipedrivePerson)
      });

      const conflict = await personSync.detectConflict(
        coldCopyLead.id,
        lastSyncTime
      );

      expect(conflict).toBeTruthy();
      expect(conflict.type).toBe('both_modified');
      expect(conflict.localVersion.name).toBe('Lead Name - ColdCopy');
      expect(conflict.remoteVersion.name).toBe('Lead Name - Pipedrive');
    });
  });

  describe('Data Validation', () => {
    it('should validate email addresses', async () => {
      const invalidEmails = [
        'notanemail',
        '@example.com',
        'test@',
        'test..email@example.com'
      ];

      for (const email of invalidEmails) {
        await expect(
          personSync.createPerson({ name: 'Test', email })
        ).rejects.toThrow('Invalid email');
      }
    });

    it('should validate phone numbers', async () => {
      const validPhones = [
        '+1234567890',
        '+44 20 1234 5678',
        '(555) 123-4567'
      ];

      const invalidPhones = [
        '123', // Too short
        'not-a-phone',
        '++123456'
      ];

      for (const phone of validPhones) {
        expect(personSync.isValidPhone(phone)).toBe(true);
      }

      for (const phone of invalidPhones) {
        expect(personSync.isValidPhone(phone)).toBe(false);
      }
    });

    it('should sanitize person data', () => {
      const dirtyData = {
        name: '  John Doe  ',
        email: 'JOHN@EXAMPLE.COM  ',
        phone: ' +1 (234) 567-890 ',
        organization: '  Acme Corp.  '
      };

      const sanitized = personSync.sanitizePersonData(dirtyData);

      expect(sanitized).toEqual({
        name: 'John Doe',
        email: 'john@example.com',
        phone: '+1234567890',
        organization: 'Acme Corp.'
      });
    });
  });

  describe('Webhook Integration', () => {
    it('should handle person.added webhook', async () => {
      const webhookData = {
        event: 'person.added',
        current: createMockPerson({ id: 123 })
      };

      mockSupabaseClient.from.mockReturnValue({
        ...mockSupabaseClient,
        insert: vi.fn().mockResolvedValue({ data: null, error: null })
      });

      await personSync.handleWebhook(webhookData);

      expect(mockSupabaseClient.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          pipedrive_id: 123,
          name: webhookData.current.name
        })
      );
    });

    it('should handle person.updated webhook', async () => {
      const webhookData = {
        event: 'person.updated',
        current: createMockPerson({ id: 123, name: 'Updated Name' }),
        previous: createMockPerson({ id: 123, name: 'Old Name' })
      };

      mockSupabaseClient.from.mockReturnValue({
        ...mockSupabaseClient,
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null })
        })
      });

      await personSync.handleWebhook(webhookData);

      expect(mockSupabaseClient.update).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Updated Name'
        })
      );
    });

    it('should handle person.deleted webhook', async () => {
      const webhookData = {
        event: 'person.deleted',
        previous: createMockPerson({ id: 123 })
      };

      mockSupabaseClient.from.mockReturnValue({
        ...mockSupabaseClient,
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null })
        })
      });

      await personSync.handleWebhook(webhookData);

      expect(mockSupabaseClient.update).toHaveBeenCalledWith(
        expect.objectContaining({
          deleted_at: expect.any(String)
        })
      );
    });
  });
});