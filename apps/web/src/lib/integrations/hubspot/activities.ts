import { HubSpotClient } from './client';
import { HubSpotAuth } from './auth';
import { createServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import {
  HubSpotEngagementEvent,
  HubSpotSyncError,
} from './types';

interface EmailEngagement {
  id: string;
  campaignId: string;
  leadId: string;
  leadEmail: string;
  hubspotContactId?: string;
  subject: string;
  content?: string;
  sentAt: Date;
  openedAt?: Date;
  clickedAt?: Date;
  repliedAt?: Date;
  bouncedAt?: Date;
}

export class HubSpotActivityLogger {
  private client: HubSpotClient;
  private auth: HubSpotAuth;
  private workspaceId: string;

  constructor(workspaceId: string, accessToken?: string) {
    this.workspaceId = workspaceId;
    this.auth = new HubSpotAuth();
    
    if (accessToken) {
      this.client = new HubSpotClient(accessToken);
    }
  }

  /**
   * Initialize client with valid access token
   */
  private async ensureClient() {
    if (!this.client) {
      const accessToken = await this.auth.getValidAccessToken(this.workspaceId);
      this.client = new HubSpotClient(accessToken);
    }
  }

  /**
   * Log email sent activity
   */
  async logEmailSent(engagement: EmailEngagement): Promise<void> {
    await this.ensureClient();

    try {
      const contactId = await this.getHubSpotContactId(engagement.leadId, engagement.leadEmail);
      if (!contactId) {
        console.warn(`No HubSpot contact found for lead ${engagement.leadId}`);
        return;
      }

      const engagementData = {
        engagement: {
          active: true,
          type: 'EMAIL',
          timestamp: engagement.sentAt.getTime(),
        },
        associations: {
          contactIds: [contactId],
        },
        metadata: {
          from: {
            email: 'noreply@coldcopy.cc', // Should be from workspace settings
            firstName: 'ColdCopy',
            lastName: 'System',
          },
          to: [{
            email: engagement.leadEmail,
          }],
          subject: engagement.subject,
          html: engagement.content || '',
          text: engagement.content || '',
        },
      };

      await this.client.post('/engagements/v1/engagements', engagementData);
      
      await this.recordActivity('EMAIL_SENT', engagement, contactId);
    } catch (error) {
      throw new HubSpotSyncError(
        `Failed to log email sent: ${error.message}`,
        engagement.id,
        'activity'
      );
    }
  }

  /**
   * Log email opened activity
   */
  async logEmailOpened(
    emailId: string,
    openedAt: Date
  ): Promise<void> {
    await this.ensureClient();

    try {
      const engagement = await this.getEmailEngagement(emailId);
      if (!engagement) {
        console.warn(`Email engagement not found: ${emailId}`);
        return;
      }

      const contactId = await this.getHubSpotContactId(engagement.leadId, engagement.leadEmail);
      if (!contactId) {
        return;
      }

      // Create timeline event for email open
      await this.createTimelineEvent(
        contactId,
        'Email Opened',
        {
          email: engagement.leadEmail,
          subject: engagement.subject,
          campaignId: engagement.campaignId,
          openedAt: openedAt.toISOString(),
        }
      );

      await this.recordActivity('EMAIL_OPENED', engagement, contactId);
    } catch (error) {
      console.error('Failed to log email opened:', error);
    }
  }

  /**
   * Log email clicked activity
   */
  async logEmailClicked(
    emailId: string,
    clickedAt: Date,
    url: string
  ): Promise<void> {
    await this.ensureClient();

    try {
      const engagement = await this.getEmailEngagement(emailId);
      if (!engagement) {
        return;
      }

      const contactId = await this.getHubSpotContactId(engagement.leadId, engagement.leadEmail);
      if (!contactId) {
        return;
      }

      // Create timeline event for email click
      await this.createTimelineEvent(
        contactId,
        'Email Link Clicked',
        {
          email: engagement.leadEmail,
          subject: engagement.subject,
          campaignId: engagement.campaignId,
          clickedAt: clickedAt.toISOString(),
          url,
        }
      );

      await this.recordActivity('EMAIL_CLICKED', engagement, contactId);
    } catch (error) {
      console.error('Failed to log email clicked:', error);
    }
  }

  /**
   * Log email replied activity
   */
  async logEmailReplied(
    emailId: string,
    repliedAt: Date,
    replyContent?: string
  ): Promise<void> {
    await this.ensureClient();

    try {
      const engagement = await this.getEmailEngagement(emailId);
      if (!engagement) {
        return;
      }

      const contactId = await this.getHubSpotContactId(engagement.leadId, engagement.leadEmail);
      if (!contactId) {
        return;
      }

      // Create timeline event for email reply
      await this.createTimelineEvent(
        contactId,
        'Email Reply Received',
        {
          email: engagement.leadEmail,
          subject: engagement.subject,
          campaignId: engagement.campaignId,
          repliedAt: repliedAt.toISOString(),
          hasPositiveSentiment: this.analyzeReplySentiment(replyContent),
        }
      );

      // Update contact property to indicate engagement
      await this.updateContactEngagement(contactId, 'replied');

      await this.recordActivity('EMAIL_REPLIED', engagement, contactId);
    } catch (error) {
      console.error('Failed to log email replied:', error);
    }
  }

  /**
   * Log email bounced activity
   */
  async logEmailBounced(
    emailId: string,
    bouncedAt: Date,
    bounceType: 'hard' | 'soft'
  ): Promise<void> {
    await this.ensureClient();

    try {
      const engagement = await this.getEmailEngagement(emailId);
      if (!engagement) {
        return;
      }

      const contactId = await this.getHubSpotContactId(engagement.leadId, engagement.leadEmail);
      if (!contactId) {
        return;
      }

      // Create timeline event for email bounce
      await this.createTimelineEvent(
        contactId,
        'Email Bounced',
        {
          email: engagement.leadEmail,
          subject: engagement.subject,
          campaignId: engagement.campaignId,
          bouncedAt: bouncedAt.toISOString(),
          bounceType,
        }
      );

      // Update contact property to indicate bounce
      if (bounceType === 'hard') {
        await this.updateContactProperty(contactId, 'email_invalid', true);
      }

      await this.recordActivity('EMAIL_BOUNCED', engagement, contactId);
    } catch (error) {
      console.error('Failed to log email bounced:', error);
    }
  }

  /**
   * Create a custom timeline event
   */
  private async createTimelineEvent(
    contactId: string,
    eventName: string,
    properties: Record<string, any>
  ): Promise<void> {
    await this.ensureClient();

    const eventData = {
      eventTemplateId: '1234567', // This should be created in HubSpot first
      email: properties.email,
      objectId: contactId,
      tokens: properties,
      extraData: {
        source: 'ColdCopy',
        timestamp: new Date().toISOString(),
      },
    };

    try {
      await this.client.post('/integrations/v1/timeline/event', eventData);
    } catch (error) {
      // Fallback to creating a note if timeline event fails
      await this.createNote(contactId, eventName, properties);
    }
  }

  /**
   * Create a note as fallback for timeline events
   */
  private async createNote(
    contactId: string,
    title: string,
    properties: Record<string, any>
  ): Promise<void> {
    const noteContent = Object.entries(properties)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');

    const noteData = {
      engagement: {
        active: true,
        type: 'NOTE',
        timestamp: Date.now(),
      },
      associations: {
        contactIds: [contactId],
      },
      metadata: {
        body: `${title}\n\n${noteContent}`,
      },
    };

    await this.client.post('/engagements/v1/engagements', noteData);
  }

  /**
   * Update contact engagement property
   */
  private async updateContactEngagement(
    contactId: string,
    engagementType: 'opened' | 'clicked' | 'replied'
  ): Promise<void> {
    const properties: Record<string, any> = {
      coldcopy_last_engagement: new Date().toISOString(),
      coldcopy_engagement_type: engagementType,
    };

    if (engagementType === 'replied') {
      properties.coldcopy_has_replied = true;
      properties.lifecyclestage = 'lead'; // Move to lead stage
    }

    await this.updateContactProperty(contactId, properties);
  }

  /**
   * Update contact properties
   */
  private async updateContactProperty(
    contactId: string,
    propertyName: string | Record<string, any>,
    propertyValue?: any
  ): Promise<void> {
    await this.ensureClient();

    const properties = typeof propertyName === 'string' 
      ? { [propertyName]: propertyValue }
      : propertyName;

    await this.client.patch(`/crm/v3/objects/contacts/${contactId}`, {
      properties,
    });
  }

  /**
   * Get HubSpot contact ID for a lead
   */
  private async getHubSpotContactId(
    leadId: string,
    email: string
  ): Promise<string | null> {
    const supabase = createServerClient(cookies());

    // Check sync status first
    const { data: syncStatus } = await supabase
      .from('hubspot_sync_status')
      .select('hubspot_id')
      .eq('workspace_id', this.workspaceId)
      .eq('entity_type', 'contact')
      .eq('entity_id', leadId)
      .single();

    if (syncStatus?.hubspot_id) {
      return syncStatus.hubspot_id;
    }

    // Try to find by email
    const searchResponse = await this.client.post('/crm/v3/objects/contacts/search', {
      filterGroups: [{
        filters: [{
          propertyName: 'email',
          operator: 'EQ',
          value: email,
        }],
      }],
      properties: ['id'],
      limit: 1,
    });

    return searchResponse.results?.[0]?.id || null;
  }

  /**
   * Get email engagement data
   */
  private async getEmailEngagement(emailId: string): Promise<EmailEngagement | null> {
    const supabase = createServerClient(cookies());

    const { data } = await supabase
      .from('campaign_emails')
      .select(`
        id,
        campaign_id,
        lead_id,
        subject,
        content,
        sent_at,
        leads!inner(email)
      `)
      .eq('id', emailId)
      .eq('workspace_id', this.workspaceId)
      .single();

    if (!data) {
      return null;
    }

    return {
      id: data.id,
      campaignId: data.campaign_id,
      leadId: data.lead_id,
      leadEmail: data.leads.email,
      subject: data.subject,
      content: data.content,
      sentAt: new Date(data.sent_at),
    };
  }

  /**
   * Analyze reply sentiment (basic implementation)
   */
  private analyzeReplySentiment(replyContent?: string): boolean {
    if (!replyContent) {
      return false;
    }

    const positiveIndicators = [
      'interested',
      'yes',
      'sure',
      'let\'s talk',
      'schedule',
      'meeting',
      'call',
      'demo',
    ];

    const negativeIndicators = [
      'not interested',
      'unsubscribe',
      'remove',
      'stop',
      'no thanks',
    ];

    const lowerContent = replyContent.toLowerCase();
    
    const hasPositive = positiveIndicators.some(indicator => 
      lowerContent.includes(indicator)
    );
    
    const hasNegative = negativeIndicators.some(indicator => 
      lowerContent.includes(indicator)
    );

    return hasPositive && !hasNegative;
  }

  /**
   * Record activity in database
   */
  private async recordActivity(
    activityType: string,
    engagement: EmailEngagement,
    hubspotContactId: string
  ): Promise<void> {
    const supabase = createServerClient(cookies());

    await supabase
      .from('hubspot_activity_log')
      .insert({
        workspace_id: this.workspaceId,
        lead_id: engagement.leadId,
        hubspot_contact_id: hubspotContactId,
        activity_type: activityType,
        activity_data: {
          campaignId: engagement.campaignId,
          emailId: engagement.id,
          subject: engagement.subject,
        },
      });
  }
}