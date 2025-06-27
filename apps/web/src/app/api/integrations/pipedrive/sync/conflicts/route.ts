import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { z } from 'zod';

// Conflict resolution schema
const ConflictResolutionSchema = z.object({
  conflict_id: z.string().uuid(),
  resolution: z.enum(['use_coldcopy', 'use_pipedrive', 'merge', 'ignore']),
  merge_data: z.any().optional(),
});

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Get sync conflicts
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get workspace
    const { data: workspaceUser, error: workspaceError } = await supabase
      .from('workspace_users')
      .select('workspace_id')
      .eq('user_id', session.user.id)
      .single();

    if (workspaceError || !workspaceUser) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    const { workspace_id } = workspaceUser;

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'pending';
    const entityType = searchParams.get('entity_type');
    const limit = parseInt(searchParams.get('limit') || '50');

    // Build query
    let query = supabase
      .from('pipedrive_sync_conflicts')
      .select(`
        *,
        leads!pipedrive_sync_conflicts_entity_id_fkey (
          id,
          email,
          first_name,
          last_name,
          company
        )
      `)
      .eq('workspace_id', workspace_id)
      .eq('resolution_status', status)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (entityType) {
      query = query.eq('entity_type', entityType);
    }

    const { data: conflicts, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch conflicts: ${error.message}`);
    }

    // Group conflicts by type
    const conflictsByType = conflicts?.reduce((acc, conflict) => {
      const key = `${conflict.entity_type}_${conflict.conflict_type}`;
      if (!acc[key]) {
        acc[key] = {
          entity_type: conflict.entity_type,
          conflict_type: conflict.conflict_type,
          count: 0,
          conflicts: [],
        };
      }
      acc[key].count++;
      acc[key].conflicts.push(conflict);
      return acc;
    }, {} as Record<string, any>) || {};

    return NextResponse.json({
      total: conflicts?.length || 0,
      by_type: Object.values(conflictsByType),
      conflicts: conflicts || [],
    });

  } catch (error) {
    console.error('Get conflicts error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get conflicts' },
      { status: 500 }
    );
  }
}

// Resolve a sync conflict
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { conflict_id, resolution, merge_data } = ConflictResolutionSchema.parse(body);

    // Get workspace
    const { data: workspaceUser, error: workspaceError } = await supabase
      .from('workspace_users')
      .select('workspace_id, role')
      .eq('user_id', session.user.id)
      .single();

    if (workspaceError || !workspaceUser) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    if (!['owner', 'admin'].includes(workspaceUser.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { workspace_id } = workspaceUser;

    // Get conflict details
    const { data: conflict, error: conflictError } = await supabase
      .from('pipedrive_sync_conflicts')
      .select('*')
      .eq('id', conflict_id)
      .eq('workspace_id', workspace_id)
      .single();

    if (conflictError || !conflict) {
      return NextResponse.json({ error: 'Conflict not found' }, { status: 404 });
    }

    // Resolve based on resolution type
    let resolvedData: any;
    let syncAction: 'update_coldcopy' | 'update_pipedrive' | 'both' | 'none' = 'none';

    switch (resolution) {
      case 'use_coldcopy':
        resolvedData = conflict.coldcopy_data;
        syncAction = 'update_pipedrive';
        break;

      case 'use_pipedrive':
        resolvedData = conflict.pipedrive_data;
        syncAction = 'update_coldcopy';
        break;

      case 'merge':
        resolvedData = merge_data || { ...conflict.pipedrive_data, ...conflict.coldcopy_data };
        syncAction = 'both';
        break;

      case 'ignore':
        resolvedData = null;
        syncAction = 'none';
        break;
    }

    // Update conflict status
    const { error: updateError } = await supabase
      .from('pipedrive_sync_conflicts')
      .update({
        resolution_status: 'resolved',
        resolved_data: resolvedData,
        resolved_at: new Date().toISOString(),
        resolved_by: session.user.id,
      })
      .eq('id', conflict_id);

    if (updateError) {
      throw new Error(`Failed to update conflict: ${updateError.message}`);
    }

    // Queue sync operations if needed
    if (syncAction !== 'none' && resolvedData) {
      const syncOperations = [];

      if (syncAction === 'update_coldcopy' || syncAction === 'both') {
        // Update ColdCopy data
        if (conflict.entity_type === 'person') {
          await supabase
            .from('leads')
            .update({
              email: resolvedData.email?.[0]?.value || resolvedData.email,
              first_name: resolvedData.first_name,
              last_name: resolvedData.last_name,
              company: resolvedData.org_name,
              phone: resolvedData.phone?.[0]?.value || resolvedData.phone,
              metadata: supabase.raw(`metadata || '{"last_sync_resolution": "pipedrive"}'::jsonb`),
            })
            .eq('id', conflict.entity_id);
        }
      }

      if (syncAction === 'update_pipedrive' || syncAction === 'both') {
        // Queue Pipedrive update
        syncOperations.push({
          workspace_id,
          operation: 'update' as const,
          entity_type: conflict.entity_type,
          entity_id: conflict.entity_id,
          pipedrive_id: conflict.pipedrive_id,
          data: resolvedData,
          priority: 8,
        });
      }

      if (syncOperations.length > 0) {
        await supabase
          .from('pipedrive_sync_queue')
          .insert(syncOperations);
      }
    }

    // Update sync metrics
    await supabase.rpc('update_pipedrive_sync_metrics', {
      p_workspace_id: workspace_id,
      p_entity_type: conflict.entity_type,
      p_sync_conflicts: 1,
    });

    return NextResponse.json({
      message: 'Conflict resolved successfully',
      conflict_id,
      resolution,
      sync_action: syncAction,
    });

  } catch (error) {
    console.error('Resolve conflict error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to resolve conflict' },
      { status: 500 }
    );
  }
}

// Bulk resolve conflicts
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { conflict_ids, resolution } = z.object({
      conflict_ids: z.array(z.string().uuid()),
      resolution: z.enum(['use_coldcopy', 'use_pipedrive', 'ignore']),
    }).parse(body);

    // Get workspace
    const { data: workspaceUser, error: workspaceError } = await supabase
      .from('workspace_users')
      .select('workspace_id, role')
      .eq('user_id', session.user.id)
      .single();

    if (workspaceError || !workspaceUser) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    if (!['owner', 'admin'].includes(workspaceUser.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { workspace_id } = workspaceUser;

    // Get all conflicts
    const { data: conflicts, error: conflictsError } = await supabase
      .from('pipedrive_sync_conflicts')
      .select('*')
      .eq('workspace_id', workspace_id)
      .in('id', conflict_ids);

    if (conflictsError) {
      throw new Error(`Failed to fetch conflicts: ${conflictsError.message}`);
    }

    // Process each conflict
    const results = {
      resolved: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const conflict of conflicts || []) {
      try {
        // Resolve based on resolution type
        let resolvedData: any;
        switch (resolution) {
          case 'use_coldcopy':
            resolvedData = conflict.coldcopy_data;
            break;
          case 'use_pipedrive':
            resolvedData = conflict.pipedrive_data;
            break;
          case 'ignore':
            resolvedData = null;
            break;
        }

        // Update conflict
        await supabase
          .from('pipedrive_sync_conflicts')
          .update({
            resolution_status: 'resolved',
            resolved_data: resolvedData,
            resolved_at: new Date().toISOString(),
            resolved_by: session.user.id,
          })
          .eq('id', conflict.id);

        results.resolved++;
      } catch (error) {
        results.failed++;
        results.errors.push(`Conflict ${conflict.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return NextResponse.json({
      message: 'Bulk resolution completed',
      ...results,
    });

  } catch (error) {
    console.error('Bulk resolve error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to resolve conflicts' },
      { status: 500 }
    );
  }
}