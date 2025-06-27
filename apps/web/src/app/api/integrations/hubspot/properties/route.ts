import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createHubSpotClient } from '@/lib/integrations/hubspot/client'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const objectType = searchParams.get('object_type')
    
    if (!objectType || !['contacts', 'companies', 'deals'].includes(objectType)) {
      return NextResponse.json(
        { error: 'Invalid object type' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user's workspace
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('workspace_id')
      .eq('user_id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      )
    }

    // Get HubSpot client
    const hubspot = await createHubSpotClient(profile.workspace_id)
    
    if (!hubspot) {
      return NextResponse.json(
        { error: 'HubSpot not connected' },
        { status: 400 }
      )
    }

    // Fetch properties from HubSpot
    const properties = await hubspot.getProperties(objectType)
    
    // Transform and filter properties
    const filteredProperties = properties
      .filter(prop => !prop.hidden && prop.type !== 'enumeration' || prop.options?.length < 50)
      .map(prop => ({
        name: prop.name,
        label: prop.label,
        type: prop.type,
        description: prop.description,
        options: prop.options?.map(opt => ({
          label: opt.label,
          value: opt.value,
        })),
      }))
      .sort((a, b) => a.label.localeCompare(b.label))

    return NextResponse.json(filteredProperties)
  } catch (error) {
    console.error('HubSpot properties fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch properties', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}