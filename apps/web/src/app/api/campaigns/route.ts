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

    // Get campaigns for the workspace (handle missing table gracefully)
    let campaigns = [];
    try {
      const { data: campaignsData, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('workspace_id', workspaceData.workspace_id)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Campaigns table not found or error:', error.message);
        // Return empty array if table doesn't exist
        campaigns = [];
      } else {
        campaigns = campaignsData || [];
      }
    } catch (e) {
      console.warn('Campaigns table query failed:', e.message);
      campaigns = [];
    }

    return NextResponse.json({ campaigns });
  } catch (error) {
    console.error('Error in /api/campaigns:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { name, description, email_sequence, target_audience, settings } = body;

    // Create campaign
    const { data: campaign, error } = await supabase
      .from('campaigns')
      .insert({
        workspace_id: workspaceData.workspace_id,
        name,
        description,
        email_sequence,
        target_audience,
        settings,
        status: 'draft',
        created_by: user.id
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating campaign:', error);
      return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 });
    }

    return NextResponse.json({ campaign });
  } catch (error) {
    console.error('Error in /api/campaigns POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}