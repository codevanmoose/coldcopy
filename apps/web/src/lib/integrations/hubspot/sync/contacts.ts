import { createClient } from '@/lib/supabase/server'
import { createHubSpotClient, type HubSpotContact } from '../client'

export interface Lead {
  id: string
  email: string
  first_name?: string
  last_name?: string
  company?: string
  phone?: string
  website?: string
  job_title?: string
  location?: string
  workspace_id: string
  created_at: string
  updated_at: string
  enrichment_data?: any
}

export class ContactSyncService {
  private workspaceId: string

  constructor(workspaceId: string) {
    this.workspaceId = workspaceId
  }

  async syncLeadsToHubSpot(): Promise<{
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
          object_type: 'contacts',
          direction: 'to_hubspot',
          status: 'syncing',
        })
        .select()
        .single()

      if (!syncJob) {
        throw new Error('Failed to create sync job')
      }

      // Get leads that aren't mapped to HubSpot yet
      const { data: leads } = await supabase
        .from('leads')
        .select('*')
        .eq('workspace_id', this.workspaceId)
        .not('id', 'in', 
          supabase
            .from('hubspot_object_mappings')
            .select('coldcopy_id')
            .eq('workspace_id', this.workspaceId)
            .eq('object_type', 'contacts')
        )
        .limit(100) // Process in batches

      if (!leads || leads.length === 0) {
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

      // Process each lead
      for (const lead of leads) {
        try {
          // Check if contact already exists by email
          const existingContacts = await hubspot.searchContacts(lead.email)
          
          let hubspotContact: HubSpotContact
          let isUpdate = false

          if (existingContacts.results.length > 0) {
            // Update existing contact
            hubspotContact = await hubspot.updateContact(
              existingContacts.results[0].id!,
              this.mapLeadToHubSpotContact(lead)
            )
            isUpdate = true
          } else {
            // Create new contact
            hubspotContact = await hubspot.createContact(
              this.mapLeadToHubSpotContact(lead)
            )
          }

          // Store mapping
          await supabase
            .from('hubspot_object_mappings')
            .upsert({
              workspace_id: this.workspaceId,
              object_type: 'contacts',
              coldcopy_id: lead.id,
              hubspot_id: hubspotContact.id!,
              sync_direction: 'to_hubspot',
              metadata: {
                action: isUpdate ? 'updated' : 'created',
                synced_at: new Date().toISOString(),
              },
            })

          synced++
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          errors.push(`Lead ${lead.email}: ${errorMessage}`)
          
          // Store error for retry
          await supabase
            .from('hubspot_sync_errors')
            .insert({
              workspace_id: this.workspaceId,
              sync_job_id: syncJob.id,
              object_type: 'contacts',
              coldcopy_id: lead.id,
              error_message: errorMessage,
              next_retry_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // Retry in 5 minutes
            })

          failed++
        }
      }

      // Update sync job
      await supabase
        .from('hubspot_sync_jobs')
        .update({
          status: failed > 0 ? 'completed' : 'completed',
          completed_at: new Date().toISOString(),
          records_processed: leads.length,
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
        .eq('object_type', 'contacts')

      return { synced, failed, errors }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('Contact sync error:', error)
      
      // Update sync job with error
      await supabase
        .from('hubspot_sync_jobs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: errorMessage,
        })
        .eq('workspace_id', this.workspaceId)
        .eq('object_type', 'contacts')
        .eq('status', 'syncing')

      throw error
    }
  }

  async syncContactsFromHubSpot(): Promise<{
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
          object_type: 'contacts',
          direction: 'from_hubspot',
          status: 'syncing',
        })
        .select()
        .single()

      if (!syncJob) {
        throw new Error('Failed to create sync job')
      }

      // Get all contacts from HubSpot (paginated)
      let hasMore = true
      let after: string | undefined

      while (hasMore) {
        const response = await hubspot.getContacts(100, after)
        
        for (const contact of response.results) {
          try {
            // Check if contact is already mapped
            const { data: existingMapping } = await supabase
              .from('hubspot_object_mappings')
              .select('coldcopy_id')
              .eq('workspace_id', this.workspaceId)
              .eq('object_type', 'contacts')
              .eq('hubspot_id', contact.id!)
              .single()

            if (existingMapping) {
              // Update existing lead
              await supabase
                .from('leads')
                .update(this.mapHubSpotContactToLead(contact))
                .eq('id', existingMapping.coldcopy_id)
            } else {
              // Create new lead
              const { data: newLead } = await supabase
                .from('leads')
                .insert({
                  ...this.mapHubSpotContactToLead(contact),
                  workspace_id: this.workspaceId,
                })
                .select()
                .single()

              if (newLead) {
                // Create mapping
                await supabase
                  .from('hubspot_object_mappings')
                  .insert({
                    workspace_id: this.workspaceId,
                    object_type: 'contacts',
                    coldcopy_id: newLead.id,
                    hubspot_id: contact.id!,
                    sync_direction: 'from_hubspot',
                  })
              }
            }

            synced++
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error'
            errors.push(`Contact ${contact.email}: ${errorMessage}`)
            failed++
          }
        }

        // Check for more pages
        hasMore = !!response.paging?.next?.after
        after = response.paging?.next?.after
      }

      // Update sync job
      await supabase
        .from('hubspot_sync_jobs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          records_processed: synced + failed,
          records_success: synced,
          records_failed: failed,
          error_message: errors.length > 0 ? errors.join('; ') : null,
        })
        .eq('id', syncJob.id)

      return { synced, failed, errors }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('Contact sync from HubSpot error:', error)
      
      await supabase
        .from('hubspot_sync_jobs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: errorMessage,
        })
        .eq('workspace_id', this.workspaceId)
        .eq('object_type', 'contacts')
        .eq('status', 'syncing')

      throw error
    }
  }

  private mapLeadToHubSpotContact(lead: Lead): Omit<HubSpotContact, 'id'> {
    return {
      email: lead.email,
      firstname: lead.first_name || undefined,
      lastname: lead.last_name || undefined,
      company: lead.company || undefined,
      phone: lead.phone || undefined,
      website: lead.website || undefined,
      jobtitle: lead.job_title || undefined,
      lead_source: 'ColdCopy',
      lifecyclestage: 'lead',
      // Add enrichment data as custom properties if available
      ...(lead.enrichment_data && {
        hs_additional_emails: lead.enrichment_data.additional_emails?.join(';'),
        twitterhandle: lead.enrichment_data.social?.twitter,
        linkedinbio: lead.enrichment_data.social?.linkedin,
      }),
    }
  }

  private mapHubSpotContactToLead(contact: HubSpotContact): Partial<Lead> {
    return {
      email: contact.email,
      first_name: contact.firstname || undefined,
      last_name: contact.lastname || undefined,
      company: contact.company || undefined,
      phone: contact.phone || undefined,
      website: contact.website || undefined,
      job_title: contact.jobtitle || undefined,
      enrichment_data: {
        source: 'hubspot',
        lifecycle_stage: contact.lifecyclestage,
        lead_source: contact.lead_source,
        ...(contact.twitterhandle && { social: { twitter: contact.twitterhandle } }),
        ...(contact.linkedinbio && { social: { linkedin: contact.linkedinbio } }),
      },
    }
  }

  async syncSingleLead(leadId: string): Promise<void> {
    const supabase = await createClient()
    const hubspot = await createHubSpotClient(this.workspaceId)
    
    if (!hubspot) {
      throw new Error('HubSpot not connected')
    }

    const { data: lead } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .eq('workspace_id', this.workspaceId)
      .single()

    if (!lead) {
      throw new Error('Lead not found')
    }

    // Check if already mapped
    const { data: mapping } = await supabase
      .from('hubspot_object_mappings')
      .select('hubspot_id')
      .eq('workspace_id', this.workspaceId)
      .eq('object_type', 'contacts')
      .eq('coldcopy_id', leadId)
      .single()

    let hubspotContact: HubSpotContact

    if (mapping) {
      // Update existing contact
      hubspotContact = await hubspot.updateContact(
        mapping.hubspot_id,
        this.mapLeadToHubSpotContact(lead)
      )
    } else {
      // Create new contact
      hubspotContact = await hubspot.createContact(
        this.mapLeadToHubSpotContact(lead)
      )

      // Create mapping
      await supabase
        .from('hubspot_object_mappings')
        .insert({
          workspace_id: this.workspaceId,
          object_type: 'contacts',
          coldcopy_id: leadId,
          hubspot_id: hubspotContact.id!,
          sync_direction: 'to_hubspot',
        })
    }
  }

  async syncSingleLeadToHubSpot(leadId: string): Promise<void> {
    const supabase = await createClient()
    const hubspot = await createHubSpotClient(this.workspaceId)
    
    if (!hubspot) {
      throw new Error('HubSpot not connected')
    }

    // Get the lead
    const { data: lead } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .eq('workspace_id', this.workspaceId)
      .single()

    if (!lead) {
      throw new Error('Lead not found')
    }

    // Check if already mapped
    const { data: existingMapping } = await supabase
      .from('hubspot_object_mappings')
      .select('hubspot_id')
      .eq('workspace_id', this.workspaceId)
      .eq('object_type', 'contacts')
      .eq('coldcopy_id', leadId)
      .single()

    const contactData: Omit<HubSpotContact, 'id'> = {
      email: lead.email,
      firstname: lead.first_name || undefined,
      lastname: lead.last_name || undefined,
      company: lead.company || undefined,
      phone: lead.phone || undefined,
      website: lead.website || undefined,
      jobtitle: lead.job_title || undefined,
    }

    let hubspotContact: HubSpotContact

    if (existingMapping) {
      // Update existing contact
      hubspotContact = await hubspot.updateContact(existingMapping.hubspot_id, contactData)
    } else {
      // Create new contact
      hubspotContact = await hubspot.createContact(contactData)
      
      // Create mapping
      await supabase
        .from('hubspot_object_mappings')
        .insert({
          workspace_id: this.workspaceId,
          object_type: 'contacts',
          coldcopy_id: leadId,
          hubspot_id: hubspotContact.id!,
          sync_direction: 'to_hubspot',
        })
    }
  }

  async deleteMappedContact(leadId: string): Promise<void> {
    const supabase = await createClient()
    
    // Remove the mapping (conservative approach - don't delete from HubSpot)
    await supabase
      .from('hubspot_object_mappings')
      .delete()
      .eq('workspace_id', this.workspaceId)
      .eq('object_type', 'contacts')
      .eq('coldcopy_id', leadId)
  }
}