import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/supabase/api-auth'
import { corsHeaders } from '@/lib/cors'

// Remove edge runtime to avoid global object issues
// export const runtime = 'edge'

// GET /api/workspaces/[workspaceId]/campaigns
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ workspaceId: string }> }
) {
  const { workspaceId } = await context.params
  const origin = request.headers.get('origin')
  const headers = corsHeaders(origin)
  
  try {
    const authResult = await requireAuth(request)
    if (authResult.error) {
      return NextResponse.json(authResult.error, { status: authResult.status, headers })
    }
    
    const { supabase, user } = authResult
    
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
    const type = searchParams.get('type')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')
    
    // Build query
    let query = supabase
      .from('campaigns')
      .select(`
        *,
        campaign_emails!inner (
          count
        ),
        campaign_leads!inner (
          count
        )
      `, { count: 'exact' })
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)
    
    // Apply filters
    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`)
    }
    
    if (status) {
      query = query.eq('status', status)
    }
    
    if (type) {
      query = query.eq('type', type)
    }
    
    const { data: campaigns, error, count } = await query
    
    if (error) {
      console.error('Error fetching campaigns:', error)
      return NextResponse.json({ error: error.message }, { status: 400, headers })
    }
    
    // Get metrics for each campaign
    const campaignIds = campaigns?.map(c => c.id) || []
    let metrics: Record<string, any> = {}
    
    if (campaignIds.length > 0) {
      const { data: emailMetrics } = await supabase
        .from('campaign_emails')
        .select('campaign_id, status, opened_at, clicked_at, replied_at')
        .in('campaign_id', campaignIds)
      
      // Aggregate metrics by campaign
      emailMetrics?.forEach(email => {
        if (!metrics[email.campaign_id]) {
          metrics[email.campaign_id] = {
            total_leads: 0,
            sent: 0,
            opened: 0,
            clicked: 0,
            replied: 0
          }
        }
        
        metrics[email.campaign_id].total_leads++
        if (email.status === 'sent' || email.status === 'delivered') {
          metrics[email.campaign_id].sent++
        }
        if (email.opened_at) {
          metrics[email.campaign_id].opened++
        }
        if (email.clicked_at) {
          metrics[email.campaign_id].clicked++
        }
        if (email.replied_at) {
          metrics[email.campaign_id].replied++
        }
      })
    }
    
    // Combine campaigns with metrics
    const campaignsWithMetrics = campaigns?.map(campaign => ({
      ...campaign,
      metrics: metrics[campaign.id] || {
        total_leads: 0,
        sent: 0,
        opened: 0,
        clicked: 0,
        replied: 0
      }
    }))
    
    return NextResponse.json({ 
      data: campaignsWithMetrics,
      total: count,
      limit,
      offset 
    }, { headers })
    
  } catch (error) {
    console.error('Error in campaigns GET:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers }
    )
  }
}

// POST /api/workspaces/[workspaceId]/campaigns
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ workspaceId: string }> }
) {
  const { workspaceId } = await context.params
  const origin = request.headers.get('origin')
  const headers = corsHeaders(origin)
  
  try {
    const authResult = await requireAuth(request)
    if (authResult.error) {
      return NextResponse.json(authResult.error, { status: authResult.status, headers })
    }
    
    const { supabase, user } = authResult
    
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
      name,
      description,
      type,
      status = 'draft',
      timezone,
      schedule_settings,
      daily_limit,
      sequences = [],
      lead_ids = []
    } = body
    
    // Validate required fields
    if (!name) {
      return NextResponse.json({ error: 'Campaign name is required' }, { status: 400, headers })
    }
    
    // Start a transaction by creating the campaign first
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .insert({
        workspace_id: workspaceId,
        name,
        description,
        type: type || 'sequence',
        status,
        created_by: user.id,
        settings: {
          timezone,
          schedule_settings,
          daily_limit
        },
        sequence_steps: sequences
      })
      .select()
      .single()
    
    if (campaignError) {
      console.error('Error creating campaign:', campaignError)
      return NextResponse.json({ error: campaignError.message }, { status: 400, headers })
    }
    
    // Add leads to campaign if provided
    if (lead_ids.length > 0) {
      const campaignLeads = lead_ids.map((leadId: string) => ({
        campaign_id: campaign.id,
        lead_id: leadId,
        status: 'pending'
      }))
      
      const { error: leadsError } = await supabase
        .from('campaign_leads')
        .insert(campaignLeads)
      
      if (leadsError) {
        // Rollback by deleting the campaign
        await supabase.from('campaigns').delete().eq('id', campaign.id)
        
        console.error('Error adding leads to campaign:', leadsError)
        return NextResponse.json({ error: 'Failed to add leads to campaign' }, { status: 400, headers })
      }
    }
    
    // Log audit event
    await supabase.from('audit_logs').insert({
      workspace_id: workspaceId,
      user_id: user.id,
      action: 'campaign.created',
      resource_type: 'campaign',
      resource_id: campaign.id,
      metadata: { name, type, lead_count: lead_ids.length }
    })
    
    return NextResponse.json({ data: campaign }, { status: 201, headers })
    
  } catch (error) {
    console.error('Error in campaigns POST:', error)
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