/**
 * White-Label Service
 * 
 * Core service for managing white-label functionality including domain management,
 * branding system, client portals, email templates, and configuration management.
 * 
 * This service integrates with Supabase and supports both server and client-side usage.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { createClient as createBrowserClient } from '../supabase/client';
import { createClient as createServerClient } from '../supabase/server';
import {
  WhiteLabelDomain,
  WhiteLabelBranding,
  WhiteLabelEmailTemplate,
  WhiteLabelClientPortal,
  WhiteLabelSettings,
  CreateDomainParams,
  UpdateBrandingParams,
  CreateEmailTemplateParams,
  CreateClientPortalParams,
  RenderEmailParams,
  ValidatePortalParams,
  RenderedEmailTemplate,
  PortalAccessValidation,
  DomainConfig,
  BrandTheme,
  CacheEntry,
  CacheOptions,
  DNSRecords,
  EmailTemplateType,
  DomainSSLStatus,
  DomainVerificationStatus,
} from './types';
import {
  validateDomain,
  generateDNSRecords,
  generateBrandCSS,
  generatePortalSlug,
  generateAccessToken,
  generateSecureToken,
  replaceTemplateVariables,
  generateCacheKey,
  isExpired,
  addDays,
} from './utils';
import {
  DomainValidationError,
  DomainNotFoundError,
  DomainAlreadyExistsError,
  DomainVerificationError,
  SSLProvisioningError,
  TemplateNotFoundError,
  TemplateRenderingError,
  PortalNotFoundError,
  PortalAccessDeniedError,
  PortalExpiredError,
  PortalLockedError,
  InvalidAccessTokenError,
  WorkspaceNotFoundError,
  ClientNotFoundError,
  FeatureNotEnabledError,
  DatabaseError,
  withErrorHandling,
  retryWithBackoff,
} from './errors';

// ====================================
// Cache Implementation
// ====================================

class WhiteLabelCache {
  private cache = new Map<string, CacheEntry<any>>();
  private defaultTTL = 5 * 60 * 1000; // 5 minutes

  set<T>(key: string, data: T, options: CacheOptions = {}): void {
    const ttl = options.ttl || this.defaultTTL;
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
    };
    
    this.cache.set(key, entry);

    // Set cleanup timer
    setTimeout(() => {
      this.cache.delete(key);
    }, ttl);
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }
}

// ====================================
// Main White-Label Service
// ====================================

export class WhiteLabelService {
  private supabase: SupabaseClient;
  private cache = new WhiteLabelCache();
  private isServer: boolean;

  constructor(supabaseClient?: SupabaseClient) {
    this.isServer = typeof window === 'undefined';
    this.supabase = supabaseClient || (this.isServer ? null : createBrowserClient());
  }

  /**
   * Initialize service with server-side Supabase client
   */
  static async createServerInstance(): Promise<WhiteLabelService> {
    const supabase = await createServerClient();
    return new WhiteLabelService(supabase);
  }

  /**
   * Get Supabase client (lazy initialization for server-side)
   */
  private async getSupabase(): Promise<SupabaseClient> {
    if (!this.supabase) {
      if (this.isServer) {
        this.supabase = await createServerClient();
      } else {
        this.supabase = createBrowserClient();
      }
    }
    return this.supabase;
  }

  // ====================================
  // Domain Management
  // ====================================

  /**
   * Create a new custom domain
   */
  async createDomain(params: CreateDomainParams): Promise<WhiteLabelDomain> {
    return withErrorHandling(async () => {
      const { workspaceId, domain, subdomain, isPrimary = false } = params;
      const supabase = await this.getSupabase();

      // Validate domain format
      const validation = validateDomain(domain);
      if (!validation.isValid) {
        throw new DomainValidationError(domain, validation.error!);
      }

      // Check if domain already exists
      const { data: existingDomain } = await supabase
        .from('white_label_domains')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('domain', domain)
        .eq('subdomain', subdomain || null)
        .single();

      if (existingDomain) {
        const fullDomain = subdomain ? `${subdomain}.${domain}` : domain;
        throw new DomainAlreadyExistsError(fullDomain);
      }

      // Generate DNS records
      const dnsRecords = generateDNSRecords(domain, subdomain);

      // Create domain record
      const { data, error } = await supabase
        .from('white_label_domains')
        .insert({
          workspace_id: workspaceId,
          domain,
          subdomain,
          dns_records: dnsRecords,
          is_primary: isPrimary,
        })
        .select()
        .single();

      if (error) {
        throw new DatabaseError('Failed to create domain', error);
      }

      // Clear cache
      this.clearDomainCache(workspaceId);

      return data;
    }, 'createDomain');
  }

  /**
   * Get domain by ID
   */
  async getDomain(domainId: string): Promise<WhiteLabelDomain | null> {
    return withErrorHandling(async () => {
      const cacheKey = generateCacheKey('domain', domainId);
      const cached = this.cache.get<WhiteLabelDomain>(cacheKey);
      if (cached) return cached;

      const supabase = await this.getSupabase();
      const { data, error } = await supabase
        .from('white_label_domains')
        .select('*')
        .eq('id', domainId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        throw new DatabaseError('Failed to fetch domain', error);
      }

      this.cache.set(cacheKey, data);
      return data;
    }, 'getDomain');
  }

  /**
   * Get all domains for a workspace
   */
  async getDomains(workspaceId: string): Promise<WhiteLabelDomain[]> {
    return withErrorHandling(async () => {
      const cacheKey = generateCacheKey('domains', workspaceId);
      const cached = this.cache.get<WhiteLabelDomain[]>(cacheKey);
      if (cached) return cached;

      const supabase = await this.getSupabase();
      const { data, error } = await supabase
        .from('white_label_domains')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false });

      if (error) {
        throw new DatabaseError('Failed to fetch domains', error);
      }

      this.cache.set(cacheKey, data);
      return data;
    }, 'getDomains');
  }

  /**
   * Get domain configuration by URL
   */
  async getDomainConfig(domain: string): Promise<DomainConfig | null> {
    return withErrorHandling(async () => {
      const cacheKey = generateCacheKey('domain-config', domain);
      const cached = this.cache.get<DomainConfig>(cacheKey);
      if (cached) return cached;

      const supabase = await this.getSupabase();
      const { data, error } = await supabase
        .rpc('get_domain_config', { p_domain: domain });

      if (error) {
        throw new DatabaseError('Failed to fetch domain configuration', error);
      }

      if (!data || data.length === 0) return null;

      const config = data[0];
      this.cache.set(cacheKey, config);
      return config;
    }, 'getDomainConfig');
  }

  /**
   * Verify domain ownership
   */
  async verifyDomain(domainId: string): Promise<boolean> {
    return withErrorHandling(async () => {
      const supabase = await this.getSupabase();
      
      // Call the database function
      const { data, error } = await supabase
        .rpc('verify_domain_ownership', {
          p_domain_id: domainId,
          p_verification_method: 'txt',
        });

      if (error) {
        throw new DomainVerificationError(domainId, error.message);
      }

      // Clear cache
      const domain = await this.getDomain(domainId);
      if (domain) {
        this.clearDomainCache(domain.workspace_id);
        this.cache.delete(generateCacheKey('domain', domainId));
      }

      return data;
    }, 'verifyDomain');
  }

  /**
   * Provision SSL certificate for domain
   */
  async provisionSSL(domainId: string): Promise<boolean> {
    return withErrorHandling(async () => {
      const supabase = await this.getSupabase();
      
      // Call the database function
      const { data, error } = await supabase
        .rpc('provision_ssl_certificate', {
          p_domain_id: domainId,
        });

      if (error) {
        throw new SSLProvisioningError(domainId, error.message);
      }

      // Clear cache
      const domain = await this.getDomain(domainId);
      if (domain) {
        this.clearDomainCache(domain.workspace_id);
        this.cache.delete(generateCacheKey('domain', domainId));
      }

      return data;
    }, 'provisionSSL');
  }

  /**
   * Update domain status
   */
  async updateDomainStatus(
    domainId: string,
    updates: {
      sslStatus?: DomainSSLStatus;
      verificationStatus?: DomainVerificationStatus;
      isActive?: boolean;
    }
  ): Promise<WhiteLabelDomain> {
    return withErrorHandling(async () => {
      const supabase = await this.getSupabase();
      
      const updateData: any = {};
      if (updates.sslStatus) updateData.ssl_status = updates.sslStatus;
      if (updates.verificationStatus) updateData.verification_status = updates.verificationStatus;
      if (updates.isActive !== undefined) updateData.is_active = updates.isActive;
      
      if (updates.verificationStatus === 'verified') {
        updateData.verified_at = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from('white_label_domains')
        .update(updateData)
        .eq('id', domainId)
        .select()
        .single();

      if (error) {
        throw new DatabaseError('Failed to update domain status', error);
      }

      // Clear cache
      this.clearDomainCache(data.workspace_id);
      this.cache.delete(generateCacheKey('domain', domainId));

      return data;
    }, 'updateDomainStatus');
  }

  /**
   * Delete domain
   */
  async deleteDomain(domainId: string): Promise<void> {
    return withErrorHandling(async () => {
      const domain = await this.getDomain(domainId);
      if (!domain) {
        throw new DomainNotFoundError(domainId);
      }

      const supabase = await this.getSupabase();
      const { error } = await supabase
        .from('white_label_domains')
        .delete()
        .eq('id', domainId);

      if (error) {
        throw new DatabaseError('Failed to delete domain', error);
      }

      // Clear cache
      this.clearDomainCache(domain.workspace_id);
      this.cache.delete(generateCacheKey('domain', domainId));
    }, 'deleteDomain');
  }

  // ====================================
  // Branding System
  // ====================================

  /**
   * Get branding configuration for workspace
   */
  async getBranding(workspaceId: string, domainId?: string): Promise<WhiteLabelBranding | null> {
    return withErrorHandling(async () => {
      const cacheKey = generateCacheKey('branding', workspaceId, domainId || 'default');
      const cached = this.cache.get<WhiteLabelBranding>(cacheKey);
      if (cached) return cached;

      const supabase = await this.getSupabase();
      let query = supabase
        .from('white_label_branding')
        .select('*')
        .eq('workspace_id', workspaceId);

      if (domainId) {
        query = query.eq('domain_id', domainId);
      } else {
        query = query.is('domain_id', null);
      }

      const { data, error } = await query.single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        throw new DatabaseError('Failed to fetch branding', error);
      }

      this.cache.set(cacheKey, data);
      return data;
    }, 'getBranding');
  }

  /**
   * Update branding configuration
   */
  async updateBranding(params: UpdateBrandingParams): Promise<WhiteLabelBranding> {
    return withErrorHandling(async () => {
      const { workspaceId, domainId, branding } = params;
      const supabase = await this.getSupabase();

      const { data, error } = await supabase
        .from('white_label_branding')
        .upsert({
          workspace_id: workspaceId,
          domain_id: domainId || null,
          ...branding,
        })
        .select()
        .single();

      if (error) {
        throw new DatabaseError('Failed to update branding', error);
      }

      // Clear cache
      this.cache.delete(generateCacheKey('branding', workspaceId, domainId || 'default'));
      this.cache.delete(generateCacheKey('brand-css', workspaceId, domainId || 'default'));

      return data;
    }, 'updateBranding');
  }

  /**
   * Generate CSS for branding
   */
  async generateBrandingCSS(workspaceId: string, domainId?: string): Promise<string> {
    return withErrorHandling(async () => {
      const cacheKey = generateCacheKey('brand-css', workspaceId, domainId || 'default');
      const cached = this.cache.get<string>(cacheKey);
      if (cached) return cached;

      const branding = await this.getBranding(workspaceId, domainId);
      if (!branding) {
        return '/* No branding configuration found */';
      }

      const css = generateBrandCSS(branding);
      this.cache.set(cacheKey, css, { ttl: 30 * 60 * 1000 }); // Cache for 30 minutes

      return css;
    }, 'generateBrandingCSS');
  }

  /**
   * Create default branding for workspace
   */
  async createDefaultBranding(workspaceId: string, companyName: string): Promise<string> {
    return withErrorHandling(async () => {
      const supabase = await this.getSupabase();
      
      const { data, error } = await supabase
        .rpc('create_default_branding', {
          p_workspace_id: workspaceId,
          p_company_name: companyName,
        });

      if (error) {
        throw new DatabaseError('Failed to create default branding', error);
      }

      return data;
    }, 'createDefaultBranding');
  }

  // ====================================
  // Email Template Service
  // ====================================

  /**
   * Get email template by type
   */
  async getEmailTemplate(
    workspaceId: string,
    templateType: EmailTemplateType
  ): Promise<WhiteLabelEmailTemplate | null> {
    return withErrorHandling(async () => {
      const cacheKey = generateCacheKey('email-template', workspaceId, templateType);
      const cached = this.cache.get<WhiteLabelEmailTemplate>(cacheKey);
      if (cached) return cached;

      const supabase = await this.getSupabase();
      const { data, error } = await supabase
        .from('white_label_email_templates')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('template_type', templateType)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        throw new DatabaseError('Failed to fetch email template', error);
      }

      this.cache.set(cacheKey, data);
      return data;
    }, 'getEmailTemplate');
  }

  /**
   * Get all email templates for workspace
   */
  async getEmailTemplates(workspaceId: string): Promise<WhiteLabelEmailTemplate[]> {
    return withErrorHandling(async () => {
      const cacheKey = generateCacheKey('email-templates', workspaceId);
      const cached = this.cache.get<WhiteLabelEmailTemplate[]>(cacheKey);
      if (cached) return cached;

      const supabase = await this.getSupabase();
      const { data, error } = await supabase
        .from('white_label_email_templates')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('template_type', { ascending: true });

      if (error) {
        throw new DatabaseError('Failed to fetch email templates', error);
      }

      this.cache.set(cacheKey, data);
      return data;
    }, 'getEmailTemplates');
  }

  /**
   * Create email template
   */
  async createEmailTemplate(params: CreateEmailTemplateParams): Promise<WhiteLabelEmailTemplate> {
    return withErrorHandling(async () => {
      const supabase = await this.getSupabase();
      
      const { data, error } = await supabase
        .from('white_label_email_templates')
        .insert({
          workspace_id: params.workspaceId,
          template_type: params.templateType,
          template_name: params.templateName,
          subject: params.subject,
          html_content: params.htmlContent,
          text_content: params.textContent,
          variables: params.variables || {},
        })
        .select()
        .single();

      if (error) {
        throw new DatabaseError('Failed to create email template', error);
      }

      // Clear cache
      this.cache.delete(generateCacheKey('email-templates', params.workspaceId));
      this.cache.delete(generateCacheKey('email-template', params.workspaceId, params.templateType));

      return data;
    }, 'createEmailTemplate');
  }

  /**
   * Update email template
   */
  async updateEmailTemplate(
    templateId: string,
    updates: Partial<Pick<WhiteLabelEmailTemplate, 'subject' | 'html_content' | 'text_content' | 'variables' | 'is_active'>>
  ): Promise<WhiteLabelEmailTemplate> {
    return withErrorHandling(async () => {
      const supabase = await this.getSupabase();
      
      const { data, error } = await supabase
        .from('white_label_email_templates')
        .update(updates)
        .eq('id', templateId)
        .select()
        .single();

      if (error) {
        throw new DatabaseError('Failed to update email template', error);
      }

      // Clear cache
      this.cache.delete(generateCacheKey('email-templates', data.workspace_id));
      this.cache.delete(generateCacheKey('email-template', data.workspace_id, data.template_type));

      return data;
    }, 'updateEmailTemplate');
  }

  /**
   * Render email template with variables
   */
  async renderEmailTemplate(params: RenderEmailParams): Promise<RenderedEmailTemplate> {
    return withErrorHandling(async () => {
      const supabase = await this.getSupabase();
      
      const { data, error } = await supabase
        .rpc('render_email_template', {
          p_workspace_id: params.workspaceId,
          p_template_type: params.templateType,
          p_variables: params.variables,
        });

      if (error) {
        throw new TemplateRenderingError(params.templateType, error.message);
      }

      if (!data || data.length === 0) {
        throw new TemplateNotFoundError(params.templateType, params.workspaceId);
      }

      return data[0];
    }, 'renderEmailTemplate');
  }

  /**
   * Create default email templates for workspace
   */
  async createDefaultEmailTemplates(workspaceId: string): Promise<void> {
    return withErrorHandling(async () => {
      const supabase = await this.getSupabase();
      
      const { error } = await supabase
        .rpc('create_default_email_templates', {
          p_workspace_id: workspaceId,
        });

      if (error) {
        throw new DatabaseError('Failed to create default email templates', error);
      }

      // Clear cache
      this.cache.delete(generateCacheKey('email-templates', workspaceId));
    }, 'createDefaultEmailTemplates');
  }

  // ====================================
  // Client Portal Service
  // ====================================

  /**
   * Create client portal access
   */
  async createClientPortal(params: CreateClientPortalParams): Promise<WhiteLabelClientPortal> {
    return withErrorHandling(async () => {
      const { workspaceId, clientId, portalUrl, permissions, expiresInDays = 365 } = params;
      const supabase = await this.getSupabase();

      // Generate portal URL if not provided
      const finalPortalUrl = portalUrl || generatePortalSlug();
      
      // Generate access token
      const accessToken = generateAccessToken();

      const { data, error } = await supabase
        .from('white_label_client_portals')
        .insert({
          workspace_id: workspaceId,
          client_id: clientId,
          portal_url: finalPortalUrl,
          access_token: accessToken,
          permissions: permissions || {},
          expires_at: addDays(new Date(), expiresInDays).toISOString(),
        })
        .select()
        .single();

      if (error) {
        throw new DatabaseError('Failed to create client portal', error);
      }

      return data;
    }, 'createClientPortal');
  }

  /**
   * Get client portal by URL
   */
  async getClientPortal(portalUrl: string): Promise<WhiteLabelClientPortal | null> {
    return withErrorHandling(async () => {
      const cacheKey = generateCacheKey('client-portal', portalUrl);
      const cached = this.cache.get<WhiteLabelClientPortal>(cacheKey);
      if (cached) return cached;

      const supabase = await this.getSupabase();
      const { data, error } = await supabase
        .from('white_label_client_portals')
        .select('*')
        .eq('portal_url', portalUrl)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        throw new DatabaseError('Failed to fetch client portal', error);
      }

      this.cache.set(cacheKey, data, { ttl: 60 * 1000 }); // Cache for 1 minute
      return data;
    }, 'getClientPortal');
  }

  /**
   * Validate portal access
   */
  async validatePortalAccess(params: ValidatePortalParams): Promise<PortalAccessValidation> {
    return withErrorHandling(async () => {
      const { portalUrl, accessToken } = params;
      const supabase = await this.getSupabase();
      
      const { data, error } = await supabase
        .rpc('validate_portal_access', {
          p_portal_url: portalUrl,
          p_access_token: accessToken,
        });

      if (error) {
        throw new DatabaseError('Failed to validate portal access', error);
      }

      if (!data || data.length === 0) {
        throw new PortalNotFoundError(portalUrl);
      }

      const validation = data[0];
      
      if (!validation.is_valid) {
        const portal = await this.getClientPortal(portalUrl);
        if (!portal) {
          throw new PortalNotFoundError(portalUrl);
        }
        
        if (isExpired(portal.expires_at)) {
          throw new PortalExpiredError(portalUrl, portal.expires_at);
        }
        
        if (portal.is_locked) {
          throw new PortalLockedError(portalUrl, portal.locked_until);
        }
        
        if (portal.access_token !== accessToken) {
          throw new InvalidAccessTokenError(portalUrl);
        }
        
        throw new PortalAccessDeniedError(portalUrl, 'Access validation failed');
      }

      return validation;
    }, 'validatePortalAccess');
  }

  /**
   * Get client portals for workspace
   */
  async getClientPortals(workspaceId: string): Promise<WhiteLabelClientPortal[]> {
    return withErrorHandling(async () => {
      const cacheKey = generateCacheKey('client-portals', workspaceId);
      const cached = this.cache.get<WhiteLabelClientPortal[]>(cacheKey);
      if (cached) return cached;

      const supabase = await this.getSupabase();
      const { data, error } = await supabase
        .from('white_label_client_portals')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false });

      if (error) {
        throw new DatabaseError('Failed to fetch client portals', error);
      }

      this.cache.set(cacheKey, data);
      return data;
    }, 'getClientPortals');
  }

  /**
   * Update client portal
   */
  async updateClientPortal(
    portalId: string,
    updates: Partial<Pick<WhiteLabelClientPortal, 'permissions' | 'is_active' | 'custom_welcome_message' | 'allowed_features'>>
  ): Promise<WhiteLabelClientPortal> {
    return withErrorHandling(async () => {
      const supabase = await this.getSupabase();
      
      const { data, error } = await supabase
        .from('white_label_client_portals')
        .update(updates)
        .eq('id', portalId)
        .select()
        .single();

      if (error) {
        throw new DatabaseError('Failed to update client portal', error);
      }

      // Clear cache
      this.cache.delete(generateCacheKey('client-portals', data.workspace_id));
      this.cache.delete(generateCacheKey('client-portal', data.portal_url));

      return data;
    }, 'updateClientPortal');
  }

  /**
   * Delete client portal
   */
  async deleteClientPortal(portalId: string): Promise<void> {
    return withErrorHandling(async () => {
      const supabase = await this.getSupabase();
      
      // Get portal data before deletion for cache clearing
      const { data: portal } = await supabase
        .from('white_label_client_portals')
        .select('workspace_id, portal_url')
        .eq('id', portalId)
        .single();

      const { error } = await supabase
        .from('white_label_client_portals')
        .delete()
        .eq('id', portalId);

      if (error) {
        throw new DatabaseError('Failed to delete client portal', error);
      }

      // Clear cache
      if (portal) {
        this.cache.delete(generateCacheKey('client-portals', portal.workspace_id));
        this.cache.delete(generateCacheKey('client-portal', portal.portal_url));
      }
    }, 'deleteClientPortal');
  }

  // ====================================
  // Configuration Management
  // ====================================

  /**
   * Get white-label settings for workspace
   */
  async getSettings(workspaceId: string): Promise<WhiteLabelSettings | null> {
    return withErrorHandling(async () => {
      const cacheKey = generateCacheKey('settings', workspaceId);
      const cached = this.cache.get<WhiteLabelSettings>(cacheKey);
      if (cached) return cached;

      const supabase = await this.getSupabase();
      const { data, error } = await supabase
        .from('white_label_settings')
        .select('*')
        .eq('workspace_id', workspaceId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        throw new DatabaseError('Failed to fetch settings', error);
      }

      this.cache.set(cacheKey, data);
      return data;
    }, 'getSettings');
  }

  /**
   * Update white-label settings
   */
  async updateSettings(
    workspaceId: string,
    updates: Partial<Omit<WhiteLabelSettings, keyof { id: string; workspace_id: string; created_at: string; updated_at: string }>>
  ): Promise<WhiteLabelSettings> {
    return withErrorHandling(async () => {
      const supabase = await this.getSupabase();
      
      const { data, error } = await supabase
        .from('white_label_settings')
        .upsert({
          workspace_id: workspaceId,
          ...updates,
        })
        .select()
        .single();

      if (error) {
        throw new DatabaseError('Failed to update settings', error);
      }

      // Clear cache
      this.cache.delete(generateCacheKey('settings', workspaceId));

      return data;
    }, 'updateSettings');
  }

  /**
   * Check if feature is enabled for workspace
   */
  async isFeatureEnabled(workspaceId: string, feature: string): Promise<boolean> {
    return withErrorHandling(async () => {
      const settings = await this.getSettings(workspaceId);
      if (!settings) return false;

      return settings.feature_flags[feature] === true;
    }, 'isFeatureEnabled');
  }

  /**
   * Create default settings for workspace
   */
  async createDefaultSettings(workspaceId: string): Promise<string> {
    return withErrorHandling(async () => {
      const supabase = await this.getSupabase();
      
      const { data, error } = await supabase
        .rpc('create_default_settings', {
          p_workspace_id: workspaceId,
        });

      if (error) {
        throw new DatabaseError('Failed to create default settings', error);
      }

      return data;
    }, 'createDefaultSettings');
  }

  // ====================================
  // Cache Management
  // ====================================

  /**
   * Clear all cache for workspace
   */
  clearWorkspaceCache(workspaceId: string): void {
    const patterns = [
      generateCacheKey('domains', workspaceId),
      generateCacheKey('branding', workspaceId),
      generateCacheKey('brand-css', workspaceId),
      generateCacheKey('email-templates', workspaceId),
      generateCacheKey('client-portals', workspaceId),
      generateCacheKey('settings', workspaceId),
    ];

    patterns.forEach(pattern => {
      this.cache.delete(pattern);
      this.cache.delete(pattern + ':default');
    });
  }

  /**
   * Clear domain-specific cache
   */
  private clearDomainCache(workspaceId: string): void {
    this.cache.delete(generateCacheKey('domains', workspaceId));
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    const keys = Array.from((this.cache as any).cache.keys());
    return {
      size: keys.length,
      keys,
    };
  }

  /**
   * Clear all cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  // ====================================
  // Utility Methods
  // ====================================

  /**
   * Initialize workspace with default configuration
   */
  async initializeWorkspace(workspaceId: string, companyName: string): Promise<void> {
    return withErrorHandling(async () => {
      // Create default branding
      await this.createDefaultBranding(workspaceId, companyName);
      
      // Create default email templates
      await this.createDefaultEmailTemplates(workspaceId);
      
      // Create default settings
      await this.createDefaultSettings(workspaceId);
    }, 'initializeWorkspace');
  }

  /**
   * Get complete workspace configuration
   */
  async getWorkspaceConfiguration(workspaceId: string): Promise<{
    domains: WhiteLabelDomain[];
    branding: WhiteLabelBranding | null;
    settings: WhiteLabelSettings | null;
    emailTemplates: WhiteLabelEmailTemplate[];
    clientPortals: WhiteLabelClientPortal[];
  }> {
    return withErrorHandling(async () => {
      // Fetch all data in parallel
      const [domains, branding, settings, emailTemplates, clientPortals] = await Promise.all([
        this.getDomains(workspaceId),
        this.getBranding(workspaceId),
        this.getSettings(workspaceId),
        this.getEmailTemplates(workspaceId),
        this.getClientPortals(workspaceId),
      ]);

      return {
        domains,
        branding,
        settings,
        emailTemplates,
        clientPortals,
      };
    }, 'getWorkspaceConfiguration');
  }
}

// ====================================
// Export Default Instance
// ====================================

// Default client-side instance
export const whiteLabelService = new WhiteLabelService();

// Server-side factory
export async function createWhiteLabelService(): Promise<WhiteLabelService> {
  return await WhiteLabelService.createServerInstance();
}

// Export all types for convenience
export * from './types';
export * from './utils';
export * from './errors';

export default WhiteLabelService;