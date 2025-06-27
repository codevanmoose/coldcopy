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

    if (!['running', 'paused', 'pending'].includes(syncJob.status)) {
      return NextResponse.json(
        { error: 'Cannot cancel completed sync jobs' },
        { status: 400 }
      );
    }

    // Update status
    const { error: updateError } = await supabase
      .from('pipedrive_sync_jobs')
      .update({
        status: 'cancelled',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.syncId);

    if (updateError) {
      throw updateError;
    }

    // TODO: Signal the actual sync process to cancel
    // This would involve inter-process communication in a real implementation

    return NextResponse.json({
      success: true,
      message: 'Sync job cancelled successfully',
    });
  } catch (error) {
    console.error('Error cancelling sync job:', error);
    return NextResponse.json(
      { error: 'Failed to cancel sync job' },
      { status: 500 }
    );
  }
}