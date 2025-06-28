#!/bin/bash

# ColdCopy Background Workers Deployment Script
# Deploys workers to Digital Ocean

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
WORKER_PREFIX="coldcopy-worker"
REGION="nyc1"
IMAGE_REGISTRY="registry.digitalocean.com/coldcopy"

echo -e "${BLUE}ColdCopy Workers Deployment${NC}"
echo "============================"
echo ""

# Worker configurations
declare -A WORKERS=(
  ["email"]="2:2048:2"      # 2 vCPU, 2GB RAM, 2 instances
  ["enrichment"]="1:1024:1" # 1 vCPU, 1GB RAM, 1 instance
  ["ai"]="2:4096:1"         # 2 vCPU, 4GB RAM, 1 instance
  ["analytics"]="4:8192:1"  # 4 vCPU, 8GB RAM, 1 instance
  ["integration"]="1:2048:1" # 1 vCPU, 2GB RAM, 1 instance
  ["maintenance"]="1:1024:1" # 1 vCPU, 1GB RAM, 1 instance
)

# Function to check prerequisites
check_prerequisites() {
    echo "Checking prerequisites..."
    
    if ! command -v doctl &> /dev/null; then
        echo -e "${RED}✗ doctl CLI not found${NC}"
        exit 1
    fi
    
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}✗ Docker not found${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✓ Prerequisites met${NC}"
}

# Function to build worker image
build_worker_image() {
    echo ""
    echo "Building worker Docker image..."
    
    cd ../..
    
    # Build the worker image
    docker build -f infrastructure/docker/Dockerfile.worker -t ${IMAGE_REGISTRY}/worker:latest .
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Worker image built${NC}"
    else
        echo -e "${RED}✗ Build failed${NC}"
        exit 1
    fi
}

# Function to push image to registry
push_worker_image() {
    echo ""
    echo "Pushing image to Digital Ocean registry..."
    
    # Login to registry
    doctl registry login
    
    # Tag and push
    docker tag ${IMAGE_REGISTRY}/worker:latest ${IMAGE_REGISTRY}/worker:$(date +%Y%m%d-%H%M%S)
    docker push ${IMAGE_REGISTRY}/worker:latest
    
    echo -e "${GREEN}✓ Image pushed to registry${NC}"
}

# Function to create worker droplet
create_worker_droplet() {
    local worker_type=$1
    local config=$2
    
    IFS=':' read -r vcpu memory instances <<< "$config"
    
    # Determine droplet size
    local size=""
    case "${vcpu}:${memory}" in
        "1:1024") size="s-1vcpu-1gb" ;;
        "1:2048") size="s-1vcpu-2gb" ;;
        "2:2048") size="s-2vcpu-2gb" ;;
        "2:4096") size="s-2vcpu-4gb" ;;
        "4:8192") size="s-4vcpu-8gb" ;;
        *) echo "Unknown size configuration"; exit 1 ;;
    esac
    
    echo ""
    echo "Creating ${instances} ${worker_type} worker(s) (${size})..."
    
    for i in $(seq 1 $instances); do
        local droplet_name="${WORKER_PREFIX}-${worker_type}-${i}"
        
        # Check if droplet exists
        if doctl compute droplet list --format Name | grep -q "^${droplet_name}$"; then
            echo -e "${YELLOW}Droplet ${droplet_name} already exists${NC}"
            continue
        fi
        
        # Create droplet with user data
        doctl compute droplet create ${droplet_name} \
            --image docker-20-04 \
            --size ${size} \
            --region ${REGION} \
            --ssh-keys $(doctl compute ssh-key list --format ID --no-header | head -1) \
            --tag-names "worker,${worker_type}" \
            --user-data-file <(cat <<EOF
#!/bin/bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install doctl
cd ~
wget https://github.com/digitalocean/doctl/releases/download/v1.94.0/doctl-1.94.0-linux-amd64.tar.gz
tar xf doctl-1.94.0-linux-amd64.tar.gz
mv doctl /usr/local/bin

# Login to registry
doctl auth init --access-token ${DIGITALOCEAN_TOKEN}
doctl registry login

# Create systemd service
cat > /etc/systemd/system/coldcopy-worker.service <<'SERVICE'
[Unit]
Description=ColdCopy ${worker_type} Worker
After=docker.service
Requires=docker.service

[Service]
Type=simple
Restart=always
RestartSec=30
Environment="WORKER_TYPE=${worker_type}"
ExecStartPre=/usr/bin/docker pull ${IMAGE_REGISTRY}/worker:latest
ExecStart=/usr/bin/docker run --rm \
  --name coldcopy-${worker_type}-worker \
  --env-file /etc/coldcopy/worker.env \
  -e WORKER_TYPE=${worker_type} \
  ${IMAGE_REGISTRY}/worker:latest \
  node dist/workers/${worker_type}-worker.js
ExecStop=/usr/bin/docker stop coldcopy-${worker_type}-worker

[Install]
WantedBy=multi-user.target
SERVICE

# Create environment file
mkdir -p /etc/coldcopy
cat > /etc/coldcopy/worker.env <<'ENV'
NODE_ENV=production
REDIS_URL=${REDIS_URL}
DATABASE_URL=${DATABASE_URL}
AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}
AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}
OPENAI_API_KEY=${OPENAI_API_KEY}
ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
ENV

# Start service
systemctl daemon-reload
systemctl enable coldcopy-worker
systemctl start coldcopy-worker
EOF
        )
        
        echo -e "${GREEN}✓ Created ${droplet_name}${NC}"
    done
}

# Function to setup monitoring
setup_monitoring() {
    echo ""
    echo "Setting up monitoring..."
    
    # Add monitoring agent to all worker droplets
    local droplet_ids=$(doctl compute droplet list --tag-name worker --format ID --no-header)
    
    for id in $droplet_ids; do
        doctl monitoring droplet install-agent $id || true
    done
    
    echo -e "${GREEN}✓ Monitoring configured${NC}"
}

# Function to create load balancer (optional)
create_load_balancer() {
    echo ""
    echo "Creating load balancer for workers..."
    
    # This is optional - only needed if workers expose HTTP endpoints
    local lb_name="${WORKER_PREFIX}-lb"
    
    if doctl compute load-balancer list --format Name | grep -q "^${lb_name}$"; then
        echo -e "${YELLOW}Load balancer already exists${NC}"
        return
    fi
    
    doctl compute load-balancer create \
        --name ${lb_name} \
        --region ${REGION} \
        --tag-name worker \
        --forwarding-rules "entry_protocol:http,entry_port:80,target_protocol:http,target_port:3001" \
        --health-check "protocol:http,port:3001,path:/health,check_interval_seconds:10"
    
    echo -e "${GREEN}✓ Load balancer created${NC}"
}

# Function to display worker status
display_status() {
    echo ""
    echo "Worker Status:"
    echo "============="
    
    doctl compute droplet list --tag-name worker --format "Name,PublicIPv4,Status,Memory,VCPUs"
    
    echo ""
    echo "To check worker logs:"
    echo "doctl compute ssh ${WORKER_PREFIX}-email-1 --ssh-command 'journalctl -u coldcopy-worker -f'"
}

# Main deployment flow
main() {
    check_prerequisites
    
    echo ""
    echo -e "${YELLOW}This will deploy ColdCopy background workers${NC}"
    echo -e "${YELLOW}Workers to deploy:${NC}"
    for worker in "${!WORKERS[@]}"; do
        IFS=':' read -r vcpu memory instances <<< "${WORKERS[$worker]}"
        echo "  - $worker: ${instances} instance(s) (${vcpu} vCPU, ${memory}MB RAM)"
    done
    echo ""
    echo -e "${YELLOW}Estimated cost: ~\$100-150/month${NC}"
    echo ""
    read -p "Continue? (y/n) " -n 1 -r
    echo ""
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Deployment cancelled"
        exit 0
    fi
    
    build_worker_image
    push_worker_image
    
    # Deploy each worker type
    for worker_type in "${!WORKERS[@]}"; do
        create_worker_droplet "$worker_type" "${WORKERS[$worker_type]}"
    done
    
    setup_monitoring
    # create_load_balancer # Optional
    
    display_status
    
    echo ""
    echo -e "${GREEN}Worker deployment complete!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Verify workers are running: check logs"
    echo "2. Monitor queue metrics in dashboard"
    echo "3. Set up alerts for failed jobs"
    echo "4. Configure auto-scaling if needed"
}

# Run main function
main