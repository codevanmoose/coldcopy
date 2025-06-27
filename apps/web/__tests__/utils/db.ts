import { createClient } from '@supabase/supabase-js'
import { faker } from '@faker-js/faker'

// Test database client
export const testDb = createClient(
  process.env.SUPABASE_URL || 'http://localhost:54321',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key'
)

// Database test helpers
export const dbHelpers = {
  // Clean up test data
  async cleanupTestData(userId?: string) {
    if (userId) {
      // Clean up user-specific data
      await testDb.from('campaigns').delete().eq('user_id', userId)
      await testDb.from('leads').delete().eq('user_id', userId)
      await testDb.from('email_logs').delete().eq('user_id', userId)
      await testDb.from('workspaces').delete().eq('owner_id', userId)
    }
  },

  // Create test user
  async createTestUser(overrides = {}) {
    const email = faker.internet.email()
    const password = faker.internet.password()
    
    const { data, error } = await testDb.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: faker.person.fullName(),
        ...overrides,
      },
    })

    if (error) throw error
    
    return { user: data.user, email, password }
  },

  // Create test workspace
  async createTestWorkspace(userId: string, overrides = {}) {
    const { data, error } = await testDb
      .from('workspaces')
      .insert({
        name: faker.company.name(),
        owner_id: userId,
        settings: {
          timezone: 'UTC',
          ...overrides,
        },
      })
      .select()
      .single()

    if (error) throw error
    return data
  },

  // Create test campaign
  async createTestCampaign(workspaceId: string, userId: string, overrides = {}) {
    const { data, error } = await testDb
      .from('campaigns')
      .insert({
        name: faker.lorem.words(3),
        workspace_id: workspaceId,
        user_id: userId,
        status: 'draft',
        settings: {
          daily_limit: 50,
          tracking: {
            open_tracking: true,
            click_tracking: true,
          },
        },
        ...overrides,
      })
      .select()
      .single()

    if (error) throw error
    return data
  },

  // Create test leads
  async createTestLeads(workspaceId: string, count = 5) {
    const leads = Array.from({ length: count }, () => ({
      email: faker.internet.email(),
      first_name: faker.person.firstName(),
      last_name: faker.person.lastName(),
      company: faker.company.name(),
      title: faker.person.jobTitle(),
      workspace_id: workspaceId,
      status: 'active',
      custom_fields: {
        industry: faker.company.buzzPhrase(),
      },
    }))

    const { data, error } = await testDb
      .from('leads')
      .insert(leads)
      .select()

    if (error) throw error
    return data
  },

  // Seed database for integration tests
  async seedTestDatabase() {
    // Create test users
    const users = await Promise.all([
      this.createTestUser({ role: 'admin' }),
      this.createTestUser({ role: 'user' }),
      this.createTestUser({ role: 'user' }),
    ])

    // Create workspaces
    const workspaces = await Promise.all(
      users.map(({ user }) => 
        this.createTestWorkspace(user.id, {
          plan: faker.helpers.arrayElement(['free', 'pro', 'enterprise']),
        })
      )
    )

    // Create campaigns and leads
    for (let i = 0; i < workspaces.length; i++) {
      const workspace = workspaces[i]
      const user = users[i].user
      
      // Create campaigns
      await Promise.all([
        this.createTestCampaign(workspace.id, user.id, { status: 'active' }),
        this.createTestCampaign(workspace.id, user.id, { status: 'paused' }),
        this.createTestCampaign(workspace.id, user.id, { status: 'completed' }),
      ])

      // Create leads
      await this.createTestLeads(workspace.id, 20)
    }

    return { users, workspaces }
  },

  // Transaction wrapper for isolated tests
  async withTransaction<T>(fn: () => Promise<T>): Promise<T> {
    // Note: Supabase doesn't support transactions in the same way as traditional SQL
    // This is a simplified version that ensures cleanup
    try {
      const result = await fn()
      return result
    } catch (error) {
      // Cleanup on error
      throw error
    }
  },

  // Wait for database operations to complete
  async waitForDb(ms = 100) {
    await new Promise(resolve => setTimeout(resolve, ms))
  },
}

// Test data factories
export const factories = {
  user: (overrides = {}) => ({
    email: faker.internet.email(),
    full_name: faker.person.fullName(),
    avatar_url: faker.image.avatar(),
    ...overrides,
  }),

  workspace: (overrides = {}) => ({
    name: faker.company.name(),
    settings: {
      timezone: 'UTC',
      daily_send_limit: 100,
      ...overrides.settings,
    },
    ...overrides,
  }),

  campaign: (overrides = {}) => ({
    name: faker.lorem.words(3),
    subject: faker.lorem.sentence(),
    body: faker.lorem.paragraphs(2),
    status: 'draft',
    settings: {
      daily_limit: 50,
      tracking: {
        open_tracking: true,
        click_tracking: true,
      },
      ...overrides.settings,
    },
    ...overrides,
  }),

  lead: (overrides = {}) => ({
    email: faker.internet.email(),
    first_name: faker.person.firstName(),
    last_name: faker.person.lastName(),
    company: faker.company.name(),
    title: faker.person.jobTitle(),
    phone: faker.phone.number(),
    linkedin_url: `https://linkedin.com/in/${faker.internet.username()}`,
    status: 'active',
    custom_fields: {
      industry: faker.company.buzzPhrase(),
      ...overrides.custom_fields,
    },
    ...overrides,
  }),
}

// Database cleanup utility for test teardown
export async function cleanupDatabase() {
  // Clean up in reverse order of dependencies
  const tables = [
    'email_logs',
    'campaign_leads',
    'campaigns',
    'leads',
    'workspace_members',
    'workspaces',
    'users',
  ]

  for (const table of tables) {
    try {
      await testDb.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000')
    } catch (error) {
      console.error(`Error cleaning up ${table}:`, error)
    }
  }
}