#!/bin/bash
set -euo pipefail

# ColdCopy Quick Setup Script
# Rapidly sets up individual services or the entire stack

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Configuration
SERVICE=${1:-all}
ENVIRONMENT=${2:-development}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Function to print header
print_header() {
    echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}$1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

# Function to check prerequisites
check_prerequisites() {
    local missing=false
    
    echo -e "${YELLOW}Checking prerequisites...${NC}"
    
    for cmd in docker docker-compose git npm python3 redis-cli psql; do
        if command -v "$cmd" >/dev/null 2>&1; then
            echo -e "${GREEN}✅ $cmd is installed${NC}"
        else
            echo -e "${RED}❌ $cmd is missing${NC}"
            missing=true
        fi
    done
    
    if [ "$missing" = true ]; then
        echo -e "\n${RED}Please install missing prerequisites before continuing.${NC}"
        exit 1
    fi
}

# Function to setup environment
setup_environment() {
    print_header "Setting up environment files"
    
    cd "$ROOT_DIR"
    
    # Create .env files if they don't exist
    if [ ! -f ".env.$ENVIRONMENT" ]; then
        echo -e "${YELLOW}Creating .env.$ENVIRONMENT from template...${NC}"
        if [ -f ".env.example" ]; then
            cp .env.example ".env.$ENVIRONMENT"
            echo -e "${GREEN}✅ Created .env.$ENVIRONMENT${NC}"
            echo -e "${YELLOW}⚠️  Please update the values in .env.$ENVIRONMENT${NC}"
        else
            echo -e "${RED}❌ .env.example not found${NC}"
            exit 1
        fi
    else
        echo -e "${GREEN}✅ .env.$ENVIRONMENT already exists${NC}"
    fi
}

# Function to setup database
setup_database() {
    print_header "Setting up Database"
    
    cd "$ROOT_DIR"
    
    # Start Supabase
    echo -e "${YELLOW}Starting Supabase...${NC}"
    cd supabase
    npx supabase start
    
    # Run migrations
    echo -e "${YELLOW}Running database migrations...${NC}"
    npx supabase db push
    
    # Seed database in development
    if [ "$ENVIRONMENT" = "development" ]; then
        echo -e "${YELLOW}Seeding database...${NC}"
        if [ -f "seed.sql" ]; then
            npx supabase db seed
        fi
    fi
    
    cd "$ROOT_DIR"
    echo -e "${GREEN}✅ Database setup complete${NC}"
}

# Function to setup Redis
setup_redis() {
    print_header "Setting up Redis"
    
    cd "$ROOT_DIR/infrastructure"
    
    # Create Redis config if it doesn't exist
    if [ ! -f "redis/redis.conf" ]; then
        mkdir -p redis
        cat > redis/redis.conf <<EOF
# Redis configuration for ColdCopy
bind 0.0.0.0
protected-mode yes
port 6379
tcp-backlog 511
timeout 0
tcp-keepalive 300
daemonize no
supervised no
pidfile /var/run/redis_6379.pid
loglevel notice
logfile ""
databases 16
save 900 1
save 300 10
save 60 10000
stop-writes-on-bgsave-error yes
rdbcompression yes
rdbchecksum yes
dbfilename dump.rdb
dir ./
maxmemory 256mb
maxmemory-policy allkeys-lru
EOF
        echo -e "${GREEN}✅ Created Redis configuration${NC}"
    fi
    
    # Start Redis container
    echo -e "${YELLOW}Starting Redis container...${NC}"
    docker run -d \
        --name coldcopy-redis \
        -p 6379:6379 \
        -v "$PWD/redis/redis.conf:/usr/local/etc/redis/redis.conf" \
        -v "$PWD/redis/data:/data" \
        redis:7-alpine redis-server /usr/local/etc/redis/redis.conf
    
    echo -e "${GREEN}✅ Redis is running${NC}"
}

# Function to setup PgBouncer
setup_pgbouncer() {
    print_header "Setting up PgBouncer"
    
    cd "$ROOT_DIR/infrastructure/pgbouncer"
    
    if [ -f "setup.sh" ]; then
        echo -e "${YELLOW}Running PgBouncer setup script...${NC}"
        bash setup.sh
    else
        echo -e "${YELLOW}Starting PgBouncer with Docker Compose...${NC}"
        docker-compose up -d
    fi
    
    echo -e "${GREEN}✅ PgBouncer is running${NC}"
}

# Function to setup API
setup_api() {
    print_header "Setting up API Service"
    
    cd "$ROOT_DIR/apps/api"
    
    # Create virtual environment
    echo -e "${YELLOW}Creating Python virtual environment...${NC}"
    python3 -m venv venv
    source venv/bin/activate
    
    # Install dependencies
    echo -e "${YELLOW}Installing Python dependencies...${NC}"
    pip install --upgrade pip
    pip install -r requirements.txt
    pip install -r requirements-dev.txt
    
    # Run migrations
    echo -e "${YELLOW}Running API migrations...${NC}"
    alembic upgrade head
    
    # Start API in development mode
    if [ "$ENVIRONMENT" = "development" ]; then
        echo -e "${YELLOW}Starting API in development mode...${NC}"
        nohup uvicorn main:app --reload --host 0.0.0.0 --port 8000 > api.log 2>&1 &
        echo $! > api.pid
        echo -e "${GREEN}✅ API is running on http://localhost:8000${NC}"
    else
        echo -e "${YELLOW}Building API Docker image...${NC}"
        docker build -t coldcopy-api:latest .
        docker run -d \
            --name coldcopy-api \
            --env-file "../../.env.$ENVIRONMENT" \
            -p 8000:8000 \
            coldcopy-api:latest
        echo -e "${GREEN}✅ API container is running${NC}"
    fi
}

# Function to setup Frontend
setup_frontend() {
    print_header "Setting up Frontend"
    
    cd "$ROOT_DIR/apps/web"
    
    # Install dependencies
    echo -e "${YELLOW}Installing Node dependencies...${NC}"
    npm install
    
    # Build frontend
    echo -e "${YELLOW}Building frontend...${NC}"
    npm run build
    
    # Start frontend
    if [ "$ENVIRONMENT" = "development" ]; then
        echo -e "${YELLOW}Starting frontend in development mode...${NC}"
        nohup npm run dev > frontend.log 2>&1 &
        echo $! > frontend.pid
        echo -e "${GREEN}✅ Frontend is running on http://localhost:3000${NC}"
    else
        echo -e "${YELLOW}Starting frontend in production mode...${NC}"
        nohup npm start > frontend.log 2>&1 &
        echo $! > frontend.pid
        echo -e "${GREEN}✅ Frontend is running on http://localhost:3000${NC}"
    fi
}

# Function to setup email service
setup_email() {
    print_header "Setting up Email Service"
    
    cd "$ROOT_DIR/infrastructure/email"
    
    if [ -f "setup.sh" ]; then
        echo -e "${YELLOW}Running email setup script...${NC}"
        bash setup.sh
    else
        echo -e "${YELLOW}Building email service...${NC}"
        docker build -t coldcopy-email:latest .
        docker run -d \
            --name coldcopy-email \
            --env-file "../../.env.$ENVIRONMENT" \
            coldcopy-email:latest
    fi
    
    echo -e "${GREEN}✅ Email service is running${NC}"
}

# Function to setup backup service
setup_backup() {
    print_header "Setting up Backup Service"
    
    cd "$ROOT_DIR/infrastructure/backup"
    
    if [ -f "setup.sh" ]; then
        echo -e "${YELLOW}Running backup setup script...${NC}"
        bash setup.sh
    else
        echo -e "${YELLOW}Starting backup service...${NC}"
        docker-compose up -d
    fi
    
    echo -e "${GREEN}✅ Backup service is running${NC}"
}

# Function to setup all services
setup_all() {
    print_header "Setting up ColdCopy - Complete Stack"
    
    check_prerequisites
    setup_environment
    setup_database
    setup_redis
    setup_pgbouncer
    setup_api
    setup_frontend
    setup_email
    setup_backup
    
    print_header "🎉 ColdCopy Setup Complete!"
    
    echo -e "${GREEN}All services are running!${NC}\n"
    echo -e "Frontend: ${BLUE}http://localhost:3000${NC}"
    echo -e "API: ${BLUE}http://localhost:8000${NC}"
    echo -e "API Docs: ${BLUE}http://localhost:8000/docs${NC}"
    echo -e "Supabase Studio: ${BLUE}http://localhost:54323${NC}"
    echo -e "\n${YELLOW}Next steps:${NC}"
    echo -e "1. Update environment variables in .env.$ENVIRONMENT"
    echo -e "2. Run health check: ${BLUE}./health-check.sh${NC}"
    echo -e "3. Verify deployment: ${BLUE}./deployment-verifier.sh${NC}"
}

# Function to show usage
show_usage() {
    echo -e "${BLUE}ColdCopy Quick Setup Script${NC}"
    echo -e "\nUsage: $0 [service] [environment]"
    echo -e "\nServices:"
    echo -e "  ${YELLOW}all${NC}        - Setup complete stack (default)"
    echo -e "  ${YELLOW}database${NC}   - Setup Supabase database"
    echo -e "  ${YELLOW}redis${NC}      - Setup Redis cache"
    echo -e "  ${YELLOW}pgbouncer${NC}  - Setup PgBouncer connection pooling"
    echo -e "  ${YELLOW}api${NC}        - Setup API service"
    echo -e "  ${YELLOW}frontend${NC}   - Setup frontend application"
    echo -e "  ${YELLOW}email${NC}      - Setup email service"
    echo -e "  ${YELLOW}backup${NC}     - Setup backup service"
    echo -e "\nEnvironments:"
    echo -e "  ${YELLOW}development${NC} - Local development (default)"
    echo -e "  ${YELLOW}staging${NC}     - Staging environment"
    echo -e "  ${YELLOW}production${NC}  - Production environment"
    echo -e "\nExamples:"
    echo -e "  $0                    # Setup everything for development"
    echo -e "  $0 api staging        # Setup only API for staging"
    echo -e "  $0 frontend production # Setup only frontend for production"
}

# Main execution
echo -e "${MAGENTA}🚀 ColdCopy Quick Setup${NC}"
echo -e "Service: ${YELLOW}$SERVICE${NC}"
echo -e "Environment: ${YELLOW}$ENVIRONMENT${NC}"

case "$SERVICE" in
    all)
        setup_all
        ;;
    database|db)
        check_prerequisites
        setup_environment
        setup_database
        ;;
    redis)
        check_prerequisites
        setup_redis
        ;;
    pgbouncer)
        check_prerequisites
        setup_environment
        setup_pgbouncer
        ;;
    api)
        check_prerequisites
        setup_environment
        setup_api
        ;;
    frontend|web)
        check_prerequisites
        setup_environment
        setup_frontend
        ;;
    email)
        check_prerequisites
        setup_environment
        setup_email
        ;;
    backup)
        check_prerequisites
        setup_environment
        setup_backup
        ;;
    help|--help|-h)
        show_usage
        exit 0
        ;;
    *)
        echo -e "${RED}Unknown service: $SERVICE${NC}"
        show_usage
        exit 1
        ;;
esac

echo -e "\n${GREEN}✨ Setup completed successfully!${NC}"