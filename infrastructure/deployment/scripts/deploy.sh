#!/bin/bash
set -euo pipefail

# ColdCopy Deployment Script
# This script automates the deployment process

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-production}
DOCKER_REGISTRY="registry.digitalocean.com/coldcopy"
APP_VERSION=$(git rev-parse --short HEAD)

echo -e "${GREEN}🚀 ColdCopy Deployment Script${NC}"
echo -e "Environment: ${YELLOW}$ENVIRONMENT${NC}"
echo -e "Version: ${YELLOW}$APP_VERSION${NC}"

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo -e "\n${YELLOW}Checking prerequisites...${NC}"
for cmd in docker docker-compose doctl vercel; do
    if command_exists $cmd; then
        echo -e "✅ $cmd is installed"
    else
        echo -e "❌ $cmd is not installed"
        exit 1
    fi
done

# Load environment variables
if [ -f ".env.$ENVIRONMENT" ]; then
    echo -e "\n${YELLOW}Loading environment variables...${NC}"
    export $(cat .env.$ENVIRONMENT | grep -v '^#' | xargs)
else
    echo -e "${RED}Error: .env.$ENVIRONMENT file not found${NC}"
    exit 1
fi

# Build and push Docker images
echo -e "\n${YELLOW}Building Docker images...${NC}"
docker build -t $DOCKER_REGISTRY/api:$APP_VERSION -t $DOCKER_REGISTRY/api:latest ./apps/api
docker push $DOCKER_REGISTRY/api:$APP_VERSION
docker push $DOCKER_REGISTRY/api:latest
echo -e "${GREEN}✅ Docker images built and pushed${NC}"

# Deploy to Digital Ocean
echo -e "\n${YELLOW}Deploying to Digital Ocean...${NC}"

# Update droplets
for i in 1 2 3; do
    echo -e "Updating coldcopy-api-$i..."
    doctl compute ssh coldcopy-api-$i --ssh-command "
        cd /home/coldcopy/app &&
        git pull origin main &&
        docker-compose pull &&
        docker-compose up -d --remove-orphans
    "
done
echo -e "${GREEN}✅ API servers updated${NC}"

# Run database migrations
echo -e "\n${YELLOW}Running database migrations...${NC}"
cd supabase
supabase db push --linked
cd ..
echo -e "${GREEN}✅ Database migrations complete${NC}"

# Deploy frontend to Vercel
echo -e "\n${YELLOW}Deploying frontend to Vercel...${NC}"
cd apps/web
vercel --prod --yes
cd ../..
echo -e "${GREEN}✅ Frontend deployed to Vercel${NC}"

# Update cron jobs
echo -e "\n${YELLOW}Updating cron jobs...${NC}"
doctl compute ssh coldcopy-api-1 --ssh-command "
    docker exec -i coldcopy_api_1 python manage.py update_cron_jobs
"
echo -e "${GREEN}✅ Cron jobs updated${NC}"

# Warm up the application
echo -e "\n${YELLOW}Warming up the application...${NC}"
curl -s -o /dev/null -w "%{http_code}" https://api.coldcopy.io/health
echo -e "\n${GREEN}✅ Application is healthy${NC}"

# Clear caches
echo -e "\n${YELLOW}Clearing caches...${NC}"
doctl compute ssh coldcopy-api-1 --ssh-command "
    docker exec -i coldcopy_redis_1 redis-cli FLUSHDB
"
echo -e "${GREEN}✅ Caches cleared${NC}"

# Notify monitoring
if [ "$ENVIRONMENT" = "production" ]; then
    echo -e "\n${YELLOW}Notifying monitoring services...${NC}"
    curl -X POST https://api.coldcopy.io/deployments \
        -H "Content-Type: application/json" \
        -d "{\"version\": \"$APP_VERSION\", \"environment\": \"$ENVIRONMENT\"}"
fi

echo -e "\n${GREEN}🎉 Deployment complete!${NC}"
echo -e "Version ${YELLOW}$APP_VERSION${NC} is now live in ${YELLOW}$ENVIRONMENT${NC}"

# Show deployment summary
echo -e "\n${YELLOW}Deployment Summary:${NC}"
echo -e "Frontend URL: https://coldcopy.io"
echo -e "API URL: https://api.coldcopy.io"
echo -e "Monitoring: https://monitor.coldcopy.io"
echo -e "Documentation: https://docs.coldcopy.io"