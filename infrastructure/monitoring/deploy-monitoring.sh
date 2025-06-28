#!/bin/bash

# ColdCopy Monitoring Infrastructure Deployment Script
# Deploys Prometheus, Grafana, and Alertmanager for comprehensive monitoring

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
MONITORING_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${MONITORING_DIR}/.env"
DOCKER_COMPOSE_FILE="${MONITORING_DIR}/docker-compose.yml"

echo -e "${BLUE}ColdCopy Monitoring Infrastructure Deployment${NC}"
echo "=============================================="
echo ""

# Function to log messages
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

# Function to check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        error "Docker not found. Please install Docker first."
        exit 1
    fi
    
    # Check if Docker Compose is installed
    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose not found. Please install Docker Compose first."
        exit 1
    fi
    
    # Check if Docker daemon is running
    if ! docker info &> /dev/null; then
        error "Docker daemon is not running. Please start Docker first."
        exit 1
    fi
    
    log "Prerequisites check passed"
}

# Function to create environment file
create_env_file() {
    log "Creating environment configuration..."
    
    if [ ! -f "$ENV_FILE" ]; then
        cat > "$ENV_FILE" << EOF
# ColdCopy Monitoring Environment Configuration

# Prometheus Configuration
PROMETHEUS_AUTH_TOKEN=your_prometheus_auth_token_here

# Grafana Configuration
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=change_me_please
GRAFANA_CLOUD_USERNAME=your_grafana_cloud_username
GRAFANA_CLOUD_API_KEY=your_grafana_cloud_api_key

# Alertmanager Email Configuration
ALERT_EMAIL_FROM=alerts@coldcopy.cc
ALERT_EMAIL_USERNAME=alerts@coldcopy.cc
ALERT_EMAIL_PASSWORD=your_email_password_here
DEFAULT_ALERT_EMAIL=admin@coldcopy.cc
CRITICAL_ALERT_EMAIL=critical@coldcopy.cc
SECURITY_ALERT_EMAIL=security@coldcopy.cc

# SMTP Configuration for Grafana
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=alerts@coldcopy.cc
SMTP_PASSWORD=your_smtp_password_here
SMTP_FROM_ADDRESS=alerts@coldcopy.cc

# Slack Integration (optional)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK

# Redis Configuration (if using Redis)
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=your_redis_password_here
EOF
        
        warn "Environment file created at $ENV_FILE"
        warn "Please edit the file and update the configuration values before proceeding."
        echo ""
        echo "Key values to update:"
        echo "  - PROMETHEUS_AUTH_TOKEN: Generate a secure token for Prometheus scraping"
        echo "  - GRAFANA_ADMIN_PASSWORD: Set a strong password for Grafana admin"
        echo "  - Email settings: Configure SMTP for alert notifications"
        echo "  - Slack webhook: Add Slack integration URL (optional)"
        echo ""
        read -p "Press Enter after updating the environment file..."
    else
        log "Environment file already exists at $ENV_FILE"
    fi
}

# Function to create necessary directories
create_directories() {
    log "Creating necessary directories..."
    
    mkdir -p "${MONITORING_DIR}/prometheus/data"
    mkdir -p "${MONITORING_DIR}/grafana/data"
    mkdir -p "${MONITORING_DIR}/grafana/datasources"
    mkdir -p "${MONITORING_DIR}/alertmanager/data"
    mkdir -p "${MONITORING_DIR}/loki/data"
    mkdir -p "${MONITORING_DIR}/nginx/ssl"
    
    # Set proper permissions
    chmod 777 "${MONITORING_DIR}/prometheus/data"
    chmod 777 "${MONITORING_DIR}/grafana/data"
    chmod 777 "${MONITORING_DIR}/alertmanager/data"
    chmod 777 "${MONITORING_DIR}/loki/data"
    
    log "Directories created successfully"
}

# Function to create Grafana datasource configuration
create_grafana_datasources() {
    log "Creating Grafana datasource configuration..."
    
    cat > "${MONITORING_DIR}/grafana/datasources/prometheus.yml" << EOF
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: true
    
  - name: Loki
    type: loki
    access: proxy
    url: http://loki:3100
    editable: true
EOF
    
    log "Grafana datasources configured"
}

# Function to create Loki configuration
create_loki_config() {
    log "Creating Loki configuration..."
    
    mkdir -p "${MONITORING_DIR}/loki"
    cat > "${MONITORING_DIR}/loki/loki-config.yml" << EOF
auth_enabled: false

server:
  http_listen_port: 3100

ingester:
  lifecycler:
    address: 127.0.0.1
    ring:
      kvstore:
        store: inmemory
      replication_factor: 1
    final_sleep: 0s
  chunk_idle_period: 1h
  max_chunk_age: 1h
  chunk_target_size: 1048576
  chunk_retain_period: 30s
  max_transfer_retries: 0

schema_config:
  configs:
    - from: 2020-10-24
      store: boltdb-shipper
      object_store: filesystem
      schema: v11
      index:
        prefix: index_
        period: 24h

storage_config:
  boltdb_shipper:
    active_index_directory: /loki/boltdb-shipper-active
    cache_location: /loki/boltdb-shipper-cache
    shared_store: filesystem
  filesystem:
    directory: /loki/chunks

limits_config:
  enforce_metric_name: false
  reject_old_samples: true
  reject_old_samples_max_age: 168h

chunk_store_config:
  max_look_back_period: 0s

table_manager:
  retention_deletes_enabled: false
  retention_period: 0s

ruler:
  storage:
    type: local
    local:
      directory: /loki/rules
  rule_path: /loki/rules-temp
  alertmanager_url: http://alertmanager:9093
  ring:
    kvstore:
      store: inmemory
  enable_api: true
EOF
    
    log "Loki configuration created"
}

# Function to create Promtail configuration
create_promtail_config() {
    log "Creating Promtail configuration..."
    
    mkdir -p "${MONITORING_DIR}/promtail"
    cat > "${MONITORING_DIR}/promtail/promtail-config.yml" << EOF
server:
  http_listen_port: 9080
  grpc_listen_port: 0

positions:
  filename: /tmp/positions.yaml

clients:
  - url: http://loki:3100/loki/api/v1/push

scrape_configs:
  - job_name: containers
    static_configs:
      - targets:
          - localhost
        labels:
          job: containerlogs
          __path__: /var/lib/docker/containers/*/*log

    pipeline_stages:
      - json:
          expressions:
            output: log
            stream: stream
            attrs:
      - json:
          expressions:
            tag:
          source: attrs
      - regex:
          expression: (?P<container_name>(?:[^|]*))\|
          source: tag
      - timestamp:
          format: RFC3339Nano
          source: time
      - labels:
          stream:
          container_name:
      - output:
          source: output

  - job_name: syslog
    static_configs:
      - targets:
          - localhost
        labels:
          job: syslog
          __path__: /var/log/syslog
EOF
    
    log "Promtail configuration created"
}

# Function to create Nginx configuration
create_nginx_config() {
    log "Creating Nginx reverse proxy configuration..."
    
    mkdir -p "${MONITORING_DIR}/nginx"
    cat > "${MONITORING_DIR}/nginx/nginx.conf" << EOF
events {
    worker_connections 1024;
}

http {
    upstream prometheus {
        server prometheus:9090;
    }
    
    upstream grafana {
        server grafana:3000;
    }
    
    upstream alertmanager {
        server alertmanager:9093;
    }
    
    server {
        listen 80;
        server_name prometheus.coldcopy.cc;
        
        location / {
            proxy_pass http://prometheus;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
        }
        
        location /health {
            access_log off;
            return 200 "healthy\n";
            add_header Content-Type text/plain;
        }
    }
    
    server {
        listen 80;
        server_name grafana.coldcopy.cc;
        
        location / {
            proxy_pass http://grafana;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
        }
    }
    
    server {
        listen 80;
        server_name alertmanager.coldcopy.cc;
        
        location / {
            proxy_pass http://alertmanager;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
        }
    }
}
EOF
    
    log "Nginx configuration created"
}

# Function to deploy monitoring stack
deploy_stack() {
    log "Deploying monitoring stack..."
    
    cd "$MONITORING_DIR"
    
    # Pull latest images
    log "Pulling Docker images..."
    docker-compose pull
    
    # Start services
    log "Starting monitoring services..."
    docker-compose --env-file "$ENV_FILE" up -d
    
    # Wait for services to be ready
    log "Waiting for services to start..."
    sleep 30
    
    # Check service health
    check_service_health
    
    log "Monitoring stack deployed successfully!"
}

# Function to check service health
check_service_health() {
    log "Checking service health..."
    
    services=("prometheus:9090" "grafana:3000" "alertmanager:9093")
    
    for service in "${services[@]}"; do
        IFS=':' read -r name port <<< "$service"
        
        if curl -f "http://localhost:$port" &> /dev/null; then
            log "$name is healthy"
        else
            warn "$name might not be ready yet"
        fi
    done
}

# Function to show access information
show_access_info() {
    echo ""
    echo -e "${BLUE}Monitoring Services Access Information${NC}"
    echo "======================================"
    echo ""
    echo "Prometheus:    http://localhost:9090"
    echo "Grafana:       http://localhost:3000"
    echo "               Username: admin"
    echo "               Password: (check .env file)"
    echo "Alertmanager:  http://localhost:9093"
    echo ""
    echo "With custom domains (if configured):"
    echo "Prometheus:    http://prometheus.coldcopy.cc"
    echo "Grafana:       http://grafana.coldcopy.cc"
    echo "Alertmanager:  http://alertmanager.coldcopy.cc"
    echo ""
    echo -e "${YELLOW}Next Steps:${NC}"
    echo "1. Import Grafana dashboards from the dashboards/ directory"
    echo "2. Configure alert notification channels in Alertmanager"
    echo "3. Set up DNS records for custom domains"
    echo "4. Configure SSL certificates for production use"
    echo ""
}

# Function to stop monitoring stack
stop_stack() {
    log "Stopping monitoring stack..."
    cd "$MONITORING_DIR"
    docker-compose down
    log "Monitoring stack stopped"
}

# Function to restart monitoring stack
restart_stack() {
    log "Restarting monitoring stack..."
    stop_stack
    deploy_stack
}

# Function to show logs
show_logs() {
    local service="$1"
    cd "$MONITORING_DIR"
    
    if [ -n "$service" ]; then
        docker-compose logs -f "$service"
    else
        docker-compose logs -f
    fi
}

# Function to backup monitoring data
backup_data() {
    log "Creating backup of monitoring data..."
    
    backup_dir="${MONITORING_DIR}/backups/$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$backup_dir"
    
    # Backup Prometheus data
    docker run --rm -v "${MONITORING_DIR}_prometheus_data:/data" -v "$backup_dir:/backup" alpine tar czf /backup/prometheus-data.tar.gz -C /data .
    
    # Backup Grafana data
    docker run --rm -v "${MONITORING_DIR}_grafana_data:/data" -v "$backup_dir:/backup" alpine tar czf /backup/grafana-data.tar.gz -C /data .
    
    # Backup Alertmanager data
    docker run --rm -v "${MONITORING_DIR}_alertmanager_data:/data" -v "$backup_dir:/backup" alpine tar czf /backup/alertmanager-data.tar.gz -C /data .
    
    log "Backup created at $backup_dir"
}

# Main execution
case "${1:-deploy}" in
    "deploy")
        check_prerequisites
        create_env_file
        create_directories
        create_grafana_datasources
        create_loki_config
        create_promtail_config
        create_nginx_config
        deploy_stack
        show_access_info
        ;;
    "stop")
        stop_stack
        ;;
    "restart")
        restart_stack
        ;;
    "logs")
        show_logs "$2"
        ;;
    "backup")
        backup_data
        ;;
    "health")
        check_service_health
        ;;
    *)
        echo "Usage: $0 {deploy|stop|restart|logs [service]|backup|health}"
        echo ""
        echo "Commands:"
        echo "  deploy   - Deploy the complete monitoring stack"
        echo "  stop     - Stop all monitoring services"
        echo "  restart  - Restart all monitoring services"
        echo "  logs     - Show logs for all services or specific service"
        echo "  backup   - Create backup of monitoring data"
        echo "  health   - Check health of all services"
        exit 1
        ;;
esac