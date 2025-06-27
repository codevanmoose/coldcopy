import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = loginSchema.parse(body)

    const supabase = await createClient()
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      )
    }

    // Get user's workspaces
    const { data: workspaces } = await supabase
      .rpc('get_user_workspaces', { user_id: data.user.id })

    // Create audit log
    if (workspaces && workspaces.length > 0) {
      const defaultWorkspace = workspaces.find(w => w.is_default) || workspaces[0]
      await supabase.from('audit_logs').insert({
        workspace_id: defaultWorkspace.workspace_id,
        user_id: data.user.id,
        action: 'user_login',
        resource_type: 'auth',
        metadata: {
          email,
          ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
          user_agent: request.headers.get('user-agent'),
        },
      })
    }

    return NextResponse.json({
      user: data.user,
      session: data.session,
      workspaces,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}