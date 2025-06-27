import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { PipedriveNotificationSystem } from '@/lib/integrations/pipedrive/notifications';

export async function POST(request: NextRequest) {
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
    const notificationSystem = new PipedriveNotificationSystem(workspaceId);

    const body = await request.json();
    const { type, ...data } = body;

    switch (type) {
      case 'create_rule':
        const rule = await notificationSystem.createNotificationRule(data);
        return NextResponse.json({ rule });
      
      case 'setup_collaboration':
        const { dealId, ownerId, collaborators, permissions } = data;
        const collaboration = await notificationSystem.setupDealCollaboration(
          dealId,
          ownerId,
          collaborators,
          permissions
        );
        return NextResponse.json({ collaboration });
      
      case 'add_comment':
        const { dealId: commentDealId, userId, content, mentions } = data;
        const comment = await notificationSystem.addDealComment(
          commentDealId,
          userId,
          content,
          mentions
        );
        return NextResponse.json({ comment });
      
      case 'add_watcher':
        const { dealId: watchDealId, userId: watchUserId, preferences } = data;
        await notificationSystem.addDealWatcher(
          watchDealId,
          watchUserId,
          preferences
        );
        return NextResponse.json({ success: true });
      
      default:
        return NextResponse.json({ error: 'Invalid notification type' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error processing notification request:', error);
    return NextResponse.json(
      { error: 'Failed to process notification request' },
      { status: 500 }
    );
  }
}