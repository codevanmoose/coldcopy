#!/bin/bash

# Add Upstash Redis to ColdCopy

echo "📦 Adding Upstash Redis package..."
npm install @upstash/redis

echo "✅ Upstash Redis package installed!"
echo ""
echo "Next steps:"
echo "1. Create an Upstash account at https://upstash.com"
echo "2. Create a Redis database"
echo "3. Add these environment variables to Vercel:"
echo "   - UPSTASH_REDIS_REST_URL"
echo "   - UPSTASH_REDIS_REST_TOKEN"
echo "4. Redeploy to activate caching"
echo ""
echo "See UPSTASH_REDIS_SETUP.md for detailed instructions"