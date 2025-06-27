import { NextRequest, NextResponse } from 'next/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { Database } from '@/lib/supabase/database.types'

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerComponentClient<Database>({ cookies })
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')
    const domain = searchParams.get('domain')

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

    // Fetch all white-label data in parallel
    const [domainsResult, brandingResult, settingsResult] = await Promise.allSettled([
      // Fetch domains
      supabase
        .from('white_label_domains')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false }),

      // Fetch branding (global for workspace)
      supabase
        .from('white_label_branding')
        .select('*')
        .eq('workspace_id', workspaceId)
        .is('domain_id', null)
        .single(),

      // Fetch settings
      supabase
        .from('white_label_settings')
        .select('*')
        .eq('workspace_id', workspaceId)
        .single()
    ])

    // Process results
    const domains = domainsResult.status === 'fulfilled' ? domainsResult.value.data || [] : []
    const branding = brandingResult.status === 'fulfilled' ? brandingResult.value.data : null
    const settings = settingsResult.status === 'fulfilled' ? settingsResult.value.data : null

    // If domain-specific branding is requested and domain exists
    let domainBranding = branding
    if (domain && domains.length > 0) {
      const matchingDomain = domains.find(d => d.full_domain === domain)
      if (matchingDomain) {
        const { data: domainSpecificBranding } = await supabase
          .from('white_label_branding')
          .select('*')
          .eq('workspace_id', workspaceId)
          .eq('domain_id', matchingDomain.id)
          .single()

        if (domainSpecificBranding) {
          domainBranding = domainSpecificBranding
        }
      }
    }

    // Create default settings if none exist
    if (!settings) {
      const { data: newSettings } = await supabase
        .from('white_label_settings')
        .insert({
          workspace_id: workspaceId,
          feature_flags: {
            custom_domains: true,
            client_portals: true,
            custom_email_templates: true,
            white_label_reports: true,
            api_access: false,
            sso_integration: false,
            advanced_analytics: false,
            webhook_endpoints: false
          },
          custom_navigation: {
            items: [
              { label: "Dashboard", path: "/dashboard", icon: "home" },
              { label: "Campaigns", path: "/campaigns", icon: "mail" },
              { label: "Analytics", path: "/analytics", icon: "chart" },
              { label: "Settings", path: "/settings", icon: "settings" }
            ],
            logo_text: null,
            show_breadcrumbs: true,
            show_user_menu: true
          },
          hide_coldcopy_branding: false,
          hide_powered_by: false,
          custom_footer_text: null,
          show_support_chat: true,
          custom_login_page: {
            enabled: false,
            background_image: null,
            welcome_title: "Welcome Back",
            welcome_subtitle: "Sign in to your account",
            show_registration: true,
            custom_css: null
          },
          custom_dashboard: {
            welcome_message: "Welcome to your dashboard",
            default_widgets: ["recent_campaigns", "analytics_overview", "quick_actions"],
            layout: "grid",
            show_getting_started: true
          },
          webhook_endpoints: {
            campaign_complete: null,
            lead_updated: null,
            portal_access: null,
            payment_received: null
          },
          security_config: {
            session_timeout: 3600,
            require_2fa: false,
            allowed_ip_ranges: [],
            password_policy: {
              min_length: 8,
              require_uppercase: true,
              require_numbers: true,
              require_symbols: false
            }
          },
          email_config: {
            smtp_host: null,
            smtp_port: 587,
            smtp_username: null,
            smtp_password: null,
            use_tls: true,
            default_from_email: null,
            default_from_name: null
          }
        })
        .select()
        .single()

      if (newSettings) {
        return NextResponse.json({
          domains,
          branding: domainBranding,
          settings: newSettings
        })
      }
    }

    return NextResponse.json({
      domains,
      branding: domainBranding,
      settings
    })
  } catch (error) {
    console.error('White-label API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}