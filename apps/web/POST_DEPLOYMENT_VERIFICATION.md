# ColdCopy Post-Deployment Verification Guide

## Phase 1.4: Post-Deployment Verification

This guide provides a comprehensive checklist for verifying your ColdCopy deployment on Vercel.

## 🚀 Automated Verification

Run the automated verification script:
```bash
npm run env:verify && npx tsx scripts/deployment-verify.ts
```

## 📋 Manual Verification Checklist

### 1. Frontend Functionality

#### Landing Pages
- [ ] Homepage loads correctly at https://coldcopy.cc
- [ ] Pricing page displays all tiers
- [ ] Privacy Policy and Terms of Service are accessible
- [ ] All images load properly
- [ ] Mobile responsive design works

#### Authentication
- [ ] Login page loads
- [ ] Signup page loads
- [ ] Password reset flow works
- [ ] OAuth providers connect (if configured)
- [ ] Session persistence works

#### Dashboard Access
- [ ] Dashboard redirects to login when not authenticated
- [ ] Dashboard loads after login
- [ ] Navigation menu works
- [ ] User profile dropdown functions

### 2. API Functionality

#### Health Checks
- [ ] `/api/health` returns `{"status":"ok"}`
- [ ] Response includes timestamp and region

#### Security Headers
Check with: `curl -I https://coldcopy.cc`
- [ ] X-Content-Type-Options: nosniff
- [ ] X-Frame-Options: SAMEORIGIN
- [ ] X-XSS-Protection: 1; mode=block
- [ ] Strict-Transport-Security present

### 3. Database Connectivity

#### Supabase Connection
- [ ] Authentication works (login/signup)
- [ ] Data loads in dashboard
- [ ] Real-time subscriptions connect
- [ ] RLS policies enforce correctly

### 4. Email System

#### Amazon SES
- [ ] Test email sending from dashboard
- [ ] Email tracking pixels load
- [ ] Click tracking redirects work
- [ ] Webhook endpoints receive events

### 5. Payment System

#### Stripe Integration
- [ ] Pricing page shows correct prices
- [ ] Checkout flow initiates
- [ ] Webhook endpoint is accessible
- [ ] Customer portal links work

### 6. Cron Jobs

Check in Vercel Dashboard → Functions → Cron:
- [ ] All 7 cron jobs are listed
- [ ] No execution errors in logs
- [ ] Cron secret is set in environment variables

#### Cron Job Schedule:
1. `/api/cron/billing/trial` - Daily at 9 AM UTC
2. `/api/cron/data-retention` - Daily at 2 AM UTC
3. `/api/cron/lead-scoring` - Every 6 hours
4. `/api/cron/workflow-execution` - Every 5 minutes
5. `/api/cron/email-warmup` - 4 times daily
6. `/api/cron/analytics-refresh` - Every 2 hours
7. `/api/cron/cache-warming` - Every 30 minutes

### 7. Performance Metrics

Check in Vercel Dashboard → Analytics:
- [ ] Core Web Vitals are green
- [ ] First Contentful Paint < 1.2s
- [ ] Time to Interactive < 2.5s
- [ ] Cumulative Layout Shift < 0.1

### 8. Edge Functions

- [ ] Middleware executes (check Function logs)
- [ ] White-label domain detection works
- [ ] Authentication checks function

### 9. Static Assets & SEO

- [ ] `/robots.txt` accessible
- [ ] `/sitemap.xml` generates correctly
- [ ] Favicon loads
- [ ] Open Graph meta tags present

### 10. Error Monitoring

#### Sentry (if configured)
- [ ] Errors are being captured
- [ ] Source maps uploaded
- [ ] User context included

#### Vercel Logs
- [ ] No 500 errors in Function logs
- [ ] No build warnings
- [ ] No runtime errors

### 11. Custom Domain

- [ ] https://coldcopy.cc resolves
- [ ] SSL certificate is valid
- [ ] www subdomain redirects to apex
- [ ] No mixed content warnings

### 12. Environment Variables

Verify in Vercel Dashboard → Settings → Environment Variables:
- [ ] All required variables are set
- [ ] Production environment selected
- [ ] No placeholder values remain

### 13. Cache Behavior

- [ ] Static pages load quickly (cached)
- [ ] ISR pages update at correct intervals
- [ ] API responses include cache headers
- [ ] CDN cache hits in Vercel Analytics

### 14. Mobile & PWA

- [ ] Site works on mobile devices
- [ ] PWA manifest loads
- [ ] Add to Home Screen works (mobile)
- [ ] Offline page displays when offline

### 15. Integrations

#### If configured:
- [ ] Google OAuth works
- [ ] LinkedIn integration connects
- [ ] Twitter integration functions
- [ ] HubSpot sync initiates
- [ ] Salesforce connection works

## 🚨 Common Issues & Solutions

### Build Failures
```bash
# Check build logs
vercel logs --since 1h

# Verify all dependencies
npm ci
npm run build
```

### Environment Variable Issues
```bash
# Verify environment variables locally
npm run env:verify

# Pull from Vercel
vercel env pull .env.local
```

### Function Timeouts
- Check Function logs in Vercel dashboard
- Verify timeout configurations in vercel.json
- Consider moving to background jobs for long tasks

### Database Connection Errors
- Verify Supabase URL and keys
- Check RLS policies aren't blocking access
- Ensure connection pooling is configured

### Cron Job Failures
- Verify CRON_SECRET is set
- Check Function logs for cron executions
- Test cron endpoints manually with secret

## 📊 Performance Benchmarks

After deployment, your metrics should meet:

| Metric | Target | Acceptable |
|--------|--------|------------|
| Lighthouse Performance | 90+ | 80+ |
| First Contentful Paint | < 1.2s | < 2s |
| Time to Interactive | < 2.5s | < 3.5s |
| Cumulative Layout Shift | < 0.1 | < 0.25 |
| API Response Time (p95) | < 200ms | < 500ms |
| Error Rate | < 0.1% | < 1% |

## 🎯 Next Steps

Once verification is complete:

1. **Monitor for 24 hours**
   - Watch error rates
   - Monitor performance metrics
   - Check cron job executions

2. **Set up alerts**
   - Error rate spikes
   - Performance degradation
   - Failed cron jobs
   - High memory usage

3. **Document any issues**
   - Create GitHub issues
   - Update runbooks
   - Plan fixes

4. **Proceed to Phase 2**
   - Digital Ocean infrastructure
   - Redis cache setup
   - Background workers

## 🔧 Rollback Procedure

If critical issues are found:

```bash
# Instant rollback to previous deployment
vercel rollback

# Or from dashboard:
# 1. Go to Deployments
# 2. Find last working deployment
# 3. Click "..." → "Promote to Production"
```

## ✅ Sign-off

- [ ] All automated tests pass
- [ ] Manual checks complete
- [ ] Performance meets targets
- [ ] No critical errors
- [ ] Ready for Phase 2

**Verified by**: _________________
**Date**: _________________
**Deployment URL**: _________________