import { createServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { PipedriveReplyHandlerService } from './reply-handler';
import { EmailReplyDetectionService } from './reply-detection';

export interface EmailEvent {
  id: string;
  workspaceId: string;
  emailId: string;
  campaignId?: string;
  leadId?: string;
  eventType: 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'replied' | 'unsubscribed';
  metadata: Record<string, any>;
  createdAt: Date;
}

export interface IncomingEmailData {
  messageId: string;
  threadId?: string;
  inReplyTo?: string;
  fromEmail: string;
  fromName?: string;
  toEmail: string;
  subject: string;
  textContent: string;
  htmlContent?: string;
  headers: Record<string, string>;
  receivedAt: Date;
  attachments?: Array<{
    filename: string;
    contentType: string;
    size: number;
    data?: Buffer;
  }>;
}

export interface EmailWebhookPayload {
  event: string;
  timestamp: string;
  messageId: string;
  email: string;
  data: Record<string, any>;
}

export class EmailTrackingIntegrationService {
  private workspaceId: string;
  private replyHandler?: PipedriveReplyHandlerService;
  private replyDetection?: EmailReplyDetectionService;

  constructor(workspaceId: string) {
    this.workspaceId = workspaceId;
  }

  /**
   * Initialize Pipedrive services if enabled
   */
  private async initializePipedriveServices(): Promise<void> {
    const supabase = createServerClient(cookies());
    
    // Check if Pipedrive integration is enabled and configured
    const { data: integration } = await supabase
      .from('pipedrive_integrations')
      .select('*')
      .eq('workspace_id', this.workspaceId)
      .single();

    if (integration && integration.enabled) {
      // Check if reply handler is configured
      const { data: replyConfig } = await supabase
        .from('pipedrive_reply_handler_settings')
        .select('*')
        .eq('workspace_id', this.workspaceId)
        .single();

      if (replyConfig && replyConfig.enabled) {
        this.replyHandler = new PipedriveReplyHandlerService(this.workspaceId, replyConfig.config);
        this.replyDetection = new EmailReplyDetectionService(this.workspaceId);
      }
    }
  }

  /**
   * Process incoming email webhook
   */
  async processEmailWebhook(payload: EmailWebhookPayload): Promise<{
    success: boolean;
    processed: boolean;
    actions: string[];
    error?: string;
  }> {
    try {
      await this.initializePipedriveServices();

      const actions: string[] = [];

      // Handle email events from tracking service
      switch (payload.event) {
        case 'email_delivered':
          await this.handleEmailDelivered(payload);
          actions.push('logged_delivery');
          break;

        case 'email_opened':
          await this.handleEmailOpened(payload);
          actions.push('logged_open');
          break;

        case 'email_clicked':
          await this.handleEmailClicked(payload);
          actions.push('logged_click');
          break;

        case 'email_replied':
          const replyProcessed = await this.handleEmailReply(payload);
          actions.push('logged_reply');
          if (replyProcessed) {
            actions.push('processed_reply_for_pipedrive');
          }
          break;

        case 'email_bounced':
          await this.handleEmailBounced(payload);
          actions.push('logged_bounce');
          break;

        case 'email_unsubscribed':
          await this.handleEmailUnsubscribed(payload);
          actions.push('logged_unsubscribe');
          break;

        default:
          return {
            success: false,
            processed: false,
            actions: [],
            error: `Unknown event type: ${payload.event}`,
          };
      }

      return {
        success: true,
        processed: true,
        actions,
      };
    } catch (error) {
      console.error('Error processing email webhook:', error);
      return {
        success: false,
        processed: false,
        actions: [],
        error: (error as Error).message,
      };
    }
  }

  /**
   * Process incoming email directly (e.g., from email server)
   */
  async processIncomingEmail(emailData: IncomingEmailData): Promise<{
    success: boolean;
    isReply: boolean;
    pipedriveProcessed: boolean;
    replyId?: string;
    actions: string[];
    error?: string;
  }> {
    try {
      await this.initializePipedriveServices();

      const actions: string[] = [];

      // Convert to reply format
      const replyData = {
        id: emailData.messageId,
        messageId: emailData.messageId,
        threadId: emailData.threadId,
        inReplyTo: emailData.inReplyTo,
        fromEmail: emailData.fromEmail,
        fromName: emailData.fromName,
        toEmail: emailData.toEmail,
        subject: emailData.subject,
        content: emailData.textContent,
        htmlContent: emailData.htmlContent,
        receivedAt: emailData.receivedAt,
        headers: emailData.headers,
        isReply: !!(emailData.inReplyTo || emailData.threadId || this.isReplySubject(emailData.subject)),
      };

      // Check if this is a reply to one of our emails
      if (!this.replyDetection) {
        return {
          success: true,
          isReply: false,
          pipedriveProcessed: false,
          actions: ['stored_email'],
        };
      }

      const isReply = await this.replyDetection.detectReply(replyData);
      actions.push('checked_reply_status');

      if (!isReply) {
        return {
          success: true,
          isReply: false,
          pipedriveProcessed: false,
          actions,
        };
      }

      // Store the email as a reply
      await this.storeIncomingEmail(emailData, true);
      actions.push('stored_reply');

      // Process with Pipedrive if handler is available
      let pipedriveProcessed = false;
      if (this.replyHandler) {
        try {
          const result = await this.replyHandler.processReply(replyData);
          pipedriveProcessed = result.processed;
          
          if (result.success) {
            actions.push('processed_with_pipedrive');
            if (result.actions.length > 0) {
              actions.push(`pipedrive_actions: ${result.actions.map(a => a.type).join(', ')}`);
            }
          } else if (result.errors.length > 0) {
            actions.push(`pipedrive_errors: ${result.errors.join(', ')}`);
          }
        } catch (error) {
          console.error('Error processing reply with Pipedrive:', error);
          actions.push(`pipedrive_error: ${(error as Error).message}`);
        }
      }

      return {
        success: true,
        isReply: true,
        pipedriveProcessed,
        replyId: emailData.messageId,
        actions,
      };
    } catch (error) {
      console.error('Error processing incoming email:', error);
      return {
        success: false,
        isReply: false,
        pipedriveProcessed: false,
        actions: [],
        error: (error as Error).message,
      };
    }
  }

  /**
   * Handle email delivered event
   */
  private async handleEmailDelivered(payload: EmailWebhookPayload): Promise<void> {
    const supabase = createServerClient(cookies());

    // Update email status
    await supabase
      .from('campaign_emails')
      .update({
        status: 'delivered',
        delivered_at: new Date(payload.timestamp).toISOString(),
      })
      .eq('message_id', payload.messageId)
      .eq('workspace_id', this.workspaceId);

    // Log event
    await this.logEmailEvent({
      emailId: await this.getEmailIdByMessageId(payload.messageId),
      eventType: 'delivered',
      metadata: payload.data,
      createdAt: new Date(payload.timestamp),
    });
  }

  /**
   * Handle email opened event
   */
  private async handleEmailOpened(payload: EmailWebhookPayload): Promise<void> {
    const supabase = createServerClient(cookies());

    // Update email with open information
    const { data: email } = await supabase
      .from('campaign_emails')
      .select('id, open_count, opened_at')
      .eq('message_id', payload.messageId)
      .eq('workspace_id', this.workspaceId)
      .single();

    if (email) {
      await supabase
        .from('campaign_emails')
        .update({
          opened_at: email.opened_at || new Date(payload.timestamp).toISOString(),
          open_count: (email.open_count || 0) + 1,
        })
        .eq('id', email.id);

      // Update lead engagement score
      const leadId = await this.getLeadIdByEmailId(email.id);
      if (leadId) {
        await supabase.rpc('increment_engagement_score', {
          p_lead_id: leadId,
          p_points: 5, // Points for opening email
        });
      }
    }

    // Log event
    await this.logEmailEvent({
      emailId: email?.id,
      eventType: 'opened',
      metadata: {
        ...payload.data,
        user_agent: payload.data.user_agent,
        ip_address: payload.data.ip_address,
      },
      createdAt: new Date(payload.timestamp),
    });
  }

  /**
   * Handle email clicked event
   */
  private async handleEmailClicked(payload: EmailWebhookPayload): Promise<void> {
    const supabase = createServerClient(cookies());

    // Update email with click information
    const { data: email } = await supabase
      .from('campaign_emails')
      .select('id, click_count, clicked_at')
      .eq('message_id', payload.messageId)
      .eq('workspace_id', this.workspaceId)
      .single();

    if (email) {
      await supabase
        .from('campaign_emails')
        .update({
          clicked_at: email.clicked_at || new Date(payload.timestamp).toISOString(),
          click_count: (email.click_count || 0) + 1,
        })
        .eq('id', email.id);

      // Update lead engagement score
      const leadId = await this.getLeadIdByEmailId(email.id);
      if (leadId) {
        await supabase.rpc('increment_engagement_score', {
          p_lead_id: leadId,
          p_points: 10, // Points for clicking link
        });
      }
    }

    // Log event
    await this.logEmailEvent({
      emailId: email?.id,
      eventType: 'clicked',
      metadata: {
        ...payload.data,
        url: payload.data.url,
        link_text: payload.data.link_text,
      },
      createdAt: new Date(payload.timestamp),
    });
  }

  /**
   * Handle email reply event
   */
  private async handleEmailReply(payload: EmailWebhookPayload): Promise<boolean> {
    const supabase = createServerClient(cookies());

    // Update original email with reply information
    const { data: email } = await supabase
      .from('campaign_emails')
      .select('id, replied_at')
      .eq('message_id', payload.messageId)
      .eq('workspace_id', this.workspaceId)
      .single();

    if (email) {
      await supabase
        .from('campaign_emails')
        .update({
          replied_at: email.replied_at || new Date(payload.timestamp).toISOString(),
        })
        .eq('id', email.id);

      // Update lead engagement score
      const leadId = await this.getLeadIdByEmailId(email.id);
      if (leadId) {
        await supabase.rpc('increment_engagement_score', {
          p_lead_id: leadId,
          p_points: 25, // High points for replying
        });
      }
    }

    // Log event
    await this.logEmailEvent({
      emailId: email?.id,
      eventType: 'replied',
      metadata: {
        ...payload.data,
        reply_message_id: payload.data.reply_message_id,
        reply_subject: payload.data.reply_subject,
      },
      createdAt: new Date(payload.timestamp),
    });

    // If reply handler is available, process the reply
    if (this.replyHandler && payload.data.reply_content) {
      try {
        const replyData = {
          id: payload.data.reply_message_id || `reply_${Date.now()}`,
          messageId: payload.data.reply_message_id,
          inReplyTo: payload.messageId,
          fromEmail: payload.email,
          toEmail: payload.data.to_email,
          subject: payload.data.reply_subject || 'Reply',
          content: payload.data.reply_content,
          receivedAt: new Date(payload.timestamp),
          headers: payload.data.headers || {},
          isReply: true,
        };

        await this.replyHandler.processReply(replyData);
        return true;
      } catch (error) {
        console.error('Error processing reply with handler:', error);
      }
    }

    return false;
  }

  /**
   * Handle email bounced event
   */
  private async handleEmailBounced(payload: EmailWebhookPayload): Promise<void> {
    const supabase = createServerClient(cookies());

    // Update email status
    await supabase
      .from('campaign_emails')
      .update({
        status: 'bounced',
        bounced_at: new Date(payload.timestamp).toISOString(),
        bounce_reason: payload.data.reason || 'Unknown',
      })
      .eq('message_id', payload.messageId)
      .eq('workspace_id', this.workspaceId);

    // Log event
    await this.logEmailEvent({
      emailId: await this.getEmailIdByMessageId(payload.messageId),
      eventType: 'bounced',
      metadata: {
        ...payload.data,
        bounce_type: payload.data.bounce_type,
        bounce_reason: payload.data.reason,
      },
      createdAt: new Date(payload.timestamp),
    });

    // Mark lead as having bounced email for future campaigns
    const emailId = await this.getEmailIdByMessageId(payload.messageId);
    if (emailId) {
      const leadId = await this.getLeadIdByEmailId(emailId);
      if (leadId) {
        await supabase
          .from('leads')
          .update({
            email_status: 'bounced',
            last_bounce_at: new Date(payload.timestamp).toISOString(),
          })
          .eq('id', leadId)
          .eq('workspace_id', this.workspaceId);
      }
    }
  }

  /**
   * Handle email unsubscribed event
   */
  private async handleEmailUnsubscribed(payload: EmailWebhookPayload): Promise<void> {
    const supabase = createServerClient(cookies());

    // Log event
    await this.logEmailEvent({
      emailId: await this.getEmailIdByMessageId(payload.messageId),
      eventType: 'unsubscribed',
      metadata: payload.data,
      createdAt: new Date(payload.timestamp),
    });

    // Mark lead as unsubscribed
    const emailId = await this.getEmailIdByMessageId(payload.messageId);
    if (emailId) {
      const leadId = await this.getLeadIdByEmailId(emailId);
      if (leadId) {
        await supabase
          .from('leads')
          .update({
            unsubscribed: true,
            unsubscribed_at: new Date(payload.timestamp).toISOString(),
          })
          .eq('id', leadId)
          .eq('workspace_id', this.workspaceId);

        // Add to suppression list for GDPR compliance
        await supabase
          .from('suppression_list')
          .insert({
            workspace_id: this.workspaceId,
            email: payload.email,
            suppression_type: 'unsubscribe',
            reason: 'User requested unsubscribe',
            created_at: new Date(payload.timestamp).toISOString(),
          });
      }
    }
  }

  /**
   * Store incoming email in database
   */
  private async storeIncomingEmail(emailData: IncomingEmailData, isReply: boolean): Promise<void> {
    const supabase = createServerClient(cookies());

    const table = isReply ? 'email_replies' : 'incoming_emails';
    
    await supabase
      .from(table)
      .insert({
        id: emailData.messageId,
        workspace_id: this.workspaceId,
        message_id: emailData.messageId,
        thread_id: emailData.threadId,
        in_reply_to: emailData.inReplyTo,
        from_email: emailData.fromEmail,
        from_name: emailData.fromName,
        to_email: emailData.toEmail,
        subject: emailData.subject,
        content: emailData.textContent,
        html_content: emailData.htmlContent,
        headers: emailData.headers,
        received_at: emailData.receivedAt.toISOString(),
        has_attachments: emailData.attachments && emailData.attachments.length > 0,
        processed_at: new Date().toISOString(),
      });

    // Store attachments if any
    if (emailData.attachments && emailData.attachments.length > 0) {
      const attachmentInserts = emailData.attachments.map(attachment => ({
        workspace_id: this.workspaceId,
        email_id: emailData.messageId,
        filename: attachment.filename,
        content_type: attachment.contentType,
        size: attachment.size,
        // data would be stored in separate blob storage
      }));

      await supabase
        .from('email_attachments')
        .insert(attachmentInserts);
    }
  }

  /**
   * Log email event
   */
  private async logEmailEvent(event: Partial<EmailEvent>): Promise<void> {
    if (!event.emailId) return;

    const supabase = createServerClient(cookies());

    await supabase
      .from('email_events')
      .insert({
        workspace_id: this.workspaceId,
        email_id: event.emailId,
        event_type: event.eventType,
        metadata: event.metadata || {},
        created_at: event.createdAt?.toISOString() || new Date().toISOString(),
      });
  }

  /**
   * Get email ID by message ID
   */
  private async getEmailIdByMessageId(messageId: string): Promise<string | null> {
    const supabase = createServerClient(cookies());

    const { data } = await supabase
      .from('campaign_emails')
      .select('id')
      .eq('message_id', messageId)
      .eq('workspace_id', this.workspaceId)
      .single();

    return data?.id || null;
  }

  /**
   * Get lead ID by email ID
   */
  private async getLeadIdByEmailId(emailId: string): Promise<string | null> {
    const supabase = createServerClient(cookies());

    const { data } = await supabase
      .from('campaign_emails')
      .select('lead_id')
      .eq('id', emailId)
      .eq('workspace_id', this.workspaceId)
      .single();

    return data?.lead_id || null;
  }

  /**
   * Check if subject indicates a reply
   */
  private isReplySubject(subject: string): boolean {
    const replyPrefixes = /^(Re:|RE:|Fwd:|FWD:|Fw:|FW:)\s+/i;
    return replyPrefixes.test(subject);
  }

  /**
   * Process batch of unprocessed replies
   */
  async processPendingReplies(limit: number = 50): Promise<{
    totalProcessed: number;
    successful: number;
    failed: number;
    results: any[];
  }> {
    await this.initializePipedriveServices();

    if (!this.replyHandler) {
      return {
        totalProcessed: 0,
        successful: 0,
        failed: 0,
        results: [],
      };
    }

    return this.replyHandler.batchProcessReplies(limit);
  }

  /**
   * Get email tracking statistics
   */
  async getEmailTrackingStats(campaignId?: string, days: number = 30): Promise<{
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    replied: number;
    bounced: number;
    unsubscribed: number;
    deliveryRate: number;
    openRate: number;
    clickRate: number;
    replyRate: number;
    bounceRate: number;
  }> {
    const supabase = createServerClient(cookies());
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    let query = supabase
      .from('campaign_emails')
      .select('status, opened_at, clicked_at, replied_at, bounced_at')
      .eq('workspace_id', this.workspaceId)
      .gte('sent_at', cutoffDate.toISOString());

    if (campaignId) {
      query = query.eq('campaign_id', campaignId);
    }

    const { data: emails } = await query;

    if (!emails || emails.length === 0) {
      return {
        sent: 0,
        delivered: 0,
        opened: 0,
        clicked: 0,
        replied: 0,
        bounced: 0,
        unsubscribed: 0,
        deliveryRate: 0,
        openRate: 0,
        clickRate: 0,
        replyRate: 0,
        bounceRate: 0,
      };
    }

    const sent = emails.length;
    const delivered = emails.filter(e => e.status === 'delivered' || e.opened_at || e.clicked_at || e.replied_at).length;
    const opened = emails.filter(e => e.opened_at).length;
    const clicked = emails.filter(e => e.clicked_at).length;
    const replied = emails.filter(e => e.replied_at).length;
    const bounced = emails.filter(e => e.status === 'bounced').length;

    // Get unsubscribe count from events
    const { count: unsubscribed } = await supabase
      .from('email_events')
      .select('*', { count: 'exact' })
      .eq('workspace_id', this.workspaceId)
      .eq('event_type', 'unsubscribed')
      .gte('created_at', cutoffDate.toISOString());

    return {
      sent,
      delivered,
      opened,
      clicked,
      replied,
      bounced,
      unsubscribed: unsubscribed || 0,
      deliveryRate: sent > 0 ? (delivered / sent) * 100 : 0,
      openRate: delivered > 0 ? (opened / delivered) * 100 : 0,
      clickRate: opened > 0 ? (clicked / opened) * 100 : 0,
      replyRate: delivered > 0 ? (replied / delivered) * 100 : 0,
      bounceRate: sent > 0 ? (bounced / sent) * 100 : 0,
    };
  }

  /**
   * Enable or disable Pipedrive integration
   */
  async togglePipedriveIntegration(enabled: boolean): Promise<void> {
    const supabase = createServerClient(cookies());

    await supabase
      .from('pipedrive_reply_handler_settings')
      .upsert({
        workspace_id: this.workspaceId,
        enabled,
        last_updated: new Date().toISOString(),
      });

    // Re-initialize services if enabling
    if (enabled) {
      await this.initializePipedriveServices();
    } else {
      this.replyHandler = undefined;
      this.replyDetection = undefined;
    }
  }
}