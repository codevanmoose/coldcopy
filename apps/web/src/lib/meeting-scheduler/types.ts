// AI Meeting Scheduler Types

export type MeetingIntent = 
  | 'demo_request'
  | 'intro_call'
  | 'follow_up'
  | 'technical_discussion'
  | 'negotiation'
  | 'closing_call'
  | 'check_in'
  | 'general_meeting';

export type MeetingRequestStatus = 
  | 'detected'
  | 'pending_slots'
  | 'slots_proposed'
  | 'scheduled'
  | 'rescheduled'
  | 'cancelled'
  | 'completed'
  | 'no_show';

export type MeetingStatus = 
  | 'scheduled'
  | 'confirmed'
  | 'tentative'
  | 'cancelled'
  | 'completed'
  | 'no_show'
  | 'rescheduled';

export type MeetingOutcome = 
  | 'successful'
  | 'rescheduled'
  | 'no_show_lead'
  | 'no_show_sales'
  | 'cancelled'
  | 'technical_issues';

export type UrgencyLevel = 'low' | 'medium' | 'high' | 'asap';
export type MeetingProvider = 'zoom' | 'teams' | 'meet' | 'other';
export type CalendarProvider = 'google' | 'outlook' | 'other';

export interface MeetingRequest {
  id: string;
  workspace_id: string;
  lead_id?: string;
  source_message_id: string;
  source_type: 'email' | 'linkedin' | 'twitter' | 'manual';
  conversation_thread_id?: string;
  requester_email: string;
  requester_name?: string;
  requested_by_lead: boolean;
  intent_confidence: number;
  detected_intent: MeetingIntent;
  suggested_duration_minutes: number;
  suggested_topic?: string;
  suggested_agenda: string[];
  participants: Array<{
    email: string;
    name?: string;
    role?: string;
  }>;
  timezone?: string;
  preferred_times: Array<{
    date?: string;
    time?: string;
    description?: string;
  }>;
  earliest_date?: string;
  latest_date?: string;
  urgency_level: UrgencyLevel;
  status: MeetingRequestStatus;
  ai_analysis: any;
  ai_model: string;
  tokens_used: number;
  created_at: string;
  updated_at: string;
}

export interface MeetingSlot {
  id: string;
  workspace_id: string;
  request_id: string;
  start_time: string;
  end_time: string;
  timezone: string;
  host_available: boolean;
  attendees_available: Record<string, boolean>;
  conflicts: Array<{
    title: string;
    start: string;
    end: string;
  }>;
  preference_score: number;
  convenience_score: number;
  overall_score: number;
  is_proposed: boolean;
  proposed_at?: string;
  is_selected: boolean;
  selected_at?: string;
  rejected_at?: string;
  rejection_reason?: string;
  created_at: string;
}

export interface ScheduledMeeting {
  id: string;
  workspace_id: string;
  request_id: string;
  slot_id?: string;
  title: string;
  description?: string;
  agenda: string[];
  start_time: string;
  end_time: string;
  timezone: string;
  location?: string;
  meeting_url?: string;
  meeting_provider?: MeetingProvider;
  host_email: string;
  host_name?: string;
  attendees: Array<{
    email: string;
    name?: string;
    status?: 'pending' | 'accepted' | 'declined';
    responded_at?: string;
  }>;
  calendar_event_id?: string;
  calendar_provider?: CalendarProvider;
  ical_uid?: string;
  status: MeetingStatus;
  reminder_sent_24h: boolean;
  reminder_sent_1h: boolean;
  attendance?: Record<string, boolean>;
  duration_minutes?: number;
  meeting_notes?: string;
  follow_up_required: boolean;
  outcome?: MeetingOutcome;
  created_at: string;
  updated_at: string;
}

export interface MeetingTemplate {
  id: string;
  workspace_id: string;
  name: string;
  meeting_type: MeetingIntent;
  default_duration_minutes: number;
  default_title?: string;
  default_description?: string;
  default_agenda: string[];
  buffer_before_minutes: number;
  buffer_after_minutes: number;
  preferred_hours: Record<string, { start: string; end: string }>;
  invitation_template?: string;
  reminder_template_24h?: string;
  reminder_template_1h?: string;
  follow_up_template?: string;
  cancellation_template?: string;
  auto_send_invites: boolean;
  auto_send_reminders: boolean;
  require_confirmation: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MeetingAvailability {
  id: string;
  workspace_id: string;
  user_id?: string;
  timezone: string;
  weekly_hours: Record<string, Array<{ start: string; end: string }>>;
  min_notice_hours: number;
  max_bookings_per_day: number;
  buffer_between_meetings_minutes: number;
  blocked_dates: Array<{ start: string; end: string }>;
  sync_with_calendar: boolean;
  calendar_provider?: CalendarProvider;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Request/Response types
export interface DetectMeetingRequest {
  workspace_id: string;
  message_id: string;
  message_type: 'email' | 'linkedin' | 'twitter';
  message_content: string;
  sender_email: string;
  sender_name?: string;
  conversation_context?: string;
  lead_id?: string;
}

export interface ProposeMeetingSlotsRequest {
  workspace_id: string;
  request_id: string;
  host_email: string;
  attendee_emails: string[];
  duration_minutes?: number;
  earliest_date?: string;
  latest_date?: string;
  timezone?: string;
  slots_to_propose?: number;
}

export interface ScheduleMeetingRequest {
  workspace_id: string;
  request_id: string;
  slot_id: string;
  meeting_details?: {
    title?: string;
    description?: string;
    agenda?: string[];
    meeting_url?: string;
  };
  send_invites?: boolean;
}

export interface MeetingSchedulerResponse {
  request?: MeetingRequest;
  slots?: MeetingSlot[];
  meeting?: ScheduledMeeting;
  error?: string;
}

// Calendar integration types
export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  attendees: string[];
  location?: string;
  description?: string;
  busy: boolean;
}

export interface AvailabilityCheck {
  email: string;
  available_slots: Array<{
    start: string;
    end: string;
  }>;
  busy_slots: Array<{
    start: string;
    end: string;
    title?: string;
  }>;
}