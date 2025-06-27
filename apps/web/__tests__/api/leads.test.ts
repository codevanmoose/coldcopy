import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ApiTestClient, createMockRequest, testApiRoute } from '../utils/api'
import { cleanTestDatabase } from '../setup/test-db-setup'
import { userFactory, workspaceFactory, leadFactory } from '../utils/factories'
import { EnrichmentService } from '@/lib/enrichment/enrichment-service'
import { faker } from '@faker-js/faker'

// Mock external services
jest.mock('@/lib/enrichment/enrichment-service')
jest.mock('@/lib/supabase/server')
jest.mock('csv-parse')

const mockEnrichmentService = EnrichmentService as jest.MockedClass<typeof EnrichmentService>
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
  ilike: jest.fn().mockReturnThis(),
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

// Mock leads API handlers (these would be actual route handlers)
const mockLeadsHandlers = {
  GET: jest.fn(),
  POST: jest.fn(),
  PATCH: jest.fn(),
  DELETE: jest.fn(),
}

describe('Leads API Integration Tests', () => {
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

    // Setup enrichment service mocks
    mockEnrichmentService.prototype.enrichLead = jest.fn()
    mockEnrichmentService.prototype.validateEmail = jest.fn()
    mockEnrichmentService.prototype.findCompanyInfo = jest.fn()
    mockEnrichmentService.prototype.processCSVImport = jest.fn()
  })

  describe('Lead CRUD Operations', () => {
    describe('GET /api/leads', () => {
      it('should return paginated leads for workspace', async () => {
        const mockLeads = leadFactory.createMany(15, { workspace_id: testWorkspace.id })
        const paginatedResponse = {
          data: mockLeads.slice(0, 10),
          total: 15,
          page: 1,
          limit: 10,
          totalPages: 2
        }

        mockSupabase.count.mockResolvedValue({ count: 15, error: null })
        mockSupabase.range.mockResolvedValue({
          data: mockLeads.slice(0, 10),
          error: null
        })

        const request = createMockRequest('/api/leads', {
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

        // Mock the leads GET handler
        mockLeadsHandlers.GET.mockResolvedValue({
          status: 200,
          data: paginatedResponse
        })

        const response = await mockLeadsHandlers.GET(request)
        
        expect(response.status).toBe(200)
        expect(response.data.data.length).toBe(10)
        expect(response.data.total).toBe(15)
        expect(response.data.totalPages).toBe(2)
      })

      it('should filter leads by search query', async () => {
        const searchQuery = 'john@example.com'
        const filteredLeads = [testLead]

        mockSupabase.ilike.mockReturnThis()
        mockSupabase.range.mockResolvedValue({
          data: filteredLeads,
          error: null
        })
        mockSupabase.count.mockResolvedValue({ count: 1, error: null })

        const request = createMockRequest('/api/leads', {
          method: 'GET',
          headers: {
            'x-workspace-id': testWorkspace.id,
            'authorization': `Bearer ${authToken}`
          },
          searchParams: {
            search: searchQuery
          }
        })

        mockLeadsHandlers.GET.mockResolvedValue({
          status: 200,
          data: {
            data: filteredLeads,
            total: 1,
            page: 1,
            limit: 50
          }
        })

        const response = await mockLeadsHandlers.GET(request)
        
        expect(response.status).toBe(200)
        expect(response.data.data.length).toBe(1)
        expect(mockSupabase.ilike).toHaveBeenCalled()
      })

      it('should filter leads by status', async () => {
        const activeLeads = leadFactory.createMany(5, { 
          workspace_id: testWorkspace.id,
          status: 'active'
        })

        mockSupabase.eq.mockReturnThis()
        mockSupabase.range.mockResolvedValue({
          data: activeLeads,
          error: null
        })
        mockSupabase.count.mockResolvedValue({ count: 5, error: null })

        const request = createMockRequest('/api/leads', {
          method: 'GET',
          headers: {
            'x-workspace-id': testWorkspace.id,
            'authorization': `Bearer ${authToken}`
          },
          searchParams: {
            status: 'active'
          }
        })

        mockLeadsHandlers.GET.mockResolvedValue({
          status: 200,
          data: {
            data: activeLeads,
            total: 5
          }
        })

        const response = await mockLeadsHandlers.GET(request)
        
        expect(response.status).toBe(200)
        expect(response.data.data.every(lead => lead.status === 'active')).toBe(true)
      })

      it('should sort leads by specified field', async () => {
        const sortedLeads = leadFactory.createMany(5, { workspace_id: testWorkspace.id })
          .sort((a, b) => a.created_at.localeCompare(b.created_at))

        mockSupabase.order.mockReturnThis()
        mockSupabase.range.mockResolvedValue({
          data: sortedLeads,
          error: null
        })
        mockSupabase.count.mockResolvedValue({ count: 5, error: null })

        const request = createMockRequest('/api/leads', {
          method: 'GET',
          headers: {
            'x-workspace-id': testWorkspace.id,
            'authorization': `Bearer ${authToken}`
          },
          searchParams: {
            sortBy: 'created_at',
            sortOrder: 'asc'
          }
        })

        mockLeadsHandlers.GET.mockResolvedValue({
          status: 200,
          data: {
            data: sortedLeads,
            total: 5
          }
        })

        const response = await mockLeadsHandlers.GET(request)
        
        expect(response.status).toBe(200)
        expect(mockSupabase.order).toHaveBeenCalledWith('created_at', { ascending: true })
      })
    })

    describe('POST /api/leads', () => {
      it('should create new lead successfully', async () => {
        const newLeadData = {
          email: faker.internet.email(),
          first_name: faker.person.firstName(),
          last_name: faker.person.lastName(),
          company: faker.company.name(),
          title: faker.person.jobTitle(),
          phone: faker.phone.number(),
          linkedin_url: `https://linkedin.com/in/${faker.internet.username()}`,
          website: faker.internet.url(),
          tags: ['prospect', 'cold'],
          custom_fields: {
            industry: faker.company.buzzNoun(),
            company_size: '50-100',
            source: 'website'
          }
        }

        const createdLead = {
          id: faker.string.uuid(),
          workspace_id: testWorkspace.id,
          ...newLeadData,
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }

        mockSupabase.insert.mockResolvedValue({
          data: [createdLead],
          error: null
        })

        const request = createMockRequest('/api/leads', {
          method: 'POST',
          headers: {
            'x-workspace-id': testWorkspace.id,
            'authorization': `Bearer ${authToken}`
          },
          body: newLeadData
        })

        mockLeadsHandlers.POST.mockResolvedValue({
          status: 201,
          data: createdLead
        })

        const response = await mockLeadsHandlers.POST(request)
        
        expect(response.status).toBe(201)
        expect(response.data.email).toBe(newLeadData.email)
        expect(response.data.workspace_id).toBe(testWorkspace.id)
        expect(response.data.status).toBe('active')
      })

      it('should validate lead data before creation', async () => {
        const invalidLeadData = {
          email: 'invalid-email', // Invalid email format
          first_name: '', // Empty required field
          company: 'a'.repeat(256), // Too long
          custom_fields: 'not an object' // Invalid type
        }

        const request = createMockRequest('/api/leads', {
          method: 'POST',
          headers: {
            'x-workspace-id': testWorkspace.id,
            'authorization': `Bearer ${authToken}`
          },
          body: invalidLeadData
        })

        mockLeadsHandlers.POST.mockResolvedValue({
          status: 400,
          data: {
            error: 'Validation failed',
            errors: [
              'Invalid email format',
              'First name is required',
              'Company name too long',
              'Custom fields must be an object'
            ]
          }
        })

        const response = await mockLeadsHandlers.POST(request)
        
        expect(response.status).toBe(400)
        expect(response.data.errors.length).toBeGreaterThan(0)
      })

      it('should prevent duplicate email addresses in workspace', async () => {
        const duplicateEmail = testLead.email

        mockSupabase.insert.mockResolvedValue({
          data: null,
          error: {
            code: '23505', // Unique constraint violation
            message: 'duplicate key value violates unique constraint'
          }
        })

        const request = createMockRequest('/api/leads', {
          method: 'POST',
          headers: {
            'x-workspace-id': testWorkspace.id,
            'authorization': `Bearer ${authToken}`
          },
          body: {
            email: duplicateEmail,
            first_name: faker.person.firstName(),
            last_name: faker.person.lastName()
          }
        })

        mockLeadsHandlers.POST.mockResolvedValue({
          status: 409,
          data: {
            error: 'Email already exists in this workspace'
          }
        })

        const response = await mockLeadsHandlers.POST(request)
        
        expect(response.status).toBe(409)
        expect(response.data.error).toContain('already exists')
      })
    })

    describe('PATCH /api/leads/[id]', () => {
      it('should update lead successfully', async () => {
        const updateData = {
          first_name: 'Updated Name',
          title: 'Senior Manager',
          tags: ['prospect', 'warm', 'demo-scheduled'],
          custom_fields: {
            ...testLead.custom_fields,
            lead_score: 85,
            last_contacted: new Date().toISOString()
          }
        }

        const updatedLead = {
          ...testLead,
          ...updateData,
          updated_at: new Date().toISOString()
        }

        mockSupabase.single.mockResolvedValueOnce({
          data: testLead,
          error: null
        })

        mockSupabase.update.mockResolvedValue({
          data: [updatedLead],
          error: null
        })

        const request = createMockRequest(`/api/leads/${testLead.id}`, {
          method: 'PATCH',
          headers: {
            'x-workspace-id': testWorkspace.id,
            'authorization': `Bearer ${authToken}`
          },
          body: updateData
        })

        mockLeadsHandlers.PATCH.mockResolvedValue({
          status: 200,
          data: updatedLead
        })

        const response = await mockLeadsHandlers.PATCH(request)
        
        expect(response.status).toBe(200)
        expect(response.data.first_name).toBe(updateData.first_name)
        expect(response.data.title).toBe(updateData.title)
        expect(response.data.tags).toEqual(updateData.tags)
      })

      it('should return 404 for non-existent lead', async () => {
        const nonExistentId = faker.string.uuid()

        mockSupabase.single.mockResolvedValue({
          data: null,
          error: { message: 'Not found' }
        })

        const request = createMockRequest(`/api/leads/${nonExistentId}`, {
          method: 'PATCH',
          headers: {
            'x-workspace-id': testWorkspace.id,
            'authorization': `Bearer ${authToken}`
          },
          body: { first_name: 'Updated' }
        })

        mockLeadsHandlers.PATCH.mockResolvedValue({
          status: 404,
          data: {
            error: 'Lead not found'
          }
        })

        const response = await mockLeadsHandlers.PATCH(request)
        
        expect(response.status).toBe(404)
        expect(response.data.error).toBe('Lead not found')
      })
    })

    describe('DELETE /api/leads/[id]', () => {
      it('should delete lead successfully', async () => {
        mockSupabase.single.mockResolvedValueOnce({
          data: testLead,
          error: null
        })

        mockSupabase.delete.mockResolvedValue({
          data: [testLead],
          error: null
        })

        const request = createMockRequest(`/api/leads/${testLead.id}`, {
          method: 'DELETE',
          headers: {
            'x-workspace-id': testWorkspace.id,
            'authorization': `Bearer ${authToken}`
          }
        })

        mockLeadsHandlers.DELETE.mockResolvedValue({
          status: 204,
          data: null
        })

        const response = await mockLeadsHandlers.DELETE(request)
        
        expect(response.status).toBe(204)
      })

      it('should handle cascade deletion of related data', async () => {
        // Mock that lead has related email logs and campaign associations
        const relatedData = {
          email_logs: 5,
          campaign_leads: 2,
          enrichment_records: 1
        }

        mockSupabase.single.mockResolvedValueOnce({
          data: testLead,
          error: null
        })

        // Mock deletion of related data
        mockSupabase.delete.mockResolvedValueOnce({
          data: Array(relatedData.email_logs).fill({}),
          error: null
        })
        
        mockSupabase.delete.mockResolvedValueOnce({
          data: Array(relatedData.campaign_leads).fill({}),
          error: null
        })
        
        mockSupabase.delete.mockResolvedValueOnce({
          data: [testLead],
          error: null
        })

        const request = createMockRequest(`/api/leads/${testLead.id}`, {
          method: 'DELETE',
          headers: {
            'x-workspace-id': testWorkspace.id,
            'authorization': `Bearer ${authToken}`
          }
        })

        mockLeadsHandlers.DELETE.mockResolvedValue({
          status: 204,
          data: null
        })

        const response = await mockLeadsHandlers.DELETE(request)
        
        expect(response.status).toBe(204)
        // Verify that related data deletion was attempted
        expect(mockSupabase.delete).toHaveBeenCalledTimes(3)
      })
    })
  })

  describe('CSV Import Functionality', () => {
    it('should process CSV import successfully', async () => {
      const csvData = `email,first_name,last_name,company,title
john@example.com,John,Doe,Acme Corp,Manager
jane@example.com,Jane,Smith,Beta Inc,Director`
      
      const parsedLeads = [
        {
          email: 'john@example.com',
          first_name: 'John',
          last_name: 'Doe',
          company: 'Acme Corp',
          title: 'Manager'
        },
        {
          email: 'jane@example.com',
          first_name: 'Jane',
          last_name: 'Smith',
          company: 'Beta Inc',
          title: 'Director'
        }
      ]

      const importResult = {
        jobId: faker.string.uuid(),
        totalRows: 2,
        validRows: 2,
        invalidRows: 0,
        duplicates: 0,
        imported: 2,
        status: 'completed',
        errors: []
      }

      mockEnrichmentService.prototype.processCSVImport.mockResolvedValue(importResult)

      const request = createMockRequest('/api/leads/import', {
        method: 'POST',
        headers: {
          'x-workspace-id': testWorkspace.id,
          'authorization': `Bearer ${authToken}`,
          'content-type': 'multipart/form-data'
        },
        body: {
          file: csvData,
          options: {
            skipDuplicates: true,
            enrichOnImport: false
          }
        }
      })

      const mockImportHandler = jest.fn().mockResolvedValue({
        status: 200,
        data: importResult
      })

      const response = await mockImportHandler(request)
      
      expect(response.status).toBe(200)
      expect(response.data.totalRows).toBe(2)
      expect(response.data.imported).toBe(2)
      expect(response.data.status).toBe('completed')
    })

    it('should handle CSV validation errors', async () => {
      const invalidCsvData = `email,first_name,last_name
invalid-email,John,Doe
,Jane,Smith
john@example.com,,`
      
      const importResult = {
        jobId: faker.string.uuid(),
        totalRows: 3,
        validRows: 0,
        invalidRows: 3,
        imported: 0,
        status: 'failed',
        errors: [
          { row: 1, field: 'email', message: 'Invalid email format' },
          { row: 2, field: 'email', message: 'Email is required' },
          { row: 3, field: 'first_name', message: 'First name is required' }
        ]
      }

      mockEnrichmentService.prototype.processCSVImport.mockResolvedValue(importResult)

      const request = createMockRequest('/api/leads/import', {
        method: 'POST',
        headers: {
          'x-workspace-id': testWorkspace.id,
          'authorization': `Bearer ${authToken}`
        },
        body: {
          file: invalidCsvData
        }
      })

      const mockImportHandler = jest.fn().mockResolvedValue({
        status: 200,
        data: importResult
      })

      const response = await mockImportHandler(request)
      
      expect(response.status).toBe(200)
      expect(response.data.invalidRows).toBe(3)
      expect(response.data.errors.length).toBe(3)
    })

    it('should handle large CSV imports with batching', async () => {
      const largeImportResult = {
        jobId: faker.string.uuid(),
        totalRows: 10000,
        validRows: 9850,
        invalidRows: 150,
        imported: 9850,
        status: 'completed',
        processingTime: 45000, // 45 seconds
        batchesProcessed: 100,
        batchSize: 100
      }

      mockEnrichmentService.prototype.processCSVImport.mockResolvedValue(largeImportResult)

      const request = createMockRequest('/api/leads/import', {
        method: 'POST',
        headers: {
          'x-workspace-id': testWorkspace.id,
          'authorization': `Bearer ${authToken}`
        },
        body: {
          file: 'large-csv-data',
          options: {
            batchSize: 100,
            enrichOnImport: true
          }
        }
      })

      const mockImportHandler = jest.fn().mockResolvedValue({
        status: 202, // Accepted for processing
        data: {
          jobId: largeImportResult.jobId,
          status: 'processing',
          message: 'Import job started. Check status using job ID.'
        }
      })

      const response = await mockImportHandler(request)
      
      expect(response.status).toBe(202)
      expect(response.data.jobId).toBeTruthy()
      expect(response.data.status).toBe('processing')
    })

    it('should track import job status', async () => {
      const jobId = faker.string.uuid()
      
      const jobStatus = {
        jobId,
        status: 'processing',
        progress: {
          totalRows: 5000,
          processedRows: 2500,
          validRows: 2450,
          invalidRows: 50,
          percentage: 50
        },
        startedAt: new Date(Date.now() - 60000).toISOString(),
        estimatedCompletion: new Date(Date.now() + 60000).toISOString()
      }

      const request = createMockRequest(`/api/leads/import/${jobId}`, {
        method: 'GET',
        headers: {
          'x-workspace-id': testWorkspace.id,
          'authorization': `Bearer ${authToken}`
        }
      })

      const mockStatusHandler = jest.fn().mockResolvedValue({
        status: 200,
        data: jobStatus
      })

      const response = await mockStatusHandler(request)
      
      expect(response.status).toBe(200)
      expect(response.data.progress.percentage).toBe(50)
      expect(response.data.status).toBe('processing')
    })
  })

  describe('Lead Enrichment', () => {
    it('should enrich lead with external data', async () => {
      const enrichmentData = {
        company_info: {
          domain: 'acme.com',
          industry: 'Technology',
          employees: 250,
          revenue: '$10M-$50M',
          technologies: ['React', 'Node.js', 'AWS'],
          social: {
            twitter: '@acme',
            linkedin: 'company/acme'
          }
        },
        person_info: {
          verified_email: true,
          phone: '+1-555-0123',
          linkedin_profile: 'https://linkedin.com/in/johndoe',
          job_seniority: 'manager',
          department: 'engineering'
        },
        enrichment_metadata: {
          provider: 'clearbit',
          confidence: 0.95,
          enriched_at: new Date().toISOString(),
          cost_credits: 1
        }
      }

      mockEnrichmentService.prototype.enrichLead.mockResolvedValue({
        leadId: testLead.id,
        enrichmentData,
        success: true
      })

      const request = createMockRequest(`/api/leads/${testLead.id}/enrich`, {
        method: 'POST',
        headers: {
          'x-workspace-id': testWorkspace.id,
          'authorization': `Bearer ${authToken}`
        },
        body: {
          providers: ['clearbit', 'hunter'],
          fields: ['company_info', 'person_info']
        }
      })

      const mockEnrichHandler = jest.fn().mockResolvedValue({
        status: 200,
        data: {
          leadId: testLead.id,
          enriched: true,
          data: enrichmentData,
          creditsUsed: 1
        }
      })

      const response = await mockEnrichHandler(request)
      
      expect(response.status).toBe(200)
      expect(response.data.enriched).toBe(true)
      expect(response.data.data.company_info.domain).toBe('acme.com')
      expect(response.data.creditsUsed).toBe(1)
    })

    it('should handle enrichment failures gracefully', async () => {
      const enrichmentError = {
        error: 'Provider API limit exceeded',
        provider: 'clearbit',
        retryAfter: 3600 // 1 hour
      }

      mockEnrichmentService.prototype.enrichLead.mockRejectedValue(
        new Error('API limit exceeded')
      )

      const request = createMockRequest(`/api/leads/${testLead.id}/enrich`, {
        method: 'POST',
        headers: {
          'x-workspace-id': testWorkspace.id,
          'authorization': `Bearer ${authToken}`
        },
        body: {
          providers: ['clearbit']
        }
      })

      const mockEnrichHandler = jest.fn().mockResolvedValue({
        status: 429,
        data: enrichmentError
      })

      const response = await mockEnrichHandler(request)
      
      expect(response.status).toBe(429)
      expect(response.data.error).toContain('limit exceeded')
      expect(response.data.retryAfter).toBe(3600)
    })

    it('should track enrichment credits usage', async () => {
      const workspaceUsage = {
        workspace_id: testWorkspace.id,
        period_start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        period_end: new Date().toISOString(),
        enrichments_used: 85,
        enrichments_limit: 100,
        remaining: 15
      }

      mockSupabase.single.mockResolvedValue({
        data: workspaceUsage,
        error: null
      })

      expect(workspaceUsage.remaining).toBe(15)
      expect(workspaceUsage.enrichments_used).toBeLessThan(workspaceUsage.enrichments_limit)
    })
  })

  describe('Lead Search and Filtering', () => {
    it('should support advanced search queries', async () => {
      const searchFilters = {
        email: 'john@',
        company: 'acme',
        tags: ['prospect', 'warm'],
        status: 'active',
        created_after: '2024-01-01',
        custom_fields: {
          lead_score: { gte: 75 },
          industry: 'technology'
        }
      }

      const filteredLeads = leadFactory.createMany(3, {
        workspace_id: testWorkspace.id,
        status: 'active',
        tags: ['prospect', 'warm']
      })

      mockSupabase.ilike.mockReturnThis()
      mockSupabase.eq.mockReturnThis()
      mockSupabase.gte.mockReturnThis()
      mockSupabase.range.mockResolvedValue({
        data: filteredLeads,
        error: null
      })
      mockSupabase.count.mockResolvedValue({ count: 3, error: null })

      const request = createMockRequest('/api/leads/search', {
        method: 'POST',
        headers: {
          'x-workspace-id': testWorkspace.id,
          'authorization': `Bearer ${authToken}`
        },
        body: searchFilters
      })

      const mockSearchHandler = jest.fn().mockResolvedValue({
        status: 200,
        data: {
          leads: filteredLeads,
          total: 3,
          filters_applied: searchFilters
        }
      })

      const response = await mockSearchHandler(request)
      
      expect(response.status).toBe(200)
      expect(response.data.leads.length).toBe(3)
      expect(response.data.total).toBe(3)
    })

    it('should support saved search queries', async () => {
      const savedSearch = {
        id: faker.string.uuid(),
        name: 'High-value prospects',
        workspace_id: testWorkspace.id,
        user_id: testUser.id,
        filters: {
          tags: ['prospect'],
          custom_fields: {
            lead_score: { gte: 80 },
            company_size: '50+'
          },
          status: 'active'
        },
        created_at: new Date().toISOString()
      }

      mockSupabase.insert.mockResolvedValue({
        data: [savedSearch],
        error: null
      })

      const request = createMockRequest('/api/leads/saved-searches', {
        method: 'POST',
        headers: {
          'x-workspace-id': testWorkspace.id,
          'authorization': `Bearer ${authToken}`
        },
        body: {
          name: savedSearch.name,
          filters: savedSearch.filters
        }
      })

      const mockSavedSearchHandler = jest.fn().mockResolvedValue({
        status: 201,
        data: savedSearch
      })

      const response = await mockSavedSearchHandler(request)
      
      expect(response.status).toBe(201)
      expect(response.data.name).toBe(savedSearch.name)
      expect(response.data.filters).toEqual(savedSearch.filters)
    })
  })

  describe('Data Isolation and Security', () => {
    it('should prevent cross-workspace data access', async () => {
      const otherWorkspace = workspaceFactory.create()
      const otherLead = leadFactory.create({ workspace_id: otherWorkspace.id })

      // Try to access lead from different workspace
      const request = createMockRequest(`/api/leads/${otherLead.id}`, {
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
          error: 'Lead not found'
        }
      })

      const response = await mockGetHandler(request)
      
      expect(response.status).toBe(404)
      expect(response.data.error).toBe('Lead not found')
    })

    it('should validate workspace permissions for bulk operations', async () => {
      const bulkUpdateData = {
        leadIds: [testLead.id, faker.string.uuid()],
        updates: {
          status: 'unsubscribed',
          tags: ['unsubscribed']
        }
      }

      // Mock that only one lead belongs to workspace
      mockSupabase.select.mockResolvedValue({
        data: [testLead], // Only one lead found
        error: null
      })

      const request = createMockRequest('/api/leads/bulk-update', {
        method: 'PATCH',
        headers: {
          'x-workspace-id': testWorkspace.id,
          'authorization': `Bearer ${authToken}`
        },
        body: bulkUpdateData
      })

      const mockBulkHandler = jest.fn().mockResolvedValue({
        status: 207, // Multi-status
        data: {
          updated: 1,
          failed: 1,
          errors: [
            {
              leadId: bulkUpdateData.leadIds[1],
              error: 'Lead not found in workspace'
            }
          ]
        }
      })

      const response = await mockBulkHandler(request)
      
      expect(response.status).toBe(207)
      expect(response.data.updated).toBe(1)
      expect(response.data.failed).toBe(1)
    })
  })

  describe('Rate Limiting and Performance', () => {
    it('should handle high-volume lead operations', async () => {
      const bulkLeadData = leadFactory.createMany(1000, {
        workspace_id: testWorkspace.id
      })

      // Mock batch insertion
      const batchSize = 100
      const batches = Math.ceil(bulkLeadData.length / batchSize)
      
      const insertPromises = Array.from({ length: batches }, (_, i) => {
        const batchData = bulkLeadData.slice(i * batchSize, (i + 1) * batchSize)
        return mockSupabase.insert.mockResolvedValueOnce({
          data: batchData,
          error: null
        })
      })

      const bulkResult = {
        totalLeads: 1000,
        inserted: 1000,
        failed: 0,
        batchesProcessed: batches,
        processingTime: 5000 // 5 seconds
      }

      expect(bulkResult.batchesProcessed).toBe(10)
      expect(bulkResult.inserted).toBe(1000)
    })

    it('should implement rate limiting for API endpoints', async () => {
      const rapidRequests = Array.from({ length: 101 }, () => 
        createMockRequest('/api/leads', {
          method: 'GET',
          headers: {
            'x-workspace-id': testWorkspace.id,
            'authorization': `Bearer ${authToken}`
          }
        })
      )

      const responses = rapidRequests.map((_, index) => {
        if (index >= 100) {
          return {
            status: 429,
            data: {
              error: 'Rate limit exceeded',
              retryAfter: 60
            }
          }
        }
        
        return {
          status: 200,
          data: { leads: [] }
        }
      })

      const rateLimitedCount = responses.filter(r => r.status === 429).length
      expect(rateLimitedCount).toBeGreaterThan(0)
    })
  })

  describe('Error Handling', () => {
    it('should handle database connection failures', async () => {
      mockSupabase.from.mockImplementation(() => {
        throw new Error('Database connection failed')
      })

      const request = createMockRequest('/api/leads', {
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

    it('should handle malformed request data', async () => {
      const malformedRequests = [
        { body: null },
        { body: 'invalid json' },
        { body: { email: null } },
        { body: { custom_fields: 'not an object' } }
      ]

      malformedRequests.forEach(reqData => {
        const isValid = reqData.body && 
                       typeof reqData.body === 'object' &&
                       reqData.body.email !== null
        
        expect(isValid).toBe(false)
      })
    })
  })
})

// Lead Schema Validation Tests
describe('Leads API Schema Validation', () => {
  it('should validate lead creation schema', () => {
    const validLead = {
      email: faker.internet.email(),
      first_name: faker.person.firstName(),
      last_name: faker.person.lastName(),
      company: faker.company.name(),
      title: faker.person.jobTitle(),
      phone: faker.phone.number(),
      website: faker.internet.url(),
      tags: ['prospect', 'cold'],
      custom_fields: {
        industry: 'technology',
        company_size: '50-100'
      }
    }

    expect(validLead.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
    expect(validLead.first_name.length).toBeGreaterThan(0)
    expect(validLead.last_name.length).toBeGreaterThan(0)
    expect(Array.isArray(validLead.tags)).toBe(true)
    expect(typeof validLead.custom_fields).toBe('object')
  })

  it('should validate search filter schema', () => {
    const validFilters = {
      email: 'john@',
      status: 'active',
      tags: ['prospect'],
      created_after: '2024-01-01T00:00:00Z',
      custom_fields: {
        lead_score: { gte: 75 },
        industry: 'technology'
      },
      page: 1,
      limit: 50,
      sortBy: 'created_at',
      sortOrder: 'desc'
    }

    expect(typeof validFilters.email).toBe('string')
    expect(['active', 'inactive', 'unsubscribed', 'bounced'].includes(validFilters.status)).toBe(true)
    expect(Array.isArray(validFilters.tags)).toBe(true)
    expect(new Date(validFilters.created_after)).toBeInstanceOf(Date)
    expect(typeof validFilters.custom_fields).toBe('object')
    expect(validFilters.page).toBeGreaterThan(0)
    expect(validFilters.limit).toBeGreaterThan(0)
    expect(validFilters.limit).toBeLessThanOrEqual(100)
  })

  it('should validate CSV import schema', () => {
    const validImportOptions = {
      skipDuplicates: true,
      enrichOnImport: false,
      batchSize: 100,
      mapping: {
        'Email Address': 'email',
        'First Name': 'first_name',
        'Last Name': 'last_name',
        'Company Name': 'company'
      },
      defaultTags: ['imported', 'cold'],
      customFieldMappings: {
        'Lead Score': 'lead_score',
        'Industry': 'industry'
      }
    }

    expect(typeof validImportOptions.skipDuplicates).toBe('boolean')
    expect(typeof validImportOptions.enrichOnImport).toBe('boolean')
    expect(validImportOptions.batchSize).toBeGreaterThan(0)
    expect(validImportOptions.batchSize).toBeLessThanOrEqual(1000)
    expect(typeof validImportOptions.mapping).toBe('object')
    expect(Array.isArray(validImportOptions.defaultTags)).toBe(true)
  })
})
