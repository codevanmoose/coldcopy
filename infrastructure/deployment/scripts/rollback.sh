#!/bin/bash
set -euo pipefail

# ColdCopy Rollback Script
# Safely rolls back to a previous deployment version

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-production}
TARGET_VERSION=${2:-}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"
LOG_FILE="/tmp/coldcopy-rollback-$(date +%Y%m%d-%H%M%S).log"
BACKUP_DIR="/var/backups/coldcopy"

# Docker registry
DOCKER_REGISTRY="registry.digitalocean.com/coldcopy"

# Initialize log
echo "ColdCopy Rollback - $(date)" > "$LOG_FILE"
echo "Environment: $ENVIRONMENT" >> "$LOG_FILE"
echo "Target Version: $TARGET_VERSION" >> "$LOG_FILE"
echo "========================================" >> "$LOG_FILE"

# Function to log messages
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Function to get current version
get_current_version() {
    local version=$(curl -s "https://api.coldcopy.io/version" | jq -r '.version' 2>/dev/null || echo "unknown")
    echo "$version"
}

# Function to get available versions
get_available_versions() {
    echo -e "${YELLOW}Fetching available versions from registry...${NC}"
    
    # Get tags from Docker registry
    doctl registry repository list-tags api --format "Tag" --no-header | \
        grep -E '^v[0-9]+\.[0-9]+\.[0-9]+' | \
        sort -rV | \
        head -10
}

# Function to create rollback checkpoint
create_rollback_checkpoint() {
    local checkpoint_name="rollback-$(date +%Y%m%d-%H%M%S)"
    
    echo -e "${YELLOW}Creating rollback checkpoint: $checkpoint_name${NC}"
    
    # Backup current database state
    log "Backing up current database state..."
    pg_dump "$DATABASE_URL" | gzip > "$BACKUP_DIR/$checkpoint_name-db.sql.gz"
    
    # Save current configuration
    log "Saving current configuration..."
    mkdir -p "$BACKUP_DIR/$checkpoint_name"
    cp ".env.$ENVIRONMENT" "$BACKUP_DIR/$checkpoint_name/"
    
    # Save current version info
    echo "{
        \"version\": \"$(get_current_version)\",
        \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
        \"environment\": \"$ENVIRONMENT\"
    }" > "$BACKUP_DIR/$checkpoint_name/version.json"
    
    echo "$checkpoint_name"
}

# Function to rollback database
rollback_database() {
    local target_version=$1
    local backup_file="$BACKUP_DIR/version-$target_version-db.sql.gz"
    
    if [ ! -f "$backup_file" ]; then
        log "Warning: No database backup found for version $target_version"
        return 1
    fi
    
    echo -e "${YELLOW}Rolling back database to version $target_version...${NC}"
    
    # Create backup of current state first
    pg_dump "$DATABASE_URL" | gzip > "$BACKUP_DIR/pre-rollback-$(date +%Y%m%d-%H%M%S).sql.gz"
    
    # Restore target version
    gunzip -c "$backup_file" | psql "$DATABASE_URL"
    
    echo -e "${GREEN}✅ Database rolled back${NC}"
}

# Function to rollback API
rollback_api() {
    local target_version=$1
    
    echo -e "${YELLOW}Rolling back API to version $target_version...${NC}"
    
    # Update API servers
    for i in 1 2 3; do
        echo -e "Updating coldcopy-api-$i..."
        doctl compute ssh coldcopy-api-$i --ssh-command "
            cd /home/coldcopy/app &&
            docker pull $DOCKER_REGISTRY/api:$target_version &&
            docker-compose stop api &&
            docker-compose rm -f api &&
            sed -i 's|image: .*api:.*|image: $DOCKER_REGISTRY/api:$target_version|' docker-compose.yml &&
            docker-compose up -d api
        "
    done
    
    echo -e "${GREEN}✅ API servers rolled back${NC}"
}

# Function to rollback frontend
rollback_frontend() {
    local target_version=$1
    
    echo -e "${YELLOW}Rolling back frontend to version $target_version...${NC}"
    
    # For Vercel, we need to use their API or CLI
    cd "$ROOT_DIR/apps/web"
    
    # Get deployment ID for target version
    deployment_id=$(vercel list --token "$VERCEL_TOKEN" | \
        grep "$target_version" | \
        head -1 | \
        awk '{print $1}')
    
    if [ -n "$deployment_id" ]; then
        echo -e "Promoting deployment $deployment_id..."
        vercel alias set "$deployment_id" coldcopy.io --token "$VERCEL_TOKEN"
        echo -e "${GREEN}✅ Frontend rolled back${NC}"
    else
        echo -e "${RED}❌ Could not find frontend deployment for version $target_version${NC}"
        return 1
    fi
    
    cd "$ROOT_DIR"
}

# Function to verify rollback
verify_rollback() {
    local expected_version=$1
    
    echo -e "\n${YELLOW}Verifying rollback...${NC}"
    
    # Wait for services to stabilize
    sleep 10
    
    # Check API version
    actual_version=$(get_current_version)
    if [ "$actual_version" = "$expected_version" ]; then
        echo -e "${GREEN}✅ API version correct: $actual_version${NC}"
    else
        echo -e "${RED}❌ API version mismatch. Expected: $expected_version, Got: $actual_version${NC}"
        return 1
    fi
    
    # Run health check
    "$SCRIPT_DIR/health-check.sh" "$ENVIRONMENT" 5 --once
}

# Header
echo -e "${BLUE}🔄 ColdCopy Rollback Manager${NC}"
echo -e "Environment: ${YELLOW}$ENVIRONMENT${NC}"
echo -e "Current Version: ${YELLOW}$(get_current_version)${NC}"
echo -e "Log file: ${YELLOW}$LOG_FILE${NC}\n"

# Check if target version is provided
if [ -z "$TARGET_VERSION" ]; then
    echo -e "${YELLOW}Available versions for rollback:${NC}"
    get_available_versions
    echo
    read -p "Enter target version (e.g., v1.2.3): " TARGET_VERSION
    
    if [ -z "$TARGET_VERSION" ]; then
        echo -e "${RED}No version selected. Exiting.${NC}"
        exit 1
    fi
fi

# Confirm rollback
current_version=$(get_current_version)
echo -e "\n${YELLOW}⚠️  Rollback Confirmation${NC}"
echo -e "Current version: ${RED}$current_version${NC}"
echo -e "Target version: ${GREEN}$TARGET_VERSION${NC}"
echo -e "Environment: ${YELLOW}$ENVIRONMENT${NC}"
echo
read -p "Are you sure you want to rollback? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo -e "${YELLOW}Rollback cancelled.${NC}"
    exit 0
fi

# Create rollback checkpoint
echo -e "\n${YELLOW}1. Creating rollback checkpoint...${NC}"
checkpoint=$(create_rollback_checkpoint)
echo -e "${GREEN}✅ Checkpoint created: $checkpoint${NC}"

# Put site in maintenance mode
echo -e "\n${YELLOW}2. Enabling maintenance mode...${NC}"
doctl compute ssh coldcopy-api-1 --ssh-command "
    docker exec coldcopy_api_1 python manage.py maintenance on
"
echo -e "${GREEN}✅ Maintenance mode enabled${NC}"

# Perform rollback
echo -e "\n${YELLOW}3. Performing rollback...${NC}"

# Rollback API
if ! rollback_api "$TARGET_VERSION"; then
    echo -e "${RED}API rollback failed${NC}"
    exit 1
fi

# Rollback Frontend
if ! rollback_frontend "$TARGET_VERSION"; then
    echo -e "${YELLOW}⚠️  Frontend rollback failed, continuing...${NC}"
fi

# Rollback Database (if needed)
read -p "Do you need to rollback the database? (yes/no): " rollback_db
if [ "$rollback_db" = "yes" ]; then
    if ! rollback_database "$TARGET_VERSION"; then
        echo -e "${YELLOW}⚠️  Database rollback failed, continuing...${NC}"
    fi
fi

# Clear caches
echo -e "\n${YELLOW}4. Clearing caches...${NC}"
doctl compute ssh coldcopy-api-1 --ssh-command "
    docker exec coldcopy_redis_1 redis-cli FLUSHDB
"
echo -e "${GREEN}✅ Caches cleared${NC}"

# Disable maintenance mode
echo -e "\n${YELLOW}5. Disabling maintenance mode...${NC}"
doctl compute ssh coldcopy-api-1 --ssh-command "
    docker exec coldcopy_api_1 python manage.py maintenance off
"
echo -e "${GREEN}✅ Maintenance mode disabled${NC}"

# Verify rollback
echo -e "\n${YELLOW}6. Verifying rollback...${NC}"
if verify_rollback "$TARGET_VERSION"; then
    echo -e "\n${GREEN}✅ Rollback completed successfully!${NC}"
    echo -e "Version ${YELLOW}$TARGET_VERSION${NC} is now live in ${YELLOW}$ENVIRONMENT${NC}"
    
    # Send notification
    if [ -n "${DEPLOYMENT_WEBHOOK_URL:-}" ]; then
        curl -X POST "$DEPLOYMENT_WEBHOOK_URL" \
            -H "Content-Type: application/json" \
            -d "{
                \"event\": \"rollback\",
                \"environment\": \"$ENVIRONMENT\",
                \"from_version\": \"$current_version\",
                \"to_version\": \"$TARGET_VERSION\",
                \"status\": \"success\",
                \"checkpoint\": \"$checkpoint\",
                \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
            }" 2>/dev/null || true
    fi
else
    echo -e "\n${RED}⚠️  Rollback verification failed!${NC}"
    echo -e "Manual intervention may be required."
    echo -e "Checkpoint available at: $BACKUP_DIR/$checkpoint"
    
    # Send alert
    if [ -n "${DEPLOYMENT_WEBHOOK_URL:-}" ]; then
        curl -X POST "$DEPLOYMENT_WEBHOOK_URL" \
            -H "Content-Type: application/json" \
            -d "{
                \"event\": \"rollback\",
                \"environment\": \"$ENVIRONMENT\",
                \"from_version\": \"$current_version\",
                \"to_version\": \"$TARGET_VERSION\",
                \"status\": \"failed\",
                \"checkpoint\": \"$checkpoint\",
                \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
            }" 2>/dev/null || true
    fi
    
    exit 1
fi

# Post-rollback tasks
echo -e "\n${YELLOW}Post-rollback tasks:${NC}"
echo -e "1. Monitor application health"
echo -e "2. Check error logs for any issues"
echo -e "3. Verify critical user flows"
echo -e "4. Update team about the rollback"

echo -e "\n${BLUE}Rollback log saved to: $LOG_FILE${NC}"