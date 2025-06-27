'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/auth'
import { User as DBUser, Workspace } from '@coldcopy/database'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { setUser, setDbUser, setWorkspace, setIsLoading, reset } = useAuthStore()
  const supabase = createClient()

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser(session.user)
        
        // Fetch user details from database
        const { data: dbUser } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single()
        
        if (dbUser) {
          setDbUser(dbUser as DBUser)
          
          // Fetch workspace details
          const { data: workspace } = await supabase
            .from('workspaces')
            .select('*')
            .eq('id', dbUser.workspace_id)
            .single()
          
          if (workspace) {
            setWorkspace(workspace as Workspace)
          }
        }
        
        setIsLoading(false)
      } else {
        reset()
        router.push('/login')
      }
    })

    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user)
        
        // Fetch user details from database
        supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single()
          .then(({ data: dbUser }) => {
            if (dbUser) {
              setDbUser(dbUser as DBUser)
              
              // Fetch workspace details
              supabase
                .from('workspaces')
                .select('*')
                .eq('id', dbUser.workspace_id)
                .single()
                .then(({ data: workspace }) => {
                  if (workspace) {
                    setWorkspace(workspace as Workspace)
                  }
                  setIsLoading(false)
                })
            } else {
              setIsLoading(false)
            }
          })
      } else {
        setIsLoading(false)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase, setUser, setDbUser, setWorkspace, setIsLoading, reset, router])

  return <>{children}</>
}