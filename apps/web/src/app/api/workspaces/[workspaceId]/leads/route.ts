import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { corsHeaders } from '@/lib/cors'
import { z } from 'zod'

const createLeadSchema = z.object({
  email: z.string().email(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  company: z.string().optional(),
  title: z.string().optional(),
  phone: z.string().optional(),
  website: z.string().optional(),
  location: z.string().optional(),
  industry: z.string().optional(),
  tags: z.array(z.string()).default([]),
  custom_fields: z.record(z.any()).default({}),
})

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
    
    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers })
    }

    // Check workspace access
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single()

    if (!member) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403, headers })
    }

    // Get search query from URL params
    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search')

    // Build query
    let query = supabase
      .from('leads')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })

    // Add search filter if provided
    if (search) {
      query = query.or(`email.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%,company.ilike.%${search}%`)
    }

    const { data: leads, error } = await query

    if (error) {
      console.error('Error fetching leads:', error)
      return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500, headers })
    }

    return NextResponse.json(leads || [], { headers })
  } catch (error) {
    console.error('Leads GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers })
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
    
    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers })
    }

    // Check workspace access
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single()

    if (!member) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403, headers })
    }

    // Parse and validate request body
    const body = await request.json()
    const validatedData = createLeadSchema.parse(body)

    // Check for duplicate email in workspace
    const { data: existing } = await supabase
      .from('leads')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('email', validatedData.email)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: 'A lead with this email already exists' },
        { status: 409, headers }
      )
    }

    // Create lead
    const { data: lead, error } = await supabase
      .from('leads')
      .insert({
        ...validatedData,
        workspace_id: workspaceId,
        status: 'new',
        score: 0,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating lead:', error)
      return NextResponse.json({ error: 'Failed to create lead' }, { status: 500, headers })
    }

    // Create audit log
    await supabase.from('audit_logs').insert({
      workspace_id: workspaceId,
      user_id: user.id,
      action: 'lead_created',
      resource_type: 'lead',
      resource_id: lead.id,
      metadata: { email: lead.email },
    })

    return NextResponse.json(lead, { headers })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400, headers }
      )
    }

    console.error('Lead creation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers })
  }
}

// OPTIONS handler for CORS
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin')
  const headers = corsHeaders(origin)
  return new NextResponse(null, { status: 200, headers })
}