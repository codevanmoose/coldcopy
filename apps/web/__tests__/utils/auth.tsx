import { createClient } from '@supabase/supabase-js'
import { faker } from '@faker-js/faker'
import type { User } from '@supabase/supabase-js'

// Mock auth session
export interface MockSession {
  user: User
  access_token: string
  refresh_token: string
}

// Authentication test helpers
export const authHelpers = {
  // Create a mock authenticated user
  createMockUser(overrides: Partial<User> = {}): User {
    return {
      id: faker.string.uuid(),
      email: faker.internet.email(),
      app_metadata: {
        provider: 'email',
        providers: ['email'],
      },
      user_metadata: {
        full_name: faker.person.fullName(),
        avatar_url: faker.image.avatar(),
      },
      aud: 'authenticated',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      role: 'authenticated',
      email_confirmed_at: new Date().toISOString(),
      confirmed_at: new Date().toISOString(),
      ...overrides,
    }
  },

  // Create a mock session
  createMockSession(userOverrides: Partial<User> = {}): MockSession {
    const user = this.createMockUser(userOverrides)
    return {
      user,
      access_token: `mock-access-token-${user.id}`,
      refresh_token: `mock-refresh-token-${user.id}`,
    }
  },

  // Mock Supabase auth client
  createMockAuthClient() {
    const mockSession = this.createMockSession()
    
    return {
      auth: {
        getSession: jest.fn().mockResolvedValue({ 
          data: { session: mockSession }, 
          error: null 
        }),
        getUser: jest.fn().mockResolvedValue({ 
          data: { user: mockSession.user }, 
          error: null 
        }),
        signInWithPassword: jest.fn().mockResolvedValue({ 
          data: { user: mockSession.user, session: mockSession }, 
          error: null 
        }),
        signUp: jest.fn().mockResolvedValue({ 
          data: { user: mockSession.user, session: mockSession }, 
          error: null 
        }),
        signOut: jest.fn().mockResolvedValue({ error: null }),
        onAuthStateChange: jest.fn().mockReturnValue({
          data: { subscription: { unsubscribe: jest.fn() } },
        }),
        refreshSession: jest.fn().mockResolvedValue({
          data: { session: mockSession },
          error: null,
        }),
      },
    }
  },

  // Create test tokens
  createTestTokens() {
    return {
      accessToken: `test-access-token-${faker.string.alphanumeric(16)}`,
      refreshToken: `test-refresh-token-${faker.string.alphanumeric(16)}`,
      expiresIn: 3600,
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    }
  },

  // Mock authentication context value
  createMockAuthContext(overrides = {}) {
    const user = this.createMockUser()
    const session = this.createMockSession({ id: user.id })
    
    return {
      user,
      session,
      loading: false,
      error: null,
      signIn: jest.fn().mockResolvedValue({ error: null }),
      signUp: jest.fn().mockResolvedValue({ error: null }),
      signOut: jest.fn().mockResolvedValue({ error: null }),
      updateUser: jest.fn().mockResolvedValue({ error: null }),
      ...overrides,
    }
  },

  // Mock workspace context
  createMockWorkspaceContext(overrides = {}) {
    const workspaceId = faker.string.uuid()
    
    return {
      currentWorkspace: {
        id: workspaceId,
        name: faker.company.name(),
        owner_id: faker.string.uuid(),
        settings: {
          timezone: 'UTC',
          daily_send_limit: 100,
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      workspaces: [],
      loading: false,
      error: null,
      switchWorkspace: jest.fn().mockResolvedValue(true),
      createWorkspace: jest.fn().mockResolvedValue({ error: null }),
      updateWorkspace: jest.fn().mockResolvedValue({ error: null }),
      deleteWorkspace: jest.fn().mockResolvedValue({ error: null }),
      ...overrides,
    }
  },

  // Helper to set up authenticated test environment
  async setupAuthenticatedTest() {
    const user = this.createMockUser()
    const session = this.createMockSession({ id: user.id })
    const supabase = this.createMockAuthClient()
    
    // Mock the auth hooks
    const useUser = jest.fn().mockReturnValue({ user, loading: false, error: null })
    const useSession = jest.fn().mockReturnValue({ session, loading: false, error: null })
    
    return {
      user,
      session,
      supabase,
      useUser,
      useSession,
    }
  },

  // Helper for testing protected routes
  createProtectedRouteWrapper(children: React.ReactNode, authContext = {}) {
    const MockAuthProvider = ({ children }: { children: React.ReactNode }) => {
      const value = this.createMockAuthContext(authContext)
      return children
    }
    
    return <MockAuthProvider>{children}</MockAuthProvider>
  },

  // Mock permissions
  createMockPermissions(overrides = {}) {
    return {
      canViewDashboard: true,
      canManageCampaigns: true,
      canManageLeads: true,
      canManageTeam: false,
      canManageBilling: false,
      canAccessAdmin: false,
      ...overrides,
    }
  },

  // Test different user roles
  createUserWithRole(role: 'owner' | 'admin' | 'member' | 'viewer') {
    const permissions = {
      owner: {
        canViewDashboard: true,
        canManageCampaigns: true,
        canManageLeads: true,
        canManageTeam: true,
        canManageBilling: true,
        canAccessAdmin: true,
      },
      admin: {
        canViewDashboard: true,
        canManageCampaigns: true,
        canManageLeads: true,
        canManageTeam: true,
        canManageBilling: false,
        canAccessAdmin: false,
      },
      member: {
        canViewDashboard: true,
        canManageCampaigns: true,
        canManageLeads: true,
        canManageTeam: false,
        canManageBilling: false,
        canAccessAdmin: false,
      },
      viewer: {
        canViewDashboard: true,
        canManageCampaigns: false,
        canManageLeads: false,
        canManageTeam: false,
        canManageBilling: false,
        canAccessAdmin: false,
      },
    }
    
    return {
      user: this.createMockUser({ 
        user_metadata: { role } 
      }),
      permissions: permissions[role],
    }
  },
}

// Mock authentication hooks
export const mockUseUser = () => {
  const user = authHelpers.createMockUser()
  return { user, loading: false, error: null }
}

export const mockUseSession = () => {
  const session = authHelpers.createMockSession()
  return { session, loading: false, error: null }
}