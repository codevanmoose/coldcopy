# ColdCopy Deployment Recovery Guide

## Current Situation (December 28, 2024)
All infrastructure is down:
- Frontend (coldcopy.cc) - 404 error
- Backend API (api.coldcopy.cc) - 404 error  
- Database (Supabase) - 404 error

## Recovery Steps

### 1. Supabase Setup
1. Go to https://supabase.com and create a new project
2. Note down:
   - Project URL
   - Anon Key
   - Service Role Key
3. Run database migrations:
   ```bash
   cd supabase
   supabase link --project-ref [new-project-ref]
   supabase db push
   ```

### 2. Vercel Deployment
1. Login to Vercel:
   ```bash
   cd apps/web
   vercel login
   ```
2. Link to GitHub repository:
   ```bash
   vercel link
   ```
3. Configure environment variables in Vercel dashboard:
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY
   - SUPABASE_SERVICE_ROLE_KEY
   - NEXTAUTH_SECRET (generate with: openssl rand -base64 32)
   - JWT_SECRET (generate with: openssl rand -base64 32)
   - ENCRYPTION_KEY (generate with: openssl rand -hex 32)
4. Deploy:
   ```bash
   vercel --prod
   ```

### 3. Digital Ocean Backend
1. Create new App in Digital Ocean App Platform
2. Connect to GitHub repository
3. Configure:
   - Build Command: `docker build -t coldcopy-api .`
   - Run Command: `docker run coldcopy-api`
   - Environment variables (same as Vercel plus backend-specific)
4. Deploy

### 4. DNS Configuration
1. Update DNS records:
   - A record: coldcopy.cc → Vercel IP
   - CNAME: www.coldcopy.cc → coldcopy.cc
   - A record: api.coldcopy.cc → Digital Ocean IP
   - A record: track.coldcopy.cc → Digital Ocean IP

### 5. Amazon SES Setup
1. Verify domain in SES
2. Create configuration sets
3. Set up SNS topics for bounces/complaints
4. Request production access

### 6. Post-Deployment Verification
1. Test user signup/login
2. Create test campaign
3. Send test email
4. Verify tracking pixels
5. Check integrations

## Environment Variables Needed

### Frontend (Vercel)
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Authentication
NEXTAUTH_SECRET=
NEXTAUTH_URL=https://coldcopy.cc
JWT_SECRET=
ENCRYPTION_KEY=

# API
NEXT_PUBLIC_API_URL=https://api.coldcopy.cc
NEXT_PUBLIC_APP_URL=https://coldcopy.cc

# Stripe
STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# AI Services
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
```

### Backend (Digital Ocean)
```env
# Database
DATABASE_URL=
REDIS_URL=

# AWS
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-east-1
SES_CONFIGURATION_SET=coldcopy-transactional

# AI Services
OPENAI_API_KEY=
ANTHROPIC_API_KEY=

# OAuth
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
LINKEDIN_REDIRECT_URI=
```

## Recovery Priority
1. Database (Supabase) - Foundation for everything
2. Frontend (Vercel) - User interface
3. Backend API (Digital Ocean) - Core functionality
4. Email (SES) - Critical for outreach
5. Monitoring - Error tracking

## Estimated Time
- Supabase setup: 30 minutes
- Vercel deployment: 20 minutes
- Digital Ocean setup: 45 minutes
- DNS propagation: 0-48 hours
- SES verification: 24-72 hours
- Total active work: ~2 hours