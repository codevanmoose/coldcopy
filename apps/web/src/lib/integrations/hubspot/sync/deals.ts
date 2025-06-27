import { createClient } from '@/lib/supabase/server'
import { createHubSpotClient, type HubSpotDeal } from '../client'

export interface Campaign {
  id: string
  name: string
  description?: string
  status: 'draft' | 'active' | 'paused' | 'completed'
  workspace_id: string
  created_at: string
  updated_at: string
  settings?: any
  stats?: {
    total_leads: number
    emails_sent: number
    opens: number
    clicks: number
    replies: number
  }
}

export class DealSyncService {
  private workspaceId: string

  constructor(workspaceId: string) {
    this.workspaceId = workspaceId
  }

  async syncCampaignsToDeals(): Promise<{
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
          object_type: 'deals',
          direction: 'to_hubspot',
          status: 'syncing',
        })
        .select()
        .single()

      if (!syncJob) {
        throw new Error('Failed to create sync job')
      }

      // Get campaigns that aren't mapped to HubSpot yet
      const { data: campaigns } = await supabase
        .from('campaigns')
        .select(`
          *,
          campaign_stats:campaign_analytics(
            total_leads,
            emails_sent,
            total_opens,
            total_clicks,
            total_replies
          )
        `)
        .eq('workspace_id', this.workspaceId)
        .not('id', 'in', 
          supabase
            .from('hubspot_object_mappings')
            .select('coldcopy_id')
            .eq('workspace_id', this.workspaceId)
            .eq('object_type', 'deals')
        )
        .limit(50) // Process in batches

      if (!campaigns || campaigns.length === 0) {
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

      // Get available deal pipelines and stages
      const pipelines = await hubspot.getDealPipelines()
      const defaultPipeline = pipelines.find(p => p.label.toLowerCase().includes('sales')) || pipelines[0]
      const defaultStage = defaultPipeline?.stages.find(s => s.label.toLowerCase().includes('prospect')) || defaultPipeline?.stages[0]

      // Process each campaign
      for (const campaign of campaigns) {
        try {
          const stats = campaign.campaign_stats?.[0] || {}
          
          // Calculate deal value based on campaign metrics
          const dealValue = this.calculateDealValue(stats)
          
          // Map campaign status to deal stage
          const dealStage = this.mapCampaignStatusToDealStage(campaign.status, defaultPipeline)
          
          const hubspotDeal: Omit<HubSpotDeal, 'id'> = {
            dealname: `${campaign.name} - Cold Outreach Campaign`,
            amount: dealValue,
            dealstage: dealStage || defaultStage?.id,
            pipeline: defaultPipeline?.id,
            dealtype: 'newbusiness',
            description: this.buildDealDescription(campaign, stats),
            closedate: this.calculateCloseDate(campaign, stats),
            // Custom properties for tracking
            hs_deal_source: 'ColdCopy',
            hs_deal_source_id: campaign.id,
            hs_campaign_name: campaign.name,
            hs_num_contacted_deals: stats.total_leads?.toString() || '0',
          }

          // Check if deal already exists by name
          const existingDeals = await this.searchDealsByName(hubspot, hubspotDeal.dealname)
          
          let hubspotDealResult: HubSpotDeal
          let isUpdate = false

          if (existingDeals.length > 0) {
            // Update existing deal
            hubspotDealResult = await hubspot.updateDeal(
              existingDeals[0].id!,
              hubspotDeal
            )
            isUpdate = true
          } else {
            // Create new deal
            hubspotDealResult = await hubspot.createDeal(hubspotDeal)
          }

          // Store mapping
          await supabase
            .from('hubspot_object_mappings')
            .upsert({
              workspace_id: this.workspaceId,
              object_type: 'deals',
              coldcopy_id: campaign.id,
              hubspot_id: hubspotDealResult.id!,
              sync_direction: 'to_hubspot',
              metadata: {
                action: isUpdate ? 'updated' : 'created',
                pipeline_id: defaultPipeline?.id,
                stage_id: dealStage,
                deal_value: dealValue,
                synced_at: new Date().toISOString(),
              },
            })

          // Associate deal with contacts from this campaign
          await this.associateDealWithCampaignContacts(campaign.id, hubspotDealResult.id!)

          synced++
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          errors.push(`Campaign ${campaign.name}: ${errorMessage}`)
          
          // Store error for retry
          await supabase
            .from('hubspot_sync_errors')
            .insert({
              workspace_id: this.workspaceId,
              sync_job_id: syncJob.id,
              object_type: 'deals',
              coldcopy_id: campaign.id,
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
          records_processed: campaigns.length,
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
        .eq('object_type', 'deals')

      return { synced, failed, errors }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('Deal sync error:', error)
      
      // Update sync job with error
      await supabase
        .from('hubspot_sync_jobs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: errorMessage,
        })
        .eq('workspace_id', this.workspaceId)
        .eq('object_type', 'deals')
        .eq('status', 'syncing')

      throw error
    }
  }

  private calculateDealValue(stats: any): number {
    // Basic calculation based on engagement metrics
    const baseValue = 1000 // Base deal value
    const leadsMultiplier = (stats.total_leads || 0) * 10
    const engagementMultiplier = ((stats.total_opens || 0) + (stats.total_clicks || 0) * 2 + (stats.total_replies || 0) * 5)
    
    return Math.max(baseValue + leadsMultiplier + engagementMultiplier, 500)
  }

  private mapCampaignStatusToDealStage(status: string, pipeline: any): string | undefined {
    if (!pipeline?.stages) return undefined

    const stageMap: Record<string, string[]> = {
      'draft': ['prospect', 'new', 'lead'],
      'active': ['qualified', 'meeting', 'proposal'],
      'paused': ['on hold', 'paused', 'stalled'],
      'completed': ['closed won', 'won', 'success']
    }

    const stageKeywords = stageMap[status] || ['prospect']
    
    for (const keyword of stageKeywords) {
      const stage = pipeline.stages.find((s: any) => 
        s.label.toLowerCase().includes(keyword)
      )
      if (stage) return stage.id
    }

    return pipeline.stages[0]?.id // Default to first stage
  }

  private buildDealDescription(campaign: any, stats: any): string {
    const parts = []
    
    if (campaign.description) {
      parts.push(campaign.description)
    }
    
    parts.push(`\nCampaign Statistics:`)
    parts.push(`- Total Leads: ${stats.total_leads || 0}`)
    parts.push(`- Emails Sent: ${stats.emails_sent || 0}`)
    parts.push(`- Opens: ${stats.total_opens || 0}`)
    parts.push(`- Clicks: ${stats.total_clicks || 0}`)
    parts.push(`- Replies: ${stats.total_replies || 0}`)
    
    if (stats.total_opens && stats.emails_sent) {
      const openRate = ((stats.total_opens / stats.emails_sent) * 100).toFixed(1)
      parts.push(`- Open Rate: ${openRate}%`)
    }
    
    if (stats.total_clicks && stats.emails_sent) {
      const clickRate = ((stats.total_clicks / stats.emails_sent) * 100).toFixed(1)
      parts.push(`- Click Rate: ${clickRate}%`)
    }
    
    parts.push(`\nSynced from ColdCopy on ${new Date().toLocaleDateString()}`)
    
    return parts.join('\n')
  }

  private calculateCloseDate(campaign: any, stats: any): string {
    // Estimate close date based on campaign activity and engagement
    const now = new Date()
    let daysToClose = 30 // Default 30 days
    
    // Adjust based on engagement
    const engagementScore = (stats.total_opens || 0) + (stats.total_clicks || 0) * 2 + (stats.total_replies || 0) * 5
    
    if (engagementScore > 50) {
      daysToClose = 15 // High engagement = shorter sales cycle
    } else if (engagementScore > 20) {
      daysToClose = 20
    } else if (engagementScore < 5) {
      daysToClose = 60 // Low engagement = longer sales cycle
    }
    
    // Adjust based on campaign status
    if (campaign.status === 'completed') {
      daysToClose = 7 // Close soon if campaign is complete
    } else if (campaign.status === 'paused') {
      daysToClose = 90 // Longer cycle if paused
    }
    
    const closeDate = new Date(now.getTime() + daysToClose * 24 * 60 * 60 * 1000)
    return closeDate.toISOString().split('T')[0] // YYYY-MM-DD format
  }

  private async searchDealsByName(hubspot: any, dealName: string): Promise<HubSpotDeal[]> {
    try {
      const response = await hubspot.makeRequest('/crm/v3/objects/deals/search', {
        method: 'POST',
        body: JSON.stringify({
          filterGroups: [{
            filters: [{
              propertyName: 'dealname',
              operator: 'EQ',
              value: dealName,
            }]
          }],
          limit: 10,
        }),
      })

      return response.results || []
    } catch (error) {
      console.warn('Deal search failed:', error)
      return []
    }
  }

  private async associateDealWithCampaignContacts(campaignId: string, dealId: string): Promise<void> {
    const supabase = await createClient()
    const hubspot = await createHubSpotClient(this.workspaceId)
    
    if (!hubspot) return

    try {
      // Get campaign leads that are mapped to HubSpot contacts
      const { data: campaignLeads } = await supabase
        .from('campaign_leads')
        .select(`
          lead_id,
          hubspot_object_mappings!inner(hubspot_id)
        `)
        .eq('campaign_id', campaignId)
        .eq('hubspot_object_mappings.workspace_id', this.workspaceId)
        .eq('hubspot_object_mappings.object_type', 'contacts')

      if (!campaignLeads) return

      // Associate each contact with the deal
      for (const campaignLead of campaignLeads) {
        try {
          const contactId = campaignLead.hubspot_object_mappings.hubspot_id
          
          await hubspot.makeRequest(`/crm/v3/objects/deals/${dealId}/associations/contacts/${contactId}/deal_to_contact`, {
            method: 'PUT',
          })
        } catch (error) {
          console.warn(`Failed to associate contact with deal:`, error)
          // Continue with other associations even if one fails
        }
      }
    } catch (error) {
      console.error('Failed to associate deal with campaign contacts:', error)
    }
  }

  async updateDealFromCampaignStats(campaignId: string): Promise<void> {
    const supabase = await createClient()
    const hubspot = await createHubSpotClient(this.workspaceId)
    
    if (!hubspot) {
      throw new Error('HubSpot not connected')
    }

    // Get deal mapping
    const { data: mapping } = await supabase
      .from('hubspot_object_mappings')
      .select('hubspot_id')
      .eq('workspace_id', this.workspaceId)
      .eq('object_type', 'deals')
      .eq('coldcopy_id', campaignId)
      .single()

    if (!mapping) {
      throw new Error('Deal mapping not found')
    }

    // Get updated campaign stats
    const { data: campaign } = await supabase
      .from('campaigns')
      .select(`
        *,
        campaign_stats:campaign_analytics(
          total_leads,
          emails_sent,
          total_opens,
          total_clicks,
          total_replies
        )
      `)
      .eq('id', campaignId)
      .single()

    if (!campaign) {
      throw new Error('Campaign not found')
    }

    const stats = campaign.campaign_stats?.[0] || {}
    const dealValue = this.calculateDealValue(stats)
    
    // Update deal with new stats
    await hubspot.updateDeal(mapping.hubspot_id, {
      amount: dealValue,
      description: this.buildDealDescription(campaign, stats),
      hs_num_contacted_deals: stats.total_leads?.toString() || '0',
    })

    // Update mapping metadata
    await supabase
      .from('hubspot_object_mappings')
      .update({
        metadata: {
          ...mapping.metadata,
          deal_value: dealValue,
          last_updated: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', mapping.id)
  }

  async syncSingleCampaignToDeal(campaignId: string): Promise<void> {
    const supabase = await createClient()
    const hubspot = await createHubSpotClient(this.workspaceId)
    
    if (!hubspot) {
      throw new Error('HubSpot not connected')
    }

    // Get campaign data
    const { data: campaign } = await supabase
      .from('campaigns')
      .select(`
        *,
        campaign_stats:campaign_analytics(
          total_leads,
          emails_sent,
          total_opens,
          total_clicks,
          total_replies
        )
      `)
      .eq('id', campaignId)
      .eq('workspace_id', this.workspaceId)
      .single()

    if (!campaign) {
      throw new Error('Campaign not found')
    }

    const stats = campaign.campaign_stats?.[0] || {}
    const dealValue = this.calculateDealValue(stats)

    // Get available deal pipelines and stages
    const pipelines = await hubspot.getDealPipelines()
    const defaultPipeline = pipelines.find(p => p.label.toLowerCase().includes('sales')) || pipelines[0]
    const dealStage = this.mapCampaignStatusToDealStage(campaign.status, defaultPipeline)

    const hubspotDeal: Omit<HubSpotDeal, 'id'> = {
      dealname: `${campaign.name} - Cold Outreach Campaign`,
      amount: dealValue,
      dealstage: dealStage || defaultPipeline?.stages[0]?.id,
      pipeline: defaultPipeline?.id,
      dealtype: 'newbusiness',
      description: this.buildDealDescription(campaign, stats),
      closedate: this.calculateCloseDate(campaign, stats),
      hs_deal_source: 'ColdCopy',
      hs_deal_source_id: campaign.id,
      hs_campaign_name: campaign.name,
      hs_num_contacted_deals: stats.total_leads?.toString() || '0',
    }

    // Check if already mapped
    const { data: existingMapping } = await supabase
      .from('hubspot_object_mappings')
      .select('hubspot_id')
      .eq('workspace_id', this.workspaceId)
      .eq('object_type', 'deals')
      .eq('coldcopy_id', campaignId)
      .single()

    let hubspotDealResult: HubSpotDeal

    if (existingMapping) {
      // Update existing deal
      hubspotDealResult = await hubspot.updateDeal(existingMapping.hubspot_id, hubspotDeal)
    } else {
      // Search for existing deal by name
      const existingDeals = await this.searchDealsByName(hubspot, hubspotDeal.dealname)
      
      if (existingDeals.length > 0) {
        // Update existing deal
        hubspotDealResult = await hubspot.updateDeal(existingDeals[0].id!, hubspotDeal)
      } else {
        // Create new deal
        hubspotDealResult = await hubspot.createDeal(hubspotDeal)
      }

      // Create mapping
      await supabase
        .from('hubspot_object_mappings')
        .insert({
          workspace_id: this.workspaceId,
          object_type: 'deals',
          coldcopy_id: campaignId,
          hubspot_id: hubspotDealResult.id!,
          sync_direction: 'to_hubspot',
        })
    }

    // Associate deal with contacts from this campaign
    await this.associateDealWithCampaignContacts(campaignId, hubspotDealResult.id!)
  }
}