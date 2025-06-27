import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ContactSyncService } from '@/lib/integrations/hubspot/sync/contacts'
import { CompanySyncService } from '@/lib/integrations/hubspot/sync/companies'
import { DealSyncService } from '@/lib/integrations/hubspot/sync/deals'
import { ActivitySyncService } from '@/lib/integrations/hubspot/sync/activities'
import { z } from 'zod'

const syncRequestSchema = z.object({
  workspace_id: z.string().uuid(),
  object_type: z.enum(['contacts', 'companies', 'deals', 'activities']),
  direction: z.enum(['to_hubspot', 'from_hubspot', 'bidirectional']).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { workspace_id, object_type, direction } = syncRequestSchema.parse(body)

    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user has permission to trigger syncs
    const { data: hasPermission } = await supabase
      .rpc('check_user_permission', {
        p_user_id: user.id,
        p_workspace_id: workspace_id,
        p_permission: 'settings:manage'
      })

    if (!hasPermission) {
      return NextResponse.json(
        { error: 'Permission denied' },
        { status: 403 }
      )
    }

    // Check if HubSpot is connected
    const { data: connection } = await supabase
      .rpc('get_hubspot_connection', { p_workspace_id: workspace_id })
      .single()

    if (!connection || !connection.is_active) {
      return NextResponse.json(
        { error: 'HubSpot not connected' },
        { status: 400 }
      )
    }

    // Get sync configuration
    const { data: syncConfig } = await supabase
      .from('hubspot_sync_configs')
      .select('*')
      .eq('workspace_id', workspace_id)
      .eq('object_type', object_type)
      .single()

    if (!syncConfig || !syncConfig.is_enabled) {
      return NextResponse.json(
        { error: `${object_type} sync is not enabled` },
        { status: 400 }
      )
    }

    let result: { synced: number; failed: number; errors: string[] }

    // Execute sync based on object type
    switch (object_type) {
      case 'contacts':
        const contactSync = new ContactSyncService(workspace_id)
        
        if (direction) {
          // Specific direction requested
          if (direction === 'to_hubspot') {
            result = await contactSync.syncLeadsToHubSpot()
          } else if (direction === 'from_hubspot') {
            result = await contactSync.syncContactsFromHubSpot()
          } else {
            // Bidirectional - do both
            const toHubSpot = await contactSync.syncLeadsToHubSpot()
            const fromHubSpot = await contactSync.syncContactsFromHubSpot()
            
            result = {
              synced: toHubSpot.synced + fromHubSpot.synced,
              failed: toHubSpot.failed + fromHubSpot.failed,
              errors: [...toHubSpot.errors, ...fromHubSpot.errors],
            }
          }
        } else {
          // Use config direction
          if (syncConfig.direction === 'to_hubspot') {
            result = await contactSync.syncLeadsToHubSpot()
          } else if (syncConfig.direction === 'from_hubspot') {
            result = await contactSync.syncContactsFromHubSpot()
          } else {
            // Bidirectional
            const toHubSpot = await contactSync.syncLeadsToHubSpot()
            const fromHubSpot = await contactSync.syncContactsFromHubSpot()
            
            result = {
              synced: toHubSpot.synced + fromHubSpot.synced,
              failed: toHubSpot.failed + fromHubSpot.failed,
              errors: [...toHubSpot.errors, ...fromHubSpot.errors],
            }
          }
        }
        break

      case 'companies':
        const companySync = new CompanySyncService(workspace_id)
        
        if (direction) {
          if (direction === 'to_hubspot') {
            result = await companySync.syncCompaniesToHubSpot()
          } else if (direction === 'from_hubspot') {
            result = await companySync.syncCompaniesFromHubSpot()
          } else {
            // Bidirectional
            const toHubSpot = await companySync.syncCompaniesToHubSpot()
            const fromHubSpot = await companySync.syncCompaniesFromHubSpot()
            
            result = {
              synced: toHubSpot.synced + fromHubSpot.synced,
              failed: toHubSpot.failed + fromHubSpot.failed,
              errors: [...toHubSpot.errors, ...fromHubSpot.errors],
            }
          }
        } else {
          // Use config direction
          if (syncConfig.direction === 'to_hubspot') {
            result = await companySync.syncCompaniesToHubSpot()
          } else if (syncConfig.direction === 'from_hubspot') {
            result = await companySync.syncCompaniesFromHubSpot()
          } else {
            // Bidirectional
            const toHubSpot = await companySync.syncCompaniesToHubSpot()
            const fromHubSpot = await companySync.syncCompaniesFromHubSpot()
            
            result = {
              synced: toHubSpot.synced + fromHubSpot.synced,
              failed: toHubSpot.failed + fromHubSpot.failed,
              errors: [...toHubSpot.errors, ...fromHubSpot.errors],
            }
          }
        }
        break

      case 'deals':
        const dealSync = new DealSyncService(workspace_id)
        // Deals are typically one-way: campaigns -> deals
        result = await dealSync.syncCampaignsToDeals()
        break

      case 'activities':
        const activitySync = new ActivitySyncService(workspace_id)
        // Activities are typically one-way: email events -> activities
        result = await activitySync.syncEmailActivitiesToHubSpot()
        break

      default:
        return NextResponse.json(
          { error: 'Invalid object type' },
          { status: 400 }
        )
    }

    // Create audit log
    await supabase.from('audit_logs').insert({
      workspace_id,
      user_id: user.id,
      action: 'hubspot_sync_triggered',
      resource_type: 'integration',
      metadata: {
        object_type,
        direction: direction || syncConfig.direction,
        synced: result.synced,
        failed: result.failed,
      },
    })

    return NextResponse.json({
      success: true,
      object_type,
      direction: direction || syncConfig.direction,
      ...result,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    console.error('HubSpot sync error:', error)
    return NextResponse.json(
      { error: 'Sync failed', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}