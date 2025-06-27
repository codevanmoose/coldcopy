import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { LinkedInAnalyticsService } from '@/lib/integrations/linkedin/analytics-service';
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
    
    // Get all active workspaces with LinkedIn integrations
    const { data: workspaces, error: workspacesError } = await supabase
      .from('workspaces')
      .select(`
        id,
        name,
        linkedin_integrations!inner(
          id,
          is_active
        )
      `)
      .eq('linkedin_integrations.is_active', true);

    if (workspacesError) {
      console.error('Error fetching workspaces:', workspacesError);
      return NextResponse.json(
        { error: 'Failed to fetch workspaces' },
        { status: 500 }
      );
    }

    const results = {
      total: workspaces?.length || 0,
      successful: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Process each workspace
    for (const workspace of workspaces || []) {
      try {
        // Calculate daily analytics
        const analyticsResult = await LinkedInAnalyticsService.calculateDailyAnalytics(
          workspace.id
        );

        if (analyticsResult.success) {
          results.successful++;

          // Update campaign analytics
          const { data: campaigns } = await supabase
            .from('campaigns')
            .select('id')
            .eq('workspace_id', workspace.id)
            .eq('channel', 'linkedin')
            .eq('status', 'active');

          for (const campaign of campaigns || []) {
            await LinkedInAnalyticsService.updateCampaignAnalytics(
              workspace.id,
              campaign.id
            );
          }

          // Detect engagement patterns every Sunday
          if (new Date().getDay() === 0) {
            await LinkedInAnalyticsService.detectEngagementPatterns(workspace.id);
          }
        } else {
          results.failed++;
          results.errors.push(`Workspace ${workspace.id}: ${analyticsResult.error}`);
        }
      } catch (error) {
        results.failed++;
        results.errors.push(`Workspace ${workspace.id}: ${error}`);
        console.error(`Error processing workspace ${workspace.id}:`, error);
      }
    }

    // Refresh materialized view
    if (results.successful > 0) {
      await LinkedInAnalyticsService.refreshEngagementOverview();
    }

    console.log('LinkedIn analytics cron job completed:', results);

    return NextResponse.json({
      success: true,
      message: 'LinkedIn analytics calculation completed',
      results,
    });
  } catch (error) {
    console.error('LinkedIn analytics cron job error:', error);
    return NextResponse.json(
      { error: 'Failed to run analytics job' },
      { status: 500 }
    );
  }
}

// Also support POST for manual triggers
export async function POST(request: NextRequest) {
  return GET(request);
}