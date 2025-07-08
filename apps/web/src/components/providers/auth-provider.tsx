'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/auth'
import { User as DBUser, Workspace } from '@coldcopy/database'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { setUser, setDbUser, setWorkspace, setIsLoading, setHydrated, isHydrated, reset } = useAuthStore()
  const supabase = createClient()

  useEffect(() => {
    let mounted = true

    const fetchUserData = async (userId: string) => {
      try {
        // Fetch user details from user_profiles
        const { data: dbUser } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', userId)
          .single()
        
        if (mounted && dbUser) {
          setDbUser(dbUser as DBUser)
          
          // Fetch workspace through workspace_members
          const { data: member } = await supabase
            .from('workspace_members')
            .select('workspace_id')
            .eq('user_id', userId)
            .single()
          
          if (mounted && member) {
            const { data: workspace } = await supabase
              .from('workspaces')
              .select('*')
              .eq('id', member.workspace_id)
              .single()
            
            if (mounted && workspace) {
              setWorkspace(workspace as Workspace)
            }
          }
        }
      } catch (error) {
        console.error('Error fetching user data:', error)
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return

      if (event === 'SIGNED_OUT' || !session?.user) {
        reset()
        // Don't redirect on initial load, let the middleware handle it
        if (event === 'SIGNED_OUT') {
          router.push('/login')
        }
        return
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setUser(session.user)
        await fetchUserData(session.user.id)
      }
    })

    // Check initial session - this is critical for page refresh
    const checkInitialSession = async () => {
      // Wait for hydration to complete before checking session
      if (!isHydrated) {
        // Wait a bit for zustand to hydrate
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (!mounted) return

        if (error) {
          console.error('Error getting session:', error)
          setIsLoading(false)
          return
        }

        if (session?.user) {
          setUser(session.user)
          await fetchUserData(session.user.id)
        } else {
          // No session found - let middleware handle redirect
          setIsLoading(false)
        }
      } catch (error) {
        console.error('Error checking initial session:', error)
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    // Only check session after hydration
    if (isHydrated) {
      checkInitialSession()
    } else {
      // Mark as hydrated if not already
      setHydrated()
      checkInitialSession()
    }

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [supabase, setUser, setDbUser, setWorkspace, setIsLoading, reset, router])

  return <>{children}</>
}