/**
 * White-Label Utility Functions
 * 
 * Utility functions for CSS generation, domain validation, token management,
 * and other common white-label operations.
 */

import { 
  BrandTheme, 
  CSSCustomProperties, 
  DomainValidationResult,
  WhiteLabelBranding,
  ThemeConfig,
  DNSRecords,
  DNSRecord
} from './types';

// ====================================
// CSS Generation Utilities
// ====================================

/**
 * Generate CSS custom properties from brand theme
 */
export function generateCSSCustomProperties(theme: BrandTheme): CSSCustomProperties {
  const properties: CSSCustomProperties = {
    '--wl-color-primary': theme.colors.primary,
    '--wl-color-secondary': theme.colors.secondary,
    '--wl-color-accent': theme.colors.accent,
    '--wl-color-background': theme.colors.background,
    '--wl-color-text': theme.colors.text,
    '--wl-font-family': theme.fonts.family,
    '--wl-border-radius': theme.config.borderRadius,
    '--wl-spacing': theme.config.spacing,
  };

  // Add derived colors
  properties['--wl-color-primary-light'] = lightenColor(theme.colors.primary, 0.1);
  properties['--wl-color-primary-dark'] = darkenColor(theme.colors.primary, 0.1);
  properties['--wl-color-secondary-light'] = lightenColor(theme.colors.secondary, 0.1);
  properties['--wl-color-secondary-dark'] = darkenColor(theme.colors.secondary, 0.1);

  // Add shadow variables if enabled
  if (theme.config.shadows) {
    properties['--wl-shadow-sm'] = '0 1px 2px 0 rgb(0 0 0 / 0.05)';
    properties['--wl-shadow-md'] = '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)';
    properties['--wl-shadow-lg'] = '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)';
  } else {
    properties['--wl-shadow-sm'] = 'none';
    properties['--wl-shadow-md'] = 'none';
    properties['--wl-shadow-lg'] = 'none';
  }

  return properties;
}

/**
 * Convert CSS custom properties to CSS string
 */
export function cssPropertiesToString(properties: CSSCustomProperties): string {
  const cssRules = Object.entries(properties)
    .map(([property, value]) => `  ${property}: ${value};`)
    .join('\n');

  return `:root {\n${cssRules}\n}`;
}

/**
 * Generate complete CSS from branding configuration
 */
export function generateBrandCSS(branding: WhiteLabelBranding): string {
  const theme: BrandTheme = {
    colors: {
      primary: branding.primary_color,
      secondary: branding.secondary_color,
      accent: branding.accent_color,
      background: branding.background_color,
      text: branding.text_color,
    },
    fonts: {
      family: branding.font_family,
      url: branding.font_url,
    },
    config: branding.theme_config,
    customCSS: branding.custom_css,
  };

  let css = '';

  // Font import if custom font URL provided
  if (theme.fonts.url) {
    css += `@import url('${theme.fonts.url}');\n\n`;
  }

  // CSS custom properties
  const customProperties = generateCSSCustomProperties(theme);
  css += cssPropertiesToString(customProperties);

  // Component-specific styles
  css += `\n\n/* White-label component styles */
.wl-button-primary {
  background-color: var(--wl-color-primary);
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: var(--wl-border-radius);
  font-family: var(--wl-font-family);
  cursor: pointer;
  transition: all 0.2s ease;
}

.wl-button-primary:hover {
  background-color: var(--wl-color-primary-dark);
  transform: ${theme.config.animations ? 'translateY(-1px)' : 'none'};
  box-shadow: ${theme.config.shadows ? 'var(--wl-shadow-md)' : 'none'};
}

.wl-button-secondary {
  background-color: var(--wl-color-secondary);
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: var(--wl-border-radius);
  font-family: var(--wl-font-family);
  cursor: pointer;
  transition: all 0.2s ease;
}

.wl-card {
  background-color: var(--wl-color-background);
  border-radius: var(--wl-border-radius);
  padding: var(--wl-spacing);
  box-shadow: ${theme.config.shadows ? 'var(--wl-shadow-sm)' : 'none'};
  font-family: var(--wl-font-family);
}

.wl-text-primary {
  color: var(--wl-color-primary);
}

.wl-text-secondary {
  color: var(--wl-color-secondary);
}

.wl-bg-primary {
  background-color: var(--wl-color-primary);
}

.wl-bg-secondary {
  background-color: var(--wl-color-secondary);
}`;

  // Custom CSS overrides
  if (theme.customCSS) {
    css += `\n\n/* Custom CSS overrides */\n${theme.customCSS}`;
  }

  return css;
}

// ====================================
// Color Utilities
// ====================================

/**
 * Convert hex color to RGB values
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

/**
 * Convert RGB to hex color
 */
export function rgbToHex(r: number, g: number, b: number): string {
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

/**
 * Lighten a hex color by a percentage
 */
export function lightenColor(hex: string, percent: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;

  const { r, g, b } = rgb;
  const lightR = Math.min(255, Math.floor(r + (255 - r) * percent));
  const lightG = Math.min(255, Math.floor(g + (255 - g) * percent));
  const lightB = Math.min(255, Math.floor(b + (255 - b) * percent));

  return rgbToHex(lightR, lightG, lightB);
}

/**
 * Darken a hex color by a percentage
 */
export function darkenColor(hex: string, percent: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;

  const { r, g, b } = rgb;
  const darkR = Math.max(0, Math.floor(r * (1 - percent)));
  const darkG = Math.max(0, Math.floor(g * (1 - percent)));
  const darkB = Math.max(0, Math.floor(b * (1 - percent)));

  return rgbToHex(darkR, darkG, darkB);
}

/**
 * Check if a color is light or dark
 */
export function isLightColor(hex: string): boolean {
  const rgb = hexToRgb(hex);
  if (!rgb) return true;

  // Calculate relative luminance
  const { r, g, b } = rgb;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  return luminance > 0.5;
}

/**
 * Get contrasting text color for a background color
 */
export function getContrastingTextColor(backgroundColor: string): string {
  return isLightColor(backgroundColor) ? '#000000' : '#ffffff';
}

// ====================================
// Domain Validation Utilities
// ====================================

/**
 * Validate domain name format
 */
export function validateDomain(domain: string): DomainValidationResult {
  // Remove protocol if present
  const cleanDomain = domain.replace(/^https?:\/\//, '').toLowerCase();
  
  // Basic domain regex
  const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  
  if (!domainRegex.test(cleanDomain)) {
    return {
      isValid: false,
      error: 'Invalid domain format',
      suggestions: [
        'Domain should not include protocol (http:// or https://)',
        'Domain should only contain letters, numbers, dots, and hyphens',
        'Domain parts should not start or end with hyphens'
      ]
    };
  }

  // Check length constraints
  if (cleanDomain.length > 253) {
    return {
      isValid: false,
      error: 'Domain name is too long (maximum 253 characters)'
    };
  }

  // Check for reserved domains
  const reservedDomains = ['localhost', 'example.com', 'test.com', 'invalid'];
  if (reservedDomains.some(reserved => cleanDomain.includes(reserved))) {
    return {
      isValid: false,
      error: 'Cannot use reserved domain names'
    };
  }

  // Check TLD
  const parts = cleanDomain.split('.');
  if (parts.length < 2) {
    return {
      isValid: false,
      error: 'Domain must have a valid top-level domain (TLD)'
    };
  }

  const tld = parts[parts.length - 1];
  if (tld.length < 2) {
    return {
      isValid: false,
      error: 'Top-level domain must be at least 2 characters long'
    };
  }

  return { isValid: true };
}

/**
 * Extract subdomain from full domain
 */
export function extractSubdomain(fullDomain: string, rootDomain: string): string | null {
  if (fullDomain === rootDomain) {
    return null;
  }

  if (fullDomain.endsWith('.' + rootDomain)) {
    return fullDomain.replace('.' + rootDomain, '');
  }

  return null;
}

/**
 * Check if domain is a subdomain of another domain
 */
export function isSubdomainOf(subdomain: string, rootDomain: string): boolean {
  return subdomain !== rootDomain && subdomain.endsWith('.' + rootDomain);
}

// ====================================
// DNS Utilities
// ====================================

/**
 * Generate DNS records for domain verification
 */
export function generateDNSRecords(domain: string, subdomain?: string): DNSRecords {
  const fullDomain = subdomain ? `${subdomain}.${domain}` : domain;
  const verificationToken = generateSecureToken(32);

  const cname: DNSRecord = {
    name: subdomain || '@',
    value: 'coldcopy-proxy.vercel.app',
    ttl: 300,
    type: 'CNAME'
  };

  const aRecords: DNSRecord[] = [
    {
      name: '@',
      value: '76.76.19.142', // Example IP - replace with actual
      ttl: 300,
      type: 'A'
    }
  ];

  const txtRecords: DNSRecord[] = [
    {
      name: '_coldcopy-verification',
      value: `coldcopy-verification=${verificationToken}`,
      ttl: 300,
      type: 'TXT'
    }
  ];

  return {
    cname,
    a_records: aRecords,
    txt_records: txtRecords,
    mx_records: [],
    verification_token: verificationToken
  };
}

/**
 * Format DNS record for display
 */
export function formatDNSRecord(record: DNSRecord): string {
  return `${record.type} ${record.name} ${record.value} ${record.ttl}`;
}

// ====================================
// Token Generation Utilities
// ====================================

/**
 * Generate secure random token
 */
export function generateSecureToken(length: number = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  
  // Use crypto.getRandomValues if available (browser)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    
    for (let i = 0; i < length; i++) {
      result += chars[array[i] % chars.length];
    }
  } else {
    // Fallback for server-side
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  }
  
  return result;
}

/**
 * Generate portal URL slug
 */
export function generatePortalSlug(): string {
  const prefix = 'client';
  const suffix = generateSecureToken(8).toLowerCase();
  return `${prefix}-${suffix}`;
}

/**
 * Generate access token for client portal
 */
export function generateAccessToken(): string {
  return generateSecureToken(64);
}

// ====================================
// URL Utilities
// ====================================

/**
 * Build full URL with protocol
 */
export function buildFullURL(domain: string, path: string = '', protocol: string = 'https'): string {
  const cleanDomain = domain.replace(/^https?:\/\//, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${protocol}://${cleanDomain}${cleanPath}`;
}

/**
 * Extract domain from URL
 */
export function extractDomainFromURL(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    // Fallback for invalid URLs
    return url.replace(/^https?:\/\//, '').split('/')[0].split('?')[0].split('#')[0];
  }
}

// ====================================
// Validation Utilities
// ====================================

/**
 * Validate email address format
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate hex color format
 */
export function validateHexColor(color: string): boolean {
  const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
  return hexRegex.test(color);
}

/**
 * Validate URL format
 */
export function validateURL(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Sanitize HTML content for email templates
 */
export function sanitizeHTML(html: string): string {
  // Basic HTML sanitization - in production, use a proper library like DOMPurify
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/on\w+='[^']*'/gi, '')
    .replace(/javascript:/gi, '');
}

// ====================================
// Template Utilities
// ====================================

/**
 * Replace template variables in text
 */
export function replaceTemplateVariables(
  template: string,
  variables: Record<string, string>
): string {
  let result = template;
  
  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
    result = result.replace(regex, value || '');
  });
  
  return result;
}

/**
 * Extract template variables from text
 */
export function extractTemplateVariables(template: string): string[] {
  const regex = /{{\\s*([^}\\s]+)\\s*}}/g;
  const variables: string[] = [];
  let match;
  
  while ((match = regex.exec(template)) !== null) {
    if (!variables.includes(match[1])) {
      variables.push(match[1]);
    }
  }
  
  return variables;
}

// ====================================
// Date Utilities
// ====================================

/**
 * Check if date is expired
 */
export function isExpired(dateString: string): boolean {
  return new Date(dateString) < new Date();
}

/**
 * Add days to date
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Format date for display
 */
export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// ====================================
// Error Utilities
// ====================================

/**
 * Create standardized white-label error
 */
export function createWhiteLabelError(code: string, message: string, details?: any) {
  return {
    code,
    message,
    details,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Check if error is a white-label error
 */
export function isWhiteLabelError(error: any): boolean {
  return error && typeof error === 'object' && 'code' in error && 'message' in error;
}

// ====================================
// Cache Key Utilities
// ====================================

/**
 * Generate cache key for white-label data
 */
export function generateCacheKey(type: string, ...identifiers: string[]): string {
  return `wl:${type}:${identifiers.join(':')}`;
}

/**
 * Parse cache key
 */
export function parseCacheKey(key: string): { type: string; identifiers: string[] } | null {
  const parts = key.split(':');
  if (parts.length < 2 || parts[0] !== 'wl') {
    return null;
  }
  
  return {
    type: parts[1],
    identifiers: parts.slice(2),
  };
}

export {
  // Re-export types for convenience
  type BrandTheme,
  type CSSCustomProperties,
  type DomainValidationResult,
  type WhiteLabelBranding,
  type ThemeConfig,
  type DNSRecords,
  type DNSRecord,
};