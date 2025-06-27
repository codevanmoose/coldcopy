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
      suggestion_id,
      sent_message_id,
      sent_message_type,
      sent_content,
      was_edited,
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

    // Track the reply performance
    await SmartReplyService.trackReplyPerformance(
      workspace_id,
      suggestion_id,
      sent_message_id,
      sent_message_type,
      sent_content,
      was_edited
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Reply tracking error:', error);
    return NextResponse.json(
      { error: 'Failed to track reply performance' },
      { status: 500 }
    );
  }
}