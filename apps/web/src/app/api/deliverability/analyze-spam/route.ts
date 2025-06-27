import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { EmailDeliverabilityService } from '@/lib/email-deliverability/service';

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
    
    const body = await request.json();
    const { workspace_id, subject, body_html, body_text, from_name, from_email } = body;
    
    if (!workspace_id || !subject || (!body_html && !body_text)) {
      return NextResponse.json(
        { error: 'Missing required fields' },
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
    
    // Analyze spam score
    const deliverability = new EmailDeliverabilityService(workspace_id);
    const analysis = await deliverability.analyzeSpamScore(
      subject,
      body_html || '',
      body_text || '',
      from_name,
      from_email
    );
    
    return NextResponse.json(analysis);
    
  } catch (error) {
    console.error('Spam analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze spam score' },
      { status: 500 }
    );
  }
}