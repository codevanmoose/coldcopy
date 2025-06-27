# 🚀 ColdCopy Quick Deployment Guide

Let's get your ColdCopy platform live! This guide will walk you through deploying everything step by step.

## Prerequisites
- GitHub account
- Supabase account (free tier works)
- Vercel account (free tier works)
- Digital Ocean account ($200 credit available for new users)
- Domain name (optional, can use subdomains)

## Step 1: GitHub Setup ✅

### If the repo doesn't exist yet:
1. Go to https://github.com/new
2. Create a new repository named `coldcopy`
3. Make it public or private (your choice)
4. DON'T initialize with README (we already have one)
5. After creating, push your code:
```bash
git remote add origin https://github.com/YOUR_USERNAME/coldcopy.git
git push -u origin main
```

## Step 2: Supabase Setup 🗄️

1. **Create Supabase Project**
   - Go to https://app.supabase.com
   - Click "New project"
   - Name: `coldcopy-prod`
   - Database Password: (save this securely!)
   - Region: Choose closest to your users
   - Click "Create new project" (takes ~2 minutes)

2. **Get Your Keys**
   - Go to Settings → API
   - Copy:
     - `Project URL` → This is your `NEXT_PUBLIC_SUPABASE_URL`
     - `anon public` → This is your `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - `service_role secret` → This is your `SUPABASE_SERVICE_ROLE_KEY` (keep secret!)

3. **Run Migrations**
   ```bash
   cd supabase
   npx supabase login
   npx supabase link --project-ref YOUR_PROJECT_REF
   npx supabase db push
   ```

## Step 3: Vercel Deployment (Frontend) 🌐

1. **Connect to Vercel**
   - Go to https://vercel.com/new
   - Import your GitHub repository
   - Select `coldcopy` repository

2. **Configure Build Settings**
   - Framework Preset: Next.js
   - Root Directory: `apps/web`
   - Build Command: `npm run build`
   - Output Directory: `.next`

3. **Add Environment Variables**
   Click "Environment Variables" and add:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   NEXT_PUBLIC_API_URL=https://api.yourdomain.com
   NEXT_PUBLIC_ENVIRONMENT=production
   ```

4. **Deploy**
   - Click "Deploy"
   - Wait for build (~3-5 minutes)
   - Your frontend will be live at `your-project.vercel.app`

## Step 4: Digital Ocean Setup (Backend) 🌊

### Option A: App Platform (Easier, $12/month)

1. **Create App**
   - Go to https://cloud.digitalocean.com/apps
   - Click "Create App"
   - Choose GitHub as source
   - Select your repository

2. **Configure Component**
   - Name: `coldcopy-api`
   - Source Directory: `/apps/api`
   - Type: Web Service
   - Build Command: `pip install -r requirements.txt`
   - Run Command: `uvicorn main:app --host 0.0.0.0 --port 8080`

3. **Environment Variables**
   Add all from `apps/api/.env.example`:
   ```
   DATABASE_URL=postgresql://...
   REDIS_URL=redis://...
   AWS_ACCESS_KEY_ID=...
   AWS_SECRET_ACCESS_KEY=...
   OPENAI_API_KEY=...
   ```

4. **Deploy**
   - Click "Next" → "Create Resources"
   - Wait for deployment (~5-10 minutes)

### Option B: Droplet (More Control, $6/month)

1. **Create Droplet**
   - Ubuntu 22.04
   - Basic → Regular → $6/month
   - Choose datacenter region
   - Add SSH keys

2. **Setup Script** (Run after SSH into droplet)
   ```bash
   # We'll create a setup script for this
   curl -sSL https://raw.githubusercontent.com/yourusername/coldcopy/main/scripts/setup-droplet.sh | bash
   ```

## Step 5: Connect Everything 🔗

1. **Update Vercel Environment**
   - Go to Vercel project settings
   - Update `NEXT_PUBLIC_API_URL` to your Digital Ocean URL

2. **Update Backend Environment**
   - Add your Supabase connection string to Digital Ocean

3. **Set up Domain (Optional)**
   - Add custom domain in Vercel
   - Add custom domain in Digital Ocean
   - Update CORS settings

## Step 6: Post-Deployment ✨

1. **Test Everything**
   - Sign up for an account
   - Create a workspace
   - Import some test leads
   - Send a test campaign

2. **Set up Monitoring**
   - Enable Vercel Analytics
   - Set up Digital Ocean monitoring
   - Configure error tracking (optional)

3. **Configure Email (AWS SES)**
   - Verify your domain in AWS SES
   - Move out of sandbox mode
   - Update SES credentials in backend

## Quick Commands Reference

```bash
# Local development
cd apps/web && npm run dev       # Frontend on :3000
cd apps/api && uvicorn main:app  # Backend on :8000

# Check deployment status
vercel ls                        # List Vercel deployments
doctl apps list                  # List DO apps (needs doctl CLI)

# View logs
vercel logs your-project-name    # Frontend logs
doctl apps logs APP_ID           # Backend logs
```

## Troubleshooting

**Frontend not loading?**
- Check Vercel build logs
- Verify environment variables
- Check browser console

**API not responding?**
- Check Digital Ocean logs
- Verify Python version (needs 3.11+)
- Check database connection

**Database errors?**
- Verify Supabase is running
- Check connection string
- Run migrations again

## Support

- Vercel Docs: https://vercel.com/docs
- Digital Ocean Docs: https://docs.digitalocean.com
- Supabase Docs: https://supabase.com/docs
- Your repo issues: https://github.com/yourusername/coldcopy/issues

---

🎉 **Congratulations!** Your ColdCopy platform should now be live!

Next steps:
1. Set up payment processing (Stripe)
2. Configure email sending (AWS SES)
3. Add your AI API keys
4. Customize branding
5. Start selling! 💰