# ColdCopy Email Infrastructure

A production-ready email sending infrastructure built on Amazon SES with multi-region failover, automatic IP warm-up, reputation monitoring, and GDPR compliance.

## Features

- **Multi-Region Failover**: Automatic failover between US-East-1 (primary) and EU-West-1 (backup)
- **IP Warm-up Automation**: 30-day progressive warm-up schedule for new IPs
- **Reputation Monitoring**: Real-time dashboard with bounce/complaint tracking
- **Event Processing**: Webhook handler for all SES events (bounces, complaints, opens, clicks)
- **Suppression Management**: Automatic suppression list with TTL and manual override
- **Rate Limiting**: Token bucket algorithm with burst support
- **Queue Management**: Redis-based email queue with retry logic
- **GDPR Compliance**: Unsubscribe handling, data retention, consent tracking

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   FastAPI App   │────▶│  Email Service   │────▶│   Amazon SES    │
│                 │     │                  │     │   Multi-Region  │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │
                    ┌──────────┴──────────┐
                    │                     │
              ┌─────▼─────┐        ┌──────▼──────┐
              │   Redis    │        │  PostgreSQL │
              │   Queue    │        │   Events    │
              └───────────┘        └─────────────┘
```

## Quick Start

### Prerequisites

- AWS Account with SES access
- Redis server
- PostgreSQL database (Supabase)
- Docker and Docker Compose
- Python 3.11+

### Installation

1. **Clone and navigate to email infrastructure**:
```bash
cd infrastructure/email
```

2. **Configure environment variables**:
```bash
cp .env.example .env
# Edit .env with your AWS credentials and configuration
```

3. **Run setup script**:
```bash
./setup.sh
```

This will:
- Install dependencies
- Initialize SES configuration sets
- Create database tables
- Start all services with Docker Compose

### Manual Setup (Without Docker)

1. **Install dependencies**:
```bash
pip install -r requirements.txt
```

2. **Initialize SES**:
```bash
python init_ses.py init
```

3. **Run services individually**:
```bash
# Terminal 1: Reputation Monitor
python reputation_monitor.py

# Terminal 2: Event Processor
python event_processor.py

# Terminal 3: Start Redis if not running
redis-server
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `AWS_ACCESS_KEY_ID` | AWS access key | Required |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | Required |
| `AWS_REGION` | Primary SES region | us-east-1 |
| `AWS_BACKUP_REGIONS` | Backup regions (comma-separated) | eu-west-1 |
| `DB_HOST` | PostgreSQL host | Required |
| `DB_PASSWORD` | PostgreSQL password | Required |
| `REDIS_URL` | Redis connection URL | redis://localhost:6379 |
| `FROM_EMAIL` | Default from email | noreply@coldcopy.ai |
| `TRACKING_DOMAIN` | Domain for tracking | track.coldcopy.ai |

### DNS Configuration

After running `init_ses.py`, configure these DNS records:

1. **Domain Verification**:
```
_amazonses.yourdomain.com    TXT    "verification-token"
```

2. **DKIM Records** (3 records):
```
token1._domainkey.yourdomain.com    CNAME    token1.dkim.amazonses.com
token2._domainkey.yourdomain.com    CNAME    token2.dkim.amazonses.com
token3._domainkey.yourdomain.com    CNAME    token3.dkim.amazonses.com
```

3. **SPF Record**:
```
yourdomain.com    TXT    "v=spf1 include:amazonses.com ~all"
```

4. **DMARC Record**:
```
_dmarc.yourdomain.com    TXT    "v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdomain.com"
```

## Usage

### Sending Emails via API

The email infrastructure integrates with the FastAPI backend. Available endpoints:

#### Send Single Email
```bash
POST /api/ses/send
{
  "recipients": [{
    "email": "user@example.com",
    "name": "John Doe",
    "merge_vars": {"first_name": "John"}
  }],
  "template": {
    "subject": "Hello {{first_name}}",
    "html_body": "<h1>Welcome {{first_name}}!</h1>",
    "text_body": "Welcome {{first_name}}!"
  },
  "email_type": "transactional"
}
```

#### Send Campaign Emails
```bash
POST /api/ses/campaigns/{campaign_id}/send
{
  "recipients": [...],
  "template": {...}
}
```

#### Check Email Status
```bash
GET /api/ses/status/{message_id}
```

#### Get Reputation Status
```bash
GET /api/ses/reputation
```

### Testing

Test email sending functionality:

```bash
# Send test email
python test_email.py user@example.com

# Test with marketing template
python test_email.py user@example.com --type marketing

# Test bounce handling
python test_email.py --test-bounce

# View statistics
python test_email.py --stats
```

## Services

### 1. Reputation Monitor (Port 8091)

Real-time dashboard for monitoring email reputation:
- View bounce/complaint rates by region
- Track reputation scores
- Get deliverability insights
- Monitor sending quotas

Access at: http://localhost:8091

### 2. Event Processor (Port 8092)

Webhook handler for SES events:
- Processes bounces and complaints
- Updates suppression list
- Tracks email engagement
- Stores events in PostgreSQL

Webhook URL: https://your-domain.com/webhooks/ses

### 3. Email Queue Processor

Background service that:
- Processes queued emails
- Handles retries with exponential backoff
- Manages rate limiting
- Distributes load across regions

### 4. IP Warm-up Scheduler

Automated warm-up for new IPs:
- Gradually increases sending volume over 30 days
- Monitors IP health metrics
- Pauses on reputation issues
- Sends to major ISPs for optimal results

## Monitoring

### Prometheus Metrics

Available metrics at `/metrics`:
- `coldcopy_emails_sent_total`
- `coldcopy_email_send_duration_seconds`
- `coldcopy_ses_reputation_score`
- `coldcopy_ses_bounce_rate`
- `coldcopy_ses_complaint_rate`
- `coldcopy_suppression_list_size`

### Health Checks

- Reputation Monitor: `GET http://localhost:8091/health`
- Event Processor: `GET http://localhost:8092/health`

### Logs

View logs:
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f reputation-monitor
```

## Database Schema

### email_events (Partitioned by month)
```sql
CREATE TABLE email_events (
    id UUID PRIMARY KEY,
    event_type VARCHAR(50),
    email VARCHAR(255),
    timestamp TIMESTAMPTZ,
    message_id VARCHAR(255),
    workspace_id UUID,
    campaign_id UUID,
    lead_id UUID,
    bounce_type VARCHAR(50),
    bounce_subtype VARCHAR(50),
    complaint_type VARCHAR(50),
    raw_event JSONB
) PARTITION BY RANGE (timestamp);
```

### lead_engagement
```sql
CREATE TABLE lead_engagement (
    id UUID PRIMARY KEY,
    lead_id UUID,
    action VARCHAR(50),
    timestamp TIMESTAMPTZ,
    metadata JSONB
);
```

## Troubleshooting

### Common Issues

1. **"Email not sending"**
   - Check AWS credentials in `.env`
   - Verify domain/email is verified in SES
   - Check if in SES sandbox mode
   - Review logs: `docker-compose logs email-queue-processor`

2. **"High bounce rate"**
   - Check email validation before sending
   - Review bounce types in event processor logs
   - Verify email list quality
   - Check suppression list size

3. **"Reputation declining"**
   - Review complaint rate
   - Check email content for spam triggers
   - Verify opt-in process
   - Reduce sending volume temporarily

4. **"Rate limit exceeded"**
   - Check current SES quotas
   - Adjust `RATE_LIMIT_PER_SECOND` in `.env`
   - Use queue for bulk sends
   - Consider requesting quota increase

### Debug Mode

Enable detailed logging:
```bash
export LOG_LEVEL=DEBUG
docker-compose up
```

### Manual Suppression Management

```python
# Add to suppression list
from ses_manager import SESManager, SESConfig
manager = SESManager(SESConfig(...))
await manager.add_to_suppression_list("user@example.com", "Manual suppression")

# Remove from suppression list
await manager.remove_from_suppression_list("user@example.com")
```

## Production Deployment

### Digital Ocean Deployment

1. **Create Droplet**:
   - Ubuntu 22.04 LTS
   - 2 vCPU, 4GB RAM minimum
   - Enable backups

2. **Install Dependencies**:
```bash
sudo apt update
sudo apt install docker.io docker-compose
sudo systemctl enable docker
```

3. **Deploy Services**:
```bash
git clone <repository>
cd infrastructure/email
./setup.sh
```

4. **Configure Nginx** (optional):
```nginx
server {
    listen 80;
    server_name email.yourdomain.com;
    
    location /webhooks/ses {
        proxy_pass http://localhost:8092;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    location / {
        proxy_pass http://localhost:8091;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Scaling Considerations

1. **Horizontal Scaling**:
   - Run multiple email queue processors
   - Use Redis Cluster for high volume
   - Implement database read replicas

2. **Performance Optimization**:
   - Enable Redis persistence
   - Use connection pooling
   - Implement caching for templates
   - Batch database writes

3. **High Availability**:
   - Deploy across multiple regions
   - Use managed Redis (ElastiCache)
   - Implement health check automation
   - Set up automated backups

## Security

### Best Practices

1. **Credentials**:
   - Use IAM roles in production
   - Rotate access keys regularly
   - Never commit credentials

2. **Network Security**:
   - Use VPC for database access
   - Implement IP whitelisting
   - Enable SSL/TLS everywhere

3. **Data Protection**:
   - Encrypt sensitive data at rest
   - Use secure webhook endpoints
   - Implement rate limiting
   - Regular security audits

## API Reference

### Email Service Methods

```python
from email_service import EmailService, SendEmailRequest

# Initialize service
service = EmailService(config)

# Send email
request = SendEmailRequest(
    recipients=[...],
    template=...,
    email_type="transactional"
)
result = await service.send_email(request)

# Check status
status = await service.get_email_status(message_id)

# Validate email
validation = await service.validate_email("user@example.com")

# Get statistics
stats = await service.get_sending_stats(workspace_id)
```

## Contributing

1. Fork the repository
2. Create feature branch
3. Add tests for new features
4. Ensure all tests pass
5. Submit pull request

## License

Copyright (c) 2024 ColdCopy. All rights reserved.