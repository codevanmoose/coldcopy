#!/bin/bash
set -euo pipefail

# ColdCopy Environment Setup Validator
# Validates that all required services and dependencies are properly configured

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-production}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"
LOG_FILE="/tmp/coldcopy-env-validation-$(date +%Y%m%d-%H%M%S).log"

# Required environment variables
REQUIRED_ENV_VARS=(
    "DATABASE_URL"
    "SUPABASE_URL"
    "SUPABASE_SERVICE_KEY"
    "REDIS_URL"
    "AWS_ACCESS_KEY_ID"
    "AWS_SECRET_ACCESS_KEY"
    "AWS_REGION"
    "OPENAI_API_KEY"
    "ANTHROPIC_API_KEY"
    "DIGITAL_OCEAN_TOKEN"
    "SENTRY_DSN"
    "SMTP_HOST"
    "SMTP_PORT"
    "SMTP_USER"
    "SMTP_PASSWORD"
)

# Required files
REQUIRED_FILES=(
    ".env.$ENVIRONMENT"
    "docker-compose.yml"
    "apps/api/requirements.txt"
    "apps/web/package.json"
    "supabase/config.toml"
)

# Required commands
REQUIRED_COMMANDS=(
    "docker:Docker container runtime"
    "docker-compose:Docker Compose for orchestration"
    "node:Node.js runtime"
    "npm:Node package manager"
    "python3:Python 3.11+ runtime"
    "redis-cli:Redis client"
    "psql:PostgreSQL client"
    "git:Git version control"
    "curl:HTTP client"
    "jq:JSON processor"
)

# Initialize log
echo "ColdCopy Environment Validation - $(date)" > "$LOG_FILE"
echo "Environment: $ENVIRONMENT" >> "$LOG_FILE"
echo "========================================" >> "$LOG_FILE"

# Function to log messages
log() {
    echo "$1" | tee -a "$LOG_FILE"
}

# Function to log error
log_error() {
    echo -e "${RED}❌ $1${NC}" | tee -a "$LOG_FILE"
}

# Function to log success
log_success() {
    echo -e "${GREEN}✅ $1${NC}" | tee -a "$LOG_FILE"
}

# Function to log warning
log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}" | tee -a "$LOG_FILE"
}

# Function to log info
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}" | tee -a "$LOG_FILE"
}

# Header
echo -e "${BLUE}🔍 ColdCopy Environment Validator${NC}"
echo -e "Environment: ${YELLOW}$ENVIRONMENT${NC}"
echo -e "Log file: ${YELLOW}$LOG_FILE${NC}\n"

# Change to root directory
cd "$ROOT_DIR"

# 1. Check Required Commands
echo -e "${YELLOW}1. Checking Required Commands...${NC}"
COMMANDS_OK=true
for cmd_info in "${REQUIRED_COMMANDS[@]}"; do
    IFS=':' read -r cmd desc <<< "$cmd_info"
    if command -v "$cmd" >/dev/null 2>&1; then
        version=$($cmd --version 2>&1 | head -n1 || echo "version unknown")
        log_success "$desc: $version"
    else
        log_error "$desc is not installed"
        COMMANDS_OK=false
    fi
done

# 2. Check Required Files
echo -e "\n${YELLOW}2. Checking Required Files...${NC}"
FILES_OK=true
for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        log_success "Found: $file"
    else
        log_error "Missing: $file"
        FILES_OK=false
    fi
done

# 3. Check Environment Variables
echo -e "\n${YELLOW}3. Checking Environment Variables...${NC}"
ENV_OK=true
if [ -f ".env.$ENVIRONMENT" ]; then
    source ".env.$ENVIRONMENT"
    for var in "${REQUIRED_ENV_VARS[@]}"; do
        if [ -n "${!var:-}" ]; then
            # Mask sensitive values
            masked_value="${!var:0:4}****${!var: -4}"
            log_success "$var is set ($masked_value)"
        else
            log_error "$var is not set"
            ENV_OK=false
        fi
    done
else
    log_error ".env.$ENVIRONMENT file not found"
    ENV_OK=false
fi

# 4. Check Service Connectivity
echo -e "\n${YELLOW}4. Checking Service Connectivity...${NC}"

# Database
if [ -n "${DATABASE_URL:-}" ]; then
    if psql "$DATABASE_URL" -c "SELECT 1" >/dev/null 2>&1; then
        log_success "Database connection successful"
    else
        log_error "Cannot connect to database"
    fi
fi

# Redis
if [ -n "${REDIS_URL:-}" ]; then
    if redis-cli -u "$REDIS_URL" ping >/dev/null 2>&1; then
        log_success "Redis connection successful"
    else
        log_error "Cannot connect to Redis"
    fi
fi

# Supabase
if [ -n "${SUPABASE_URL:-}" ]; then
    if curl -s -f "$SUPABASE_URL/rest/v1/" >/dev/null 2>&1; then
        log_success "Supabase API accessible"
    else
        log_error "Cannot reach Supabase API"
    fi
fi

# AWS SES
if [ -n "${AWS_ACCESS_KEY_ID:-}" ]; then
    if aws ses get-send-quota >/dev/null 2>&1; then
        log_success "AWS SES configured"
    else
        log_warning "AWS SES not accessible"
    fi
fi

# 5. Check Docker Services
echo -e "\n${YELLOW}5. Checking Docker Services...${NC}"
if docker info >/dev/null 2>&1; then
    log_success "Docker daemon is running"
    
    # Check if services are defined
    if [ -f "docker-compose.yml" ]; then
        services=$(docker-compose config --services 2>/dev/null | wc -l)
        log_info "Found $services services in docker-compose.yml"
    fi
else
    log_error "Docker daemon is not running"
fi

# 6. Check Disk Space
echo -e "\n${YELLOW}6. Checking System Resources...${NC}"
disk_usage=$(df -h . | awk 'NR==2 {print $5}' | sed 's/%//')
if [ "$disk_usage" -lt 80 ]; then
    log_success "Disk usage: ${disk_usage}% (sufficient space)"
else
    log_warning "Disk usage: ${disk_usage}% (low space)"
fi

# Check memory
if command -v free >/dev/null 2>&1; then
    mem_available=$(free -m | awk 'NR==2 {print $7}')
    if [ "$mem_available" -gt 1024 ]; then
        log_success "Available memory: ${mem_available}MB"
    else
        log_warning "Low memory: ${mem_available}MB available"
    fi
fi

# 7. Check SSL Certificates
echo -e "\n${YELLOW}7. Checking SSL Certificates...${NC}"
if [ "$ENVIRONMENT" = "production" ]; then
    domains=("api.coldcopy.io" "coldcopy.io")
    for domain in "${domains[@]}"; do
        if openssl s_client -connect "$domain:443" -servername "$domain" </dev/null 2>&1 | grep -q "Verify return code: 0"; then
            log_success "SSL certificate valid for $domain"
        else
            log_warning "SSL certificate issue for $domain"
        fi
    done
fi

# 8. Check Python Dependencies
echo -e "\n${YELLOW}8. Checking Python Dependencies...${NC}"
if [ -f "apps/api/requirements.txt" ]; then
    cd apps/api
    if python3 -m pip check >/dev/null 2>&1; then
        log_success "Python dependencies satisfied"
    else
        log_warning "Some Python dependencies may be missing"
    fi
    cd "$ROOT_DIR"
fi

# 9. Check Node Dependencies
echo -e "\n${YELLOW}9. Checking Node Dependencies...${NC}"
if [ -f "apps/web/package.json" ]; then
    cd apps/web
    if npm ls >/dev/null 2>&1; then
        log_success "Node dependencies satisfied"
    else
        log_warning "Some Node dependencies may be missing"
    fi
    cd "$ROOT_DIR"
fi

# 10. Generate Summary
echo -e "\n${YELLOW}📊 Validation Summary${NC}"
echo -e "===================="

if $COMMANDS_OK && $FILES_OK && $ENV_OK; then
    log_success "Environment is properly configured for $ENVIRONMENT"
    echo -e "\n${GREEN}✨ All checks passed! Ready for deployment.${NC}"
    exit 0
else
    log_error "Environment validation failed"
    echo -e "\n${RED}⚠️  Please fix the issues above before deploying.${NC}"
    echo -e "Check the log file for details: $LOG_FILE"
    exit 1
fi