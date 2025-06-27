import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'

export function useUser({ redirectTo = '', redirectIfFound = false } = {}) {
  const router = useRouter()
  const { user, loading } = useAuth()

  useEffect(() => {
    if (!redirectTo || loading) return

    if (
      (redirectTo && !redirectIfFound && !user) ||
      (redirectIfFound && user)
    ) {
      router.push(redirectTo)
    }
  }, [user, loading, redirectIfFound, redirectTo, router])

  return { user, isLoading: loading, isAuthenticated: !!user }
}

export function useCurrentWorkspace() {
  const { currentWorkspace } = useAuth()
  return currentWorkspace
}

export function useWorkspaces() {
  const { workspaces, currentWorkspace, switchWorkspace } = useAuth()
  return { workspaces, currentWorkspace, switchWorkspace }
}

export function usePermissions() {
  const { checkPermission, currentWorkspace } = useAuth()
  
  const hasPermission = async (permission: string) => {
    if (!currentWorkspace) return false
    return await checkPermission(permission)
  }

  const canManageCampaigns = async () => hasPermission('campaigns:write')
  const canManageLeads = async () => hasPermission('leads:write')
  const canViewAnalytics = async () => hasPermission('analytics:read')
  const canManageTeam = async () => hasPermission('team:manage')
  const canManageBilling = async () => hasPermission('billing:manage')
  const canManageSettings = async () => hasPermission('settings:manage')

  const isAdmin = currentWorkspace?.role === 'workspace_admin' || currentWorkspace?.role === 'super_admin'
  const isSuperAdmin = currentWorkspace?.role === 'super_admin'

  return {
    hasPermission,
    canManageCampaigns,
    canManageLeads,
    canViewAnalytics,
    canManageTeam,
    canManageBilling,
    canManageSettings,
    isAdmin,
    isSuperAdmin
  }
}