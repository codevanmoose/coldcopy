import { NextRequest, NextResponse } from 'next/server';
import { TwitterService } from '@/lib/integrations/twitter';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get workspace ID
    const { workspaceId } = await request.json();
    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Workspace ID required' },
        { status: 400 }
      );
    }

    // Verify user has access to workspace
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single();

    if (!member || !['workspace_admin', 'super_admin'].includes(member.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Disconnect account
    await TwitterService.disconnectAccount(workspaceId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Twitter disconnect error:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect Twitter account' },
      { status: 500 }
    );
  }
}