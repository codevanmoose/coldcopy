# ColdCopy Environment Variables Guide

## Overview
This document contains all environment variables needed to deploy ColdCopy. Copy the appropriate sections to your `.env` files and replace placeholder values with your actual credentials.

## Frontend Environment Variables (.env.local for Vercel)

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Application URLs
NEXT_PUBLIC_APP_URL=https://coldcopy.io
NEXT_PUBLIC_API_URL=https://api.coldcopy.io

# Stripe Payments
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_your-stripe-publishable-key
STRIPE_SECRET_KEY=sk_live_your-stripe-secret-key
STRIPE_WEBHOOK_SECRET=whsec_your-stripe-webhook-secret

# Authentication
NEXTAUTH_SECRET=generate-with-openssl-rand-base64-32
NEXTAUTH_URL=https://coldcopy.io

# Encryption Key (for storing API keys)
ENCRYPTION_KEY=generate-with-openssl-rand-base64-32
```

## Backend Environment Variables (.env for Digital Ocean)

```bash
# Database Configuration
DATABASE_URL=postgresql://postgres:your-password@db.your-project.supabase.co:5432/postgres
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Redis Cache
REDIS_URL=redis://default:your-redis-password@your-redis-host:6379

# Email Configuration (Amazon SES)
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AWS_REGION=us-east-1
SES_CONFIGURATION_SET=coldcopy-transactional
FROM_EMAIL=hello@coldcopy.io
REPLY_TO_EMAIL=support@coldcopy.io

# AI Services
OPENAI_API_KEY=sk-your-openai-api-key
ANTHROPIC_API_KEY=sk-ant-your-anthropic-api-key

# LinkedIn Integration
LINKEDIN_CLIENT_ID=your-linkedin-client-id
LINKEDIN_CLIENT_SECRET=your-linkedin-client-secret
LINKEDIN_REDIRECT_URI=https://api.coldcopy.io/api/linkedin/callback

# Twitter/X Integration
TWITTER_CONSUMER_KEY=your-twitter-consumer-key
TWITTER_CONSUMER_SECRET=your-twitter-consumer-secret
TWITTER_BEARER_TOKEN=your-twitter-bearer-token

# HubSpot Integration
HUBSPOT_APP_ID=your-hubspot-app-id
HUBSPOT_CLIENT_ID=your-hubspot-client-id
HUBSPOT_CLIENT_SECRET=your-hubspot-client-secret
HUBSPOT_REDIRECT_URI=https://api.coldcopy.io/api/hubspot/callback

# Salesforce Integration
SALESFORCE_CLIENT_ID=your-salesforce-client-id
SALESFORCE_CLIENT_SECRET=your-salesforce-client-secret
SALESFORCE_REDIRECT_URI=https://api.coldcopy.io/api/salesforce/callback
SALESFORCE_SANDBOX=false

# Lead Enrichment Services
HUNTER_API_KEY=your-hunter-api-key
CLEARBIT_API_KEY=sk_your-clearbit-api-key
APOLLO_API_KEY=your-apollo-api-key

# Calendar Integration
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-google-client-secret
GOOGLE_REDIRECT_URI=https://api.coldcopy.io/api/calendar/google/callback

# Security & Encryption
JWT_SECRET=generate-with-openssl-rand-base64-64
ENCRYPTION_KEY=same-key-as-frontend-encryption-key
WEBHOOK_SIGNING_SECRET=generate-with-openssl-rand-hex-32

# Monitoring & Analytics
SENTRY_DSN=https://your-sentry-id@o123456.ingest.sentry.io/1234567
PROMETHEUS_PUSH_GATEWAY=http://prometheus:9091
GRAFANA_ADMIN_PASSWORD=your-secure-admin-password

# Cron Job Authentication
CRON_SECRET=generate-with-openssl-rand-hex-16

# Application Settings
NODE_ENV=production
API_PORT=8000
CELERY_BROKER_URL=redis://default:your-redis-password@redis:6379/0
CELERY_RESULT_BACKEND=redis://default:your-redis-password@redis:6379/1

# Webhook Verification Tokens
SALESFORCE_WEBHOOK_VERIFY_TOKEN=your-salesforce-webhook-token
HUBSPOT_WEBHOOK_APP_SECRET=your-hubspot-webhook-secret
```

## GitHub Actions Secrets

Add these secrets to your GitHub repository settings:

```bash
# Digital Ocean
DO_ACCESS_TOKEN=dop_v1_your-digital-ocean-personal-access-token
DO_REGISTRY_TOKEN=your-digital-ocean-registry-token

# Supabase
SUPABASE_PROJECT_REF=your-project-ref
SUPABASE_DB_PASSWORD=your-database-password
SUPABASE_ACCESS_TOKEN=sbp_your-supabase-access-token

# Vercel
VERCEL_TOKEN=your-vercel-token
VERCEL_ORG_ID=team_your-vercel-org-id
VERCEL_PROJECT_ID=prj_your-vercel-project-id

# Cloudflare
CLOUDFLARE_API_TOKEN=your-cloudflare-api-token
CLOUDFLARE_ZONE_ID=your-cloudflare-zone-id

# Monitoring & Notifications
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX
SENTRY_AUTH_TOKEN=your-sentry-auth-token

# Docker Registry
DOCKER_USERNAME=your-docker-username
DOCKER_PASSWORD=your-docker-password
```

## How to Generate Secure Keys

```bash
# Generate NEXTAUTH_SECRET (32 bytes base64)
openssl rand -base64 32

# Generate ENCRYPTION_KEY (32 bytes base64)
openssl rand -base64 32

# Generate JWT_SECRET (64 bytes base64)
openssl rand -base64 64

# Generate WEBHOOK_SIGNING_SECRET (32 bytes hex)
openssl rand -hex 32

# Generate CRON_SECRET (16 bytes hex)
openssl rand -hex 16

# Generate any random string
openssl rand -hex 20
```

## Where to Get API Keys

### Supabase
1. Go to https://app.supabase.com
2. Select your project
3. Settings → API
4. Copy the URL, anon key, and service role key

### Stripe
1. Go to https://dashboard.stripe.com/apikeys
2. Copy publishable and secret keys
3. For webhook secret: Webhooks → Add endpoint → Copy signing secret

### OpenAI
1. Go to https://platform.openai.com/api-keys
2. Create new secret key
3. Copy immediately (won't be shown again)

### Anthropic
1. Go to https://console.anthropic.com/
2. Account Settings → API Keys
3. Create and copy key

### LinkedIn
1. Go to https://www.linkedin.com/developers/
2. Create app
3. Auth tab → Copy client ID and secret
4. Set OAuth 2.0 redirect URL

### Twitter/X
1. Go to https://developer.twitter.com/
2. Projects & Apps → Create app
3. Keys and tokens → Copy all required keys

### HubSpot
1. Go to https://developers.hubspot.com/
2. Create app
3. App info → Copy app ID, client ID, and secret

### Salesforce
1. Go to Setup → Apps → App Manager
2. New Connected App
3. Enable OAuth Settings
4. Copy consumer key and secret

### Google (Calendar)
1. Go to https://console.cloud.google.com/
2. Create project
3. Enable Calendar API
4. Create OAuth 2.0 credentials
5. Copy client ID and secret

### Amazon Web Services (SES)
1. Go to IAM → Users
2. Create user with SES permissions
3. Security credentials → Create access key
4. Copy access key ID and secret

### Digital Ocean
1. API → Generate New Token
2. Copy personal access token
3. Container Registry → Generate token

### Vercel
1. Account Settings → Tokens
2. Create token with appropriate scope
3. Copy token

### Cloudflare
1. My Profile → API Tokens
2. Create token with Zone:Read and Cache Purge permissions
3. Copy token

## Security Best Practices

1. **Never commit .env files** to version control
2. **Use different credentials** for development, staging, and production
3. **Rotate keys regularly** (every 90 days minimum)
4. **Limit permissions** to the minimum required for each service
5. **Use secret management tools** in production (e.g., HashiCorp Vault)
6. **Enable 2FA** on all service accounts
7. **Monitor key usage** for suspicious activity
8. **Document key rotation** procedures

## Environment File Templates

### .env.example (for repository)
```bash
# Copy to .env.local and fill in your values
# DO NOT commit actual .env files!

# Required
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
DATABASE_URL=

# See ENVIRONMENT_VARIABLES.md for complete list
```

### .env.development
```bash
# Development environment
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:8000
# Use test keys for Stripe, etc.
```

### .env.production
```bash
# Production environment
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://coldcopy.io
NEXT_PUBLIC_API_URL=https://api.coldcopy.io
# Use live keys for all services
```

## Validation Script

Create `validate-env.js` to check all required variables:

```javascript
const required = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'DATABASE_URL',
  // Add all required vars
];

const missing = required.filter(key => !process.env[key]);

if (missing.length > 0) {
  console.error('Missing required environment variables:');
  missing.forEach(key => console.error(`  - ${key}`));
  process.exit(1);
}

console.log('✅ All required environment variables are set');
```

## Next Steps

1. Copy the appropriate sections to your `.env` files
2. Replace all placeholder values with actual credentials
3. Run the validation script to ensure everything is set
4. Test connections in development before deploying
5. Use GitHub Secrets for CI/CD pipeline
6. Document any custom environment variables

Remember: Keep your production credentials secure and never share them publicly!