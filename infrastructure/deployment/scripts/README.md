# ColdCopy Deployment Scripts

This directory contains comprehensive deployment automation scripts for the ColdCopy platform. These scripts handle environment validation, deployment, health monitoring, backups, and disaster recovery.

## Scripts Overview

### 1. **environment-validator.sh**
Validates that all required services, dependencies, and configurations are properly set up before deployment.

**Usage:**
```bash
./environment-validator.sh [environment]
# Examples:
./environment-validator.sh production
./environment-validator.sh staging
```

**Features:**
- Checks all required commands and tools
- Validates environment variables
- Tests service connectivity (Database, Redis, Supabase, AWS)
- Verifies SSL certificates
- Checks system resources (disk, memory)
- Validates Python and Node dependencies
- Generates detailed validation report

### 2. **health-check.sh**
Continuously monitors all services and generates health reports with real-time metrics.

**Usage:**
```bash
./health-check.sh [environment] [interval] [--once]
# Examples:
./health-check.sh production 5        # Check every 5 seconds
./health-check.sh staging 10 --once   # Single check
```

**Features:**
- Real-time service monitoring
- Response time tracking
- Error rate calculation
- System resource monitoring
- Docker container status
- Alert notifications
- JSON metrics export
- Prometheus-compatible metrics

### 3. **deployment-verifier.sh**
Verifies that a deployment was successful by running comprehensive smoke tests and validation checks.

**Usage:**
```bash
./deployment-verifier.sh [environment] [version]
# Examples:
./deployment-verifier.sh production v1.2.3
./deployment-verifier.sh staging latest
```

**Features:**
- Version verification
- Service health validation
- Database migration status
- Critical endpoint testing
- Background job verification
- Email service testing
- Cache system validation
- SSL certificate checking
- Performance benchmarking
- Automated smoke tests

### 4. **quick-setup.sh**
Rapidly sets up individual services or the entire ColdCopy stack for any environment.

**Usage:**
```bash
./quick-setup.sh [service] [environment]
# Examples:
./quick-setup.sh all development      # Setup everything
./quick-setup.sh api staging          # Setup only API
./quick-setup.sh frontend production  # Setup only frontend
```

**Available Services:**
- `all` - Complete stack setup
- `database` - Supabase database
- `redis` - Redis cache
- `pgbouncer` - Connection pooling
- `api` - FastAPI backend
- `frontend` - Next.js frontend
- `email` - Email service
- `backup` - Backup service

### 5. **rollback.sh**
Safely rolls back to a previous deployment version with checkpoint creation and verification.

**Usage:**
```bash
./rollback.sh [environment] [target_version]
# Examples:
./rollback.sh production v1.2.2
./rollback.sh staging              # Interactive version selection
```

**Features:**
- Version history browsing
- Rollback checkpoint creation
- Maintenance mode management
- API and frontend rollback
- Optional database rollback
- Cache clearing
- Automated verification
- Rollback notifications

### 6. **database-backup.sh**
Comprehensive database backup system with encryption and cloud storage integration.

**Usage:**
```bash
./database-backup.sh [action] [environment/file] [type]
# Examples:
./database-backup.sh backup production full
./database-backup.sh backup staging incremental
./database-backup.sh list production
./database-backup.sh restore backup-20240101.enc
./database-backup.sh verify /path/to/backup.enc
```

**Actions:**
- `backup` - Create new backup
- `restore` - Restore from backup
- `list` - List available backups
- `verify` - Verify backup integrity
- `cleanup` - Remove old backups

**Backup Types:**
- `full` - Complete database backup
- `incremental` - WAL-based incremental
- `schema` - Schema-only backup

### 7. **database-restore.sh**
Advanced database restoration tool with multiple restore options and safety features.

**Usage:**
```bash
./database-restore.sh [backup_source] [target_env] [options]
# Examples:
./database-restore.sh /backups/backup.enc staging full
./database-restore.sh database/prod/backup.enc development schema
./database-restore.sh backup-id staging tables:users,leads
```

**Restore Options:**
- `full` - Complete database restore
- `schema` - Schema only (no data)
- `data` - Data only
- `tables:t1,t2` - Specific tables

## Environment Variables

All scripts respect environment-specific `.env` files:
- `.env.development`
- `.env.staging`
- `.env.production`

Required variables:
```bash
DATABASE_URL=postgresql://...
SUPABASE_URL=https://...
SUPABASE_SERVICE_KEY=...
REDIS_URL=redis://...
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
DO_SPACES_ACCESS_KEY=...
DO_SPACES_SECRET_KEY=...
DO_SPACES_ENDPOINT=...
DEPLOYMENT_WEBHOOK_URL=...  # Optional: For notifications
MONITORING_WEBHOOK_URL=...  # Optional: For alerts
```

## Prerequisites

Ensure these tools are installed:
- Docker & Docker Compose
- Node.js (v18+) & npm
- Python 3.11+
- PostgreSQL client (psql)
- Redis client (redis-cli)
- Git
- curl & jq
- OpenSSL
- AWS CLI (for SES)
- s3cmd (for Digital Ocean Spaces)
- doctl (Digital Ocean CLI)
- Vercel CLI

## Best Practices

1. **Always validate before deploying:**
   ```bash
   ./environment-validator.sh production
   ```

2. **Create backup before major changes:**
   ```bash
   ./database-backup.sh backup production full
   ```

3. **Verify deployment after completion:**
   ```bash
   ./deployment-verifier.sh production latest
   ```

4. **Monitor health continuously:**
   ```bash
   ./health-check.sh production 60
   ```

5. **Test rollback procedures:**
   - Practice rollbacks in staging
   - Keep rollback checkpoints
   - Document rollback decisions

## Error Handling

All scripts include:
- Comprehensive error checking
- Detailed logging to `/tmp/coldcopy-*.log`
- Safe failure modes
- Rollback capabilities
- Clear error messages

## Security

- Database backups are encrypted with AES-256
- Sensitive values are masked in logs
- Environment files are never committed
- SSL certificates are validated
- Access keys are stored securely

## Monitoring Integration

Scripts can send notifications to:
- Deployment webhooks
- Monitoring systems
- Slack/Discord channels
- Email alerts

Configure webhook URLs in environment files.

## Troubleshooting

### Common Issues

1. **Permission denied:**
   ```bash
   chmod +x *.sh
   ```

2. **Environment not found:**
   - Ensure `.env.{environment}` exists
   - Check file permissions

3. **Service connection failed:**
   - Verify service is running
   - Check firewall rules
   - Validate credentials

4. **Backup/Restore issues:**
   - Check disk space
   - Verify encryption key exists
   - Ensure database permissions

### Debug Mode

Enable verbose logging:
```bash
DEBUG=1 ./script-name.sh
```

## Maintenance

- Review logs regularly: `/tmp/coldcopy-*.log`
- Clean old backups monthly
- Update scripts for new services
- Test disaster recovery quarterly

## Support

For issues or questions:
1. Check script logs
2. Run environment validator
3. Review this documentation
4. Contact DevOps team

---

Last updated: 2024-01-26