import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/supabase/api-auth';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) {
      return NextResponse.json(authResult.error, { status: authResult.status });
    }
    
    const { supabase, user } = authResult;

    // Get user's workspace
    const { data: workspaceData } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .single();

    if (!workspaceData) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 });
    }

    // Get analytics overview for the workspace
    const workspaceId = workspaceData.workspace_id;

    // Get total counts
    const [
      { count: totalLeads },
      { count: totalCampaigns },
      { count: totalTemplates },
      { count: sentEmails }
    ] = await Promise.all([
      supabase.from('leads').select('*', { count: 'exact', head: true }).eq('workspace_id', workspaceId),
      supabase.from('campaigns').select('*', { count: 'exact', head: true }).eq('workspace_id', workspaceId),
      supabase.from('templates').select('*', { count: 'exact', head: true }).eq('workspace_id', workspaceId),
      supabase.from('email_sends').select('*', { count: 'exact', head: true }).eq('workspace_id', workspaceId)
    ]);

    // Get recent campaign performance
    const { data: recentCampaigns } = await supabase
      .from('campaigns')
      .select('name, created_at, status')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(5);

    // Get email metrics
    const { data: emailMetrics } = await supabase
      .from('email_sends')
      .select('sent_at, opened_at, clicked_at, replied_at')
      .eq('workspace_id', workspaceId)
      .limit(100);

    // Calculate metrics
    const openRate = emailMetrics && emailMetrics.length > 0 
      ? (emailMetrics.filter(e => e.opened_at).length / emailMetrics.length) * 100 
      : 0;

    const clickRate = emailMetrics && emailMetrics.length > 0 
      ? (emailMetrics.filter(e => e.clicked_at).length / emailMetrics.length) * 100 
      : 0;

    const replyRate = emailMetrics && emailMetrics.length > 0 
      ? (emailMetrics.filter(e => e.replied_at).length / emailMetrics.length) * 100 
      : 0;

    const analytics = {
      overview: {
        totalLeads: totalLeads || 0,
        totalCampaigns: totalCampaigns || 0,
        totalTemplates: totalTemplates || 0,
        sentEmails: sentEmails || 0,
        openRate: Math.round(openRate),
        clickRate: Math.round(clickRate),
        replyRate: Math.round(replyRate)
      },
      recentCampaigns: recentCampaigns || [],
      emailPerformance: {
        sent: sentEmails || 0,
        opened: emailMetrics ? emailMetrics.filter(e => e.opened_at).length : 0,
        clicked: emailMetrics ? emailMetrics.filter(e => e.clicked_at).length : 0,
        replied: emailMetrics ? emailMetrics.filter(e => e.replied_at).length : 0
      }
    };

    return NextResponse.json({ analytics });
  } catch (error) {
    console.error('Error in /api/analytics/overview:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}