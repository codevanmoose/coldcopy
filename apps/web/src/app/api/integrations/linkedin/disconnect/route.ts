import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { LinkedInAuth } from '@/lib/integrations/linkedin/auth';

export async function POST(request: NextRequest) {
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
    
    // Get workspace ID from request body
    const { workspace_id } = await request.json();
    
    if (!workspace_id) {
      return NextResponse.json(
        { error: 'Workspace ID required' },
        { status: 400 }
      );
    }
    
    // Verify user has access to workspace
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspace_id)
      .eq('user_id', user.id)
      .single();
      
    if (!membership) {
      return NextResponse.json(
        { error: 'Access denied to workspace' },
        { status: 403 }
      );
    }
    
    // Check if user has permission to disconnect integrations
    if (!['workspace_admin', 'super_admin'].includes(membership.role)) {
      return NextResponse.json(
        { error: 'Only workspace admins can disconnect integrations' },
        { status: 403 }
      );
    }
    
    // Disconnect LinkedIn integration
    await LinkedInAuth.disconnect(workspace_id);
    
    return NextResponse.json({
      success: true,
      message: 'LinkedIn integration disconnected successfully',
    });
    
  } catch (error) {
    console.error('LinkedIn disconnect error:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect LinkedIn integration' },
      { status: 500 }
    );
  }
}