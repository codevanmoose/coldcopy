import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Pipedrive API client
class PipedriveClient {
  private accessToken: string;
  private companyDomain: string;

  constructor(accessToken: string, companyDomain: string) {
    this.accessToken = accessToken;
    this.companyDomain = companyDomain;
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(
      `https://${this.companyDomain}.pipedrive.com/api/v1${endpoint}`,
      {
        ...options,
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Pipedrive API error: ${error.error || response.statusText}`);
    }

    return response.json();
  }

  async createPerson(data: any) {
    return this.request('/persons', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updatePerson(id: number, data: any) {
    return this.request(`/persons/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deletePerson(id: number) {
    return this.request(`/persons/${id}`, {
      method: 'DELETE',
    });
  }

  async createDeal(data: any) {
    return this.request('/deals', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateDeal(id: number, data: any) {
    return this.request(`/deals/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async createActivity(data: any) {
    return this.request('/activities', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
}

// Field mapping functions
function mapLeadToPipedrivePerson(lead: any, fieldMappings: any[]): any {
  const defaultMapping = {
    name: `${lead.first_name} ${lead.last_name}`.trim() || lead.email,
    first_name: lead.first_name,
    last_name: lead.last_name,
    email: lead.email ? [{ value: lead.email, primary: true }] : undefined,
    phone: lead.phone ? [{ value: lead.phone, primary: true }] : undefined,
    org_name: lead.company,
  };

  // Apply custom field mappings
  let mappedData = { ...defaultMapping };
  for (const mapping of fieldMappings) {
    if (mapping.source_system === 'coldcopy' && mapping.target_system === 'pipedrive') {
      const sourceValue = lead[mapping.source_field];
      if (sourceValue !== undefined) {
        mappedData[mapping.target_field] = sourceValue;
      }
    }
  }

  return mappedData;
}

function mapCampaignActivityToPipedrive(activity: any, personId: number, dealId?: number): any {
  return {
    subject: activity.subject || 'Email Campaign Activity',
    type: 'email',
    person_id: personId,
    deal_id: dealId,
    done: 1,
    note: activity.body || '',
    due_date: new Date().toISOString().split('T')[0],
    due_time: new Date().toISOString().split('T')[1].substring(0, 5),
  };
}

// Sync a single lead to Pipedrive
async function syncLeadToPipedrive(
  lead: any,
  workspaceId: string,
  pipedrive: PipedriveClient,
  fieldMappings: any[]
): Promise<void> {
  const lockId = uuidv4();
  
  try {
    // Acquire sync lock
    const lockAcquired = await supabase.rpc('acquire_pipedrive_sync_lock', {
      p_workspace_id: workspaceId,
      p_entity_type: 'person',
      p_entity_id: lead.id,
      p_lock_type: 'exclusive',
      p_locked_by: lockId,
    });

    if (!lockAcquired) {
      throw new Error('Could not acquire sync lock');
    }

    // Check existing sync status
    const { data: syncStatus } = await supabase
      .from('pipedrive_sync_status')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('entity_type', 'person')
      .eq('entity_id', lead.id)
      .single();

    const personData = mapLeadToPipedrivePerson(lead, fieldMappings);

    if (syncStatus?.pipedrive_id) {
      // Update existing person
      const result = await pipedrive.updatePerson(syncStatus.pipedrive_id, personData);
      
      // Update sync status
      await supabase
        .from('pipedrive_sync_status')
        .update({
          last_synced_at: new Date().toISOString(),
          sync_hash: JSON.stringify(result.data),
          status: 'synced',
        })
        .eq('id', syncStatus.id);
    } else {
      // Create new person
      const result = await pipedrive.createPerson(personData);
      
      // Create sync status
      await supabase
        .from('pipedrive_sync_status')
        .insert({
          workspace_id: workspaceId,
          entity_type: 'person',
          entity_id: lead.id,
          pipedrive_id: result.data.id,
          last_synced_at: new Date().toISOString(),
          sync_hash: JSON.stringify(result.data),
          status: 'synced',
        });

      // Update lead with Pipedrive ID
      await supabase
        .from('leads')
        .update({
          metadata: supabase.raw(`metadata || '{"pipedrive_id": ${result.data.id}}'::jsonb`),
        })
        .eq('id', lead.id);
    }

  } finally {
    // Release sync lock
    await supabase.rpc('release_pipedrive_sync_lock', {
      p_workspace_id: workspaceId,
      p_entity_type: 'person',
      p_entity_id: lead.id,
      p_locked_by: lockId,
    });
  }
}

// Process sync queue
async function processSyncQueue(workspaceId: string, pipedrive: PipedriveClient): Promise<{
  processed: number;
  failed: number;
  conflicts: number;
}> {
  let processed = 0;
  let failed = 0;
  let conflicts = 0;

  // Get next items from queue
  const { data: queueItems } = await supabase.rpc('get_next_pipedrive_sync_items', {
    p_limit: 10,
  });

  if (!queueItems || queueItems.length === 0) {
    return { processed, failed, conflicts };
  }

  // Get field mappings
  const { data: fieldMappings } = await supabase
    .from('pipedrive_field_mappings')
    .select('*')
    .eq('workspace_id', workspaceId);

  for (const item of queueItems) {
    try {
      switch (item.entity_type) {
        case 'person':
          if (item.operation === 'create' || item.operation === 'update') {
            await syncLeadToPipedrive(item.data, workspaceId, pipedrive, fieldMappings || []);
          } else if (item.operation === 'delete' && item.pipedrive_id) {
            await pipedrive.deletePerson(item.pipedrive_id);
          }
          break;

        case 'activity':
          if (item.operation === 'create') {
            const activityData = mapCampaignActivityToPipedrive(
              item.data,
              item.data.pipedrive_person_id,
              item.data.pipedrive_deal_id
            );
            await pipedrive.createActivity(activityData);
          }
          break;

        // Add more entity types as needed
      }

      // Mark as completed
      await supabase
        .from('pipedrive_sync_queue')
        .update({
          status: 'completed',
          processed_at: new Date().toISOString(),
        })
        .eq('id', item.queue_id);

      processed++;

    } catch (error) {
      console.error(`Sync queue item ${item.queue_id} failed:`, error);
      
      // Mark as failed
      await supabase
        .from('pipedrive_sync_queue')
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error',
          processed_at: new Date().toISOString(),
        })
        .eq('id', item.queue_id);

      failed++;
    }
  }

  // Update metrics
  await supabase.rpc('update_pipedrive_sync_metrics', {
    p_workspace_id: workspaceId,
    p_entity_type: 'all',
    p_sync_operations: processed + failed,
    p_sync_conflicts: conflicts,
  });

  return { processed, failed, conflicts };
}

// Manual sync endpoint
export async function POST(request: NextRequest) {
  try {
    // Get session
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { entity_type, entity_ids, full_sync = false } = body;

    // Get workspace
    const { data: workspaceUser, error: workspaceError } = await supabase
      .from('workspace_users')
      .select('workspace_id')
      .eq('user_id', session.user.id)
      .single();

    if (workspaceError || !workspaceUser) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    const { workspace_id } = workspaceUser;

    // Get Pipedrive integration
    const { data: integration, error: integrationError } = await supabase
      .from('pipedrive_integrations')
      .select('*')
      .eq('workspace_id', workspace_id)
      .single();

    if (integrationError || !integration) {
      return NextResponse.json({ error: 'Pipedrive not connected' }, { status: 400 });
    }

    const pipedrive = new PipedriveClient(integration.access_token, integration.company_domain);

    if (full_sync) {
      // Queue all entities for sync
      let query = supabase
        .from('leads')
        .select('id, email, first_name, last_name, company, phone, metadata')
        .eq('workspace_id', workspace_id)
        .is('deleted_at', null);

      if (entity_type === 'person' && entity_ids?.length > 0) {
        query = query.in('id', entity_ids);
      }

      const { data: leads, error: leadsError } = await query;

      if (leadsError) {
        throw new Error(`Failed to fetch leads: ${leadsError.message}`);
      }

      // Queue sync for each lead
      const syncQueueItems = leads?.map(lead => ({
        workspace_id,
        operation: 'update' as const,
        entity_type: 'person' as const,
        entity_id: lead.id,
        data: lead,
        priority: 5,
      })) || [];

      if (syncQueueItems.length > 0) {
        await supabase
          .from('pipedrive_sync_queue')
          .insert(syncQueueItems);
      }

      return NextResponse.json({
        message: 'Full sync queued',
        queued_count: syncQueueItems.length,
      });
    }

    // Process existing sync queue
    const results = await processSyncQueue(workspace_id, pipedrive);

    return NextResponse.json({
      message: 'Sync completed',
      ...results,
    });

  } catch (error) {
    console.error('Bidirectional sync error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    );
  }
}

// Get sync status
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get workspace
    const { data: workspaceUser, error: workspaceError } = await supabase
      .from('workspace_users')
      .select('workspace_id')
      .eq('user_id', session.user.id)
      .single();

    if (workspaceError || !workspaceUser) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    // Get sync queue status
    const { data: queueStatus } = await supabase
      .from('pipedrive_sync_queue')
      .select('status, count(*)')
      .eq('workspace_id', workspaceUser.workspace_id)
      .group('status');

    // Get recent sync conflicts
    const { data: conflicts } = await supabase
      .from('pipedrive_sync_conflicts')
      .select('*')
      .eq('workspace_id', workspaceUser.workspace_id)
      .eq('resolution_status', 'pending')
      .order('created_at', { ascending: false })
      .limit(10);

    // Get sync metrics for today
    const { data: metrics } = await supabase
      .from('pipedrive_sync_metrics')
      .select('*')
      .eq('workspace_id', workspaceUser.workspace_id)
      .eq('metric_date', new Date().toISOString().split('T')[0]);

    return NextResponse.json({
      queue: queueStatus || [],
      conflicts: conflicts || [],
      metrics: metrics || [],
    });

  } catch (error) {
    console.error('Get sync status error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get sync status' },
      { status: 500 }
    );
  }
}