import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const { searchParams } = new URL(request.url)
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's workspace
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('workspace_id')
      .eq('id', user.id)
      .single()
    
    if (profileError || !profile?.workspace_id) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }

    const workspaceId = profile.workspace_id

    // Parse query parameters
    const leadId = searchParams.get('leadId')
    const providerId = searchParams.get('providerId')
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build query
    let query = supabase
      .from('enrichment_requests')
      .select(`
        id,
        created_at,
        provider_id,
        request_type,
        status,
        input_data,
        output_data,
        error_message,
        processing_time_ms,
        enriched_data (
          id,
          data_type,
          data,
          confidence_score,
          verification_status,
          source_url
        )
      `)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Apply filters
    if (leadId) {
      query = query.eq('lead_id', leadId)
    }

    if (providerId) {
      query = query.eq('provider_id', providerId)
    }

    if (status) {
      query = query.eq('status', status)
    }

    const { data: requests, error: requestsError } = await query

    if (requestsError) {
      throw requestsError
    }

    // Transform data for UI
    const history = []
    
    // Group requests by created date and provider to create enrichment sessions
    const sessionMap = new Map()
    
    for (const request of requests || []) {
      const sessionKey = `${request.created_at.split('T')[0]}-${request.provider_id}`
      
      if (!sessionMap.has(sessionKey)) {
        sessionMap.set(sessionKey, {
          id: `session-${sessionKey}`,
          createdAt: request.created_at,
          provider: request.provider_id,
          status: 'success',
          fieldsEnriched: 0,
          creditsUsed: 0,
          results: []
        })
      }
      
      const session = sessionMap.get(sessionKey)
      
      // Update session status based on request status
      if (request.status === 'failed' && session.status !== 'failed') {
        session.status = session.fieldsEnriched > 0 ? 'partial' : 'failed'
      } else if (request.status === 'pending' && session.status === 'success') {
        session.status = 'partial'
      }
      
      // Add results if successful
      if (request.status === 'completed' && request.output_data) {
        session.fieldsEnriched++
        
        // Estimate credits used (this would ideally come from the request record)
        const creditsPerType = {
          email_finder: 1,
          phone_finder: 2,
          company_enrichment: 1,
          social_profiles: 1,
          title_finder: 1,
          technographics: 2
        }
        session.creditsUsed += creditsPerType[request.request_type as keyof typeof creditsPerType] || 1
        
        // Create result entries
        if (request.enriched_data && request.enriched_data.length > 0) {
          for (const enrichedData of request.enriched_data) {
            session.results.push({
              field: enrichedData.data_type,
              oldValue: request.input_data?.old_value || null,
              newValue: enrichedData.data,
              confidence: enrichedData.confidence_score || 0,
              source: enrichedData.source_url || request.provider_id,
              verified: enrichedData.verification_status === 'verified'
            })
          }
        } else {
          // Fallback to output_data
          const fieldName = request.request_type.replace(/_finder|_enrichment/, '')
          session.results.push({
            field: fieldName,
            oldValue: request.input_data?.[fieldName] || null,
            newValue: request.output_data,
            confidence: 0.8, // Default confidence
            source: request.provider_id,
            verified: false
          })
        }
      }
    }
    
    // Convert map to array and sort by date
    const historyArray = Array.from(sessionMap.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return NextResponse.json(historyArray)

  } catch (error) {
    console.error('Get enrichment history error:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch enrichment history' 
    }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = createClient()
    const { searchParams } = new URL(request.url)
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's workspace
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('workspace_id')
      .eq('id', user.id)
      .single()
    
    if (profileError || !profile?.workspace_id) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }

    const workspaceId = profile.workspace_id
    const historyId = searchParams.get('id')

    if (!historyId) {
      return NextResponse.json({ error: 'History ID required' }, { status: 400 })
    }

    // Delete enrichment request and related data
    const { error: deleteError } = await supabase
      .from('enrichment_requests')
      .delete()
      .eq('id', historyId)
      .eq('workspace_id', workspaceId)

    if (deleteError) {
      throw deleteError
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Delete enrichment history error:', error)
    return NextResponse.json({ 
      error: 'Failed to delete enrichment history' 
    }, { status: 500 })
  }
}