import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { SalesforceAuth } from '@/lib/integrations/salesforce/auth';
import { v4 as uuidv4 } from 'uuid';

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const workspaceId = searchParams.get('workspace_id');
    const action = searchParams.get('action');

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'workspace_id is required' },
        { status: 400 }
      );
    }

    // Verify user has access to workspace
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single();

    if (!member || !['workspace_admin', 'super_admin'].includes(member.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const auth = new SalesforceAuth({
      client_id: process.env.SALESFORCE_CLIENT_ID!,
      client_secret: process.env.SALESFORCE_CLIENT_SECRET!,
      redirect_uri: process.env.SALESFORCE_REDIRECT_URI!,
      sandbox: process.env.SALESFORCE_SANDBOX === 'true',
    });

    if (action === 'connect') {
      // Generate state token
      const state = `${workspaceId}:${uuidv4()}`;
      
      // Store state in session (you might want to use a more persistent storage)
      const authUrl = auth.getAuthorizationUrl(state);
      
      return NextResponse.json({ auth_url: authUrl });
    } else if (action === 'disconnect') {
      // Get integration
      const { data: integration } = await supabase
        .from('salesforce_integrations')
        .select('access_token, refresh_token')
        .eq('workspace_id', workspaceId)
        .single();

      if (integration) {
        // Revoke tokens
        try {
          const accessToken = auth.decryptToken(integration.access_token);
          await auth.revokeToken(accessToken);
        } catch (error) {
          console.error('Error revoking token:', error);
        }

        // Delete integration
        await supabase
          .from('salesforce_integrations')
          .delete()
          .eq('workspace_id', workspaceId);

        // Delete all mappings
        await supabase
          .from('salesforce_object_mappings')
          .delete()
          .eq('workspace_id', workspaceId);
      }

      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json(
        { error: 'Invalid action. Use connect or disconnect' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Salesforce auth error:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}