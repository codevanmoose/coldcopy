import { createClient } from '@/lib/supabase/server'
import { createHubSpotClient, type HubSpotCompany } from '../client'

export interface Workspace {
  id: string
  name: string
  slug: string
  domain?: string
  settings: any
  created_at: string
  updated_at: string
}

export interface CompanyLead {
  id: string
  email: string
  company?: string
  website?: string
  phone?: string
  location?: string
  enrichment_data?: any
  workspace_id: string
}

export class CompanySyncService {
  private workspaceId: string

  constructor(workspaceId: string) {
    this.workspaceId = workspaceId
  }

  async syncCompaniesToHubSpot(): Promise<{
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
          object_type: 'companies',
          direction: 'to_hubspot',
          status: 'syncing',
        })
        .select()
        .single()

      if (!syncJob) {
        throw new Error('Failed to create sync job')
      }

      // Get unique companies from leads that aren't mapped yet
      const { data: companyLeads } = await supabase
        .from('leads')
        .select('company, website, phone, location, enrichment_data')
        .eq('workspace_id', this.workspaceId)
        .not('company', 'is', null)
        .not('company', 'eq', '')

      if (!companyLeads || companyLeads.length === 0) {
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

      // Group leads by company name and aggregate data
      const companiesMap = new Map<string, {
        name: string
        domain?: string
        phone?: string
        city?: string
        industry?: string
        leadCount: number
        websites: Set<string>
        phones: Set<string>
        enrichmentData: any[]
      }>()

      for (const lead of companyLeads) {
        const companyName = lead.company!.trim()
        const existing = companiesMap.get(companyName) || {
          name: companyName,
          leadCount: 0,
          websites: new Set<string>(),
          phones: new Set<string>(),
          enrichmentData: [],
        }

        existing.leadCount++
        
        if (lead.website) existing.websites.add(lead.website)
        if (lead.phone) existing.phones.add(lead.phone)
        if (lead.enrichment_data) existing.enrichmentData.push(lead.enrichment_data)

        // Extract location info
        if (lead.location) {
          const locationParts = lead.location.split(',').map(p => p.trim())
          if (locationParts.length > 0) {
            existing.city = locationParts[0]
          }
        }

        // Extract industry from enrichment data
        if (lead.enrichment_data?.company?.industry) {
          existing.industry = lead.enrichment_data.company.industry
        }

        companiesMap.set(companyName, existing)
      }

      // Process each unique company
      for (const [companyName, companyData] of companiesMap) {
        try {
          // Check if company already exists in HubSpot
          const searchResults = await hubspot.searchContacts(companyName) // Using contact search as proxy
          
          // Create the company data
          const hubspotCompanyData: Omit<HubSpotCompany, 'id'> = {
            name: companyData.name,
            domain: Array.from(companyData.websites)[0], // Use first website as domain
            phone: Array.from(companyData.phones)[0], // Use first phone
            city: companyData.city,
            industry: companyData.industry,
            // Custom properties
            number_of_employees: companyData.leadCount.toString(),
            description: `Company synced from ColdCopy with ${companyData.leadCount} leads`,
            lead_source: 'ColdCopy',
          }

          let hubspotCompany: HubSpotCompany
          let isUpdate = false

          // Search for existing company by domain or name
          try {
            const existingCompanies = await this.searchCompaniesByName(hubspot, companyName)
            
            if (existingCompanies.length > 0) {
              // Update existing company
              hubspotCompany = await hubspot.updateCompany(
                existingCompanies[0].id!,
                hubspotCompanyData
              )
              isUpdate = true
            } else {
              // Create new company
              hubspotCompany = await hubspot.createCompany(hubspotCompanyData)
            }
          } catch (searchError) {
            // If search fails, try to create new company
            hubspotCompany = await hubspot.createCompany(hubspotCompanyData)
          }

          // Store mapping using company name as identifier
          await supabase
            .from('hubspot_object_mappings')
            .upsert({
              workspace_id: this.workspaceId,
              object_type: 'companies',
              coldcopy_id: companyName, // Using company name as ID since we don't have separate company entities
              hubspot_id: hubspotCompany.id!,
              sync_direction: 'to_hubspot',
              metadata: {
                action: isUpdate ? 'updated' : 'created',
                lead_count: companyData.leadCount,
                synced_at: new Date().toISOString(),
              },
            })

          synced++
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          errors.push(`Company ${companyName}: ${errorMessage}`)
          
          // Store error for retry
          await supabase
            .from('hubspot_sync_errors')
            .insert({
              workspace_id: this.workspaceId,
              sync_job_id: syncJob.id,
              object_type: 'companies',
              coldcopy_id: companyName,
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
          records_processed: companiesMap.size,
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
        .eq('object_type', 'companies')

      return { synced, failed, errors }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('Company sync error:', error)
      
      // Update sync job with error
      await supabase
        .from('hubspot_sync_jobs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: errorMessage,
        })
        .eq('workspace_id', this.workspaceId)
        .eq('object_type', 'companies')
        .eq('status', 'syncing')

      throw error
    }
  }

  async syncCompaniesFromHubSpot(): Promise<{
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
          object_type: 'companies',
          direction: 'from_hubspot',
          status: 'syncing',
        })
        .select()
        .single()

      if (!syncJob) {
        throw new Error('Failed to create sync job')
      }

      // Get all companies from HubSpot (paginated)
      let hasMore = true
      let after: string | undefined

      while (hasMore) {
        const response = await hubspot.getCompanies(100, after)
        
        for (const company of response.results) {
          try {
            // Check if company is already mapped
            const { data: existingMapping } = await supabase
              .from('hubspot_object_mappings')
              .select('coldcopy_id')
              .eq('workspace_id', this.workspaceId)
              .eq('object_type', 'companies')
              .eq('hubspot_id', company.id!)
              .single()

            if (!existingMapping) {
              // Store mapping for this company so we can reference it when syncing leads
              await supabase
                .from('hubspot_object_mappings')
                .insert({
                  workspace_id: this.workspaceId,
                  object_type: 'companies',
                  coldcopy_id: company.name, // Use company name as identifier
                  hubspot_id: company.id!,
                  sync_direction: 'from_hubspot',
                  metadata: {
                    domain: company.domain,
                    industry: company.industry,
                    city: company.city,
                    synced_at: new Date().toISOString(),
                  },
                })

              // Update existing leads with company information if they match
              if (company.domain) {
                await this.updateLeadsWithCompanyInfo(company)
              }
            }

            synced++
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error'
            errors.push(`Company ${company.name}: ${errorMessage}`)
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
      console.error('Company sync from HubSpot error:', error)
      
      await supabase
        .from('hubspot_sync_jobs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: errorMessage,
        })
        .eq('workspace_id', this.workspaceId)
        .eq('object_type', 'companies')
        .eq('status', 'syncing')

      throw error
    }
  }

  private async searchCompaniesByName(hubspot: any, companyName: string): Promise<HubSpotCompany[]> {
    try {
      // HubSpot doesn't have a direct company search by name in the v3 API
      // We'll use the search API with filters
      const response = await hubspot.makeRequest('/crm/v3/objects/companies/search', {
        method: 'POST',
        body: JSON.stringify({
          filterGroups: [{
            filters: [{
              propertyName: 'name',
              operator: 'EQ',
              value: companyName,
            }]
          }],
          limit: 10,
        }),
      })

      return response.results || []
    } catch (error) {
      console.warn('Company search failed:', error)
      return []
    }
  }

  private async updateLeadsWithCompanyInfo(company: HubSpotCompany): Promise<void> {
    const supabase = await createClient()
    
    if (!company.domain) return

    // Update leads that have emails from this company's domain
    const emailDomain = company.domain.replace(/^https?:\/\//, '').replace(/^www\./, '')
    
    await supabase
      .from('leads')
      .update({
        company: company.name,
        website: company.domain,
        enrichment_data: supabase.rpc('jsonb_set', {
          target: 'enrichment_data',
          path: '{company}',
          new_value: JSON.stringify({
            name: company.name,
            domain: company.domain,
            industry: company.industry,
            city: company.city,
            source: 'hubspot',
          }),
        }),
      })
      .eq('workspace_id', this.workspaceId)
      .like('email', `%@${emailDomain}`)
      .is('company', null)
  }

  async associateContactsWithCompanies(): Promise<{
    associated: number
    failed: number
    errors: string[]
  }> {
    const supabase = await createClient()
    const hubspot = await createHubSpotClient(this.workspaceId)
    
    if (!hubspot) {
      throw new Error('HubSpot not connected')
    }

    const errors: string[] = []
    let associated = 0
    let failed = 0

    try {
      // Get contact mappings
      const { data: contactMappings } = await supabase
        .from('hubspot_object_mappings')
        .select('coldcopy_id, hubspot_id')
        .eq('workspace_id', this.workspaceId)
        .eq('object_type', 'contacts')

      if (!contactMappings) return { associated: 0, failed: 0, errors: [] }

      // Get company mappings
      const { data: companyMappings } = await supabase
        .from('hubspot_object_mappings')
        .select('coldcopy_id, hubspot_id')
        .eq('workspace_id', this.workspaceId)
        .eq('object_type', 'companies')

      if (!companyMappings) return { associated: 0, failed: 0, errors: [] }

      const companyMap = new Map(companyMappings.map(c => [c.coldcopy_id, c.hubspot_id]))

      // Process each contact
      for (const contactMapping of contactMappings) {
        try {
          // Get the lead to find its company
          const { data: lead } = await supabase
            .from('leads')
            .select('company')
            .eq('id', contactMapping.coldcopy_id)
            .single()

          if (lead?.company && companyMap.has(lead.company)) {
            const companyHubSpotId = companyMap.get(lead.company)!
            
            // Associate contact with company in HubSpot
            await hubspot.makeRequest(`/crm/v3/objects/contacts/${contactMapping.hubspot_id}/associations/companies/${companyHubSpotId}/contact_to_company`, {
              method: 'PUT',
            })

            associated++
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          errors.push(`Contact ${contactMapping.coldcopy_id}: ${errorMessage}`)
          failed++
        }
      }

      return { associated, failed, errors }
    } catch (error) {
      console.error('Association error:', error)
      throw error
    }
  }

  async syncSingleCompanyToHubSpot(companyName: string): Promise<void> {
    const supabase = await createClient()
    const hubspot = await createHubSpotClient(this.workspaceId)
    
    if (!hubspot) {
      throw new Error('HubSpot not connected')
    }

    // Get company data from leads
    const { data: companyLeads } = await supabase
      .from('leads')
      .select('company, website, phone, location, enrichment_data')
      .eq('workspace_id', this.workspaceId)
      .eq('company', companyName)

    if (!companyLeads || companyLeads.length === 0) {
      throw new Error('No leads found for company')
    }

    // Aggregate company data
    const websites = new Set<string>()
    const phones = new Set<string>()
    let city: string | undefined
    let industry: string | undefined

    for (const lead of companyLeads) {
      if (lead.website) websites.add(lead.website)
      if (lead.phone) phones.add(lead.phone)
      
      if (lead.location && !city) {
        city = lead.location.split(',')[0]?.trim()
      }
      
      if (lead.enrichment_data?.company?.industry && !industry) {
        industry = lead.enrichment_data.company.industry
      }
    }

    const hubspotCompanyData: Omit<HubSpotCompany, 'id'> = {
      name: companyName,
      domain: Array.from(websites)[0],
      phone: Array.from(phones)[0],
      city,
      industry,
      number_of_employees: companyLeads.length.toString(),
      description: `Company synced from ColdCopy with ${companyLeads.length} leads`,
      lead_source: 'ColdCopy',
    }

    // Check if already mapped
    const { data: existingMapping } = await supabase
      .from('hubspot_object_mappings')
      .select('hubspot_id')
      .eq('workspace_id', this.workspaceId)
      .eq('object_type', 'companies')
      .eq('coldcopy_id', companyName)
      .single()

    let hubspotCompany: HubSpotCompany

    if (existingMapping) {
      // Update existing company
      hubspotCompany = await hubspot.updateCompany(existingMapping.hubspot_id, hubspotCompanyData)
    } else {
      // Search for existing company by name
      const existingCompanies = await this.searchCompaniesByName(hubspot, companyName)
      
      if (existingCompanies.length > 0) {
        // Update existing company
        hubspotCompany = await hubspot.updateCompany(existingCompanies[0].id!, hubspotCompanyData)
      } else {
        // Create new company
        hubspotCompany = await hubspot.createCompany(hubspotCompanyData)
      }

      // Create mapping
      await supabase
        .from('hubspot_object_mappings')
        .insert({
          workspace_id: this.workspaceId,
          object_type: 'companies',
          coldcopy_id: companyName,
          hubspot_id: hubspotCompany.id!,
          sync_direction: 'to_hubspot',
        })
    }
  }
}