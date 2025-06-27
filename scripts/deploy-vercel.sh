#!/bin/bash
# Deploy ColdCopy to Vercel

echo "🚀 Deploying ColdCopy to Vercel..."

# Navigate to web directory
cd /Users/jasper/Documents/Poetsen/Van\ Moose\ Projects/ColdCopy/apps/web

# Check if logged in
if ! vercel whoami &> /dev/null; then
    echo "❌ Not logged in to Vercel"
    echo "Please run: vercel login"
    exit 1
fi

echo "✅ Logged in to Vercel"

# Deploy to production with environment variables
echo "📦 Starting deployment..."

vercel --prod \
  --name coldcopy \
  --yes \
  -e NEXT_PUBLIC_SUPABASE_URL=https://zicipvpablahehxstbfr.supabase.co \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InppY2lwdnBhYmxhaGVoeHN0YmZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEwMDY3NTEsImV4cCI6MjA2NjU4Mjc1MX0.4i08GOhX0UPWjv4YdLRBXXEi2WMYiFgAica8LM9fRB8 \
  -e NEXT_PUBLIC_API_URL=https://api.coldcopy.io \
  -e NEXT_PUBLIC_ENVIRONMENT=production

if [ $? -eq 0 ]; then
    echo "✅ Deployment successful!"
    echo "🎉 Your app is now live on Vercel!"
else
    echo "❌ Deployment failed"
    exit 1
fi