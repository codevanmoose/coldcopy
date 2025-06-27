import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const switchWorkspaceSchema = z.object({
  workspaceId: z.string().uuid(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { workspaceId } = switchWorkspaceSchema.parse(body)

    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify user has access to this workspace
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('id, role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return NextResponse.json(
        { error: 'You do not have access to this workspace' },
        { status: 403 }
      )
    }

    // Reset all default flags for user
    await supabase
      .from('workspace_members')
      .update({ is_default: false })
      .eq('user_id', user.id)

    // Set new default workspace
    const { error } = await supabase
      .from('workspace_members')
      .update({ is_default: true })
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)

    if (error) {
      throw error
    }

    // Create audit log
    await supabase.from('audit_logs').insert({
      workspace_id: workspaceId,
      user_id: user.id,
      action: 'workspace_switched',
      resource_type: 'workspace',
      resource_id: workspaceId,
    })

    return NextResponse.json({
      success: true,
      workspaceId,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Switch workspace error:', error)
    return NextResponse.json(
      { error: 'Failed to switch workspace' },
      { status: 500 }
    )
  }
}