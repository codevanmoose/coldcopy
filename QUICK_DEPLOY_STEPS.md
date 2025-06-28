# Quick Deploy Steps for ColdCopy

## Current Status
All infrastructure is down - need complete redeployment.

## Step 1: Create New Supabase Project (Manual)
1. Go to https://supabase.com/dashboard
2. Create new project: "coldcopy-production" 
3. Region: us-east-1
4. Save the credentials:
   - Project URL: https://[project-ref].supabase.co
   - Anon Key: [anon-key]
   - Service Role Key: [service-role-key]

## Step 2: Update Environment Variables
Update `.env.local` with new Supabase credentials:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://[new-project-ref].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[new-anon-key]
```

## Step 3: Deploy to Vercel
```bash
cd apps/web
vercel login  # Use GitHub OAuth
vercel link   # Link to existing project or create new
vercel --prod # Deploy to production
```

## Step 4: Run Database Migrations
After Supabase project is created:
```bash
cd supabase
supabase link --project-ref [new-project-ref]
supabase db push
```

## Step 5: Configure Vercel Environment Variables
In Vercel dashboard, add:
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY  
- SUPABASE_SERVICE_ROLE_KEY
- NEXTAUTH_SECRET (generate new)
- JWT_SECRET (generate new)
- ENCRYPTION_KEY (generate new)

## Step 6: Deploy Python Backend (Optional)
The Next.js app has API routes that can handle most functionality.
Only deploy Python backend if advanced features are needed.

## Emergency Deployment Commands
```bash
# Generate secrets
openssl rand -base64 32  # NEXTAUTH_SECRET
openssl rand -base64 32  # JWT_SECRET  
openssl rand -hex 32     # ENCRYPTION_KEY

# Quick deploy
cd apps/web
npm run build  # Test build
vercel --prod  # Deploy
```

## Testing After Deployment
1. Visit https://coldcopy.cc
2. Try signup/login
3. Create test campaign
4. Verify basic functionality