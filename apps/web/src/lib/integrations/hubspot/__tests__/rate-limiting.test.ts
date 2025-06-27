import { HubSpotRateLimiter } from '../rate-limiter';
import { HubSpotRateLimitError } from '../types';

// Mock setTimeout and clearTimeout for testing
jest.useFakeTimers();

describe('HubSpotRateLimiter', () => {
  let rateLimiter: HubSpotRateLimiter;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    rateLimiter = new HubSpotRateLimiter();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.useFakeTimers();
  });

  describe('Rate Limit Tracking', () => {
    it('should initialize with default limits', () => {
      // Act
      const status = rateLimiter.getRateLimitStatus();

      // Assert
      expect(status.remaining).toBe(100); // Default daily limit
      expect(status.resetTime).toBeGreaterThan(Date.now());
    });

    it('should update rate limit from response headers', () => {
      // Arrange
      const headers = new Headers({
        'X-HubSpot-RateLimit-Daily': '1000',
        'X-HubSpot-RateLimit-Daily-Remaining': '850',
        'X-HubSpot-RateLimit-Interval-Milliseconds': '86400000',
        'X-HubSpot-RateLimit-Max': '100',
        'X-HubSpot-RateLimit-Remaining': '75',
      });

      // Act
      rateLimiter.updateFromHeaders(headers);
      const status = rateLimiter.getRateLimitStatus();

      // Assert
      expect(status.remaining).toBe(75);
      expect(status.dailyRemaining).toBe(850);
      expect(status.intervalRemaining).toBe(75);
    });

    it('should track multiple rate limit types', () => {
      // Arrange
      const headers = new Headers({
        'X-HubSpot-RateLimit-Daily': '1000',
        'X-HubSpot-RateLimit-Daily-Remaining': '900',
        'X-HubSpot-RateLimit-Secondly': '10',
        'X-HubSpot-RateLimit-Secondly-Remaining': '8',
        'X-HubSpot-RateLimit-Burst': '100',
        'X-HubSpot-RateLimit-Burst-Remaining': '95',
      });

      // Act
      rateLimiter.updateFromHeaders(headers);
      const status = rateLimiter.getRateLimitStatus();

      // Assert
      expect(status.limits.daily.remaining).toBe(900);
      expect(status.limits.secondly.remaining).toBe(8);
      expect(status.limits.burst.remaining).toBe(95);
    });
  });

  describe('Rate Limit Enforcement', () => {
    it('should allow requests when under limit', async () => {
      // Arrange
      const headers = new Headers({
        'X-HubSpot-RateLimit-Remaining': '50',
        'X-HubSpot-RateLimit-Daily-Remaining': '500',
      });
      rateLimiter.updateFromHeaders(headers);

      // Act & Assert
      await expect(rateLimiter.checkRateLimit()).resolves.toBeUndefined();
    });

    it('should block requests when rate limit exceeded', async () => {
      // Arrange
      const headers = new Headers({
        'X-HubSpot-RateLimit-Remaining': '0',
        'X-HubSpot-RateLimit-Interval-Milliseconds': '10000',
      });
      rateLimiter.updateFromHeaders(headers);

      // Act & Assert
      await expect(rateLimiter.checkRateLimit())
        .rejects
        .toThrow(HubSpotRateLimitError);
    });

    it('should block requests when daily limit exceeded', async () => {
      // Arrange
      const headers = new Headers({
        'X-HubSpot-RateLimit-Daily-Remaining': '0',
        'X-HubSpot-RateLimit-Remaining': '50', // Still has interval limit
      });
      rateLimiter.updateFromHeaders(headers);

      // Act & Assert
      await expect(rateLimiter.checkRateLimit())
        .rejects
        .toThrow(HubSpotRateLimitError);
    });

    it('should calculate correct wait time for rate limit reset', async () => {
      // Arrange
      const resetTime = Date.now() + 30000; // 30 seconds from now
      const headers = new Headers({
        'X-HubSpot-RateLimit-Remaining': '0',
        'X-HubSpot-RateLimit-Interval-Milliseconds': '30000',
      });
      rateLimiter.updateFromHeaders(headers);

      // Act & Assert
      try {
        await rateLimiter.checkRateLimit();
        fail('Should have thrown rate limit error');
      } catch (error) {
        expect(error).toBeInstanceOf(HubSpotRateLimitError);
        expect((error as HubSpotRateLimitError).retryAfter).toBeCloseTo(30, 1);
      }
    });
  });

  describe('Proactive Rate Limiting', () => {
    it('should delay requests when approaching rate limit', async () => {
      // Arrange
      const rateLimiterWithBuffer = new HubSpotRateLimiter({
        bufferPercentage: 0.1, // Reserve 10% buffer
        enableProactiveThrottling: true,
      });

      const headers = new Headers({
        'X-HubSpot-RateLimit-Max': '100',
        'X-HubSpot-RateLimit-Remaining': '5', // Only 5% remaining, within buffer
        'X-HubSpot-RateLimit-Interval-Milliseconds': '10000',
      });
      rateLimiterWithBuffer.updateFromHeaders(headers);

      // Act
      const startTime = Date.now();
      const checkPromise = rateLimiterWithBuffer.checkRateLimit();

      // Fast-forward time to simulate delay
      jest.advanceTimersByTime(1000);

      await checkPromise;
      const endTime = Date.now();

      // Assert
      expect(endTime - startTime).toBeGreaterThanOrEqual(1000);
    });

    it('should not delay when sufficient rate limit remaining', async () => {
      // Arrange
      const rateLimiterWithBuffer = new HubSpotRateLimiter({
        bufferPercentage: 0.1,
        enableProactiveThrottling: true,
      });

      const headers = new Headers({
        'X-HubSpot-RateLimit-Max': '100',
        'X-HubSpot-RateLimit-Remaining': '50', // 50% remaining, above buffer
        'X-HubSpot-RateLimit-Interval-Milliseconds': '10000',
      });
      rateLimiterWithBuffer.updateFromHeaders(headers);

      // Act
      const startTime = Date.now();
      await rateLimiterWithBuffer.checkRateLimit();
      const endTime = Date.now();

      // Assert
      expect(endTime - startTime).toBeLessThan(100); // Should be immediate
    });

    it('should calculate appropriate delay based on remaining quota', async () => {
      // Arrange
      const rateLimiterWithAdaptive = new HubSpotRateLimiter({
        enableProactiveThrottling: true,
        adaptiveDelayFactor: 2,
      });

      const headers = new Headers({
        'X-HubSpot-RateLimit-Max': '100',
        'X-HubSpot-RateLimit-Remaining': '2', // Very low remaining
        'X-HubSpot-RateLimit-Interval-Milliseconds': '60000', // 1 minute
      });
      rateLimiterWithAdaptive.updateFromHeaders(headers);

      // Act
      const checkPromise = rateLimiterWithAdaptive.checkRateLimit();

      // The delay should be significant due to low remaining quota
      jest.advanceTimersByTime(5000); // Advance 5 seconds

      await checkPromise;

      // Assert that a delay was applied
      expect(jest.getTimerCount()).toBe(0); // All timers should be resolved
    });
  });

  describe('Request Queuing', () => {
    it('should queue requests when rate limited', async () => {
      // Arrange
      const rateLimiterWithQueue = new HubSpotRateLimiter({
        enableRequestQueuing: true,
        maxQueueSize: 10,
      });

      const headers = new Headers({
        'X-HubSpot-RateLimit-Remaining': '0',
        'X-HubSpot-RateLimit-Interval-Milliseconds': '5000',
      });
      rateLimiterWithQueue.updateFromHeaders(headers);

      // Act
      const promises = [
        rateLimiterWithQueue.checkRateLimit(),
        rateLimiterWithQueue.checkRateLimit(),
        rateLimiterWithQueue.checkRateLimit(),
      ];

      // Simulate rate limit reset
      jest.advanceTimersByTime(5000);

      // Update to show available quota
      const resetHeaders = new Headers({
        'X-HubSpot-RateLimit-Remaining': '100',
        'X-HubSpot-RateLimit-Interval-Milliseconds': '60000',
      });
      rateLimiterWithQueue.updateFromHeaders(resetHeaders);

      await Promise.all(promises);

      // Assert
      expect(promises).toHaveLength(3);
      // All promises should resolve after the rate limit reset
    });

    it('should reject requests when queue is full', async () => {
      // Arrange
      const rateLimiterWithSmallQueue = new HubSpotRateLimiter({
        enableRequestQueuing: true,
        maxQueueSize: 2,
      });

      const headers = new Headers({
        'X-HubSpot-RateLimit-Remaining': '0',
        'X-HubSpot-RateLimit-Interval-Milliseconds': '10000',
      });
      rateLimiterWithSmallQueue.updateFromHeaders(headers);

      // Act
      const promise1 = rateLimiterWithSmallQueue.checkRateLimit();
      const promise2 = rateLimiterWithSmallQueue.checkRateLimit();

      // Third request should be rejected due to full queue
      await expect(rateLimiterWithSmallQueue.checkRateLimit())
        .rejects
        .toThrow('Request queue is full');

      // Clean up pending promises
      jest.advanceTimersByTime(10000);
      rateLimiterWithSmallQueue.updateFromHeaders(new Headers({
        'X-HubSpot-RateLimit-Remaining': '100',
      }));

      await Promise.all([promise1, promise2]);
    });

    it('should process queued requests in FIFO order', async () => {
      // Arrange
      const rateLimiterWithQueue = new HubSpotRateLimiter({
        enableRequestQueuing: true,
        requestProcessingInterval: 100,
      });

      const headers = new Headers({
        'X-HubSpot-RateLimit-Remaining': '0',
        'X-HubSpot-RateLimit-Interval-Milliseconds': '1000',
      });
      rateLimiterWithQueue.updateFromHeaders(headers);

      const executionOrder: number[] = [];

      // Act
      const promise1 = rateLimiterWithQueue.checkRateLimit().then(() => {
        executionOrder.push(1);
      });
      const promise2 = rateLimiterWithQueue.checkRateLimit().then(() => {
        executionOrder.push(2);
      });
      const promise3 = rateLimiterWithQueue.checkRateLimit().then(() => {
        executionOrder.push(3);
      });

      // Simulate rate limit reset and queue processing
      jest.advanceTimersByTime(1000);
      rateLimiterWithQueue.updateFromHeaders(new Headers({
        'X-HubSpot-RateLimit-Remaining': '100',
      }));

      jest.advanceTimersByTime(300); // Process queue

      await Promise.all([promise1, promise2, promise3]);

      // Assert
      expect(executionOrder).toEqual([1, 2, 3]);
    });
  });

  describe('Burst Handling', () => {
    it('should handle burst rate limits separately', async () => {
      // Arrange
      const headers = new Headers({
        'X-HubSpot-RateLimit-Remaining': '50', // Regular limit OK
        'X-HubSpot-RateLimit-Burst-Remaining': '0', // Burst limit exceeded
        'X-HubSpot-RateLimit-Burst-Interval-Milliseconds': '1000',
      });
      rateLimiter.updateFromHeaders(headers);

      // Act & Assert
      await expect(rateLimiter.checkRateLimit())
        .rejects
        .toThrow(HubSpotRateLimitError);
    });

    it('should allow requests when burst limit resets', async () => {
      // Arrange
      const headers = new Headers({
        'X-HubSpot-RateLimit-Remaining': '50',
        'X-HubSpot-RateLimit-Burst-Remaining': '0',
        'X-HubSpot-RateLimit-Burst-Interval-Milliseconds': '1000',
      });
      rateLimiter.updateFromHeaders(headers);

      // First request should fail
      await expect(rateLimiter.checkRateLimit())
        .rejects
        .toThrow(HubSpotRateLimitError);

      // Simulate burst limit reset
      jest.advanceTimersByTime(1000);
      const resetHeaders = new Headers({
        'X-HubSpot-RateLimit-Remaining': '50',
        'X-HubSpot-RateLimit-Burst-Remaining': '10',
      });
      rateLimiter.updateFromHeaders(resetHeaders);

      // Second request should succeed
      await expect(rateLimiter.checkRateLimit()).resolves.toBeUndefined();
    });
  });

  describe('Multiple Workspace Support', () => {
    it('should track rate limits per workspace', async () => {
      // Arrange
      const workspace1Limiter = new HubSpotRateLimiter({ workspaceId: 'workspace-1' });
      const workspace2Limiter = new HubSpotRateLimiter({ workspaceId: 'workspace-2' });

      const workspace1Headers = new Headers({
        'X-HubSpot-RateLimit-Remaining': '10',
      });
      const workspace2Headers = new Headers({
        'X-HubSpot-RateLimit-Remaining': '50',
      });

      // Act
      workspace1Limiter.updateFromHeaders(workspace1Headers);
      workspace2Limiter.updateFromHeaders(workspace2Headers);

      const status1 = workspace1Limiter.getRateLimitStatus();
      const status2 = workspace2Limiter.getRateLimitStatus();

      // Assert
      expect(status1.remaining).toBe(10);
      expect(status2.remaining).toBe(50);
    });

    it('should not share rate limit state between workspaces', async () => {
      // Arrange
      const workspace1Limiter = new HubSpotRateLimiter({ workspaceId: 'workspace-1' });
      const workspace2Limiter = new HubSpotRateLimiter({ workspaceId: 'workspace-2' });

      // Exhaust rate limit for workspace 1
      workspace1Limiter.updateFromHeaders(new Headers({
        'X-HubSpot-RateLimit-Remaining': '0',
      }));

      // Workspace 2 should still have default limits
      const status2 = workspace2Limiter.getRateLimitStatus();

      // Assert
      expect(status2.remaining).toBeGreaterThan(0);
      await expect(workspace2Limiter.checkRateLimit()).resolves.toBeUndefined();
    });
  });

  describe('Metrics and Monitoring', () => {
    it('should track rate limit metrics', () => {
      // Arrange
      const rateLimiterWithMetrics = new HubSpotRateLimiter({
        enableMetrics: true,
      });

      // Act
      rateLimiterWithMetrics.updateFromHeaders(new Headers({
        'X-HubSpot-RateLimit-Remaining': '75',
        'X-HubSpot-RateLimit-Max': '100',
      }));

      const metrics = rateLimiterWithMetrics.getMetrics();

      // Assert
      expect(metrics.requestsAllowed).toBe(0);
      expect(metrics.requestsThrottled).toBe(0);
      expect(metrics.requestsQueued).toBe(0);
      expect(metrics.currentUtilization).toBe(0.25); // 25% used (75/100 remaining)
    });

    it('should update metrics on rate limit events', async () => {
      // Arrange
      const rateLimiterWithMetrics = new HubSpotRateLimiter({
        enableMetrics: true,
        enableProactiveThrottling: true,
      });

      rateLimiterWithMetrics.updateFromHeaders(new Headers({
        'X-HubSpot-RateLimit-Remaining': '5',
        'X-HubSpot-RateLimit-Max': '100',
        'X-HubSpot-RateLimit-Interval-Milliseconds': '1000',
      }));

      // Act - This should trigger throttling
      const checkPromise = rateLimiterWithMetrics.checkRateLimit();
      jest.advanceTimersByTime(100);
      await checkPromise;

      const metrics = rateLimiterWithMetrics.getMetrics();

      // Assert
      expect(metrics.requestsThrottled).toBe(1);
      expect(metrics.requestsAllowed).toBe(1);
    });

    it('should reset metrics when requested', () => {
      // Arrange
      const rateLimiterWithMetrics = new HubSpotRateLimiter({
        enableMetrics: true,
      });

      // Simulate some activity
      rateLimiterWithMetrics.updateFromHeaders(new Headers({
        'X-HubSpot-RateLimit-Remaining': '50',
      }));

      // Act
      rateLimiterWithMetrics.resetMetrics();
      const metrics = rateLimiterWithMetrics.getMetrics();

      // Assert
      expect(metrics.requestsAllowed).toBe(0);
      expect(metrics.requestsThrottled).toBe(0);
      expect(metrics.requestsQueued).toBe(0);
    });
  });

  describe('Configuration', () => {
    it('should use custom configuration', () => {
      // Arrange
      const customConfig = {
        bufferPercentage: 0.2,
        enableProactiveThrottling: true,
        maxQueueSize: 50,
        requestProcessingInterval: 200,
        enableMetrics: true,
      };

      // Act
      const customRateLimiter = new HubSpotRateLimiter(customConfig);
      const config = customRateLimiter.getConfiguration();

      // Assert
      expect(config.bufferPercentage).toBe(0.2);
      expect(config.enableProactiveThrottling).toBe(true);
      expect(config.maxQueueSize).toBe(50);
      expect(config.requestProcessingInterval).toBe(200);
      expect(config.enableMetrics).toBe(true);
    });

    it('should merge with default configuration', () => {
      // Arrange
      const partialConfig = {
        bufferPercentage: 0.15,
      };

      // Act
      const rateLimiterWithPartialConfig = new HubSpotRateLimiter(partialConfig);
      const config = rateLimiterWithPartialConfig.getConfiguration();

      // Assert
      expect(config.bufferPercentage).toBe(0.15); // Custom value
      expect(config.enableProactiveThrottling).toBe(false); // Default value
      expect(config.maxQueueSize).toBe(100); // Default value
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing rate limit headers gracefully', () => {
      // Arrange
      const emptyHeaders = new Headers();

      // Act & Assert
      expect(() => rateLimiter.updateFromHeaders(emptyHeaders)).not.toThrow();
      
      const status = rateLimiter.getRateLimitStatus();
      expect(status.remaining).toBeGreaterThan(0); // Should maintain default limits
    });

    it('should handle invalid header values', () => {
      // Arrange
      const invalidHeaders = new Headers({
        'X-HubSpot-RateLimit-Remaining': 'invalid',
        'X-HubSpot-RateLimit-Max': 'not-a-number',
      });

      // Act & Assert
      expect(() => rateLimiter.updateFromHeaders(invalidHeaders)).not.toThrow();
      
      const status = rateLimiter.getRateLimitStatus();
      expect(typeof status.remaining).toBe('number');
    });

    it('should handle negative rate limit values', () => {
      // Arrange
      const negativeHeaders = new Headers({
        'X-HubSpot-RateLimit-Remaining': '-5',
        'X-HubSpot-RateLimit-Max': '100',
      });

      // Act
      rateLimiter.updateFromHeaders(negativeHeaders);

      // Assert
      await expect(rateLimiter.checkRateLimit())
        .rejects
        .toThrow(HubSpotRateLimitError);
    });

    it('should handle very large reset intervals', () => {
      // Arrange
      const longIntervalHeaders = new Headers({
        'X-HubSpot-RateLimit-Remaining': '0',
        'X-HubSpot-RateLimit-Interval-Milliseconds': '86400000', // 24 hours
      });

      // Act
      rateLimiter.updateFromHeaders(longIntervalHeaders);

      // Assert
      try {
        await rateLimiter.checkRateLimit();
        fail('Should have thrown rate limit error');
      } catch (error) {
        expect(error).toBeInstanceOf(HubSpotRateLimitError);
        expect((error as HubSpotRateLimitError).retryAfter).toBe(86400); // 24 hours in seconds
      }
    });
  });
});