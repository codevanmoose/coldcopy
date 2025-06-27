import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { PipedriveDealManager } from '@/lib/integrations/pipedrive/deal-manager';

export async function GET(request: NextRequest) {
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

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const params = {
      start: searchParams.get('start') ? parseInt(searchParams.get('start')!) : undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined,
      stage_id: searchParams.get('stage_id') ? parseInt(searchParams.get('stage_id')!) : undefined,
      status: searchParams.get('status') as any,
      user_id: searchParams.get('user_id') ? parseInt(searchParams.get('user_id')!) : undefined,
      owned_by_you: searchParams.get('owned_by_you') === 'true',
      sort: searchParams.get('sort') || undefined,
    };

    const deals = await dealManager.getDeals(params);

    return NextResponse.json(deals);
  } catch (error) {
    console.error('Error fetching deals:', error);
    return NextResponse.json(
      { error: 'Failed to fetch deals' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { type, ...dealData } = body;

    if (type === 'create_with_intelligent_value') {
      // Create deal with intelligent value calculation
      const { leadId, title, personId, orgId, stageId } = dealData;
      
      if (!leadId || !title) {
        return NextResponse.json(
          { error: 'Lead ID and title are required' },
          { status: 400 }
        );
      }

      const result = await dealManager.createDealWithIntelligentValue(
        leadId,
        title,
        personId,
        orgId,
        stageId
      );

      return NextResponse.json(result);
    } else {
      // Standard deal creation
      const deal = await dealManager.createDeal(dealData);
      return NextResponse.json(deal);
    }
  } catch (error) {
    console.error('Error creating deal:', error);
    return NextResponse.json(
      { error: 'Failed to create deal' },
      { status: 500 }
    );
  }
}