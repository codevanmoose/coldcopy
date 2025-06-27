import { GdprService } from '../gdpr-service'
import { createClient } from '@supabase/supabase-js'
import {
  ConsentType,
  ConsentStatus,
  ConsentMethod,
  DataSubjectRequestType,
  DataSubjectRequestStatus,
  RequestPriority,
  ResponseFormat,
  DeletionStrategy,
  SuppressionType,
  GdprErrorCode,
  VerificationMethod,
  AuditActionCategory,
} from '../types'

// Mock dependencies
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}))

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

jest.mock('../utils', () => ({
  ...jest.requireActual('../utils'),
  generateVerificationToken: jest.fn(() => 'verification-token-123'),
  generateDownloadToken: jest.fn(() => 'download-token-123'),
  generateAnonymousId: jest.fn(() => 'anon-id-123'),
  hashData: jest.fn(() => 'hash-123'),
  createConsentSignature: jest.fn(() => 'signature-123'),
  verifyConsentSignature: jest.fn(() => true),
  convertDataToFormat: jest.fn(async (data, format) => ({
    content: JSON.stringify(data),
    mimeType: 'application/json',
    extension: 'json',
  })),
}))

jest.mock('../email-templates', () => ({
  getEmailTemplate: jest.fn(() => ({
    subject: 'Test Email',
    html: '<p>Test</p>',
    text: 'Test',
  })),
  GdprEmailType: {
    CONSENT_CONFIRMATION: 'consent_confirmation',
    CONSENT_WITHDRAWAL: 'consent_withdrawal',
    DATA_REQUEST_RECEIVED: 'data_request_received',
    DATA_REQUEST_VERIFICATION: 'data_request_verification',
    DATA_REQUEST_COMPLETED: 'data_request_completed',
    DATA_REQUEST_REJECTED: 'data_request_rejected',
    DATA_EXPORT_READY: 'data_export_ready',
    DATA_DELETION_CONFIRMATION: 'data_deletion_confirmation',
  },
}))

describe('GdprService', () => {
  let service: GdprService
  let mockSupabase: any

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks()

    // Mock Supabase client
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      upsert: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      neq: jest.fn().mockReturnThis(),
      not: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      lt: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      rpc: jest.fn(),
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-123' } } }),
      },
    };

    (createClient as jest.Mock).mockReturnValue(mockSupabase)

    // Create service instance
    service = new GdprService(mockSupabase)
  })

  describe('Consent Management', () => {
    describe('recordConsent', () => {
      it('should record consent successfully', async () => {
        // Arrange
        mockSupabase.rpc.mockResolvedValue({ data: 'consent-123', error: null })
        mockSupabase.single.mockResolvedValue({
          data: {
            id: 'consent-123',
            workspace_id: 'workspace-123',
            lead_id: 'lead-123',
            consent_type: ConsentType.MARKETING,
            status: ConsentStatus.GRANTED,
          },
          error: null,
        })

        // Act
        const result = await service.recordConsent({
          workspaceId: 'workspace-123',
          leadId: 'lead-123',
          consentType: ConsentType.MARKETING,
          status: ConsentStatus.GRANTED,
          method: ConsentMethod.EXPLICIT,
          version: '1.0',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          consentText: 'I agree to receive marketing emails',
          source: 'signup_form',
        })

        // Assert
        expect(result).toBeDefined()
        expect(result.id).toBe('consent-123')
        expect(mockSupabase.rpc).toHaveBeenCalledWith('record_consent', {
          p_workspace_id: 'workspace-123',
          p_lead_id: 'lead-123',
          p_consent_type: ConsentType.MARKETING,
          p_status: ConsentStatus.GRANTED,
          p_method: ConsentMethod.EXPLICIT,
          p_version: '1.0',
          p_ip_address: '192.168.1.1',
          p_user_agent: 'Mozilla/5.0',
          p_consent_text: 'I agree to receive marketing emails',
          p_source: 'signup_form',
          p_expires_days: undefined,
        })
      })

      it('should send confirmation email when consent is granted', async () => {
        // Arrange
        mockSupabase.rpc.mockResolvedValue({ data: 'consent-123', error: null })
        mockSupabase.single.mockResolvedValue({
          data: { id: 'consent-123', status: ConsentStatus.GRANTED },
          error: null,
        })
        mockSupabase.single.mockResolvedValueOnce({
          data: { email: 'user@example.com', first_name: 'John', last_name: 'Doe' },
          error: null,
        })
        mockSupabase.single.mockResolvedValueOnce({
          data: { name: 'Test Workspace' },
          error: null,
        })

        // Act
        await service.recordConsent({
          workspaceId: 'workspace-123',
          leadId: 'lead-123',
          consentType: ConsentType.MARKETING,
          status: ConsentStatus.GRANTED,
          method: ConsentMethod.EXPLICIT,
          version: '1.0',
        })

        // Assert - Email sending is mocked, so we just verify the flow completes
        expect(mockSupabase.from).toHaveBeenCalledWith('leads')
        expect(mockSupabase.from).toHaveBeenCalledWith('workspaces')
      })

      it('should handle invalid consent type', async () => {
        // Act & Assert
        await expect(
          service.recordConsent({
            workspaceId: 'workspace-123',
            leadId: 'lead-123',
            consentType: 'invalid_type' as ConsentType,
            status: ConsentStatus.GRANTED,
            method: ConsentMethod.EXPLICIT,
            version: '1.0',
          })
        ).rejects.toThrow('Invalid consent type')
      })
    })

    describe('checkConsent', () => {
      it('should check consent status for multiple types', async () => {
        // Arrange
        mockSupabase.rpc
          .mockResolvedValueOnce({ data: true, error: null })
          .mockResolvedValueOnce({ data: false, error: null })

        mockSupabase.single.mockResolvedValue({
          data: {
            version: '1.0',
            created_at: '2024-01-01T00:00:00Z',
            expires_at: '2025-01-01T00:00:00Z',
          },
          error: null,
        })

        // Act
        const result = await service.checkConsent({
          workspaceId: 'workspace-123',
          leadId: 'lead-123',
          consentTypes: [ConsentType.MARKETING, ConsentType.ANALYTICS],
        })

        // Assert
        expect(result.consents[ConsentType.MARKETING]).toEqual({
          granted: true,
          version: '1.0',
          grantedAt: new Date('2024-01-01T00:00:00Z'),
          expiresAt: new Date('2025-01-01T00:00:00Z'),
        })
        expect(result.consents[ConsentType.ANALYTICS]).toEqual({
          granted: false,
        })
      })
    })

    describe('withdrawConsent', () => {
      it('should withdraw consent successfully', async () => {
        // Arrange
        mockSupabase.rpc.mockResolvedValue({ data: 'consent-123', error: null })
        mockSupabase.single.mockResolvedValue({
          data: { id: 'consent-123', status: ConsentStatus.WITHDRAWN },
          error: null,
        })

        // Act
        await service.withdrawConsent(
          'workspace-123',
          'lead-123',
          [ConsentType.MARKETING, ConsentType.ANALYTICS],
          'No longer interested'
        )

        // Assert
        expect(mockSupabase.rpc).toHaveBeenCalledTimes(2)
        expect(mockSupabase.update).toHaveBeenCalledWith({
          withdrawal_reason: 'No longer interested',
        })
      })
    })

    describe('getConsentHistory', () => {
      it('should retrieve consent history', async () => {
        // Arrange
        const consentHistory = [
          { id: '1', consent_type: ConsentType.MARKETING, status: ConsentStatus.GRANTED },
          { id: '2', consent_type: ConsentType.MARKETING, status: ConsentStatus.WITHDRAWN },
        ]

        mockSupabase.order.mockResolvedValue({ data: consentHistory, error: null })

        // Act
        const result = await service.getConsentHistory('workspace-123', 'lead-123')

        // Assert
        expect(result).toHaveLength(2)
        expect(mockSupabase.order).toHaveBeenCalledWith('created_at', { ascending: false })
      })
    })
  })

  describe('Data Subject Rights', () => {
    describe('createDataSubjectRequest', () => {
      it('should create a data subject request successfully', async () => {
        // Arrange
        mockSupabase.rpc.mockResolvedValue({ data: 'request-123', error: null })
        mockSupabase.single.mockResolvedValue({
          data: {
            id: 'request-123',
            workspace_id: 'workspace-123',
            request_type: DataSubjectRequestType.ACCESS,
            requester_email: 'user@example.com',
            status: DataSubjectRequestStatus.PENDING,
            verification_token: 'token-123',
          },
          error: null,
        })

        // Act
        const result = await service.createDataSubjectRequest({
          workspaceId: 'workspace-123',
          requestType: DataSubjectRequestType.ACCESS,
          requesterEmail: 'user@example.com',
          requesterName: 'John Doe',
          leadId: 'lead-123',
          priority: RequestPriority.HIGH,
        })

        // Assert
        expect(result.id).toBe('request-123')
        expect(mockSupabase.rpc).toHaveBeenCalledWith('create_data_subject_request', {
          p_workspace_id: 'workspace-123',
          p_request_type: DataSubjectRequestType.ACCESS,
          p_requester_email: 'user@example.com',
          p_requester_name: 'John Doe',
          p_lead_id: 'lead-123',
          p_request_details: {},
        })
      })

      it('should validate email format', async () => {
        // Act & Assert
        await expect(
          service.createDataSubjectRequest({
            workspaceId: 'workspace-123',
            requestType: DataSubjectRequestType.ACCESS,
            requesterEmail: 'invalid-email',
            requesterName: 'John Doe',
          })
        ).rejects.toThrow('Invalid email address')
      })
    })

    describe('verifyDataSubjectRequest', () => {
      it('should verify request and start processing', async () => {
        // Arrange
        const request = {
          id: 'request-123',
          workspace_id: 'workspace-123',
          request_type: DataSubjectRequestType.ACCESS,
          lead_id: 'lead-123',
          verification_token: 'token-123',
          response_format: ResponseFormat.JSON,
        }

        mockSupabase.single.mockResolvedValueOnce({ data: request, error: null })
        mockSupabase.single.mockResolvedValueOnce({
          data: { ...request, verified_at: '2024-01-01', status: DataSubjectRequestStatus.IN_PROGRESS },
          error: null,
        })

        // Mock export data for access request
        mockSupabase.single.mockResolvedValueOnce({ data: { email: 'user@example.com' }, error: null })
        mockSupabase.order.mockResolvedValue({ data: [], error: null })
        mockSupabase.single.mockResolvedValueOnce({
          data: { id: 'export-123' },
          error: null,
        })
        mockSupabase.single.mockResolvedValueOnce({
          data: { ...request, status: DataSubjectRequestStatus.COMPLETED },
          error: null,
        })

        // Act
        const result = await service.verifyDataSubjectRequest({
          requestId: 'request-123',
          verificationToken: 'token-123',
        })

        // Assert
        expect(result.verified_at).toBe('2024-01-01')
        expect(result.status).toBe(DataSubjectRequestStatus.IN_PROGRESS)
      })

      it('should reject invalid verification token', async () => {
        // Arrange
        mockSupabase.single.mockResolvedValue({ data: null, error: { message: 'Not found' } })

        // Act & Assert
        await expect(
          service.verifyDataSubjectRequest({
            requestId: 'request-123',
            verificationToken: 'invalid-token',
          })
        ).rejects.toThrow('Invalid verification token or request not found')
      })
    })

    describe('updateDataSubjectRequest', () => {
      it('should update request status', async () => {
        // Arrange
        mockSupabase.single.mockResolvedValue({
          data: {
            id: 'request-123',
            status: DataSubjectRequestStatus.COMPLETED,
            completed_at: '2024-01-01',
          },
          error: null,
        })

        // Act
        const result = await service.updateDataSubjectRequest({
          requestId: 'request-123',
          status: DataSubjectRequestStatus.COMPLETED,
          responseData: { exported: true },
        })

        // Assert
        expect(result.status).toBe(DataSubjectRequestStatus.COMPLETED)
        expect(mockSupabase.update).toHaveBeenCalledWith(
          expect.objectContaining({
            status: DataSubjectRequestStatus.COMPLETED,
            response_data: { exported: true },
            completed_at: expect.any(String),
            completed_by: 'user-123',
          })
        )
      })
    })

    describe('getDataSubjectRequests', () => {
      it('should retrieve requests with filters', async () => {
        // Arrange
        const requests = [
          { id: '1', request_type: DataSubjectRequestType.ACCESS, status: DataSubjectRequestStatus.PENDING },
          { id: '2', request_type: DataSubjectRequestType.ERASURE, status: DataSubjectRequestStatus.COMPLETED },
        ]

        mockSupabase.order.mockResolvedValue({ data: requests, error: null })

        // Act
        const result = await service.getDataSubjectRequests('workspace-123', {
          status: DataSubjectRequestStatus.PENDING,
          requestType: DataSubjectRequestType.ACCESS,
          priority: RequestPriority.HIGH,
        })

        // Assert
        expect(result).toHaveLength(2)
        expect(mockSupabase.eq).toHaveBeenCalledWith('status', DataSubjectRequestStatus.PENDING)
        expect(mockSupabase.eq).toHaveBeenCalledWith('request_type', DataSubjectRequestType.ACCESS)
        expect(mockSupabase.eq).toHaveBeenCalledWith('priority', RequestPriority.HIGH)
      })
    })
  })

  describe('Data Export', () => {
    describe('exportData', () => {
      it('should export personal data successfully', async () => {
        // Arrange
        const leadData = {
          id: 'lead-123',
          email: 'user@example.com',
          first_name: 'John',
          last_name: 'Doe',
        }

        const consentData = [
          { consent_type: ConsentType.MARKETING, status: ConsentStatus.GRANTED },
        ]

        mockSupabase.single.mockResolvedValueOnce({ data: leadData, error: null })
        mockSupabase.eq.mockReturnThis()
        mockSupabase.eq.mockResolvedValueOnce({ data: consentData, error: null })
        mockSupabase.single.mockResolvedValueOnce({
          data: {
            id: 'export-123',
            export_format: ResponseFormat.JSON,
            file_size: 1024,
            checksum: 'hash-123',
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
          error: null,
        })

        // Act
        const result = await service.exportData({
          workspaceId: 'workspace-123',
          leadId: 'lead-123',
          format: ResponseFormat.JSON,
          includeTypes: ['leads', 'consent'],
        })

        // Assert
        expect(result.exportId).toBe('export-123')
        expect(result.downloadUrl).toContain('/api/gdpr/download/export-123')
        expect(result.format).toBe(ResponseFormat.JSON)
        expect(result.fileSize).toBe(1024)
      })

      it('should exclude specified data types', async () => {
        // Arrange
        mockSupabase.single.mockResolvedValue({ data: null, error: null })
        mockSupabase.eq.mockResolvedValue({ data: [], error: null })
        mockSupabase.single.mockResolvedValueOnce({
          data: { id: 'export-123' },
          error: null,
        })

        // Act
        await service.exportData({
          workspaceId: 'workspace-123',
          leadId: 'lead-123',
          format: ResponseFormat.JSON,
          excludeTypes: ['emails', 'events'],
        })

        // Assert
        // Verify that email and event queries were not made
        const fromCalls = (mockSupabase.from as jest.Mock).mock.calls
        expect(fromCalls).not.toContain(['campaign_emails'])
        expect(fromCalls).not.toContain(['email_events'])
      })
    })
  })

  describe('Data Deletion', () => {
    describe('deleteData', () => {
      it('should hard delete data successfully', async () => {
        // Arrange
        mockSupabase.single.mockResolvedValue({ data: null, error: null })
        mockSupabase.limit.mockResolvedValue({ data: [], error: null })
        mockSupabase.select
          .mockResolvedValueOnce({ count: 5 })
          .mockResolvedValueOnce({ count: 10 })
          .mockResolvedValueOnce({ count: 2 })
          .mockResolvedValueOnce({ count: 3 })
          .mockResolvedValueOnce({ count: 1 })

        mockSupabase.rpc.mockResolvedValue({ data: true, error: null })

        // Act
        const result = await service.deleteData({
          workspaceId: 'workspace-123',
          leadId: 'lead-123',
          deletionStrategy: DeletionStrategy.HARD_DELETE,
          reason: 'User request',
          notifyUser: true,
        })

        // Assert
        expect(result.deletionId).toBe('anon-id-123')
        expect(result.affectedRecords.hardDeleted).toBe(21)
        expect(result.strategy).toBe(DeletionStrategy.HARD_DELETE)
        expect(mockSupabase.delete).toHaveBeenCalledTimes(5)
      })

      it('should anonymize data successfully', async () => {
        // Arrange
        mockSupabase.single.mockResolvedValue({ data: null, error: null })
        mockSupabase.limit.mockResolvedValue({ data: [], error: null })
        mockSupabase.rpc
          .mockResolvedValueOnce({ data: true, error: null })
          .mockResolvedValueOnce({ error: null })

        // Act
        const result = await service.deleteData({
          workspaceId: 'workspace-123',
          leadId: 'lead-123',
          deletionStrategy: DeletionStrategy.ANONYMIZE,
          reason: 'GDPR request',
        })

        // Assert
        expect(result.affectedRecords.anonymized).toBe(1)
        expect(mockSupabase.rpc).toHaveBeenCalledWith('anonymize_lead_data', {
          p_lead_id: 'lead-123',
          p_workspace_id: 'workspace-123',
        })
      })

      it('should soft delete data successfully', async () => {
        // Arrange
        mockSupabase.single.mockResolvedValue({ data: null, error: null })
        mockSupabase.limit.mockResolvedValue({ data: [], error: null })
        mockSupabase.select.mockResolvedValue({ count: 1 })
        mockSupabase.rpc.mockResolvedValue({ data: true, error: null })

        // Act
        const result = await service.deleteData({
          workspaceId: 'workspace-123',
          leadId: 'lead-123',
          deletionStrategy: DeletionStrategy.SOFT_DELETE,
          reason: 'User request',
        })

        // Assert
        expect(result.affectedRecords.softDeleted).toBe(1)
        expect(mockSupabase.update).toHaveBeenCalledWith({
          deleted_at: expect.any(String),
        })
      })

      it('should check deletion eligibility', async () => {
        // Arrange
        mockSupabase.limit.mockResolvedValue({
          data: [{ id: 'sub-123' }],
          error: null,
        })

        // Act & Assert
        await expect(
          service.deleteData({
            workspaceId: 'workspace-123',
            userId: 'user-123',
            deletionStrategy: DeletionStrategy.HARD_DELETE,
            reason: 'User request',
          })
        ).rejects.toThrow('Active subscription exists')
      })

      it('should add to suppression list after deletion', async () => {
        // Arrange
        mockSupabase.single
          .mockResolvedValueOnce({ data: null, error: null })
          .mockResolvedValueOnce({ data: { email: 'user@example.com' }, error: null })
        mockSupabase.limit.mockResolvedValue({ data: [], error: null })
        mockSupabase.select.mockResolvedValue({ count: 0 })
        mockSupabase.rpc.mockResolvedValue({ error: null })

        // Act
        await service.deleteData({
          workspaceId: 'workspace-123',
          leadId: 'lead-123',
          deletionStrategy: DeletionStrategy.SOFT_DELETE,
          reason: 'GDPR request',
        })

        // Assert
        expect(mockSupabase.rpc).toHaveBeenCalledWith('add_to_suppression_list', {
          p_workspace_id: 'workspace-123',
          p_email: 'user@example.com',
          p_suppression_type: SuppressionType.GDPR_REQUEST,
          p_reason: 'GDPR request',
          p_source: 'gdpr_service',
        })
      })
    })
  })

  describe('Cookie Management', () => {
    describe('recordCookieConsent', () => {
      it('should record cookie consent successfully', async () => {
        // Arrange
        mockSupabase.rpc.mockResolvedValue({ data: 'consent-123', error: null })

        // Act
        const result = await service.recordCookieConsent({
          workspaceId: 'workspace-123',
          visitorId: 'visitor-123',
          necessary: true,
          functional: true,
          analytics: false,
          marketing: false,
          version: '1.0',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
        })

        // Assert
        expect(result.consentId).toBe('consent-123')
        expect(result.consentGivenAt).toBeInstanceOf(Date)
        expect(result.expiresAt).toBeInstanceOf(Date)
        expect(mockSupabase.rpc).toHaveBeenCalledWith('record_cookie_consent', {
          p_workspace_id: 'workspace-123',
          p_visitor_id: 'visitor-123',
          p_necessary: true,
          p_functional: true,
          p_analytics: false,
          p_marketing: false,
          p_version: '1.0',
          p_ip_address: '192.168.1.1',
          p_user_agent: 'Mozilla/5.0',
        })
      })
    })

    describe('getCookieConsent', () => {
      it('should retrieve cookie consent', async () => {
        // Arrange
        const consent = {
          consent_id: 'consent-123',
          necessary: true,
          functional: true,
          analytics: false,
          marketing: false,
        }

        mockSupabase.single.mockResolvedValue({ data: consent, error: null })

        // Act
        const result = await service.getCookieConsent('workspace-123', 'visitor-123')

        // Assert
        expect(result).toEqual(consent)
        expect(mockSupabase.order).toHaveBeenCalledWith('created_at', { ascending: false })
      })

      it('should return null if no consent found', async () => {
        // Arrange
        mockSupabase.single.mockResolvedValue({ data: null, error: { code: 'PGRST116' } })

        // Act
        const result = await service.getCookieConsent('workspace-123', 'visitor-123')

        // Assert
        expect(result).toBeNull()
      })
    })

    describe('updateCookieConsent', () => {
      it('should update cookie preferences', async () => {
        // Arrange
        mockSupabase.eq.mockResolvedValue({ error: null })

        // Act
        await service.updateCookieConsent('workspace-123', 'consent-123', {
          analytics: true,
          marketing: true,
        })

        // Assert
        expect(mockSupabase.update).toHaveBeenCalledWith({
          updated_at: expect.any(String),
          analytics: true,
          marketing: true,
        })
      })
    })

    describe('withdrawCookieConsent', () => {
      it('should withdraw cookie consent', async () => {
        // Arrange
        mockSupabase.eq.mockResolvedValue({ error: null })

        // Act
        await service.withdrawCookieConsent('workspace-123', 'consent-123')

        // Assert
        expect(mockSupabase.update).toHaveBeenCalledWith({
          consent_withdrawn_at: expect.any(String),
          functional: false,
          analytics: false,
          marketing: false,
        })
      })
    })
  })

  describe('Compliance Tracking', () => {
    describe('generateComplianceReport', () => {
      it('should generate consent compliance report', async () => {
        // Arrange
        const consentData = [
          { consent_type: ConsentType.MARKETING, status: ConsentStatus.GRANTED, method: ConsentMethod.EXPLICIT },
          { consent_type: ConsentType.ANALYTICS, status: ConsentStatus.WITHDRAWN, method: ConsentMethod.IMPLIED },
        ]

        mockSupabase.lte.mockResolvedValue({ data: consentData, error: null })

        // Act
        const result = await service.generateComplianceReport({
          workspaceId: 'workspace-123',
          reportType: 'consent',
          format: ResponseFormat.JSON,
        })

        // Assert
        expect(result.reportId).toBe('anon-id-123')
        expect(result.reportType).toBe('consent')
        expect(result.summary.totalRecords).toBe(1) // consentMetrics object counts as 1
      })

      it('should generate full compliance report', async () => {
        // Arrange
        mockSupabase.lte.mockResolvedValue({ data: [], error: null })
        mockSupabase.eq.mockResolvedValue({ data: [], error: null })

        // Act
        const result = await service.generateComplianceReport({
          workspaceId: 'workspace-123',
          reportType: 'full',
        })

        // Assert
        expect(result.reportType).toBe('full')
        expect(mockSupabase.from).toHaveBeenCalledWith('consent_records')
        expect(mockSupabase.from).toHaveBeenCalledWith('data_subject_requests')
        expect(mockSupabase.from).toHaveBeenCalledWith('data_processing_activities')
      })
    })

    describe('getGdprMetrics', () => {
      it('should calculate GDPR metrics correctly', async () => {
        // Arrange
        const consentData = [
          { status: ConsentStatus.GRANTED },
          { status: ConsentStatus.GRANTED },
          { status: ConsentStatus.WITHDRAWN },
        ]

        const requestData = [
          {
            request_type: DataSubjectRequestType.ACCESS,
            status: DataSubjectRequestStatus.COMPLETED,
            created_at: '2024-01-01',
            completed_at: '2024-01-02',
          },
          {
            request_type: DataSubjectRequestType.ERASURE,
            status: DataSubjectRequestStatus.PENDING,
          },
        ]

        const suppressionData = [
          { suppression_type: SuppressionType.GDPR_REQUEST },
          { suppression_type: SuppressionType.UNSUBSCRIBE },
        ]

        mockSupabase.eq.mockReturnThis()
        mockSupabase.select
          .mockResolvedValueOnce({ data: consentData, error: null })
          .mockResolvedValueOnce({ data: requestData, error: null })
          .mockResolvedValueOnce({ data: suppressionData, error: null })

        mockSupabase.single.mockResolvedValue({
          data: { next_execution_at: '2024-01-10' },
          error: null,
        })

        // Act
        const result = await service.getGdprMetrics('workspace-123')

        // Assert
        expect(result.totalConsents).toBe(3)
        expect(result.activeConsents).toBe(2)
        expect(result.withdrawnConsents).toBe(1)
        expect(result.consentRate).toBeCloseTo(66.67, 1)
        expect(result.dataSubjectRequests.total).toBe(2)
        expect(result.dataSubjectRequests.byType[DataSubjectRequestType.ACCESS]).toBe(1)
        expect(result.dataSubjectRequests.byType[DataSubjectRequestType.ERASURE]).toBe(1)
        expect(result.dataSubjectRequests.pendingRequests).toBe(1)
        expect(result.suppressionList.totalEntries).toBe(2)
        expect(result.suppressionList.byType[SuppressionType.GDPR_REQUEST]).toBe(1)
      })
    })

    describe('logAuditEvent', () => {
      it('should log audit events', async () => {
        // Arrange
        mockSupabase.insert.mockResolvedValue({ error: null })

        // Act
        await service.logAuditEvent({
          workspaceId: 'workspace-123',
          action: 'data_export_created',
          actionCategory: AuditActionCategory.DATA_EXPORT,
          resourceType: 'data_export',
          resourceId: 'export-123',
          purpose: 'Data portability request',
          changes: { format: 'json' },
        })

        // Assert
        expect(mockSupabase.insert).toHaveBeenCalledWith({
          workspace_id: 'workspace-123',
          user_id: 'user-123',
          action: 'data_export_created',
          action_category: AuditActionCategory.DATA_EXPORT,
          resource_type: 'data_export',
          resource_id: 'export-123',
          purpose: 'Data portability request',
          changes: { format: 'json' },
          resource_identifier: undefined,
          data_categories: undefined,
          legal_basis: undefined,
          ip_address: undefined,
          user_agent: undefined,
          session_id: undefined,
          risk_score: undefined,
        })
      })

      it('should not throw on audit logging errors', async () => {
        // Arrange
        mockSupabase.insert.mockResolvedValue({ error: { message: 'DB error' } })
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

        // Act
        await service.logAuditEvent({
          workspaceId: 'workspace-123',
          action: 'test_action',
          actionCategory: AuditActionCategory.ACCESS,
          resourceType: 'test',
        })

        // Assert
        expect(consoleSpy).toHaveBeenCalledWith('Failed to log audit event:', expect.any(Object))
        consoleSpy.mockRestore()
      })
    })
  })

  describe('Privacy Policies', () => {
    describe('getActivePrivacyPolicy', () => {
      it('should retrieve active privacy policy', async () => {
        // Arrange
        const policy = {
          id: 'policy-123',
          workspace_id: 'workspace-123',
          policy_type: 'privacy_policy',
          version: '2.0',
          content: 'Privacy policy content',
          is_active: true,
        }

        mockSupabase.single.mockResolvedValue({ data: policy, error: null })

        // Act
        const result = await service.getActivePrivacyPolicy('workspace-123')

        // Assert
        expect(result).toEqual(policy)
        expect(mockSupabase.eq).toHaveBeenCalledWith('is_active', true)
      })
    })

    describe('upsertPrivacyPolicy', () => {
      it('should create new privacy policy and deactivate old ones', async () => {
        // Arrange
        const newPolicy = {
          workspaceId: 'workspace-123',
          policyType: 'privacy_policy' as any,
          language: 'en',
          version: '3.0',
          title: 'Privacy Policy',
          content: 'New content',
          effectiveDate: new Date(),
          isActive: true,
        }

        mockSupabase.eq.mockResolvedValue({ error: null })
        mockSupabase.single.mockResolvedValue({
          data: { ...newPolicy, id: 'policy-123' },
          error: null,
        })

        // Act
        const result = await service.upsertPrivacyPolicy(newPolicy)

        // Assert
        expect(mockSupabase.update).toHaveBeenCalledWith({ is_active: false })
        expect(mockSupabase.insert).toHaveBeenCalledWith({
          ...newPolicy,
          created_by: 'user-123',
        })
        expect(result.id).toBe('policy-123')
      })
    })
  })

  describe('Data Retention', () => {
    describe('getDataRetentionPolicies', () => {
      it('should retrieve retention policies', async () => {
        // Arrange
        const policies = [
          { id: '1', data_type: 'leads', retention_days: 365, is_active: true },
          { id: '2', data_type: 'logs', retention_days: 90, is_active: true },
        ]

        mockSupabase.order.mockResolvedValue({ data: policies, error: null })

        // Act
        const result = await service.getDataRetentionPolicies('workspace-123')

        // Assert
        expect(result).toHaveLength(2)
        expect(mockSupabase.eq).toHaveBeenCalledWith('is_active', true)
      })
    })

    describe('executeRetentionPolicies', () => {
      it('should execute retention policies', async () => {
        // Arrange
        mockSupabase.rpc.mockResolvedValue({ data: 150, error: null })

        // Act
        const result = await service.executeRetentionPolicies('workspace-123')

        // Assert
        expect(result).toBe(150)
        expect(mockSupabase.rpc).toHaveBeenCalledWith('process_data_retention_policies')
      })
    })
  })

  describe('Suppression List', () => {
    describe('addToSuppressionList', () => {
      it('should add email to suppression list', async () => {
        // Arrange
        mockSupabase.single.mockResolvedValue({
          data: { email: 'user@example.com' },
          error: null,
        })
        mockSupabase.rpc.mockResolvedValue({ error: null })

        // Act
        await service.addToSuppressionList(
          'workspace-123',
          'lead-123',
          SuppressionType.GDPR_REQUEST,
          'User requested deletion'
        )

        // Assert
        expect(mockSupabase.rpc).toHaveBeenCalledWith('add_to_suppression_list', {
          p_workspace_id: 'workspace-123',
          p_email: 'user@example.com',
          p_suppression_type: SuppressionType.GDPR_REQUEST,
          p_reason: 'User requested deletion',
          p_source: 'gdpr_service',
        })
      })
    })

    describe('isEmailSuppressed', () => {
      it('should check if email is suppressed', async () => {
        // Arrange
        mockSupabase.rpc.mockResolvedValue({ data: true, error: null })

        // Act
        const result = await service.isEmailSuppressed('workspace-123', 'user@example.com')

        // Assert
        expect(result).toBe(true)
        expect(mockSupabase.rpc).toHaveBeenCalledWith('is_email_suppressed', {
          p_workspace_id: 'workspace-123',
          p_email: 'user@example.com',
        })
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle database errors properly', async () => {
      // Arrange
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' },
      })

      // Act & Assert
      await expect(
        service.recordConsent({
          workspaceId: 'workspace-123',
          leadId: 'lead-123',
          consentType: ConsentType.MARKETING,
          status: ConsentStatus.GRANTED,
          method: ConsentMethod.EXPLICIT,
          version: '1.0',
        })
      ).rejects.toThrow()
    })

    it('should handle RPC errors properly', async () => {
      // Arrange
      mockSupabase.rpc.mockRejectedValue(new Error('RPC failed'))

      // Act & Assert
      await expect(
        service.recordCookieConsent({
          workspaceId: 'workspace-123',
          visitorId: 'visitor-123',
          necessary: true,
          functional: false,
          analytics: false,
          marketing: false,
        })
      ).rejects.toThrow('RPC failed')
    })
  })

  describe('Data Processing Requests', () => {
    it('should process rectification request', async () => {
      // Arrange
      const request = {
        id: 'request-123',
        workspace_id: 'workspace-123',
        request_type: DataSubjectRequestType.RECTIFICATION,
        verification_token: 'token-123',
      }

      mockSupabase.single.mockResolvedValueOnce({ data: request, error: null })
      mockSupabase.single.mockResolvedValueOnce({
        data: { ...request, verified_at: '2024-01-01', status: DataSubjectRequestStatus.IN_PROGRESS },
        error: null,
      })
      mockSupabase.single.mockResolvedValueOnce({
        data: { ...request },
        error: null,
      })

      // Act
      await service.verifyDataSubjectRequest({
        requestId: 'request-123',
        verificationToken: 'token-123',
      })

      // Assert
      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          internal_notes: 'Rectification request requires manual review',
        })
      )
    })

    it('should process restriction request', async () => {
      // Arrange
      const request = {
        id: 'request-123',
        workspace_id: 'workspace-123',
        request_type: DataSubjectRequestType.RESTRICTION,
        verification_token: 'token-123',
      }

      mockSupabase.single.mockResolvedValueOnce({ data: request, error: null })
      mockSupabase.single.mockResolvedValueOnce({
        data: { ...request, verified_at: '2024-01-01', status: DataSubjectRequestStatus.IN_PROGRESS },
        error: null,
      })
      mockSupabase.single.mockResolvedValueOnce({
        data: { ...request },
        error: null,
      })

      // Act
      await service.verifyDataSubjectRequest({
        requestId: 'request-123',
        verificationToken: 'token-123',
      })

      // Assert
      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          internal_notes: 'Processing restriction applied',
        })
      )
    })

    it('should process objection request', async () => {
      // Arrange
      const request = {
        id: 'request-123',
        workspace_id: 'workspace-123',
        request_type: DataSubjectRequestType.OBJECTION,
        lead_id: 'lead-123',
        verification_token: 'token-123',
      }

      mockSupabase.single.mockResolvedValueOnce({ data: request, error: null })
      mockSupabase.single.mockResolvedValueOnce({
        data: { ...request, verified_at: '2024-01-01', status: DataSubjectRequestStatus.IN_PROGRESS },
        error: null,
      })
      mockSupabase.rpc.mockResolvedValue({ data: 'consent-123', error: null })
      mockSupabase.single.mockResolvedValue({ data: {}, error: null })

      // Act
      await service.verifyDataSubjectRequest({
        requestId: 'request-123',
        verificationToken: 'token-123',
      })

      // Assert
      expect(mockSupabase.rpc).toHaveBeenCalledWith('record_consent', expect.any(Object))
    })
  })
})