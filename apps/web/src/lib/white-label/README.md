# White-Label Service Documentation

A comprehensive white-label solution for ColdCopy providing domain management, branding customization, client portals, email templates, and configuration management.

## Features

### 🌐 Domain Management
- Custom domain verification and SSL certificate provisioning
- DNS record generation and validation
- Primary domain handling and subdomain routing
- Automatic SSL certificate management

### 🎨 Branding System
- Dynamic theme generation from brand colors
- CSS custom property injection
- Logo and favicon management
- Font loading and custom CSS application
- Real-time style generation

### 🔐 Client Portal Service
- Secure portal generation for leads/clients
- Access token management with expiration
- Portal authentication and permissions
- Custom portal content rendering
- Role-based access control

### 📧 Email Template Service
- White-label email template rendering
- Variable substitution with branding
- Custom email styling with brand colors
- Template management and versioning
- Multi-language support ready

### ⚙️ Configuration Management
- Feature flag management
- Settings validation and defaults
- Multi-domain configuration
- Performance-optimized caching

## Quick Start

### 1. Initialize a Workspace

```typescript
import { setupWhiteLabelWorkspace } from '@/lib/white-label';

// Quick setup for new workspace
await setupWhiteLabelWorkspace('workspace-123', 'My Company', {
  primaryColor: '#ff6b35',
  logoUrl: 'https://example.com/logo.png',
  customDomain: 'mycompany.com',
  enablePortals: true,
});
```

### 2. Basic Service Usage

```typescript
import { whiteLabelService } from '@/lib/white-label';

// Get workspace configuration
const config = await whiteLabelService.getWorkspaceConfiguration('workspace-123');

// Create custom domain
const domain = await whiteLabelService.createDomain({
  workspaceId: 'workspace-123',
  domain: 'app.mycompany.com',
  isPrimary: true,
});

// Update branding
const branding = await whiteLabelService.updateBranding({
  workspaceId: 'workspace-123',
  branding: {
    company_name: 'My Company',
    primary_color: '#ff6b35',
    logo_url: 'https://example.com/logo.png',
  },
});
```

### 3. Server-Side Usage

```typescript
import { createWhiteLabelService } from '@/lib/white-label';

// Create server-side instance
const service = await createWhiteLabelService();

// Use in API routes
export async function GET(request: Request) {
  const domains = await service.getDomains('workspace-123');
  return Response.json(domains);
}
```

## Core APIs

### Domain Management

```typescript
// Create domain
const domain = await service.createDomain({
  workspaceId: 'workspace-123',
  domain: 'mycompany.com',
  subdomain: 'app', // Optional
  isPrimary: true,
});

// Verify domain ownership
const verified = await service.verifyDomain(domain.id);

// Provision SSL certificate
const sslProvisioned = await service.provisionSSL(domain.id);

// Get domain configuration
const config = await service.getDomainConfig('app.mycompany.com');
```

### Branding System

```typescript
// Get branding
const branding = await service.getBranding('workspace-123');

// Update branding
const updated = await service.updateBranding({
  workspaceId: 'workspace-123',
  branding: {
    primary_color: '#ff6b35',
    secondary_color: '#2c3e50',
    company_name: 'My Company',
    logo_url: 'https://example.com/logo.png',
  },
});

// Generate CSS
const css = await service.generateBrandingCSS('workspace-123');
```

### Client Portals

```typescript
// Create client portal
const portal = await service.createClientPortal({
  workspaceId: 'workspace-123',
  clientId: 'client-456',
  permissions: {
    view_campaigns: true,
    view_analytics: true,
    download_reports: false,
  },
  expiresInDays: 365,
});

// Validate portal access
const validation = await service.validatePortalAccess({
  portalUrl: portal.portal_url,
  accessToken: 'provided-token',
});
```

### Email Templates

```typescript
// Create email template
const template = await service.createEmailTemplate({
  workspaceId: 'workspace-123',
  templateType: 'welcome',
  templateName: 'Welcome Email',
  subject: 'Welcome to {{company_name}}!',
  htmlContent: '<h1>Welcome {{user_name}}!</h1>',
  variables: {
    user_name: '{{user_name}}',
    company_name: '{{company_name}}',
  },
});

// Render template with variables
const rendered = await service.renderEmailTemplate({
  workspaceId: 'workspace-123',
  templateType: 'welcome',
  variables: {
    user_name: 'John Doe',
    company_name: 'My Company',
    action_url: 'https://app.mycompany.com/dashboard',
  },
});
```

## Middleware Integration

### Next.js Middleware Setup

```typescript
// middleware.ts
import { whiteLabelMiddleware } from '@/lib/white-label';

export async function middleware(request: NextRequest) {
  return await whiteLabelMiddleware(request);
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
```

### Custom Domain Handling

The middleware automatically handles:
- Custom domain routing
- SSL certificate validation
- Branding injection
- Portal authentication
- Rate limiting

### Getting Context in Components

```typescript
import { getWhiteLabelContext } from '@/lib/white-label';

export default function MyComponent({ request }: { request: NextRequest }) {
  const context = getWhiteLabelContext(request);
  
  return (
    <div>
      <h1>Welcome to {context.workspaceId}</h1>
      {context.css && <style dangerouslySetInnerHTML={{ __html: context.css }} />}
    </div>
  );
}
```

## Advanced Usage

### Custom CSS Generation

```typescript
import { generateBrandCSS, BrandTheme } from '@/lib/white-label';

const theme: BrandTheme = {
  colors: {
    primary: '#ff6b35',
    secondary: '#2c3e50',
    accent: '#f39c12',
    background: '#ffffff',
    text: '#2c3e50',
  },
  fonts: {
    family: 'Roboto, sans-serif',
    url: 'https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap',
  },
  config: {
    borderRadius: '8px',
    spacing: '1.5rem',
    shadows: true,
    animations: true,
  },
};

const css = generateBrandCSS(theme);
```

### Portal Permissions

```typescript
const permissions: ClientPortalPermissions = {
  view_campaigns: true,
  view_analytics: true,
  download_reports: false,
  update_profile: true,
  view_invoices: false,
  manage_team: false,
};

const portal = await service.createClientPortal({
  workspaceId: 'workspace-123',
  clientId: 'client-456',
  permissions,
});
```

### Feature Flags

```typescript
// Check if feature is enabled
const isEnabled = await service.isFeatureEnabled('workspace-123', 'custom_domains');

// Update feature flags
await service.updateSettings('workspace-123', {
  feature_flags: {
    custom_domains: true,
    client_portals: true,
    api_access: true,
  },
});
```

## Error Handling

The service provides comprehensive error handling:

```typescript
import { 
  DomainValidationError,
  PortalAccessDeniedError,
  isWhiteLabelError,
  formatErrorForUser,
} from '@/lib/white-label';

try {
  await service.createDomain({
    workspaceId: 'workspace-123',
    domain: 'invalid-domain',
  });
} catch (error) {
  if (isWhiteLabelError(error)) {
    console.error('White-label error:', error.code, error.message);
    
    // Show user-friendly message
    const userMessage = formatErrorForUser(error);
    alert(userMessage);
  }
}
```

## Caching

The service includes built-in caching for performance:

```typescript
// Cache is automatic, but you can control it
service.clearWorkspaceCache('workspace-123');

// Get cache statistics
const stats = service.getCacheStats();
console.log('Cache size:', stats.size);
```

## Rate Limiting

Built-in rate limiting for API protection:

```typescript
import { rateLimiter } from '@/lib/white-label';

// Check rate limit
const allowed = rateLimiter.isAllowed('workspace-123');
if (!allowed) {
  throw new Error('Rate limit exceeded');
}

// Get remaining requests
const remaining = rateLimiter.getRemainingRequests('workspace-123');
```

## Database Schema

The service works with these database tables:
- `white_label_domains` - Custom domains and SSL certificates
- `white_label_branding` - Visual branding and company info
- `white_label_email_templates` - Email templates and variables
- `white_label_client_portals` - Client portal access and permissions
- `white_label_settings` - Feature flags and configuration

## Security Considerations

1. **Domain Verification**: All domains must be verified before activation
2. **SSL Certificates**: Automatic provisioning and renewal
3. **Access Tokens**: Secure token generation for portal access
4. **Rate Limiting**: Built-in protection against abuse
5. **Input Validation**: Comprehensive validation for all inputs
6. **SQL Injection Protection**: All queries use parameterized statements

## Performance Optimization

1. **Caching**: Multi-level caching for frequently accessed data
2. **Database Indexes**: Optimized indexes for all query patterns
3. **Connection Pooling**: Efficient database connection management
4. **CDN Ready**: CSS and assets can be cached by CDN
5. **Lazy Loading**: Components load only when needed

## Testing

```typescript
// Example test
import { WhiteLabelService } from '@/lib/white-label';

describe('WhiteLabelService', () => {
  it('should create domain successfully', async () => {
    const service = new WhiteLabelService(mockSupabaseClient);
    
    const domain = await service.createDomain({
      workspaceId: 'test-workspace',
      domain: 'test.com',
    });
    
    expect(domain.domain).toBe('test.com');
    expect(domain.verification_status).toBe('pending');
  });
});
```

## Migration Guide

If upgrading from a previous version:

1. Run database migrations
2. Update middleware configuration
3. Update component imports
4. Test custom domain routing
5. Verify SSL certificate provisioning

## Support

For issues or questions:
1. Check the error handling section
2. Review the database schema
3. Examine the middleware configuration
4. Contact the development team

## License

This white-label service is part of the ColdCopy application and follows the same license terms.