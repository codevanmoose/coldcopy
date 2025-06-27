import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DealManager } from '../deal-management';
import { 
  mockSupabaseClient, 
  mockFetch,
  createMockDeal,
  createMockPipeline,
  createMockStage,
  createMockActivity,
  createMockNote,
  createApiResponse,
  createPaginatedResponse,
  testConfig
} from './test-utils';
import { testData } from './test.config';

describe('Pipedrive Deal Management', () => {
  let dealManager: DealManager;

  beforeEach(() => {
    vi.clearAllMocks();
    dealManager = new DealManager({
      config: testConfig,
      supabaseClient: mockSupabaseClient,
      workspaceId: testData.workspace.id
    });
  });

  describe('Deal CRUD Operations', () => {
    it('should create a deal', async () => {
      const dealData = {
        title: 'New Business Opportunity',
        value: 50000,
        currency: 'USD',
        personId: 123,
        organizationId: 456,
        pipelineId: 1,
        stageId: 1
      };

      const mockDeal = createMockDeal({
        ...dealData,
        id: 789,
        person_id: dealData.personId,
        org_id: dealData.organizationId,
        pipeline_id: dealData.pipelineId,
        stage_id: dealData.stageId
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => createApiResponse(mockDeal)
      });

      const result = await dealManager.createDeal(dealData);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/deals'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining(dealData.title)
        })
      );

      expect(result).toMatchObject({
        id: mockDeal.id,
        title: mockDeal.title,
        value: mockDeal.value
      });
    });

    it('should update a deal', async () => {
      const dealId = 789;
      const updates = {
        title: 'Updated Opportunity',
        value: 75000,
        probability: 80
      };

      const updatedDeal = createMockDeal({
        id: dealId,
        ...updates
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createApiResponse(updatedDeal)
      });

      const result = await dealManager.updateDeal(dealId, updates);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/deals/${dealId}`),
        expect.objectContaining({
          method: 'PUT',
          body: expect.stringContaining(updates.title)
        })
      );

      expect(result).toMatchObject(updates);
    });

    it('should delete a deal', async () => {
      const dealId = 789;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createApiResponse({ id: dealId })
      });

      await dealManager.deleteDeal(dealId);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/deals/${dealId}`),
        expect.objectContaining({
          method: 'DELETE'
        })
      );
    });

    it('should mark deal as won', async () => {
      const dealId = 789;
      const wonTime = new Date();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createApiResponse(
          createMockDeal({
            id: dealId,
            status: 'won',
            won_time: wonTime.toISOString()
          })
        )
      });

      const result = await dealManager.markDealAsWon(dealId);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/deals/${dealId}`),
        expect.objectContaining({
          method: 'PUT',
          body: expect.stringContaining('won')
        })
      );

      expect(result.status).toBe('won');
      expect(result.won_time).toBeTruthy();
    });

    it('should mark deal as lost with reason', async () => {
      const dealId = 789;
      const lostReason = 'Price too high';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createApiResponse(
          createMockDeal({
            id: dealId,
            status: 'lost',
            lost_reason: lostReason,
            lost_time: new Date().toISOString()
          })
        )
      });

      const result = await dealManager.markDealAsLost(dealId, lostReason);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/deals/${dealId}`),
        expect.objectContaining({
          method: 'PUT',
          body: expect.stringContaining(lostReason)
        })
      );

      expect(result.status).toBe('lost');
      expect(result.lost_reason).toBe(lostReason);
    });
  });

  describe('Pipeline Operations', () => {
    it('should get all pipelines', async () => {
      const mockPipelines = testData.pipelines.map(p => 
        createMockPipeline(p)
      );

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createApiResponse(mockPipelines)
      });

      const pipelines = await dealManager.getPipelines();

      expect(pipelines).toHaveLength(2);
      expect(pipelines[0].name).toBe('Sales Pipeline');
    });

    it('should get stages for a pipeline', async () => {
      const pipelineId = 1;
      const mockStages = testData.pipelines[0].stages.map(s =>
        createMockStage(s)
      );

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createApiResponse(mockStages)
      });

      const stages = await dealManager.getStages(pipelineId);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/stages?pipeline_id=${pipelineId}`),
        expect.any(Object)
      );

      expect(stages).toHaveLength(6);
      expect(stages[0].name).toBe('Lead');
    });

    it('should move deal to different stage', async () => {
      const dealId = 789;
      const newStageId = 3;

      const updatedDeal = createMockDeal({
        id: dealId,
        stage_id: newStageId,
        stage_change_time: new Date().toISOString()
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createApiResponse(updatedDeal)
      });

      const result = await dealManager.moveDealToStage(dealId, newStageId);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/deals/${dealId}`),
        expect.objectContaining({
          method: 'PUT',
          body: expect.stringContaining(`"stage_id":${newStageId}`)
        })
      );

      expect(result.stage_id).toBe(newStageId);
      expect(result.stage_change_time).toBeTruthy();
    });

    it('should validate stage transitions', async () => {
      const deal = createMockDeal({
        id: 789,
        stage_id: 5, // Won stage
        status: 'won'
      });

      // Should not allow moving won deal to earlier stage
      await expect(
        dealManager.moveDealToStage(deal.id, 2, { validateTransition: true })
      ).rejects.toThrow('Cannot move won deal to earlier stage');
    });

    it('should bulk move deals between stages', async () => {
      const dealIds = [100, 101, 102];
      const newStageId = 3;

      // Mock individual updates
      for (const dealId of dealIds) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => createApiResponse(
            createMockDeal({ id: dealId, stage_id: newStageId })
          )
        });
      }

      const results = await dealManager.bulkMoveDeals(dealIds, newStageId);

      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(results.successful).toHaveLength(3);
      expect(results.failed).toHaveLength(0);
    });
  });

  describe('Deal Analytics', () => {
    it('should calculate pipeline metrics', async () => {
      const pipelineId = 1;
      const deals = [
        createMockDeal({ pipeline_id: pipelineId, value: 10000, stage_id: 1 }),
        createMockDeal({ pipeline_id: pipelineId, value: 20000, stage_id: 2 }),
        createMockDeal({ pipeline_id: pipelineId, value: 30000, stage_id: 3 }),
        createMockDeal({ pipeline_id: pipelineId, value: 40000, stage_id: 5, status: 'won' }),
        createMockDeal({ pipeline_id: pipelineId, value: 15000, stage_id: 6, status: 'lost' })
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createPaginatedResponse(deals, 0, 100, false)
      });

      const metrics = await dealManager.getPipelineMetrics(pipelineId);

      expect(metrics).toMatchObject({
        totalDeals: 5,
        openDeals: 3,
        wonDeals: 1,
        lostDeals: 1,
        totalValue: 60000, // Open deals only
        wonValue: 40000,
        lostValue: 15000,
        averageDealSize: 20000,
        winRate: 0.5 // 1 won / (1 won + 1 lost)
      });
    });

    it('should calculate stage conversion rates', async () => {
      const pipelineId = 1;
      const stages = testData.pipelines[0].stages;
      
      // Mock stage data
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createApiResponse(stages.map(s => createMockStage(s)))
      });

      // Mock deals per stage
      const dealsByStage = {
        1: 50,  // Lead
        2: 35,  // Qualified
        3: 20,  // Proposal
        4: 15,  // Negotiation
        5: 10,  // Won
        6: 5    // Lost
      };

      for (const [stageId, count] of Object.entries(dealsByStage)) {
        const deals = Array(count).fill(null).map(() => 
          createMockDeal({ stage_id: parseInt(stageId) })
        );
        
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => createApiResponse({ count })
        });
      }

      const conversionRates = await dealManager.getStageConversionRates(pipelineId);

      expect(conversionRates).toMatchObject({
        '1-2': 0.7,   // 35/50
        '2-3': 0.571, // 20/35
        '3-4': 0.75,  // 15/20
        '4-5': 0.667  // 10/15
      });
    });

    it('should get deal velocity metrics', async () => {
      const dealId = 789;
      const stageHistory = [
        { stage_id: 1, entered_at: '2024-01-01T10:00:00Z' },
        { stage_id: 2, entered_at: '2024-01-03T14:00:00Z' },
        { stage_id: 3, entered_at: '2024-01-08T09:00:00Z' },
        { stage_id: 5, entered_at: '2024-01-15T16:00:00Z' }
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createApiResponse(stageHistory)
      });

      const velocity = await dealManager.getDealVelocity(dealId);

      expect(velocity).toMatchObject({
        totalDays: 14.25, // ~14 days from stage 1 to stage 5
        averageDaysPerStage: 4.75,
        stageMetrics: {
          1: { days: 2.17 },  // ~2 days in stage 1
          2: { days: 4.79 },  // ~5 days in stage 2
          3: { days: 7.29 }   // ~7 days in stage 3
        }
      });
    });
  });

  describe('Deal Activities', () => {
    it('should add activity to deal', async () => {
      const dealId = 789;
      const activityData = {
        type: 'call',
        subject: 'Follow-up call',
        note: 'Discussed pricing options',
        due_date: '2024-01-20',
        due_time: '14:00'
      };

      const mockActivity = createMockActivity({
        ...activityData,
        deal_id: dealId
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => createApiResponse(mockActivity)
      });

      const result = await dealManager.addActivity(dealId, activityData);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/activities'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining(activityData.subject)
        })
      );

      expect(result).toMatchObject({
        deal_id: dealId,
        subject: activityData.subject
      });
    });

    it('should get deal timeline', async () => {
      const dealId = 789;
      const activities = [
        createMockActivity({ deal_id: dealId, type: 'email', done: true }),
        createMockActivity({ deal_id: dealId, type: 'call', done: true }),
        createMockActivity({ deal_id: dealId, type: 'meeting', done: false })
      ];

      const notes = [
        createMockNote({ deal_id: dealId, content: 'Initial contact' }),
        createMockNote({ deal_id: dealId, content: 'Price negotiation' })
      ];

      // Mock activities
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createApiResponse(activities)
      });

      // Mock notes
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createApiResponse(notes)
      });

      const timeline = await dealManager.getDealTimeline(dealId);

      expect(timeline).toHaveLength(5);
      expect(timeline[0].type).toMatch(/email|call|meeting|note/);
    });

    it('should schedule next activity based on stage', async () => {
      const dealId = 789;
      const deal = createMockDeal({
        id: dealId,
        stage_id: 2 // Qualified stage
      });

      // Mock get deal
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createApiResponse(deal)
      });

      // Mock activity creation
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => createApiResponse(createMockActivity({
          deal_id: dealId,
          type: 'task',
          subject: 'Send proposal'
        }))
      });

      const activity = await dealManager.scheduleNextActivity(dealId);

      expect(activity.subject).toContain('proposal');
      expect(activity.type).toBe('task');
    });
  });

  describe('Deal Custom Fields', () => {
    it('should map campaign data to deal custom fields', async () => {
      const customFields = testData.customFields.deal;
      
      // Mock custom fields
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createApiResponse(customFields)
      });

      const dealData = {
        title: 'New Deal',
        value: 10000,
        campaignId: 'campaign-123',
        emailEngagement: 0.75,
        qualifiedDate: '2024-01-15'
      };

      const mapped = await dealManager.mapCustomFields(dealData);

      expect(mapped).toHaveProperty('campaign_id_field_key', dealData.campaignId);
      expect(mapped).toHaveProperty('email_engagement_field_key', dealData.emailEngagement);
      expect(mapped).toHaveProperty('qualified_date_field_key', dealData.qualifiedDate);
    });

    it('should sync deal custom fields with ColdCopy data', async () => {
      const dealId = 789;
      const coldCopyData = {
        lastEmailSent: '2024-01-10',
        emailOpens: 5,
        emailClicks: 2,
        leadScore: 85
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createApiResponse(
          createMockDeal({ id: dealId })
        )
      });

      await dealManager.syncCustomFields(dealId, coldCopyData);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/deals/${dealId}`),
        expect.objectContaining({
          method: 'PUT',
          body: expect.stringContaining('85') // Lead score
        })
      );
    });
  });

  describe('Deal Automation', () => {
    it('should auto-create deal from qualified lead', async () => {
      const leadData = {
        personId: 123,
        organizationId: 456,
        leadScore: 85,
        campaignName: 'Q1 Outreach',
        estimatedValue: 25000
      };

      const mockDeal = createMockDeal({
        person_id: leadData.personId,
        org_id: leadData.organizationId,
        value: leadData.estimatedValue
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => createApiResponse(mockDeal)
      });

      const deal = await dealManager.createDealFromLead(leadData);

      expect(deal.title).toContain(leadData.campaignName);
      expect(deal.value).toBe(leadData.estimatedValue);
    });

    it('should trigger stage-based automations', async () => {
      const dealId = 789;
      const oldStageId = 1;
      const newStageId = 2;

      const automations = await dealManager.getStageAutomations(newStageId);
      
      expect(automations).toContainEqual(
        expect.objectContaining({
          action: 'create_activity',
          params: expect.objectContaining({
            type: 'task',
            subject: expect.stringContaining('proposal')
          })
        })
      );
    });

    it('should handle deal assignment rules', async () => {
      const dealData = {
        title: 'Enterprise Deal',
        value: 100000,
        personId: 123
      };

      // Mock user lookup for round-robin assignment
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createApiResponse([
          { id: 1, name: 'Sales Rep 1', active_deals_count: 10 },
          { id: 2, name: 'Sales Rep 2', active_deals_count: 8 },
          { id: 3, name: 'Sales Rep 3', active_deals_count: 12 }
        ])
      });

      const assignedUserId = await dealManager.getAssignedUser(dealData);
      
      expect(assignedUserId).toBe(2); // User with least deals
    });
  });

  describe('Bulk Deal Operations', () => {
    it('should bulk import deals', async () => {
      const deals = Array.from({ length: 25 }, (_, i) => ({
        title: `Deal ${i + 1}`,
        value: 10000 + (i * 1000),
        personId: 100 + i
      }));

      // Mock batch responses
      for (let i = 0; i < 3; i++) {
        const batchDeals = deals.slice(i * 10, Math.min((i + 1) * 10, deals.length))
          .map((d, idx) => createMockDeal({
            id: 1000 + (i * 10) + idx,
            title: d.title,
            value: d.value,
            person_id: d.personId
          }));

        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => createApiResponse(batchDeals)
        });
      }

      const results = await dealManager.bulkImport(deals, { batchSize: 10 });

      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(results.created).toHaveLength(25);
      expect(results.failed).toHaveLength(0);
    });

    it('should bulk update deal stages with validation', async () => {
      const updates = [
        { dealId: 100, stageId: 2 },
        { dealId: 101, stageId: 3 },
        { dealId: 102, stageId: 5 } // Won stage
      ];

      for (const update of updates) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => createApiResponse(
            createMockDeal({ 
              id: update.dealId, 
              stage_id: update.stageId,
              status: update.stageId === 5 ? 'won' : 'open'
            })
          )
        });
      }

      const results = await dealManager.bulkUpdateStages(updates);

      expect(results.updated).toHaveLength(3);
      expect(results.updated[2].status).toBe('won');
    });
  });

  describe('Deal Search and Filtering', () => {
    it('should search deals by multiple criteria', async () => {
      const searchCriteria = {
        term: 'enterprise',
        minValue: 50000,
        maxValue: 200000,
        stages: [2, 3, 4],
        owners: [1, 2],
        dateRange: {
          start: '2024-01-01',
          end: '2024-01-31'
        }
      };

      const mockDeals = [
        createMockDeal({ title: 'Enterprise Deal 1', value: 75000 }),
        createMockDeal({ title: 'Enterprise Deal 2', value: 150000 })
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createApiResponse(mockDeals)
      });

      const results = await dealManager.searchDeals(searchCriteria);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('term=enterprise'),
        expect.any(Object)
      );

      expect(results).toHaveLength(2);
    });

    it('should filter deals by custom field values', async () => {
      const filters = {
        campaignId: 'campaign-123',
        minLeadScore: 70,
        hasEngagement: true
      };

      // Mock filter creation
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => createApiResponse({ id: 999 })
      });

      // Mock filtered deals
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createApiResponse([
          createMockDeal({ id: 100 }),
          createMockDeal({ id: 101 })
        ])
      });

      const results = await dealManager.filterByCustomFields(filters);

      expect(results).toHaveLength(2);
    });
  });
});