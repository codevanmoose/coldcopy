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

    // Get leads for the workspace (handle missing table gracefully)
    let leads = [];
    try {
      const { data: leadsData, error } = await supabase
        .from('leads')
        .select('*')
        .eq('workspace_id', workspaceData.workspace_id)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Leads table not found or error:', error.message);
        // Return empty array if table doesn't exist
        leads = [];
      } else {
        leads = leadsData || [];
      }
    } catch (e) {
      console.warn('Leads table query failed:', e.message);
      leads = [];
    }

    return NextResponse.json({ leads });
  } catch (error) {
    console.error('Error in /api/leads:', error);
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
    const { email, first_name, last_name, company, title, phone, linkedin_url, notes } = body;

    // Create lead
    const { data: lead, error } = await supabase
      .from('leads')
      .insert({
        workspace_id: workspaceData.workspace_id,
        email,
        first_name,
        last_name,
        company,
        title,
        phone,
        linkedin_url,
        notes,
        status: 'new',
        created_by: user.id
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating lead:', error);
      return NextResponse.json({ error: 'Failed to create lead' }, { status: 500 });
    }

    return NextResponse.json({ lead });
  } catch (error) {
    console.error('Error in /api/leads POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}