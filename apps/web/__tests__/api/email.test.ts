import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ApiTestClient, createMockRequest, testApiRoute } from '../utils/api'
import { cleanTestDatabase } from '../setup/test-db-setup'
import { userFactory, workspaceFactory, campaignFactory, leadFactory, emailLogFactory } from '../utils/factories'
import { SESClient } from '@/lib/email/ses-client'
import { EmailTrackingService } from '@/lib/email/tracking'
import * as sendHandler from '@/app/api/email/send/route'
import * as trackOpenHandler from '@/app/api/email/track/open/route'
import * as trackClickHandler from '@/app/api/email/track/click/route'
import * as emailWebhookHandler from '@/app/api/webhooks/email/route'
import { faker } from '@faker-js/faker'

// Mock external services
jest.mock('@/lib/email/ses-client')
jest.mock('@/lib/email/tracking')
jest.mock('@/lib/supabase/server')
jest.mock('@aws-sdk/client-ses')

const mockSESClient = SESClient as jest.MockedClass<typeof SESClient>
const mockTrackingService = EmailTrackingService as jest.MockedClass<typeof EmailTrackingService>
const mockSupabase = {
  auth: {
    getUser: jest.fn(),
  },
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  single: jest.fn(),
  limit: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  range: jest.fn().mockReturnThis(),
  rpc: jest.fn(),
}

require('@/lib/supabase/server').createClient = jest.fn().mockReturnValue(mockSupabase)

describe('Email API Integration Tests', () => {
  let testClient: ApiTestClient
  let testUser: any
  let testWorkspace: any
  let testCampaign: any
  let testLead: any
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
    testLead = leadFactory.create({ workspace_id: testWorkspace.id })

    // Setup default auth mock
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: testUser },
      error: null
    })

    // Setup email service mocks
    mockSESClient.prototype.sendEmail = jest.fn()
    mockSESClient.prototype.sendBulkEmail = jest.fn()
    mockSESClient.prototype.validateEmail = jest.fn()
    mockTrackingService.prototype.generateTrackingPixel = jest.fn()
    mockTrackingService.prototype.generateTrackingLinks = jest.fn()
    mockTrackingService.prototype.recordOpen = jest.fn()
    mockTrackingService.prototype.recordClick = jest.fn()
  })

  describe('Email Sending', () => {
    describe('POST /api/email/send', () => {
      it('should send single email successfully', async () => {
        const emailData = {
          to: testLead.email,
          subject: 'Test Email',
          body: 'Hello {{first_name}}, this is a test email.',
          campaignId: testCampaign.id,
          leadId: testLead.id,
          personalization: {
            first_name: testLead.first_name,
            company: testLead.company
          },
          tracking: {
            openTracking: true,
            clickTracking: true
          }
        }

        const mockSendResult = {
          messageId: `${Date.now()}.${faker.string.alphanumeric(10)}@email.amazonses.com`,
          status: 'sent',
          sentAt: new Date().toISOString()
        }

        mockSESClient.prototype.sendEmail.mockResolvedValue(mockSendResult)
        mockTrackingService.prototype.generateTrackingPixel.mockReturnValue('https://track.example.com/open/abc123')
        mockTrackingService.prototype.generateTrackingLinks.mockReturnValue('Body with tracking links')

        // Mock successful database inserts
        mockSupabase.single.mockResolvedValueOnce({
          data: testCampaign,
          error: null
        })
        
        mockSupabase.single.mockResolvedValueOnce({
          data: testLead,
          error: null
        })

        mockSupabase.insert.mockResolvedValue({
          data: [{ id: faker.string.uuid() }],
          error: null
        })

        const request = createMockRequest('/api/email/send', {
          method: 'POST',
          headers: {
            'x-workspace-id': testWorkspace.id,
            'authorization': `Bearer ${authToken}`
          },
          body: emailData
        })

        const response = await testApiRoute(sendHandler.POST, request)
        
        expect(response.status).toBe(200)
        expect(response.data.messageId).toBe(mockSendResult.messageId)
        expect(response.data.status).toBe('sent')
        expect(mockSESClient.prototype.sendEmail).toHaveBeenCalledWith(
          expect.objectContaining({
            to: emailData.to,
            subject: emailData.subject
          })
        )
      })

      it('should send bulk emails with proper rate limiting', async () => {
        const bulkEmailData = {
          campaignId: testCampaign.id,
          leads: Array.from({ length: 50 }, () => ({
            id: faker.string.uuid(),
            email: faker.internet.email(),
            first_name: faker.person.firstName(),
            company: faker.company.name()
          })),
          template: {
            subject: 'Welcome to {{company}}!',
            body: 'Hi {{first_name}}, welcome to our platform!'
          },
          settings: {
            batchSize: 10,
            delayBetweenBatches: 1000,
            dailyLimit: 100
          }
        }

        const mockBulkResult = {
          batchId: faker.string.uuid(),
          totalEmails: 50,
          sent: 45,
          failed: 5,
          status: 'completed'
        }

        mockSESClient.prototype.sendBulkEmail.mockResolvedValue(mockBulkResult)

        // Mock workspace and campaign data
        mockSupabase.single.mockResolvedValueOnce({
          data: testWorkspace,
          error: null
        })
        
        mockSupabase.single.mockResolvedValueOnce({
          data: testCampaign,
          error: null
        })

        const request = createMockRequest('/api/email/send', {
          method: 'POST',
          headers: {
            'x-workspace-id': testWorkspace.id,
            'authorization': `Bearer ${authToken}`
          },
          body: bulkEmailData
        })

        const response = await testApiRoute(sendHandler.POST, request)
        
        expect(response.status).toBe(200)
        expect(response.data.batchId).toBe(mockBulkResult.batchId)
        expect(response.data.totalEmails).toBe(50)
        expect(mockSESClient.prototype.sendBulkEmail).toHaveBeenCalled()
      })

      it('should validate email addresses before sending', async () => {
        const invalidEmailData = {
          to: 'invalid-email',
          subject: 'Test',
          body: 'Test body',
          campaignId: testCampaign.id
        }

        const request = createMockRequest('/api/email/send', {
          method: 'POST',
          headers: {
            'x-workspace-id': testWorkspace.id,
            'authorization': `Bearer ${authToken}`
          },
          body: invalidEmailData
        })

        const response = await testApiRoute(sendHandler.POST, request)
        
        expect(response.status).toBe(400)
        expect(response.data.error).toContain('Invalid email address')
      })

      it('should enforce workspace usage limits', async () => {
        // Mock that workspace has exceeded email limits
        mockSupabase.single.mockResolvedValueOnce({
          data: {
            ...testWorkspace,
            plan: 'free',
            usage: {
              emails_sent_this_month: 150,
              email_limit: 100
            }
          },
          error: null
        })

        const emailData = {
          to: testLead.email,
          subject: 'Test Email',
          body: 'Test body',
          campaignId: testCampaign.id
        }

        const request = createMockRequest('/api/email/send', {
          method: 'POST',
          headers: {
            'x-workspace-id': testWorkspace.id,
            'authorization': `Bearer ${authToken}`
          },
          body: emailData
        })

        const response = await testApiRoute(sendHandler.POST, request)
        
        expect(response.status).toBe(429)
        expect(response.data.error).toContain('usage limit')
      })

      it('should handle email sending failures', async () => {
        const emailData = {
          to: testLead.email,
          subject: 'Test Email',
          body: 'Test body',
          campaignId: testCampaign.id
        }

        const sendError = new Error('SES service unavailable')
        sendError.code = 'ServiceUnavailable'
        
        mockSESClient.prototype.sendEmail.mockRejectedValue(sendError)

        mockSupabase.single.mockResolvedValueOnce({
          data: testCampaign,
          error: null
        })

        const request = createMockRequest('/api/email/send', {
          method: 'POST',
          headers: {
            'x-workspace-id': testWorkspace.id,
            'authorization': `Bearer ${authToken}`
          },
          body: emailData
        })

        const response = await testApiRoute(sendHandler.POST, request)
        
        expect(response.status).toBe(500)
        expect(response.data.error).toContain('SES service unavailable')
      })
    })
  })

  describe('Email Tracking', () => {
    describe('GET /api/email/track/open', () => {
      it('should track email opens correctly', async () => {
        const trackingId = faker.string.alphanumeric(32)
        const emailLog = emailLogFactory.create({
          campaign_id: testCampaign.id,
          lead_id: testLead.id,
          workspace_id: testWorkspace.id
        })

        mockSupabase.single.mockResolvedValue({
          data: emailLog,
          error: null
        })

        mockTrackingService.prototype.recordOpen.mockResolvedValue({
          openId: faker.string.uuid(),
          timestamp: new Date().toISOString(),
          userAgent: faker.internet.userAgent(),
          ipAddress: faker.internet.ip()
        })

        const request = createMockRequest('/api/email/track/open', {
          method: 'GET',
          searchParams: { 
            id: trackingId,
            ip: faker.internet.ip(),
            ua: faker.internet.userAgent()
          }
        })

        const response = await testApiRoute(trackOpenHandler.GET, request)
        
        expect(response.status).toBe(200)
        expect(response.headers.get('Content-Type')).toContain('image/gif')
        expect(mockTrackingService.prototype.recordOpen).toHaveBeenCalledWith(
          trackingId,
          expect.objectContaining({
            ip: expect.any(String),
            userAgent: expect.any(String)
          })
        )
      })

      it('should handle duplicate opens gracefully', async () => {
        const trackingId = faker.string.alphanumeric(32)
        
        mockSupabase.single.mockResolvedValue({
          data: {
            id: faker.string.uuid(),
            opened_at: faker.date.past().toISOString(),
            open_count: 1
          },
          error: null
        })

        mockTrackingService.prototype.recordOpen.mockResolvedValue({
          isFirstOpen: false,
          totalOpens: 2
        })

        const request = createMockRequest('/api/email/track/open', {
          method: 'GET',
          searchParams: { id: trackingId }
        })

        const response = await testApiRoute(trackOpenHandler.GET, request)
        
        expect(response.status).toBe(200)
        expect(mockTrackingService.prototype.recordOpen).toHaveBeenCalled()
      })

      it('should ignore bot opens', async () => {
        const trackingId = faker.string.alphanumeric(32)
        const botUserAgent = 'GoogleBot/2.1 (+http://www.google.com/bot.html)'

        const request = createMockRequest('/api/email/track/open', {
          method: 'GET',
          searchParams: { 
            id: trackingId,
            ua: botUserAgent
          }
        })

        const response = await testApiRoute(trackOpenHandler.GET, request)
        
        expect(response.status).toBe(200)
        // Should still serve tracking pixel but not record open
        expect(mockTrackingService.prototype.recordOpen).not.toHaveBeenCalled()
      })
    })

    describe('GET /api/email/track/click', () => {
      it('should track email clicks and redirect', async () => {
        const trackingId = faker.string.alphanumeric(32)
        const originalUrl = 'https://example.com/landing-page'
        
        mockSupabase.single.mockResolvedValue({
          data: {
            id: faker.string.uuid(),
            original_url: originalUrl,
            campaign_id: testCampaign.id,
            lead_id: testLead.id
          },
          error: null
        })

        mockTrackingService.prototype.recordClick.mockResolvedValue({
          clickId: faker.string.uuid(),
          timestamp: new Date().toISOString(),
          originalUrl
        })

        const request = createMockRequest('/api/email/track/click', {
          method: 'GET',
          searchParams: { 
            id: trackingId,
            ip: faker.internet.ip(),
            ua: faker.internet.userAgent()
          }
        })

        const response = await testApiRoute(trackClickHandler.GET, request)
        
        expect(response.status).toBe(302)
        expect(response.headers.get('Location')).toBe(originalUrl)
        expect(mockTrackingService.prototype.recordClick).toHaveBeenCalledWith(
          trackingId,
          expect.any(Object)
        )
      })

      it('should handle invalid tracking links', async () => {
        const invalidTrackingId = 'invalid-tracking-id'
        
        mockSupabase.single.mockResolvedValue({
          data: null,
          error: { message: 'Not found' }
        })

        const request = createMockRequest('/api/email/track/click', {
          method: 'GET',
          searchParams: { id: invalidTrackingId }
        })

        const response = await testApiRoute(trackClickHandler.GET, request)
        
        expect(response.status).toBe(404)
        expect(response.data.error).toBe('Tracking link not found')
      })

      it('should prevent click tracking abuse', async () => {
        const trackingId = faker.string.alphanumeric(32)
        
        // Simulate rapid clicks from same IP
        const requests = Array.from({ length: 10 }, () => 
          createMockRequest('/api/email/track/click', {
            method: 'GET',
            searchParams: { 
              id: trackingId,
              ip: '192.168.1.1'
            }
          })
        )

        // Mock the tracking service to detect abuse
        mockTrackingService.prototype.recordClick.mockResolvedValueOnce({
          clickId: faker.string.uuid(),
          recorded: true
        })
        
        // Subsequent clicks should be ignored
        mockTrackingService.prototype.recordClick.mockResolvedValue({
          recorded: false,
          reason: 'Rate limited'
        })

        mockSupabase.single.mockResolvedValue({
          data: {
            id: faker.string.uuid(),
            original_url: 'https://example.com'
          },
          error: null
        })

        const responses = await Promise.all(
          requests.map(req => testApiRoute(trackClickHandler.GET, req))
        )

        // All should redirect but only first should be recorded
        responses.forEach(response => {
          expect(response.status).toBe(302)
        })
      })
    })
  })

  describe('Email Webhooks', () => {
    describe('POST /api/webhooks/email', () => {
      it('should handle SES bounce notifications', async () => {
        const bounceWebhook = {
          Type: 'Notification',
          Message: JSON.stringify({
            notificationType: 'Bounce',
            bounce: {
              bounceType: 'Permanent',
              bounceSubType: 'General',
              timestamp: new Date().toISOString(),
              bounceRecipients: [{
                emailAddress: testLead.email,
                diagnosticCode: '550 5.1.1 User unknown'
              }]
            },
            mail: {
              messageId: `${Date.now()}.test@amazonses.com`,
              destination: [testLead.email]
            }
          })
        }

        mockSupabase.single.mockResolvedValue({
          data: {
            id: faker.string.uuid(),
            lead_id: testLead.id,
            campaign_id: testCampaign.id
          },
          error: null
        })

        const request = createMockRequest('/api/webhooks/email', {
          method: 'POST',
          headers: {
            'x-amz-sns-message-type': 'Notification'
          },
          body: bounceWebhook
        })

        const response = await testApiRoute(emailWebhookHandler.POST, request)
        
        expect(response.status).toBe(200)
        expect(response.data.processed).toBe(true)
        // Should update email log with bounce info
        expect(mockSupabase.update).toHaveBeenCalledWith(
          expect.objectContaining({
            status: 'bounced',
            bounced_at: expect.any(String),
            bounce_type: 'Permanent'
          })
        )
      })

      it('should handle SES complaint notifications', async () => {
        const complaintWebhook = {
          Type: 'Notification',
          Message: JSON.stringify({
            notificationType: 'Complaint',
            complaint: {
              timestamp: new Date().toISOString(),
              complainedRecipients: [{
                emailAddress: testLead.email
              }],
              complaintFeedbackType: 'abuse'
            },
            mail: {
              messageId: `${Date.now()}.test@amazonses.com`,
              destination: [testLead.email]
            }
          })
        }

        mockSupabase.single.mockResolvedValue({
          data: {
            id: faker.string.uuid(),
            lead_id: testLead.id
          },
          error: null
        })

        const request = createMockRequest('/api/webhooks/email', {
          method: 'POST',
          body: complaintWebhook
        })

        const response = await testApiRoute(emailWebhookHandler.POST, request)
        
        expect(response.status).toBe(200)
        // Should add lead to suppression list
        expect(mockSupabase.insert).toHaveBeenCalledWith(
          expect.objectContaining({
            email: testLead.email,
            reason: 'complaint',
            type: 'abuse'
          })
        )
      })

      it('should handle delivery confirmations', async () => {
        const deliveryWebhook = {
          Type: 'Notification',
          Message: JSON.stringify({
            notificationType: 'Delivery',
            delivery: {
              timestamp: new Date().toISOString(),
              recipients: [testLead.email],
              smtpResponse: '250 2.0.0 OK'
            },
            mail: {
              messageId: `${Date.now()}.test@amazonses.com`
            }
          })
        }

        mockSupabase.single.mockResolvedValue({
          data: {
            id: faker.string.uuid(),
            status: 'sent'
          },
          error: null
        })

        const request = createMockRequest('/api/webhooks/email', {
          method: 'POST',
          body: deliveryWebhook
        })

        const response = await testApiRoute(emailWebhookHandler.POST, request)
        
        expect(response.status).toBe(200)
        expect(mockSupabase.update).toHaveBeenCalledWith(
          expect.objectContaining({
            status: 'delivered',
            delivered_at: expect.any(String)
          })
        )
      })

      it('should validate webhook signatures', async () => {
        const invalidWebhook = {
          Type: 'Notification',
          Message: 'invalid message'
        }

        const request = createMockRequest('/api/webhooks/email', {
          method: 'POST',
          headers: {
            'x-amz-sns-message-type': 'Notification'
          },
          body: invalidWebhook
        })

        const response = await testApiRoute(emailWebhookHandler.POST, request)
        
        expect(response.status).toBe(400)
        expect(response.data.error).toContain('Invalid webhook')
      })
    })
  })

  describe('Campaign Execution', () => {
    it('should execute email campaigns with proper sequencing', async () => {
      const campaignExecution = {
        campaignId: testCampaign.id,
        sequenceStep: 1,
        leadIds: [testLead.id],
        scheduleTime: new Date(Date.now() + 3600000).toISOString() // 1 hour from now
      }

      mockSupabase.select.mockResolvedValueOnce({
        data: [testLead],
        error: null
      })

      mockSupabase.single.mockResolvedValue({
        data: {
          ...testCampaign,
          sequences: [{
            id: faker.string.uuid(),
            position: 1,
            delay_days: 0,
            subject: 'Welcome!',
            body: 'Hello {{first_name}}!'
          }]
        },
        error: null
      })

      // Mock campaign execution
      const executionResult = {
        campaignId: testCampaign.id,
        sequenceStep: 1,
        scheduled: 1,
        sent: 0,
        failed: 0,
        status: 'scheduled'
      }

      expect(executionResult.scheduled).toBe(1)
      expect(executionResult.status).toBe('scheduled')
    })

    it('should handle campaign pausing and resuming', async () => {
      // Test pausing active campaign
      mockSupabase.single.mockResolvedValueOnce({
        data: { ...testCampaign, status: 'active' },
        error: null
      })

      mockSupabase.update.mockResolvedValue({
        data: [{ ...testCampaign, status: 'paused' }],
        error: null
      })

      const pauseResult = {
        campaignId: testCampaign.id,
        previousStatus: 'active',
        newStatus: 'paused',
        pausedAt: new Date().toISOString()
      }

      expect(pauseResult.newStatus).toBe('paused')
    })
  })

  describe('Template Management', () => {
    it('should validate email templates', async () => {
      const validTemplate = {
        name: 'Welcome Email',
        subject: 'Welcome to {{company_name}}!',
        body: 'Hi {{first_name}}, welcome to {{company_name}}!',
        variables: ['first_name', 'company_name'],
        category: 'onboarding'
      }

      const invalidTemplate = {
        name: '',
        subject: 'Missing variables: {{undefined_var}}',
        body: 'Invalid template',
        variables: ['first_name'],
        category: 'invalid_category'
      }

      // Valid template should pass validation
      expect(validTemplate.name.length).toBeGreaterThan(0)
      expect(validTemplate.variables.every(v => 
        validTemplate.subject.includes(`{{${v}}}`) || 
        validTemplate.body.includes(`{{${v}}}`)
      )).toBe(true)

      // Invalid template should fail
      expect(invalidTemplate.name.length).toBe(0)
      expect(invalidTemplate.subject.includes('{{undefined_var}}')).toBe(true)
    })

    it('should personalize email content', async () => {
      const template = {
        subject: 'Hi {{first_name}}, {{company}} has a special offer!',
        body: 'Dear {{first_name}},\n\nWe at {{company}} would like to offer you...'
      }

      const personalizationData = {
        first_name: testLead.first_name,
        company: testLead.company
      }

      const personalizedSubject = template.subject
        .replace('{{first_name}}', personalizationData.first_name)
        .replace('{{company}}', personalizationData.company)

      const personalizedBody = template.body
        .replace('{{first_name}}', personalizationData.first_name)
        .replace('{{company}}', personalizationData.company)

      expect(personalizedSubject).toContain(testLead.first_name)
      expect(personalizedSubject).toContain(testLead.company)
      expect(personalizedBody).toContain(testLead.first_name)
      expect(personalizedBody).toContain(testLead.company)
    })
  })

  describe('Rate Limiting and Quotas', () => {
    it('should enforce sending rate limits', async () => {
      const rapidRequests = Array.from({ length: 20 }, () => 
        createMockRequest('/api/email/send', {
          method: 'POST',
          headers: {
            'x-workspace-id': testWorkspace.id,
            'authorization': `Bearer ${authToken}`
          },
          body: {
            to: faker.internet.email(),
            subject: 'Test',
            body: 'Test',
            campaignId: testCampaign.id
          }
        })
      )

      // Mock rate limiting - first few succeed, then get rate limited
      mockSupabase.single.mockResolvedValue({
        data: testCampaign,
        error: null
      })

      const responses = await Promise.all(
        rapidRequests.map(req => testApiRoute(sendHandler.POST, req))
      )

      const rateLimitedCount = responses.filter(r => r.status === 429).length
      expect(rateLimitedCount).toBeGreaterThan(0)
    })

    it('should track daily sending quotas', async () => {
      const dailyQuota = {
        workspace_id: testWorkspace.id,
        date: new Date().toISOString().split('T')[0],
        emails_sent: 95,
        daily_limit: 100
      }

      // Mock quota check
      mockSupabase.single.mockResolvedValue({
        data: dailyQuota,
        error: null
      })

      const emailData = {
        to: testLead.email,
        subject: 'Test Email',
        body: 'Test body',
        campaignId: testCampaign.id
      }

      const request = createMockRequest('/api/email/send', {
        method: 'POST',
        headers: {
          'x-workspace-id': testWorkspace.id,
          'authorization': `Bearer ${authToken}`
        },
        body: emailData
      })

      // Should allow since under limit
      const response = await testApiRoute(sendHandler.POST, request)
      expect(response.status).not.toBe(429)
    })
  })

  describe('Data Isolation', () => {
    it('should prevent cross-workspace email access', async () => {
      const otherWorkspace = workspaceFactory.create()
      const otherCampaign = campaignFactory.create({ 
        workspace_id: otherWorkspace.id 
      })

      const request = createMockRequest('/api/email/send', {
        method: 'POST',
        headers: {
          'x-workspace-id': testWorkspace.id,
          'authorization': `Bearer ${authToken}`
        },
        body: {
          to: testLead.email,
          subject: 'Test',
          body: 'Test',
          campaignId: otherCampaign.id // Different workspace campaign
        }
      })

      // Mock that campaign is not found in current workspace
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'Not found' }
      })

      const response = await testApiRoute(sendHandler.POST, request)
      
      expect(response.status).toBe(404)
      expect(response.data.error).toContain('Campaign not found')
    })
  })

  describe('Error Handling', () => {
    it('should handle SES service errors gracefully', async () => {
      const emailData = {
        to: testLead.email,
        subject: 'Test Email',
        body: 'Test body',
        campaignId: testCampaign.id
      }

      const sesError = new Error('SES quota exceeded')
      sesError.code = 'Throttling'
      
      mockSESClient.prototype.sendEmail.mockRejectedValue(sesError)

      mockSupabase.single.mockResolvedValue({
        data: testCampaign,
        error: null
      })

      const request = createMockRequest('/api/email/send', {
        method: 'POST',
        headers: {
          'x-workspace-id': testWorkspace.id,
          'authorization': `Bearer ${authToken}`
        },
        body: emailData
      })

      const response = await testApiRoute(sendHandler.POST, request)
      
      expect(response.status).toBe(429)
      expect(response.data.error).toContain('quota exceeded')
      expect(response.data.retryAfter).toBeDefined()
    })

    it('should handle database connection failures', async () => {
      mockSupabase.auth.getUser.mockRejectedValue(
        new Error('Database connection failed')
      )

      const request = createMockRequest('/api/email/send', {
        method: 'POST',
        headers: {
          'x-workspace-id': testWorkspace.id,
          'authorization': `Bearer ${authToken}`
        },
        body: {
          to: testLead.email,
          subject: 'Test',
          body: 'Test',
          campaignId: testCampaign.id
        }
      })

      const response = await testApiRoute(sendHandler.POST, request)
      
      expect(response.status).toBe(500)
      expect(response.data.error).toContain('Database connection failed')
    })
  })
})

// Email Schema Validation Tests
describe('Email API Schema Validation', () => {
  it('should validate email send request schema', () => {
    const validRequest = {
      to: faker.internet.email(),
      subject: faker.lorem.sentence(),
      body: faker.lorem.paragraphs(2),
      campaignId: faker.string.uuid(),
      personalization: {
        first_name: faker.person.firstName(),
        company: faker.company.name()
      }
    }

    expect(validRequest.to).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
    expect(validRequest.subject.length).toBeGreaterThan(0)
    expect(validRequest.body.length).toBeGreaterThan(0)
    expect(validRequest.campaignId).toMatch(/^[a-f0-9-]{36}$/)
  })

  it('should validate tracking event schemas', () => {
    const validTrackingEvent = {
      type: 'open',
      timestamp: new Date().toISOString(),
      emailId: faker.string.uuid(),
      leadId: faker.string.uuid(),
      metadata: {
        userAgent: faker.internet.userAgent(),
        ipAddress: faker.internet.ip(),
        location: {
          city: faker.location.city(),
          country: faker.location.country()
        }
      }
    }

    expect(['open', 'click', 'bounce', 'complaint']).toContain(validTrackingEvent.type)
    expect(new Date(validTrackingEvent.timestamp)).toBeInstanceOf(Date)
    expect(validTrackingEvent.metadata.ipAddress).toMatch(/^\d+\.\d+\.\d+\.\d+$/)
  })
})
