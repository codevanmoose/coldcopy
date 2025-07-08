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
        // Optimized: Fetch user and workspace data in parallel
        const [userResponse, memberResponse] = await Promise.all([
          supabase
            .from('user_profiles')
            .select('*')
            .eq('id', userId)
            .single(),
          supabase
            .from('workspace_members')
            .select(`
              workspace_id,
              workspaces!inner (*)
            `)
            .eq('user_id', userId)
            .eq('is_default', true)
            .single()
        ])
        
        if (mounted) {
          if (userResponse.data) {
            setDbUser(userResponse.data as DBUser)
          }
          
          if (memberResponse.data?.workspaces) {
            setWorkspace(memberResponse.data.workspaces as Workspace)
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

    // Initialize auth state
    const initializeAuth = async () => {
      // Ensure hydration is marked complete
      if (!isHydrated) {
        setHydrated()
      }
      
      // Small delay to ensure client-side hydration is complete
      await new Promise(resolve => setTimeout(resolve, 50))
      
      if (mounted) {
        await checkInitialSession()
      }
    }

    initializeAuth()

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [isHydrated]) // Simplified dependencies to avoid re-runs

  return <>{children}</>
}