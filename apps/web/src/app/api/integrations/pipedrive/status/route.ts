import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { PipedriveAuth } from '@/lib/integrations/pipedrive/auth';

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

    // Get integration status
    const auth = new PipedriveAuth();
    const integration = await auth.getIntegration(workspaceId);

    if (!integration) {
      return NextResponse.json({ 
        connected: false,
        companyDomain: null,
        scopes: [],
        createdAt: null
      });
    }

    // Test connection
    const isConnected = await auth.testConnection(workspaceId);

    return NextResponse.json({
      connected: isConnected,
      companyDomain: integration.companyDomain,
      scopes: integration.scopes,
      tokenType: integration.tokenType,
      createdAt: integration.createdAt,
      updatedAt: integration.updatedAt
    });
  } catch (error) {
    console.error('Pipedrive status error:', error);
    return NextResponse.json(
      { error: 'Failed to get Pipedrive integration status' },
      { status: 500 }
    );
  }
}