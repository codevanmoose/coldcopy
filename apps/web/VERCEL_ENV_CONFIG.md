# Vercel Environment Variables Configuration Guide

## Overview
This guide walks through setting up all required environment variables in the Vercel dashboard for ColdCopy production deployment.

## Access Vercel Dashboard
1. Go to [https://vercel.com/dashboard](https://vercel.com/dashboard)
2. Select your ColdCopy project
3. Navigate to Settings → Environment Variables

## Environment Variables Setup

### 1. Supabase Configuration
These are required for database access and authentication.

```
NEXT_PUBLIC_SUPABASE_URL = https://zicipvpablahehxstbfr.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = [Get from Supabase dashboard → Settings → API]
SUPABASE_SERVICE_ROLE_KEY = [Get from Supabase dashboard → Settings → API - KEEP SECRET]
```

### 2. Authentication Secrets
Generate secure random strings for these:

```
NEXTAUTH_SECRET = [Generate with: openssl rand -base64 32]
NEXTAUTH_URL = https://coldcopy.cc
JWT_SECRET = [Generate with: openssl rand -base64 32]
ENCRYPTION_KEY = [Generate with: openssl rand -hex 32]
```

### 3. API URL Configuration
```
NEXT_PUBLIC_API_URL = https://api.coldcopy.cc
NEXT_PUBLIC_APP_URL = https://coldcopy.cc
```

### 4. Email Service (Amazon SES)
```
AWS_ACCESS_KEY_ID = [From AWS IAM Console]
AWS_SECRET_ACCESS_KEY = [From AWS IAM Console]
AWS_REGION = us-east-1
SES_CONFIGURATION_SET = coldcopy-transactional
SES_FROM_EMAIL = noreply@coldcopy.cc
```

### 5. AI Services
```
OPENAI_API_KEY = [From OpenAI Platform]
ANTHROPIC_API_KEY = [From Anthropic Console]
```

### 6. Payment Processing (Stripe)
```
STRIPE_SECRET_KEY = sk_live_[Your Stripe Secret Key]
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = pk_live_[Your Stripe Publishable Key]
STRIPE_WEBHOOK_SECRET = whsec_[From Stripe Webhook Dashboard]
```

### 7. Lead Enrichment Providers
```
HUNTER_API_KEY = [From Hunter.io Dashboard]
CLEARBIT_API_KEY = [From Clearbit Dashboard]
APOLLO_API_KEY = [From Apollo.io Dashboard]
```

### 8. Social Media APIs
```
LINKEDIN_CLIENT_ID = [From LinkedIn Developer Apps]
LINKEDIN_CLIENT_SECRET = [From LinkedIn Developer Apps]
LINKEDIN_REDIRECT_URI = https://coldcopy.cc/api/auth/linkedin/callback

TWITTER_API_KEY = [From Twitter Developer Portal]
TWITTER_API_SECRET = [From Twitter Developer Portal]
TWITTER_ACCESS_TOKEN = [From Twitter Developer Portal]
TWITTER_ACCESS_SECRET = [From Twitter Developer Portal]
```

### 9. Redis Cache
```
REDIS_URL = redis://default:[password]@[host]:[port]
```

### 10. File Storage (Digital Ocean Spaces)
```
DO_SPACES_KEY = [From Digital Ocean API]
DO_SPACES_SECRET = [From Digital Ocean API]
DO_SPACES_ENDPOINT = https://nyc3.digitaloceanspaces.com
DO_SPACES_REGION = nyc3
DO_SPACES_BUCKET = coldcopy-uploads
```

### 11. OAuth Providers
```
GOOGLE_CLIENT_ID = [From Google Cloud Console]
GOOGLE_CLIENT_SECRET = [From Google Cloud Console]

MICROSOFT_CLIENT_ID = [From Azure App Registration]
MICROSOFT_CLIENT_SECRET = [From Azure App Registration]
MICROSOFT_TENANT_ID = [From Azure App Registration]
```

### 12. Webhook Secrets
```
WEBHOOK_SECRET = [Generate with: openssl rand -base64 32]
SES_WEBHOOK_SECRET = [Generate with: openssl rand -base64 32]
STRIPE_WEBHOOK_SECRET = whsec_[From Stripe Dashboard]
```

### 13. Monitoring & Analytics
```
SENTRY_DSN = [From Sentry Project Settings]
SENTRY_AUTH_TOKEN = [From Sentry Settings]
NEXT_PUBLIC_POSTHOG_KEY = [From PostHog Project Settings]
NEXT_PUBLIC_POSTHOG_HOST = https://app.posthog.com
```

### 14. Salesforce Integration (Optional)
```
SALESFORCE_CLIENT_ID = [From Salesforce Connected App]
SALESFORCE_CLIENT_SECRET = [From Salesforce Connected App]
SALESFORCE_REDIRECT_URI = https://coldcopy.cc/api/integrations/salesforce/callback
```

### 15. HubSpot Integration (Optional)
```
HUBSPOT_CLIENT_ID = [From HubSpot App]
HUBSPOT_CLIENT_SECRET = [From HubSpot App]
HUBSPOT_REDIRECT_URI = https://coldcopy.cc/api/integrations/hubspot/callback
```

### 16. Email Tracking
```
TRACKING_PIXEL_URL = https://track.coldcopy.cc/pixel
TRACKING_DOMAIN = track.coldcopy.cc
```

### 17. Cron Jobs
```
CRON_SECRET = [Generate with: openssl rand -base64 32]
```

### 18. Feature Flags
```
ENABLE_LINKEDIN_INTEGRATION = true
ENABLE_TWITTER_INTEGRATION = true
ENABLE_SALES_INTELLIGENCE = true
ENABLE_AI_MEETING_SCHEDULER = true
```

## Setting Environment Variables in Vercel

### Step-by-Step Process

1. **Access Environment Variables**
   - Go to your project in Vercel Dashboard
   - Click on "Settings" tab
   - Click on "Environment Variables" in the left sidebar

2. **Add Each Variable**
   - Click "Add New"
   - Enter the Key (e.g., `NEXT_PUBLIC_SUPABASE_URL`)
   - Enter the Value
   - Select environments: ✓ Production, ✓ Preview, ✓ Development
   - Click "Save"

3. **Sensitive Variables**
   For these variables, only enable for Production:
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `STRIPE_SECRET_KEY`
   - `AWS_SECRET_ACCESS_KEY`
   - All `*_SECRET` and `*_PRIVATE_KEY` variables

4. **Public Variables**
   Variables starting with `NEXT_PUBLIC_` are exposed to the browser.
   Double-check these contain no sensitive data.

## Verification Steps

### 1. Test Build
After adding all variables, trigger a new deployment:
```bash
vercel --prod
```

### 2. Check Function Logs
Monitor the Functions tab in Vercel dashboard for any errors.

### 3. Test Critical Features
- [ ] Authentication (login/signup)
- [ ] Database connection
- [ ] Email sending
- [ ] Payment processing
- [ ] AI features
- [ ] Lead enrichment

### 4. Monitor Cron Jobs
Check that cron jobs are executing:
- Go to Functions → Cron tab
- Verify all 7 cron jobs are listed
- Check execution logs

## Security Best Practices

1. **Rotate Secrets Regularly**
   - Set calendar reminders to rotate secrets every 90 days
   - Use Vercel's environment variable history for rollback

2. **Limit Access**
   - Only give team members necessary access levels
   - Use Vercel's team roles appropriately

3. **Audit Trail**
   - Vercel logs all environment variable changes
   - Review logs regularly for unauthorized changes

4. **Backup Secrets**
   - Store a secure backup of all secrets
   - Use a password manager or secrets management tool
   - Never commit secrets to Git

## Troubleshooting

### Common Issues

1. **Build Failures**
   - Check that all required `NEXT_PUBLIC_*` variables are set
   - Verify no typos in variable names
   - Ensure values don't contain invalid characters

2. **Runtime Errors**
   - Check Function logs for missing variables
   - Verify database connection strings are correct
   - Ensure API keys have necessary permissions

3. **Cron Job Failures**
   - Verify `CRON_SECRET` is set correctly
   - Check that cron endpoints return 200 status
   - Monitor Function logs for errors

### Debug Commands
```bash
# List all environment variables (without values)
vercel env ls

# Pull environment variables to local .env
vercel env pull .env.local

# Add a new variable via CLI
vercel env add VARIABLE_NAME production
```

## Next Steps

After configuring all environment variables:

1. Deploy to production: `vercel --prod`
2. Run post-deployment verification tests
3. Configure custom domain DNS
4. Set up monitoring alerts
5. Test all integrations

## Support

If you encounter issues:
1. Check Vercel documentation: https://vercel.com/docs/environment-variables
2. Review Function logs in Vercel dashboard
3. Contact support with deployment ID and error messages