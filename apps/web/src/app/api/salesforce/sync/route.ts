import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { SalesforceService } from '@/lib/integrations/salesforce/service';

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      workspace_id,
      sync_type,
      sync_direction,
      object_types,
      lead_ids,
      campaign_ids,
      modified_since,
    } = body;

    if (!workspace_id || !sync_type) {
      return NextResponse.json(
        { error: 'workspace_id and sync_type are required' },
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

    // Check if Salesforce integration exists
    const { data: integration } = await supabase
      .from('salesforce_integrations')
      .select('id, is_active, sync_enabled')
      .eq('workspace_id', workspace_id)
      .single();

    if (!integration || !integration.is_active) {
      return NextResponse.json(
        { error: 'Salesforce integration not found or inactive' },
        { status: 404 }
      );
    }

    if (!integration.sync_enabled) {
      return NextResponse.json(
        { error: 'Salesforce sync is disabled' },
        { status: 400 }
      );
    }

    const salesforceService = new SalesforceService();
    const results = {
      leads: { synced: 0, failed: 0, errors: [] as string[] },
      campaigns: { synced: 0, failed: 0, errors: [] as string[] },
      activities: { synced: 0, failed: 0, errors: [] as string[] },
    };

    // Create sync log
    const { data: syncLog } = await supabase
      .from('salesforce_sync_logs')
      .insert({
        workspace_id,
        sync_type,
        sync_direction: sync_direction || 'bidirectional',
        objects_synced: object_types || ['Lead', 'Campaign'],
        status: 'started',
      })
      .select()
      .single();

    const startTime = Date.now();

    try {
      // Sync based on direction and object types
      if (sync_direction === 'to_salesforce' || sync_direction === 'bidirectional') {
        if (!object_types || object_types.includes('Lead')) {
          const leadResults = await salesforceService.syncLeadsToSalesforce(
            workspace_id,
            lead_ids
          );
          results.leads = leadResults;
        }

        if (!object_types || object_types.includes('Campaign')) {
          const campaignResults = await salesforceService.syncCampaignsToSalesforce(
            workspace_id,
            campaign_ids
          );
          results.campaigns = campaignResults;
        }

        if (!object_types || object_types.includes('Task')) {
          const activityResults = await salesforceService.syncEmailActivities(
            workspace_id,
            modified_since
          );
          results.activities = activityResults;
        }
      }

      if (sync_direction === 'from_salesforce' || sync_direction === 'bidirectional') {
        if (!object_types || object_types.includes('Lead')) {
          const leadResults = await salesforceService.syncLeadsFromSalesforce(
            workspace_id,
            modified_since
          );
          results.leads = {
            synced: results.leads.synced + leadResults.synced,
            failed: results.leads.failed + leadResults.failed,
            errors: [...results.leads.errors, ...leadResults.errors],
          };
        }
      }

      // Update sync log
      const totalSynced = results.leads.synced + results.campaigns.synced + results.activities.synced;
      const totalFailed = results.leads.failed + results.campaigns.failed + results.activities.failed;
      const allErrors = [
        ...results.leads.errors,
        ...results.campaigns.errors,
        ...results.activities.errors,
      ];

      await supabase
        .from('salesforce_sync_logs')
        .update({
          total_records: totalSynced + totalFailed,
          created_records: totalSynced,
          failed_records: totalFailed,
          duration_seconds: Math.floor((Date.now() - startTime) / 1000),
          status: totalFailed === 0 ? 'completed' : 'completed',
          error_message: allErrors.length > 0 ? allErrors.join('; ') : null,
          warnings: allErrors,
          completed_at: new Date().toISOString(),
        })
        .eq('id', syncLog.id);

      // Update last sync timestamp
      await supabase
        .from('salesforce_integrations')
        .update({
          last_sync_at: new Date().toISOString(),
          last_successful_sync_at: totalFailed === 0 ? new Date().toISOString() : undefined,
        })
        .eq('workspace_id', workspace_id);

      return NextResponse.json({
        success: true,
        results,
        sync_log_id: syncLog.id,
      });
    } catch (error) {
      // Update sync log with error
      await supabase
        .from('salesforce_sync_logs')
        .update({
          status: 'failed',
          error_message: String(error),
          completed_at: new Date().toISOString(),
        })
        .eq('id', syncLog.id);

      throw error;
    }
  } catch (error) {
    console.error('Salesforce sync error:', error);
    return NextResponse.json(
      { error: 'Failed to sync with Salesforce' },
      { status: 500 }
    );
  }
}

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

    // Get sync status
    const { data: integration } = await supabase
      .from('salesforce_integrations')
      .select('last_sync_at, last_successful_sync_at')
      .eq('workspace_id', workspace_id)
      .single();

    // Get pending items in queue
    const { data: pendingCount } = await supabase
      .from('salesforce_sync_queue')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspace_id)
      .eq('status', 'pending');

    // Get recent sync logs
    const { data: recentLogs } = await supabase
      .from('salesforce_sync_logs')
      .select('*')
      .eq('workspace_id', workspace_id)
      .order('started_at', { ascending: false })
      .limit(5);

    // Check if currently syncing
    const { data: activeSync } = await supabase
      .from('salesforce_sync_logs')
      .select('id')
      .eq('workspace_id', workspace_id)
      .eq('status', 'started')
      .single();

    return NextResponse.json({
      is_syncing: !!activeSync,
      last_sync_at: integration?.last_sync_at,
      last_successful_sync_at: integration?.last_successful_sync_at,
      objects_pending: pendingCount?.count || 0,
      recent_logs: recentLogs || [],
    });
  } catch (error) {
    console.error('Salesforce sync status error:', error);
    return NextResponse.json(
      { error: 'Failed to get sync status' },
      { status: 500 }
    );
  }
}