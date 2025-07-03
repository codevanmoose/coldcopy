'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

export function BackToDashboardButton() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function checkAuth() {
      try {
        const supabase = createClient()
        
        // First check if we have a session
        const { data: { session } } = await supabase.auth.getSession()
        console.log('[BackToDashboardButton] Session check:', { hasSession: !!session })
        
        if (session) {
          setIsAuthenticated(true)
        } else {
          // If no session, try to get the user (might trigger a refresh)
          const { data: { user }, error } = await supabase.auth.getUser()
          console.log('[BackToDashboardButton] User check:', { hasUser: !!user, error })
          setIsAuthenticated(!!user)
        }
      } catch (error) {
        console.error('[BackToDashboardButton] Error checking auth:', error)
        setIsAuthenticated(false)
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()

    // Subscribe to auth changes
    const supabase = createClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[BackToDashboardButton] Auth state changed:', { event, hasSession: !!session })
      setIsAuthenticated(!!session)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  // Don't render anything while loading or if not authenticated
  if (isLoading || !isAuthenticated) {
    return null
  }

  return (
    <Button
      asChild
      variant="ghost"
      className="mb-6"
    >
      <Link href="/dashboard">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Dashboard
      </Link>
    </Button>
  )
}