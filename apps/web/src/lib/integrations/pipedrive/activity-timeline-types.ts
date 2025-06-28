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
  
  // Note subtypes
  NOTE_GENERAL = 'note_general',
  NOTE_CALL = 'note_call',
  NOTE_MEETING = 'note_meeting',
  
  // LinkedIn subtypes
  LINKEDIN_MESSAGE = 'linkedin_message',
  LINKEDIN_CONNECTION = 'linkedin_connection',
  LINKEDIN_VIEW = 'linkedin_view',
  LINKEDIN_REACTION = 'linkedin_reaction',
  
  // SMS/WhatsApp subtypes
  SMS_SENT = 'sms_sent',
  SMS_RECEIVED = 'sms_received',
  WHATSAPP_SENT = 'whatsapp_sent',
  WHATSAPP_RECEIVED = 'whatsapp_received',
}