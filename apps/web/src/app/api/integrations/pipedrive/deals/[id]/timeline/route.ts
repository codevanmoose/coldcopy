import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { PipedriveDealManager } from '@/lib/integrations/pipedrive/deal-manager';

interface RouteParams {
  params: {
    id: string;
  };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = createServerClient(cookies());
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get workspace
    const { data: workspace } = await supabase
      .from('workspace_users')
      .select('workspace_id')
      .eq('user_id', user.id)
      .single();

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    const workspaceId = workspace.workspace_id;
    const dealManager = new PipedriveDealManager(workspaceId);
    
    const dealId = parseInt(params.id);
    if (isNaN(dealId)) {
      return NextResponse.json({ error: 'Invalid deal ID' }, { status: 400 });
    }

    const timeline = await dealManager.getDealTimeline(dealId);

    return NextResponse.json(timeline);
  } catch (error) {
    console.error('Error fetching deal timeline:', error);
    return NextResponse.json(
      { error: 'Failed to fetch deal timeline' },
      { status: 500 }
    );
  }
}