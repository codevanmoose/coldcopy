import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const updateMemberSchema = z.object({
  role: z.enum(['workspace_admin', 'campaign_manager', 'outreach_specialist']),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string; memberId: string }> }
) {
  const { workspaceId } = await params;
  try {
    const body = await request.json()
    const { role } = updateMemberSchema.parse(body)

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
        p_workspace_id: workspaceId,
        p_permission: 'team:manage'
      })

    if (!hasPermission) {
      return NextResponse.json(
        { error: 'Permission denied' },
        { status: 403 }
      )
    }

    // Update member role
    const { error } = await supabase
      .from('workspace_members')
      .update({ role })
      .eq('id', params.memberId)
      .eq('workspace_id', workspaceId)

    if (error) {
      throw error
    }

    // Create audit log
    await supabase.from('audit_logs').insert({
      workspace_id: workspaceId,
      user_id: user.id,
      action: 'member_role_updated',
      resource_type: 'workspace_member',
      resource_id: params.memberId,
      metadata: { new_role: role },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Update member error:', error)
    return NextResponse.json(
      { error: 'Failed to update member' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string; memberId: string }> }
) {
  const { workspaceId } = await params;
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
        p_workspace_id: workspaceId,
        p_permission: 'team:manage'
      })

    if (!hasPermission) {
      return NextResponse.json(
        { error: 'Permission denied' },
        { status: 403 }
      )
    }

    // Get member info before deletion
    const { data: member } = await supabase
      .from('workspace_members')
      .select('user_id')
      .eq('id', params.memberId)
      .eq('workspace_id', workspaceId)
      .single()

    if (!member) {
      return NextResponse.json(
        { error: 'Member not found' },
        { status: 404 }
      )
    }

    // Prevent removing yourself
    if (member.user_id === user.id) {
      return NextResponse.json(
        { error: 'Cannot remove yourself from the workspace' },
        { status: 400 }
      )
    }

    // Remove member
    const { error } = await supabase
      .from('workspace_members')
      .delete()
      .eq('id', params.memberId)
      .eq('workspace_id', workspaceId)

    if (error) {
      throw error
    }

    // Create audit log
    await supabase.from('audit_logs').insert({
      workspace_id: workspaceId,
      user_id: user.id,
      action: 'member_removed',
      resource_type: 'workspace_member',
      resource_id: params.memberId,
      metadata: { removed_user_id: member.user_id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Remove member error:', error)
    return NextResponse.json(
      { error: 'Failed to remove member' },
      { status: 500 }
    )
  }
}
