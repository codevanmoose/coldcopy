import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get current user before logout for audit log
    const { data: { user } } = await supabase.auth.getUser()
    
    if (user) {
      // Get user's workspaces for audit log
      const { data: workspaces } = await supabase
        .rpc('get_user_workspaces', { user_id: user.id })

      if (workspaces && workspaces.length > 0) {
        const defaultWorkspace = workspaces.find(w => w.is_default) || workspaces[0]
        
        // Create audit log
        await supabase.from('audit_logs').insert({
          workspace_id: defaultWorkspace.workspace_id,
          user_id: user.id,
          action: 'user_logout',
          resource_type: 'auth',
          metadata: {
            email: user.email,
            ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
            user_agent: request.headers.get('user-agent'),
          },
        })
      }
    }
    
    // Sign out the user
    const { error } = await supabase.auth.signOut()

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: 'Successfully logged out',
    })
  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}