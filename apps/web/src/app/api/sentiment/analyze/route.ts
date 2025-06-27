import { NextRequest, NextResponse } from 'next/server';
import { SentimentAnalysisService } from '@/lib/sentiment-analysis/service';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      workspace_id,
      thread_key,
      channel,
      messages,
      lead_id,
      subject,
    } = body;

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

    // Analyze conversation
    const analysis = await SentimentAnalysisService.analyzeConversation({
      workspace_id,
      thread_key,
      channel,
      messages,
      lead_id,
      subject,
    });

    return NextResponse.json(analysis);
  } catch (error) {
    console.error('Sentiment analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze conversation sentiment' },
      { status: 500 }
    );
  }
}