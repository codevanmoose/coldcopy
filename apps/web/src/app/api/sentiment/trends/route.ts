import { NextRequest, NextResponse } from 'next/server';
import { SentimentAnalysisService } from '@/lib/sentiment-analysis/service';
import { createClient } from '@/utils/supabase/server';

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
    const days = parseInt(searchParams.get('days') || '30');

    if (!workspace_id) {
      return NextResponse.json(
        { error: 'Workspace ID required' },
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

    // Get sentiment trends
    const trends = await SentimentAnalysisService.getSentimentTrends(
      workspace_id,
      days
    );

    // Get at-risk conversations
    const atRisk = await SentimentAnalysisService.getAtRiskConversations(
      workspace_id
    );

    // Get overall metrics
    const { data: threads } = await supabase
      .from('conversation_threads')
      .select('overall_sentiment, risk_level')
      .eq('workspace_id', workspace_id)
      .eq('is_active', true);

    const metrics = {
      total_threads: threads?.length || 0,
      positive_percentage: threads
        ? (threads.filter(t => t.overall_sentiment === 'positive' || t.overall_sentiment === 'very_positive').length / threads.length) * 100
        : 0,
      negative_percentage: threads
        ? (threads.filter(t => t.overall_sentiment === 'negative' || t.overall_sentiment === 'very_negative').length / threads.length) * 100
        : 0,
      at_risk_count: threads
        ? threads.filter(t => t.risk_level === 'high' || t.risk_level === 'critical').length
        : 0,
    };

    return NextResponse.json({
      metrics,
      trends,
      at_risk: atRisk,
    });
  } catch (error) {
    console.error('Sentiment trends error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sentiment trends' },
      { status: 500 }
    );
  }
}