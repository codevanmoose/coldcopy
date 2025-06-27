import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WebhookManager } from '../webhooks';
import { 
  mockSupabaseClient, 
  mockFetch,
  mockRedisClient,
  createMockWebhook,
  createWebhookEvent,
  createMockPerson,
  createMockDeal,
  createMockActivity,
  createApiResponse,
  testConfig
} from './test-utils';
import { testData } from './test.config';
import crypto from 'crypto';

describe('Pipedrive Webhooks', () => {
  let webhookManager: WebhookManager;
  const webhookUrl = 'https://app.example.com/api/pipedrive/webhook';
  const webhookSecret = 'test-webhook-secret';

  beforeEach(() => {
    vi.clearAllMocks();
    webhookManager = new WebhookManager({
      config: { ...testConfig, webhookSecret },
      supabaseClient: mockSupabaseClient,
      redisClient: mockRedisClient,
      workspaceId: testData.workspace.id
    });
  });

  describe('Webhook Registration', () => {
    it('should register webhooks for all event types', async () => {
      const eventTypes = [
        'person.added', 'person.updated', 'person.deleted',
        'deal.added', 'deal.updated', 'deal.deleted',
        'activity.added', 'activity.updated', 'activity.deleted'
      ];

      // Mock webhook creation responses
      for (const eventType of eventTypes) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 201,
          json: async () => createApiResponse(
            createMockWebhook({
              event_action: eventType.split('.')[1],
              event_object: eventType.split('.')[0],
              subscription_url: webhookUrl
            })
          )
        });
      }

      const webhooks = await webhookManager.registerWebhooks(
        webhookUrl,
        eventTypes
      );

      expect(mockFetch).toHaveBeenCalledTimes(eventTypes.length);
      expect(webhooks).toHaveLength(eventTypes.length);
    });

    it('should update existing webhooks', async () => {
      const existingWebhook = createMockWebhook({
        id: 123,
        event_action: 'added',
        event_object: 'person',
        subscription_url: 'https://old-url.com/webhook'
      });

      // Mock get existing webhooks
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createApiResponse([existingWebhook])
      });

      // Mock update webhook
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createApiResponse({
          ...existingWebhook,
          subscription_url: webhookUrl
        })
      });

      await webhookManager.updateWebhook(existingWebhook.id, {
        subscription_url: webhookUrl
      });

      expect(mockFetch).toHaveBeenLastCalledWith(
        expect.stringContaining(`/webhooks/${existingWebhook.id}`),
        expect.objectContaining({
          method: 'PUT',
          body: expect.stringContaining(webhookUrl)
        })
      );
    });

    it('should delete webhooks', async () => {
      const webhookId = 123;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createApiResponse({ id: webhookId })
      });

      await webhookManager.deleteWebhook(webhookId);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/webhooks/${webhookId}`),
        expect.objectContaining({
          method: 'DELETE'
        })
      );
    });

    it('should handle webhook registration failures', async () => {
      const eventType = 'person.added';

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Invalid webhook URL' })
      });

      await expect(
        webhookManager.registerWebhook(webhookUrl, eventType)
      ).rejects.toThrow('Invalid webhook URL');
    });
  });

  describe('Webhook Signature Verification', () => {
    it('should verify valid webhook signature', () => {
      const payload = JSON.stringify({
        event: 'person.added',
        current: { id: 123 }
      });
      const timestamp = Math.floor(Date.now() / 1000).toString();
      
      const signature = crypto
        .createHmac('sha256', webhookSecret)
        .update(`${timestamp}.${payload}`)
        .digest('hex');

      const headers = {
        'x-pipedrive-signature': `t=${timestamp},v1=${signature}`
      };

      const isValid = webhookManager.verifySignature(
        payload,
        headers['x-pipedrive-signature']
      );

      expect(isValid).toBe(true);
    });

    it('should reject invalid signature', () => {
      const payload = JSON.stringify({
        event: 'person.added',
        current: { id: 123 }
      });
      const timestamp = Math.floor(Date.now() / 1000).toString();

      const headers = {
        'x-pipedrive-signature': `t=${timestamp},v1=invalid-signature`
      };

      const isValid = webhookManager.verifySignature(
        payload,
        headers['x-pipedrive-signature']
      );

      expect(isValid).toBe(false);
    });

    it('should reject expired signatures', () => {
      const payload = JSON.stringify({
        event: 'person.added',
        current: { id: 123 }
      });
      const oldTimestamp = (Math.floor(Date.now() / 1000) - 3600).toString();
      
      const signature = crypto
        .createHmac('sha256', webhookSecret)
        .update(`${oldTimestamp}.${payload}`)
        .digest('hex');

      const headers = {
        'x-pipedrive-signature': `t=${oldTimestamp},v1=${signature}`
      };

      const isValid = webhookManager.verifySignature(
        payload,
        headers['x-pipedrive-signature'],
        { tolerance: 300 } // 5 minute tolerance
      );

      expect(isValid).toBe(false);
    });

    it('should handle multiple signature versions', () => {
      const payload = JSON.stringify({
        event: 'person.added',
        current: { id: 123 }
      });
      const timestamp = Math.floor(Date.now() / 1000).toString();
      
      const v1Signature = crypto
        .createHmac('sha256', webhookSecret)
        .update(`${timestamp}.${payload}`)
        .digest('hex');

      const v2Signature = crypto
        .createHmac('sha512', webhookSecret)
        .update(`${timestamp}.${payload}`)
        .digest('hex');

      const headers = {
        'x-pipedrive-signature': `t=${timestamp},v1=${v1Signature},v2=${v2Signature}`
      };

      const isValid = webhookManager.verifySignature(
        payload,
        headers['x-pipedrive-signature']
      );

      expect(isValid).toBe(true);
    });
  });

  describe('Webhook Event Processing', () => {
    it('should process person.added event', async () => {
      const person = createMockPerson({ id: 123 });
      const event = createWebhookEvent('added', 'person', person);

      mockSupabaseClient.from.mockReturnValue({
        ...mockSupabaseClient,
        insert: vi.fn().mockResolvedValue({ data: null, error: null })
      });

      await webhookManager.processWebhook(event);

      expect(mockSupabaseClient.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          pipedrive_id: person.id,
          name: person.name,
          email: person.email[0].value,
          workspace_id: testData.workspace.id
        })
      );
    });

    it('should process person.updated event', async () => {
      const previousPerson = createMockPerson({ 
        id: 123, 
        name: 'Old Name' 
      });
      const currentPerson = createMockPerson({ 
        id: 123, 
        name: 'New Name' 
      });
      
      const event = createWebhookEvent('updated', 'person', currentPerson);
      event.previous = previousPerson;

      mockSupabaseClient.from.mockReturnValue({
        ...mockSupabaseClient,
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null })
        })
      });

      await webhookManager.processWebhook(event);

      expect(mockSupabaseClient.update).toHaveBeenCalledWith(
        expect.objectContaining({
          name: currentPerson.name
        })
      );
    });

    it('should process person.deleted event', async () => {
      const person = createMockPerson({ id: 123 });
      const event = createWebhookEvent('deleted', 'person', null);
      event.previous = person;

      mockSupabaseClient.from.mockReturnValue({
        ...mockSupabaseClient,
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null })
        })
      });

      await webhookManager.processWebhook(event);

      expect(mockSupabaseClient.update).toHaveBeenCalledWith(
        expect.objectContaining({
          deleted_at: expect.any(String)
        })
      );
    });

    it('should process deal.added event', async () => {
      const deal = createMockDeal({ id: 789 });
      const event = createWebhookEvent('added', 'deal', deal);

      mockSupabaseClient.from.mockReturnValue({
        ...mockSupabaseClient,
        insert: vi.fn().mockResolvedValue({ data: null, error: null })
      });

      await webhookManager.processWebhook(event);

      expect(mockSupabaseClient.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          pipedrive_id: deal.id,
          title: deal.title,
          value: deal.value,
          stage_id: deal.stage_id
        })
      );
    });

    it('should process activity.added event', async () => {
      const activity = createMockActivity({ id: 456 });
      const event = createWebhookEvent('added', 'activity', activity);

      mockSupabaseClient.from.mockReturnValue({
        ...mockSupabaseClient,
        insert: vi.fn().mockResolvedValue({ data: null, error: null })
      });

      await webhookManager.processWebhook(event);

      expect(mockSupabaseClient.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          pipedrive_id: activity.id,
          type: activity.type,
          subject: activity.subject,
          done: activity.done
        })
      );
    });

    it('should handle bulk webhook events', async () => {
      const events = [
        createWebhookEvent('added', 'person', createMockPerson({ id: 1 })),
        createWebhookEvent('added', 'person', createMockPerson({ id: 2 })),
        createWebhookEvent('added', 'person', createMockPerson({ id: 3 }))
      ];

      mockSupabaseClient.from.mockReturnValue({
        ...mockSupabaseClient,
        insert: vi.fn().mockResolvedValue({ data: null, error: null })
      });

      await webhookManager.processBulkWebhooks(events);

      expect(mockSupabaseClient.insert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ pipedrive_id: 1 }),
          expect.objectContaining({ pipedrive_id: 2 }),
          expect.objectContaining({ pipedrive_id: 3 })
        ])
      );
    });
  });

  describe('Webhook Deduplication', () => {
    it('should prevent duplicate webhook processing', async () => {
      const event = createWebhookEvent(
        'added', 
        'person', 
        createMockPerson({ id: 123 })
      );

      // First processing
      mockRedisClient.set.mockResolvedValueOnce('OK');
      mockRedisClient.exists.mockResolvedValueOnce(0);

      mockSupabaseClient.from.mockReturnValue({
        ...mockSupabaseClient,
        insert: vi.fn().mockResolvedValue({ data: null, error: null })
      });

      await webhookManager.processWebhook(event);

      // Second processing (duplicate)
      mockRedisClient.exists.mockResolvedValueOnce(1);

      await webhookManager.processWebhook(event);

      // Should only process once
      expect(mockSupabaseClient.insert).toHaveBeenCalledTimes(1);
    });

    it('should use event ID for deduplication', async () => {
      const eventId = 'webhook-123456';
      const event = createWebhookEvent(
        'added', 
        'person', 
        createMockPerson({ id: 123 })
      );
      event.meta.id = eventId;

      mockRedisClient.exists.mockResolvedValueOnce(0);
      mockRedisClient.set.mockResolvedValueOnce('OK');

      await webhookManager.processWebhook(event);

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        expect.stringContaining(eventId),
        '1',
        'EX',
        3600 // 1 hour expiry
      );
    });
  });

  describe('Webhook Error Handling', () => {
    it('should retry failed webhook processing', async () => {
      const event = createWebhookEvent(
        'added', 
        'person', 
        createMockPerson({ id: 123 })
      );

      // First attempt fails
      mockSupabaseClient.from.mockReturnValueOnce({
        ...mockSupabaseClient,
        insert: vi.fn().mockRejectedValueOnce(new Error('Database error'))
      });

      // Second attempt succeeds
      mockSupabaseClient.from.mockReturnValueOnce({
        ...mockSupabaseClient,
        insert: vi.fn().mockResolvedValueOnce({ data: null, error: null })
      });

      await webhookManager.processWebhook(event, { retries: 1 });

      expect(mockSupabaseClient.from).toHaveBeenCalledTimes(2);
    });

    it('should queue failed webhooks for later processing', async () => {
      const event = createWebhookEvent(
        'added', 
        'person', 
        createMockPerson({ id: 123 })
      );

      mockSupabaseClient.from.mockReturnValue({
        ...mockSupabaseClient,
        insert: vi.fn().mockRejectedValue(new Error('Database error'))
      });

      mockRedisClient.zadd.mockResolvedValueOnce(1);

      await webhookManager.processWebhook(event, { 
        retries: 0,
        queueOnFailure: true 
      });

      expect(mockRedisClient.zadd).toHaveBeenCalledWith(
        'webhook_retry_queue',
        expect.any(Number), // Score (timestamp)
        expect.stringContaining(JSON.stringify(event))
      );
    });

    it('should process retry queue', async () => {
      const event1 = createWebhookEvent('added', 'person', createMockPerson({ id: 1 }));
      const event2 = createWebhookEvent('added', 'person', createMockPerson({ id: 2 }));

      mockRedisClient.zrange.mockResolvedValueOnce([
        JSON.stringify(event1),
        JSON.stringify(event2)
      ]);

      mockSupabaseClient.from.mockReturnValue({
        ...mockSupabaseClient,
        insert: vi.fn().mockResolvedValue({ data: null, error: null })
      });

      mockRedisClient.zrem.mockResolvedValue(1);

      await webhookManager.processRetryQueue();

      expect(mockSupabaseClient.insert).toHaveBeenCalledTimes(2);
      expect(mockRedisClient.zrem).toHaveBeenCalledTimes(2);
    });
  });

  describe('Webhook Monitoring', () => {
    it('should track webhook metrics', async () => {
      const events = [
        createWebhookEvent('added', 'person', createMockPerson()),
        createWebhookEvent('updated', 'deal', createMockDeal()),
        createWebhookEvent('deleted', 'activity', null)
      ];

      mockSupabaseClient.from.mockReturnValue({
        ...mockSupabaseClient,
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null })
        })
      });

      for (const event of events) {
        await webhookManager.processWebhook(event);
      }

      const metrics = await webhookManager.getMetrics();

      expect(metrics).toMatchObject({
        processed: 3,
        byType: {
          'person.added': 1,
          'deal.updated': 1,
          'activity.deleted': 1
        }
      });
    });

    it('should alert on webhook failures', async () => {
      const event = createWebhookEvent(
        'added', 
        'person', 
        createMockPerson({ id: 123 })
      );

      mockSupabaseClient.from.mockReturnValue({
        ...mockSupabaseClient,
        insert: vi.fn().mockRejectedValue(new Error('Database error'))
      });

      // Mock notification service
      const notificationSpy = vi.spyOn(webhookManager, 'sendAlert');

      await webhookManager.processWebhook(event, { 
        retries: 0,
        alertOnFailure: true 
      });

      expect(notificationSpy).toHaveBeenCalledWith({
        type: 'webhook_failure',
        event: 'person.added',
        error: 'Database error'
      });
    });
  });

  describe('Webhook Configuration', () => {
    it('should list all registered webhooks', async () => {
      const webhooks = [
        createMockWebhook({ event_object: 'person', event_action: 'added' }),
        createMockWebhook({ event_object: 'deal', event_action: 'updated' }),
        createMockWebhook({ event_object: 'activity', event_action: 'deleted' })
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createApiResponse(webhooks)
      });

      const registered = await webhookManager.listWebhooks();

      expect(registered).toHaveLength(3);
      expect(registered.map(w => `${w.event_object}.${w.event_action}`))
        .toEqual(['person.added', 'deal.updated', 'activity.deleted']);
    });

    it('should validate webhook URL accessibility', async () => {
      const testUrl = 'https://app.example.com/api/pipedrive/webhook';

      // Mock HEAD request to test URL
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200
      });

      const isValid = await webhookManager.validateWebhookUrl(testUrl);

      expect(isValid).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        testUrl,
        expect.objectContaining({
          method: 'HEAD'
        })
      );
    });

    it('should update webhook configuration', async () => {
      const config = {
        enabledEvents: [
          'person.added',
          'person.updated',
          'deal.added',
          'deal.updated'
        ],
        retryAttempts: 3,
        retryDelay: 5000,
        deduplicationWindow: 3600
      };

      mockSupabaseClient.from.mockReturnValue({
        ...mockSupabaseClient,
        upsert: vi.fn().mockResolvedValue({ data: null, error: null })
      });

      await webhookManager.updateConfiguration(config);

      expect(mockSupabaseClient.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          workspace_id: testData.workspace.id,
          config: config
        })
      );
    });
  });
});