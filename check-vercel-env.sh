#!/bin/bash

echo "🔐 Checking Vercel environment variables for ColdCopy..."
echo ""
echo "First, you need to log in to Vercel:"
echo ""

# Login to Vercel
vercel login

echo ""
echo "✅ Logged in! Now checking environment variables..."
echo ""

# List all environment variables
echo "📋 Current environment variables in Vercel:"
echo "=========================================="
vercel env ls

echo ""
echo "🔍 To see the actual values, you can use:"
echo "vercel env pull .env.local"
echo ""
echo "This will create a .env.local file with all your production variables"