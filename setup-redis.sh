#!/bin/bash

echo "🔧 Setting up Redis for ColdCopy..."

# Check if we already have Redis configured
echo "📡 Checking current Redis configuration..."

# Try to get Vercel KV environment variables
echo "🔍 Checking for Vercel KV integration..."
vercel env ls production | grep -i "KV_REST_API"

if [ $? -eq 0 ]; then
    echo "✅ Vercel KV detected! Environment variables already configured."
else
    echo "❌ No Vercel KV found."
    echo ""
    echo "🛠️ Manual setup required:"
    echo "1. Go to: https://vercel.com/vanmooseprojects/coldcopy/storage"
    echo "2. Click 'Create Database'"
    echo "3. Select 'KV (Upstash Redis)'"
    echo "4. Name it 'coldcopy-redis'"
    echo "5. Click 'Create'"
    echo ""
    echo "Or use Upstash directly:"
    echo "1. Go to: https://console.upstash.com"
    echo "2. Create or find your Redis database"
    echo "3. Copy the REST API URL and Token"
    echo "4. Run:"
    echo "   vercel env add UPSTASH_REDIS_REST_URL production"
    echo "   vercel env add UPSTASH_REDIS_REST_TOKEN production"
    echo ""
fi

echo "🧪 Testing current Redis status..."
curl -s https://coldcopy.cc/api/test-redis | jq . || curl -s https://coldcopy.cc/api/test-redis

echo ""
echo "✅ Setup script complete!"
echo "💡 Remember: Redis is optional - the platform works without it!"