# Vercel Environment Variables Setup Guide

## 🚀 Quick Setup - Copy & Paste These Variables

Add these environment variables to your Vercel project to reach 100% functionality.

### 1. ✅ Essential Variables (Required for Basic Operation)

```bash
# Supabase Configuration - ALREADY HAVE THESE
NEXT_PUBLIC_SUPABASE_URL=https://zicipvpablahehxstbfr.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InppY2lwdnBhYmxhaGVoeHN0YmZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEwMDY3NTEsImV4cCI6MjA2NjU4Mjc1MX0.4i08GOhX0UPWjv4YdLRBXXEi2WMYiFgAica8LM9fRB8
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InppY2lwdnBhYmxhaGVoeHN0YmZyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTAwNjc1MSwiZXhwIjoyMDY2NTgyNzUxfQ.FuHhzGlvQaA4HXPhKvR1UZIn3UPr4EgtydupNTdJjow

# Application URLs
NEXT_PUBLIC_APP_URL=https://coldcopy.cc
NEXT_PUBLIC_API_URL=https://coldcopy.cc/api

# Authentication Secrets
JWT_SECRET=3j+z/BpaIF+usn0sdU9uy/0eWKCp8kmSXLs2VLSIv90=
NEXTAUTH_SECRET=3j+z/BpaIF+usn0sdU9uy/0eWKCp8kmSXLs2VLSIv90=
NEXTAUTH_URL=https://coldcopy.cc

# Security Keys (Generate new ones for production)
ENCRYPTION_KEY=generate-32-character-string-here
WEBHOOK_SECRET=generate-random-webhook-secret-here
```

### 2. 🤖 AI API Keys (Required for Email Generation)

```bash
# OpenAI - Get from https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-...your-openai-key-here...

# Anthropic Claude - Get from https://console.anthropic.com/
ANTHROPIC_API_KEY=sk-ant-...your-anthropic-key-here...

# Default AI Settings
AI_PROVIDER=openai
AI_MODEL=gpt-4-turbo-preview
```

### 3. 📧 Email Configuration (AWS SES)

```bash
# AWS SES Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
SES_CONFIGURATION_SET=coldcopy-events
SES_FROM_EMAIL=noreply@coldcopy.cc
SES_WEBHOOK_SECRET=generate-ses-webhook-secret

# Email Settings
EMAIL_FROM_NAME=ColdCopy
EMAIL_FROM_ADDRESS=hello@coldcopy.cc
EMAIL_REPLY_TO=support@coldcopy.cc
```

### 4. 💳 Stripe Payment Processing

```bash
# Stripe - Get from https://dashboard.stripe.com/apikeys
STRIPE_SECRET_KEY=sk_live_...your-stripe-secret-key...
STRIPE_WEBHOOK_SECRET=whsec_...your-webhook-secret...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...your-publishable-key...
```

### 5. 🔄 CRM Integrations (Optional)

```bash
# HubSpot - Get from https://app.hubspot.com/settings/integrations/private-apps
HUBSPOT_CLIENT_ID=your-hubspot-client-id
HUBSPOT_CLIENT_SECRET=your-hubspot-client-secret
HUBSPOT_APP_ID=your-hubspot-app-id
HUBSPOT_REDIRECT_URI=https://coldcopy.cc/api/integrations/hubspot/callback

# Salesforce - Get from Setup > Apps > App Manager
SALESFORCE_CLIENT_ID=your-salesforce-client-id
SALESFORCE_CLIENT_SECRET=your-salesforce-client-secret
SALESFORCE_REDIRECT_URI=https://coldcopy.cc/api/integrations/salesforce/callback
```

### 6. 📱 Social Media APIs (Optional)

```bash
# LinkedIn - Get from https://www.linkedin.com/developers/
LINKEDIN_CLIENT_ID=your-linkedin-client-id
LINKEDIN_CLIENT_SECRET=your-linkedin-client-secret
LINKEDIN_REDIRECT_URI=https://coldcopy.cc/api/integrations/linkedin/callback

# Twitter/X - Get from https://developer.twitter.com/
TWITTER_CLIENT_ID=your-twitter-client-id
TWITTER_CLIENT_SECRET=your-twitter-client-secret
TWITTER_BEARER_TOKEN=your-twitter-bearer-token
```

### 7. 🔍 Lead Enrichment APIs (Optional)

```bash
# Hunter.io - Get from https://hunter.io/api
HUNTER_API_KEY=your-hunter-api-key

# Clearbit - Get from https://dashboard.clearbit.com/
CLEARBIT_API_KEY=your-clearbit-api-key

# Apollo.io - Get from https://app.apollo.io/
APOLLO_API_KEY=your-apollo-api-key
```

### 8. 📊 Analytics & Monitoring (Recommended)

```bash
# Google Analytics
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX

# Sentry Error Tracking - Get from https://sentry.io/
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
SENTRY_ORG=coldcopy
SENTRY_PROJECT=coldcopy-web
SENTRY_AUTH_TOKEN=your-sentry-auth-token

# PostHog Analytics (Optional)
NEXT_PUBLIC_POSTHOG_KEY=your-posthog-key
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
```

### 9. 🚀 Feature Flags & Settings

```bash
# Feature Toggles
ENABLE_AI_FEATURES=true
ENABLE_MULTI_CHANNEL=true
ENABLE_WORKFLOW_AUTOMATION=true
ENABLE_LEAD_SCORING=true
ENABLE_WHITE_LABEL=true

# Rate Limiting
RATE_LIMIT_AI_REQUESTS=100
RATE_LIMIT_API_REQUESTS=1000
RATE_LIMIT_WINDOW=3600

# Environment
VERCEL_ENV=production
NODE_ENV=production
```

### 10. 🗄️ Redis Cache (Optional but Recommended)

```bash
# Redis Configuration - Use Upstash Redis or Vercel KV
REDIS_URL=redis://your-redis-host:6379
REDIS_PASSWORD=your-redis-password
```

## 📝 Step-by-Step Setup Instructions

1. **Login to Vercel Dashboard**
   - Go to: https://vercel.com/vanmooseprojects/coldcopy/settings/environment-variables

2. **Add Variables by Priority**:
   - Start with Section 1 (Essential Variables) - Platform won't work without these
   - Add Section 2 (AI API Keys) - Required for email generation features
   - Add Section 3 (Email Configuration) - Required for sending emails
   - Add remaining sections based on features you want to enable

3. **For Each Variable**:
   - Click "Add New"
   - Enter the Key (e.g., `OPENAI_API_KEY`)
   - Enter the Value (your actual API key)
   - Select "Production" environment
   - Click "Save"

4. **Trigger Redeployment**:
   - After adding all variables, go to Deployments tab
   - Click "..." on the latest deployment
   - Select "Redeploy"

## 🔐 Security Notes

1. **Generate New Secrets**: For production, generate new values for:
   - `JWT_SECRET` - Use: `openssl rand -base64 32`
   - `NEXTAUTH_SECRET` - Use: `openssl rand -base64 32`
   - `ENCRYPTION_KEY` - Must be exactly 32 characters
   - `WEBHOOK_SECRET` - Use: `openssl rand -hex 32`

2. **Never Commit Secrets**: These values should ONLY be in Vercel, never in code

3. **API Key Security**: 
   - Use environment-specific keys (dev/staging/prod)
   - Rotate keys regularly
   - Monitor usage for anomalies

## ✅ Verification Steps

After adding environment variables and redeploying:

1. Visit https://coldcopy.cc
2. Try to login with admin credentials
3. Check that AI email generation works
4. Verify email sending functionality
5. Test any enabled integrations

## 🆘 Troubleshooting

If something isn't working after adding variables:

1. **Check Vercel Function Logs**: 
   - Go to Functions tab in Vercel dashboard
   - Look for any errors mentioning missing environment variables

2. **Verify Variable Names**: 
   - Ensure no typos in variable names
   - Check that all required variables are present

3. **Redeploy**: 
   - Sometimes a fresh deployment is needed
   - Use "Redeploy" option with "Use existing Build Cache" unchecked

## 📊 Priority Order for 100% Functionality

1. **Must Have (95% → 97%)**:
   - All Section 1 variables ✅
   - OpenAI or Anthropic API key (Section 2)
   - Basic AWS SES config (Section 3)

2. **Should Have (97% → 99%)**:
   - Stripe keys for payments (Section 4)
   - Google Analytics (Section 8)
   - Redis cache (Section 10)

3. **Nice to Have (99% → 100%)**:
   - CRM integrations (Section 5)
   - Social media APIs (Section 6)
   - Lead enrichment (Section 7)
   - Advanced monitoring (Sentry, PostHog)

---

**Quick Win**: Just adding the AI API keys (OpenAI/Anthropic) will unlock most of the platform's core functionality and get you to ~98% ready!