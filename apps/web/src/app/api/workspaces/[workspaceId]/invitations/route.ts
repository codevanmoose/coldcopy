import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
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

    // Verify user has access to this workspace
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('id, role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    // Only admins can view invitations
    if (membership.role !== 'workspace_admin' && membership.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Permission denied' },
        { status: 403 }
      )
    }

    // Fetch pending invitations with inviter info
    const { data: invitations, error } = await supabase
      .from('workspace_invitations')
      .select(`
        id,
        email,
        role,
        expires_at,
        created_at,
        invited_by,
        user_profiles!workspace_invitations_invited_by_fkey (
          email
        )
      `)
      .eq('workspace_id', workspaceId)
      .is('accepted_at', null)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })

    if (error) {
      throw error
    }

    // Transform the data
    const transformedInvitations = invitations.map(invitation => ({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      invited_by_email: invitation.user_profiles?.email || 'Unknown',
      expires_at: invitation.expires_at,
      created_at: invitation.created_at,
    }))

    return NextResponse.json({ invitations: transformedInvitations })
  } catch (error) {
    console.error('Get invitations error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch invitations' },
      { status: 500 }
    )
  }
}
