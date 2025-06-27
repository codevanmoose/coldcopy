import { PipedriveDealManager } from './deal-manager';
import { PipedriveClient } from './client';
import { PipedriveAuth } from './auth';
import { createServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import {
  PipedriveDeal,
  PipedriveStage,
  PipedriveActivity,
  PipedriveSyncError,
} from './types';

interface NotificationRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  triggers: NotificationTrigger[];
  conditions: NotificationCondition[];
  recipients: NotificationRecipient[];
  channels: NotificationChannel[];
  template: NotificationTemplate;
  schedule?: NotificationSchedule;
}

interface NotificationTrigger {
  event: 'deal_created' | 'deal_updated' | 'stage_changed' | 'deal_won' | 'deal_lost' | 'deal_stalled' | 'activity_overdue' | 'health_score_changed';
  conditions?: Record<string, any>;
}

interface NotificationCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'changed';
  value: any;
}

interface NotificationRecipient {
  type: 'user' | 'role' | 'team' | 'external';
  identifier: string; // user_id, role_name, team_id, or email
  conditions?: NotificationCondition[]; // Additional conditions for this recipient
}

interface NotificationChannel {
  type: 'email' | 'slack' | 'teams' | 'webhook' | 'in_app' | 'sms';
  config: Record<string, any>;
  enabled: boolean;
}

interface NotificationTemplate {
  subject: string;
  body: string;
  variables: string[]; // Available template variables
  format: 'text' | 'html' | 'markdown';
}

interface NotificationSchedule {
  type: 'immediate' | 'digest' | 'delayed';
  delayMinutes?: number;
  digestFrequency?: 'hourly' | 'daily' | 'weekly';
  quietHours?: {
    start: string; // HH:MM format
    end: string;
    timezone: string;
  };
}

interface TeamCollaboration {
  dealId: number;
  participants: Participant[];
  activities: CollaborationActivity[];
  mentions: Mention[];
  watchlist: Watcher[];
  permissions: DealPermissions;
}

interface Participant {
  userId: number;
  role: 'owner' | 'collaborator' | 'viewer';
  joinedAt: Date;
  lastActive: Date;
  permissions: string[];
}

interface CollaborationActivity {
  id: string;
  type: 'comment' | 'update' | 'mention' | 'file_upload' | 'status_change';
  userId: number;
  userName: string;
  content: string;
  metadata: Record<string, any>;
  createdAt: Date;
}

interface Mention {
  id: string;
  fromUserId: number;
  toUserId: number;
  activityId: string;
  content: string;
  read: boolean;
  createdAt: Date;
}

interface Watcher {
  userId: number;
  addedAt: Date;
  notificationPreferences: WatcherNotificationPreferences;
}

interface WatcherNotificationPreferences {
  stageChanges: boolean;
  newComments: boolean;
  dealUpdates: boolean;
  activityReminders: boolean;
  channels: string[]; // Which channels to receive notifications
}

interface DealPermissions {
  canEdit: string[]; // User IDs or roles
  canView: string[]; // User IDs or roles
  canComment: string[]; // User IDs or roles
  canManageTeam: string[]; // User IDs or roles
}

interface NotificationDigest {
  userId: number;
  frequency: 'hourly' | 'daily' | 'weekly';
  items: DigestItem[];
  lastSentAt: Date;
  nextSendAt: Date;
}

interface DigestItem {
  type: 'deal_update' | 'stage_change' | 'activity_reminder' | 'team_mention';
  dealId: number;
  dealTitle: string;
  summary: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  createdAt: Date;
}

interface SlackIntegration {
  workspaceId: string;
  botToken: string;
  channels: SlackChannel[];
  userMappings: SlackUserMapping[];
  defaultChannel: string;
}

interface SlackChannel {
  id: string;
  name: string;
  purpose: 'deals' | 'notifications' | 'team_updates' | 'custom';
  filters: NotificationCondition[];
}

interface SlackUserMapping {
  coldcopyUserId: number;
  slackUserId: string;
  notifications: boolean;
}

export class PipedriveNotificationSystem {
  private dealManager: PipedriveDealManager;
  private client: PipedriveClient;
  private auth: PipedriveAuth;
  private workspaceId: string;

  constructor(workspaceId: string) {
    this.workspaceId = workspaceId;
    this.auth = new PipedriveAuth();
    this.dealManager = new PipedriveDealManager(workspaceId);
  }

  private async initializeClient(): Promise<void> {
    if (!this.client) {
      const accessToken = await this.auth.getValidAccessToken(this.workspaceId);
      const integration = await this.auth.getIntegration(this.workspaceId);
      this.client = new PipedriveClient(accessToken, integration?.companyDomain);
    }
  }

  /**
   * Create notification rule
   */
  async createNotificationRule(rule: Omit<NotificationRule, 'id'>): Promise<NotificationRule> {
    const supabase = createServerClient(cookies());

    const ruleId = `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const fullRule: NotificationRule = {
      id: ruleId,
      ...rule,
    };

    const { error } = await supabase
      .from('pipedrive_notification_rules')
      .insert({
        id: ruleId,
        workspace_id: this.workspaceId,
        name: rule.name,
        description: rule.description,
        enabled: rule.enabled,
        priority: rule.priority,
        triggers: rule.triggers,
        conditions: rule.conditions,
        recipients: rule.recipients,
        channels: rule.channels,
        template: rule.template,
        schedule: rule.schedule,
        created_at: new Date().toISOString(),
      });

    if (error) {
      throw new PipedriveSyncError(`Failed to create notification rule: ${error.message}`);
    }

    return fullRule;
  }

  /**
   * Process deal event and send notifications
   */
  async processDealNotificationEvent(
    dealId: number,
    eventType: string,
    eventData: Record<string, any> = {},
    userId?: number
  ): Promise<void> {
    const supabase = createServerClient(cookies());

    try {
      // Get active notification rules
      const { data: rules } = await supabase
        .from('pipedrive_notification_rules')
        .select('*')
        .eq('workspace_id', this.workspaceId)
        .eq('enabled', true);

      if (!rules || rules.length === 0) return;

      // Get deal data
      const dealResponse = await this.dealManager.getDeal(dealId);
      if (!dealResponse.success) return;

      const deal = dealResponse.data;

      // Process each rule
      for (const rule of rules) {
        // Check if rule is triggered by this event
        const isTriggered = rule.triggers.some((trigger: NotificationTrigger) => {
          return trigger.event === eventType;
        });

        if (!isTriggered) continue;

        // Check rule conditions
        if (rule.conditions && rule.conditions.length > 0) {
          const conditionsMet = this.evaluateNotificationConditions(rule.conditions, deal, eventData);
          if (!conditionsMet) continue;
        }

        // Send notifications
        await this.sendNotifications(rule, deal, eventType, eventData, userId);
      }
    } catch (error) {
      console.error('Error processing deal notification event:', error);
    }
  }

  /**
   * Send notifications based on rule
   */
  private async sendNotifications(
    rule: NotificationRule,
    deal: PipedriveDeal,
    eventType: string,
    eventData: Record<string, any>,
    triggeredByUserId?: number
  ): Promise<void> {
    const supabase = createServerClient(cookies());

    // Get recipients
    const recipients = await this.resolveRecipients(rule.recipients, deal);

    // Filter out the user who triggered the event (if specified in rule)
    const filteredRecipients = recipients.filter(r => r.userId !== triggeredByUserId);

    if (filteredRecipients.length === 0) return;

    // Prepare notification content
    const content = this.prepareNotificationContent(rule.template, deal, eventType, eventData);

    // Send via each enabled channel
    for (const channel of rule.channels) {
      if (!channel.enabled) continue;

      try {
        switch (channel.type) {
          case 'email':
            await this.sendEmailNotifications(filteredRecipients, content, rule, channel);
            break;
          
          case 'slack':
            await this.sendSlackNotifications(filteredRecipients, content, rule, channel);
            break;
          
          case 'teams':
            await this.sendTeamsNotifications(filteredRecipients, content, rule, channel);
            break;
          
          case 'in_app':
            await this.sendInAppNotifications(filteredRecipients, content, rule);
            break;
          
          case 'webhook':
            await this.sendWebhookNotifications(content, rule, channel, deal);
            break;
          
          case 'sms':
            await this.sendSMSNotifications(filteredRecipients, content, rule, channel);
            break;
        }

        // Log successful notification
        await supabase
          .from('pipedrive_notification_logs')
          .insert({
            workspace_id: this.workspaceId,
            rule_id: rule.id,
            deal_id: deal.id,
            event_type: eventType,
            channel_type: channel.type,
            recipients: filteredRecipients.map(r => r.userId),
            status: 'sent',
            sent_at: new Date().toISOString(),
          });

      } catch (error) {
        console.error(`Failed to send ${channel.type} notification:`, error);
        
        // Log failed notification
        await supabase
          .from('pipedrive_notification_logs')
          .insert({
            workspace_id: this.workspaceId,
            rule_id: rule.id,
            deal_id: deal.id,
            event_type: eventType,
            channel_type: channel.type,
            recipients: filteredRecipients.map(r => r.userId),
            status: 'failed',
            error_message: (error as Error).message,
            sent_at: new Date().toISOString(),
          });
      }
    }
  }

  /**
   * Setup team collaboration for a deal
   */
  async setupDealCollaboration(
    dealId: number,
    ownerId: number,
    collaborators: number[] = [],
    permissions?: Partial<DealPermissions>
  ): Promise<TeamCollaboration> {
    const supabase = createServerClient(cookies());

    // Create participants
    const participants: Participant[] = [
      {
        userId: ownerId,
        role: 'owner',
        joinedAt: new Date(),
        lastActive: new Date(),
        permissions: ['edit', 'view', 'comment', 'manage_team'],
      },
      ...collaborators.map(userId => ({
        userId,
        role: 'collaborator' as const,
        joinedAt: new Date(),
        lastActive: new Date(),
        permissions: ['view', 'comment'],
      })),
    ];

    // Setup default permissions
    const defaultPermissions: DealPermissions = {
      canEdit: [ownerId.toString()],
      canView: [...participants.map(p => p.userId.toString())],
      canComment: [...participants.map(p => p.userId.toString())],
      canManageTeam: [ownerId.toString()],
      ...permissions,
    };

    // Store collaboration setup
    const { error } = await supabase
      .from('pipedrive_deal_collaboration')
      .upsert({
        workspace_id: this.workspaceId,
        deal_id: dealId,
        participants,
        permissions: defaultPermissions,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    if (error) {
      throw new PipedriveSyncError(`Failed to setup deal collaboration: ${error.message}`);
    }

    return {
      dealId,
      participants,
      activities: [],
      mentions: [],
      watchlist: [],
      permissions: defaultPermissions,
    };
  }

  /**
   * Add comment to deal
   */
  async addDealComment(
    dealId: number,
    userId: number,
    content: string,
    mentions: number[] = []
  ): Promise<CollaborationActivity> {
    const supabase = createServerClient(cookies());

    // Get user info
    const { data: user } = await supabase
      .from('users')
      .select('full_name')
      .eq('id', userId)
      .single();

    const activityId = `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const activity: CollaborationActivity = {
      id: activityId,
      type: 'comment',
      userId,
      userName: user?.full_name || 'Unknown User',
      content,
      metadata: { mentions },
      createdAt: new Date(),
    };

    // Store activity
    const { error } = await supabase
      .from('pipedrive_deal_activities')
      .insert({
        id: activityId,
        workspace_id: this.workspaceId,
        deal_id: dealId,
        user_id: userId,
        activity_type: 'comment',
        content,
        metadata: { mentions },
        created_at: new Date().toISOString(),
      });

    if (error) {
      throw new PipedriveSyncError(`Failed to add comment: ${error.message}`);
    }

    // Handle mentions
    if (mentions.length > 0) {
      await this.processMentions(dealId, userId, activityId, content, mentions);
    }

    // Notify watchers
    await this.notifyWatchers(dealId, 'new_comment', {
      comment: content,
      commenterName: user?.full_name || 'Unknown User',
      commenterUserId: userId,
    });

    return activity;
  }

  /**
   * Add user to deal watchlist
   */
  async addDealWatcher(
    dealId: number,
    userId: number,
    preferences: Partial<WatcherNotificationPreferences> = {}
  ): Promise<void> {
    const supabase = createServerClient(cookies());

    const defaultPreferences: WatcherNotificationPreferences = {
      stageChanges: true,
      newComments: true,
      dealUpdates: true,
      activityReminders: false,
      channels: ['in_app', 'email'],
      ...preferences,
    };

    const { error } = await supabase
      .from('pipedrive_deal_watchers')
      .upsert({
        workspace_id: this.workspaceId,
        deal_id: dealId,
        user_id: userId,
        notification_preferences: defaultPreferences,
        added_at: new Date().toISOString(),
      });

    if (error) {
      throw new PipedriveSyncError(`Failed to add watcher: ${error.message}`);
    }
  }

  /**
   * Process mentions in comments
   */
  private async processMentions(
    dealId: number,
    fromUserId: number,
    activityId: string,
    content: string,
    mentionedUserIds: number[]
  ): Promise<void> {
    const supabase = createServerClient(cookies());

    // Create mention records
    const mentions = mentionedUserIds.map(userId => ({
      workspace_id: this.workspaceId,
      deal_id: dealId,
      from_user_id: fromUserId,
      to_user_id: userId,
      activity_id: activityId,
      content,
      read: false,
      created_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from('pipedrive_deal_mentions')
      .insert(mentions);

    if (error) {
      console.error('Failed to create mention records:', error);
      return;
    }

    // Send notifications for mentions
    for (const userId of mentionedUserIds) {
      await this.sendMentionNotification(dealId, fromUserId, userId, content);
    }
  }

  /**
   * Send mention notification
   */
  private async sendMentionNotification(
    dealId: number,
    fromUserId: number,
    toUserId: number,
    content: string
  ): Promise<void> {
    const supabase = createServerClient(cookies());

    // Get user info
    const { data: fromUser } = await supabase
      .from('users')
      .select('full_name')
      .eq('id', fromUserId)
      .single();

    // Get deal info
    const dealResponse = await this.dealManager.getDeal(dealId);
    if (!dealResponse.success) return;

    const deal = dealResponse.data;

    // Send in-app notification
    await supabase
      .from('notifications')
      .insert({
        workspace_id: this.workspaceId,
        user_id: toUserId,
        type: 'mention',
        title: 'You were mentioned in a deal comment',
        message: `${fromUser?.full_name || 'Someone'} mentioned you in "${deal.title}": ${content.substring(0, 100)}${content.length > 100 ? '...' : ''}`,
        data: {
          dealId,
          fromUserId,
          content,
        },
        read: false,
        created_at: new Date().toISOString(),
      });
  }

  /**
   * Notify watchers of deal changes
   */
  private async notifyWatchers(
    dealId: number,
    eventType: string,
    eventData: Record<string, any>
  ): Promise<void> {
    const supabase = createServerClient(cookies());

    // Get watchers
    const { data: watchers } = await supabase
      .from('pipedrive_deal_watchers')
      .select('user_id, notification_preferences')
      .eq('workspace_id', this.workspaceId)
      .eq('deal_id', dealId);

    if (!watchers || watchers.length === 0) return;

    // Filter watchers based on their preferences
    const relevantWatchers = watchers.filter(watcher => {
      const prefs = watcher.notification_preferences as WatcherNotificationPreferences;
      switch (eventType) {
        case 'stage_change':
          return prefs.stageChanges;
        case 'new_comment':
          return prefs.newComments;
        case 'deal_update':
          return prefs.dealUpdates;
        case 'activity_reminder':
          return prefs.activityReminders;
        default:
          return false;
      }
    });

    // Send notifications to relevant watchers
    for (const watcher of relevantWatchers) {
      const prefs = watcher.notification_preferences as WatcherNotificationPreferences;
      
      // Send via preferred channels
      for (const channel of prefs.channels) {
        if (channel === 'in_app') {
          await this.sendWatcherInAppNotification(watcher.user_id, dealId, eventType, eventData);
        } else if (channel === 'email') {
          await this.sendWatcherEmailNotification(watcher.user_id, dealId, eventType, eventData);
        }
      }
    }
  }

  /**
   * Send in-app notification to watcher
   */
  private async sendWatcherInAppNotification(
    userId: number,
    dealId: number,
    eventType: string,
    eventData: Record<string, any>
  ): Promise<void> {
    const supabase = createServerClient(cookies());

    const dealResponse = await this.dealManager.getDeal(dealId);
    if (!dealResponse.success) return;

    const deal = dealResponse.data;

    let title = '';
    let message = '';

    switch (eventType) {
      case 'stage_change':
        title = 'Deal stage changed';
        message = `"${deal.title}" moved to a new stage`;
        break;
      case 'new_comment':
        title = 'New comment on deal';
        message = `${eventData.commenterName} commented on "${deal.title}"`;
        break;
      case 'deal_update':
        title = 'Deal updated';
        message = `"${deal.title}" has been updated`;
        break;
    }

    await supabase
      .from('notifications')
      .insert({
        workspace_id: this.workspaceId,
        user_id: userId,
        type: 'deal_watch',
        title,
        message,
        data: {
          dealId,
          eventType,
          eventData,
        },
        read: false,
        created_at: new Date().toISOString(),
      });
  }

  /**
   * Send Slack notifications
   */
  private async sendSlackNotifications(
    recipients: any[],
    content: any,
    rule: NotificationRule,
    channel: NotificationChannel
  ): Promise<void> {
    // Implementation would depend on Slack SDK
    console.log('Sending Slack notifications:', { recipients, content, rule: rule.name });
  }

  /**
   * Send email notifications
   */
  private async sendEmailNotifications(
    recipients: any[],
    content: any,
    rule: NotificationRule,
    channel: NotificationChannel
  ): Promise<void> {
    // Implementation would integrate with your email service
    console.log('Sending email notifications:', { recipients, content, rule: rule.name });
  }

  /**
   * Send Teams notifications
   */
  private async sendTeamsNotifications(
    recipients: any[],
    content: any,
    rule: NotificationRule,
    channel: NotificationChannel
  ): Promise<void> {
    // Implementation would depend on Teams SDK
    console.log('Sending Teams notifications:', { recipients, content, rule: rule.name });
  }

  /**
   * Send in-app notifications
   */
  private async sendInAppNotifications(
    recipients: any[],
    content: any,
    rule: NotificationRule
  ): Promise<void> {
    const supabase = createServerClient(cookies());

    for (const recipient of recipients) {
      await supabase
        .from('notifications')
        .insert({
          workspace_id: this.workspaceId,
          user_id: recipient.userId,
          type: 'pipeline_notification',
          title: content.subject,
          message: content.body,
          data: {
            ruleId: rule.id,
            ruleName: rule.name,
            priority: rule.priority,
          },
          read: false,
          created_at: new Date().toISOString(),
        });
    }
  }

  /**
   * Send webhook notifications
   */
  private async sendWebhookNotifications(
    content: any,
    rule: NotificationRule,
    channel: NotificationChannel,
    deal: PipedriveDeal
  ): Promise<void> {
    const webhookUrl = channel.config.url;
    if (!webhookUrl) return;

    const payload = {
      rule: rule.name,
      deal: {
        id: deal.id,
        title: deal.title,
        value: deal.value,
        stage_id: deal.stage_id,
        status: deal.status,
      },
      content,
      timestamp: new Date().toISOString(),
    };

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(channel.config.headers || {}),
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Webhook failed with status ${response.status}`);
      }
    } catch (error) {
      console.error('Webhook notification failed:', error);
      throw error;
    }
  }

  /**
   * Send SMS notifications
   */
  private async sendSMSNotifications(
    recipients: any[],
    content: any,
    rule: NotificationRule,
    channel: NotificationChannel
  ): Promise<void> {
    // Implementation would depend on SMS service (Twilio, etc.)
    console.log('Sending SMS notifications:', { recipients, content, rule: rule.name });
  }

  /**
   * Send watcher email notification
   */
  private async sendWatcherEmailNotification(
    userId: number,
    dealId: number,
    eventType: string,
    eventData: Record<string, any>
  ): Promise<void> {
    // Implementation would integrate with your email service
    console.log('Sending watcher email notification:', { userId, dealId, eventType });
  }

  // Helper methods

  private async resolveRecipients(recipients: NotificationRecipient[], deal: PipedriveDeal): Promise<any[]> {
    const supabase = createServerClient(cookies());
    const resolvedRecipients = [];

    for (const recipient of recipients) {
      switch (recipient.type) {
        case 'user':
          resolvedRecipients.push({ userId: parseInt(recipient.identifier) });
          break;
        
        case 'role':
          // Get users with this role
          const { data: roleUsers } = await supabase
            .from('workspace_users')
            .select('user_id')
            .eq('workspace_id', this.workspaceId)
            .eq('role', recipient.identifier);
          
          if (roleUsers) {
            resolvedRecipients.push(...roleUsers.map(u => ({ userId: u.user_id })));
          }
          break;
        
        case 'team':
          // Get team members
          const { data: teamMembers } = await supabase
            .from('team_members')
            .select('user_id')
            .eq('team_id', recipient.identifier)
            .eq('workspace_id', this.workspaceId);
          
          if (teamMembers) {
            resolvedRecipients.push(...teamMembers.map(m => ({ userId: m.user_id })));
          }
          break;
        
        case 'external':
          resolvedRecipients.push({ email: recipient.identifier });
          break;
      }
    }

    return resolvedRecipients;
  }

  private evaluateNotificationConditions(
    conditions: NotificationCondition[],
    deal: PipedriveDeal,
    eventData: Record<string, any>
  ): boolean {
    return conditions.every(condition => {
      const fieldValue = this.getNotificationFieldValue(condition.field, deal, eventData);
      
      switch (condition.operator) {
        case 'equals':
          return fieldValue === condition.value;
        case 'not_equals':
          return fieldValue !== condition.value;
        case 'greater_than':
          return Number(fieldValue) > Number(condition.value);
        case 'less_than':
          return Number(fieldValue) < Number(condition.value);
        case 'contains':
          return String(fieldValue).toLowerCase().includes(String(condition.value).toLowerCase());
        case 'changed':
          return eventData.hasOwnProperty(condition.field);
        default:
          return false;
      }
    });
  }

  private getNotificationFieldValue(field: string, deal: PipedriveDeal, eventData: Record<string, any>): any {
    if (eventData.hasOwnProperty(field)) {
      return eventData[field];
    }
    return (deal as any)[field];
  }

  private prepareNotificationContent(
    template: NotificationTemplate,
    deal: PipedriveDeal,
    eventType: string,
    eventData: Record<string, any>
  ): { subject: string; body: string } {
    const variables = {
      deal_title: deal.title,
      deal_value: deal.value,
      deal_stage: deal.stage_id,
      deal_status: deal.status,
      event_type: eventType,
      ...eventData,
    };

    let subject = template.subject;
    let body = template.body;

    // Replace template variables
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      subject = subject.replace(new RegExp(placeholder, 'g'), String(value));
      body = body.replace(new RegExp(placeholder, 'g'), String(value));
    }

    return { subject, body };
  }
}