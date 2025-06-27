import { NextRequest, NextResponse } from 'next/server';
import { ActivityTimelineService } from '@/lib/integrations/pipedrive/activity-timeline';
import { createServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient(cookies());
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get workspace ID
    const { data: userData } = await supabase
      .from('users')
      .select('workspace_id')
      .eq('id', user.id)
      .single();

    if (!userData?.workspace_id) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const leadId = searchParams.get('leadId') || undefined;
    const campaignId = searchParams.get('campaignId') || undefined;
    const personId = searchParams.get('personId');
    const dealId = searchParams.get('dealId');
    const categories = searchParams.get('categories')?.split(',') || undefined;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const includeThreads = searchParams.get('includeThreads') !== 'false';
    const limit = parseInt(searchParams.get('limit') || '100');

    // Initialize service
    const service = new ActivityTimelineService(userData.workspace_id);

    // Get timeline data
    const timeline = await service.getLeadTimeline(leadId!, {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      categories: categories as any,
      includeEmailThreads: includeThreads,
      limit,
    });

    return NextResponse.json(timeline);

  } catch (error) {
    console.error('Error fetching activity timeline:', error);
    return NextResponse.json(
      { error: 'Failed to fetch activity timeline' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient(cookies());
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get workspace ID
    const { data: userData } = await supabase
      .from('users')
      .select('workspace_id')
      .eq('id', user.id)
      .single();

    if (!userData?.workspace_id) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    // Parse request body
    const body = await request.json();
    const { templateId, leadId, personId, dealId, fieldValues } = body;

    // Initialize service
    const service = new ActivityTimelineService(userData.workspace_id);

    // Create activity from template
    const activity = await service.createActivityFromTemplate(templateId, {
      leadId,
      personId,
      dealId,
      fieldValues,
    });

    return NextResponse.json(activity);

  } catch (error) {
    console.error('Error creating activity:', error);
    return NextResponse.json(
      { error: 'Failed to create activity' },
      { status: 500 }
    );
  }
}