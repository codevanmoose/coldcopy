/**
 * White-Label Error Handling
 * 
 * Comprehensive error handling for white-label operations including
 * domain verification, SSL provisioning, portal access, and email templating.
 */

import { WhiteLabelError } from './types';

// ====================================
// Base Error Class
// ====================================

export class WhiteLabelBaseError extends Error {
  public readonly code: string;
  public readonly details?: any;
  public readonly timestamp: string;

  constructor(code: string, message: string, details?: any) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON(): WhiteLabelError {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}

// ====================================
// Domain Management Errors
// ====================================

export class DomainError extends WhiteLabelBaseError {
  constructor(message: string, details?: any) {
    super('DOMAIN_ERROR', message, details);
  }
}

export class DomainValidationError extends DomainError {
  constructor(domain: string, reason: string) {
    super(`Domain validation failed for "${domain}": ${reason}`, { domain, reason });
    this.code = 'DOMAIN_VALIDATION_ERROR';
  }
}

export class DomainNotFoundError extends DomainError {
  constructor(domain: string) {
    super(`Domain "${domain}" not found`, { domain });
    this.code = 'DOMAIN_NOT_FOUND';
  }
}

export class DomainAlreadyExistsError extends DomainError {
  constructor(domain: string) {
    super(`Domain "${domain}" already exists`, { domain });
    this.code = 'DOMAIN_ALREADY_EXISTS';
  }
}

export class DomainVerificationError extends DomainError {
  constructor(domain: string, reason: string) {
    super(`Domain verification failed for "${domain}": ${reason}`, { domain, reason });
    this.code = 'DOMAIN_VERIFICATION_ERROR';
  }
}

export class SSLProvisioningError extends DomainError {
  constructor(domain: string, reason: string) {
    super(`SSL provisioning failed for "${domain}": ${reason}`, { domain, reason });
    this.code = 'SSL_PROVISIONING_ERROR';
  }
}

export class DNSConfigurationError extends DomainError {
  constructor(domain: string, recordType: string, reason: string) {
    super(`DNS configuration error for "${domain}" (${recordType}): ${reason}`, {
      domain,
      recordType,
      reason,
    });
    this.code = 'DNS_CONFIGURATION_ERROR';
  }
}

// ====================================
// Branding System Errors
// ====================================

export class BrandingError extends WhiteLabelBaseError {
  constructor(message: string, details?: any) {
    super('BRANDING_ERROR', message, details);
  }
}

export class InvalidColorError extends BrandingError {
  constructor(color: string) {
    super(`Invalid color format: "${color}". Expected hex color (e.g., #FF0000)`, { color });
    this.code = 'INVALID_COLOR_ERROR';
  }
}

export class InvalidFontError extends BrandingError {
  constructor(fontFamily: string) {
    super(`Invalid font family: "${fontFamily}"`, { fontFamily });
    this.code = 'INVALID_FONT_ERROR';
  }
}

export class AssetUploadError extends BrandingError {
  constructor(assetType: string, reason: string) {
    super(`Failed to upload ${assetType}: ${reason}`, { assetType, reason });
    this.code = 'ASSET_UPLOAD_ERROR';
  }
}

export class CSSGenerationError extends BrandingError {
  constructor(reason: string) {
    super(`Failed to generate CSS: ${reason}`, { reason });
    this.code = 'CSS_GENERATION_ERROR';
  }
}

// ====================================
// Email Template Errors
// ====================================

export class EmailTemplateError extends WhiteLabelBaseError {
  constructor(message: string, details?: any) {
    super('EMAIL_TEMPLATE_ERROR', message, details);
  }
}

export class TemplateNotFoundError extends EmailTemplateError {
  constructor(templateType: string, workspaceId: string) {
    super(`Email template "${templateType}" not found for workspace`, {
      templateType,
      workspaceId,
    });
    this.code = 'TEMPLATE_NOT_FOUND';
  }
}

export class InvalidTemplateError extends EmailTemplateError {
  constructor(templateType: string, reason: string) {
    super(`Invalid email template "${templateType}": ${reason}`, { templateType, reason });
    this.code = 'INVALID_TEMPLATE_ERROR';
  }
}

export class TemplateRenderingError extends EmailTemplateError {
  constructor(templateType: string, reason: string) {
    super(`Failed to render email template "${templateType}": ${reason}`, {
      templateType,
      reason,
    });
    this.code = 'TEMPLATE_RENDERING_ERROR';
  }
}

export class VariableSubstitutionError extends EmailTemplateError {
  constructor(templateType: string, missingVariables: string[]) {
    super(`Missing required variables in template "${templateType}": ${missingVariables.join(', ')}`, {
      templateType,
      missingVariables,
    });
    this.code = 'VARIABLE_SUBSTITUTION_ERROR';
  }
}

// ====================================
// Client Portal Errors
// ====================================

export class ClientPortalError extends WhiteLabelBaseError {
  constructor(message: string, details?: any) {
    super('CLIENT_PORTAL_ERROR', message, details);
  }
}

export class PortalNotFoundError extends ClientPortalError {
  constructor(portalUrl: string) {
    super(`Client portal not found: "${portalUrl}"`, { portalUrl });
    this.code = 'PORTAL_NOT_FOUND';
  }
}

export class PortalAccessDeniedError extends ClientPortalError {
  constructor(portalUrl: string, reason: string) {
    super(`Access denied to portal "${portalUrl}": ${reason}`, { portalUrl, reason });
    this.code = 'PORTAL_ACCESS_DENIED';
  }
}

export class PortalExpiredError extends ClientPortalError {
  constructor(portalUrl: string, expiredAt: string) {
    super(`Portal "${portalUrl}" expired on ${expiredAt}`, { portalUrl, expiredAt });
    this.code = 'PORTAL_EXPIRED';
  }
}

export class PortalLockedError extends ClientPortalError {
  constructor(portalUrl: string, lockedUntil?: string) {
    super(`Portal "${portalUrl}" is locked${lockedUntil ? ` until ${lockedUntil}` : ''}`, {
      portalUrl,
      lockedUntil,
    });
    this.code = 'PORTAL_LOCKED';
  }
}

export class InvalidAccessTokenError extends ClientPortalError {
  constructor(portalUrl: string) {
    super(`Invalid access token for portal "${portalUrl}"`, { portalUrl });
    this.code = 'INVALID_ACCESS_TOKEN';
  }
}

export class PortalPermissionError extends ClientPortalError {
  constructor(portalUrl: string, requiredPermission: string) {
    super(`Insufficient permissions for portal "${portalUrl}": requires ${requiredPermission}`, {
      portalUrl,
      requiredPermission,
    });
    this.code = 'PORTAL_PERMISSION_ERROR';
  }
}

// ====================================
// Configuration Errors
// ====================================

export class ConfigurationError extends WhiteLabelBaseError {
  constructor(message: string, details?: any) {
    super('CONFIGURATION_ERROR', message, details);
  }
}

export class FeatureNotEnabledError extends ConfigurationError {
  constructor(feature: string, workspaceId: string) {
    super(`Feature "${feature}" is not enabled for this workspace`, { feature, workspaceId });
    this.code = 'FEATURE_NOT_ENABLED';
  }
}

export class InvalidSettingsError extends ConfigurationError {
  constructor(setting: string, reason: string) {
    super(`Invalid setting "${setting}": ${reason}`, { setting, reason });
    this.code = 'INVALID_SETTINGS_ERROR';
  }
}

export class SettingsValidationError extends ConfigurationError {
  constructor(errors: Record<string, string>) {
    super('Settings validation failed', { errors });
    this.code = 'SETTINGS_VALIDATION_ERROR';
  }
}

// ====================================
// Database Errors
// ====================================

export class DatabaseError extends WhiteLabelBaseError {
  constructor(message: string, details?: any) {
    super('DATABASE_ERROR', message, details);
  }
}

export class WorkspaceNotFoundError extends DatabaseError {
  constructor(workspaceId: string) {
    super(`Workspace not found: ${workspaceId}`, { workspaceId });
    this.code = 'WORKSPACE_NOT_FOUND';
  }
}

export class ClientNotFoundError extends DatabaseError {
  constructor(clientId: string) {
    super(`Client not found: ${clientId}`, { clientId });
    this.code = 'CLIENT_NOT_FOUND';
  }
}

export class UniqueConstraintError extends DatabaseError {
  constructor(field: string, value: string) {
    super(`Unique constraint violation: ${field} "${value}" already exists`, { field, value });
    this.code = 'UNIQUE_CONSTRAINT_ERROR';
  }
}

export class RecordNotFoundError extends DatabaseError {
  constructor(table: string, identifier: string) {
    super(`Record not found in ${table}: ${identifier}`, { table, identifier });
    this.code = 'RECORD_NOT_FOUND';
  }
}

// ====================================
// Authentication & Authorization Errors
// ====================================

export class AuthenticationError extends WhiteLabelBaseError {
  constructor(message: string, details?: any) {
    super('AUTHENTICATION_ERROR', message, details);
  }
}

export class AuthorizationError extends WhiteLabelBaseError {
  constructor(message: string, details?: any) {
    super('AUTHORIZATION_ERROR', message, details);
  }
}

export class UnauthorizedError extends AuthenticationError {
  constructor(resource: string) {
    super(`Unauthorized access to ${resource}`, { resource });
    this.code = 'UNAUTHORIZED';
  }
}

export class ForbiddenError extends AuthorizationError {
  constructor(resource: string, requiredRole: string) {
    super(`Forbidden: ${resource} requires ${requiredRole} role`, { resource, requiredRole });
    this.code = 'FORBIDDEN';
  }
}

export class InvalidTokenError extends AuthenticationError {
  constructor(tokenType: string) {
    super(`Invalid ${tokenType} token`, { tokenType });
    this.code = 'INVALID_TOKEN';
  }
}

export class TokenExpiredError extends AuthenticationError {
  constructor(tokenType: string) {
    super(`${tokenType} token has expired`, { tokenType });
    this.code = 'TOKEN_EXPIRED';
  }
}

// ====================================
// External Service Errors
// ====================================

export class ExternalServiceError extends WhiteLabelBaseError {
  constructor(service: string, message: string, details?: any) {
    super(`${service} error: ${message}`, { service, ...details });
    this.code = 'EXTERNAL_SERVICE_ERROR';
  }
}

export class DNSProviderError extends ExternalServiceError {
  constructor(provider: string, operation: string, reason: string) {
    super(provider, `DNS ${operation} failed: ${reason}`, { operation, reason });
    this.code = 'DNS_PROVIDER_ERROR';
  }
}

export class SSLProviderError extends ExternalServiceError {
  constructor(provider: string, domain: string, reason: string) {
    super(provider, `SSL certificate provisioning failed for ${domain}: ${reason}`, {
      domain,
      reason,
    });
    this.code = 'SSL_PROVIDER_ERROR';
  }
}

export class EmailProviderError extends ExternalServiceError {
  constructor(provider: string, operation: string, reason: string) {
    super(provider, `Email ${operation} failed: ${reason}`, { operation, reason });
    this.code = 'EMAIL_PROVIDER_ERROR';
  }
}

// ====================================
// Validation Errors
// ====================================

export class ValidationError extends WhiteLabelBaseError {
  constructor(field: string, value: any, reason: string) {
    super(`Validation error for ${field}: ${reason}`, { field, value, reason });
    this.code = 'VALIDATION_ERROR';
  }
}

export class RequiredFieldError extends ValidationError {
  constructor(field: string) {
    super(field, null, 'This field is required');
    this.code = 'REQUIRED_FIELD_ERROR';
  }
}

export class InvalidFormatError extends ValidationError {
  constructor(field: string, value: any, expectedFormat: string) {
    super(field, value, `Expected format: ${expectedFormat}`);
    this.code = 'INVALID_FORMAT_ERROR';
  }
}

export class ValueTooLongError extends ValidationError {
  constructor(field: string, value: string, maxLength: number) {
    super(field, value, `Value too long (max ${maxLength} characters)`);
    this.code = 'VALUE_TOO_LONG_ERROR';
  }
}

export class ValueTooShortError extends ValidationError {
  constructor(field: string, value: string, minLength: number) {
    super(field, value, `Value too short (min ${minLength} characters)`);
    this.code = 'VALUE_TOO_SHORT_ERROR';
  }
}

// ====================================
// Rate Limiting Errors
// ====================================

export class RateLimitError extends WhiteLabelBaseError {
  constructor(operation: string, limit: number, resetTime: string) {
    super(`Rate limit exceeded for ${operation}. Limit: ${limit}. Reset: ${resetTime}`, {
      operation,
      limit,
      resetTime,
    });
    this.code = 'RATE_LIMIT_ERROR';
  }
}

// ====================================
// Cache Errors
// ====================================

export class CacheError extends WhiteLabelBaseError {
  constructor(operation: string, reason: string) {
    super(`Cache ${operation} failed: ${reason}`, { operation, reason });
    this.code = 'CACHE_ERROR';
  }
}

// ====================================
// Error Utilities
// ====================================

/**
 * Check if an error is a white-label error
 */
export function isWhiteLabelError(error: any): error is WhiteLabelBaseError {
  return error instanceof WhiteLabelBaseError;
}

/**
 * Get error details from any error type
 */
export function getErrorDetails(error: any): WhiteLabelError {
  if (isWhiteLabelError(error)) {
    return error.toJSON();
  }

  if (error instanceof Error) {
    return {
      code: 'UNKNOWN_ERROR',
      message: error.message,
      details: {
        name: error.name,
        stack: error.stack,
      },
    };
  }

  return {
    code: 'UNKNOWN_ERROR',
    message: String(error),
    details: { originalError: error },
  };
}

/**
 * Format error for user display
 */
export function formatErrorForUser(error: any): string {
  const errorDetails = getErrorDetails(error);

  // User-friendly error messages
  const userFriendlyMessages: Record<string, string> = {
    DOMAIN_VALIDATION_ERROR: 'The domain name you entered is not valid. Please check the format and try again.',
    DOMAIN_NOT_FOUND: 'The requested domain could not be found.',
    DOMAIN_ALREADY_EXISTS: 'This domain is already registered. Please choose a different domain.',
    DOMAIN_VERIFICATION_ERROR: 'Domain verification failed. Please check your DNS settings and try again.',
    SSL_PROVISIONING_ERROR: 'SSL certificate setup failed. Please contact support if this continues.',
    DNS_CONFIGURATION_ERROR: 'DNS configuration error. Please check your domain settings.',
    INVALID_COLOR_ERROR: 'Please enter a valid color in hex format (e.g., #FF0000).',
    TEMPLATE_NOT_FOUND: 'The requested email template was not found.',
    PORTAL_NOT_FOUND: 'The client portal you are trying to access does not exist.',
    PORTAL_ACCESS_DENIED: 'Access to this portal is restricted.',
    PORTAL_EXPIRED: 'This portal link has expired. Please request a new one.',
    PORTAL_LOCKED: 'This portal is temporarily locked due to security reasons.',
    FEATURE_NOT_ENABLED: 'This feature is not available on your current plan.',
    UNAUTHORIZED: 'You are not authorized to perform this action.',
    FORBIDDEN: 'You do not have permission to access this resource.',
    RATE_LIMIT_ERROR: 'Too many requests. Please wait a moment and try again.',
    VALIDATION_ERROR: 'Please check your input and try again.',
  };

  return userFriendlyMessages[errorDetails.code] || errorDetails.message;
}

/**
 * Create error response for API endpoints
 */
export function createErrorResponse(error: any, statusCode: number = 500) {
  const errorDetails = getErrorDetails(error);

  return {
    error: {
      code: errorDetails.code,
      message: formatErrorForUser(error),
      details: process.env.NODE_ENV === 'development' ? errorDetails.details : undefined,
    },
    status: statusCode,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Log error with context
 */
export function logError(error: any, context?: Record<string, any>) {
  const errorDetails = getErrorDetails(error);
  
  console.error('White-Label Error:', {
    ...errorDetails,
    context,
    timestamp: new Date().toISOString(),
  });
}

// ====================================
// Error Recovery Utilities
// ====================================

/**
 * Retry operation with exponential backoff
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries) {
        break;
      }

      // Don't retry on certain error types
      if (isWhiteLabelError(error)) {
        const nonRetryableCodes = [
          'DOMAIN_VALIDATION_ERROR',
          'INVALID_COLOR_ERROR',
          'UNAUTHORIZED',
          'FORBIDDEN',
          'VALIDATION_ERROR',
        ];

        if (nonRetryableCodes.includes(error.code)) {
          throw error;
        }
      }

      // Exponential backoff
      const delay = baseDelay * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Wrap operation with error handling
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context?: string
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (context) {
      logError(error, { context });
    }
    throw error;
  }
}

// Export all error classes
export {
  WhiteLabelBaseError,
  DomainError,
  DomainValidationError,
  DomainNotFoundError,
  DomainAlreadyExistsError,
  DomainVerificationError,
  SSLProvisioningError,
  DNSConfigurationError,
  BrandingError,
  InvalidColorError,
  InvalidFontError,
  AssetUploadError,
  CSSGenerationError,
  EmailTemplateError,
  TemplateNotFoundError,
  InvalidTemplateError,
  TemplateRenderingError,
  VariableSubstitutionError,
  ClientPortalError,
  PortalNotFoundError,
  PortalAccessDeniedError,
  PortalExpiredError,
  PortalLockedError,
  InvalidAccessTokenError,
  PortalPermissionError,
  ConfigurationError,
  FeatureNotEnabledError,
  InvalidSettingsError,
  SettingsValidationError,
  DatabaseError,
  WorkspaceNotFoundError,
  ClientNotFoundError,
  UniqueConstraintError,
  RecordNotFoundError,
  AuthenticationError,
  AuthorizationError,
  UnauthorizedError,
  ForbiddenError,
  InvalidTokenError,
  TokenExpiredError,
  ExternalServiceError,
  DNSProviderError,
  SSLProviderError,
  EmailProviderError,
  ValidationError,
  RequiredFieldError,
  InvalidFormatError,
  ValueTooLongError,
  ValueTooShortError,
  RateLimitError,
  CacheError,
};