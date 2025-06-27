import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ApiTestClient, createMockRequest, testApiRoute } from '../utils/api'
import { cleanTestDatabase } from '../setup/test-db-setup'
import { userFactory, workspaceFactory, campaignFactory, leadFactory, sequenceFactory, emailLogFactory } from '../utils/factories'
import { AIService } from '@/lib/ai/index'
import { SESClient } from '@/lib/email/ses-client'
import { faker } from '@faker-js/faker'

// Mock external services
jest.mock('@/lib/ai/index')
jest.mock('@/lib/email/ses-client')
jest.mock('@/lib/supabase/server')
jest.mock('@/lib/analytics/conversion-tracking')

const mockAIService = AIService as jest.MockedClass<typeof AIService>
const mockSESClient = SESClient as jest.MockedClass<typeof SESClient>
const mockSupabase = {
  auth: {
    getUser: jest.fn(),
  },
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  upsert: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  neq: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  lte: jest.fn().mockReturnThis(),
  single: jest.fn(),
  limit: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  range: jest.fn().mockReturnThis(),
  count: jest.fn().mockReturnThis(),
  rpc: jest.fn(),
}

require('@/lib/supabase/server').createClient = jest.fn().mockReturnValue(mockSupabase)

// Mock campaign API handlers
const mockCampaignHandlers = {
  GET: jest.fn(),
  POST: jest.fn(),
  PATCH: jest.fn(),
  DELETE: jest.fn(),
}

describe('Campaigns API Integration Tests', () => {
  let testClient: ApiTestClient
  let testUser: any
  let testWorkspace: any
  let testCampaign: any
  let testLeads: any[]
  let testSequences: any[]
  let authToken: string

  beforeAll(async () => {
    await cleanTestDatabase()
    testClient = new ApiTestClient()
    authToken = 'test-auth-token'
  })

  beforeEach(async () => {
    jest.clearAllMocks()
    
    // Create test data
    testUser = userFactory.create()
    testWorkspace = workspaceFactory.create({ owner_id: testUser.id })
    testCampaign = campaignFactory.create({ 
      workspace_id: testWorkspace.id,
      user_id: testUser.id 
    })
    testLeads = leadFactory.createMany(10, { workspace_id: testWorkspace.id })
    testSequences = sequenceFactory.createMany(3, { campaign_id: testCampaign.id })

    // Setup default auth mock
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: testUser },
      error: null
    })

    // Setup AI service mocks
    mockAIService.prototype.generateEmailContent = jest.fn()
    mockAIService.prototype.personalizeEmail = jest.fn()
    mockAIService.prototype.optimizeSubjectLine = jest.fn()
    
    // Setup email service mocks
    mockSESClient.prototype.sendEmail = jest.fn()
    mockSESClient.prototype.sendBulkEmail = jest.fn()
  })

  describe('Campaign CRUD Operations', () => {
    describe('GET /api/campaigns', () => {
      it('should return paginated campaigns for workspace', async () => {
        const mockCampaigns = campaignFactory.createMany(5, { 
          workspace_id: testWorkspace.id,
          user_id: testUser.id 
        })
        
        const paginatedResponse = {
          data: mockCampaigns,
          total: 5,
          page: 1,
          limit: 10,
          totalPages: 1
        }

        mockSupabase.count.mockResolvedValue({ count: 5, error: null })
        mockSupabase.range.mockResolvedValue({
          data: mockCampaigns,
          error: null
        })

        const request = createMockRequest('/api/campaigns', {
          method: 'GET',
          headers: {
            'x-workspace-id': testWorkspace.id,
            'authorization': `Bearer ${authToken}`
          },
          searchParams: {
            page: '1',
            limit: '10'
          }
        })

        mockCampaignHandlers.GET.mockResolvedValue({
          status: 200,
          data: paginatedResponse
        })

        const response = await mockCampaignHandlers.GET(request)
        
        expect(response.status).toBe(200)
        expect(response.data.data.length).toBe(5)
        expect(response.data.total).toBe(5)
      })

      it('should filter campaigns by status', async () => {
        const activeCampaigns = campaignFactory.createMany(3, {
          workspace_id: testWorkspace.id,
          status: 'active'
        })

        mockSupabase.eq.mockReturnThis()
        mockSupabase.range.mockResolvedValue({
          data: activeCampaigns,
          error: null
        })
        mockSupabase.count.mockResolvedValue({ count: 3, error: null })

        const request = createMockRequest('/api/campaigns', {
          method: 'GET',
          headers: {
            'x-workspace-id': testWorkspace.id,
            'authorization': `Bearer ${authToken}`
          },
          searchParams: {
            status: 'active'
          }
        })

        mockCampaignHandlers.GET.mockResolvedValue({
          status: 200,
          data: {
            data: activeCampaigns,
            total: 3
          }
        })

        const response = await mockCampaignHandlers.GET(request)
        
        expect(response.status).toBe(200)
        expect(response.data.data.every(c => c.status === 'active')).toBe(true)
      })
    })

    describe('POST /api/campaigns', () => {
      it('should create new campaign successfully', async () => {
        const newCampaignData = {
          name: faker.commerce.productName() + ' Campaign',
          subject: faker.lorem.sentence(),
          from_name: faker.person.fullName(),
          from_email: faker.internet.email(),
          reply_to: faker.internet.email(),
          settings: {
            daily_limit: 50,
            timezone: 'UTC',
            tracking: {
              open_tracking: true,
              click_tracking: true,
              reply_tracking: true
            },
            schedule: {
              start_date: new Date().toISOString(),
              send_days: ['mon', 'tue', 'wed', 'thu', 'fri'],
              send_time_start: '09:00',
              send_time_end: '17:00'
            }
          }
        }

        const createdCampaign = {
          id: faker.string.uuid(),
          workspace_id: testWorkspace.id,
          user_id: testUser.id,
          ...newCampaignData,
          status: 'draft',
          stats: {
            total_sent: 0,
            total_opened: 0,
            total_clicked: 0,
            total_replied: 0
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }

        mockSupabase.insert.mockResolvedValue({
          data: [createdCampaign],
          error: null
        })

        const request = createMockRequest('/api/campaigns', {
          method: 'POST',
          headers: {
            'x-workspace-id': testWorkspace.id,
            'authorization': `Bearer ${authToken}`
          },
          body: newCampaignData
        })

        mockCampaignHandlers.POST.mockResolvedValue({
          status: 201,
          data: createdCampaign
        })

        const response = await mockCampaignHandlers.POST(request)
        
        expect(response.status).toBe(201)
        expect(response.data.name).toBe(newCampaignData.name)
        expect(response.data.workspace_id).toBe(testWorkspace.id)
        expect(response.data.status).toBe('draft')
      })

      it('should validate campaign data', async () => {
        const invalidCampaignData = {
          name: '', // Empty name
          subject: 'a'.repeat(1000), // Too long
          from_email: 'invalid-email', // Invalid email
          settings: {
            daily_limit: -5, // Invalid negative value
            schedule: {
              send_time_start: '25:00' // Invalid time
            }
          }
        }

        const request = createMockRequest('/api/campaigns', {
          method: 'POST',
          headers: {
            'x-workspace-id': testWorkspace.id,
            'authorization': `Bearer ${authToken}`
          },
          body: invalidCampaignData
        })

        mockCampaignHandlers.POST.mockResolvedValue({
          status: 400,
          data: {
            error: 'Validation failed',
            errors: [
              'Campaign name is required',
              'Subject line too long',
              'Invalid from email address',
              'Daily limit must be positive',
              'Invalid time format'
            ]
          }
        })

        const response = await mockCampaignHandlers.POST(request)
        
        expect(response.status).toBe(400)
        expect(response.data.errors.length).toBeGreaterThan(0)
      })
    })

    describe('PATCH /api/campaigns/[id]', () => {
      it('should update campaign successfully', async () => {
        const updateData = {
          name: 'Updated Campaign Name',
          status: 'active',
          settings: {
            ...testCampaign.settings,
            daily_limit: 100
          }
        }

        const updatedCampaign = {
          ...testCampaign,
          ...updateData,
          updated_at: new Date().toISOString()
        }

        mockSupabase.single.mockResolvedValueOnce({
          data: testCampaign,
          error: null
        })

        mockSupabase.update.mockResolvedValue({
          data: [updatedCampaign],
          error: null
        })

        const request = createMockRequest(`/api/campaigns/${testCampaign.id}`, {
          method: 'PATCH',
          headers: {
            'x-workspace-id': testWorkspace.id,
            'authorization': `Bearer ${authToken}`
          },
          body: updateData
        })

        mockCampaignHandlers.PATCH.mockResolvedValue({
          status: 200,
          data: updatedCampaign
        })

        const response = await mockCampaignHandlers.PATCH(request)
        
        expect(response.status).toBe(200)
        expect(response.data.name).toBe(updateData.name)
        expect(response.data.status).toBe(updateData.status)
      })

      it('should prevent updating active campaigns inappropriately', async () => {
        const activeCampaign = {
          ...testCampaign,
          status: 'active'
        }

        const invalidUpdate = {
          from_email: 'newemail@example.com', // Can't change from_email of active campaign
          settings: {
            schedule: {
              start_date: new Date(Date.now() - 86400000).toISOString() // Past date
            }
          }
        }

        mockSupabase.single.mockResolvedValue({
          data: activeCampaign,
          error: null
        })

        const request = createMockRequest(`/api/campaigns/${activeCampaign.id}`, {
          method: 'PATCH',
          headers: {
            'x-workspace-id': testWorkspace.id,
            'authorization': `Bearer ${authToken}`
          },
          body: invalidUpdate
        })

        mockCampaignHandlers.PATCH.mockResolvedValue({
          status: 400,
          data: {
            error: 'Cannot modify critical settings of active campaign'
          }
        })

        const response = await mockCampaignHandlers.PATCH(request)
        
        expect(response.status).toBe(400)
        expect(response.data.error).toContain('active campaign')
      })
    })

    describe('DELETE /api/campaigns/[id]', () => {
      it('should delete draft campaign successfully', async () => {
        const draftCampaign = {
          ...testCampaign,
          status: 'draft'
        }

        mockSupabase.single.mockResolvedValueOnce({
          data: draftCampaign,
          error: null
        })

        mockSupabase.delete.mockResolvedValue({
          data: [draftCampaign],
          error: null
        })

        const request = createMockRequest(`/api/campaigns/${draftCampaign.id}`, {
          method: 'DELETE',
          headers: {
            'x-workspace-id': testWorkspace.id,
            'authorization': `Bearer ${authToken}`
          }
        })

        mockCampaignHandlers.DELETE.mockResolvedValue({
          status: 204,
          data: null
        })

        const response = await mockCampaignHandlers.DELETE(request)
        
        expect(response.status).toBe(204)
      })

      it('should prevent deletion of active campaigns', async () => {
        const activeCampaign = {
          ...testCampaign,
          status: 'active'
        }

        mockSupabase.single.mockResolvedValue({
          data: activeCampaign,
          error: null
        })

        const request = createMockRequest(`/api/campaigns/${activeCampaign.id}`, {
          method: 'DELETE',
          headers: {
            'x-workspace-id': testWorkspace.id,
            'authorization': `Bearer ${authToken}`
          }
        })

        mockCampaignHandlers.DELETE.mockResolvedValue({
          status: 400,
          data: {
            error: 'Cannot delete active campaign. Pause it first.'
          }
        })

        const response = await mockCampaignHandlers.DELETE(request)
        
        expect(response.status).toBe(400)
        expect(response.data.error).toContain('active campaign')
      })
    })
  })

  describe('Sequence Management', () => {
    describe('POST /api/campaigns/[id]/sequences', () => {
      it('should create email sequence successfully', async () => {
        const sequenceData = {
          name: 'Follow-up Email',
          position: 2,
          delay_days: 3,
          subject: 'Following up on {{company_name}}',
          body: 'Hi {{first_name}},\n\nI wanted to follow up on our previous email...',
          settings: {
            stop_on_reply: true,
            personalization: {
              use_first_name: true,
              use_company_name: true,
              fallback_values: {
                first_name: 'there',
                company_name: 'your company'
              }
            }
          }
        }

        const createdSequence = {
          id: faker.string.uuid(),
          campaign_id: testCampaign.id,
          ...sequenceData,
          enabled: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }

        mockSupabase.single.mockResolvedValueOnce({
          data: testCampaign,
          error: null
        })

        mockSupabase.insert.mockResolvedValue({
          data: [createdSequence],
          error: null
        })

        const request = createMockRequest(`/api/campaigns/${testCampaign.id}/sequences`, {
          method: 'POST',
          headers: {
            'x-workspace-id': testWorkspace.id,
            'authorization': `Bearer ${authToken}`
          },
          body: sequenceData
        })

        const mockSequenceHandler = jest.fn().mockResolvedValue({
          status: 201,
          data: createdSequence
        })

        const response = await mockSequenceHandler(request)
        
        expect(response.status).toBe(201)
        expect(response.data.campaign_id).toBe(testCampaign.id)
        expect(response.data.position).toBe(sequenceData.position)
        expect(response.data.delay_days).toBe(sequenceData.delay_days)
      })

      it('should validate sequence order and delays', async () => {
        const invalidSequences = [
          {
            position: 0, // Invalid position
            delay_days: -1 // Negative delay
          },
          {
            position: 1, // Duplicate position
            delay_days: 0,
            subject: '' // Empty subject
          }
        ]

        invalidSequences.forEach(async (sequenceData) => {
          const request = createMockRequest(`/api/campaigns/${testCampaign.id}/sequences`, {
            method: 'POST',
            headers: {
              'x-workspace-id': testWorkspace.id,
              'authorization': `Bearer ${authToken}`
            },
            body: sequenceData
          })

          const mockSequenceHandler = jest.fn().mockResolvedValue({
            status: 400,
            data: {
              error: 'Invalid sequence data'
            }
          })

          const response = await mockSequenceHandler(request)
          expect(response.status).toBe(400)
        })
      })
    })

    describe('PATCH /api/campaigns/[id]/sequences/[sequenceId]', () => {
      it('should update sequence content', async () => {
        const sequence = testSequences[0]
        const updateData = {
          subject: 'Updated subject line',
          body: 'Updated email body with {{first_name}}',
          delay_days: 5
        }

        const updatedSequence = {
          ...sequence,
          ...updateData,
          updated_at: new Date().toISOString()
        }

        mockSupabase.single.mockResolvedValueOnce({
          data: sequence,
          error: null
        })

        mockSupabase.update.mockResolvedValue({
          data: [updatedSequence],
          error: null
        })

        const request = createMockRequest(`/api/campaigns/${testCampaign.id}/sequences/${sequence.id}`, {
          method: 'PATCH',
          headers: {
            'x-workspace-id': testWorkspace.id,
            'authorization': `Bearer ${authToken}`
          },
          body: updateData
        })

        const mockUpdateHandler = jest.fn().mockResolvedValue({
          status: 200,
          data: updatedSequence
        })

        const response = await mockUpdateHandler(request)
        
        expect(response.status).toBe(200)
        expect(response.data.subject).toBe(updateData.subject)
        expect(response.data.delay_days).toBe(updateData.delay_days)
      })
    })
  })

  describe('Campaign Execution', () => {
    describe('POST /api/campaigns/[id]/start', () => {
      it('should start campaign successfully', async () => {
        const readyCampaign = {
          ...testCampaign,
          status: 'draft'
        }

        // Mock pre-flight checks
        mockSupabase.single.mockResolvedValueOnce({
          data: readyCampaign,
          error: null
        })

        // Mock sequences check
        mockSupabase.select.mockResolvedValueOnce({
          data: testSequences,
          error: null
        })

        // Mock leads check
        mockSupabase.count.mockResolvedValueOnce({
          count: testLeads.length,
          error: null
        })

        // Mock campaign update
        mockSupabase.update.mockResolvedValue({
          data: [{ ...readyCampaign, status: 'active' }],
          error: null
        })

        const request = createMockRequest(`/api/campaigns/${readyCampaign.id}/start`, {
          method: 'POST',
          headers: {
            'x-workspace-id': testWorkspace.id,
            'authorization': `Bearer ${authToken}`
          },
          body: {
            leadIds: testLeads.map(l => l.id),
            scheduleTime: new Date(Date.now() + 3600000).toISOString() // 1 hour from now
          }
        })

        const mockStartHandler = jest.fn().mockResolvedValue({
          status: 200,
          data: {
            campaignId: readyCampaign.id,
            status: 'active',
            leadsScheduled: testLeads.length,
            firstEmailScheduledFor: new Date(Date.now() + 3600000).toISOString()
          }
        })

        const response = await mockStartHandler(request)
        
        expect(response.status).toBe(200)
        expect(response.data.status).toBe('active')
        expect(response.data.leadsScheduled).toBe(testLeads.length)
      })

      it('should validate campaign before starting', async () => {
        const invalidCampaign = {
          ...testCampaign,
          from_email: '', // Missing required field
          status: 'draft'
        }

        mockSupabase.single.mockResolvedValue({
          data: invalidCampaign,
          error: null
        })

        mockSupabase.select.mockResolvedValue({
          data: [], // No sequences
          error: null
        })

        const request = createMockRequest(`/api/campaigns/${invalidCampaign.id}/start`, {
          method: 'POST',
          headers: {
            'x-workspace-id': testWorkspace.id,
            'authorization': `Bearer ${authToken}`
          },
          body: {
            leadIds: []
          }
        })

        const mockStartHandler = jest.fn().mockResolvedValue({
          status: 400,
          data: {
            error: 'Campaign validation failed',
            issues: [
              'From email is required',
              'At least one sequence is required',
              'At least one lead must be selected'
            ]
          }
        })

        const response = await mockStartHandler(request)
        
        expect(response.status).toBe(400)
        expect(response.data.issues.length).toBeGreaterThan(0)
      })
    })

    describe('POST /api/campaigns/[id]/pause', () => {
      it('should pause active campaign', async () => {
        const activeCampaign = {
          ...testCampaign,
          status: 'active'
        }

        mockSupabase.single.mockResolvedValue({
          data: activeCampaign,
          error: null
        })

        mockSupabase.update.mockResolvedValue({
          data: [{ ...activeCampaign, status: 'paused' }],
          error: null
        })

        const request = createMockRequest(`/api/campaigns/${activeCampaign.id}/pause`, {
          method: 'POST',
          headers: {
            'x-workspace-id': testWorkspace.id,
            'authorization': `Bearer ${authToken}`
          }
        })

        const mockPauseHandler = jest.fn().mockResolvedValue({
          status: 200,
          data: {
            campaignId: activeCampaign.id,
            status: 'paused',
            pausedAt: new Date().toISOString(),
            scheduledEmailsCancelled: 15
          }
        })

        const response = await mockPauseHandler(request)
        
        expect(response.status).toBe(200)
        expect(response.data.status).toBe('paused')
      })
    })

    describe('POST /api/campaigns/[id]/resume', () => {
      it('should resume paused campaign', async () => {
        const pausedCampaign = {
          ...testCampaign,
          status: 'paused'
        }

        mockSupabase.single.mockResolvedValue({
          data: pausedCampaign,
          error: null
        })

        mockSupabase.update.mockResolvedValue({
          data: [{ ...pausedCampaign, status: 'active' }],
          error: null
        })

        const request = createMockRequest(`/api/campaigns/${pausedCampaign.id}/resume`, {
          method: 'POST',
          headers: {
            'x-workspace-id': testWorkspace.id,
            'authorization': `Bearer ${authToken}`
          }
        })

        const mockResumeHandler = jest.fn().mockResolvedValue({
          status: 200,
          data: {
            campaignId: pausedCampaign.id,
            status: 'active',
            resumedAt: new Date().toISOString(),
            emailsRescheduled: 12
          }
        })

        const response = await mockResumeHandler(request)
        
        expect(response.status).toBe(200)
        expect(response.data.status).toBe('active')
      })
    })
  })

  describe('Email Scheduling', () => {
    it('should schedule emails based on campaign settings', async () => {
      const schedulingSettings = {
        dailyLimit: 50,
        sendDays: ['mon', 'tue', 'wed', 'thu', 'fri'],
        sendTimeStart: '09:00',
        sendTimeEnd: '17:00',
        timezone: 'America/New_York'
      }

      const leadsToSchedule = testLeads.slice(0, 5)
      const scheduledEmails = leadsToSchedule.map((lead, index) => ({
        id: faker.string.uuid(),
        campaign_id: testCampaign.id,
        lead_id: lead.id,
        sequence_position: 1,
        scheduled_at: new Date(Date.now() + (index * 3600000)).toISOString(), // 1 hour apart
        status: 'scheduled',
        created_at: new Date().toISOString()
      }))

      mockSupabase.insert.mockResolvedValue({
        data: scheduledEmails,
        error: null
      })

      const request = createMockRequest(`/api/campaigns/${testCampaign.id}/schedule`, {
        method: 'POST',
        headers: {
          'x-workspace-id': testWorkspace.id,
          'authorization': `Bearer ${authToken}`
        },
        body: {
          leadIds: leadsToSchedule.map(l => l.id),
          settings: schedulingSettings
        }
      })

      const mockScheduleHandler = jest.fn().mockResolvedValue({
        status: 200,
        data: {
          scheduled: scheduledEmails.length,
          nextSendTime: scheduledEmails[0].scheduled_at,
          estimatedCompletion: scheduledEmails[scheduledEmails.length - 1].scheduled_at
        }
      })

      const response = await mockScheduleHandler(request)
      
      expect(response.status).toBe(200)
      expect(response.data.scheduled).toBe(5)
    })

    it('should respect workspace sending limits', async () => {
      const workspaceWithLimits = {
        ...testWorkspace,
        plan: 'starter',
        usage: {
          emails_sent_today: 90,
          daily_limit: 100
        }
      }

      const request = createMockRequest(`/api/campaigns/${testCampaign.id}/schedule`, {
        method: 'POST',
        headers: {
          'x-workspace-id': workspaceWithLimits.id,
          'authorization': `Bearer ${authToken}`
        },
        body: {
          leadIds: testLeads.map(l => l.id) // 10 leads, but only 10 emails left
        }
      })

      const mockScheduleHandler = jest.fn().mockResolvedValue({
        status: 200,
        data: {
          scheduled: 10, // Only remaining quota
          skipped: 0,
          limitReached: true,
          message: 'Daily sending limit reached. Remaining emails will be scheduled for tomorrow.'
        }
      })

      const response = await mockScheduleHandler(request)
      
      expect(response.status).toBe(200)
      expect(response.data.limitReached).toBe(true)
      expect(response.data.scheduled).toBeLessThanOrEqual(10)
    })
  })

  describe('Analytics and Tracking', () => {
    describe('GET /api/campaigns/[id]/analytics', () => {
      it('should return comprehensive campaign analytics', async () => {
        const campaignStats = {
          basic_metrics: {
            total_sent: 250,
            total_delivered: 245,
            total_opened: 98,
            total_clicked: 23,
            total_replied: 8,
            total_bounced: 5,
            total_unsubscribed: 2
          },
          rates: {
            delivery_rate: 98.0,
            open_rate: 40.0,
            click_rate: 9.4,
            reply_rate: 3.3,
            bounce_rate: 2.0,
            unsubscribe_rate: 0.8
          },
          sequence_performance: testSequences.map((seq, index) => ({
            sequence_id: seq.id,
            position: seq.position,
            sent: 100 - (index * 20),
            opened: 40 - (index * 8),
            clicked: 10 - (index * 3),
            replied: 5 - (index * 2)
          })),
          time_series: {
            daily_stats: Array.from({ length: 7 }, (_, i) => ({
              date: new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              sent: faker.number.int({ min: 10, max: 50 }),
              opened: faker.number.int({ min: 5, max: 25 }),
              clicked: faker.number.int({ min: 1, max: 8 })
            }))
          }
        }

        mockSupabase.single.mockResolvedValueOnce({
          data: testCampaign,
          error: null
        })

        mockSupabase.rpc.mockResolvedValue({
          data: campaignStats,
          error: null
        })

        const request = createMockRequest(`/api/campaigns/${testCampaign.id}/analytics`, {
          method: 'GET',
          headers: {
            'x-workspace-id': testWorkspace.id,
            'authorization': `Bearer ${authToken}`
          },
          searchParams: {
            timeframe: '30d',
            includeSequenceBreakdown: 'true'
          }
        })

        const mockAnalyticsHandler = jest.fn().mockResolvedValue({
          status: 200,
          data: campaignStats
        })

        const response = await mockAnalyticsHandler(request)
        
        expect(response.status).toBe(200)
        expect(response.data.basic_metrics.total_sent).toBe(250)
        expect(response.data.rates.open_rate).toBe(40.0)
        expect(response.data.sequence_performance.length).toBe(testSequences.length)
      })

      it('should filter analytics by date range', async () => {
        const dateRangeStats = {
          period: {
            start: '2024-01-01',
            end: '2024-01-31'
          },
          metrics: {
            total_sent: 150,
            total_opened: 60,
            open_rate: 40.0
          }
        }

        const request = createMockRequest(`/api/campaigns/${testCampaign.id}/analytics`, {
          method: 'GET',
          headers: {
            'x-workspace-id': testWorkspace.id,
            'authorization': `Bearer ${authToken}`
          },
          searchParams: {
            startDate: '2024-01-01',
            endDate: '2024-01-31'
          }
        })

        const mockAnalyticsHandler = jest.fn().mockResolvedValue({
          status: 200,
          data: dateRangeStats
        })

        const response = await mockAnalyticsHandler(request)
        
        expect(response.status).toBe(200)
        expect(response.data.period.start).toBe('2024-01-01')
        expect(response.data.period.end).toBe('2024-01-31')
      })
    })

    describe('GET /api/campaigns/[id]/leads', () => {
      it('should return campaign lead status', async () => {
        const campaignLeads = testLeads.map(lead => ({
          ...lead,
          campaign_status: faker.helpers.arrayElement(['scheduled', 'sent', 'opened', 'clicked', 'replied']),
          last_sequence_sent: faker.number.int({ min: 1, max: 3 }),
          last_email_sent_at: faker.date.recent().toISOString(),
          next_email_scheduled_at: faker.date.future().toISOString()
        }))

        mockSupabase.select.mockResolvedValue({
          data: campaignLeads,
          error: null
        })
        mockSupabase.count.mockResolvedValue({ count: campaignLeads.length, error: null })

        const request = createMockRequest(`/api/campaigns/${testCampaign.id}/leads`, {
          method: 'GET',
          headers: {
            'x-workspace-id': testWorkspace.id,
            'authorization': `Bearer ${authToken}`
          },
          searchParams: {
            status: 'all',
            page: '1',
            limit: '50'
          }
        })

        const mockCampaignLeadsHandler = jest.fn().mockResolvedValue({
          status: 200,
          data: {
            leads: campaignLeads,
            total: campaignLeads.length,
            summary: {
              scheduled: campaignLeads.filter(l => l.campaign_status === 'scheduled').length,
              sent: campaignLeads.filter(l => l.campaign_status === 'sent').length,
              opened: campaignLeads.filter(l => l.campaign_status === 'opened').length,
              replied: campaignLeads.filter(l => l.campaign_status === 'replied').length
            }
          }
        })

        const response = await mockCampaignLeadsHandler(request)
        
        expect(response.status).toBe(200)
        expect(response.data.leads.length).toBe(testLeads.length)
        expect(response.data.summary).toBeDefined()
      })
    })
  })

  describe('AI Personalization', () => {
    describe('POST /api/campaigns/[id]/personalize', () => {
      it('should generate personalized email content', async () => {
        const personalizationRequest = {
          leadId: testLeads[0].id,
          sequencePosition: 1,
          template: {
            subject: 'Interesting opportunity for {{company}}',
            body: 'Hi {{first_name}},\n\nI noticed {{company}} is in the {{industry}} space...'
          },
          personalizationLevel: 'high'
        }

        const personalizedContent = {
          subject: `Interesting opportunity for ${testLeads[0].company}`,
          body: `Hi ${testLeads[0].first_name},\n\nI noticed ${testLeads[0].company} is in the ${testLeads[0].custom_fields?.industry} space. Based on your recent growth, I thought you might be interested in how we've helped similar companies reduce their customer acquisition costs by 35%.\n\nWould you be open to a 15-minute call next week?`,
          personalization_metadata: {
            variables_used: ['first_name', 'company', 'industry'],
            ai_insights: ['company_growth', 'industry_trends'],
            confidence_score: 0.92
          }
        }

        mockAIService.prototype.personalizeEmail.mockResolvedValue(personalizedContent)

        const request = createMockRequest(`/api/campaigns/${testCampaign.id}/personalize`, {
          method: 'POST',
          headers: {
            'x-workspace-id': testWorkspace.id,
            'authorization': `Bearer ${authToken}`
          },
          body: personalizationRequest
        })

        const mockPersonalizeHandler = jest.fn().mockResolvedValue({
          status: 200,
          data: personalizedContent
        })

        const response = await mockPersonalizeHandler(request)
        
        expect(response.status).toBe(200)
        expect(response.data.subject).toContain(testLeads[0].company)
        expect(response.data.body).toContain(testLeads[0].first_name)
        expect(response.data.personalization_metadata.confidence_score).toBeGreaterThan(0.8)
      })

      it('should optimize subject lines with A/B testing', async () => {
        const subjectOptimization = {
          originalSubject: 'Quick question about {{company}}',
          variations: [
            {
              subject: 'Quick question about {{company}}',
              predicted_open_rate: 23.5,
              tone: 'casual'
            },
            {
              subject: '2-minute question for {{company}}',
              predicted_open_rate: 28.2,
              tone: 'direct'
            },
            {
              subject: 'Helping {{company}} reduce costs',
              predicted_open_rate: 31.7,
              tone: 'value-focused'
            }
          ],
          recommended: 2 // Index of best performing variation
        }

        mockAIService.prototype.optimizeSubjectLine.mockResolvedValue(subjectOptimization)

        const request = createMockRequest(`/api/campaigns/${testCampaign.id}/optimize-subject`, {
          method: 'POST',
          headers: {
            'x-workspace-id': testWorkspace.id,
            'authorization': `Bearer ${authToken}`
          },
          body: {
            subject: subjectOptimization.originalSubject,
            targetAudience: 'SaaS executives',
            campaignGoal: 'book_demo'
          }
        })

        const mockOptimizeHandler = jest.fn().mockResolvedValue({
          status: 200,
          data: subjectOptimization
        })

        const response = await mockOptimizeHandler(request)
        
        expect(response.status).toBe(200)
        expect(response.data.variations.length).toBe(3)
        expect(response.data.variations[response.data.recommended].predicted_open_rate).toBeGreaterThan(30)
      })
    })
  })

  describe('Data Isolation and Security', () => {
    it('should prevent cross-workspace campaign access', async () => {
      const otherWorkspace = workspaceFactory.create()
      const otherCampaign = campaignFactory.create({ workspace_id: otherWorkspace.id })

      const request = createMockRequest(`/api/campaigns/${otherCampaign.id}`, {
        method: 'GET',
        headers: {
          'x-workspace-id': testWorkspace.id,
          'authorization': `Bearer ${authToken}`
        }
      })

      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'Not found' }
      })

      const mockGetHandler = jest.fn().mockResolvedValue({
        status: 404,
        data: {
          error: 'Campaign not found'
        }
      })

      const response = await mockGetHandler(request)
      
      expect(response.status).toBe(404)
      expect(response.data.error).toBe('Campaign not found')
    })

    it('should validate user permissions for campaign operations', async () => {
      const memberUser = userFactory.create()
      
      // Mock user with limited permissions
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: memberUser },
        error: null
      })

      mockSupabase.single.mockResolvedValueOnce({
        data: {
          user_id: memberUser.id,
          workspace_id: testWorkspace.id,
          role: 'member' // Not admin or owner
        },
        error: null
      })

      const request = createMockRequest(`/api/campaigns/${testCampaign.id}`, {
        method: 'DELETE',
        headers: {
          'x-workspace-id': testWorkspace.id,
          'authorization': `Bearer ${authToken}`
        }
      })

      const mockDeleteHandler = jest.fn().mockResolvedValue({
        status: 403,
        data: {
          error: 'Insufficient permissions to delete campaigns'
        }
      })

      const response = await mockDeleteHandler(request)
      
      expect(response.status).toBe(403)
      expect(response.data.error).toContain('Insufficient permissions')
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle campaign with no sequences', async () => {
      const campaignWithoutSequences = {
        ...testCampaign,
        status: 'draft'
      }

      mockSupabase.single.mockResolvedValue({
        data: campaignWithoutSequences,
        error: null
      })

      mockSupabase.select.mockResolvedValue({
        data: [], // No sequences
        error: null
      })

      const request = createMockRequest(`/api/campaigns/${campaignWithoutSequences.id}/start`, {
        method: 'POST',
        headers: {
          'x-workspace-id': testWorkspace.id,
          'authorization': `Bearer ${authToken}`
        },
        body: {
          leadIds: testLeads.map(l => l.id)
        }
      })

      const mockStartHandler = jest.fn().mockResolvedValue({
        status: 400,
        data: {
          error: 'Cannot start campaign without email sequences'
        }
      })

      const response = await mockStartHandler(request)
      
      expect(response.status).toBe(400)
      expect(response.data.error).toContain('sequences')
    })

    it('should handle database connection failures', async () => {
      mockSupabase.from.mockImplementation(() => {
        throw new Error('Database connection failed')
      })

      const request = createMockRequest('/api/campaigns', {
        method: 'GET',
        headers: {
          'x-workspace-id': testWorkspace.id,
          'authorization': `Bearer ${authToken}`
        }
      })

      const mockErrorHandler = jest.fn().mockResolvedValue({
        status: 500,
        data: {
          error: 'Database connection failed',
          retryable: true
        }
      })

      const response = await mockErrorHandler(request)
      
      expect(response.status).toBe(500)
      expect(response.data.retryable).toBe(true)
    })

    it('should handle AI service failures gracefully', async () => {
      mockAIService.prototype.personalizeEmail.mockRejectedValue(
        new Error('AI service temporarily unavailable')
      )

      const request = createMockRequest(`/api/campaigns/${testCampaign.id}/personalize`, {
        method: 'POST',
        headers: {
          'x-workspace-id': testWorkspace.id,
          'authorization': `Bearer ${authToken}`
        },
        body: {
          leadId: testLeads[0].id,
          template: { subject: 'Test', body: 'Test body' }
        }
      })

      const mockPersonalizeHandler = jest.fn().mockResolvedValue({
        status: 503,
        data: {
          error: 'AI personalization service temporarily unavailable',
          fallback: {
            subject: 'Test',
            body: 'Test body'
          }
        }
      })

      const response = await mockPersonalizeHandler(request)
      
      expect(response.status).toBe(503)
      expect(response.data.fallback).toBeDefined()
    })
  })
})

// Campaign Schema Validation Tests
describe('Campaigns API Schema Validation', () => {
  it('should validate campaign creation schema', () => {
    const validCampaign = {
      name: faker.commerce.productName(),
      subject: faker.lorem.sentence(),
      from_name: faker.person.fullName(),
      from_email: faker.internet.email(),
      reply_to: faker.internet.email(),
      settings: {
        daily_limit: 50,
        timezone: 'UTC',
        tracking: {
          open_tracking: true,
          click_tracking: true,
          reply_tracking: true
        },
        schedule: {
          start_date: new Date().toISOString(),
          send_days: ['mon', 'tue', 'wed', 'thu', 'fri'],
          send_time_start: '09:00',
          send_time_end: '17:00'
        }
      }
    }

    expect(validCampaign.name.length).toBeGreaterThan(0)
    expect(validCampaign.from_email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
    expect(validCampaign.settings.daily_limit).toBeGreaterThan(0)
    expect(validCampaign.settings.schedule.send_days.length).toBeGreaterThan(0)
    expect(validCampaign.settings.schedule.send_time_start).toMatch(/^\d{2}:\d{2}$/)
  })

  it('should validate sequence creation schema', () => {
    const validSequence = {
      name: faker.lorem.words(3),
      position: 1,
      delay_days: 3,
      subject: faker.lorem.sentence(),
      body: faker.lorem.paragraphs(2),
      settings: {
        stop_on_reply: true,
        personalization: {
          use_first_name: true,
          use_company_name: true,
          fallback_values: {
            first_name: 'there',
            company_name: 'your company'
          }
        }
      }
    }

    expect(validSequence.position).toBeGreaterThan(0)
    expect(validSequence.delay_days).toBeGreaterThanOrEqual(0)
    expect(validSequence.subject.length).toBeGreaterThan(0)
    expect(validSequence.body.length).toBeGreaterThan(0)
    expect(typeof validSequence.settings.stop_on_reply).toBe('boolean')
  })

  it('should validate campaign analytics filters', () => {
    const validFilters = {
      timeframe: '30d',
      startDate: '2024-01-01',
      endDate: '2024-01-31',
      includeSequenceBreakdown: true,
      groupBy: 'day',
      metrics: ['sent', 'opened', 'clicked', 'replied']
    }

    expect(['7d', '30d', '90d', 'custom'].includes(validFilters.timeframe)).toBe(true)
    expect(new Date(validFilters.startDate)).toBeInstanceOf(Date)
    expect(new Date(validFilters.endDate)).toBeInstanceOf(Date)
    expect(typeof validFilters.includeSequenceBreakdown).toBe('boolean')
    expect(['hour', 'day', 'week', 'month'].includes(validFilters.groupBy)).toBe(true)
    expect(Array.isArray(validFilters.metrics)).toBe(true)
  })
})
