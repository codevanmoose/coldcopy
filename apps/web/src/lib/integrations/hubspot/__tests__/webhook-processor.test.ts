import { HubSpotWebhookProcessor } from '../webhook-processor';
import { HubSpotClient } from '../client';
import { HubSpotAuth } from '../auth';
import {
  HubSpotWebhookEvent,
  HubSpotValidationError,
  HubSpotSyncError,
} from '../types';
import { createServerClient } from '@/lib/supabase/server';
import { NextRequest } from 'next/server';

// Mock dependencies
jest.mock('../client');
jest.mock('../auth');
jest.mock('@/lib/supabase/server');
jest.mock('crypto', () => ({
  createHmac: jest.fn(),
}));

describe('HubSpotWebhookProcessor', () => {
  let webhookProcessor: HubSpotWebhookProcessor;
  let mockClient: jest.Mocked<HubSpotClient>;
  let mockAuth: jest.Mocked<HubSpotAuth>;
  let mockSupabase: any;
  let mockRequest: Partial<NextRequest>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Supabase
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      upsert: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
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

    // Mock request object
    mockRequest = {
      headers: new Headers({
        'x-hubspot-signature': 'sha256=test-signature',
        'content-type': 'application/json',
      }),
      text: jest.fn(),
      json: jest.fn(),
    };

    webhookProcessor = new HubSpotWebhookProcessor();
  });

  describe('Webhook Verification', () => {
    it('should verify webhook signature successfully', async () => {
      // Arrange
      const webhookSecret = 'test-webhook-secret';
      const payload = JSON.stringify({
        subscriptionType: 'contact.creation',
        eventId: 'event-123',
      });
      const expectedSignature = 'sha256=correct-signature';

      // Mock crypto
      const mockHmac = {
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue('correct-signature'),
      };
      const crypto = require('crypto');
      crypto.createHmac.mockReturnValue(mockHmac);

      mockRequest.text = jest.fn().mockResolvedValue(payload);
      mockRequest.headers = new Headers({
        'x-hubspot-signature': expectedSignature,
      });

      // Act
      const isValid = await webhookProcessor.verifySignature(
        mockRequest as NextRequest,
        webhookSecret
      );

      // Assert
      expect(isValid).toBe(true);
      expect(crypto.createHmac).toHaveBeenCalledWith('sha256', webhookSecret);
      expect(mockHmac.update).toHaveBeenCalledWith(payload);
    });

    it('should reject invalid webhook signature', async () => {
      // Arrange
      const webhookSecret = 'test-webhook-secret';
      const payload = JSON.stringify({
        subscriptionType: 'contact.creation',
        eventId: 'event-123',
      });

      // Mock crypto to return different signature
      const mockHmac = {
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue('different-signature'),
      };
      const crypto = require('crypto');
      crypto.createHmac.mockReturnValue(mockHmac);

      mockRequest.text = jest.fn().mockResolvedValue(payload);
      mockRequest.headers = new Headers({
        'x-hubspot-signature': 'sha256=wrong-signature',
      });

      // Act
      const isValid = await webhookProcessor.verifySignature(
        mockRequest as NextRequest,
        webhookSecret
      );

      // Assert
      expect(isValid).toBe(false);
    });

    it('should handle missing signature header', async () => {
      // Arrange
      const webhookSecret = 'test-webhook-secret';
      mockRequest.headers = new Headers();

      // Act & Assert
      await expect(
        webhookProcessor.verifySignature(mockRequest as NextRequest, webhookSecret)
      ).rejects.toThrow(HubSpotValidationError);
    });
  });

  describe('Contact Event Processing', () => {
    it('should process contact creation event', async () => {
      // Arrange
      const webhookEvent: HubSpotWebhookEvent = {
        eventId: 'event-123',
        subscriptionType: 'contact.creation',
        portalId: 12345,
        occurredAt: '2024-01-15T10:00:00Z',
        subscriptionId: 1,
        attemptNumber: 1,
        objectId: 'contact-456',
        changeSource: 'CRM_UI',
      };

      // Mock contact data from HubSpot
      const mockContact = {
        id: 'contact-456',
        properties: {
          email: 'new@example.com',
          firstname: 'New',
          lastname: 'Contact',
          createdate: '2024-01-15T10:00:00Z',
          coldcopy_campaign_id: 'campaign-123',
        },
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-15T10:00:00Z',
      };

      mockClient.get.mockResolvedValue(mockContact);

      // Mock workspace lookup
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'integration-123',
          workspace_id: 'workspace-123',
          hub_id: '12345',
        },
        error: null,
      });

      // Mock lead creation
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'lead-789',
          email: 'new@example.com',
          first_name: 'New',
          last_name: 'Contact',
          workspace_id: 'workspace-123',
        },
        error: null,
      });

      // Mock sync status creation
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'sync-123',
          entity_type: 'contact',
          entity_id: 'lead-789',
          hubspot_id: 'contact-456',
          status: 'synced',
        },
        error: null,
      });

      // Act
      const result = await webhookProcessor.processEvent(webhookEvent);

      // Assert
      expect(result.success).toBe(true);
      expect(result.action).toBe('contact_created');
      expect(mockClient.get).toHaveBeenCalledWith(
        '/crm/v3/objects/contacts/contact-456',
        expect.any(Object)
      );
      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'new@example.com',
          first_name: 'New',
          last_name: 'Contact',
          workspace_id: 'workspace-123',
        })
      );
    });

    it('should process contact property update event', async () => {
      // Arrange
      const webhookEvent: HubSpotWebhookEvent = {
        eventId: 'event-456',
        subscriptionType: 'contact.propertyChange',
        portalId: 12345,
        occurredAt: '2024-01-15T11:00:00Z',
        subscriptionId: 1,
        attemptNumber: 1,
        objectId: 'contact-456',
        changeSource: 'CRM_UI',
        propertyName: 'lifecyclestage',
        propertyValue: 'customer',
      };

      // Mock workspace lookup
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'integration-123',
          workspace_id: 'workspace-123',
          hub_id: '12345',
        },
        error: null,
      });

      // Mock existing sync status
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'sync-123',
          entity_type: 'contact',
          entity_id: 'lead-789',
          hubspot_id: 'contact-456',
          status: 'synced',
        },
        error: null,
      });

      // Mock contact data
      const mockContact = {
        id: 'contact-456',
        properties: {
          email: 'existing@example.com',
          firstname: 'Existing',
          lastname: 'Contact',
          lifecyclestage: 'customer',
        },
      };

      mockClient.get.mockResolvedValue(mockContact);

      // Mock lead update
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'lead-789',
          email: 'existing@example.com',
          first_name: 'Existing',
          last_name: 'Contact',
          lifecycle_stage: 'customer',
        },
        error: null,
      });

      // Act
      const result = await webhookProcessor.processEvent(webhookEvent);

      // Assert
      expect(result.success).toBe(true);
      expect(result.action).toBe('contact_updated');
      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          lifecycle_stage: 'customer',
        })
      );
    });

    it('should process contact deletion event', async () => {
      // Arrange
      const webhookEvent: HubSpotWebhookEvent = {
        eventId: 'event-789',
        subscriptionType: 'contact.deletion',
        portalId: 12345,
        occurredAt: '2024-01-15T12:00:00Z',
        subscriptionId: 1,
        attemptNumber: 1,
        objectId: 'contact-456',
        changeSource: 'CRM_UI',
      };

      // Mock workspace lookup
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'integration-123',
          workspace_id: 'workspace-123',
          hub_id: '12345',
        },
        error: null,
      });

      // Mock existing sync status
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'sync-123',
          entity_type: 'contact',
          entity_id: 'lead-789',
          hubspot_id: 'contact-456',
          status: 'synced',
        },
        error: null,
      });

      // Mock sync status deletion
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      // Act
      const result = await webhookProcessor.processEvent(webhookEvent);

      // Assert
      expect(result.success).toBe(true);
      expect(result.action).toBe('contact_deleted');
      expect(mockSupabase.delete).toHaveBeenCalled();
    });
  });

  describe('Deal Event Processing', () => {
    it('should process deal creation event', async () => {
      // Arrange
      const webhookEvent: HubSpotWebhookEvent = {
        eventId: 'event-deal-123',
        subscriptionType: 'deal.creation',
        portalId: 12345,
        occurredAt: '2024-01-15T13:00:00Z',
        subscriptionId: 2,
        attemptNumber: 1,
        objectId: 'deal-456',
        changeSource: 'CRM_UI',
      };

      // Mock deal data
      const mockDeal = {
        id: 'deal-456',
        properties: {
          dealname: 'New Deal',
          amount: '50000',
          dealstage: 'appointmentscheduled',
          createdate: '2024-01-15T13:00:00Z',
          coldcopy_campaign_id: 'campaign-123',
          coldcopy_lead_id: 'lead-789',
        },
      };

      mockClient.get.mockResolvedValue(mockDeal);

      // Mock workspace lookup
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'integration-123',
          workspace_id: 'workspace-123',
          hub_id: '12345',
        },
        error: null,
      });

      // Mock deal creation in ColdCopy
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'coldcopy-deal-123',
          name: 'New Deal',
          value: 50000,
          stage: 'qualified',
          workspace_id: 'workspace-123',
          lead_id: 'lead-789',
        },
        error: null,
      });

      // Act
      const result = await webhookProcessor.processEvent(webhookEvent);

      // Assert
      expect(result.success).toBe(true);
      expect(result.action).toBe('deal_created');
      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'New Deal',
          value: 50000,
          stage: 'qualified',
          workspace_id: 'workspace-123',
          lead_id: 'lead-789',
        })
      );
    });

    it('should process deal stage change event', async () => {
      // Arrange
      const webhookEvent: HubSpotWebhookEvent = {
        eventId: 'event-deal-456',
        subscriptionType: 'deal.propertyChange',
        portalId: 12345,
        occurredAt: '2024-01-15T14:00:00Z',
        subscriptionId: 2,
        attemptNumber: 1,
        objectId: 'deal-456',
        changeSource: 'CRM_UI',
        propertyName: 'dealstage',
        propertyValue: 'closedwon',
      };

      // Mock workspace lookup
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'integration-123',
          workspace_id: 'workspace-123',
          hub_id: '12345',
        },
        error: null,
      });

      // Mock existing sync status for deal
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'sync-deal-123',
          entity_type: 'deal',
          entity_id: 'coldcopy-deal-123',
          hubspot_id: 'deal-456',
          status: 'synced',
        },
        error: null,
      });

      // Mock deal update
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'coldcopy-deal-123',
          stage: 'won',
          closed_at: '2024-01-15T14:00:00Z',
        },
        error: null,
      });

      // Act
      const result = await webhookProcessor.processEvent(webhookEvent);

      // Assert
      expect(result.success).toBe(true);
      expect(result.action).toBe('deal_updated');
      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          stage: 'won',
          closed_at: expect.any(String),
        })
      );
    });
  });

  describe('Company Event Processing', () => {
    it('should process company creation event', async () => {
      // Arrange
      const webhookEvent: HubSpotWebhookEvent = {
        eventId: 'event-company-123',
        subscriptionType: 'company.creation',
        portalId: 12345,
        occurredAt: '2024-01-15T15:00:00Z',
        subscriptionId: 3,
        attemptNumber: 1,
        objectId: 'company-789',
        changeSource: 'CRM_UI',
      };

      // Mock company data
      const mockCompany = {
        id: 'company-789',
        properties: {
          name: 'Acme Corporation',
          domain: 'acme.com',
          industry: 'Technology',
          numberofemployees: '500',
          annualrevenue: '10000000',
          createdate: '2024-01-15T15:00:00Z',
        },
      };

      mockClient.get.mockResolvedValue(mockCompany);

      // Mock workspace lookup
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'integration-123',
          workspace_id: 'workspace-123',
          hub_id: '12345',
        },
        error: null,
      });

      // Mock company creation in ColdCopy
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'coldcopy-company-123',
          name: 'Acme Corporation',
          domain: 'acme.com',
          industry: 'Technology',
          employee_count: 500,
          annual_revenue: 10000000,
          workspace_id: 'workspace-123',
        },
        error: null,
      });

      // Act
      const result = await webhookProcessor.processEvent(webhookEvent);

      // Assert
      expect(result.success).toBe(true);
      expect(result.action).toBe('company_created');
      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Acme Corporation',
          domain: 'acme.com',
          industry: 'Technology',
          employee_count: 500,
          annual_revenue: 10000000,
        })
      );
    });
  });

  describe('Engagement Event Processing', () => {
    it('should process email engagement event', async () => {
      // Arrange
      const webhookEvent: HubSpotWebhookEvent = {
        eventId: 'event-email-123',
        subscriptionType: 'engagement.email',
        portalId: 12345,
        occurredAt: '2024-01-15T16:00:00Z',
        subscriptionId: 4,
        attemptNumber: 1,
        objectId: 'engagement-456',
        changeSource: 'EMAIL',
      };

      // Mock engagement data
      const mockEngagement = {
        id: 'engagement-456',
        type: 'EMAIL',
        timestamp: '2024-01-15T16:00:00Z',
        metadata: {
          subject: 'Follow-up Email',
          html: 'Email content...',
          status: 'SENT',
        },
        associations: {
          contactIds: ['contact-123'],
        },
      };

      mockClient.get.mockResolvedValue(mockEngagement);

      // Mock workspace lookup
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'integration-123',
          workspace_id: 'workspace-123',
          hub_id: '12345',
        },
        error: null,
      });

      // Mock contact lookup for email tracking
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'sync-contact-123',
          entity_id: 'lead-456',
          hubspot_id: 'contact-123',
        },
        error: null,
      });

      // Mock email event creation
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'email-event-123',
          lead_id: 'lead-456',
          event_type: 'sent',
          subject: 'Follow-up Email',
          timestamp: '2024-01-15T16:00:00Z',
        },
        error: null,
      });

      // Act
      const result = await webhookProcessor.processEvent(webhookEvent);

      // Assert
      expect(result.success).toBe(true);
      expect(result.action).toBe('engagement_logged');
      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          lead_id: 'lead-456',
          event_type: 'sent',
          subject: 'Follow-up Email',
          timestamp: '2024-01-15T16:00:00Z',
        })
      );
    });

    it('should process call engagement event', async () => {
      // Arrange
      const webhookEvent: HubSpotWebhookEvent = {
        eventId: 'event-call-123',
        subscriptionType: 'engagement.call',
        portalId: 12345,
        occurredAt: '2024-01-15T17:00:00Z',
        subscriptionId: 5,
        attemptNumber: 1,
        objectId: 'engagement-789',
        changeSource: 'PHONE',
      };

      // Mock call engagement data
      const mockEngagement = {
        id: 'engagement-789',
        type: 'CALL',
        timestamp: '2024-01-15T17:00:00Z',
        metadata: {
          durationMilliseconds: 1800000, // 30 minutes
          disposition: 'CONNECTED',
          body: 'Discussed pricing and next steps',
        },
        associations: {
          contactIds: ['contact-456'],
        },
      };

      mockClient.get.mockResolvedValue(mockEngagement);

      // Mock workspace lookup
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'integration-123',
          workspace_id: 'workspace-123',
          hub_id: '12345',
        },
        error: null,
      });

      // Mock contact lookup
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'sync-contact-456',
          entity_id: 'lead-789',
          hubspot_id: 'contact-456',
        },
        error: null,
      });

      // Mock call activity creation
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'call-activity-123',
          lead_id: 'lead-789',
          activity_type: 'call',
          duration: 1800,
          disposition: 'connected',
          notes: 'Discussed pricing and next steps',
          timestamp: '2024-01-15T17:00:00Z',
        },
        error: null,
      });

      // Act
      const result = await webhookProcessor.processEvent(webhookEvent);

      // Assert
      expect(result.success).toBe(true);
      expect(result.action).toBe('engagement_logged');
      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          lead_id: 'lead-789',
          activity_type: 'call',
          duration: 1800,
          disposition: 'connected',
          notes: 'Discussed pricing and next steps',
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle unknown subscription types', async () => {
      // Arrange
      const webhookEvent: HubSpotWebhookEvent = {
        eventId: 'event-unknown-123',
        subscriptionType: 'unknown.event',
        portalId: 12345,
        occurredAt: '2024-01-15T18:00:00Z',
        subscriptionId: 99,
        attemptNumber: 1,
        objectId: 'object-123',
        changeSource: 'UNKNOWN',
      };

      // Act
      const result = await webhookProcessor.processEvent(webhookEvent);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown subscription type');
      expect(result.action).toBe('ignored');
    });

    it('should handle missing workspace integration', async () => {
      // Arrange
      const webhookEvent: HubSpotWebhookEvent = {
        eventId: 'event-no-workspace-123',
        subscriptionType: 'contact.creation',
        portalId: 99999, // Non-existent portal
        occurredAt: '2024-01-15T18:00:00Z',
        subscriptionId: 1,
        attemptNumber: 1,
        objectId: 'contact-123',
        changeSource: 'CRM_UI',
      };

      // Mock workspace lookup failure
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      });

      // Act
      const result = await webhookProcessor.processEvent(webhookEvent);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('No integration found');
      expect(result.action).toBe('ignored');
    });

    it('should handle HubSpot API errors', async () => {
      // Arrange
      const webhookEvent: HubSpotWebhookEvent = {
        eventId: 'event-api-error-123',
        subscriptionType: 'contact.creation',
        portalId: 12345,
        occurredAt: '2024-01-15T18:00:00Z',
        subscriptionId: 1,
        attemptNumber: 1,
        objectId: 'contact-404',
        changeSource: 'CRM_UI',
      };

      // Mock workspace lookup
      mockSupabase.single.mockResolvedValue({
        data: {
          id: 'integration-123',
          workspace_id: 'workspace-123',
          hub_id: '12345',
        },
        error: null,
      });

      // Mock HubSpot API error
      mockClient.get.mockRejectedValue({
        status: 'error',
        message: 'Contact not found',
        category: 'OBJECT_NOT_FOUND',
      });

      // Act
      const result = await webhookProcessor.processEvent(webhookEvent);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Contact not found');
      expect(result.action).toBe('error');
    });

    it('should handle database errors', async () => {
      // Arrange
      const webhookEvent: HubSpotWebhookEvent = {
        eventId: 'event-db-error-123',
        subscriptionType: 'contact.creation',
        portalId: 12345,
        occurredAt: '2024-01-15T18:00:00Z',
        subscriptionId: 1,
        attemptNumber: 1,
        objectId: 'contact-456',
        changeSource: 'CRM_UI',
      };

      const mockContact = {
        id: 'contact-456',
        properties: {
          email: 'test@example.com',
          firstname: 'Test',
          lastname: 'User',
        },
      };

      mockClient.get.mockResolvedValue(mockContact);

      // Mock workspace lookup
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'integration-123',
          workspace_id: 'workspace-123',
          hub_id: '12345',
        },
        error: null,
      });

      // Mock database error
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database connection failed' },
      });

      // Act
      const result = await webhookProcessor.processEvent(webhookEvent);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Database connection failed');
      expect(result.action).toBe('error');
    });

    it('should handle retry attempts', async () => {
      // Arrange
      const webhookEvent: HubSpotWebhookEvent = {
        eventId: 'event-retry-123',
        subscriptionType: 'contact.creation',
        portalId: 12345,
        occurredAt: '2024-01-15T18:00:00Z',
        subscriptionId: 1,
        attemptNumber: 3, // Retry attempt
        objectId: 'contact-456',
        changeSource: 'CRM_UI',
      };

      // Mock previous processing attempt
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'webhook-log-123',
          event_id: 'event-retry-123',
          status: 'failed',
          attempt_count: 2,
        },
        error: null,
      });

      // Mock successful processing on retry
      const mockContact = {
        id: 'contact-456',
        properties: {
          email: 'retry@example.com',
          firstname: 'Retry',
          lastname: 'User',
        },
      };

      mockClient.get.mockResolvedValue(mockContact);

      // Mock workspace lookup
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'integration-123',
          workspace_id: 'workspace-123',
          hub_id: '12345',
        },
        error: null,
      });

      // Mock successful lead creation
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'lead-retry-123',
          email: 'retry@example.com',
          first_name: 'Retry',
          last_name: 'User',
        },
        error: null,
      });

      // Act
      const result = await webhookProcessor.processEvent(webhookEvent);

      // Assert
      expect(result.success).toBe(true);
      expect(result.action).toBe('contact_created');
      expect(result.retryAttempt).toBe(3);
    });
  });

  describe('Webhook Logging', () => {
    it('should log webhook events', async () => {
      // Arrange
      const webhookEvent: HubSpotWebhookEvent = {
        eventId: 'event-log-123',
        subscriptionType: 'contact.creation',
        portalId: 12345,
        occurredAt: '2024-01-15T18:00:00Z',
        subscriptionId: 1,
        attemptNumber: 1,
        objectId: 'contact-456',
        changeSource: 'CRM_UI',
      };

      // Mock successful processing
      const mockContact = {
        id: 'contact-456',
        properties: {
          email: 'log@example.com',
          firstname: 'Log',
          lastname: 'Test',
        },
      };

      mockClient.get.mockResolvedValue(mockContact);

      // Mock workspace lookup
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'integration-123',
          workspace_id: 'workspace-123',
          hub_id: '12345',
        },
        error: null,
      });

      // Mock lead creation
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'lead-log-123',
          email: 'log@example.com',
        },
        error: null,
      });

      // Mock webhook log creation
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'webhook-log-123',
          event_id: 'event-log-123',
          subscription_type: 'contact.creation',
          status: 'processed',
          attempt_count: 1,
          processed_at: '2024-01-15T18:00:00Z',
        },
        error: null,
      });

      // Act
      const result = await webhookProcessor.processEvent(webhookEvent);

      // Assert
      expect(result.success).toBe(true);
      expect(mockSupabase.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_id: 'event-log-123',
          subscription_type: 'contact.creation',
          status: 'processed',
          attempt_count: 1,
        })
      );
    });

    it('should log failed webhook events', async () => {
      // Arrange
      const webhookEvent: HubSpotWebhookEvent = {
        eventId: 'event-failed-123',
        subscriptionType: 'contact.creation',
        portalId: 12345,
        occurredAt: '2024-01-15T18:00:00Z',
        subscriptionId: 1,
        attemptNumber: 1,
        objectId: 'contact-error',
        changeSource: 'CRM_UI',
      };

      // Mock workspace lookup
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'integration-123',
          workspace_id: 'workspace-123',
          hub_id: '12345',
        },
        error: null,
      });

      // Mock HubSpot API error
      mockClient.get.mockRejectedValue({
        status: 'error',
        message: 'Contact not found',
      });

      // Mock webhook log creation for failure
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'webhook-log-failed-123',
          event_id: 'event-failed-123',
          status: 'failed',
          error_message: 'Contact not found',
        },
        error: null,
      });

      // Act
      const result = await webhookProcessor.processEvent(webhookEvent);

      // Assert
      expect(result.success).toBe(false);
      expect(mockSupabase.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_id: 'event-failed-123',
          status: 'failed',
          error_message: expect.stringContaining('Contact not found'),
        })
      );
    });
  });

  describe('Deduplication', () => {
    it('should detect and skip duplicate events', async () => {
      // Arrange
      const webhookEvent: HubSpotWebhookEvent = {
        eventId: 'event-duplicate-123',
        subscriptionType: 'contact.creation',
        portalId: 12345,
        occurredAt: '2024-01-15T18:00:00Z',
        subscriptionId: 1,
        attemptNumber: 1,
        objectId: 'contact-456',
        changeSource: 'CRM_UI',
      };

      // Mock existing webhook log
      mockSupabase.single.mockResolvedValue({
        data: {
          id: 'webhook-log-existing-123',
          event_id: 'event-duplicate-123',
          status: 'processed',
          processed_at: '2024-01-15T18:00:00Z',
        },
        error: null,
      });

      // Act
      const result = await webhookProcessor.processEvent(webhookEvent);

      // Assert
      expect(result.success).toBe(true);
      expect(result.action).toBe('duplicate_skipped');
      expect(mockClient.get).not.toHaveBeenCalled(); // Should not fetch from HubSpot
    });

    it('should process event if previous attempt failed', async () => {
      // Arrange
      const webhookEvent: HubSpotWebhookEvent = {
        eventId: 'event-retry-failed-123',
        subscriptionType: 'contact.creation',
        portalId: 12345,
        occurredAt: '2024-01-15T18:00:00Z',
        subscriptionId: 1,
        attemptNumber: 2,
        objectId: 'contact-456',
        changeSource: 'CRM_UI',
      };

      // Mock existing failed webhook log
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'webhook-log-failed-123',
          event_id: 'event-retry-failed-123',
          status: 'failed',
          attempt_count: 1,
          error_message: 'Previous error',
        },
        error: null,
      });

      // Mock successful processing on retry
      const mockContact = {
        id: 'contact-456',
        properties: {
          email: 'retry@example.com',
          firstname: 'Retry',
          lastname: 'Test',
        },
      };

      mockClient.get.mockResolvedValue(mockContact);

      // Mock workspace lookup
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'integration-123',
          workspace_id: 'workspace-123',
          hub_id: '12345',
        },
        error: null,
      });

      // Mock lead creation
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'lead-retry-123',
          email: 'retry@example.com',
        },
        error: null,
      });

      // Act
      const result = await webhookProcessor.processEvent(webhookEvent);

      // Assert
      expect(result.success).toBe(true);
      expect(result.action).toBe('contact_created');
      expect(result.retryAttempt).toBe(2);
    });
  });
});