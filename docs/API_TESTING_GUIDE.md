# ColdCopy API Testing Guide

## Quick Start

Test your ColdCopy API in 30 seconds:

1. Navigate to `/test-api` in your browser
2. Click "Test All Endpoints"
3. Review the results

## Available Test Endpoints

### Core Services
- **Health Check** (`/api/health`) - Basic connectivity test
- **Authentication** (`/api/auth/me`) - Verify user authentication
- **Redis Cache** (`/api/test-redis`) - Test caching layer
- **AI Config** (`/api/test-ai-config`) - Verify AI providers

### Integration Tests
- **Email Service** (`/api/email/test`) - Test email sending
- **AI Generation** (`/api/test-ai-generation`) - Test GPT-4/Claude
- **Stripe** (`/api/test-stripe-config`) - Payment configuration
- **Supabase** (`/api/test-supabase-config`) - Database connectivity

## Using the Test Dashboard

The visual test dashboard at `/test-api` provides:
- One-click testing of all endpoints
- Real-time status indicators
- Detailed response viewing
- Request timing information

### Status Indicators
- 🔄 **Testing** - Request in progress
- ✅ **Success** - Endpoint working correctly
- ❌ **Error** - Endpoint failed (expand for details)

## Command Line Testing

### Basic Health Check
```bash
curl https://coldcopy.cc/api/health
```

### Test AI Generation
```bash
curl -X POST https://coldcopy.cc/api/test-ai-generation \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4",
    "prompt": "Write a test email"
  }'
```

### Test Redis Connection
```bash
curl https://coldcopy.cc/api/test-redis
```

## API Client Usage

```javascript
import { api } from '@/lib/api-client'

// Test authentication
const user = await api.auth.me()

// Test campaign creation
const campaign = await api.campaigns.create(workspaceId, {
  name: 'Test Campaign',
  subject: 'Test Subject'
})

// Test with error handling
try {
  const leads = await api.leads.list(workspaceId)
} catch (error) {
  console.error('API Error:', error.message)
}
```

## Debugging Tips

### Enable Debug Mode
```javascript
// In browser console
localStorage.setItem('DEBUG_API', 'true')
```

This enables:
- Detailed request/response logging
- Performance metrics
- Error stack traces

### Common Issues

**CORS Errors**
- Check API URL configuration
- Verify backend allows frontend origin

**401 Unauthorized**
- Ensure you're logged in
- Try refreshing your session

**Network Timeouts**
- Check internet connection
- Verify API server is running

## Testing Checklist

Before deployment:
- [ ] All endpoints return successful status
- [ ] Authentication is working
- [ ] External services are connected
- [ ] Error handling is implemented
- [ ] Response times are acceptable (<1s)

## Need Help?

1. Check browser console for errors
2. Use the Test API Dashboard
3. Enable debug mode for verbose logging
4. Review the full documentation at `/test-api/documentation`

---
*Last Updated: January 3, 2025*