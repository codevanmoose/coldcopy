import { HubSpotFieldMapping, HubSpotSyncStatus, HubSpotWebhookEvent } from '@/lib/integrations/hubspot/types';

export interface FieldMappingItem {
  id: string;
  coldcopyField: ColdCopyField;
  hubspotProperty: HubSpotPropertyField;
  direction: 'to_hubspot' | 'from_hubspot' | 'bidirectional';
  transformFunction?: string;
}

export interface ColdCopyField {
  name: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'email' | 'phone';
  required?: boolean;
  category: 'lead' | 'campaign' | 'engagement' | 'custom';
}

export interface HubSpotPropertyField {
  name: string;
  label: string;
  type: string;
  fieldType: string;
  groupName: string;
  required?: boolean;
}

export interface WorkflowTrigger {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  triggerType: 'lead_created' | 'email_sent' | 'email_opened' | 'email_clicked' | 'email_replied' | 'lead_enriched';
  hubspotWorkflowId?: string;
  conditions?: TriggerCondition[];
  createdAt: Date;
  updatedAt: Date;
}

export interface TriggerCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than';
  value: string | number | boolean;
}

export interface WebhookSubscription {
  id: string;
  eventType: string;
  propertyName?: string;
  active: boolean;
  hubspotSubscriptionId?: number;
  createdAt: Date;
  lastTriggered?: Date;
  callbackUrl: string;
}

export interface SyncHistory {
  id: string;
  syncType: 'manual' | 'scheduled' | 'webhook';
  direction: 'to_hubspot' | 'from_hubspot' | 'bidirectional';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  recordsProcessed: number;
  recordsFailed: number;
  errorMessage?: string;
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
}

export interface ErrorLog {
  id: string;
  timestamp: Date;
  errorType: 'auth' | 'api' | 'sync' | 'webhook' | 'validation';
  message: string;
  details?: any;
  severity: 'low' | 'medium' | 'high' | 'critical';
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
}

export interface HubSpotConnectionStatus {
  connected: boolean;
  hubId?: string;
  portalName?: string;
  lastVerified?: Date;
  scopes?: string[];
  expiresAt?: Date;
}

export interface SyncSettings {
  enabled: boolean;
  syncInterval: number;
  syncDirection: 'to_hubspot' | 'from_hubspot' | 'bidirectional';
  autoCreateContacts: boolean;
  autoLogActivities: boolean;
  activityTypes: string[];
  batchSize: number;
  retryAttempts: number;
  customPropertyPrefix?: string;
}