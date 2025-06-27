export interface HubSpotIntegration {
  id: string;
  workspaceId: string;
  hubId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scopes: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface HubSpotFieldMapping {
  id: string;
  workspaceId: string;
  coldcopyField: string;
  hubspotProperty: string;
  direction: 'to_hubspot' | 'from_hubspot' | 'bidirectional';
  transformFunction?: string;
  createdAt: Date;
}

export interface HubSpotSyncStatus {
  id: string;
  workspaceId: string;
  entityType: 'contact' | 'company' | 'activity';
  entityId: string;
  hubspotId?: string;
  lastSyncedAt?: Date;
  syncHash?: string;
  status: 'pending' | 'synced' | 'error';
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface HubSpotContact {
  id: string;
  properties: {
    email: string;
    firstname?: string;
    lastname?: string;
    company?: string;
    phone?: string;
    website?: string;
    lifecyclestage?: string;
    [key: string]: any;
  };
  createdAt: string;
  updatedAt: string;
}

export interface HubSpotCompany {
  id: string;
  properties: {
    name: string;
    domain?: string;
    industry?: string;
    website?: string;
    numberofemployees?: number;
    annualrevenue?: number;
    [key: string]: any;
  };
  createdAt: string;
  updatedAt: string;
}

export interface HubSpotEngagementEvent {
  id: string;
  eventType: 'EMAIL_SENT' | 'EMAIL_OPENED' | 'EMAIL_CLICKED' | 'EMAIL_REPLIED' | 'EMAIL_BOUNCED';
  email: string;
  subject: string;
  timestamp: string;
  properties: {
    campaignId?: string;
    leadId?: string;
    emailId?: string;
    [key: string]: any;
  };
}

export interface HubSpotWebhookEvent {
  eventId: string;
  subscriptionType: string;
  portalId: number;
  occurredAt: string;
  subscriptionId: number;
  attemptNumber: number;
  objectId: string;
  changeSource: string;
  propertyName?: string;
  propertyValue?: any;
}

export interface HubSpotOAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface HubSpotOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

export interface HubSpotProperty {
  name: string;
  label: string;
  type: string;
  fieldType: string;
  description?: string;
  groupName: string;
  options?: Array<{
    label: string;
    value: string;
  }>;
  displayOrder?: number;
  hasUniqueValue?: boolean;
  modificationMetadata?: {
    readOnly: boolean;
  };
}

export interface HubSpotSyncConfig {
  enabled: boolean;
  syncInterval: number; // minutes
  syncDirection: 'to_hubspot' | 'from_hubspot' | 'bidirectional';
  autoCreateContacts: boolean;
  autoLogActivities: boolean;
  activityTypes: string[];
  customPropertyPrefix?: string;
}

export interface HubSpotApiError {
  status: string;
  message: string;
  correlationId: string;
  category?: string;
  subCategory?: string;
  errors?: Array<{
    message: string;
    in: string;
    code: string;
    subCategory?: string;
  }>;
}

export interface HubSpotBatchOperation<T> {
  inputs: T[];
  results?: Array<{
    id: string;
    status: 'COMPLETE' | 'ERROR';
    error?: HubSpotApiError;
  }>;
}

export interface HubSpotSearchRequest {
  filterGroups?: Array<{
    filters: Array<{
      propertyName: string;
      operator: string;
      value: string;
    }>;
  }>;
  sorts?: Array<{
    propertyName: string;
    direction: 'ASCENDING' | 'DESCENDING';
  }>;
  properties?: string[];
  limit?: number;
  after?: string;
}

export interface HubSpotSearchResponse<T> {
  total: number;
  results: T[];
  paging?: {
    next?: {
      after: string;
      link: string;
    };
  };
}

export class HubSpotAuthError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'HubSpotAuthError';
  }
}

export class HubSpotRateLimitError extends Error {
  constructor(public retryAfter: number) {
    super(`Rate limit exceeded. Retry after ${retryAfter} seconds`);
    this.name = 'HubSpotRateLimitError';
  }
}

export class HubSpotValidationError extends Error {
  constructor(message: string, public errors?: any[]) {
    super(message);
    this.name = 'HubSpotValidationError';
  }
}

export class HubSpotSyncError extends Error {
  constructor(message: string, public entityId?: string, public entityType?: string) {
    super(message);
    this.name = 'HubSpotSyncError';
  }
}