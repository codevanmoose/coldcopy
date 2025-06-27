# CI/CD Pipeline Documentation

## Overview

ColdCopy uses GitHub Actions for continuous integration and deployment. Our pipeline ensures code quality, security, and reliable deployments across all environments.

## Workflows

### 1. CI Pipeline (`ci.yml`)

**Triggers**: Push to main/develop, Pull requests

**Jobs**:
- **Changes Detection**: Optimizes CI by only running relevant tests
- **Frontend Tests**: TypeScript, linting, unit tests, build verification
- **Backend Tests**: Python type checking, linting, unit tests with coverage
- **Database Tests**: Migration verification and schema validation
- **E2E Tests**: Full integration tests with Playwright
- **Security Scanning**: Vulnerability detection with Trivy

**Key Features**:
- Parallel job execution for faster feedback
- Caching for dependencies
- Test result artifacts
- Coverage reporting

### 2. Deploy Pipeline (`deploy.yml`)

**Triggers**: Push to main, Manual workflow dispatch

**Environments**: staging, production

**Jobs**:
- **Frontend Deploy**: Vercel deployment with preview URLs
- **Backend Deploy**: Digital Ocean App Platform deployment
- **Database Deploy**: Supabase migrations and view refresh
- **Infrastructure Deploy**: PgBouncer and Redis updates
- **Post-Deploy Tests**: Smoke tests and health checks
- **Rollback**: Automatic rollback on failure

**Key Features**:
- Environment-specific configurations
- Blue-green deployments
- Automatic rollback
- Deployment notifications

### 3. PR Checks (`pr.yml`)

**Triggers**: Pull request events

**Jobs**:
- **Auto-labeling**: Labels PRs based on changed files
- **Size Check**: Labels PR size (XS/S/M/L/XL)
- **Linting**: Super Linter for all languages
- **Security**: Secret scanning and vulnerability checks
- **Coverage**: Test coverage with PR comments
- **Preview Deploy**: Vercel preview with unique URL
- **Lighthouse**: Performance metrics

**Key Features**:
- Automated PR feedback
- Preview deployments
- Performance benchmarking
- Security scanning

### 4. Scheduled Maintenance (`scheduled.yml`)

**Triggers**: Daily at 2 AM UTC, Manual dispatch

**Jobs**:
- **Database Maintenance**: Partition management, view refresh
- **Data Cleanup**: Old records, expired sessions
- **Dependency Updates**: Check for outdated packages
- **Security Scanning**: Regular vulnerability checks
- **Backup Verification**: Ensure backups are valid
- **Performance Monitoring**: Check for slow queries

**Key Features**:
- Automated maintenance
- Proactive monitoring
- Weekly reports
- Alert generation

## Environment Configuration

### Secrets

Required GitHub secrets:

```yaml
# Deployment
VERCEL_TOKEN
VERCEL_ORG_ID
VERCEL_PROJECT_ID
DIGITALOCEAN_ACCESS_TOKEN
DO_REGISTRY
DO_APP_ID

# Database
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_PROJECT_ID
SUPABASE_DB_PASSWORD
SUPABASE_ACCESS_TOKEN
DATABASE_URL

# Services
REDIS_URL
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
OPENAI_API_KEY
ANTHROPIC_API_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET

# Monitoring
SENTRY_DSN
SLACK_WEBHOOK
CLOUDFLARE_ZONE_ID
CLOUDFLARE_API_TOKEN

# Security
SNYK_TOKEN
DOCKER_USERNAME
DOCKER_PASSWORD
SSH_USER
SSH_HOST
```

### Environment Variables

Environment-specific variables:

```yaml
# Staging
API_URL: https://api-staging.coldcopy.ai
APP_URL: https://staging.coldcopy.ai

# Production
API_URL: https://api.coldcopy.ai
APP_URL: https://app.coldcopy.ai
```

## Usage

### Manual Deployment

```bash
# Deploy to staging
gh workflow run deploy.yml -f environment=staging

# Deploy to production
gh workflow run deploy.yml -f environment=production
```

### Running Maintenance

```bash
# Run scheduled maintenance manually
gh workflow run scheduled.yml
```

### Monitoring Workflows

```bash
# View recent workflow runs
gh run list

# Watch a specific run
gh run watch <run-id>

# View workflow logs
gh run view <run-id> --log
```

## Best Practices

### 1. Branch Protection

Configure branch protection rules:
- Require PR reviews
- Require status checks to pass
- Require branches to be up to date
- Include administrators

### 2. Environment Protection

Configure environment protection rules:
- Required reviewers for production
- Deployment branch restrictions
- Environment secrets
- Wait timer for production

### 3. Workflow Optimization

- Use job matrices for parallel testing
- Cache dependencies aggressively
- Use conditional jobs with `if:`
- Minimize checkout depth when possible
- Use composite actions for reusable logic

### 4. Security

- Never hardcode secrets
- Use OIDC for cloud authentication
- Regularly rotate secrets
- Review third-party actions
- Enable Dependabot

## Troubleshooting

### Common Issues

1. **Workflow not triggering**
   - Check workflow syntax
   - Verify branch protection
   - Check GitHub Actions status

2. **Test failures**
   - Review test logs
   - Check for flaky tests
   - Verify test environment

3. **Deployment failures**
   - Check deployment logs
   - Verify secrets are set
   - Check service health

4. **Performance issues**
   - Review job duration trends
   - Optimize caching
   - Parallelize jobs

### Debug Mode

Enable debug logging:
```yaml
env:
  ACTIONS_STEP_DEBUG: true
  ACTIONS_RUNNER_DEBUG: true
```

### Monitoring

Monitor workflow performance:
- GitHub Actions tab
- Workflow run history
- API usage metrics
- Third-party monitoring

## Cost Management

### Optimization Tips

1. **Use hosted runners efficiently**
   - Minimize job duration
   - Use appropriate runner size
   - Cancel redundant workflows

2. **Optimize storage**
   - Clean up old artifacts
   - Limit artifact retention
   - Use artifact compression

3. **Cache management**
   - Set appropriate cache keys
   - Clean up stale caches
   - Monitor cache hit rates

### Usage Tracking

Monitor GitHub Actions usage:
- Settings > Billing > Actions
- Track minute usage
- Monitor storage usage
- Set spending limits

## Maintenance

### Regular Tasks

1. **Weekly**
   - Review failed workflows
   - Update dependencies
   - Check security alerts

2. **Monthly**
   - Review workflow performance
   - Update runner versions
   - Clean up old artifacts

3. **Quarterly**
   - Audit secrets
   - Review permissions
   - Update documentation

### Upgrades

Keep workflows updated:
- Update action versions
- Update runner images
- Update tool versions
- Review deprecations