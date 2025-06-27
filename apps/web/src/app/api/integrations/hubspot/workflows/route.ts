import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { createWorkflowTriggerService } from '@/lib/integrations/hubspot/workflows';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient(cookies());
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get workspace ID from query params
    const workspaceId = request.nextUrl.searchParams.get('workspaceId');
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID required' }, { status: 400 });
    }

    // Verify user has access to workspace
    const { data: workspaceUser } = await supabase
      .from('workspace_users')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single();

    if (!workspaceUser) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get workflow triggers
    const { data: triggers, error } = await supabase
      .from('hubspot_workflow_triggers')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    // Get execution stats for each trigger
    const { data: stats } = await supabase
      .rpc('get_workflow_trigger_stats', { p_workspace_id: workspaceId });

    // Merge stats with triggers
    const triggersWithStats = triggers.map(trigger => {
      const stat = stats?.find(s => s.trigger_id === trigger.id);
      return {
        ...trigger,
        stats: {
          totalExecutions: stat?.total_executions || 0,
          successfulExecutions: stat?.successful_executions || 0,
          failedExecutions: stat?.failed_executions || 0,
          lastExecution: stat?.last_execution || null,
        }
      };
    });

    return NextResponse.json({ triggers: triggersWithStats });
  } catch (error) {
    console.error('Error fetching workflow triggers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch workflow triggers' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient(cookies());
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { workspaceId, ...triggerConfig } = body;

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID required' }, { status: 400 });
    }

    // Verify user has admin access to workspace
    const { data: workspaceUser } = await supabase
      .from('workspace_users')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single();

    if (!workspaceUser || !['owner', 'admin'].includes(workspaceUser.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Validate trigger configuration
    if (!triggerConfig.name || !triggerConfig.eventType || !triggerConfig.actions?.length) {
      return NextResponse.json(
        { error: 'Invalid trigger configuration' },
        { status: 400 }
      );
    }

    // Create workflow trigger
    const service = createWorkflowTriggerService(workspaceId);
    const trigger = await service.upsertTriggerConfig(triggerConfig);

    return NextResponse.json({ trigger });
  } catch (error) {
    console.error('Error creating workflow trigger:', error);
    return NextResponse.json(
      { error: 'Failed to create workflow trigger' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = createServerClient(cookies());
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { workspaceId, triggerId, ...updates } = body;

    if (!workspaceId || !triggerId) {
      return NextResponse.json(
        { error: 'Workspace ID and Trigger ID required' },
        { status: 400 }
      );
    }

    // Verify user has admin access
    const { data: workspaceUser } = await supabase
      .from('workspace_users')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single();

    if (!workspaceUser || !['owner', 'admin'].includes(workspaceUser.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Update trigger
    const { data: trigger, error } = await supabase
      .from('hubspot_workflow_triggers')
      .update(updates)
      .eq('id', triggerId)
      .eq('workspace_id', workspaceId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ trigger });
  } catch (error) {
    console.error('Error updating workflow trigger:', error);
    return NextResponse.json(
      { error: 'Failed to update workflow trigger' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = createServerClient(cookies());
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const workspaceId = request.nextUrl.searchParams.get('workspaceId');
    const triggerId = request.nextUrl.searchParams.get('triggerId');

    if (!workspaceId || !triggerId) {
      return NextResponse.json(
        { error: 'Workspace ID and Trigger ID required' },
        { status: 400 }
      );
    }

    // Verify user has admin access
    const { data: workspaceUser } = await supabase
      .from('workspace_users')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single();

    if (!workspaceUser || !['owner', 'admin'].includes(workspaceUser.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Delete trigger
    const service = createWorkflowTriggerService(workspaceId);
    await service.deleteTriggerConfig(triggerId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting workflow trigger:', error);
    return NextResponse.json(
      { error: 'Failed to delete workflow trigger' },
      { status: 500 }
    );
  }
}