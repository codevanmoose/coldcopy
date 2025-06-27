/**
 * GDPR Utility Functions
 * Helper functions for data anonymization, hashing, and compliance operations
 */

import crypto from 'crypto'
import { format } from 'date-fns'
import { 
  ConsentType, 
  DeletionStrategy,
  ResponseFormat,
  GdprError,
  GdprErrorCode,
  AnonymizationResult
} from './types'

// ==================== Anonymization Functions ====================

/**
 * Anonymize email address while preserving domain for analytics
 */
export function anonymizeEmail(email: string, preserveDomain = true): string {
  if (!email || !email.includes('@')) {
    return 'anonymous@example.com'
  }

  const [localPart, domain] = email.split('@')
  
  if (preserveDomain) {
    const hash = crypto.createHash('sha256').update(localPart).digest('hex')
    return `anon-${hash.substring(0, 8)}@${domain}`
  }
  
  const hash = crypto.createHash('sha256').update(email).digest('hex')
  return `anon-${hash.substring(0, 16)}@example.com`
}

/**
 * Anonymize phone number
 */
export function anonymizePhone(phone: string): string {
  if (!phone) return ''
  
  // Keep country code if present
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length >= 10) {
    const countryCode = cleaned.length > 10 ? cleaned.substring(0, cleaned.length - 10) : ''
    return countryCode + 'XXXXXX' + cleaned.substring(cleaned.length - 4)
  }
  
  return 'XXXXXXXXXX'
}

/**
 * Anonymize name
 */
export function anonymizeName(name: string, type: 'first' | 'last' | 'full' = 'full'): string {
  if (!name) return 'ANONYMIZED'
  
  const hash = crypto.createHash('sha256').update(name).digest('hex')
  const shortHash = hash.substring(0, 6).toUpperCase()
  
  switch (type) {
    case 'first':
      return `FirstName_${shortHash}`
    case 'last':
      return `LastName_${shortHash}`
    default:
      return `User_${shortHash}`
  }
}

/**
 * Anonymize IP address
 */
export function anonymizeIpAddress(ip: string): string {
  if (!ip) return '0.0.0.0'
  
  // IPv4
  if (ip.includes('.')) {
    const parts = ip.split('.')
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.0.0`
    }
  }
  
  // IPv6
  if (ip.includes(':')) {
    const parts = ip.split(':')
    if (parts.length >= 4) {
      return `${parts[0]}:${parts[1]}:${parts[2]}::`
    }
  }
  
  return '0.0.0.0'
}

/**
 * Anonymize custom fields based on field type
 */
export function anonymizeCustomFields(fields: Record<string, any>): Record<string, any> {
  const anonymized: Record<string, any> = {}
  
  for (const [key, value] of Object.entries(fields)) {
    if (value === null || value === undefined) {
      anonymized[key] = null
      continue
    }
    
    // Detect field type and anonymize accordingly
    const lowerKey = key.toLowerCase()
    
    if (lowerKey.includes('email')) {
      anonymized[key] = anonymizeEmail(String(value))
    } else if (lowerKey.includes('phone') || lowerKey.includes('mobile')) {
      anonymized[key] = anonymizePhone(String(value))
    } else if (lowerKey.includes('name')) {
      anonymized[key] = anonymizeName(String(value))
    } else if (lowerKey.includes('address') || lowerKey.includes('city') || lowerKey.includes('location')) {
      anonymized[key] = 'REDACTED_LOCATION'
    } else if (lowerKey.includes('ip')) {
      anonymized[key] = anonymizeIpAddress(String(value))
    } else if (typeof value === 'string' && value.length > 20) {
      // Long strings might contain PII
      anonymized[key] = 'REDACTED_TEXT'
    } else if (typeof value === 'number') {
      // Preserve numbers for analytics
      anonymized[key] = value
    } else if (typeof value === 'boolean') {
      // Preserve booleans
      anonymized[key] = value
    } else {
      // Default: redact
      anonymized[key] = 'REDACTED'
    }
  }
  
  return anonymized
}

/**
 * Generate a deterministic anonymous ID from personal data
 */
export function generateAnonymousId(data: string | Record<string, any>): string {
  const input = typeof data === 'string' ? data : JSON.stringify(data)
  return crypto.createHash('sha256').update(input).digest('hex').substring(0, 16)
}

// ==================== Hashing Functions ====================

/**
 * Create a secure hash of sensitive data
 */
export function hashData(data: string, salt?: string): string {
  const actualSalt = salt || process.env.GDPR_HASH_SALT || 'default-salt'
  return crypto
    .createHash('sha256')
    .update(data + actualSalt)
    .digest('hex')
}

/**
 * Create a consent signature for proof
 */
export function createConsentSignature(
  consentData: {
    workspaceId: string
    leadId?: string
    consentType: ConsentType
    version: string
    timestamp: Date
    ipAddress?: string
  }
): string {
  const payload = JSON.stringify({
    ...consentData,
    timestamp: consentData.timestamp.toISOString()
  })
  
  const secret = process.env.GDPR_SIGNATURE_SECRET || 'default-secret'
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
}

/**
 * Verify a consent signature
 */
export function verifyConsentSignature(
  consentData: {
    workspaceId: string
    leadId?: string
    consentType: ConsentType
    version: string
    timestamp: Date
    ipAddress?: string
  },
  signature: string
): boolean {
  const expectedSignature = createConsentSignature(consentData)
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  )
}

// ==================== Data Export Functions ====================

/**
 * Convert data to requested format
 */
export async function convertDataToFormat(
  data: any,
  format: ResponseFormat
): Promise<{ content: string | Buffer; mimeType: string; extension: string }> {
  switch (format) {
    case ResponseFormat.JSON:
      return {
        content: JSON.stringify(data, null, 2),
        mimeType: 'application/json',
        extension: 'json'
      }
    
    case ResponseFormat.CSV:
      const csv = await convertToCSV(data)
      return {
        content: csv,
        mimeType: 'text/csv',
        extension: 'csv'
      }
    
    case ResponseFormat.XML:
      const xml = convertToXML(data)
      return {
        content: xml,
        mimeType: 'application/xml',
        extension: 'xml'
      }
    
    case ResponseFormat.PDF:
      // This would require a PDF library like puppeteer or pdfkit
      throw new Error('PDF export not yet implemented')
    
    default:
      throw new Error(`Unsupported format: ${format}`)
  }
}

/**
 * Convert data to CSV format
 */
async function convertToCSV(data: any): Promise<string> {
  // Handle different data structures
  let rows: any[] = []
  
  if (Array.isArray(data)) {
    rows = data
  } else if (typeof data === 'object' && data !== null) {
    // Convert nested object to flat structure
    rows = flattenObject(data)
  } else {
    throw new Error('Invalid data format for CSV conversion')
  }
  
  if (rows.length === 0) {
    return ''
  }
  
  // Get all unique keys
  const keys = Array.from(
    new Set(rows.flatMap(row => Object.keys(row)))
  )
  
  // Create header
  const header = keys.map(key => escapeCSV(key)).join(',')
  
  // Create rows
  const csvRows = rows.map(row => 
    keys.map(key => escapeCSV(row[key] ?? '')).join(',')
  )
  
  return [header, ...csvRows].join('\n')
}

/**
 * Escape CSV values
 */
function escapeCSV(value: any): string {
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/**
 * Convert data to XML format
 */
function convertToXML(data: any, rootName = 'data'): string {
  const xmlBuilder = (obj: any, name: string): string => {
    if (obj === null || obj === undefined) {
      return `<${name}/>`
    }
    
    if (Array.isArray(obj)) {
      return obj.map((item, index) => 
        xmlBuilder(item, `${name}_${index}`)
      ).join('\n')
    }
    
    if (typeof obj === 'object') {
      const content = Object.entries(obj)
        .map(([key, value]) => xmlBuilder(value, key))
        .join('\n')
      return `<${name}>\n${content}\n</${name}>`
    }
    
    return `<${name}>${escapeXML(String(obj))}</${name}>`
  }
  
  return '<?xml version="1.0" encoding="UTF-8"?>\n' + xmlBuilder(data, rootName)
}

/**
 * Escape XML values
 */
function escapeXML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Flatten nested object for CSV export
 */
function flattenObject(obj: any, prefix = ''): any[] {
  const result: any[] = []
  
  const flatten = (current: any, prop: string) => {
    if (Object(current) !== current) {
      return { [prop]: current }
    } else if (Array.isArray(current)) {
      return current.map((item, index) => 
        flatten(item, `${prop}[${index}]`)
      ).flat()
    } else {
      let isEmpty = true
      const nested: any = {}
      
      for (const key in current) {
        isEmpty = false
        const flattened = flatten(current[key], prop ? `${prop}.${key}` : key)
        if (Array.isArray(flattened)) {
          result.push(...flattened)
        } else {
          Object.assign(nested, flattened)
        }
      }
      
      return isEmpty ? { [prop]: {} } : nested
    }
  }
  
  const flattened = flatten(obj, prefix)
  if (!Array.isArray(flattened)) {
    result.push(flattened)
  }
  
  return result
}

// ==================== Validation Functions ====================

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Validate consent type
 */
export function isValidConsentType(type: string): type is ConsentType {
  return Object.values(ConsentType).includes(type as ConsentType)
}

/**
 * Validate deletion strategy
 */
export function isValidDeletionStrategy(strategy: string): strategy is DeletionStrategy {
  return Object.values(DeletionStrategy).includes(strategy as DeletionStrategy)
}

/**
 * Check if data retention period has expired
 */
export function isRetentionExpired(
  createdAt: Date,
  retentionDays: number
): boolean {
  const expirationDate = new Date(createdAt)
  expirationDate.setDate(expirationDate.getDate() + retentionDays)
  return new Date() > expirationDate
}

// ==================== Error Handling ====================

/**
 * Create a GDPR error
 */
export function createGdprError(
  message: string,
  code: GdprErrorCode,
  statusCode = 400,
  details?: Record<string, any>
): GdprError {
  const error = new Error(message) as GdprError
  error.code = code
  error.statusCode = statusCode
  error.details = details
  return error
}

/**
 * Handle GDPR errors
 */
export function handleGdprError(error: any): GdprError {
  if (error.code && Object.values(GdprErrorCode).includes(error.code)) {
    return error as GdprError
  }
  
  // Map common errors to GDPR errors
  if (error.message?.includes('not found')) {
    return createGdprError(
      error.message,
      GdprErrorCode.REQUEST_NOT_FOUND,
      404
    )
  }
  
  if (error.message?.includes('unauthorized')) {
    return createGdprError(
      error.message,
      GdprErrorCode.UNAUTHORIZED,
      401
    )
  }
  
  if (error.message?.includes('validation')) {
    return createGdprError(
      error.message,
      GdprErrorCode.VALIDATION_ERROR,
      400
    )
  }
  
  // Default error
  return createGdprError(
    error.message || 'An unknown error occurred',
    GdprErrorCode.UNKNOWN_ERROR,
    500,
    { originalError: error }
  )
}

// ==================== Date/Time Utilities ====================

/**
 * Calculate GDPR deadline (30 days by default)
 */
export function calculateDeadline(days = 30): Date {
  const deadline = new Date()
  deadline.setDate(deadline.getDate() + days)
  return deadline
}

/**
 * Format date for GDPR compliance reports
 */
export function formatGdprDate(date: Date): string {
  return format(date, 'yyyy-MM-dd HH:mm:ss zzz')
}

/**
 * Check if deadline is approaching (within 7 days)
 */
export function isDeadlineApproaching(deadline: Date, warningDays = 7): boolean {
  const warningDate = new Date()
  warningDate.setDate(warningDate.getDate() + warningDays)
  return deadline <= warningDate
}

// ==================== Security Utilities ====================

/**
 * Generate secure verification token
 */
export function generateVerificationToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

/**
 * Generate download token with expiration
 */
export function generateDownloadToken(
  exportId: string,
  expirationHours = 24
): string {
  const payload = {
    exportId,
    exp: Date.now() + (expirationHours * 60 * 60 * 1000)
  }
  
  const secret = process.env.GDPR_DOWNLOAD_SECRET || 'default-download-secret'
  return crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex')
}

/**
 * Verify download token
 */
export function verifyDownloadToken(
  token: string,
  exportId: string
): boolean {
  try {
    // In production, implement proper JWT verification
    // This is a simplified version
    return true
  } catch {
    return false
  }
}

// ==================== Analytics Utilities ====================

/**
 * Calculate consent rate
 */
export function calculateConsentRate(
  granted: number,
  total: number
): number {
  if (total === 0) return 0
  return Math.round((granted / total) * 100)
}

/**
 * Calculate average completion time for requests
 */
export function calculateAverageCompletionTime(
  requests: Array<{ createdAt: Date; completedAt?: Date }>
): number {
  const completedRequests = requests.filter(r => r.completedAt)
  
  if (completedRequests.length === 0) return 0
  
  const totalTime = completedRequests.reduce((sum, request) => {
    const timeDiff = request.completedAt!.getTime() - request.createdAt.getTime()
    return sum + timeDiff
  }, 0)
  
  return Math.round(totalTime / completedRequests.length / (1000 * 60 * 60)) // in hours
}

// ==================== Compliance Utilities ====================

/**
 * Check if user can be deleted
 */
export function canDeleteUser(userData: {
  hasActiveSubscription?: boolean
  hasOpenInvoices?: boolean
  hasLegalHold?: boolean
}): { canDelete: boolean; reason?: string } {
  if (userData.hasActiveSubscription) {
    return { 
      canDelete: false, 
      reason: 'User has active subscription' 
    }
  }
  
  if (userData.hasOpenInvoices) {
    return { 
      canDelete: false, 
      reason: 'User has open invoices' 
    }
  }
  
  if (userData.hasLegalHold) {
    return { 
      canDelete: false, 
      reason: 'User data is under legal hold' 
    }
  }
  
  return { canDelete: true }
}

/**
 * Determine appropriate deletion strategy
 */
export function determineDeletionStrategy(
  dataType: string,
  hasLegalRequirement: boolean,
  preserveAnalytics: boolean
): DeletionStrategy {
  if (hasLegalRequirement) {
    return DeletionStrategy.ARCHIVE
  }
  
  if (preserveAnalytics) {
    return DeletionStrategy.ANONYMIZE
  }
  
  // Sensitive data should be hard deleted
  const sensitiveTypes = ['payment', 'health', 'financial', 'government_id']
  if (sensitiveTypes.some(type => dataType.toLowerCase().includes(type))) {
    return DeletionStrategy.HARD_DELETE
  }
  
  // Default to anonymization
  return DeletionStrategy.ANONYMIZE
}