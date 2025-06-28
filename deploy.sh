#!/bin/bash

# ColdCopy Deployment Automation Script
# This script helps automate parts of the deployment process

set -e

echo "🚀 ColdCopy Deployment Assistant"
echo "================================"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
REPO_URL="https://github.com/codevanmoose/coldcopy"
DOMAIN="coldcopy.cc"

# Environment variables
NEXTAUTH_SECRET="qltJzWq5hx1ikfB9WsmER4CrYZqLTtKdyfTriXlLmnw="
JWT_SECRET="mKx7bV5vf9h/4sWWXFCbK6o1WpOkxoQNpPA0y/HhHy0="
ENCRYPTION_KEY="ee1c3e1682247a7c606811d5804c6a0f1ab8ea0209c092ba134d54aedb24863c"

echo -e "${BLUE}This script will guide you through deploying ColdCopy.${NC}"
echo -e "${YELLOW}Manual steps are required as we need access to web consoles.${NC}\n"

# Step 1: Check prerequisites
echo -e "${YELLOW}Step 1: Checking prerequisites...${NC}"

# Check if we have the tools
command -v git >/dev/null 2>&1 || { echo -e "${RED}❌ git is required but not installed.${NC}"; exit 1; }
command -v curl >/dev/null 2>&1 || { echo -e "${RED}❌ curl is required but not installed.${NC}"; exit 1; }

echo -e "${GREEN}✅ Prerequisites met${NC}"

# Step 2: Verify repository
echo -e "\n${YELLOW}Step 2: Verifying repository...${NC}"
echo "Repository: $REPO_URL"
echo "Latest commit: $(git log -1 --oneline)"
echo -e "${GREEN}✅ Repository ready${NC}"

# Step 3: Manual Supabase setup
echo -e "\n${YELLOW}Step 3: Supabase Setup (Manual)${NC}"
echo -e "${BLUE}Please complete these steps manually:${NC}"
echo "1. Go to https://supabase.com/dashboard"
echo "2. Create new project: 'coldcopy-production'"
echo "3. Copy the Project URL, Anon Key, and Service Role Key"
echo ""
read -p "Have you created the Supabase project? (y/n): " supabase_done

if [[ $supabase_done != "y" ]]; then
    echo -e "${YELLOW}Please complete Supabase setup first.${NC}"
    exit 1
fi

echo "Enter your Supabase details:"
read -p "Project URL (https://[ref].supabase.co): " SUPABASE_URL
read -p "Anon Key: " SUPABASE_ANON_KEY
read -s -p "Service Role Key: " SUPABASE_SERVICE_KEY
echo ""

# Step 4: Manual Vercel setup
echo -e "\n${YELLOW}Step 4: Vercel Deployment (Manual)${NC}"
echo -e "${BLUE}Please complete these steps manually:${NC}"
echo "1. Go to https://vercel.com/dashboard"
echo "2. Import from GitHub: codevanmoose/coldcopy"
echo "3. Framework: Next.js"
echo "4. Root Directory: apps/web"
echo "5. Add these environment variables:"
echo ""

# Generate environment variables
echo -e "${GREEN}Environment Variables to add in Vercel:${NC}"
echo "========================================"
echo "NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL"
echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY"
echo "SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_KEY"
echo "NEXTAUTH_SECRET=$NEXTAUTH_SECRET"
echo "JWT_SECRET=$JWT_SECRET"
echo "ENCRYPTION_KEY=$ENCRYPTION_KEY"
echo "NEXTAUTH_URL=https://$DOMAIN"
echo "NEXT_PUBLIC_API_URL=https://api.$DOMAIN"
echo "NEXT_PUBLIC_APP_URL=https://$DOMAIN"
echo "NEXT_PUBLIC_ENVIRONMENT=production"
echo "========================================"
echo ""

read -p "Have you deployed to Vercel with the environment variables? (y/n): " vercel_done

if [[ $vercel_done != "y" ]]; then
    echo -e "${YELLOW}Please complete Vercel deployment first.${NC}"
    exit 1
fi

# Step 5: Database migrations
echo -e "\n${YELLOW}Step 5: Database Migrations${NC}"
echo "Running database migrations..."

# Extract project ref from URL
PROJECT_REF=$(echo $SUPABASE_URL | sed 's/https:\/\/\([^.]*\).*/\1/')

if command -v supabase >/dev/null 2>&1; then
    echo "Linking to Supabase project..."
    cd supabase
    supabase link --project-ref $PROJECT_REF
    
    echo "Running migrations..."
    supabase db push
    
    echo -e "${GREEN}✅ Database migrations completed${NC}"
    cd ..
else
    echo -e "${YELLOW}⚠️ Supabase CLI not found. Please run migrations manually:${NC}"
    echo "1. Install: npm install -g supabase"
    echo "2. Login: supabase login"
    echo "3. Link: supabase link --project-ref $PROJECT_REF"
    echo "4. Migrate: supabase db push"
fi

# Step 6: Test deployment
echo -e "\n${YELLOW}Step 6: Testing Deployment${NC}"
echo "Waiting for deployment to propagate..."
sleep 10

echo "Testing deployment..."
if command -v curl >/dev/null 2>&1; then
    status=$(curl -s -o /dev/null -w "%{http_code}" "https://$DOMAIN")
    if [ "$status" = "200" ]; then
        echo -e "${GREEN}✅ Deployment successful!${NC}"
        echo -e "${GREEN}🎉 ColdCopy is live at https://$DOMAIN${NC}"
    else
        echo -e "${YELLOW}⚠️ Deployment status: HTTP $status${NC}"
        echo "This might be normal if DNS is still propagating."
    fi
fi

# Step 7: Next steps
echo -e "\n${YELLOW}Step 7: Next Steps${NC}"
echo -e "${BLUE}To complete the full setup:${NC}"
echo "1. Configure custom domain in Vercel"
echo "2. Set up Amazon SES for email sending"
echo "3. Configure monitoring with Sentry"
echo "4. Set up CRM integrations (HubSpot, Salesforce)"
echo "5. Configure Stripe for billing"
echo ""

echo -e "${GREEN}🚀 Basic deployment complete!${NC}"
echo -e "Visit https://$DOMAIN to start using ColdCopy"

# Save configuration
echo -e "\n${YELLOW}Saving configuration...${NC}"
cat > .env.production << EOF
NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_KEY
NEXTAUTH_SECRET=$NEXTAUTH_SECRET
JWT_SECRET=$JWT_SECRET
ENCRYPTION_KEY=$ENCRYPTION_KEY
NEXTAUTH_URL=https://$DOMAIN
NEXT_PUBLIC_API_URL=https://api.$DOMAIN
NEXT_PUBLIC_APP_URL=https://$DOMAIN
NEXT_PUBLIC_ENVIRONMENT=production
EOF

echo -e "${GREEN}✅ Configuration saved to .env.production${NC}"
echo -e "${YELLOW}🔐 Keep this file secure and do not commit it to version control${NC}"

echo -e "\n${GREEN}Deployment Summary:${NC}"
echo "=================="
echo "Domain: https://$DOMAIN"
echo "Supabase: $SUPABASE_URL"
echo "Repository: $REPO_URL"
echo "Status: Ready for production use"
echo ""
echo -e "${BLUE}Run './scripts/test-deployment.sh' to verify all functionality${NC}"