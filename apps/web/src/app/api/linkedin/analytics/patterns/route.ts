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
    const pattern_type = searchParams.get('pattern_type');

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

    if (pattern_type) {
      // Get specific pattern type
      const { data, error } = await supabase
        .from('linkedin_engagement_patterns')
        .select('*')
        .eq('workspace_id', workspace_id)
        .eq('pattern_type', pattern_type)
        .eq('is_active', true)
        .order('discovered_at', { ascending: false });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({ patterns: data });
    } else {
      // Detect and return patterns
      const result = await LinkedInAnalyticsService.detectEngagementPatterns(
        workspace_id
      );

      if (result.error) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      // Save detected patterns
      if (result.data && result.data.length > 0) {
        const patternsToSave = result.data.map(pattern => ({
          workspace_id,
          ...pattern,
        }));

        await supabase
          .from('linkedin_engagement_patterns')
          .upsert(patternsToSave, {
            onConflict: 'workspace_id,pattern_type,pattern_name',
          });
      }

      return NextResponse.json({ 
        patterns: result.data,
        count: result.data?.length || 0
      });
    }
  } catch (error) {
    console.error('LinkedIn patterns error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch patterns' },
      { status: 500 }
    );
  }
}