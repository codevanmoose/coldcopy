import { NextRequest, NextResponse } from 'next/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { Database } from '@/lib/supabase/database.types'

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerComponentClient<Database>({ cookies })
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')

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

    // Fetch domains for the workspace
    const { data: domains, error } = await supabase
      .from('white_label_domains')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching domains:', error)
      return NextResponse.json(
        { error: 'Failed to fetch domains' },
        { status: 500 }
      )
    }

    return NextResponse.json(domains)
  } catch (error) {
    console.error('Domains API error:', error)
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
    const { workspaceId, domain, subdomain, isPrimary = false } = body

    if (!workspaceId || !domain) {
      return NextResponse.json(
        { error: 'Workspace ID and domain are required' },
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

    // Validate domain format
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/
    if (!domainRegex.test(domain)) {
      return NextResponse.json(
        { error: 'Invalid domain format' },
        { status: 400 }
      )
    }

    if (subdomain && !domainRegex.test(subdomain)) {
      return NextResponse.json(
        { error: 'Invalid subdomain format' },
        { status: 400 }
      )
    }

    // Generate DNS records
    const dnsRecords = {
      cname: {
        name: subdomain || '@',
        value: 'coldcopy-proxy.herokuapp.com',
        ttl: 300,
        type: 'CNAME'
      },
      a_records: [
        {
          name: '@',
          value: '192.168.1.100',
          ttl: 300,
          type: 'A'
        }
      ],
      txt_records: [
        {
          name: '_coldcopy-verification',
          value: `coldcopy-verification=${generateVerificationToken()}`,
          ttl: 300,
          type: 'TXT'
        }
      ],
      mx_records: [],
      verification_token: generateVerificationToken()
    }

    // Insert the domain
    const { data: newDomain, error } = await supabase
      .from('white_label_domains')
      .insert({
        workspace_id: workspaceId,
        domain,
        subdomain: subdomain || null,
        dns_records: dnsRecords,
        is_primary: isPrimary,
        ssl_status: 'pending',
        verification_status: 'pending',
        is_active: false,
        last_checked_at: new Date().toISOString(),
        config: {}
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating domain:', error)
      
      // Handle unique constraint violations
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Domain already exists' },
          { status: 409 }
        )
      }
      
      return NextResponse.json(
        { error: 'Failed to create domain' },
        { status: 500 }
      )
    }

    return NextResponse.json(newDomain, { status: 201 })
  } catch (error) {
    console.error('Create domain API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function generateVerificationToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}