import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { LinkedInAuth } from '@/lib/integrations/linkedin/auth';

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
    
    // Get workspace ID from query params or user's default workspace
    const searchParams = request.nextUrl.searchParams;
    let workspaceId = searchParams.get('workspace_id');
    
    if (!workspaceId) {
      // Get user's default workspace
      const { data: member } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', user.id)
        .single();
        
      if (!member) {
        return NextResponse.json(
          { error: 'No workspace found' },
          { status: 400 }
        );
      }
      
      workspaceId = member.workspace_id;
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
    
    // Check if user has permission to connect integrations
    if (!['workspace_admin', 'super_admin'].includes(membership.role)) {
      return NextResponse.json(
        { error: 'Only workspace admins can connect integrations' },
        { status: 403 }
      );
    }
    
    // Generate authorization URL
    const authUrl = await LinkedInAuth.getAuthorizationUrl(workspaceId, user.id);
    
    // Redirect to LinkedIn OAuth
    return NextResponse.redirect(authUrl);
    
  } catch (error) {
    console.error('LinkedIn connect error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate LinkedIn connection' },
      { status: 500 }
    );
  }
}