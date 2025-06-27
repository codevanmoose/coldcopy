import { HubSpotActivities } from '../activities';
import { HubSpotClient } from '../client';
import { HubSpotAuth } from '../auth';
import {
  HubSpotEngagementEvent,
  HubSpotValidationError,
  HubSpotSyncError,
} from '../types';
import { createServerClient } from '@/lib/supabase/server';

// Mock dependencies
jest.mock('../client');
jest.mock('../auth');
jest.mock('@/lib/supabase/server');

describe('HubSpotActivities', () => {
  let hubspotActivities: HubSpotActivities;
  let mockClient: jest.Mocked<HubSpotClient>;
  let mockAuth: jest.Mocked<HubSpotAuth>;
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Supabase
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      upsert: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
    };

    (createServerClient as jest.Mock).mockReturnValue(mockSupabase);

    // Mock HubSpot client
    mockClient = {
      get: jest.fn(),
      post: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
    } as any;

    // Mock HubSpot auth
    mockAuth = {
      getIntegration: jest.fn(),
      getValidAccessToken: jest.fn(),
    } as any;

    (HubSpotClient as jest.Mock).mockImplementation(() => mockClient);
    (HubSpotAuth as jest.Mock).mockImplementation(() => mockAuth);

    hubspotActivities = new HubSpotActivities('workspace-123');
  });

  describe('Log Email Activity', () => {
    it('should log email sent activity successfully', async () => {
      // Arrange
      const emailActivity = {
        contactId: 'contact-123',
        type: 'EMAIL_SENT' as const,
        subject: 'Welcome to our service',
        body: 'Thank you for signing up...',
        timestamp: '2024-01-15T10:00:00Z',
        properties: {
          campaignId: 'campaign-456',
          emailId: 'email-789',
          leadId: 'lead-123',
        },
      };

      const mockEngagement = {
        id: 'engagement-123',
        type: 'EMAIL',
        timestamp: emailActivity.timestamp,
        metadata: {
          subject: emailActivity.subject,
          html: emailActivity.body,
          status: 'SENT',
        },
        associations: {
          contactIds: [emailActivity.contactId],
        },
      };

      mockClient.post.mockResolvedValue(mockEngagement);

      // Act
      const result = await hubspotActivities.logEmailActivity(emailActivity);

      // Assert
      expect(result).toEqual(mockEngagement);
      expect(mockClient.post).toHaveBeenCalledWith(
        '/crm/v3/objects/emails',
        expect.objectContaining({
          properties: expect.objectContaining({
            hs_email_subject: emailActivity.subject,
            hs_email_html: emailActivity.body,
            hs_email_status: 'SENT',
            hs_timestamp: emailActivity.timestamp,
          }),
          associations: [
            {
              to: { id: emailActivity.contactId },
              types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 198 }],
            },
          ],
        })
      );
    });

    it('should log email opened activity', async () => {
      // Arrange
      const emailActivity = {
        contactId: 'contact-123',
        type: 'EMAIL_OPENED' as const,
        subject: 'Newsletter #1',
        timestamp: '2024-01-15T11:00:00Z',
        properties: {
          campaignId: 'campaign-456',
          emailId: 'email-789',
          userAgent: 'Mozilla/5.0...',
          ipAddress: '192.168.1.1',
        },
      };

      const mockEngagement = {
        id: 'engagement-456',
        type: 'EMAIL',
        timestamp: emailActivity.timestamp,
        metadata: {
          subject: emailActivity.subject,
          status: 'OPENED',
        },
      };

      mockClient.post.mockResolvedValue(mockEngagement);

      // Act
      const result = await hubspotActivities.logEmailActivity(emailActivity);

      // Assert
      expect(result).toEqual(mockEngagement);
      expect(mockClient.post).toHaveBeenCalledWith(
        '/crm/v3/objects/emails',
        expect.objectContaining({
          properties: expect.objectContaining({
            hs_email_status: 'OPENED',
            coldcopy_user_agent: 'Mozilla/5.0...',
            coldcopy_ip_address: '192.168.1.1',
          }),
        })
      );
    });

    it('should log email clicked activity', async () => {
      // Arrange
      const emailActivity = {
        contactId: 'contact-123',
        type: 'EMAIL_CLICKED' as const,
        subject: 'Special Offer',
        timestamp: '2024-01-15T12:00:00Z',
        properties: {
          campaignId: 'campaign-456',
          linkUrl: 'https://example.com/offer',
          linkText: 'Get 50% Off',
        },
      };

      const mockEngagement = {
        id: 'engagement-789',
        type: 'EMAIL',
        timestamp: emailActivity.timestamp,
        metadata: {
          subject: emailActivity.subject,
          status: 'CLICKED',
        },
      };

      mockClient.post.mockResolvedValue(mockEngagement);

      // Act
      const result = await hubspotActivities.logEmailActivity(emailActivity);

      // Assert
      expect(result.metadata.status).toBe('CLICKED');
      expect(mockClient.post).toHaveBeenCalledWith(
        '/crm/v3/objects/emails',
        expect.objectContaining({
          properties: expect.objectContaining({
            hs_email_status: 'CLICKED',
            coldcopy_link_url: 'https://example.com/offer',
            coldcopy_link_text: 'Get 50% Off',
          }),
        })
      );
    });

    it('should log email replied activity', async () => {
      // Arrange
      const emailActivity = {
        contactId: 'contact-123',
        type: 'EMAIL_REPLIED' as const,
        subject: 'Re: Your inquiry',
        body: 'Thanks for reaching out...',
        timestamp: '2024-01-15T13:00:00Z',
        properties: {
          originalEmailId: 'email-789',
          replyId: 'reply-123',
        },
      };

      const mockEngagement = {
        id: 'engagement-999',
        type: 'EMAIL',
        timestamp: emailActivity.timestamp,
        metadata: {
          subject: emailActivity.subject,
          html: emailActivity.body,
          status: 'REPLIED',
        },
      };

      mockClient.post.mockResolvedValue(mockEngagement);

      // Act
      const result = await hubspotActivities.logEmailActivity(emailActivity);

      // Assert
      expect(result.metadata.status).toBe('REPLIED');
      expect(mockClient.post).toHaveBeenCalledWith(
        '/crm/v3/objects/emails',
        expect.objectContaining({
          properties: expect.objectContaining({
            hs_email_status: 'REPLIED',
            coldcopy_original_email_id: 'email-789',
            coldcopy_reply_id: 'reply-123',
          }),
        })
      );
    });

    it('should log email bounced activity', async () => {
      // Arrange
      const emailActivity = {
        contactId: 'contact-123',
        type: 'EMAIL_BOUNCED' as const,
        subject: 'Bounced Email',
        timestamp: '2024-01-15T14:00:00Z',
        properties: {
          bounceType: 'hard',
          bounceReason: 'mailbox_full',
          diagnosticCode: '550 Mailbox full',
        },
      };

      const mockEngagement = {
        id: 'engagement-555',
        type: 'EMAIL',
        timestamp: emailActivity.timestamp,
        metadata: {
          subject: emailActivity.subject,
          status: 'BOUNCED',
        },
      };

      mockClient.post.mockResolvedValue(mockEngagement);

      // Act
      const result = await hubspotActivities.logEmailActivity(emailActivity);

      // Assert
      expect(result.metadata.status).toBe('BOUNCED');
      expect(mockClient.post).toHaveBeenCalledWith(
        '/crm/v3/objects/emails',
        expect.objectContaining({
          properties: expect.objectContaining({
            hs_email_status: 'BOUNCED',
            coldcopy_bounce_type: 'hard',
            coldcopy_bounce_reason: 'mailbox_full',
            coldcopy_diagnostic_code: '550 Mailbox full',
          }),
        })
      );
    });

    it('should handle missing contact ID error', async () => {
      // Arrange
      const invalidActivity = {
        type: 'EMAIL_SENT' as const,
        subject: 'Test',
        timestamp: '2024-01-15T10:00:00Z',
        // Missing contactId
      } as any;

      // Act & Assert
      await expect(hubspotActivities.logEmailActivity(invalidActivity))
        .rejects
        .toThrow(HubSpotValidationError);
    });

    it('should handle API errors when logging activity', async () => {
      // Arrange
      const emailActivity = {
        contactId: 'invalid-contact',
        type: 'EMAIL_SENT' as const,
        subject: 'Test',
        timestamp: '2024-01-15T10:00:00Z',
      };

      mockClient.post.mockRejectedValue({
        status: 'error',
        message: 'Contact not found',
        category: 'OBJECT_NOT_FOUND',
      });

      // Act & Assert
      await expect(hubspotActivities.logEmailActivity(emailActivity))
        .rejects
        .toThrow('Contact not found');
    });
  });

  describe('Log Call Activity', () => {
    it('should log call activity successfully', async () => {
      // Arrange
      const callActivity = {
        contactId: 'contact-123',
        subject: 'Follow-up call',
        notes: 'Discussed pricing and next steps',
        duration: 1800, // 30 minutes in seconds
        timestamp: '2024-01-15T15:00:00Z',
        disposition: 'CONNECTED',
        recordingUrl: 'https://recordings.example.com/call-123',
      };

      const mockCall = {
        id: 'call-123',
        type: 'CALL',
        timestamp: callActivity.timestamp,
        metadata: {
          durationMilliseconds: callActivity.duration * 1000,
          disposition: callActivity.disposition,
          body: callActivity.notes,
        },
      };

      mockClient.post.mockResolvedValue(mockCall);

      // Act
      const result = await hubspotActivities.logCallActivity(callActivity);

      // Assert
      expect(result).toEqual(mockCall);
      expect(mockClient.post).toHaveBeenCalledWith(
        '/crm/v3/objects/calls',
        expect.objectContaining({
          properties: expect.objectContaining({
            hs_call_title: callActivity.subject,
            hs_call_body: callActivity.notes,
            hs_call_duration: callActivity.duration * 1000,
            hs_call_disposition: callActivity.disposition,
            hs_timestamp: callActivity.timestamp,
            coldcopy_recording_url: callActivity.recordingUrl,
          }),
        })
      );
    });

    it('should handle call activity without recording', async () => {
      // Arrange
      const callActivity = {
        contactId: 'contact-123',
        subject: 'Quick check-in',
        notes: 'Brief status update',
        duration: 300,
        timestamp: '2024-01-15T16:00:00Z',
        disposition: 'CONNECTED',
      };

      const mockCall = {
        id: 'call-456',
        type: 'CALL',
        timestamp: callActivity.timestamp,
      };

      mockClient.post.mockResolvedValue(mockCall);

      // Act
      const result = await hubspotActivities.logCallActivity(callActivity);

      // Assert
      expect(result).toEqual(mockCall);
      expect(mockClient.post).toHaveBeenCalledWith(
        '/crm/v3/objects/calls',
        expect.objectContaining({
          properties: expect.not.objectContaining({
            coldcopy_recording_url: expect.anything(),
          }),
        })
      );
    });

    it('should handle missed call activity', async () => {
      // Arrange
      const callActivity = {
        contactId: 'contact-123',
        subject: 'Missed call attempt',
        notes: 'No answer, will try again later',
        duration: 0,
        timestamp: '2024-01-15T17:00:00Z',
        disposition: 'NO_ANSWER',
      };

      const mockCall = {
        id: 'call-789',
        type: 'CALL',
        timestamp: callActivity.timestamp,
        metadata: {
          disposition: 'NO_ANSWER',
          durationMilliseconds: 0,
        },
      };

      mockClient.post.mockResolvedValue(mockCall);

      // Act
      const result = await hubspotActivities.logCallActivity(callActivity);

      // Assert
      expect(result.metadata.disposition).toBe('NO_ANSWER');
      expect(result.metadata.durationMilliseconds).toBe(0);
    });
  });

  describe('Log Meeting Activity', () => {
    it('should log meeting activity successfully', async () => {
      // Arrange
      const meetingActivity = {
        contactId: 'contact-123',
        subject: 'Product Demo',
        notes: 'Showed key features, answered questions',
        startTime: '2024-01-16T10:00:00Z',
        endTime: '2024-01-16T11:00:00Z',
        meetingType: 'DEMO',
        meetingUrl: 'https://zoom.us/j/123456789',
        attendees: ['contact-123', 'user-456'],
      };

      const mockMeeting = {
        id: 'meeting-123',
        type: 'MEETING',
        timestamp: meetingActivity.startTime,
        metadata: {
          startTime: meetingActivity.startTime,
          endTime: meetingActivity.endTime,
          title: meetingActivity.subject,
          body: meetingActivity.notes,
        },
      };

      mockClient.post.mockResolvedValue(mockMeeting);

      // Act
      const result = await hubspotActivities.logMeetingActivity(meetingActivity);

      // Assert
      expect(result).toEqual(mockMeeting);
      expect(mockClient.post).toHaveBeenCalledWith(
        '/crm/v3/objects/meetings',
        expect.objectContaining({
          properties: expect.objectContaining({
            hs_meeting_title: meetingActivity.subject,
            hs_meeting_body: meetingActivity.notes,
            hs_meeting_start_time: meetingActivity.startTime,
            hs_meeting_end_time: meetingActivity.endTime,
            coldcopy_meeting_type: meetingActivity.meetingType,
            coldcopy_meeting_url: meetingActivity.meetingUrl,
          }),
        })
      );
    });

    it('should associate meeting with multiple contacts', async () => {
      // Arrange
      const meetingActivity = {
        contactId: 'contact-123',
        subject: 'Team Meeting',
        startTime: '2024-01-16T14:00:00Z',
        endTime: '2024-01-16T15:00:00Z',
        attendees: ['contact-123', 'contact-456', 'contact-789'],
      };

      const mockMeeting = {
        id: 'meeting-456',
        type: 'MEETING',
        associations: {
          contactIds: meetingActivity.attendees,
        },
      };

      mockClient.post.mockResolvedValue(mockMeeting);

      // Act
      const result = await hubspotActivities.logMeetingActivity(meetingActivity);

      // Assert
      expect(mockClient.post).toHaveBeenCalledWith(
        '/crm/v3/objects/meetings',
        expect.objectContaining({
          associations: expect.arrayContaining([
            expect.objectContaining({
              to: { id: 'contact-123' },
            }),
            expect.objectContaining({
              to: { id: 'contact-456' },
            }),
            expect.objectContaining({
              to: { id: 'contact-789' },
            }),
          ]),
        })
      );
    });
  });

  describe('Log Custom Activity', () => {
    it('should log custom activity successfully', async () => {
      // Arrange
      const customActivity = {
        contactId: 'contact-123',
        activityType: 'FORM_SUBMISSION',
        subject: 'Contact Form Submitted',
        details: {
          formName: 'Contact Us',
          formUrl: 'https://example.com/contact',
          submissionData: {
            message: 'Interested in your services',
            budget: '$10,000+',
          },
        },
        timestamp: '2024-01-16T09:00:00Z',
      };

      const mockActivity = {
        id: 'activity-123',
        type: 'NOTE',
        timestamp: customActivity.timestamp,
        metadata: {
          body: JSON.stringify(customActivity.details),
        },
      };

      mockClient.post.mockResolvedValue(mockActivity);

      // Act
      const result = await hubspotActivities.logCustomActivity(customActivity);

      // Assert
      expect(result).toEqual(mockActivity);
      expect(mockClient.post).toHaveBeenCalledWith(
        '/crm/v3/objects/notes',
        expect.objectContaining({
          properties: expect.objectContaining({
            hs_note_body: expect.stringContaining('FORM_SUBMISSION'),
            coldcopy_activity_type: 'FORM_SUBMISSION',
            coldcopy_activity_details: JSON.stringify(customActivity.details),
          }),
        })
      );
    });

    it('should handle website visit activity', async () => {
      // Arrange
      const websiteActivity = {
        contactId: 'contact-123',
        activityType: 'WEBSITE_VISIT',
        subject: 'Visited pricing page',
        details: {
          url: 'https://example.com/pricing',
          referrer: 'https://google.com',
          userAgent: 'Mozilla/5.0...',
          duration: 120,
          pageViews: 5,
        },
        timestamp: '2024-01-16T12:30:00Z',
      };

      const mockActivity = {
        id: 'activity-456',
        type: 'NOTE',
        timestamp: websiteActivity.timestamp,
      };

      mockClient.post.mockResolvedValue(mockActivity);

      // Act
      const result = await hubspotActivities.logCustomActivity(websiteActivity);

      // Assert
      expect(result).toEqual(mockActivity);
      expect(mockClient.post).toHaveBeenCalledWith(
        '/crm/v3/objects/notes',
        expect.objectContaining({
          properties: expect.objectContaining({
            coldcopy_activity_type: 'WEBSITE_VISIT',
            coldcopy_page_url: 'https://example.com/pricing',
            coldcopy_referrer: 'https://google.com',
            coldcopy_session_duration: 120,
            coldcopy_page_views: 5,
          }),
        })
      );
    });
  });

  describe('Batch Activity Logging', () => {
    it('should log multiple activities in batch', async () => {
      // Arrange
      const activities = [
        {
          contactId: 'contact-123',
          type: 'EMAIL_SENT' as const,
          subject: 'Email 1',
          timestamp: '2024-01-16T10:00:00Z',
        },
        {
          contactId: 'contact-456',
          type: 'EMAIL_SENT' as const,
          subject: 'Email 2',
          timestamp: '2024-01-16T10:01:00Z',
        },
        {
          contactId: 'contact-789',
          type: 'EMAIL_OPENED' as const,
          subject: 'Email 3',
          timestamp: '2024-01-16T10:02:00Z',
        },
      ];

      const mockBatchResponse = {
        results: [
          { id: 'engagement-1', status: 'COMPLETE' },
          { id: 'engagement-2', status: 'COMPLETE' },
          { id: 'engagement-3', status: 'COMPLETE' },
        ],
      };

      mockClient.post.mockResolvedValue(mockBatchResponse);

      // Act
      const results = await hubspotActivities.batchLogEmailActivities(activities);

      // Assert
      expect(results).toEqual(mockBatchResponse);
      expect(mockClient.post).toHaveBeenCalledWith(
        '/crm/v3/objects/emails/batch/create',
        expect.objectContaining({
          inputs: expect.arrayContaining([
            expect.objectContaining({
              properties: expect.objectContaining({
                hs_email_subject: 'Email 1',
                hs_email_status: 'SENT',
              }),
            }),
          ]),
        })
      );
    });

    it('should handle batch size limits', async () => {
      // Arrange
      const largeActivityList = Array(150).fill(null).map((_, i) => ({
        contactId: `contact-${i}`,
        type: 'EMAIL_SENT' as const,
        subject: `Email ${i}`,
        timestamp: '2024-01-16T10:00:00Z',
      }));

      mockClient.post.mockResolvedValue({
        results: Array(100).fill({ status: 'COMPLETE' }),
      });

      // Act
      await hubspotActivities.batchLogEmailActivities(largeActivityList);

      // Assert
      expect(mockClient.post).toHaveBeenCalledTimes(2); // 100 + 50
    });

    it('should handle partial batch failures', async () => {
      // Arrange
      const activities = [
        {
          contactId: 'contact-123',
          type: 'EMAIL_SENT' as const,
          subject: 'Valid Email',
          timestamp: '2024-01-16T10:00:00Z',
        },
        {
          contactId: 'invalid-contact',
          type: 'EMAIL_SENT' as const,
          subject: 'Invalid Email',
          timestamp: '2024-01-16T10:01:00Z',
        },
      ];

      const mockBatchResponse = {
        results: [
          { id: 'engagement-1', status: 'COMPLETE' },
          {
            id: '',
            status: 'ERROR',
            error: {
              status: 'error',
              message: 'Contact not found',
              correlationId: 'correlation-123',
            },
          },
        ],
      };

      mockClient.post.mockResolvedValue(mockBatchResponse);

      // Act
      const results = await hubspotActivities.batchLogEmailActivities(activities);

      // Assert
      expect(results.results[0].status).toBe('COMPLETE');
      expect(results.results[1].status).toBe('ERROR');
      expect(results.results[1].error?.message).toBe('Contact not found');
    });
  });

  describe('Activity Retrieval', () => {
    it('should get activities for contact', async () => {
      // Arrange
      const contactId = 'contact-123';
      const mockActivities = [
        {
          id: 'email-1',
          type: 'EMAIL',
          timestamp: '2024-01-16T10:00:00Z',
          metadata: {
            subject: 'Welcome Email',
            status: 'SENT',
          },
        },
        {
          id: 'call-1',
          type: 'CALL',
          timestamp: '2024-01-16T11:00:00Z',
          metadata: {
            disposition: 'CONNECTED',
            durationMilliseconds: 1800000,
          },
        },
      ];

      mockClient.get.mockResolvedValue({
        results: mockActivities,
        total: 2,
      });

      // Act
      const activities = await hubspotActivities.getContactActivities(contactId);

      // Assert
      expect(activities.results).toEqual(mockActivities);
      expect(mockClient.get).toHaveBeenCalledWith(
        `/crm/v4/objects/contacts/${contactId}/associations/emails,calls,meetings,notes`,
        expect.any(Object)
      );
    });

    it('should filter activities by type', async () => {
      // Arrange
      const contactId = 'contact-123';
      const activityTypes = ['EMAIL', 'CALL'];

      // Act
      await hubspotActivities.getContactActivities(contactId, { types: activityTypes });

      // Assert
      expect(mockClient.get).toHaveBeenCalledWith(
        expect.stringContaining('emails,calls'),
        expect.any(Object)
      );
    });

    it('should filter activities by date range', async () => {
      // Arrange
      const contactId = 'contact-123';
      const dateRange = {
        startDate: '2024-01-01T00:00:00Z',
        endDate: '2024-01-31T23:59:59Z',
      };

      // Act
      await hubspotActivities.getContactActivities(contactId, { dateRange });

      // Assert
      expect(mockClient.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          since: dateRange.startDate,
          until: dateRange.endDate,
        })
      );
    });
  });

  describe('Activity Sync Status', () => {
    it('should track activity sync status', async () => {
      // Arrange
      const emailActivity = {
        contactId: 'contact-123',
        type: 'EMAIL_SENT' as const,
        subject: 'Test Email',
        timestamp: '2024-01-16T10:00:00Z',
        properties: {
          campaignId: 'campaign-456',
          emailId: 'email-789',
        },
      };

      const mockEngagement = {
        id: 'engagement-123',
        type: 'EMAIL',
        timestamp: emailActivity.timestamp,
      };

      mockClient.post.mockResolvedValue(mockEngagement);

      // Mock sync status creation
      mockSupabase.single.mockResolvedValue({
        data: {
          id: 'sync-123',
          entity_type: 'activity',
          entity_id: 'email-789',
          hubspot_id: 'engagement-123',
          status: 'synced',
        },
        error: null,
      });

      // Act
      await hubspotActivities.logEmailActivity(emailActivity);

      // Assert
      expect(mockSupabase.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          entity_type: 'activity',
          entity_id: 'email-789',
          hubspot_id: 'engagement-123',
          status: 'synced',
          last_synced_at: expect.any(String),
        })
      );
    });

    it('should handle sync errors and update status', async () => {
      // Arrange
      const emailActivity = {
        contactId: 'invalid-contact',
        type: 'EMAIL_SENT' as const,
        subject: 'Test Email',
        timestamp: '2024-01-16T10:00:00Z',
        properties: {
          emailId: 'email-789',
        },
      };

      mockClient.post.mockRejectedValue({
        status: 'error',
        message: 'Contact not found',
      });

      // Mock sync status error creation
      mockSupabase.single.mockResolvedValue({
        data: {
          id: 'sync-123',
          entity_type: 'activity',
          entity_id: 'email-789',
          status: 'error',
          error_message: 'Contact not found',
        },
        error: null,
      });

      // Act & Assert
      await expect(hubspotActivities.logEmailActivity(emailActivity))
        .rejects
        .toThrow(HubSpotSyncError);

      expect(mockSupabase.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'error',
          error_message: 'Contact not found',
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle rate limiting', async () => {
      // Arrange
      const emailActivity = {
        contactId: 'contact-123',
        type: 'EMAIL_SENT' as const,
        subject: 'Rate Limited Email',
        timestamp: '2024-01-16T10:00:00Z',
      };

      mockClient.post.mockRejectedValueOnce({
        status: 429,
        message: 'Rate limit exceeded',
        retryAfter: 60,
      });

      // Mock successful retry
      const mockEngagement = {
        id: 'engagement-123',
        type: 'EMAIL',
        timestamp: emailActivity.timestamp,
      };

      mockClient.post.mockResolvedValueOnce(mockEngagement);

      // Act
      const result = await hubspotActivities.logEmailActivity(emailActivity);

      // Assert
      expect(result).toEqual(mockEngagement);
      expect(mockClient.post).toHaveBeenCalledTimes(2);
    });

    it('should handle validation errors', async () => {
      // Arrange
      const invalidActivity = {
        contactId: 'contact-123',
        type: 'EMAIL_SENT' as const,
        // Missing required subject field
        timestamp: '2024-01-16T10:00:00Z',
      } as any;

      // Act & Assert
      await expect(hubspotActivities.logEmailActivity(invalidActivity))
        .rejects
        .toThrow(HubSpotValidationError);
    });

    it('should retry on temporary failures', async () => {
      // Arrange
      const emailActivity = {
        contactId: 'contact-123',
        type: 'EMAIL_SENT' as const,
        subject: 'Retry Test',
        timestamp: '2024-01-16T10:00:00Z',
      };

      const mockEngagement = {
        id: 'engagement-123',
        type: 'EMAIL',
        timestamp: emailActivity.timestamp,
      };

      // First call fails with 503, second succeeds
      mockClient.post
        .mockRejectedValueOnce({ status: 503, message: 'Service unavailable' })
        .mockResolvedValueOnce(mockEngagement);

      // Act
      const result = await hubspotActivities.logEmailActivity(emailActivity);

      // Assert
      expect(result).toEqual(mockEngagement);
      expect(mockClient.post).toHaveBeenCalledTimes(2);
    });

    it('should not retry on permanent failures', async () => {
      // Arrange
      const emailActivity = {
        contactId: 'contact-123',
        type: 'EMAIL_SENT' as const,
        subject: 'Permanent Failure',
        timestamp: '2024-01-16T10:00:00Z',
      };

      mockClient.post.mockRejectedValue({
        status: 400,
        message: 'Invalid request',
      });

      // Act & Assert
      await expect(hubspotActivities.logEmailActivity(emailActivity))
        .rejects
        .toThrow('Invalid request');

      expect(mockClient.post).toHaveBeenCalledTimes(1); // No retry
    });
  });
});