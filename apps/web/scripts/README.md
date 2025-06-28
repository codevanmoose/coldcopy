# ColdCopy Deployment Scripts

This directory contains scripts for verifying and managing ColdCopy deployments.

## verify-deployment.ts

A comprehensive deployment verification script that tests all critical endpoints and services after deployment to production.

### Usage

```bash
# Run with default production URLs
npm run verify:deployment

# Run with custom URLs
FRONTEND_URL=https://custom.vercel.app API_URL=https://api.custom.com npm run verify:deployment

# Run with Supabase credentials (for full testing)
NEXT_PUBLIC_SUPABASE_URL=your-url NEXT_PUBLIC_SUPABASE_ANON_KEY=your-key npm run verify:deployment
```

### What It Tests

1. **Frontend Health Check**
   - Verifies the frontend is serving HTML content
   - Checks response status and content

2. **API Health Check**
   - Tests the `/health` endpoint
   - Verifies API is accessible

3. **Supabase Connection**
   - Tests connection to Supabase
   - Checks authentication service availability

4. **Authentication Endpoints**
   - `/api/auth/session` - Session check
   - `/api/auth/csrf` - CSRF token

5. **Static Assets**
   - `/favicon.ico`
   - `/manifest.json`
   - `/_next/static/css/` - CSS bundles

6. **CORS Configuration**
   - Verifies CORS headers are properly set
   - Tests OPTIONS requests

7. **Environment Variables**
   - Checks if runtime config is exposed
   - Verifies Next.js configuration

8. **Database Connectivity**
   - Tests actual database queries
   - Verifies RLS policies are active

### Output

The script provides:
- Real-time test progress with timing
- Color-coded pass/fail indicators
- Detailed error messages for failures
- Summary statistics
- Exit code 1 on any failure (for CI/CD)

### Common Issues and Solutions

#### Frontend Returns 404
- Ensure the deployment URL is correct
- Check if the deployment is complete in Vercel
- Verify the domain is properly configured

#### API Health Check Fails
- Check if the API backend is deployed
- Verify the API URL is correct
- Ensure Digital Ocean app is running

#### Supabase Connection Fails
- Verify environment variables are set
- Check Supabase project is active
- Ensure anon key is valid

#### CORS Headers Missing
- Check `vercel.json` configuration
- Verify API CORS middleware is active
- Test with correct Origin header

#### Database Connection Fails
- Ensure Supabase project is not paused
- Check network connectivity
- Verify database credentials

### Integration with CI/CD

This script can be used in GitHub Actions:

```yaml
- name: Verify Deployment
  run: |
    cd apps/web
    npm ci
    npm run verify:deployment
  env:
    FRONTEND_URL: ${{ secrets.FRONTEND_URL }}
    API_URL: ${{ secrets.API_URL }}
    NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
    NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
```

### Extending the Script

To add new tests:

1. Create a new test function:
```typescript
async function testNewFeature(): Promise<{ passed: boolean; message: string }> {
  // Test implementation
}
```

2. Add it to the main function:
```typescript
await runTest('New Feature Test', testNewFeature);
```

### Dependencies

- `chalk` - Terminal output styling
- `@supabase/supabase-js` - Supabase client
- `tsx` - TypeScript execution

### Environment Variables

- `FRONTEND_URL` - Frontend deployment URL (default: https://coldcopy-moose.vercel.app)
- `API_URL` - API backend URL (default: https://api.coldcopy.cc)
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key