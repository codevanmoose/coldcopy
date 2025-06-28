# Email Setup Guide for ColdCopy

## 🚀 Current Status

The ColdCopy email infrastructure has been successfully set up with Amazon SES integration. Here's what's been implemented:

### ✅ Completed Features

1. **Amazon SES Integration**
   - Full SES client implementation with support for single and bulk emails
   - Raw email support with custom headers for tracking
   - Configuration set support for webhooks and reputation monitoring
   - Email verification for sandbox mode

2. **Email API Endpoints**
   - `/api/email/send` - Send emails with GDPR compliance and tracking
   - `/api/email/verify` - Verify email addresses in SES sandbox mode
   - `/api/email/track/open/[id]` - Email open tracking pixel
   - `/api/email/track/click/[id]` - Link click tracking
   - `/api/webhooks/email` - SES webhook handler for bounces/complaints

3. **Email Settings UI**
   - Comprehensive email configuration page at `/settings/email`
   - AWS SES setup guide with step-by-step instructions
   - Domain verification status checking
   - DNS record configuration helpers
   - Test email functionality

4. **GDPR Compliance**
   - Consent checking before sending emails
   - Suppression list management
   - Unsubscribe link generation and handling
   - Audit logging for all email events

5. **Email Tracking & Analytics**
   - Open and click tracking with pixel/link replacement
   - Reply detection and automatic sequence stopping
   - Email event logging for analytics
   - Campaign performance metrics

## 📋 Environment Variables Required

Add these to your `.env.local` file:

```bash
# AWS SES Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here
SES_CONFIGURATION_SET=coldcopy-events

# Application URLs
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## 🔧 AWS SES Setup Steps

### 1. Create AWS Account
1. Sign up at [aws.amazon.com/free](https://aws.amazon.com/free)
2. Navigate to AWS Console → Services → Amazon Simple Email Service (SES)
3. Choose region: `us-east-1` (recommended for global use)

### 2. Verify Your Domain
1. In SES Console: "Verified identities" → "Create identity" → "Domain"
2. Enter your domain (e.g., `yourdomain.com`)
3. Enable DKIM signing
4. Copy the DNS records provided by AWS

### 3. Configure DNS Records
Add these records to your domain's DNS:

```dns
# Domain verification (replace with actual token from AWS)
_amazonses.yourdomain.com    TXT    "verification-token-from-aws"

# SPF record
yourdomain.com               TXT    "v=spf1 include:amazonses.com ~all"

# DMARC policy
_dmarc.yourdomain.com        TXT    "v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdomain.com"

# DKIM keys (replace with actual values from AWS)
selector1._domainkey.yourdomain.com  CNAME  selector1.yourdomain.dkim.amazonses.com
selector2._domainkey.yourdomain.com  CNAME  selector2.yourdomain.dkim.amazonses.com
```

### 4. Create IAM User
1. AWS Console → IAM → Users → Create user
2. Attach policy: `AmazonSESFullAccess`
3. Create access key: Security credentials → Create access key → "Application running outside AWS"
4. Copy Access Key ID and Secret Access Key

### 5. Configure Environment
1. Add AWS credentials to `.env.local`
2. Restart your development server
3. Test configuration in ColdCopy at Settings → Email

### 6. Request Production Access
Once testing is successful:
1. SES Console → Account dashboard → Request production access
2. Fill out the form explaining your use case
3. Wait for AWS approval (usually 24-48 hours)

## 🧪 Testing Email Functionality

### 1. Configure Email Settings
1. Go to `/settings/email` in ColdCopy
2. Set your sender name and email
3. Optionally set a reply-to address

### 2. Send Test Email
1. Click "Send Test Email" button
2. Enter a verified email address (in sandbox mode)
3. Check inbox for successful delivery

### 3. Test Campaign Email
1. Create a new campaign
2. Add leads with verified email addresses
3. Send the campaign and monitor delivery

## 📊 Monitoring & Analytics

### Email Events Tracked
- **Sent**: Email successfully sent to recipient
- **Delivered**: Email delivered to recipient's inbox
- **Opened**: Recipient opened the email
- **Clicked**: Recipient clicked a link
- **Bounced**: Email bounced (hard/soft)
- **Complained**: Recipient marked as spam
- **Replied**: Recipient replied to email

### Viewing Analytics
- Campaign performance: `/campaigns/[id]`
- Email events: `/analytics`
- Deliverability metrics: `/settings/email`

## 🔧 Troubleshooting

### Common Issues

1. **"Email service not configured" error**
   - Check AWS credentials in `.env.local`
   - Restart development server
   - Verify AWS region is correct

2. **"No marketing consent" error**
   - Lead doesn't have marketing consent
   - Update lead consent in lead management
   - Or disable consent checking for testing

3. **Emails not being delivered**
   - Check if you're in SES sandbox mode
   - Verify recipient email addresses in SES Console
   - Check bounce/complaint rates

4. **Domain verification failed**
   - Verify DNS records are correctly configured
   - Allow up to 72 hours for DNS propagation
   - Use DNS checking tools to verify records

### Getting Help

1. Check AWS SES Console for delivery statistics
2. Review CloudWatch logs for SES events
3. Check ColdCopy audit logs in database
4. Monitor bounce and complaint rates

## 🚀 Production Deployment

### Before Going Live
1. ✅ Domain fully verified with DKIM, SPF, DMARC
2. ✅ AWS production access approved
3. ✅ Sender reputation established
4. ✅ Bounce/complaint monitoring set up
5. ✅ Email content templates tested
6. ✅ Unsubscribe links working
7. ✅ GDPR compliance verified

### Production Configuration
```bash
# Production environment variables
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=prod_access_key
AWS_SECRET_ACCESS_KEY=prod_secret_key
SES_CONFIGURATION_SET=coldcopy-prod-events
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

## 📈 Performance & Limits

### AWS SES Limits (New Accounts)
- **Sandbox Mode**: 200 emails/day, 1 email/second
- **Production Mode**: 200 emails/day initially, increases automatically
- **Send Rate**: Starts at 1 email/second, increases with good reputation

### ColdCopy Optimizations
- Batch email sending for better performance
- Rate limiting to respect SES limits
- Retry logic with exponential backoff
- Connection pooling for high volume

## 🎯 Next Steps

With email sending now configured, you can:

1. **Set up email templates** - Create reusable email templates
2. **Configure warm-up** - Gradually increase sending volume
3. **Monitor reputation** - Track deliverability metrics
4. **Scale sending** - Request higher SES limits as needed
5. **Add integrations** - Connect with CRM systems for lead sync

The email infrastructure is now production-ready and can handle thousands of emails per day with proper monitoring and gradual scaling.