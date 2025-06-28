#!/bin/bash

# ColdCopy Digital Ocean Deployment Script
# This script deploys ColdCopy to Digital Ocean App Platform

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="coldcopy-app"
GITHUB_REPO="codevanmoose/coldcopy"
REGION="nyc1"

echo -e "${BLUE}ColdCopy Digital Ocean Deployment${NC}"
echo "===================================="
echo ""

# Check prerequisites
check_prerequisites() {
    echo "Checking prerequisites..."
    
    # Check if doctl is installed
    if ! command -v doctl &> /dev/null; then
        echo -e "${RED}✗ doctl CLI not found${NC}"
        echo "Please install doctl: https://docs.digitalocean.com/reference/doctl/how-to/install/"
        exit 1
    fi
    
    # Check if authenticated
    if ! doctl auth list &> /dev/null; then
        echo -e "${RED}✗ Not authenticated with Digital Ocean${NC}"
        echo "Please run: doctl auth init"
        exit 1
    fi
    
    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}✗ Docker not found${NC}"
        echo "Please install Docker: https://docs.docker.com/get-docker/"
        exit 1
    fi
    
    echo -e "${GREEN}✓ All prerequisites met${NC}"
}

# Build and test Docker image locally
build_docker_image() {
    echo ""
    echo "Building Docker image locally..."
    
    cd ../..
    docker build -f infrastructure/docker/Dockerfile -t coldcopy:latest .
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Docker image built successfully${NC}"
    else
        echo -e "${RED}✗ Docker build failed${NC}"
        exit 1
    fi
}

# Run tests
run_tests() {
    echo ""
    echo "Running tests..."
    
    # Run unit tests
    cd apps/web
    npm test --passWithNoTests
    
    # Run build
    npm run build
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Tests passed${NC}"
    else
        echo -e "${RED}✗ Tests failed${NC}"
        exit 1
    fi
    
    cd ../..
}

# Create or update app
deploy_app() {
    echo ""
    echo "Deploying to Digital Ocean..."
    
    # Check if app exists
    if doctl apps list --format Name | grep -q "^${APP_NAME}$"; then
        echo "Updating existing app..."
        APP_ID=$(doctl apps list --format ID,Name --no-header | grep "${APP_NAME}$" | awk '{print $1}')
        doctl apps update $APP_ID --spec infrastructure/deployment/app.yaml
    else
        echo "Creating new app..."
        doctl apps create --spec infrastructure/deployment/app.yaml
        APP_ID=$(doctl apps list --format ID,Name --no-header | grep "${APP_NAME}$" | awk '{print $1}')
    fi
    
    echo -e "${GREEN}✓ App deployed with ID: $APP_ID${NC}"
}

# Configure environment variables
configure_env_vars() {
    echo ""
    echo "Configuring environment variables..."
    
    # List of required environment variables
    cat << EOF
Please set the following environment variables in the Digital Ocean dashboard:

1. Go to: https://cloud.digitalocean.com/apps/$APP_ID/settings
2. Click on the 'web' component
3. Add the following environment variables:

Required:
- DATABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- NEXTAUTH_SECRET
- JWT_SECRET
- ENCRYPTION_KEY
- AWS_ACCESS_KEY_ID
- AWS_SECRET_ACCESS_KEY
- AWS_REGION
- SES_CONFIGURATION_SET
- SES_FROM_EMAIL
- OPENAI_API_KEY
- ANTHROPIC_API_KEY
- STRIPE_SECRET_KEY
- STRIPE_WEBHOOK_SECRET
- CRON_SECRET

Optional:
- HUNTER_API_KEY
- CLEARBIT_API_KEY
- APOLLO_API_KEY
- LINKEDIN_CLIENT_ID
- LINKEDIN_CLIENT_SECRET
- TWITTER_API_KEY
- TWITTER_API_SECRET
- SENTRY_DSN
EOF
}

# Set up domains
configure_domains() {
    echo ""
    echo "Configuring domains..."
    
    # Add domains to app
    doctl apps update $APP_ID --spec infrastructure/deployment/app.yaml
    
    echo -e "${YELLOW}Please update your DNS records:${NC}"
    echo "1. Create A record: api.coldcopy.cc -> App's IP address"
    echo "2. Create A record: track.coldcopy.cc -> App's IP address"
    echo ""
    echo "Get the IP address from: https://cloud.digitalocean.com/apps/$APP_ID/settings"
}

# Monitor deployment
monitor_deployment() {
    echo ""
    echo "Monitoring deployment..."
    echo "This may take 5-10 minutes..."
    
    # Wait for deployment to complete
    while true; do
        STATUS=$(doctl apps get $APP_ID --format "UpdatedAt,Status" --no-header | awk '{print $2}')
        
        if [ "$STATUS" = "active" ]; then
            echo -e "${GREEN}✓ Deployment successful!${NC}"
            break
        elif [ "$STATUS" = "error" ]; then
            echo -e "${RED}✗ Deployment failed${NC}"
            echo "Check logs: doctl apps logs $APP_ID"
            exit 1
        else
            echo -n "."
            sleep 10
        fi
    done
}

# Post-deployment verification
verify_deployment() {
    echo ""
    echo "Verifying deployment..."
    
    # Get app URL
    APP_URL=$(doctl apps get $APP_ID --format "LiveURL" --no-header)
    
    # Check health endpoint
    if curl -s "${APP_URL}/api/health" | grep -q "ok"; then
        echo -e "${GREEN}✓ Health check passed${NC}"
    else
        echo -e "${RED}✗ Health check failed${NC}"
    fi
    
    echo ""
    echo "Deployment Summary:"
    echo "=================="
    echo "App ID: $APP_ID"
    echo "App URL: $APP_URL"
    echo "Dashboard: https://cloud.digitalocean.com/apps/$APP_ID"
}

# Main deployment flow
main() {
    check_prerequisites
    
    echo ""
    echo -e "${YELLOW}This will deploy ColdCopy to Digital Ocean App Platform${NC}"
    echo -e "${YELLOW}Estimated cost: \$40-100/month depending on usage${NC}"
    read -p "Continue? (y/n) " -n 1 -r
    echo ""
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Deployment cancelled"
        exit 0
    fi
    
    build_docker_image
    run_tests
    deploy_app
    configure_env_vars
    configure_domains
    monitor_deployment
    verify_deployment
    
    echo ""
    echo -e "${GREEN}Deployment complete!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Configure environment variables in DO dashboard"
    echo "2. Update DNS records for custom domains"
    echo "3. Configure Stripe webhooks to: ${APP_URL}/api/webhooks/stripe"
    echo "4. Configure SES webhooks to: ${APP_URL}/api/webhooks/ses"
    echo "5. Monitor logs: doctl apps logs $APP_ID --follow"
}

# Run main function
main