# ColdCopy Deployment Checklist

## ✅ Completed Preparation
- [x] Code repository updated and pushed to GitHub
- [x] Build process verified (app builds successfully)
- [x] Security secrets generated
- [x] Deployment documentation created
- [x] Testing script prepared

## 🔄 Infrastructure Deployment (Manual Steps Required)

### Step 1: Supabase Database Setup
- [ ] Go to https://supabase.com/dashboard
- [ ] Create new project: "coldcopy-production"
- [ ] Copy Project URL: `https://[ref].supabase.co`
- [ ] Copy Anon Key from Settings → API
- [ ] Copy Service Role Key from Settings → API

### Step 2: Vercel Frontend Deployment
- [ ] Go to https://vercel.com/dashboard  
- [ ] Import GitHub repository: `codevanmoose/coldcopy`
- [ ] Set framework: Next.js
- [ ] Set root directory: `apps/web`
- [ ] Configure environment variables (see below)
- [ ] Deploy to production

### Step 3: Environment Variables Configuration
Add these in Vercel dashboard → Settings → Environment Variables:

#### Required for Basic Functionality
```bash
NEXT_PUBLIC_SUPABASE_URL=[from-step-1]
NEXT_PUBLIC_SUPABASE_ANON_KEY=[from-step-1]
SUPABASE_SERVICE_ROLE_KEY=[from-step-1]
NEXTAUTH_SECRET=qltJzWq5hx1ikfB9WsmER4CrYZqLTtKdyfTriXlLmnw=
JWT_SECRET=mKx7bV5vf9h/4sWWXFCbK6o1WpOkxoQNpPA0y/HhHy0=
ENCRYPTION_KEY=ee1c3e1682247a7c606811d5804c6a0f1ab8ea0209c092ba134d54aedb24863c
NEXTAUTH_URL=https://coldcopy.cc
NEXT_PUBLIC_API_URL=https://api.coldcopy.cc
NEXT_PUBLIC_APP_URL=https://coldcopy.cc
NEXT_PUBLIC_ENVIRONMENT=production
```

### Step 4: Database Migration
- [ ] Install Supabase CLI: `npm install -g supabase`
- [ ] Login: `supabase login`
- [ ] Link project: `supabase link --project-ref [ref-from-step-1]`
- [ ] Run migrations: `supabase db push`

### Step 5: Domain Configuration
- [ ] Add domain in Vercel: `coldcopy.cc`
- [ ] Add domain in Vercel: `www.coldcopy.cc`
- [ ] Update DNS records in Cloudflare:
  - A record: `coldcopy.cc` → Vercel IP
  - CNAME: `www.coldcopy.cc` → `cname.vercel-dns.com`

### Step 6: Deployment Testing
- [ ] Run test script: `./scripts/test-deployment.sh`
- [ ] Test user signup/login
- [ ] Test workspace creation
- [ ] Test lead management
- [ ] Test basic navigation

## 🚀 Advanced Configuration (Optional)

### Email Service (Amazon SES)
- [ ] Set up SES domain verification
- [ ] Configure SES credentials in environment variables
- [ ] Test email sending functionality

### Backend API (Digital Ocean)
- [ ] Deploy Python FastAPI backend
- [ ] Configure Redis caching
- [ ] Set up background workers

### Monitoring & Analytics
- [ ] Configure Sentry for error tracking
- [ ] Set up performance monitoring
- [ ] Configure analytics tracking

### Integrations
- [ ] HubSpot OAuth setup
- [ ] Salesforce integration
- [ ] Stripe billing configuration
- [ ] LinkedIn API setup

## 📊 Success Criteria

### Minimum Viable Deployment
- [ ] Frontend loads at https://coldcopy.cc
- [ ] User can sign up and login
- [ ] Database operations work
- [ ] Basic lead management functions
- [ ] No console errors

### Full Production Deployment
- [ ] All API endpoints responding
- [ ] Email sending operational
- [ ] CRM integrations working
- [ ] Billing system functional
- [ ] Performance optimized

## 🔧 Troubleshooting

### Common Issues
1. **Build Failures**: Check environment variables
2. **Database Errors**: Verify migrations ran successfully
3. **404 Errors**: Check DNS propagation (up to 48 hours)
4. **SSL Issues**: Verify domain configuration in Vercel

### Debug Commands
```bash
# Test local build
npm run build

# Check environment variables
npm run verify-env

# Test database connection
supabase db diff

# Check DNS propagation
dig coldcopy.cc
```

## 📞 Deployment Support

### Resources
- Manual Deployment Guide: `MANUAL_DEPLOYMENT_GUIDE.md`
- Testing Script: `scripts/test-deployment.sh`
- Environment Config: `VERCEL_ENV_CONFIG.md`

### Quick Commands
```bash
# Generate new secrets
openssl rand -base64 32  # NEXTAUTH_SECRET
openssl rand -hex 32     # ENCRYPTION_KEY

# Test deployment
./scripts/test-deployment.sh

# Check migration status
supabase db diff
```

---

**Status**: Ready for manual deployment through web consoles.  
**Estimated Time**: 1-2 hours for basic deployment, 4-6 hours for full production setup.  
**Next Action**: Create Supabase project at https://supabase.com/dashboard