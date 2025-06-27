/**
 * GDPR Compliance Module
 * Export all GDPR-related functionality
 */

// Export the main service
export { GdprService, gdprService } from './gdpr-service'

// Export all types
export * from './types'

// Export utilities
export {
  // Anonymization functions
  anonymizeEmail,
  anonymizePhone,
  anonymizeName,
  anonymizeIpAddress,
  anonymizeCustomFields,
  generateAnonymousId,
  
  // Hashing functions
  hashData,
  createConsentSignature,
  verifyConsentSignature,
  
  // Data export functions
  convertDataToFormat,
  
  // Validation functions
  isValidEmail,
  isValidConsentType,
  isValidDeletionStrategy,
  isRetentionExpired,
  
  // Error handling
  createGdprError,
  handleGdprError,
  
  // Date/Time utilities
  calculateDeadline,
  formatGdprDate,
  isDeadlineApproaching,
  
  // Security utilities
  generateVerificationToken,
  generateDownloadToken,
  verifyDownloadToken,
  
  // Analytics utilities
  calculateConsentRate,
  calculateAverageCompletionTime,
  
  // Compliance utilities
  canDeleteUser,
  determineDeletionStrategy,
} from './utils'

// Export email templates
export { getEmailTemplate, GdprEmailType } from './email-templates'

// Re-export commonly used enums for convenience
export {
  ConsentType,
  ConsentStatus,
  ConsentMethod,
  DataSubjectRequestType,
  DataSubjectRequestStatus,
  RequestPriority,
  VerificationMethod,
  ResponseFormat,
  LegalBasis,
  DeletionStrategy,
  AuditActionCategory,
  PolicyType,
  SuppressionType,
  GdprErrorCode,
} from './types'