#!/bin/bash
set -euo pipefail

# ColdCopy Service Health Check Script
# Monitors all services and generates health reports

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-production}
CHECK_INTERVAL=${2:-5}  # Seconds between checks
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="/tmp/coldcopy-health-$(date +%Y%m%d-%H%M%S).log"
METRICS_FILE="/tmp/coldcopy-metrics-$(date +%Y%m%d-%H%M%S).json"

# Service endpoints
declare -A SERVICES
SERVICES["API"]="https://api.coldcopy.io/health"
SERVICES["Frontend"]="https://coldcopy.io"
SERVICES["Supabase"]="${SUPABASE_URL}/rest/v1/"
SERVICES["Redis"]="redis://localhost:6379"
SERVICES["Database"]="${DATABASE_URL}"

# Service health thresholds
RESPONSE_TIME_WARNING=1000  # ms
RESPONSE_TIME_CRITICAL=3000 # ms
ERROR_RATE_WARNING=5        # %
ERROR_RATE_CRITICAL=10      # %

# Initialize metrics
declare -A SERVICE_STATUS
declare -A SERVICE_RESPONSE_TIME
declare -A SERVICE_ERROR_COUNT
declare -A SERVICE_CHECK_COUNT

# Function to log messages
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Function to check HTTP endpoint
check_http_endpoint() {
    local name=$1
    local url=$2
    local start_time=$(date +%s.%N)
    
    response=$(curl -s -o /dev/null -w "%{http_code}:%{time_total}" "$url" 2>&1) || response="000:0"
    
    local end_time=$(date +%s.%N)
    local response_time=$(echo "($end_time - $start_time) * 1000" | bc)
    
    IFS=':' read -r http_code time_total <<< "$response"
    
    if [ "$http_code" = "200" ] || [ "$http_code" = "204" ]; then
        SERVICE_STATUS[$name]="UP"
        SERVICE_RESPONSE_TIME[$name]=$response_time
        echo -e "${GREEN}✅ $name is healthy${NC} (${response_time}ms)"
    else
        SERVICE_STATUS[$name]="DOWN"
        SERVICE_ERROR_COUNT[$name]=$((${SERVICE_ERROR_COUNT[$name]:-0} + 1))
        echo -e "${RED}❌ $name is down${NC} (HTTP $http_code)"
    fi
    
    SERVICE_CHECK_COUNT[$name]=$((${SERVICE_CHECK_COUNT[$name]:-0} + 1))
}

# Function to check Redis
check_redis() {
    local name="Redis"
    local start_time=$(date +%s.%N)
    
    if redis-cli ping >/dev/null 2>&1; then
        local end_time=$(date +%s.%N)
        local response_time=$(echo "($end_time - $start_time) * 1000" | bc)
        
        SERVICE_STATUS[$name]="UP"
        SERVICE_RESPONSE_TIME[$name]=$response_time
        
        # Get Redis info
        local memory_used=$(redis-cli info memory | grep used_memory_human | cut -d: -f2 | tr -d '\r')
        local connected_clients=$(redis-cli info clients | grep connected_clients | cut -d: -f2 | tr -d '\r')
        
        echo -e "${GREEN}✅ $name is healthy${NC} (${response_time}ms, Memory: $memory_used, Clients: $connected_clients)"
    else
        SERVICE_STATUS[$name]="DOWN"
        SERVICE_ERROR_COUNT[$name]=$((${SERVICE_ERROR_COUNT[$name]:-0} + 1))
        echo -e "${RED}❌ $name is down${NC}"
    fi
    
    SERVICE_CHECK_COUNT[$name]=$((${SERVICE_CHECK_COUNT[$name]:-0} + 1))
}

# Function to check Database
check_database() {
    local name="Database"
    local start_time=$(date +%s.%N)
    
    if psql "$DATABASE_URL" -c "SELECT 1" >/dev/null 2>&1; then
        local end_time=$(date +%s.%N)
        local response_time=$(echo "($end_time - $start_time) * 1000" | bc)
        
        SERVICE_STATUS[$name]="UP"
        SERVICE_RESPONSE_TIME[$name]=$response_time
        
        # Get connection count
        local connections=$(psql "$DATABASE_URL" -t -c "SELECT count(*) FROM pg_stat_activity" 2>/dev/null | tr -d ' ')
        
        echo -e "${GREEN}✅ $name is healthy${NC} (${response_time}ms, Connections: $connections)"
    else
        SERVICE_STATUS[$name]="DOWN"
        SERVICE_ERROR_COUNT[$name]=$((${SERVICE_ERROR_COUNT[$name]:-0} + 1))
        echo -e "${RED}❌ $name is down${NC}"
    fi
    
    SERVICE_CHECK_COUNT[$name]=$((${SERVICE_CHECK_COUNT[$name]:-0} + 1))
}

# Function to check Docker containers
check_docker_containers() {
    echo -e "\n${YELLOW}Docker Container Status:${NC}"
    
    if docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "coldcopy|pgbouncer|redis"; then
        echo -e "${GREEN}Containers running${NC}"
    else
        echo -e "${YELLOW}Some containers may be down${NC}"
    fi
}

# Function to check system resources
check_system_resources() {
    echo -e "\n${YELLOW}System Resources:${NC}"
    
    # CPU usage
    if command -v top >/dev/null 2>&1; then
        cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
        if (( $(echo "$cpu_usage < 80" | bc -l) )); then
            echo -e "${GREEN}✅ CPU Usage: ${cpu_usage}%${NC}"
        else
            echo -e "${YELLOW}⚠️  High CPU Usage: ${cpu_usage}%${NC}"
        fi
    fi
    
    # Memory usage
    if command -v free >/dev/null 2>&1; then
        mem_usage=$(free | grep Mem | awk '{print ($2-$7)/$2 * 100.0}')
        if (( $(echo "$mem_usage < 80" | bc -l) )); then
            echo -e "${GREEN}✅ Memory Usage: ${mem_usage}%${NC}"
        else
            echo -e "${YELLOW}⚠️  High Memory Usage: ${mem_usage}%${NC}"
        fi
    fi
    
    # Disk usage
    disk_usage=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
    if [ "$disk_usage" -lt 80 ]; then
        echo -e "${GREEN}✅ Disk Usage: ${disk_usage}%${NC}"
    else
        echo -e "${YELLOW}⚠️  High Disk Usage: ${disk_usage}%${NC}"
    fi
}

# Function to generate metrics JSON
generate_metrics() {
    local timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    
    cat > "$METRICS_FILE" <<EOF
{
  "timestamp": "$timestamp",
  "environment": "$ENVIRONMENT",
  "services": {
EOF
    
    local first=true
    for service in "${!SERVICE_STATUS[@]}"; do
        if [ "$first" = false ]; then
            echo "," >> "$METRICS_FILE"
        fi
        first=false
        
        local error_rate=0
        if [ "${SERVICE_CHECK_COUNT[$service]}" -gt 0 ]; then
            error_rate=$(echo "scale=2; ${SERVICE_ERROR_COUNT[$service]:-0} * 100 / ${SERVICE_CHECK_COUNT[$service]}" | bc)
        fi
        
        cat >> "$METRICS_FILE" <<EOF
    "$service": {
      "status": "${SERVICE_STATUS[$service]}",
      "response_time_ms": ${SERVICE_RESPONSE_TIME[$service]:-0},
      "error_count": ${SERVICE_ERROR_COUNT[$service]:-0},
      "check_count": ${SERVICE_CHECK_COUNT[$service]},
      "error_rate": $error_rate
    }
EOF
    done
    
    cat >> "$METRICS_FILE" <<EOF
  }
}
EOF
}

# Function to send alert
send_alert() {
    local service=$1
    local status=$2
    local message=$3
    
    log "ALERT: $service is $status - $message"
    
    # Send to monitoring endpoint if available
    if [ -n "${MONITORING_WEBHOOK_URL:-}" ]; then
        curl -X POST "$MONITORING_WEBHOOK_URL" \
            -H "Content-Type: application/json" \
            -d "{
                \"service\": \"$service\",
                \"status\": \"$status\",
                \"message\": \"$message\",
                \"environment\": \"$ENVIRONMENT\",
                \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
            }" 2>/dev/null || true
    fi
}

# Header
echo -e "${BLUE}🏥 ColdCopy Health Check Monitor${NC}"
echo -e "Environment: ${YELLOW}$ENVIRONMENT${NC}"
echo -e "Check Interval: ${YELLOW}${CHECK_INTERVAL}s${NC}"
echo -e "Log: ${YELLOW}$LOG_FILE${NC}"
echo -e "Metrics: ${YELLOW}$METRICS_FILE${NC}\n"

# Main monitoring loop
iteration=0
while true; do
    iteration=$((iteration + 1))
    echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}Health Check #$iteration - $(date '+%Y-%m-%d %H:%M:%S')${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    # Check all services
    echo -e "\n${YELLOW}Service Status:${NC}"
    check_http_endpoint "API" "${SERVICES[API]}"
    check_http_endpoint "Frontend" "${SERVICES[Frontend]}"
    check_redis
    check_database
    
    # Check Docker containers
    check_docker_containers
    
    # Check system resources
    check_system_resources
    
    # Generate metrics
    generate_metrics
    
    # Check for alerts
    echo -e "\n${YELLOW}Alert Status:${NC}"
    alerts_triggered=false
    for service in "${!SERVICE_STATUS[@]}"; do
        if [ "${SERVICE_STATUS[$service]}" = "DOWN" ]; then
            send_alert "$service" "DOWN" "Service is not responding"
            alerts_triggered=true
        elif [ -n "${SERVICE_RESPONSE_TIME[$service]:-}" ]; then
            if (( $(echo "${SERVICE_RESPONSE_TIME[$service]} > $RESPONSE_TIME_CRITICAL" | bc -l) )); then
                send_alert "$service" "CRITICAL" "Response time ${SERVICE_RESPONSE_TIME[$service]}ms exceeds critical threshold"
                alerts_triggered=true
            elif (( $(echo "${SERVICE_RESPONSE_TIME[$service]} > $RESPONSE_TIME_WARNING" | bc -l) )); then
                echo -e "${YELLOW}⚠️  $service response time (${SERVICE_RESPONSE_TIME[$service]}ms) exceeds warning threshold${NC}"
            fi
        fi
    done
    
    if [ "$alerts_triggered" = false ]; then
        echo -e "${GREEN}✅ No alerts triggered${NC}"
    fi
    
    # Summary
    echo -e "\n${BLUE}Summary:${NC}"
    up_count=0
    total_count=0
    for service in "${!SERVICE_STATUS[@]}"; do
        total_count=$((total_count + 1))
        if [ "${SERVICE_STATUS[$service]}" = "UP" ]; then
            up_count=$((up_count + 1))
        fi
    done
    
    echo -e "Services: ${GREEN}$up_count/$total_count UP${NC}"
    echo -e "Metrics saved to: $METRICS_FILE"
    
    # Exit if single run mode
    if [ "${3:-}" = "--once" ]; then
        exit 0
    fi
    
    # Wait for next iteration
    echo -e "\nNext check in ${CHECK_INTERVAL} seconds... (Press Ctrl+C to stop)"
    sleep "$CHECK_INTERVAL"
done