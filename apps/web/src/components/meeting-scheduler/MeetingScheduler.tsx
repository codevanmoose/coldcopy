'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Calendar as CalendarIcon,
  Clock,
  Users,
  Video,
  MapPin,
  Sparkles,
  AlertCircle,
  CheckCircle,
  Loader2,
  Mail,
  MessageSquare,
  Twitter,
  ChevronRight,
  Zap,
} from 'lucide-react';
import { format, parseISO, addMinutes } from 'date-fns';
import { useAuthStore } from '@/stores/auth';
import { toast } from 'sonner';
import {
  MeetingRequest,
  MeetingSlot,
  ScheduledMeeting,
  MeetingIntent,
} from '@/lib/meeting-scheduler/types';

interface MeetingSchedulerProps {
  messageId?: string;
  messageType?: 'email' | 'linkedin' | 'twitter';
  messageContent?: string;
  senderEmail?: string;
  senderName?: string;
  leadId?: string;
  onScheduled?: (meeting: ScheduledMeeting) => void;
}

export function MeetingScheduler({
  messageId,
  messageType,
  messageContent,
  senderEmail,
  senderName,
  leadId,
  onScheduled,
}: MeetingSchedulerProps) {
  const { workspace } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [proposingSlots, setProposingSlots] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  
  const [meetingRequest, setMeetingRequest] = useState<MeetingRequest | null>(null);
  const [proposedSlots, setProposedSlots] = useState<MeetingSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  
  const [customDetails, setCustomDetails] = useState({
    title: '',
    description: '',
    agenda: '',
    meetingUrl: '',
  });

  useEffect(() => {
    if (messageId && messageContent && workspace?.id) {
      detectMeetingRequest();
    }
  }, [messageId, workspace?.id]);

  const detectMeetingRequest = async () => {
    if (!workspace?.id || !messageId || !messageContent) return;

    setDetecting(true);
    try {
      const response = await fetch('/api/meetings/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspace.id,
          message_id: messageId,
          message_type: messageType,
          message_content: messageContent,
          sender_email: senderEmail,
          sender_name: senderName,
          lead_id: leadId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to detect meeting request');
      }

      const data = await response.json();
      if (data.request) {
        setMeetingRequest(data.request);
        toast.success('Meeting request detected!');
      } else {
        toast.info('No meeting request detected in this message');
      }
    } catch (error) {
      console.error('Detection error:', error);
      toast.error('Failed to analyze message for meeting request');
    } finally {
      setDetecting(false);
    }
  };

  const proposeMeetingSlots = async () => {
    if (!workspace?.id || !meetingRequest) return;

    setProposingSlots(true);
    try {
      const response = await fetch('/api/meetings/slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspace.id,
          request_id: meetingRequest.id,
          attendee_emails: meetingRequest.participants.map(p => p.email),
          duration_minutes: meetingRequest.suggested_duration_minutes,
          timezone: meetingRequest.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
          slots_to_propose: 5,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to propose meeting slots');
      }

      const data = await response.json();
      setProposedSlots(data.slots || []);
      toast.success(`${data.slots?.length || 0} time slots found`);
    } catch (error) {
      console.error('Slot proposal error:', error);
      toast.error('Failed to find available time slots');
    } finally {
      setProposingSlots(false);
    }
  };

  const scheduleMeeting = async () => {
    if (!workspace?.id || !meetingRequest || !selectedSlot) return;

    setScheduling(true);
    try {
      const response = await fetch('/api/meetings/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspace.id,
          request_id: meetingRequest.id,
          slot_id: selectedSlot,
          meeting_details: {
            title: customDetails.title || meetingRequest.suggested_topic,
            description: customDetails.description,
            agenda: customDetails.agenda ? customDetails.agenda.split('\n') : meetingRequest.suggested_agenda,
            meeting_url: customDetails.meetingUrl,
          },
          send_invites: true,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to schedule meeting');
      }

      const data = await response.json();
      toast.success('Meeting scheduled successfully!');
      onScheduled?.(data.meeting);
    } catch (error) {
      console.error('Scheduling error:', error);
      toast.error('Failed to schedule meeting');
    } finally {
      setScheduling(false);
    }
  };

  const getIntentIcon = (intent: MeetingIntent) => {
    const icons: Record<MeetingIntent, JSX.Element> = {
      demo_request: <Video className="h-4 w-4" />,
      intro_call: <Users className="h-4 w-4" />,
      follow_up: <MessageSquare className="h-4 w-4" />,
      technical_discussion: <Zap className="h-4 w-4" />,
      negotiation: <AlertCircle className="h-4 w-4" />,
      closing_call: <CheckCircle className="h-4 w-4" />,
      check_in: <Clock className="h-4 w-4" />,
      general_meeting: <CalendarIcon className="h-4 w-4" />,
    };
    return icons[intent] || <CalendarIcon className="h-4 w-4" />;
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'email':
        return <Mail className="h-4 w-4" />;
      case 'linkedin':
        return <MessageSquare className="h-4 w-4" />;
      case 'twitter':
        return <Twitter className="h-4 w-4" />;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            <CardTitle>AI Meeting Scheduler</CardTitle>
          </div>
          <Badge variant="secondary">
            <Sparkles className="mr-1 h-3 w-3" />
            AI Powered
          </Badge>
        </div>
        <CardDescription>
          Automatically detect and schedule meetings from conversations
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {!meetingRequest && messageContent && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Click "Detect Meeting Request" to analyze this message for scheduling intent
            </AlertDescription>
          </Alert>
        )}

        {meetingRequest && (
          <div className="space-y-4">
            {/* Meeting Request Details */}
            <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium flex items-center gap-2">
                  {getIntentIcon(meetingRequest.detected_intent)}
                  Meeting Request Detected
                </h4>
                <div className="flex items-center gap-2">
                  {getSourceIcon(meetingRequest.source_type)}
                  <Badge variant="outline">
                    {(meetingRequest.intent_confidence * 100).toFixed(0)}% confident
                  </Badge>
                </div>
              </div>

              <div className="grid gap-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Type:</span>
                  <span className="font-medium capitalize">
                    {meetingRequest.detected_intent.replace('_', ' ')}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Duration:</span>
                  <span className="font-medium">
                    {meetingRequest.suggested_duration_minutes} minutes
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Requester:</span>
                  <span className="font-medium">
                    {meetingRequest.requester_name || meetingRequest.requester_email}
                  </span>
                </div>
                {meetingRequest.suggested_topic && (
                  <div className="flex items-start justify-between">
                    <span className="text-muted-foreground">Topic:</span>
                    <span className="font-medium text-right">
                      {meetingRequest.suggested_topic}
                    </span>
                  </div>
                )}
              </div>

              {meetingRequest.suggested_agenda.length > 0 && (
                <div className="space-y-1">
                  <span className="text-sm text-muted-foreground">Suggested Agenda:</span>
                  <ul className="text-sm space-y-1">
                    {meetingRequest.suggested_agenda.map((item, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="text-muted-foreground">{index + 1}.</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Time Slots */}
            {proposedSlots.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium">Available Time Slots</h4>
                <RadioGroup value={selectedSlot || ''} onValueChange={setSelectedSlot}>
                  <div className="space-y-2">
                    {proposedSlots.map((slot) => {
                      const startTime = parseISO(slot.start_time);
                      const endTime = parseISO(slot.end_time);
                      
                      return (
                        <div
                          key={slot.id}
                          className="flex items-center space-x-3 rounded-lg border p-3 hover:bg-muted/50"
                        >
                          <RadioGroupItem value={slot.id} />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">
                                {format(startTime, 'EEEE, MMMM d')}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              <span>
                                {format(startTime, 'h:mm a')} - {format(endTime, 'h:mm a')}
                              </span>
                              <span className="text-xs">({slot.timezone})</span>
                            </div>
                          </div>
                          <Badge variant="secondary" className="text-xs">
                            Score: {(slot.overall_score * 100).toFixed(0)}%
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                </RadioGroup>
              </div>
            )}

            {/* Custom Details */}
            {selectedSlot && (
              <div className="space-y-4 border-t pt-4">
                <h4 className="font-medium">Customize Meeting Details</h4>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="title">Meeting Title</Label>
                    <Input
                      id="title"
                      value={customDetails.title}
                      onChange={(e) => setCustomDetails({ ...customDetails, title: e.target.value })}
                      placeholder={meetingRequest.suggested_topic || 'Meeting Title'}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={customDetails.description}
                      onChange={(e) => setCustomDetails({ ...customDetails, description: e.target.value })}
                      placeholder="Add any additional context or instructions..."
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="meetingUrl">Meeting Link (optional)</Label>
                    <Input
                      id="meetingUrl"
                      value={customDetails.meetingUrl}
                      onChange={(e) => setCustomDetails({ ...customDetails, meetingUrl: e.target.value })}
                      placeholder="https://zoom.us/j/..."
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          {!meetingRequest && (
            <Button
              onClick={detectMeetingRequest}
              disabled={detecting || !messageContent}
              className="flex-1"
            >
              {detecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Detect Meeting Request
                </>
              )}
            </Button>
          )}

          {meetingRequest && proposedSlots.length === 0 && (
            <Button
              onClick={proposeMeetingSlots}
              disabled={proposingSlots}
              className="flex-1"
            >
              {proposingSlots ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Finding Slots...
                </>
              ) : (
                <>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  Find Available Times
                </>
              )}
            </Button>
          )}

          {selectedSlot && (
            <Button
              onClick={scheduleMeeting}
              disabled={scheduling}
              className="flex-1"
            >
              {scheduling ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Scheduling...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Schedule Meeting
                </>
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}