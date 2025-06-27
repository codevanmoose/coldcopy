// Pipedrive webhook event types
export interface PipedriveWebhookEvent {
  v?: number;
  matches_filters?: {
    current?: any[];
    previous?: any[];
  };
  meta: PipedriveWebhookMeta;
  retry_object?: any;
  current?: any;
  previous?: any;
  event?: string;
  retry?: number;
}

export interface PipedriveWebhookMeta {
  v: number;
  action: 'added' | 'updated' | 'deleted' | 'merged';
  object: 'person' | 'organization' | 'deal' | 'activity' | 'user' | 'note' | 'file' | 'product' | 'stage';
  id: number;
  company_id: number;
  user_id: number;
  host: string;
  timestamp: number;
  timestamp_micro: number;
  permitted_user_ids?: number[];
  trans_pending?: boolean;
  is_bulk_update?: boolean;
  pipedrive_service_name?: string;
  change_source?: string;
  matches_filters?: {
    current?: any[];
    previous?: any[];
  };
}

// Database types
export interface PipedriveWebhookEventRecord {
  id: string;
  workspace_id: string;
  webhook_id?: string;
  event_id: string;
  event_action: 'added' | 'updated' | 'deleted' | 'merged';
  event_object: 'person' | 'organization' | 'deal' | 'activity' | 'user' | 'note' | 'file' | 'product' | 'stage';
  object_id: number;
  retry_object?: any;
  current_data: any;
  previous_data?: any;
  meta_data?: any;
  user_id?: number;
  company_id?: number;
  processed_at?: string;
  processing_status: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';
  error_message?: string;
  retry_count: number;
  next_retry_at?: string;
  created_at: string;
  event_time: string;
}

export interface PipedriveWebhookSignature {
  id: string;
  workspace_id: string;
  webhook_secret: string;
  created_at: string;
  rotated_at?: string;
  is_active: boolean;
}

export interface PipedriveSyncQueueItem {
  id: string;
  workspace_id: string;
  operation: 'create' | 'update' | 'delete';
  entity_type: 'person' | 'organization' | 'deal' | 'activity' | 'note';
  entity_id: string;
  pipedrive_id?: number;
  data: any;
  field_mappings?: any;
  priority: number;
  scheduled_at: string;
  processed_at?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  error_message?: string;
  retry_count: number;
  max_retries: number;
  created_at: string;
  updated_at: string;
}

export interface PipedriveSyncLock {
  id: string;
  workspace_id: string;
  entity_type: string;
  entity_id: string;
  lock_type: 'exclusive' | 'shared';
  locked_by: string;
  locked_at: string;
  expires_at: string;
  released_at?: string;
}

export interface PipedriveWebhookRoute {
  id: string;
  workspace_id: string;
  event_action: string;
  event_object: string;
  handler_name: string;
  handler_config: any;
  filter_conditions: any;
  priority: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PipedriveSyncMetrics {
  id: string;
  workspace_id: string;
  metric_date: string;
  entity_type: string;
  events_received: number;
  events_processed: number;
  events_failed: number;
  sync_operations: number;
  sync_conflicts: number;
  avg_processing_time_ms?: number;
  created_at: string;
  updated_at: string;
}

export interface PipedriveWebhookStatus {
  id: string;
  workspace_id: string;
  webhook_url: string;
  last_event_at?: string;
  last_error_at?: string;
  last_error_message?: string;
  consecutive_failures: number;
  is_healthy: boolean;
  health_check_at?: string;
  created_at: string;
  updated_at: string;
}

export interface PipedriveSyncConflict {
  id: string;
  workspace_id: string;
  entity_type: string;
  entity_id: string;
  pipedrive_id?: number;
  conflict_type: string;
  coldcopy_data: any;
  pipedrive_data: any;
  resolution_status: 'pending' | 'resolved' | 'ignored';
  resolved_data?: any;
  resolved_at?: string;
  resolved_by?: string;
  created_at: string;
}

// API response types
export interface WebhookSubscriptionResponse {
  message: string;
  webhook_id: string;
  pipedrive_webhook_id: number;
  event: string;
}

export interface WebhookListResponse {
  webhooks: Array<{
    id: string;
    workspace_id: string;
    pipedrive_webhook_id: number;
    event_action: string;
    event_object: string;
    subscription_url: string;
    version: string;
    active: boolean;
    created_at: string;
    updated_at: string;
    pipedrive_webhook_routes?: PipedriveWebhookRoute[];
  }>;
  status: {
    is_healthy: boolean;
    last_event_at?: string;
    last_error_at?: string;
    consecutive_failures: number;
  };
}

export interface SyncStatusResponse {
  queue: Array<{
    status: string;
    count: number;
  }>;
  conflicts: PipedriveSyncConflict[];
  metrics: PipedriveSyncMetrics[];
}

export interface MonitoringResponse {
  summary: {
    total_events: number;
    processed_events: number;
    failed_events: number;
    pending_events: number;
    processing_rate: string;
    webhook_health: 'healthy' | 'unhealthy';
    active_locks: number;
  };
  event_stats: Array<{
    event_action: string;
    event_object: string;
    processing_status: string;
    count: string;
  }>;
  recent_events: PipedriveWebhookEventRecord[];
  failed_events: PipedriveWebhookEventRecord[];
  sync_metrics: PipedriveSyncMetrics[];
  webhook_status?: PipedriveWebhookStatus;
  time_range: string;
}

export interface ConflictResolutionRequest {
  conflict_id: string;
  resolution: 'use_coldcopy' | 'use_pipedrive' | 'merge' | 'ignore';
  merge_data?: any;
}

export interface BulkConflictResolutionRequest {
  conflict_ids: string[];
  resolution: 'use_coldcopy' | 'use_pipedrive' | 'ignore';
}

// Event handler types
export type WebhookEventHandler = (
  event: PipedriveWebhookEvent,
  workspaceId: string
) => Promise<void>;

export interface WebhookEventHandlers {
  [key: string]: WebhookEventHandler;
}

// Sync operation types
export interface SyncOperation {
  workspace_id: string;
  operation: 'create' | 'update' | 'delete';
  entity_type: string;
  entity_id: string;
  pipedrive_id?: number;
  data: any;
  field_mappings?: any;
  priority?: number;
}

// Field mapping types
export interface FieldMapping {
  id: string;
  workspace_id: string;
  source_field: string;
  target_field: string;
  source_system: 'coldcopy' | 'pipedrive';
  target_system: 'coldcopy' | 'pipedrive';
  field_type: string;
  transformation?: any;
  required: boolean;
  bidirectional: boolean;
  created_at: string;
  updated_at: string;
}