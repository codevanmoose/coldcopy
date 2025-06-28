interface BounceEvent {
  id: string
  messageId: string
  email: string
  bounceType: 'hard' | 'soft' | 'complaint' | 'delivery_delay'
  bounceSubType: string
  timestamp: string
  diagnosticCode?: string
  description?: string
  campaignId?: string
  leadId?: string
}

interface SuppressionListEntry {
  email: string
  reason: 'hard_bounce' | 'soft_bounce' | 'complaint' | 'unsubscribe' | 'manual'
  bounceCount: number
  lastBounceDate: string
  addedDate: string
  workspaceId: string
  isActive: boolean
  notes?: string
}

interface DomainReputation {
  domain: string
  reputation: 'excellent' | 'good' | 'fair' | 'poor' | 'blacklisted'
  bounceRate: number
  complaintRate: number
  deliveryRate: number
  lastChecked: string
  totalSent: number
  totalBounced: number
  totalComplaints: number
}

export class BounceHandler {
  // Hard bounce patterns that indicate permanent delivery failure
  private static HARD_BOUNCE_PATTERNS = [
    /user unknown/i,
    /no such user/i,
    /invalid recipient/i,
    /recipient address rejected/i,
    /mailbox not found/i,
    /mailbox unavailable/i,
    /account disabled/i,
    /account does not exist/i,
    /user does not exist/i,
    /email address does not exist/i,
    /invalid email address/i,
    /bad destination mailbox/i,
    /recipient not found/i,
    /no mailbox here/i,
    /mailbox does not exist/i,
    /address rejected/i,
    /permanent failure/i,
    /delivery permanently failed/i
  ]

  // Soft bounce patterns that indicate temporary delivery issues
  private static SOFT_BOUNCE_PATTERNS = [
    /mailbox full/i,
    /quota exceeded/i,
    /mailbox over quota/i,
    /insufficient storage/i,
    /temporary failure/i,
    /try again later/i,
    /server temporarily unavailable/i,
    /mail server temporarily unavailable/i,
    /connection timed out/i,
    /message too large/i,
    /message size exceeds limit/i,
    /temporarily deferred/i,
    /greylisted/i,
    /rate limited/i,
    /too many connections/i,
    /service unavailable/i
  ]

  // Complaint patterns (spam reports)
  private static COMPLAINT_PATTERNS = [
    /abuse/i,
    /spam/i,
    /complained/i,
    /feedback loop/i,
    /list-unsubscribe/i,
    /unsubscribe/i,
    /junk mail/i,
    /unsolicited/i
  ]

  // Domain-specific bounce codes
  private static DOMAIN_BOUNCE_CODES = {
    'gmail.com': {
      '550-5.1.1': 'hard', // User unknown
      '550-5.2.1': 'hard', // Mailbox disabled
      '452-4.2.2': 'soft', // Mailbox full
      '421-4.7.0': 'soft', // IP temporarily deferred
    },
    'outlook.com': {
      '550 5.1.1': 'hard', // User unknown
      '550 5.2.2': 'hard', // Mailbox disabled
      '452 4.3.1': 'soft', // Mailbox full
      '421 4.3.2': 'soft', // Service not available
    },
    'yahoo.com': {
      '554': 'hard', // Message rejected
      '421': 'soft', // Service not available
      '452': 'soft', // Requested action aborted
    }
  }

  static async processBounceEvent(bounceData: any, workspaceId: string): Promise<BounceEvent> {
    const bounceEvent: BounceEvent = {
      id: bounceData.messageId || crypto.randomUUID(),
      messageId: bounceData.messageId,
      email: this.extractEmail(bounceData),
      bounceType: this.determineBounceType(bounceData),
      bounceSubType: this.determineBounceSubType(bounceData),
      timestamp: bounceData.timestamp || new Date().toISOString(),
      diagnosticCode: bounceData.diagnosticCode,
      description: bounceData.description || this.generateDescription(bounceData),
      campaignId: bounceData.campaignId,
      leadId: bounceData.leadId
    }

    // Store bounce event in database
    await this.storeBounceEvent(bounceEvent, workspaceId)

    // Update suppression list
    await this.updateSuppressionList(bounceEvent, workspaceId)

    // Update domain reputation
    await this.updateDomainReputation(bounceEvent, workspaceId)

    // Process campaign effects
    if (bounceEvent.campaignId) {
      await this.processCampaignBounce(bounceEvent, workspaceId)
    }

    // Send notifications if needed
    await this.sendBounceNotifications(bounceEvent, workspaceId)

    return bounceEvent
  }

  private static extractEmail(bounceData: any): string {
    // Extract email from various bounce data formats
    if (bounceData.recipient) return bounceData.recipient
    if (bounceData.email) return bounceData.email
    if (bounceData.destination) return bounceData.destination

    // Try to extract from diagnostic message
    const emailMatch = bounceData.diagnosticCode?.match(/[\w.-]+@[\w.-]+\.\w+/)
    return emailMatch ? emailMatch[0] : ''
  }

  private static determineBounceType(bounceData: any): 'hard' | 'soft' | 'complaint' | 'delivery_delay' {
    const diagnosticCode = bounceData.diagnosticCode || ''
    const statusCode = bounceData.statusCode || ''
    const bounceType = bounceData.bounceType || ''

    // Check for explicit bounce type
    if (bounceType === 'Permanent') return 'hard'
    if (bounceType === 'Transient') return 'soft'
    if (bounceType === 'Complaint') return 'complaint'

    // Check status codes
    if (statusCode.startsWith('5.')) return 'hard'
    if (statusCode.startsWith('4.')) return 'soft'

    // Check diagnostic patterns
    for (const pattern of this.HARD_BOUNCE_PATTERNS) {
      if (pattern.test(diagnosticCode)) return 'hard'
    }

    for (const pattern of this.SOFT_BOUNCE_PATTERNS) {
      if (pattern.test(diagnosticCode)) return 'soft'
    }

    for (const pattern of this.COMPLAINT_PATTERNS) {
      if (pattern.test(diagnosticCode)) return 'complaint'
    }

    // Default to soft bounce for unknown patterns
    return 'soft'
  }

  private static determineBounceSubType(bounceData: any): string {
    const diagnosticCode = bounceData.diagnosticCode || ''
    const bounceSubType = bounceData.bounceSubType

    if (bounceSubType) return bounceSubType

    // Determine subtype based on diagnostic code
    if (/user unknown|no such user|invalid recipient/i.test(diagnosticCode)) {
      return 'NoEmail'
    }
    
    if (/mailbox full|quota exceeded/i.test(diagnosticCode)) {
      return 'MailboxFull'
    }
    
    if (/message too large|size exceeds/i.test(diagnosticCode)) {
      return 'MessageTooLarge'
    }
    
    if (/rate limited|too many/i.test(diagnosticCode)) {
      return 'MessageRejected'
    }
    
    if (/content rejected|spam/i.test(diagnosticCode)) {
      return 'ContentRejected'
    }

    return 'General'
  }

  private static generateDescription(bounceData: any): string {
    const bounceType = this.determineBounceType(bounceData)
    const subType = this.determineBounceSubType(bounceData)

    const descriptions = {
      hard: {
        NoEmail: 'The email address does not exist',
        General: 'Permanent delivery failure - email address is invalid'
      },
      soft: {
        MailboxFull: 'Recipient mailbox is full',
        MessageTooLarge: 'Message size exceeds recipient limits',
        MessageRejected: 'Message temporarily rejected by recipient server',
        General: 'Temporary delivery failure - will retry later'
      },
      complaint: {
        General: 'Recipient marked the email as spam'
      },
      delivery_delay: {
        General: 'Delivery delayed but will continue trying'
      }
    }

    return descriptions[bounceType]?.[subType] || descriptions[bounceType]?.General || 'Email delivery issue'
  }

  private static async storeBounceEvent(bounceEvent: BounceEvent, workspaceId: string): Promise<void> {
    // In a real implementation, this would store to database
    console.log('Storing bounce event:', bounceEvent)
    
    // Example database storage
    // await supabase
    //   .from('email_bounces')
    //   .insert({
    //     id: bounceEvent.id,
    //     workspace_id: workspaceId,
    //     message_id: bounceEvent.messageId,
    //     email: bounceEvent.email,
    //     bounce_type: bounceEvent.bounceType,
    //     bounce_subtype: bounceEvent.bounceSubType,
    //     diagnostic_code: bounceEvent.diagnosticCode,
    //     description: bounceEvent.description,
    //     campaign_id: bounceEvent.campaignId,
    //     lead_id: bounceEvent.leadId,
    //     timestamp: bounceEvent.timestamp
    //   })
  }

  private static async updateSuppressionList(bounceEvent: BounceEvent, workspaceId: string): Promise<void> {
    const email = bounceEvent.email.toLowerCase()
    
    // Get existing suppression entry
    const existingEntry = await this.getSuppressionEntry(email, workspaceId)
    
    if (existingEntry) {
      // Update existing entry
      await this.updateExistingSuppressionEntry(existingEntry, bounceEvent)
    } else {
      // Create new suppression entry
      await this.createSuppressionEntry(bounceEvent, workspaceId)
    }
  }

  private static async getSuppressionEntry(email: string, workspaceId: string): Promise<SuppressionListEntry | null> {
    // In a real implementation, this would query the database
    // const { data } = await supabase
    //   .from('suppression_list')
    //   .select('*')
    //   .eq('email', email)
    //   .eq('workspace_id', workspaceId)
    //   .eq('is_active', true)
    //   .single()
    
    return null // Placeholder
  }

  private static async updateExistingSuppressionEntry(
    entry: SuppressionListEntry, 
    bounceEvent: BounceEvent
  ): Promise<void> {
    const updates: Partial<SuppressionListEntry> = {
      bounceCount: entry.bounceCount + 1,
      lastBounceDate: bounceEvent.timestamp
    }

    // Update reason if it's a more severe bounce type
    if (bounceEvent.bounceType === 'hard' && entry.reason === 'soft_bounce') {
      updates.reason = 'hard_bounce'
    } else if (bounceEvent.bounceType === 'complaint') {
      updates.reason = 'complaint'
    }

    // In a real implementation, this would update the database
    console.log('Updating suppression entry:', updates)
  }

  private static async createSuppressionEntry(bounceEvent: BounceEvent, workspaceId: string): Promise<void> {
    const entry: SuppressionListEntry = {
      email: bounceEvent.email.toLowerCase(),
      reason: bounceEvent.bounceType === 'hard' ? 'hard_bounce' :
              bounceEvent.bounceType === 'complaint' ? 'complaint' : 'soft_bounce',
      bounceCount: 1,
      lastBounceDate: bounceEvent.timestamp,
      addedDate: new Date().toISOString(),
      workspaceId,
      isActive: true,
      notes: bounceEvent.description
    }

    // In a real implementation, this would insert into database
    console.log('Creating suppression entry:', entry)
  }

  private static async updateDomainReputation(bounceEvent: BounceEvent, workspaceId: string): Promise<void> {
    const domain = bounceEvent.email.split('@')[1]?.toLowerCase()
    if (!domain) return

    // Get existing domain reputation
    const reputation = await this.getDomainReputation(domain, workspaceId)
    
    if (reputation) {
      // Update existing reputation
      await this.updateExistingDomainReputation(reputation, bounceEvent)
    } else {
      // Create new domain reputation record
      await this.createDomainReputation(domain, bounceEvent, workspaceId)
    }
  }

  private static async getDomainReputation(domain: string, workspaceId: string): Promise<DomainReputation | null> {
    // In a real implementation, this would query the database
    return null // Placeholder
  }

  private static async updateExistingDomainReputation(
    reputation: DomainReputation, 
    bounceEvent: BounceEvent
  ): Promise<void> {
    const updates: Partial<DomainReputation> = {
      totalBounced: reputation.totalBounced + 1,
      lastChecked: new Date().toISOString()
    }

    if (bounceEvent.bounceType === 'complaint') {
      updates.totalComplaints = reputation.totalComplaints + 1
    }

    // Recalculate rates
    updates.bounceRate = (updates.totalBounced || reputation.totalBounced) / reputation.totalSent * 100
    updates.complaintRate = (updates.totalComplaints || reputation.totalComplaints) / reputation.totalSent * 100
    updates.deliveryRate = 100 - updates.bounceRate - updates.complaintRate

    // Update reputation level
    updates.reputation = this.calculateReputationLevel(updates.bounceRate, updates.complaintRate)

    console.log('Updating domain reputation:', updates)
  }

  private static async createDomainReputation(
    domain: string, 
    bounceEvent: BounceEvent, 
    workspaceId: string
  ): Promise<void> {
    const reputation: DomainReputation = {
      domain,
      reputation: 'fair',
      bounceRate: 100, // First email bounced
      complaintRate: bounceEvent.bounceType === 'complaint' ? 100 : 0,
      deliveryRate: 0,
      lastChecked: new Date().toISOString(),
      totalSent: 1,
      totalBounced: 1,
      totalComplaints: bounceEvent.bounceType === 'complaint' ? 1 : 0
    }

    console.log('Creating domain reputation:', reputation)
  }

  private static calculateReputationLevel(bounceRate: number, complaintRate: number): 'excellent' | 'good' | 'fair' | 'poor' | 'blacklisted' {
    if (complaintRate > 0.5 || bounceRate > 10) return 'blacklisted'
    if (complaintRate > 0.3 || bounceRate > 7) return 'poor'
    if (complaintRate > 0.1 || bounceRate > 5) return 'fair'
    if (complaintRate > 0.05 || bounceRate > 2) return 'good'
    return 'excellent'
  }

  private static async processCampaignBounce(bounceEvent: BounceEvent, workspaceId: string): Promise<void> {
    if (!bounceEvent.campaignId) return

    // Update campaign statistics
    await this.updateCampaignStats(bounceEvent.campaignId, bounceEvent, workspaceId)

    // Stop sending to this email in the campaign if hard bounce
    if (bounceEvent.bounceType === 'hard') {
      await this.stopCampaignForEmail(bounceEvent.campaignId, bounceEvent.email, workspaceId)
    }

    // Check if campaign should be paused due to high bounce rate
    await this.checkCampaignHealth(bounceEvent.campaignId, workspaceId)
  }

  private static async updateCampaignStats(campaignId: string, bounceEvent: BounceEvent, workspaceId: string): Promise<void> {
    // In a real implementation, this would update campaign statistics
    console.log('Updating campaign stats for bounce:', { campaignId, bounceEvent })
  }

  private static async stopCampaignForEmail(campaignId: string, email: string, workspaceId: string): Promise<void> {
    // In a real implementation, this would mark the email as stopped in the campaign
    console.log('Stopping campaign for email:', { campaignId, email })
  }

  private static async checkCampaignHealth(campaignId: string, workspaceId: string): Promise<void> {
    // Get campaign statistics
    const stats = await this.getCampaignStats(campaignId, workspaceId)
    
    if (stats.bounceRate > 10 || stats.complaintRate > 0.5) {
      // Pause campaign due to poor deliverability
      await this.pauseCampaign(campaignId, 'High bounce/complaint rate detected', workspaceId)
    }
  }

  private static async getCampaignStats(campaignId: string, workspaceId: string): Promise<{
    totalSent: number
    totalBounced: number
    totalComplaints: number
    bounceRate: number
    complaintRate: number
  }> {
    // In a real implementation, this would query campaign statistics
    return {
      totalSent: 100,
      totalBounced: 5,
      totalComplaints: 1,
      bounceRate: 5,
      complaintRate: 1
    }
  }

  private static async pauseCampaign(campaignId: string, reason: string, workspaceId: string): Promise<void> {
    console.log('Pausing campaign due to deliverability issues:', { campaignId, reason })
    
    // In a real implementation, this would:
    // 1. Update campaign status to paused
    // 2. Log the reason
    // 3. Send notification to campaign owner
    // 4. Create alert in admin dashboard
  }

  private static async sendBounceNotifications(bounceEvent: BounceEvent, workspaceId: string): Promise<void> {
    // Send notifications based on bounce severity
    if (bounceEvent.bounceType === 'hard' || bounceEvent.bounceType === 'complaint') {
      await this.sendImmediateNotification(bounceEvent, workspaceId)
    }

    // Check if we should send a summary notification
    await this.checkSummaryNotifications(workspaceId)
  }

  private static async sendImmediateNotification(bounceEvent: BounceEvent, workspaceId: string): Promise<void> {
    console.log('Sending immediate bounce notification:', bounceEvent)
    
    // In a real implementation, this would send email/slack/webhook notifications
  }

  private static async checkSummaryNotifications(workspaceId: string): Promise<void> {
    // Check if daily/weekly summary should be sent
    console.log('Checking summary notifications for workspace:', workspaceId)
  }

  // Utility methods for managing suppression list
  static async addToSuppressionList(
    email: string, 
    reason: SuppressionListEntry['reason'], 
    workspaceId: string,
    notes?: string
  ): Promise<void> {
    const entry: SuppressionListEntry = {
      email: email.toLowerCase(),
      reason,
      bounceCount: 0,
      lastBounceDate: new Date().toISOString(),
      addedDate: new Date().toISOString(),
      workspaceId,
      isActive: true,
      notes
    }

    console.log('Manually adding to suppression list:', entry)
  }

  static async removeFromSuppressionList(email: string, workspaceId: string): Promise<void> {
    console.log('Removing from suppression list:', { email, workspaceId })
    
    // In a real implementation, this would deactivate the suppression entry
  }

  static async checkSuppressionList(emails: string[], workspaceId: string): Promise<{
    suppressed: string[]
    allowed: string[]
  }> {
    // In a real implementation, this would check against the database
    console.log('Checking suppression list for emails:', emails)
    
    return {
      suppressed: [],
      allowed: emails
    }
  }

  static async getSuppressionListStats(workspaceId: string): Promise<{
    totalSuppressed: number
    hardBounces: number
    softBounces: number
    complaints: number
    unsubscribes: number
    manual: number
  }> {
    // In a real implementation, this would query suppression statistics
    return {
      totalSuppressed: 0,
      hardBounces: 0,
      softBounces: 0,
      complaints: 0,
      unsubscribes: 0,
      manual: 0
    }
  }

  // Domain reputation methods
  static async getDomainReputationReport(workspaceId: string): Promise<DomainReputation[]> {
    // In a real implementation, this would return all domain reputations
    return []
  }

  static async cleanupOldBounces(workspaceId: string, daysToKeep: number = 90): Promise<number> {
    // In a real implementation, this would clean up old bounce records
    console.log('Cleaning up bounces older than', daysToKeep, 'days')
    return 0
  }
}