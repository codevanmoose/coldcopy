# ColdCopy API Testing Documentation

## Overview

ColdCopy includes a comprehensive API testing infrastructure that allows developers and administrators to verify API connectivity, test integrations, and debug issues. This documentation covers all available testing features and how to use them effectively.

## Table of Contents

1. [Test API Dashboard](#test-api-dashboard)
2. [API Client Library](#api-client-library)
3. [Test Endpoints](#test-endpoints)
4. [Integration Testing](#integration-testing)
5. [Debugging Guide](#debugging-guide)
6. [Best Practices](#best-practices)

## Test API Dashboard

### Accessing the Dashboard

Navigate to `/test-api` in the ColdCopy application or click "Test API" in the sidebar navigation.

### Dashboard Features

The Test API Dashboard provides a visual interface for testing API connectivity:

#### Connection Information
- **API URL**: Displays the backend API endpoint
- **Frontend URL**: Shows the current frontend URL
- **Workspace ID**: Current workspace identifier
- **Authentication Status**: Indicates if user is authenticated

#### Available Tests

1. **Health Check** (`/api/health`)
   - Verifies basic API connectivity
   - Returns server status and timestamp

2. **Auth Status** (`/api/auth/me`)
   - Confirms authentication is working
   - Returns user information and permissions

3. **List Workspaces** (`/api/workspaces`)
   - Tests workspace API functionality
   - Returns all accessible workspaces

4. **Current Workspace** (`/api/workspaces/{id}`)
   - Verifies specific workspace access
   - Returns detailed workspace information

### Using the Dashboard

1. Click "Test All Endpoints" to run all tests sequentially
2. Each test shows status indicators:
   - 🔄 **Testing**: Request in progress
   - ✅ **Success**: Endpoint working correctly
   - ❌ **Error**: Endpoint failed (check response for details)
3. Click on any test result to expand and view the full response

## API Client Library

### Location
`/apps/web/src/lib/api-client.ts`

### Key Features

1. **Automatic Authentication**
   ```typescript
   // Authentication token automatically injected
   const response = await api.campaigns.list()
   ```

2. **Request Logging**
   ```typescript
   // All requests are logged with timing information
   // Check browser console for:
   // - Request URL and method
   // - Response time
   // - Status codes
   ```

3. **Error Handling**
   ```typescript
   try {
     const data = await api.leads.create(leadData)
   } catch (error) {
     // Detailed error information available
     console.error('API Error:', error.message)
   }
   ```

### Available API Methods

#### Authentication
- `api.auth.login(email, password)`
- `api.auth.logout()`
- `api.auth.me()`
- `api.auth.resetPassword(email)`

#### Workspaces
- `api.workspaces.list()`
- `api.workspaces.get(id)`
- `api.workspaces.create(data)`
- `api.workspaces.update(id, data)`
- `api.workspaces.delete(id)`

#### Campaigns
- `api.campaigns.list(workspaceId)`
- `api.campaigns.get(workspaceId, campaignId)`
- `api.campaigns.create(workspaceId, data)`
- `api.campaigns.update(workspaceId, campaignId, data)`
- `api.campaigns.delete(workspaceId, campaignId)`
- `api.campaigns.start(workspaceId, campaignId)`
- `api.campaigns.pause(workspaceId, campaignId)`

#### Leads
- `api.leads.list(workspaceId, params)`
- `api.leads.get(workspaceId, leadId)`
- `api.leads.create(workspaceId, data)`
- `api.leads.update(workspaceId, leadId, data)`
- `api.leads.delete(workspaceId, leadId)`
- `api.leads.import(workspaceId, file)`
- `api.leads.export(workspaceId, params)`
- `api.leads.enrich(workspaceId, leadId)`

#### Email
- `api.email.send(workspaceId, data)`
- `api.email.generateWithAI(workspaceId, data)`
- `api.email.trackOpen(emailId)`
- `api.email.trackClick(emailId, linkId)`

#### Analytics
- `api.analytics.overview(workspaceId, period)`
- `api.analytics.campaigns(workspaceId, campaignId)`
- `api.analytics.emails(workspaceId, params)`

## Test Endpoints

### Core Service Tests

#### AI Configuration Test
**Endpoint**: `/api/test-ai-config`
```bash
curl https://coldcopy.cc/api/test-ai-config
```
**Tests**:
- OpenAI API key configuration
- Anthropic API key configuration
- Returns configuration status for both providers

#### Redis Connection Test
**Endpoint**: `/api/test-redis`
```bash
curl https://coldcopy.cc/api/test-redis
```
**Tests**:
- Redis connectivity
- Basic set/get operations
- Connection latency

#### Stripe Configuration Test
**Endpoint**: `/api/test-stripe-config`
```bash
curl https://coldcopy.cc/api/test-stripe-config
```
**Tests**:
- Stripe API key validity
- Webhook endpoint configuration
- Product and price configuration

#### Supabase Configuration Test
**Endpoint**: `/api/test-supabase-config`
```bash
curl https://coldcopy.cc/api/test-supabase-config
```
**Tests**:
- Database connectivity
- Authentication service
- Realtime subscriptions

### Integration Tests

#### Email Service Test
**Endpoint**: `/api/email/test`
```bash
curl -X POST https://coldcopy.cc/api/email/test \
  -H "Content-Type: application/json" \
  -d '{"to": "test@example.com", "type": "test"}'
```

#### AI Generation Test
**Endpoint**: `/api/test-ai-generation`
```bash
curl -X POST https://coldcopy.cc/api/test-ai-generation \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Write a test email",
    "model": "gpt-4"
  }'
```

## Integration Testing

### HubSpot Integration
```typescript
// Test connection
const status = await api.integrations.hubspot.testConnection()

// Test sync
const result = await api.integrations.hubspot.testSync(workspaceId)
```

### Slack Integration
```typescript
// Test webhook
const result = await api.integrations.slack.testWebhook(webhookUrl)

// Test posting
const message = await api.integrations.slack.testPost(channel, text)
```

### Gmail Integration
```typescript
// Test OAuth
const auth = await api.integrations.gmail.testAuth()

// Test sending
const result = await api.integrations.gmail.testSend(to, subject)
```

## Debugging Guide

### Common Issues and Solutions

#### 1. CORS Errors
**Symptom**: "Access-Control-Allow-Origin" errors in console

**Solution**:
```javascript
// Check API URL configuration
console.log('API URL:', process.env.NEXT_PUBLIC_API_URL)

// Ensure backend allows frontend origin
// Backend should include:
// Access-Control-Allow-Origin: https://coldcopy.cc
```

#### 2. Authentication Failures
**Symptom**: 401 Unauthorized errors

**Solution**:
```javascript
// Check auth token
const supabase = createClient()
const { data: { session } } = await supabase.auth.getSession()
console.log('Auth token:', session?.access_token)

// Refresh session if needed
await supabase.auth.refreshSession()
```

#### 3. Network Timeouts
**Symptom**: Requests taking too long or timing out

**Solution**:
```javascript
// Add timeout to API calls
const controller = new AbortController()
const timeoutId = setTimeout(() => controller.abort(), 5000)

try {
  const response = await fetch(url, {
    signal: controller.signal
  })
} finally {
  clearTimeout(timeoutId)
}
```

### Debug Mode

Enable debug mode for verbose logging:

```javascript
// In browser console
localStorage.setItem('DEBUG_API', 'true')

// This enables:
// - Detailed request/response logging
// - Performance metrics
// - Error stack traces
```

### Using Browser DevTools

1. **Network Tab**:
   - Monitor all API requests
   - Check request/response headers
   - Verify payload data
   - Analyze response times

2. **Console**:
   - View API client logs
   - Check for JavaScript errors
   - Monitor debug output

3. **Application Tab**:
   - Inspect localStorage
   - Check authentication tokens
   - Verify environment variables

## Best Practices

### 1. Test in Sequence
```javascript
// Good: Test dependencies first
await testAuth()
await testWorkspace()
await testCampaignCreation()

// Bad: Testing without checking prerequisites
await testCampaignCreation() // May fail if auth isn't working
```

### 2. Handle Errors Gracefully
```javascript
// Good: Comprehensive error handling
try {
  const result = await api.campaigns.create(workspaceId, data)
  console.log('Success:', result)
} catch (error) {
  console.error('Error creating campaign:', {
    message: error.message,
    status: error.status,
    data: error.data
  })
  
  // Provide user feedback
  toast.error(`Failed to create campaign: ${error.message}`)
}
```

### 3. Use Environment-Specific Testing
```javascript
// Development
if (process.env.NODE_ENV === 'development') {
  // Enable verbose logging
  api.enableDebugMode()
  
  // Use test data
  const testLead = generateTestLead()
}

// Production
if (process.env.NODE_ENV === 'production') {
  // Disable debug logs
  api.disableDebugMode()
  
  // Use real data with caution
}
```

### 4. Monitor Performance
```javascript
// Track API response times
const startTime = Date.now()
const response = await api.leads.list(workspaceId)
const duration = Date.now() - startTime

if (duration > 1000) {
  console.warn(`Slow API response: ${duration}ms`)
}
```

### 5. Test Rate Limits
```javascript
// Test rate limit handling
async function testRateLimits() {
  const requests = []
  
  // Send multiple requests
  for (let i = 0; i < 10; i++) {
    requests.push(api.leads.list(workspaceId))
  }
  
  try {
    await Promise.all(requests)
  } catch (error) {
    if (error.status === 429) {
      console.log('Rate limit hit - backoff implemented correctly')
    }
  }
}
```

## API Response Examples

### Successful Response
```json
{
  "success": true,
  "data": {
    "id": "123",
    "name": "Test Campaign",
    "status": "active"
  },
  "meta": {
    "timestamp": "2024-01-03T10:00:00Z",
    "duration": 145
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid email format",
    "details": {
      "field": "email",
      "value": "invalid-email"
    }
  }
}
```

### Paginated Response
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "perPage": 20,
    "total": 145,
    "totalPages": 8
  }
}
```

## Troubleshooting Checklist

- [ ] Verify environment variables are set correctly
- [ ] Check network connectivity
- [ ] Confirm authentication is working
- [ ] Validate API endpoint URLs
- [ ] Test with minimal payload first
- [ ] Check browser console for errors
- [ ] Verify CORS configuration
- [ ] Confirm API rate limits aren't exceeded
- [ ] Test with different user roles/permissions
- [ ] Check service health status

## Support

For additional help with API testing:

1. Check the browser console for detailed error messages
2. Use the Test API Dashboard for quick diagnostics
3. Enable debug mode for verbose logging
4. Review server logs for backend issues
5. Contact support with specific error messages and test results

---

*Last Updated: January 3, 2025*