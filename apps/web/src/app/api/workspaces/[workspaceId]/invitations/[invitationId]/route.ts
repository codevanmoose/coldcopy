import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { workspaceId: string; invitationId: string } }
) {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user has permission
    const { data: hasPermission } = await supabase
      .rpc('check_user_permission', {
        p_user_id: user.id,
        p_workspace_id: params.workspaceId,
        p_permission: 'team:manage'
      })

    if (!hasPermission) {
      return NextResponse.json(
        { error: 'Permission denied' },
        { status: 403 }
      )
    }

    // Get invitation info before deletion
    const { data: invitation } = await supabase
      .from('workspace_invitations')
      .select('email')
      .eq('id', params.invitationId)
      .eq('workspace_id', params.workspaceId)
      .single()

    if (!invitation) {
      return NextResponse.json(
        { error: 'Invitation not found' },
        { status: 404 }
      )
    }

    // Delete invitation
    const { error } = await supabase
      .from('workspace_invitations')
      .delete()
      .eq('id', params.invitationId)
      .eq('workspace_id', params.workspaceId)

    if (error) {
      throw error
    }

    // Create audit log
    await supabase.from('audit_logs').insert({
      workspace_id: params.workspaceId,
      user_id: user.id,
      action: 'invitation_cancelled',
      resource_type: 'workspace_invitation',
      resource_id: params.invitationId,
      metadata: { email: invitation.email },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Cancel invitation error:', error)
    return NextResponse.json(
      { error: 'Failed to cancel invitation' },
      { status: 500 }
    )
  }
}