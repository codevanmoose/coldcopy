import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import crypto from 'crypto'

const inviteSchema = z.object({
  workspaceId: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(['workspace_admin', 'campaign_manager', 'outreach_specialist']),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { workspaceId, email, role } = inviteSchema.parse(body)

    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user has permission to invite
    const { data: hasPermission } = await supabase
      .rpc('check_user_permission', {
        p_user_id: user.id,
        p_workspace_id: workspaceId,
        p_permission: 'team:manage'
      })

    if (!hasPermission) {
      return NextResponse.json(
        { error: 'You do not have permission to invite members' },
        { status: 403 }
      )
    }

    // Check if user is already a member
    const { data: existingMember } = await supabase
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('user_id', (
        await supabase
          .from('user_profiles')
          .select('id')
          .eq('email', email)
          .single()
      ).data?.id)
      .single()

    if (existingMember) {
      return NextResponse.json(
        { error: 'User is already a member of this workspace' },
        { status: 400 }
      )
    }

    // Check for existing pending invitation
    const { data: existingInvite } = await supabase
      .from('workspace_invitations')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('email', email)
      .eq('accepted_at', null)
      .gte('expires_at', new Date().toISOString())
      .single()

    if (existingInvite) {
      return NextResponse.json(
        { error: 'An invitation has already been sent to this email' },
        { status: 400 }
      )
    }

    // Generate invitation token
    const token = crypto.randomBytes(32).toString('hex')

    // Create invitation
    const { data: invitation, error } = await supabase
      .from('workspace_invitations')
      .insert({
        workspace_id: workspaceId,
        email,
        role,
        token,
        invited_by: user.id,
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    // Get workspace details
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('name')
      .eq('id', workspaceId)
      .single()

    // TODO: Send invitation email
    // await sendInvitationEmail({
    //   to: email,
    //   inviterName: user.email,
    //   workspaceName: workspace.name,
    //   role,
    //   inviteUrl: `${process.env.NEXT_PUBLIC_APP_URL}/auth/invite?token=${token}`,
    // })

    // Create audit log
    await supabase.from('audit_logs').insert({
      workspace_id: workspaceId,
      user_id: user.id,
      action: 'member_invited',
      resource_type: 'workspace_invitation',
      resource_id: invitation.id,
      metadata: {
        email,
        role,
      },
    })

    return NextResponse.json({
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        expires_at: invitation.expires_at,
      },
      message: 'Invitation sent successfully',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Invite member error:', error)
    return NextResponse.json(
      { error: 'Failed to send invitation' },
      { status: 500 }
    )
  }
}