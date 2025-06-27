import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { LinkedInAnalyticsService } from '@/lib/integrations/linkedin/analytics-service';

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { workspace_id, event, bulk_events } = body;

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

    // Track single event or bulk events
    if (bulk_events && Array.isArray(bulk_events)) {
      const result = await LinkedInAnalyticsService.trackBulkEvents(
        workspace_id,
        bulk_events
      );

      if (result.error) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      return NextResponse.json({ 
        success: true, 
        events: result.data,
        count: result.data?.length || 0
      });
    } else if (event) {
      const result = await LinkedInAnalyticsService.trackEvent(
        workspace_id,
        event
      );

      if (result.error) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      return NextResponse.json({ 
        success: true, 
        event: result.data 
      });
    } else {
      return NextResponse.json(
        { error: 'Either event or bulk_events must be provided' }, 
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('LinkedIn analytics event tracking error:', error);
    return NextResponse.json(
      { error: 'Failed to track event' },
      { status: 500 }
    );
  }
}