'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Mail, Lock, Loader2 } from 'lucide-react'

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

type LoginForm = z.infer<typeof loginSchema>

export default function SimpleLoginPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  
  // Initialize Supabase client on each render (safe for client components)
  const supabase = createClient()

  // Check if user is already authenticated
  useEffect(() => {
    let mounted = true

    const checkAuthStatus = async () => {
      try {
        // Add a small delay for Safari to properly initialize cookies
        const userAgent = navigator.userAgent
        const isSafari = /^((?!chrome|android).)*safari/i.test(userAgent) || 
                        /iPad|iPhone|iPod/.test(userAgent)
        
        if (isSafari) {
          // Safari needs more time for cookies to be available after hydration
          await new Promise(resolve => setTimeout(resolve, 300))
        }
        
        // Check current session
        const { data: { session } } = await supabase.auth.getSession()
        if (mounted && session?.user) {
          router.push('/dashboard')
          return
        }
      } catch (error) {
        console.error('Error checking auth status:', error)
      } finally {
        if (mounted) {
          setIsCheckingAuth(false)
        }
      }
    }

    checkAuthStatus()

    // Cleanup function
    return () => {
      mounted = false
    }
  }, [])

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginForm) => {
    try {
      setError(null)
      console.log('Attempting login for:', data.email)
      
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      })

      console.log('Auth response:', { error, user: authData?.user?.email })

      if (error) {
        console.error('Login error:', error)
        setError(error.message)
        return
      }

      if (!authData?.user) {
        console.error('No user data returned')
        setError('Login failed - no user data')
        return
      }

      // Redirect to dashboard on success
      console.log('Login successful, redirecting...')
      
      // Small delay to ensure auth state is updated
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Use Next.js router for faster navigation
      router.push('/dashboard')
    } catch (err) {
      console.error('Unexpected error:', err)
      setError('An unexpected error occurred')
    }
  }

  // Show loading while checking authentication
  if (isCheckingAuth) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold">Welcome back</CardTitle>
        <CardDescription>
          Enter your credentials to access your account
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                className="pl-10"
                {...register('email')}
              />
            </div>
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                className="pl-10"
                {...register('password')}
              />
            </div>
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password.message}</p>
            )}
          </div>
          <div className="text-right">
            <Link
              href="/forgot-password"
              className="text-sm text-primary hover:underline"
            >
              Forgot password?
            </Link>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              'Sign in'
            )}
          </Button>
          <p className="text-sm text-center text-muted-foreground">
            Don't have an account?{' '}
            <Link href="/signup" className="text-primary hover:underline">
              Sign up
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}