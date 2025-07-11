'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { User } from '@supabase/supabase-js'
import { Mail } from 'lucide-react'

export function MarketingNav() {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    // Check initial auth state
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        setUser(session?.user || null)
      } catch (error) {
        console.error('Error checking auth:', error)
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return (
    <nav className="border-b border-white/10">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center space-x-2">
          <Mail className="h-6 w-6 text-primary" />
          <span className="text-2xl font-bold text-white">ColdCopy</span>
        </Link>
        
        <div className="flex items-center gap-6">
          <Link href="/pricing" className="text-sm font-medium text-white/80 hover:text-white transition-colors">
            Pricing
          </Link>
          <Link href="/features" className="text-sm font-medium text-white/80 hover:text-white transition-colors">
            Features
          </Link>
          
          {isLoading ? (
            // Show loading state
            <div className="w-20 h-8" />
          ) : user ? (
            // User is logged in
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/dashboard">Dashboard</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/settings">Account</Link>
              </Button>
            </>
          ) : (
            // User is not logged in
            <>
              <Link href="/login" className="text-sm font-medium text-white/80 hover:text-white transition-colors">
                Login
              </Link>
              <Button asChild size="sm" className="bg-white text-black hover:bg-white/90">
                <Link href="/signup">Get Started</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}