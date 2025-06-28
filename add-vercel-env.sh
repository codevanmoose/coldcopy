#!/bin/bash

# Script to add environment variables to Vercel
# This creates a quick way to add all variables via CLI if you prefer

echo "🚀 Adding environment variables to Vercel..."
echo ""
echo "Make sure you're logged in to Vercel CLI first:"
echo "vercel login"
echo ""
echo "Press Enter to continue or Ctrl+C to exit..."
read

# Critical Supabase Variables
echo "Adding Supabase configuration..."
vercel env add NEXT_PUBLIC_SUPABASE_URL production <<< "https://zicipvpablahehxstbfr.supabase.co"
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production <<< "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InppY2lwdnBhYmxhaGVoeHN0YmZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEwMDY3NTEsImV4cCI6MjA2NjU4Mjc1MX0.4i08GOhX0UPWjv4YdLRBXXEi2WMYiFgAica8LM9fRB8"
vercel env add SUPABASE_SERVICE_ROLE_KEY production <<< "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InppY2lwdnBhYmxhaGVoeHN0YmZyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTAwNjc1MSwiZXhwIjoyMDY2NTgyNzUxfQ.FuHhzGlvQaA4HXPhKvR1UZIn3UPr4EgtydupNTdJjow"

# Authentication
echo "Adding authentication secrets..."
vercel env add NEXTAUTH_SECRET production <<< "qltJzWq5hx1ikfB9WsmER4CrYZqLTtKdyfTriXlLmnw="
vercel env add NEXTAUTH_URL production <<< "https://coldcopy.vercel.app"
vercel env add JWT_SECRET production <<< "mKx7bV5vf9h/4sWWXFCbK6o1WpOkxoQNpPA0y/HhHy0="
vercel env add ENCRYPTION_KEY production <<< "ee1c3e1682247a7c606811d5804c6a0f1ab8ea0209c092ba134d54aedb24863c"

# Application URLs
echo "Adding application URLs..."
vercel env add NEXT_PUBLIC_APP_URL production <<< "https://coldcopy.vercel.app"
vercel env add NEXT_PUBLIC_API_URL production <<< "https://api.coldcopy.cc"
vercel env add NEXT_PUBLIC_ENVIRONMENT production <<< "production"

# Redis (default)
echo "Adding Redis configuration..."
vercel env add REDIS_URL production <<< "redis://localhost:6379"

# Feature Flags
echo "Adding feature flags..."
vercel env add ENABLE_LINKEDIN_INTEGRATION production <<< "false"
vercel env add ENABLE_TWITTER_INTEGRATION production <<< "false"
vercel env add ENABLE_SALES_INTELLIGENCE production <<< "false"
vercel env add ENABLE_AI_MEETING_SCHEDULER production <<< "false"

# Generate random secrets
echo "Generating webhook secrets..."
WEBHOOK_SECRET=$(openssl rand -base64 32)
CRON_SECRET=$(openssl rand -base64 32)

vercel env add WEBHOOK_SECRET production <<< "$WEBHOOK_SECRET"
vercel env add CRON_SECRET production <<< "$CRON_SECRET"

echo ""
echo "✅ Basic environment variables added!"
echo ""
echo "⚠️  Don't forget to add these manually in Vercel dashboard:"
echo "- OPENAI_API_KEY"
echo "- ANTHROPIC_API_KEY"
echo "- AWS credentials (for email)"
echo "- Stripe keys (for payments)"
echo ""
echo "📋 Saved webhook secrets for reference:"
echo "WEBHOOK_SECRET=$WEBHOOK_SECRET"
echo "CRON_SECRET=$CRON_SECRET"
echo ""
echo "🔄 Triggering new deployment..."
vercel --prod