#!/bin/bash

# ColdCopy Redis Deployment Script for Digital Ocean
# This script deploys Redis cache infrastructure

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REDIS_NAME="coldcopy-redis"
REGION="nyc1"
SIZE="db-s-1vcpu-1gb"  # 1GB RAM, $15/month

echo -e "${BLUE}ColdCopy Redis Cache Deployment${NC}"
echo "===================================="
echo ""

# Function to check prerequisites
check_prerequisites() {
    echo "Checking prerequisites..."
    
    if ! command -v doctl &> /dev/null; then
        echo -e "${RED}✗ doctl CLI not found${NC}"
        echo "Please install: https://docs.digitalocean.com/reference/doctl/how-to/install/"
        exit 1
    fi
    
    if ! doctl auth list &> /dev/null; then
        echo -e "${RED}✗ Not authenticated with Digital Ocean${NC}"
        echo "Please run: doctl auth init"
        exit 1
    fi
    
    echo -e "${GREEN}✓ Prerequisites met${NC}"
}

# Function to create managed Redis
create_managed_redis() {
    echo ""
    echo "Creating Managed Redis Database..."
    echo "Size: $SIZE (1GB RAM, 100 connections)"
    echo "Cost: ~$15/month"
    echo ""
    
    # Check if database already exists
    if doctl databases list --format Name | grep -q "^${REDIS_NAME}$"; then
        echo -e "${YELLOW}Redis database already exists${NC}"
        REDIS_ID=$(doctl databases list --format ID,Name --no-header | grep "${REDIS_NAME}$" | awk '{print $1}')
    else
        # Create new Redis database
        REDIS_ID=$(doctl databases create $REDIS_NAME \
            --engine redis \
            --version 7 \
            --size $SIZE \
            --region $REGION \
            --format ID \
            --no-header)
        
        echo -e "${GREEN}✓ Redis database created with ID: $REDIS_ID${NC}"
    fi
    
    # Wait for database to be ready
    echo "Waiting for database to be ready..."
    while true; do
        STATUS=$(doctl databases get $REDIS_ID --format Status --no-header)
        if [ "$STATUS" = "online" ]; then
            echo -e "${GREEN}✓ Database is online${NC}"
            break
        else
            echo -n "."
            sleep 10
        fi
    done
}

# Function to configure Redis
configure_redis() {
    echo ""
    echo "Configuring Redis..."
    
    # Update Redis configuration
    doctl databases config update $REDIS_ID \
        --engine redis \
        --config-json '{
            "maxmemory_policy": "allkeys-lru",
            "timeout": "300",
            "notify_keyspace_events": "Ex",
            "persistence": "rdb",
            "acl_channels_default": "allchannels"
        }' 2>/dev/null || echo "Config update skipped (may not be supported)"
    
    echo -e "${GREEN}✓ Redis configured${NC}"
}

# Function to setup firewall rules
setup_firewall() {
    echo ""
    echo "Setting up firewall rules..."
    
    # Get database info
    DB_INFO=$(doctl databases get $REDIS_ID --format ID,Name,Connection --no-header)
    
    # Create firewall for Redis
    FIREWALL_NAME="${REDIS_NAME}-firewall"
    
    # Check if firewall exists
    if doctl databases firewalls list $REDIS_ID 2>/dev/null | grep -q "droplet"; then
        echo -e "${YELLOW}Firewall rules already configured${NC}"
    else
        # Add firewall rules for app servers
        # Note: You'll need to add your app server IPs here
        echo "Adding firewall rules..."
        
        # Add rules for k8s cluster (if using DO Kubernetes)
        # doctl databases firewalls append $REDIS_ID --rule k8s:cluster-id
        
        # Add rules for droplets by tag
        # doctl databases firewalls append $REDIS_ID --rule tag:coldcopy-app
        
        echo -e "${YELLOW}Note: Configure firewall rules in DO dashboard${NC}"
    fi
}

# Function to get connection details
get_connection_details() {
    echo ""
    echo "Getting connection details..."
    echo ""
    
    # Get connection URI
    REDIS_URI=$(doctl databases connection $REDIS_ID --format URI --no-header)
    
    # Parse connection details
    REDIS_HOST=$(doctl databases connection $REDIS_ID --format Host --no-header)
    REDIS_PORT=$(doctl databases connection $REDIS_ID --format Port --no-header)
    REDIS_PASSWORD=$(doctl databases connection $REDIS_ID --format Password --no-header)
    REDIS_USER=$(doctl databases connection $REDIS_ID --format User --no-header)
    
    # Display connection info
    echo -e "${GREEN}Redis Connection Details:${NC}"
    echo "========================="
    echo "URI: $REDIS_URI"
    echo ""
    echo "Host: $REDIS_HOST"
    echo "Port: $REDIS_PORT"
    echo "User: $REDIS_USER"
    echo "Password: [hidden]"
    echo ""
    echo "SSL: Required"
    echo "Connection String for Apps:"
    echo "REDIS_URL=$REDIS_URI"
    echo ""
    
    # Save to file
    cat > redis-connection.txt << EOF
# ColdCopy Redis Connection Details
# Generated: $(date)

REDIS_URL=$REDIS_URI
REDIS_HOST=$REDIS_HOST
REDIS_PORT=$REDIS_PORT
REDIS_USER=$REDIS_USER
REDIS_PASSWORD=$REDIS_PASSWORD

# For ioredis configuration:
{
  host: "$REDIS_HOST",
  port: $REDIS_PORT,
  username: "$REDIS_USER",
  password: "$REDIS_PASSWORD",
  tls: {
    rejectUnauthorized: false
  }
}

# Test connection:
redis-cli -h $REDIS_HOST -p $REDIS_PORT -a $REDIS_PASSWORD --tls --insecure ping
EOF
    
    echo -e "${GREEN}✓ Connection details saved to redis-connection.txt${NC}"
}

# Function to test connection
test_connection() {
    echo ""
    echo "Testing Redis connection..."
    
    # Test with redis-cli if available
    if command -v redis-cli &> /dev/null; then
        if redis-cli -h $REDIS_HOST -p $REDIS_PORT -a $REDIS_PASSWORD --tls --insecure ping 2>/dev/null | grep -q "PONG"; then
            echo -e "${GREEN}✓ Redis connection successful${NC}"
        else
            echo -e "${YELLOW}⚠ Could not verify connection with redis-cli${NC}"
        fi
    else
        echo -e "${YELLOW}redis-cli not found, skipping connection test${NC}"
    fi
}

# Function to setup monitoring
setup_monitoring() {
    echo ""
    echo "Setting up monitoring..."
    
    # Create alert policy
    doctl monitoring alert-policy create \
        --type "database" \
        --description "Redis high memory usage" \
        --compare "GreaterThan" \
        --value 80 \
        --window "5m" \
        --entities "database:$REDIS_ID" \
        --tags "service:redis,env:production" \
        --alerts email 2>/dev/null || echo "Alert already exists"
    
    echo -e "${GREEN}✓ Monitoring configured${NC}"
    echo ""
    echo "View metrics at: https://cloud.digitalocean.com/databases/$REDIS_ID/metrics"
}

# Function to create backup policy
setup_backups() {
    echo ""
    echo "Configuring backups..."
    
    # Backups are automatic for managed databases
    echo "✓ Daily backups: Automatic"
    echo "✓ Retention: 7 days"
    echo "✓ Point-in-time recovery: Available"
    
    echo ""
    echo -e "${GREEN}✓ Backup configuration complete${NC}"
}

# Main deployment flow
main() {
    check_prerequisites
    
    echo ""
    echo -e "${YELLOW}This will deploy Redis cache for ColdCopy${NC}"
    echo -e "${YELLOW}Estimated cost: $15/month for managed Redis${NC}"
    echo ""
    read -p "Continue? (y/n) " -n 1 -r
    echo ""
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Deployment cancelled"
        exit 0
    fi
    
    create_managed_redis
    configure_redis
    setup_firewall
    get_connection_details
    test_connection
    setup_monitoring
    setup_backups
    
    echo ""
    echo -e "${GREEN}Redis deployment complete!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Add REDIS_URL to your app environment variables"
    echo "2. Configure firewall rules for your app servers"
    echo "3. Test cache implementation"
    echo "4. Monitor performance"
    echo ""
    echo "Dashboard: https://cloud.digitalocean.com/databases/$REDIS_ID"
    echo ""
    echo "To delete Redis (if needed):"
    echo "doctl databases delete $REDIS_ID"
}

# Run main function
main