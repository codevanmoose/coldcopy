import {
  SalesforceRecord,
  SalesforceLead,
  SalesforceContact,
  SalesforceAccount,
  SalesforceOpportunity,
  SalesforceCampaign,
  SalesforceTask,
  SalesforceQueryResponse,
  SalesforceBatchRequest,
  SalesforceBatchResponse,
  SalesforceError,
  SalesforceField,
} from './types';

export class SalesforceClient {
  private instanceUrl: string;
  private accessToken: string;
  private apiVersion: string;

  constructor(instanceUrl: string, accessToken: string, apiVersion: string = 'v59.0') {
    this.instanceUrl = instanceUrl;
    this.accessToken = accessToken;
    this.apiVersion = apiVersion;
  }

  /**
   * Make an authenticated request to Salesforce API
   */
  private async request<T = any>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.instanceUrl}/services/data/${this.apiVersion}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error[0]?.message || 'Salesforce API error');
    }

    // Handle empty responses
    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  }

  /**
   * Query records using SOQL
   */
  async query<T = SalesforceRecord>(soql: string): Promise<SalesforceQueryResponse<T>> {
    const encodedQuery = encodeURIComponent(soql);
    return this.request<SalesforceQueryResponse<T>>(`/query?q=${encodedQuery}`);
  }

  /**
   * Query all records (handles pagination automatically)
   */
  async *queryAll<T = SalesforceRecord>(soql: string): AsyncGenerator<T[]> {
    let nextUrl: string | undefined;
    let done = false;

    while (!done) {
      const result = nextUrl
        ? await this.request<SalesforceQueryResponse<T>>(nextUrl)
        : await this.query<T>(soql);

      yield result.records;

      done = result.done;
      nextUrl = result.nextRecordsUrl;
    }
  }

  /**
   * Get a single record by ID
   */
  async getRecord<T = SalesforceRecord>(
    objectType: string,
    id: string,
    fields?: string[]
  ): Promise<T> {
    const endpoint = fields
      ? `/sobjects/${objectType}/${id}?fields=${fields.join(',')}`
      : `/sobjects/${objectType}/${id}`;
    
    return this.request<T>(endpoint);
  }

  /**
   * Create a new record
   */
  async createRecord(
    objectType: string,
    data: Record<string, any>
  ): Promise<{ id: string; success: boolean; errors: SalesforceError[] }> {
    return this.request(`/sobjects/${objectType}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Update an existing record
   */
  async updateRecord(
    objectType: string,
    id: string,
    data: Record<string, any>
  ): Promise<void> {
    return this.request(`/sobjects/${objectType}/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  /**
   * Upsert a record by external ID
   */
  async upsertRecord(
    objectType: string,
    externalIdField: string,
    externalId: string,
    data: Record<string, any>
  ): Promise<{ id: string; created: boolean }> {
    return this.request(
      `/sobjects/${objectType}/${externalIdField}/${externalId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(data),
      }
    );
  }

  /**
   * Delete a record
   */
  async deleteRecord(objectType: string, id: string): Promise<void> {
    return this.request(`/sobjects/${objectType}/${id}`, {
      method: 'DELETE',
    });
  }

  /**
   * Execute batch requests
   */
  async batch(requests: SalesforceBatchRequest[]): Promise<SalesforceBatchResponse> {
    const batchRequests = requests.map((req, index) => ({
      method: req.method,
      url: `/services/data/${this.apiVersion}${req.url}`,
      richInput: req.richInput,
    }));

    return this.request('/composite/batch', {
      method: 'POST',
      body: JSON.stringify({
        batchRequests,
      }),
    });
  }

  /**
   * Get object metadata
   */
  async describeObject(objectType: string): Promise<{
    name: string;
    label: string;
    fields: SalesforceField[];
    [key: string]: any;
  }> {
    return this.request(`/sobjects/${objectType}/describe`);
  }

  /**
   * Search records using SOSL
   */
  async search(searchQuery: string): Promise<{
    searchRecords: Array<{
      attributes: { type: string; url: string };
      Id: string;
      [key: string]: any;
    }>;
  }> {
    const encodedQuery = encodeURIComponent(searchQuery);
    return this.request(`/search?q=${encodedQuery}`);
  }

  // Specific object methods

  /**
   * Get leads
   */
  async getLeads(limit: number = 100): Promise<SalesforceLead[]> {
    const result = await this.query<SalesforceLead>(
      `SELECT Id, FirstName, LastName, Email, Company, Title, Phone, 
       Website, Status, LeadSource, Industry, Rating, OwnerId, 
       IsConverted, CreatedDate, LastModifiedDate 
       FROM Lead 
       ORDER BY CreatedDate DESC 
       LIMIT ${limit}`
    );
    return result.records;
  }

  /**
   * Create a lead
   */
  async createLead(lead: Partial<SalesforceLead>): Promise<string> {
    const result = await this.createRecord('Lead', lead);
    if (!result.success) {
      throw new Error(`Failed to create lead: ${result.errors[0]?.message}`);
    }
    return result.id;
  }

  /**
   * Get contacts
   */
  async getContacts(limit: number = 100): Promise<SalesforceContact[]> {
    const result = await this.query<SalesforceContact>(
      `SELECT Id, FirstName, LastName, Email, Phone, Title, 
       Department, AccountId, OwnerId, CreatedDate, LastModifiedDate 
       FROM Contact 
       ORDER BY CreatedDate DESC 
       LIMIT ${limit}`
    );
    return result.records;
  }

  /**
   * Create a contact
   */
  async createContact(contact: Partial<SalesforceContact>): Promise<string> {
    const result = await this.createRecord('Contact', contact);
    if (!result.success) {
      throw new Error(`Failed to create contact: ${result.errors[0]?.message}`);
    }
    return result.id;
  }

  /**
   * Get campaigns
   */
  async getCampaigns(limit: number = 100): Promise<SalesforceCampaign[]> {
    const result = await this.query<SalesforceCampaign>(
      `SELECT Id, Name, Type, Status, StartDate, EndDate, 
       ExpectedRevenue, BudgetedCost, ActualCost, IsActive, 
       NumberOfLeads, NumberOfContacts, NumberOfResponses, 
       NumberOfOpportunities, CreatedDate, LastModifiedDate 
       FROM Campaign 
       ORDER BY CreatedDate DESC 
       LIMIT ${limit}`
    );
    return result.records;
  }

  /**
   * Create a campaign
   */
  async createCampaign(campaign: Partial<SalesforceCampaign>): Promise<string> {
    const result = await this.createRecord('Campaign', campaign);
    if (!result.success) {
      throw new Error(`Failed to create campaign: ${result.errors[0]?.message}`);
    }
    return result.id;
  }

  /**
   * Add lead to campaign
   */
  async addCampaignMember(
    campaignId: string,
    leadId: string,
    status?: string
  ): Promise<string> {
    const result = await this.createRecord('CampaignMember', {
      CampaignId: campaignId,
      LeadId: leadId,
      Status: status || 'Sent',
    });
    if (!result.success) {
      throw new Error(`Failed to add campaign member: ${result.errors[0]?.message}`);
    }
    return result.id;
  }

  /**
   * Create a task
   */
  async createTask(task: Partial<SalesforceTask>): Promise<string> {
    const result = await this.createRecord('Task', task);
    if (!result.success) {
      throw new Error(`Failed to create task: ${result.errors[0]?.message}`);
    }
    return result.id;
  }

  /**
   * Get recent activities for a record
   */
  async getActivities(
    recordId: string,
    limit: number = 10
  ): Promise<SalesforceTask[]> {
    const result = await this.query<SalesforceTask>(
      `SELECT Id, Subject, ActivityDate, Status, Priority, 
       WhoId, WhatId, Description, OwnerId, CreatedDate 
       FROM Task 
       WHERE WhoId = '${recordId}' OR WhatId = '${recordId}' 
       ORDER BY CreatedDate DESC 
       LIMIT ${limit}`
    );
    return result.records;
  }

  /**
   * Convert a lead to contact, account, and opportunity
   */
  async convertLead(
    leadId: string,
    options: {
      accountId?: string;
      contactId?: string;
      opportunityName?: string;
      doNotCreateOpportunity?: boolean;
      ownerId?: string;
      sendNotificationEmail?: boolean;
    } = {}
  ): Promise<{
    accountId: string;
    contactId: string;
    opportunityId?: string;
    success: boolean;
  }> {
    return this.request('/sobjects/LeadConvert', {
      method: 'POST',
      body: JSON.stringify({
        leadId,
        convertedStatus: 'Qualified',
        ...options,
      }),
    });
  }

  /**
   * Get picklist values for a field
   */
  async getPicklistValues(
    objectType: string,
    fieldName: string
  ): Promise<Array<{ value: string; label: string }>> {
    const metadata = await this.describeObject(objectType);
    const field = metadata.fields.find(f => f.name === fieldName);
    
    if (!field || !field.picklistValues) {
      throw new Error(`Field ${fieldName} not found or is not a picklist`);
    }

    return field.picklistValues
      .filter(pv => pv.active)
      .map(pv => ({ value: pv.value, label: pv.label }));
  }

  /**
   * Execute anonymous Apex code
   */
  async executeApex(apexCode: string): Promise<{
    compiled: boolean;
    compileProblem?: string;
    success: boolean;
    line?: number;
    column?: number;
    exceptionMessage?: string;
    exceptionStackTrace?: string;
  }> {
    const encodedCode = encodeURIComponent(apexCode);
    return this.request(
      `/tooling/executeAnonymous?anonymousBody=${encodedCode}`,
      { method: 'GET' }
    );
  }

  /**
   * Get API limits
   */
  async getLimits(): Promise<Record<string, { Max: number; Remaining: number }>> {
    return this.request('/limits');
  }
}