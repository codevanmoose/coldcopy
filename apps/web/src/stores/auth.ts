import { create } from 'zustand'
import { User } from '@supabase/supabase-js'
import { User as DBUser, Workspace } from '@coldcopy/database'

interface AuthState {
  user: User | null
  dbUser: DBUser | null
  workspace: Workspace | null
  isLoading: boolean
  setUser: (user: User | null) => void
  setDbUser: (dbUser: DBUser | null) => void
  setWorkspace: (workspace: Workspace | null) => void
  setIsLoading: (isLoading: boolean) => void
  reset: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  dbUser: null,
  workspace: null,
  isLoading: true,
  setUser: (user) => set({ user }),
  setDbUser: (dbUser) => set({ dbUser }),
  setWorkspace: (workspace) => set({ workspace }),
  setIsLoading: (isLoading) => set({ isLoading }),
  reset: () => set({ user: null, dbUser: null, workspace: null, isLoading: false }),
}))