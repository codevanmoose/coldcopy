import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { LinkedInService } from '@/lib/integrations/linkedin/service';

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
    
    const { lead_id, linkedin_url, workspace_id } = await request.json();
    
    if (!lead_id || !workspace_id) {
      return NextResponse.json(
        { error: 'Lead ID and workspace ID required' },
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
    
    // Check if LinkedIn is connected
    const { data: integration } = await supabase
      .from('linkedin_integrations')
      .select('id')
      .eq('workspace_id', workspace_id)
      .eq('is_active', true)
      .single();
      
    if (!integration) {
      return NextResponse.json(
        { error: 'LinkedIn integration not connected' },
        { status: 400 }
      );
    }
    
    // Enrich lead with LinkedIn data
    const linkedInService = new LinkedInService(workspace_id);
    const profile = await linkedInService.enrichLead(lead_id, linkedin_url);
    
    if (!profile) {
      return NextResponse.json(
        { error: 'Could not find LinkedIn profile' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: profile,
    });
    
  } catch (error) {
    console.error('LinkedIn enrich error:', error);
    return NextResponse.json(
      { error: 'Failed to enrich lead with LinkedIn data' },
      { status: 500 }
    );
  }
}