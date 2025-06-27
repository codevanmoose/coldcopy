/**
 * White-Label TypeScript Interfaces
 * 
 * Comprehensive type definitions for the white-label system including
 * domains, branding, email templates, client portals, and settings.
 */

// ====================================
// Core Types
// ====================================

export interface DatabaseRecord {
  id: string;
  created_at: string;
  updated_at?: string;
}

export interface WorkspaceReference {
  workspace_id: string;
}

// ====================================
// Domain Management Types
// ====================================

export type DomainSSLStatus = 
  | 'pending' 
  | 'provisioning' 
  | 'active' 
  | 'expired' 
  | 'failed' 
  | 'disabled';

export type DomainVerificationStatus = 
  | 'pending' 
  | 'verifying' 
  | 'verified' 
  | 'failed' 
  | 'expired';

export interface DNSRecord {
  name: string;
  value: string;
  ttl: number;
  type: 'A' | 'CNAME' | 'TXT' | 'MX';
}

export interface DNSRecords {
  cname: DNSRecord | null;
  a_records: DNSRecord[];
  txt_records: DNSRecord[];
  mx_records: DNSRecord[];
  verification_token: string | null;
}

export interface WhiteLabelDomain extends DatabaseRecord, WorkspaceReference {
  domain: string;
  subdomain?: string;
  full_domain: string;
  ssl_status: DomainSSLStatus;
  verification_status: DomainVerificationStatus;
  dns_records: DNSRecords;
  verified_at?: string;
  expires_at?: string;
  last_checked_at: string;
  is_active: boolean;
  is_primary: boolean;
  notes?: string;
  config: Record<string, any>;
}

export interface DomainConfig {
  workspace_id: string;
  domain_id: string;
  is_active: boolean;
  branding: WhiteLabelBranding | null;
  settings: WhiteLabelSettings | null;
}

// ====================================
// Branding System Types
// ====================================

export interface SocialLinks {
  twitter?: string;
  linkedin?: string;
  facebook?: string;
  instagram?: string;
  youtube?: string;
}

export interface ThemeConfig {
  borderRadius: string;
  spacing: string;
  shadows: boolean;
  animations: boolean;
}

export interface WhiteLabelBranding extends DatabaseRecord, WorkspaceReference {
  domain_id?: string;
  
  // Visual branding
  logo_url?: string;
  favicon_url?: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  background_color: string;
  text_color: string;
  
  // Typography
  font_family: string;
  font_url?: string;
  
  // Custom styling
  custom_css?: string;
  theme_config: ThemeConfig;
  
  // Company information
  company_name: string;
  company_description?: string;
  company_address?: string;
  company_phone?: string;
  company_website?: string;
  
  // Footer and legal
  footer_text?: string;
  copyright_text?: string;
  support_email?: string;
  privacy_url?: string;
  terms_url?: string;
  cookie_policy_url?: string;
  
  // Social links
  social_links: SocialLinks;
}

export interface BrandTheme {
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };
  fonts: {
    family: string;
    url?: string;
  };
  config: ThemeConfig;
  customCSS?: string;
}

// ====================================
// Email Template Types
// ====================================

export type EmailTemplateType = 
  | 'welcome'
  | 'password_reset'
  | 'email_verification'
  | 'invitation'
  | 'lead_notification'
  | 'campaign_complete'
  | 'weekly_report'
  | 'monthly_report'
  | 'payment_receipt'
  | 'trial_expiring'
  | 'subscription_cancelled'
  | 'custom';

export interface EmailTemplateVariables {
  [key: string]: string;
}

export interface WhiteLabelEmailTemplate extends DatabaseRecord, WorkspaceReference {
  template_type: EmailTemplateType;
  template_name: string;
  template_key?: string;
  
  // Email content
  subject: string;
  html_content: string;
  text_content?: string;
  preheader?: string;
  
  // Template variables
  variables: EmailTemplateVariables;
  
  // Email settings
  from_name?: string;
  from_email?: string;
  reply_to?: string;
  cc_emails?: string[];
  bcc_emails?: string[];
  
  // Status and metadata
  is_active: boolean;
  is_default: boolean;
  version: number;
  last_used_at?: string;
}

export interface RenderedEmailTemplate {
  subject: string;
  html_content: string;
  text_content?: string;
  from_name?: string;
  from_email?: string;
}

// ====================================
// Client Portal Types
// ====================================

export interface ClientPortalPermissions {
  view_campaigns: boolean;
  view_analytics: boolean;
  download_reports: boolean;
  update_profile: boolean;
  view_invoices: boolean;
  manage_team: boolean;
}

export type NotificationFrequency = 'immediate' | 'daily' | 'weekly' | 'monthly' | 'never';

export interface WhiteLabelClientPortal extends DatabaseRecord, WorkspaceReference {
  client_id: string;
  
  // Portal access
  portal_url: string;
  access_token: string;
  login_token?: string;
  
  // Permissions and features
  permissions: ClientPortalPermissions;
  
  // Portal customization
  custom_welcome_message?: string;
  allowed_features: string[];
  theme_override?: Partial<BrandTheme>;
  
  // Status and security
  is_active: boolean;
  login_attempts: number;
  last_login_attempt_at?: string;
  is_locked: boolean;
  locked_until?: string;
  
  // Timestamps
  expires_at: string;
  last_accessed_at?: string;
  
  // Notifications
  email_notifications: boolean;
  notification_frequency: NotificationFrequency;
}

export interface PortalAccessValidation {
  portal_id: string;
  workspace_id: string;
  client_id: string;
  permissions: ClientPortalPermissions;
  is_valid: boolean;
}

// ====================================
// Configuration Management Types
// ====================================

export interface FeatureFlags {
  custom_domains: boolean;
  client_portals: boolean;
  custom_email_templates: boolean;
  white_label_reports: boolean;
  api_access: boolean;
  sso_integration: boolean;
  advanced_analytics: boolean;
  webhook_endpoints: boolean;
}

export interface NavigationItem {
  label: string;
  path: string;
  icon: string;
}

export interface CustomNavigation {
  items: NavigationItem[];
  logo_text?: string;
  show_breadcrumbs: boolean;
  show_user_menu: boolean;
}

export interface CustomLoginPage {
  enabled: boolean;
  background_image?: string;
  welcome_title: string;
  welcome_subtitle: string;
  show_registration: boolean;
  custom_css?: string;
}

export interface CustomDashboard {
  welcome_message: string;
  default_widgets: string[];
  layout: 'grid' | 'list';
  show_getting_started: boolean;
}

export interface WebhookEndpoints {
  campaign_complete?: string;
  lead_updated?: string;
  portal_access?: string;
  payment_received?: string;
}

export interface PasswordPolicy {
  min_length: number;
  require_uppercase: boolean;
  require_numbers: boolean;
  require_symbols: boolean;
}

export interface SecurityConfig {
  session_timeout: number;
  require_2fa: boolean;
  allowed_ip_ranges: string[];
  password_policy: PasswordPolicy;
}

export interface EmailConfig {
  smtp_host?: string;
  smtp_port: number;
  smtp_username?: string;
  smtp_password?: string;
  use_tls: boolean;
  default_from_email?: string;
  default_from_name?: string;
}

export interface WhiteLabelSettings extends DatabaseRecord, WorkspaceReference {
  // Feature flags
  feature_flags: FeatureFlags;
  
  // Navigation and UI customization
  custom_navigation: CustomNavigation;
  
  // Branding control
  hide_coldcopy_branding: boolean;
  hide_powered_by: boolean;
  custom_footer_text?: string;
  show_support_chat: boolean;
  
  // Page customizations
  custom_login_page: CustomLoginPage;
  custom_dashboard: CustomDashboard;
  
  // Integration settings
  webhook_endpoints: WebhookEndpoints;
  
  // Security settings
  security_config: SecurityConfig;
  
  // Email settings
  email_config: EmailConfig;
}

// ====================================
// Service Method Parameters
// ====================================

export interface CreateDomainParams {
  workspaceId: string;
  domain: string;
  subdomain?: string;
  isPrimary?: boolean;
}

export interface UpdateBrandingParams {
  workspaceId: string;
  domainId?: string;
  branding: Partial<Omit<WhiteLabelBranding, keyof DatabaseRecord | keyof WorkspaceReference | 'domain_id'>>;
}

export interface CreateEmailTemplateParams {
  workspaceId: string;
  templateType: EmailTemplateType;
  templateName: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
  variables?: EmailTemplateVariables;
}

export interface CreateClientPortalParams {
  workspaceId: string;
  clientId: string;
  portalUrl?: string;
  permissions?: Partial<ClientPortalPermissions>;
  expiresInDays?: number;
}

export interface RenderEmailParams {
  workspaceId: string;
  templateType: EmailTemplateType;
  variables: Record<string, string>;
}

export interface ValidatePortalParams {
  portalUrl: string;
  accessToken: string;
}

// ====================================
// Utility Types
// ====================================

export interface WhiteLabelError {
  code: string;
  message: string;
  details?: any;
}

export interface CSSCustomProperties {
  [key: string]: string;
}

export interface DomainValidationResult {
  isValid: boolean;
  error?: string;
  suggestions?: string[];
}

export interface SSLCertificateInfo {
  issuer: string;
  validFrom: string;
  validTo: string;
  isValid: boolean;
}

// ====================================
// Cache Types
// ====================================

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  prefix?: string;
  serialize?: boolean;
}

// ====================================
// Event Types
// ====================================

export interface WhiteLabelEvent {
  type: string;
  workspaceId: string;
  data: any;
  timestamp: string;
}

export type DomainEvent = WhiteLabelEvent & {
  type: 'domain.created' | 'domain.verified' | 'domain.ssl_provisioned' | 'domain.deleted';
  data: {
    domainId: string;
    domain: string;
    status: DomainSSLStatus | DomainVerificationStatus;
  };
};

export type PortalEvent = WhiteLabelEvent & {
  type: 'portal.created' | 'portal.accessed' | 'portal.expired';
  data: {
    portalId: string;
    clientId: string;
    portalUrl: string;
  };
};

// ====================================
// Export all types
// ====================================

export type {
  // Core
  DatabaseRecord,
  WorkspaceReference,
  
  // Domains
  DomainSSLStatus,
  DomainVerificationStatus,
  DNSRecord,
  DNSRecords,
  WhiteLabelDomain,
  DomainConfig,
  
  // Branding
  SocialLinks,
  ThemeConfig,
  WhiteLabelBranding,
  BrandTheme,
  
  // Email Templates
  EmailTemplateType,
  EmailTemplateVariables,
  WhiteLabelEmailTemplate,
  RenderedEmailTemplate,
  
  // Client Portals
  ClientPortalPermissions,
  NotificationFrequency,
  WhiteLabelClientPortal,
  PortalAccessValidation,
  
  // Settings
  FeatureFlags,
  NavigationItem,
  CustomNavigation,
  CustomLoginPage,
  CustomDashboard,
  WebhookEndpoints,
  PasswordPolicy,
  SecurityConfig,
  EmailConfig,
  WhiteLabelSettings,
  
  // Service Parameters
  CreateDomainParams,
  UpdateBrandingParams,
  CreateEmailTemplateParams,
  CreateClientPortalParams,
  RenderEmailParams,
  ValidatePortalParams,
  
  // Utilities
  WhiteLabelError,
  CSSCustomProperties,
  DomainValidationResult,
  SSLCertificateInfo,
  CacheEntry,
  CacheOptions,
  
  // Events
  WhiteLabelEvent,
  DomainEvent,
  PortalEvent,
};