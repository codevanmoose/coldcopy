import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { PipedriveAuth } from '@/lib/integrations/pipedrive/auth';
import crypto from 'crypto';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient(cookies());
    
    // Check authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get workspace
    const workspaceId = request.headers.get('x-workspace-id');
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID required' }, { status: 400 });
    }

    // Verify user has access to workspace
    const { data: member } = await supabase
      .from('workspace_users')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single();

    if (!member || !['owner', 'admin'].includes(member.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Generate state token for CSRF protection
    const state = crypto.randomBytes(32).toString('hex');
    
    // Store state in database for verification
    await supabase
      .from('auth_states')
      .insert({
        state,
        workspace_id: workspaceId,
        user_id: user.id,
        provider: 'pipedrive',
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
      });

    // Generate authorization URL
    const auth = new PipedriveAuth();
    const authUrl = auth.getAuthorizationUrl(state);

    return NextResponse.json({ authUrl });
  } catch (error) {
    console.error('Pipedrive auth error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate Pipedrive authentication' },
      { status: 500 }
    );
  }
}