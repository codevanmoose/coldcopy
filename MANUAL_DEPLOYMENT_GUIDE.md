# ColdCopy Manual Deployment Guide

## Step 1: Create Supabase Project

### 1.1 Create New Project
1. Go to https://supabase.com/dashboard
2. Click "New Project"
3. Name: `coldcopy-production`
4. Database Password: Generate strong password
5. Region: `us-east-1` (Virginia)
6. Wait for project creation (2-3 minutes)

### 1.2 Get Credentials
After project creation, go to Settings → API:
- Project URL: `https://[project-ref].supabase.co`
- Anon Key: `eyJ...` (public)
- Service Role Key: `eyJ...` (secret)

## Step 2: Deploy to Vercel

### 2.1 Import Repository
1. Go to https://vercel.com/dashboard
2. Click "Import Project"
3. Import from GitHub: `codevanmoose/coldcopy`
4. Framework Preset: Next.js
5. Root Directory: `apps/web`

### 2.2 Configure Environment Variables
In Vercel dashboard, add these environment variables:

#### Core Configuration
```bash
NEXT_PUBLIC_SUPABASE_URL=https://[project-ref].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[anon-key-from-supabase]
SUPABASE_SERVICE_ROLE_KEY=[service-role-key-from-supabase]
```

#### Authentication & Security
```bash
NEXTAUTH_SECRET=qltJzWq5hx1ikfB9WsmER4CrYZqLTtKdyfTriXlLmnw=
JWT_SECRET=mKx7bV5vf9h/4sWWXFCbK6o1WpOkxoQNpPA0y/HhHy0=
ENCRYPTION_KEY=ee1c3e1682247a7c606811d5804c6a0f1ab8ea0209c092ba134d54aedb24863c
NEXTAUTH_URL=https://coldcopy.cc
```

#### API Configuration
```bash
NEXT_PUBLIC_API_URL=https://api.coldcopy.cc
NEXT_PUBLIC_APP_URL=https://coldcopy.cc
NEXT_PUBLIC_ENVIRONMENT=production
```

### 2.3 Deploy
1. Click "Deploy"
2. Wait for build completion
3. Verify deployment at generated URL

## Step 3: Run Database Migrations

### 3.1 Link Local CLI to Project
```bash
cd supabase
supabase login
supabase link --project-ref [project-ref-from-step-1]
```

### 3.2 Run Migrations
```bash
supabase db push
```

### 3.3 Verify Database
Check tables were created in Supabase dashboard → Table Editor

## Step 4: Configure Custom Domain

### 4.1 Add Domain in Vercel
1. Go to Project Settings → Domains
2. Add domain: `coldcopy.cc`
3. Add domain: `www.coldcopy.cc`

### 4.2 Update DNS (Cloudflare)
Add these records:
```
A     coldcopy.cc        76.76.19.61
CNAME www.coldcopy.cc    cname.vercel-dns.com
```

## Step 5: Test Deployment

### 5.1 Basic Functionality
1. Visit https://coldcopy.cc
2. Try signup/login
3. Create test workspace
4. Add test lead
5. Create test campaign

### 5.2 Database Connection
Check that data persists in Supabase dashboard

## Step 6: Production Verification

### 6.1 Performance Check
```bash
npm run build  # Should complete without errors
npm run typecheck  # Should pass
npm run lint  # Should pass
```

### 6.2 End-to-End Flow
1. User registration
2. Workspace creation
3. Lead import
4. Campaign creation
5. Email sending (when SES configured)

## Troubleshooting

### Build Errors
- Check environment variables are set correctly
- Verify Supabase project is active
- Check database migrations completed

### 404 Errors
- Verify custom domain configuration
- Check DNS propagation (up to 48 hours)
- Verify Vercel deployment succeeded

### Database Errors
- Check Supabase project status
- Verify database migrations ran successfully
- Check RLS policies are active

## Next Steps After Basic Deployment

1. Set up Amazon SES for email sending
2. Configure monitoring with Sentry
3. Set up backend API on Digital Ocean
4. Configure advanced features (HubSpot, Stripe, etc.)
5. Load testing and performance optimization

## Environment Variables Summary

Copy these to Vercel dashboard:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://[your-project-ref].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[your-anon-key]
SUPABASE_SERVICE_ROLE_KEY=[your-service-role-key]
NEXTAUTH_SECRET=qltJzWq5hx1ikfB9WsmER4CrYZqLTtKdyfTriXlLmnw=
JWT_SECRET=mKx7bV5vf9h/4sWWXFCbK6o1WpOkxoQNpPA0y/HhHy0=
ENCRYPTION_KEY=ee1c3e1682247a7c606811d5804c6a0f1ab8ea0209c092ba134d54aedb24863c
NEXTAUTH_URL=https://coldcopy.cc
NEXT_PUBLIC_API_URL=https://api.coldcopy.cc
NEXT_PUBLIC_APP_URL=https://coldcopy.cc
NEXT_PUBLIC_ENVIRONMENT=production
```

**Important**: Replace `[your-project-ref]`, `[your-anon-key]`, and `[your-service-role-key]` with actual values from your Supabase project.