# ColdCopy Security Documentation

## Overview

ColdCopy implements enterprise-grade security features to protect your data and ensure reliable service. This document covers our security architecture, features, and best practices.

## Table of Contents

1. [Rate Limiting](#rate-limiting)
2. [API Key Authentication](#api-key-authentication)
3. [Security Headers](#security-headers)
4. [Data Encryption](#data-encryption)
5. [Access Control](#access-control)
6. [Audit Logging](#audit-logging)
7. [Best Practices](#best-practices)

## Rate Limiting

ColdCopy implements sophisticated rate limiting to prevent abuse and ensure fair usage.

### Rate Limit Tiers

#### Authentication Endpoints
- **Sign In**: 5 attempts per 15 minutes
- **Sign Up**: 3 attempts per hour
- **Password Reset**: 3 attempts per hour

#### API Endpoints
- **Default**: 100 requests per minute
- **Leads API**: 200 requests per minute
- **Campaigns API**: 50 requests per minute
- **Enrichment API**: 100 requests per hour
- **AI API**: 20 requests per minute
- **Export API**: 10 requests per hour
- **Upload API**: 50 uploads per hour

#### Public Endpoints
- **Email Tracking**: 10,000 events per minute
- **Unsubscribe**: 100 requests per hour

### Rate Limit Headers

All API responses include rate limit information:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
X-RateLimit-Reset-After: 45
```

### Handling Rate Limits

When rate limited, you'll receive a 429 response:

```json
{
  "error": "Too many requests",
  "retryAfter": "2024-01-01T12:00:00Z"
}
```

## API Key Authentication

API keys provide secure programmatic access to your workspace data.

### Creating API Keys

1. Navigate to Settings → API Keys
2. Click "Create API Key"
3. Configure:
   - **Name**: Descriptive identifier
   - **Permissions**: Granular scope selection
   - **Expiration**: Optional expiry date
   - **IP Allowlist**: Optional IP restrictions

### Using API Keys

Include your API key in requests using one of these methods:

#### Authorization Header (Recommended)
```bash
curl -H "Authorization: Bearer cc_your_api_key_here" \
  https://api.coldcopy.cc/v1/leads
```

#### X-API-Key Header
```bash
curl -H "X-API-Key: cc_your_api_key_here" \
  https://api.coldcopy.cc/v1/leads
```

### Available Scopes

#### Lead Management
- `leads.read` - View leads
- `leads.write` - Create and update leads
- `leads.delete` - Delete leads
- `leads.import` - Import leads
- `leads.export` - Export leads
- `leads.enrich` - Enrich lead data

#### Campaign Management
- `campaigns.read` - View campaigns
- `campaigns.write` - Create and update campaigns
- `campaigns.delete` - Delete campaigns
- `campaigns.send` - Send campaigns

#### Email Operations
- `email.send` - Send emails
- `email.read` - Read email data
- `email.track` - Track email events

#### Analytics & Workspace
- `analytics.read` - View analytics
- `workspace.read` - View workspace data
- `workspace.write` - Update workspace settings
- `workspace.members` - Manage team members

#### Billing & Webhooks
- `billing.read` - View billing information
- `billing.write` - Update billing settings
- `webhooks.read` - View webhooks
- `webhooks.write` - Manage webhooks

### API Key Security

- Keys are shown only once during creation
- Store keys securely in environment variables
- Use IP allowlisting for additional security
- Rotate keys regularly (recommended: every 90 days)
- Monitor usage through the dashboard

## Security Headers

ColdCopy implements comprehensive security headers:

### Content Security Policy (CSP)
```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https: blob:; connect-src 'self' https://api.stripe.com https://*.supabase.co wss://*.supabase.co https://api.openai.com https://api.anthropic.com; frame-src 'self' https://js.stripe.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
```

### Additional Headers
- `X-Frame-Options: DENY` - Prevents clickjacking
- `X-Content-Type-Options: nosniff` - Prevents MIME sniffing
- `X-XSS-Protection: 1; mode=block` - XSS protection
- `Referrer-Policy: strict-origin-when-cross-origin` - Controls referrer information
- `Permissions-Policy: camera=(), microphone=(), geolocation=()` - Restricts browser features
- `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload` - Forces HTTPS

## Data Encryption

### At Rest
- Database encryption using AES-256
- File storage encryption in Digital Ocean Spaces
- Encrypted backups with customer-managed keys

### In Transit
- TLS 1.3 for all connections
- Certificate pinning for mobile apps
- Perfect Forward Secrecy (PFS)

### Sensitive Data
- API keys hashed with SHA-256
- Passwords hashed with bcrypt (cost factor 12)
- OAuth tokens encrypted before storage
- PII fields encrypted at application level

## Access Control

### Role-Based Access Control (RBAC)

#### Roles
1. **Super Admin** - Full system access
2. **Workspace Admin** - Full workspace access
3. **Campaign Manager** - Campaign and lead management
4. **Outreach Specialist** - Email sending and inbox access

#### Row-Level Security (RLS)
- Automatic workspace isolation
- User-specific data filtering
- Secure multi-tenancy

### Session Management
- 30-day session lifetime
- Secure, httpOnly cookies
- Automatic session refresh
- Device tracking and management

## Audit Logging

All security-relevant events are logged:

### Logged Events
- Authentication (login, logout, password changes)
- API key operations (create, update, revoke)
- Data access (exports, bulk operations)
- Permission changes
- Failed authentication attempts
- Rate limit violations

### Log Format
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2024-01-01T12:00:00Z",
  "user_id": "user_123",
  "workspace_id": "ws_456",
  "action": "api_key.create",
  "resource_type": "api_key",
  "resource_id": "key_789",
  "ip_address": "192.168.1.1",
  "user_agent": "Mozilla/5.0...",
  "metadata": {
    "name": "Production API Key",
    "scopes": ["leads.read", "campaigns.read"]
  }
}
```

### Log Retention
- Security logs: 2 years
- Access logs: 1 year
- Error logs: 90 days

## Best Practices

### For Developers

1. **API Key Management**
   ```bash
   # Good: Store in environment variables
   export COLDCOPY_API_KEY="cc_your_key_here"
   
   # Bad: Hardcode in source
   const apiKey = "cc_your_key_here" // Never do this!
   ```

2. **Error Handling**
   ```javascript
   try {
     const response = await fetch('/api/leads', {
       headers: {
         'Authorization': `Bearer ${process.env.COLDCOPY_API_KEY}`
       }
     });
     
     if (response.status === 429) {
       // Handle rate limiting
       const retryAfter = response.headers.get('Retry-After');
       await sleep(retryAfter * 1000);
       return retry();
     }
     
     if (!response.ok) {
       throw new Error(`API error: ${response.status}`);
     }
     
     return await response.json();
   } catch (error) {
     console.error('API request failed:', error);
     // Implement appropriate error handling
   }
   ```

3. **Webhook Security**
   ```javascript
   // Verify webhook signatures
   const crypto = require('crypto');
   
   function verifyWebhookSignature(payload, signature, secret) {
     const hmac = crypto.createHmac('sha256', secret);
     hmac.update(payload);
     const expectedSignature = hmac.digest('hex');
     
     return crypto.timingSafeEqual(
       Buffer.from(signature),
       Buffer.from(expectedSignature)
     );
   }
   ```

### For Administrators

1. **Regular Security Tasks**
   - Review API key usage monthly
   - Rotate API keys quarterly
   - Audit user permissions quarterly
   - Review security logs weekly
   - Update IP allowlists as needed

2. **Incident Response**
   - Immediately revoke compromised API keys
   - Reset passwords if account compromise suspected
   - Review audit logs for unauthorized access
   - Contact support for security incidents

3. **Compliance Considerations**
   - Enable audit logging for all workspaces
   - Configure data retention policies
   - Implement IP restrictions for sensitive operations
   - Use separate API keys for different environments
   - Document security procedures

## Security Contact

For security concerns or to report vulnerabilities:

- Email: security@coldcopy.cc
- Response time: Within 24 hours for critical issues
- Bug bounty program: Available for qualifying vulnerabilities

## Security Certifications

ColdCopy maintains:
- SOC 2 Type II compliance
- GDPR compliance
- CCPA compliance
- ISO 27001 certification (in progress)

## Updates and Monitoring

Stay informed about security:
- Security status: https://status.coldcopy.cc
- Security blog: https://coldcopy.cc/security
- API changelog: https://docs.coldcopy.cc/changelog