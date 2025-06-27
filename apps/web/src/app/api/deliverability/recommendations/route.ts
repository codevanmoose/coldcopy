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
    
    // Get recommendations
    const deliverability = new EmailDeliverabilityService(workspaceId);
    const recommendations = await deliverability.getRecommendations();
    
    // If no recommendations exist, create default ones
    if (!recommendations || recommendations.length === 0) {
      // Check domain reputation to create specific recommendations
      const { data: domains } = await supabase
        .from('domain_reputation')
        .select('*')
        .eq('workspace_id', workspaceId);
        
      const newRecommendations = [];
      
      // Check for authentication issues
      const hasAuthIssues = domains?.some(d => !d.spf_valid || !d.dkim_valid || !d.dmarc_valid);
      if (hasAuthIssues) {
        newRecommendations.push({
          category: 'authentication',
          priority: 'critical',
          title: 'Fix Email Authentication',
          description: 'One or more of your domains have authentication issues',
          action_items: [
            'Add SPF records to your DNS',
            'Configure DKIM signing',
            'Set up DMARC policy',
          ],
          impact_score: 10,
          estimated_improvement: '30-50% better deliverability',
        });
      }
      
      // Check for high bounce rates
      const hasHighBounce = domains?.some(d => d.bounce_rate > 5);
      if (hasHighBounce) {
        newRecommendations.push({
          category: 'reputation',
          priority: 'high',
          title: 'Reduce Bounce Rate',
          description: 'Your bounce rate is above recommended levels',
          action_items: [
            'Clean your email list regularly',
            'Use double opt-in for new subscribers',
            'Verify email addresses before sending',
          ],
          impact_score: 8,
          estimated_improvement: '20% better reputation',
        });
      }
      
      return NextResponse.json(newRecommendations);
    }
    
    return NextResponse.json(recommendations);
    
  } catch (error) {
    console.error('Recommendations error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recommendations' },
      { status: 500 }
    );
  }
}