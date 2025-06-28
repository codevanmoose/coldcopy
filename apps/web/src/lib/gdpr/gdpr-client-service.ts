/**
 * GDPR Client Service
 * Client-side version of GDPR service that works with Supabase client
 */

import { createClient } from '@/lib/supabase/client'
import type {
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

class GdprClientService {
  private supabase = createClient()

  async getGdprMetrics(workspaceId: string): Promise<GdprMetrics> {
    try {
      const response = await fetch(`/api/gdpr/metrics?workspaceId=${workspaceId}`)
      if (!response.ok) throw new Error('Failed to fetch metrics')
      return await response.json()
    } catch (error) {
      console.error('Error fetching GDPR metrics:', error)
      throw error
    }
  }

  async getDataSubjectRequests(workspaceId: string): Promise<DataSubjectRequest[]> {
    try {
      const { data, error } = await this.supabase
        .from('data_subject_requests')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching data subject requests:', error)
      throw error
    }
  }

  async getDataRetentionPolicies(workspaceId: string): Promise<DataRetentionPolicy[]> {
    try {
      const { data, error } = await this.supabase
        .from('data_retention_policies')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('data_type', { ascending: true })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching retention policies:', error)
      throw error
    }
  }

  async updateDataSubjectRequest(params: UpdateDataSubjectRequestRequest): Promise<void> {
    try {
      const response = await fetch('/api/gdpr/requests/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })
      if (!response.ok) throw new Error('Failed to update request')
    } catch (error) {
      console.error('Error updating data subject request:', error)
      throw error
    }
  }

  async executeRetentionPolicies(workspaceId: string): Promise<void> {
    try {
      const response = await fetch('/api/gdpr/retention/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId }),
      })
      if (!response.ok) throw new Error('Failed to execute retention policies')
    } catch (error) {
      console.error('Error executing retention policies:', error)
      throw error
    }
  }

  async generateComplianceReport(params: ComplianceReportRequest): Promise<ComplianceReportResponse> {
    try {
      const response = await fetch('/api/gdpr/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })
      if (!response.ok) throw new Error('Failed to generate report')
      return await response.json()
    } catch (error) {
      console.error('Error generating compliance report:', error)
      throw error
    }
  }
}

export const gdprClientService = new GdprClientService()