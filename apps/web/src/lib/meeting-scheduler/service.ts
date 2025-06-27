import { createClient } from '@/utils/supabase/server';
import { OpenAI } from 'openai';
import {
  MeetingRequest,
  MeetingSlot,
  ScheduledMeeting,
  DetectMeetingRequest,
  ProposeMeetingSlotsRequest,
  ScheduleMeetingRequest,
  MeetingSchedulerResponse,
  MeetingIntent,
  AvailabilityCheck,
} from './types';
import { addDays, addHours, format, parse, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { utcToZonedTime, zonedTimeToUtc } from 'date-fns-tz';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export class MeetingSchedulerService {
  /**
   * Detect meeting request from message content
   */
  static async detectMeetingRequest(
    request: DetectMeetingRequest
  ): Promise<MeetingSchedulerResponse> {
    const supabase = createClient();

    try {
      // Check if already processed
      const { data: existing } = await supabase
        .from('meeting_requests')
        .select('*')
        .eq('source_message_id', request.message_id)
        .single();

      if (existing) {
        return { request: existing };
      }

      // Analyze message with AI
      const analysis = await this.analyzeMeetingIntent(request);

      if (!analysis.is_meeting_request) {
        return { error: 'No meeting request detected' };
      }

      // Create meeting request record
      const { data: meetingRequest, error } = await supabase
        .from('meeting_requests')
        .insert({
          workspace_id: request.workspace_id,
          lead_id: request.lead_id,
          source_message_id: request.message_id,
          source_type: request.message_type,
          requester_email: request.sender_email,
          requester_name: request.sender_name,
          requested_by_lead: true, // Assuming lead initiated
          intent_confidence: analysis.confidence,
          detected_intent: analysis.intent as MeetingIntent,
          suggested_duration_minutes: analysis.duration || 30,
          suggested_topic: analysis.topic,
          suggested_agenda: analysis.agenda || [],
          participants: analysis.participants || [],
          timezone: analysis.timezone,
          preferred_times: analysis.preferred_times || [],
          earliest_date: analysis.earliest_date,
          latest_date: analysis.latest_date,
          urgency_level: analysis.urgency || 'medium',
          ai_analysis: analysis,
          ai_model: 'gpt-4-turbo-preview',
          tokens_used: analysis.tokens_used,
        })
        .select()
        .single();

      if (error) throw error;

      return { request: meetingRequest };
    } catch (error) {
      console.error('Meeting detection error:', error);
      return { error: 'Failed to detect meeting request' };
    }
  }

  /**
   * Analyze message for meeting intent
   */
  private static async analyzeMeetingIntent(request: DetectMeetingRequest): Promise<any> {
    const prompt = `
Analyze the following message to detect if it contains a meeting request:

Message: "${request.message_content}"
Sender: ${request.sender_name || request.sender_email}
${request.conversation_context ? `Context: ${request.conversation_context}` : ''}

Determine:
1. Is this a meeting request? (true/false)
2. Confidence level (0.0 to 1.0)
3. Meeting intent type (demo_request/intro_call/follow_up/technical_discussion/negotiation/closing_call/check_in/general_meeting)
4. Suggested meeting topic/title
5. Suggested duration in minutes (15/30/45/60)
6. Suggested agenda items (array)
7. Participants mentioned (array of {email, name, role})
8. Time preferences mentioned (array of {date, time, description})
9. Timezone if mentioned
10. Earliest and latest dates mentioned
11. Urgency level (low/medium/high/asap)

Extract any specific dates, times, or scheduling preferences mentioned.

Format as JSON.`;

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at analyzing business communication to detect meeting requests and extract scheduling preferences.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 800,
      });

      const result = JSON.parse(completion.choices[0].message.content || '{}');
      result.tokens_used = completion.usage?.total_tokens || 0;

      return result;
    } catch (error) {
      console.error('AI analysis error:', error);
      throw error;
    }
  }

  /**
   * Propose meeting time slots
   */
  static async proposeMeetingSlots(
    request: ProposeMeetingSlotsRequest
  ): Promise<MeetingSchedulerResponse> {
    const supabase = createClient();

    try {
      // Get meeting request
      const { data: meetingRequest, error: requestError } = await supabase
        .from('meeting_requests')
        .select('*')
        .eq('id', request.request_id)
        .single();

      if (requestError || !meetingRequest) {
        return { error: 'Meeting request not found' };
      }

      // Get host availability
      const hostAvailability = await this.getUserAvailability(
        request.workspace_id,
        request.host_email
      );

      // Get attendees availability (if calendar integrated)
      const attendeesAvailability = await Promise.all(
        request.attendee_emails.map(email =>
          this.getExternalAvailability(email, request.earliest_date, request.latest_date)
        )
      );

      // Generate possible slots
      const slots = await this.generateTimeSlots(
        meetingRequest,
        hostAvailability,
        attendeesAvailability,
        request
      );

      // Score and rank slots
      const scoredSlots = slots.map(slot => ({
        ...slot,
        overall_score: this.calculateSlotScore(slot, meetingRequest),
      }));

      // Sort by score and take top slots
      const topSlots = scoredSlots
        .sort((a, b) => b.overall_score - a.overall_score)
        .slice(0, request.slots_to_propose || 3);

      // Save slots to database
      const { data: savedSlots, error: slotsError } = await supabase
        .from('meeting_slots')
        .insert(
          topSlots.map(slot => ({
            ...slot,
            workspace_id: request.workspace_id,
            request_id: request.request_id,
            is_proposed: true,
            proposed_at: new Date().toISOString(),
          }))
        )
        .select();

      if (slotsError) throw slotsError;

      // Update request status
      await supabase
        .from('meeting_requests')
        .update({ status: 'slots_proposed' })
        .eq('id', request.request_id);

      return { slots: savedSlots || [] };
    } catch (error) {
      console.error('Slot proposal error:', error);
      return { error: 'Failed to propose meeting slots' };
    }
  }

  /**
   * Schedule a meeting from selected slot
   */
  static async scheduleMeeting(
    request: ScheduleMeetingRequest
  ): Promise<MeetingSchedulerResponse> {
    const supabase = createClient();

    try {
      // Get slot and request details
      const [{ data: slot }, { data: meetingRequest }] = await Promise.all([
        supabase.from('meeting_slots').select('*').eq('id', request.slot_id).single(),
        supabase.from('meeting_requests').select('*').eq('id', request.request_id).single(),
      ]);

      if (!slot || !meetingRequest) {
        return { error: 'Slot or request not found' };
      }

      // Create scheduled meeting
      const meetingTitle = request.meeting_details?.title || 
        meetingRequest.suggested_topic || 
        `Meeting with ${meetingRequest.requester_name || meetingRequest.requester_email}`;

      const { data: meeting, error: meetingError } = await supabase
        .from('scheduled_meetings')
        .insert({
          workspace_id: meetingRequest.workspace_id,
          request_id: request.request_id,
          slot_id: request.slot_id,
          title: meetingTitle,
          description: request.meeting_details?.description,
          agenda: request.meeting_details?.agenda || meetingRequest.suggested_agenda,
          start_time: slot.start_time,
          end_time: slot.end_time,
          timezone: slot.timezone,
          meeting_url: request.meeting_details?.meeting_url,
          host_email: meetingRequest.requester_email,
          host_name: meetingRequest.requester_name,
          attendees: meetingRequest.participants.map(p => ({
            email: p.email,
            name: p.name,
            status: 'pending',
          })),
          status: 'scheduled',
        })
        .select()
        .single();

      if (meetingError) throw meetingError;

      // Update slot as selected
      await supabase
        .from('meeting_slots')
        .update({
          is_selected: true,
          selected_at: new Date().toISOString(),
        })
        .eq('id', request.slot_id);

      // Update request status
      await supabase
        .from('meeting_requests')
        .update({ status: 'scheduled' })
        .eq('id', request.request_id);

      // Send calendar invites if requested
      if (request.send_invites) {
        await this.sendCalendarInvites(meeting);
      }

      return { meeting };
    } catch (error) {
      console.error('Meeting scheduling error:', error);
      return { error: 'Failed to schedule meeting' };
    }
  }

  /**
   * Get user availability from settings
   */
  private static async getUserAvailability(
    workspace_id: string,
    user_email: string
  ): Promise<any> {
    const supabase = createClient();

    // Get user's availability settings
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('email', user_email)
      .single();

    if (!user) return null;

    const { data: availability } = await supabase
      .from('meeting_availability')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    return availability || {
      timezone: 'UTC',
      weekly_hours: {
        monday: [{ start: '09:00', end: '17:00' }],
        tuesday: [{ start: '09:00', end: '17:00' }],
        wednesday: [{ start: '09:00', end: '17:00' }],
        thursday: [{ start: '09:00', end: '17:00' }],
        friday: [{ start: '09:00', end: '17:00' }],
      },
      min_notice_hours: 24,
      buffer_between_meetings_minutes: 15,
    };
  }

  /**
   * Get external calendar availability (mock for now)
   */
  private static async getExternalAvailability(
    email: string,
    start_date?: string,
    end_date?: string
  ): Promise<AvailabilityCheck> {
    // In production, this would integrate with calendar APIs
    // For now, return mock availability
    return {
      email,
      available_slots: [],
      busy_slots: [],
    };
  }

  /**
   * Generate possible time slots
   */
  private static async generateTimeSlots(
    request: MeetingRequest,
    hostAvailability: any,
    attendeesAvailability: AvailabilityCheck[],
    options: ProposeMeetingSlotsRequest
  ): Promise<Partial<MeetingSlot>[]> {
    const slots: Partial<MeetingSlot>[] = [];
    const duration = options.duration_minutes || request.suggested_duration_minutes || 30;
    const timezone = options.timezone || request.timezone || 'UTC';

    // Determine date range
    const startDate = options.earliest_date
      ? new Date(options.earliest_date)
      : addHours(new Date(), hostAvailability?.min_notice_hours || 24);
    
    const endDate = options.latest_date
      ? new Date(options.latest_date)
      : addDays(startDate, 14);

    // Generate slots for each day
    let currentDate = startDate;
    while (currentDate <= endDate) {
      const dayOfWeek = format(currentDate, 'EEEE').toLowerCase();
      const dayHours = hostAvailability?.weekly_hours?.[dayOfWeek] || [];

      for (const timeBlock of dayHours) {
        const blockStart = parse(timeBlock.start, 'HH:mm', currentDate);
        const blockEnd = parse(timeBlock.end, 'HH:mm', currentDate);
        
        let slotStart = blockStart;
        while (addHours(slotStart, duration / 60) <= blockEnd) {
          const slotEnd = addHours(slotStart, duration / 60);

          // Check if slot is available for all participants
          const isAvailable = this.checkSlotAvailability(
            slotStart,
            slotEnd,
            attendeesAvailability
          );

          if (isAvailable) {
            slots.push({
              start_time: zonedTimeToUtc(slotStart, timezone).toISOString(),
              end_time: zonedTimeToUtc(slotEnd, timezone).toISOString(),
              timezone,
              host_available: true,
              attendees_available: {},
              conflicts: [],
              preference_score: 0.5,
              convenience_score: this.calculateConvenienceScore(slotStart),
            });
          }

          // Move to next slot with buffer
          slotStart = addHours(slotStart, (duration + (hostAvailability?.buffer_between_meetings_minutes || 0)) / 60);
        }
      }

      currentDate = addDays(currentDate, 1);
    }

    return slots.slice(0, 20); // Limit to 20 slots
  }

  /**
   * Check if slot is available for all participants
   */
  private static checkSlotAvailability(
    start: Date,
    end: Date,
    attendeesAvailability: AvailabilityCheck[]
  ): boolean {
    // For now, assume all slots are available
    // In production, check against attendees' busy slots
    return true;
  }

  /**
   * Calculate convenience score for a time slot
   */
  private static calculateConvenienceScore(slotTime: Date): number {
    const hour = slotTime.getHours();
    const dayOfWeek = slotTime.getDay();

    // Business hours on weekdays get highest score
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      if (hour >= 9 && hour <= 11) return 1.0; // Morning
      if (hour >= 14 && hour <= 16) return 0.9; // Afternoon
      if (hour >= 12 && hour <= 13) return 0.7; // Lunch
      if (hour >= 8 && hour < 9) return 0.6; // Early morning
      if (hour >= 17 && hour <= 18) return 0.5; // Late afternoon
    }

    // Weekends get lower scores
    if (dayOfWeek === 0 || dayOfWeek === 6) return 0.3;

    return 0.4; // Off hours
  }

  /**
   * Calculate overall slot score
   */
  private static calculateSlotScore(
    slot: Partial<MeetingSlot>,
    request: MeetingRequest
  ): number {
    let score = 0.5;

    // Factor in convenience score
    score = (score + (slot.convenience_score || 0.5)) / 2;

    // Check if slot matches preferred times
    if (request.preferred_times.length > 0) {
      // Implementation to match against preferences
      // For now, use base score
    }

    // Urgency boost
    if (request.urgency_level === 'asap') {
      // Boost scores for earlier slots
      const daysFromNow = Math.floor(
        (new Date(slot.start_time!).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      if (daysFromNow <= 2) score += 0.2;
    }

    return Math.min(score, 1.0);
  }

  /**
   * Send calendar invites (mock for now)
   */
  private static async sendCalendarInvites(meeting: ScheduledMeeting): Promise<void> {
    // In production, this would:
    // 1. Generate iCal file
    // 2. Send via email
    // 3. Create calendar events via API
    console.log('Sending calendar invites for meeting:', meeting.id);
  }

  /**
   * Generate meeting agenda using AI
   */
  static async generateMeetingAgenda(
    topic: string,
    context?: string,
    duration?: number
  ): Promise<string[]> {
    const prompt = `
Generate a professional meeting agenda for the following:

Topic: ${topic}
Duration: ${duration || 30} minutes
${context ? `Context: ${context}` : ''}

Create 3-5 agenda items that are:
- Clear and actionable
- Appropriately timed for the duration
- Relevant to the topic

Format as a JSON array of strings.`;

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at creating effective meeting agendas.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 300,
      });

      const result = JSON.parse(completion.choices[0].message.content || '{}');
      return result.agenda || [];
    } catch (error) {
      console.error('Agenda generation error:', error);
      return ['Introduction', 'Main Discussion', 'Next Steps', 'Q&A'];
    }
  }
}