import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { corsHeaders } from '@/lib/cors'

// Remove edge runtime to avoid global object issues
// export const runtime = 'edge'

// GET /api/workspaces/[workspaceId]/leads/[leadId]
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ workspaceId: string; leadId: string }> }
) {
  const { workspaceId, leadId } = await context.params
  const origin = request.headers.get('origin')
  const headers = corsHeaders(origin)
  
  try {
    const supabase = await createClient()
    
    // Verify user has access to workspace
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers })
    }
    
    // Check workspace membership
    const { data: member } = await supabase
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single()
      
    if (!member) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403, headers })
    }
    
    // Get lead
    const { data: lead, error } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .eq('workspace_id', workspaceId)
      .single()
    
    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Lead not found' }, { status: 404, headers })
      }
      console.error('Error fetching lead:', error)
      return NextResponse.json({ error: error.message }, { status: 400, headers })
    }
    
    return NextResponse.json({ data: lead }, { headers })
    
  } catch (error) {
    console.error('Error in lead GET:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers }
    )
  }
}

// PATCH /api/workspaces/[workspaceId]/leads/[leadId]
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ workspaceId: string; leadId: string }> }
) {
  const { workspaceId, leadId } = await context.params
  const origin = request.headers.get('origin')
  const headers = corsHeaders(origin)
  
  try {
    const supabase = await createClient()
    
    // Verify user has access to workspace
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers })
    }
    
    // Check workspace membership
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single()
      
    if (!member) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403, headers })
    }
    
    // Parse request body
    const updates = await request.json()
    
    // Remove fields that shouldn't be updated
    delete updates.id
    delete updates.workspace_id
    delete updates.created_at
    
    // Update lead
    const { data: lead, error } = await supabase
      .from('leads')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', leadId)
      .eq('workspace_id', workspaceId)
      .select()
      .single()
    
    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Lead not found' }, { status: 404, headers })
      }
      console.error('Error updating lead:', error)
      return NextResponse.json({ error: error.message }, { status: 400, headers })
    }
    
    // Log audit event
    await supabase.from('audit_logs').insert({
      workspace_id: workspaceId,
      user_id: user.id,
      action: 'lead.updated',
      resource_type: 'lead',
      resource_id: leadId,
      metadata: { updates }
    })
    
    return NextResponse.json({ data: lead }, { headers })
    
  } catch (error) {
    console.error('Error in lead PATCH:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers }
    )
  }
}

// DELETE /api/workspaces/[workspaceId]/leads/[leadId]
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ workspaceId: string; leadId: string }> }
) {
  const { workspaceId, leadId } = await context.params
  const origin = request.headers.get('origin')
  const headers = corsHeaders(origin)
  
  try {
    const supabase = await createClient()
    
    // Verify user has access to workspace
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers })
    }
    
    // Check workspace membership with appropriate permission
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single()
      
    if (!member) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403, headers })
    }
    
    // Check if user has permission to delete (workspace_admin or campaign_manager)
    if (!['workspace_admin', 'campaign_manager'].includes(member.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403, headers })
    }
    
    // Get lead email for audit log
    const { data: leadData } = await supabase
      .from('leads')
      .select('email')
      .eq('id', leadId)
      .eq('workspace_id', workspaceId)
      .single()
    
    // Delete lead
    const { error } = await supabase
      .from('leads')
      .delete()
      .eq('id', leadId)
      .eq('workspace_id', workspaceId)
    
    if (error) {
      console.error('Error deleting lead:', error)
      return NextResponse.json({ error: error.message }, { status: 400, headers })
    }
    
    // Log audit event
    await supabase.from('audit_logs').insert({
      workspace_id: workspaceId,
      user_id: user.id,
      action: 'lead.deleted',
      resource_type: 'lead',
      resource_id: leadId,
      metadata: { email: leadData?.email }
    })
    
    return NextResponse.json({ success: true }, { headers })
    
  } catch (error) {
    console.error('Error in lead DELETE:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers }
    )
  }
}

// OPTIONS handler for CORS
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin')
  const headers = corsHeaders(origin)
  return new NextResponse(null, { status: 200, headers })
}