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
    
    // Get LinkedIn integration
    const { data: integration, error } = await supabase
      .from('linkedin_integrations')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('is_active', true)
      .single();
      
    if (error && error.code !== 'PGRST116') { // Not found is ok
      console.error('Error fetching LinkedIn integration:', error);
      throw error;
    }
    
    // Get usage stats for today
    let todayStats = null;
    if (integration) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { data: messages } = await supabase
        .from('linkedin_messages')
        .select('message_type, status')
        .eq('workspace_id', workspaceId)
        .gte('sent_at', today.toISOString())
        .in('status', ['sent', 'delivered', 'read', 'replied']);
        
      if (messages) {
        todayStats = {
          connectionRequestsSent: messages.filter(m => m.message_type === 'connection_request').length,
          messagesSent: messages.filter(m => m.message_type !== 'connection_request').length,
        };
      }
    }
    
    return NextResponse.json({
      integration,
      todayStats,
      connected: !!integration,
    });
    
  } catch (error) {
    console.error('LinkedIn status error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch LinkedIn status' },
      { status: 500 }
    );
  }
}