'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { 
  getCurrentUser, 
  switchWorkspace as switchWorkspaceUtil,
  checkPermission as checkPermissionUtil,
  signOut as signOutUtil,
  type AuthUser,
  type UserWorkspace 
} from '@/lib/supabase/auth'

interface AuthContextType {
  user: AuthUser | null
  loading: boolean
  currentWorkspace: UserWorkspace | null
  workspaces: UserWorkspace[]
  switchWorkspace: (workspaceId: string) => Promise<void>
  checkPermission: (permission: string) => Promise<boolean>
  signOut: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: React.ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  const refreshUser = useCallback(async () => {
    try {
      const currentUser = await getCurrentUser()
      setUser(currentUser)
    } catch (error) {
      console.error('Error refreshing user:', error)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshUser()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        await refreshUser()
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
        router.push('/auth/login')
      }
    })

    return () => subscription.unsubscribe()
  }, [refreshUser, router, supabase.auth])

  const switchWorkspace = async (workspaceId: string) => {
    if (!user) return

    const success = await switchWorkspaceUtil(workspaceId)
    if (success) {
      await refreshUser()
      router.refresh()
    }
  }

  const checkPermission = async (permission: string) => {
    if (!user?.currentWorkspace) return false
    return await checkPermissionUtil(user.currentWorkspace.workspace_id, permission)
  }

  const signOut = async () => {
    await signOutUtil()
    setUser(null)
    router.push('/auth/login')
  }

  const currentWorkspace = user?.currentWorkspace || null
  const workspaces = user?.workspaces || []

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        currentWorkspace,
        workspaces,
        switchWorkspace,
        checkPermission,
        signOut,
        refreshUser
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}