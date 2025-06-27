# White-Label Domain Routing Middleware

This comprehensive middleware system provides white-label domain routing for Next.js applications, specifically designed for the ColdCopy platform. It handles custom domain detection, workspace resolution, authentication, and branding injection with high performance and security.

## 🚀 Features

### 1. **Domain Detection**
- ✅ Detect custom domains vs default app domain
- ✅ Extract workspace from domain configuration
- ✅ Handle both apex domains and subdomains
- ✅ Support for localhost and development environments

### 2. **White-Label Context**
- ✅ Inject white-label branding into request headers
- ✅ Set workspace context for custom domains
- ✅ Handle authentication for white-label domains
- ✅ Dynamic metadata and theme injection

### 3. **Routing Logic**
- ✅ Route white-label domains to appropriate pages
- ✅ Handle client portal access with token validation
- ✅ Redirect unauthorized access appropriately
- ✅ Smart rewriting for white-label routes

### 4. **Performance**
- ✅ Cache domain configurations with TTL
- ✅ Minimize database lookups via edge caching
- ✅ Handle edge cases gracefully
- ✅ Optimized for Vercel Edge Runtime

### 5. **Security**
- ✅ Validate domain ownership
- ✅ Prevent subdomain takeover attacks
- ✅ Secure portal access with token validation
- ✅ Rate limiting and DDoS protection
- ✅ Security headers injection

## 📁 File Structure

```
/src/
├── middleware.ts                     # Main middleware implementation
├── lib/white-label/
│   ├── domain-resolver.ts           # Domain resolution logic
│   ├── types.ts                     # TypeScript definitions
│   ├── utils.ts                     # Utility functions
│   └── white-label-service.ts       # Core service implementation
├── app/
│   ├── layout.tsx                   # Updated with dynamic branding
│   └── white-label/
│       ├── layout.tsx               # White-label layout
│       ├── page.tsx                 # Landing page
│       ├── login/page.tsx           # Custom login
│       ├── dashboard/page.tsx       # Dashboard
│       └── portal/[portalId]/page.tsx # Client portal
└── components/white-label/
    ├── white-label-provider.tsx     # React context provider
    ├── white-label-header.tsx       # Custom header component
    └── white-label-sidebar.tsx      # Custom sidebar component
```

## 🔧 Implementation Details

### Middleware Flow

The middleware processes requests in the following order:

1. **Rate Limiting & Security**
   - IP-based rate limiting (100 req/min)
   - Security headers injection
   - CSRF protection

2. **Domain Detection & Resolution**
   - Parse domain from request URL
   - Determine if custom domain or default
   - Fetch domain configuration from cache/database

3. **Security Validation**
   - Validate domain ownership
   - Prevent subdomain takeover
   - Check domain verification status

4. **Authentication**
   - Supabase auth integration
   - User session validation
   - Workspace context resolution

5. **Routing Decision**
   - Determine action: continue, redirect, rewrite, or block
   - Handle portal access validation
   - Apply white-label specific routing

6. **Header Injection**
   - Branding information headers
   - Workspace context headers
   - Feature flags and settings
   - Performance metrics

### Domain Resolver

The `DomainResolver` class handles:

```typescript
// Parse domain components
const validation = domainResolver.parseDomain(request.url);
// { domain: 'example.com', subdomain: 'app', isValid: true }

// Resolve domain context
const context = await domainResolver.resolveDomain(request);
// { isWhiteLabel: true, workspaceId: 'uuid', branding: {...} }

// Determine routing
const decision = domainResolver.determineRouting(context, pathname, isAuth);
// { action: 'rewrite', destination: '/white-label/dashboard' }
```

### Caching Strategy

- **Domain Configurations**: 5-minute TTL
- **Branding Data**: 30-minute TTL
- **Portal Validations**: 1-minute TTL
- **Automatic Cleanup**: Periodic expired entry removal

## 🚦 Routing Examples

### Default Domain Behavior
```
app.coldcopy.com/login → /login (normal flow)
app.coldcopy.com/dashboard → /dashboard (normal flow)
```

### White-Label Domain Behavior
```
client.example.com/ → /white-label (landing page)
client.example.com/login → /white-label/login (branded login)
client.example.com/dashboard → /white-label/dashboard (branded dashboard)
```

### Portal Access
```
client.example.com/portal/abc123?token=xyz → Portal validation → Client dashboard
```

## 🎨 Branding Integration

### Dynamic CSS Injection

The system injects custom CSS variables based on white-label branding:

```css
:root {
  --color-primary: #your-brand-color;
  --color-secondary: #your-secondary-color;
  --brand-font: 'Your Custom Font';
}
```

### Component Theming

Components automatically adapt to white-label branding:

```tsx
// Button with brand colors
<Button style={{ backgroundColor: branding.primaryColor }}>
  Click Me
</Button>

// Logo display
{branding.logoUrl ? (
  <img src={branding.logoUrl} alt="Logo" />
) : (
  <div style={{ backgroundColor: branding.primaryColor }}>
    {branding.companyName.charAt(0)}
  </div>
)}
```

## 🔐 Security Features

### Domain Validation
- DNS record verification
- SSL certificate validation
- Ownership proof requirements

### Portal Security
- Token-based authentication
- Expiration handling
- Account lockout protection
- Access logging

### Rate Limiting
```typescript
// Per-IP rate limiting
const RATE_LIMIT_MAX_REQUESTS = 100;
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
```

## 🚀 Performance Optimizations

### Edge Runtime Compatibility
- Minimal external dependencies
- Direct Supabase REST API calls
- Efficient memory usage

### Caching Architecture
```typescript
class EdgeCache {
  set<T>(key: string, data: T, ttl?: number): void
  get<T>(key: string): T | null
  cleanup(): void // Periodic cleanup
}
```

### Response Time Tracking
```typescript
headers.set('x-response-time', `${Date.now() - startTime}ms`);
headers.set('x-cache-status', domainContext.isWhiteLabel ? 'MISS' : 'HIT');
```

## 📊 Monitoring & Analytics

### Request Headers
All white-label requests include context headers:

```
x-white-label: true
x-workspace-id: uuid-here
x-domain: client.example.com
x-brand-company: Client%20Company
x-brand-primary-color: #ff6b35
x-response-time: 45ms
```

### Error Handling
- Graceful fallbacks for failed domain resolution
- Comprehensive error logging
- Fallback to default domain on errors

## 🔧 Configuration

### Environment Variables
```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-key
VERCEL_URL=your-default-domain.com
```

### Middleware Configuration
```typescript
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$|api).*)',
  ],
}
```

## 🎯 Usage Examples

### Setting Up a White-Label Domain

1. **Add Domain to Database**
```sql
INSERT INTO white_label_domains (workspace_id, domain, subdomain, is_active)
VALUES ('workspace-uuid', 'example.com', 'app', true);
```

2. **Configure DNS**
```
CNAME app.example.com → your-app.vercel.app
TXT _vercel → verification-token
```

3. **Set Up Branding**
```sql
INSERT INTO white_label_branding (workspace_id, company_name, primary_color, logo_url)
VALUES ('workspace-uuid', 'Client Company', '#ff6b35', 'https://...');
```

### Creating Client Portals

```typescript
// Create portal access
const portal = await whiteLabelService.createClientPortal({
  workspaceId: 'uuid',
  clientId: 'client-uuid',
  portalUrl: 'client-portal-slug',
  permissions: {
    view_campaigns: true,
    view_analytics: true,
    download_reports: false,
  },
  expiresInDays: 30,
});

// Access portal
const portalUrl = `https://client.example.com/portal/${portal.portal_url}?token=${portal.access_token}`;
```

### Custom Email Templates

```typescript
// Create branded email template
await whiteLabelService.createEmailTemplate({
  workspaceId: 'uuid',
  templateType: 'welcome',
  templateName: 'Client Welcome Email',
  subject: 'Welcome to {{company_name}}!',
  htmlContent: `
    <div style="color: {{primary_color}}">
      <h1>Welcome to {{company_name}}!</h1>
      <p>Your personalized outreach platform is ready.</p>
    </div>
  `,
  variables: {
    company_name: 'Client Company',
    primary_color: '#ff6b35',
  },
});
```

## 🔍 Troubleshooting

### Common Issues

1. **Domain Not Resolving**
   - Check DNS configuration
   - Verify domain ownership
   - Ensure domain is active in database

2. **Branding Not Applied**
   - Check white-label headers in browser dev tools
   - Verify branding data in database
   - Clear domain cache

3. **Portal Access Denied**
   - Validate access token
   - Check portal expiration
   - Verify portal is active

### Debug Mode

Enable verbose logging by setting:
```typescript
const DEBUG_MODE = process.env.NODE_ENV === 'development';
```

### Cache Management

```typescript
// Clear specific domain cache
domainResolver.clearCache('client.example.com');

// Clear all cache
domainResolver.clearCache();

// Get cache statistics
const stats = domainResolver.getCacheStats();
console.log('Cache size:', stats.size);
```

## 🚀 Deployment

### Vercel Configuration

```json
{
  "functions": {
    "src/middleware.ts": {
      "runtime": "edge"
    }
  },
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        }
      ]
    }
  ]
}
```

### Database Setup

Ensure these tables exist in your Supabase database:
- `white_label_domains`
- `white_label_branding`
- `white_label_settings`
- `white_label_client_portals`
- `white_label_email_templates`

### Production Checklist

- [ ] DNS records configured
- [ ] SSL certificates provisioned
- [ ] Domain ownership verified
- [ ] Rate limiting configured
- [ ] Error monitoring set up
- [ ] Cache warming implemented
- [ ] Performance testing completed

## 📚 API Reference

### Middleware Headers

| Header | Description | Example |
|--------|-------------|---------|
| `x-white-label` | Indicates white-label domain | `true` |
| `x-workspace-id` | Associated workspace ID | `uuid-string` |
| `x-domain` | Base domain | `example.com` |
| `x-subdomain` | Subdomain if present | `app` |
| `x-brand-company` | Company name (URL encoded) | `Client%20Company` |
| `x-brand-primary-color` | Primary brand color | `#ff6b35` |
| `x-brand-logo` | Logo URL (URL encoded) | `https://...` |
| `x-portal-id` | Portal ID for client access | `portal-slug` |
| `x-response-time` | Middleware processing time | `45ms` |

### Domain Resolver API

```typescript
interface DomainResolver {
  parseDomain(url: string): DomainValidation
  resolveDomain(request: Request): Promise<DomainContext>
  determineRouting(context: DomainContext, pathname: string, isAuth: boolean): RoutingDecision
  validateDomainOwnership(context: DomainContext): Promise<boolean>
  generateBrandingHeaders(context: DomainContext): Record<string, string>
  clearCache(domain?: string): void
}
```

## 🤝 Contributing

When extending the white-label system:

1. **Add new middleware features** in `src/middleware.ts`
2. **Extend domain resolution** in `src/lib/white-label/domain-resolver.ts`
3. **Add new white-label pages** in `src/app/white-label/`
4. **Create reusable components** in `src/components/white-label/`
5. **Update type definitions** in `src/lib/white-label/types.ts`

### Testing

```bash
# Test middleware locally
npm run dev

# Test with custom domain
echo "127.0.0.1 test.localhost" >> /etc/hosts
# Visit http://test.localhost:3000

# Test portal access
# Visit http://test.localhost:3000/portal/test-portal?token=test-token
```

This middleware system provides a robust foundation for white-label domain routing with enterprise-grade performance, security, and scalability features optimized for the Vercel Edge Runtime.