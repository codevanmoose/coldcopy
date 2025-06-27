# ColdCopy Deployment Checklist

## Pre-Deployment Setup

### 1. Create Service Accounts
- [ ] Create Vercel account (https://vercel.com)
- [ ] Create Supabase project (https://app.supabase.com)
- [ ] Create Digital Ocean account (https://www.digitalocean.com)
- [ ] Create Cloudflare account (https://cloudflare.com)
- [ ] Create AWS account for SES (https://aws.amazon.com)
- [ ] Create Stripe account (https://stripe.com)
- [ ] Create Sentry account for monitoring (https://sentry.io)

### 2. Domain Registration & DNS
- [ ] Register domain (e.g., coldcopy.io)
- [ ] Add domain to Cloudflare
- [ ] Update nameservers at registrar to Cloudflare
- [ ] Configure DNS records:
  ```
  A     @           YOUR_LOAD_BALANCER_IP
  A     api         YOUR_LOAD_BALANCER_IP
  CNAME www         coldcopy.io
  CNAME app         cname.vercel-dns.com
  CNAME track       YOUR_LOAD_BALANCER_IP
  ```

### 3. API Keys & Credentials
Collect all required API keys (see `/infrastructure/deployment/ENVIRONMENT_VARIABLES.md`):

#### AI Services
- [ ] OpenAI API Key
- [ ] Anthropic API Key

#### Email Service
- [ ] AWS Access Key ID
- [ ] AWS Secret Access Key
- [ ] Verify domain in Amazon SES
- [ ] Move out of SES sandbox (request production access)

#### Social Media
- [ ] LinkedIn App (Client ID & Secret)
- [ ] Twitter App (Consumer Key & Secret)

#### CRM Integrations
- [ ] HubSpot App credentials
- [ ] Salesforce Connected App credentials

#### Lead Enrichment
- [ ] Hunter.io API Key
- [ ] Clearbit API Key
- [ ] Apollo.io API Key

#### Calendar
- [ ] Google Cloud Project (Calendar API enabled)
- [ ] Google OAuth credentials

#### Payments
- [ ] Stripe publishable key
- [ ] Stripe secret key
- [ ] Create webhook endpoint in Stripe

### 4. Environment Variables Setup
- [ ] Create `.env.local` for frontend
- [ ] Create `.env.production` for backend
- [ ] Generate all required secrets:
  ```bash
  # NEXTAUTH_SECRET
  openssl rand -base64 32
  
  # ENCRYPTION_KEY
  openssl rand -base64 32
  
  # JWT_SECRET
  openssl rand -base64 64
  
  # WEBHOOK_SIGNING_SECRET
  openssl rand -hex 32
  
  # CRON_SECRET
  openssl rand -hex 16
  ```

## Database Deployment

### 5. Supabase Setup
- [ ] Create new Supabase project
- [ ] Note down project URL and keys
- [ ] Enable required extensions:
  ```sql
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
  CREATE EXTENSION IF NOT EXISTS "pgcrypto";
  CREATE EXTENSION IF NOT EXISTS "pg_trgm";
  ```
- [ ] Run migrations:
  ```bash
  cd supabase
  supabase link --project-ref YOUR_PROJECT_REF
  supabase db push
  ```
- [ ] Verify all tables created (113 tables)
- [ ] Test RLS policies are active

### 6. Initial Data Setup
- [ ] Create subscription plans in Stripe
- [ ] Insert subscription plans into database
- [ ] Create default workspace
- [ ] Create admin user account

## Backend Deployment

### 7. Digital Ocean Infrastructure
- [ ] Create Digital Ocean Space for backups
- [ ] Create Container Registry
- [ ] Create Redis database:
  ```bash
  doctl databases create coldcopy-redis \
    --engine redis \
    --region nyc3 \
    --size db-s-1vcpu-1gb
  ```
- [ ] Create 3 Droplets:
  ```bash
  doctl compute droplet create \
    --region nyc3 \
    --size s-2vcpu-4gb \
    --image docker-20-04 \
    --ssh-keys YOUR_SSH_KEY_ID \
    --user-data-file cloud-init.yml \
    coldcopy-api-1 coldcopy-api-2 coldcopy-api-3
  ```
- [ ] Create Load Balancer:
  ```bash
  doctl compute load-balancer create \
    --name coldcopy-lb \
    --region nyc3 \
    --forwarding-rules entry_protocol:https,entry_port:443,target_protocol:http,target_port:8000
  ```

### 8. SSL Certificates
- [ ] Generate SSL certificate (Let's Encrypt or Cloudflare)
- [ ] Configure SSL on Load Balancer
- [ ] Test HTTPS connectivity

### 9. Docker Setup
- [ ] Build Docker images:
  ```bash
  cd apps/api
  docker build -t coldcopy/api:latest .
  ```
- [ ] Push to registry:
  ```bash
  docker tag coldcopy/api:latest registry.digitalocean.com/coldcopy/api:latest
  docker push registry.digitalocean.com/coldcopy/api:latest
  ```
- [ ] Deploy to servers:
  ```bash
  cd infrastructure/deployment
  docker-compose up -d
  ```

### 10. Backend Configuration
- [ ] Copy environment variables to servers
- [ ] Start API services
- [ ] Start Celery workers
- [ ] Start Celery beat scheduler
- [ ] Verify Redis connection
- [ ] Test health endpoint: https://api.coldcopy.io/health

## Frontend Deployment

### 11. Vercel Setup
- [ ] Install Vercel CLI: `npm i -g vercel`
- [ ] Link project: `vercel link`
- [ ] Add environment variables in Vercel dashboard
- [ ] Deploy to production:
  ```bash
  cd apps/web
  vercel --prod
  ```
- [ ] Configure custom domain in Vercel
- [ ] Test frontend loads: https://coldcopy.io

## Email Configuration

### 12. Amazon SES Setup
- [ ] Verify sending domain
- [ ] Configure DKIM records in DNS
- [ ] Set up SPF record: `v=spf1 include:amazonses.com ~all`
- [ ] Create configuration set
- [ ] Set up SNS topic for webhooks
- [ ] Configure webhook endpoint
- [ ] Test email sending

### 13. Email Authentication
- [ ] SPF record configured
- [ ] DKIM records added (3 CNAME records from SES)
- [ ] DMARC policy set: `v=DMARC1; p=quarantine; rua=mailto:dmarc@coldcopy.io`
- [ ] Test with mail-tester.com

## Monitoring & Analytics

### 14. Monitoring Setup
- [ ] Deploy Prometheus on monitoring server
- [ ] Deploy Grafana
- [ ] Import dashboard templates
- [ ] Configure alerts:
  - API response time > 1s
  - Error rate > 1%
  - Database connections > 80%
  - Redis memory > 80%

### 15. Error Tracking
- [ ] Create Sentry project
- [ ] Configure Sentry in frontend and backend
- [ ] Test error reporting
- [ ] Set up alerts for critical errors

### 16. Analytics
- [ ] Set up Google Analytics (optional)
- [ ] Configure Mixpanel (optional)
- [ ] Set up custom event tracking

## Security

### 17. Security Hardening
- [ ] Enable firewall on all servers
- [ ] Configure fail2ban
- [ ] Disable root SSH access
- [ ] Set up SSH key-only authentication
- [ ] Configure rate limiting in nginx
- [ ] Enable security headers
- [ ] Run security scan

### 18. Backup Configuration
- [ ] Set up daily database backups
- [ ] Configure backup retention (30 days)
- [ ] Test backup restoration
- [ ] Set up backup monitoring alerts

## Testing

### 19. Integration Testing
- [ ] Test user registration and login
- [ ] Test workspace creation
- [ ] Test email sending
- [ ] Test LinkedIn OAuth flow
- [ ] Test Twitter OAuth flow
- [ ] Test HubSpot integration
- [ ] Test Salesforce integration
- [ ] Test Stripe payment flow
- [ ] Test lead import
- [ ] Test campaign creation and sending

### 20. Load Testing
- [ ] Run load tests with k6
- [ ] Verify system handles 1000 concurrent users
- [ ] Check email sending rate limits
- [ ] Monitor resource usage during load

### 21. Security Testing
- [ ] Run OWASP ZAP scan
- [ ] Test for SQL injection
- [ ] Test for XSS vulnerabilities
- [ ] Verify all endpoints require authentication
- [ ] Check for exposed secrets

## CI/CD Setup

### 22. GitHub Actions
- [ ] Add all secrets to GitHub repository
- [ ] Test deployment workflow
- [ ] Verify automatic deployments work
- [ ] Set up staging environment (optional)

### 23. Deployment Automation
- [ ] Test zero-downtime deployments
- [ ] Verify rollback procedures
- [ ] Document deployment process

## Go-Live

### 24. Final Checks
- [ ] All environment variables set correctly
- [ ] All services running and healthy
- [ ] Monitoring dashboards showing data
- [ ] Emails delivering successfully
- [ ] Payments processing correctly
- [ ] Data backup running
- [ ] SSL certificates valid
- [ ] DNS propagated globally

### 25. Launch Tasks
- [ ] Remove "coming soon" page
- [ ] Enable user registrations
- [ ] Announce launch
- [ ] Monitor systems closely for 24 hours
- [ ] Have rollback plan ready

## Post-Launch

### 26. Documentation
- [ ] Document all credentials securely
- [ ] Create runbooks for common issues
- [ ] Document scaling procedures
- [ ] Create user documentation

### 27. Optimization
- [ ] Review performance metrics
- [ ] Optimize slow queries
- [ ] Adjust caching policies
- [ ] Fine-tune rate limits

### 28. Maintenance Plan
- [ ] Schedule regular security updates
- [ ] Plan for certificate renewals
- [ ] Set up log rotation
- [ ] Create disaster recovery plan

## Support Setup

### 29. Customer Support
- [ ] Set up support email
- [ ] Create help documentation
- [ ] Set up status page
- [ ] Create FAQ section

### 30. Legal
- [ ] Privacy Policy published
- [ ] Terms of Service published
- [ ] Cookie Policy published
- [ ] GDPR compliance verified

## Success Criteria

✅ Platform accessible at https://coldcopy.io
✅ API responding at https://api.coldcopy.io
✅ Users can register and log in
✅ Emails sending successfully
✅ Payments processing
✅ All integrations functional
✅ Monitoring showing healthy metrics
✅ No critical errors in logs

## Emergency Contacts

- **Infrastructure**: Digital Ocean Support
- **Database**: Supabase Support
- **Frontend**: Vercel Support
- **Email**: AWS Support
- **Payments**: Stripe Support
- **On-call Engineer**: [Your Phone]

## Rollback Plan

If critical issues arise:

1. **Frontend**: Revert to previous Vercel deployment
2. **Backend**: Use Docker tags to rollback
3. **Database**: Restore from backup
4. **DNS**: Update Cloudflare if needed

Keep this checklist updated as you progress through deployment!