# AWS SES Production Access Request Template

## 🚀 Quick Action Required

**Status**: Currently in SANDBOX mode (200 emails/day limit)
**Action Needed**: Submit production access request to AWS

## Step-by-Step Instructions

### 1. Login to AWS Console
- Go to: https://console.aws.amazon.com/ses/
- Select region: **US East (N. Virginia) us-east-1**

### 2. Navigate to Production Access
- Click "Account dashboard" in left sidebar
- Find "Your account is in the sandbox" warning
- Click "Request production access" button

### 3. Copy & Paste This Information

**Use Case Description:**
```
ColdCopy is a B2B sales automation platform that helps businesses with cold outreach campaigns. We send personalized sales emails on behalf of our users to their prospects.

Email Types:
- Transactional: Account notifications, password resets, receipts
- Marketing: B2B sales outreach campaigns (user-initiated)
- Notifications: Reply alerts, campaign reports

All recipients are business contacts added by our users, with full compliance to CAN-SPAM and GDPR.
```

**Website URL:** `https://coldcopy.cc`

**Expected Volume:** `10,000-50,000 emails per month`

**How do you handle bounces and complaints?**
```
We have automated systems in place:
1. SES webhooks process all bounce/complaint events in real-time
2. Hard bounces are immediately added to suppression list
3. Complaints trigger automatic unsubscribe
4. Dashboard shows bounce/complaint rates to users
5. Accounts exceeding 5% bounce or 0.1% complaint rate are automatically paused
```

**How do recipients opt-in?**
```
B2B sales context:
- Recipients are business contacts identified by our users
- Each email includes clear sender identification
- One-click unsubscribe link in every email
- Suppression list prevents re-contacting unsubscribed addresses
- Full CAN-SPAM and GDPR compliance
```

**Additional Information:**
```
- Domain coldcopy.cc is verified with SPF, DKIM, and DMARC
- We use configuration sets to separate transactional and marketing emails
- Real-time monitoring of sender reputation
- Dedicated support team for compliance issues
- Previous experience managing email infrastructure at scale
```

### 4. Select Options
- **Mail Type**: Marketing
- **AWS Region**: US East (N. Virginia)
- **Websites**: https://coldcopy.cc
- **Use Case**: Business-to-Business (B2B) outreach

### 5. Submit and Wait
- Submit the form
- AWS typically responds within 24-48 hours
- Check email for approval notification

## 📊 What Happens After Approval

1. **Immediate Changes**:
   - Sending limit increases to 50,000 emails/day
   - Can send to any email address (not just verified)
   - Maximum send rate increases to 14 emails/second

2. **Platform Updates Needed**:
   - Update rate limiting in email service
   - Remove sandbox warnings from UI
   - Enable bulk sending features
   - Update monitoring dashboards

3. **Best Practices**:
   - Start with lower volumes and ramp up
   - Monitor metrics closely first week
   - Keep bounce rate < 5%
   - Keep complaint rate < 0.1%

## 🔔 Important Notes

- **Current Workaround**: Platform uses Supabase email (3/hour) until approved
- **No Platform Changes Needed**: Code already supports production SES
- **Cost**: ~$5/month for 50,000 emails
- **Alternative**: Can use SendGrid/Postmark if SES denied

## 📝 Quick Checklist

- [ ] Login to AWS Console
- [ ] Navigate to SES → Account dashboard
- [ ] Click "Request production access"
- [ ] Copy/paste the template above
- [ ] Submit form
- [ ] Wait 24-48 hours for approval
- [ ] Update platform settings once approved

---

**Time Required**: 5 minutes to submit
**Approval Time**: 24-48 hours
**Impact**: Enables full email sending capabilities