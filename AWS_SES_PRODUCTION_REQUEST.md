# AWS SES Production Access Request Guide

## Step-by-Step Instructions for January 4, 2025

### 1. Log into AWS Console
- URL: https://console.aws.amazon.com/
- Make sure you're in the **us-east-1** region (N. Virginia)

### 2. Navigate to SES
- Search for "SES" in the AWS services search bar
- Click on "Amazon Simple Email Service"

### 3. Request Production Access
- In the left sidebar, click on "Account dashboard"
- Look for the orange banner saying "Your account is in the sandbox"
- Click the "Request production access" button

### 4. Fill Out the Request Form

#### Use Case Details
**Mail Type**: Marketing
**Website URL**: https://coldcopy.cc
**Use Case Description**:
```
ColdCopy is a B2B sales automation platform that helps agencies and sales teams personalize and send cold outreach emails. Our platform:

1. Enables users to send personalized sales emails to their prospects
2. Provides AI-powered email personalization using GPT-4 and Claude
3. Includes full unsubscribe management and GDPR compliance
4. Implements bounce and complaint handling via SES webhooks
5. Maintains suppression lists to prevent sending to opted-out recipients

All recipients are business contacts added by our users for legitimate B2B outreach.
```

#### Additional Details
**How do you plan to build or acquire your mailing list?**:
```
Users upload their own B2B prospect lists through CSV import or manual entry. We do not sell or provide email lists. Each user manages their own contacts and is responsible for ensuring they have legitimate business reasons to contact their prospects.
```

**How do you handle bounces and complaints?**:
```
1. Automated bounce processing via SES SNS webhooks
2. Hard bounces are immediately added to suppression list
3. Soft bounces are retried with exponential backoff
4. Complaints trigger immediate unsubscribe and investigation
5. Real-time monitoring dashboard for bounce/complaint rates
6. Automatic pause of campaigns if rates exceed thresholds
```

**How can recipients opt out?**:
```
1. One-click unsubscribe link in every email footer
2. Unsubscribe page requires no login or authentication
3. Instant processing - no delays or confirmation required
4. Reply with "STOP" or "UNSUBSCRIBE" triggers auto-unsubscribe
5. Global suppression list prevents re-subscription by mistake
6. GDPR-compliant data deletion options available
```

#### Configuration Details
**Additional configuration details**:
```
- Dedicated configuration sets for transactional vs marketing emails
- Event publishing to track opens, clicks, bounces, and complaints
- Custom headers for campaign tracking and analytics
- SPF, DKIM, and DMARC properly configured for coldcopy.cc
- Rate limiting to respect recipient server limits
```

#### Expected Volume
**Expected daily volume**: 10,000 emails
**Expected peak send rate**: 50 emails/second

### 5. Submit the Request
- Review all information
- Click "Submit request"
- You'll receive a case number

### 6. Monitor the Request
- Check your email for updates
- Typically approved within 24-48 hours
- May receive follow-up questions

### 7. After Approval
Once approved, update the platform:
1. Remove sandbox restrictions in the code
2. Update rate limits to match approved levels
3. Configure dedicated IP pool if needed
4. Set up CloudWatch alarms for monitoring

## Support Case Template
If you need to create a support case instead:

**Subject**: Request for SES Production Access - ColdCopy B2B Sales Platform

**Description**:
We are requesting production access for our B2B sales automation platform ColdCopy (https://coldcopy.cc).

Platform Overview:
- B2B cold email outreach tool for sales teams and agencies
- AI-powered personalization using GPT-4 and Claude
- Full compliance with CAN-SPAM and GDPR regulations
- Automated bounce and complaint handling
- One-click unsubscribe in all emails

Technical Implementation:
- Domain: coldcopy.cc (SPF, DKIM, DMARC configured)
- Bounce handling: Automated via SNS webhooks
- Complaint handling: Immediate suppression and investigation
- List management: User-uploaded B2B contacts only
- Expected volume: 10,000 emails/day initially

We have thoroughly tested in sandbox mode and are ready for production deployment.

---

**Remember**: Be honest and thorough in your responses. AWS values transparency and proper email practices.