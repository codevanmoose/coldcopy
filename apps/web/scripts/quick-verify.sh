#!/bin/bash

# ColdCopy Quick Deployment Verification
# A simple bash script for basic deployment checks

echo "🚀 ColdCopy Quick Deployment Check"
echo "=================================="

# Default URLs
FRONTEND_URL="${FRONTEND_URL:-https://coldcopy-moose.vercel.app}"
API_URL="${API_URL:-https://api.coldcopy.cc}"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
PASSED=0
FAILED=0

# Test function
test_endpoint() {
    local name="$1"
    local url="$2"
    local expected_status="${3:-200}"
    
    echo -n "Testing $name... "
    
    # Make the request
    response=$(curl -s -o /dev/null -w "%{http_code}" "$url" -H "User-Agent: ColdCopy-Quick-Check")
    
    if [ "$response" = "$expected_status" ]; then
        echo -e "${GREEN}✓ PASSED${NC} (Status: $response)"
        ((PASSED++))
    else
        echo -e "${RED}✗ FAILED${NC} (Expected: $expected_status, Got: $response)"
        ((FAILED++))
    fi
}

# Run tests
echo ""
echo "Frontend URL: $FRONTEND_URL"
echo "API URL: $API_URL"
echo ""

# Frontend tests
test_endpoint "Frontend Homepage" "$FRONTEND_URL" "200"
test_endpoint "Frontend Health" "$FRONTEND_URL/api/health" "200"
test_endpoint "Frontend Favicon" "$FRONTEND_URL/favicon.ico" "200"
test_endpoint "Frontend Manifest" "$FRONTEND_URL/manifest.json" "200"

# API tests (if API URL is different from frontend)
if [ "$API_URL" != "$FRONTEND_URL" ]; then
    test_endpoint "API Health" "$API_URL/health" "200"
fi

# Summary
echo ""
echo "=================================="
echo "Summary:"
echo -e "${GREEN}Passed: $PASSED${NC}"
if [ $FAILED -gt 0 ]; then
    echo -e "${RED}Failed: $FAILED${NC}"
else
    echo -e "${GREEN}All tests passed!${NC}"
fi

# Exit with error if any tests failed
if [ $FAILED -gt 0 ]; then
    exit 1
fi