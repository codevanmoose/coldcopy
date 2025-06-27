# ColdCopy Deployment Guide

## Infrastructure Overview

- **Frontend**: Vercel (Next.js)
- **Database**: Supabase (PostgreSQL)
- **Backend API**: Digital Ocean Droplets
- **Cache**: Redis on Digital Ocean
- **File Storage**: Digital Ocean Spaces
- **CDN**: Cloudflare
- **Email**: Amazon SES
- **Monitoring**: Prometheus + Grafana

## Prerequisites

- Vercel account
- Supabase account
- Digital Ocean account
- Cloudflare account
- AWS account (for SES)
- Domain name (coldcopy.io)

## Phase 1: Database Setup (Supabase)

1. Create new Supabase project
2. Run all migrations in order:
   ```bash
   cd supabase
   supabase db push
   ```

3. Enable required extensions:
   ```sql
   CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
   CREATE EXTENSION IF NOT EXISTS "pgcrypto";
   CREATE EXTENSION IF NOT EXISTS "pg_cron";
   CREATE EXTENSION IF NOT EXISTS "pg_partman";
   ```

4. Set up RLS policies (already in migrations)

5. Configure auth providers:
   - Email/Password
   - Magic Link
   - Google OAuth (optional)

## Phase 2: Backend Deployment (Digital Ocean)

### 2.1 Create Droplets

```bash
# Create 3 droplets for high availability
doctl compute droplet create \
  --region nyc3 \
  --size s-2vcpu-4gb \
  --image docker-20-04 \
  --ssh-keys YOUR_SSH_KEY_ID \
  --tag-name coldcopy-api \
  --user-data-file cloud-init.yml \
  coldcopy-api-1 coldcopy-api-2 coldcopy-api-3
```

### 2.2 Set up Load Balancer

```bash
doctl compute load-balancer create \
  --name coldcopy-lb \
  --region nyc3 \
  --tag-name coldcopy-api \
  --forwarding-rules entry_protocol:https,entry_port:443,target_protocol:http,target_port:8000
```

### 2.3 Configure Redis

```bash
# Create managed Redis cluster
doctl databases create \
  --engine redis \
  --region nyc3 \
  --size db-s-1vcpu-1gb \
  --num-nodes 1 \
  coldcopy-redis
```

### 2.4 Set up Spaces (S3-compatible storage)

```bash
# Create Space for file storage
doctl spaces create coldcopy-files --region nyc3
```

## Phase 3: Frontend Deployment (Vercel)

### 3.1 Connect GitHub Repository

```bash
vercel link
vercel env pull
```

### 3.2 Configure Environment Variables

```bash
# Production environment variables
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add NEXT_PUBLIC_APP_URL production
vercel env add NEXT_PUBLIC_API_URL production
# ... add all required env vars
```

### 3.3 Deploy

```bash
vercel --prod
```

## Phase 4: Domain & SSL Setup

### 4.1 Cloudflare Configuration

1. Add domain to Cloudflare
2. Update nameservers at registrar
3. Configure DNS records:

```
A     @           YOUR_LOAD_BALANCER_IP
A     api         YOUR_LOAD_BALANCER_IP
CNAME www         coldcopy.io
CNAME app         cname.vercel-dns.com
```

4. Enable SSL/TLS:
   - Mode: Full (strict)
   - Always Use HTTPS: On
   - Automatic HTTPS Rewrites: On

### 4.2 Configure Vercel Custom Domain

```bash
vercel domains add coldcopy.io
vercel domains add www.coldcopy.io
```

## Phase 5: Email Configuration (Amazon SES)

### 5.1 Verify Domain

```bash
aws ses verify-domain-identity --domain coldcopy.io
```

### 5.2 Configure DKIM

Add DKIM records to Cloudflare DNS

### 5.3 Set up Configuration Set

```bash
aws ses put-configuration-set \
  --configuration-set Name=coldcopy-transactional
```

### 5.4 Configure SNS for Webhooks

```bash
aws sns create-topic --name coldcopy-email-events
aws sns subscribe \
  --topic-arn arn:aws:sns:us-east-1:xxx:coldcopy-email-events \
  --protocol https \
  --notification-endpoint https://api.coldcopy.io/api/webhooks/ses
```

## Phase 6: Monitoring Setup

### 6.1 Install Prometheus on Monitoring Droplet

```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'coldcopy-api'
    static_configs:
      - targets: ['api-1:8000', 'api-2:8000', 'api-3:8000']
  
  - job_name: 'redis'
    static_configs:
      - targets: ['redis:9121']
```

### 6.2 Install Grafana

```bash
docker run -d \
  -p 3000:3000 \
  --name grafana \
  -e "GF_SECURITY_ADMIN_PASSWORD=secret" \
  grafana/grafana
```

### 6.3 Configure Alerts

Set up alerts for:
- API response time > 1s
- Error rate > 1%
- Database connections > 80%
- Redis memory > 80%
- Disk usage > 80%

## Phase 7: CI/CD Pipeline

### 7.1 GitHub Actions for Backend

```yaml
# .github/workflows/deploy-api.yml
name: Deploy API
on:
  push:
    branches: [main]
    paths: ['apps/api/**']

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Build Docker image
        run: |
          docker build -t coldcopy/api:${{ github.sha }} ./apps/api
          docker tag coldcopy/api:${{ github.sha }} coldcopy/api:latest
      
      - name: Push to registry
        run: |
          echo ${{ secrets.DOCKER_PASSWORD }} | docker login -u ${{ secrets.DOCKER_USERNAME }} --password-stdin
          docker push coldcopy/api:${{ github.sha }}
          docker push coldcopy/api:latest
      
      - name: Deploy to Digital Ocean
        run: |
          doctl auth init --access-token ${{ secrets.DO_ACCESS_TOKEN }}
          doctl compute ssh coldcopy-api-1 --ssh-command "docker service update --image coldcopy/api:${{ github.sha }} coldcopy_api"
```

### 7.2 Vercel Auto-deployment

Vercel automatically deploys on push to main branch

## Phase 8: Security Hardening

### 8.1 API Security

```nginx
# nginx.conf rate limiting
limit_req_zone $binary_remote_addr zone=api:10m rate=100r/s;
limit_req zone=api burst=20 nodelay;

# Security headers
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
```

### 8.2 Database Security

```sql
-- Restrict connections
ALTER DATABASE coldcopy SET restricted_session = true;

-- Enable SSL
ALTER SYSTEM SET ssl = on;
```

### 8.3 Secrets Management

Use Digital Ocean's secrets management:

```bash
doctl apps create-deployment coldcopy-api \
  --env DATABASE_URL='${_self.ENCRYPTED_DATABASE_URL}' \
  --env OPENAI_API_KEY='${_self.ENCRYPTED_OPENAI_API_KEY}'
```

## Phase 9: Backup Strategy

### 9.1 Database Backups

```bash
# Set up daily backups
SELECT cron.schedule(
  'backup-database',
  '0 3 * * *',
  $$CALL backup_to_spaces('coldcopy-backups')$$
);
```

### 9.2 Application Backups

- Docker images in registry
- Code in GitHub
- Environment variables in Vercel/DO

## Phase 10: Launch Checklist

- [ ] All migrations run successfully
- [ ] Environment variables configured
- [ ] SSL certificates active
- [ ] Email sending verified
- [ ] Monitoring dashboards set up
- [ ] Backup jobs running
- [ ] Load testing completed
- [ ] Security scan passed
- [ ] Documentation updated
- [ ] Support email configured

## Maintenance Commands

```bash
# Check API health
curl https://api.coldcopy.io/health

# View logs
doctl apps logs coldcopy-api --tail --follow

# Scale workers
doctl apps update-worker coldcopy-api --count 5

# Database maintenance
supabase db dump --data-only > backup.sql

# Clear Redis cache
redis-cli FLUSHDB
```

## Cost Estimation (Monthly)

- Vercel Pro: $20
- Supabase Pro: $25
- Digital Ocean:
  - 3x Droplets (s-2vcpu-4gb): $72
  - Load Balancer: $12
  - Spaces: $5
  - Managed Redis: $15
- Cloudflare Pro: $20
- Amazon SES: ~$50 (volume-based)
- **Total: ~$219/month**

## Support

- Technical issues: Create GitHub issue
- Security concerns: security@coldcopy.io
- Business inquiries: hello@coldcopy.io