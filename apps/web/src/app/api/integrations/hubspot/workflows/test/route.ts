import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { createWorkflowTriggerService } from '@/lib/integrations/hubspot/workflows';

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient(cookies());
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { workspaceId, triggerId, testData } = body;

    if (!workspaceId || !triggerId) {
      return NextResponse.json(
        { error: 'Workspace ID and Trigger ID required' },
        { status: 400 }
      );
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

    // Verify trigger exists and belongs to workspace
    const { data: trigger, error: triggerError } = await supabase
      .from('hubspot_workflow_triggers')
      .select('*')
      .eq('id', triggerId)
      .eq('workspace_id', workspaceId)
      .single();

    if (triggerError || !trigger) {
      return NextResponse.json({ error: 'Trigger not found' }, { status: 404 });
    }

    // Test the workflow trigger
    const service = createWorkflowTriggerService(workspaceId);
    
    try {
      await service.testTrigger(triggerId, testData);
      
      // Log the test execution
      await supabase
        .from('hubspot_workflow_executions')
        .insert({
          workspace_id: workspaceId,
          trigger_id: triggerId,
          event_id: `test-${Date.now()}`,
          event_type: trigger.event_type,
          lead_id: testData?.leadId || '00000000-0000-0000-0000-000000000000', // Use a valid UUID
          status: 'success',
          metadata: {
            isTest: true,
            testData,
            executedBy: user.id,
          }
        });

      return NextResponse.json({ 
        success: true,
        message: 'Workflow trigger test executed successfully',
        trigger: {
          id: trigger.id,
          name: trigger.name,
          eventType: trigger.event_type,
        }
      });
    } catch (testError: any) {
      // Log the failed test
      await supabase
        .from('hubspot_workflow_executions')
        .insert({
          workspace_id: workspaceId,
          trigger_id: triggerId,
          event_id: `test-${Date.now()}`,
          event_type: trigger.event_type,
          lead_id: testData?.leadId || '00000000-0000-0000-0000-000000000000',
          status: 'failed',
          error_message: testError.message,
          metadata: {
            isTest: true,
            testData,
            executedBy: user.id,
          }
        });

      return NextResponse.json({ 
        success: false,
        message: 'Workflow trigger test failed',
        error: testError.message,
        trigger: {
          id: trigger.id,
          name: trigger.name,
          eventType: trigger.event_type,
        }
      }, { status: 400 });
    }
  } catch (error) {
    console.error('Error testing workflow trigger:', error);
    return NextResponse.json(
      { error: 'Failed to test workflow trigger' },
      { status: 500 }
    );
  }
}