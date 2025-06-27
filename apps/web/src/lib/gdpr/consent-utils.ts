/**
 * GDPR Consent Checking Utilities
 * Helper functions for consent management and verification
 */

import { createClient } from '@/lib/supabase/server'
import { gdprService } from './gdpr-service'
import { 
  ConsentType, 
  ConsentStatus,
  ConsentMethod,
  CheckConsentResponse 
} from './types'

/**
 * Check if a user has given consent for a specific type
 */
export async function hasConsent(
  workspaceId: string,
  leadId: string | undefined,
  consentType: ConsentType
): Promise<boolean> {
  if (!leadId) return false

  try {
    const response = await gdprService.checkConsent({
      workspaceId,
      leadId,
      consentTypes: [consentType],
    })

    return response.consents[consentType]?.granted || false
  } catch (error) {
    console.error('Error checking consent:', error)
    return false
  }
}

/**
 * Check multiple consent types at once
 */
export async function checkMultipleConsents(
  workspaceId: string,
  leadId: string | undefined,
  consentTypes: ConsentType[]
): Promise<Record<ConsentType, boolean>> {
  if (!leadId) {
    return consentTypes.reduce((acc, type) => {
      acc[type] = false
      return acc
    }, {} as Record<ConsentType, boolean>)
  }

  try {
    const response = await gdprService.checkConsent({
      workspaceId,
      leadId,
      consentTypes,
    })

    return consentTypes.reduce((acc, type) => {
      acc[type] = response.consents[type]?.granted || false
      return acc
    }, {} as Record<ConsentType, boolean>)
  } catch (error) {
    console.error('Error checking multiple consents:', error)
    return consentTypes.reduce((acc, type) => {
      acc[type] = false
      return acc
    }, {} as Record<ConsentType, boolean>)
  }
}

/**
 * Record consent with validation
 */
export async function recordConsent(
  workspaceId: string,
  leadId: string,
  consentType: ConsentType,
  granted: boolean,
  options?: {
    method?: ConsentMethod
    version?: string
    source?: string
    ipAddress?: string
    userAgent?: string
    consentText?: string
    expiryDays?: number
  }
): Promise<boolean> {
  try {
    await gdprService.recordConsent({
      workspaceId,
      leadId,
      consentType,
      status: granted ? ConsentStatus.GRANTED : ConsentStatus.WITHDRAWN,
      method: options?.method || ConsentMethod.EXPLICIT,
      version: options?.version || '1.0',
      source: options?.source,
      ipAddress: options?.ipAddress,
      userAgent: options?.userAgent,
      consentText: options?.consentText,
      expiresDays: options?.expiryDays,
    })

    return true
  } catch (error) {
    console.error('Error recording consent:', error)
    return false
  }
}

/**
 * Batch record multiple consents
 */
export async function recordMultipleConsents(
  workspaceId: string,
  leadId: string,
  consents: Array<{
    type: ConsentType
    granted: boolean
  }>,
  options?: {
    method?: ConsentMethod
    version?: string
    source?: string
    ipAddress?: string
    userAgent?: string
  }
): Promise<boolean> {
  try {
    const promises = consents.map((consent) =>
      recordConsent(workspaceId, leadId, consent.type, consent.granted, options)
    )

    const results = await Promise.all(promises)
    return results.every((r) => r === true)
  } catch (error) {
    console.error('Error recording multiple consents:', error)
    return false
  }
}

/**
 * Get consent history for a lead
 */
export async function getConsentHistory(
  workspaceId: string,
  leadId: string
): Promise<any[]> {
  try {
    return await gdprService.getConsentHistory(workspaceId, leadId)
  } catch (error) {
    console.error('Error getting consent history:', error)
    return []
  }
}

/**
 * Check if email is suppressed
 */
export async function isEmailSuppressed(
  workspaceId: string,
  email: string
): Promise<boolean> {
  try {
    return await gdprService.isEmailSuppressed(workspaceId, email)
  } catch (error) {
    console.error('Error checking suppression:', error)
    return false
  }
}

/**
 * Get required consents for an action
 */
export function getRequiredConsents(action: string): ConsentType[] {
  const consentMap: Record<string, ConsentType[]> = {
    send_marketing_email: [ConsentType.MARKETING, ConsentType.TRACKING],
    send_newsletter: [ConsentType.NEWSLETTER],
    send_product_updates: [ConsentType.PRODUCT_UPDATES],
    enrich_data: [ConsentType.DATA_PROCESSING, ConsentType.PROFILING],
    share_with_third_party: [ConsentType.THIRD_PARTY_SHARING],
    set_analytics_cookies: [ConsentType.COOKIES, ConsentType.TRACKING],
    set_marketing_cookies: [ConsentType.COOKIES, ConsentType.MARKETING],
  }

  return consentMap[action] || []
}

/**
 * Check if an action is allowed based on consents
 */
export async function isActionAllowed(
  workspaceId: string,
  leadId: string | undefined,
  action: string
): Promise<boolean> {
  if (!leadId) return false

  const requiredConsents = getRequiredConsents(action)
  if (requiredConsents.length === 0) return true

  const consentStatuses = await checkMultipleConsents(
    workspaceId,
    leadId,
    requiredConsents
  )

  return requiredConsents.every((consentType) => consentStatuses[consentType])
}

/**
 * Get consent requirements for email type
 */
export function getEmailConsentRequirements(emailType: string): {
  required: ConsentType[]
  optional: ConsentType[]
} {
  const requirements: Record<string, { required: ConsentType[]; optional: ConsentType[] }> = {
    marketing: {
      required: [ConsentType.MARKETING],
      optional: [ConsentType.TRACKING],
    },
    newsletter: {
      required: [ConsentType.NEWSLETTER],
      optional: [ConsentType.TRACKING],
    },
    transactional: {
      required: [],
      optional: [],
    },
    product_update: {
      required: [ConsentType.PRODUCT_UPDATES],
      optional: [],
    },
  }

  return requirements[emailType] || { required: [], optional: [] }
}

/**
 * Format consent for display
 */
export function formatConsentType(consentType: ConsentType): string {
  const labels: Record<ConsentType, string> = {
    [ConsentType.MARKETING]: 'Marketing Communications',
    [ConsentType.TRACKING]: 'Analytics & Tracking',
    [ConsentType.DATA_PROCESSING]: 'Data Processing',
    [ConsentType.COOKIES]: 'Cookies',
    [ConsentType.PROFILING]: 'Profiling & Personalization',
    [ConsentType.THIRD_PARTY_SHARING]: 'Third-Party Sharing',
    [ConsentType.NEWSLETTER]: 'Newsletter',
    [ConsentType.PRODUCT_UPDATES]: 'Product Updates',
  }

  return labels[consentType] || consentType
}

/**
 * Get consent description
 */
export function getConsentDescription(consentType: ConsentType): string {
  const descriptions: Record<ConsentType, string> = {
    [ConsentType.MARKETING]: 'Receive marketing emails and promotional offers',
    [ConsentType.TRACKING]: 'Allow us to track email opens and clicks for analytics',
    [ConsentType.DATA_PROCESSING]: 'Process your data for service improvement',
    [ConsentType.COOKIES]: 'Store cookies for functionality and preferences',
    [ConsentType.PROFILING]: 'Create profiles for personalized experiences',
    [ConsentType.THIRD_PARTY_SHARING]: 'Share data with trusted third parties',
    [ConsentType.NEWSLETTER]: 'Receive our regular newsletter',
    [ConsentType.PRODUCT_UPDATES]: 'Get notified about new features and updates',
  }

  return descriptions[consentType] || ''
}

/**
 * Check if consent is expired
 */
export function isConsentExpired(consentDate: Date, expiryDate?: Date): boolean {
  if (!expiryDate) return false
  return new Date() > expiryDate
}

/**
 * Calculate consent expiry date
 */
export function calculateConsentExpiry(days: number = 365): Date {
  const expiryDate = new Date()
  expiryDate.setDate(expiryDate.getDate() + days)
  return expiryDate
}

/**
 * Validate consent request
 */
export function validateConsentRequest(
  consentType: ConsentType,
  method: ConsentMethod
): { valid: boolean; reason?: string } {
  // Marketing consent must be explicit
  if (consentType === ConsentType.MARKETING && method !== ConsentMethod.EXPLICIT) {
    return {
      valid: false,
      reason: 'Marketing consent must be explicitly given',
    }
  }

  // Third-party sharing requires explicit consent
  if (consentType === ConsentType.THIRD_PARTY_SHARING && method !== ConsentMethod.EXPLICIT) {
    return {
      valid: false,
      reason: 'Third-party sharing consent must be explicitly given',
    }
  }

  return { valid: true }
}

/**
 * Get consent status summary
 */
export async function getConsentSummary(
  workspaceId: string,
  leadId: string
): Promise<{
  hasMarketing: boolean
  hasTracking: boolean
  hasNewsletter: boolean
  hasDataProcessing: boolean
  lastUpdated?: Date
}> {
  const consents = await checkMultipleConsents(workspaceId, leadId, [
    ConsentType.MARKETING,
    ConsentType.TRACKING,
    ConsentType.NEWSLETTER,
    ConsentType.DATA_PROCESSING,
  ])

  const history = await getConsentHistory(workspaceId, leadId)
  const lastUpdated = history.length > 0 
    ? new Date(history[0].created_at)
    : undefined

  return {
    hasMarketing: consents[ConsentType.MARKETING],
    hasTracking: consents[ConsentType.TRACKING],
    hasNewsletter: consents[ConsentType.NEWSLETTER],
    hasDataProcessing: consents[ConsentType.DATA_PROCESSING],
    lastUpdated,
  }
}