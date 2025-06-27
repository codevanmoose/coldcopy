import { createClient } from '@/lib/supabase/server'

export interface HubSpotConfig {
  accessToken: string
  refreshToken: string
  expiresAt: Date
  portalId: number
  hubDomain?: string
}

export interface HubSpotContact {
  id?: string
  email: string
  firstname?: string
  lastname?: string
  company?: string
  phone?: string
  website?: string
  jobtitle?: string
  lifecyclestage?: string
  lead_source?: string
  [key: string]: any
}

export interface HubSpotCompany {
  id?: string
  name: string
  domain?: string
  industry?: string
  phone?: string
  city?: string
  state?: string
  country?: string
  [key: string]: any
}

export interface HubSpotDeal {
  id?: string
  dealname: string
  amount?: number
  dealstage?: string
  pipeline?: string
  closedate?: string
  dealtype?: string
  description?: string
  [key: string]: any
}

export interface HubSpotActivity {
  id?: string
  activityType: string
  timestamp: number
  contactId?: string
  dealId?: string
  subject?: string
  body?: string
  outcome?: string
  [key: string]: any
}

export class HubSpotClient {
  private config: HubSpotConfig
  private baseURL = 'https://api.hubapi.com'

  constructor(config: HubSpotConfig) {
    this.config = config
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`
    
    const headers = {
      'Authorization': `Bearer ${this.config.accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    }

    const response = await fetch(url, {
      ...options,
      headers,
    })

    if (response.status === 401) {
      // Token expired, need to refresh
      throw new Error('TOKEN_EXPIRED')
    }

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`HubSpot API Error: ${response.status} - ${error}`)
    }

    return response.json()
  }

  // Contacts API
  async getContacts(limit = 100, after?: string): Promise<{
    results: HubSpotContact[]
    paging?: { next?: { after: string } }
  }> {
    const params = new URLSearchParams({
      limit: limit.toString(),
      ...(after && { after }),
    })

    return this.makeRequest(`/crm/v3/objects/contacts?${params}`)
  }

  async getContact(contactId: string): Promise<HubSpotContact> {
    return this.makeRequest(`/crm/v3/objects/contacts/${contactId}`)
  }

  async createContact(contact: Omit<HubSpotContact, 'id'>): Promise<HubSpotContact> {
    return this.makeRequest('/crm/v3/objects/contacts', {
      method: 'POST',
      body: JSON.stringify({ properties: contact }),
    })
  }

  async updateContact(contactId: string, contact: Partial<HubSpotContact>): Promise<HubSpotContact> {
    return this.makeRequest(`/crm/v3/objects/contacts/${contactId}`, {
      method: 'PATCH',
      body: JSON.stringify({ properties: contact }),
    })
  }

  async deleteContact(contactId: string): Promise<void> {
    await this.makeRequest(`/crm/v3/objects/contacts/${contactId}`, {
      method: 'DELETE',
    })
  }

  async searchContacts(query: string): Promise<{
    results: HubSpotContact[]
    total: number
  }> {
    return this.makeRequest('/crm/v3/objects/contacts/search', {
      method: 'POST',
      body: JSON.stringify({
        filterGroups: [{
          filters: [{
            propertyName: 'email',
            operator: 'CONTAINS_TOKEN',
            value: query,
          }]
        }],
        limit: 100,
      }),
    })
  }

  // Companies API
  async getCompanies(limit = 100, after?: string): Promise<{
    results: HubSpotCompany[]
    paging?: { next?: { after: string } }
  }> {
    const params = new URLSearchParams({
      limit: limit.toString(),
      ...(after && { after }),
    })

    return this.makeRequest(`/crm/v3/objects/companies?${params}`)
  }

  async createCompany(company: Omit<HubSpotCompany, 'id'>): Promise<HubSpotCompany> {
    return this.makeRequest('/crm/v3/objects/companies', {
      method: 'POST',
      body: JSON.stringify({ properties: company }),
    })
  }

  async updateCompany(companyId: string, company: Partial<HubSpotCompany>): Promise<HubSpotCompany> {
    return this.makeRequest(`/crm/v3/objects/companies/${companyId}`, {
      method: 'PATCH',
      body: JSON.stringify({ properties: company }),
    })
  }

  // Deals API
  async getDeals(limit = 100, after?: string): Promise<{
    results: HubSpotDeal[]
    paging?: { next?: { after: string } }
  }> {
    const params = new URLSearchParams({
      limit: limit.toString(),
      ...(after && { after }),
    })

    return this.makeRequest(`/crm/v3/objects/deals?${params}`)
  }

  async createDeal(deal: Omit<HubSpotDeal, 'id'>): Promise<HubSpotDeal> {
    return this.makeRequest('/crm/v3/objects/deals', {
      method: 'POST',
      body: JSON.stringify({ properties: deal }),
    })
  }

  async updateDeal(dealId: string, deal: Partial<HubSpotDeal>): Promise<HubSpotDeal> {
    return this.makeRequest(`/crm/v3/objects/deals/${dealId}`, {
      method: 'PATCH',
      body: JSON.stringify({ properties: deal }),
    })
  }

  // Activities/Engagements API
  async createActivity(activity: HubSpotActivity): Promise<HubSpotActivity> {
    const engagement = {
      engagement: {
        active: true,
        type: activity.activityType,
        timestamp: activity.timestamp,
      },
      associations: {
        ...(activity.contactId && { contactIds: [activity.contactId] }),
        ...(activity.dealId && { dealIds: [activity.dealId] }),
      },
      metadata: {
        subject: activity.subject,
        body: activity.body,
        outcome: activity.outcome,
      },
    }

    return this.makeRequest('/engagements/v1/engagements', {
      method: 'POST',
      body: JSON.stringify(engagement),
    })
  }

  // Account info
  async getAccountInfo(): Promise<{
    portalId: number
    accountType: string
    timeZone: string
    companyCurrency: string
    additionalCurrencies: string[]
  }> {
    return this.makeRequest('/account-info/v3/details')
  }

  // Properties API
  async getContactProperties(): Promise<Array<{
    name: string
    label: string
    type: string
    fieldType: string
    description?: string
  }>> {
    const response = await this.makeRequest<{ results: any[] }>('/crm/v3/properties/contacts')
    return response.results
  }

  async getCompanyProperties(): Promise<Array<{
    name: string
    label: string
    type: string
    fieldType: string
    description?: string
  }>> {
    const response = await this.makeRequest<{ results: any[] }>('/crm/v3/properties/companies')
    return response.results
  }

  async getDealProperties(): Promise<Array<{
    name: string
    label: string
    type: string
    fieldType: string
    description?: string
  }>> {
    const response = await this.makeRequest<{ results: any[] }>('/crm/v3/properties/deals')
    return response.results
  }

  async getProperties(objectType: string): Promise<Array<{
    name: string
    label: string
    type: string
    fieldType: string
    description?: string
    hidden?: boolean
    options?: Array<{ label: string; value: string }>
  }>> {
    const response = await this.makeRequest<{ results: any[] }>(`/crm/v3/properties/${objectType}`)
    return response.results.map(prop => ({
      name: prop.name,
      label: prop.label,
      type: prop.type,
      fieldType: prop.fieldType,
      description: prop.description,
      hidden: prop.hidden,
      options: prop.options?.map((opt: any) => ({
        label: opt.label,
        value: opt.value,
      })),
    }))
  }

  // Pipelines API
  async getDealPipelines(): Promise<Array<{
    id: string
    label: string
    stages: Array<{
      id: string
      label: string
      displayOrder: number
    }>
  }>> {
    const response = await this.makeRequest<{ results: any[] }>('/crm/v3/pipelines/deals')
    return response.results
  }
}

// Utility function to create HubSpot client for workspace
export async function createHubSpotClient(workspaceId: string): Promise<HubSpotClient | null> {
  const supabase = await createClient()
  
  const { data: connection } = await supabase
    .rpc('get_hubspot_connection', { p_workspace_id: workspaceId })
    .single()

  if (!connection || !connection.is_active) {
    return null
  }

  // Check if token is expired
  const now = new Date()
  const expiresAt = new Date(connection.expires_at)
  
  if (now >= expiresAt) {
    // Token expired, need to refresh
    try {
      const refreshedConfig = await refreshHubSpotToken(workspaceId, connection.refresh_token)
      return new HubSpotClient(refreshedConfig)
    } catch (error) {
      console.error('Failed to refresh HubSpot token:', error)
      return null
    }
  }

  return new HubSpotClient({
    accessToken: connection.access_token,
    refreshToken: connection.refresh_token,
    expiresAt: expiresAt,
    portalId: connection.portal_id,
    hubDomain: connection.hub_domain,
  })
}

// Refresh HubSpot access token
export async function refreshHubSpotToken(
  workspaceId: string,
  refreshToken: string
): Promise<HubSpotConfig> {
  const response = await fetch('https://api.hubapi.com/oauth/v1/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: process.env.HUBSPOT_CLIENT_ID!,
      client_secret: process.env.HUBSPOT_CLIENT_SECRET!,
      refresh_token: refreshToken,
    }),
  })

  if (!response.ok) {
    throw new Error('Failed to refresh HubSpot token')
  }

  const data = await response.json()
  const expiresAt = new Date(Date.now() + data.expires_in * 1000)

  // Update token in database
  const supabase = await createClient()
  await supabase
    .from('hubspot_connections')
    .update({
      access_token: data.access_token,
      refresh_token: data.refresh_token || refreshToken,
      expires_at: expiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('workspace_id', workspaceId)

  // Return the account info to get portal_id
  const tempClient = new HubSpotClient({
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresAt,
    portalId: 0, // Will be updated
  })

  const accountInfo = await tempClient.getAccountInfo()

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresAt,
    portalId: accountInfo.portalId,
  }
}