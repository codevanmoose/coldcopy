'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { trackEvents } from '@/lib/analytics/gtag'
import { setSentryUser } from '@/lib/sentry/helpers'

interface AuthContextType {
  user: User | null
  loading: boolean
  error: Error | null
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  refreshUser: () => Promise<void>
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    // Check active sessions and sets the user
    supabase.auth.getSession().then(({ data: { session } }) => {
      const user = session?.user ?? null
      setUser(user)
      setSentryUser(user)
      setLoading(false)
    })

    // Listen for changes on auth state (logged in, signed out, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null
      setUser(user)
      setSentryUser(user)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    try {
      setError(null)
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      trackEvents.login()
      router.push('/dashboard')
    } catch (error) {
      setError(error as Error)
      throw error
    }
  }

  const signUp = async (email: string, password: string) => {
    try {
      setError(null)
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) throw error
      trackEvents.signup()
    } catch (error) {
      setError(error as Error)
      throw error
    }
  }

  const signOut = async () => {
    try {
      setError(null)
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      trackEvents.logout()
      router.push('/login')
    } catch (error) {
      setError(error as Error)
      throw error
    }
  }

  const refreshUser = async () => {
    try {
      setError(null)
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error) throw error
      setUser(user)
    } catch (error) {
      setError(error as Error)
      throw error
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        signIn,
        signUp,
        signOut,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuthContext = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider')
  }
  return context
}

// Export useAuth as an alias for useAuthContext
export const useAuth = useAuthContext