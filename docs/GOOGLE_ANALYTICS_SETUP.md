# Google Analytics Setup Guide

## Overview
ColdCopy is pre-configured to use Google Analytics 4 (GA4) for tracking user behavior and platform metrics. You just need to add your GA Measurement ID.

## Setup Steps

### 1. Create Google Analytics Property
1. Go to [Google Analytics](https://analytics.google.com)
2. Click "Admin" (gear icon)
3. Click "Create Property"
4. Enter property name: "ColdCopy"
5. Select your time zone and currency
6. Choose "Web" as platform
7. Enter website URL: https://coldcopy.cc

### 2. Get Measurement ID
1. In GA4, go to Admin → Data Streams
2. Click on your web stream
3. Copy the "Measurement ID" (starts with G-)
   - Example: `G-XXXXXXXXXX`

### 3. Add to Environment Variables
Add to your `.env.local` file:
```env
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

For Vercel deployment:
```bash
vercel env add NEXT_PUBLIC_GA_MEASUREMENT_ID
```

### 4. Deploy Changes
The analytics will automatically start working after deployment.

## What's Being Tracked

### Page Views
- Every page navigation
- Time on page
- Bounce rate
- User flow

### User Events
- **Authentication**: Signup, login, logout
- **Campaigns**: Create, start, pause
- **AI Usage**: Email generation by model
- **Leads**: Import, enrichment
- **Billing**: Plan upgrades/downgrades
- **Features**: Usage of specific features

### Custom Dimensions
- Workspace ID
- User role
- Subscription plan
- AI model preference

## Using Analytics in Code

### Track Custom Events
```typescript
import { trackEvents } from '@/lib/analytics/gtag'

// Track campaign creation
trackEvents.createCampaign()

// Track AI usage
trackEvents.generateEmail('gpt-4')

// Track lead import
trackEvents.importLeads(100)
```

### Track Page Views (Automatic)
Page views are automatically tracked via the `AnalyticsProvider` component.

### Track User Properties
```typescript
import { setUserProperties } from '@/lib/analytics/gtag'

setUserProperties({
  subscription_plan: 'pro',
  workspace_count: 3,
  total_campaigns: 25
})
```

## Viewing Analytics

### Real-time Reports
1. Go to GA4 → Reports → Real-time
2. See active users on your site right now
3. Monitor live conversions

### Key Reports to Monitor
1. **User Acquisition** - Where users come from
2. **Engagement** - Feature usage and retention
3. **Monetization** - Revenue by user segment
4. **Retention** - User cohort analysis

### Custom Reports
Create custom reports for:
- AI model usage comparison
- Campaign performance by user segment
- Feature adoption rates
- Conversion funnel analysis

## Privacy Compliance

### GDPR Compliance
- Analytics respects user consent preferences
- No personal data is sent to GA
- IP anonymization is enabled
- Users can opt-out via privacy settings

### Cookie Notice
The platform includes cookie consent management that controls GA tracking.

## Testing Analytics

### Debug Mode
Enable debug mode in browser console:
```javascript
window.gtag('config', 'GA_MEASUREMENT_ID', {
  debug_mode: true
});
```

### GA4 DebugView
1. Enable debug mode
2. Go to GA4 → Configure → DebugView
3. See events in real-time

### Browser Extension
Install "Google Analytics Debugger" Chrome extension for detailed logging.

## Common Issues

### No Data Showing
1. Check if Measurement ID is correct
2. Verify environment variable is set
3. Wait 24-48 hours for data to appear
4. Check if ad blockers are blocking GA

### Events Not Tracking
1. Check browser console for errors
2. Verify event names match GA4 standards
3. Ensure user has accepted cookies

### Wrong Time Zone
1. Go to GA4 Admin → Property Settings
2. Update time zone
3. Historical data won't change

## Advanced Configuration

### Enhanced Ecommerce
Track detailed purchase funnel:
```typescript
// View item
gtag('event', 'view_item', {
  currency: 'USD',
  value: 99.00,
  items: [{
    item_id: 'plan_pro',
    item_name: 'Pro Plan',
    price: 99.00,
    quantity: 1
  }]
})
```

### User ID Tracking
For better cross-device tracking:
```typescript
gtag('config', 'GA_MEASUREMENT_ID', {
  user_id: 'USER_ID'
})
```

### Custom Dimensions
Set up in GA4 Admin → Custom definitions:
1. workspace_id (User-scoped)
2. subscription_plan (User-scoped)
3. ai_model (Event-scoped)

## Monitoring Checklist

- [ ] Verify GA4 property is receiving data
- [ ] Set up conversion events (signup, purchase)
- [ ] Create custom audiences
- [ ] Set up email alerts for anomalies
- [ ] Configure data retention settings
- [ ] Link to Google Ads (if using)
- [ ] Export to BigQuery (for advanced analysis)

---

*Note: Google Analytics data may take 24-48 hours to fully populate after initial setup.*