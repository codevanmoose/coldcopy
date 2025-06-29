#!/bin/bash

# ColdCopy Essential Environment Variables Generator
# This script generates the minimum required environment variables to get the app running

echo "=== ColdCopy Environment Variables Generator ==="
echo "This will generate the essential environment variables needed for deployment"
echo ""

# Create output file
OUTPUT_FILE="vercel-env-essential.txt"

# Function to generate random secrets
generate_secret() {
    openssl rand -base64 32 | tr -d '\n'
}

generate_hex_secret() {
    openssl rand -hex 32 | tr -d '\n'
}

# Generate the essential variables
cat > "$OUTPUT_FILE" << EOF
# ===================================
# ESSENTIAL ENVIRONMENT VARIABLES
# Copy these to Vercel Dashboard
# ===================================

# 1. SUPABASE (REQUIRED - Get from Supabase Dashboard)
NEXT_PUBLIC_SUPABASE_URL=https://zicipvpablahehxstbfr.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[GET_FROM_SUPABASE_DASHBOARD_SETTINGS_API]
SUPABASE_SERVICE_ROLE_KEY=[GET_FROM_SUPABASE_DASHBOARD_SETTINGS_API_SERVICE_ROLE]

# 2. AUTHENTICATION SECRETS (REQUIRED)
NEXTAUTH_SECRET=$(generate_secret)
NEXTAUTH_URL=https://coldcopy.vercel.app
JWT_SECRET=$(generate_secret)
ENCRYPTION_KEY=$(generate_hex_secret)

# 3. APPLICATION URLs (REQUIRED)
NEXT_PUBLIC_API_URL=https://coldcopy.vercel.app/api
NEXT_PUBLIC_APP_URL=https://coldcopy.vercel.app

# 4. WEBHOOK & CRON SECRETS (REQUIRED)
WEBHOOK_SECRET=$(generate_secret)
CRON_SECRET=$(generate_secret)

# 5. FEATURE FLAGS (REQUIRED)
ENABLE_LINKEDIN_INTEGRATION=false
ENABLE_TWITTER_INTEGRATION=false
ENABLE_SALES_INTELLIGENCE=true
ENABLE_AI_MEETING_SCHEDULER=true

# ===================================
# PLACEHOLDER VALUES FOR BUILD
# These allow the app to build but features won't work without real keys
# ===================================

# Email (Replace with real AWS SES credentials)
AWS_ACCESS_KEY_ID=PLACEHOLDER_ACCESS_KEY
AWS_SECRET_ACCESS_KEY=PLACEHOLDER_SECRET_KEY
AWS_REGION=us-east-1
SES_CONFIGURATION_SET=coldcopy-transactional
SES_FROM_EMAIL=noreply@coldcopy.vercel.app

# AI Services (Replace with real API keys)
OPENAI_API_KEY=sk-placeholder-key
ANTHROPIC_API_KEY=sk-ant-placeholder-key

# Payment (Replace with real Stripe keys)
STRIPE_SECRET_KEY=sk_test_placeholder
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_placeholder
STRIPE_WEBHOOK_SECRET=whsec_placeholder

# Lead Enrichment (Optional - features won't work without real keys)
HUNTER_API_KEY=placeholder
CLEARBIT_API_KEY=placeholder
APOLLO_API_KEY=placeholder

# Social Media (Optional - features won't work without real keys)
LINKEDIN_CLIENT_ID=placeholder
LINKEDIN_CLIENT_SECRET=placeholder
LINKEDIN_REDIRECT_URI=https://coldcopy.vercel.app/api/auth/linkedin/callback
TWITTER_API_KEY=placeholder
TWITTER_API_SECRET=placeholder
TWITTER_ACCESS_TOKEN=placeholder
TWITTER_ACCESS_SECRET=placeholder

# Redis (Optional - caching won't work without real URL)
REDIS_URL=redis://localhost:6379

# File Storage (Optional)
DO_SPACES_KEY=placeholder
DO_SPACES_SECRET=placeholder
DO_SPACES_ENDPOINT=https://nyc3.digitaloceanspaces.com
DO_SPACES_REGION=nyc3
DO_SPACES_BUCKET=coldcopy-uploads

# OAuth (Optional)
GOOGLE_CLIENT_ID=placeholder
GOOGLE_CLIENT_SECRET=placeholder
MICROSOFT_CLIENT_ID=placeholder
MICROSOFT_CLIENT_SECRET=placeholder
MICROSOFT_TENANT_ID=common

# Monitoring (Optional)
SENTRY_DSN=
SENTRY_AUTH_TOKEN=
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com

# CRM Integrations (Optional)
SALESFORCE_CLIENT_ID=placeholder
SALESFORCE_CLIENT_SECRET=placeholder
SALESFORCE_REDIRECT_URI=https://coldcopy.vercel.app/api/integrations/salesforce/callback
HUBSPOT_CLIENT_ID=placeholder
HUBSPOT_CLIENT_SECRET=placeholder
HUBSPOT_REDIRECT_URI=https://coldcopy.vercel.app/api/integrations/hubspot/callback

# Email Tracking
TRACKING_PIXEL_URL=https://coldcopy.vercel.app/api/track/pixel
TRACKING_DOMAIN=coldcopy.vercel.app

EOF

echo ""
echo "✅ Environment variables generated in: $OUTPUT_FILE"
echo ""
echo "NEXT STEPS:"
echo "1. Get your Supabase keys from: https://supabase.com/dashboard/project/zicipvpablahehxstbfr/settings/api"
echo "2. Copy the variables from $OUTPUT_FILE"
echo "3. Go to: https://vercel.com/vanmooseprojects/coldcopy/settings/environment-variables"
echo "4. Add each variable (Key and Value)"
echo "5. Select all environments: Production, Preview, Development"
echo "6. Vercel will automatically redeploy after saving"
echo ""
echo "⚠️  IMPORTANT: The app will work with these essential variables, but many features"
echo "   (email, AI, payments, etc.) require real API keys to function properly."