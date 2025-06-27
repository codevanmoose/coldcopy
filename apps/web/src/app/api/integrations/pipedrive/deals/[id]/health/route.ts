import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { DealHealthOptimizer } from '@/lib/integrations/pipedrive/deal-health-optimizer';

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
    const healthOptimizer = new DealHealthOptimizer(workspaceId);
    
    const dealId = parseInt(params.id);
    if (isNaN(dealId)) {
      return NextResponse.json({ error: 'Invalid deal ID' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const includeHistory = searchParams.get('include_history') === 'true';

    const healthProfile = await healthOptimizer.generateDealHealthProfile(dealId);

    // Store health profile for historical tracking
    await healthOptimizer.storeHealthProfile(healthProfile);

    let response: any = { healthProfile };

    if (includeHistory) {
      const history = await healthOptimizer.getHealthProfileHistory(dealId, 10);
      response.history = history;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching deal health:', error);
    return NextResponse.json(
      { error: 'Failed to fetch deal health' },
      { status: 500 }
    );
  }
}