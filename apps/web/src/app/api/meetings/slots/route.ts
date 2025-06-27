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
      request_id,
      host_email,
      attendee_emails,
      duration_minutes,
      earliest_date,
      latest_date,
      timezone,
      slots_to_propose,
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

    // Propose meeting slots
    const result = await MeetingSchedulerService.proposeMeetingSlots({
      workspace_id,
      request_id,
      host_email: host_email || user.email!,
      attendee_emails: attendee_emails || [],
      duration_minutes,
      earliest_date,
      latest_date,
      timezone,
      slots_to_propose,
    });

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Slot proposal error:', error);
    return NextResponse.json(
      { error: 'Failed to propose meeting slots' },
      { status: 500 }
    );
  }
}