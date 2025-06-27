import { PipedriveClient } from './client';
import { PipedriveAuth } from './auth';
import { createServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import {
  PipedriveActivity,
  PipedriveApiResponse,
  PipedriveEngagementEvent,
  PipedriveSyncError,
  PipedriveValidationError,
  PipedriveRateLimitError,
} from './types';

// Enhanced activity types with detailed categorization
export enum ActivityCategory {
  EMAIL = 'email',
  CALL = 'call',
  MEETING = 'meeting',
  TASK = 'task',
  NOTE = 'note',
  LINKEDIN = 'linkedin',
  SMS = 'sms',
  WHATSAPP = 'whatsapp',
}

export enum ActivitySubType {
  // Email subtypes
  EMAIL_SENT = 'email_sent',
  EMAIL_OPENED = 'email_opened',
  EMAIL_CLICKED = 'email_clicked',
  EMAIL_REPLIED = 'email_replied',
  EMAIL_BOUNCED = 'email_bounced',
  EMAIL_UNSUBSCRIBED = 'email_unsubscribed',
  // Call subtypes
  CALL_OUTBOUND = 'call_outbound',
  CALL_INBOUND = 'call_inbound',
  CALL_MISSED = 'call_missed',
  CALL_VOICEMAIL = 'call_voicemail',
  // Meeting subtypes
  MEETING_SCHEDULED = 'meeting_scheduled',
  MEETING_COMPLETED = 'meeting_completed',
  MEETING_CANCELLED = 'meeting_cancelled',
  MEETING_NO_SHOW = 'meeting_no_show',
  // Task subtypes
  TASK_CREATED = 'task_created',
  TASK_COMPLETED = 'task_completed',
  TASK_OVERDUE = 'task_overdue',
}

interface TimelineActivity {
  id: string;
  pipedriveActivityId?: number;
  category: ActivityCategory;
  subType: ActivitySubType;
  subject: string;
  description?: string;
  timestamp: Date;
  duration?: number; // in minutes
  participants: {
    email: string;
    name?: string;
    role?: 'sender' | 'recipient' | 'attendee';
  }[];
  metadata: {
    campaignId?: string;
    leadId?: string;
    dealId?: number;
    personId?: number;
    orgId?: number;
    threadId?: string;
    messageId?: string;
    sequenceStep?: number;
    emailStats?: {
      opens: number;
      clicks: number;
      linkClicks: { url: string; count: number }[];
    };
    callStats?: {
      outcome: 'connected' | 'no_answer' | 'busy' | 'voicemail';
      recordingUrl?: string;
      transcript?: string;
    };
    meetingStats?: {
      platform?: string;
      recordingUrl?: string;
      attendanceRate?: number;
    };
    engagement: {
      score: number;
      sentiment?: 'positive' | 'neutral' | 'negative';
      intent?: 'high' | 'medium' | 'low';
    };
  };
  synced: boolean;
  syncedAt?: Date;
  error?: string;
}

interface EmailThread {
  id: string;
  subject: string;
  participants: string[];
  messageCount: number;
  firstMessageAt: Date;
  lastMessageAt: Date;
  messages: {
    id: string;
    from: string;
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject: string;
    body: string;
    timestamp: Date;
    direction: 'inbound' | 'outbound';
    inReplyTo?: string;
    references?: string[];
  }[];
  status: 'active' | 'closed' | 'archived';
  sentiment: 'positive' | 'neutral' | 'negative';
  engagementScore: number;
}

interface ActivityTemplate {
  id: string;
  name: string;
  category: ActivityCategory;
  defaultSubject: string;
  defaultDescription?: string;
  defaultDuration?: number;
  fields: {
    name: string;
    type: 'text' | 'number' | 'date' | 'select' | 'boolean';
    required: boolean;
    options?: string[];
    defaultValue?: any;
  }[];
  workspaceId: string;
  createdAt: Date;
  updatedAt: Date;
}

interface BulkSyncOptions {
  startDate?: Date;
  endDate?: Date;
  categories?: ActivityCategory[];
  leadIds?: string[];
  campaignIds?: string[];
  batchSize?: number;
  includeHistorical?: boolean;
  syncDirection?: 'to_pipedrive' | 'from_pipedrive' | 'bidirectional';
  conflictResolution?: 'skip' | 'overwrite' | 'merge';
}

interface SyncProgress {
  totalActivities: number;
  syncedActivities: number;
  failedActivities: number;
  currentBatch: number;
  totalBatches: number;
  estimatedTimeRemaining: number; // in seconds
  errors: Array<{
    activityId: string;
    error: string;
    timestamp: Date;
  }>;
}

export class ActivityTimelineService {
  private client: PipedriveClient;
  private auth: PipedriveAuth;
  private workspaceId: string;
  private syncInProgress: boolean = false;
  private syncProgress: SyncProgress | null = null;

  constructor(workspaceId: string) {
    this.workspaceId = workspaceId;
    this.auth = new PipedriveAuth();
  }

  /**
   * Initialize the client with valid access token
   */
  private async initializeClient(): Promise<void> {
    if (!this.client) {
      const accessToken = await this.auth.getValidAccessToken(this.workspaceId);
      const integration = await this.auth.getIntegration(this.workspaceId);
      this.client = new PipedriveClient(accessToken, integration?.companyDomain);
    }
  }

  /**
   * Get complete activity timeline for a lead
   */
  async getLeadTimeline(leadId: string, options?: {
    startDate?: Date;
    endDate?: Date;
    categories?: ActivityCategory[];
    includeEmailThreads?: boolean;
    limit?: number;
  }): Promise<{
    activities: TimelineActivity[];
    threads: EmailThread[];
    summary: {
      totalActivities: number;
      byCategory: Record<ActivityCategory, number>;
      engagementScore: number;
      lastActivity: Date | null;
      nextScheduledActivity: Date | null;
    };
  }> {
    const supabase = createServerClient(cookies());

    // Build query filters
    let query = supabase
      .from('activity_timeline')
      .select('*')
      .eq('workspace_id', this.workspaceId)
      .eq('lead_id', leadId)
      .order('timestamp', { ascending: false });

    if (options?.startDate) {
      query = query.gte('timestamp', options.startDate.toISOString());
    }
    if (options?.endDate) {
      query = query.lte('timestamp', options.endDate.toISOString());
    }
    if (options?.categories?.length) {
      query = query.in('category', options.categories);
    }
    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data: activities, error } = await query;
    if (error) {
      throw new PipedriveSyncError('Failed to fetch activity timeline: ' + error.message);
    }

    // Fetch email threads if requested
    let threads: EmailThread[] = [];
    if (options?.includeEmailThreads) {
      threads = await this.getEmailThreads(leadId);
    }

    // Calculate summary statistics
    const summary = this.calculateTimelineSummary(activities || []);

    return {
      activities: activities || [],
      threads,
      summary,
    };
  }

  /**
   * Sync all email history to Pipedrive
   */
  async syncEmailHistory(options: BulkSyncOptions): Promise<void> {
    if (this.syncInProgress) {
      throw new PipedriveSyncError('Sync already in progress');
    }

    this.syncInProgress = true;
    const supabase = createServerClient(cookies());

    try {
      // Get all email events to sync
      let query = supabase
        .from('email_events')
        .select(`
          *,
          campaigns(name, settings),
          leads(email, first_name, last_name, company),
          email_messages(subject, body_text, body_html, message_id, in_reply_to)
        `)
        .eq('workspace_id', this.workspaceId);

      if (options.startDate) {
        query = query.gte('created_at', options.startDate.toISOString());
      }
      if (options.endDate) {
        query = query.lte('created_at', options.endDate.toISOString());
      }
      if (options.leadIds?.length) {
        query = query.in('lead_id', options.leadIds);
      }
      if (options.campaignIds?.length) {
        query = query.in('campaign_id', options.campaignIds);
      }

      const { data: emailEvents, error } = await query;
      if (error) {
        throw new PipedriveSyncError('Failed to fetch email events: ' + error.message);
      }

      // Initialize sync progress
      this.syncProgress = {
        totalActivities: emailEvents?.length || 0,
        syncedActivities: 0,
        failedActivities: 0,
        currentBatch: 1,
        totalBatches: Math.ceil((emailEvents?.length || 0) / (options.batchSize || 50)),
        estimatedTimeRemaining: (emailEvents?.length || 0) * 0.5, // 0.5 seconds per activity estimate
        errors: [],
      };

      // Process in batches
      const batchSize = options.batchSize || 50;
      for (let i = 0; i < (emailEvents?.length || 0); i += batchSize) {
        const batch = emailEvents?.slice(i, i + batchSize) || [];
        await this.processBatch(batch, options);
        this.syncProgress.currentBatch++;
      }

    } finally {
      this.syncInProgress = false;
      this.syncProgress = null;
    }
  }

  /**
   * Process a batch of activities for sync
   */
  private async processBatch(events: any[], options: BulkSyncOptions): Promise<void> {
    await this.initializeClient();
    const supabase = createServerClient(cookies());

    for (const event of events) {
      try {
        // Convert to timeline activity
        const activity = await this.convertToTimelineActivity(event);

        // Check if already synced
        if (activity.synced && options.conflictResolution === 'skip') {
          continue;
        }

        // Get Pipedrive person ID
        const personId = await this.getOrCreatePerson(event.leads);

        // Create or update Pipedrive activity
        const pipedriveActivity = await this.createPipedriveActivity(activity, personId);

        // Update sync status
        await supabase
          .from('activity_timeline')
          .upsert({
            id: activity.id,
            workspace_id: this.workspaceId,
            lead_id: event.lead_id,
            campaign_id: event.campaign_id,
            category: activity.category,
            sub_type: activity.subType,
            subject: activity.subject,
            description: activity.description,
            timestamp: activity.timestamp,
            duration: activity.duration,
            participants: activity.participants,
            metadata: activity.metadata,
            pipedrive_activity_id: pipedriveActivity.id,
            synced: true,
            synced_at: new Date(),
          });

        this.syncProgress!.syncedActivities++;

      } catch (error) {
        console.error('Error syncing activity:', error);
        this.syncProgress!.failedActivities++;
        this.syncProgress!.errors.push({
          activityId: event.id,
          error: (error as Error).message,
          timestamp: new Date(),
        });

        if (error instanceof PipedriveRateLimitError) {
          // Wait for rate limit reset
          await new Promise(resolve => setTimeout(resolve, error.retryAfter * 1000));
        }
      }

      // Update estimated time remaining
      const processed = this.syncProgress!.syncedActivities + this.syncProgress!.failedActivities;
      const remaining = this.syncProgress!.totalActivities - processed;
      this.syncProgress!.estimatedTimeRemaining = remaining * 0.5;
    }
  }

  /**
   * Convert email event to timeline activity
   */
  private async convertToTimelineActivity(event: any): Promise<TimelineActivity> {
    const activity: TimelineActivity = {
      id: event.id,
      category: ActivityCategory.EMAIL,
      subType: this.getEmailSubType(event.event_type),
      subject: event.email_messages?.subject || `Email: ${event.event_type}`,
      description: event.email_messages?.body_text,
      timestamp: new Date(event.created_at),
      participants: [
        {
          email: event.leads?.email,
          name: `${event.leads?.first_name || ''} ${event.leads?.last_name || ''}`.trim(),
          role: 'recipient',
        },
      ],
      metadata: {
        campaignId: event.campaign_id,
        leadId: event.lead_id,
        messageId: event.email_messages?.message_id,
        engagement: {
          score: this.calculateEngagementScore(event),
        },
      },
      synced: false,
    };

    // Add email statistics if available
    if (event.metadata?.stats) {
      activity.metadata.emailStats = {
        opens: event.metadata.stats.opens || 0,
        clicks: event.metadata.stats.clicks || 0,
        linkClicks: event.metadata.stats.linkClicks || [],
      };
    }

    return activity;
  }

  /**
   * Get email threads for a lead
   */
  private async getEmailThreads(leadId: string): Promise<EmailThread[]> {
    const supabase = createServerClient(cookies());

    const { data: threads, error } = await supabase
      .from('email_threads')
      .select(`
        *,
        email_messages(*)
      `)
      .eq('workspace_id', this.workspaceId)
      .eq('lead_id', leadId)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching email threads:', error);
      return [];
    }

    return (threads || []).map(thread => ({
      id: thread.id,
      subject: thread.subject,
      participants: this.extractParticipants(thread.email_messages),
      messageCount: thread.email_messages.length,
      firstMessageAt: new Date(thread.created_at),
      lastMessageAt: new Date(thread.updated_at),
      messages: thread.email_messages.map((msg: any) => ({
        id: msg.id,
        from: msg.from_email,
        to: [msg.to_email],
        subject: msg.subject,
        body: msg.body_text || msg.body_html,
        timestamp: new Date(msg.created_at),
        direction: msg.direction,
        inReplyTo: msg.in_reply_to,
      })),
      status: thread.status,
      sentiment: this.analyzeSentiment(thread.email_messages),
      engagementScore: this.calculateThreadEngagement(thread),
    }));
  }

  /**
   * Create or update Pipedrive activity
   */
  private async createPipedriveActivity(
    activity: TimelineActivity,
    personId: number
  ): Promise<PipedriveActivity> {
    const activityData = {
      subject: activity.subject,
      type: this.mapToPipedriveType(activity.category),
      person_id: personId,
      org_id: activity.metadata.orgId,
      deal_id: activity.metadata.dealId,
      done: this.isActivityCompleted(activity),
      due_date: activity.timestamp.toISOString().split('T')[0],
      due_time: activity.timestamp.toTimeString().split(' ')[0],
      duration: activity.duration ? `${activity.duration}:00` : undefined,
      note: this.formatActivityNote(activity),
    };

    if (activity.pipedriveActivityId) {
      // Update existing activity
      const response = await this.client.put<PipedriveActivity>(
        `/activities/${activity.pipedriveActivityId}`,
        activityData,
        { workspaceId: this.workspaceId }
      );
      return response.data;
    } else {
      // Create new activity
      const response = await this.client.post<PipedriveActivity>(
        '/activities',
        activityData,
        { workspaceId: this.workspaceId }
      );
      return response.data;
    }
  }

  /**
   * Get or create Pipedrive person
   */
  private async getOrCreatePerson(lead: any): Promise<number> {
    // First, try to find existing person
    const searchResult = await this.client.search({
      term: lead.email,
      fields: 'email',
      exact: true,
    }, { workspaceId: this.workspaceId });

    if (searchResult.success && searchResult.data?.items?.length > 0) {
      return searchResult.data.items[0].item.id;
    }

    // Create new person
    const response = await this.client.post('/persons', {
      name: `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || lead.email,
      email: [lead.email],
      org_id: lead.company ? await this.getOrCreateOrganization(lead.company) : undefined,
    }, { workspaceId: this.workspaceId });

    return response.data.id;
  }

  /**
   * Get or create Pipedrive organization
   */
  private async getOrCreateOrganization(companyName: string): Promise<number | undefined> {
    if (!companyName) return undefined;

    const searchResult = await this.client.search({
      term: companyName,
      fields: 'name',
      exact: true,
    }, { workspaceId: this.workspaceId });

    if (searchResult.success && searchResult.data?.items?.length > 0) {
      return searchResult.data.items[0].item.id;
    }

    const response = await this.client.post('/organizations', {
      name: companyName,
    }, { workspaceId: this.workspaceId });

    return response.data.id;
  }

  /**
   * Real-time activity streaming
   */
  async streamActivities(options: {
    leadId?: string;
    campaignId?: string;
    categories?: ActivityCategory[];
    onActivity: (activity: TimelineActivity) => void;
    onError?: (error: Error) => void;
  }): Promise<() => void> {
    const supabase = createServerClient(cookies());

    // Build subscription filters
    let subscription = supabase
      .channel('activity-timeline')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'activity_timeline',
          filter: `workspace_id=eq.${this.workspaceId}`,
        },
        (payload) => {
          try {
            const activity = payload.new as TimelineActivity;
            
            // Apply client-side filters
            if (options.leadId && activity.metadata.leadId !== options.leadId) return;
            if (options.campaignId && activity.metadata.campaignId !== options.campaignId) return;
            if (options.categories?.length && !options.categories.includes(activity.category)) return;

            options.onActivity(activity);
          } catch (error) {
            options.onError?.(error as Error);
          }
        }
      );

    subscription.subscribe();

    // Return unsubscribe function
    return () => {
      subscription.unsubscribe();
    };
  }

  /**
   * Get activity templates
   */
  async getActivityTemplates(category?: ActivityCategory): Promise<ActivityTemplate[]> {
    const supabase = createServerClient(cookies());

    let query = supabase
      .from('activity_templates')
      .select('*')
      .eq('workspace_id', this.workspaceId);

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query;
    if (error) {
      throw new PipedriveSyncError('Failed to fetch activity templates: ' + error.message);
    }

    return data || [];
  }

  /**
   * Create activity from template
   */
  async createActivityFromTemplate(
    templateId: string,
    data: {
      leadId: string;
      personId?: number;
      dealId?: number;
      fieldValues: Record<string, any>;
    }
  ): Promise<TimelineActivity> {
    const supabase = createServerClient(cookies());

    // Get template
    const { data: template, error } = await supabase
      .from('activity_templates')
      .select('*')
      .eq('id', templateId)
      .eq('workspace_id', this.workspaceId)
      .single();

    if (error || !template) {
      throw new PipedriveValidationError('Template not found');
    }

    // Create activity
    const activity: TimelineActivity = {
      id: crypto.randomUUID(),
      category: template.category,
      subType: ActivitySubType.TASK_CREATED,
      subject: this.interpolateTemplate(template.defaultSubject, data.fieldValues),
      description: template.defaultDescription 
        ? this.interpolateTemplate(template.defaultDescription, data.fieldValues)
        : undefined,
      timestamp: new Date(),
      duration: template.defaultDuration,
      participants: [],
      metadata: {
        leadId: data.leadId,
        personId: data.personId,
        dealId: data.dealId,
        engagement: {
          score: 0,
        },
      },
      synced: false,
    };

    // Save to database
    await supabase
      .from('activity_timeline')
      .insert({
        ...activity,
        workspace_id: this.workspaceId,
      });

    // Sync to Pipedrive if person ID provided
    if (data.personId) {
      await this.createPipedriveActivity(activity, data.personId);
    }

    return activity;
  }

  /**
   * Get engagement analytics for activities
   */
  async getEngagementAnalytics(options: {
    leadId?: string;
    campaignId?: string;
    startDate: Date;
    endDate: Date;
    groupBy: 'day' | 'week' | 'month';
  }): Promise<{
    timeline: Array<{
      date: string;
      activities: number;
      engagementScore: number;
      byCategory: Record<ActivityCategory, number>;
    }>;
    summary: {
      totalActivities: number;
      averageEngagement: number;
      topCategory: ActivityCategory;
      peakDay: string;
      velocity: number; // activities per day
    };
  }> {
    const supabase = createServerClient(cookies());

    let query = supabase
      .from('activity_timeline')
      .select('*')
      .eq('workspace_id', this.workspaceId)
      .gte('timestamp', options.startDate.toISOString())
      .lte('timestamp', options.endDate.toISOString());

    if (options.leadId) {
      query = query.eq('lead_id', options.leadId);
    }
    if (options.campaignId) {
      query = query.eq('campaign_id', options.campaignId);
    }

    const { data: activities, error } = await query;
    if (error) {
      throw new PipedriveSyncError('Failed to fetch engagement analytics: ' + error.message);
    }

    // Group activities by time period
    const grouped = this.groupActivitiesByPeriod(activities || [], options.groupBy);

    // Calculate summary statistics
    const summary = this.calculateEngagementSummary(activities || [], options);

    return {
      timeline: grouped,
      summary,
    };
  }

  /**
   * Helper methods
   */
  private getEmailSubType(eventType: string): ActivitySubType {
    const mapping: Record<string, ActivitySubType> = {
      'sent': ActivitySubType.EMAIL_SENT,
      'delivered': ActivitySubType.EMAIL_SENT,
      'opened': ActivitySubType.EMAIL_OPENED,
      'clicked': ActivitySubType.EMAIL_CLICKED,
      'replied': ActivitySubType.EMAIL_REPLIED,
      'bounced': ActivitySubType.EMAIL_BOUNCED,
      'unsubscribed': ActivitySubType.EMAIL_UNSUBSCRIBED,
    };
    return mapping[eventType] || ActivitySubType.EMAIL_SENT;
  }

  private mapToPipedriveType(category: ActivityCategory): string {
    const mapping: Record<ActivityCategory, string> = {
      [ActivityCategory.EMAIL]: 'email',
      [ActivityCategory.CALL]: 'call',
      [ActivityCategory.MEETING]: 'meeting',
      [ActivityCategory.TASK]: 'task',
      [ActivityCategory.NOTE]: 'note',
      [ActivityCategory.LINKEDIN]: 'task',
      [ActivityCategory.SMS]: 'task',
      [ActivityCategory.WHATSAPP]: 'task',
    };
    return mapping[category] || 'task';
  }

  private isActivityCompleted(activity: TimelineActivity): boolean {
    const completedSubTypes = [
      ActivitySubType.EMAIL_SENT,
      ActivitySubType.EMAIL_OPENED,
      ActivitySubType.EMAIL_CLICKED,
      ActivitySubType.EMAIL_REPLIED,
      ActivitySubType.CALL_OUTBOUND,
      ActivitySubType.CALL_INBOUND,
      ActivitySubType.MEETING_COMPLETED,
      ActivitySubType.TASK_COMPLETED,
    ];
    return completedSubTypes.includes(activity.subType);
  }

  private formatActivityNote(activity: TimelineActivity): string {
    let note = `${activity.category} Activity\n`;
    note += `Type: ${activity.subType}\n`;
    note += `Time: ${activity.timestamp.toISOString()}\n`;

    if (activity.duration) {
      note += `Duration: ${activity.duration} minutes\n`;
    }

    if (activity.participants.length > 0) {
      note += `Participants: ${activity.participants.map(p => p.email).join(', ')}\n`;
    }

    if (activity.metadata.engagement) {
      note += `Engagement Score: ${activity.metadata.engagement.score}\n`;
    }

    if (activity.metadata.emailStats) {
      note += `\nEmail Statistics:\n`;
      note += `Opens: ${activity.metadata.emailStats.opens}\n`;
      note += `Clicks: ${activity.metadata.emailStats.clicks}\n`;
    }

    if (activity.description) {
      note += `\nDescription:\n${activity.description}`;
    }

    return note;
  }

  private calculateEngagementScore(event: any): number {
    let score = 0;

    // Base score by event type
    const eventScores: Record<string, number> = {
      'sent': 1,
      'delivered': 2,
      'opened': 5,
      'clicked': 10,
      'replied': 20,
    };

    score += eventScores[event.event_type] || 0;

    // Bonus for multiple opens/clicks
    if (event.metadata?.stats) {
      score += (event.metadata.stats.opens - 1) * 2;
      score += (event.metadata.stats.clicks - 1) * 5;
    }

    return Math.min(score, 100); // Cap at 100
  }

  private calculateTimelineSummary(activities: TimelineActivity[]): any {
    const byCategory = activities.reduce((acc, activity) => {
      acc[activity.category] = (acc[activity.category] || 0) + 1;
      return acc;
    }, {} as Record<ActivityCategory, number>);

    const engagementScores = activities.map(a => a.metadata.engagement?.score || 0);
    const avgEngagement = engagementScores.length > 0
      ? engagementScores.reduce((a, b) => a + b, 0) / engagementScores.length
      : 0;

    const sortedByDate = [...activities].sort((a, b) => 
      a.timestamp.getTime() - b.timestamp.getTime()
    );

    const futureActivities = activities.filter(a => a.timestamp > new Date());
    const nextScheduled = futureActivities.length > 0
      ? futureActivities.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())[0].timestamp
      : null;

    return {
      totalActivities: activities.length,
      byCategory,
      engagementScore: Math.round(avgEngagement),
      lastActivity: sortedByDate.length > 0 ? sortedByDate[sortedByDate.length - 1].timestamp : null,
      nextScheduledActivity: nextScheduled,
    };
  }

  private extractParticipants(messages: any[]): string[] {
    const participants = new Set<string>();
    messages.forEach(msg => {
      participants.add(msg.from_email);
      participants.add(msg.to_email);
    });
    return Array.from(participants);
  }

  private analyzeSentiment(messages: any[]): 'positive' | 'neutral' | 'negative' {
    // Simple sentiment analysis based on keywords
    // In production, use a proper NLP service
    const positiveKeywords = ['thank', 'great', 'excellent', 'happy', 'pleased', 'interested'];
    const negativeKeywords = ['not interested', 'unsubscribe', 'remove', 'stop', 'no thanks'];

    let positiveCount = 0;
    let negativeCount = 0;

    messages.forEach(msg => {
      const text = (msg.body_text || '').toLowerCase();
      positiveKeywords.forEach(keyword => {
        if (text.includes(keyword)) positiveCount++;
      });
      negativeKeywords.forEach(keyword => {
        if (text.includes(keyword)) negativeCount++;
      });
    });

    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  private calculateThreadEngagement(thread: any): number {
    let score = 0;

    // Base score for thread existence
    score += 10;

    // Score based on message count
    score += Math.min(thread.email_messages.length * 5, 30);

    // Score based on back-and-forth (replies)
    const directions = thread.email_messages.map((m: any) => m.direction);
    let directionChanges = 0;
    for (let i = 1; i < directions.length; i++) {
      if (directions[i] !== directions[i - 1]) directionChanges++;
    }
    score += directionChanges * 10;

    // Recency bonus
    const lastMessageAge = Date.now() - new Date(thread.updated_at).getTime();
    const daysSinceLastMessage = lastMessageAge / (1000 * 60 * 60 * 24);
    if (daysSinceLastMessage < 7) score += 20;
    else if (daysSinceLastMessage < 30) score += 10;

    return Math.min(score, 100);
  }

  private interpolateTemplate(template: string, values: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return values[key] || match;
    });
  }

  private groupActivitiesByPeriod(
    activities: TimelineActivity[],
    groupBy: 'day' | 'week' | 'month'
  ): Array<any> {
    const grouped = new Map<string, any>();

    activities.forEach(activity => {
      const date = new Date(activity.timestamp);
      let key: string;

      switch (groupBy) {
        case 'day':
          key = date.toISOString().split('T')[0];
          break;
        case 'week':
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = weekStart.toISOString().split('T')[0];
          break;
        case 'month':
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
      }

      if (!grouped.has(key)) {
        grouped.set(key, {
          date: key,
          activities: 0,
          engagementScore: 0,
          byCategory: {} as Record<ActivityCategory, number>,
        });
      }

      const group = grouped.get(key)!;
      group.activities++;
      group.engagementScore += activity.metadata.engagement?.score || 0;
      group.byCategory[activity.category] = (group.byCategory[activity.category] || 0) + 1;
    });

    // Calculate average engagement scores
    grouped.forEach(group => {
      group.engagementScore = Math.round(group.engagementScore / group.activities);
    });

    return Array.from(grouped.values()).sort((a, b) => a.date.localeCompare(b.date));
  }

  private calculateEngagementSummary(activities: TimelineActivity[], options: any): any {
    const totalActivities = activities.length;
    const totalEngagement = activities.reduce((sum, a) => sum + (a.metadata.engagement?.score || 0), 0);
    const averageEngagement = totalActivities > 0 ? totalEngagement / totalActivities : 0;

    // Find top category
    const categoryCount = activities.reduce((acc, activity) => {
      acc[activity.category] = (acc[activity.category] || 0) + 1;
      return acc;
    }, {} as Record<ActivityCategory, number>);

    const topCategory = Object.entries(categoryCount)
      .sort(([, a], [, b]) => b - a)[0]?.[0] as ActivityCategory || ActivityCategory.EMAIL;

    // Find peak day
    const dailyCount = new Map<string, number>();
    activities.forEach(activity => {
      const date = activity.timestamp.toISOString().split('T')[0];
      dailyCount.set(date, (dailyCount.get(date) || 0) + 1);
    });

    const peakDay = Array.from(dailyCount.entries())
      .sort(([, a], [, b]) => b - a)[0]?.[0] || '';

    // Calculate velocity
    const daysDiff = Math.ceil(
      (options.endDate.getTime() - options.startDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const velocity = totalActivities / daysDiff;

    return {
      totalActivities,
      averageEngagement: Math.round(averageEngagement),
      topCategory,
      peakDay,
      velocity: Math.round(velocity * 10) / 10,
    };
  }

  /**
   * Get current sync progress
   */
  getSyncProgress(): SyncProgress | null {
    return this.syncProgress;
  }

  /**
   * Cancel ongoing sync
   */
  cancelSync(): void {
    this.syncInProgress = false;
    this.syncProgress = null;
  }
}