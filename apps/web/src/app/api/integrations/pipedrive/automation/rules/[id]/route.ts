import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { PipelineAutomationEngine } from '@/lib/integrations/pipedrive/pipeline-automation';

interface RouteParams {
  params: {
    id: string;
  };
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
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
    const automationEngine = new PipelineAutomationEngine(workspaceId);

    const body = await request.json();
    const { enabled } = body;

    if (typeof enabled === 'boolean') {
      // Toggle rule enabled/disabled
      await automationEngine.toggleAutomationRule(params.id, enabled);
      return NextResponse.json({ success: true });
    } else {
      // Full rule update would require additional implementation
      return NextResponse.json({ error: 'Only enabled toggle is supported' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error updating automation rule:', error);
    return NextResponse.json(
      { error: 'Failed to update automation rule' },
      { status: 500 }
    );
  }
}