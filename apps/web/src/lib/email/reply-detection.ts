import { createHash } from 'crypto'

/**
 * Extract the original message from a reply
 * Handles common reply patterns and quoted text
 */
export function extractReplyContent(emailBody: string): {
  replyContent: string
  quotedContent: string
  isReply: boolean
} {
  // Common reply indicators
  const replyPatterns = [
    /^-+\s*Original Message\s*-+/im,
    /^On\s.+wrote:$/im,
    /^From:\s*.+$/im,
    /^>\s*.+/m, // Quoted text with >
    /^_{3,}/m, // Underscores separator
    /^-{3,}/m, // Dashes separator
    /^={3,}/m, // Equals separator
    /^#+ Begin forwarded message/im,
    /^Sent from my iPhone/im,
    /^Sent from my Android/im,
    /^Get Outlook for/im,
  ]

  let replyContent = emailBody
  let quotedContent = ''
  let isReply = false

  // Find the earliest reply indicator
  let earliestIndex = emailBody.length
  for (const pattern of replyPatterns) {
    const match = emailBody.match(pattern)
    if (match && match.index !== undefined && match.index < earliestIndex) {
      earliestIndex = match.index
      isReply = true
    }
  }

  if (isReply && earliestIndex < emailBody.length) {
    replyContent = emailBody.substring(0, earliestIndex).trim()
    quotedContent = emailBody.substring(earliestIndex).trim()
  }

  // Remove email signatures
  const signaturePatterns = [
    /^--\s*$/m, // Standard signature delimiter
    /^Best regards,?$/im,
    /^Kind regards,?$/im,
    /^Regards,?$/im,
    /^Thanks,?$/im,
    /^Thank you,?$/im,
    /^Sincerely,?$/im,
    /^Cheers,?$/im,
  ]

  for (const pattern of signaturePatterns) {
    const match = replyContent.match(pattern)
    if (match && match.index !== undefined) {
      replyContent = replyContent.substring(0, match.index).trim()
      break
    }
  }

  return { replyContent, quotedContent, isReply }
}

/**
 * Parse email headers to find threading information
 */
export function parseEmailHeaders(headers: Record<string, string>): {
  messageId?: string
  inReplyTo?: string
  references?: string[]
  subject?: string
} {
  return {
    messageId: headers['message-id'] || headers['Message-ID'],
    inReplyTo: headers['in-reply-to'] || headers['In-Reply-To'],
    references: headers['references'] || headers['References'] 
      ? (headers['references'] || headers['References']).split(/\s+/).filter(Boolean)
      : undefined,
    subject: headers['subject'] || headers['Subject'],
  }
}

/**
 * Extract email addresses from a string (handles "Name <email@example.com>" format)
 */
export function extractEmailAddresses(input: string): string[] {
  const emailRegex = /(?:[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g
  const matches = input.match(emailRegex) || []
  return [...new Set(matches)] // Remove duplicates
}

/**
 * Normalize subject line for comparison (removes Re:, Fwd:, etc.)
 */
export function normalizeSubject(subject: string): string {
  return subject
    .replace(/^(Re:|RE:|Fwd:|FWD:|Fw:|FW:)\s*/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

/**
 * Generate a thread ID based on subject and participants
 */
export function generateThreadId(
  subject: string,
  participants: string[]
): string {
  const normalizedSubject = normalizeSubject(subject)
  const sortedParticipants = [...participants].sort().join(',')
  const data = `${normalizedSubject}:${sortedParticipants}`
  
  return createHash('sha256')
    .update(data)
    .digest('hex')
    .substring(0, 16)
}

/**
 * Check if an email is an auto-reply or out-of-office message
 */
export function isAutoReply(headers: Record<string, string>, body: string): boolean {
  // Check headers for auto-reply indicators
  const autoReplyHeaders = [
    'auto-submitted',
    'x-autoreply',
    'x-autoresponder',
    'x-autorespond',
    'precedence',
  ]

  for (const header of autoReplyHeaders) {
    const value = headers[header] || headers[header.toLowerCase()]
    if (value && value !== 'no' && value !== 'bulk') {
      return true
    }
  }

  // Check subject for auto-reply indicators
  const subject = headers['subject'] || headers['Subject'] || ''
  const autoReplySubjectPatterns = [
    /out of office/i,
    /automatic reply/i,
    /autoreply/i,
    /auto-reply/i,
    /away from office/i,
    /on vacation/i,
    /currently unavailable/i,
  ]

  for (const pattern of autoReplySubjectPatterns) {
    if (pattern.test(subject)) {
      return true
    }
  }

  // Check body for auto-reply indicators
  const autoReplyBodyPatterns = [
    /I am out of the office/i,
    /I will be out of the office/i,
    /This is an automatic reply/i,
    /This is an automated response/i,
    /currently unavailable/i,
    /away from my desk/i,
  ]

  const bodyStart = body.substring(0, 500) // Check first 500 chars
  for (const pattern of autoReplyBodyPatterns) {
    if (pattern.test(bodyStart)) {
      return true
    }
  }

  return false
}

/**
 * Detect if email is a bounce notification
 */
export function isBounceNotification(
  headers: Record<string, string>,
  fromEmail: string
): boolean {
  // Common bounce email patterns
  const bounceEmailPatterns = [
    /^mailer-daemon@/i,
    /^postmaster@/i,
    /^nobody@/i,
    /^noreply@/i,
    /^no-reply@/i,
    /^bounce.*@/i,
    /^return.*@/i,
  ]

  for (const pattern of bounceEmailPatterns) {
    if (pattern.test(fromEmail)) {
      return true
    }
  }

  // Check for bounce headers
  const bounceHeaders = [
    'x-failed-recipients',
    'x-actual-recipient',
    'action',
    'diagnostic-code',
    'status',
  ]

  for (const header of bounceHeaders) {
    if (headers[header] || headers[header.toLowerCase()]) {
      return true
    }
  }

  const subject = headers['subject'] || headers['Subject'] || ''
  const bounceSubjectPatterns = [
    /delivery.*failed/i,
    /returned mail/i,
    /undeliverable/i,
    /mail delivery failed/i,
    /delivery status notification/i,
    /bounce notification/i,
    /failure notice/i,
  ]

  for (const pattern of bounceSubjectPatterns) {
    if (pattern.test(subject)) {
      return true
    }
  }

  return false
}

/**
 * Score the likelihood that this is a genuine human reply
 */
export function calculateReplyScore(
  emailContent: string,
  headers: Record<string, string>
): number {
  let score = 50 // Start with neutral score

  const { replyContent, isReply } = extractReplyContent(emailContent)
  
  // Is it actually a reply?
  if (isReply) score += 20
  
  // Length of reply content
  const contentLength = replyContent.length
  if (contentLength > 50 && contentLength < 5000) score += 15
  else if (contentLength > 5000) score -= 10
  else if (contentLength < 20) score -= 20
  
  // Contains question marks (indicates engagement)
  if (replyContent.includes('?')) score += 10
  
  // Contains personal pronouns
  const personalPronouns = /\b(I|me|my|we|our|you|your)\b/gi
  const pronounMatches = replyContent.match(personalPronouns) || []
  score += Math.min(pronounMatches.length * 2, 15)
  
  // Auto-reply detection
  if (isAutoReply(headers, emailContent)) score -= 40
  
  // Bounce detection
  const fromEmail = extractEmailAddresses(headers['from'] || headers['From'] || '')[0] || ''
  if (isBounceNotification(headers, fromEmail)) score -= 50
  
  // Has proper capitalization (not all caps or all lowercase)
  const hasProperCase = /[a-z]/.test(replyContent) && /[A-Z]/.test(replyContent)
  if (hasProperCase) score += 5
  
  // Contains spam indicators
  const spamPatterns = [
    /click here/i,
    /unsubscribe/i,
    /viagra/i,
    /lottery/i,
    /winner/i,
    /free money/i,
    /act now/i,
  ]
  
  for (const pattern of spamPatterns) {
    if (pattern.test(replyContent)) {
      score -= 15
      break
    }
  }
  
  return Math.max(0, Math.min(100, score))
}