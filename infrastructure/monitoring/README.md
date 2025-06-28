# ColdCopy Monitoring Infrastructure

This directory contains the complete monitoring infrastructure for ColdCopy, including Prometheus, Grafana, Alertmanager, and associated configuration files.

## 🚀 Quick Start

```bash
# 1. Deploy the monitoring stack
./deploy-monitoring.sh deploy

# 2. Access the services
# Prometheus: http://localhost:9090
# Grafana: http://localhost:3000 (admin/password from .env)
# Alertmanager: http://localhost:9093
```

## 📊 Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   ColdCopy App  │───▶│    Prometheus    │───▶│     Grafana     │
│  (Metrics API)  │    │   (Collection)   │    │ (Visualization) │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌──────────────────┐    ┌─────────────────┐
                       │   Alertmanager   │───▶│ Notifications   │
                       │    (Alerting)    │    │ (Email/Slack)   │
                       └──────────────────┘    └─────────────────┘
```

## 🔧 Components

### Prometheus (Metrics Collection)
- **Purpose**: Collects and stores time-series metrics
- **Port**: 9090
- **Config**: `prometheus/prometheus.yml`
- **Rules**: `prometheus/rules/coldcopy-alerts.yml`

**Key Features**:
- Application metrics scraping from `/api/metrics`
- System metrics via node_exporter
- Redis and PostgreSQL metrics (optional)
- 30-day data retention
- Remote write to Grafana Cloud

### Grafana (Visualization)
- **Purpose**: Dashboards and data visualization
- **Port**: 3000
- **Dashboards**: `grafana/dashboards/`
- **Default Login**: admin / (see .env file)

**Pre-built Dashboards**:
- System Overview: HTTP requests, response times, errors
- Business Metrics: Active workspaces, campaigns, emails sent
- Database Performance: Connections, query times, cache hit ratio

### Alertmanager (Notifications)
- **Purpose**: Alert routing and notifications
- **Port**: 9093
- **Config**: `alertmanager/alertmanager.yml`

**Alert Channels**:
- Email notifications for all severity levels
- Slack integration for team channels
- PagerDuty integration (configurable)

## 📈 Metrics Collected

### Application Metrics
```yaml
# HTTP Request Metrics
coldcopy_http_requests_total        # Total HTTP requests by method, route, status
coldcopy_http_request_duration     # Request duration histogram

# Database Metrics
coldcopy_database_connections_active  # Active DB connections
coldcopy_database_query_duration      # Query execution time

# Email Metrics
coldcopy_emails_sent_total           # Emails sent by workspace, campaign
coldcopy_email_queue_size           # Current email queue size

# AI Metrics
coldcopy_ai_requests_total          # AI requests by provider, model
coldcopy_ai_tokens_used_total       # AI tokens consumed

# Business Metrics
coldcopy_active_workspaces          # Number of active workspaces
coldcopy_campaigns_active           # Active campaigns
coldcopy_leads_total               # Total leads created

# Security Metrics
coldcopy_authentication_attempts_total  # Auth attempts by status
coldcopy_rate_limit_hits_total         # Rate limit violations
coldcopy_suspicious_activity_total     # Security events
```

### System Metrics (via node_exporter)
- CPU usage and load averages
- Memory utilization
- Disk space and I/O
- Network traffic
- System uptime

## 🚨 Alerting Rules

### Critical Alerts (Immediate Response)
- **ApplicationDown**: Application not responding
- **CriticalErrorRate**: Error rate > 10%
- **UnhandledExceptions**: Any unhandled exceptions
- **CriticalEmailQueueBacklog**: Email queue > 5000

### Warning Alerts (Monitor & Investigate)
- **HighErrorRate**: Error rate > 5%
- **HighResponseTime**: 95th percentile > 2s
- **EmailQueueBacklog**: Email queue > 1000
- **HighDatabaseConnections**: Connections > 80
- **LowCacheHitRatio**: Cache hit ratio < 90%

### Security Alerts
- **SuspiciousActivity**: Any suspicious events detected
- **FailedAuthenticationAttempts**: High failed login rate
- **HighRateLimitHits**: Excessive rate limiting

## 🔐 Security Configuration

### Prometheus Security
```yaml
# API endpoint protection
PROMETHEUS_AUTH_TOKEN=your_secure_token

# Only allow specific scraping targets
static_configs:
  - targets: ['coldcopy.cc']
```

### Grafana Security
```yaml
# Admin credentials
GF_SECURITY_ADMIN_USER=admin
GF_SECURITY_ADMIN_PASSWORD=strong_password

# Disable signups and anonymous access
GF_USERS_ALLOW_SIGN_UP=false
GF_AUTH_ANONYMOUS_ENABLED=false
```

### Alertmanager Security
```yaml
# Email configuration
ALERT_EMAIL_FROM=alerts@coldcopy.cc
ALERT_EMAIL_PASSWORD=app_specific_password

# Slack webhook (optional)
SLACK_WEBHOOK_URL=https://hooks.slack.com/...
```

## 🚀 Deployment

### Prerequisites
- Docker and Docker Compose
- SSL certificates (for production)
- Email account for alerts
- Slack workspace (optional)

### Production Deployment

1. **Clone and Configure**:
```bash
git clone https://github.com/codevanmoose/coldcopy.git
cd infrastructure/monitoring
```

2. **Update Environment**:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Deploy Stack**:
```bash
./deploy-monitoring.sh deploy
```

4. **Configure DNS**:
```bash
# Add DNS records for subdomains
prometheus.coldcopy.cc  -> your_server_ip
grafana.coldcopy.cc     -> your_server_ip
alertmanager.coldcopy.cc -> your_server_ip
```

5. **SSL Setup** (Production):
```bash
# Install certificates in nginx/ssl/
certbot certonly --standalone -d prometheus.coldcopy.cc
certbot certonly --standalone -d grafana.coldcopy.cc
certbot certonly --standalone -d alertmanager.coldcopy.cc
```

### Docker Compose Services

```yaml
services:
  prometheus:     # Metrics collection and storage
  grafana:        # Dashboards and visualization
  alertmanager:   # Alert routing and notifications
  node-exporter:  # System metrics
  redis-exporter: # Redis metrics (optional)
  cadvisor:       # Container metrics
  loki:           # Log aggregation (optional)
  promtail:       # Log shipping (optional)
  nginx:          # Reverse proxy for services
```

## 📋 Management Commands

### Service Management
```bash
# Deploy/start services
./deploy-monitoring.sh deploy

# Stop all services
./deploy-monitoring.sh stop

# Restart services
./deploy-monitoring.sh restart

# View logs
./deploy-monitoring.sh logs [service_name]

# Check service health
./deploy-monitoring.sh health
```

### Data Management
```bash
# Create backup
./deploy-monitoring.sh backup

# View storage usage
docker system df

# Clean old data
docker system prune -f
```

## 📊 Dashboard Setup

### Import Dashboards
1. Login to Grafana (http://localhost:3000)
2. Go to Dashboards > Import
3. Upload dashboard JSON files from `grafana/dashboards/`

### Available Dashboards
- **coldcopy-overview.json**: System health and performance
- **coldcopy-business.json**: Business metrics and KPIs

### Custom Dashboards
Create custom dashboards using PromQL queries:

```promql
# Request rate by endpoint
sum(rate(coldcopy_http_requests_total[5m])) by (route)

# Error rate percentage
(rate(coldcopy_errors_total[5m]) / rate(coldcopy_http_requests_total[5m])) * 100

# P95 response time
histogram_quantile(0.95, rate(coldcopy_http_request_duration_seconds_bucket[5m]))
```

## 🔧 Troubleshooting

### Common Issues

1. **Prometheus not scraping metrics**:
```bash
# Check if metrics endpoint is accessible
curl http://localhost:3000/api/metrics

# Verify Prometheus config
docker-compose logs prometheus
```

2. **Grafana dashboards not loading**:
```bash
# Check Prometheus datasource
curl http://prometheus:9090/api/v1/query?query=up

# Verify Grafana logs
docker-compose logs grafana
```

3. **Alerts not firing**:
```bash
# Check Alertmanager status
curl http://localhost:9093/api/v1/status

# Test alert rules
promtool query instant http://localhost:9090 'up == 0'
```

4. **High memory usage**:
```bash
# Check retention settings
grep retention prometheus/prometheus.yml

# Monitor data size
du -sh prometheus_data/
```

### Performance Tuning

1. **Reduce scrape frequency**:
```yaml
# In prometheus.yml
scrape_interval: 30s  # Instead of 15s
```

2. **Optimize retention**:
```yaml
# Reduce retention period
retention.time: 15d   # Instead of 30d
retention.size: 5GB   # Instead of 10GB
```

3. **Limit series cardinality**:
```yaml
# In metrics collection, avoid high-cardinality labels
# Bad: label with user IDs (could be millions)
# Good: label with user types (admin, user, etc.)
```

## 🔗 Integration

### Slack Notifications
1. Create Slack app and webhook
2. Add webhook URL to `.env`:
```bash
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK
```

### Email Alerts
1. Configure SMTP settings in `.env`:
```bash
ALERT_EMAIL_FROM=alerts@coldcopy.cc
ALERT_EMAIL_USERNAME=alerts@coldcopy.cc
ALERT_EMAIL_PASSWORD=your_app_password
```

### Grafana Cloud (Optional)
1. Create Grafana Cloud account
2. Configure remote write in `prometheus.yml`:
```yaml
remote_write:
  - url: 'https://prometheus-blocks-prod-us-central1.grafana.net/api/prom/push'
    basic_auth:
      username: 'your_username'
      password: 'your_api_key'
```

## 📚 Additional Resources

### Documentation
- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Alertmanager Documentation](https://prometheus.io/docs/alerting/latest/alertmanager/)

### PromQL Resources
- [PromQL Basics](https://prometheus.io/docs/prometheus/latest/querying/basics/)
- [PromQL Examples](https://prometheus.io/docs/prometheus/latest/querying/examples/)

### Best Practices
- [Monitoring Best Practices](https://prometheus.io/docs/practices/naming/)
- [Alert Design Patterns](https://prometheus.io/docs/practices/alerting/)

## 🆘 Support

For monitoring-related issues:
1. Check service logs: `./deploy-monitoring.sh logs`
2. Verify service health: `./deploy-monitoring.sh health`
3. Review configuration files for syntax errors
4. Check firewall and network connectivity
5. Validate DNS resolution for custom domains

For ColdCopy application metrics issues:
1. Verify `/api/metrics` endpoint is accessible
2. Check `PROMETHEUS_AUTH_TOKEN` configuration
3. Review application logs for metric collection errors
4. Validate Supabase database connectivity