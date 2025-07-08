import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { User } from '@supabase/supabase-js'
import { User as DBUser, Workspace } from '@coldcopy/database'

interface AuthState {
  user: User | null
  dbUser: DBUser | null
  workspace: Workspace | null
  isLoading: boolean
  isHydrated: boolean
  setUser: (user: User | null) => void
  setDbUser: (dbUser: DBUser | null) => void
  setWorkspace: (workspace: Workspace | null) => void
  setIsLoading: (isLoading: boolean) => void
  setHydrated: () => void
  reset: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      dbUser: null,
      workspace: null,
      isLoading: true,
      isHydrated: false,
      setUser: (user) => set({ user }),
      setDbUser: (dbUser) => set({ dbUser }),
      setWorkspace: (workspace) => set({ workspace }),
      setIsLoading: (isLoading) => set({ isLoading }),
      setHydrated: () => set({ isHydrated: true }),
      reset: () => set({ 
        user: null, 
        dbUser: null, 
        workspace: null, 
        isLoading: false,
        isHydrated: true
      }),
    }),
    {
      name: 'coldcopy-auth',
      storage: createJSONStorage(() => {
        // Only use localStorage in the browser
        if (typeof window !== 'undefined') {
          return localStorage
        }
        // Fallback for SSR
        return {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
        }
      }),
      // Only persist non-sensitive data
      partialize: (state) => ({
        dbUser: state.dbUser,
        workspace: state.workspace,
        isHydrated: state.isHydrated,
      }),
      onRehydrateStorage: () => (state) => {
        // Mark as hydrated when rehydration is complete
        if (state) {
          state.setHydrated()
        }
      },
    }
  )
)