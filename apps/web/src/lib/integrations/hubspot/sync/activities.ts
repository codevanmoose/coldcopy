import { createClient } from '@/lib/supabase/server'
import { createHubSpotClient, type HubSpotActivity } from '../client'

export interface EmailEvent {
  id: string
  campaign_id: string
  lead_id: string
  email_id: string
  event_type: 'sent' | 'delivered' | 'opened' | 'clicked' | 'replied' | 'bounced' | 'complained'
  event_data?: any
  created_at: string
  workspace_id: string
}

export interface CampaignEmail {
  id: string
  campaign_id: string
  lead_id: string
  subject: string
  content: string
  sent_at: string
  workspace_id: string
}

export class ActivitySyncService {
  private workspaceId: string

  constructor(workspaceId: string) {
    this.workspaceId = workspaceId
  }

  async syncEmailActivitiesToHubSpot(): Promise<{
    synced: number
    failed: number
    errors: string[]
  }> {
    const supabase = await createClient()
    const hubspot = await createHubSpotClient(this.workspaceId)
    
    if (!hubspot) {
      throw new Error('HubSpot not connected')
    }

    const errors: string[] = []
    let synced = 0
    let failed = 0

    try {
      // Create sync job
      const { data: syncJob } = await supabase
        .from('hubspot_sync_jobs')
        .insert({
          workspace_id: this.workspaceId,
          object_type: 'activities',
          direction: 'to_hubspot',
          status: 'syncing',
        })
        .select()
        .single()

      if (!syncJob) {
        throw new Error('Failed to create sync job')
      }

      // Get email events from the last 30 days that haven't been synced
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      
      const { data: emailEvents } = await supabase
        .from('email_events')
        .select(`
          *,
          campaign_emails(subject, content, campaign_id),
          leads(email)
        `)
        .eq('workspace_id', this.workspaceId)
        .gte('created_at', thirtyDaysAgo)
        .not('id', 'in', 
          supabase
            .from('hubspot_object_mappings')
            .select('coldcopy_id')
            .eq('workspace_id', this.workspaceId)
            .eq('object_type', 'activities')
        )
        .order('created_at', { ascending: false })
        .limit(200) // Process in batches

      if (!emailEvents || emailEvents.length === 0) {
        await supabase
          .from('hubspot_sync_jobs')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            records_processed: 0,
          })
          .eq('id', syncJob.id)

        return { synced: 0, failed: 0, errors: [] }
      }

      // Process each email event
      for (const event of emailEvents) {
        try {
          // Get HubSpot contact ID for this lead
          const { data: contactMapping } = await supabase
            .from('hubspot_object_mappings')
            .select('hubspot_id')
            .eq('workspace_id', this.workspaceId)
            .eq('object_type', 'contacts')
            .eq('coldcopy_id', event.lead_id)
            .single()

          if (!contactMapping) {
            // Skip if contact is not mapped to HubSpot
            continue
          }

          // Get deal ID if available
          let dealId: string | undefined
          if (event.campaign_emails?.campaign_id) {
            const { data: dealMapping } = await supabase
              .from('hubspot_object_mappings')
              .select('hubspot_id')
              .eq('workspace_id', this.workspaceId)
              .eq('object_type', 'deals')
              .eq('coldcopy_id', event.campaign_emails.campaign_id)
              .single()

            dealId = dealMapping?.hubspot_id
          }

          // Create activity based on event type
          const activity = this.mapEmailEventToActivity(event, contactMapping.hubspot_id, dealId)
          
          if (activity) {
            const hubspotActivity = await hubspot.createActivity(activity)

            // Store mapping
            await supabase
              .from('hubspot_object_mappings')
              .insert({
                workspace_id: this.workspaceId,
                object_type: 'activities',
                coldcopy_id: event.id,
                hubspot_id: hubspotActivity.id!,
                sync_direction: 'to_hubspot',
                metadata: {
                  event_type: event.event_type,
                  contact_id: contactMapping.hubspot_id,
                  deal_id: dealId,
                  synced_at: new Date().toISOString(),
                },
              })

            synced++
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          errors.push(`Event ${event.id} (${event.event_type}): ${errorMessage}`)
          
          // Store error for retry
          await supabase
            .from('hubspot_sync_errors')
            .insert({
              workspace_id: this.workspaceId,
              sync_job_id: syncJob.id,
              object_type: 'activities',
              coldcopy_id: event.id,
              error_message: errorMessage,
              next_retry_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
            })

          failed++
        }
      }

      // Update sync job
      await supabase
        .from('hubspot_sync_jobs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          records_processed: emailEvents.length,
          records_success: synced,
          records_failed: failed,
          error_message: errors.length > 0 ? errors.join('; ') : null,
        })
        .eq('id', syncJob.id)

      // Update last sync time
      await supabase
        .from('hubspot_sync_configs')
        .update({ last_sync_at: new Date().toISOString() })
        .eq('workspace_id', this.workspaceId)
        .eq('object_type', 'activities')

      return { synced, failed, errors }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('Activity sync error:', error)
      
      // Update sync job with error
      await supabase
        .from('hubspot_sync_jobs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: errorMessage,
        })
        .eq('workspace_id', this.workspaceId)
        .eq('object_type', 'activities')
        .eq('status', 'syncing')

      throw error
    }
  }

  private mapEmailEventToActivity(
    event: EmailEvent & { campaign_emails?: any; leads?: any },
    contactId: string,
    dealId?: string
  ): HubSpotActivity | null {
    const timestamp = new Date(event.created_at).getTime()
    const leadEmail = event.leads?.email || 'Unknown'
    const subject = event.campaign_emails?.subject || 'Cold Outreach Email'

    switch (event.event_type) {
      case 'sent':
        return {
          activityType: 'EMAIL',
          timestamp,
          contactId,
          dealId,
          subject: `Email Sent: ${subject}`,
          body: this.buildEmailActivityBody(event, 'sent', leadEmail, subject),
          outcome: 'SENT',
        }

      case 'delivered':
        return {
          activityType: 'EMAIL',
          timestamp,
          contactId,
          dealId,
          subject: `Email Delivered: ${subject}`,
          body: this.buildEmailActivityBody(event, 'delivered', leadEmail, subject),
          outcome: 'DELIVERED',
        }

      case 'opened':
        return {
          activityType: 'EMAIL',
          timestamp,
          contactId,
          dealId,
          subject: `Email Opened: ${subject}`,
          body: this.buildEmailActivityBody(event, 'opened', leadEmail, subject),
          outcome: 'OPENED',
        }

      case 'clicked':
        return {
          activityType: 'EMAIL',
          timestamp,
          contactId,
          dealId,
          subject: `Email Link Clicked: ${subject}`,
          body: this.buildEmailActivityBody(event, 'clicked', leadEmail, subject),
          outcome: 'CLICKED',
        }

      case 'replied':
        return {
          activityType: 'EMAIL',
          timestamp,
          contactId,
          dealId,
          subject: `Email Reply Received: ${subject}`,
          body: this.buildEmailActivityBody(event, 'replied', leadEmail, subject),
          outcome: 'REPLIED',
        }

      case 'bounced':
        return {
          activityType: 'EMAIL',
          timestamp,
          contactId,
          dealId,
          subject: `Email Bounced: ${subject}`,
          body: this.buildEmailActivityBody(event, 'bounced', leadEmail, subject),
          outcome: 'BOUNCED',
        }

      case 'complained':
        return {
          activityType: 'EMAIL',
          timestamp,
          contactId,
          dealId,
          subject: `Spam Complaint: ${subject}`,
          body: this.buildEmailActivityBody(event, 'complained', leadEmail, subject),
          outcome: 'COMPLAINED',
        }

      default:
        return null
    }
  }

  private buildEmailActivityBody(
    event: EmailEvent & { campaign_emails?: any; leads?: any },
    eventType: string,
    leadEmail: string,
    subject: string
  ): string {
    const parts = []
    
    parts.push(`Email ${eventType} for contact: ${leadEmail}`)
    parts.push(`Subject: ${subject}`)
    
    if (event.campaign_emails?.campaign_id) {
      parts.push(`Campaign ID: ${event.campaign_emails.campaign_id}`)
    }
    
    if (event.event_data) {
      if (event.event_data.url && eventType === 'clicked') {
        parts.push(`Clicked URL: ${event.event_data.url}`)
      }
      
      if (event.event_data.user_agent) {
        parts.push(`User Agent: ${event.event_data.user_agent}`)
      }
      
      if (event.event_data.ip_address) {
        parts.push(`IP Address: ${event.event_data.ip_address}`)
      }
      
      if (event.event_data.bounce_reason && eventType === 'bounced') {
        parts.push(`Bounce Reason: ${event.event_data.bounce_reason}`)
      }
    }
    
    parts.push(`\nTracked via ColdCopy on ${new Date(event.created_at).toLocaleString()}`)
    
    return parts.join('\n')
  }

  async syncSingleEmailEvent(eventId: string): Promise<void> {
    const supabase = await createClient()
    const hubspot = await createHubSpotClient(this.workspaceId)
    
    if (!hubspot) {
      throw new Error('HubSpot not connected')
    }

    const { data: event } = await supabase
      .from('email_events')
      .select(`
        *,
        campaign_emails(subject, content, campaign_id),
        leads(email)
      `)
      .eq('id', eventId)
      .eq('workspace_id', this.workspaceId)
      .single()

    if (!event) {
      throw new Error('Email event not found')
    }

    // Check if already synced
    const { data: existingMapping } = await supabase
      .from('hubspot_object_mappings')
      .select('id')
      .eq('workspace_id', this.workspaceId)
      .eq('object_type', 'activities')
      .eq('coldcopy_id', eventId)
      .single()

    if (existingMapping) {
      throw new Error('Email event already synced')
    }

    // Get contact mapping
    const { data: contactMapping } = await supabase
      .from('hubspot_object_mappings')
      .select('hubspot_id')
      .eq('workspace_id', this.workspaceId)
      .eq('object_type', 'contacts')
      .eq('coldcopy_id', event.lead_id)
      .single()

    if (!contactMapping) {
      throw new Error('Contact not mapped to HubSpot')
    }

    // Get deal mapping if available
    let dealId: string | undefined
    if (event.campaign_emails?.campaign_id) {
      const { data: dealMapping } = await supabase
        .from('hubspot_object_mappings')
        .select('hubspot_id')
        .eq('workspace_id', this.workspaceId)
        .eq('object_type', 'deals')
        .eq('coldcopy_id', event.campaign_emails.campaign_id)
        .single()

      dealId = dealMapping?.hubspot_id
    }

    // Create activity
    const activity = this.mapEmailEventToActivity(event, contactMapping.hubspot_id, dealId)
    
    if (!activity) {
      throw new Error('Unable to map email event to activity')
    }

    const hubspotActivity = await hubspot.createActivity(activity)

    // Store mapping
    await supabase
      .from('hubspot_object_mappings')
      .insert({
        workspace_id: this.workspaceId,
        object_type: 'activities',
        coldcopy_id: eventId,
        hubspot_id: hubspotActivity.id!,
        sync_direction: 'to_hubspot',
        metadata: {
          event_type: event.event_type,
          contact_id: contactMapping.hubspot_id,
          deal_id: dealId,
          synced_at: new Date().toISOString(),
        },
      })
  }

  async createNoteActivity(
    leadId: string,
    subject: string,
    content: string,
    dealId?: string
  ): Promise<void> {
    const supabase = await createClient()
    const hubspot = await createHubSpotClient(this.workspaceId)
    
    if (!hubspot) {
      throw new Error('HubSpot not connected')
    }

    // Get contact mapping
    const { data: contactMapping } = await supabase
      .from('hubspot_object_mappings')
      .select('hubspot_id')
      .eq('workspace_id', this.workspaceId)
      .eq('object_type', 'contacts')
      .eq('coldcopy_id', leadId)
      .single()

    if (!contactMapping) {
      throw new Error('Contact not mapped to HubSpot')
    }

    // Create note activity
    const activity: HubSpotActivity = {
      activityType: 'NOTE',
      timestamp: Date.now(),
      contactId: contactMapping.hubspot_id,
      dealId,
      subject,
      body: content,
    }

    await hubspot.createActivity(activity)
  }
}