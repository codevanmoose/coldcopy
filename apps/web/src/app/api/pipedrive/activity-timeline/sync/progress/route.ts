import { NextRequest, NextResponse } from 'next/server';
import { ActivityTimelineService } from '@/lib/integrations/pipedrive/activity-timeline';
import { createServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

// Store sync progress in memory (in production, use Redis or similar)
const syncProgressMap = new Map<string, any>();

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

    // Initialize service
    const service = new ActivityTimelineService(userData.workspace_id);

    // Get sync progress
    const progress = service.getSyncProgress();

    return NextResponse.json(progress || { status: 'idle' });

  } catch (error) {
    console.error('Error fetching sync progress:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sync progress' },
      { status: 500 }
    );
  }
}