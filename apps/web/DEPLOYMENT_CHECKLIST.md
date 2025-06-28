# ColdCopy Deployment Checklist

## Pre-Deployment Checklist

### Environment Variables ✓
- [ ] Copy `.env.production.example` to `.env.production`
- [ ] Fill in all Supabase credentials
- [ ] Add all API keys (OpenAI, Anthropic, Stripe, etc.)
- [ ] Configure AWS SES credentials
- [ ] Add social media API keys
- [ ] Set Redis connection string
- [ ] Configure monitoring tokens (Sentry, PostHog)
- [ ] Generate secure secrets (JWT_SECRET, ENCRYPTION_KEY, WEBHOOK_SECRET)

### Vercel Configuration ✓
- [ ] Login to Vercel CLI: `vercel login`
- [ ] Link project: `vercel link`
- [ ] Import environment variables: `vercel env pull`
- [ ] Add production environment variables via dashboard

### Build Verification ✓
```bash
# Test production build locally
npm run build
npm run start

# Run type checking
npm run typecheck

# Run linting
npm run lint

# Run tests
npm test
```

### Database Preparation ✓
- [ ] Ensure all migrations are ready
- [ ] Test migrations on staging database
- [ ] Backup existing data (if any)
- [ ] Prepare rollback scripts

## Deployment Steps

### 1. Deploy to Vercel
```bash
# Deploy to production
cd apps/web
vercel --prod

# Or use GitHub integration for automatic deploys
git push origin main
```

### 2. Configure Custom Domain
- [ ] Add domain in Vercel dashboard
- [ ] Update DNS records in Cloudflare:
  - A record: @ -> 76.76.21.21
  - CNAME: www -> cname.vercel-dns.com
- [ ] Enable SSL in Vercel
- [ ] Test domain resolution

### 3. Set Up Cron Jobs
- [ ] Verify cron endpoints are accessible
- [ ] Generate and set CRON_SECRET
- [ ] Test each cron job manually
- [ ] Monitor cron execution in Vercel dashboard

### 4. Configure Edge Functions
- [ ] Enable edge runtime for auth middleware
- [ ] Configure regional edge functions
- [ ] Test edge function performance

### 5. Enable Caching
- [ ] Configure ISR for dynamic pages
- [ ] Set cache headers for static assets
- [ ] Enable CDN caching in Cloudflare
- [ ] Test cache invalidation

## Post-Deployment Verification

### Functionality Tests ✓
- [ ] User registration and login
- [ ] Email sending via SES
- [ ] Stripe payment processing
- [ ] AI email generation
- [ ] Lead scoring calculation
- [ ] Workflow execution
- [ ] Multi-channel campaigns
- [ ] Real-time updates

### Performance Tests ✓
- [ ] Page load speed < 2s
- [ ] API response time < 200ms
- [ ] Time to Interactive < 3s
- [ ] Lighthouse score > 90

### Security Tests ✓
- [ ] SSL certificate valid
- [ ] Security headers present
- [ ] CORS configured correctly
- [ ] Rate limiting active
- [ ] Input validation working

### Monitoring Setup ✓
- [ ] Sentry error tracking active
- [ ] PostHog analytics recording
- [ ] Vercel Analytics enabled
- [ ] Custom metrics tracking

## Rollback Plan

### Quick Rollback
```bash
# Revert to previous deployment
vercel rollback

# Or use Vercel dashboard to promote previous deployment
```

### Database Rollback
```sql
-- Keep rollback scripts ready
-- Example: DROP TABLE IF EXISTS new_feature_table;
```

### DNS Rollback
- Have previous DNS configuration documented
- Keep TTL low during deployment (300s)
- Switch back if issues arise

## Production Monitoring

### Real-time Monitoring
- Vercel Dashboard: https://vercel.com/dashboard
- Sentry: https://sentry.io/organizations/coldcopy
- PostHog: https://app.posthog.com

### Key Metrics to Watch
- Error rate < 0.1%
- Apdex score > 0.9
- Database connection pool usage < 80%
- API rate limit violations
- Failed payment attempts

### Alerts Configuration
- [ ] Error rate spike (> 1%)
- [ ] Performance degradation (> 2s response)
- [ ] Database connection failures
- [ ] Payment processing failures
- [ ] High memory usage (> 90%)

## Support Readiness

### Documentation
- [ ] Update API documentation
- [ ] Create user guides
- [ ] Prepare FAQ
- [ ] Update changelog

### Team Communication
- [ ] Notify team of deployment
- [ ] Share rollback procedures
- [ ] Designate on-call person
- [ ] Update status page

### Customer Communication
- [ ] Prepare maintenance notice (if needed)
- [ ] Draft incident response templates
- [ ] Update support documentation
- [ ] Test support channels

## Sign-off

- [ ] Technical Lead Approval
- [ ] QA Sign-off
- [ ] Product Owner Approval
- [ ] Deployment Completed Successfully

**Deployment Date**: _______________
**Deployed By**: _______________
**Version**: _______________