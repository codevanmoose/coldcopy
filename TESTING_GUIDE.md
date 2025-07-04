# ColdCopy Testing Guide

## Overview
This guide documents how to test the ColdCopy platform, including automated tests with Playwright and manual testing procedures.

## Prerequisites
- Node.js installed
- Playwright installed (`npm install playwright`)
- Chromium browser installed (`npx playwright install chromium`)

## Test Credentials

### Admin Account (CHANGE IN PRODUCTION!)
- **Email**: jaspervanmoose@gmail.com
- **Password**: okkenbollen33
- **Role**: super_admin
- **Warning**: These credentials are hardcoded in `setup-admin.js` and MUST be changed for security

## Automated Tests

### 1. Full Platform Test
Tests account creation, login, and basic navigation.

```bash
node test-full-platform.js
```

**What it tests:**
- Account creation flow
- Login functionality
- Dashboard access
- API health endpoints
- Error handling

### 2. Admin Login Test
Tests login with admin credentials and dashboard features.

```bash
node test-admin-login.js
```

**What it tests:**
- Admin login
- Dashboard loading
- All navigation sections
- Campaign creation
- User menu
- API endpoints

### 3. Dashboard Navigation Test
Comprehensive test of all dashboard features.

```bash
node test-dashboard-navigation.js
```

**What it tests:**
- Login flow
- Each dashboard section (Campaigns, Leads, Inbox, Templates, Analytics, Settings)
- Navigation functionality
- Content loading
- API health

## Manual Testing

### Essential URLs
1. **Landing Page**: https://www.coldcopy.cc
2. **Login Page**: https://www.coldcopy.cc/login
3. **Signup Page**: https://www.coldcopy.cc/signup
4. **Dashboard**: https://www.coldcopy.cc/dashboard (requires login)
5. **Auth Test**: https://www.coldcopy.cc/auth-test (debug page)

### API Health Checks
```bash
# Check general health
curl https://www.coldcopy.cc/api/health

# Check authentication status
curl https://www.coldcopy.cc/api/test-auth

# Check workspaces (requires authentication)
curl -H "Cookie: <auth-cookies>" https://www.coldcopy.cc/api/workspaces

# Check metrics
curl https://www.coldcopy.cc/api/metrics
```

### Dashboard Features to Test

#### 1. Campaigns
- View campaign list
- Click "New Campaign" button
- Check campaign creation form
- Verify demo campaigns are displayed

#### 2. Leads
- View leads table
- Check for import button
- Verify demo leads are displayed
- Test search/filter functionality

#### 3. Inbox
- Check message list
- Verify conversation view
- Test reply functionality

#### 4. Templates
- View template list
- Check demo templates
- Test template preview

#### 5. Analytics
- Verify charts load
- Check metrics display
- Test date range filters

#### 6. Settings
- Check all settings tabs
- Verify form fields
- Test save functionality

### Common Issues and Solutions

#### Login Spinner Stuck
**Issue**: Login page shows infinite loading spinner
**Solution**: Fixed in commit `9a8315d` - Supabase client initialization issue

#### API 500 Errors
**Issue**: `/api/workspaces` returns 500 error
**Solution**: Fixed in commit `9ccab61` - RPC response mapping issue

#### Email Verification Required
**Issue**: New signups require email verification
**Note**: This is expected behavior. Email sending is limited:
- Supabase: 3 emails/hour
- AWS SES: 200 emails/day (sandbox mode)

## Testing Best Practices

1. **Always test in incognito/private mode** to avoid cached sessions
2. **Check browser console** for JavaScript errors
3. **Monitor network tab** for failed API requests
4. **Take screenshots** when issues occur
5. **Test on multiple browsers** (Chrome, Firefox, Safari)
6. **Test responsive design** on mobile viewports

## Debugging Tips

### Check Authentication
```javascript
// Run in browser console
const response = await fetch('https://www.coldcopy.cc/api/test-auth');
const data = await response.json();
console.log(data);
```

### Check Supabase Connection
Visit https://www.coldcopy.cc/auth-test to see:
- Supabase initialization status
- Current session status
- Environment variable configuration

### View Request Headers
```bash
# See what headers are being sent
curl -v https://www.coldcopy.cc/api/health
```

## Test Data

The platform automatically seeds demo data for new workspaces:
- **Leads**: 5 sample companies/contacts
- **Templates**: 8 email templates
- **Campaigns**: 6 sample campaigns
- **Messages**: Welcome message from ColdCopy team

## Continuous Testing

For ongoing development:
1. Run tests before each deployment
2. Add new tests for new features
3. Update test credentials regularly
4. Monitor production error logs
5. Set up automated testing in CI/CD

## Support

If tests fail:
1. Check the latest deployment status on Vercel
2. Verify environment variables are set correctly
3. Check Supabase service status
4. Review recent commits for breaking changes

---

*Last Updated: January 4, 2025*