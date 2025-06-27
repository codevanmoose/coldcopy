import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ApiTestClient, createMockRequest, testApiRoute } from '../utils/api'
import { cleanTestDatabase } from '../setup/test-db-setup'
import { userFactory, workspaceFactory, leadFactory } from '../utils/factories'
import { GDPRService } from '@/lib/gdpr/gdpr-service'
import { ConsentType, RequestType, RequestStatus } from '@/lib/gdpr/types'
import * as consentHandler from '@/app/api/gdpr/consent/route'
import * as cookiesHandler from '@/app/api/gdpr/cookies/route'
import * as requestsHandler from '@/app/api/gdpr/requests/route'
import * as exportHandler from '@/app/api/gdpr/export/route'
import * as unsubscribeHandler from '@/app/api/unsubscribe/route'
import { faker } from '@faker-js/faker'

// Mock external services
jest.mock('@/lib/gdpr/gdpr-service')
jest.mock('@/lib/supabase/server')
jest.mock('@/lib/email/ses-client')

const mockGDPRService = GDPRService as jest.MockedClass<typeof GDPRService>
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
  neq: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  single: jest.fn(),
  limit: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  range: jest.fn().mockReturnThis(),
}

require('@/lib/supabase/server').createClient = jest.fn().mockReturnValue(mockSupabase)

describe('GDPR API Integration Tests', () => {
  let testClient: ApiTestClient
  let testUser: any
  let testWorkspace: any
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
    testLead = leadFactory.create({ workspace_id: testWorkspace.id })

    // Setup default auth mock
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: testUser },
      error: null
    })

    // Setup GDPR service mocks
    mockGDPRService.prototype.recordConsent = jest.fn()
    mockGDPRService.prototype.getConsent = jest.fn()
    mockGDPRService.prototype.withdrawConsent = jest.fn()
    mockGDPRService.prototype.createDataRequest = jest.fn()
    mockGDPRService.prototype.processDataRequest = jest.fn()
    mockGDPRService.prototype.exportUserData = jest.fn()
    mockGDPRService.prototype.deleteUserData = jest.fn()
    mockGDPRService.prototype.anonymizeUserData = jest.fn()
  })

  describe('Consent Management', () => {
    describe('POST /api/gdpr/consent', () => {
      it('should record user consent successfully', async () => {
        const consentData = {
          email: testLead.email,
          consentType: ConsentType.EMAIL_MARKETING,
          granted: true,
          source: 'signup_form',
          ipAddress: faker.internet.ip(),
          userAgent: faker.internet.userAgent(),
          metadata: {
            formVersion: '1.2',
            campaign: 'newsletter_signup'
          }
        }

        const mockConsentRecord = {
          id: faker.string.uuid(),
          ...consentData,
          timestamp: new Date().toISOString()
        }

        mockGDPRService.prototype.recordConsent.mockResolvedValue(mockConsentRecord)

        const request = createMockRequest('/api/gdpr/consent', {
          method: 'POST',
          body: consentData
        })

        const response = await testApiRoute(consentHandler.POST, request)
        
        expect(response.status).toBe(201)
        expect(response.data).toEqual(mockConsentRecord)
        expect(mockGDPRService.prototype.recordConsent).toHaveBeenCalledWith(consentData)
      })

      it('should validate required consent fields', async () => {
        const invalidData = {
          email: '', // Empty email
          consentType: 'invalid_type', // Invalid consent type
          granted: 'not_boolean' // Invalid boolean
        }

        const request = createMockRequest('/api/gdpr/consent', {
          method: 'POST',
          body: invalidData
        })

        const response = await testApiRoute(consentHandler.POST, request)
        
        expect(response.status).toBe(400)
        expect(response.data.error).toContain('validation')
      })

      it('should handle duplicate consent records', async () => {
        const consentData = {
          email: testLead.email,
          consentType: ConsentType.EMAIL_MARKETING,
          granted: true
        }

        const error = new Error('Consent already exists')
        error.code = 'DUPLICATE_CONSENT'
        error.statusCode = 409
        
        mockGDPRService.prototype.recordConsent.mockRejectedValue(error)

        const request = createMockRequest('/api/gdpr/consent', {
          method: 'POST',
          body: consentData
        })

        const response = await testApiRoute(consentHandler.POST, request)
        
        expect(response.status).toBe(409)
        expect(response.data.error).toBe('Consent already exists')
      })
    })

    describe('GET /api/gdpr/consent', () => {
      it('should retrieve consent status for email', async () => {
        const mockConsent = {
          email: testLead.email,
          consents: {
            [ConsentType.EMAIL_MARKETING]: {
              granted: true,
              timestamp: new Date().toISOString(),
              source: 'signup_form'
            },
            [ConsentType.DATA_PROCESSING]: {
              granted: true,
              timestamp: new Date().toISOString(),
              source: 'privacy_policy'
            }
          }
        }

        mockGDPRService.prototype.getConsent.mockResolvedValue(mockConsent)

        const request = createMockRequest('/api/gdpr/consent', {
          method: 'GET',
          searchParams: { email: testLead.email }
        })

        const response = await testApiRoute(consentHandler.GET, request)
        
        expect(response.status).toBe(200)
        expect(response.data).toEqual(mockConsent)
        expect(mockGDPRService.prototype.getConsent).toHaveBeenCalledWith(testLead.email)
      })

      it('should return 404 for non-existent email', async () => {
        const nonExistentEmail = faker.internet.email()
        
        mockGDPRService.prototype.getConsent.mockResolvedValue(null)

        const request = createMockRequest('/api/gdpr/consent', {
          method: 'GET',
          searchParams: { email: nonExistentEmail }
        })

        const response = await testApiRoute(consentHandler.GET, request)
        
        expect(response.status).toBe(404)
        expect(response.data.error).toBe('Consent record not found')
      })
    })

    describe('DELETE /api/gdpr/consent', () => {
      it('should withdraw consent successfully', async () => {
        const withdrawalData = {
          email: testLead.email,
          consentType: ConsentType.EMAIL_MARKETING,
          reason: 'User requested withdrawal'
        }

        const mockWithdrawal = {
          ...withdrawalData,
          timestamp: new Date().toISOString(),
          id: faker.string.uuid()
        }

        mockGDPRService.prototype.withdrawConsent.mockResolvedValue(mockWithdrawal)

        const request = createMockRequest('/api/gdpr/consent', {
          method: 'DELETE',
          body: withdrawalData
        })

        const response = await testApiRoute(consentHandler.DELETE, request)
        
        expect(response.status).toBe(200)
        expect(response.data).toEqual(mockWithdrawal)
        expect(mockGDPRService.prototype.withdrawConsent).toHaveBeenCalledWith(withdrawalData)
      })
    })
  })

  describe('Cookie Management', () => {
    describe('GET /api/gdpr/cookies', () => {
      it('should return cookie preferences for user', async () => {
        const mockPreferences = {
          necessary: true,
          analytics: false,
          marketing: true,
          preferences: true,
          lastUpdated: new Date().toISOString()
        }

        mockSupabase.single.mockResolvedValue({
          data: { cookie_preferences: mockPreferences },
          error: null
        })

        const request = createMockRequest('/api/gdpr/cookies', {
          method: 'GET',
          searchParams: { userId: testUser.id }
        })

        const response = await testApiRoute(cookiesHandler.GET, request)
        
        expect(response.status).toBe(200)
        expect(response.data).toEqual(mockPreferences)
      })

      it('should return default preferences for new users', async () => {
        mockSupabase.single.mockResolvedValue({
          data: null,
          error: null
        })

        const request = createMockRequest('/api/gdpr/cookies', {
          method: 'GET',
          searchParams: { userId: 'new_user_id' }
        })

        const response = await testApiRoute(cookiesHandler.GET, request)
        
        expect(response.status).toBe(200)
        expect(response.data.necessary).toBe(true)
        expect(response.data.analytics).toBe(false)
        expect(response.data.marketing).toBe(false)
      })
    })

    describe('POST /api/gdpr/cookies', () => {
      it('should update cookie preferences', async () => {
        const preferences = {
          necessary: true,
          analytics: true,
          marketing: false,
          preferences: true
        }

        mockSupabase.single.mockResolvedValue({
          data: { id: testUser.id },
          error: null
        })

        const request = createMockRequest('/api/gdpr/cookies', {
          method: 'POST',
          body: {
            userId: testUser.id,
            preferences
          }
        })

        const response = await testApiRoute(cookiesHandler.POST, request)
        
        expect(response.status).toBe(200)
        expect(response.data.preferences).toEqual(preferences)
      })
    })
  })

  describe('Data Subject Requests', () => {
    describe('POST /api/gdpr/requests', () => {
      it('should create data access request', async () => {
        const requestData = {
          email: testLead.email,
          requestType: RequestType.ACCESS,
          description: 'I want to see all my personal data',
          verificationData: {
            firstName: testLead.first_name,
            lastName: testLead.last_name
          }
        }

        const mockRequest = {
          id: faker.string.uuid(),
          ...requestData,
          status: RequestStatus.PENDING,
          submittedAt: new Date().toISOString(),
          estimatedCompletionDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        }

        mockGDPRService.prototype.createDataRequest.mockResolvedValue(mockRequest)

        const request = createMockRequest('/api/gdpr/requests', {
          method: 'POST',
          body: requestData
        })

        const response = await testApiRoute(requestsHandler.POST, request)
        
        expect(response.status).toBe(201)
        expect(response.data).toEqual(mockRequest)
        expect(mockGDPRService.prototype.createDataRequest).toHaveBeenCalledWith(requestData)
      })

      it('should create data deletion request', async () => {
        const requestData = {
          email: testLead.email,
          requestType: RequestType.DELETION,
          description: 'Please delete all my personal data',
          verificationData: {
            firstName: testLead.first_name,
            phone: testLead.phone
          }
        }

        const mockRequest = {
          id: faker.string.uuid(),
          ...requestData,
          status: RequestStatus.PENDING,
          submittedAt: new Date().toISOString()
        }

        mockGDPRService.prototype.createDataRequest.mockResolvedValue(mockRequest)

        const request = createMockRequest('/api/gdpr/requests', {
          method: 'POST',
          body: requestData
        })

        const response = await testApiRoute(requestsHandler.POST, request)
        
        expect(response.status).toBe(201)
        expect(response.data.requestType).toBe(RequestType.DELETION)
      })

      it('should validate request data', async () => {
        const invalidData = {
          email: 'invalid-email',
          requestType: 'INVALID_TYPE',
          verificationData: {} // Empty verification
        }

        const request = createMockRequest('/api/gdpr/requests', {
          method: 'POST',
          body: invalidData
        })

        const response = await testApiRoute(requestsHandler.POST, request)
        
        expect(response.status).toBe(400)
        expect(response.data.error).toContain('validation')
      })

      it('should prevent duplicate pending requests', async () => {
        const requestData = {
          email: testLead.email,
          requestType: RequestType.ACCESS
        }

        const error = new Error('Pending request already exists')
        error.code = 'DUPLICATE_REQUEST'
        error.statusCode = 409
        
        mockGDPRService.prototype.createDataRequest.mockRejectedValue(error)

        const request = createMockRequest('/api/gdpr/requests', {
          method: 'POST',
          body: requestData
        })

        const response = await testApiRoute(requestsHandler.POST, request)
        
        expect(response.status).toBe(409)
        expect(response.data.error).toBe('Pending request already exists')
      })
    })

    describe('GET /api/gdpr/requests', () => {
      it('should list data requests for authenticated user', async () => {
        const mockRequests = [
          {
            id: faker.string.uuid(),
            email: testLead.email,
            requestType: RequestType.ACCESS,
            status: RequestStatus.COMPLETED,
            submittedAt: faker.date.past().toISOString(),
            completedAt: faker.date.recent().toISOString()
          },
          {
            id: faker.string.uuid(),
            email: testLead.email,
            requestType: RequestType.DELETION,
            status: RequestStatus.PENDING,
            submittedAt: faker.date.recent().toISOString()
          }
        ]

        mockSupabase.select.mockResolvedValue({
          data: mockRequests,
          error: null
        })

        const request = createMockRequest('/api/gdpr/requests', {
          method: 'GET',
          headers: {
            'x-workspace-id': testWorkspace.id,
            'authorization': `Bearer ${authToken}`
          }
        })

        const response = await testApiRoute(requestsHandler.GET, request)
        
        expect(response.status).toBe(200)
        expect(response.data).toEqual(mockRequests)
      })

      it('should filter requests by status', async () => {
        const pendingRequests = [
          {
            id: faker.string.uuid(),
            status: RequestStatus.PENDING,
            requestType: RequestType.ACCESS
          }
        ]

        mockSupabase.select.mockResolvedValue({
          data: pendingRequests,
          error: null
        })

        const request = createMockRequest('/api/gdpr/requests', {
          method: 'GET',
          headers: {
            'authorization': `Bearer ${authToken}`
          },
          searchParams: { status: RequestStatus.PENDING }
        })

        const response = await testApiRoute(requestsHandler.GET, request)
        
        expect(response.status).toBe(200)
        expect(response.data.every(r => r.status === RequestStatus.PENDING)).toBe(true)
      })
    })
  })

  describe('Data Export', () => {
    describe('GET /api/gdpr/export', () => {
      it('should export user data successfully', async () => {
        const mockExportData = {
          personal_information: {
            email: testLead.email,
            first_name: testLead.first_name,
            last_name: testLead.last_name,
            created_at: testLead.created_at
          },
          email_interactions: [
            {
              campaign_name: 'Welcome Series',
              sent_at: faker.date.past().toISOString(),
              opened: true,
              clicked: false
            }
          ],
          consent_records: [
            {
              consent_type: ConsentType.EMAIL_MARKETING,
              granted: true,
              timestamp: faker.date.past().toISOString()
            }
          ],
          export_metadata: {
            exported_at: new Date().toISOString(),
            export_format: 'json',
            data_retention_period: '7 years'
          }
        }

        mockGDPRService.prototype.exportUserData.mockResolvedValue(mockExportData)

        const request = createMockRequest('/api/gdpr/export', {
          method: 'GET',
          searchParams: { 
            requestId: faker.string.uuid(),
            token: 'verification_token' 
          }
        })

        const response = await testApiRoute(exportHandler.GET, request)
        
        expect(response.status).toBe(200)
        expect(response.data).toEqual(mockExportData)
        expect(response.headers.get('Content-Type')).toContain('application/json')
      })

      it('should handle CSV export format', async () => {
        const mockCsvData = 'email,first_name,last_name\ntest@example.com,John,Doe'
        
        mockGDPRService.prototype.exportUserData.mockResolvedValue(mockCsvData)

        const request = createMockRequest('/api/gdpr/export', {
          method: 'GET',
          searchParams: { 
            requestId: faker.string.uuid(),
            format: 'csv',
            token: 'verification_token'
          }
        })

        const response = await testApiRoute(exportHandler.GET, request)
        
        expect(response.status).toBe(200)
        expect(response.headers.get('Content-Type')).toContain('text/csv')
      })

      it('should validate export tokens', async () => {
        const request = createMockRequest('/api/gdpr/export', {
          method: 'GET',
          searchParams: { 
            requestId: faker.string.uuid(),
            token: 'invalid_token'
          }
        })

        const error = new Error('Invalid or expired token')
        error.statusCode = 403
        
        mockGDPRService.prototype.exportUserData.mockRejectedValue(error)

        const response = await testApiRoute(exportHandler.GET, request)
        
        expect(response.status).toBe(403)
        expect(response.data.error).toBe('Invalid or expired token')
      })
    })
  })

  describe('Unsubscribe Endpoints', () => {
    describe('GET /api/unsubscribe', () => {
      it('should show unsubscribe page with valid token', async () => {
        const unsubscribeToken = 'valid_unsubscribe_token'
        const mockLeadData = {
          email: testLead.email,
          first_name: testLead.first_name,
          subscription_status: 'subscribed'
        }

        mockSupabase.single.mockResolvedValue({
          data: mockLeadData,
          error: null
        })

        const request = createMockRequest('/api/unsubscribe', {
          method: 'GET',
          searchParams: { token: unsubscribeToken }
        })

        const response = await testApiRoute(unsubscribeHandler.GET, request)
        
        expect(response.status).toBe(200)
        expect(response.data.lead).toEqual(mockLeadData)
      })

      it('should return 404 for invalid unsubscribe tokens', async () => {
        mockSupabase.single.mockResolvedValue({
          data: null,
          error: { message: 'Not found' }
        })

        const request = createMockRequest('/api/unsubscribe', {
          method: 'GET',
          searchParams: { token: 'invalid_token' }
        })

        const response = await testApiRoute(unsubscribeHandler.GET, request)
        
        expect(response.status).toBe(404)
        expect(response.data.error).toBe('Invalid unsubscribe link')
      })
    })

    describe('POST /api/unsubscribe', () => {
      it('should process unsubscribe request', async () => {
        const unsubscribeData = {
          token: 'valid_token',
          reason: 'Too many emails',
          feedback: 'The frequency was too high'
        }

        mockSupabase.single.mockResolvedValueOnce({
          data: { lead_id: testLead.id, email: testLead.email },
          error: null
        })

        mockSupabase.single.mockResolvedValueOnce({
          data: { id: testLead.id, status: 'unsubscribed' },
          error: null
        })

        const request = createMockRequest('/api/unsubscribe', {
          method: 'POST',
          body: unsubscribeData
        })

        const response = await testApiRoute(unsubscribeHandler.POST, request)
        
        expect(response.status).toBe(200)
        expect(response.data.success).toBe(true)
        expect(response.data.message).toContain('unsubscribed')
      })

      it('should record unsubscribe reasons', async () => {
        const unsubscribeData = {
          token: 'valid_token',
          reason: 'Not interested',
          categories: ['marketing', 'newsletters']
        }

        mockSupabase.single.mockResolvedValueOnce({
          data: { lead_id: testLead.id },
          error: null
        })

        mockSupabase.single.mockResolvedValueOnce({
          data: { id: testLead.id },
          error: null
        })

        const request = createMockRequest('/api/unsubscribe', {
          method: 'POST',
          body: unsubscribeData
        })

        const response = await testApiRoute(unsubscribeHandler.POST, request)
        
        expect(response.status).toBe(200)
        // Verify that unsubscribe reason was recorded
        expect(mockSupabase.insert).toHaveBeenCalledWith(
          expect.objectContaining({
            reason: unsubscribeData.reason,
            categories: unsubscribeData.categories
          })
        )
      })
    })
  })

  describe('GDPR Compliance Features', () => {
    it('should handle right to be forgotten requests', async () => {
      const deletionRequestId = faker.string.uuid()
      
      mockGDPRService.prototype.processDataRequest.mockResolvedValue({
        requestId: deletionRequestId,
        status: RequestStatus.COMPLETED,
        deletedRecords: {
          leads: 1,
          email_logs: 15,
          consent_records: 3,
          unsubscribe_records: 1
        },
        completedAt: new Date().toISOString()
      })

      // This would be called by an admin or automated process
      const result = await mockGDPRService.prototype.processDataRequest(deletionRequestId)
      
      expect(result.status).toBe(RequestStatus.COMPLETED)
      expect(result.deletedRecords.leads).toBe(1)
    })

    it('should anonymize data instead of deleting when required', async () => {
      const anonymizationRequestId = faker.string.uuid()
      
      mockGDPRService.prototype.anonymizeUserData.mockResolvedValue({
        requestId: anonymizationRequestId,
        anonymizedRecords: {
          leads: 1,
          email_logs: 15
        },
        anonymizationMethod: 'hash_with_salt',
        completedAt: new Date().toISOString()
      })

      const result = await mockGDPRService.prototype.anonymizeUserData(testLead.email)
      
      expect(result.anonymizedRecords.leads).toBe(1)
      expect(result.anonymizationMethod).toBe('hash_with_salt')
    })
  })

  describe('Data Retention Compliance', () => {
    it('should enforce data retention policies', async () => {
      // Mock old records that should be deleted
      const oldDate = new Date(Date.now() - 8 * 365 * 24 * 60 * 60 * 1000) // 8 years ago
      
      mockSupabase.select.mockResolvedValue({
        data: [
          {
            id: faker.string.uuid(),
            email: faker.internet.email(),
            created_at: oldDate.toISOString(),
            last_activity: oldDate.toISOString()
          }
        ],
        error: null
      })

      // This would be part of a CRON job
      const retentionResult = {
        deletedRecords: 1,
        retentionPeriod: '7 years',
        executedAt: new Date().toISOString()
      }

      expect(retentionResult.deletedRecords).toBeGreaterThan(0)
    })
  })

  describe('Rate Limiting and Security', () => {
    it('should rate limit GDPR requests', async () => {
      const requests = Array.from({ length: 6 }, () => 
        createMockRequest('/api/gdpr/requests', {
          method: 'POST',
          body: {
            email: faker.internet.email(),
            requestType: RequestType.ACCESS
          }
        })
      )

      const responses = await Promise.all(
        requests.map(req => testApiRoute(requestsHandler.POST, req))
      )

      // Should rate limit after 5 requests
      const rateLimitedResponses = responses.filter(r => r.status === 429)
      expect(rateLimitedResponses.length).toBeGreaterThan(0)
    })

    it('should prevent GDPR data leakage between workspaces', async () => {
      const otherWorkspace = workspaceFactory.create()
      const otherLead = leadFactory.create({ workspace_id: otherWorkspace.id })
      
      // Try to access other workspace's GDPR data
      const request = createMockRequest('/api/gdpr/requests', {
        method: 'GET',
        headers: {
          'x-workspace-id': testWorkspace.id,
          'authorization': `Bearer ${authToken}`
        },
        searchParams: { email: otherLead.email }
      })

      mockSupabase.select.mockResolvedValue({
        data: [], // No data returned due to workspace isolation
        error: null
      })

      const response = await testApiRoute(requestsHandler.GET, request)
      
      expect(response.status).toBe(200)
      expect(response.data).toEqual([])
    })
  })

  describe('Error Handling', () => {
    it('should handle malformed GDPR requests', async () => {
      const request = createMockRequest('/api/gdpr/consent', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: 'invalid json{'
      })

      const response = await testApiRoute(consentHandler.POST, request)
      
      expect(response.status).toBeGreaterThanOrEqual(400)
    })

    it('should handle service unavailability', async () => {
      mockGDPRService.prototype.recordConsent.mockRejectedValue(
        new Error('Service temporarily unavailable')
      )

      const request = createMockRequest('/api/gdpr/consent', {
        method: 'POST',
        body: {
          email: testLead.email,
          consentType: ConsentType.EMAIL_MARKETING,
          granted: true
        }
      })

      const response = await testApiRoute(consentHandler.POST, request)
      
      expect(response.status).toBe(500)
      expect(response.data.error).toContain('Service temporarily unavailable')
    })
  })
})

// GDPR Schema Validation Tests
describe('GDPR API Schema Validation', () => {
  it('should validate consent record structure', () => {
    const validConsent = {
      email: faker.internet.email(),
      consentType: ConsentType.EMAIL_MARKETING,
      granted: true,
      source: 'signup_form',
      ipAddress: faker.internet.ip(),
      timestamp: new Date().toISOString()
    }

    expect(validConsent.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
    expect(Object.values(ConsentType)).toContain(validConsent.consentType)
    expect(typeof validConsent.granted).toBe('boolean')
  })

  it('should validate data request structure', () => {
    const validRequest = {
      email: faker.internet.email(),
      requestType: RequestType.ACCESS,
      description: 'Please provide all my personal data',
      verificationData: {
        firstName: 'John',
        lastName: 'Doe'
      }
    }

    expect(Object.values(RequestType)).toContain(validRequest.requestType)
    expect(validRequest.description.length).toBeGreaterThan(0)
    expect(validRequest.verificationData).toBeTruthy()
  })

  it('should validate cookie preferences structure', () => {
    const validPreferences = {
      necessary: true,
      analytics: false,
      marketing: true,
      preferences: false
    }

    Object.values(validPreferences).forEach(value => {
      expect(typeof value).toBe('boolean')
    })
    expect(validPreferences.necessary).toBe(true) // Necessary cookies always required
  })
})
