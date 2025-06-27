import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { CachedAnalyticsService } from '@/lib/cache/cached-services';
import { withCache, setCacheHeaders } from '@/lib/cache/middleware';

async function handler(
  request: NextRequest,
  { params }: { params: { workspaceId: string } }
) {
  try {
    const supabase = createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceId } = params;
    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get('period') || 'last_30_days';

    // Verify user has access to workspace
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single();

    if (!member) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Get cached analytics
    const analytics = await CachedAnalyticsService.getWorkspaceAnalytics(
      workspaceId,
      period
    );

    if (!analytics) {
      return NextResponse.json(
        { error: 'Analytics not found' },
        { status: 404 }
      );
    }

    // Get additional real-time metrics not in materialized view
    const [
      { data: recentEmails },
      { data: activeLeads },
      { data: recentCampaigns }
    ] = await Promise.all([
      supabase
        .from('campaign_emails')
        .select('id', { count: 'exact' })
        .eq('workspace_id', workspaceId)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
      supabase
        .from('leads')
        .select('id', { count: 'exact' })
        .eq('workspace_id', workspaceId)
        .eq('status', 'active'),
      supabase
        .from('campaigns')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('status', 'active')
        .limit(5)
    ]);

    const response = NextResponse.json({
      ...analytics,
      realtime: {
        emails_last_24h: recentEmails?.length || 0,
        active_leads: activeLeads?.length || 0,
        active_campaigns: recentCampaigns || [],
      },
    });

    // Set cache headers for CDN
    return setCacheHeaders(response, 300, 1800); // 5 min browser, 30 min CDN
  } catch (error) {
    console.error('Analytics error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}

// Apply caching middleware
export const GET = withCache({
  ttl: 300, // 5 minutes
  key: (req) => {
    const url = new URL(req.url);
    const workspaceId = url.pathname.split('/').pop();
    const period = url.searchParams.get('period') || 'last_30_days';
    return `api:analytics:workspace:${workspaceId}:${period}`;
  },
})(handler);