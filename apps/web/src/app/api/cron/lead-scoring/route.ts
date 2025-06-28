import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { leadScoringService } from '@/lib/intelligence/lead-scoring-service'

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createClient()
    
    // Get all active workspaces
    const { data: workspaces, error: workspaceError } = await supabase
      .from('workspaces')
      .select('id')
      .eq('status', 'active')

    if (workspaceError) {
      throw workspaceError
    }

    let totalScored = 0
    let errors = 0

    // Process each workspace
    for (const workspace of workspaces) {
      try {
        // Get leads that need scoring update (not scored in last 6 hours)
        const { data: leads, error: leadsError } = await supabase
          .from('leads')
          .select('id')
          .eq('workspace_id', workspace.id)
          .eq('status', 'active')
          .or(`lead_scores.last_calculated.lt.${new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()},lead_scores.id.is.null`)
          .limit(100)

        if (leadsError) {
          console.error(`Error fetching leads for workspace ${workspace.id}:`, leadsError)
          errors++
          continue
        }

        if (!leads || leads.length === 0) continue

        // Score leads in batches
        const leadIds = leads.map(l => l.id)
        await leadScoringService.bulkScoreLeads(workspace.id, leadIds, {
          batchSize: 10,
          includeInsights: false,
        })

        totalScored += leads.length
      } catch (error) {
        console.error(`Error processing workspace ${workspace.id}:`, error)
        errors++
      }
    }

    return NextResponse.json({
      success: true,
      totalScored,
      errors,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Lead scoring cron error:', error)
    return NextResponse.json(
      { error: 'Failed to run lead scoring' },
      { status: 500 }
    )
  }
}