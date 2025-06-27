#!/bin/bash
set -euo pipefail

# ColdCopy Deployment Verification Script
# Verifies that a deployment was successful and all services are operational

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-production}
VERSION=${2:-latest}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"
LOG_FILE="/tmp/coldcopy-deploy-verify-$(date +%Y%m%d-%H%M%S).log"

# Test configuration
MAX_RETRIES=5
RETRY_DELAY=10
SMOKE_TEST_TIMEOUT=30

# Service URLs
API_URL="https://api.coldcopy.io"
FRONTEND_URL="https://coldcopy.io"
if [ "$ENVIRONMENT" = "staging" ]; then
    API_URL="https://api-staging.coldcopy.io"
    FRONTEND_URL="https://staging.coldcopy.io"
fi

# Initialize log
echo "ColdCopy Deployment Verification - $(date)" > "$LOG_FILE"
echo "Environment: $ENVIRONMENT" >> "$LOG_FILE"
echo "Version: $VERSION" >> "$LOG_FILE"
echo "========================================" >> "$LOG_FILE"

# Function to log messages
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Function to retry command
retry_command() {
    local command=$1
    local description=$2
    local retries=0
    
    while [ $retries -lt $MAX_RETRIES ]; do
        if eval "$command"; then
            return 0
        else
            retries=$((retries + 1))
            if [ $retries -lt $MAX_RETRIES ]; then
                log "Retry $retries/$MAX_RETRIES for: $description"
                sleep $RETRY_DELAY
            fi
        fi
    done
    
    return 1
}

# Header
echo -e "${BLUE}🔍 ColdCopy Deployment Verifier${NC}"
echo -e "Environment: ${YELLOW}$ENVIRONMENT${NC}"
echo -e "Version: ${YELLOW}$VERSION${NC}"
echo -e "Log file: ${YELLOW}$LOG_FILE${NC}\n"

# 1. Version Verification
echo -e "${YELLOW}1. Verifying Deployment Version...${NC}"
api_version=$(curl -s "$API_URL/version" | jq -r '.version' 2>/dev/null || echo "unknown")
if [ "$api_version" = "$VERSION" ] || [ "$VERSION" = "latest" ]; then
    echo -e "${GREEN}✅ API version verified: $api_version${NC}"
else
    echo -e "${RED}❌ Version mismatch. Expected: $VERSION, Got: $api_version${NC}"
fi

# 2. Service Health Checks
echo -e "\n${YELLOW}2. Running Service Health Checks...${NC}"

# API Health
if retry_command "curl -sf '$API_URL/health' > /dev/null" "API health check"; then
    response=$(curl -s "$API_URL/health")
    status=$(echo "$response" | jq -r '.status' 2>/dev/null || echo "unknown")
    if [ "$status" = "healthy" ]; then
        echo -e "${GREEN}✅ API is healthy${NC}"
        
        # Check sub-components
        db_status=$(echo "$response" | jq -r '.database' 2>/dev/null || echo "unknown")
        redis_status=$(echo "$response" | jq -r '.redis' 2>/dev/null || echo "unknown")
        
        [ "$db_status" = "connected" ] && echo -e "  ${GREEN}✓ Database: connected${NC}" || echo -e "  ${RED}✗ Database: $db_status${NC}"
        [ "$redis_status" = "connected" ] && echo -e "  ${GREEN}✓ Redis: connected${NC}" || echo -e "  ${RED}✗ Redis: $redis_status${NC}"
    else
        echo -e "${YELLOW}⚠️  API responded but status is: $status${NC}"
    fi
else
    echo -e "${RED}❌ API health check failed${NC}"
fi

# Frontend Health
if retry_command "curl -sf '$FRONTEND_URL' > /dev/null" "Frontend check"; then
    echo -e "${GREEN}✅ Frontend is accessible${NC}"
else
    echo -e "${RED}❌ Frontend is not accessible${NC}"
fi

# 3. Database Migrations
echo -e "\n${YELLOW}3. Verifying Database Migrations...${NC}"
migration_status=$(curl -s "$API_URL/admin/migrations/status" \
    -H "Authorization: Bearer $ADMIN_TOKEN" 2>/dev/null | jq -r '.status' || echo "unknown")

if [ "$migration_status" = "up-to-date" ]; then
    echo -e "${GREEN}✅ Database migrations are up to date${NC}"
else
    echo -e "${YELLOW}⚠️  Migration status: $migration_status${NC}"
fi

# 4. Critical Endpoints Test
echo -e "\n${YELLOW}4. Testing Critical API Endpoints...${NC}"

endpoints=(
    "GET:/api/workspaces:List workspaces"
    "GET:/api/leads:List leads"
    "GET:/api/campaigns:List campaigns"
    "GET:/api/auth/session:Check session"
)

for endpoint_info in "${endpoints[@]}"; do
    IFS=':' read -r method path description <<< "$endpoint_info"
    
    if curl -sf -X "$method" "$API_URL$path" \
        -H "Authorization: Bearer $TEST_API_KEY" \
        -o /dev/null; then
        echo -e "${GREEN}✅ $description ($method $path)${NC}"
    else
        echo -e "${RED}❌ $description ($method $path) failed${NC}"
    fi
done

# 5. Background Jobs
echo -e "\n${YELLOW}5. Verifying Background Jobs...${NC}"

# Check Celery workers
worker_status=$(curl -s "$API_URL/admin/workers/status" \
    -H "Authorization: Bearer $ADMIN_TOKEN" 2>/dev/null | jq -r '.active_workers' || echo "0")

if [ "$worker_status" -gt 0 ]; then
    echo -e "${GREEN}✅ Celery workers active: $worker_status${NC}"
else
    echo -e "${RED}❌ No active Celery workers found${NC}"
fi

# Check cron jobs
cron_status=$(curl -s "$API_URL/admin/cron/status" \
    -H "Authorization: Bearer $ADMIN_TOKEN" 2>/dev/null | jq -r '.active_jobs' || echo "0")

if [ "$cron_status" -gt 0 ]; then
    echo -e "${GREEN}✅ Cron jobs configured: $cron_status${NC}"
else
    echo -e "${YELLOW}⚠️  No active cron jobs found${NC}"
fi

# 6. Email Service Test
echo -e "\n${YELLOW}6. Testing Email Service...${NC}"

test_email="deployment-test-$(date +%s)@coldcopy.io"
email_test_response=$(curl -s -X POST "$API_URL/admin/email/test" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"to\": \"$test_email\", \"template\": \"deployment_test\"}" 2>/dev/null)

if echo "$email_test_response" | jq -e '.success' >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Email service is operational${NC}"
else
    echo -e "${YELLOW}⚠️  Email service test returned: $email_test_response${NC}"
fi

# 7. Cache Verification
echo -e "\n${YELLOW}7. Verifying Cache System...${NC}"

cache_stats=$(curl -s "$API_URL/api/cache/stats" \
    -H "Authorization: Bearer $ADMIN_TOKEN" 2>/dev/null)

if echo "$cache_stats" | jq -e '.connected' >/dev/null 2>&1; then
    hit_rate=$(echo "$cache_stats" | jq -r '.hit_rate' || echo "0")
    echo -e "${GREEN}✅ Cache system operational (Hit rate: ${hit_rate}%)${NC}"
else
    echo -e "${RED}❌ Cache system not responding${NC}"
fi

# 8. SSL Certificate Check
echo -e "\n${YELLOW}8. Verifying SSL Certificates...${NC}"

domains=("$API_URL" "$FRONTEND_URL")
for domain in "${domains[@]}"; do
    domain_name=$(echo "$domain" | sed 's|https://||')
    cert_expiry=$(echo | openssl s_client -servername "$domain_name" -connect "$domain_name:443" 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
    
    if [ -n "$cert_expiry" ]; then
        expiry_epoch=$(date -d "$cert_expiry" +%s 2>/dev/null || date -j -f "%b %d %H:%M:%S %Y %Z" "$cert_expiry" +%s 2>/dev/null)
        current_epoch=$(date +%s)
        days_until_expiry=$(( (expiry_epoch - current_epoch) / 86400 ))
        
        if [ $days_until_expiry -gt 30 ]; then
            echo -e "${GREEN}✅ $domain_name SSL valid for $days_until_expiry days${NC}"
        else
            echo -e "${YELLOW}⚠️  $domain_name SSL expires in $days_until_expiry days${NC}"
        fi
    else
        echo -e "${RED}❌ Could not verify SSL for $domain_name${NC}"
    fi
done

# 9. Performance Benchmarks
echo -e "\n${YELLOW}9. Running Performance Benchmarks...${NC}"

# API response time
start_time=$(date +%s%N)
curl -s "$API_URL/health" > /dev/null
end_time=$(date +%s%N)
response_time=$(( (end_time - start_time) / 1000000 ))

if [ $response_time -lt 1000 ]; then
    echo -e "${GREEN}✅ API response time: ${response_time}ms${NC}"
else
    echo -e "${YELLOW}⚠️  API response time: ${response_time}ms (slow)${NC}"
fi

# Frontend load time
start_time=$(date +%s%N)
curl -s "$FRONTEND_URL" > /dev/null
end_time=$(date +%s%N)
load_time=$(( (end_time - start_time) / 1000000 ))

if [ $load_time -lt 3000 ]; then
    echo -e "${GREEN}✅ Frontend load time: ${load_time}ms${NC}"
else
    echo -e "${YELLOW}⚠️  Frontend load time: ${load_time}ms (slow)${NC}"
fi

# 10. Smoke Tests
echo -e "\n${YELLOW}10. Running Smoke Tests...${NC}"

# Test user authentication flow
auth_test=$(curl -s -X POST "$API_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email": "test@coldcopy.io", "password": "test123"}' 2>/dev/null)

if echo "$auth_test" | jq -e '.token' >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Authentication flow working${NC}"
else
    echo -e "${YELLOW}⚠️  Authentication test returned unexpected response${NC}"
fi

# Test lead creation
lead_test=$(curl -s -X POST "$API_URL/api/leads" \
    -H "Authorization: Bearer $TEST_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{"email": "verify@example.com", "first_name": "Deployment", "last_name": "Test"}' 2>/dev/null)

if echo "$lead_test" | jq -e '.id' >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Lead creation working${NC}"
    # Clean up test lead
    lead_id=$(echo "$lead_test" | jq -r '.id')
    curl -s -X DELETE "$API_URL/api/leads/$lead_id" \
        -H "Authorization: Bearer $TEST_API_KEY" > /dev/null 2>&1
else
    echo -e "${YELLOW}⚠️  Lead creation test returned unexpected response${NC}"
fi

# Summary
echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}Deployment Verification Summary${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Count successes and failures
success_count=$(grep -c "✅" "$LOG_FILE" || true)
warning_count=$(grep -c "⚠️" "$LOG_FILE" || true)
failure_count=$(grep -c "❌" "$LOG_FILE" || true)

echo -e "Results:"
echo -e "  ${GREEN}✅ Success: $success_count${NC}"
echo -e "  ${YELLOW}⚠️  Warnings: $warning_count${NC}"
echo -e "  ${RED}❌ Failures: $failure_count${NC}"

if [ $failure_count -eq 0 ]; then
    echo -e "\n${GREEN}✨ Deployment verification PASSED!${NC}"
    echo -e "Version $VERSION is successfully deployed to $ENVIRONMENT"
    
    # Send success notification
    if [ -n "${DEPLOYMENT_WEBHOOK_URL:-}" ]; then
        curl -X POST "$DEPLOYMENT_WEBHOOK_URL" \
            -H "Content-Type: application/json" \
            -d "{
                \"environment\": \"$ENVIRONMENT\",
                \"version\": \"$VERSION\",
                \"status\": \"success\",
                \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
            }" 2>/dev/null || true
    fi
    
    exit 0
else
    echo -e "\n${RED}⚠️  Deployment verification FAILED!${NC}"
    echo -e "Please check the log file: $LOG_FILE"
    
    # Send failure notification
    if [ -n "${DEPLOYMENT_WEBHOOK_URL:-}" ]; then
        curl -X POST "$DEPLOYMENT_WEBHOOK_URL" \
            -H "Content-Type: application/json" \
            -d "{
                \"environment\": \"$ENVIRONMENT\",
                \"version\": \"$VERSION\",
                \"status\": \"failed\",
                \"failures\": $failure_count,
                \"warnings\": $warning_count,
                \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
            }" 2>/dev/null || true
    fi
    
    exit 1
fi