/**
 * White-Label System - Main Export Module
 * 
 * Comprehensive white-label solution for ColdCopy with domain management,
 * branding system, client portals, email templates, and configuration management.
 */

// ====================================
// Core Service
// ====================================

export { 
  default as WhiteLabelService,
  whiteLabelService,
  createWhiteLabelService
} from './white-label-service';

// ====================================
// Middleware
// ====================================

export {
  default as whiteLabelMiddleware,
  getWhiteLabelContext,
  createRewriteURL,
  injectCSS,
  createCSSVariables,
  enhanceResponse,
  createCORSHeaders,
  validateDomainOwnership,
  WhiteLabelRateLimit,
  rateLimiter,
} from './middleware';

// ====================================
// Types
// ====================================

export type {
  // Core Types
  DatabaseRecord,
  WorkspaceReference,
  
  // Domain Management
  DomainSSLStatus,
  DomainVerificationStatus,
  DNSRecord,
  DNSRecords,
  WhiteLabelDomain,
  DomainConfig,
  
  // Branding System
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
  
  // Configuration
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
} from './types';

// ====================================
// Utilities
// ====================================

export {
  // CSS Generation
  generateCSSCustomProperties,
  cssPropertiesToString,
  generateBrandCSS,
  
  // Color Utilities
  hexToRgb,
  rgbToHex,
  lightenColor,
  darkenColor,
  isLightColor,
  getContrastingTextColor,
  
  // Domain Validation
  validateDomain,
  extractSubdomain,
  isSubdomainOf,
  
  // DNS Utilities
  generateDNSRecords,
  formatDNSRecord,
  
  // Token Generation
  generateSecureToken,
  generatePortalSlug,
  generateAccessToken,
  
  // URL Utilities
  buildFullURL,
  extractDomainFromURL,
  
  // Validation
  validateEmail,
  validateHexColor,
  validateURL,
  sanitizeHTML,
  
  // Template Utilities
  replaceTemplateVariables,
  extractTemplateVariables,
  
  // Date Utilities
  isExpired,
  addDays,
  formatDate,
  
  // Error Utilities
  createWhiteLabelError,
  isWhiteLabelError,
  
  // Cache Utilities
  generateCacheKey,
  parseCacheKey,
} from './utils';

// ====================================
// Error Classes
// ====================================

export {
  // Base Error
  WhiteLabelBaseError,
  
  // Domain Errors
  DomainError,
  DomainValidationError,
  DomainNotFoundError,
  DomainAlreadyExistsError,
  DomainVerificationError,
  SSLProvisioningError,
  DNSConfigurationError,
  
  // Branding Errors
  BrandingError,
  InvalidColorError,
  InvalidFontError,
  AssetUploadError,
  CSSGenerationError,
  
  // Email Template Errors
  EmailTemplateError,
  TemplateNotFoundError,
  InvalidTemplateError,
  TemplateRenderingError,
  VariableSubstitutionError,
  
  // Client Portal Errors
  ClientPortalError,
  PortalNotFoundError,
  PortalAccessDeniedError,
  PortalExpiredError,
  PortalLockedError,
  InvalidAccessTokenError,
  PortalPermissionError,
  
  // Configuration Errors
  ConfigurationError,
  FeatureNotEnabledError,
  InvalidSettingsError,
  SettingsValidationError,
  
  // Database Errors
  DatabaseError,
  WorkspaceNotFoundError,
  ClientNotFoundError,
  UniqueConstraintError,
  RecordNotFoundError,
  
  // Authentication Errors
  AuthenticationError,
  AuthorizationError,
  UnauthorizedError,
  ForbiddenError,
  InvalidTokenError,
  TokenExpiredError,
  
  // External Service Errors
  ExternalServiceError,
  DNSProviderError,
  SSLProviderError,
  EmailProviderError,
  
  // Validation Errors
  ValidationError,
  RequiredFieldError,
  InvalidFormatError,
  ValueTooLongError,
  ValueTooShortError,
  
  // Rate Limiting & Cache Errors
  RateLimitError,
  CacheError,
  
  // Error Utilities
  getErrorDetails,
  formatErrorForUser,
  createErrorResponse,
  logError,
  retryWithBackoff,
  withErrorHandling,
} from './errors';

// ====================================
// Constants
// ====================================

export const WHITE_LABEL_CONSTANTS = {
  DEFAULT_THEME: {
    colors: {
      primary: '#3b82f6',
      secondary: '#1e40af',
      accent: '#f59e0b',
      background: '#ffffff',
      text: '#1f2937',
    },
    fonts: {
      family: 'Inter, system-ui, sans-serif',
    },
    config: {
      borderRadius: '0.5rem',
      spacing: '1rem',
      shadows: true,
      animations: true,
    },
  },
  
  DEFAULT_PERMISSIONS: {
    view_campaigns: true,
    view_analytics: false,
    download_reports: false,
    update_profile: true,
    view_invoices: false,
    manage_team: false,
  },
  
  DEFAULT_FEATURE_FLAGS: {
    custom_domains: true,
    client_portals: true,
    custom_email_templates: true,
    white_label_reports: true,
    api_access: false,
    sso_integration: false,
    advanced_analytics: false,
    webhook_endpoints: false,
  },
  
  CACHE_KEYS: {
    DOMAIN: 'domain',
    DOMAINS: 'domains',
    DOMAIN_CONFIG: 'domain-config',
    BRANDING: 'branding',
    BRAND_CSS: 'brand-css',
    EMAIL_TEMPLATE: 'email-template',
    EMAIL_TEMPLATES: 'email-templates',
    CLIENT_PORTAL: 'client-portal',
    CLIENT_PORTALS: 'client-portals',
    SETTINGS: 'settings',
  },
  
  CACHE_TTL: {
    SHORT: 60 * 1000, // 1 minute
    MEDIUM: 5 * 60 * 1000, // 5 minutes
    LONG: 30 * 60 * 1000, // 30 minutes
  },
  
  RATE_LIMITS: {
    DEFAULT: {
      maxRequests: 100,
      windowMs: 60 * 1000, // 1 minute
    },
    DOMAIN_VERIFICATION: {
      maxRequests: 10,
      windowMs: 60 * 60 * 1000, // 1 hour
    },
    EMAIL_TEMPLATE: {
      maxRequests: 50,
      windowMs: 60 * 1000, // 1 minute
    },
  },
} as const;

// ====================================
// Helper Functions for Easy Setup
// ====================================

/**
 * Quick setup function for new workspaces
 */
export async function setupWhiteLabelWorkspace(
  workspaceId: string,
  companyName: string,
  options: {
    primaryColor?: string;
    logoUrl?: string;
    customDomain?: string;
    enablePortals?: boolean;
  } = {}
): Promise<void> {
  const service = await createWhiteLabelService();
  
  // Initialize with defaults
  await service.initializeWorkspace(workspaceId, companyName);
  
  // Update branding if custom options provided
  if (options.primaryColor || options.logoUrl) {
    await service.updateBranding({
      workspaceId,
      branding: {
        ...(options.primaryColor && { primary_color: options.primaryColor }),
        ...(options.logoUrl && { logo_url: options.logoUrl }),
      },
    });
  }
  
  // Add custom domain if provided
  if (options.customDomain) {
    await service.createDomain({
      workspaceId,
      domain: options.customDomain,
      isPrimary: true,
    });
  }
  
  // Enable portals if requested
  if (options.enablePortals) {
    await service.updateSettings(workspaceId, {
      feature_flags: {
        ...WHITE_LABEL_CONSTANTS.DEFAULT_FEATURE_FLAGS,
        client_portals: true,
      },
    });
  }
}

/**
 * Get white-label context for React components
 */
export function useWhiteLabelContext(): {
  workspaceId?: string;
  domainId?: string;
  domain?: string;
  portalId?: string;
  css?: string;
  permissions?: any;
} {
  // This would be implemented as a React hook in a real app
  // For now, return empty context
  return {};
}

// ====================================
// Version Information
// ====================================

export const WHITE_LABEL_VERSION = '1.0.0';
export const WHITE_LABEL_BUILD_DATE = new Date().toISOString();

// ====================================
// Default Export
// ====================================

export default {
  WhiteLabelService,
  whiteLabelService,
  createWhiteLabelService,
  whiteLabelMiddleware,
  setupWhiteLabelWorkspace,
  WHITE_LABEL_CONSTANTS,
  WHITE_LABEL_VERSION,
};