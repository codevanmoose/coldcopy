# 🔧 Redis Connection Fix Guide

## Issue
The Upstash integration set `REDIS_URL="redis://localhost:6379"` which doesn't work in production.

## Quick Fix Options

### Option 1: Use Vercel KV (Recommended - Easiest)
1. Go to [Vercel Storage](https://vercel.com/vanmooseprojects/coldcopy/storage)
2. Click "Create Database" → "KV (Upstash Redis)"
3. This automatically sets up the correct environment variables
4. Redeploy the app

### Option 2: Manual Upstash Setup
1. Go to [Upstash Console](https://console.upstash.com)
2. Find your existing database or create new one
3. Copy the credentials:
   ```
   UPSTASH_REDIS_REST_URL=https://your-db.upstash.io
   UPSTASH_REDIS_REST_TOKEN=your-token
   ```
4. Add these to Vercel:
   ```bash
   vercel env add UPSTASH_REDIS_REST_URL production
   vercel env add UPSTASH_REDIS_REST_TOKEN production
   ```

### Option 3: Update Code for Standard Redis URL
I can modify our code to parse any Redis URL format.

## Recommendation
Go with **Option 1** - it's one click and automatically configures everything correctly.

After setup:
- Visit https://coldcopy.cc/redis-status to verify
- Redis will start caching for better performance