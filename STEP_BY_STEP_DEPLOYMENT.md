# ColdCopy Step-by-Step Deployment Guide

## 🎯 Complete Infrastructure Recovery

### Current Status
- ❌ Frontend: https://coldcopy.cc (404 - DEPLOYMENT_NOT_FOUND)
- ❌ Backend: https://api.coldcopy.cc (404)
- ❌ Database: Previous Supabase project inaccessible
- ✅ Repository: https://github.com/codevanmoose/coldcopy (Ready)

## 📋 Pre-Deployment Checklist
- [x] Code committed and pushed to GitHub
- [x] Build verified locally (successful)
- [x] Environment variables generated
- [x] Database migrations prepared
- [x] Testing scripts ready

## 🚀 Deployment Steps

### Step 1: Create Supabase Project (5 minutes)

#### 1.1 Access Supabase Dashboard
1. Go to: https://supabase.com/dashboard
2. Sign in with GitHub account
3. Click "New Project"

#### 1.2 Configure Project
- **Name**: `coldcopy-production`
- **Organization**: (select existing or create new)
- **Database Password**: Generate and save securely
- **Region**: `US East (N. Virginia)`
- **Pricing**: Free tier (can upgrade later)

#### 1.3 Save Credentials
After project creation (2-3 minutes), go to Settings → API:
- **Project URL**: `https://[project-ref].supabase.co`
- **Anon Key**: `eyJ...` (copy this)
- **Service Role Key**: `eyJ...` (copy this - keep secret)

### Step 2: Deploy to Vercel (10 minutes)

#### 2.1 Import Repository
1. Go to: https://vercel.com/dashboard
2. Click "Import Project" or "Add New..."
3. Select "Import Git Repository"
4. Enter: `https://github.com/codevanmoose/coldcopy`
5. Click "Import"

#### 2.2 Configure Deployment
- **Framework Preset**: Next.js (auto-detected)
- **Root Directory**: `apps/web`
- **Build Settings**: (leave defaults)

#### 2.3 Add Environment Variables
Click "Environment Variables" and add:

```bash
# Supabase Configuration (from Step 1.3)
NEXT_PUBLIC_SUPABASE_URL=https://[your-project-ref].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[your-anon-key]
SUPABASE_SERVICE_ROLE_KEY=[your-service-role-key]

# Authentication (pre-generated)
NEXTAUTH_SECRET=qltJzWq5hx1ikfB9WsmER4CrYZqLTtKdyfTriXlLmnw=
JWT_SECRET=mKx7bV5vf9h/4sWWXFCbK6o1WpOkxoQNpPA0y/HhHy0=
ENCRYPTION_KEY=ee1c3e1682247a7c606811d5804c6a0f1ab8ea0209c092ba134d54aedb24863c
NEXTAUTH_URL=https://coldcopy.cc

# API Configuration
NEXT_PUBLIC_API_URL=https://api.coldcopy.cc
NEXT_PUBLIC_APP_URL=https://coldcopy.cc
NEXT_PUBLIC_ENVIRONMENT=production
```

#### 2.4 Deploy
1. Click "Deploy"
2. Wait for build completion (3-5 minutes)
3. Note the generated Vercel URL

### Step 3: Configure Custom Domain (5 minutes)

#### 3.1 Add Domain in Vercel
1. Go to Project Settings → Domains
2. Add domain: `coldcopy.cc`
3. Add domain: `www.coldcopy.cc` (optional)

#### 3.2 Verify Domain Configuration
Vercel will provide DNS instructions. The domain should already be configured correctly.

### Step 4: Run Database Migrations (5 minutes)

#### 4.1 Link Local CLI to Supabase
```bash
cd supabase
supabase login
supabase link --project-ref [project-ref-from-step-1]
```

#### 4.2 Push Database Schema
```bash
supabase db push
```

This will create all necessary tables, indexes, and functions.

### Step 5: Verify Deployment (5 minutes)

#### 5.1 Test Basic Connectivity
```bash
curl -I https://coldcopy.cc
# Expected: HTTP/2 200
```

#### 5.2 Run Comprehensive Tests
```bash
./scripts/test-deployment.sh
```

#### 5.3 Manual Testing
1. Visit https://coldcopy.cc
2. Try user registration
3. Create a workspace
4. Add a test lead
5. Navigate through the dashboard

## 🔧 Troubleshooting

### Build Failures
**Issue**: Vercel build fails
**Solution**: 
1. Check environment variables are set correctly
2. Verify Supabase project is active
3. Check build logs in Vercel dashboard

### 404 Errors
**Issue**: Site returns 404
**Solution**:
1. Verify domain configuration in Vercel
2. Check DNS propagation (up to 48 hours)
3. Ensure build completed successfully

### Database Connection Errors
**Issue**: Database operations fail
**Solution**:
1. Verify Supabase project is active
2. Check environment variables match Supabase settings
3. Ensure migrations completed successfully

### SSL Certificate Issues
**Issue**: SSL warnings or errors
**Solution**:
1. Wait for Vercel SSL provisioning (automatic)
2. Verify domain ownership
3. Check DNS configuration

## 📊 Expected Results

### Immediate (after deployment)
- ✅ Frontend accessible at https://coldcopy.cc
- ✅ User registration/login functional
- ✅ Database operations working
- ✅ Basic navigation operational
- ✅ API endpoints responding

### Advanced Features (ready to use)
- 🚀 Multi-channel outreach campaigns
- 🤖 AI-powered email generation
- 📊 Advanced analytics dashboards
- 👥 Team collaboration features
- 🔗 CRM integration capabilities
- 💳 Usage-based billing system
- 🎨 White-label customization
- 📧 Email deliverability tools

## 🎉 Success Metrics

### Technical Health
- [ ] Build completes without errors
- [ ] All environment variables configured
- [ ] Database migrations successful
- [ ] SSL certificate valid
- [ ] Domain resolves correctly

### User Experience
- [ ] Homepage loads quickly
- [ ] User signup flow works
- [ ] Dashboard is responsive
- [ ] Navigation is functional
- [ ] No console errors

## 📞 Post-Deployment

### Immediate Tasks
1. **Test core user flows**
2. **Monitor error logs**
3. **Verify performance**
4. **Check analytics**

### Optional Enhancements
1. **Amazon SES setup** (email sending)
2. **Monitoring configuration** (Sentry)
3. **Performance optimization**
4. **Integration setup** (HubSpot, Stripe)

---

**Estimated Total Time**: 30 minutes  
**Next Action**: Start with Step 1 - Create Supabase Project  
**Support**: Monitor with `./scripts/monitor-deployment.sh`