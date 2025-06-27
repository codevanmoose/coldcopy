import { NextRequest, NextResponse } from 'next/server';
import { SmartReplyService } from '@/lib/smart-reply/service';
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
      message_id,
      message_type,
      message_content,
      sender_name,
      sender_email,
      conversation_thread_id,
      include_suggestions = true,
      suggestion_count = 3,
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

    // Get smart reply analysis and suggestions
    const response = await SmartReplyService.getSmartReply({
      workspace_id,
      message_id,
      message_type,
      message_content,
      sender_name,
      sender_email,
      conversation_thread_id,
      include_suggestions,
      suggestion_count,
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error('Smart reply analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze message and generate suggestions' },
      { status: 500 }
    );
  }
}