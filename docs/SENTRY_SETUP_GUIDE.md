# Sentry Error Monitoring Setup Guide

## Overview
ColdCopy is pre-configured to use Sentry for error monitoring and performance tracking. This guide explains how to set up Sentry for production use.

## Current Implementation
- ✅ Sentry SDK installed and configured
- ✅ Error boundaries integrated
- ✅ Source maps configured
- ✅ Performance monitoring ready
- ✅ Session replay capability
- ✅ Automatic error grouping

## Setup Steps

### 1. Create Sentry Account
1. Sign up at [sentry.io](https://sentry.io)
2. Create a new organization
3. Create a new project:
   - Platform: Next.js
   - Project name: coldcopy-production
   - Team: Your team name

### 2. Get DSN (Data Source Name)
1. Go to Settings → Projects → Your Project
2. Click on "Client Keys (DSN)"
3. Copy the DSN (format: `https://xxx@xxx.ingest.sentry.io/xxx`)

### 3. Configure Environment Variables

#### Local Development (.env.local)
```env
# Sentry Configuration
NEXT_PUBLIC_SENTRY_DSN=https://your-dsn@sentry.io/project-id
SENTRY_ORG=your-org-name
SENTRY_PROJECT=coldcopy-production
SENTRY_AUTH_TOKEN=your-auth-token
```

#### Production (Vercel)
```bash
# Add DSN for client-side errors
vercel env add NEXT_PUBLIC_SENTRY_DSN production

# Add organization and project for source maps
vercel env add SENTRY_ORG production
vercel env add SENTRY_PROJECT production
vercel env add SENTRY_AUTH_TOKEN production
```

### 4. Generate Sentry Auth Token
1. Go to Settings → Account → API → Auth Tokens
2. Create new token with scopes:
   - `project:releases`
   - `org:read`
   - `project:write`
3. Copy the token

### 5. Configure Source Maps (Optional but Recommended)
Source maps help you see the original code in error reports.

In your CI/CD or deployment:
```bash
# Upload source maps during build
SENTRY_AUTH_TOKEN=xxx npm run build
```

## Features Configured

### 1. Error Tracking
- Automatic error capture
- Error boundaries for React components
- Unhandled promise rejection tracking
- Network error monitoring

### 2. Performance Monitoring
- Page load performance
- API call tracking
- Database query monitoring
- Custom transaction tracking

### 3. Session Replay
- Visual replay of user sessions when errors occur
- Privacy-safe (masks sensitive data)
- 10% sample rate for all sessions
- 100% capture on errors

### 4. Release Tracking
- Automatic version tracking with git commits
- Error regression detection
- Deploy tracking

## Configuration Options

### Sampling Rates
Current configuration in `sentry.client.config.ts`:
```typescript
tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0, // 10% in prod
replaysSessionSampleRate: 0.1, // 10% of sessions
replaysOnErrorSampleRate: 1.0, // 100% on errors
```

Adjust based on your volume and plan limits.

### Ignored Errors
Common browser errors are filtered out:
- Browser extension errors
- Network failures
- ResizeObserver warnings
- Known Next.js navigation errors

Add more in `ignoreErrors` array if needed.

### Privacy Controls
Sensitive data is automatically filtered:
- Passwords
- API keys
- Credit card numbers
- Personal information

## Usage in Code

### Manual Error Capture
```typescript
import * as Sentry from '@sentry/nextjs'

try {
  // Your code
} catch (error) {
  Sentry.captureException(error, {
    tags: {
      section: 'payment',
    },
    extra: {
      orderId: order.id,
    },
  })
}
```

### Add User Context
```typescript
import * as Sentry from '@sentry/nextjs'

// After user login
Sentry.setUser({
  id: user.id,
  email: user.email,
  username: user.username,
})

// On logout
Sentry.setUser(null)
```

### Custom Breadcrumbs
```typescript
Sentry.addBreadcrumb({
  message: 'User clicked upgrade button',
  category: 'ui',
  level: 'info',
  data: {
    plan: 'professional',
  },
})
```

### Performance Tracking
```typescript
const transaction = Sentry.startTransaction({
  op: 'ai.generate',
  name: 'Generate Email with AI',
})

try {
  const result = await generateEmail()
  transaction.setStatus('ok')
} catch (error) {
  transaction.setStatus('internal_error')
  throw error
} finally {
  transaction.finish()
}
```

## Viewing Errors in Sentry

### Dashboard Overview
1. **Issues**: All errors grouped by similarity
2. **Performance**: Page load and API performance
3. **Releases**: Errors by version
4. **Discover**: Custom queries

### Issue Details
Each error includes:
- Stack trace with source code
- User actions leading to error
- Device/browser information
- Custom context you added

### Alerts & Notifications

Set up alerts in Sentry:
1. Go to Alerts → Create Alert
2. Choose alert type:
   - Issue Alert: New errors or spikes
   - Metric Alert: Performance degradation
   - Uptime Alert: Service availability

Example alerts:
- New error affecting >10 users
- Page load time >3 seconds
- Error rate >5% of sessions
- Payment errors

## Best Practices

### 1. Add Context
Always add relevant context to errors:
```typescript
Sentry.withScope((scope) => {
  scope.setTag('feature', 'email-generation')
  scope.setContext('campaign', {
    id: campaign.id,
    name: campaign.name,
  })
  Sentry.captureException(error)
})
```

### 2. Use Error Boundaries
Wrap feature components:
```typescript
import { ErrorBoundary } from '@/components/error-boundary'

<ErrorBoundary>
  <YourComponent />
</ErrorBoundary>
```

### 3. Track Business Metrics
```typescript
// Track conversion events
Sentry.metrics.increment('subscription.created', 1, {
  tags: { plan: 'professional' },
})

// Track performance metrics
Sentry.metrics.distribution('ai.generation.duration', duration, {
  tags: { model: 'gpt-4' },
})
```

### 4. Filter Sensitive Data
```typescript
beforeSend(event) {
  // Remove sensitive data
  if (event.request?.cookies) {
    delete event.request.cookies
  }
  
  // Sanitize URLs
  if (event.request?.url) {
    event.request.url = sanitizeUrl(event.request.url)
  }
  
  return event
}
```

## Testing Sentry Integration

### 1. Test Error Capture
Add to any page:
```typescript
<button onClick={() => {
  throw new Error('Test Sentry Error')
}}>
  Test Sentry
</button>
```

### 2. Verify in Dashboard
1. Click the button
2. Go to Sentry dashboard
3. Error should appear within seconds

### 3. Test Source Maps
1. Check if error shows original source code
2. If showing minified code, verify auth token

## Monitoring Costs

Sentry pricing based on:
- Error events per month
- Performance transactions
- Session replays
- Data retention

Monitor usage in Sentry:
- Settings → Usage & Billing
- Set up quota alerts
- Adjust sampling rates if needed

## Troubleshooting

### Errors Not Appearing
1. Verify DSN is correct
2. Check browser console for Sentry errors
3. Ensure not blocked by ad blockers
4. Verify environment variables in production

### Source Maps Not Working
1. Check SENTRY_AUTH_TOKEN is set
2. Verify org and project names match
3. Check build logs for upload errors

### Performance Issues
1. Reduce sampling rates
2. Disable session replay
3. Filter out more errors client-side

## Security Considerations

1. **Never commit DSN to public repos** (OK for client-side)
2. **Keep AUTH_TOKEN secret** (server-side only)
3. **Sanitize all user data** before sending
4. **Use Sentry's data scrubbing** features
5. **Set up data retention** policies

## Next Steps

1. ✅ Add Sentry DSN to environment variables
2. ✅ Deploy to production
3. ✅ Test error capture
4. ✅ Set up alerts
5. ✅ Configure team notifications
6. ✅ Monitor performance metrics

---

*Remember: Good error monitoring helps you fix issues before users report them!*