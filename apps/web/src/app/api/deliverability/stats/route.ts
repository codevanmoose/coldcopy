import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createServerClient(cookieStore);
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Get workspace ID from query params
    const searchParams = request.nextUrl.searchParams;
    const workspaceId = searchParams.get('workspace_id');
    const period = searchParams.get('period') || '30d'; // Default to 30 days
    
    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Workspace ID required' },
        { status: 400 }
      );
    }
    
    // Verify user has access to workspace
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single();
      
    if (!membership) {
      return NextResponse.json(
        { error: 'Access denied to workspace' },
        { status: 403 }
      );
    }
    
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    
    switch (period) {
      case '7d':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(endDate.getDate() - 90);
        break;
      default:
        startDate.setDate(endDate.getDate() - 30);
    }
    
    // Get email statistics
    const { data: emailStats, error: statsError } = await supabase
      .from('email_events')
      .select('event_type, created_at')
      .eq('workspace_id', workspaceId)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());
      
    if (statsError) {
      console.error('Error fetching email stats:', statsError);
      return NextResponse.json(
        { error: 'Failed to fetch email statistics' },
        { status: 500 }
      );
    }
    
    // Calculate metrics
    const stats = {
      sent: 0,
      delivered: 0,
      bounced: 0,
      complained: 0,
      opened: 0,
      clicked: 0,
    };
    
    emailStats?.forEach(event => {
      switch (event.event_type) {
        case 'sent':
          stats.sent++;
          break;
        case 'delivered':
          stats.delivered++;
          break;
        case 'bounce':
        case 'hard_bounce':
        case 'soft_bounce':
          stats.bounced++;
          break;
        case 'complaint':
          stats.complained++;
          break;
        case 'open':
          stats.opened++;
          break;
        case 'click':
          stats.clicked++;
          break;
      }
    });
    
    // Calculate rates
    const deliveryRate = stats.sent > 0 ? (stats.delivered / stats.sent) * 100 : 0;
    const bounceRate = stats.sent > 0 ? (stats.bounced / stats.sent) * 100 : 0;
    const complaintRate = stats.sent > 0 ? (stats.complained / stats.sent) * 100 : 0;
    const openRate = stats.delivered > 0 ? (stats.opened / stats.delivered) * 100 : 0;
    const clickRate = stats.delivered > 0 ? (stats.clicked / stats.delivered) * 100 : 0;
    
    // Calculate overall score (weighted average)
    let overallScore = 50; // Base score
    
    // Delivery rate impact (max 30 points)
    if (deliveryRate >= 95) overallScore += 30;
    else if (deliveryRate >= 90) overallScore += 25;
    else if (deliveryRate >= 85) overallScore += 20;
    else if (deliveryRate >= 80) overallScore += 15;
    else overallScore += 10;
    
    // Bounce rate impact (max -20 points)
    if (bounceRate > 10) overallScore -= 20;
    else if (bounceRate > 5) overallScore -= 15;
    else if (bounceRate > 3) overallScore -= 10;
    else if (bounceRate > 2) overallScore -= 5;
    
    // Complaint rate impact (max -30 points)
    if (complaintRate > 0.5) overallScore -= 30;
    else if (complaintRate > 0.3) overallScore -= 20;
    else if (complaintRate > 0.1) overallScore -= 10;
    else if (complaintRate > 0.05) overallScore -= 5;
    
    // Engagement bonus (max 20 points)
    if (openRate > 25 && clickRate > 5) overallScore += 20;
    else if (openRate > 20 && clickRate > 3) overallScore += 15;
    else if (openRate > 15 && clickRate > 2) overallScore += 10;
    else if (openRate > 10) overallScore += 5;
    
    // Ensure score is between 0 and 100
    overallScore = Math.max(0, Math.min(100, overallScore));
    
    // Determine reputation based on score
    let reputation: 'excellent' | 'good' | 'fair' | 'poor';
    if (overallScore >= 85) reputation = 'excellent';
    else if (overallScore >= 70) reputation = 'good';
    else if (overallScore >= 50) reputation = 'fair';
    else reputation = 'poor';
    
    // Get domain-specific stats
    const { data: domainStats } = await supabase
      .from('email_events')
      .select('recipient_email')
      .eq('workspace_id', workspaceId)
      .eq('event_type', 'sent')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());
      
    // Group by domain
    const domainBreakdown: Record<string, { sent: number; delivered: number; bounced: number }> = {};
    
    domainStats?.forEach(event => {
      if (event.recipient_email) {
        const domain = event.recipient_email.split('@')[1] || 'unknown';
        if (!domainBreakdown[domain]) {
          domainBreakdown[domain] = { sent: 0, delivered: 0, bounced: 0 };
        }
        domainBreakdown[domain].sent++;
      }
    });
    
    // Get delivery/bounce stats per domain
    const { data: domainDeliveryStats } = await supabase
      .from('email_events')
      .select('recipient_email, event_type')
      .eq('workspace_id', workspaceId)
      .in('event_type', ['delivered', 'bounce', 'hard_bounce', 'soft_bounce'])
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());
      
    domainDeliveryStats?.forEach(event => {
      if (event.recipient_email) {
        const domain = event.recipient_email.split('@')[1] || 'unknown';
        if (domainBreakdown[domain]) {
          if (event.event_type === 'delivered') {
            domainBreakdown[domain].delivered++;
          } else {
            domainBreakdown[domain].bounced++;
          }
        }
      }
    });
    
    // Sort domains by volume and get top 5
    const topDomains = Object.entries(domainBreakdown)
      .sort(([, a], [, b]) => b.sent - a.sent)
      .slice(0, 5)
      .map(([domain, stats]) => ({
        domain,
        sent: stats.sent,
        delivered: stats.delivered,
        bounced: stats.bounced,
        rate: stats.sent > 0 ? (stats.delivered / stats.sent) * 100 : 0,
      }));
    
    // Get suppression list stats
    const { data: suppressionData } = await supabase
      .from('suppression_list')
      .select('reason')
      .eq('workspace_id', workspaceId);
      
    const suppressionStats = {
      totalSuppressed: suppressionData?.length || 0,
      hardBounces: suppressionData?.filter(s => s.reason === 'hard_bounce').length || 0,
      softBounces: suppressionData?.filter(s => s.reason === 'soft_bounce').length || 0,
      complaints: suppressionData?.filter(s => s.reason === 'complaint').length || 0,
      unsubscribes: suppressionData?.filter(s => s.reason === 'unsubscribe').length || 0,
      manual: suppressionData?.filter(s => s.reason === 'manual').length || 0,
    };
    
    return NextResponse.json({
      overallScore,
      emailsSent: stats.sent,
      delivered: stats.delivered,
      bounced: stats.bounced,
      complained: stats.complained,
      deliveryRate: Math.round(deliveryRate * 10) / 10,
      bounceRate: Math.round(bounceRate * 10) / 10,
      complaintRate: Math.round(complaintRate * 100) / 100,
      reputation,
      period,
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
      domainPerformance: topDomains,
      suppressionStats,
      engagement: {
        opened: stats.opened,
        clicked: stats.clicked,
        openRate: Math.round(openRate * 10) / 10,
        clickRate: Math.round(clickRate * 10) / 10,
      },
    });
    
  } catch (error) {
    console.error('Deliverability stats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch deliverability statistics' },
      { status: 500 }
    );
  }
}