// Salesforce Integration Types

export interface SalesforceIntegration {
  id: string;
  workspace_id: string;
  instance_url: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  salesforce_user_id: string;
  salesforce_org_id: string;
  salesforce_username?: string;
  salesforce_email?: string;
  is_active: boolean;
  sync_enabled: boolean;
  sync_direction: 'to_salesforce' | 'from_salesforce' | 'bidirectional';
  sync_leads: boolean;
  sync_contacts: boolean;
  sync_accounts: boolean;
  sync_opportunities: boolean;
  sync_activities: boolean;
  sync_campaigns: boolean;
  lead_field_mappings: Record<string, any>;
  contact_field_mappings: Record<string, any>;
  account_field_mappings: Record<string, any>;
  opportunity_field_mappings: Record<string, any>;
  sync_frequency_minutes: number;
  last_sync_at?: string;
  last_successful_sync_at?: string;
  api_version: string;
  scopes: string[];
  webhook_secret?: string;
  created_at: string;
  updated_at: string;
}

export interface SalesforceObjectMapping {
  id: string;
  workspace_id: string;
  local_object_type: 'lead' | 'campaign' | 'campaign_email' | 'email_event';
  local_object_id: string;
  salesforce_object_type: 'Lead' | 'Contact' | 'Account' | 'Opportunity' | 'Campaign' | 'Task' | 'Event';
  salesforce_object_id: string;
  last_synced_at: string;
  sync_status: 'synced' | 'pending' | 'error' | 'conflict';
  sync_error?: string;
  local_version: number;
  salesforce_version: number;
  created_at: string;
  updated_at: string;
}

export interface SalesforceSyncQueueItem {
  id: string;
  workspace_id: string;
  operation: 'create' | 'update' | 'delete' | 'upsert';
  object_type: 'Lead' | 'Contact' | 'Account' | 'Opportunity' | 'Campaign' | 'Task' | 'Event';
  salesforce_id?: string;
  local_id?: string;
  payload: Record<string, any>;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  attempts: number;
  max_attempts: number;
  error_message?: string;
  error_code?: string;
  scheduled_for: string;
  started_at?: string;
  completed_at?: string;
  priority: number;
  created_at: string;
  updated_at: string;
}

export interface SalesforceSyncLog {
  id: string;
  workspace_id: string;
  sync_type: 'full' | 'incremental' | 'manual' | 'webhook';
  sync_direction: 'to_salesforce' | 'from_salesforce' | 'bidirectional';
  objects_synced: string[];
  total_records: number;
  created_records: number;
  updated_records: number;
  deleted_records: number;
  failed_records: number;
  duration_seconds?: number;
  api_calls_made: number;
  api_calls_remaining?: number;
  status: 'started' | 'completed' | 'failed' | 'cancelled';
  error_message?: string;
  warnings: any[];
  started_at: string;
  completed_at?: string;
  created_at: string;
}

export interface SalesforceFieldMapping {
  id: string;
  workspace_id: string;
  mapping_name: string;
  salesforce_object: string;
  local_object: string;
  field_mappings: Array<{
    local_field: string;
    salesforce_field: string;
    transform?: string;
    default_value?: any;
  }>;
  is_active: boolean;
  is_default: boolean;
  sync_direction: 'to_salesforce' | 'from_salesforce' | 'bidirectional';
  conflict_resolution: 'salesforce_wins' | 'local_wins' | 'newest_wins' | 'manual';
  created_at: string;
  updated_at: string;
}

export interface SalesforceWebhookEvent {
  id: string;
  workspace_id: string;
  event_type: string;
  object_type: string;
  salesforce_id: string;
  change_type: 'created' | 'updated' | 'deleted' | 'undeleted';
  payload: Record<string, any>;
  changed_fields?: string[];
  processed: boolean;
  processed_at?: string;
  processing_error?: string;
  replay_id?: string;
  event_date?: string;
  created_at: string;
}

export interface SalesforceCustomObject {
  id: string;
  workspace_id: string;
  api_name: string;
  label: string;
  plural_label?: string;
  fields: SalesforceField[];
  sync_enabled: boolean;
  field_mappings: Record<string, any>;
  is_custom: boolean;
  created_by_id?: string;
  last_modified_date?: string;
  created_at: string;
  updated_at: string;
}

export interface SalesforceCampaignMember {
  id: string;
  workspace_id: string;
  campaign_id: string;
  lead_id: string;
  salesforce_campaign_id: string;
  salesforce_lead_id?: string;
  salesforce_contact_id?: string;
  salesforce_campaign_member_id?: string;
  status?: string;
  has_responded: boolean;
  first_responded_date?: string;
  last_synced_at?: string;
  sync_status: 'synced' | 'pending' | 'error';
  created_at: string;
  updated_at: string;
}

// Salesforce API Types
export interface SalesforceField {
  name: string;
  label: string;
  type: string;
  length?: number;
  precision?: number;
  scale?: number;
  custom: boolean;
  required: boolean;
  unique: boolean;
  updateable: boolean;
  createable: boolean;
  picklistValues?: Array<{
    value: string;
    label: string;
    active: boolean;
    defaultValue: boolean;
  }>;
  referenceTo?: string[];
}

export interface SalesforceRecord {
  Id: string;
  Name?: string;
  CreatedDate: string;
  LastModifiedDate: string;
  [key: string]: any;
}

export interface SalesforceLead extends SalesforceRecord {
  FirstName?: string;
  LastName?: string;
  Email?: string;
  Company?: string;
  Title?: string;
  Phone?: string;
  Website?: string;
  Status: string;
  LeadSource?: string;
  Industry?: string;
  NumberOfEmployees?: number;
  AnnualRevenue?: number;
  Rating?: string;
  OwnerId: string;
  IsConverted: boolean;
  ConvertedAccountId?: string;
  ConvertedContactId?: string;
  ConvertedOpportunityId?: string;
}

export interface SalesforceContact extends SalesforceRecord {
  FirstName?: string;
  LastName?: string;
  Email?: string;
  Phone?: string;
  Title?: string;
  Department?: string;
  AccountId?: string;
  OwnerId: string;
  MailingStreet?: string;
  MailingCity?: string;
  MailingState?: string;
  MailingPostalCode?: string;
  MailingCountry?: string;
}

export interface SalesforceAccount extends SalesforceRecord {
  Type?: string;
  Industry?: string;
  Website?: string;
  Phone?: string;
  NumberOfEmployees?: number;
  AnnualRevenue?: number;
  BillingStreet?: string;
  BillingCity?: string;
  BillingState?: string;
  BillingPostalCode?: string;
  BillingCountry?: string;
  OwnerId: string;
}

export interface SalesforceOpportunity extends SalesforceRecord {
  AccountId: string;
  Amount?: number;
  CloseDate: string;
  StageName: string;
  Probability?: number;
  Type?: string;
  LeadSource?: string;
  IsClosed: boolean;
  IsWon: boolean;
  OwnerId: string;
}

export interface SalesforceCampaign extends SalesforceRecord {
  Type?: string;
  Status: string;
  StartDate?: string;
  EndDate?: string;
  ExpectedRevenue?: number;
  BudgetedCost?: number;
  ActualCost?: number;
  ExpectedResponse?: number;
  NumberSent?: number;
  IsActive: boolean;
  OwnerId: string;
  NumberOfLeads?: number;
  NumberOfConvertedLeads?: number;
  NumberOfContacts?: number;
  NumberOfResponses?: number;
  NumberOfOpportunities?: number;
  NumberOfWonOpportunities?: number;
}

export interface SalesforceTask extends SalesforceRecord {
  Subject: string;
  ActivityDate?: string;
  Status: string;
  Priority?: string;
  WhoId?: string; // Lead or Contact ID
  WhatId?: string; // Related to (Account, Opportunity, etc.)
  Description?: string;
  IsReminderSet?: boolean;
  ReminderDateTime?: string;
  OwnerId: string;
}

// API Request/Response Types
export interface SalesforceAuthRequest {
  code: string;
  redirect_uri: string;
}

export interface SalesforceAuthResponse {
  access_token: string;
  refresh_token: string;
  instance_url: string;
  id: string;
  token_type: string;
  issued_at: string;
  signature: string;
}

export interface SalesforceQueryResponse<T = SalesforceRecord> {
  totalSize: number;
  done: boolean;
  records: T[];
  nextRecordsUrl?: string;
}

export interface SalesforceBatchRequest {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  url: string;
  richInput?: Record<string, any>;
}

export interface SalesforceBatchResponse {
  hasErrors: boolean;
  results: Array<{
    statusCode: number;
    result: any;
    headers?: Record<string, string>;
  }>;
}

export interface SalesforceError {
  message: string;
  errorCode: string;
  fields?: string[];
}

// Configuration Types
export interface SalesforceSyncConfig {
  workspace_id: string;
  object_types: string[];
  field_mappings?: Record<string, SalesforceFieldMapping>;
  sync_direction: 'to_salesforce' | 'from_salesforce' | 'bidirectional';
  batch_size?: number;
  include_deleted?: boolean;
  modified_since?: string;
}

export interface SalesforceConnectionConfig {
  client_id: string;
  client_secret: string;
  redirect_uri: string;
  api_version?: string;
  sandbox?: boolean;
}

// Field mapping configuration
export interface FieldMappingConfig {
  local_field: string;
  salesforce_field: string;
  transform?: 'lowercase' | 'uppercase' | 'trim' | 'date' | 'boolean' | 'number' | 'custom';
  custom_transform?: (value: any) => any;
  default_value?: any;
  required?: boolean;
}

// Sync status types
export interface SyncStatus {
  is_syncing: boolean;
  last_sync_at?: string;
  next_sync_at?: string;
  objects_pending: number;
  errors: number;
  warnings: number;
}