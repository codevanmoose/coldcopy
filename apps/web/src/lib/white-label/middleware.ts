/**
 * White-Label Middleware for Next.js
 * 
 * Handles domain routing, request processing, and white-label configuration
 * injection for custom domains and subdomains.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createWhiteLabelService } from './white-label-service';
import { DomainConfig, WhiteLabelSettings, WhiteLabelBranding } from './types';
import { extractDomainFromURL, buildFullURL } from './utils';

// ====================================
// Configuration
// ====================================

const DEFAULT_DOMAIN = process.env.NEXT_PUBLIC_APP_DOMAIN || 'app.coldcopy.ai';
const ALLOWED_PATHS = [
  '/api',
  '/_next',
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
  '/portal', // Client portal routes
];

// ====================================
// Middleware Function
// ====================================

export async function whiteLabelMiddleware(request: NextRequest): Promise<NextResponse> {
  const { pathname, search } = request.nextUrl;
  const hostname = request.headers.get('host') || '';
  const protocol = request.headers.get('x-forwarded-proto') || 'https';
  
  // Skip middleware for certain paths
  if (shouldSkipMiddleware(pathname)) {
    return NextResponse.next();
  }

  try {
    // Check if this is a custom domain
    if (hostname !== DEFAULT_DOMAIN && !hostname.includes('localhost')) {
      return await handleCustomDomain(request, hostname);
    }

    // Handle subdomain routing on default domain
    if (hostname.includes('.') && hostname !== DEFAULT_DOMAIN) {
      return await handleSubdomain(request, hostname);
    }

    // Handle client portal routes
    if (pathname.startsWith('/portal/')) {
      return await handlePortalRoute(request);
    }

    return NextResponse.next();
  } catch (error) {
    console.error('White-label middleware error:', error);
    
    // Fallback to default behavior on error
    return NextResponse.next();
  }
}

// ====================================
// Domain Handling
// ====================================

/**
 * Handle custom domain requests
 */
async function handleCustomDomain(request: NextRequest, hostname: string): Promise<NextResponse> {
  const service = await createWhiteLabelService();
  
  // Get domain configuration
  const domainConfig = await service.getDomainConfig(hostname);
  
  if (!domainConfig) {
    // Domain not found - redirect to default domain or show error
    return handleUnknownDomain(request, hostname);
  }
  
  if (!domainConfig.is_active) {
    // Domain is inactive
    return new NextResponse('Domain is not active', { status: 503 });
  }

  // Create response with domain context
  const response = NextResponse.next();
  
  // Inject domain configuration into headers for use in components
  response.headers.set('x-wl-workspace-id', domainConfig.workspace_id);
  response.headers.set('x-wl-domain-id', domainConfig.domain_id);
  response.headers.set('x-wl-domain', hostname);
  
  // Inject branding CSS if available
  if (domainConfig.branding) {
    const css = await service.generateBrandingCSS(domainConfig.workspace_id, domainConfig.domain_id);
    response.headers.set('x-wl-css', encodeURIComponent(css));
  }
  
  // Handle settings-based redirects
  if (domainConfig.settings) {
    const redirectResponse = handleSettingsRedirects(request, domainConfig.settings);
    if (redirectResponse) return redirectResponse;
  }

  return response;
}

/**
 * Handle subdomain routing
 */
async function handleSubdomain(request: NextRequest, hostname: string): Promise<NextResponse> {
  const parts = hostname.split('.');
  const subdomain = parts[0];
  const rootDomain = parts.slice(1).join('.');
  
  // Skip common subdomains
  if (['www', 'api', 'cdn'].includes(subdomain)) {
    return NextResponse.next();
  }
  
  const service = await createWhiteLabelService();
  const domainConfig = await service.getDomainConfig(hostname);
  
  if (domainConfig) {
    return handleCustomDomain(request, hostname);
  }
  
  return NextResponse.next();
}

/**
 * Handle unknown domain requests
 */
function handleUnknownDomain(request: NextRequest, hostname: string): NextResponse {
  const { pathname, search } = request.nextUrl;
  
  // Redirect to default domain with original path
  const redirectUrl = buildFullURL(DEFAULT_DOMAIN, pathname + search);
  
  return NextResponse.redirect(redirectUrl, 302);
}

// ====================================
// Portal Handling
// ====================================

/**
 * Handle client portal routes
 */
async function handlePortalRoute(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  const pathSegments = pathname.split('/').filter(Boolean);
  
  // Extract portal URL from path: /portal/{portalUrl}
  if (pathSegments.length < 2) {
    return new NextResponse('Portal not found', { status: 404 });
  }
  
  const portalUrl = pathSegments[1];
  const service = await createWhiteLabelService();
  
  try {
    // Get portal configuration
    const portal = await service.getClientPortal(portalUrl);
    
    if (!portal) {
      return new NextResponse('Portal not found', { status: 404 });
    }
    
    if (!portal.is_active) {
      return new NextResponse('Portal is not active', { status: 403 });
    }
    
    // Check if portal is expired
    if (new Date(portal.expires_at) < new Date()) {
      return new NextResponse('Portal has expired', { status:410 });
    }
    
    // Check if portal is locked
    if (portal.is_locked) {
      const lockedUntil = portal.locked_until ? new Date(portal.locked_until) : null;
      if (!lockedUntil || lockedUntil > new Date()) {
        return new NextResponse('Portal is locked', { status: 423 });
      }
    }
    
    // Get workspace branding for portal customization
    const branding = await service.getBranding(portal.workspace_id);
    
    const response = NextResponse.next();
    
    // Inject portal context into headers
    response.headers.set('x-wl-portal-id', portal.id);
    response.headers.set('x-wl-portal-url', portalUrl);
    response.headers.set('x-wl-workspace-id', portal.workspace_id);
    response.headers.set('x-wl-client-id', portal.client_id);
    response.headers.set('x-wl-portal-permissions', JSON.stringify(portal.permissions));
    
    // Inject branding CSS if available
    if (branding) {
      const css = await service.generateBrandingCSS(portal.workspace_id);
      response.headers.set('x-wl-css', encodeURIComponent(css));
    }
    
    return response;
  } catch (error) {
    console.error('Portal middleware error:', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
}

// ====================================
// Settings-Based Routing
// ====================================

/**
 * Handle redirects based on settings
 */
function handleSettingsRedirects(request: NextRequest, settings: any): NextResponse | null {
  const { pathname } = request.nextUrl;
  
  // Custom login page redirect
  if (pathname === '/login' && settings.custom_login_page?.enabled) {
    return NextResponse.rewrite(new URL('/custom-login', request.url));
  }
  
  // Dashboard customization
  if (pathname === '/dashboard' && settings.custom_dashboard) {
    const response = NextResponse.next();
    response.headers.set('x-wl-custom-dashboard', JSON.stringify(settings.custom_dashboard));
    return response;
  }
  
  return null;
}

// ====================================
// Utility Functions
// ====================================

/**
 * Check if middleware should be skipped for this path
 */
function shouldSkipMiddleware(pathname: string): boolean {
  return ALLOWED_PATHS.some(allowedPath => {
    if (allowedPath.endsWith('*')) {
      return pathname.startsWith(allowedPath.slice(0, -1));
    }
    return pathname === allowedPath || pathname.startsWith(allowedPath + '/');
  });
}

/**
 * Extract white-label context from request headers
 */
export function getWhiteLabelContext(request: NextRequest) {
  return {
    workspaceId: request.headers.get('x-wl-workspace-id'),
    domainId: request.headers.get('x-wl-domain-id'),
    domain: request.headers.get('x-wl-domain'),
    portalId: request.headers.get('x-wl-portal-id'),
    portalUrl: request.headers.get('x-wl-portal-url'),
    clientId: request.headers.get('x-wl-client-id'),
    css: request.headers.get('x-wl-css') ? decodeURIComponent(request.headers.get('x-wl-css')!) : null,
    permissions: request.headers.get('x-wl-portal-permissions') ? 
      JSON.parse(request.headers.get('x-wl-portal-permissions')!) : null,
  };
}

/**
 * Create rewrite URL for white-label routing
 */
export function createRewriteURL(request: NextRequest, targetPath: string): URL {
  const url = new URL(targetPath, request.url);
  url.search = request.nextUrl.search;
  return url;
}

// ====================================
// CSS Injection Helpers
// ====================================

/**
 * Inject CSS into HTML response
 */
export function injectCSS(html: string, css: string): string {
  const cssTag = `<style id="white-label-styles">${css}</style>`;
  
  // Try to inject before closing head tag
  if (html.includes('</head>')) {
    return html.replace('</head>', `${cssTag}</head>`);
  }
  
  // Fallback: inject at the beginning of body
  if (html.includes('<body>')) {
    return html.replace('<body>', `<body>${cssTag}`);
  }
  
  // Last resort: prepend to HTML
  return cssTag + html;
}

/**
 * Create CSS variables from branding
 */
export function createCSSVariables(branding: WhiteLabelBranding): string {
  const variables = [
    `--wl-primary-color: ${branding.primary_color};`,
    `--wl-secondary-color: ${branding.secondary_color};`,
    `--wl-accent-color: ${branding.accent_color};`,
    `--wl-background-color: ${branding.background_color};`,
    `--wl-text-color: ${branding.text_color};`,
    `--wl-font-family: ${branding.font_family};`,
  ];
  
  return `:root { ${variables.join(' ')} }`;
}

// ====================================
// Response Enhancement
// ====================================

/**
 * Enhance response with white-label headers
 */
export function enhanceResponse(
  response: NextResponse,
  context: {
    workspaceId?: string;
    domainId?: string;
    branding?: WhiteLabelBranding;
    settings?: WhiteLabelSettings;
  }
): NextResponse {
  if (context.workspaceId) {
    response.headers.set('x-wl-workspace-id', context.workspaceId);
  }
  
  if (context.domainId) {
    response.headers.set('x-wl-domain-id', context.domainId);
  }
  
  if (context.branding) {
    response.headers.set('x-wl-company-name', context.branding.company_name);
    response.headers.set('x-wl-primary-color', context.branding.primary_color);
    
    if (context.branding.logo_url) {
      response.headers.set('x-wl-logo-url', context.branding.logo_url);
    }
  }
  
  if (context.settings) {
    response.headers.set('x-wl-hide-branding', context.settings.hide_coldcopy_branding.toString());
    response.headers.set('x-wl-feature-flags', JSON.stringify(context.settings.feature_flags));
  }
  
  return response;
}

/**
 * Create CORS headers for white-label domains
 */
export function createCORSHeaders(allowedDomain: string) {
  return {
    'Access-Control-Allow-Origin': allowedDomain,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-wl-workspace-id, x-wl-domain-id',
    'Access-Control-Allow-Credentials': 'true',
  };
}

// ====================================
// Security Helpers
// ====================================

/**
 * Validate domain ownership for API requests
 */
export async function validateDomainOwnership(
  request: NextRequest,
  workspaceId: string
): Promise<boolean> {
  const hostname = request.headers.get('host') || '';
  
  if (hostname === DEFAULT_DOMAIN || hostname.includes('localhost')) {
    return true; // Default domain is always allowed
  }
  
  try {
    const service = await createWhiteLabelService();
    const domainConfig = await service.getDomainConfig(hostname);
    
    return domainConfig?.workspace_id === workspaceId && domainConfig.is_active;
  } catch {
    return false;
  }
}

/**
 * Rate limiting for white-label requests
 */
export class WhiteLabelRateLimit {
  private requests = new Map<string, { count: number; resetTime: number }>();
  private maxRequests = 100;
  private windowMs = 60 * 1000; // 1 minute

  isAllowed(identifier: string): boolean {
    const now = Date.now();
    const record = this.requests.get(identifier);
    
    if (!record || now > record.resetTime) {
      this.requests.set(identifier, { count: 1, resetTime: now + this.windowMs });
      return true;
    }
    
    if (record.count >= this.maxRequests) {
      return false;
    }
    
    record.count++;
    return true;
  }
  
  getRemainingRequests(identifier: string): number {
    const record = this.requests.get(identifier);
    if (!record || Date.now() > record.resetTime) {
      return this.maxRequests;
    }
    
    return Math.max(0, this.maxRequests - record.count);
  }
}

export const rateLimiter = new WhiteLabelRateLimit();

// Export middleware function as default
export default whiteLabelMiddleware;