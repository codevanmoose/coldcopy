import { createClient } from '@supabase/supabase-js'

// Mock dependencies
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}))

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

jest.mock('@/lib/email/ses-client', () => ({
  sendEmail: jest.fn(),
  sendBulkEmails: jest.fn(),
}))

jest.mock('@/lib/ai', () => ({
  generatePersonalizedEmail: jest.fn(),
}))

describe('Campaign Service', () => {
  let mockSupabase: any
  let mockSendEmail: jest.Mock
  let mockSendBulkEmails: jest.Mock
  let mockGeneratePersonalizedEmail: jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()

    // Mock Supabase client
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      neq: jest.fn().mockReturnThis(),
      not: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      lt: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      rpc: jest.fn(),
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-123' } } }),
      },
    };

    (createClient as jest.Mock).mockReturnValue(mockSupabase)

    // Mock email service
    mockSendEmail = require('@/lib/email/ses-client').sendEmail as jest.Mock
    mockSendBulkEmails = require('@/lib/email/ses-client').sendBulkEmails as jest.Mock

    // Mock AI service
    mockGeneratePersonalizedEmail = require('@/lib/ai').generatePersonalizedEmail as jest.Mock

    mockSendEmail.mockResolvedValue({ success: true, messageId: 'msg-123' })
    mockSendBulkEmails.mockResolvedValue({ success: true, messageIds: ['msg-1', 'msg-2'] })
    mockGeneratePersonalizedEmail.mockResolvedValue({
      subject: 'Personalized Subject',
      body: 'Personalized email body',
    })
  })

  describe('Campaign Creation', () => {
    it('should create a campaign successfully', async () => {
      // Arrange
      const campaignData = {
        name: 'Product Launch Campaign',
        subject: 'Introducing Our New Product',
        description: 'Launch campaign for new product',
        workspace_id: 'workspace-123',
        type: 'sequence',
        status: 'draft',
      }

      const createdCampaign = {
        id: 'campaign-123',
        ...campaignData,
        created_at: new Date().toISOString(),
      }

      mockSupabase.single.mockResolvedValue({ data: createdCampaign, error: null })

      // Act
      const result = await createCampaign(campaignData)

      // Assert
      expect(result.id).toBe('campaign-123')
      expect(result.name).toBe('Product Launch Campaign')
      expect(mockSupabase.insert).toHaveBeenCalledWith(campaignData)
    })

    it('should validate campaign data before creation', async () => {
      // Arrange
      const invalidCampaignData = {
        name: '', // Invalid: empty name
        subject: 'Test Subject',
        workspace_id: 'workspace-123',
      }

      // Act & Assert
      await expect(createCampaign(invalidCampaignData)).rejects.toThrow(
        'Campaign name is required'
      )
    })

    it('should create campaign sequences', async () => {
      // Arrange
      const campaignId = 'campaign-123'
      const sequences = [
        {
          sequence_number: 1,
          name: 'Introduction Email',
          subject: 'Welcome to our product',
          body: 'Thanks for your interest...',
          delay_days: 0,
          delay_hours: 0,
        },
        {
          sequence_number: 2,
          name: 'Follow-up Email',
          subject: 'Still interested?',
          body: 'Just following up...',
          delay_days: 3,
          delay_hours: 0,
        },
      ]

      const createdSequences = sequences.map((seq, idx) => ({
        id: `seq-${idx + 1}`,
        campaign_id: campaignId,
        ...seq,
      }))

      mockSupabase.select.mockResolvedValue({ data: createdSequences, error: null })

      // Act
      const result = await createCampaignSequences(campaignId, sequences)

      // Assert
      expect(result).toHaveLength(2)
      expect(result[0].sequence_number).toBe(1)
      expect(result[1].delay_days).toBe(3)
      expect(mockSupabase.insert).toHaveBeenCalledWith(
        sequences.map((seq) => ({
          campaign_id: campaignId,
          ...seq,
        }))
      )
    })

    it('should handle duplicate sequence numbers', async () => {
      // Arrange
      const campaignId = 'campaign-123'
      const sequences = [
        { sequence_number: 1, name: 'Email 1', subject: 'Test 1', body: 'Body 1' },
        { sequence_number: 1, name: 'Email 2', subject: 'Test 2', body: 'Body 2' }, // Duplicate
      ]

      // Act & Assert
      await expect(createCampaignSequences(campaignId, sequences)).rejects.toThrow(
        'Duplicate sequence numbers are not allowed'
      )
    })
  })

  describe('Campaign Scheduling', () => {
    it('should schedule campaign for immediate send', async () => {
      // Arrange
      const campaignId = 'campaign-123'
      const leadIds = ['lead-1', 'lead-2', 'lead-3']
      const scheduleTime = new Date()

      const scheduledLeads = leadIds.map((leadId) => ({
        id: `cl-${leadId}`,
        campaign_id: campaignId,
        lead_id: leadId,
        status: 'pending',
        scheduled_at: scheduleTime.toISOString(),
      }))

      mockSupabase.select.mockResolvedValue({ data: scheduledLeads, error: null })

      // Act
      const result = await scheduleCampaign(campaignId, leadIds, scheduleTime)

      // Assert
      expect(result).toHaveLength(3)
      expect(result[0].status).toBe('pending')
      expect(mockSupabase.insert).toHaveBeenCalledWith(
        leadIds.map((leadId) => ({
          campaign_id: campaignId,
          lead_id: leadId,
          status: 'pending',
          scheduled_at: scheduleTime.toISOString(),
        }))
      )
    })

    it('should schedule campaign with future send time', async () => {
      // Arrange
      const campaignId = 'campaign-123'
      const leadIds = ['lead-1']
      const futureTime = new Date(Date.now() + 24 * 60 * 60 * 1000) // Tomorrow

      mockSupabase.select.mockResolvedValue({
        data: [
          {
            id: 'cl-1',
            campaign_id: campaignId,
            lead_id: 'lead-1',
            status: 'scheduled',
            scheduled_at: futureTime.toISOString(),
          },
        ],
        error: null,
      })

      // Act
      const result = await scheduleCampaign(campaignId, leadIds, futureTime)

      // Assert
      expect(result[0].status).toBe('scheduled')
      expect(new Date(result[0].scheduled_at)).toEqual(futureTime)
    })

    it('should validate lead availability before scheduling', async () => {
      // Arrange
      const campaignId = 'campaign-123'
      const leadIds = ['lead-1', 'lead-2']

      // Mock one lead as already in another active campaign
      mockSupabase.select.mockResolvedValue({
        data: [
          { lead_id: 'lead-1', status: 'in_progress' }, // Already in campaign
        ],
        error: null,
      })

      // Act & Assert
      await expect(scheduleCampaign(campaignId, leadIds)).rejects.toThrow(
        'Some leads are already in active campaigns'
      )
    })

    it('should respect daily sending limits', async () => {
      // Arrange
      const campaignId = 'campaign-123'
      const leadIds = Array.from({ length: 1000 }, (_, i) => `lead-${i}`) // 1000 leads
      const dailyLimit = 500

      mockSupabase.single.mockResolvedValue({
        data: { daily_limit: dailyLimit },
        error: null,
      })

      // Act
      const result = await scheduleCampaign(campaignId, leadIds, new Date(), {
        respectDailyLimit: true,
      })

      // Assert
      expect(result).toHaveLength(dailyLimit)
    })
  })

  describe('Email Execution', () => {
    it('should execute campaign sequence', async () => {
      // Arrange
      const queueItem = {
        id: 'queue-1',
        campaign_id: 'campaign-123',
        campaign_lead_id: 'cl-1',
        sequence_id: 'seq-1',
        scheduled_for: new Date().toISOString(),
        status: 'pending',
      }

      const campaignLead = {
        id: 'cl-1',
        campaign_id: 'campaign-123',
        lead_id: 'lead-1',
        current_sequence: 0,
      }

      const lead = {
        id: 'lead-1',
        email: 'test@example.com',
        first_name: 'John',
        last_name: 'Doe',
        company: 'Test Corp',
      }

      const sequence = {
        id: 'seq-1',
        campaign_id: 'campaign-123',
        sequence_number: 1,
        subject: 'Welcome {{first_name}}!',
        body: 'Hi {{first_name}}, welcome to {{company}}!',
      }

      const campaign = {
        id: 'campaign-123',
        name: 'Test Campaign',
        from_name: 'Test Team',
        from_email: 'team@test.com',
      }

      mockSupabase.single
        .mockResolvedValueOnce({ data: campaignLead, error: null })
        .mockResolvedValueOnce({ data: lead, error: null })
        .mockResolvedValueOnce({ data: sequence, error: null })
        .mockResolvedValueOnce({ data: campaign, error: null })

      // Mock update calls
      mockSupabase.eq.mockResolvedValue({ error: null })

      // Act
      const result = await executeCampaignEmail(queueItem)

      // Assert
      expect(result.success).toBe(true)
      expect(mockSendEmail).toHaveBeenCalledWith({
        from: { email: 'team@test.com', name: 'Test Team' },
        to: ['test@example.com'],
        subject: 'Welcome John!',
        html: expect.stringContaining('Hi John, welcome to Test Corp!'),
        text: expect.stringContaining('Hi John, welcome to Test Corp!'),
        tags: {
          campaign_id: 'campaign-123',
          lead_id: 'lead-1',
          sequence_id: 'seq-1',
        },
        headers: {
          'X-Campaign-ID': 'campaign-123',
          'X-Lead-ID': 'lead-1',
          'List-Unsubscribe': expect.stringContaining('/unsubscribe'),
        },
      })
    })

    it('should personalize email content with AI', async () => {
      // Arrange
      const queueItem = {
        id: 'queue-1',
        campaign_id: 'campaign-123',
        campaign_lead_id: 'cl-1',
        sequence_id: 'seq-1',
      }

      const lead = {
        id: 'lead-1',
        email: 'ceo@techcorp.com',
        first_name: 'Jane',
        last_name: 'Smith',
        company: 'TechCorp',
        title: 'CEO',
        industry: 'Technology',
      }

      const sequence = {
        id: 'seq-1',
        subject: 'Partnership Opportunity',
        body: 'Hi {{first_name}}, I noticed your work at {{company}}...',
        use_ai_personalization: true,
      }

      const campaign = {
        id: 'campaign-123',
        ai_personalization_prompt: 'Personalize based on company and role',
      }

      mockSupabase.single
        .mockResolvedValueOnce({ data: {}, error: null })
        .mockResolvedValueOnce({ data: lead, error: null })
        .mockResolvedValueOnce({ data: sequence, error: null })
        .mockResolvedValueOnce({ data: campaign, error: null })

      mockSupabase.eq.mockResolvedValue({ error: null })

      // Act
      await executeCampaignEmail(queueItem)

      // Assert
      expect(mockGeneratePersonalizedEmail).toHaveBeenCalledWith({
        leadData: lead,
        template: sequence.body,
        prompt: campaign.ai_personalization_prompt,
      })

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Personalized Subject',
          html: expect.stringContaining('Personalized email body'),
        })
      )
    })

    it('should handle email delivery failures', async () => {
      // Arrange
      const queueItem = {
        id: 'queue-1',
        campaign_id: 'campaign-123',
        campaign_lead_id: 'cl-1',
        sequence_id: 'seq-1',
      }

      mockSupabase.single
        .mockResolvedValue({ data: { email: 'invalid@example.com' }, error: null })

      mockSendEmail.mockResolvedValue({
        success: false,
        error: 'Email address is not verified',
      })

      // Act
      const result = await executeCampaignEmail(queueItem)

      // Assert
      expect(result.success).toBe(false)
      expect(result.error).toBe('Email address is not verified')

      // Should update queue item with failure
      expect(mockSupabase.update).toHaveBeenCalledWith({
        status: 'failed',
        last_error: 'Email address is not verified',
        attempts: expect.any(Number),
      })
    })

    it('should retry failed emails up to limit', async () => {
      // Arrange
      const queueItem = {
        id: 'queue-1',
        attempts: 2, // Already tried twice
        status: 'failed',
      }

      const maxRetries = 3

      // Act
      const shouldRetry = await shouldRetryEmail(queueItem, maxRetries)

      // Assert
      expect(shouldRetry).toBe(true)

      // Try one more time (attempt 3)
      const queueItemAttempt3 = { ...queueItem, attempts: 3 }
      const shouldRetryAgain = await shouldRetryEmail(queueItemAttempt3, maxRetries)
      expect(shouldRetryAgain).toBe(false)
    })

    it('should advance to next sequence after successful send', async () => {
      // Arrange
      const campaignLeadId = 'cl-1'
      const currentSequence = 1

      const nextSequence = {
        id: 'seq-2',
        sequence_number: 2,
        delay_days: 2,
        delay_hours: 0,
      }

      mockSupabase.single.mockResolvedValue({ data: nextSequence, error: null })
      mockSupabase.rpc.mockResolvedValue({ data: true, error: null })

      // Act
      const result = await advanceToNextSequence(campaignLeadId)

      // Assert
      expect(result).toBe(true)
      expect(mockSupabase.rpc).toHaveBeenCalledWith('advance_campaign_sequence', {
        p_campaign_lead_id: campaignLeadId,
      })
    })

    it('should complete campaign when no more sequences', async () => {
      // Arrange
      const campaignLeadId = 'cl-1'

      // No next sequence found
      mockSupabase.single.mockResolvedValue({ data: null, error: null })

      // Act
      const result = await advanceToNextSequence(campaignLeadId)

      // Assert
      expect(result).toBe(true)
      expect(mockSupabase.update).toHaveBeenCalledWith({
        status: 'completed',
        completed_at: expect.any(String),
      })
    })
  })

  describe('Stop Conditions', () => {
    it('should stop campaign on email reply', async () => {
      // Arrange
      const campaignLeadId = 'cl-1'
      const replyData = {
        from: 'test@example.com',
        subject: 'Re: Your email',
        message_id: 'reply-123',
      }

      mockSupabase.single.mockResolvedValue({
        data: { status: 'in_progress' },
        error: null,
      })

      // Act
      const result = await handleEmailReply(campaignLeadId, replyData)

      // Assert
      expect(result.campaignStopped).toBe(true)
      expect(mockSupabase.update).toHaveBeenCalledWith({
        status: 'replied',
        stopped_reason: 'email_reply',
        completed_at: expect.any(String),
      })

      // Should cancel pending emails
      expect(mockSupabase.update).toHaveBeenCalledWith({
        status: 'cancelled',
      })
    })

    it('should stop campaign on unsubscribe', async () => {
      // Arrange
      const leadId = 'lead-1'
      const campaignId = 'campaign-123'

      mockSupabase.select.mockResolvedValue({
        data: [
          { id: 'cl-1', status: 'in_progress' },
          { id: 'cl-2', status: 'pending' },
        ],
        error: null,
      })

      // Act
      const result = await handleUnsubscribe(leadId, campaignId)

      // Assert
      expect(result.campaignsStopped).toBe(2)
      expect(mockSupabase.update).toHaveBeenCalledWith({
        status: 'unsubscribed',
        stopped_reason: 'unsubscribe',
        completed_at: expect.any(String),
      })
    })

    it('should stop campaign on bounce', async () => {
      // Arrange
      const emailAddress = 'bounced@example.com'
      const bounceType = 'permanent'

      mockSupabase.single.mockResolvedValue({
        data: { id: 'lead-1' },
        error: null,
      })

      mockSupabase.select.mockResolvedValue({
        data: [{ id: 'cl-1', campaign_id: 'campaign-123' }],
        error: null,
      })

      // Act
      const result = await handleEmailBounce(emailAddress, bounceType)

      // Assert
      expect(result.campaignsStopped).toBe(1)
      expect(mockSupabase.update).toHaveBeenCalledWith({
        status: 'bounced',
        stopped_reason: 'email_bounce',
        completed_at: expect.any(String),
      })

      // Should add to suppression list for permanent bounces
      if (bounceType === 'permanent') {
        expect(mockSupabase.rpc).toHaveBeenCalledWith('add_to_suppression_list', {
          p_email: emailAddress,
          p_suppression_type: 'bounce',
          p_reason: 'Permanent bounce',
        })
      }
    })

    it('should handle soft bounces differently', async () => {
      // Arrange
      const emailAddress = 'temp-issue@example.com'
      const bounceType = 'transient'

      // Act
      const result = await handleEmailBounce(emailAddress, bounceType)

      // Assert
      // Should not stop campaign for transient bounces
      expect(result.campaignsStopped).toBe(0)
      // But should log the bounce
      expect(mockSupabase.insert).toHaveBeenCalledWith({
        email: emailAddress,
        bounce_type: bounceType,
        created_at: expect.any(String),
      })
    })
  })

  describe('Analytics Tracking', () => {
    it('should track email open events', async () => {
      // Arrange
      const trackingData = {
        campaign_id: 'campaign-123',
        lead_id: 'lead-1',
        sequence_id: 'seq-1',
        event_type: 'open',
        user_agent: 'Mozilla/5.0...',
        ip_address: '192.168.1.1',
      }

      mockSupabase.single.mockResolvedValue({ data: { id: 'event-1' }, error: null })

      // Act
      const result = await trackEmailEvent(trackingData)

      // Assert
      expect(result.tracked).toBe(true)
      expect(mockSupabase.insert).toHaveBeenCalledWith({
        ...trackingData,
        created_at: expect.any(String),
      })
    })

    it('should track email click events', async () => {
      // Arrange
      const trackingData = {
        campaign_id: 'campaign-123',
        lead_id: 'lead-1',
        sequence_id: 'seq-1',
        event_type: 'click',
        clicked_url: 'https://example.com/product',
        user_agent: 'Mozilla/5.0...',
      }

      mockSupabase.single.mockResolvedValue({ data: { id: 'event-2' }, error: null })

      // Act
      const result = await trackEmailEvent(trackingData)

      // Assert
      expect(result.tracked).toBe(true)
      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          clicked_url: 'https://example.com/product',
        })
      )
    })

    it('should generate campaign analytics', async () => {
      // Arrange
      const campaignId = 'campaign-123'

      const analyticsData = {
        total_sent: 100,
        delivered: 95,
        opened: 30,
        clicked: 10,
        replied: 5,
        unsubscribed: 2,
        bounced: 3,
      }

      mockSupabase.single.mockResolvedValue({ data: analyticsData, error: null })

      // Act
      const result = await getCampaignAnalytics(campaignId)

      // Assert
      expect(result.totalSent).toBe(100)
      expect(result.openRate).toBeCloseTo(31.58, 2) // 30/95 * 100
      expect(result.clickRate).toBeCloseTo(10.53, 2) // 10/95 * 100
      expect(result.replyRate).toBeCloseTo(5.26, 2) // 5/95 * 100
      expect(result.unsubscribeRate).toBeCloseTo(2.11, 2) // 2/95 * 100
    })

    it('should track campaign performance over time', async () => {
      // Arrange
      const campaignId = 'campaign-123'
      const timeRange = { start: '2024-01-01', end: '2024-01-31' }

      const timeSeriesData = [
        { date: '2024-01-01', sent: 10, opened: 3, clicked: 1 },
        { date: '2024-01-02', sent: 15, opened: 5, clicked: 2 },
        { date: '2024-01-03', sent: 12, opened: 4, clicked: 1 },
      ]

      mockSupabase.order.mockResolvedValue({ data: timeSeriesData, error: null })

      // Act
      const result = await getCampaignPerformanceTimeSeries(campaignId, timeRange)

      // Assert
      expect(result).toHaveLength(3)
      expect(result[0].openRate).toBeCloseTo(30, 1) // 3/10 * 100
      expect(result[1].clickRate).toBeCloseTo(13.33, 2) // 2/15 * 100
    })
  })

  describe('Campaign Management', () => {
    it('should pause active campaign', async () => {
      // Arrange
      const campaignId = 'campaign-123'

      mockSupabase.single.mockResolvedValue({
        data: { id: campaignId, status: 'active' },
        error: null,
      })

      // Act
      const result = await pauseCampaign(campaignId)

      // Assert
      expect(result.status).toBe('paused')
      expect(mockSupabase.update).toHaveBeenCalledWith({
        status: 'paused',
        paused_at: expect.any(String),
      })

      // Should pause all pending queue items
      expect(mockSupabase.update).toHaveBeenCalledWith({
        status: 'paused',
      })
    })

    it('should resume paused campaign', async () => {
      // Arrange
      const campaignId = 'campaign-123'

      mockSupabase.single.mockResolvedValue({
        data: { id: campaignId, status: 'paused' },
        error: null,
      })

      // Act
      const result = await resumeCampaign(campaignId)

      // Assert
      expect(result.status).toBe('active')
      expect(mockSupabase.update).toHaveBeenCalledWith({
        status: 'active',
        paused_at: null,
        resumed_at: expect.any(String),
      })
    })

    it('should delete campaign and cleanup data', async () => {
      // Arrange
      const campaignId = 'campaign-123'

      mockSupabase.select.mockResolvedValue({ count: 0 })

      // Act
      const result = await deleteCampaign(campaignId)

      // Assert
      expect(result.deleted).toBe(true)

      // Should delete in correct order (foreign key constraints)
      expect(mockSupabase.delete).toHaveBeenCalledTimes(4) // sequences, leads, queue, campaign
    })

    it('should prevent deleting active campaigns', async () => {
      // Arrange
      const campaignId = 'campaign-123'

      mockSupabase.single.mockResolvedValue({
        data: { id: campaignId, status: 'active' },
        error: null,
      })

      // Act & Assert
      await expect(deleteCampaign(campaignId)).rejects.toThrow(
        'Cannot delete active campaign'
      )
    })
  })
})

// Mock service functions (implementation examples)
async function createCampaign(campaignData: any) {
  if (!campaignData.name?.trim()) {
    throw new Error('Campaign name is required')
  }

  const supabase = createClient()
  const { data, error } = await supabase
    .from('campaigns')
    .insert(campaignData)
    .select()
    .single()

  if (error) throw error
  return data
}

async function createCampaignSequences(campaignId: string, sequences: any[]) {
  // Check for duplicate sequence numbers
  const sequenceNumbers = sequences.map((s) => s.sequence_number)
  if (new Set(sequenceNumbers).size !== sequenceNumbers.length) {
    throw new Error('Duplicate sequence numbers are not allowed')
  }

  const supabase = createClient()
  const { data, error } = await supabase
    .from('campaign_sequences')
    .insert(
      sequences.map((seq) => ({
        campaign_id: campaignId,
        ...seq,
      }))
    )
    .select()

  if (error) throw error
  return data
}

async function scheduleCampaign(
  campaignId: string,
  leadIds: string[],
  scheduleTime?: Date,
  options?: any
) {
  const actualScheduleTime = scheduleTime || new Date()

  // Check for leads already in campaigns
  const supabase = createClient()
  const { data: existingCampaignLeads } = await supabase
    .from('campaign_leads')
    .select('lead_id, status')
    .in('lead_id', leadIds)
    .eq('status', 'in_progress')

  if (existingCampaignLeads && existingCampaignLeads.length > 0) {
    throw new Error('Some leads are already in active campaigns')
  }

  // Apply daily limit if specified
  let finalLeadIds = leadIds
  if (options?.respectDailyLimit) {
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('daily_limit')
      .eq('id', campaignId)
      .single()

    if (campaign?.daily_limit) {
      finalLeadIds = leadIds.slice(0, campaign.daily_limit)
    }
  }

  const { data, error } = await supabase
    .from('campaign_leads')
    .insert(
      finalLeadIds.map((leadId) => ({
        campaign_id: campaignId,
        lead_id: leadId,
        status: scheduleTime && scheduleTime > new Date() ? 'scheduled' : 'pending',
        scheduled_at: actualScheduleTime.toISOString(),
      }))
    )
    .select()

  if (error) throw error
  return data
}

async function executeCampaignEmail(queueItem: any) {
  const supabase = createClient()

  try {
    // Get campaign lead, lead, sequence, and campaign data
    const { data: campaignLead } = await supabase
      .from('campaign_leads')
      .select('*')
      .eq('id', queueItem.campaign_lead_id)
      .single()

    const { data: lead } = await supabase
      .from('leads')
      .select('*')
      .eq('id', campaignLead.lead_id)
      .single()

    const { data: sequence } = await supabase
      .from('campaign_sequences')
      .select('*')
      .eq('id', queueItem.sequence_id)
      .single()

    const { data: campaign } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', queueItem.campaign_id)
      .single()

    // Personalize content
    let subject = sequence.subject
    let body = sequence.body

    if (sequence.use_ai_personalization) {
      const personalized = await mockGeneratePersonalizedEmail({
        leadData: lead,
        template: body,
        prompt: campaign.ai_personalization_prompt,
      })
      subject = personalized.subject
      body = personalized.body
    }

    // Replace variables
    subject = replaceVariables(subject, lead)
    body = replaceVariables(body, lead)

    // Send email
    const emailResult = await mockSendEmail({
      from: { email: campaign.from_email, name: campaign.from_name },
      to: [lead.email],
      subject,
      html: body,
      text: stripHtml(body),
      tags: {
        campaign_id: queueItem.campaign_id,
        lead_id: lead.id,
        sequence_id: queueItem.sequence_id,
      },
      headers: {
        'X-Campaign-ID': queueItem.campaign_id,
        'X-Lead-ID': lead.id,
        'List-Unsubscribe': `<https://app.example.com/unsubscribe/${lead.id}>`,
      },
    })

    if (emailResult.success) {
      // Update queue item as sent
      await supabase
        .from('campaign_schedule_queue')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
        })
        .eq('id', queueItem.id)

      // Advance to next sequence
      await advanceToNextSequence(queueItem.campaign_lead_id)

      return { success: true, messageId: emailResult.messageId }
    } else {
      // Update queue item as failed
      await supabase
        .from('campaign_schedule_queue')
        .update({
          status: 'failed',
          last_error: emailResult.error,
          attempts: (queueItem.attempts || 0) + 1,
        })
        .eq('id', queueItem.id)

      return { success: false, error: emailResult.error }
    }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

async function advanceToNextSequence(campaignLeadId: string) {
  const supabase = createClient()

  // Use stored procedure to advance sequence
  const { data, error } = await supabase.rpc('advance_campaign_sequence', {
    p_campaign_lead_id: campaignLeadId,
  })

  if (error) throw error
  return data
}

async function shouldRetryEmail(queueItem: any, maxRetries: number) {
  return (queueItem.attempts || 0) < maxRetries
}

async function handleEmailReply(campaignLeadId: string, replyData: any) {
  const supabase = createClient()

  // Stop the campaign for this lead
  await supabase
    .from('campaign_leads')
    .update({
      status: 'replied',
      stopped_reason: 'email_reply',
      completed_at: new Date().toISOString(),
    })
    .eq('id', campaignLeadId)

  // Cancel pending emails
  await supabase
    .from('campaign_schedule_queue')
    .update({ status: 'cancelled' })
    .eq('campaign_lead_id', campaignLeadId)
    .eq('status', 'pending')

  return { campaignStopped: true }
}

async function handleUnsubscribe(leadId: string, campaignId?: string) {
  const supabase = createClient()

  let query = supabase
    .from('campaign_leads')
    .select('*')
    .eq('lead_id', leadId)
    .in('status', ['pending', 'in_progress'])

  if (campaignId) {
    query = query.eq('campaign_id', campaignId)
  }

  const { data: campaignLeads } = await query

  if (campaignLeads) {
    // Stop all active campaigns for this lead
    await supabase
      .from('campaign_leads')
      .update({
        status: 'unsubscribed',
        stopped_reason: 'unsubscribe',
        completed_at: new Date().toISOString(),
      })
      .in(
        'id',
        campaignLeads.map((cl) => cl.id)
      )

    return { campaignsStopped: campaignLeads.length }
  }

  return { campaignsStopped: 0 }
}

async function handleEmailBounce(emailAddress: string, bounceType: string) {
  const supabase = createClient()

  // Find lead by email
  const { data: lead } = await supabase
    .from('leads')
    .select('id')
    .eq('email', emailAddress)
    .single()

  if (!lead) return { campaignsStopped: 0 }

  // For permanent bounces, stop campaigns and add to suppression list
  if (bounceType === 'permanent') {
    const { data: campaignLeads } = await supabase
      .from('campaign_leads')
      .select('*')
      .eq('lead_id', lead.id)
      .in('status', ['pending', 'in_progress'])

    if (campaignLeads) {
      await supabase
        .from('campaign_leads')
        .update({
          status: 'bounced',
          stopped_reason: 'email_bounce',
          completed_at: new Date().toISOString(),
        })
        .in(
          'id',
          campaignLeads.map((cl) => cl.id)
        )

      // Add to suppression list
      await supabase.rpc('add_to_suppression_list', {
        p_email: emailAddress,
        p_suppression_type: 'bounce',
        p_reason: 'Permanent bounce',
      })

      return { campaignsStopped: campaignLeads.length }
    }
  } else {
    // For transient bounces, just log the bounce
    await supabase.from('email_bounces').insert({
      email: emailAddress,
      bounce_type: bounceType,
      created_at: new Date().toISOString(),
    })
  }

  return { campaignsStopped: 0 }
}

async function trackEmailEvent(trackingData: any) {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('email_events')
    .insert({
      ...trackingData,
      created_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) throw error

  return { tracked: true, eventId: data.id }
}

async function getCampaignAnalytics(campaignId: string) {
  const supabase = createClient()

  const { data } = await supabase
    .rpc('get_campaign_analytics', { p_campaign_id: campaignId })
    .single()

  return {
    totalSent: data.total_sent,
    delivered: data.delivered,
    opened: data.opened,
    clicked: data.clicked,
    replied: data.replied,
    unsubscribed: data.unsubscribed,
    bounced: data.bounced,
    openRate: (data.opened / data.delivered) * 100,
    clickRate: (data.clicked / data.delivered) * 100,
    replyRate: (data.replied / data.delivered) * 100,
    unsubscribeRate: (data.unsubscribed / data.delivered) * 100,
  }
}

async function getCampaignPerformanceTimeSeries(campaignId: string, timeRange: any) {
  const supabase = createClient()

  const { data } = await supabase
    .from('campaign_daily_stats')
    .select('*')
    .eq('campaign_id', campaignId)
    .gte('date', timeRange.start)
    .lte('date', timeRange.end)
    .order('date')

  return (
    data?.map((day: any) => ({
      ...day,
      openRate: day.sent > 0 ? (day.opened / day.sent) * 100 : 0,
      clickRate: day.sent > 0 ? (day.clicked / day.sent) * 100 : 0,
    })) || []
  )
}

async function pauseCampaign(campaignId: string) {
  const supabase = createClient()

  // Update campaign status
  const { data, error } = await supabase
    .from('campaigns')
    .update({
      status: 'paused',
      paused_at: new Date().toISOString(),
    })
    .eq('id', campaignId)
    .select()
    .single()

  if (error) throw error

  // Pause all pending queue items
  await supabase
    .from('campaign_schedule_queue')
    .update({ status: 'paused' })
    .eq('campaign_id', campaignId)
    .eq('status', 'pending')

  return data
}

async function resumeCampaign(campaignId: string) {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('campaigns')
    .update({
      status: 'active',
      paused_at: null,
      resumed_at: new Date().toISOString(),
    })
    .eq('id', campaignId)
    .select()
    .single()

  if (error) throw error

  // Resume all paused queue items
  await supabase
    .from('campaign_schedule_queue')
    .update({ status: 'pending' })
    .eq('campaign_id', campaignId)
    .eq('status', 'paused')

  return data
}

async function deleteCampaign(campaignId: string) {
  const supabase = createClient()

  // Check if campaign is active
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('status')
    .eq('id', campaignId)
    .single()

  if (campaign?.status === 'active') {
    throw new Error('Cannot delete active campaign')
  }

  // Delete in order of foreign key dependencies
  await supabase.from('campaign_schedule_queue').delete().eq('campaign_id', campaignId)
  await supabase.from('campaign_leads').delete().eq('campaign_id', campaignId)
  await supabase.from('campaign_sequences').delete().eq('campaign_id', campaignId)
  await supabase.from('campaigns').delete().eq('id', campaignId)

  return { deleted: true }
}

// Helper functions
function replaceVariables(template: string, lead: any): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return lead[key] || match
  })
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '')
}