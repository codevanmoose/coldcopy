import { NextRequest, NextResponse } from 'next/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { Database } from '@/lib/supabase/database.types'

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerComponentClient<Database>({ cookies })
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')
    const domainId = searchParams.get('domainId')

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Workspace ID is required' },
        { status: 400 }
      )
    }

    // Verify user has access to this workspace
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check workspace membership
    const { data: workspaceUser } = await supabase
      .from('workspace_users')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single()

    if (!workspaceUser) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    // Fetch branding for the workspace/domain
    let query = supabase
      .from('white_label_branding')
      .select('*')
      .eq('workspace_id', workspaceId)

    if (domainId) {
      query = query.eq('domain_id', domainId)
    } else {
      query = query.is('domain_id', null)
    }

    const { data: branding, error } = await query.single()

    if (error && error.code !== 'PGRST116') { // Not found is OK
      console.error('Error fetching branding:', error)
      return NextResponse.json(
        { error: 'Failed to fetch branding' },
        { status: 500 }
      )
    }

    return NextResponse.json(branding)
  } catch (error) {
    console.error('Branding API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = createServerComponentClient<Database>({ cookies })
    const body = await request.json()
    const { workspaceId, domainId = null, branding } = body

    if (!workspaceId || !branding) {
      return NextResponse.json(
        { error: 'Workspace ID and branding data are required' },
        { status: 400 }
      )
    }

    // Verify user has admin access to this workspace
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { data: workspaceUser } = await supabase
      .from('workspace_users')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single()

    if (!workspaceUser || !['owner', 'admin'].includes(workspaceUser.role)) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    // Validate required fields
    if (!branding.company_name) {
      return NextResponse.json(
        { error: 'Company name is required' },
        { status: 400 }
      )
    }

    // Validate color formats
    const colorFields = ['primary_color', 'secondary_color', 'accent_color', 'background_color', 'text_color']
    for (const field of colorFields) {
      if (branding[field] && !isValidHexColor(branding[field])) {
        return NextResponse.json(
          { error: `Invalid ${field} format. Must be a valid hex color.` },
          { status: 400 }
        )
      }
    }

    // Prepare branding data with defaults
    const brandingData = {
      workspace_id: workspaceId,
      domain_id: domainId,
      company_name: branding.company_name,
      company_description: branding.company_description || null,
      company_address: branding.company_address || null,
      company_phone: branding.company_phone || null,
      company_website: branding.company_website || null,
      logo_url: branding.logo_url || null,
      favicon_url: branding.favicon_url || null,
      primary_color: branding.primary_color || '#3b82f6',
      secondary_color: branding.secondary_color || '#1e40af',
      accent_color: branding.accent_color || '#f59e0b',
      background_color: branding.background_color || '#ffffff',
      text_color: branding.text_color || '#1f2937',
      font_family: branding.font_family || 'Inter, system-ui, sans-serif',
      font_url: branding.font_url || null,
      custom_css: branding.custom_css || null,
      theme_config: branding.theme_config || {
        borderRadius: '0.5rem',
        spacing: '1rem',
        shadows: true,
        animations: true
      },
      footer_text: branding.footer_text || null,
      copyright_text: branding.copyright_text || null,
      support_email: branding.support_email || null,
      privacy_url: branding.privacy_url || null,
      terms_url: branding.terms_url || null,
      cookie_policy_url: branding.cookie_policy_url || null,
      social_links: branding.social_links || {},
      updated_at: new Date().toISOString()
    }

    // Upsert the branding
    const { data: upsertedBranding, error } = await supabase
      .from('white_label_branding')
      .upsert(brandingData, {
        onConflict: 'workspace_id,domain_id'
      })
      .select()
      .single()

    if (error) {
      console.error('Error upserting branding:', error)
      return NextResponse.json(
        { error: 'Failed to update branding' },
        { status: 500 }
      )
    }

    return NextResponse.json(upsertedBranding)
  } catch (error) {
    console.error('Update branding API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerComponentClient<Database>({ cookies })
    const body = await request.json()
    const { workspaceId, domainId = null, branding } = body

    if (!workspaceId || !branding) {
      return NextResponse.json(
        { error: 'Workspace ID and branding data are required' },
        { status: 400 }
      )
    }

    // Verify user has admin access to this workspace
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { data: workspaceUser } = await supabase
      .from('workspace_users')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single()

    if (!workspaceUser || !['owner', 'admin'].includes(workspaceUser.role)) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    // Validate required fields
    if (!branding.company_name) {
      return NextResponse.json(
        { error: 'Company name is required' },
        { status: 400 }
      )
    }

    // Prepare branding data
    const brandingData = {
      workspace_id: workspaceId,
      domain_id: domainId,
      company_name: branding.company_name,
      company_description: branding.company_description || null,
      company_address: branding.company_address || null,
      company_phone: branding.company_phone || null,
      company_website: branding.company_website || null,
      logo_url: branding.logo_url || null,
      favicon_url: branding.favicon_url || null,
      primary_color: branding.primary_color || '#3b82f6',
      secondary_color: branding.secondary_color || '#1e40af',
      accent_color: branding.accent_color || '#f59e0b',
      background_color: branding.background_color || '#ffffff',
      text_color: branding.text_color || '#1f2937',
      font_family: branding.font_family || 'Inter, system-ui, sans-serif',
      font_url: branding.font_url || null,
      custom_css: branding.custom_css || null,
      theme_config: branding.theme_config || {
        borderRadius: '0.5rem',
        spacing: '1rem',
        shadows: true,
        animations: true
      },
      footer_text: branding.footer_text || null,
      copyright_text: branding.copyright_text || null,
      support_email: branding.support_email || null,
      privacy_url: branding.privacy_url || null,
      terms_url: branding.terms_url || null,
      cookie_policy_url: branding.cookie_policy_url || null,
      social_links: branding.social_links || {}
    }

    // Insert the branding
    const { data: newBranding, error } = await supabase
      .from('white_label_branding')
      .insert(brandingData)
      .select()
      .single()

    if (error) {
      console.error('Error creating branding:', error)
      
      // Handle unique constraint violations
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Branding already exists for this workspace/domain' },
          { status: 409 }
        )
      }
      
      return NextResponse.json(
        { error: 'Failed to create branding' },
        { status: 500 }
      )
    }

    return NextResponse.json(newBranding, { status: 201 })
  } catch (error) {
    console.error('Create branding API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function isValidHexColor(color: string): boolean {
  return /^#([0-9A-F]{3}){1,2}$/i.test(color)
}