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

    const { workspaceId, query, filters } = await request.json();

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

    // Search and import profiles
    const profiles = await TwitterService.searchAndImportProfiles(
      workspaceId,
      query,
      filters
    );

    return NextResponse.json({ profiles });
  } catch (error) {
    console.error('Twitter profile search error:', error);
    return NextResponse.json(
      { error: 'Failed to search Twitter profiles' },
      { status: 500 }
    );
  }
}