import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { EmailDeliverabilityService } from '@/lib/email-deliverability/service';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createServerClient(cookieStore);
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Get workspace ID from query params
    const searchParams = request.nextUrl.searchParams;
    const workspaceId = searchParams.get('workspace_id');
    
    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Workspace ID required' },
        { status: 400 }
      );
    }
    
    // Verify user has access to workspace
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single();
      
    if (!membership) {
      return NextResponse.json(
        { error: 'Access denied to workspace' },
        { status: 403 }
      );
    }
    
    // Get all sending domains for the workspace
    const { data: domains } = await supabase
      .from('domain_reputation')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('domain');
      
    // If no domains found, check the default workspace domain
    if (!domains || domains.length === 0) {
      const { data: workspace } = await supabase
        .from('workspaces')
        .select('name')
        .eq('id', workspaceId)
        .single();
        
      if (workspace) {
        // Create a default domain entry
        const defaultDomain = `${workspace.name.toLowerCase().replace(/\s+/g, '-')}.coldcopy.cc`;
        const deliverability = new EmailDeliverabilityService(workspaceId);
        const reputation = await deliverability.checkDomainReputation(defaultDomain);
        
        return NextResponse.json([reputation]);
      }
    }
    
    return NextResponse.json(domains || []);
    
  } catch (error) {
    console.error('Domain reputation error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch domain reputation' },
      { status: 500 }
    );
  }
}