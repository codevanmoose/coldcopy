/**
 * GDPR Compliance Service
 * Comprehensive service for managing GDPR compliance including consent management,
 * data subject rights, cookie management, and compliance tracking
 */

import { createClient } from '@/lib/supabase/server'
import { SupabaseClient } from '@supabase/supabase-js'
import {
  ConsentRecord,
  ConsentType,
  ConsentStatus,
  ConsentMethod,
  DataSubjectRequest,
  DataSubjectRequestType,
  DataSubjectRequestStatus,
  RequestPriority,
  VerificationMethod,
  ResponseFormat,
  DeletionStrategy,
  AuditActionCategory,
  GdprError,
  GdprErrorCode,
  RecordConsentRequest,
  CheckConsentRequest,
  CheckConsentResponse,
  CreateDataSubjectRequestRequest,
  VerifyDataSubjectRequestRequest,
  UpdateDataSubjectRequestRequest,
  DataExportRequest,
  DataExportResponse,
  DataDeletionRequest,
  DataDeletionResponse,
  CookieConsentRequest,
  CookieConsentResponse,
  ComplianceReportRequest,
  ComplianceReportResponse,
  GdprMetrics,
  SuppressionType,
  CookieConsent,
  DataPortabilityExport,
  GdprAuditLog,
  PrivacyPolicy,
  DataRetentionPolicy,
  LegalBasis,
} from './types'
import {
  anonymizeEmail,
  anonymizePhone,
  anonymizeName,
  anonymizeIpAddress,
  anonymizeCustomFields,
  generateAnonymousId,
  hashData,
  createConsentSignature,
  verifyConsentSignature,
  convertDataToFormat,
  isValidEmail,
  isValidConsentType,
  isValidDeletionStrategy,
  isRetentionExpired,
  createGdprError,
  handleGdprError,
  calculateDeadline,
  formatGdprDate,
  isDeadlineApproaching,
  generateVerificationToken,
  generateDownloadToken,
  verifyDownloadToken,
  calculateConsentRate,
  calculateAverageCompletionTime,
  canDeleteUser,
  determineDeletionStrategy,
} from './utils'
import { getEmailTemplate, GdprEmailType } from './email-templates'

export class GdprService {
  private supabase: SupabaseClient

  constructor(supabase?: SupabaseClient) {
    this.supabase = supabase || createClient()
  }

  // ==================== Consent Management ====================

  /**
   * Record consent from a data subject
   */
  async recordConsent(request: RecordConsentRequest): Promise<ConsentRecord> {
    try {
      // Validate consent type
      if (!isValidConsentType(request.consentType)) {
        throw createGdprError(
          'Invalid consent type',
          GdprErrorCode.INVALID_CONSENT_TYPE
        )
      }

      // Call stored procedure to record consent
      const { data, error } = await this.supabase.rpc('record_consent', {
        p_workspace_id: request.workspaceId,
        p_lead_id: request.leadId,
        p_consent_type: request.consentType,
        p_status: request.status,
        p_method: request.method,
        p_version: request.version,
        p_ip_address: request.ipAddress,
        p_user_agent: request.userAgent,
        p_consent_text: request.consentText,
        p_source: request.source,
        p_expires_days: request.expiresDays,
      })

      if (error) throw error

      // Fetch the created consent record
      const { data: consent, error: fetchError } = await this.supabase
        .from('consent_records')
        .select('*')
        .eq('id', data)
        .single()

      if (fetchError) throw fetchError

      // Send confirmation email if consent was granted
      if (request.status === ConsentStatus.GRANTED && request.leadId) {
        await this.sendConsentEmail(
          request.workspaceId,
          request.leadId,
          GdprEmailType.CONSENT_CONFIRMATION,
          [request.consentType]
        )
      }

      return consent
    } catch (error) {
      throw handleGdprError(error)
    }
  }

  /**
   * Check consent status for multiple consent types
   */
  async checkConsent(request: CheckConsentRequest): Promise<CheckConsentResponse> {
    try {
      const consents: CheckConsentResponse['consents'] = {}

      for (const consentType of request.consentTypes) {
        const { data: hasConsent, error } = await this.supabase.rpc(
          'check_consent',
          {
            p_workspace_id: request.workspaceId,
            p_lead_id: request.leadId,
            p_consent_type: consentType,
          }
        )

        if (error) throw error

        if (hasConsent) {
          // Get consent details
          const { data: consentRecord } = await this.supabase
            .from('consent_records')
            .select('version, created_at, expires_at')
            .eq('workspace_id', request.workspaceId)
            .eq('lead_id', request.leadId)
            .eq('consent_type', consentType)
            .eq('status', ConsentStatus.GRANTED)
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

          consents[consentType] = {
            granted: true,
            version: consentRecord?.version,
            grantedAt: consentRecord?.created_at ? new Date(consentRecord.created_at) : undefined,
            expiresAt: consentRecord?.expires_at ? new Date(consentRecord.expires_at) : undefined,
          }
        } else {
          consents[consentType] = { granted: false }
        }
      }

      return { consents }
    } catch (error) {
      throw handleGdprError(error)
    }
  }

  /**
   * Withdraw consent
   */
  async withdrawConsent(
    workspaceId: string,
    leadId: string,
    consentTypes: ConsentType[],
    withdrawalReason?: string
  ): Promise<void> {
    try {
      for (const consentType of consentTypes) {
        await this.recordConsent({
          workspaceId,
          leadId,
          consentType,
          status: ConsentStatus.WITHDRAWN,
          method: ConsentMethod.EXPLICIT,
          version: '1.0',
          source: 'user_withdrawal',
        })

        // Update withdrawal reason if provided
        if (withdrawalReason) {
          await this.supabase
            .from('consent_records')
            .update({ withdrawal_reason: withdrawalReason })
            .eq('workspace_id', workspaceId)
            .eq('lead_id', leadId)
            .eq('consent_type', consentType)
            .order('created_at', { ascending: false })
            .limit(1)
        }
      }

      // Send withdrawal confirmation email
      await this.sendConsentEmail(
        workspaceId,
        leadId,
        GdprEmailType.CONSENT_WITHDRAWAL,
        consentTypes
      )
    } catch (error) {
      throw handleGdprError(error)
    }
  }

  /**
   * Get consent history for a lead
   */
  async getConsentHistory(
    workspaceId: string,
    leadId: string
  ): Promise<ConsentRecord[]> {
    try {
      const { data, error } = await this.supabase
        .from('consent_records')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })

      if (error) throw error

      return data || []
    } catch (error) {
      throw handleGdprError(error)
    }
  }

  // ==================== Data Subject Rights ====================

  /**
   * Create a new data subject request
   */
  async createDataSubjectRequest(
    request: CreateDataSubjectRequestRequest
  ): Promise<DataSubjectRequest> {
    try {
      // Validate email
      if (!isValidEmail(request.requesterEmail)) {
        throw createGdprError(
          'Invalid email address',
          GdprErrorCode.VALIDATION_ERROR
        )
      }

      // Call stored procedure to create request
      const { data: requestId, error } = await this.supabase.rpc(
        'create_data_subject_request',
        {
          p_workspace_id: request.workspaceId,
          p_request_type: request.requestType,
          p_requester_email: request.requesterEmail,
          p_requester_name: request.requesterName,
          p_lead_id: request.leadId,
          p_request_details: request.requestDetails || {},
        }
      )

      if (error) throw error

      // Update priority if specified
      if (request.priority) {
        await this.supabase
          .from('data_subject_requests')
          .update({ priority: request.priority })
          .eq('id', requestId)
      }

      // Fetch the created request
      const { data: dataRequest, error: fetchError } = await this.supabase
        .from('data_subject_requests')
        .select('*')
        .eq('id', requestId)
        .single()

      if (fetchError) throw fetchError

      // Send confirmation email
      await this.sendDataRequestEmail(
        dataRequest,
        GdprEmailType.DATA_REQUEST_RECEIVED
      )

      // Send verification email
      await this.sendDataRequestEmail(
        dataRequest,
        GdprEmailType.DATA_REQUEST_VERIFICATION
      )

      return dataRequest
    } catch (error) {
      throw handleGdprError(error)
    }
  }

  /**
   * Verify a data subject request
   */
  async verifyDataSubjectRequest(
    request: VerifyDataSubjectRequestRequest
  ): Promise<DataSubjectRequest> {
    try {
      // Get the request
      const { data: dataRequest, error } = await this.supabase
        .from('data_subject_requests')
        .select('*')
        .eq('id', request.requestId)
        .eq('verification_token', request.verificationToken)
        .single()

      if (error || !dataRequest) {
        throw createGdprError(
          'Invalid verification token or request not found',
          GdprErrorCode.VERIFICATION_FAILED,
          400
        )
      }

      // Check if already verified
      if (dataRequest.verified_at) {
        return dataRequest
      }

      // Update verification status
      const { data: updatedRequest, error: updateError } = await this.supabase
        .from('data_subject_requests')
        .update({
          verified_at: new Date().toISOString(),
          status: DataSubjectRequestStatus.IN_PROGRESS,
          verification_method: VerificationMethod.EMAIL,
        })
        .eq('id', request.requestId)
        .select()
        .single()

      if (updateError) throw updateError

      // Process the request based on type
      await this.processDataSubjectRequest(updatedRequest)

      return updatedRequest
    } catch (error) {
      throw handleGdprError(error)
    }
  }

  /**
   * Update a data subject request
   */
  async updateDataSubjectRequest(
    request: UpdateDataSubjectRequestRequest
  ): Promise<DataSubjectRequest> {
    try {
      const updateData: any = {}

      if (request.status) updateData.status = request.status
      if (request.assignedTo) updateData.assigned_to = request.assignedTo
      if (request.internalNotes) updateData.internal_notes = request.internalNotes
      if (request.responseData) updateData.response_data = request.responseData
      if (request.rejectionReason) updateData.rejection_reason = request.rejectionReason

      // If completing or rejecting, set completion data
      if (request.status === DataSubjectRequestStatus.COMPLETED ||
          request.status === DataSubjectRequestStatus.REJECTED) {
        updateData.completed_at = new Date().toISOString()
        updateData.completed_by = (await this.supabase.auth.getUser()).data.user?.id
      }

      const { data, error } = await this.supabase
        .from('data_subject_requests')
        .update(updateData)
        .eq('id', request.requestId)
        .select()
        .single()

      if (error) throw error

      // Send appropriate email based on status
      if (request.status === DataSubjectRequestStatus.COMPLETED) {
        await this.sendDataRequestEmail(data, GdprEmailType.DATA_REQUEST_COMPLETED)
      } else if (request.status === DataSubjectRequestStatus.REJECTED) {
        await this.sendDataRequestEmail(data, GdprEmailType.DATA_REQUEST_REJECTED)
      }

      return data
    } catch (error) {
      throw handleGdprError(error)
    }
  }

  /**
   * Get data subject requests for a workspace
   */
  async getDataSubjectRequests(
    workspaceId: string,
    filters?: {
      status?: DataSubjectRequestStatus
      requestType?: DataSubjectRequestType
      priority?: RequestPriority
    }
  ): Promise<DataSubjectRequest[]> {
    try {
      let query = this.supabase
        .from('data_subject_requests')
        .select('*')
        .eq('workspace_id', workspaceId)

      if (filters?.status) {
        query = query.eq('status', filters.status)
      }
      if (filters?.requestType) {
        query = query.eq('request_type', filters.requestType)
      }
      if (filters?.priority) {
        query = query.eq('priority', filters.priority)
      }

      const { data, error } = await query.order('created_at', { ascending: false })

      if (error) throw error

      return data || []
    } catch (error) {
      throw handleGdprError(error)
    }
  }

  /**
   * Process a verified data subject request
   */
  private async processDataSubjectRequest(
    request: DataSubjectRequest
  ): Promise<void> {
    switch (request.requestType) {
      case DataSubjectRequestType.ACCESS:
        await this.processAccessRequest(request)
        break
      case DataSubjectRequestType.PORTABILITY:
        await this.processPortabilityRequest(request)
        break
      case DataSubjectRequestType.ERASURE:
        await this.processErasureRequest(request)
        break
      case DataSubjectRequestType.RECTIFICATION:
        await this.processRectificationRequest(request)
        break
      case DataSubjectRequestType.RESTRICTION:
        await this.processRestrictionRequest(request)
        break
      case DataSubjectRequestType.OBJECTION:
        await this.processObjectionRequest(request)
        break
      default:
        throw createGdprError(
          `Unsupported request type: ${request.requestType}`,
          GdprErrorCode.VALIDATION_ERROR
        )
    }
  }

  // ==================== Data Export ====================

  /**
   * Export personal data
   */
  async exportData(request: DataExportRequest): Promise<DataExportResponse> {
    try {
      // Get all personal data
      const data = await this.collectPersonalData(
        request.workspaceId,
        request.leadId,
        request.userId,
        request.includeTypes,
        request.excludeTypes
      )

      // Convert to requested format
      const { content, mimeType, extension } = await convertDataToFormat(
        data,
        request.format
      )

      // Create export record
      const { data: exportRecord, error } = await this.supabase
        .from('data_portability_exports')
        .insert({
          request_id: generateAnonymousId({ ...request, timestamp: Date.now() }),
          export_format: request.format,
          file_size: Buffer.byteLength(content),
          checksum: hashData(content.toString()),
          max_downloads: 3,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        })
        .select()
        .single()

      if (error) throw error

      // Store the file (in production, use cloud storage)
      const filePath = `/exports/${exportRecord.id}.${extension}`
      // await this.storeExportFile(filePath, content)

      // Generate download URL
      const downloadToken = generateDownloadToken(exportRecord.id)
      const downloadUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/gdpr/download/${exportRecord.id}?token=${downloadToken}`

      // Log the export
      await this.logAuditEvent({
        workspaceId: request.workspaceId,
        action: 'data_export_created',
        actionCategory: AuditActionCategory.DATA_EXPORT,
        resourceType: 'data_export',
        resourceId: exportRecord.id,
        purpose: 'Data portability export requested',
      })

      return {
        exportId: exportRecord.id,
        downloadUrl,
        expiresAt: new Date(exportRecord.expires_at),
        format: request.format,
        fileSize: exportRecord.file_size,
      }
    } catch (error) {
      throw handleGdprError(error)
    }
  }

  /**
   * Collect all personal data for a subject
   */
  private async collectPersonalData(
    workspaceId: string,
    leadId?: string,
    userId?: string,
    includeTypes?: string[],
    excludeTypes?: string[]
  ): Promise<any> {
    const data: any = {
      exportMetadata: {
        workspaceId,
        exportDate: new Date().toISOString(),
        dataSubject: { leadId, userId },
      },
    }

    // Helper function to check if data type should be included
    const shouldInclude = (type: string) => {
      if (excludeTypes?.includes(type)) return false
      if (includeTypes && !includeTypes.includes(type)) return false
      return true
    }

    if (leadId) {
      // Lead data
      if (shouldInclude('leads')) {
        const { data: leadData } = await this.supabase
          .from('leads')
          .select('*')
          .eq('id', leadId)
          .eq('workspace_id', workspaceId)
          .single()
        
        data.lead = leadData
      }

      // Consent records
      if (shouldInclude('consent')) {
        const { data: consentData } = await this.supabase
          .from('consent_records')
          .select('*')
          .eq('lead_id', leadId)
          .eq('workspace_id', workspaceId)
        
        data.consentRecords = consentData
      }

      // Campaign emails
      if (shouldInclude('emails')) {
        const { data: emailData } = await this.supabase
          .from('campaign_emails')
          .select(`
            *,
            campaigns (
              name,
              subject
            )
          `)
          .eq('lead_id', leadId)
        
        data.campaignEmails = emailData
      }

      // Email events
      if (shouldInclude('events')) {
        const { data: eventData } = await this.supabase
          .from('email_events')
          .select('*')
          .eq('lead_id', leadId)
        
        data.emailEvents = eventData
      }

      // Enriched data
      if (shouldInclude('enrichment')) {
        const { data: enrichedData } = await this.supabase
          .from('enriched_data')
          .select('*')
          .eq('lead_id', leadId)
          .eq('workspace_id', workspaceId)
        
        data.enrichedData = enrichedData
      }
    }

    // Add more data collection as needed...

    return data
  }

  // ==================== Data Deletion ====================

  /**
   * Delete personal data
   */
  async deleteData(request: DataDeletionRequest): Promise<DataDeletionResponse> {
    try {
      // Check if user can be deleted
      const deletionCheck = await this.checkDeletionEligibility(
        request.workspaceId,
        request.leadId,
        request.userId
      )

      if (!deletionCheck.canDelete) {
        throw createGdprError(
          deletionCheck.reason || 'Cannot delete user data',
          GdprErrorCode.DELETION_RESTRICTED,
          400
        )
      }

      const affectedRecords: Record<string, number> = {}

      // Execute deletion based on strategy
      switch (request.deletionStrategy) {
        case DeletionStrategy.HARD_DELETE:
          affectedRecords.hardDeleted = await this.hardDeleteData(
            request.workspaceId,
            request.leadId,
            request.userId
          )
          break

        case DeletionStrategy.ANONYMIZE:
          affectedRecords.anonymized = await this.anonymizeData(
            request.workspaceId,
            request.leadId,
            request.userId
          )
          break

        case DeletionStrategy.SOFT_DELETE:
          affectedRecords.softDeleted = await this.softDeleteData(
            request.workspaceId,
            request.leadId,
            request.userId
          )
          break

        default:
          throw createGdprError(
            'Invalid deletion strategy',
            GdprErrorCode.VALIDATION_ERROR
          )
      }

      // Add to suppression list if email is available
      if (request.leadId) {
        await this.addToSuppressionList(
          request.workspaceId,
          request.leadId,
          SuppressionType.GDPR_REQUEST,
          request.reason
        )
      }

      // Log the deletion
      await this.logAuditEvent({
        workspaceId: request.workspaceId,
        action: 'data_deletion_completed',
        actionCategory: AuditActionCategory.DATA_DELETION,
        resourceType: 'data_deletion',
        resourceId: request.leadId || request.userId,
        purpose: `Data deletion: ${request.reason}`,
        changes: {
          strategy: request.deletionStrategy,
          affectedRecords,
        },
      })

      // Send confirmation email if requested
      if (request.notifyUser && request.leadId) {
        await this.sendDeletionConfirmationEmail(
          request.workspaceId,
          request.leadId
        )
      }

      return {
        deletionId: generateAnonymousId(request),
        affectedRecords,
        strategy: request.deletionStrategy,
        completedAt: new Date(),
      }
    } catch (error) {
      throw handleGdprError(error)
    }
  }

  /**
   * Check if data can be deleted
   */
  private async checkDeletionEligibility(
    workspaceId: string,
    leadId?: string,
    userId?: string
  ): Promise<{ canDelete: boolean; reason?: string }> {
    // Check for active subscriptions
    if (userId) {
      const { data: subscriptions } = await this.supabase
        .from('subscriptions')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('status', 'active')
        .limit(1)

      if (subscriptions && subscriptions.length > 0) {
        return {
          canDelete: false,
          reason: 'Active subscription exists',
        }
      }
    }

    // Check for legal holds or other restrictions
    // Add more checks as needed...

    return { canDelete: true }
  }

  /**
   * Hard delete data
   */
  private async hardDeleteData(
    workspaceId: string,
    leadId?: string,
    userId?: string
  ): Promise<number> {
    let deletedCount = 0

    if (leadId) {
      // Delete in reverse order of dependencies
      // Email events
      const { count: eventCount } = await this.supabase
        .from('email_events')
        .delete()
        .eq('lead_id', leadId)
        .select('count')

      deletedCount += eventCount || 0

      // Campaign emails
      const { count: emailCount } = await this.supabase
        .from('campaign_emails')
        .delete()
        .eq('lead_id', leadId)
        .select('count')

      deletedCount += emailCount || 0

      // Enriched data
      const { count: enrichedCount } = await this.supabase
        .from('enriched_data')
        .delete()
        .eq('lead_id', leadId)
        .eq('workspace_id', workspaceId)
        .select('count')

      deletedCount += enrichedCount || 0

      // Consent records
      const { count: consentCount } = await this.supabase
        .from('consent_records')
        .delete()
        .eq('lead_id', leadId)
        .eq('workspace_id', workspaceId)
        .select('count')

      deletedCount += consentCount || 0

      // Finally, delete the lead
      const { count: leadCount } = await this.supabase
        .from('leads')
        .delete()
        .eq('id', leadId)
        .eq('workspace_id', workspaceId)
        .select('count')

      deletedCount += leadCount || 0
    }

    return deletedCount
  }

  /**
   * Anonymize data
   */
  private async anonymizeData(
    workspaceId: string,
    leadId?: string,
    userId?: string
  ): Promise<number> {
    let anonymizedCount = 0

    if (leadId) {
      // Call the anonymization function
      const { error } = await this.supabase.rpc('anonymize_lead_data', {
        p_lead_id: leadId,
        p_workspace_id: workspaceId,
      })

      if (!error) {
        anonymizedCount = 1
      }
    }

    return anonymizedCount
  }

  /**
   * Soft delete data
   */
  private async softDeleteData(
    workspaceId: string,
    leadId?: string,
    userId?: string
  ): Promise<number> {
    let deletedCount = 0

    if (leadId) {
      const { count } = await this.supabase
        .from('leads')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', leadId)
        .eq('workspace_id', workspaceId)
        .select('count')

      deletedCount = count || 0
    }

    return deletedCount
  }

  // ==================== Cookie Management ====================

  /**
   * Record cookie consent
   */
  async recordCookieConsent(
    request: CookieConsentRequest
  ): Promise<CookieConsentResponse> {
    try {
      const { data: consentId, error } = await this.supabase.rpc(
        'record_cookie_consent',
        {
          p_workspace_id: request.workspaceId,
          p_visitor_id: request.visitorId,
          p_necessary: request.necessary,
          p_functional: request.functional,
          p_analytics: request.analytics,
          p_marketing: request.marketing,
          p_version: request.version || '1.0',
          p_ip_address: request.ipAddress,
          p_user_agent: request.userAgent,
        }
      )

      if (error) throw error

      // Calculate expiration (1 year)
      const expiresAt = new Date()
      expiresAt.setFullYear(expiresAt.getFullYear() + 1)

      return {
        consentId,
        consentGivenAt: new Date(),
        expiresAt,
      }
    } catch (error) {
      throw handleGdprError(error)
    }
  }

  /**
   * Get cookie consent
   */
  async getCookieConsent(
    workspaceId: string,
    visitorId: string
  ): Promise<CookieConsent | null> {
    try {
      const { data, error } = await this.supabase
        .from('cookie_consents')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('visitor_id', visitorId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (error && error.code !== 'PGRST116') throw error

      return data
    } catch (error) {
      throw handleGdprError(error)
    }
  }

  /**
   * Update cookie consent
   */
  async updateCookieConsent(
    workspaceId: string,
    consentId: string,
    preferences: Partial<CookieConsentRequest>
  ): Promise<void> {
    try {
      const updateData: any = {
        updated_at: new Date().toISOString(),
      }

      if (preferences.functional !== undefined) {
        updateData.functional = preferences.functional
      }
      if (preferences.analytics !== undefined) {
        updateData.analytics = preferences.analytics
      }
      if (preferences.marketing !== undefined) {
        updateData.marketing = preferences.marketing
      }

      const { error } = await this.supabase
        .from('cookie_consents')
        .update(updateData)
        .eq('workspace_id', workspaceId)
        .eq('consent_id', consentId)

      if (error) throw error
    } catch (error) {
      throw handleGdprError(error)
    }
  }

  /**
   * Withdraw cookie consent
   */
  async withdrawCookieConsent(
    workspaceId: string,
    consentId: string
  ): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('cookie_consents')
        .update({
          consent_withdrawn_at: new Date().toISOString(),
          functional: false,
          analytics: false,
          marketing: false,
        })
        .eq('workspace_id', workspaceId)
        .eq('consent_id', consentId)

      if (error) throw error
    } catch (error) {
      throw handleGdprError(error)
    }
  }

  // ==================== Compliance Tracking ====================

  /**
   * Generate compliance report
   */
  async generateComplianceReport(
    request: ComplianceReportRequest
  ): Promise<ComplianceReportResponse> {
    try {
      const reportData: any = {
        workspaceId: request.workspaceId,
        reportType: request.reportType,
        dateRange: request.dateRange || {
          start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          end: new Date(),
        },
      }

      // Collect data based on report type
      switch (request.reportType) {
        case 'consent':
          reportData.consentMetrics = await this.getConsentMetrics(
            request.workspaceId,
            reportData.dateRange
          )
          break

        case 'requests':
          reportData.requestMetrics = await this.getRequestMetrics(
            request.workspaceId,
            reportData.dateRange
          )
          break

        case 'audit':
          reportData.auditLogs = await this.getAuditLogs(
            request.workspaceId,
            reportData.dateRange
          )
          break

        case 'processing':
          reportData.processingActivities = await this.getProcessingActivities(
            request.workspaceId
          )
          break

        case 'full':
          reportData.consentMetrics = await this.getConsentMetrics(
            request.workspaceId,
            reportData.dateRange
          )
          reportData.requestMetrics = await this.getRequestMetrics(
            request.workspaceId,
            reportData.dateRange
          )
          reportData.processingActivities = await this.getProcessingActivities(
            request.workspaceId
          )
          break
      }

      // Generate report ID
      const reportId = generateAnonymousId({
        ...request,
        timestamp: Date.now(),
      })

      // Convert to requested format if needed
      let downloadUrl: string | undefined
      if (request.format && request.format !== ResponseFormat.JSON) {
        const { content, extension } = await convertDataToFormat(
          reportData,
          request.format
        )
        // Store report file and generate URL
        downloadUrl = `/api/gdpr/reports/${reportId}.${extension}`
      }

      return {
        reportId,
        reportType: request.reportType,
        generatedAt: new Date(),
        downloadUrl,
        summary: {
          totalRecords: Object.values(reportData).reduce(
            (sum: number, data: any) =>
              sum + (Array.isArray(data) ? data.length : 1),
            0
          ),
          dateRange: reportData.dateRange,
        },
      }
    } catch (error) {
      throw handleGdprError(error)
    }
  }

  /**
   * Get GDPR metrics
   */
  async getGdprMetrics(workspaceId: string): Promise<GdprMetrics> {
    try {
      // Get consent metrics
      const { data: consentData } = await this.supabase
        .from('consent_records')
        .select('status')
        .eq('workspace_id', workspaceId)

      const totalConsents = consentData?.length || 0
      const activeConsents =
        consentData?.filter((c) => c.status === ConsentStatus.GRANTED).length || 0
      const withdrawnConsents =
        consentData?.filter((c) => c.status === ConsentStatus.WITHDRAWN).length || 0

      // Get data subject request metrics
      const { data: requestData } = await this.supabase
        .from('data_subject_requests')
        .select('request_type, status, created_at, completed_at')
        .eq('workspace_id', workspaceId)

      const requestsByType: Record<DataSubjectRequestType, number> = {
        [DataSubjectRequestType.ACCESS]: 0,
        [DataSubjectRequestType.RECTIFICATION]: 0,
        [DataSubjectRequestType.ERASURE]: 0,
        [DataSubjectRequestType.PORTABILITY]: 0,
        [DataSubjectRequestType.RESTRICTION]: 0,
        [DataSubjectRequestType.OBJECTION]: 0,
        [DataSubjectRequestType.AUTOMATED_DECISION]: 0,
      }

      requestData?.forEach((request) => {
        requestsByType[request.request_type as DataSubjectRequestType]++
      })

      const pendingRequests =
        requestData?.filter(
          (r) =>
            r.status === DataSubjectRequestStatus.PENDING ||
            r.status === DataSubjectRequestStatus.IN_PROGRESS
        ).length || 0

      const avgCompletionTime = calculateAverageCompletionTime(
        requestData || []
      )

      // Get suppression list metrics
      const { data: suppressionData } = await this.supabase
        .from('suppression_list')
        .select('suppression_type')
        .eq('workspace_id', workspaceId)

      const suppressionByType: Record<SuppressionType, number> = {
        [SuppressionType.UNSUBSCRIBE]: 0,
        [SuppressionType.BOUNCE]: 0,
        [SuppressionType.COMPLAINT]: 0,
        [SuppressionType.MANUAL]: 0,
        [SuppressionType.GDPR_REQUEST]: 0,
        [SuppressionType.INVALID]: 0,
      }

      suppressionData?.forEach((entry) => {
        suppressionByType[entry.suppression_type as SuppressionType]++
      })

      // Get retention policy data
      const { data: retentionData } = await this.supabase
        .from('data_retention_policies')
        .select('next_execution_at')
        .eq('workspace_id', workspaceId)
        .eq('is_active', true)
        .order('next_execution_at', { ascending: true })
        .limit(1)
        .single()

      return {
        totalConsents,
        activeConsents,
        withdrawnConsents,
        consentRate: calculateConsentRate(activeConsents, totalConsents),
        dataSubjectRequests: {
          total: requestData?.length || 0,
          byType: requestsByType,
          averageCompletionTime: avgCompletionTime,
          pendingRequests,
        },
        suppressionList: {
          totalEntries: suppressionData?.length || 0,
          byType: suppressionByType,
        },
        dataRetention: {
          recordsDeleted: 0, // Would need to track this separately
          recordsAnonymized: 0, // Would need to track this separately
          nextScheduledRun: retentionData?.next_execution_at
            ? new Date(retentionData.next_execution_at)
            : new Date(),
        },
      }
    } catch (error) {
      throw handleGdprError(error)
    }
  }

  /**
   * Log audit event
   */
  async logAuditEvent(event: {
    workspaceId: string
    userId?: string
    action: string
    actionCategory: AuditActionCategory
    resourceType: string
    resourceId?: string
    resourceIdentifier?: string
    dataCategories?: string[]
    purpose?: string
    legalBasis?: string
    changes?: Record<string, any>
    ipAddress?: string
    userAgent?: string
    sessionId?: string
    riskScore?: number
  }): Promise<void> {
    try {
      const { error } = await this.supabase.from('gdpr_audit_logs').insert({
        workspace_id: event.workspaceId,
        user_id: event.userId || (await this.supabase.auth.getUser()).data.user?.id,
        action: event.action,
        action_category: event.actionCategory,
        resource_type: event.resourceType,
        resource_id: event.resourceId,
        resource_identifier: event.resourceIdentifier,
        data_categories: event.dataCategories,
        purpose: event.purpose,
        legal_basis: event.legalBasis,
        changes: event.changes,
        ip_address: event.ipAddress,
        user_agent: event.userAgent,
        session_id: event.sessionId,
        risk_score: event.riskScore,
      })

      if (error) throw error
    } catch (error) {
      // Log errors but don't throw - audit logging should not break operations
      console.error('Failed to log audit event:', error)
    }
  }

  // ==================== Privacy Policies ====================

  /**
   * Get active privacy policy
   */
  async getActivePrivacyPolicy(
    workspaceId: string,
    policyType: PolicyType = PolicyType.PRIVACY_POLICY,
    language = 'en'
  ): Promise<PrivacyPolicy | null> {
    try {
      const { data, error } = await this.supabase
        .from('privacy_policies')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('policy_type', policyType)
        .eq('language', language)
        .eq('is_active', true)
        .single()

      if (error && error.code !== 'PGRST116') throw error

      return data
    } catch (error) {
      throw handleGdprError(error)
    }
  }

  /**
   * Create or update privacy policy
   */
  async upsertPrivacyPolicy(
    policy: Omit<PrivacyPolicy, 'id' | 'createdAt'>
  ): Promise<PrivacyPolicy> {
    try {
      // Deactivate current active policy
      await this.supabase
        .from('privacy_policies')
        .update({ is_active: false })
        .eq('workspace_id', policy.workspaceId)
        .eq('policy_type', policy.policyType)
        .eq('language', policy.language)
        .eq('is_active', true)

      // Insert new policy
      const { data, error } = await this.supabase
        .from('privacy_policies')
        .insert({
          ...policy,
          created_by: (await this.supabase.auth.getUser()).data.user?.id,
        })
        .select()
        .single()

      if (error) throw error

      return data
    } catch (error) {
      throw handleGdprError(error)
    }
  }

  // ==================== Data Retention ====================

  /**
   * Get data retention policies
   */
  async getDataRetentionPolicies(
    workspaceId: string,
    activeOnly = true
  ): Promise<DataRetentionPolicy[]> {
    try {
      let query = this.supabase
        .from('data_retention_policies')
        .select('*')
        .eq('workspace_id', workspaceId)

      if (activeOnly) {
        query = query.eq('is_active', true)
      }

      const { data, error } = await query.order('data_type')

      if (error) throw error

      return data || []
    } catch (error) {
      throw handleGdprError(error)
    }
  }

  /**
   * Create or update retention policy
   */
  async upsertRetentionPolicy(
    policy: Omit<DataRetentionPolicy, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<DataRetentionPolicy> {
    try {
      const { data, error } = await this.supabase
        .from('data_retention_policies')
        .upsert(
          {
            ...policy,
            next_execution_at:
              policy.nextExecutionAt ||
              new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
          },
          {
            onConflict: 'workspace_id,data_type',
          }
        )
        .select()
        .single()

      if (error) throw error

      return data
    } catch (error) {
      throw handleGdprError(error)
    }
  }

  /**
   * Execute retention policies
   */
  async executeRetentionPolicies(workspaceId: string): Promise<number> {
    try {
      const { data, error } = await this.supabase.rpc(
        'process_data_retention_policies'
      )

      if (error) throw error

      return data || 0
    } catch (error) {
      throw handleGdprError(error)
    }
  }

  // ==================== Suppression List ====================

  /**
   * Add email to suppression list
   */
  async addToSuppressionList(
    workspaceId: string,
    leadId: string,
    suppressionType: SuppressionType,
    reason?: string
  ): Promise<void> {
    try {
      // Get lead email
      const { data: lead, error: leadError } = await this.supabase
        .from('leads')
        .select('email')
        .eq('id', leadId)
        .eq('workspace_id', workspaceId)
        .single()

      if (leadError || !lead?.email) throw leadError

      // Add to suppression list
      const { error } = await this.supabase.rpc('add_to_suppression_list', {
        p_workspace_id: workspaceId,
        p_email: lead.email,
        p_suppression_type: suppressionType,
        p_reason: reason,
        p_source: 'gdpr_service',
      })

      if (error) throw error
    } catch (error) {
      throw handleGdprError(error)
    }
  }

  /**
   * Check if email is suppressed
   */
  async isEmailSuppressed(
    workspaceId: string,
    email: string
  ): Promise<boolean> {
    try {
      const { data, error } = await this.supabase.rpc('is_email_suppressed', {
        p_workspace_id: workspaceId,
        p_email: email,
      })

      if (error) throw error

      return data || false
    } catch (error) {
      throw handleGdprError(error)
    }
  }

  // ==================== Helper Methods ====================

  /**
   * Process access request
   */
  private async processAccessRequest(request: DataSubjectRequest): Promise<void> {
    // Export data
    const exportResponse = await this.exportData({
      workspaceId: request.workspaceId,
      leadId: request.leadId,
      format: request.responseFormat || ResponseFormat.JSON,
    })

    // Update request with export data
    await this.updateDataSubjectRequest({
      requestId: request.id,
      status: DataSubjectRequestStatus.COMPLETED,
      responseData: {
        exportId: exportResponse.exportId,
        downloadUrl: exportResponse.downloadUrl,
        expiresAt: exportResponse.expiresAt,
      },
    })

    // Send completion email
    await this.sendDataRequestEmail(
      request,
      GdprEmailType.DATA_EXPORT_READY,
      {
        downloadLink: exportResponse.downloadUrl,
        expirationDate: formatGdprDate(exportResponse.expiresAt),
      }
    )
  }

  /**
   * Process portability request
   */
  private async processPortabilityRequest(
    request: DataSubjectRequest
  ): Promise<void> {
    // Similar to access request but with machine-readable format
    await this.processAccessRequest(request)
  }

  /**
   * Process erasure request
   */
  private async processErasureRequest(request: DataSubjectRequest): Promise<void> {
    // Delete data
    const deletionResponse = await this.deleteData({
      workspaceId: request.workspaceId,
      leadId: request.leadId,
      deletionStrategy: DeletionStrategy.ANONYMIZE,
      reason: 'GDPR erasure request',
      notifyUser: false, // We'll send a custom email
    })

    // Update request
    await this.updateDataSubjectRequest({
      requestId: request.id,
      status: DataSubjectRequestStatus.COMPLETED,
      responseData: deletionResponse,
    })

    // Send confirmation email
    await this.sendDataRequestEmail(
      request,
      GdprEmailType.DATA_DELETION_CONFIRMATION
    )
  }

  /**
   * Process rectification request
   */
  private async processRectificationRequest(
    request: DataSubjectRequest
  ): Promise<void> {
    // This would need manual review
    // Update status to notify admin
    await this.updateDataSubjectRequest({
      requestId: request.id,
      internalNotes: 'Rectification request requires manual review',
    })
  }

  /**
   * Process restriction request
   */
  private async processRestrictionRequest(
    request: DataSubjectRequest
  ): Promise<void> {
    // Mark data as restricted
    // This would need implementation based on business logic
    await this.updateDataSubjectRequest({
      requestId: request.id,
      internalNotes: 'Processing restriction applied',
    })
  }

  /**
   * Process objection request
   */
  private async processObjectionRequest(
    request: DataSubjectRequest
  ): Promise<void> {
    // Withdraw relevant consents
    if (request.leadId) {
      await this.withdrawConsent(
        request.workspaceId,
        request.leadId,
        [ConsentType.MARKETING, ConsentType.PROFILING],
        'Data subject objection'
      )
    }

    await this.updateDataSubjectRequest({
      requestId: request.id,
      status: DataSubjectRequestStatus.COMPLETED,
    })
  }

  /**
   * Get consent metrics
   */
  private async getConsentMetrics(
    workspaceId: string,
    dateRange: { start: Date; end: Date }
  ): Promise<any> {
    const { data, error } = await this.supabase
      .from('consent_records')
      .select('*')
      .eq('workspace_id', workspaceId)
      .gte('created_at', dateRange.start.toISOString())
      .lte('created_at', dateRange.end.toISOString())

    if (error) throw error

    // Process metrics
    const metrics = {
      total: data?.length || 0,
      byType: {} as Record<string, number>,
      byStatus: {} as Record<string, number>,
      byMethod: {} as Record<string, number>,
    }

    data?.forEach((consent) => {
      metrics.byType[consent.consent_type] =
        (metrics.byType[consent.consent_type] || 0) + 1
      metrics.byStatus[consent.status] =
        (metrics.byStatus[consent.status] || 0) + 1
      metrics.byMethod[consent.method] =
        (metrics.byMethod[consent.method] || 0) + 1
    })

    return metrics
  }

  /**
   * Get request metrics
   */
  private async getRequestMetrics(
    workspaceId: string,
    dateRange: { start: Date; end: Date }
  ): Promise<any> {
    const { data, error } = await this.supabase
      .from('data_subject_requests')
      .select('*')
      .eq('workspace_id', workspaceId)
      .gte('created_at', dateRange.start.toISOString())
      .lte('created_at', dateRange.end.toISOString())

    if (error) throw error

    return {
      total: data?.length || 0,
      byType: data?.reduce((acc, req) => {
        acc[req.request_type] = (acc[req.request_type] || 0) + 1
        return acc
      }, {} as Record<string, number>),
      byStatus: data?.reduce((acc, req) => {
        acc[req.status] = (acc[req.status] || 0) + 1
        return acc
      }, {} as Record<string, number>),
      averageCompletionTime: calculateAverageCompletionTime(data || []),
    }
  }

  /**
   * Get audit logs
   */
  private async getAuditLogs(
    workspaceId: string,
    dateRange: { start: Date; end: Date }
  ): Promise<GdprAuditLog[]> {
    const { data, error } = await this.supabase
      .from('gdpr_audit_logs')
      .select('*')
      .eq('workspace_id', workspaceId)
      .gte('created_at', dateRange.start.toISOString())
      .lte('created_at', dateRange.end.toISOString())
      .order('created_at', { ascending: false })
      .limit(1000)

    if (error) throw error

    return data || []
  }

  /**
   * Get processing activities
   */
  private async getProcessingActivities(
    workspaceId: string
  ): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('data_processing_activities')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('is_active', true)

    if (error) throw error

    return data || []
  }

  /**
   * Send consent email
   */
  private async sendConsentEmail(
    workspaceId: string,
    leadId: string,
    emailType: GdprEmailType,
    consentTypes?: ConsentType[]
  ): Promise<void> {
    try {
      // Get lead and workspace data
      const { data: lead } = await this.supabase
        .from('leads')
        .select('email, first_name, last_name')
        .eq('id', leadId)
        .single()

      const { data: workspace } = await this.supabase
        .from('workspaces')
        .select('name')
        .eq('id', workspaceId)
        .single()

      if (!lead || !workspace) return

      const template = getEmailTemplate(emailType, {
        recipientName: `${lead.first_name} ${lead.last_name}`.trim(),
        recipientEmail: lead.email,
        workspaceName: workspace.name,
        consentTypes,
        supportEmail: process.env.SUPPORT_EMAIL || 'support@example.com',
      })

      // Send email via your email service
      // await sendEmail(template)
    } catch (error) {
      console.error('Failed to send consent email:', error)
    }
  }

  /**
   * Send data request email
   */
  private async sendDataRequestEmail(
    request: DataSubjectRequest,
    emailType: GdprEmailType,
    additionalData?: any
  ): Promise<void> {
    try {
      const { data: workspace } = await this.supabase
        .from('workspaces')
        .select('name')
        .eq('id', request.workspaceId)
        .single()

      if (!workspace) return

      const verificationLink = `${process.env.NEXT_PUBLIC_APP_URL}/gdpr/verify/${request.id}?token=${request.verificationToken}`

      const template = getEmailTemplate(emailType, {
        recipientName: request.requesterName,
        recipientEmail: request.requesterEmail,
        workspaceName: workspace.name,
        requestId: request.id,
        verificationLink,
        reason: request.rejectionReason,
        supportEmail: process.env.SUPPORT_EMAIL || 'support@example.com',
        ...additionalData,
      })

      // Send email via your email service
      // await sendEmail(template)
    } catch (error) {
      console.error('Failed to send data request email:', error)
    }
  }

  /**
   * Send deletion confirmation email
   */
  private async sendDeletionConfirmationEmail(
    workspaceId: string,
    leadId: string
  ): Promise<void> {
    try {
      const { data: lead } = await this.supabase
        .from('leads')
        .select('email, first_name, last_name')
        .eq('id', leadId)
        .single()

      const { data: workspace } = await this.supabase
        .from('workspaces')
        .select('name')
        .eq('id', workspaceId)
        .single()

      if (!lead || !workspace) return

      const template = getEmailTemplate(GdprEmailType.DATA_DELETION_CONFIRMATION, {
        recipientName: `${lead.first_name} ${lead.last_name}`.trim(),
        recipientEmail: lead.email,
        workspaceName: workspace.name,
        supportEmail: process.env.SUPPORT_EMAIL || 'support@example.com',
      })

      // Send email via your email service
      // await sendEmail(template)
    } catch (error) {
      console.error('Failed to send deletion confirmation email:', error)
    }
  }
}

// Export singleton instance
export const gdprService = new GdprService()