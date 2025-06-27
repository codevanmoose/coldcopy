# ColdCopy Webhook Setup Guide

This guide explains how to configure webhooks from various email service providers to work with ColdCopy's webhook endpoints.

## Supported Email Providers

ColdCopy supports webhooks from the following email service providers:

- **Amazon SES** (via SNS)
- **SendGrid**
- **Mailgun**
- **Postmark**

## Webhook Endpoints

All webhook endpoints are available under `/api/webhooks/`:

- `POST /api/webhooks/ses` - Amazon SES/SNS webhooks
- `POST /api/webhooks/sendgrid` - SendGrid webhooks
- `POST /api/webhooks/mailgun` - Mailgun webhooks
- `POST /api/webhooks/postmark` - Postmark webhooks
- `GET /api/webhooks/health` - Webhook service health check

## Amazon SES Setup

### 1. Configure SNS Topic

```bash
# Create SNS topic for SES events
aws sns create-topic --name coldcopy-ses-events

# Get the topic ARN
aws sns get-topic-attributes --topic-arn arn:aws:sns:us-east-1:123456789:coldcopy-ses-events
```

### 2. Subscribe Webhook Endpoint

```bash
# Subscribe your webhook endpoint to the SNS topic
aws sns subscribe \
  --topic-arn arn:aws:sns:us-east-1:123456789:coldcopy-ses-events \
  --protocol https \
  --notification-endpoint https://api.coldcopy.cc/api/webhooks/ses
```

### 3. Configure SES Event Publishing

```bash
# Configure SES to publish events to SNS
aws ses put-configuration-set-event-destination \
  --configuration-set-name coldcopy-events \
  --event-destination Name=sns-destination,Enabled=true,SNSDestination={TopicARN=arn:aws:sns:us-east-1:123456789:coldcopy-ses-events},MatchingEventTypes=send,bounce,complaint,delivery,open,click
```

### 4. Environment Variables

Add these to your `.env` file:

```env
AWS_SNS_SECRET=your_sns_webhook_secret
VERIFY_WEBHOOK_SIGNATURES=true
```

## SendGrid Setup

### 1. Configure Event Webhook

1. Go to SendGrid dashboard → Settings → Mail Settings → Event Webhook
2. Set HTTP Post URL: `https://api.coldcopy.cc/api/webhooks/sendgrid`
3. Select events to track:
   - Delivered
   - Bounced
   - Dropped
   - Spam Reports
   - Unsubscribes
   - Opens
   - Clicks

### 2. Configure Signed Webhooks

1. Enable "Signed Event Webhook"
2. Generate a verification key
3. Add to environment variables

### 3. Environment Variables

```env
SENDGRID_WEBHOOK_KEY=your_sendgrid_verification_key
VERIFY_WEBHOOK_SIGNATURES=true
```

## Mailgun Setup

### 1. Configure Webhooks

```bash
# Using Mailgun API
curl -s --user 'api:YOUR_API_KEY' \
  https://api.mailgun.net/v3/domains/yourdomain.com/webhooks \
  -F id='delivered' \
  -F url='https://api.coldcopy.cc/api/webhooks/mailgun'
```

Or via Mailgun dashboard:
1. Go to Sending → Webhooks
2. Add webhook URL: `https://api.coldcopy.cc/api/webhooks/mailgun`
3. Select events: delivered, failed, opened, clicked, unsubscribed, complained

### 2. Configure Webhook Signing

1. Enable webhook signing in Mailgun dashboard
2. Copy the signing key
3. Add to environment variables

### 3. Environment Variables

```env
MAILGUN_WEBHOOK_KEY=your_mailgun_signing_key
VERIFY_WEBHOOK_SIGNATURES=true
```

## Postmark Setup

### 1. Configure Webhooks

1. Go to Postmark server → Settings → Webhooks
2. Add webhook URL: `https://api.coldcopy.cc/api/webhooks/postmark`
3. Select webhook types:
   - Delivery webhook
   - Bounce webhook
   - Spam complaint webhook
   - Open tracking webhook
   - Click tracking webhook

### 2. Environment Variables

```env
POSTMARK_WEBHOOK_KEY=your_postmark_webhook_secret
VERIFY_WEBHOOK_SIGNATURES=true
```

## Webhook Event Types

### Standard Event Types

ColdCopy normalizes all provider events to these standard types:

- `sent` - Email was sent successfully
- `delivered` - Email was delivered to recipient
- `bounced` - Email bounced (soft or hard)
- `failed` - Email sending failed
- `opened` - Email was opened by recipient
- `clicked` - Link in email was clicked
- `complained` - Recipient marked as spam
- `unsubscribed` - Recipient unsubscribed

### Provider-Specific Mappings

#### Amazon SES
- `send` → `sent`
- `delivery` → `delivered`
- `bounce` → `bounced`
- `complaint` → `complained`
- `open` → `opened`
- `click` → `clicked`
- `reject` → `rejected`

#### SendGrid
- `processed` → `sent`
- `delivered` → `delivered`
- `bounce` → `bounced`
- `dropped` → `dropped`
- `spamreport` → `complained`
- `unsubscribe` → `unsubscribed`
- `open` → `opened`
- `click` → `clicked`

#### Mailgun
- `delivered` → `delivered`
- `failed` → `failed`
- `opened` → `opened`
- `clicked` → `clicked`
- `unsubscribed` → `unsubscribed`
- `complained` → `complained`

#### Postmark
- `delivery` → `delivered`
- `bounce` → `bounced`
- `spamcomplaint` → `complained`
- `open` → `opened`
- `click` → `clicked`

## Webhook Security

### Signature Verification

ColdCopy automatically verifies webhook signatures when enabled:

```env
VERIFY_WEBHOOK_SIGNATURES=true
```

Each provider uses different signature methods:

- **SES/SNS**: HMAC-SHA256 with SNS secret
- **SendGrid**: ECDSA signature verification
- **Mailgun**: HMAC-SHA256 with signing key
- **Postmark**: HMAC-SHA256 with webhook secret

### IP Whitelisting

For additional security, you can whitelist provider IPs:

#### SendGrid IPs
```
149.72.172.0/24
149.72.173.0/24
149.72.174.0/24
149.72.175.0/24
```

#### Mailgun IPs
```
50.56.129.169/32
69.72.43.7/32
173.193.210.51/32
```

### HTTPS Only

All webhook endpoints require HTTPS connections. HTTP requests will be rejected.

## Testing Webhooks

### Test Endpoints

Development test endpoints are available:

```bash
# Test SES webhook
curl -X GET https://api.coldcopy.cc/api/webhooks/test/ses

# Test SendGrid webhook
curl -X GET https://api.coldcopy.cc/api/webhooks/test/sendgrid

# Test Mailgun webhook
curl -X GET https://api.coldcopy.cc/api/webhooks/test/mailgun
```

### Health Check

Check webhook service health:

```bash
curl https://api.coldcopy.cc/api/webhooks/health
```

### Webhook Logs

Monitor webhook processing in application logs:

```bash
# Filter webhook logs
grep "webhook" /var/log/coldcopy/app.log

# Monitor real-time
tail -f /var/log/coldcopy/app.log | grep webhook
```

## Troubleshooting

### Common Issues

1. **Signature Verification Failed**
   - Check webhook secret configuration
   - Verify environment variables
   - Ensure HTTPS is used

2. **Events Not Processing**
   - Check Celery worker status
   - Verify Redis connection
   - Check database connectivity

3. **Missing Events**
   - Verify webhook URL configuration
   - Check provider event selection
   - Monitor webhook health endpoint

### Debug Mode

Enable debug logging for webhook processing:

```env
LOG_LEVEL=DEBUG
```

### Manual Event Processing

For testing, you can manually trigger event processing:

```python
from workers.webhook_tasks import process_webhook_event

# Example event data
event_data = {
    "provider": "sendgrid",
    "event_type": "delivered",
    "message_id": "test-123",
    "recipient_email": "test@example.com",
    "timestamp": "2024-01-15T10:30:00Z",
    "event_data": {...}
}

# Process event
process_webhook_event.delay(event_data)
```

## Rate Limiting

Webhook endpoints have rate limiting configured:

- **Default**: 60 requests per minute
- **Burst**: 100 requests per minute
- **Per IP**: Configurable in settings

## Monitoring

### Metrics

ColdCopy tracks webhook metrics:

- Event processing rate
- Processing latency
- Error rates by provider
- Signature verification failures

### Alerting

Set up alerts for:

- High error rates (>5%)
- Processing delays (>30s)
- Signature verification failures
- Webhook endpoint downtime

## Best Practices

1. **Always use HTTPS** for webhook endpoints
2. **Enable signature verification** in production
3. **Monitor webhook health** regularly
4. **Set up proper alerting** for failures
5. **Log all webhook events** for debugging
6. **Use test endpoints** during development
7. **Implement proper error handling** in your application
8. **Monitor rate limits** to avoid throttling

## Support

For webhook-related issues:

1. Check the webhook health endpoint
2. Review application logs
3. Verify provider configuration
4. Test with sample events
5. Contact support with specific error details