#!/bin/bash

# ColdCopy Deployment Testing Script
echo "🚀 Testing ColdCopy Deployment..."

# Configuration
DOMAIN="https://coldcopy.cc"
API_DOMAIN="https://api.coldcopy.cc"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test functions
test_frontend() {
    echo -e "\n${YELLOW}Testing Frontend...${NC}"
    
    # Test main domain
    echo "Testing $DOMAIN"
    status=$(curl -s -o /dev/null -w "%{http_code}" "$DOMAIN")
    if [ "$status" = "200" ]; then
        echo -e "${GREEN}✅ Frontend accessible${NC}"
    else
        echo -e "${RED}❌ Frontend failed (HTTP $status)${NC}"
        return 1
    fi
    
    # Test login page
    echo "Testing login page"
    status=$(curl -s -o /dev/null -w "%{http_code}" "$DOMAIN/login")
    if [ "$status" = "200" ]; then
        echo -e "${GREEN}✅ Login page accessible${NC}"
    else
        echo -e "${RED}❌ Login page failed (HTTP $status)${NC}"
        return 1
    fi
    
    return 0
}

test_api_health() {
    echo -e "\n${YELLOW}Testing API Health...${NC}"
    
    # Test health endpoint
    echo "Testing API health endpoint"
    response=$(curl -s "$DOMAIN/api/health")
    if echo "$response" | grep -q "ok\|healthy\|success"; then
        echo -e "${GREEN}✅ API health check passed${NC}"
    else
        echo -e "${RED}❌ API health check failed${NC}"
        echo "Response: $response"
        return 1
    fi
    
    return 0
}

test_database_connection() {
    echo -e "\n${YELLOW}Testing Database Connection...${NC}"
    
    # Test workspaces endpoint (requires DB)
    echo "Testing database connectivity"
    status=$(curl -s -o /dev/null -w "%{http_code}" "$DOMAIN/api/workspaces")
    if [ "$status" = "401" ] || [ "$status" = "200" ]; then
        echo -e "${GREEN}✅ Database connection working${NC}"
    else
        echo -e "${RED}❌ Database connection failed (HTTP $status)${NC}"
        return 1
    fi
    
    return 0
}

test_build_status() {
    echo -e "\n${YELLOW}Testing Build Status...${NC}"
    
    # Check if Next.js hydration works
    echo "Testing Next.js hydration"
    content=$(curl -s "$DOMAIN")
    if echo "$content" | grep -q "__NEXT_DATA__"; then
        echo -e "${GREEN}✅ Next.js build working${NC}"
    else
        echo -e "${RED}❌ Next.js build failed${NC}"
        return 1
    fi
    
    return 0
}

test_ssl_certificate() {
    echo -e "\n${YELLOW}Testing SSL Certificate...${NC}"
    
    # Test SSL
    echo "Testing SSL certificate"
    ssl_info=$(curl -vI "$DOMAIN" 2>&1 | grep -E "SSL|TLS|certificate")
    if echo "$ssl_info" | grep -q "TLS"; then
        echo -e "${GREEN}✅ SSL certificate valid${NC}"
    else
        echo -e "${RED}❌ SSL certificate issues${NC}"
        return 1
    fi
    
    return 0
}

# Run all tests
echo "Starting deployment tests for ColdCopy..."

# Initialize test results
failed_tests=0

# Run tests
if ! test_frontend; then
    ((failed_tests++))
fi

if ! test_api_health; then
    ((failed_tests++))
fi

if ! test_database_connection; then
    ((failed_tests++))
fi

if ! test_build_status; then
    ((failed_tests++))
fi

if ! test_ssl_certificate; then
    ((failed_tests++))
fi

# Summary
echo -e "\n${YELLOW}=== DEPLOYMENT TEST SUMMARY ===${NC}"
if [ $failed_tests -eq 0 ]; then
    echo -e "${GREEN}🎉 All tests passed! Deployment successful.${NC}"
    echo -e "${GREEN}✅ Frontend: Working${NC}"
    echo -e "${GREEN}✅ API: Healthy${NC}"
    echo -e "${GREEN}✅ Database: Connected${NC}"
    echo -e "${GREEN}✅ Build: Successful${NC}"
    echo -e "${GREEN}✅ SSL: Valid${NC}"
    
    echo -e "\n${GREEN}🚀 ColdCopy is ready for production use!${NC}"
    echo -e "Dashboard: $DOMAIN"
    echo -e "API: $DOMAIN/api"
    
    exit 0
else
    echo -e "${RED}❌ $failed_tests test(s) failed. Deployment needs attention.${NC}"
    echo -e "\n${YELLOW}Please check:${NC}"
    echo -e "1. Supabase project is active and configured"
    echo -e "2. Environment variables are set correctly in Vercel"
    echo -e "3. Database migrations have been run"
    echo -e "4. DNS propagation is complete"
    
    exit 1
fi