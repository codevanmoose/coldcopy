/**
 * Domain Resolver for White-Label Middleware
 * 
 * Handles domain detection, workspace resolution, and routing logic for white-label domains.
 * Optimized for Edge Runtime with efficient caching and minimal external dependencies.
 */

import { DomainConfig, WhiteLabelBranding, WhiteLabelSettings } from './types';

// ====================================
// Types and Interfaces
// ====================================

export interface DomainContext {
  domain: string;
  subdomain?: string;
  isCustomDomain: boolean;
  isWhiteLabel: boolean;
  workspaceId?: string;
  domainConfig?: DomainConfig;
  branding?: WhiteLabelBranding;
  settings?: WhiteLabelSettings;
}

export interface ResolverOptions {
  fallbackDomain?: string;
  enableCaching?: boolean;
  cacheTimeout?: number;
  maxRetries?: number;
}

export interface DomainValidation {
  isValid: boolean;
  domain: string;
  subdomain?: string;
  fullDomain: string;
  errors?: string[];
}

export interface RoutingDecision {
  action: 'continue' | 'redirect' | 'rewrite' | 'block';
  destination?: string;
  headers?: Record<string, string>;
  statusCode?: number;
}

// ====================================
// Cache Implementation for Edge Runtime
// ====================================

class EdgeCache {
  private cache = new Map<string, { data: any; expires: number }>();
  private defaultTtl = 5 * 60 * 1000; // 5 minutes

  set<T>(key: string, data: T, ttl?: number): void {
    const expires = Date.now() + (ttl || this.defaultTtl);
    this.cache.set(key, { data, expires });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expires) {
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

  // Clean expired entries
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expires) {
        this.cache.delete(key);
      }
    }
  }
}

// ====================================
// Domain Resolver Class
// ====================================

export class DomainResolver {
  private cache = new EdgeCache();
  private options: ResolverOptions;
  private defaultDomains: Set<string>;

  constructor(options: ResolverOptions = {}) {
    this.options = {
      fallbackDomain: process.env.VERCEL_URL || 'localhost:3000',
      enableCaching: true,
      cacheTimeout: 5 * 60 * 1000, // 5 minutes
      maxRetries: 3,
      ...options,
    };

    // Define default app domains
    this.defaultDomains = new Set([
      'coldcopy.com',
      'app.coldcopy.com',
      'www.coldcopy.com',
      'coldcopy.vercel.app',
      this.options.fallbackDomain!.replace(/^https?:\/\//, ''),
      'localhost:3000',
      '127.0.0.1:3000',
    ]);
  }

  /**
   * Parse domain from request URL
   */
  parseDomain(url: string | URL): DomainValidation {
    try {
      const urlObj = typeof url === 'string' ? new URL(url) : url;
      const hostname = urlObj.hostname;
      const port = urlObj.port;
      const fullDomain = port && port !== '80' && port !== '443' 
        ? `${hostname}:${port}` 
        : hostname;

      // Extract subdomain and domain
      const parts = hostname.split('.');
      let domain: string;
      let subdomain: string | undefined;

      if (parts.length === 1) {
        // localhost or IP
        domain = fullDomain;
      } else if (parts.length === 2) {
        // example.com
        domain = hostname;
      } else {
        // subdomain.example.com or www.example.com
        subdomain = parts[0];
        domain = parts.slice(1).join('.');
      }

      return {
        isValid: true,
        domain,
        subdomain,
        fullDomain,
      };
    } catch (error) {
      return {
        isValid: false,
        domain: '',
        fullDomain: '',
        errors: [`Invalid URL: ${error instanceof Error ? error.message : 'Unknown error'}`],
      };
    }
  }

  /**
   * Check if domain is a default app domain
   */
  isDefaultDomain(domain: string): boolean {
    return this.defaultDomains.has(domain.toLowerCase());
  }

  /**
   * Resolve domain context with workspace and configuration
   */
  async resolveDomain(request: Request): Promise<DomainContext> {
    const url = new URL(request.url);
    const domainValidation = this.parseDomain(url);

    if (!domainValidation.isValid) {
      throw new Error(`Invalid domain: ${domainValidation.errors?.join(', ')}`);
    }

    const { domain, subdomain, fullDomain } = domainValidation;
    const isCustomDomain = !this.isDefaultDomain(fullDomain);

    // Base context
    const context: DomainContext = {
      domain,
      subdomain,
      isCustomDomain,
      isWhiteLabel: false,
    };

    // If it's not a custom domain, return early
    if (!isCustomDomain) {
      return context;
    }

    // Check cache first
    const cacheKey = `domain:${fullDomain}`;
    if (this.options.enableCaching) {
      const cached = this.cache.get<DomainContext>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    try {
      // Fetch domain configuration from database
      const domainConfig = await this.fetchDomainConfig(fullDomain);
      
      if (domainConfig) {
        context.isWhiteLabel = true;
        context.workspaceId = domainConfig.workspace_id;
        context.domainConfig = domainConfig;
        context.branding = domainConfig.branding;
        context.settings = domainConfig.settings;
      }

      // Cache the result
      if (this.options.enableCaching) {
        this.cache.set(cacheKey, context, this.options.cacheTimeout);
      }

      return context;
    } catch (error) {
      console.error(`Failed to resolve domain ${fullDomain}:`, error);
      // Return context without white-label config on error
      return context;
    }
  }

  /**
   * Fetch domain configuration from Supabase
   */
  private async fetchDomainConfig(fullDomain: string): Promise<DomainConfig | null> {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration missing');
    }

    try {
      // Use Supabase REST API directly for Edge Runtime compatibility
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/get_domain_config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Prefer': 'return=representation',
        },
        body: JSON.stringify({
          p_domain: fullDomain,
        }),
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data && data.length > 0 ? data[0] : null;
    } catch (error) {
      console.error('Failed to fetch domain config:', error);
      throw error;
    }
  }

  /**
   * Determine routing action based on domain context
   */
  determineRouting(
    context: DomainContext, 
    pathname: string, 
    isAuthenticated: boolean
  ): RoutingDecision {
    // Handle custom domains with white-label
    if (context.isWhiteLabel && context.workspaceId) {
      return this.handleWhiteLabelRouting(context, pathname, isAuthenticated);
    }

    // Handle custom domains without white-label (potential subdomain takeover prevention)
    if (context.isCustomDomain && !context.isWhiteLabel) {
      return {
        action: 'redirect',
        destination: `https://${this.options.fallbackDomain}${pathname}`,
        statusCode: 302,
      };
    }

    // Default domain - continue normal processing
    return { action: 'continue' };
  }

  /**
   * Handle routing for white-label domains
   */
  private handleWhiteLabelRouting(
    context: DomainContext,
    pathname: string,
    isAuthenticated: boolean
  ): RoutingDecision {
    const headers: Record<string, string> = {
      'x-white-label': 'true',
      'x-workspace-id': context.workspaceId!,
      'x-domain': context.domain,
    };

    if (context.subdomain) {
      headers['x-subdomain'] = context.subdomain;
    }

    // Portal access routes
    if (pathname.startsWith('/portal/')) {
      return this.handlePortalRouting(context, pathname, headers);
    }

    // Auth routes on white-label domains
    if (pathname.startsWith('/login') || pathname.startsWith('/signup')) {
      return {
        action: 'rewrite',
        destination: `/white-label${pathname}`,
        headers,
      };
    }

    // Dashboard access - require authentication
    if (pathname.startsWith('/dashboard') || pathname.startsWith('/admin')) {
      if (!isAuthenticated) {
        return {
          action: 'redirect',
          destination: '/login?redirectTo=' + encodeURIComponent(pathname),
          headers,
        };
      }
      
      return {
        action: 'rewrite',
        destination: `/white-label${pathname}`,
        headers,
      };
    }

    // API routes
    if (pathname.startsWith('/api/')) {
      return {
        action: 'continue',
        headers,
      };
    }

    // Static assets and public routes
    if (this.isPublicRoute(pathname)) {
      return {
        action: 'continue',
        headers,
      };
    }

    // Default white-label landing page
    if (pathname === '/') {
      return {
        action: 'rewrite',
        destination: '/white-label',
        headers,
      };
    }

    // Continue with white-label headers
    return {
      action: 'continue',
      headers,
    };
  }

  /**
   * Handle client portal routing
   */
  private handlePortalRouting(
    context: DomainContext,
    pathname: string,
    headers: Record<string, string>
  ): RoutingDecision {
    // Extract portal ID from path
    const pathParts = pathname.split('/');
    const portalId = pathParts[2];

    if (!portalId) {
      return {
        action: 'redirect',
        destination: '/login',
        statusCode: 302,
      };
    }

    headers['x-portal-id'] = portalId;

    return {
      action: 'rewrite',
      destination: `/white-label${pathname}`,
      headers,
    };
  }

  /**
   * Check if route is public (doesn't require authentication)
   */
  private isPublicRoute(pathname: string): boolean {
    const publicRoutes = [
      '/favicon.ico',
      '/robots.txt',
      '/sitemap.xml',
      '/_next/',
      '/api/auth/',
      '/api/webhooks/',
      '/unsubscribe',
      '/track/',
    ];

    return publicRoutes.some(route => pathname.startsWith(route));
  }

  /**
   * Generate branding headers for white-label domains
   */
  generateBrandingHeaders(context: DomainContext): Record<string, string> {
    const headers: Record<string, string> = {};

    if (!context.branding) return headers;

    const branding = context.branding;

    // Basic branding info
    headers['x-brand-company'] = encodeURIComponent(branding.company_name || '');
    headers['x-brand-primary-color'] = branding.primary_color || '';
    headers['x-brand-secondary-color'] = branding.secondary_color || '';
    
    if (branding.logo_url) {
      headers['x-brand-logo'] = encodeURIComponent(branding.logo_url);
    }
    
    if (branding.favicon_url) {
      headers['x-brand-favicon'] = encodeURIComponent(branding.favicon_url);
    }

    return headers;
  }

  /**
   * Validate domain ownership to prevent subdomain takeover
   */
  async validateDomainOwnership(context: DomainContext): Promise<boolean> {
    if (!context.isCustomDomain || !context.domainConfig) {
      return true; // Default domains are always valid
    }

    const domainConfig = context.domainConfig;
    
    // Check if domain is verified and active
    if (!domainConfig.is_active) {
      return false;
    }

    // Additional security checks could be added here
    // e.g., DNS record validation, SSL certificate verification

    return true;
  }

  /**
   * Clear domain cache
   */
  clearCache(domain?: string): void {
    if (domain) {
      this.cache.delete(`domain:${domain}`);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Cleanup expired cache entries
   */
  cleanupCache(): void {
    this.cache.cleanup();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; hits: number; misses: number } {
    // Basic implementation - could be enhanced with actual hit/miss tracking
    return {
      size: (this.cache as any).cache.size,
      hits: 0, // Would need to implement tracking
      misses: 0, // Would need to implement tracking
    };
  }
}

// ====================================
// Utility Functions
// ====================================

/**
 * Create domain resolver with default configuration
 */
export function createDomainResolver(options?: ResolverOptions): DomainResolver {
  return new DomainResolver(options);
}

/**
 * Extract workspace ID from white-label headers
 */
export function getWorkspaceFromHeaders(headers: Headers): string | null {
  return headers.get('x-workspace-id');
}

/**
 * Check if request is from white-label domain
 */
export function isWhiteLabelRequest(headers: Headers): boolean {
  return headers.get('x-white-label') === 'true';
}

/**
 * Get portal ID from headers
 */
export function getPortalIdFromHeaders(headers: Headers): string | null {
  return headers.get('x-portal-id');
}

/**
 * Validate domain format
 */
export function isValidDomain(domain: string): boolean {
  const domainRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/i;
  return domainRegex.test(domain) && domain.length <= 253;
}

/**
 * Extract subdomain from hostname
 */
export function extractSubdomain(hostname: string): string | null {
  const parts = hostname.split('.');
  if (parts.length > 2) {
    return parts[0];
  }
  return null;
}

/**
 * Build full domain from parts
 */
export function buildFullDomain(domain: string, subdomain?: string): string {
  return subdomain ? `${subdomain}.${domain}` : domain;
}

// Export default instance
export const domainResolver = createDomainResolver();

export default DomainResolver;