# ColdCopy Deployment Day Runbook

## 📅 Deployment Schedule

### Day Before Deployment
- [ ] Run pre-deployment checklist
- [ ] Verify all team members are available
- [ ] Confirm maintenance window with stakeholders
- [ ] Test rollback procedures in staging
- [ ] Review deployment commands reference

### Deployment Day Timeline
- **08:00** - Team standup & final go/no-go decision
- **08:30** - Begin pre-deployment checks
- **09:00** - Create production backups
- **09:30** - Enable maintenance mode
- **10:00** - Begin deployment
- **11:00** - Verification and testing
- **11:30** - Disable maintenance mode
- **12:00** - Monitor and observe

## 🎯 Deployment Roles

### Deployment Lead
- Coordinates deployment activities
- Makes go/no-go decisions
- Communicates with stakeholders

### Infrastructure Engineer
- Manages servers and infrastructure
- Handles Docker deployments
- Monitors system resources

### Database Administrator
- Runs migrations
- Creates and verifies backups
- Monitors database performance

### Frontend Developer
- Deploys to Vercel
- Verifies frontend functionality
- Checks PWA features

### QA Engineer
- Runs smoke tests
- Verifies critical paths
- Documents any issues

## 📋 Step-by-Step Deployment Process

### Phase 1: Pre-Deployment (30 minutes)
```bash
# 1. Start recording deployment log
script deployment-log-$(date +%Y%m%d).txt

# 2. Run final checks
cd /path/to/coldcopy
./infrastructure/deployment/scripts/pre-deployment-checklist.sh

# 3. Verify team is ready
echo "Team check-in:"
echo "- Infrastructure: Ready? [y/n]"
echo "- Database: Ready? [y/n]"
echo "- Frontend: Ready? [y/n]"
echo "- QA: Ready? [y/n]"

# 4. Create deployment checkpoint
git tag -a deployment-$(date +%Y%m%d-%H%M) -m "Pre-deployment checkpoint"
git push origin --tags
```

### Phase 2: Backup Creation (30 minutes)
```bash
# 1. Create full database backup
./infrastructure/deployment/scripts/database-backup.sh --type full

# 2. Backup current application state
ssh coldcopy@api-server-1 "cd /home/coldcopy/app && tar -czf pre-deployment-backup.tar.gz ."

# 3. Export current environment
ssh coldcopy@api-server-1 "cd /home/coldcopy/app && cp .env .env.backup-$(date +%Y%m%d)"

# 4. Verify backups
./infrastructure/deployment/scripts/database-backup.sh --list
```

### Phase 3: Maintenance Mode (10 minutes)
```bash
# 1. Enable maintenance mode
curl -X POST https://api.coldcopy.io/admin/maintenance/enable \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "ColdCopy is undergoing scheduled maintenance. We'll be back shortly!", "estimated_time": "2 hours"}'

# 2. Verify maintenance mode
curl https://api.coldcopy.io/health

# 3. Notify users (if applicable)
# Send email/Slack notifications
```

### Phase 4: Database Deployment (20 minutes)
```bash
# 1. Run migrations
cd supabase
supabase db push --linked

# 2. Verify migrations
supabase db diff

# 3. Run post-migration scripts (if any)
psql $DATABASE_URL < post-migration-scripts.sql

# 4. Update materialized views
psql $DATABASE_URL -c "REFRESH MATERIALIZED VIEW CONCURRENTLY campaign_analytics_mv;"
```

### Phase 5: Backend Deployment (30 minutes)
```bash
# 1. Deploy to first server (canary)
ssh coldcopy@api-server-1
cd /home/coldcopy/app
docker-compose pull
docker-compose up -d

# 2. Verify first server
curl http://api-server-1:8000/health

# 3. Deploy to remaining servers
for server in api-server-2 api-server-3; do
  ssh coldcopy@$server "cd /home/coldcopy/app && docker-compose pull && docker-compose up -d"
done

# 4. Verify all servers
./infrastructure/deployment/scripts/health-check.sh
```

### Phase 6: Frontend Deployment (15 minutes)
```bash
# 1. Deploy to Vercel
cd apps/web
vercel --prod --yes

# 2. Wait for deployment
echo "Waiting for Vercel deployment to complete..."
sleep 60

# 3. Verify deployment
DEPLOYMENT_URL=$(vercel ls --prod | grep Production | awk '{print $2}')
curl -I $DEPLOYMENT_URL

# 4. Clear CDN cache
curl -X POST "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/purge_cache" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"purge_everything":true}'
```

### Phase 7: Verification (30 minutes)
```bash
# 1. Run automated verification
./infrastructure/deployment/scripts/deployment-verifier.sh

# 2. Manual smoke tests
echo "Manual Test Checklist:"
echo "[ ] User can register"
echo "[ ] User can login"
echo "[ ] Email sending works"
echo "[ ] Payment processing works"
echo "[ ] AI features work"
echo "[ ] Integrations work"

# 3. Performance check
ab -n 1000 -c 10 https://api.coldcopy.io/health

# 4. Check monitoring
open https://monitor.coldcopy.io
```

### Phase 8: Go Live (10 minutes)
```bash
# 1. Disable maintenance mode
curl -X POST https://api.coldcopy.io/admin/maintenance/disable \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 2. Verify site is accessible
curl -I https://coldcopy.io

# 3. Clear all caches
redis-cli FLUSHALL

# 4. Warm up caches
curl -X POST https://api.coldcopy.io/api/cache/warming/start
```

### Phase 9: Post-Deployment Monitoring (2 hours)
```bash
# 1. Start continuous monitoring
./infrastructure/deployment/scripts/health-check.sh --interval 30 &

# 2. Watch error logs
ssh coldcopy@api-server-1 "docker-compose logs -f api | grep ERROR"

# 3. Monitor key metrics
watch -n 5 'curl -s https://api.coldcopy.io/metrics | jq .'

# 4. Check user reports
# Monitor support channels for issues
```

## 🚨 Rollback Procedures

### Immediate Rollback (< 5 minutes after deployment)
```bash
# 1. Enable maintenance mode
curl -X POST https://api.coldcopy.io/admin/maintenance/enable

# 2. Quick rollback
./infrastructure/deployment/scripts/rollback.sh

# 3. Verify rollback
./infrastructure/deployment/scripts/health-check.sh

# 4. Disable maintenance mode
curl -X POST https://api.coldcopy.io/admin/maintenance/disable
```

### Database Rollback (if needed)
```bash
# 1. Stop all services
ssh coldcopy@api-server-1 "docker-compose down"

# 2. Restore database
./infrastructure/deployment/scripts/database-restore.sh latest-full-backup.sql.enc

# 3. Restart services with previous version
./infrastructure/deployment/scripts/rollback.sh --include-database

# 4. Verify
./infrastructure/deployment/scripts/deployment-verifier.sh
```

## 📊 Success Criteria

### Technical Metrics
- [ ] All health checks passing
- [ ] Response time < 200ms (p95)
- [ ] Error rate < 0.1%
- [ ] All integration tests passing
- [ ] No critical errors in logs

### Business Metrics
- [ ] Users can register and login
- [ ] Emails are being sent
- [ ] Payments are processing
- [ ] No increase in support tickets
- [ ] Key features are functional

## 🔥 Emergency Contacts

### Internal Team
- **Deployment Lead**: +1-XXX-XXX-XXXX
- **Infrastructure Lead**: +1-XXX-XXX-XXXX
- **Database Admin**: +1-XXX-XXX-XXXX
- **On-Call Engineer**: +1-XXX-XXX-XXXX

### External Support
- **Vercel Support**: https://vercel.com/support
- **Supabase Support**: support@supabase.io
- **Digital Ocean**: https://www.digitalocean.com/support/
- **AWS Support**: https://console.aws.amazon.com/support/

### Escalation Path
1. Try to fix issue (15 minutes max)
2. If not resolved, initiate rollback
3. If rollback fails, call Infrastructure Lead
4. If still not resolved, conference call with full team
5. Last resort: Contact external support

## 📝 Post-Deployment Tasks

### Immediate (Day 0)
- [ ] Update status page
- [ ] Send deployment notification
- [ ] Document any issues encountered
- [ ] Update runbook with learnings

### Next Day (Day 1)
- [ ] Review deployment metrics
- [ ] Analyze performance impact
- [ ] Address any user feedback
- [ ] Plan fixes for any issues

### Next Week
- [ ] Conduct deployment retrospective
- [ ] Update deployment procedures
- [ ] Plan next deployment improvements
- [ ] Archive deployment logs

## 🎯 Deployment Checklist Summary

### Before Starting
- [ ] All team members available
- [ ] Pre-deployment checklist passed
- [ ] Backups created and verified
- [ ] Rollback plan tested
- [ ] Stakeholders notified

### During Deployment
- [ ] Maintenance mode enabled
- [ ] Database migrations successful
- [ ] Backend deployed to all servers
- [ ] Frontend deployed to Vercel
- [ ] All verifications passed

### After Deployment
- [ ] Maintenance mode disabled
- [ ] Monitoring active
- [ ] No critical errors
- [ ] Users can access site
- [ ] Team debriefed

## 📚 Appendix

### Common Issues and Solutions

#### Issue: Migration Fails
```bash
# Solution: Rollback migration
supabase db reset
# Fix migration file
# Re-run migration
```

#### Issue: Docker Pull Fails
```bash
# Solution: Re-authenticate
docker login registry.digitalocean.com
# Retry pull
docker-compose pull
```

#### Issue: Health Check Fails
```bash
# Solution: Check specific service
docker-compose ps
docker-compose logs failing-service
# Restart service
docker-compose restart failing-service
```

#### Issue: SSL Certificate Error
```bash
# Solution: Renew certificate
sudo certbot renew --force-renewal
# Restart nginx
docker-compose restart nginx
```

### Useful Commands During Deployment

```bash
# Watch deployment progress
tail -f /tmp/coldcopy-deployment-*.log

# Monitor server resources
htop

# Check Docker status
docker ps
docker stats

# View real-time logs
docker-compose logs -f --tail=100

# Quick database query
psql $DATABASE_URL -c "SELECT COUNT(*) FROM users"

# Test specific endpoint
curl -X POST https://api.coldcopy.io/api/test \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

Remember: Stay calm, follow the runbook, and communicate clearly with the team!