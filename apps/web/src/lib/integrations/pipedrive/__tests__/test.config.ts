import type { PipedriveConfig } from '../types';

// Test environment configuration
export const TEST_ENV = {
  PIPEDRIVE_API_KEY: 'test-api-key-123',
  PIPEDRIVE_WEBHOOK_SECRET: 'test-webhook-secret',
  PIPEDRIVE_COMPANY_DOMAIN: 'test-company',
  SUPABASE_URL: 'http://localhost:54321',
  SUPABASE_ANON_KEY: 'test-anon-key',
  REDIS_URL: 'redis://localhost:6379',
  NODE_ENV: 'test'
};

// Test configuration presets
export const testConfigs = {
  default: {
    apiKey: TEST_ENV.PIPEDRIVE_API_KEY,
    baseUrl: `https://${TEST_ENV.PIPEDRIVE_COMPANY_DOMAIN}.pipedrive.com/api/v1`,
    companyDomain: TEST_ENV.PIPEDRIVE_COMPANY_DOMAIN,
    webhookSecret: TEST_ENV.PIPEDRIVE_WEBHOOK_SECRET,
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
  } as PipedriveConfig,

  highVolume: {
    apiKey: TEST_ENV.PIPEDRIVE_API_KEY,
    baseUrl: `https://${TEST_ENV.PIPEDRIVE_COMPANY_DOMAIN}.pipedrive.com/api/v1`,
    companyDomain: TEST_ENV.PIPEDRIVE_COMPANY_DOMAIN,
    webhookSecret: TEST_ENV.PIPEDRIVE_WEBHOOK_SECRET,
    rateLimit: {
      maxRequests: 1000,
      windowMs: 60000
    },
    syncOptions: {
      batchSize: 200,
      syncInterval: 60000,
      retryAttempts: 5,
      retryDelay: 2000
    }
  } as PipedriveConfig,

  lowLatency: {
    apiKey: TEST_ENV.PIPEDRIVE_API_KEY,
    baseUrl: `https://${TEST_ENV.PIPEDRIVE_COMPANY_DOMAIN}.pipedrive.com/api/v1`,
    companyDomain: TEST_ENV.PIPEDRIVE_COMPANY_DOMAIN,
    webhookSecret: TEST_ENV.PIPEDRIVE_WEBHOOK_SECRET,
    rateLimit: {
      maxRequests: 50,
      windowMs: 60000
    },
    syncOptions: {
      batchSize: 10,
      syncInterval: 10000,
      retryAttempts: 2,
      retryDelay: 500
    }
  } as PipedriveConfig
};

// Test data presets
export const testData = {
  workspace: {
    id: 'test-workspace-id',
    name: 'Test Workspace',
    settings: {
      pipedrive: {
        enabled: true,
        config: testConfigs.default
      }
    }
  },

  user: {
    id: 'test-user-id',
    email: 'test@example.com',
    workspace_id: 'test-workspace-id'
  },

  customFields: {
    person: [
      { key: 'lead_source', name: 'Lead Source', field_type: 'varchar' },
      { key: 'lead_score', name: 'Lead Score', field_type: 'double' },
      { key: 'last_contacted', name: 'Last Contacted', field_type: 'date' }
    ],
    deal: [
      { key: 'campaign_id', name: 'Campaign ID', field_type: 'varchar' },
      { key: 'email_engagement', name: 'Email Engagement', field_type: 'double' },
      { key: 'qualified_date', name: 'Qualified Date', field_type: 'date' }
    ],
    organization: [
      { key: 'industry', name: 'Industry', field_type: 'varchar' },
      { key: 'company_size', name: 'Company Size', field_type: 'int' }
    ]
  },

  pipelines: [
    {
      id: 1,
      name: 'Sales Pipeline',
      stages: [
        { id: 1, name: 'Lead', order_nr: 1, deal_probability: 10 },
        { id: 2, name: 'Qualified', order_nr: 2, deal_probability: 30 },
        { id: 3, name: 'Proposal', order_nr: 3, deal_probability: 60 },
        { id: 4, name: 'Negotiation', order_nr: 4, deal_probability: 80 },
        { id: 5, name: 'Won', order_nr: 5, deal_probability: 100 },
        { id: 6, name: 'Lost', order_nr: 6, deal_probability: 0 }
      ]
    },
    {
      id: 2,
      name: 'Outreach Pipeline',
      stages: [
        { id: 7, name: 'Cold', order_nr: 1, deal_probability: 5 },
        { id: 8, name: 'Contacted', order_nr: 2, deal_probability: 15 },
        { id: 9, name: 'Engaged', order_nr: 3, deal_probability: 40 },
        { id: 10, name: 'Meeting Scheduled', order_nr: 4, deal_probability: 70 }
      ]
    }
  ],

  activityTypes: [
    { id: 1, name: 'Call', icon_key: 'call' },
    { id: 2, name: 'Meeting', icon_key: 'meeting' },
    { id: 3, name: 'Email', icon_key: 'email' },
    { id: 4, name: 'Task', icon_key: 'task' },
    { id: 5, name: 'Deadline', icon_key: 'deadline' },
    { id: 6, name: 'Follow-up', icon_key: 'follow_up' }
  ],

  webhookEvents: [
    'person.added',
    'person.updated',
    'person.deleted',
    'person.merged',
    'deal.added',
    'deal.updated',
    'deal.deleted',
    'deal.merged',
    'activity.added',
    'activity.updated',
    'activity.deleted',
    'note.added',
    'note.updated',
    'note.deleted',
    'organization.added',
    'organization.updated',
    'organization.deleted'
  ]
};

// Test timeouts
export const testTimeouts = {
  unit: 5000,        // 5 seconds for unit tests
  integration: 30000, // 30 seconds for integration tests
  e2e: 60000,        // 60 seconds for end-to-end tests
  performance: 120000 // 2 minutes for performance tests
};

// Mock server endpoints
export const mockServerEndpoints = {
  persons: '/persons',
  deals: '/deals',
  activities: '/activities',
  organizations: '/organizations',
  pipelines: '/pipelines',
  stages: '/stages',
  users: '/users',
  webhooks: '/webhooks',
  notes: '/notes',
  fields: '/:objectType/fields'
};

// Test user scenarios
export const testScenarios = {
  smallBusiness: {
    personCount: 100,
    dealCount: 50,
    activityCount: 200,
    syncInterval: 'daily'
  },
  enterprise: {
    personCount: 10000,
    dealCount: 5000,
    activityCount: 50000,
    syncInterval: 'hourly'
  },
  highVolume: {
    personCount: 100000,
    dealCount: 50000,
    activityCount: 500000,
    syncInterval: 'realtime'
  }
};

// Performance benchmarks
export const performanceBenchmarks = {
  apiCall: {
    p50: 200,   // 50th percentile: 200ms
    p95: 500,   // 95th percentile: 500ms
    p99: 1000   // 99th percentile: 1s
  },
  bulkSync: {
    itemsPerSecond: 100,
    maxMemoryMB: 512,
    maxConcurrentRequests: 10
  },
  webhookProcessing: {
    maxLatencyMs: 100,
    maxQueueSize: 1000,
    maxRetries: 3
  }
};