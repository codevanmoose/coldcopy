import { vi } from 'vitest';
import type { 
  PipedriveConfig, 
  PipedrivePerson, 
  PipedriveDeal, 
  PipedriveActivity,
  PipedriveWebhook,
  PipedriveOrganization,
  PipedriveStage,
  PipedrivePipeline,
  PipedriveUser,
  PipedriveField,
  PipedriveNote
} from '../types';

// Mock Supabase client
export const mockSupabaseClient = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn(),
  data: null,
  error: null,
  auth: {
    getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user-id' } }, error: null })
  }
};

// Mock fetch for API calls
export const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock Redis client
export const mockRedisClient = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  exists: vi.fn(),
  expire: vi.fn(),
  incr: vi.fn(),
  decr: vi.fn(),
  zadd: vi.fn(),
  zrange: vi.fn(),
  zrem: vi.fn(),
  pipeline: vi.fn().mockReturnThis(),
  exec: vi.fn()
};

// Test configuration
export const testConfig: PipedriveConfig = {
  apiKey: 'test-api-key-123',
  baseUrl: 'https://test-company.pipedrive.com/api/v1',
  companyDomain: 'test-company',
  webhookSecret: 'test-webhook-secret',
  rateLimit: {
    maxRequests: 100,
    windowMs: 60000
  },
  syncOptions: {
    batchSize: 50,
    syncInterval: 300000,
    retryAttempts: 3,
    retryDelay: 1000
  }
};

// Mock data generators
export const createMockPerson = (overrides: Partial<PipedrivePerson> = {}): PipedrivePerson => ({
  id: Math.floor(Math.random() * 10000),
  name: 'Test Person',
  email: [{ value: 'test@example.com', primary: true }],
  phone: [{ value: '+1234567890', primary: true }],
  org_id: 1,
  owner_id: 1,
  add_time: new Date().toISOString(),
  update_time: new Date().toISOString(),
  visible_to: '3',
  active_flag: true,
  custom_fields: {},
  ...overrides
});

export const createMockDeal = (overrides: Partial<PipedriveDeal> = {}): PipedriveDeal => ({
  id: Math.floor(Math.random() * 10000),
  title: 'Test Deal',
  value: 10000,
  currency: 'USD',
  person_id: 1,
  org_id: 1,
  pipeline_id: 1,
  stage_id: 1,
  status: 'open',
  add_time: new Date().toISOString(),
  update_time: new Date().toISOString(),
  stage_change_time: new Date().toISOString(),
  active: true,
  deleted: false,
  probability: 50,
  next_activity_date: null,
  next_activity_time: null,
  next_activity_id: null,
  last_activity_date: null,
  last_activity_id: null,
  won_time: null,
  close_time: null,
  lost_time: null,
  owner_id: 1,
  visible_to: '3',
  ...overrides
});

export const createMockActivity = (overrides: Partial<PipedriveActivity> = {}): PipedriveActivity => ({
  id: Math.floor(Math.random() * 10000),
  type: 'email',
  subject: 'Test Activity',
  done: false,
  due_date: new Date().toISOString().split('T')[0],
  due_time: '12:00',
  duration: '00:30',
  person_id: 1,
  org_id: 1,
  deal_id: 1,
  note: 'Test note',
  add_time: new Date().toISOString(),
  update_time: new Date().toISOString(),
  marked_as_done_time: null,
  active_flag: true,
  user_id: 1,
  ...overrides
});

export const createMockOrganization = (overrides: Partial<PipedriveOrganization> = {}): PipedriveOrganization => ({
  id: Math.floor(Math.random() * 10000),
  name: 'Test Organization',
  address: '123 Test St',
  active_flag: true,
  add_time: new Date().toISOString(),
  update_time: new Date().toISOString(),
  visible_to: '3',
  owner_id: 1,
  ...overrides
});

export const createMockPipeline = (overrides: Partial<PipedrivePipeline> = {}): PipedrivePipeline => ({
  id: Math.floor(Math.random() * 10000),
  name: 'Test Pipeline',
  order_nr: 1,
  active: true,
  deal_probability: true,
  add_time: new Date().toISOString(),
  update_time: new Date().toISOString(),
  ...overrides
});

export const createMockStage = (overrides: Partial<PipedriveStage> = {}): PipedriveStage => ({
  id: Math.floor(Math.random() * 10000),
  name: 'Test Stage',
  pipeline_id: 1,
  order_nr: 1,
  active_flag: true,
  deal_probability: 50,
  add_time: new Date().toISOString(),
  update_time: new Date().toISOString(),
  ...overrides
});

export const createMockWebhook = (overrides: Partial<PipedriveWebhook> = {}): PipedriveWebhook => ({
  id: Math.floor(Math.random() * 10000),
  subscription_url: 'https://example.com/webhook',
  event_action: 'added',
  event_object: 'person',
  user_id: 1,
  add_time: new Date().toISOString(),
  update_time: new Date().toISOString(),
  active_flag: true,
  http_auth_user: null,
  http_auth_password: null,
  ...overrides
});

export const createMockUser = (overrides: Partial<PipedriveUser> = {}): PipedriveUser => ({
  id: Math.floor(Math.random() * 10000),
  name: 'Test User',
  email: 'testuser@example.com',
  active_flag: true,
  created: new Date().toISOString(),
  modified: new Date().toISOString(),
  role_id: 1,
  ...overrides
});

export const createMockField = (overrides: Partial<PipedriveField> = {}): PipedriveField => ({
  id: Math.floor(Math.random() * 10000),
  key: 'test_field',
  name: 'Test Field',
  field_type: 'varchar',
  add_time: new Date().toISOString(),
  update_time: new Date().toISOString(),
  active_flag: true,
  edit_flag: true,
  index_visible_flag: true,
  details_visible_flag: true,
  add_visible_flag: true,
  important_flag: false,
  ...overrides
});

export const createMockNote = (overrides: Partial<PipedriveNote> = {}): PipedriveNote => ({
  id: Math.floor(Math.random() * 10000),
  content: 'Test note content',
  person_id: 1,
  org_id: 1,
  deal_id: 1,
  user_id: 1,
  add_time: new Date().toISOString(),
  update_time: new Date().toISOString(),
  active_flag: true,
  pinned_to_person_flag: false,
  pinned_to_organization_flag: false,
  pinned_to_deal_flag: false,
  ...overrides
});

// API response helpers
export const createApiResponse = <T>(data: T, success = true, additionalData = {}) => ({
  success,
  data,
  additional_data: additionalData,
  ...(success ? {} : { error: 'Test error', error_info: 'Test error info' })
});

export const createPaginatedResponse = <T>(
  items: T[], 
  start = 0, 
  limit = 100, 
  moreItemsInCollection = false
) => ({
  success: true,
  data: items,
  additional_data: {
    pagination: {
      start,
      limit,
      more_items_in_collection: moreItemsInCollection,
      next_start: moreItemsInCollection ? start + limit : null
    }
  }
});

// Webhook event helpers
export const createWebhookEvent = (
  eventAction: string,
  eventObject: string,
  data: any
) => ({
  v: 1,
  matches_filters: {
    current: [],
    previous: []
  },
  meta: {
    id: Math.floor(Math.random() * 100000),
    company_id: 123456,
    user_id: 1,
    host: 'test-company.pipedrive.com',
    timestamp: Math.floor(Date.now() / 1000),
    timestamp_micro: Date.now() * 1000,
    permitted_user_ids: [1],
    trans_pending: false,
    is_bulk_update: false,
    pipedrive_service_name: 'webapp',
    matches_filters: {
      current: [],
      previous: []
    },
    webhook_id: 'test-webhook-id'
  },
  current: data,
  previous: null,
  event: `${eventObject}.${eventAction}`,
  retry: 0
});

// Rate limiting helpers
export const simulateRateLimit = (mockFetch: any) => {
  mockFetch.mockResolvedValueOnce({
    status: 429,
    headers: new Map([
      ['X-RateLimit-Limit', '100'],
      ['X-RateLimit-Remaining', '0'],
      ['X-RateLimit-Reset', String(Date.now() / 1000 + 60)]
    ]),
    json: async () => ({ error: 'Rate limit exceeded' })
  });
};

// Error simulation helpers
export const simulateApiError = (mockFetch: any, status = 500, error = 'Internal Server Error') => {
  mockFetch.mockResolvedValueOnce({
    status,
    ok: false,
    json: async () => ({ error, error_info: `HTTP ${status} error` })
  });
};

// OAuth helpers
export const createMockOAuthTokens = () => ({
  access_token: 'test-access-token',
  refresh_token: 'test-refresh-token',
  expires_in: 3600,
  token_type: 'Bearer',
  scope: 'read write'
});

// Bulk operation helpers
export const createBulkItems = <T>(
  count: number, 
  generator: (index: number) => T
): T[] => {
  return Array.from({ length: count }, (_, i) => generator(i));
};

// Conflict detection helpers
export const createConflictScenario = (
  local: any,
  remote: any,
  lastSync: Date
) => ({
  local,
  remote,
  lastSync,
  localUpdateTime: new Date(local.update_time),
  remoteUpdateTime: new Date(remote.update_time),
  hasConflict: new Date(local.update_time) > lastSync && new Date(remote.update_time) > lastSync
});

// Performance testing helpers
export const measurePerformance = async (
  name: string,
  fn: () => Promise<any>
) => {
  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;
  return { result, duration, name };
};

// Mock timers for testing intervals and timeouts
export const useMockTimers = () => {
  vi.useFakeTimers();
  return {
    advanceTime: (ms: number) => vi.advanceTimersByTime(ms),
    runAllTimers: () => vi.runAllTimers(),
    cleanup: () => vi.useRealTimers()
  };
};