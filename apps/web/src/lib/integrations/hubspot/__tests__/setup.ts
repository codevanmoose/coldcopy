import '@testing-library/jest-dom';

// Mock environment variables
process.env.HUBSPOT_CLIENT_ID = 'test-client-id';
process.env.HUBSPOT_CLIENT_SECRET = 'test-client-secret';
process.env.HUBSPOT_REDIRECT_URI = 'https://app.coldcopy.com/api/integrations/hubspot/callback';
process.env.HUBSPOT_WEBHOOK_SECRET = 'test-webhook-secret';
process.env.NEXT_PUBLIC_APP_URL = 'https://app.coldcopy.com';

// Mock global fetch if not available
if (!global.fetch) {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
      text: () => Promise.resolve(''),
      headers: new Headers(),
    })
  ) as jest.Mock;
}

// Mock AbortController if not available
if (!global.AbortController) {
  global.AbortController = class AbortController {
    signal = {
      aborted: false,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    };
    abort = jest.fn();
  } as any;
}

// Mock Headers if not available
if (!global.Headers) {
  global.Headers = class Headers {
    private headers: Record<string, string> = {};

    constructor(init?: HeadersInit) {
      if (init) {
        if (Array.isArray(init)) {
          init.forEach(([key, value]) => {
            this.headers[key.toLowerCase()] = value;
          });
        } else if (init instanceof Headers) {
          // Copy from another Headers instance
          (init as any).forEach((value: string, key: string) => {
            this.headers[key.toLowerCase()] = value;
          });
        } else {
          // Object with key-value pairs
          Object.entries(init).forEach(([key, value]) => {
            this.headers[key.toLowerCase()] = value;
          });
        }
      }
    }

    get(key: string): string | null {
      return this.headers[key.toLowerCase()] || null;
    }

    set(key: string, value: string): void {
      this.headers[key.toLowerCase()] = value;
    }

    has(key: string): boolean {
      return key.toLowerCase() in this.headers;
    }

    delete(key: string): void {
      delete this.headers[key.toLowerCase()];
    }

    forEach(callback: (value: string, key: string) => void): void {
      Object.entries(this.headers).forEach(([key, value]) => {
        callback(value, key);
      });
    }

    *[Symbol.iterator](): IterableIterator<[string, string]> {
      for (const [key, value] of Object.entries(this.headers)) {
        yield [key, value];
      }
    }
  } as any;
}

// Mock Request and Response if not available
if (!global.Request) {
  global.Request = class Request {
    url: string;
    method: string;
    headers: Headers;
    body: any;

    constructor(url: string, init?: RequestInit) {
      this.url = url;
      this.method = init?.method || 'GET';
      this.headers = new Headers(init?.headers);
      this.body = init?.body;
    }

    text(): Promise<string> {
      return Promise.resolve(this.body || '');
    }

    json(): Promise<any> {
      return Promise.resolve(JSON.parse(this.body || '{}'));
    }
  } as any;
}

if (!global.Response) {
  global.Response = class Response {
    ok: boolean;
    status: number;
    headers: Headers;
    body: any;

    constructor(body?: any, init?: ResponseInit) {
      this.body = body;
      this.status = init?.status || 200;
      this.ok = this.status >= 200 && this.status < 300;
      this.headers = new Headers(init?.headers);
    }

    text(): Promise<string> {
      return Promise.resolve(this.body || '');
    }

    json(): Promise<any> {
      return Promise.resolve(typeof this.body === 'string' ? JSON.parse(this.body) : this.body);
    }
  } as any;
}

// Mock crypto for webhook signature verification
if (!global.crypto) {
  const crypto = require('crypto');
  global.crypto = {
    ...crypto,
    createHmac: crypto.createHmac,
  } as any;
}

// Suppress console warnings in tests unless specifically testing them
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

beforeEach(() => {
  console.warn = jest.fn();
  console.error = jest.fn();
});

afterEach(() => {
  console.warn = originalConsoleWarn;
  console.error = originalConsoleError;
  jest.clearAllMocks();
});

// Global test helpers
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidUUID(): R;
      toBeValidEmail(): R;
      toBeValidUrl(): R;
      toBeValidTimestamp(): R;
    }
  }
}

// Custom Jest matchers
expect.extend({
  toBeValidUUID(received: string) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const pass = uuidRegex.test(received);
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid UUID`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid UUID`,
        pass: false,
      };
    }
  },

  toBeValidEmail(received: string) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const pass = emailRegex.test(received);
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid email`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid email`,
        pass: false,
      };
    }
  },

  toBeValidUrl(received: string) {
    try {
      new URL(received);
      return {
        message: () => `expected ${received} not to be a valid URL`,
        pass: true,
      };
    } catch {
      return {
        message: () => `expected ${received} to be a valid URL`,
        pass: false,
      };
    }
  },

  toBeValidTimestamp(received: string) {
    const timestamp = new Date(received);
    const pass = !isNaN(timestamp.getTime());
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid timestamp`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid timestamp`,
        pass: false,
      };
    }
  },
});

// Test data factories
export const createMockContact = (overrides: Partial<any> = {}) => ({
  id: 'contact-123',
  properties: {
    email: 'test@example.com',
    firstname: 'Test',
    lastname: 'User',
    createdate: '2024-01-15T10:00:00Z',
    lastmodifieddate: '2024-01-15T10:00:00Z',
    ...overrides.properties,
  },
  createdAt: '2024-01-15T10:00:00Z',
  updatedAt: '2024-01-15T10:00:00Z',
  ...overrides,
});

export const createMockLead = (overrides: Partial<any> = {}) => ({
  id: 'lead-123',
  email: 'test@example.com',
  first_name: 'Test',
  last_name: 'User',
  company: 'Test Company',
  phone: '+1234567890',
  workspace_id: 'workspace-123',
  created_at: '2024-01-15T10:00:00Z',
  updated_at: '2024-01-15T10:00:00Z',
  enrichment_data: {},
  ...overrides,
});

export const createMockIntegration = (overrides: Partial<any> = {}) => ({
  id: 'integration-123',
  workspace_id: 'workspace-123',
  hub_id: '12345',
  access_token: 'encrypted-access-token',
  refresh_token: 'encrypted-refresh-token',
  expires_at: new Date(Date.now() + 3600000),
  scopes: ['crm.objects.contacts.read', 'crm.objects.contacts.write'],
  created_at: new Date('2024-01-15T10:00:00Z'),
  updated_at: new Date('2024-01-15T10:00:00Z'),
  ...overrides,
});

export const createMockWebhookEvent = (overrides: Partial<any> = {}) => ({
  eventId: 'event-123',
  subscriptionType: 'contact.creation',
  portalId: 12345,
  occurredAt: '2024-01-15T10:00:00Z',
  subscriptionId: 1,
  attemptNumber: 1,
  objectId: 'contact-123',
  changeSource: 'CRM_UI',
  ...overrides,
});

export const createMockFieldMapping = (overrides: Partial<any> = {}) => ({
  id: 'mapping-123',
  workspace_id: 'workspace-123',
  coldcopy_field: 'first_name',
  hubspot_property: 'firstname',
  direction: 'bidirectional',
  transform_function: null,
  created_at: new Date('2024-01-15T10:00:00Z'),
  ...overrides,
});

// Utility functions for tests
export const waitFor = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

export const mockSuccessResponse = (data: any, status = 200) => ({
  ok: true,
  status,
  json: async () => data,
  text: async () => JSON.stringify(data),
  headers: new Headers(),
});

export const mockErrorResponse = (error: any, status = 400) => ({
  ok: false,
  status,
  json: async () => error,
  text: async () => JSON.stringify(error),
  headers: new Headers(),
});

export const mockRateLimitResponse = (retryAfter = 60) => ({
  ok: false,
  status: 429,
  json: async () => ({
    status: 'error',
    message: 'Rate limit exceeded',
    category: 'RATE_LIMITS',
  }),
  headers: new Headers({
    'Retry-After': retryAfter.toString(),
    'X-HubSpot-RateLimit-Remaining': '0',
  }),
});

// Export test utilities
export * from '@testing-library/jest-dom';
export { jest } from '@jest/globals';