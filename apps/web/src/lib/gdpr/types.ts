/**
 * GDPR Compliance Types
 * Central type definitions for all GDPR-related entities
 */

// ==================== Enums ====================

export enum ConsentType {
  MARKETING = 'marketing',
  TRACKING = 'tracking',
  DATA_PROCESSING = 'data_processing',
  COOKIES = 'cookies',
  PROFILING = 'profiling',
  THIRD_PARTY_SHARING = 'third_party_sharing',
  NEWSLETTER = 'newsletter',
  PRODUCT_UPDATES = 'product_updates',
}

export enum ConsentStatus {
  GRANTED = 'granted',
  WITHDRAWN = 'withdrawn',
  PENDING = 'pending',
  EXPIRED = 'expired',
}

export enum ConsentMethod {
  EXPLICIT = 'explicit',
  IMPLICIT = 'implicit',
  IMPORTED = 'imported',
  OPT_OUT = 'opt_out',
  OPT_IN = 'opt_in',
}

export enum DataSubjectRequestType {
  ACCESS = 'access',              // Article 15
  RECTIFICATION = 'rectification', // Article 16
  ERASURE = 'erasure',            // Article 17 (Right to be forgotten)
  PORTABILITY = 'portability',    // Article 20
  RESTRICTION = 'restriction',    // Article 18
  OBJECTION = 'objection',        // Article 21
  AUTOMATED_DECISION = 'automated_decision', // Article 22
}

export enum DataSubjectRequestStatus {
  PENDING = 'pending',
  VERIFYING = 'verifying',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
}

export enum RequestPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}

export enum VerificationMethod {
  EMAIL = 'email',
  ID_DOCUMENT = 'id_document',
  PHONE = 'phone',
  OTHER = 'other',
}

export enum ResponseFormat {
  JSON = 'json',
  CSV = 'csv',
  PDF = 'pdf',
  XML = 'xml',
}

export enum LegalBasis {
  CONSENT = 'consent',
  CONTRACT = 'contract',
  LEGAL_OBLIGATION = 'legal_obligation',
  VITAL_INTERESTS = 'vital_interests',
  PUBLIC_TASK = 'public_task',
  LEGITIMATE_INTERESTS = 'legitimate_interests',
}

export enum DeletionStrategy {
  SOFT_DELETE = 'soft_delete',
  ANONYMIZE = 'anonymize',
  PSEUDONYMIZE = 'pseudonymize',
  HARD_DELETE = 'hard_delete',
  ARCHIVE = 'archive',
}

export enum AuditActionCategory {
  DATA_ACCESS = 'data_access',
  DATA_MODIFICATION = 'data_modification',
  DATA_DELETION = 'data_deletion',
  CONSENT_MANAGEMENT = 'consent_management',
  DATA_EXPORT = 'data_export',
  USER_RIGHTS = 'user_rights',
  SECURITY_EVENT = 'security_event',
}

export enum PolicyType {
  PRIVACY_POLICY = 'privacy_policy',
  COOKIE_POLICY = 'cookie_policy',
  TERMS_OF_SERVICE = 'terms_of_service',
  DATA_PROCESSING_AGREEMENT = 'data_processing_agreement',
}

export enum SuppressionType {
  UNSUBSCRIBE = 'unsubscribe',
  BOUNCE = 'bounce',
  COMPLAINT = 'complaint',
  MANUAL = 'manual',
  GDPR_REQUEST = 'gdpr_request',
  INVALID = 'invalid',
}

// ==================== Core Entities ====================

export interface ConsentRecord {
  id: string
  workspaceId: string
  leadId?: string
  userId?: string
  consentType: ConsentType
  status: ConsentStatus
  method: ConsentMethod
  ipAddress?: string
  userAgent?: string
  consentText?: string
  version: string
  source?: string
  withdrawalReason?: string
  parentConsentId?: string
  expiresAt?: Date
  createdAt: Date
  updatedAt: Date
}

export interface DataProcessingActivity {
  id: string
  workspaceId: string
  activityName: string
  description: string
  purpose: string[]
  legalBasis: LegalBasis
  legalBasisDetails?: string
  dataCategories: string[]
  dataSources?: string[]
  recipients?: string[]
  thirdCountries?: string[]
  retentionPeriod: string
  securityMeasures: string[]
  riskLevel?: 'low' | 'medium' | 'high'
  dpiaRequired: boolean
  dpiaCompletedAt?: Date
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  createdBy?: string
}

export interface DataSubjectRequest {
  id: string
  workspaceId: string
  requestType: DataSubjectRequestType
  requesterEmail: string
  requesterName?: string
  leadId?: string
  status: DataSubjectRequestStatus
  priority: RequestPriority
  verificationMethod?: VerificationMethod
  verificationToken?: string
  verifiedAt?: Date
  verificationAttempts: number
  requestDetails: Record<string, any>
  responseData?: Record<string, any>
  responseFormat?: ResponseFormat
  responseSentAt?: Date
  responseMethod?: 'email' | 'api' | 'download' | 'mail'
  rejectionReason?: string
  internalNotes?: string
  assignedTo?: string
  completedBy?: string
  completedAt?: Date
  deadline: Date
  createdAt: Date
  updatedAt: Date
}

export interface PrivacyPolicy {
  id: string
  workspaceId: string
  version: string
  title: string
  content: string
  summary?: string
  changesSummary?: string
  effectiveDate: Date
  language: string
  policyType: PolicyType
  isActive: boolean
  requiresConsent: boolean
  createdAt: Date
  createdBy?: string
  approvedBy?: string
  approvedAt?: Date
}

export interface DataRetentionPolicy {
  id: string
  workspaceId: string
  dataType: string
  description?: string
  tableName?: string
  retentionDays: number
  deletionStrategy: DeletionStrategy
  anonymizationFields?: string[]
  legalBasisForRetention?: string
  isActive: boolean
  lastExecutionAt?: Date
  nextExecutionAt?: Date
  createdAt: Date
  updatedAt: Date
}

export interface GdprAuditLog {
  id: string
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
  createdAt: Date
}

export interface CookieConsent {
  id: string
  workspaceId: string
  visitorId: string
  consentId: string
  necessary: boolean
  functional: boolean
  analytics: boolean
  marketing: boolean
  consentGivenAt?: Date
  consentWithdrawnAt?: Date
  ipAddress?: string
  userAgent?: string
  consentVersion?: string
  createdAt: Date
  updatedAt: Date
}

export interface DataPortabilityExport {
  id: string
  requestId: string
  exportFormat: ResponseFormat
  filePath?: string
  fileSize?: number
  checksum?: string
  encryptionKeyId?: string
  downloadCount: number
  maxDownloads: number
  expiresAt: Date
  createdAt: Date
}

export interface SuppressionListEntry {
  id: string
  workspaceId: string
  email: string
  suppressionType: SuppressionType
  reason?: string
  source?: string
  campaignId?: string
  isGlobal: boolean
  metadata?: Record<string, any>
  createdAt: Date
}

export interface UnsubscribeReason {
  id: string
  workspaceId: string
  email: string
  leadId?: string
  reasonCategory: 'too_frequent' | 'not_relevant' | 'never_signed_up' | 'privacy_concerns' | 'other'
  reasonDetails?: string
  feedback?: string
  campaignId?: string
  unsubscribeToken?: string
  ipAddress?: string
  userAgent?: string
  createdAt: Date
}

// ==================== Request/Response Types ====================

export interface RecordConsentRequest {
  workspaceId: string
  leadId?: string
  userId?: string
  consentType: ConsentType
  status: ConsentStatus
  method: ConsentMethod
  version: string
  ipAddress?: string
  userAgent?: string
  consentText?: string
  source?: string
  expiresDays?: number
}

export interface CheckConsentRequest {
  workspaceId: string
  leadId?: string
  userId?: string
  consentTypes: ConsentType[]
}

export interface CheckConsentResponse {
  consents: {
    [key in ConsentType]?: {
      granted: boolean
      version?: string
      grantedAt?: Date
      expiresAt?: Date
    }
  }
}

export interface CreateDataSubjectRequestRequest {
  workspaceId: string
  requestType: DataSubjectRequestType
  requesterEmail: string
  requesterName?: string
  leadId?: string
  requestDetails?: Record<string, any>
  priority?: RequestPriority
}

export interface VerifyDataSubjectRequestRequest {
  requestId: string
  verificationToken: string
  verificationData?: Record<string, any>
}

export interface UpdateDataSubjectRequestRequest {
  requestId: string
  status?: DataSubjectRequestStatus
  assignedTo?: string
  internalNotes?: string
  responseData?: Record<string, any>
  rejectionReason?: string
}

export interface DataExportRequest {
  workspaceId: string
  leadId?: string
  userId?: string
  format: ResponseFormat
  includeTypes?: string[]
  excludeTypes?: string[]
}

export interface DataExportResponse {
  exportId: string
  downloadUrl: string
  expiresAt: Date
  format: ResponseFormat
  fileSize: number
}

export interface DataDeletionRequest {
  workspaceId: string
  leadId?: string
  userId?: string
  deletionStrategy: DeletionStrategy
  reason: string
  cascadeDelete?: boolean
  notifyUser?: boolean
}

export interface DataDeletionResponse {
  deletionId: string
  affectedRecords: {
    [tableName: string]: number
  }
  strategy: DeletionStrategy
  completedAt: Date
}

export interface CookieConsentRequest {
  workspaceId: string
  visitorId: string
  necessary: boolean
  functional: boolean
  analytics: boolean
  marketing: boolean
  version?: string
  ipAddress?: string
  userAgent?: string
}

export interface CookieConsentResponse {
  consentId: string
  consentGivenAt: Date
  expiresAt: Date
}

export interface ComplianceReportRequest {
  workspaceId: string
  reportType: 'consent' | 'requests' | 'audit' | 'processing' | 'full'
  dateRange?: {
    start: Date
    end: Date
  }
  format?: ResponseFormat
}

export interface ComplianceReportResponse {
  reportId: string
  reportType: string
  generatedAt: Date
  downloadUrl?: string
  summary: Record<string, any>
}

// ==================== Configuration Types ====================

export interface GdprConfig {
  consent: {
    defaultExpireDays: number
    requireExplicitConsent: boolean
    granularConsent: boolean
    cookieBannerEnabled: boolean
  }
  dataSubjectRequests: {
    autoVerifyEmail: boolean
    defaultDeadlineDays: number
    requireIdVerification: boolean
    notificationEmails: string[]
  }
  retention: {
    defaultRetentionDays: number
    enableAutoDelete: boolean
    reviewIntervalDays: number
  }
  anonymization: {
    preserveAnalytics: boolean
    anonymizationPrefix: string
    fieldsToPreserve: string[]
  }
  export: {
    maxExportSizeMb: number
    exportExpirationHours: number
    allowedFormats: ResponseFormat[]
  }
  audit: {
    enableDetailedLogging: boolean
    logRetentionDays: number
    sensitiveDataMasking: boolean
  }
}

// ==================== Analytics Types ====================

export interface GdprMetrics {
  totalConsents: number
  activeConsents: number
  withdrawnConsents: number
  consentRate: number
  dataSubjectRequests: {
    total: number
    byType: Record<DataSubjectRequestType, number>
    averageCompletionTime: number
    pendingRequests: number
  }
  suppressionList: {
    totalEntries: number
    byType: Record<SuppressionType, number>
  }
  dataRetention: {
    recordsDeleted: number
    recordsAnonymized: number
    nextScheduledRun: Date
  }
}

// ==================== Error Types ====================

export interface GdprError extends Error {
  code?: GdprErrorCode
  statusCode?: number
  details?: Record<string, any>
}

export enum GdprErrorCode {
  // Consent errors
  CONSENT_NOT_FOUND = 'CONSENT_NOT_FOUND',
  CONSENT_ALREADY_EXISTS = 'CONSENT_ALREADY_EXISTS',
  CONSENT_EXPIRED = 'CONSENT_EXPIRED',
  INVALID_CONSENT_TYPE = 'INVALID_CONSENT_TYPE',
  
  // Request errors
  REQUEST_NOT_FOUND = 'REQUEST_NOT_FOUND',
  REQUEST_ALREADY_COMPLETED = 'REQUEST_ALREADY_COMPLETED',
  VERIFICATION_FAILED = 'VERIFICATION_FAILED',
  DEADLINE_EXCEEDED = 'DEADLINE_EXCEEDED',
  
  // Export errors
  EXPORT_FAILED = 'EXPORT_FAILED',
  EXPORT_TOO_LARGE = 'EXPORT_TOO_LARGE',
  EXPORT_EXPIRED = 'EXPORT_EXPIRED',
  
  // Deletion errors
  DELETION_FAILED = 'DELETION_FAILED',
  CANNOT_DELETE_ACTIVE_USER = 'CANNOT_DELETE_ACTIVE_USER',
  DELETION_RESTRICTED = 'DELETION_RESTRICTED',
  
  // Policy errors
  POLICY_NOT_FOUND = 'POLICY_NOT_FOUND',
  INVALID_POLICY_VERSION = 'INVALID_POLICY_VERSION',
  
  // Generic errors
  WORKSPACE_NOT_FOUND = 'WORKSPACE_NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

// ==================== Utility Types ====================

export interface AnonymizationResult {
  recordsAffected: number
  fieldsAnonymized: string[]
  strategy: 'hash' | 'replace' | 'remove'
  completedAt: Date
}

export interface ConsentProof {
  consentId: string
  timestamp: Date
  ipAddress?: string
  userAgent?: string
  consentText: string
  version: string
  signature: string
}

export interface DataInventory {
  dataType: string
  location: string
  purpose: string[]
  legalBasis: LegalBasis
  retention: string
  sharing: string[]
  security: string[]
}

// ==================== Email Template Types ====================

export interface GdprEmailTemplate {
  id: string
  type: GdprEmailType
  subject: string
  htmlContent: string
  textContent: string
  variables: string[]
  language: string
}

export enum GdprEmailType {
  CONSENT_REQUEST = 'consent_request',
  CONSENT_CONFIRMATION = 'consent_confirmation',
  CONSENT_WITHDRAWAL = 'consent_withdrawal',
  DATA_REQUEST_RECEIVED = 'data_request_received',
  DATA_REQUEST_VERIFICATION = 'data_request_verification',
  DATA_REQUEST_COMPLETED = 'data_request_completed',
  DATA_REQUEST_REJECTED = 'data_request_rejected',
  DATA_EXPORT_READY = 'data_export_ready',
  DATA_DELETION_CONFIRMATION = 'data_deletion_confirmation',
  PRIVACY_POLICY_UPDATE = 'privacy_policy_update',
  UNSUBSCRIBE_CONFIRMATION = 'unsubscribe_confirmation',
}