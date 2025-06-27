import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { SalesforceService } from '@/lib/integrations/salesforce/service';
import { headers } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret if configured
    const headersList = headers();
    const cronSecret = headersList.get('x-cron-secret');
    
    if (process.env.CRON_SECRET && cronSecret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient();
    const salesforceService = new SalesforceService();
    
    // Get all active Salesforce integrations that need syncing
    const { data: integrations, error: integrationsError } = await supabase
      .from('salesforce_integrations')
      .select('*')
      .eq('is_active', true)
      .eq('sync_enabled', true);

    if (integrationsError) {
      console.error('Error fetching integrations:', integrationsError);
      return NextResponse.json(
        { error: 'Failed to fetch integrations' },
        { status: 500 }
      );
    }

    const results = {
      total: integrations?.length || 0,
      synced: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Process each integration
    for (const integration of integrations || []) {
      try {
        // Check if it's time to sync based on frequency
        const lastSync = integration.last_sync_at
          ? new Date(integration.last_sync_at)
          : new Date(0);
        const nextSync = new Date(
          lastSync.getTime() + integration.sync_frequency_minutes * 60000
        );

        if (nextSync > new Date()) {
          continue; // Skip this integration, not time yet
        }

        // Create sync log
        const { data: syncLog } = await supabase
          .from('salesforce_sync_logs')
          .insert({
            workspace_id: integration.workspace_id,
            sync_type: 'incremental',
            sync_direction: integration.sync_direction,
            objects_synced: [],
            status: 'started',
          })
          .select()
          .single();

        const startTime = Date.now();
        let syncResults = {
          leads: { synced: 0, failed: 0 },
          campaigns: { synced: 0, failed: 0 },
          activities: { synced: 0, failed: 0 },
        };

        try {
          // Sync based on configuration
          if (integration.sync_direction === 'to_salesforce' || 
              integration.sync_direction === 'bidirectional') {
            
            if (integration.sync_leads) {
              const leadResults = await salesforceService.syncLeadsToSalesforce(
                integration.workspace_id
              );
              syncResults.leads.synced += leadResults.synced;
              syncResults.leads.failed += leadResults.failed;
            }

            if (integration.sync_campaigns) {
              const campaignResults = await salesforceService.syncCampaignsToSalesforce(
                integration.workspace_id
              );
              syncResults.campaigns.synced += campaignResults.synced;
              syncResults.campaigns.failed += campaignResults.failed;
            }

            if (integration.sync_activities) {
              const activityResults = await salesforceService.syncEmailActivities(
                integration.workspace_id,
                integration.last_successful_sync_at
              );
              syncResults.activities.synced += activityResults.synced;
              syncResults.activities.failed += activityResults.failed;
            }
          }

          if (integration.sync_direction === 'from_salesforce' || 
              integration.sync_direction === 'bidirectional') {
            
            if (integration.sync_leads) {
              const leadResults = await salesforceService.syncLeadsFromSalesforce(
                integration.workspace_id,
                integration.last_successful_sync_at
              );
              syncResults.leads.synced += leadResults.synced;
              syncResults.leads.failed += leadResults.failed;
            }
          }

          // Process sync queue
          const queueResults = await salesforceService.processSyncQueue(
            integration.workspace_id,
            100
          );

          // Update sync log
          const totalSynced = syncResults.leads.synced + 
                            syncResults.campaigns.synced + 
                            syncResults.activities.synced +
                            queueResults.processed;
          const totalFailed = syncResults.leads.failed + 
                            syncResults.campaigns.failed + 
                            syncResults.activities.failed +
                            queueResults.failed;

          await supabase
            .from('salesforce_sync_logs')
            .update({
              total_records: totalSynced + totalFailed,
              created_records: totalSynced,
              failed_records: totalFailed,
              duration_seconds: Math.floor((Date.now() - startTime) / 1000),
              status: 'completed',
              completed_at: new Date().toISOString(),
            })
            .eq('id', syncLog.id);

          // Update integration timestamps
          await supabase
            .from('salesforce_integrations')
            .update({
              last_sync_at: new Date().toISOString(),
              last_successful_sync_at: totalFailed === 0 
                ? new Date().toISOString() 
                : integration.last_successful_sync_at,
            })
            .eq('id', integration.id);

          results.synced++;
        } catch (error) {
          results.failed++;
          results.errors.push(`Workspace ${integration.workspace_id}: ${error}`);

          // Update sync log with error
          await supabase
            .from('salesforce_sync_logs')
            .update({
              status: 'failed',
              error_message: String(error),
              completed_at: new Date().toISOString(),
            })
            .eq('id', syncLog.id);
        }
      } catch (error) {
        results.failed++;
        results.errors.push(`Integration ${integration.id}: ${error}`);
        console.error(`Error processing integration ${integration.id}:`, error);
      }
    }

    console.log('Salesforce sync cron job completed:', results);

    return NextResponse.json({
      success: true,
      message: 'Salesforce sync cron job completed',
      results,
    });
  } catch (error) {
    console.error('Salesforce sync cron job error:', error);
    return NextResponse.json(
      { error: 'Failed to run sync job' },
      { status: 500 }
    );
  }
}

// Also support POST for manual triggers
export async function POST(request: NextRequest) {
  return GET(request);
}