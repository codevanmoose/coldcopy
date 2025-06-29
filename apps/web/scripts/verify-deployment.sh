#!/bin/bash

# ColdCopy Deployment Verification Script
# This script checks if your deployment is working correctly

echo "=== ColdCopy Deployment Verification ==="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Base URL (update this if using custom domain)
BASE_URL="https://coldcopy.vercel.app"

# Function to check endpoint
check_endpoint() {
    local endpoint=$1
    local description=$2
    
    echo -n "Checking $description... "
    
    response=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL$endpoint")
    
    if [ "$response" = "200" ] || [ "$response" = "307" ] || [ "$response" = "308" ]; then
        echo -e "${GREEN}✓ OK${NC} (HTTP $response)"
        return 0
    else
        echo -e "${RED}✗ FAILED${NC} (HTTP $response)"
        return 1
    fi
}

# Function to check if page loads without errors
check_page_content() {
    local endpoint=$1
    local description=$2
    
    echo -n "Loading $description... "
    
    content=$(curl -s "$BASE_URL$endpoint")
    
    if [[ $content == *"500"* ]] || [[ $content == *"Application error"* ]]; then
        echo -e "${RED}✗ ERROR${NC} (500 Server Error)"
        return 1
    elif [[ $content == *"<!DOCTYPE html>"* ]]; then
        echo -e "${GREEN}✓ OK${NC} (HTML content loaded)"
        return 0
    else
        echo -e "${YELLOW}⚠ WARNING${NC} (Unexpected response)"
        return 1
    fi
}

# Function to check API health
check_api_health() {
    echo -n "Checking API health... "
    
    response=$(curl -s "$BASE_URL/api/health" 2>/dev/null)
    
    if [[ $response == *"ok"* ]] || [[ $response == *"healthy"* ]]; then
        echo -e "${GREEN}✓ OK${NC}"
        return 0
    else
        echo -e "${YELLOW}⚠ No health endpoint${NC}"
        return 1
    fi
}

echo "Testing deployment at: $BASE_URL"
echo "================================"
echo ""

# Check main pages
check_endpoint "/" "Homepage"
check_endpoint "/login" "Login page"
check_endpoint "/signup" "Signup page"

echo ""

# Check page content
check_page_content "/" "Homepage content"

echo ""

# Check API
check_api_health

echo ""
echo "================================"

# Check environment readiness
echo ""
echo "Environment Variable Checklist:"
echo "------------------------------"
echo "Make sure you've added these critical variables in Vercel:"
echo ""
echo "□ NEXT_PUBLIC_SUPABASE_URL"
echo "□ NEXT_PUBLIC_SUPABASE_ANON_KEY" 
echo "□ SUPABASE_SERVICE_ROLE_KEY"
echo "□ NEXTAUTH_SECRET"
echo "□ JWT_SECRET"
echo ""

# Test database connection
echo "Testing database connection..."
echo -n "Checking Supabase endpoint... "

SUPABASE_URL="https://zicipvpablahehxstbfr.supabase.co"
supabase_response=$(curl -s -o /dev/null -w "%{http_code}" "$SUPABASE_URL/rest/v1/")

if [ "$supabase_response" = "200" ] || [ "$supabase_response" = "401" ]; then
    echo -e "${GREEN}✓ Supabase is reachable${NC}"
else
    echo -e "${RED}✗ Cannot reach Supabase${NC}"
fi

echo ""
echo "================================"
echo ""

# Summary
echo "Deployment Status Summary:"
echo "-------------------------"

if [ "$BASE_URL" = "https://coldcopy.vercel.app" ]; then
    echo "• URL: Vercel default domain"
    echo "• Next step: Configure custom domain (coldcopy.cc)"
else
    echo "• URL: $BASE_URL"
fi

echo ""
echo "If you see 500 errors above:"
echo "1. Add environment variables at: https://vercel.com/dashboard"
echo "2. Wait for automatic redeployment (2-3 minutes)"
echo "3. Run this script again"
echo ""
echo "Once working, your next priorities are:"
echo "• Set up Amazon SES for email functionality"
echo "• Add AI API keys (OpenAI/Anthropic)"
echo "• Configure payment processing (Stripe)"