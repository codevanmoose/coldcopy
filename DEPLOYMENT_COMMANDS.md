# ColdCopy Deployment Command Reference

## Quick Reference Card

### 🚀 Pre-Deployment
```bash
# 1. Run pre-deployment checklist
./infrastructure/deployment/scripts/pre-deployment-checklist.sh

# 2. Validate environment
./infrastructure/deployment/scripts/environment-validator.sh

# 3. Test service connectivity
./infrastructure/deployment/scripts/health-check.sh --test
```

### 📦 Database Setup
```bash
# Initialize Supabase
cd supabase
supabase link --project-ref YOUR_PROJECT_REF
supabase db push

# Backup before deployment
../infrastructure/deployment/scripts/database-backup.sh --type full
```

### 🔧 Service Deployment
```bash
# Quick setup for specific service
./infrastructure/deployment/scripts/quick-setup.sh production database
./infrastructure/deployment/scripts/quick-setup.sh production api
./infrastructure/deployment/scripts/quick-setup.sh production frontend

# Full stack deployment
./infrastructure/deployment/scripts/deploy.sh production

# Deploy with specific version
VERSION=v1.0.0 ./infrastructure/deployment/scripts/deploy.sh production
```

### 🏗️ Digital Ocean Setup
```bash
# Create infrastructure
doctl auth init
doctl compute droplet create \
  --region nyc3 \
  --size s-2vcpu-4gb \
  --image docker-20-04 \
  --ssh-keys YOUR_SSH_KEY_ID \
  --user-data-file infrastructure/deployment/cloud-init.yml \
  coldcopy-api-1 coldcopy-api-2 coldcopy-api-3

# Create load balancer
doctl compute load-balancer create \
  --name coldcopy-lb \
  --region nyc3 \
  --forwarding-rules entry_protocol:https,entry_port:443,target_protocol:http,target_port:8000

# Create Redis database
doctl databases create coldcopy-redis \
  --engine redis \
  --region nyc3 \
  --size db-s-1vcpu-1gb
```

### 🌐 Frontend Deployment
```bash
# Deploy to Vercel
cd apps/web
vercel --prod

# With specific environment
vercel --prod --env production

# Preview deployment
vercel
```

### 🐳 Docker Operations
```bash
# Build images
docker build -t coldcopy/api:latest ./apps/api

# Push to registry
docker tag coldcopy/api:latest registry.digitalocean.com/coldcopy/api:latest
docker push registry.digitalocean.com/coldcopy/api:latest

# Deploy on server
ssh coldcopy@YOUR_SERVER_IP
cd /home/coldcopy/app
docker-compose pull
docker-compose up -d
```

### 📊 Monitoring
```bash
# Real-time health monitoring
./infrastructure/deployment/scripts/health-check.sh

# Continuous monitoring (30s intervals)
./infrastructure/deployment/scripts/health-check.sh --interval 30

# Export metrics
./infrastructure/deployment/scripts/health-check.sh --json > metrics.json
```

### ✅ Post-Deployment
```bash
# Verify deployment
./infrastructure/deployment/scripts/deployment-verifier.sh

# Run smoke tests
./infrastructure/deployment/scripts/deployment-verifier.sh --smoke-test

# Check all services
curl https://api.coldcopy.io/health
curl https://coldcopy.io
```

### 🔄 Rollback
```bash
# Interactive rollback
./infrastructure/deployment/scripts/rollback.sh

# Rollback to specific version
./infrastructure/deployment/scripts/rollback.sh abc123def

# Emergency rollback (includes database)
./infrastructure/deployment/scripts/rollback.sh --include-database
```

### 💾 Backup & Restore
```bash
# Create backup
./infrastructure/deployment/scripts/database-backup.sh --type full

# List backups
./infrastructure/deployment/scripts/database-backup.sh --list

# Restore from backup
./infrastructure/deployment/scripts/database-restore.sh backup_20240120_120000.sql.enc

# Restore from cloud
./infrastructure/deployment/scripts/database-restore.sh --from-cloud backup_20240120_120000.sql.enc
```

### 🔐 SSL Certificates
```bash
# Generate certificate with Certbot
sudo certbot certonly --nginx -d coldcopy.io -d api.coldcopy.io

# Verify SSL
openssl s_client -connect coldcopy.io:443 -servername coldcopy.io

# Check expiry
echo | openssl s_client -connect coldcopy.io:443 2>/dev/null | openssl x509 -noout -dates
```

### 📝 Logs & Debugging
```bash
# View API logs
ssh coldcopy@api-server
docker-compose logs -f api

# View specific service logs
docker-compose logs -f celery-worker
docker-compose logs -f nginx

# Check system logs
journalctl -u coldcopy.service -f

# Debug deployment issues
tail -f /tmp/coldcopy-deployment-*.log
```

### 🚨 Emergency Commands
```bash
# Enable maintenance mode
curl -X POST https://api.coldcopy.io/admin/maintenance/enable \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Stop all services
ssh coldcopy@api-server "docker-compose down"

# Emergency database backup
pg_dump $DATABASE_URL > emergency-backup-$(date +%Y%m%d-%H%M%S).sql

# Clear all caches
redis-cli FLUSHALL

# Restart services
systemctl restart coldcopy.service
```

### 🔧 Common Fixes
```bash
# Fix permission issues
sudo chown -R coldcopy:coldcopy /home/coldcopy/app

# Fix Docker space issues
docker system prune -a --volumes

# Rebuild without cache
docker-compose build --no-cache

# Force recreate containers
docker-compose up -d --force-recreate

# Reset database sequences
psql $DATABASE_URL -c "SELECT setval(pg_get_serial_sequence('table_name', 'id'), MAX(id)) FROM table_name;"
```

## Environment-Specific Commands

### Development
```bash
# Start development environment
npm run dev                    # Frontend
uvicorn main:app --reload     # Backend

# Run with docker-compose
docker-compose -f docker-compose.dev.yml up
```

### Staging
```bash
# Deploy to staging
ENVIRONMENT=staging ./infrastructure/deployment/scripts/deploy.sh

# Run staging tests
npm run test:staging
```

### Production
```bash
# Full production deployment
ENVIRONMENT=production ./infrastructure/deployment/scripts/deploy.sh

# Production health check
curl -H "X-Health-Check-Token: $CRON_SECRET" https://api.coldcopy.io/health/detailed
```

## Useful Aliases

Add these to your `.bashrc` or `.zshrc`:

```bash
# ColdCopy deployment aliases
alias cc-deploy="cd ~/coldcopy && ./infrastructure/deployment/scripts/deploy.sh"
alias cc-health="cd ~/coldcopy && ./infrastructure/deployment/scripts/health-check.sh"
alias cc-logs="ssh coldcopy@api.coldcopy.io 'docker-compose logs -f'"
alias cc-rollback="cd ~/coldcopy && ./infrastructure/deployment/scripts/rollback.sh"
alias cc-backup="cd ~/coldcopy && ./infrastructure/deployment/scripts/database-backup.sh"
alias cc-verify="cd ~/coldcopy && ./infrastructure/deployment/scripts/deployment-verifier.sh"
```

## Deployment Workflow

### Standard Deployment Flow
```bash
# 1. Pre-deployment checks
./infrastructure/deployment/scripts/pre-deployment-checklist.sh

# 2. Create backup
./infrastructure/deployment/scripts/database-backup.sh --type full

# 3. Deploy
./infrastructure/deployment/scripts/deploy.sh production

# 4. Verify
./infrastructure/deployment/scripts/deployment-verifier.sh

# 5. Monitor
./infrastructure/deployment/scripts/health-check.sh --interval 60
```

### Emergency Deployment Flow
```bash
# 1. Enable maintenance mode
curl -X POST https://api.coldcopy.io/admin/maintenance/enable

# 2. Quick backup
./infrastructure/deployment/scripts/database-backup.sh --type schema

# 3. Deploy fix
./infrastructure/deployment/scripts/deploy.sh production

# 4. Verify fix
./infrastructure/deployment/scripts/deployment-verifier.sh --smoke-test

# 5. Disable maintenance mode
curl -X POST https://api.coldcopy.io/admin/maintenance/disable
```

## Troubleshooting Guide

### Service Won't Start
```bash
# Check logs
docker-compose logs service-name

# Check config
docker-compose config

# Validate environment
./infrastructure/deployment/scripts/environment-validator.sh
```

### Database Connection Issues
```bash
# Test connection
psql $DATABASE_URL -c "SELECT 1"

# Check firewall
sudo ufw status

# Verify credentials
echo $DATABASE_URL
```

### SSL Certificate Issues
```bash
# Renew certificate
sudo certbot renew

# Restart nginx
docker-compose restart nginx
```

### Performance Issues
```bash
# Check resource usage
htop
docker stats

# Check slow queries
psql $DATABASE_URL -c "SELECT * FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10"

# Clear caches
redis-cli FLUSHDB
```

Keep this reference handy during deployment!