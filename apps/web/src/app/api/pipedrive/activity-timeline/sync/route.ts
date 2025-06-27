import { NextRequest, NextResponse } from 'next/server';
import { ActivityTimelineService } from '@/lib/integrations/pipedrive/activity-timeline';
import { createServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
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
      .select('workspace_id, role')
      .eq('id', user.id)
      .single();

    if (!userData?.workspace_id) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    // Check if user has admin role
    if (!['super_admin', 'workspace_admin'].includes(userData.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Parse request body
    const body = await request.json();
    const {
      startDate,
      endDate,
      categories,
      leadIds,
      campaignIds,
      batchSize = 50,
      includeHistorical = false,
      syncDirection = 'to_pipedrive',
      conflictResolution = 'skip',
    } = body;

    // Initialize service
    const service = new ActivityTimelineService(userData.workspace_id);

    // Start sync in background
    service.syncEmailHistory({
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      categories,
      leadIds,
      campaignIds,
      batchSize,
      includeHistorical,
      syncDirection,
      conflictResolution,
    }).catch(error => {
      console.error('Background sync error:', error);
    });

    return NextResponse.json({ 
      message: 'Sync started successfully',
      status: 'running' 
    });

  } catch (error) {
    console.error('Error starting sync:', error);
    return NextResponse.json(
      { error: 'Failed to start sync' },
      { status: 500 }
    );
  }
}