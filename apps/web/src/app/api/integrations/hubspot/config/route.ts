import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

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

    if (!member) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get integration config
    const { data: integration, error } = await supabase
      .from('integrations')
      .select(`
        id,
        provider,
        is_active,
        settings,
        metadata,
        connected_at,
        last_sync_at,
        sync_status,
        integration_field_mappings (
          id,
          source_field,
          target_field,
          field_type,
          is_required,
          transform_rules
        )
      `)
      .eq('workspace_id', workspaceId)
      .eq('provider', 'hubspot')
      .eq('is_active', true)
      .single();

    if (error || !integration) {
      return NextResponse.json({ 
        connected: false,
        message: 'HubSpot integration not found' 
      });
    }

    // Get sync statistics
    const { data: syncStats } = await supabase
      .from('sync_jobs')
      .select('status, created_at, completed_at, records_processed, records_failed')
      .eq('integration_id', integration.id)
      .order('created_at', { ascending: false })
      .limit(10);

    // Calculate sync health
    const recentSyncs = syncStats || [];
    const successfulSyncs = recentSyncs.filter(s => s.status === 'completed').length;
    const syncHealth = recentSyncs.length > 0 
      ? (successfulSyncs / recentSyncs.length) * 100 
      : 0;

    return NextResponse.json({
      connected: true,
      integration: {
        id: integration.id,
        connectedAt: integration.connected_at,
        lastSyncAt: integration.last_sync_at,
        syncStatus: integration.sync_status,
        settings: integration.settings || {},
        metadata: integration.metadata || {},
        fieldMappings: integration.integration_field_mappings || [],
        syncHealth: Math.round(syncHealth),
        recentSyncs: recentSyncs.slice(0, 5).map(sync => ({
          status: sync.status,
          createdAt: sync.created_at,
          completedAt: sync.completed_at,
          recordsProcessed: sync.records_processed,
          recordsFailed: sync.records_failed,
        })),
      },
    });
  } catch (error) {
    console.error('HubSpot config error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch HubSpot configuration' },
      { status: 500 }
    );
  }
}