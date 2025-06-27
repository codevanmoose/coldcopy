import { useAuthStore } from '@/stores/auth'

export function useWorkspace() {
  const { workspace, dbUser } = useAuthStore()
  
  return {
    workspace,
    user: dbUser,
    isLoading: false, // Could add loading state if needed
  }
}