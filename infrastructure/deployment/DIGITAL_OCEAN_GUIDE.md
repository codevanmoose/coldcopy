# ColdCopy Digital Ocean Deployment Guide

## Phase 2.2: API Server Setup on Digital Ocean

This guide covers deploying ColdCopy's Next.js application to Digital Ocean App Platform.

## Prerequisites

1. **Digital Ocean Account**
   - Sign up at https://www.digitalocean.com
   - Add payment method
   - Generate API token

2. **Install doctl CLI**
   ```bash
   # macOS
   brew install doctl

   # Linux
   cd ~
   wget https://github.com/digitalocean/doctl/releases/download/v1.94.0/doctl-1.94.0-linux-amd64.tar.gz
   tar xf doctl-1.94.0-linux-amd64.tar.gz
   sudo mv doctl /usr/local/bin

   # Windows
   # Download from https://github.com/digitalocean/doctl/releases
   ```

3. **Authenticate doctl**
   ```bash
   doctl auth init
   # Enter your API token when prompted
   ```

4. **Docker installed** (for local testing)

## Deployment Options

### Option A: Digital Ocean App Platform (Recommended)

**Pros:**
- Fully managed platform
- Automatic SSL certificates
- Built-in CDN
- Auto-scaling
- Zero-downtime deployments
- Integrated monitoring

**Cons:**
- Higher cost ($40-100/month)
- Less control over infrastructure

### Option B: Digital Ocean Droplets

**Pros:**
- Full control
- Lower cost ($20-40/month)
- Custom configurations

**Cons:**
- Manual management required
- Need to handle SSL, monitoring, updates

## Step 1: Prepare for Deployment

### 1.1 Update next.config.ts for standalone output
```typescript
// apps/web/next.config.ts
const nextConfig = {
  output: 'standalone',
  // ... rest of config
}
```

### 1.2 Test Docker build locally
```bash
cd /path/to/coldcopy
docker build -f infrastructure/docker/Dockerfile -t coldcopy:test .
docker run -p 3000:3000 coldcopy:test
```

### 1.3 Push to GitHub
```bash
git add .
git commit -m "Add Digital Ocean deployment configuration"
git push origin main
```

## Step 2: Deploy Using App Platform

### 2.1 Automated Deployment
```bash
cd infrastructure/deployment
./deploy.sh
```

### 2.2 Manual Deployment via Dashboard

1. Go to https://cloud.digitalocean.com/apps
2. Click "Create App"
3. Choose GitHub as source
4. Select repository: `codevanmoose/coldcopy`
5. Configure app:
   - **Type**: Web Service
   - **Branch**: main
   - **Source Directory**: /
   - **Dockerfile Path**: infrastructure/docker/Dockerfile

## Step 3: Configure Environment Variables

In the Digital Ocean App Platform dashboard:

### Required Variables
```env
# Database
DATABASE_URL=postgresql://...
SUPABASE_SERVICE_ROLE_KEY=...

# Auth
NEXTAUTH_SECRET=...
NEXTAUTH_URL=https://coldcopy.cc
JWT_SECRET=...
ENCRYPTION_KEY=...

# Email
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
SES_CONFIGURATION_SET=coldcopy-transactional
SES_FROM_EMAIL=noreply@coldcopy.cc

# AI Services
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Billing
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# System
CRON_SECRET=...
WEBHOOK_SECRET=...
```

### Build-time Variables
```env
NEXT_PUBLIC_SUPABASE_URL=https://...supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_APP_URL=https://coldcopy.cc
NEXT_PUBLIC_API_URL=https://api.coldcopy.cc
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

## Step 4: Configure Domains

### 4.1 Add Custom Domains
1. In App Settings → Domains
2. Add domain: `api.coldcopy.cc`
3. Add domain: `track.coldcopy.cc`

### 4.2 Update DNS Records
In your DNS provider (Cloudflare):
```
Type  Name    Value                   TTL
A     api     <DO_APP_IP>            Auto
A     track   <DO_APP_IP>            Auto
```

### 4.3 SSL Configuration
- Automatic via Let's Encrypt
- No configuration needed

## Step 5: Configure Redis Cache

### 5.1 Create Managed Redis
```bash
doctl databases create coldcopy-redis \
  --engine redis \
  --version 7 \
  --size db-s-1vcpu-1gb \
  --region nyc1
```

### 5.2 Get Redis URL
```bash
doctl databases connection coldcopy-redis --format URI
```

### 5.3 Update Environment Variable
Add `REDIS_URL` to app environment variables

## Step 6: Configure Monitoring

### 6.1 Enable App Platform Monitoring
- CPU, Memory, Response time metrics
- Built into dashboard

### 6.2 Set Up Alerts
```bash
doctl apps create-alert $APP_ID \
  --rule CPU_UTILIZATION \
  --value 80 \
  --operator GREATER_THAN \
  --window FIVE_MINUTES
```

### 6.3 Configure Logging
- Logs available in dashboard
- Stream logs: `doctl apps logs $APP_ID --follow`

## Step 7: Configure Webhooks

### 7.1 Stripe Webhooks
1. Go to https://dashboard.stripe.com/webhooks
2. Add endpoint: `https://api.coldcopy.cc/api/webhooks/stripe`
3. Select events:
   - `checkout.session.completed`
   - `customer.subscription.*`
   - `invoice.*`
   - `payment_intent.*`

### 7.2 SES Webhooks
1. Go to AWS SES Console
2. Configuration Sets → coldcopy-transactional
3. Event Destinations → Add
4. Endpoint: `https://api.coldcopy.cc/api/webhooks/ses`

## Step 8: Performance Optimization

### 8.1 Configure Scaling
```yaml
# In app.yaml
instance_count: 2  # Start with 2 instances
instance_size_slug: professional-xs  # 1 vCPU, 2GB RAM

# Auto-scaling rules
min_instance_count: 2
max_instance_count: 10
```

### 8.2 Enable CDN
- Automatic for static assets
- Configure cache headers in Next.js

### 8.3 Database Connection Pooling
- Use PgBouncer via Supabase
- Connection string includes pooling

## Step 9: Testing & Verification

### 9.1 Health Check
```bash
curl https://api.coldcopy.cc/api/health
# Expected: {"status":"ok","timestamp":"..."}
```

### 9.2 Test Critical Features
- [ ] Authentication (login/signup)
- [ ] Email sending
- [ ] Payment processing
- [ ] Webhook reception
- [ ] File uploads
- [ ] Real-time features

### 9.3 Load Testing
```bash
# Simple load test
hey -n 1000 -c 10 https://api.coldcopy.cc/api/health
```

## Step 10: Backup & Disaster Recovery

### 10.1 Database Backups
- Handled by Supabase
- Daily automatic backups
- Point-in-time recovery

### 10.2 Application Backups
- Code in GitHub
- Environment variables documented
- Digital Ocean snapshots

## Troubleshooting

### Common Issues

1. **Build Failures**
   ```bash
   # Check build logs
   doctl apps logs $APP_ID --type build
   ```

2. **Runtime Errors**
   ```bash
   # Check runtime logs
   doctl apps logs $APP_ID --follow
   ```

3. **Connection Issues**
   - Verify environment variables
   - Check firewall rules
   - Validate SSL certificates

4. **Performance Issues**
   - Scale up instances
   - Check database connections
   - Review Redis cache hit rate

### Debug Commands
```bash
# Get app info
doctl apps get $APP_ID

# List deployments
doctl apps list-deployments $APP_ID

# Force redeploy
doctl apps create-deployment $APP_ID

# SSH into container (if enabled)
doctl apps console $APP_ID
```

## Cost Estimation

### Monthly Costs
- **App Platform (2x Basic)**: $40
- **Managed Redis**: $15
- **Bandwidth**: ~$10
- **Total**: ~$65/month

### Scaling Costs
- Each additional instance: $20/month
- Larger instances: $40-100/month
- More Redis memory: $30-100/month

## Maintenance

### Daily
- Monitor error rates
- Check response times
- Review resource usage

### Weekly
- Review logs for issues
- Check SSL certificate expiry
- Update dependencies

### Monthly
- Review costs
- Optimize resources
- Security updates

## Rollback Procedure

### Quick Rollback
```bash
# List deployments
doctl apps list-deployments $APP_ID

# Rollback to previous
doctl apps create-deployment $APP_ID \
  --force-rebuild false \
  --deployment-id $PREVIOUS_DEPLOYMENT_ID
```

### Manual Rollback
1. Go to App Dashboard
2. Activity tab
3. Find previous successful deployment
4. Click "Rollback"

## Next Steps

After successful deployment:

1. ✅ Configure all environment variables
2. ✅ Update DNS records
3. ✅ Set up webhooks
4. ✅ Test all features
5. ✅ Monitor for 24 hours
6. ✅ Document any issues
7. ✅ Proceed to Phase 2.3 (Redis Cache)

## Support Resources

- Digital Ocean Docs: https://docs.digitalocean.com/products/app-platform/
- Status Page: https://status.digitalocean.com/
- Support: https://www.digitalocean.com/support/

## Sign-off Checklist

- [ ] App deployed successfully
- [ ] All environment variables configured
- [ ] Custom domains working
- [ ] SSL certificates active
- [ ] Health checks passing
- [ ] Webhooks configured
- [ ] Monitoring enabled
- [ ] Documentation updated

**Deployed by**: _________________
**Date**: _________________
**App ID**: _________________
**URL**: _________________