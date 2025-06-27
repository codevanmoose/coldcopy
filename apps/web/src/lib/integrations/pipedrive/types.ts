export interface PipedriveIntegration {
  id: string;
  workspaceId: string;
  companyDomain: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  tokenType: string;
  scopes: string[];
  apiToken?: string; // Fallback for API token auth
  createdAt: Date;
  updatedAt: Date;
}

export interface PipedriveFieldMapping {
  id: string;
  workspaceId: string;
  sourceField: string;
  targetField: string;
  sourceSystem: 'coldcopy' | 'pipedrive';
  targetSystem: 'coldcopy' | 'pipedrive';
  fieldType: PipedriveFieldType;
  transformation?: FieldTransformation;
  required: boolean;
  bidirectional: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export enum PipedriveFieldType {
  VARCHAR = 'varchar',
  TEXT = 'text',
  INT = 'int',
  DECIMAL = 'decimal',
  DATE = 'date',
  DATETIME = 'datetime',
  TIME = 'time',
  PHONE = 'phone',
  EMAIL = 'email',
  ENUM = 'enum',
  SET = 'set',
  MONETARY = 'monetary',
  USER = 'user',
  ORGANIZATION = 'org',
  PERSON = 'people',
  VISIBLE_TO = 'visible_to'
}

export interface FieldTransformation {
  type: 'format' | 'lookup' | 'calculation' | 'conditional';
  config: Record<string, any>;
}

export interface PipedriveSyncStatus {
  id: string;
  workspaceId: string;
  entityType: 'person' | 'organization' | 'deal' | 'activity';
  entityId: string;
  pipedriveId?: number;
  lastSyncedAt?: Date;
  syncHash?: string;
  status: 'pending' | 'synced' | 'error';
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PipedrivePerson {
  id: number;
  name: string;
  first_name?: string;
  last_name?: string;
  phone: string[];
  email: string[];
  org_id?: number;
  owner_id: number;
  add_time: string;
  update_time: string;
  visible_to: string;
  custom_fields?: Record<string, any>;
  label?: number;
  cc_email?: string;
  picture_id?: {
    item_type: string;
    item_id: number;
    active_flag: boolean;
    add_time: string;
    update_time: string;
    added_by_user_id: number;
    pictures: Record<string, string>;
  };
}

export interface PipedriveOrganization {
  id: number;
  name: string;
  people_count?: number;
  owner_id: number;
  address?: string;
  address_subpremise?: string;
  address_street_number?: string;
  address_route?: string;
  address_sublocality?: string;
  address_locality?: string;
  address_admin_area_level_1?: string;
  address_admin_area_level_2?: string;
  address_country?: string;
  address_postal_code?: string;
  address_formatted_address?: string;
  add_time: string;
  update_time: string;
  visible_to: string;
  custom_fields?: Record<string, any>;
  label?: number;
  cc_email?: string;
  picture_id?: {
    item_type: string;
    item_id: number;
    active_flag: boolean;
    add_time: string;
    update_time: string;
    added_by_user_id: number;
    pictures: Record<string, string>;
  };
}

export interface PipedriveDeal {
  id: number;
  title: string;
  value?: number;
  currency?: string;
  person_id?: number;
  org_id?: number;
  stage_id: number;
  status: 'open' | 'won' | 'lost' | 'deleted';
  probability?: number;
  add_time: string;
  update_time: string;
  stage_change_time?: string;
  won_time?: string;
  lost_time?: string;
  close_time?: string;
  lost_reason?: string;
  visible_to: string;
  pipeline_id: number;
  weighted_value?: number;
  weighted_value_currency?: string;
  owner_id: number;
  creator_user_id?: number;
  custom_fields?: Record<string, any>;
  expected_close_date?: string;
  label?: number;
  rotten_time?: string;
  notes_count?: number;
  files_count?: number;
  followers_count?: number;
  email_messages_count?: number;
  activities_count?: number;
  done_activities_count?: number;
  undone_activities_count?: number;
  reference_activities_count?: number;
  participants_count?: number;
}

export interface PipedriveActivity {
  id: number;
  subject: string;
  type: string; // 'call', 'meeting', 'task', 'deadline', 'email', 'lunch'
  due_date?: string;
  due_time?: string;
  duration?: string;
  person_id?: number;
  org_id?: number;
  deal_id?: number;
  done: boolean;
  add_time: string;
  marked_as_done_time?: string;
  note?: string;
  owner_id: number;
  created_by_user_id?: number;
  location?: string;
  public_description?: string;
  busy_flag?: boolean;
  attendees?: Array<{
    email_address: string;
    is_organizer: boolean;
    name: string;
    person_id: number;
    status: string;
    user_id: number;
  }>;
  participants?: Array<{
    person_id: number;
    primary_flag: boolean;
  }>;
  custom_fields?: Record<string, any>;
  update_time?: string;
  active_flag?: boolean;
  update_user_id?: number;
  source_timezone?: string;
  rec_rule?: string;
  rec_rule_extension?: string;
  rec_master_activity_id?: number;
  conference_meeting?: {
    meeting_url: string;
    meeting_id: string;
  };
}

export interface PipedrivePipeline {
  id: number;
  name: string;
  url_title: string;
  order_nr: number;
  active: boolean;
  deal_probability: boolean;
  add_time: string;
  update_time: string;
  selected: boolean;
}

export interface PipedriveStage {
  id: number;
  order_nr: number;
  name: string;
  active_flag: boolean;
  deal_probability: number;
  pipeline_id: number;
  rotten_flag: boolean;
  rotten_days?: number;
  add_time: string;
  update_time: string;
}

export interface PipedriveField {
  id: number;
  key: string;
  name: string;
  order_nr: number;
  field_type: PipedriveFieldType;
  add_time: string;
  update_time: string;
  active_flag: boolean;
  edit_flag: boolean;
  index_visible_flag: boolean;
  details_visible_flag: boolean;
  add_visible_flag: boolean;
  important_flag: boolean;
  bulk_edit_allowed: boolean;
  searchable_flag: boolean;
  filtering_allowed: boolean;
  sortable_flag: boolean;
  options?: Array<{
    id: number;
    label: string;
  }>;
  mandatory_flag?: boolean;
}

export interface PipedriveWebhookEvent {
  event: string;
  action: 'added' | 'updated' | 'deleted' | 'merged';
  object: 'person' | 'organization' | 'deal' | 'activity' | 'user';
  timestamp: string;
  selected_ids?: number[];
  event_id: string;
  company_id: number;
  user_id: number;
  http_status: number;
  version: string;
  current?: any;
  previous?: any;
}

export interface PipedriveOAuthTokens {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type: string;
  scope?: string;
}

export interface PipedriveOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
  authUrl: string;
  tokenUrl: string;
}

export interface PipedriveApiResponse<T> {
  success: boolean;
  data: T;
  additional_data?: {
    pagination?: {
      start: number;
      limit: number;
      more_items_in_collection: boolean;
      next_start?: number;
    };
  };
  related_objects?: {
    user?: Record<string, any>;
    organization?: Record<string, any>;
    person?: Record<string, any>;
    deal?: Record<string, any>;
    activity?: Record<string, any>;
  };
}

export interface PipedriveSearchRequest {
  term: string;
  fields?: string;
  exact?: boolean;
  person_id?: number;
  organization_id?: number;
  deal_id?: number;
  include_fields?: string;
  start?: number;
  limit?: number;
}

export interface PipedriveSearchResponse<T> {
  success: boolean;
  data: {
    items: Array<{
      item: T;
      result_score: number;
    }>;
  };
  additional_data?: {
    pagination?: {
      start: number;
      limit: number;
      more_items_in_collection: boolean;
      next_start?: number;
    };
  };
}

export interface PipedriveBatchOperation<T> {
  inputs: T[];
  results?: Array<{
    data: T;
    success: boolean;
    error?: PipedriveApiError;
  }>;
}

export interface TokenBudgetInfo {
  dailyBudget: number;
  currentUsage: number;
  resetTime: Date;
  remainingTokens: number;
}

export interface PipedriveRateLimitInfo {
  remaining: number;
  limit: number;
  reset: number;
  burstRemaining: number;
  burstLimit: number;
}

export interface PipedriveApiError {
  error: string;
  error_info?: string;
  data?: any;
  additional_data?: any;
}

export interface PipedriveEngagementEvent {
  id: string;
  eventType: 'EMAIL_SENT' | 'EMAIL_OPENED' | 'EMAIL_CLICKED' | 'EMAIL_REPLIED' | 'EMAIL_BOUNCED' | 'CALL_MADE' | 'MEETING_SCHEDULED';
  email?: string;
  phone?: string;
  subject?: string;
  timestamp: string;
  properties: {
    campaignId?: string;
    leadId?: string;
    dealId?: number;
    personId?: number;
    orgId?: number;
    duration?: string;
    [key: string]: any;
  };
}

export interface PipedriveSyncConfig {
  enabled: boolean;
  syncInterval: number; // minutes
  syncDirection: 'to_pipedrive' | 'from_pipedrive' | 'bidirectional';
  autoCreatePersons: boolean;
  autoCreateOrganizations: boolean;
  autoCreateDeals: boolean;
  autoLogActivities: boolean;
  activityTypes: string[];
  defaultPipelineId?: number;
  defaultStageId?: number;
  customFieldPrefix?: string;
  conflictResolution: 'latest_wins' | 'pipedrive_wins' | 'coldcopy_wins' | 'manual';
}

export interface PipedrivePersonMapping {
  pipedrivePersonId: number;
  coldcopyLeadId: string;
  emailPrimary: string;
  phonePrimary?: string;
  organizationName?: string;
  jobTitle?: string;
  enrichmentData?: Record<string, any>;
  syncStatus: 'pending' | 'synced' | 'error';
  lastSync: string;
}

export interface PipedriveOrganizationMapping {
  pipedriveOrgId: number;
  companyDomain?: string;
  employeeCount?: number;
  industry?: string;
  annualRevenue?: number;
  technologyStack?: string[];
  enrichmentData?: Record<string, any>;
}

export interface PipedriveStageMapping {
  workspaceId: string;
  pipedriveStageId: number;
  coldcopyStatus: string;
  triggerActions: PipelineAction[];
  probability: number;
}

export enum PipelineAction {
  START_CAMPAIGN = 'start_campaign',
  STOP_CAMPAIGN = 'stop_campaign',
  SEND_NOTIFICATION = 'send_notification',
  UPDATE_LEAD_SCORE = 'update_lead_score',
  ASSIGN_OWNER = 'assign_owner'
}

export enum SyncDirection {
  COLDCOPY_TO_PIPEDRIVE = 'cp_to_pd',
  PIPEDRIVE_TO_COLDCOPY = 'pd_to_cp',
  BIDIRECTIONAL = 'bidirectional'
}

export enum ConflictResolution {
  LATEST_WINS = 'latest_wins',
  PIPEDRIVE_WINS = 'pipedrive_wins',
  COLDCOPY_WINS = 'coldcopy_wins',
  MANUAL = 'manual',
  FIELD_LEVEL = 'field_level'
}

// Custom error classes
export class PipedriveAuthError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'PipedriveAuthError';
  }
}

export class PipedriveRateLimitError extends Error {
  constructor(public retryAfter: number) {
    super(`Rate limit exceeded. Retry after ${retryAfter} seconds`);
    this.name = 'PipedriveRateLimitError';
  }
}

export class PipedriveTokenBudgetError extends Error {
  constructor(public remainingTokens: number, public resetTime: Date) {
    super(`Daily token budget exceeded. ${remainingTokens} tokens remaining. Resets at ${resetTime.toISOString()}`);
    this.name = 'PipedriveTokenBudgetError';
  }
}

export class PipedriveValidationError extends Error {
  constructor(message: string, public errors?: any[]) {
    super(message);
    this.name = 'PipedriveValidationError';
  }
}

export class PipedriveSyncError extends Error {
  constructor(message: string, public entityId?: string, public entityType?: string) {
    super(message);
    this.name = 'PipedriveSyncError';
  }
}

export class PipedriveNetworkError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message);
    this.name = 'PipedriveNetworkError';
  }
}