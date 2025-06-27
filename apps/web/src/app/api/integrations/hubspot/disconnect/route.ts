import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
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

    // Check if integration exists
    const { data: integration } = await supabase
      .from('integrations')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('provider', 'hubspot')
      .eq('is_active', true)
      .single();

    if (!integration) {
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 });
    }

    // Soft delete the integration
    const { error: updateError } = await supabase
      .from('integrations')
      .update({
        is_active: false,
        disconnected_at: new Date().toISOString(),
        disconnected_by: user.id,
      })
      .eq('id', integration.id);

    if (updateError) {
      throw updateError;
    }

    // Delete associated credentials
    await supabase
      .from('integration_credentials')
      .delete()
      .eq('integration_id', integration.id);

    // Delete field mappings
    await supabase
      .from('integration_field_mappings')
      .delete()
      .eq('integration_id', integration.id);

    // Cancel any active sync jobs
    await supabase
      .from('sync_jobs')
      .update({ status: 'cancelled' })
      .eq('integration_id', integration.id)
      .in('status', ['pending', 'running']);

    return NextResponse.json({ 
      success: true,
      message: 'HubSpot integration disconnected successfully' 
    });
  } catch (error) {
    console.error('HubSpot disconnect error:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect HubSpot integration' },
      { status: 500 }
    );
  }
}