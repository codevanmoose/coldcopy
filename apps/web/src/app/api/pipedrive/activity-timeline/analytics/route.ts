import { NextRequest, NextResponse } from 'next/server';
import { ActivityTimelineService } from '@/lib/integrations/pipedrive/activity-timeline';
import { createServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient(cookies());
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get workspace ID
    const { data: userData } = await supabase
      .from('users')
      .select('workspace_id')
      .eq('id', user.id)
      .single();

    if (!userData?.workspace_id) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const leadId = searchParams.get('leadId') || undefined;
    const campaignId = searchParams.get('campaignId') || undefined;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const groupBy = searchParams.get('groupBy') as 'day' | 'week' | 'month' || 'day';

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Start date and end date are required' },
        { status: 400 }
      );
    }

    // Initialize service
    const service = new ActivityTimelineService(userData.workspace_id);

    // Get engagement analytics
    const analytics = await service.getEngagementAnalytics({
      leadId,
      campaignId,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      groupBy,
    });

    return NextResponse.json(analytics);

  } catch (error) {
    console.error('Error fetching engagement analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch engagement analytics' },
      { status: 500 }
    );
  }
}