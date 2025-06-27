import { createServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { SentimentAnalysisService, SentimentResult, EmailReplyContext } from '@/lib/ai/sentiment-analysis';

export interface EmailReply {
  id: string;
  messageId: string;
  threadId?: string;
  inReplyTo?: string;
  fromEmail: string;
  fromName?: string;
  toEmail: string;
  subject: string;
  content: string;
  htmlContent?: string;
  receivedAt: Date;
  headers: Record<string, string>;
  isReply: boolean;
  originalEmailId?: string;
  campaignId?: string;
  leadId?: string;
}

export interface ReplyProcessingResult {
  success: boolean;
  replyId: string;
  sentiment?: SentimentResult;
  originalEmail?: {
    id: string;
    subject: string;
    content: string;
    campaignId?: string;
    leadId?: string;
  };
  leadInfo?: {
    id: string;
    email: string;
    name?: string;
    company?: string;
    title?: string;
  };
  action: 'processed' | 'skipped' | 'error';
  reason?: string;
  error?: string;
}

export interface ReplyDetectionConfig {
  enableSentimentAnalysis: boolean;
  enableAutoProcessing: boolean;
  skipNegativeReplies: boolean;
  minConfidenceThreshold: number;
  minQualificationScore: number;
  processingRules: {
    positiveIntents: string[];
    negativeIntents: string[];
    qualifyingIntents: string[];
  };
}

export class EmailReplyDetectionService {
  private workspaceId: string;
  private sentimentService?: SentimentAnalysisService;
  private config: ReplyDetectionConfig;

  constructor(workspaceId: string, config?: Partial<ReplyDetectionConfig>) {
    this.workspaceId = workspaceId;
    this.config = {
      enableSentimentAnalysis: true,
      enableAutoProcessing: true,
      skipNegativeReplies: false,
      minConfidenceThreshold: 0.6,
      minQualificationScore: 40,
      processingRules: {
        positiveIntents: ['interested', 'meeting_request', 'question'],
        negativeIntents: ['not_interested', 'complaint', 'unsubscribe'],
        qualifyingIntents: ['interested', 'meeting_request', 'question'],
      },
      ...config,
    };
  }

  /**
   * Initialize sentiment analysis service
   */
  private async initializeSentimentService(): Promise<void> {
    if (this.config.enableSentimentAnalysis && !this.sentimentService) {
      const provider = process.env.AI_PROVIDER as 'openai' | 'anthropic';
      const apiKey = process.env.AI_API_KEY;
      
      if (provider && apiKey) {
        this.sentimentService = new SentimentAnalysisService({
          provider,
          apiKey,
          model: process.env.AI_MODEL,
          temperature: 0.3,
          maxTokens: 500,
        });
      }
    }
  }

  /**
   * Detect if an email is a reply to a campaign email
   */
  async detectReply(emailData: EmailReply): Promise<boolean> {
    // Check if it's marked as a reply
    if (!emailData.isReply && !emailData.inReplyTo) {
      return false;
    }

    // Check if it's a reply to one of our emails
    const originalEmail = await this.findOriginalEmail(emailData);
    return originalEmail !== null;
  }

  /**
   * Process an email reply and perform sentiment analysis
   */
  async processReply(emailData: EmailReply): Promise<ReplyProcessingResult> {
    const supabase = createServerClient(cookies());
    
    try {
      // Find the original email this is replying to
      const originalEmail = await this.findOriginalEmail(emailData);
      if (!originalEmail) {
        return {
          success: false,
          replyId: emailData.id,
          action: 'skipped',
          reason: 'Original email not found',
        };
      }

      // Get lead information
      const leadInfo = await this.getLeadInfo(originalEmail.leadId);
      if (!leadInfo) {
        return {
          success: false,
          replyId: emailData.id,
          action: 'skipped',
          reason: 'Lead information not found',
        };
      }

      // Perform sentiment analysis if enabled
      let sentiment: SentimentResult | undefined;
      if (this.config.enableSentimentAnalysis) {
        await this.initializeSentimentService();
        
        if (this.sentimentService) {
          const context: EmailReplyContext = {
            originalSubject: originalEmail.subject,
            originalContent: originalEmail.content,
            replyContent: emailData.content,
            senderEmail: emailData.fromEmail,
            leadInfo: {
              name: leadInfo.name,
              company: leadInfo.company,
              title: leadInfo.title,
            },
            campaignInfo: originalEmail.campaignId ? await this.getCampaignInfo(originalEmail.campaignId) : undefined,
          };

          try {
            sentiment = await this.sentimentService.analyzeReply(context);
          } catch (error) {
            console.error('Sentiment analysis failed:', error);
          }
        }
      }

      // Store the reply in database
      await this.storeReply(emailData, originalEmail, sentiment, leadInfo);

      // Update lead engagement metrics
      await this.updateLeadEngagement(leadInfo.id, sentiment);

      // Update email events table
      await this.createEmailEvent(emailData, originalEmail, sentiment);

      return {
        success: true,
        replyId: emailData.id,
        sentiment,
        originalEmail,
        leadInfo,
        action: 'processed',
      };
    } catch (error) {
      console.error('Error processing email reply:', error);
      return {
        success: false,
        replyId: emailData.id,
        action: 'error',
        error: (error as Error).message,
      };
    }
  }

  /**
   * Find the original email this is a reply to
   */
  private async findOriginalEmail(emailData: EmailReply): Promise<{
    id: string;
    subject: string;
    content: string;
    campaignId?: string;
    leadId?: string;
  } | null> {
    const supabase = createServerClient(cookies());

    // Try to find by In-Reply-To header
    if (emailData.inReplyTo) {
      const { data: originalByMessageId } = await supabase
        .from('campaign_emails')
        .select('id, subject, content_text, campaign_id, lead_id')
        .eq('workspace_id', this.workspaceId)
        .eq('message_id', emailData.inReplyTo)
        .single();

      if (originalByMessageId) {
        return {
          id: originalByMessageId.id,
          subject: originalByMessageId.subject,
          content: originalByMessageId.content_text || '',
          campaignId: originalByMessageId.campaign_id,
          leadId: originalByMessageId.lead_id,
        };
      }
    }

    // Try to find by thread ID
    if (emailData.threadId) {
      const { data: originalByThread } = await supabase
        .from('campaign_emails')
        .select('id, subject, content_text, campaign_id, lead_id')
        .eq('workspace_id', this.workspaceId)
        .eq('thread_id', emailData.threadId)
        .order('sent_at', { ascending: false })
        .limit(1)
        .single();

      if (originalByThread) {
        return {
          id: originalByThread.id,
          subject: originalByThread.subject,
          content: originalByThread.content_text || '',
          campaignId: originalByThread.campaign_id,
          leadId: originalByThread.lead_id,
        };
      }
    }

    // Try to find by email address and subject similarity
    const cleanSubject = this.cleanReplySubject(emailData.subject);
    const { data: originalBySubject } = await supabase
      .from('campaign_emails')
      .select('id, subject, content_text, campaign_id, lead_id')
      .eq('workspace_id', this.workspaceId)
      .ilike('subject', `%${cleanSubject}%`)
      .order('sent_at', { ascending: false })
      .limit(5);

    if (originalBySubject && originalBySubject.length > 0) {
      // Get lead info to match email addresses
      for (const email of originalBySubject) {
        const { data: lead } = await supabase
          .from('leads')
          .select('email')
          .eq('id', email.lead_id)
          .eq('workspace_id', this.workspaceId)
          .single();

        if (lead && lead.email.toLowerCase() === emailData.fromEmail.toLowerCase()) {
          return {
            id: email.id,
            subject: email.subject,
            content: email.content_text || '',
            campaignId: email.campaign_id,
            leadId: email.lead_id,
          };
        }
      }
    }

    return null;
  }

  /**
   * Clean reply subject (remove Re:, Fwd:, etc.)
   */
  private cleanReplySubject(subject: string): string {
    return subject
      .replace(/^(Re:|RE:|Fwd:|FWD:|Fw:|FW:)\s*/gi, '')
      .trim();
  }

  /**
   * Get lead information
   */
  private async getLeadInfo(leadId?: string): Promise<{
    id: string;
    email: string;
    name?: string;
    company?: string;
    title?: string;
  } | null> {
    if (!leadId) return null;

    const supabase = createServerClient(cookies());
    const { data: lead } = await supabase
      .from('leads')
      .select('id, email, first_name, last_name, company, title')
      .eq('id', leadId)
      .eq('workspace_id', this.workspaceId)
      .single();

    if (!lead) return null;

    return {
      id: lead.id,
      email: lead.email,
      name: lead.first_name && lead.last_name 
        ? `${lead.first_name} ${lead.last_name}` 
        : lead.first_name || lead.last_name,
      company: lead.company,
      title: lead.title,
    };
  }

  /**
   * Get campaign information
   */
  private async getCampaignInfo(campaignId: string): Promise<{
    name: string;
    type: string;
    stage: string;
  } | undefined> {
    const supabase = createServerClient(cookies());
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('name, type, status')
      .eq('id', campaignId)
      .eq('workspace_id', this.workspaceId)
      .single();

    if (!campaign) return undefined;

    return {
      name: campaign.name,
      type: campaign.type || 'outbound',
      stage: campaign.status || 'active',
    };
  }

  /**
   * Store the reply in the database
   */
  private async storeReply(
    emailData: EmailReply,
    originalEmail: any,
    sentiment: SentimentResult | undefined,
    leadInfo: any
  ): Promise<void> {
    const supabase = createServerClient(cookies());

    // Store in email_replies table
    await supabase
      .from('email_replies')
      .insert({
        id: emailData.id,
        workspace_id: this.workspaceId,
        original_email_id: originalEmail.id,
        campaign_id: originalEmail.campaignId,
        lead_id: originalEmail.leadId,
        from_email: emailData.fromEmail,
        from_name: emailData.fromName,
        to_email: emailData.toEmail,
        subject: emailData.subject,
        content: emailData.content,
        html_content: emailData.htmlContent,
        received_at: emailData.receivedAt.toISOString(),
        message_id: emailData.messageId,
        thread_id: emailData.threadId,
        in_reply_to: emailData.inReplyTo,
        headers: emailData.headers,
        sentiment: sentiment?.sentiment,
        sentiment_confidence: sentiment?.confidence,
        sentiment_reasoning: sentiment?.reasoning,
        intent: sentiment?.intent,
        qualification_score: sentiment?.qualificationScore,
        key_phrases: sentiment?.keyPhrases,
        urgency: sentiment?.urgency,
        processed_at: new Date().toISOString(),
      });

    // Update the original email with reply information
    await supabase
      .from('campaign_emails')
      .update({
        replied_at: emailData.receivedAt.toISOString(),
        reply_count: 1, // You might want to increment this instead
      })
      .eq('id', originalEmail.id);
  }

  /**
   * Update lead engagement metrics
   */
  private async updateLeadEngagement(leadId: string, sentiment?: SentimentResult): Promise<void> {
    const supabase = createServerClient(cookies());

    let engagementPoints = 10; // Base points for replying

    if (sentiment) {
      // Add points based on sentiment and intent
      switch (sentiment.sentiment) {
        case 'positive':
          engagementPoints += 20;
          break;
        case 'neutral':
          engagementPoints += 5;
          break;
        case 'negative':
          engagementPoints -= 5;
          break;
      }

      // Add points based on intent
      switch (sentiment.intent) {
        case 'interested':
          engagementPoints += 30;
          break;
        case 'meeting_request':
          engagementPoints += 50;
          break;
        case 'question':
          engagementPoints += 15;
          break;
        case 'not_interested':
          engagementPoints -= 20;
          break;
        case 'unsubscribe':
          engagementPoints -= 50;
          break;
      }

      // Add points based on qualification score
      engagementPoints += Math.floor(sentiment.qualificationScore / 10);
    }

    // Update lead engagement score and last activity
    await supabase.rpc('increment_engagement_score', {
      p_lead_id: leadId,
      p_points: engagementPoints,
    });

    await supabase
      .from('leads')
      .update({
        last_activity_at: new Date().toISOString(),
      })
      .eq('id', leadId)
      .eq('workspace_id', this.workspaceId);
  }

  /**
   * Create email event for tracking
   */
  private async createEmailEvent(
    emailData: EmailReply,
    originalEmail: any,
    sentiment?: SentimentResult
  ): Promise<void> {
    const supabase = createServerClient(cookies());

    await supabase
      .from('email_events')
      .insert({
        workspace_id: this.workspaceId,
        email_id: originalEmail.id,
        campaign_id: originalEmail.campaignId,
        lead_id: originalEmail.leadId,
        event_type: 'replied',
        metadata: {
          reply_id: emailData.id,
          reply_message_id: emailData.messageId,
          reply_subject: emailData.subject,
          sentiment: sentiment?.sentiment,
          intent: sentiment?.intent,
          qualification_score: sentiment?.qualificationScore,
          confidence: sentiment?.confidence,
          urgency: sentiment?.urgency,
          key_phrases: sentiment?.keyPhrases,
        },
        created_at: emailData.receivedAt.toISOString(),
      });
  }

  /**
   * Check if a reply qualifies for auto-processing
   */
  isQualifyingReply(sentiment: SentimentResult): boolean {
    // Check confidence threshold
    if (sentiment.confidence < this.config.minConfidenceThreshold) {
      return false;
    }

    // Check qualification score threshold
    if (sentiment.qualificationScore < this.config.minQualificationScore) {
      return false;
    }

    // Check if intent is in qualifying list
    if (!this.config.processingRules.qualifyingIntents.includes(sentiment.intent)) {
      return false;
    }

    // Skip negative replies if configured
    if (this.config.skipNegativeReplies && sentiment.sentiment === 'negative') {
      return false;
    }

    return true;
  }

  /**
   * Get recent unprocessed replies
   */
  async getUnprocessedReplies(limit: number = 50): Promise<EmailReply[]> {
    const supabase = createServerClient(cookies());

    const { data: replies } = await supabase
      .from('email_replies')
      .select('*')
      .eq('workspace_id', this.workspaceId)
      .is('pipedrive_processed_at', null)
      .order('received_at', { ascending: false })
      .limit(limit);

    if (!replies) return [];

    return replies.map(reply => ({
      id: reply.id,
      messageId: reply.message_id,
      threadId: reply.thread_id,
      inReplyTo: reply.in_reply_to,
      fromEmail: reply.from_email,
      fromName: reply.from_name,
      toEmail: reply.to_email,
      subject: reply.subject,
      content: reply.content,
      htmlContent: reply.html_content,
      receivedAt: new Date(reply.received_at),
      headers: reply.headers || {},
      isReply: true,
      originalEmailId: reply.original_email_id,
      campaignId: reply.campaign_id,
      leadId: reply.lead_id,
    }));
  }

  /**
   * Mark replies as processed
   */
  async markRepliesAsProcessed(replyIds: string[]): Promise<void> {
    const supabase = createServerClient(cookies());

    await supabase
      .from('email_replies')
      .update({
        pipedrive_processed_at: new Date().toISOString(),
      })
      .in('id', replyIds)
      .eq('workspace_id', this.workspaceId);
  }

  /**
   * Get reply processing statistics
   */
  async getProcessingStats(days: number = 30): Promise<{
    totalReplies: number;
    processedReplies: number;
    qualifyingReplies: number;
    sentimentDistribution: Record<string, number>;
    intentDistribution: Record<string, number>;
    averageQualificationScore: number;
  }> {
    const supabase = createServerClient(cookies());
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const { data: replies } = await supabase
      .from('email_replies')
      .select('sentiment, intent, qualification_score, pipedrive_processed_at')
      .eq('workspace_id', this.workspaceId)
      .gte('received_at', cutoffDate.toISOString());

    if (!replies || replies.length === 0) {
      return {
        totalReplies: 0,
        processedReplies: 0,
        qualifyingReplies: 0,
        sentimentDistribution: {},
        intentDistribution: {},
        averageQualificationScore: 0,
      };
    }

    const processedReplies = replies.filter(r => r.pipedrive_processed_at).length;
    const qualifyingReplies = replies.filter(r => 
      r.qualification_score && r.qualification_score >= this.config.minQualificationScore
    ).length;

    const sentimentCounts: Record<string, number> = {};
    const intentCounts: Record<string, number> = {};
    let totalQualificationScore = 0;
    let scoredReplies = 0;

    for (const reply of replies) {
      if (reply.sentiment) {
        sentimentCounts[reply.sentiment] = (sentimentCounts[reply.sentiment] || 0) + 1;
      }
      if (reply.intent) {
        intentCounts[reply.intent] = (intentCounts[reply.intent] || 0) + 1;
      }
      if (reply.qualification_score !== null) {
        totalQualificationScore += reply.qualification_score;
        scoredReplies++;
      }
    }

    return {
      totalReplies: replies.length,
      processedReplies,
      qualifyingReplies,
      sentimentDistribution: sentimentCounts,
      intentDistribution: intentCounts,
      averageQualificationScore: scoredReplies > 0 ? totalQualificationScore / scoredReplies : 0,
    };
  }
}