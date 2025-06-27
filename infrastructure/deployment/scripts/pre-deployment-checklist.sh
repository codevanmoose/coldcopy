#!/bin/bash
set -euo pipefail

# Pre-Deployment Checklist Script
# This script runs through all pre-deployment checks

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CHECKLIST_LOG="/tmp/coldcopy-pre-deployment-$(date +%Y%m%d-%H%M%S).log"
FAILED_CHECKS=0
PASSED_CHECKS=0

# Function to log messages
log() {
    echo -e "$1" | tee -a "$CHECKLIST_LOG"
}

# Function to check and log results
check() {
    local description="$1"
    local command="$2"
    
    echo -n "Checking $description... "
    if eval "$command" >> "$CHECKLIST_LOG" 2>&1; then
        echo -e "${GREEN}✓${NC}"
        ((PASSED_CHECKS++))
        return 0
    else
        echo -e "${RED}✗${NC}"
        ((FAILED_CHECKS++))
        return 1
    fi
}

# Header
log "${BLUE}========================================${NC}"
log "${BLUE}   ColdCopy Pre-Deployment Checklist   ${NC}"
log "${BLUE}========================================${NC}"
log "Timestamp: $(date)"
log "Log file: $CHECKLIST_LOG"
log ""

# 1. Infrastructure Accounts
log "${YELLOW}1. Infrastructure Accounts${NC}"
check "Vercel CLI installed" "command -v vercel"
check "Supabase CLI installed" "command -v supabase"
check "Digital Ocean CLI installed" "command -v doctl"
check "Docker installed" "command -v docker"
check "Docker Compose installed" "command -v docker-compose"
log ""

# 2. Environment Files
log "${YELLOW}2. Environment Files${NC}"
check ".env.production exists" "test -f .env.production"
check ".env.local exists" "test -f apps/web/.env.local"
check "Environment variables are complete" "$SCRIPT_DIR/environment-validator.sh -q"
log ""

# 3. API Keys Validation
log "${YELLOW}3. API Keys Validation${NC}"
if [ -f .env.production ]; then
    source .env.production
    check "OpenAI API key format" "[[ \$OPENAI_API_KEY =~ ^sk- ]]"
    check "Stripe key format" "[[ \$STRIPE_SECRET_KEY =~ ^sk_live_ ]]"
    check "Supabase URL format" "[[ \$SUPABASE_URL =~ ^https://.*supabase.co$ ]]"
fi
log ""

# 4. Database Readiness
log "${YELLOW}4. Database Readiness${NC}"
check "Database migrations exist" "test -d supabase/migrations"
check "Supabase project linked" "test -f supabase/.temp/project-ref"
check "Database connection" "cd supabase && supabase db remote status"
log ""

# 5. Docker Images
log "${YELLOW}5. Docker Images${NC}"
check "API Dockerfile exists" "test -f apps/api/Dockerfile"
check "Docker daemon running" "docker ps > /dev/null"
check "Docker registry login" "docker info | grep -q 'Username'"
log ""

# 6. SSL/DNS Configuration
log "${YELLOW}6. SSL/DNS Configuration${NC}"
check "Domain DNS propagated" "dig +short coldcopy.io | grep -E '^[0-9]'"
check "API subdomain configured" "dig +short api.coldcopy.io | grep -E '^[0-9]'"
check "SSL certificate valid" "curl -s https://coldcopy.io > /dev/null"
log ""

# 7. Monitoring Setup
log "${YELLOW}7. Monitoring Setup${NC}"
check "Prometheus config exists" "test -f infrastructure/deployment/monitoring/prometheus.yml"
check "Grafana dashboards exist" "test -d infrastructure/deployment/monitoring/grafana/dashboards"
check "Alert rules configured" "test -f infrastructure/deployment/monitoring/prometheus/alerts.yml"
log ""

# 8. Backup Configuration
log "${YELLOW}8. Backup Configuration${NC}"
check "Backup script exists" "test -x $SCRIPT_DIR/database-backup.sh"
check "Restore script exists" "test -x $SCRIPT_DIR/database-restore.sh"
check "Backup encryption key set" "[[ -n \${BACKUP_ENCRYPTION_KEY:-} ]]"
log ""

# 9. Security Checks
log "${YELLOW}9. Security Checks${NC}"
check "No secrets in git" "! git grep -E '(sk_live_|AKIA|password|secret)' --cached"
check "SSH keys configured" "test -f ~/.ssh/id_rsa || test -f ~/.ssh/id_ed25519"
check "Firewall rules prepared" "test -f infrastructure/deployment/firewall-rules.txt"
log ""

# 10. CI/CD Pipeline
log "${YELLOW}10. CI/CD Pipeline${NC}"
check "GitHub Actions workflow exists" "test -f .github/workflows/deploy.yml"
check "Git repository clean" "git status --porcelain | wc -l | grep -q '^0$'"
check "On main branch" "[[ $(git branch --show-current) == 'main' ]]"
log ""

# 11. Service Dependencies
log "${YELLOW}11. Service Dependencies${NC}"
check "Redis configuration ready" "test -f infrastructure/deployment/redis/redis.conf"
check "Nginx configuration ready" "test -f infrastructure/deployment/nginx/nginx.conf"
check "PgBouncer configuration ready" "test -f infrastructure/pgbouncer/pgbouncer.ini"
log ""

# 12. Email Service
log "${YELLOW}12. Email Service${NC}"
if [ -f .env.production ]; then
    check "AWS credentials set" "[[ -n \${AWS_ACCESS_KEY_ID:-} ]] && [[ -n \${AWS_SECRET_ACCESS_KEY:-} ]]"
    check "SES region configured" "[[ -n \${AWS_REGION:-} ]]"
    check "From email configured" "[[ -n \${FROM_EMAIL:-} ]]"
fi
log ""

# Generate deployment readiness report
log ""
log "${BLUE}========================================${NC}"
log "${BLUE}        Deployment Readiness Report     ${NC}"
log "${BLUE}========================================${NC}"
log ""
log "Total checks: $((PASSED_CHECKS + FAILED_CHECKS))"
log "${GREEN}Passed: $PASSED_CHECKS${NC}"
log "${RED}Failed: $FAILED_CHECKS${NC}"
log ""

if [ $FAILED_CHECKS -eq 0 ]; then
    log "${GREEN}🎉 All checks passed! Ready for deployment.${NC}"
    log ""
    log "${YELLOW}Next steps:${NC}"
    log "1. Run: ${BLUE}./infrastructure/deployment/scripts/environment-validator.sh${NC}"
    log "2. Run: ${BLUE}./infrastructure/deployment/scripts/deploy.sh production${NC}"
    log "3. Monitor: ${BLUE}./infrastructure/deployment/scripts/health-check.sh${NC}"
    log "4. Verify: ${BLUE}./infrastructure/deployment/scripts/deployment-verifier.sh${NC}"
    exit 0
else
    log "${RED}⚠️  Some checks failed. Please resolve issues before deployment.${NC}"
    log ""
    log "${YELLOW}Failed items need attention:${NC}"
    grep "✗" "$CHECKLIST_LOG" | while read -r line; do
        log "  - $line"
    done
    log ""
    log "Check the log file for details: $CHECKLIST_LOG"
    exit 1
fi