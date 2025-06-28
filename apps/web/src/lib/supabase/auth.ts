import { createClient } from './client'
import { createClient as createServerClient } from './server'
import type { Database } from '@/types/database'

export type UserRole = Database['public']['Enums']['user_role']
export type WorkspaceStatus = Database['public']['Enums']['workspace_status']

export interface UserWorkspace {
  workspace_id: string
  workspace_name: string
  workspace_slug: string
  role: UserRole
  is_default: boolean
}

export interface AuthUser {
  id: string
  email: string
  profile: {
    full_name: string | null
    avatar_url: string | null
    phone: string | null
    timezone: string
  }
  workspaces: UserWorkspace[]
  currentWorkspace?: UserWorkspace
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const supabase = createClient()
  
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const { data: workspaces } = await supabase
    .rpc('get_user_workspaces', { user_id: user.id })

  if (!profile || !workspaces) return null

  const currentWorkspace = workspaces.find(w => w.is_default) || workspaces[0]

  return {
    id: user.id,
    email: user.email!,
    profile: {
      full_name: profile.full_name,
      avatar_url: profile.avatar_url,
      phone: profile.phone,
      timezone: profile.timezone
    },
    workspaces,
    currentWorkspace
  }
}

export async function switchWorkspace(workspaceId: string): Promise<boolean> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return false

  // Update default workspace
  const { error: resetError } = await supabase
    .from('workspace_members')
    .update({ is_default: false })
    .eq('user_id', user.id)

  if (resetError) return false

  const { error: setError } = await supabase
    .from('workspace_members')
    .update({ is_default: true })
    .eq('user_id', user.id)
    .eq('workspace_id', workspaceId)

  return !setError
}

export async function checkPermission(
  workspaceId: string,
  permission: string
): Promise<boolean> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return false

  const { data, error } = await supabase
    .rpc('check_user_permission', {
      p_user_id: user.id,
      p_workspace_id: workspaceId,
      p_permission: permission
    })

  return !error && data === true
}

export async function signOut() {
  const supabase = createClient()
  await supabase.auth.signOut()
}

export async function signIn(email: string, password: string) {
  const supabase = createClient()
  return await supabase.auth.signInWithPassword({ email, password })
}

export async function signUp(email: string, password: string, fullName?: string) {
  const supabase = createClient()
  
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName
      }
    }
  })

  if (!error && data.user && fullName) {
    // Update profile with full name
    await supabase
      .from('user_profiles')
      .update({ full_name: fullName })
      .eq('id', data.user.id)
  }

  return { data, error }
}

export async function resetPassword(email: string) {
  const supabase = createClient()
  return await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/reset-password`
  })
}

export async function updatePassword(newPassword: string) {
  const supabase = createClient()
  return await supabase.auth.updateUser({ password: newPassword })
}

// Export a mock useAuth hook for now - this should be replaced with proper context
export function useAuth() {
  return {
    user: null,
    loading: false,
    error: null,
    signOut,
  }
}