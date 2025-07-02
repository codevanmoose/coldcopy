# Fix Supabase Email Delivery Issues

## Quick Diagnosis

### 1. Check Supabase Email Settings
Go to: https://supabase.com/dashboard/project/zicipvpablahehxstbfr/auth/providers

Make sure:
- **Email** provider is ENABLED (toggle should be ON)
- **Confirm email** is enabled if you want email verification

### 2. Check Email Rate Limits
Go to: https://supabase.com/dashboard/project/zicipvpablahehxstbfr/auth/rate-limits

**Free tier limits:**
- 3 emails per hour
- If you've hit this limit, you'll need to wait or upgrade

### 3. Check Email Templates
Go to: https://supabase.com/dashboard/project/zicipvpablahehxstbfr/auth/templates

Make sure the "Confirm signup" template is active and properly configured.

## Solutions

### Option 1: Use Custom SMTP (Recommended for Production)
Since you already have Amazon SES configured, you can use it for Supabase auth emails:

1. Go to: https://supabase.com/dashboard/project/zicipvpablahehxstbfr/settings/auth
2. Scroll to "SMTP Settings"
3. Enable "Custom SMTP"
4. Enter your Amazon SES credentials:
   - Host: `email-smtp.us-east-1.amazonaws.com`
   - Port: `587`
   - Username: Your AWS SMTP username
   - Password: Your AWS SMTP password
   - Sender email: Your verified SES email
   - Sender name: `ColdCopy`

### Option 2: Disable Email Confirmation (For Testing)
1. Go to: https://supabase.com/dashboard/project/zicipvpablahehxstbfr/auth/providers
2. Under Email settings, disable "Confirm email"
3. Users will be automatically confirmed without email verification

### Option 3: Upgrade Supabase Plan
The Pro plan ($25/month) includes:
- Unlimited auth emails
- Custom SMTP support
- Better deliverability

## Testing Email Delivery

After making changes, test with:
1. Sign up with a real email address (not @example.com)
2. Check spam/junk folder
3. Wait a few minutes for delivery

## Current Status

Your app is configured to use:
- **Supabase built-in email** for authentication (signup, password reset)
- **Amazon SES** for campaign emails

The issue is likely:
1. Rate limit exceeded (3 emails/hour on free tier)
2. Emails going to spam
3. Email provider disabled in Supabase

## Recommended Action

For production, configure Supabase to use your Amazon SES SMTP credentials. This will:
- Remove rate limits
- Improve deliverability
- Use your verified domain
- Provide consistent email experience