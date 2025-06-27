import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().optional(),
  workspaceName: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password, fullName, workspaceName } = signupSchema.parse(body)

    const supabase = await createClient()
    
    // Sign up the user
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
      },
    })

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    if (!data.user) {
      return NextResponse.json(
        { error: 'Failed to create user' },
        { status: 500 }
      )
    }

    // The database triggers will automatically:
    // 1. Create user profile
    // 2. Create default workspace
    // 3. Add user as workspace admin

    // If custom workspace name provided, update it
    if (workspaceName && data.user) {
      const { data: workspaces } = await supabase
        .rpc('get_user_workspaces', { user_id: data.user.id })

      if (workspaces && workspaces.length > 0) {
        await supabase
          .from('workspaces')
          .update({ name: workspaceName })
          .eq('id', workspaces[0].workspace_id)
      }
    }

    return NextResponse.json({
      user: data.user,
      session: data.session,
      message: 'Please check your email to confirm your account',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Signup error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}