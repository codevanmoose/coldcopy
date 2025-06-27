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
} from './types';

interface CreateActivityData {
  subject: string;
  type: string;
  due_date?: string;
  due_time?: string;
  duration?: string;
  person_id?: number;
  org_id?: number;
  deal_id?: number;
  owner_id?: number;
  done?: boolean;
  note?: string;
  location?: string;
  public_description?: string;
  busy_flag?: boolean;
  attendees?: Array<{
    email_address: string;
    name: string;
    person_id?: number;
  }>;
  participants?: Array<{
    person_id: number;
    primary_flag?: boolean;
  }>;
}

interface UpdateActivityData {
  subject?: string;
  type?: string;
  due_date?: string;
  due_time?: string;
  duration?: string;
  person_id?: number;
  org_id?: number;
  deal_id?: number;
  owner_id?: number;
  done?: boolean;
  note?: string;
  location?: string;
  public_description?: string;
  busy_flag?: boolean;
}

interface GetActivitiesParams {
  start?: number;
  limit?: number;
  user_id?: number;
  filter_id?: number;
  type?: string;
  done?: boolean;
  due_date?: string;
  person_id?: number;
  org_id?: number;
  deal_id?: number;
}

interface ActivitySyncResult {
  success: boolean;
  activityId?: number;
  eventId?: string;
  action: 'created' | 'updated' | 'skipped';
  error?: string;
}

interface BulkActivitySyncResult {
  totalProcessed: number;
  successful: number;
  failed: number;
  results: ActivitySyncResult[];
}

interface EmailEventData {
  id: string;
  subject: string;
  recipient_email: string;
  sender_email: string;
  campaign_id?: string;
  lead_id?: string;
  sent_at: Date;
  status: 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'replied';
  open_count?: number;
  click_count?: number;
  reply_received?: boolean;
}

interface CallEventData {
  id: string;
  contact_email: string;
  contact_phone?: string;
  duration: number; // in minutes
  started_at: Date;
  ended_at: Date;
  notes?: string;
  outcome?: 'connected' | 'no_answer' | 'busy' | 'voicemail';
  lead_id?: string;
}

interface MeetingEventData {
  id: string;
  title: string;
  attendee_emails: string[];
  scheduled_at: Date;
  duration: number; // in minutes
  location?: string;
  notes?: string;
  lead_id?: string;
  deal_id?: string;
}

export class PipedriveActivitiesService {
  private client: PipedriveClient;
  private auth: PipedriveAuth;
  private workspaceId: string;

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
   * Get all activities from Pipedrive
   */
  async getActivities(params?: GetActivitiesParams): Promise<PipedriveApiResponse<PipedriveActivity[]>> {
    await this.initializeClient();

    const queryParams = new URLSearchParams();
    if (params?.start !== undefined) queryParams.append('start', params.start.toString());
    if (params?.limit !== undefined) queryParams.append('limit', params.limit.toString());
    if (params?.user_id) queryParams.append('user_id', params.user_id.toString());
    if (params?.filter_id) queryParams.append('filter_id', params.filter_id.toString());
    if (params?.type) queryParams.append('type', params.type);
    if (params?.done !== undefined) queryParams.append('done', params.done ? '1' : '0');
    if (params?.due_date) queryParams.append('due_date', params.due_date);
    if (params?.person_id) queryParams.append('person_id', params.person_id.toString());
    if (params?.org_id) queryParams.append('org_id', params.org_id.toString());
    if (params?.deal_id) queryParams.append('deal_id', params.deal_id.toString());

    const endpoint = `/activities${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return this.client.get<PipedriveActivity[]>(endpoint, { workspaceId: this.workspaceId });
  }

  /**
   * Get a specific activity by ID
   */
  async getActivity(activityId: number): Promise<PipedriveApiResponse<PipedriveActivity>> {
    await this.initializeClient();
    return this.client.get<PipedriveActivity>(`/activities/${activityId}`, { workspaceId: this.workspaceId });
  }

  /**
   * Create a new activity in Pipedrive
   */
  async createActivity(activityData: CreateActivityData): Promise<PipedriveApiResponse<PipedriveActivity>> {
    await this.initializeClient();

    // Validate required fields
    if (!activityData.subject) {
      throw new PipedriveValidationError('Activity subject is required');
    }
    if (!activityData.type) {
      throw new PipedriveValidationError('Activity type is required');
    }

    return this.client.post<PipedriveActivity>('/activities', activityData, { workspaceId: this.workspaceId });
  }

  /**
   * Update an existing activity in Pipedrive
   */
  async updateActivity(activityId: number, updates: UpdateActivityData): Promise<PipedriveApiResponse<PipedriveActivity>> {
    await this.initializeClient();
    return this.client.put<PipedriveActivity>(`/activities/${activityId}`, updates, { workspaceId: this.workspaceId });
  }

  /**
   * Delete an activity from Pipedrive
   */
  async deleteActivity(activityId: number): Promise<PipedriveApiResponse<{ id: number }>> {
    await this.initializeClient();
    return this.client.delete<{ id: number }>(`/activities/${activityId}`, { workspaceId: this.workspaceId });
  }

  /**
   * Mark activity as done
   */
  async markActivityDone(activityId: number): Promise<PipedriveApiResponse<PipedriveActivity>> {
    return this.updateActivity(activityId, { done: true });
  }

  /**
   * Sync email event to Pipedrive activity
   */
  async syncEmailActivity(emailEvent: EmailEventData): Promise<ActivitySyncResult> {
    try {
      const supabase = createServerClient(cookies());

      // Get person ID from email
      const personId = await this.getPersonIdByEmail(emailEvent.recipient_email);
      
      // Get deal ID if lead is associated
      let dealId: number | undefined;
      if (emailEvent.lead_id) {
        const { data: dealSync } = await supabase
          .from('pipedrive_sync_status')
          .select('pipedrive_id')
          .eq('workspace_id', this.workspaceId)
          .eq('entity_type', 'deal')
          .eq('entity_id', emailEvent.lead_id)
          .single();
        
        if (dealSync?.pipedrive_id) {
          dealId = dealSync.pipedrive_id;
        }
      }

      const activityData: CreateActivityData = {
        subject: `Email: ${emailEvent.subject}`,
        type: 'email',
        due_date: emailEvent.sent_at.toISOString().split('T')[0],
        due_time: emailEvent.sent_at.toTimeString().split(' ')[0],
        person_id: personId,
        deal_id: dealId,
        done: ['delivered', 'opened', 'clicked', 'replied'].includes(emailEvent.status),
        note: this.formatEmailNote(emailEvent),
      };

      const response = await this.createActivity(activityData);

      if (response.success) {
        // Log the activity sync
        await supabase
          .from('pipedrive_activity_log')
          .insert({
            workspace_id: this.workspaceId,
            lead_id: emailEvent.lead_id,
            pipedrive_person_id: personId,
            pipedrive_deal_id: dealId,
            activity_type: 'email_activity',
            activity_data: {
              event_id: emailEvent.id,
              pipedrive_activity_id: response.data.id,
              status: emailEvent.status,
              subject: emailEvent.subject,
            },
          });

        return {
          success: true,
          activityId: response.data.id,
          eventId: emailEvent.id,
          action: 'created',
        };
      }

      return {
        success: false,
        eventId: emailEvent.id,
        action: 'skipped',
        error: 'API request failed',
      };
    } catch (error) {
      console.error('Error syncing email activity:', error);
      return {
        success: false,
        eventId: emailEvent.id,
        action: 'skipped',
        error: (error as Error).message,
      };
    }
  }

  /**
   * Sync call event to Pipedrive activity
   */
  async syncCallActivity(callEvent: CallEventData): Promise<ActivitySyncResult> {
    try {
      const supabase = createServerClient(cookies());

      // Get person ID from email or phone
      const personId = await this.getPersonIdByEmail(callEvent.contact_email) || 
                      await this.getPersonIdByPhone(callEvent.contact_phone);

      // Get deal ID if lead is associated
      let dealId: number | undefined;
      if (callEvent.lead_id) {
        const { data: dealSync } = await supabase
          .from('pipedrive_sync_status')
          .select('pipedrive_id')
          .eq('workspace_id', this.workspaceId)
          .eq('entity_type', 'deal')
          .eq('entity_id', callEvent.lead_id)
          .single();
        
        if (dealSync?.pipedrive_id) {
          dealId = dealSync.pipedrive_id;
        }
      }

      const activityData: CreateActivityData = {
        subject: `Call: ${callEvent.duration}m (${callEvent.outcome})`,
        type: 'call',
        due_date: callEvent.started_at.toISOString().split('T')[0],
        due_time: callEvent.started_at.toTimeString().split(' ')[0],
        duration: `${callEvent.duration}:00`,
        person_id: personId,
        deal_id: dealId,
        done: true,
        note: this.formatCallNote(callEvent),
      };

      const response = await this.createActivity(activityData);

      if (response.success) {
        // Log the activity sync
        await supabase
          .from('pipedrive_activity_log')
          .insert({
            workspace_id: this.workspaceId,
            lead_id: callEvent.lead_id,
            pipedrive_person_id: personId,
            pipedrive_deal_id: dealId,
            activity_type: 'call_activity',
            activity_data: {
              event_id: callEvent.id,
              pipedrive_activity_id: response.data.id,
              outcome: callEvent.outcome,
              duration: callEvent.duration,
            },
          });

        return {
          success: true,
          activityId: response.data.id,
          eventId: callEvent.id,
          action: 'created',
        };
      }

      return {
        success: false,
        eventId: callEvent.id,
        action: 'skipped',
        error: 'API request failed',
      };
    } catch (error) {
      console.error('Error syncing call activity:', error);
      return {
        success: false,
        eventId: callEvent.id,
        action: 'skipped',
        error: (error as Error).message,
      };
    }
  }

  /**
   * Sync meeting event to Pipedrive activity
   */
  async syncMeetingActivity(meetingEvent: MeetingEventData): Promise<ActivitySyncResult> {
    try {
      const supabase = createServerClient(cookies());

      // Get person ID from first attendee email
      const personId = meetingEvent.attendee_emails.length > 0 
        ? await this.getPersonIdByEmail(meetingEvent.attendee_emails[0])
        : undefined;

      // Get deal ID if associated
      let dealId: number | undefined;
      if (meetingEvent.deal_id) {
        dealId = parseInt(meetingEvent.deal_id);
      } else if (meetingEvent.lead_id) {
        const { data: dealSync } = await supabase
          .from('pipedrive_sync_status')
          .select('pipedrive_id')
          .eq('workspace_id', this.workspaceId)
          .eq('entity_type', 'deal')
          .eq('entity_id', meetingEvent.lead_id)
          .single();
        
        if (dealSync?.pipedrive_id) {
          dealId = dealSync.pipedrive_id;
        }
      }

      const activityData: CreateActivityData = {
        subject: meetingEvent.title,
        type: 'meeting',
        due_date: meetingEvent.scheduled_at.toISOString().split('T')[0],
        due_time: meetingEvent.scheduled_at.toTimeString().split(' ')[0],
        duration: `${meetingEvent.duration}:00`,
        person_id: personId,
        deal_id: dealId,
        location: meetingEvent.location,
        note: this.formatMeetingNote(meetingEvent),
        attendees: meetingEvent.attendee_emails.map(email => ({
          email_address: email,
          name: email.split('@')[0], // Simple name extraction
        })),
      };

      const response = await this.createActivity(activityData);

      if (response.success) {
        // Log the activity sync
        await supabase
          .from('pipedrive_activity_log')
          .insert({
            workspace_id: this.workspaceId,
            lead_id: meetingEvent.lead_id,
            pipedrive_person_id: personId,
            pipedrive_deal_id: dealId,
            activity_type: 'meeting_activity',
            activity_data: {
              event_id: meetingEvent.id,
              pipedrive_activity_id: response.data.id,
              title: meetingEvent.title,
              attendee_count: meetingEvent.attendee_emails.length,
            },
          });

        return {
          success: true,
          activityId: response.data.id,
          eventId: meetingEvent.id,
          action: 'created',
        };
      }

      return {
        success: false,
        eventId: meetingEvent.id,
        action: 'skipped',
        error: 'API request failed',
      };
    } catch (error) {
      console.error('Error syncing meeting activity:', error);
      return {
        success: false,
        eventId: meetingEvent.id,
        action: 'skipped',
        error: (error as Error).message,
      };
    }
  }

  /**
   * Get person ID by email address
   */
  private async getPersonIdByEmail(email?: string): Promise<number | undefined> {
    if (!email) return undefined;

    try {
      const searchResult = await this.client.search({
        term: email,
        fields: 'email',
        exact: true,
      }, { workspaceId: this.workspaceId });

      if (searchResult.success && searchResult.data?.items?.length > 0) {
        return searchResult.data.items[0].item.id;
      }
    } catch (error) {
      console.error('Error finding person by email:', error);
    }

    return undefined;
  }

  /**
   * Get person ID by phone number
   */
  private async getPersonIdByPhone(phone?: string): Promise<number | undefined> {
    if (!phone) return undefined;

    try {
      const searchResult = await this.client.search({
        term: phone,
        fields: 'phone',
        exact: true,
      }, { workspaceId: this.workspaceId });

      if (searchResult.success && searchResult.data?.items?.length > 0) {
        return searchResult.data.items[0].item.id;
      }
    } catch (error) {
      console.error('Error finding person by phone:', error);
    }

    return undefined;
  }

  /**
   * Format email event note
   */
  private formatEmailNote(emailEvent: EmailEventData): string {
    let note = `Email sent to ${emailEvent.recipient_email}\n`;
    note += `Subject: ${emailEvent.subject}\n`;
    note += `Status: ${emailEvent.status}\n`;
    note += `Sent at: ${emailEvent.sent_at.toISOString()}\n`;

    if (emailEvent.open_count) {
      note += `Opens: ${emailEvent.open_count}\n`;
    }
    if (emailEvent.click_count) {
      note += `Clicks: ${emailEvent.click_count}\n`;
    }
    if (emailEvent.reply_received) {
      note += `Reply received: Yes\n`;
    }
    if (emailEvent.campaign_id) {
      note += `Campaign ID: ${emailEvent.campaign_id}\n`;
    }

    return note;
  }

  /**
   * Format call event note
   */
  private formatCallNote(callEvent: CallEventData): string {
    let note = `Call with ${callEvent.contact_email}\n`;
    if (callEvent.contact_phone) {
      note += `Phone: ${callEvent.contact_phone}\n`;
    }
    note += `Duration: ${callEvent.duration} minutes\n`;
    note += `Outcome: ${callEvent.outcome}\n`;
    note += `Started: ${callEvent.started_at.toISOString()}\n`;
    note += `Ended: ${callEvent.ended_at.toISOString()}\n`;

    if (callEvent.notes) {
      note += `\nNotes:\n${callEvent.notes}`;
    }

    return note;
  }

  /**
   * Format meeting event note
   */
  private formatMeetingNote(meetingEvent: MeetingEventData): string {
    let note = `Meeting: ${meetingEvent.title}\n`;
    note += `Scheduled: ${meetingEvent.scheduled_at.toISOString()}\n`;
    note += `Duration: ${meetingEvent.duration} minutes\n`;
    note += `Attendees: ${meetingEvent.attendee_emails.join(', ')}\n`;

    if (meetingEvent.location) {
      note += `Location: ${meetingEvent.location}\n`;
    }

    if (meetingEvent.notes) {
      note += `\nNotes:\n${meetingEvent.notes}`;
    }

    return note;
  }

  /**
   * Bulk sync activities
   */
  async bulkSyncActivities(events: (EmailEventData | CallEventData | MeetingEventData)[]): Promise<BulkActivitySyncResult> {
    const results: ActivitySyncResult[] = [];
    let successful = 0;
    let failed = 0;

    for (const event of events) {
      let result: ActivitySyncResult;

      // Determine event type and sync accordingly
      if ('subject' in event && 'recipient_email' in event) {
        result = await this.syncEmailActivity(event as EmailEventData);
      } else if ('duration' in event && 'contact_email' in event) {
        result = await this.syncCallActivity(event as CallEventData);
      } else if ('title' in event && 'attendee_emails' in event) {
        result = await this.syncMeetingActivity(event as MeetingEventData);
      } else {
        result = {
          success: false,
          eventId: (event as any).id,
          action: 'skipped',
          error: 'Unknown event type',
        };
      }

      results.push(result);

      if (result.success) {
        successful++;
      } else {
        failed++;
      }

      // Add delay to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    return {
      totalProcessed: events.length,
      successful,
      failed,
      results,
    };
  }

  /**
   * Get activity sync logs
   */
  async getActivityLogs(limit: number = 100): Promise<any[]> {
    const supabase = createServerClient(cookies());
    
    const { data, error } = await supabase
      .from('pipedrive_activity_log')
      .select('*')
      .eq('workspace_id', this.workspaceId)
      .in('activity_type', ['email_activity', 'call_activity', 'meeting_activity'])
      .order('synced_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new PipedriveSyncError('Failed to get activity logs: ' + error.message);
    }

    return data || [];
  }

  /**
   * Get activities for a specific person
   */
  async getPersonActivities(personId: number, limit: number = 50): Promise<PipedriveApiResponse<PipedriveActivity[]>> {
    return this.getActivities({
      person_id: personId,
      limit,
    });
  }

  /**
   * Get activities for a specific deal
   */
  async getDealActivities(dealId: number, limit: number = 50): Promise<PipedriveApiResponse<PipedriveActivity[]>> {
    return this.getActivities({
      deal_id: dealId,
      limit,
    });
  }

  /**
   * Create engagement event from Pipedrive activity
   */
  createEngagementEvent(activity: PipedriveActivity): PipedriveEngagementEvent {
    let eventType: PipedriveEngagementEvent['eventType'];
    
    switch (activity.type) {
      case 'email':
        eventType = 'EMAIL_SENT';
        break;
      case 'call':
        eventType = 'CALL_MADE';
        break;
      case 'meeting':
        eventType = 'MEETING_SCHEDULED';
        break;
      default:
        eventType = 'EMAIL_SENT'; // Default fallback
    }

    return {
      id: activity.id.toString(),
      eventType,
      timestamp: activity.add_time,
      properties: {
        dealId: activity.deal_id,
        personId: activity.person_id,
        orgId: activity.org_id,
        duration: activity.duration,
        done: activity.done,
        note: activity.note,
        type: activity.type,
      },
    };
  }
}