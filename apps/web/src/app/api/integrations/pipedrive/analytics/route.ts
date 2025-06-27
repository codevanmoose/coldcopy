import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { PipelineAnalyticsEngine } from '@/lib/integrations/pipedrive/analytics-engine';

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
    const analyticsEngine = new PipelineAnalyticsEngine(workspaceId);

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const timeframe = searchParams.get('timeframe') as '30d' | '90d' | '1y' || '90d';
    const type = searchParams.get('type') || 'metrics';

    let response: any = {};

    switch (type) {
      case 'metrics':
        response.metrics = await analyticsEngine.generatePipelineMetrics(timeframe);
        break;
      
      case 'forecast':
        const period = searchParams.get('period') as 'monthly' | 'quarterly' | 'yearly' || 'monthly';
        const forecastType = searchParams.get('forecast_type') as 'conservative' | 'realistic' | 'optimistic' || 'realistic';
        response.forecast = await analyticsEngine.generateAdvancedForecast(period, forecastType);
        break;
      
      case 'team':
        response.team = await analyticsEngine.analyzeTeamPerformance(timeframe);
        break;
      
      case 'recommendations':
        response.recommendations = await analyticsEngine.generatePipelineRecommendations();
        break;
      
      case 'all':
        response.metrics = await analyticsEngine.generatePipelineMetrics(timeframe);
        response.team = await analyticsEngine.analyzeTeamPerformance(timeframe);
        response.recommendations = await analyticsEngine.generatePipelineRecommendations();
        break;
      
      default:
        return NextResponse.json({ error: 'Invalid analytics type' }, { status: 400 });
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}