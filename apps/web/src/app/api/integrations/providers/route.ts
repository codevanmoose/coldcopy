import { NextRequest, NextResponse } from 'next/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

// GET /api/integrations/providers - Get available integration providers
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerComponentClient({ cookies })
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const authType = searchParams.get('authType')

    let query = supabase
      .from('integration_providers')
      .select('*')
      .eq('is_active', true)

    // Apply filters
    if (category) {
      query = query.eq('category', category)
    }

    if (authType) {
      query = query.eq('auth_type', authType)
    }

    const { data: providers, error } = await query
      .order('display_name')

    if (error) {
      console.error('Error fetching providers:', error)
      return NextResponse.json({ error: 'Failed to fetch providers' }, { status: 500 })
    }

    // Get user's workspace to check existing integrations
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('workspace_id')
      .eq('user_id', user.id)
      .single()

    let existingIntegrations = []
    if (profile?.workspace_id) {
      const { data: integrations } = await supabase
        .from('workspace_integrations')
        .select('provider_id, is_active, sync_status')
        .eq('workspace_id', profile.workspace_id)

      existingIntegrations = integrations || []
    }

    // Enhance providers with connection status
    const enhancedProviders = providers?.map(provider => {
      const existing = existingIntegrations.find(i => i.provider_id === provider.id)
      return {
        ...provider,
        connection_status: existing ? {
          connected: true,
          active: existing.is_active,
          status: existing.sync_status
        } : {
          connected: false,
          active: false,
          status: null
        }
      }
    }) || []

    return NextResponse.json({
      success: true,
      providers: enhancedProviders
    })

  } catch (error) {
    console.error('Providers API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}