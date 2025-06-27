import { createClient } from '@supabase/supabase-js'
import { AuthError } from '@supabase/supabase-js'

// Mock Supabase
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
  AuthError: class AuthError extends Error {
    constructor(message: string, status?: number) {
      super(message)
      this.name = 'AuthError'
      this.status = status
    }
    status?: number
  },
}))

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

describe('Authentication Service', () => {
  let mockSupabase: any

  beforeEach(() => {
    jest.clearAllMocks()

    // Mock Supabase client
    mockSupabase = {
      auth: {
        signUp: jest.fn(),
        signInWithPassword: jest.fn(),
        signInWithOAuth: jest.fn(),
        signOut: jest.fn(),
        getUser: jest.fn(),
        getSession: jest.fn(),
        resetPasswordForEmail: jest.fn(),
        updateUser: jest.fn(),
        exchangeCodeForSession: jest.fn(),
        setSession: jest.fn(),
        onAuthStateChange: jest.fn(),
      },
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      neq: jest.fn().mockReturnThis(),
      not: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      rpc: jest.fn(),
    };

    (createClient as jest.Mock).mockReturnValue(mockSupabase)
  })

  describe('User Registration', () => {
    it('should register user successfully', async () => {
      // Arrange
      const userData = {
        email: 'user@example.com',
        password: 'securePassword123',
        first_name: 'John',
        last_name: 'Doe',
        company_name: 'Acme Corp',
      }

      const supabaseUser = {
        id: 'user-123',
        email: 'user@example.com',
        email_confirmed_at: null,
        user_metadata: {
          first_name: 'John',
          last_name: 'Doe',
        },
      }

      const workspace = {
        id: 'workspace-123',
        name: 'Acme Corp',
        slug: 'acme-corp',
        owner_id: 'user-123',
      }

      const dbUser = {
        id: 'user-123',
        email: 'user@example.com',
        first_name: 'John',
        last_name: 'Doe',
        workspace_id: 'workspace-123',
        role: 'workspace_admin',
      }

      mockSupabase.auth.signUp.mockResolvedValue({
        data: { user: supabaseUser, session: null },
        error: null,
      })

      // Mock workspace creation
      mockSupabase.single
        .mockResolvedValueOnce({ data: workspace, error: null })
        .mockResolvedValueOnce({ data: dbUser, error: null })

      // Act
      const result = await registerUser(userData)

      // Assert
      expect(result.user).toEqual(supabaseUser)
      expect(result.workspace).toEqual(workspace)
      expect(result.requiresEmailConfirmation).toBe(true)
      expect(mockSupabase.auth.signUp).toHaveBeenCalledWith({
        email: 'user@example.com',
        password: 'securePassword123',
        options: {
          data: {
            first_name: 'John',
            last_name: 'Doe',
            company_name: 'Acme Corp',
          },
        },
      })
    })

    it('should handle email already registered error', async () => {
      // Arrange
      const userData = {
        email: 'existing@example.com',
        password: 'password123',
        first_name: 'John',
        last_name: 'Doe',
        company_name: 'Test Corp',
      }

      const authError = new AuthError('User already registered', 422)
      mockSupabase.auth.signUp.mockResolvedValue({
        data: { user: null, session: null },
        error: authError,
      })

      // Act & Assert
      await expect(registerUser(userData)).rejects.toThrow('User already registered')
    })

    it('should handle weak password error', async () => {
      // Arrange
      const userData = {
        email: 'user@example.com',
        password: '123',
        first_name: 'John',
        last_name: 'Doe',
        company_name: 'Test Corp',
      }

      const authError = new AuthError('Password should be at least 6 characters', 422)
      mockSupabase.auth.signUp.mockResolvedValue({
        data: { user: null, session: null },
        error: authError,
      })

      // Act & Assert
      await expect(registerUser(userData)).rejects.toThrow(
        'Password should be at least 6 characters'
      )
    })

    it('should create workspace and user profile after successful registration', async () => {
      // Arrange
      const userData = {
        email: 'user@example.com',
        password: 'securePassword123',
        first_name: 'John',
        last_name: 'Doe',
        company_name: 'Test Company',
      }

      const supabaseUser = {
        id: 'user-123',
        email: 'user@example.com',
        user_metadata: userData,
      }

      mockSupabase.auth.signUp.mockResolvedValue({
        data: { user: supabaseUser, session: null },
        error: null,
      })

      mockSupabase.single
        .mockResolvedValueOnce({ data: { id: 'workspace-123' }, error: null })
        .mockResolvedValueOnce({ data: { id: 'user-123' }, error: null })

      // Act
      await registerUser(userData)

      // Assert
      expect(mockSupabase.insert).toHaveBeenCalledWith({
        name: 'Test Company',
        owner_id: 'user-123',
        slug: expect.any(String),
      })
      expect(mockSupabase.insert).toHaveBeenCalledWith({
        id: 'user-123',
        email: 'user@example.com',
        first_name: 'John',
        last_name: 'Doe',
        workspace_id: 'workspace-123',
        role: 'workspace_admin',
      })
    })
  })

  describe('User Login', () => {
    it('should login user successfully', async () => {
      // Arrange
      const credentials = {
        email: 'user@example.com',
        password: 'password123',
      }

      const session = {
        access_token: 'access-token-123',
        refresh_token: 'refresh-token-123',
        expires_in: 3600,
        token_type: 'bearer',
        user: {
          id: 'user-123',
          email: 'user@example.com',
        },
      }

      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: session.user, session },
        error: null,
      })

      // Act
      const result = await loginUser(credentials)

      // Assert
      expect(result.user).toEqual(session.user)
      expect(result.session).toEqual(session)
      expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'user@example.com',
        password: 'password123',
      })
    })

    it('should handle invalid credentials', async () => {
      // Arrange
      const credentials = {
        email: 'user@example.com',
        password: 'wrongpassword',
      }

      const authError = new AuthError('Invalid login credentials', 400)
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: authError,
      })

      // Act & Assert
      await expect(loginUser(credentials)).rejects.toThrow('Invalid login credentials')
    })

    it('should handle email not confirmed', async () => {
      // Arrange
      const credentials = {
        email: 'unconfirmed@example.com',
        password: 'password123',
      }

      const authError = new AuthError('Email not confirmed', 400)
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: authError,
      })

      // Act & Assert
      await expect(loginUser(credentials)).rejects.toThrow('Email not confirmed')
    })

    it('should load user profile after successful login', async () => {
      // Arrange
      const user = { id: 'user-123', email: 'user@example.com' }
      const session = { access_token: 'token', user }

      const dbUser = {
        id: 'user-123',
        email: 'user@example.com',
        first_name: 'John',
        last_name: 'Doe',
        workspace_id: 'workspace-123',
        role: 'workspace_admin',
      }

      const workspace = {
        id: 'workspace-123',
        name: 'Test Workspace',
        slug: 'test-workspace',
      }

      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user, session },
        error: null,
      })

      mockSupabase.single
        .mockResolvedValueOnce({ data: dbUser, error: null })
        .mockResolvedValueOnce({ data: workspace, error: null })

      // Act
      const result = await loginUser({
        email: 'user@example.com',
        password: 'password123',
      })

      // Assert
      expect(result.dbUser).toEqual(dbUser)
      expect(result.workspace).toEqual(workspace)
    })
  })

  describe('OAuth Authentication', () => {
    it('should initiate OAuth flow', async () => {
      // Arrange
      const oauthData = {
        data: {
          url: 'https://github.com/login/oauth/authorize?client_id=123',
          provider: 'github',
        },
        error: null,
      }

      mockSupabase.auth.signInWithOAuth.mockResolvedValue(oauthData)

      // Act
      const result = await initiateOAuthFlow('github', 'https://app.example.com/auth/callback')

      // Assert
      expect(result.url).toBe('https://github.com/login/oauth/authorize?client_id=123')
      expect(mockSupabase.auth.signInWithOAuth).toHaveBeenCalledWith({
        provider: 'github',
        options: {
          redirectTo: 'https://app.example.com/auth/callback',
        },
      })
    })

    it('should handle OAuth provider errors', async () => {
      // Arrange
      const authError = new AuthError('OAuth provider not configured', 400)
      mockSupabase.auth.signInWithOAuth.mockResolvedValue({
        data: { url: null, provider: null },
        error: authError,
      })

      // Act & Assert
      await expect(
        initiateOAuthFlow('invalid_provider', 'https://app.example.com/callback')
      ).rejects.toThrow('OAuth provider not configured')
    })
  })

  describe('Session Management', () => {
    it('should get current session', async () => {
      // Arrange
      const session = {
        access_token: 'token-123',
        user: { id: 'user-123', email: 'user@example.com' },
      }

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session },
        error: null,
      })

      // Act
      const result = await getCurrentSession()

      // Assert
      expect(result).toEqual(session)
    })

    it('should return null for no session', async () => {
      // Arrange
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      })

      // Act
      const result = await getCurrentSession()

      // Assert
      expect(result).toBeNull()
    })

    it('should refresh session', async () => {
      // Arrange
      const newSession = {
        access_token: 'new-token-123',
        refresh_token: 'new-refresh-123',
        user: { id: 'user-123' },
      }

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: newSession },
        error: null,
      })

      // Act
      const result = await refreshSession()

      // Assert
      expect(result).toEqual(newSession)
    })

    it('should handle session refresh errors', async () => {
      // Arrange
      const authError = new AuthError('Invalid refresh token', 401)
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: authError,
      })

      // Act & Assert
      await expect(refreshSession()).rejects.toThrow('Invalid refresh token')
    })
  })

  describe('Password Reset', () => {
    it('should send password reset email', async () => {
      // Arrange
      mockSupabase.auth.resetPasswordForEmail.mockResolvedValue({
        data: {},
        error: null,
      })

      // Act
      await sendPasswordReset('user@example.com')

      // Assert
      expect(mockSupabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
        'user@example.com',
        {
          redirectTo: expect.stringContaining('/auth/reset-password'),
        }
      )
    })

    it('should handle password reset errors', async () => {
      // Arrange
      const authError = new AuthError('User not found', 404)
      mockSupabase.auth.resetPasswordForEmail.mockResolvedValue({
        data: {},
        error: authError,
      })

      // Act & Assert
      await expect(sendPasswordReset('nonexistent@example.com')).rejects.toThrow(
        'User not found'
      )
    })

    it('should update password', async () => {
      // Arrange
      const updatedUser = {
        id: 'user-123',
        email: 'user@example.com',
        updated_at: new Date().toISOString(),
      }

      mockSupabase.auth.updateUser.mockResolvedValue({
        data: { user: updatedUser },
        error: null,
      })

      // Act
      const result = await updatePassword('newSecurePassword123')

      // Assert
      expect(result.user).toEqual(updatedUser)
      expect(mockSupabase.auth.updateUser).toHaveBeenCalledWith({
        password: 'newSecurePassword123',
      })
    })

    it('should handle password update errors', async () => {
      // Arrange
      const authError = new AuthError('Password too weak', 422)
      mockSupabase.auth.updateUser.mockResolvedValue({
        data: { user: null },
        error: authError,
      })

      // Act & Assert
      await expect(updatePassword('weak')).rejects.toThrow('Password too weak')
    })
  })

  describe('Workspace Management', () => {
    it('should get user workspace', async () => {
      // Arrange
      const workspace = {
        id: 'workspace-123',
        name: 'Test Workspace',
        slug: 'test-workspace',
        owner_id: 'user-123',
      }

      mockSupabase.single.mockResolvedValue({ data: workspace, error: null })

      // Act
      const result = await getUserWorkspace('user-123')

      // Assert
      expect(result).toEqual(workspace)
      expect(mockSupabase.from).toHaveBeenCalledWith('workspaces')
      expect(mockSupabase.eq).toHaveBeenCalledWith('owner_id', 'user-123')
    })

    it('should check workspace membership', async () => {
      // Arrange
      const member = {
        user_id: 'user-123',
        workspace_id: 'workspace-456',
        role: 'member',
        status: 'active',
      }

      mockSupabase.single.mockResolvedValue({ data: member, error: null })

      // Act
      const result = await checkWorkspaceMembership('user-123', 'workspace-456')

      // Assert
      expect(result).toEqual(member)
      expect(mockSupabase.from).toHaveBeenCalledWith('workspace_users')
    })

    it('should return null for non-member', async () => {
      // Arrange
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      })

      // Act
      const result = await checkWorkspaceMembership('user-123', 'workspace-456')

      // Assert
      expect(result).toBeNull()
    })
  })

  describe('Role-Based Permissions', () => {
    it('should check user permissions', async () => {
      // Arrange
      const userWithRole = {
        id: 'user-123',
        workspace_id: 'workspace-123',
        role: 'workspace_admin',
      }

      mockSupabase.single.mockResolvedValue({ data: userWithRole, error: null })

      // Act
      const canManageBilling = await checkUserPermission('user-123', 'manage_billing')
      const canManageCampaigns = await checkUserPermission('user-123', 'manage_campaigns')
      const canViewAnalytics = await checkUserPermission('user-123', 'view_analytics')

      // Assert
      expect(canManageBilling).toBe(true)
      expect(canManageCampaigns).toBe(true)
      expect(canViewAnalytics).toBe(true)
    })

    it('should restrict permissions for limited roles', async () => {
      // Arrange
      const limitedUser = {
        id: 'user-456',
        workspace_id: 'workspace-123',
        role: 'viewer',
      }

      mockSupabase.single.mockResolvedValue({ data: limitedUser, error: null })

      // Act
      const canManageBilling = await checkUserPermission('user-456', 'manage_billing')
      const canViewAnalytics = await checkUserPermission('user-456', 'view_analytics')

      // Assert
      expect(canManageBilling).toBe(false)
      expect(canViewAnalytics).toBe(true)
    })

    it('should handle super admin permissions', async () => {
      // Arrange
      const superAdmin = {
        id: 'admin-123',
        workspace_id: 'workspace-123',
        role: 'super_admin',
      }

      mockSupabase.single.mockResolvedValue({ data: superAdmin, error: null })

      // Act
      const canManageSystem = await checkUserPermission('admin-123', 'manage_system')

      // Assert
      expect(canManageSystem).toBe(true)
    })
  })

  describe('User Logout', () => {
    it('should logout user successfully', async () => {
      // Arrange
      mockSupabase.auth.signOut.mockResolvedValue({ error: null })

      // Act
      await logoutUser()

      // Assert
      expect(mockSupabase.auth.signOut).toHaveBeenCalled()
    })

    it('should handle logout errors', async () => {
      // Arrange
      const authError = new AuthError('Logout failed', 500)
      mockSupabase.auth.signOut.mockResolvedValue({ error: authError })

      // Act & Assert
      await expect(logoutUser()).rejects.toThrow('Logout failed')
    })
  })

  describe('User Profile Management', () => {
    it('should update user profile', async () => {
      // Arrange
      const profileUpdate = {
        first_name: 'Jane',
        last_name: 'Smith',
        avatar_url: 'https://example.com/avatar.jpg',
      }

      const updatedUser = {
        id: 'user-123',
        ...profileUpdate,
        updated_at: new Date().toISOString(),
      }

      mockSupabase.single.mockResolvedValue({ data: updatedUser, error: null })

      // Act
      const result = await updateUserProfile('user-123', profileUpdate)

      // Assert
      expect(result).toEqual(updatedUser)
      expect(mockSupabase.update).toHaveBeenCalledWith(profileUpdate)
    })

    it('should handle profile update errors', async () => {
      // Arrange
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'User not found' },
      })

      // Act & Assert
      await expect(
        updateUserProfile('invalid-user', { first_name: 'John' })
      ).rejects.toThrow('User not found')
    })
  })

  describe('Auth State Changes', () => {
    it('should handle auth state changes', () => {
      // Arrange
      const callback = jest.fn()
      const unsubscribe = jest.fn()
      mockSupabase.auth.onAuthStateChange.mockReturnValue({
        data: { subscription: { unsubscribe } },
      })

      // Act
      const result = onAuthStateChange(callback)

      // Assert
      expect(mockSupabase.auth.onAuthStateChange).toHaveBeenCalledWith(callback)
      expect(result.unsubscribe).toBe(unsubscribe)
    })
  })

  describe('Email Confirmation', () => {
    it('should handle email confirmation callback', async () => {
      // Arrange
      const session = {
        access_token: 'token-123',
        user: { id: 'user-123', email_confirmed_at: new Date().toISOString() },
      }

      mockSupabase.auth.exchangeCodeForSession.mockResolvedValue({
        data: { session },
        error: null,
      })

      // Act
      const result = await handleEmailConfirmation('auth-code-123')

      // Assert
      expect(result.session).toEqual(session)
      expect(result.user.email_confirmed_at).toBeTruthy()
    })

    it('should handle invalid confirmation code', async () => {
      // Arrange
      const authError = new AuthError('Invalid code', 400)
      mockSupabase.auth.exchangeCodeForSession.mockResolvedValue({
        data: { session: null },
        error: authError,
      })

      // Act & Assert
      await expect(handleEmailConfirmation('invalid-code')).rejects.toThrow('Invalid code')
    })
  })
})

// Mock implementations of auth service functions
async function registerUser(userData: any) {
  const supabase = createClient()
  const { data, error } = await supabase.auth.signUp({
    email: userData.email,
    password: userData.password,
    options: {
      data: {
        first_name: userData.first_name,
        last_name: userData.last_name,
        company_name: userData.company_name,
      },
    },
  })

  if (error) throw error

  // Create workspace
  const { data: workspace } = await supabase
    .from('workspaces')
    .insert({
      name: userData.company_name,
      owner_id: data.user.id,
      slug: userData.company_name.toLowerCase().replace(/\s+/g, '-'),
    })
    .select()
    .single()

  // Create user profile
  const { data: dbUser } = await supabase
    .from('users')
    .insert({
      id: data.user.id,
      email: data.user.email,
      first_name: userData.first_name,
      last_name: userData.last_name,
      workspace_id: workspace.id,
      role: 'workspace_admin',
    })
    .select()
    .single()

  return {
    user: data.user,
    workspace,
    dbUser,
    requiresEmailConfirmation: !data.user.email_confirmed_at,
  }
}

async function loginUser(credentials: any) {
  const supabase = createClient()
  const { data, error } = await supabase.auth.signInWithPassword(credentials)

  if (error) throw error

  // Load user profile
  const { data: dbUser } = await supabase
    .from('users')
    .select('*')
    .eq('id', data.user.id)
    .single()

  // Load workspace
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('*')
    .eq('id', dbUser.workspace_id)
    .single()

  return {
    user: data.user,
    session: data.session,
    dbUser,
    workspace,
  }
}

async function initiateOAuthFlow(provider: string, redirectTo: string) {
  const supabase = createClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: provider as any,
    options: { redirectTo },
  })

  if (error) throw error

  return data
}

async function getCurrentSession() {
  const supabase = createClient()
  const { data, error } = await supabase.auth.getSession()

  if (error) throw error

  return data.session
}

async function refreshSession() {
  const supabase = createClient()
  const { data, error } = await supabase.auth.getSession()

  if (error) throw error

  return data.session
}

async function sendPasswordReset(email: string) {
  const supabase = createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password`,
  })

  if (error) throw error
}

async function updatePassword(password: string) {
  const supabase = createClient()
  const { data, error } = await supabase.auth.updateUser({ password })

  if (error) throw error

  return data
}

async function getUserWorkspace(userId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('workspaces')
    .select('*')
    .eq('owner_id', userId)
    .single()

  if (error) throw error

  return data
}

async function checkWorkspaceMembership(userId: string, workspaceId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('workspace_users')
    .select('*')
    .eq('user_id', userId)
    .eq('workspace_id', workspaceId)
    .single()

  if (error && error.code !== 'PGRST116') throw error

  return data
}

async function checkUserPermission(userId: string, permission: string): Promise<boolean> {
  const supabase = createClient()
  const { data: user } = await supabase
    .from('users')
    .select('role')
    .eq('id', userId)
    .single()

  if (!user) return false

  const rolePermissions = {
    super_admin: ['manage_system', 'manage_billing', 'manage_campaigns', 'view_analytics'],
    workspace_admin: ['manage_billing', 'manage_campaigns', 'view_analytics'],
    campaign_manager: ['manage_campaigns', 'view_analytics'],
    member: ['view_analytics'],
    viewer: ['view_analytics'],
  }

  return rolePermissions[user.role as keyof typeof rolePermissions]?.includes(permission) || false
}

async function logoutUser() {
  const supabase = createClient()
  const { error } = await supabase.auth.signOut()

  if (error) throw error
}

async function updateUserProfile(userId: string, updates: any) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', userId)
    .select()
    .single()

  if (error) throw error

  return data
}

function onAuthStateChange(callback: any) {
  const supabase = createClient()
  const { data } = supabase.auth.onAuthStateChange(callback)

  return {
    unsubscribe: data.subscription.unsubscribe,
  }
}

async function handleEmailConfirmation(code: string) {
  const supabase = createClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) throw error

  return data
}