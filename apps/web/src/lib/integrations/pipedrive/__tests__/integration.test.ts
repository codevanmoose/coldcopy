import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PipedriveIntegration } from '../index';
import { 
  mockSupabaseClient, 
  mockFetch,
  mockRedisClient,
  createMockPerson,
  createMockDeal,
  createMockActivity,
  createMockWebhook,
  createWebhookEvent,
  createApiResponse,
  createPaginatedResponse,
  createBulkItems,
  testConfig,
  useMockTimers
} from './test-utils';
import { testData, TEST_ENV } from './test.config';

describe('Pipedrive Integration E2E', () => {
  let integration: PipedriveIntegration;
  let webhookServer: any;

  beforeEach(() => {
    vi.clearAllMocks();
    integration = new PipedriveIntegration({
      config: testConfig,
      supabaseClient: mockSupabaseClient,
      redisClient: mockRedisClient,
      workspaceId: testData.workspace.id
    });
  });

  afterEach(() => {
    if (webhookServer) {
      webhookServer.close();
    }
  });

  describe('Complete Setup Flow', () => {
    it('should complete full integration setup', async () => {
      // 1. Initialize connection
      const authCode = 'test-auth-code';
      const tokens = {
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        expires_in: 3600
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => tokens
      });

      await integration.connect({
        authCode,
        redirectUri: 'https://app.example.com/auth/callback'
      });

      // 2. Verify custom fields
      const customFields = testData.customFields;
      
      // Mock existing fields check
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createApiResponse([])
      });

      // Mock field creation
      for (const fieldType of Object.keys(customFields)) {
        for (const field of customFields[fieldType]) {
          mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 201,
            json: async () => createApiResponse(field)
          });
        }
      }

      await integration.setupCustomFields();

      // 3. Register webhooks
      const webhookUrl = 'https://app.example.com/api/pipedrive/webhook';
      const eventTypes = testData.webhookEvents;

      for (const eventType of eventTypes) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 201,
          json: async () => createApiResponse(
            createMockWebhook({
              event_action: eventType.split('.')[1],
              event_object: eventType.split('.')[0]
            })
          )
        });
      }

      await integration.registerWebhooks(webhookUrl);

      // 4. Initial sync
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createPaginatedResponse(
          createBulkItems(50, i => createMockPerson({ id: i + 1 })),
          0, 50, false
        )
      });

      mockSupabaseClient.from.mockReturnValue({
        ...mockSupabaseClient,
        insert: vi.fn().mockResolvedValue({ data: null, error: null })
      });

      const syncResult = await integration.performInitialSync();

      expect(syncResult.persons.synced).toBe(50);
      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe('Lead to Deal Workflow', () => {
    it('should handle complete lead qualification workflow', async () => {
      // 1. Create lead in ColdCopy
      const lead = {
        id: 'lead-123',
        name: 'Jane Smith',
        email: 'jane@example.com',
        company: 'Acme Corp',
        leadScore: 45,
        campaignId: 'campaign-456'
      };

      // 2. Sync lead to Pipedrive as person
      const mockPerson = createMockPerson({
        id: 789,
        name: lead.name,
        email: [{ value: lead.email, primary: true }]
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => createApiResponse(mockPerson)
      });

      const person = await integration.createPerson(lead);

      // 3. Track email engagement
      const emailEvents = [
        { type: 'sent', timestamp: new Date() },
        { type: 'opened', timestamp: new Date(Date.now() + 3600000) },
        { type: 'clicked', timestamp: new Date(Date.now() + 3900000) }
      ];

      for (const event of emailEvents) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 201,
          json: async () => createApiResponse(
            createMockActivity({
              person_id: person.id,
              type: 'email',
              subject: `Email ${event.type}`
            })
          )
        });
      }

      await integration.syncEmailEvents(lead.id, emailEvents);

      // 4. Update lead score
      lead.leadScore = 85; // Qualified

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createApiResponse({
          ...mockPerson,
          'lead_score_field': 85
        })
      });

      await integration.updatePersonScore(person.id, lead.leadScore);

      // 5. Auto-create deal when qualified
      const mockDeal = createMockDeal({
        id: 999,
        person_id: person.id,
        title: `${lead.company} - ${lead.name}`,
        value: 50000,
        pipeline_id: 1,
        stage_id: 1
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => createApiResponse(mockDeal)
      });

      const deal = await integration.createDealFromQualifiedLead(lead);

      expect(deal.person_id).toBe(person.id);
      expect(deal.title).toContain(lead.company);

      // 6. Schedule follow-up activity
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => createApiResponse(
          createMockActivity({
            deal_id: deal.id,
            type: 'task',
            subject: 'Initial follow-up call'
          })
        )
      });

      await integration.scheduleFollowUp(deal.id, 'task', 2);
    });
  });

  describe('Campaign Integration Flow', () => {
    it('should sync campaign results to Pipedrive', async () => {
      const campaign = {
        id: 'campaign-123',
        name: 'Q1 Outreach',
        startDate: new Date('2024-01-01'),
        recipients: [
          { email: 'lead1@example.com', name: 'Lead 1' },
          { email: 'lead2@example.com', name: 'Lead 2' },
          { email: 'lead3@example.com', name: 'Lead 3' }
        ]
      };

      // 1. Create persons for campaign recipients
      const createdPersons = [];
      for (const recipient of campaign.recipients) {
        const mockPerson = createMockPerson({
          name: recipient.name,
          email: [{ value: recipient.email, primary: true }]
        });

        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 201,
          json: async () => createApiResponse(mockPerson)
        });

        createdPersons.push(mockPerson);
      }

      const persons = await integration.syncCampaignRecipients(campaign);

      // 2. Create deals for engaged recipients
      const engagedRecipients = persons.slice(0, 2); // First 2 engaged

      for (const person of engagedRecipients) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 201,
          json: async () => createApiResponse(
            createMockDeal({
              person_id: person.id,
              title: `${campaign.name} - ${person.name}`,
              pipeline_id: 2 // Outreach pipeline
            })
          )
        });
      }

      const deals = await integration.createDealsForEngagedRecipients(
        campaign.id,
        engagedRecipients.map(p => p.id)
      );

      expect(deals).toHaveLength(2);

      // 3. Update campaign metrics
      const metrics = {
        sent: 3,
        opened: 2,
        clicked: 1,
        replied: 1
      };

      mockSupabaseClient.from.mockReturnValue({
        ...mockSupabaseClient,
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null })
        })
      });

      await integration.updateCampaignMetrics(campaign.id, metrics);

      // 4. Sync engagement activities
      const activities = [
        { personId: persons[0].id, type: 'email', action: 'opened' },
        { personId: persons[0].id, type: 'email', action: 'clicked' },
        { personId: persons[1].id, type: 'email', action: 'opened' }
      ];

      for (const activity of activities) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 201,
          json: async () => createApiResponse(createMockActivity())
        });
      }

      await integration.syncCampaignActivities(campaign.id, activities);
    });
  });

  describe('Real-time Sync Workflow', () => {
    it('should handle bidirectional real-time updates', async () => {
      const timers = useMockTimers();

      // 1. Setup webhook listener
      const webhookHandler = integration.createWebhookHandler();

      // 2. Simulate Pipedrive person update via webhook
      const personUpdate = createWebhookEvent(
        'updated',
        'person',
        createMockPerson({
          id: 123,
          name: 'Updated Name',
          email: [{ value: 'updated@example.com', primary: true }]
        })
      );

      mockSupabaseClient.from.mockReturnValue({
        ...mockSupabaseClient,
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null })
        })
      });

      await webhookHandler(personUpdate);

      // 3. Simulate ColdCopy lead update
      const coldCopyUpdate = {
        id: 'lead-123',
        pipedrive_id: 123,
        leadScore: 90,
        lastContacted: new Date()
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createApiResponse(createMockPerson({ id: 123 }))
      });

      await integration.syncLeadUpdate(coldCopyUpdate);

      // 4. Handle conflict detection
      const conflictingUpdate = {
        id: 'lead-123',
        pipedrive_id: 123,
        name: 'Conflicting Name',
        updated_at: new Date()
      };

      // Mock both sides modified
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: {
          ...conflictingUpdate,
          updated_at: new Date(Date.now() - 5000)
        },
        error: null
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createApiResponse(
          createMockPerson({
            id: 123,
            name: 'Different Name',
            update_time: new Date(Date.now() - 3000).toISOString()
          })
        )
      });

      const conflict = await integration.detectConflict(conflictingUpdate);
      expect(conflict).toBeTruthy();

      timers.cleanup();
    });
  });

  describe('Analytics Integration', () => {
    it('should sync analytics data between systems', async () => {
      // 1. Get Pipedrive pipeline metrics
      const deals = createBulkItems(20, i => createMockDeal({
        id: i + 1,
        pipeline_id: 1,
        stage_id: (i % 5) + 1,
        value: 10000 + (i * 1000),
        status: i > 15 ? 'won' : 'open'
      }));

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createApiResponse(deals)
      });

      const pipelineMetrics = await integration.getPipelineAnalytics(1);

      expect(pipelineMetrics).toMatchObject({
        totalDeals: 20,
        wonDeals: 4,
        totalValue: expect.any(Number),
        averageDealSize: expect.any(Number),
        conversionRate: 0.2
      });

      // 2. Sync email performance to deals
      const emailMetrics = {
        dealId: 123,
        emailsSent: 5,
        emailsOpened: 4,
        emailsClicked: 2,
        replies: 1
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createApiResponse(createMockDeal({ id: 123 }))
      });

      await integration.updateDealEmailMetrics(emailMetrics);

      // 3. Generate combined report
      mockSupabaseClient.select.mockResolvedValueOnce({
        data: [
          { campaign_id: 'camp-1', deals_created: 10, revenue_generated: 150000 },
          { campaign_id: 'camp-2', deals_created: 5, revenue_generated: 75000 }
        ],
        error: null
      });

      const report = await integration.generateCampaignROIReport();

      expect(report).toHaveLength(2);
      expect(report[0].roi).toBeDefined();
    });
  });

  describe('Error Recovery Flow', () => {
    it('should handle and recover from various failure scenarios', async () => {
      // 1. API rate limit during sync
      const persons = createBulkItems(10, i => ({ 
        name: `Person ${i}`, 
        email: `person${i}@example.com` 
      }));

      // First 5 succeed
      for (let i = 0; i < 5; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 201,
          json: async () => createApiResponse(createMockPerson({ id: i + 1 }))
        });
      }

      // Hit rate limit
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Map([['Retry-After', '60']]),
        json: async () => ({ error: 'Rate limit exceeded' })
      });

      // Resume after rate limit
      for (let i = 5; i < 10; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 201,
          json: async () => createApiResponse(createMockPerson({ id: i + 1 }))
        });
      }

      const result = await integration.bulkCreatePersons(persons, {
        handleRateLimit: true
      });

      expect(result.created).toBe(10);
      expect(result.rateLimitPauses).toBe(1);

      // 2. Webhook processing failure
      const webhookEvent = createWebhookEvent('added', 'person', createMockPerson());

      // First attempt fails
      mockSupabaseClient.from.mockReturnValueOnce({
        ...mockSupabaseClient,
        insert: vi.fn().mockRejectedValueOnce(new Error('Database error'))
      });

      // Retry succeeds
      mockSupabaseClient.from.mockReturnValueOnce({
        ...mockSupabaseClient,
        insert: vi.fn().mockResolvedValueOnce({ data: null, error: null })
      });

      await integration.processWebhookWithRetry(webhookEvent);

      // 3. Partial sync failure recovery
      mockRedisClient.get.mockResolvedValueOnce(
        JSON.stringify({
          status: 'failed',
          lastSuccessfulId: 50,
          error: 'Network timeout'
        })
      );

      // Resume from last successful point
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createPaginatedResponse(
          createBulkItems(50, i => createMockPerson({ id: 51 + i })),
          50, 50, false
        )
      });

      mockSupabaseClient.from.mockReturnValue({
        ...mockSupabaseClient,
        insert: vi.fn().mockResolvedValue({ data: null, error: null })
      });

      const resumed = await integration.resumeFailedSync();
      expect(resumed.resumedFrom).toBe(50);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle high-volume operations efficiently', async () => {
      const startTime = Date.now();
      const totalRecords = 10000;
      const batchSize = 500;

      // Mock batch processing
      for (let batch = 0; batch < totalRecords / batchSize; batch++) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => createPaginatedResponse(
            createBulkItems(batchSize, i => createMockPerson({ 
              id: batch * batchSize + i + 1 
            })),
            batch * batchSize,
            batchSize,
            batch < (totalRecords / batchSize) - 1
          )
        });

        mockSupabaseClient.from.mockReturnValue({
          ...mockSupabaseClient,
          insert: vi.fn().mockResolvedValue({ data: null, error: null })
        });
      }

      const result = await integration.performHighVolumeSyc({
        batchSize,
        parallel: true,
        maxConcurrent: 5
      });

      const duration = Date.now() - startTime;
      const recordsPerSecond = totalRecords / (duration / 1000);

      expect(result.totalSynced).toBe(totalRecords);
      expect(recordsPerSecond).toBeGreaterThan(1000); // Should handle >1000 records/second
      expect(result.memoryPeakMB).toBeLessThan(512); // Memory usage under control
    });
  });

  describe('Security and Compliance', () => {
    it('should handle sensitive data securely', async () => {
      // 1. Encrypt API tokens
      const tokens = {
        access_token: 'sensitive-access-token',
        refresh_token: 'sensitive-refresh-token'
      };

      mockSupabaseClient.from.mockReturnValue({
        ...mockSupabaseClient,
        insert: vi.fn().mockImplementation((data) => {
          // Verify tokens are encrypted
          expect(data.access_token).not.toBe(tokens.access_token);
          expect(data.refresh_token).not.toBe(tokens.refresh_token);
          expect(data.access_token).toMatch(/^[a-f0-9]+:[a-f0-9]+$/);
          return Promise.resolve({ data: null, error: null });
        })
      });

      await integration.storeTokens(tokens);

      // 2. Audit sensitive operations
      const auditLog = vi.spyOn(integration, 'auditLog');

      await integration.exportPersonData(123);
      expect(auditLog).toHaveBeenCalledWith({
        action: 'data_export',
        entity: 'person',
        entityId: 123,
        userId: expect.any(String)
      });

      // 3. Handle GDPR deletion
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createApiResponse({ id: 123 })
      });

      mockSupabaseClient.from.mockReturnValue({
        ...mockSupabaseClient,
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null })
        })
      });

      await integration.deletePersonData(123, { 
        gdprRequest: true,
        purgeCompletely: true 
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/persons/123'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });
});