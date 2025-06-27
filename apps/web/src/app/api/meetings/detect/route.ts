import { NextRequest, NextResponse } from 'next/server';
import { MeetingSchedulerService } from '@/lib/meeting-scheduler/service';
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
      sender_email,
      sender_name,
      conversation_context,
      lead_id,
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

    // Detect meeting request
    const result = await MeetingSchedulerService.detectMeetingRequest({
      workspace_id,
      message_id,
      message_type,
      message_content,
      sender_email,
      sender_name,
      conversation_context,
      lead_id,
    });

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Meeting detection error:', error);
    return NextResponse.json(
      { error: 'Failed to detect meeting request' },
      { status: 500 }
    );
  }
}