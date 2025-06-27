import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { PipedriveCampaignIntegration } from '@/lib/integrations/pipedrive/campaign-integration';

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
    const campaignIntegration = new PipedriveCampaignIntegration(workspaceId);

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get('campaign_id');
    const timeframe = searchParams.get('timeframe') as '30d' | '90d' | '1y' || '90d';
    const type = searchParams.get('type') || 'performance';

    if (!campaignId) {
      return NextResponse.json({ error: 'Campaign ID is required' }, { status: 400 });
    }

    let response: any = {};

    switch (type) {
      case 'performance':
        response.performance = await campaignIntegration.getCampaignPerformance(campaignId, timeframe);
        break;
      
      case 'optimizations':
        response.optimizations = await campaignIntegration.generateCampaignOptimizations(campaignId);
        break;
      
      case 'sync':
        // Get sync status for multiple deals
        const dealIds = searchParams.get('deal_ids')?.split(',').map(id => parseInt(id)).filter(id => !isNaN(id)) || [];
        if (dealIds.length === 0) {
          return NextResponse.json({ error: 'Deal IDs are required for sync type' }, { status: 400 });
        }
        
        const syncResults = await Promise.all(
          dealIds.map(dealId => campaignIntegration.syncDealCampaignStatus(dealId))
        );
        response.sync = syncResults;
        break;
      
      default:
        return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 });
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching campaign data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch campaign data' },
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
    const campaignIntegration = new PipedriveCampaignIntegration(workspaceId);

    const body = await request.json();
    const { type, ...data } = body;

    switch (type) {
      case 'create_trigger':
        const trigger = await campaignIntegration.createCampaignTrigger(data);
        return NextResponse.json({ trigger });
      
      case 'process_event':
        const { dealId, eventType, eventData, userId } = data;
        await campaignIntegration.processDealCampaignEvent(dealId, eventType, eventData, userId);
        return NextResponse.json({ success: true });
      
      default:
        return NextResponse.json({ error: 'Invalid campaign action type' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error processing campaign request:', error);
    return NextResponse.json(
      { error: 'Failed to process campaign request' },
      { status: 500 }
    );
  }
}