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
    const profile_id = searchParams.get('profile_id');
    const top_engaged = searchParams.get('top_engaged') === 'true';
    const limit = parseInt(searchParams.get('limit') || '10');

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

    // Get profile engagement data
    if (profile_id) {
      const result = await LinkedInAnalyticsService.getProfileEngagement(
        workspace_id,
        profile_id
      );

      if (result.error) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      return NextResponse.json({ profile_engagement: result.data });
    } else if (top_engaged) {
      const result = await LinkedInAnalyticsService.getTopEngagedProfiles(
        workspace_id,
        limit
      );

      if (result.error) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      return NextResponse.json({ 
        profiles: result.data,
        count: result.data?.length || 0
      });
    } else {
      // Get all profile engagements
      const { data, error } = await supabase
        .from('linkedin_profile_engagement')
        .select(`
          *,
          profile:linkedin_profiles(
            name,
            headline,
            company_name,
            profile_url
          )
        `)
        .eq('workspace_id', workspace_id)
        .order('engagement_score', { ascending: false })
        .limit(limit);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({ 
        profiles: data,
        count: data.length
      });
    }
  } catch (error) {
    console.error('LinkedIn profile analytics error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch profile analytics' },
      { status: 500 }
    );
  }
}