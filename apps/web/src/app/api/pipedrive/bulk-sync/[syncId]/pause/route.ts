import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function POST(
  request: NextRequest,
  { params }: { params: { syncId: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceId } = await request.json();

    // Verify user has access to workspace
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single();

    if (!member) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get sync job
    const { data: syncJob } = await supabase
      .from('pipedrive_sync_jobs')
      .select('*')
      .eq('id', params.syncId)
      .eq('workspace_id', workspaceId)
      .single();

    if (!syncJob) {
      return NextResponse.json({ error: 'Sync job not found' }, { status: 404 });
    }

    if (syncJob.status !== 'running') {
      return NextResponse.json(
        { error: 'Can only pause running sync jobs' },
        { status: 400 }
      );
    }

    // Update status
    const { error: updateError } = await supabase
      .from('pipedrive_sync_jobs')
      .update({
        status: 'paused',
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.syncId);

    if (updateError) {
      throw updateError;
    }

    // TODO: Signal the actual sync process to pause
    // This would involve inter-process communication in a real implementation

    return NextResponse.json({
      success: true,
      message: 'Sync job paused successfully',
    });
  } catch (error) {
    console.error('Error pausing sync job:', error);
    return NextResponse.json(
      { error: 'Failed to pause sync job' },
      { status: 500 }
    );
  }
}