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

    // Try to get providers from database first
    const { data: dbProviders, error: providersError } = await supabase
      .from('enrichment_providers')
      .select('*')
      .eq('is_active', true)
      .order('name')

    if (!providersError && dbProviders && dbProviders.length > 0) {
      // Transform database providers to UI format
      const providers = dbProviders.map(provider => ({
        id: provider.id,
        name: provider.name,
        type: provider.type,
        creditsPerRequest: parseFloat(provider.cost_per_request || '1'),
        isActive: provider.is_active,
        accuracy: provider.config?.accuracy || 90,
        speed: provider.config?.speed || 'medium',
        rateLimits: provider.rate_limits,
        features: provider.config?.features || []
      }))

      return NextResponse.json(providers)
    }

    // Fallback to static providers if no database providers
    const staticProviders = [
      {
        id: 'clearbit',
        name: 'Clearbit',
        type: 'comprehensive',
        creditsPerRequest: 2,
        isActive: true,
        accuracy: 95,
        speed: 'fast' as const,
        rateLimits: {
          requestsPerMinute: 600,
          requestsPerHour: 20000,
          requestsPerDay: 50000
        },
        features: [
          'Email finder',
          'Company data',
          'Social profiles',
          'Technographics',
          'Real-time verification'
        ]
      },
      {
        id: 'hunter',
        name: 'Hunter.io',
        type: 'email_finder',
        creditsPerRequest: 1,
        isActive: true,
        accuracy: 92,
        speed: 'fast' as const,
        rateLimits: {
          requestsPerMinute: 300,
          requestsPerHour: 10000,
          requestsPerDay: 25000
        },
        features: [
          'Email finder',
          'Email verification',
          'Domain search',
          'Bulk processing'
        ]
      },
      {
        id: 'apollo',
        name: 'Apollo.io',
        type: 'comprehensive',
        creditsPerRequest: 2,
        isActive: true,
        accuracy: 90,
        speed: 'medium' as const,
        rateLimits: {
          requestsPerMinute: 200,
          requestsPerHour: 5000,
          requestsPerDay: 10000
        },
        features: [
          'Contact data',
          'Company data',
          'Intent data',
          'Technographics',
          'Org charts'
        ]
      },
      {
        id: 'zoominfo',
        name: 'ZoomInfo',
        type: 'comprehensive',
        creditsPerRequest: 3,
        isActive: true,
        accuracy: 96,
        speed: 'slow' as const,
        rateLimits: {
          requestsPerMinute: 100,
          requestsPerHour: 2000,
          requestsPerDay: 5000
        },
        features: [
          'Premium contact data',
          'Company intelligence',
          'Intent signals',
          'Org charts',
          'News & triggers'
        ]
      },
      {
        id: 'snov',
        name: 'Snov.io',
        type: 'email_finder',
        creditsPerRequest: 1,
        isActive: true,
        accuracy: 88,
        speed: 'fast' as const,
        rateLimits: {
          requestsPerMinute: 500,
          requestsPerHour: 15000,
          requestsPerDay: 30000
        },
        features: [
          'Email finder',
          'Email verification',
          'LinkedIn extraction',
          'Bulk processing'
        ]
      }
    ]

    return NextResponse.json(staticProviders)

  } catch (error) {
    console.error('Get providers error:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch providers' 
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin (you may need to adjust this based on your role system)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, workspace_id')
      .eq('id', user.id)
      .single()
    
    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    if (profile.role !== 'admin' && profile.role !== 'owner') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Parse request body
    const body = await request.json()
    const {
      name,
      type,
      apiEndpoint,
      apiKeyRequired = true,
      costPerRequest = 1,
      rateLimits = {
        requestsPerMinute: 100,
        requestsPerHour: 1000,
        requestsPerDay: 5000
      },
      config = {}
    } = body

    if (!name || !type) {
      return NextResponse.json({ error: 'Name and type are required' }, { status: 400 })
    }

    // Insert provider
    const { data: provider, error: insertError } = await supabase
      .from('enrichment_providers')
      .insert({
        name,
        type,
        api_endpoint: apiEndpoint,
        api_key_required: apiKeyRequired,
        cost_per_request: costPerRequest.toString(),
        rate_limits: rateLimits,
        config,
        is_active: true
      })
      .select()
      .single()

    if (insertError) {
      throw insertError
    }

    return NextResponse.json(provider, { status: 201 })

  } catch (error) {
    console.error('Create provider error:', error)
    return NextResponse.json({ 
      error: 'Failed to create provider' 
    }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = createClient()
    const { searchParams } = new URL(request.url)
    const providerId = searchParams.get('id')
    
    if (!providerId) {
      return NextResponse.json({ error: 'Provider ID required' }, { status: 400 })
    }

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    
    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    if (profile.role !== 'admin' && profile.role !== 'owner') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Parse request body
    const body = await request.json()
    const updates: any = {}

    // Only update provided fields
    if (body.name !== undefined) updates.name = body.name
    if (body.type !== undefined) updates.type = body.type
    if (body.apiEndpoint !== undefined) updates.api_endpoint = body.apiEndpoint
    if (body.apiKeyRequired !== undefined) updates.api_key_required = body.apiKeyRequired
    if (body.costPerRequest !== undefined) updates.cost_per_request = body.costPerRequest.toString()
    if (body.rateLimits !== undefined) updates.rate_limits = body.rateLimits
    if (body.config !== undefined) updates.config = body.config
    if (body.isActive !== undefined) updates.is_active = body.isActive

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 })
    }

    // Update provider
    const { data: provider, error: updateError } = await supabase
      .from('enrichment_providers')
      .update(updates)
      .eq('id', providerId)
      .select()
      .single()

    if (updateError) {
      throw updateError
    }

    return NextResponse.json(provider)

  } catch (error) {
    console.error('Update provider error:', error)
    return NextResponse.json({ 
      error: 'Failed to update provider' 
    }, { status: 500 })
  }
}