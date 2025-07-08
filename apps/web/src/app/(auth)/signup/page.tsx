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
import { Mail, Lock, User, Building, Loader2, CheckCircle2 } from 'lucide-react'

const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  fullName: z.string().min(2, 'Full name is required'),
  workspaceName: z.string().min(2, 'Workspace name is required'),
})

type SignupForm = z.infer<typeof signupSchema>

export default function SignupPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)
  const supabase = createClient()

  // Extract plan from URL parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const plan = urlParams.get('plan')
    if (plan) {
      setSelectedPlan(plan)
    }
  }, [])

  // Check if user is already authenticated
  useEffect(() => {
    let mounted = true
    let subscription: any

    const checkAuthStatus = async () => {
      try {
        // Add a small delay for Safari to properly initialize cookies
        const userAgent = navigator.userAgent
        const isSafari = /^((?!chrome|android).)*safari/i.test(userAgent) || 
                        /iPad|iPhone|iPod/.test(userAgent)
        
        if (isSafari) {
          // Safari needs time for cookies to be available after hydration
          await new Promise(resolve => setTimeout(resolve, 150))
        }
        
        // Set up auth state listener first (more reliable in Safari)
        const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
          if (mounted && session?.user) {
            router.push('/dashboard')
          }
        })
        subscription = authListener
        
        // Then check current session
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
      if (subscription?.subscription) {
        subscription.subscription.unsubscribe()
      }
    }
  }, [router, supabase.auth])

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
  })

  const onSubmit = async (data: SignupForm) => {
    try {
      setError(null)
      
      // Sign up the user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            full_name: data.fullName,
            workspace_name: data.workspaceName,
          },
        },
      })

      if (authError) {
        setError(authError.message)
        return
      }

      // Check if email confirmation is required
      if (authData.user && !authData.session) {
        router.push('/signup/verify-email')
      } else if (authData.session) {
        router.push('/dashboard')
        router.refresh()
      }
    } catch (err) {
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
        <CardTitle className="text-2xl font-bold">Create an account</CardTitle>
        <CardDescription>
          Start your 14-day free trial, no credit card required
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
              {error}
            </div>
          )}
          {selectedPlan && (
            <div className="p-3 text-sm bg-primary/10 rounded-md border border-primary/20">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <span className="font-medium">Selected Plan: {selectedPlan.charAt(0).toUpperCase() + selectedPlan.slice(1)}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                You'll be able to configure your subscription after creating your account.
              </p>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="fullName">Full name</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="fullName"
                type="text"
                placeholder="John Doe"
                className="pl-10"
                {...register('fullName')}
              />
            </div>
            {errors.fullName && (
              <p className="text-sm text-destructive">{errors.fullName.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="workspaceName">Workspace name</Label>
            <div className="relative">
              <Building className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="workspaceName"
                type="text"
                placeholder="Acme Agency"
                className="pl-10"
                {...register('workspaceName')}
              />
            </div>
            {errors.workspaceName && (
              <p className="text-sm text-destructive">{errors.workspaceName.message}</p>
            )}
          </div>
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
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating account...
              </>
            ) : (
              'Start free trial'
            )}
          </Button>
          <p className="text-sm text-center text-muted-foreground">
            Already have an account?{' '}
            <Link href="/login" className="text-primary hover:underline">
              Sign in
            </Link>
          </p>
          <p className="text-xs text-center text-muted-foreground">
            By signing up, you agree to our{' '}
            <Link href="/terms" className="underline">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="underline">
              Privacy Policy
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}