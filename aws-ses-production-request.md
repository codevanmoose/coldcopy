# AWS SES Production Access Request Response

Dear AWS SES Team,

Thank you for reviewing our request. Here's the detailed information about ColdCopy's email usage:

## About ColdCopy
ColdCopy (https://coldcopy.cc) is a B2B SaaS platform for sales automation and cold outreach management. We help businesses manage their outreach campaigns with AI-powered personalization.

## Email Use Case
We use Amazon SES exclusively for **transactional emails**:
- User registration confirmation emails
- Password reset emails
- Login verification emails (2FA when enabled)
- Account security notifications
- Billing receipts and subscription updates

## Verified Domain
- **Domain**: coldcopy.cc (already verified in SES)
- **SPF**: Configured with Amazon SES
- **DKIM**: Enabled through SES
- **From Address**: info@coldcopy.cc

## Email Sending Process
1. **Frequency**: Real-time transactional emails triggered by user actions
2. **Volume**: Currently ~50 emails/day, expecting 500-1000/day within 3 months
3. **Authentication**: Using Supabase Auth integrated with SES SMTP
4. **Content**: System-generated transactional emails only

## List Management & Compliance
- **Recipient Lists**: Only registered users who explicitly signed up
- **Double Opt-in**: Email verification required for all new accounts
- **Unsubscribe**: One-click unsubscribe link in all emails
- **Bounce Handling**: Automatic suppression via SES feedback
- **Complaint Handling**: Immediate removal from all communications
- **Data Privacy**: GDPR compliant with user consent tracking

## Email Examples

### 1. Registration Confirmation
```
Subject: Confirm your ColdCopy account
From: ColdCopy <info@coldcopy.cc>

Hi [Name],

Please confirm your email address by clicking the link below:
[Verification Link]

This link expires in 24 hours.

Best regards,
The ColdCopy Team
```

### 2. Password Reset
```
Subject: Reset your ColdCopy password
From: ColdCopy <info@coldcopy.cc>

Hi [Name],

You requested a password reset. Click below to create a new password:
[Reset Link]

If you didn't request this, please ignore this email.

Best regards,
The ColdCopy Team
```

## Technical Implementation
- **Integration**: Supabase Auth with SES SMTP
- **Rate Limiting**: Built-in to prevent abuse
- **Monitoring**: CloudWatch metrics for bounces/complaints
- **Suppression List**: Managed through SES

## Why Production Access
Currently limited to 200 emails/day in sandbox mode, which restricts our ability to onboard new users. We have paying customers waiting to join the platform.

## Contact Information
- **Technical Contact**: jaspervanmoose@gmail.com
- **Website**: https://coldcopy.cc
- **Company**: Van Moose Projects

We are committed to maintaining high sender reputation and following all AWS SES best practices.

Thank you for your consideration.

Best regards,
Jasper van Moose
Founder, ColdCopy