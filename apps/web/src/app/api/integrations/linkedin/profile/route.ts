import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

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
    
    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const workspaceId = searchParams.get('workspace_id');
    const leadId = searchParams.get('lead_id');
    
    if (!workspaceId || !leadId) {
      return NextResponse.json(
        { error: 'Workspace ID and lead ID required' },
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
    
    // Get LinkedIn profile for the lead
    const { data: profile, error } = await supabase
      .from('linkedin_profiles')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('lead_id', leadId)
      .single();
      
    if (error) {
      if (error.code === 'PGRST116') { // Not found
        return NextResponse.json(
          { error: 'LinkedIn profile not found' },
          { status: 404 }
        );
      }
      throw error;
    }
    
    return NextResponse.json({
      profile,
    });
    
  } catch (error) {
    console.error('LinkedIn profile fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch LinkedIn profile' },
      { status: 500 }
    );
  }
}