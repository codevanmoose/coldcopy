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
    
    const { 
      lead_id, 
      content, 
      message_type, 
      campaign_id, 
      workspace_id 
    } = await request.json();
    
    if (!lead_id || !content || !message_type || !workspace_id) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Validate message type
    if (!['connection_request', 'inmail', 'message'].includes(message_type)) {
      return NextResponse.json(
        { error: 'Invalid message type' },
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
    
    // Send message via LinkedIn
    const linkedInService = new LinkedInService(workspace_id);
    const message = await linkedInService.sendMessage(
      lead_id,
      content,
      message_type as 'connection_request' | 'inmail' | 'message',
      campaign_id
    );
    
    return NextResponse.json({
      success: true,
      data: message,
    });
    
  } catch (error) {
    console.error('LinkedIn send message error:', error);
    
    // Check for rate limit error
    if (error instanceof Error && error.message.includes('limit reached')) {
      return NextResponse.json(
        { error: error.message },
        { status: 429 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to send LinkedIn message' },
      { status: 500 }
    );
  }
}