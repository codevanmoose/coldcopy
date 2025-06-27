import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ContactSyncService } from '@/lib/integrations/hubspot/sync/contacts'
import { CompanySyncService } from '@/lib/integrations/hubspot/sync/companies'
import { createHubSpotClient } from '@/lib/integrations/hubspot/client'
import crypto from 'crypto'

interface HubSpotWebhookEvent {
  eventId: number
  subscriptionId: number
  portalId: number
  appId: number
  occurredAt: number
  subscriptionType: string
  attemptNumber: number
  objectId: number
  changeSource: string
  changeFlag: string
  changeType: 'CREATED' | 'UPDATED' | 'DELETED'
  objectType: 'CONTACT' | 'COMPANY' | 'DEAL'
  portalId: number
}

interface HubSpotWebhookPayload {
  events: HubSpotWebhookEvent[]
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get('x-hubspot-signature-v3')
    
    // Verify webhook signature
    if (!verifySignature(body, signature)) {
      console.error('Invalid HubSpot webhook signature')
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      )
    }

    const payload: HubSpotWebhookPayload = JSON.parse(body)
    const supabase = await createClient()

    // Process each event
    for (const event of payload.events) {
      try {
        // Find workspace by portal ID
        const { data: connection } = await supabase
          .from('hubspot_connections')
          .select('workspace_id')
          .eq('portal_id', event.portalId)
          .eq('is_active', true)
          .single()

        if (!connection) {
          console.warn(`No active connection found for portal ${event.portalId}`)
          continue
        }

        // Store webhook event
        await supabase
          .from('hubspot_webhook_events')
          .insert({
            workspace_id: connection.workspace_id,
            event_type: `${event.objectType}_${event.changeType}`,
            object_type: event.objectType.toLowerCase(),
            object_id: event.objectId.toString(),
            portal_id: event.portalId,
            occurred_at: new Date(event.occurredAt).toISOString(),
            payload: event,
          })

        // Process event based on type and change
        await processWebhookEvent(event, connection.workspace_id)

      } catch (error) {
        console.error('Error processing webhook event:', error)
        
        // Update webhook event with error
        if (connection) {
          await supabase
            .from('hubspot_webhook_events')
            .update({
              processing_status: 'failed',
              error_message: error instanceof Error ? error.message : 'Unknown error',
            })
            .eq('object_id', event.objectId.toString())
            .eq('portal_id', event.portalId)
            .eq('processing_status', 'pending')
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Webhook processing error:', error)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}

function verifySignature(body: string, signature: string | null): boolean {
  if (!signature || !process.env.HUBSPOT_WEBHOOK_SECRET) {
    return false
  }

  try {
    const expectedSignature = crypto
      .createHmac('sha256', process.env.HUBSPOT_WEBHOOK_SECRET)
      .update(body)
      .digest('hex')

    // HubSpot sends signature in format "sha256=<hash>"
    const providedSignature = signature.replace('sha256=', '')
    
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(providedSignature, 'hex')
    )
  } catch (error) {
    console.error('Signature verification error:', error)
    return false
  }
}

async function processWebhookEvent(
  event: HubSpotWebhookEvent,
  workspaceId: string
): Promise<void> {
  const supabase = await createClient()

  switch (event.objectType) {
    case 'CONTACT':
      await processContactEvent(event, workspaceId)
      break
    
    case 'COMPANY':
      await processCompanyEvent(event, workspaceId)
      break
    
    case 'DEAL':
      await processDealEvent(event, workspaceId)
      break
    
    default:
      console.log(`Unhandled object type: ${event.objectType}`)
  }

  // Mark webhook event as processed
  await supabase
    .from('hubspot_webhook_events')
    .update({
      processing_status: 'completed',
      processed_at: new Date().toISOString(),
    })
    .eq('object_id', event.objectId.toString())
    .eq('portal_id', event.portalId)
    .eq('processing_status', 'pending')
}

async function processContactEvent(
  event: HubSpotWebhookEvent,
  workspaceId: string
): Promise<void> {
  const supabase = await createClient()
  const hubspot = await createHubSpotClient(workspaceId)
  
  if (!hubspot) return

  try {
    switch (event.changeType) {
      case 'CREATED':
      case 'UPDATED':
        // Check if this contact should be synced to ColdCopy
        const { data: syncConfig } = await supabase
          .from('hubspot_sync_configs')
          .select('direction, is_enabled')
          .eq('workspace_id', workspaceId)
          .eq('object_type', 'contacts')
          .single()

        if (!syncConfig?.is_enabled || syncConfig.direction === 'to_hubspot') {
          return // Skip if sync is disabled or only syncing to HubSpot
        }

        // Get the contact from HubSpot
        const contact = await hubspot.getContact(event.objectId.toString())
        
        // Check if contact is already mapped
        const { data: existingMapping } = await supabase
          .from('hubspot_object_mappings')
          .select('coldcopy_id')
          .eq('workspace_id', workspaceId)
          .eq('object_type', 'contacts')
          .eq('hubspot_id', event.objectId.toString())
          .single()

        const contactSync = new ContactSyncService(workspaceId)

        if (existingMapping) {
          // Update existing lead
          await supabase
            .from('leads')
            .update({
              email: contact.email,
              first_name: contact.firstname || undefined,
              last_name: contact.lastname || undefined,
              company: contact.company || undefined,
              phone: contact.phone || undefined,
              website: contact.website || undefined,
              job_title: contact.jobtitle || undefined,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingMapping.coldcopy_id)
        } else {
          // Create new lead
          const { data: newLead } = await supabase
            .from('leads')
            .insert({
              email: contact.email,
              first_name: contact.firstname || undefined,
              last_name: contact.lastname || undefined,
              company: contact.company || undefined,
              phone: contact.phone || undefined,
              website: contact.website || undefined,
              job_title: contact.jobtitle || undefined,
              workspace_id: workspaceId,
            })
            .select()
            .single()

          if (newLead) {
            // Create mapping
            await supabase
              .from('hubspot_object_mappings')
              .insert({
                workspace_id: workspaceId,
                object_type: 'contacts',
                coldcopy_id: newLead.id,
                hubspot_id: event.objectId.toString(),
                sync_direction: 'from_hubspot',
              })
          }
        }
        break

      case 'DELETED':
        // Handle contact deletion
        const { data: mappingToDelete } = await supabase
          .from('hubspot_object_mappings')
          .select('coldcopy_id')
          .eq('workspace_id', workspaceId)
          .eq('object_type', 'contacts')
          .eq('hubspot_id', event.objectId.toString())
          .single()

        if (mappingToDelete) {
          // Option 1: Delete the lead (aggressive)
          // await supabase.from('leads').delete().eq('id', mappingToDelete.coldcopy_id)
          
          // Option 2: Just remove the mapping (conservative)
          await supabase
            .from('hubspot_object_mappings')
            .delete()
            .eq('workspace_id', workspaceId)
            .eq('object_type', 'contacts')
            .eq('hubspot_id', event.objectId.toString())
        }
        break
    }
  } catch (error) {
    console.error('Contact event processing error:', error)
    throw error
  }
}

async function processCompanyEvent(
  event: HubSpotWebhookEvent,
  workspaceId: string
): Promise<void> {
  const supabase = await createClient()
  const hubspot = await createHubSpotClient(workspaceId)
  
  if (!hubspot) return

  try {
    switch (event.changeType) {
      case 'CREATED':
      case 'UPDATED':
        // Check sync config
        const { data: syncConfig } = await supabase
          .from('hubspot_sync_configs')
          .select('direction, is_enabled')
          .eq('workspace_id', workspaceId)
          .eq('object_type', 'companies')
          .single()

        if (!syncConfig?.is_enabled || syncConfig.direction === 'to_hubspot') {
          return
        }

        // Get the company from HubSpot
        const company = await hubspot.getCompany(event.objectId.toString())
        
        // Update leads with company information if they match the domain
        if (company.domain) {
          const emailDomain = company.domain.replace(/^https?:\/\//, '').replace(/^www\./, '')
          
          await supabase
            .from('leads')
            .update({
              company: company.name,
              website: company.domain,
              location: company.city || undefined,
              enrichment_data: supabase.rpc('jsonb_set', {
                target: 'enrichment_data',
                path: '{company}',
                new_value: JSON.stringify({
                  name: company.name,
                  domain: company.domain,
                  industry: company.industry,
                  city: company.city,
                  source: 'hubspot_webhook',
                }),
              }),
              updated_at: new Date().toISOString(),
            })
            .eq('workspace_id', workspaceId)
            .like('email', `%@${emailDomain}`)
        }

        // Store/update company mapping
        await supabase
          .from('hubspot_object_mappings')
          .upsert({
            workspace_id: workspaceId,
            object_type: 'companies',
            coldcopy_id: company.name, // Use name as ID
            hubspot_id: event.objectId.toString(),
            sync_direction: 'from_hubspot',
            metadata: {
              domain: company.domain,
              industry: company.industry,
              city: company.city,
            },
          })
        break

      case 'DELETED':
        // Remove company mapping
        await supabase
          .from('hubspot_object_mappings')
          .delete()
          .eq('workspace_id', workspaceId)
          .eq('object_type', 'companies')
          .eq('hubspot_id', event.objectId.toString())
        break
    }
  } catch (error) {
    console.error('Company event processing error:', error)
    throw error
  }
}

async function processDealEvent(
  event: HubSpotWebhookEvent,
  workspaceId: string
): Promise<void> {
  const supabase = await createClient()
  
  try {
    switch (event.changeType) {
      case 'CREATED':
      case 'UPDATED':
        // For now, we typically sync deals one-way (campaigns -> deals)
        // But we can track deal updates for reporting
        console.log(`Deal ${event.changeType}: ${event.objectId}`)
        break

      case 'DELETED':
        // Remove deal mapping if it exists
        await supabase
          .from('hubspot_object_mappings')
          .delete()
          .eq('workspace_id', workspaceId)
          .eq('object_type', 'deals')
          .eq('hubspot_id', event.objectId.toString())
        break
    }
  } catch (error) {
    console.error('Deal event processing error:', error)
    throw error
  }
}