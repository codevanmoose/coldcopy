import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { corsHeaders } from '@/lib/cors'

// Remove edge runtime to avoid global object issues
// export const runtime = 'edge'

// GET /api/workspaces/[workspaceId]/leads
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ workspaceId: string }> }
) {
  const { workspaceId } = await context.params
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
    
    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const status = searchParams.get('status')
    const tags = searchParams.get('tags')?.split(',').filter(Boolean)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    
    // Build query
    let query = supabase
      .from('leads')
      .select('*', { count: 'exact' })
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)
    
    // Apply filters
    if (search) {
      query = query.or(`email.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%,company.ilike.%${search}%`)
    }
    
    if (status) {
      query = query.eq('status', status)
    }
    
    if (tags && tags.length > 0) {
      query = query.contains('tags', tags)
    }
    
    const { data: leads, error, count } = await query
    
    if (error) {
      console.error('Error fetching leads:', error)
      return NextResponse.json({ error: error.message }, { status: 400, headers })
    }
    
    return NextResponse.json({ 
      data: leads,
      total: count,
      limit,
      offset 
    }, { headers })
    
  } catch (error) {
    console.error('Error in leads GET:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers }
    )
  }
}

// POST /api/workspaces/[workspaceId]/leads
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ workspaceId: string }> }
) {
  const { workspaceId } = await context.params
  const origin = request.headers.get('origin')
  const headers = corsHeaders(origin)
  
  try {
    const supabase = await createClient()
    
    // Verify user has access to workspace
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers })
    }
    
    // Check workspace membership with write permission
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
    const body = await request.json()
    const {
      email,
      first_name,
      last_name,
      company,
      title,
      phone,
      linkedin_url,
      twitter_url,
      website,
      tags = [],
      custom_fields = {},
      status = 'new'
    } = body
    
    // Validate required fields
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400, headers })
    }
    
    // Create lead
    const { data: lead, error } = await supabase
      .from('leads')
      .insert({
        workspace_id: workspaceId,
        email: email.toLowerCase(),
        first_name,
        last_name,
        company,
        title,
        status,
        tags,
        custom_fields: {
          ...custom_fields,
          phone,
          linkedin_url,
          twitter_url,
          website
        }
      })
      .select()
      .single()
    
    if (error) {
      if (error.code === '23505') { // Unique constraint violation
        return NextResponse.json({ error: 'Lead with this email already exists' }, { status: 409, headers })
      }
      console.error('Error creating lead:', error)
      return NextResponse.json({ error: error.message }, { status: 400, headers })
    }
    
    // Log audit event
    await supabase.from('audit_logs').insert({
      workspace_id: workspaceId,
      user_id: user.id,
      action: 'lead.created',
      resource_type: 'lead',
      resource_id: lead.id,
      metadata: { email }
    })
    
    return NextResponse.json({ data: lead }, { status: 201, headers })
    
  } catch (error) {
    console.error('Error in leads POST:', error)
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