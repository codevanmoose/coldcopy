import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const exportSchema = z.object({
  workspaceId: z.string().uuid(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
})

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse request body
    const body = await request.json()
    const { workspaceId, startDate, endDate } = exportSchema.parse(body)

    // Verify user has access to workspace
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single()

    if (!member) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Fetch analytics data
    const [campaignsData, emailsData, leadsData] = await Promise.all([
      // Campaign metrics
      supabase
        .from('campaigns')
        .select(`
          name,
          type,
          status,
          created_at,
          campaign_emails!inner(
            id,
            status,
            sent_at,
            opened_at,
            clicked_at,
            replied_at
          )
        `)
        .eq('workspace_id', workspaceId)
        .gte('created_at', startDate)
        .lte('created_at', endDate),

      // Email events
      supabase
        .from('email_events')
        .select('*')
        .eq('workspace_id', workspaceId)
        .gte('created_at', startDate)
        .lte('created_at', endDate),

      // Lead activity
      supabase
        .from('leads')
        .select('*')
        .eq('workspace_id', workspaceId)
        .gte('created_at', startDate)
        .lte('created_at', endDate),
    ])

    // Format data as CSV
    const csvRows: string[] = []
    
    // Header
    csvRows.push([
      'Campaign Name',
      'Campaign Type',
      'Status',
      'Total Sent',
      'Opens',
      'Open Rate',
      'Clicks',
      'Click Rate',
      'Replies',
      'Reply Rate',
      'Created Date'
    ].join(','))

    // Process campaign data
    if (campaignsData.data) {
      campaignsData.data.forEach(campaign => {
        const emails = campaign.campaign_emails
        const totalSent = emails.filter((e: any) => e.status === 'sent').length
        const totalOpened = emails.filter((e: any) => e.opened_at).length
        const totalClicked = emails.filter((e: any) => e.clicked_at).length
        const totalReplied = emails.filter((e: any) => e.replied_at).length

        csvRows.push([
          `"${campaign.name}"`,
          campaign.type,
          campaign.status,
          totalSent,
          totalOpened,
          totalSent > 0 ? (totalOpened / totalSent * 100).toFixed(1) + '%' : '0%',
          totalClicked,
          totalSent > 0 ? (totalClicked / totalSent * 100).toFixed(1) + '%' : '0%',
          totalReplied,
          totalSent > 0 ? (totalReplied / totalSent * 100).toFixed(1) + '%' : '0%',
          new Date(campaign.created_at).toLocaleDateString()
        ].join(','))
      })
    }

    const csv = csvRows.join('\n')
    
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename=analytics-export-${startDate.split('T')[0]}-to-${endDate.split('T')[0]}.csv`
      }
    })
  } catch (error) {
    console.error('Analytics export error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to export analytics' },
      { status: 500 }
    )
  }
}