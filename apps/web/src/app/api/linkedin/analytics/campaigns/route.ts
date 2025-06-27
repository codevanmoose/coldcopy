import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { LinkedInAnalyticsService } from '@/lib/integrations/linkedin/analytics-service';

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const workspace_id = searchParams.get('workspace_id');
    const campaign_id = searchParams.get('campaign_id');

    if (!workspace_id) {
      return NextResponse.json(
        { error: 'workspace_id is required' }, 
        { status: 400 }
      );
    }

    // Verify user has access to workspace
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspace_id)
      .eq('user_id', user.id)
      .single();

    if (!member) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (campaign_id) {
      // Get specific campaign analytics
      const result = await LinkedInAnalyticsService.getCampaignAnalytics(
        workspace_id,
        campaign_id
      );

      if (result.error) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      return NextResponse.json({ analytics: result.data });
    } else {
      // Get all campaign analytics
      const { data, error } = await supabase
        .from('linkedin_campaign_analytics')
        .select(`
          *,
          campaign:campaigns(
            name,
            status,
            created_at
          )
        `)
        .eq('workspace_id', workspace_id)
        .order('last_calculated_at', { ascending: false });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({ 
        campaigns: data,
        count: data.length
      });
    }
  } catch (error) {
    console.error('LinkedIn campaign analytics error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch campaign analytics' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { workspace_id, campaign_id } = body;

    if (!workspace_id || !campaign_id) {
      return NextResponse.json(
        { error: 'workspace_id and campaign_id are required' }, 
        { status: 400 }
      );
    }

    // Verify user has access to workspace
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspace_id)
      .eq('user_id', user.id)
      .single();

    if (!member) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Update campaign analytics
    const result = await LinkedInAnalyticsService.updateCampaignAnalytics(
      workspace_id,
      campaign_id
    );

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ 
      success: true,
      analytics: result.data 
    });
  } catch (error) {
    console.error('LinkedIn campaign analytics update error:', error);
    return NextResponse.json(
      { error: 'Failed to update campaign analytics' },
      { status: 500 }
    );
  }
}