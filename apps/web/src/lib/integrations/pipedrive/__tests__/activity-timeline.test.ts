import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ActivityTimeline } from '../activity-timeline';
import { 
  mockSupabaseClient, 
  mockFetch,
  createMockActivity,
  createMockNote,
  createMockDeal,
  createMockPerson,
  createApiResponse,
  createPaginatedResponse,
  testConfig,
  useMockTimers
} from './test-utils';
import { testData } from './test.config';

describe('Pipedrive Activity Timeline', () => {
  let activityTimeline: ActivityTimeline;

  beforeEach(() => {
    vi.clearAllMocks();
    activityTimeline = new ActivityTimeline({
      config: testConfig,
      supabaseClient: mockSupabaseClient,
      workspaceId: testData.workspace.id
    });
  });

  describe('Activity Creation', () => {
    it('should create email activity from ColdCopy email', async () => {
      const emailData = {
        to: 'contact@example.com',
        subject: 'Follow-up: Our recent discussion',
        body: 'Thank you for your time...',
        sentAt: new Date(),
        campaignId: 'campaign-123',
        personId: 456
      };

      const mockActivity = createMockActivity({
        type: 'email',
        subject: emailData.subject,
        person_id: emailData.personId,
        done: true,
        marked_as_done_time: emailData.sentAt.toISOString()
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => createApiResponse(mockActivity)
      });

      const activity = await activityTimeline.createEmailActivity(emailData);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/activities'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining(emailData.subject)
        })
      );

      expect(activity).toMatchObject({
        type: 'email',
        subject: emailData.subject,
        done: true
      });
    });

    it('should create call activity', async () => {
      const callData = {
        personId: 456,
        duration: '00:15',
        outcome: 'connected',
        notes: 'Discussed pricing, follow up next week',
        callTime: new Date()
      };

      const mockActivity = createMockActivity({
        type: 'call',
        subject: `Call - ${callData.outcome}`,
        person_id: callData.personId,
        duration: callData.duration,
        done: true,
        note: callData.notes
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => createApiResponse(mockActivity)
      });

      const activity = await activityTimeline.createCallActivity(callData);

      expect(activity.type).toBe('call');
      expect(activity.duration).toBe(callData.duration);
      expect(activity.note).toBe(callData.notes);
    });

    it('should create meeting activity', async () => {
      const meetingData = {
        subject: 'Product Demo',
        personId: 456,
        dealId: 789,
        startTime: new Date('2024-01-20T14:00:00Z'),
        duration: '01:00',
        location: 'Zoom',
        participants: ['john@example.com', 'jane@example.com']
      };

      const mockActivity = createMockActivity({
        type: 'meeting',
        subject: meetingData.subject,
        person_id: meetingData.personId,
        deal_id: meetingData.dealId,
        due_date: '2024-01-20',
        due_time: '14:00',
        duration: meetingData.duration,
        participants: meetingData.participants.map(email => ({ email_address: email }))
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => createApiResponse(mockActivity)
      });

      const activity = await activityTimeline.createMeetingActivity(meetingData);

      expect(activity.type).toBe('meeting');
      expect(activity.participants).toHaveLength(2);
    });

    it('should create task activity', async () => {
      const taskData = {
        subject: 'Send proposal',
        personId: 456,
        dealId: 789,
        dueDate: '2024-01-25',
        assignedTo: 123
      };

      const mockActivity = createMockActivity({
        type: 'task',
        subject: taskData.subject,
        person_id: taskData.personId,
        deal_id: taskData.dealId,
        due_date: taskData.dueDate,
        user_id: taskData.assignedTo,
        done: false
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => createApiResponse(mockActivity)
      });

      const activity = await activityTimeline.createTaskActivity(taskData);

      expect(activity.type).toBe('task');
      expect(activity.done).toBe(false);
      expect(activity.user_id).toBe(taskData.assignedTo);
    });
  });

  describe('Activity Sync', () => {
    it('should sync email events to activities', async () => {
      const emailEvents = [
        {
          id: 'event-1',
          type: 'sent',
          email: 'contact@example.com',
          subject: 'Introduction',
          timestamp: new Date('2024-01-10T10:00:00Z'),
          pipedrive_person_id: 456
        },
        {
          id: 'event-2',
          type: 'opened',
          email: 'contact@example.com',
          timestamp: new Date('2024-01-10T14:00:00Z'),
          pipedrive_person_id: 456
        },
        {
          id: 'event-3',
          type: 'clicked',
          email: 'contact@example.com',
          timestamp: new Date('2024-01-10T14:05:00Z'),
          pipedrive_person_id: 456
        }
      ];

      // Mock Supabase query for email events
      mockSupabaseClient.select.mockResolvedValueOnce({
        data: emailEvents,
        error: null
      });

      // Mock activity creation for sent event
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => createApiResponse(createMockActivity({ id: 1001 }))
      });

      // Mock note creation for engagement events
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => createApiResponse(createMockNote({ id: 2001 }))
      });

      await activityTimeline.syncEmailEvents({
        since: new Date('2024-01-10T00:00:00Z')
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('email_events');
    });

    it('should batch sync activities', async () => {
      const activities = Array.from({ length: 150 }, (_, i) => ({
        type: 'email',
        subject: `Email ${i + 1}`,
        personId: 100 + i,
        done: true
      }));

      // Mock batch responses
      for (let i = 0; i < 3; i++) {
        const batchActivities = activities
          .slice(i * 50, Math.min((i + 1) * 50, activities.length))
          .map((a, idx) => createMockActivity({
            id: 1000 + (i * 50) + idx,
            type: a.type,
            subject: a.subject,
            person_id: a.personId
          }));

        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => createApiResponse(batchActivities)
        });
      }

      const results = await activityTimeline.bulkCreateActivities(activities);

      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(results.created).toHaveLength(150);
    });

    it('should handle duplicate activity prevention', async () => {
      const emailData = {
        messageId: 'msg-123',
        subject: 'Test Email',
        personId: 456,
        sentAt: new Date()
      };

      // First check for existing activity
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createApiResponse([
          createMockActivity({ 
            subject: emailData.subject,
            person_id: emailData.personId 
          })
        ])
      });

      const result = await activityTimeline.createEmailActivity(emailData, {
        checkDuplicates: true
      });

      expect(result).toBeNull(); // Should not create duplicate
      expect(mockFetch).toHaveBeenCalledTimes(1); // Only search, no create
    });

    it('should sync activities with correct timezone handling', async () => {
      const timers = useMockTimers();
      const activities = [
        {
          type: 'call',
          scheduledAt: '2024-01-20T15:00:00-05:00', // EST
          personId: 456
        },
        {
          type: 'meeting',
          scheduledAt: '2024-01-20T20:00:00Z', // UTC
          personId: 457
        }
      ];

      for (const activity of activities) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 201,
          json: async () => createApiResponse(createMockActivity({
            type: activity.type,
            person_id: activity.personId
          }))
        });
      }

      await activityTimeline.syncScheduledActivities(activities);

      // Verify timezone conversion
      expect(mockFetch).toHaveBeenNthCalledWith(1,
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('20:00') // EST to UTC
        })
      );

      timers.cleanup();
    });
  });

  describe('Activity Timeline Retrieval', () => {
    it('should get complete timeline for a person', async () => {
      const personId = 456;
      
      const activities = [
        createMockActivity({ 
          type: 'email', 
          person_id: personId,
          add_time: '2024-01-10T10:00:00Z'
        }),
        createMockActivity({ 
          type: 'call', 
          person_id: personId,
          add_time: '2024-01-11T14:00:00Z'
        }),
        createMockActivity({ 
          type: 'meeting', 
          person_id: personId,
          add_time: '2024-01-12T09:00:00Z'
        })
      ];

      const notes = [
        createMockNote({
          person_id: personId,
          add_time: '2024-01-10T15:00:00Z'
        }),
        createMockNote({
          person_id: personId,
          add_time: '2024-01-11T16:00:00Z'
        })
      ];

      // Mock activities
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createPaginatedResponse(activities, 0, 100, false)
      });

      // Mock notes
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createPaginatedResponse(notes, 0, 100, false)
      });

      const timeline = await activityTimeline.getPersonTimeline(personId);

      expect(timeline).toHaveLength(5);
      expect(timeline[0].timestamp).toBe('2024-01-10T10:00:00Z');
      expect(timeline[4].timestamp).toBe('2024-01-12T09:00:00Z');
    });

    it('should filter timeline by date range', async () => {
      const personId = 456;
      const startDate = new Date('2024-01-10');
      const endDate = new Date('2024-01-15');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createApiResponse([])
      });

      await activityTimeline.getPersonTimeline(personId, {
        startDate,
        endDate
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('start_date=2024-01-10'),
        expect.any(Object)
      );
    });

    it('should aggregate timeline statistics', async () => {
      const personId = 456;
      const activities = [
        createMockActivity({ type: 'email', done: true, person_id: personId }),
        createMockActivity({ type: 'email', done: true, person_id: personId }),
        createMockActivity({ type: 'call', done: true, person_id: personId }),
        createMockActivity({ type: 'meeting', done: true, person_id: personId }),
        createMockActivity({ type: 'task', done: false, person_id: personId })
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createApiResponse(activities)
      });

      const stats = await activityTimeline.getActivityStats(personId);

      expect(stats).toMatchObject({
        total: 5,
        completed: 4,
        pending: 1,
        byType: {
          email: 2,
          call: 1,
          meeting: 1,
          task: 1
        },
        completionRate: 0.8
      });
    });
  });

  describe('Activity Updates', () => {
    it('should mark activity as done', async () => {
      const activityId = 1001;
      const completionNote = 'Call completed successfully';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createApiResponse(
          createMockActivity({
            id: activityId,
            done: true,
            marked_as_done_time: new Date().toISOString()
          })
        )
      });

      const result = await activityTimeline.markActivityDone(
        activityId,
        completionNote
      );

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/activities/${activityId}`),
        expect.objectContaining({
          method: 'PUT',
          body: expect.stringContaining('"done":1')
        })
      );

      expect(result.done).toBe(true);
      expect(result.marked_as_done_time).toBeTruthy();
    });

    it('should reschedule activity', async () => {
      const activityId = 1001;
      const newDate = '2024-01-25';
      const newTime = '15:00';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createApiResponse(
          createMockActivity({
            id: activityId,
            due_date: newDate,
            due_time: newTime
          })
        )
      });

      const result = await activityTimeline.rescheduleActivity(
        activityId,
        newDate,
        newTime
      );

      expect(result.due_date).toBe(newDate);
      expect(result.due_time).toBe(newTime);
    });

    it('should bulk update activity status', async () => {
      const activityIds = [1001, 1002, 1003];

      for (const id of activityIds) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => createApiResponse(
            createMockActivity({ id, done: true })
          )
        });
      }

      const results = await activityTimeline.bulkMarkDone(activityIds);

      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(results.updated).toHaveLength(3);
    });
  });

  describe('Activity Notes', () => {
    it('should add note to activity', async () => {
      const activityId = 1001;
      const noteContent = 'Customer expressed interest in premium features';

      const mockNote = createMockNote({
        content: noteContent,
        activity_id: activityId
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => createApiResponse(mockNote)
      });

      const note = await activityTimeline.addActivityNote(
        activityId,
        noteContent
      );

      expect(note.content).toBe(noteContent);
      expect(note.activity_id).toBe(activityId);
    });

    it('should link multiple notes to activity', async () => {
      const activityId = 1001;
      const notes = [
        'Initial contact made',
        'Follow-up scheduled',
        'Budget discussed'
      ];

      for (const content of notes) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 201,
          json: async () => createApiResponse(
            createMockNote({ content, activity_id: activityId })
          )
        });
      }

      const results = await activityTimeline.addMultipleNotes(
        activityId,
        notes
      );

      expect(results).toHaveLength(3);
    });
  });

  describe('Activity Templates', () => {
    it('should create activity from template', async () => {
      const template = {
        type: 'email',
        subject: 'Follow-up: {deal_title}',
        dueInDays: 3,
        assignToOwner: true
      };

      const context = {
        dealId: 789,
        dealTitle: 'Enterprise Deal',
        ownerId: 123
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => createApiResponse(
          createMockActivity({
            type: template.type,
            subject: 'Follow-up: Enterprise Deal',
            deal_id: context.dealId,
            user_id: context.ownerId
          })
        )
      });

      const activity = await activityTimeline.createFromTemplate(
        template,
        context
      );

      expect(activity.subject).toBe('Follow-up: Enterprise Deal');
      expect(activity.user_id).toBe(context.ownerId);
    });

    it('should bulk create activities from workflow', async () => {
      const workflow = {
        name: 'New Deal Workflow',
        activities: [
          { type: 'task', subject: 'Send welcome email', dueInDays: 0 },
          { type: 'call', subject: 'Initial call', dueInDays: 2 },
          { type: 'meeting', subject: 'Product demo', dueInDays: 7 }
        ]
      };

      const dealId = 789;

      for (const activityTemplate of workflow.activities) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 201,
          json: async () => createApiResponse(
            createMockActivity({
              type: activityTemplate.type,
              subject: activityTemplate.subject,
              deal_id: dealId
            })
          )
        });
      }

      const results = await activityTimeline.createWorkflow(
        workflow,
        { dealId }
      );

      expect(results).toHaveLength(3);
      expect(results[0].subject).toBe('Send welcome email');
    });
  });

  describe('Activity Analytics', () => {
    it('should calculate activity metrics by type', async () => {
      const dateRange = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31')
      };

      const activities = [
        ...Array(50).fill(null).map(() => 
          createMockActivity({ type: 'email', done: true })
        ),
        ...Array(30).fill(null).map(() => 
          createMockActivity({ type: 'call', done: true })
        ),
        ...Array(20).fill(null).map(() => 
          createMockActivity({ type: 'meeting', done: true })
        ),
        ...Array(10).fill(null).map(() => 
          createMockActivity({ type: 'task', done: false })
        )
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createApiResponse(activities)
      });

      const metrics = await activityTimeline.getActivityMetrics(dateRange);

      expect(metrics).toMatchObject({
        totalActivities: 110,
        completedActivities: 100,
        completionRate: 0.909,
        byType: {
          email: { count: 50, completed: 50 },
          call: { count: 30, completed: 30 },
          meeting: { count: 20, completed: 20 },
          task: { count: 10, completed: 0 }
        }
      });
    });

    it('should track user activity performance', async () => {
      const userId = 123;
      const activities = [
        createMockActivity({ 
          user_id: userId, 
          done: true,
          marked_as_done_time: '2024-01-10T10:00:00Z',
          due_date: '2024-01-10'
        }),
        createMockActivity({ 
          user_id: userId, 
          done: true,
          marked_as_done_time: '2024-01-11T14:00:00Z',
          due_date: '2024-01-10'
        }),
        createMockActivity({ 
          user_id: userId, 
          done: false,
          due_date: '2024-01-09'
        })
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createApiResponse(activities)
      });

      const performance = await activityTimeline.getUserPerformance(userId);

      expect(performance).toMatchObject({
        totalAssigned: 3,
        completed: 2,
        overdue: 1,
        onTime: 1,
        late: 1,
        completionRate: 0.667,
        onTimeRate: 0.5
      });
    });
  });

  describe('Activity Reminders', () => {
    it('should get upcoming activities', async () => {
      const activities = [
        createMockActivity({
          due_date: '2024-01-20',
          due_time: '10:00',
          done: false
        }),
        createMockActivity({
          due_date: '2024-01-20',
          due_time: '14:00',
          done: false
        }),
        createMockActivity({
          due_date: '2024-01-21',
          due_time: '09:00',
          done: false
        })
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createApiResponse(activities)
      });

      const upcoming = await activityTimeline.getUpcomingActivities({
        days: 2
      });

      expect(upcoming).toHaveLength(3);
      expect(upcoming[0].due_date).toBe('2024-01-20');
    });

    it('should send activity reminders', async () => {
      const activities = [
        createMockActivity({
          id: 1001,
          subject: 'Call client',
          due_date: '2024-01-20',
          due_time: '10:00',
          user_id: 123,
          done: false
        })
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createApiResponse(activities)
      });

      // Mock notification creation
      mockSupabaseClient.from.mockReturnValue({
        ...mockSupabaseClient,
        insert: vi.fn().mockResolvedValue({ data: null, error: null })
      });

      await activityTimeline.sendActivityReminders({
        minutesBefore: 30
      });

      expect(mockSupabaseClient.insert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            user_id: 123,
            type: 'activity_reminder',
            data: expect.objectContaining({
              activity_id: 1001
            })
          })
        ])
      );
    });
  });
});