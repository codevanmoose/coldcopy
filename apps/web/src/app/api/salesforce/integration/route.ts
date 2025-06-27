import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const workspace_id = searchParams.get('workspace_id');

    if (!workspace_id) {
      return NextResponse.json(
        { error: 'workspace_id is required' },
        { status: 400 }
      );
    }

    // Verify user has access to workspace
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspace_id)
      .eq('user_id', user.id)
      .single();

    if (!member) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Get integration details (excluding sensitive fields)
    const { data: integration, error } = await supabase
      .from('salesforce_integrations')
      .select(`
        id,
        workspace_id,
        instance_url,
        salesforce_user_id,
        salesforce_org_id,
        salesforce_username,
        salesforce_email,
        is_active,
        sync_enabled,
        sync_direction,
        sync_leads,
        sync_contacts,
        sync_accounts,
        sync_opportunities,
        sync_activities,
        sync_campaigns,
        sync_frequency_minutes,
        last_sync_at,
        last_successful_sync_at,
        api_version,
        created_at,
        updated_at
      `)
      .eq('workspace_id', workspace_id)
      .single();

    if (error && error.code !== 'PGRST116') {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ integration });
  } catch (error) {
    console.error('Salesforce integration fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch integration' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { workspace_id, settings } = body;

    if (!workspace_id || !settings) {
      return NextResponse.json(
        { error: 'workspace_id and settings are required' },
        { status: 400 }
      );
    }

    // Verify user has access to workspace
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspace_id)
      .eq('user_id', user.id)
      .single();

    if (!member || !['workspace_admin', 'super_admin'].includes(member.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Update integration settings
    const { data: integration, error } = await supabase
      .from('salesforce_integrations')
      .update({
        sync_enabled: settings.sync_enabled,
        sync_direction: settings.sync_direction,
        sync_leads: settings.sync_leads,
        sync_contacts: settings.sync_contacts,
        sync_accounts: settings.sync_accounts,
        sync_opportunities: settings.sync_opportunities,
        sync_activities: settings.sync_activities,
        sync_campaigns: settings.sync_campaigns,
        sync_frequency_minutes: settings.sync_frequency_minutes,
        updated_at: new Date().toISOString(),
      })
      .eq('workspace_id', workspace_id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ integration });
  } catch (error) {
    console.error('Salesforce integration update error:', error);
    return NextResponse.json(
      { error: 'Failed to update integration' },
      { status: 500 }
    );
  }
}