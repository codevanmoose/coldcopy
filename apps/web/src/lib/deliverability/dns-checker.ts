interface DNSAuthResult {
  domain: string
  spf: SPFResult
  dkim: DKIMResult
  dmarc: DMARCResult
  mxRecords: MXRecord[]
  overallScore: number
  recommendations: string[]
  lastChecked: string
}

interface SPFResult {
  isValid: boolean
  record: string | null
  mechanisms: string[]
  issues: string[]
  score: number
  recommendation: string
}

interface DKIMResult {
  isValid: boolean
  selector: string | null
  record: string | null
  issues: string[]
  score: number
  recommendation: string
}

interface DMARCResult {
  isValid: boolean
  record: string | null
  policy: 'none' | 'quarantine' | 'reject' | null
  alignment: {
    spf: 'strict' | 'relaxed' | null
    dkim: 'strict' | 'relaxed' | null
  }
  reportingEmails: string[]
  issues: string[]
  score: number
  recommendation: string
}

interface MXRecord {
  priority: number
  exchange: string
  isValid: boolean
}

export class DNSChecker {
  // Common DKIM selectors to check
  private static COMMON_DKIM_SELECTORS = [
    'default',
    'selector1',
    'selector2',
    'google',
    'k1',
    's1',
    's2',
    'mail',
    'email',
    'dkim',
    'key1',
    'key2',
    'mx',
    'smtp'
  ]

  static async checkDomainAuthentication(domain: string): Promise<DNSAuthResult> {
    console.log(`Checking DNS authentication for domain: ${domain}`)

    try {
      const [spf, dkim, dmarc, mxRecords] = await Promise.all([
        this.checkSPF(domain),
        this.checkDKIM(domain),
        this.checkDMARC(domain),
        this.checkMXRecords(domain)
      ])

      const overallScore = this.calculateOverallScore(spf, dkim, dmarc, mxRecords)
      const recommendations = this.generateRecommendations(spf, dkim, dmarc, mxRecords)

      return {
        domain,
        spf,
        dkim,
        dmarc,
        mxRecords,
        overallScore,
        recommendations,
        lastChecked: new Date().toISOString()
      }
    } catch (error) {
      console.error('Error checking domain authentication:', error)
      throw new Error(`Failed to check DNS authentication for ${domain}`)
    }
  }

  private static async checkSPF(domain: string): Promise<SPFResult> {
    try {
      // In a real implementation, this would use actual DNS resolution
      // For now, we'll simulate the logic
      const spfRecord = await this.lookupTXTRecord(domain, 'v=spf1')

      if (!spfRecord) {
        return {
          isValid: false,
          record: null,
          mechanisms: [],
          issues: ['No SPF record found'],
          score: 0,
          recommendation: 'Add an SPF record to authorize email senders for your domain'
        }
      }

      const mechanisms = this.parseSPFMechanisms(spfRecord)
      const issues = this.validateSPFRecord(spfRecord, mechanisms)
      const score = this.calculateSPFScore(spfRecord, mechanisms, issues)

      return {
        isValid: issues.length === 0,
        record: spfRecord,
        mechanisms,
        issues,
        score,
        recommendation: this.getSPFRecommendation(issues, mechanisms)
      }
    } catch (error) {
      return {
        isValid: false,
        record: null,
        mechanisms: [],
        issues: ['Error checking SPF record'],
        score: 0,
        recommendation: 'Unable to check SPF record. Please verify DNS configuration.'
      }
    }
  }

  private static async checkDKIM(domain: string): Promise<DKIMResult> {
    try {
      // Try to find DKIM records using common selectors
      for (const selector of this.COMMON_DKIM_SELECTORS) {
        const dkimRecord = await this.lookupTXTRecord(`${selector}._domainkey.${domain}`, 'v=DKIM1')
        
        if (dkimRecord) {
          const issues = this.validateDKIMRecord(dkimRecord)
          const score = this.calculateDKIMScore(dkimRecord, issues)

          return {
            isValid: issues.length === 0,
            selector,
            record: dkimRecord,
            issues,
            score,
            recommendation: this.getDKIMRecommendation(issues)
          }
        }
      }

      return {
        isValid: false,
        selector: null,
        record: null,
        issues: ['No DKIM record found with common selectors'],
        score: 0,
        recommendation: 'Configure DKIM signing for your domain to improve email authentication'
      }
    } catch (error) {
      return {
        isValid: false,
        selector: null,
        record: null,
        issues: ['Error checking DKIM record'],
        score: 0,
        recommendation: 'Unable to check DKIM record. Please verify DNS configuration.'
      }
    }
  }

  private static async checkDMARC(domain: string): Promise<DMARCResult> {
    try {
      const dmarcRecord = await this.lookupTXTRecord(`_dmarc.${domain}`, 'v=DMARC1')

      if (!dmarcRecord) {
        return {
          isValid: false,
          record: null,
          policy: null,
          alignment: { spf: null, dkim: null },
          reportingEmails: [],
          issues: ['No DMARC record found'],
          score: 0,
          recommendation: 'Add a DMARC record to specify how to handle authentication failures'
        }
      }

      const policy = this.parseDMARCPolicy(dmarcRecord)
      const alignment = this.parseDMARCAlignment(dmarcRecord)
      const reportingEmails = this.parseDMARCReporting(dmarcRecord)
      const issues = this.validateDMARCRecord(dmarcRecord, policy)
      const score = this.calculateDMARCScore(dmarcRecord, policy, issues)

      return {
        isValid: issues.length === 0,
        record: dmarcRecord,
        policy,
        alignment,
        reportingEmails,
        issues,
        score,
        recommendation: this.getDMARCRecommendation(issues, policy)
      }
    } catch (error) {
      return {
        isValid: false,
        record: null,
        policy: null,
        alignment: { spf: null, dkim: null },
        reportingEmails: [],
        issues: ['Error checking DMARC record'],
        score: 0,
        recommendation: 'Unable to check DMARC record. Please verify DNS configuration.'
      }
    }
  }

  private static async checkMXRecords(domain: string): Promise<MXRecord[]> {
    try {
      // In a real implementation, this would use actual DNS resolution
      // Simulating MX record lookup
      const mxRecords = await this.lookupMXRecords(domain)
      
      return mxRecords.map(record => ({
        ...record,
        isValid: this.validateMXRecord(record)
      }))
    } catch (error) {
      console.error('Error checking MX records:', error)
      return []
    }
  }

  // DNS lookup simulation methods (in real implementation, use dns.promises)
  private static async lookupTXTRecord(domain: string, prefix: string): Promise<string | null> {
    // Simulate DNS TXT record lookup
    // In real implementation: const records = await dns.promises.resolveTxt(domain)
    
    // Mock SPF records for common domains
    const mockRecords: { [key: string]: string } = {
      'example.com': 'v=spf1 include:_spf.google.com ~all',
      'gmail.com': 'v=spf1 redirect=_spf.google.com',
      '_dmarc.example.com': 'v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com',
      'default._domainkey.example.com': 'v=DKIM1; k=rsa; p=MIGfMA0GCS...'
    }

    const record = mockRecords[domain]
    return record && record.startsWith(prefix) ? record : null
  }

  private static async lookupMXRecords(domain: string): Promise<{ priority: number; exchange: string }[]> {
    // Simulate MX record lookup
    // In real implementation: const records = await dns.promises.resolveMx(domain)
    
    const mockMXRecords: { [key: string]: { priority: number; exchange: string }[] } = {
      'example.com': [
        { priority: 10, exchange: 'mail.example.com' },
        { priority: 20, exchange: 'mail2.example.com' }
      ],
      'gmail.com': [
        { priority: 5, exchange: 'gmail-smtp-in.l.google.com' },
        { priority: 10, exchange: 'alt1.gmail-smtp-in.l.google.com' }
      ]
    }

    return mockMXRecords[domain] || []
  }

  private static parseSPFMechanisms(spfRecord: string): string[] {
    const mechanisms: string[] = []
    const parts = spfRecord.split(/\s+/)

    for (const part of parts) {
      if (part.match(/^[+\-~?]?(all|include|a|mx|ptr|ip4|ip6|exists):/)) {
        mechanisms.push(part)
      } else if (part === 'all' || part.match(/^[+\-~?]all$/)) {
        mechanisms.push(part)
      }
    }

    return mechanisms
  }

  private static validateSPFRecord(spfRecord: string, mechanisms: string[]): string[] {
    const issues: string[] = []

    // Check for common SPF issues
    if (!spfRecord.startsWith('v=spf1')) {
      issues.push('SPF record must start with "v=spf1"')
    }

    if (mechanisms.length === 0) {
      issues.push('SPF record contains no mechanisms')
    }

    // Check for 'all' mechanism
    const hasAll = mechanisms.some(m => m.match(/[+\-~?]?all$/))
    if (!hasAll) {
      issues.push('SPF record should end with an "all" mechanism')
    }

    // Check for too many DNS lookups (SPF has a 10 lookup limit)
    const lookupMechanisms = mechanisms.filter(m => 
      m.match(/^[+\-~?]?(include|a|mx|exists):/) || m.match(/^[+\-~?]?(a|mx)$/)
    )
    if (lookupMechanisms.length > 10) {
      issues.push('SPF record may exceed DNS lookup limit (10)')
    }

    // Check for syntax errors
    if (spfRecord.includes('++') || spfRecord.includes('--')) {
      issues.push('SPF record contains syntax errors')
    }

    return issues
  }

  private static calculateSPFScore(spfRecord: string, mechanisms: string[], issues: string[]): number {
    let score = 0

    // Base score for having SPF
    score += 40

    // Bonus for proper mechanisms
    if (mechanisms.some(m => m.includes('include:'))) score += 20
    if (mechanisms.some(m => m.match(/[~\-]all$/))) score += 20
    if (mechanisms.some(m => m.includes('ip4:') || m.includes('ip6:'))) score += 10

    // Penalties for issues
    score -= issues.length * 10

    return Math.max(0, Math.min(100, score))
  }

  private static getSPFRecommendation(issues: string[], mechanisms: string[]): string {
    if (issues.length === 0) {
      return 'SPF record is properly configured'
    }

    const recommendations = []
    
    if (issues.some(i => i.includes('no mechanisms'))) {
      recommendations.push('Add proper SPF mechanisms (include, ip4, ip6, etc.)')
    }
    
    if (issues.some(i => i.includes('all'))) {
      recommendations.push('Add an "all" mechanism at the end (recommended: "~all")')
    }
    
    if (issues.some(i => i.includes('lookup limit'))) {
      recommendations.push('Reduce DNS lookups by consolidating include mechanisms')
    }

    return recommendations.join('; ') || 'Fix SPF record syntax and structure'
  }

  private static validateDKIMRecord(dkimRecord: string): string[] {
    const issues: string[] = []

    if (!dkimRecord.startsWith('v=DKIM1')) {
      issues.push('DKIM record must start with "v=DKIM1"')
    }

    if (!dkimRecord.includes('p=')) {
      issues.push('DKIM record must contain public key (p=)')
    }

    // Check for empty public key
    const pubKeyMatch = dkimRecord.match(/p=([^;]+)/)
    if (pubKeyMatch && pubKeyMatch[1].trim() === '') {
      issues.push('DKIM public key is empty (revoked key)')
    }

    return issues
  }

  private static calculateDKIMScore(dkimRecord: string, issues: string[]): number {
    let score = 0

    // Base score for having DKIM
    score += 50

    // Bonus for proper configuration
    if (dkimRecord.includes('k=rsa')) score += 20
    if (dkimRecord.includes('t=s')) score += 10 // Strict mode
    if (dkimRecord.match(/p=[A-Za-z0-9+/]{100,}/)) score += 20 // Long key

    // Penalties for issues
    score -= issues.length * 15

    return Math.max(0, Math.min(100, score))
  }

  private static getDKIMRecommendation(issues: string[]): string {
    if (issues.length === 0) {
      return 'DKIM record is properly configured'
    }

    return 'Fix DKIM record syntax and ensure public key is valid'
  }

  private static parseDMARCPolicy(dmarcRecord: string): 'none' | 'quarantine' | 'reject' | null {
    const policyMatch = dmarcRecord.match(/p=(none|quarantine|reject)/)
    return policyMatch ? policyMatch[1] as 'none' | 'quarantine' | 'reject' : null
  }

  private static parseDMARCAlignment(dmarcRecord: string): { spf: 'strict' | 'relaxed' | null; dkim: 'strict' | 'relaxed' | null } {
    const spfMatch = dmarcRecord.match(/aspf=(s|r)/)
    const dkimMatch = dmarcRecord.match(/adkim=(s|r)/)

    return {
      spf: spfMatch ? (spfMatch[1] === 's' ? 'strict' : 'relaxed') : null,
      dkim: dkimMatch ? (dkimMatch[1] === 's' ? 'strict' : 'relaxed') : null
    }
  }

  private static parseDMARCReporting(dmarcRecord: string): string[] {
    const emails: string[] = []
    
    // Aggregate reports
    const ruaMatch = dmarcRecord.match(/rua=([^;]+)/)
    if (ruaMatch) {
      const ruaEmails = ruaMatch[1].split(',').map(email => 
        email.trim().replace('mailto:', '')
      )
      emails.push(...ruaEmails)
    }

    // Forensic reports
    const rufMatch = dmarcRecord.match(/ruf=([^;]+)/)
    if (rufMatch) {
      const rufEmails = rufMatch[1].split(',').map(email => 
        email.trim().replace('mailto:', '')
      )
      emails.push(...rufEmails)
    }

    return [...new Set(emails)] // Remove duplicates
  }

  private static validateDMARCRecord(dmarcRecord: string, policy: string | null): string[] {
    const issues: string[] = []

    if (!dmarcRecord.startsWith('v=DMARC1')) {
      issues.push('DMARC record must start with "v=DMARC1"')
    }

    if (!policy) {
      issues.push('DMARC record must specify a policy (p=)')
    }

    if (policy === 'none') {
      issues.push('DMARC policy is set to "none" - no protection against spoofing')
    }

    // Check for reporting configuration
    if (!dmarcRecord.includes('rua=') && !dmarcRecord.includes('ruf=')) {
      issues.push('DMARC record should include reporting email addresses (rua= or ruf=)')
    }

    return issues
  }

  private static calculateDMARCScore(dmarcRecord: string, policy: string | null, issues: string[]): number {
    let score = 0

    // Base score for having DMARC
    score += 30

    // Policy scoring
    if (policy === 'reject') score += 40
    else if (policy === 'quarantine') score += 30
    else if (policy === 'none') score += 10

    // Reporting configuration
    if (dmarcRecord.includes('rua=')) score += 15
    if (dmarcRecord.includes('ruf=')) score += 10

    // Alignment configuration
    if (dmarcRecord.includes('aspf=s')) score += 5
    if (dmarcRecord.includes('adkim=s')) score += 5

    // Penalties for issues
    score -= issues.length * 10

    return Math.max(0, Math.min(100, score))
  }

  private static getDMARCRecommendation(issues: string[], policy: string | null): string {
    if (issues.length === 0 && policy === 'reject') {
      return 'DMARC record is optimally configured'
    }

    const recommendations = []

    if (policy === 'none') {
      recommendations.push('Upgrade DMARC policy to "quarantine" or "reject"')
    } else if (policy === 'quarantine') {
      recommendations.push('Consider upgrading to "reject" policy for maximum protection')
    }

    if (issues.some(i => i.includes('reporting'))) {
      recommendations.push('Add reporting email addresses to receive DMARC reports')
    }

    return recommendations.join('; ') || 'Fix DMARC record configuration'
  }

  private static validateMXRecord(record: { priority: number; exchange: string }): boolean {
    return record.priority >= 0 && record.exchange.length > 0 && record.exchange.includes('.')
  }

  private static calculateOverallScore(
    spf: SPFResult, 
    dkim: DKIMResult, 
    dmarc: DMARCResult, 
    mxRecords: MXRecord[]
  ): number {
    const spfWeight = 0.3
    const dkimWeight = 0.3
    const dmarcWeight = 0.35
    const mxWeight = 0.05

    const mxScore = mxRecords.length > 0 && mxRecords.every(mx => mx.isValid) ? 100 : 0

    return Math.round(
      spf.score * spfWeight +
      dkim.score * dkimWeight +
      dmarc.score * dmarcWeight +
      mxScore * mxWeight
    )
  }

  private static generateRecommendations(
    spf: SPFResult, 
    dkim: DKIMResult, 
    dmarc: DMARCResult, 
    mxRecords: MXRecord[]
  ): string[] {
    const recommendations: string[] = []

    // Priority recommendations
    if (!spf.isValid) {
      recommendations.push('🔴 HIGH: ' + spf.recommendation)
    }

    if (!dkim.isValid) {
      recommendations.push('🔴 HIGH: ' + dkim.recommendation)
    }

    if (!dmarc.isValid) {
      recommendations.push('🔴 HIGH: ' + dmarc.recommendation)
    }

    // Medium priority
    if (spf.isValid && spf.score < 80) {
      recommendations.push('🟡 MEDIUM: Optimize SPF record configuration')
    }

    if (dkim.isValid && dkim.score < 80) {
      recommendations.push('🟡 MEDIUM: Improve DKIM configuration')
    }

    if (dmarc.isValid && dmarc.policy === 'none') {
      recommendations.push('🟡 MEDIUM: Upgrade DMARC policy for better protection')
    }

    // Low priority
    if (mxRecords.length === 0) {
      recommendations.push('🟢 LOW: Configure MX records for email delivery')
    }

    if (recommendations.length === 0) {
      recommendations.push('✅ All email authentication is properly configured!')
    }

    return recommendations
  }

  // Utility method to generate DNS records
  static generateRecommendedRecords(domain: string, emailProvider?: string): {
    spf: string
    dmarc: string
    dkimInstructions: string
  } {
    const providerSPF = {
      'google': 'include:_spf.google.com',
      'microsoft': 'include:spf.protection.outlook.com',
      'sendgrid': 'include:sendgrid.net',
      'mailchimp': 'include:servers.mcsv.net',
      'amazon': 'include:amazonses.com'
    }

    const spfInclude = emailProvider && providerSPF[emailProvider as keyof typeof providerSPF] 
      ? providerSPF[emailProvider as keyof typeof providerSPF]
      : 'include:_spf.youremailprovider.com'

    return {
      spf: `v=spf1 ${spfInclude} ~all`,
      dmarc: `v=DMARC1; p=quarantine; rua=mailto:dmarc@${domain}; ruf=mailto:dmarc@${domain}; fo=1`,
      dkimInstructions: `Configure DKIM signing with your email provider and add the DKIM record they provide to: selector._domainkey.${domain}`
    }
  }
}