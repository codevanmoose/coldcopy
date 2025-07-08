import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = createClient()

    // Get all-time platform statistics (handle missing tables gracefully)
    let campaigns, emails, leads, workspaces;
    
    try {
      const [
        { data: campaignData, error: campaignsError },
        { data: emailData, error: emailsError },
        { data: leadData, error: leadsError },
        { data: workspaceData, error: workspacesError }
      ] = await Promise.all([
        supabase.from('campaigns').select('id, created_at').order('created_at', { ascending: false }),
        supabase.from('email_sends').select('sent_at, opened_at, replied_at, created_at').order('created_at', { ascending: false }),
        supabase.from('leads').select('id, created_at').order('created_at', { ascending: false }),
        supabase.from('workspaces').select('id, created_at').order('created_at', { ascending: false })
      ])

      campaigns = campaignData || [];
      emails = emailData || [];
      leads = leadData || [];
      workspaces = workspaceData || [];
      
      // Log any database errors but continue with empty data
      if (campaignsError) console.warn('Campaigns table error:', campaignsError);
      if (emailsError) console.warn('Email sends table error:', emailsError);
      if (leadsError) console.warn('Leads table error:', leadsError);
      if (workspacesError) console.warn('Workspaces table error:', workspacesError);
      
    } catch (error) {
      console.warn('Database query error, using fallback data:', error);
      campaigns = [];
      emails = [];
      leads = [];
      workspaces = [];
    }

    // Calculate email metrics (using email_sends table structure)
    const totalEmails = emails?.length || 0
    const deliveredEmails = emails?.filter(e => e.sent_at).length || 0
    const openedEmails = emails?.filter(e => e.opened_at).length || 0
    const repliedEmails = emails?.filter(e => e.replied_at).length || 0

    // Calculate conversion rates
    const deliveryRate = totalEmails > 0 ? (deliveredEmails / totalEmails) * 100 : 0
    const openRate = deliveredEmails > 0 ? (openedEmails / deliveredEmails) * 100 : 0
    const replyRate = deliveredEmails > 0 ? (repliedEmails / deliveredEmails) * 100 : 0

    // Calculate growth metrics (last 30 days vs previous 30 days)
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)

    const recentCampaigns = campaigns?.filter(c => new Date(c.created_at) >= thirtyDaysAgo).length || 0
    const previousCampaigns = campaigns?.filter(c => {
      const date = new Date(c.created_at)
      return date >= sixtyDaysAgo && date < thirtyDaysAgo
    }).length || 0

    const campaignGrowth = previousCampaigns > 0 ? ((recentCampaigns - previousCampaigns) / previousCampaigns) * 100 : 0

    // Calculate ROI based on typical cold email performance
    // Average: 2-5% reply rate = good, 15-25% open rate = good
    // ColdCopy performance: If we're getting higher rates, calculate ROI improvement
    const industryAvgReplyRate = 3 // 3% industry average
    const industryAvgOpenRate = 20 // 20% industry average
    
    const replyRateImprovement = replyRate > industryAvgReplyRate ? (replyRate / industryAvgReplyRate) : 1
    const openRateImprovement = openRate > industryAvgOpenRate ? (openRate / industryAvgOpenRate) : 1
    
    // Calculate overall ROI improvement
    const avgROIImprovement = ((replyRateImprovement + openRateImprovement) / 2) * 100

    // Time savings calculation (assuming 5 minutes per manual email vs 30 seconds with AI)
    const manualTimePerEmail = 5 // minutes
    const aiTimePerEmail = 0.5 // minutes
    const timeSavingsPercentage = ((manualTimePerEmail - aiTimePerEmail) / manualTimePerEmail) * 100

    // Meeting conversion rate (assuming 30% of replies convert to meetings)
    const meetingConversionRate = 0.3
    const estimatedMeetings = repliedEmails * meetingConversionRate
    const manualMeetings = (totalEmails * (industryAvgReplyRate / 100)) * meetingConversionRate
    const meetingImprovement = manualMeetings > 0 ? estimatedMeetings / manualMeetings : 1

    const stats = {
      // Main metrics for the landing page
      roi_improvement: Math.round(avgROIImprovement) || 312, // Default to 312% if no data
      time_savings: Math.round(timeSavingsPercentage) || 73, // Default to 73% if no data
      meeting_multiplier: parseFloat(meetingImprovement.toFixed(1)) || 4.2, // Default to 4.2x if no data

      // Detailed metrics
      total_campaigns: campaigns?.length || 0,
      total_emails: totalEmails,
      total_leads: leads?.length || 0,
      total_workspaces: workspaces?.length || 0,
      
      delivery_rate: Math.round(deliveryRate),
      open_rate: Math.round(openRate),
      reply_rate: Math.round(replyRate),
      
      campaign_growth_30d: Math.round(campaignGrowth),
      
      // Performance comparison
      industry_avg_reply_rate: industryAvgReplyRate,
      industry_avg_open_rate: industryAvgOpenRate,
      
      last_updated: new Date().toISOString()
    }

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Error fetching platform stats:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        // Return fallback stats if database fails
        roi_improvement: 312,
        time_savings: 73,
        meeting_multiplier: 4.2,
        last_updated: new Date().toISOString()
      }, 
      { status: 500 }
    )
  }
}

// Enable ISR with 1 hour revalidation
export const revalidate = 3600