interface SpamCheckResult {
  score: number // 0-100, higher = more likely spam
  level: 'low' | 'medium' | 'high'
  issues: SpamIssue[]
  suggestions: string[]
  wordCount: number
  readabilityScore: number
}

interface SpamIssue {
  type: 'content' | 'formatting' | 'links' | 'headers' | 'authentication'
  severity: 'low' | 'medium' | 'high'
  message: string
  field?: string
  value?: string
}

interface EmailContent {
  subject: string
  body: string
  fromName?: string
  fromEmail?: string
  replyTo?: string
  htmlBody?: string
}

export class SpamChecker {
  // Spam trigger words with weights
  private static SPAM_WORDS = {
    high: [
      'free', 'urgent', 'act now', 'limited time', 'click here', 'guarantee',
      'no obligation', 'risk free', 'amazing', 'incredible', 'unbelievable',
      'miracle', 'breakthrough', 'revolutionary', 'secret', 'confidential',
      'congratulations', 'winner', 'selected', 'qualified', 'approved',
      'loan', 'mortgage', 'refinance', 'credit', 'debt', 'investment',
      'viagra', 'casino', 'gambling', 'lottery', 'inheritance', 'nigerian',
      'prince', 'beneficiary', 'million dollars', 'money back', 'refund',
      'make money', 'earn money', 'work from home', 'business opportunity'
    ],
    medium: [
      'offer', 'deal', 'discount', 'save', 'special', 'promotion', 'sale',
      'limited', 'exclusive', 'premium', 'platinum', 'gold', 'silver',
      'bonus', 'gift', 'reward', 'prize', 'contest', 'sweepstakes',
      'call now', 'order now', 'buy now', 'subscribe', 'sign up',
      'register', 'join', 'membership', 'access', 'download',
      'trial', 'demo', 'sample', 'preview', 'test drive'
    ],
    low: [
      'new', 'improved', 'enhanced', 'advanced', 'professional', 'premium',
      'quality', 'best', 'top', 'leading', 'trusted', 'reliable',
      'proven', 'tested', 'certified', 'guaranteed', 'secure', 'safe',
      'fast', 'quick', 'instant', 'immediate', 'easy', 'simple'
    ]
  }

  // Suspicious patterns
  private static SUSPICIOUS_PATTERNS = [
    { pattern: /\$[\d,]+/g, weight: 5, message: 'Contains money amounts' },
    { pattern: /\d+%\s*(off|discount|save)/gi, weight: 10, message: 'Contains percentage discounts' },
    { pattern: /FREE!/gi, weight: 15, message: 'Contains "FREE!" with exclamation' },
    { pattern: /!!!+/g, weight: 10, message: 'Excessive exclamation marks' },
    { pattern: /\?\?\?+/g, weight: 8, message: 'Excessive question marks' },
    { pattern: /[A-Z]{4,}/g, weight: 5, message: 'Excessive capital letters' },
    { pattern: /click\s+here/gi, weight: 12, message: 'Contains "click here"' },
    { pattern: /act\s+now/gi, weight: 15, message: 'Contains "act now"' },
    { pattern: /limited\s+time/gi, weight: 10, message: 'Contains "limited time"' },
    { pattern: /\b\d{1,3}%\b/g, weight: 3, message: 'Contains percentages' }
  ]

  static analyzeSpamScore(content: EmailContent): SpamCheckResult {
    let score = 0
    const issues: SpamIssue[] = []
    const suggestions: string[] = []

    // Analyze subject line
    const subjectScore = this.analyzeText(content.subject, 'subject')
    score += subjectScore.score * 1.5 // Subject line weighted more heavily
    issues.push(...subjectScore.issues)

    // Analyze body content
    const bodyScore = this.analyzeText(content.body, 'body')
    score += bodyScore.score
    issues.push(...bodyScore.issues)

    // Analyze HTML if provided
    if (content.htmlBody) {
      const htmlScore = this.analyzeHTML(content.htmlBody)
      score += htmlScore.score * 0.5
      issues.push(...htmlScore.issues)
    }

    // Check email headers
    const headerScore = this.analyzeHeaders(content)
    score += headerScore.score
    issues.push(...headerScore.issues)

    // Calculate readability
    const readabilityScore = this.calculateReadability(content.body)
    if (readabilityScore < 30) {
      score += 10
      issues.push({
        type: 'content',
        severity: 'medium',
        message: 'Text may be too complex or difficult to read'
      })
    }

    // Word count analysis
    const wordCount = content.body.split(/\s+/).length
    if (wordCount < 50) {
      score += 8
      issues.push({
        type: 'content',
        severity: 'medium',
        message: 'Email is very short, may appear suspicious'
      })
    } else if (wordCount > 1000) {
      score += 5
      issues.push({
        type: 'content',
        severity: 'low',
        message: 'Email is very long, may reduce engagement'
      })
    }

    // Generate suggestions
    suggestions.push(...this.generateSuggestions(issues, score))

    // Determine spam level
    let level: 'low' | 'medium' | 'high'
    if (score < 25) level = 'low'
    else if (score < 60) level = 'medium'
    else level = 'high'

    return {
      score: Math.min(100, Math.round(score)),
      level,
      issues,
      suggestions,
      wordCount,
      readabilityScore: Math.round(readabilityScore)
    }
  }

  private static analyzeText(text: string, field: 'subject' | 'body'): { score: number; issues: SpamIssue[] } {
    let score = 0
    const issues: SpamIssue[] = []
    const lowerText = text.toLowerCase()

    // Check spam words
    for (const [severity, words] of Object.entries(this.SPAM_WORDS)) {
      const weight = severity === 'high' ? 15 : severity === 'medium' ? 8 : 3
      
      for (const word of words) {
        const regex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi')
        const matches = text.match(regex)
        if (matches) {
          const wordScore = weight * matches.length
          score += wordScore
          
          if (wordScore >= 10) {
            issues.push({
              type: 'content',
              severity: severity as 'low' | 'medium' | 'high',
              message: `Contains spam trigger word: "${word}"`,
              field,
              value: word
            })
          }
        }
      }
    }

    // Check suspicious patterns
    for (const pattern of this.SUSPICIOUS_PATTERNS) {
      const matches = text.match(pattern.pattern)
      if (matches) {
        const patternScore = pattern.weight * matches.length
        score += patternScore
        
        issues.push({
          type: 'formatting',
          severity: patternScore > 15 ? 'high' : patternScore > 8 ? 'medium' : 'low',
          message: pattern.message,
          field
        })
      }
    }

    // Subject line specific checks
    if (field === 'subject') {
      if (text.length > 60) {
        score += 5
        issues.push({
          type: 'content',
          severity: 'low',
          message: 'Subject line is too long (over 60 characters)',
          field: 'subject'
        })
      }

      if (text.length < 10) {
        score += 8
        issues.push({
          type: 'content',
          severity: 'medium',
          message: 'Subject line is too short (under 10 characters)',
          field: 'subject'
        })
      }

      // Check for excessive punctuation in subject
      const punctuationCount = (text.match(/[!?.,;:]/g) || []).length
      if (punctuationCount > 3) {
        score += 10
        issues.push({
          type: 'formatting',
          severity: 'medium',
          message: 'Subject line has excessive punctuation',
          field: 'subject'
        })
      }
    }

    return { score, issues }
  }

  private static analyzeHTML(html: string): { score: number; issues: SpamIssue[] } {
    let score = 0
    const issues: SpamIssue[] = []

    // Check for suspicious HTML patterns
    if (html.includes('<!DOCTYPE html>') && !html.includes('<title>')) {
      score += 5
      issues.push({
        type: 'formatting',
        severity: 'low',
        message: 'HTML email missing title tag'
      })
    }

    // Check for too many links
    const linkCount = (html.match(/<a\s+[^>]*href/gi) || []).length
    if (linkCount > 10) {
      score += linkCount * 2
      issues.push({
        type: 'links',
        severity: linkCount > 20 ? 'high' : 'medium',
        message: `Email contains many links (${linkCount}), may appear suspicious`
      })
    }

    // Check for suspicious link patterns
    const suspiciousLinkPatterns = [
      /bit\.ly/gi,
      /tinyurl/gi,
      /t\.co/gi,
      /goo\.gl/gi,
      /ow\.ly/gi
    ]

    for (const pattern of suspiciousLinkPatterns) {
      if (pattern.test(html)) {
        score += 8
        issues.push({
          type: 'links',
          severity: 'medium',
          message: 'Contains shortened URLs, which may be flagged as suspicious'
        })
        break
      }
    }

    // Check for inline CSS excess
    const inlineCssCount = (html.match(/style\s*=/gi) || []).length
    if (inlineCssCount > 20) {
      score += 3
      issues.push({
        type: 'formatting',
        severity: 'low',
        message: 'Excessive inline CSS may increase email size'
      })
    }

    return { score, issues }
  }

  private static analyzeHeaders(content: EmailContent): { score: number; issues: SpamIssue[] } {
    let score = 0
    const issues: SpamIssue[] = []

    // Check from name
    if (content.fromName) {
      if (content.fromName.includes('noreply') || content.fromName.includes('no-reply')) {
        score += 5
        issues.push({
          type: 'headers',
          severity: 'low',
          message: 'From name contains "noreply", may reduce deliverability'
        })
      }

      if (/\d{3,}/.test(content.fromName)) {
        score += 8
        issues.push({
          type: 'headers',
          severity: 'medium',
          message: 'From name contains numbers, may appear suspicious'
        })
      }
    }

    // Check from email format
    if (content.fromEmail) {
      if (!this.isValidEmail(content.fromEmail)) {
        score += 20
        issues.push({
          type: 'headers',
          severity: 'high',
          message: 'From email address appears invalid'
        })
      }

      // Check for suspicious domains
      const suspiciousDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com']
      const domain = content.fromEmail.split('@')[1]?.toLowerCase()
      if (suspiciousDomains.includes(domain)) {
        score += 3
        issues.push({
          type: 'headers',
          severity: 'low',
          message: 'Using personal email domain for business emails may reduce credibility'
        })
      }
    }

    return { score, issues }
  }

  private static calculateReadability(text: string): number {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0)
    const words = text.split(/\s+/).filter(w => w.length > 0)
    const syllables = words.reduce((count, word) => count + this.countSyllables(word), 0)

    if (sentences.length === 0 || words.length === 0) return 0

    // Flesch Reading Ease Score
    const avgWordsPerSentence = words.length / sentences.length
    const avgSyllablesPerWord = syllables / words.length

    return Math.max(0, 206.835 - (1.015 * avgWordsPerSentence) - (84.6 * avgSyllablesPerWord))
  }

  private static countSyllables(word: string): number {
    word = word.toLowerCase()
    if (word.length <= 3) return 1
    
    word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '')
    word = word.replace(/^y/, '')
    
    const matches = word.match(/[aeiouy]{1,2}/g)
    return matches ? matches.length : 1
  }

  private static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  private static generateSuggestions(issues: SpamIssue[], score: number): string[] {
    const suggestions: string[] = []

    if (score > 60) {
      suggestions.push('Consider rewriting the email to reduce spam-like language')
    }

    if (issues.some(i => i.type === 'content' && i.message.includes('spam trigger word'))) {
      suggestions.push('Replace spam trigger words with more professional alternatives')
    }

    if (issues.some(i => i.message.includes('exclamation'))) {
      suggestions.push('Reduce the use of exclamation marks for a more professional tone')
    }

    if (issues.some(i => i.message.includes('capital letters'))) {
      suggestions.push('Use normal capitalization instead of ALL CAPS text')
    }

    if (issues.some(i => i.type === 'links' && i.severity === 'high')) {
      suggestions.push('Reduce the number of links or use full URLs instead of shortened links')
    }

    if (issues.some(i => i.field === 'subject' && i.message.includes('too long'))) {
      suggestions.push('Shorten the subject line to under 60 characters')
    }

    if (issues.some(i => i.message.includes('noreply'))) {
      suggestions.push('Use a real person\'s name and email for better engagement')
    }

    return suggestions
  }

  // Test email deliverability with various providers
  static async testDeliverability(content: EmailContent): Promise<{
    gmail: { score: number; issues: string[] }
    outlook: { score: number; issues: string[] }
    yahoo: { score: number; issues: string[] }
    apple: { score: number; issues: string[] }
  }> {
    const spamResult = this.analyzeSpamScore(content)

    // Provider-specific adjustments
    const gmail = {
      score: Math.max(0, 100 - spamResult.score - this.getGmailPenalty(content)),
      issues: this.getGmailSpecificIssues(content, spamResult)
    }

    const outlook = {
      score: Math.max(0, 100 - spamResult.score - this.getOutlookPenalty(content)),
      issues: this.getOutlookSpecificIssues(content, spamResult)
    }

    const yahoo = {
      score: Math.max(0, 100 - spamResult.score - this.getYahooPenalty(content)),
      issues: this.getYahooSpecificIssues(content, spamResult)
    }

    const apple = {
      score: Math.max(0, 100 - spamResult.score - this.getApplePenalty(content)),
      issues: this.getAppleSpecificIssues(content, spamResult)
    }

    return { gmail, outlook, yahoo, apple }
  }

  private static getGmailPenalty(content: EmailContent): number {
    let penalty = 0
    
    // Gmail is strict about promotional content
    if (content.body.toLowerCase().includes('unsubscribe') && 
        !content.body.toLowerCase().includes('list-unsubscribe')) {
      penalty += 10
    }

    return penalty
  }

  private static getGmailSpecificIssues(content: EmailContent, spamResult: SpamCheckResult): string[] {
    const issues: string[] = []
    
    if (spamResult.score > 40) {
      issues.push('Gmail may flag this email as promotional or spam')
    }
    
    if (!content.body.toLowerCase().includes('unsubscribe')) {
      issues.push('Gmail prefers emails with clear unsubscribe options')
    }

    return issues
  }

  private static getOutlookPenalty(content: EmailContent): number {
    let penalty = 0
    
    // Outlook is sensitive to image-heavy emails
    const imageCount = (content.htmlBody?.match(/<img/gi) || []).length
    if (imageCount > 5) {
      penalty += imageCount * 2
    }

    return penalty
  }

  private static getOutlookSpecificIssues(content: EmailContent, spamResult: SpamCheckResult): string[] {
    const issues: string[] = []
    
    if ((content.htmlBody?.match(/<img/gi) || []).length > 5) {
      issues.push('Outlook may have issues with image-heavy emails')
    }

    return issues
  }

  private static getYahooPenalty(content: EmailContent): number {
    let penalty = 0
    
    // Yahoo is strict about sender reputation
    if (content.fromEmail?.includes('gmail.com') || content.fromEmail?.includes('yahoo.com')) {
      penalty += 5
    }

    return penalty
  }

  private static getYahooSpecificIssues(content: EmailContent, spamResult: SpamCheckResult): string[] {
    const issues: string[] = []
    
    if (spamResult.score > 35) {
      issues.push('Yahoo has strict spam filtering that may block this email')
    }

    return issues
  }

  private static getApplePenalty(content: EmailContent): number {
    let penalty = 0
    
    // Apple Mail privacy features
    if (content.htmlBody?.includes('tracking')) {
      penalty += 5
    }

    return penalty
  }

  private static getAppleSpecificIssues(content: EmailContent, spamResult: SpamCheckResult): string[] {
    const issues: string[] = []
    
    if (content.htmlBody?.includes('tracking')) {
      issues.push('Apple Mail may block tracking pixels and links')
    }

    return issues
  }
}