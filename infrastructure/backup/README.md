# ColdCopy Database Backup System

A comprehensive backup and disaster recovery solution for ColdCopy's Supabase PostgreSQL database, featuring automated backups to Digital Ocean Spaces, point-in-time recovery, and GDPR-compliant data retention.

## Features

- **Automated Daily Backups**: Full database backups at 2 AM daily
- **Point-in-Time Recovery (PITR)**: WAL archiving for recovery to any point in time
- **Digital Ocean Spaces Integration**: Secure cloud storage with lifecycle policies
- **Backup Verification**: Automated integrity checks and test restores
- **GDPR Compliance**: Encrypted backups with configurable retention policies
- **Monitoring & Alerts**: HTTP API, Prometheus metrics, and email alerts
- **Multi-tier Retention**: 30-day standard, 1-year compliance backups
- **Disaster Recovery Plans**: Pre-defined procedures for various scenarios

## Architecture

```
┌─────────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│                     │     │                  │     │                 │
│   Supabase DB      │────▶│  Backup Manager  │────▶│  DO Spaces      │
│                     │     │                  │     │                 │
└─────────────────────┘     └──────────────────┘     └─────────────────┘
                                     │
                                     ▼
                            ┌──────────────────┐
                            │                  │
                            │  Backup Monitor  │
                            │   (HTTP API)     │
                            │                  │
                            └──────────────────┘
```

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Digital Ocean Spaces account
- PostgreSQL client tools (pg_dump, pg_restore)
- Supabase database credentials

### Installation

1. Clone the repository and navigate to backup directory:
```bash
cd infrastructure/backup
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your credentials
```

3. Run the setup script:
```bash
./setup.sh
```

4. Verify services are running:
```bash
docker-compose ps
curl http://localhost:8090/health
```

## Configuration

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `DB_HOST` | PostgreSQL host | Yes | - |
| `DB_PORT` | PostgreSQL port | No | 5432 |
| `DB_NAME` | Database name | Yes | - |
| `DB_USER` | Database user | Yes | - |
| `DB_PASSWORD` | Database password | Yes | - |
| `DO_SPACES_KEY` | Digital Ocean Spaces access key | Yes | - |
| `DO_SPACES_SECRET` | Digital Ocean Spaces secret | Yes | - |
| `DO_SPACES_BUCKET` | Bucket name for backups | Yes | - |
| `DO_SPACES_REGION` | Spaces region | No | nyc3 |
| `DO_SPACES_ENDPOINT` | Spaces endpoint URL | No | https://nyc3.digitaloceanspaces.com |
| `ALERT_EMAIL` | Email for alerts | No | - |
| `SMTP_HOST` | SMTP server host | No | - |
| `SMTP_USER` | SMTP username | No | - |
| `SMTP_PASSWORD` | SMTP password | No | - |
| `BACKUP_ENCRYPTION_KEY` | Encryption key for backups | Recommended | - |

### Backup Schedule

Default schedule (configured in `backup_manager.py`):
- **Daily Full Backup**: 2:00 AM
- **Weekly Verification**: Sundays at 3:00 AM
- **Daily Cleanup**: 4:00 AM
- **Monthly Compliance Backup**: 1st of month at 1:00 AM

## Usage

### Manual Backup

```bash
docker-compose exec backup-scheduler python backup_manager.py backup
```

### List Available Backups

```bash
docker-compose exec backup-scheduler python restore_manager.py list-backups
```

### Restore a Backup

```bash
# Restore to original database
docker-compose exec backup-scheduler python restore_manager.py restore --backup-name full_backup_coldcopy_20240124_020000

# Restore to different database
docker-compose exec backup-scheduler python restore_manager.py restore --backup-name full_backup_coldcopy_20240124_020000 --target-db coldcopy_restored
```

### Point-in-Time Recovery

```bash
# Recover to specific timestamp
docker-compose exec backup-scheduler python restore_manager.py pitr --target-time "2024-01-24 15:30:00"
```

### Check Backup Status

```bash
# Via API
curl http://localhost:8090/status

# Via CLI
docker-compose exec backup-scheduler python backup_manager.py status
```

## Monitoring

### HTTP API Endpoints

- `GET /health` - Service health check
- `GET /status` - Current backup status and statistics
- `GET /backups` - List all backups (paginated)
- `GET /backup/<name>` - Get specific backup details
- `POST /verify/<name>` - Trigger backup verification
- `GET /metrics` - Prometheus metrics
- `GET /alerts` - Current backup alerts
- `POST /restore-test` - Trigger test restore
- `GET /recovery-time` - Estimate recovery time

### Prometheus Metrics

- `coldcopy_backups_total` - Total number of backups
- `coldcopy_backups_success` - Successful backups count
- `coldcopy_backups_failed` - Failed backups count
- `coldcopy_backup_size_bytes` - Size of last backup
- `coldcopy_backup_duration_seconds` - Backup duration histogram
- `coldcopy_last_backup_timestamp` - Timestamp of last backup
- `coldcopy_total_backup_size_gb` - Total size of all backups
- `coldcopy_backup_count` - Current number of backups

### Monitoring Dashboard

Access the monitoring dashboard at: http://localhost:8090

## Disaster Recovery

### Recovery Scenarios

1. **Database Corruption**
   ```bash
   docker-compose exec backup-scheduler python restore_manager.py plan corruption
   ```

2. **Accidental Deletion**
   ```bash
   docker-compose exec backup-scheduler python restore_manager.py plan deletion
   ```

3. **Complete Disaster**
   ```bash
   docker-compose exec backup-scheduler python restore_manager.py plan disaster
   ```

4. **Compliance Data Recovery**
   ```bash
   docker-compose exec backup-scheduler python restore_manager.py plan compliance
   ```

### Recovery Time Objectives (RTO)

- **Standard Restore**: 30-60 minutes
- **Point-in-Time Recovery**: 1-2 hours
- **Complete Disaster Recovery**: 2-4 hours

### Recovery Point Objectives (RPO)

- **With WAL Archiving**: Up to 5 minutes data loss
- **Without WAL Archiving**: Up to 24 hours data loss

## Security

### Backup Encryption

All backups are encrypted using AES-256-CBC with PBKDF2 key derivation. Set `BACKUP_ENCRYPTION_KEY` environment variable to enable encryption.

### Access Control

- Backups are stored with restricted access in Digital Ocean Spaces
- Use IAM policies to limit access to backup buckets
- Rotate access keys regularly

### Network Security

- Use VPC peering between database and backup infrastructure
- Enable SSL/TLS for all connections
- Restrict access to monitoring endpoints

## Maintenance

### Storage Management

Lifecycle policies automatically:
- Move backups to cold storage after 7 days
- Delete WAL files after 30 days
- Keep monthly compliance backups for 1 year

### Manual Cleanup

```bash
# Remove old backups
docker-compose exec backup-scheduler python backup_manager.py cleanup
```

### Updating the System

```bash
# Pull latest changes
git pull

# Rebuild containers
docker-compose build

# Restart services
docker-compose down
docker-compose up -d
```

## Troubleshooting

### Common Issues

1. **Backup Failures**
   - Check database connectivity
   - Verify credentials in `.env`
   - Check available disk space
   - Review logs: `docker-compose logs backup-scheduler`

2. **Slow Backups**
   - Increase parallel jobs in `pg_dump`
   - Check network bandwidth
   - Consider using compression

3. **Restore Failures**
   - Verify backup integrity first
   - Check target database permissions
   - Ensure sufficient disk space
   - Review PostgreSQL version compatibility

### Debug Mode

Enable debug logging:
```bash
docker-compose exec backup-scheduler python backup_manager.py backup --debug
```

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backup-scheduler

# System logs
tail -f /var/log/coldcopy/backup.log
```

## Testing

### Test Backup Process

```bash
# Create test backup
docker-compose exec backup-scheduler python backup_manager.py backup

# Verify backup
docker-compose exec backup-scheduler python backup_manager.py verify <backup_name>
```

### Test Restore Process

```bash
# Test restore to temporary database
docker-compose exec backup-scheduler python restore_manager.py restore --backup-name <name> --target-db test_restore

# Verify restored database
docker-compose exec backup-scheduler psql -h $DB_HOST -U $DB_USER -d test_restore -c "SELECT COUNT(*) FROM workspaces;"
```

## Best Practices

1. **Regular Testing**
   - Test restore procedures monthly
   - Verify backup integrity weekly
   - Document any issues and resolutions

2. **Monitoring**
   - Set up alerts for backup failures
   - Monitor backup sizes for anomalies
   - Track backup/restore performance metrics

3. **Documentation**
   - Keep disaster recovery procedures updated
   - Document any custom configurations
   - Maintain contact list for emergencies

4. **Security**
   - Rotate encryption keys annually
   - Audit access logs regularly
   - Test data recovery for GDPR requests

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review logs for error messages
3. Contact the DevOps team
4. Create an issue in the repository

## License

Copyright (c) 2024 ColdCopy. All rights reserved.