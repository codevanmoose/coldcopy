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

    const { workspaceId, profileId, content, campaignId } = await request.json();

    // Verify user has access to workspace
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single();

    if (!member) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Send direct message
    const message = await TwitterService.sendDirectMessage(
      workspaceId,
      profileId,
      content,
      campaignId
    );

    return NextResponse.json({ message });
  } catch (error) {
    console.error('Twitter message send error:', error);
    return NextResponse.json(
      { error: 'Failed to send Twitter message' },
      { status: 500 }
    );
  }
}