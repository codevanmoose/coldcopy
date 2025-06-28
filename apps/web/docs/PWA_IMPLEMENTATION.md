# PWA Implementation Guide

This document outlines the Progressive Web App (PWA) implementation for ColdCopy, including offline functionality, service workers, and mobile app experience.

## Overview

ColdCopy's PWA implementation provides:
- **Offline functionality** with intelligent caching strategies
- **App-like experience** with installable app capabilities
- **Push notifications** for real-time updates
- **Background sync** for data synchronization
- **Responsive design** optimized for mobile and desktop

## Architecture

### Service Worker (`/public/sw.js`)

The service worker implements multiple caching strategies:

1. **Network-first**: For authentication, billing, and real-time data
2. **Stale-while-revalidate**: For dashboard and analytics data
3. **Cache-first**: For static assets and resources
4. **Network-only**: For mutations and sensitive operations

```javascript
// Example: Stale-while-revalidate for dashboard data
const CACHE_API_PATTERNS = [
  '/api/dashboard/stats',
  '/api/leads',
  '/api/campaigns',
  '/api/analytics/overview'
]
```

### PWA Manager (`/src/lib/pwa/pwa-manager.ts`)

Central class managing all PWA functionality:

```typescript
// Initialize PWA features
const pwaManager = PWAManager.getInstance()
await pwaManager.initialize()

// Check installation status
const status = await pwaManager.getInstallationStatus()

// Handle notifications
await pwaManager.sendNotification('Campaign Complete', {
  body: 'Your email campaign has finished sending',
  tag: 'campaign-complete'
})
```

## Components

### PWA Provider
Context provider for PWA state management:

```tsx
import { PWAProvider, usePWA } from '@/components/pwa'

function App() {
  return (
    <PWAProvider>
      <YourApp />
    </PWAProvider>
  )
}

function MyComponent() {
  const { isOnline, isInstallable, installApp } = usePWA()
  // Use PWA features
}
```

### Install Banner
Prompts users to install the app:

```tsx
import { InstallBanner } from '@/components/pwa'

function Layout() {
  return (
    <>
      <InstallBanner />
      <main>{children}</main>
    </>
  )
}
```

### Offline Indicator
Shows network status and offline capabilities:

```tsx
import { OfflineIndicator, NetworkStatusToast } from '@/components/pwa'

function Layout() {
  return (
    <>
      <OfflineIndicator />
      <NetworkStatusToast />
      <main>{children}</main>
    </>
  )
}
```

### PWA Settings
Admin panel for PWA configuration:

```tsx
import { PWASettings } from '@/components/pwa'

function SettingsPage() {
  return (
    <div>
      <h1>Settings</h1>
      <PWASettings />
    </div>
  )
}
```

## Features

### Offline Functionality

The app works offline with cached data:

- **Pages**: Dashboard, leads, campaigns, analytics
- **API Data**: Recent dashboard stats, lead lists, campaign data
- **Static Assets**: Icons, stylesheets, JavaScript bundles

When offline:
- Users can view cached data
- Forms show offline warnings
- Sync queues operations for when online

### Installation

Users can install ColdCopy as a native app:

1. **Install Prompt**: Automatically shown when criteria are met
2. **Manual Install**: Via browser menu or install banner
3. **App Shortcuts**: Quick access to key features
4. **File Handling**: Open CSV files directly in ColdCopy

### Push Notifications

Real-time notifications for:
- Campaign completion
- New email replies
- Lead updates
- System alerts

```typescript
// Send notification
await pwaManager.sendNotification('New Reply', {
  body: 'You received a reply to your campaign',
  data: { campaignId: '123', leadId: '456' },
  actions: [
    { action: 'view', title: 'View Reply' },
    { action: 'dismiss', title: 'Dismiss' }
  ]
})
```

### Background Sync

Automatic data synchronization:
- **Retry failed requests** when connection restored
- **Update cached data** in background
- **Sync pending operations** from offline queue

## Manifest Configuration

The app manifest (`/public/manifest.json`) includes:

- **App Identity**: Name, description, icons
- **Display Mode**: Standalone app experience
- **Shortcuts**: Quick actions from home screen
- **File Handlers**: CSV import capability
- **Share Target**: Import leads from other apps

```json
{
  "name": "ColdCopy - AI-Powered Cold Outreach",
  "short_name": "ColdCopy",
  "start_url": "/dashboard?source=pwa",
  "display": "standalone",
  "shortcuts": [
    {
      "name": "New Campaign",
      "url": "/campaigns/new"
    }
  ]
}
```

## Implementation Steps

### 1. Add PWA Provider to Root Layout

```tsx
// app/layout.tsx
import { PWAProvider } from '@/components/pwa'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <PWAProvider>
          {children}
        </PWAProvider>
      </body>
    </html>
  )
}
```

### 2. Add PWA Components

```tsx
// app/(dashboard)/layout.tsx
import { OfflineIndicator, NetworkStatusToast, InstallBanner } from '@/components/pwa'

export default function DashboardLayout({ children }) {
  return (
    <>
      <InstallBanner />
      <OfflineIndicator />
      <NetworkStatusToast />
      <main>{children}</main>
    </>
  )
}
```

### 3. Configure Next.js

```javascript
// next.config.js
const withPWA = require('next-pwa')({
  dest: 'public',
  register: false, // We register manually
  skipWaiting: false // We handle this manually
})

module.exports = withPWA({
  // Your Next.js config
})
```

### 4. Add Meta Tags

```tsx
// app/layout.tsx
export default function RootLayout() {
  return (
    <html>
      <head>
        <meta name="application-name" content="ColdCopy" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="ColdCopy" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#6366F1" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body>{children}</body>
    </html>
  )
}
```

## Caching Strategies

### API Endpoints

- **Network-first**: `/api/auth/*`, `/api/billing/*`, `/api/email/*`
- **Stale-while-revalidate**: `/api/dashboard/*`, `/api/leads`, `/api/campaigns`
- **Network-only**: POST/PUT/DELETE requests

### Static Assets

- **Cache-first**: Images, fonts, CSS, JavaScript
- **Network-first**: HTML pages for fresh content

### Cache Management

```typescript
// Clear all caches
await pwaManager.clearCache()

// Update specific cache entry
pwaManager.updateCache('/api/dashboard/stats')

// Get cache status
const status = await pwaManager.getCacheStatus()
console.log(`${status.totalCaches} caches, ${pwaManager.formatCacheSize(status.totalSize)}`)
```

## Offline Page

Custom offline page (`/public/offline.html`) with:
- Connection status monitoring
- Automatic retry when online
- Information about cached features
- Elegant design matching app theme

## Testing

### PWA Features
1. **Install**: Chrome DevTools > Application > Manifest
2. **Offline**: Network tab > Go offline
3. **Notifications**: Console > `pwaManager.sendNotification('Test')`
4. **Cache**: Application > Storage > Cache Storage

### Lighthouse Audit
Run PWA audit to ensure:
- ✅ Installable
- ✅ PWA optimized
- ✅ Fast and reliable
- ✅ Accessible

## Browser Support

- **Chrome/Edge**: Full PWA support
- **Firefox**: Partial support (no install)
- **Safari**: Basic PWA features
- **Mobile**: Enhanced experience on all platforms

## Security Considerations

- HTTPS required for service workers
- Secure notification permissions
- Cache isolation between workspaces
- No sensitive data in cache

## Performance

- **First Load**: Service worker registration
- **Subsequent Loads**: Instant from cache
- **Offline**: Immediate response from cache
- **Background Sync**: Non-blocking updates

## Monitoring

Track PWA usage:
- Installation rates
- Offline usage patterns
- Cache hit rates
- Notification engagement

```typescript
// Analytics example
analytics.track('pwa_installed', {
  source: 'banner',
  device: 'mobile'
})

analytics.track('offline_usage', {
  duration: offlineTime,
  pagesViewed: cachedPagesViewed
})
```

## Troubleshooting

### Common Issues

1. **Service Worker Not Registering**
   - Check HTTPS requirement
   - Verify file path `/sw.js`
   - Check browser console for errors

2. **Install Prompt Not Showing**
   - Ensure PWA criteria are met
   - Check manifest validation
   - Verify service worker is active

3. **Notifications Not Working**
   - Check permission status
   - Verify HTTPS connection
   - Test notification support

4. **Cache Issues**
   - Clear browser cache
   - Update service worker version
   - Check cache storage limits

### Debug Commands

```javascript
// Check service worker status
navigator.serviceWorker.getRegistrations().then(console.log)

// Check cache contents
caches.keys().then(console.log)

// Check notification permission
console.log(Notification.permission)

// Force service worker update
navigator.serviceWorker.ready.then(reg => reg.update())
```

## Future Enhancements

- **Web Streams**: For real-time data
- **Background Fetch**: For large file uploads
- **Periodic Sync**: For automated data updates
- **Window Controls Overlay**: For desktop app appearance
- **File System Access**: For direct file operations

## Resources

- [PWA Checklist](https://web.dev/pwa-checklist/)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Web App Manifest](https://developer.mozilla.org/en-US/docs/Web/Manifest)
- [Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)