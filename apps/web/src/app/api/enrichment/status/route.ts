import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    
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

    // Get enrichment service status
    const status = {
      apiVersion: '1.0.0',
      status: 'healthy',
      workspace: workspaceId,
      features: {
        enrichment: true,
        bulkEnrichment: true,
        history: true,
        credits: true,
        providers: true
      },
      providers: [
        {
          id: 'clearbit',
          name: 'Clearbit',
          status: 'active',
          features: ['email', 'company', 'social', 'technographics']
        },
        {
          id: 'hunter',
          name: 'Hunter.io',
          status: 'active',
          features: ['email', 'verification']
        },
        {
          id: 'apollo',
          name: 'Apollo.io',
          status: 'active',
          features: ['email', 'company', 'phone', 'social']
        }
      ],
      timestamp: new Date().toISOString()
    }

    return NextResponse.json(status)

  } catch (error) {
    console.error('Enrichment status error:', error)
    return NextResponse.json({ 
      error: 'Failed to get enrichment status',
      status: 'error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}