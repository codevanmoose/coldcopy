# Vercel SSL/CORS Configuration Guide

## SSL Configuration

SSL is automatically configured by Vercel for all deployments:
- Production domains get auto-renewed Let's Encrypt certificates
- Preview deployments use Vercel's wildcard certificate
- Custom domains automatically get SSL certificates

## CORS Configuration

### 1. API Routes CORS
All API routes should include CORS headers for cross-origin requests:

```typescript
import { corsHeaders } from '@/lib/cors'

export async function GET(request: NextRequest) {
  const origin = request.headers.get('origin')
  const headers = corsHeaders(origin)
  
  return NextResponse.json({ data }, { headers })
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin')
  const headers = corsHeaders(origin)
  return new NextResponse(null, { status: 200, headers })
}
```

### 2. Allowed Origins
Update `/src/lib/cors.ts` to include all allowed origins:

```typescript
const allowedOrigins = [
  'https://coldcopy.cc',
  'https://www.coldcopy.cc',
  'https://api.coldcopy.cc',
  'http://localhost:3000',
  // Add white-label domains here
]
```

### 3. Vercel Configuration
Add to `vercel.json` for additional headers:

```json
{
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "Access-Control-Allow-Credentials", "value": "true" },
        { "key": "Access-Control-Allow-Origin", "value": "$CORS_ALLOW_ORIGIN" },
        { "key": "Access-Control-Allow-Methods", "value": "GET,OPTIONS,PATCH,DELETE,POST,PUT" },
        { "key": "Access-Control-Allow-Headers", "value": "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, X-Workspace-Id" }
      ]
    }
  ]
}
```

### 4. Environment Variables
Set these in Vercel dashboard:
- `CORS_ALLOW_ORIGIN`: Primary allowed origin (https://coldcopy.cc)
- `API_URL`: Backend API URL (https://api.coldcopy.cc)

### 5. Testing CORS
```bash
# Test preflight request
curl -X OPTIONS https://coldcopy.cc/api/health \
  -H "Origin: https://app.coldcopy.cc" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: Authorization" \
  -v

# Test actual request
curl https://coldcopy.cc/api/health \
  -H "Origin: https://app.coldcopy.cc" \
  -v
```

## Security Headers
The middleware already includes security headers:
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- X-XSS-Protection: 1; mode=block
- Referrer-Policy: strict-origin-when-cross-origin
- Content-Security-Policy: [configured]
- Strict-Transport-Security: max-age=31536000 (production only)

## White-Label Domain SSL
For white-label domains:
1. Customer adds CNAME record pointing to `cname.vercel-dns.com`
2. Vercel automatically provisions SSL certificate
3. Domain is validated via middleware
4. SSL works automatically

## Troubleshooting

### CORS Issues
1. Check browser console for specific CORS errors
2. Verify origin is in allowedOrigins list
3. Ensure OPTIONS method is implemented for all endpoints
4. Check if credentials are being sent correctly

### SSL Issues
1. Verify DNS records are correct
2. Check certificate status in Vercel dashboard
3. Ensure no mixed content (HTTP resources on HTTPS page)
4. Use SSL checker tools to verify certificate chain

### API Connection Issues
1. Verify API_URL environment variable is set correctly
2. Check if API server has proper CORS configuration
3. Ensure authentication tokens are being sent
4. Test with curl to isolate browser issues