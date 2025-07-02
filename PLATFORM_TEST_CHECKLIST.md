# 🧪 ColdCopy Platform Test Checklist

## Pre-Test Setup
- [ ] Clear browser cache and cookies
- [ ] Use incognito/private browsing mode
- [ ] Have a test email address ready
- [ ] Prepare a small CSV with 2-3 test leads

## 1. Landing Page & Marketing
- [ ] Visit https://coldcopy.cc
- [ ] Check if page loads fast (<3s)
- [ ] Verify all links work
- [ ] Test responsive design on mobile
- [ ] Click "Start Free Trial" CTA

## 2. Authentication Flow
### Sign Up
- [ ] Click "Start Free Trial" or "Sign Up"
- [ ] Enter email and password
- [ ] Receive verification email
- [ ] Click verification link
- [ ] Successfully redirected to dashboard

### Login
- [ ] Log out
- [ ] Try logging in with credentials
- [ ] Test "Forgot Password" flow
- [ ] Verify session persists on refresh

## 3. Workspace Creation
- [ ] Create first workspace
- [ ] Set workspace name and slug
- [ ] Verify demo content appears:
  - [ ] 8 email templates visible
  - [ ] 6 sample campaigns loaded
  - [ ] 5 sample leads imported
  - [ ] Welcome message in inbox

## 4. AI Features Testing
### Email Generation
- [ ] Go to Templates > Create New
- [ ] Test AI email generation
- [ ] Verify GPT-4 is working
- [ ] Test Claude generation
- [ ] Check personalization variables

### Smart Reply
- [ ] Go to Inbox
- [ ] Open any message
- [ ] Click "AI Reply Suggestions"
- [ ] Verify 3-5 suggestions appear
- [ ] Test editing suggestions

### Sentiment Analysis
- [ ] View any conversation
- [ ] Check sentiment indicators
- [ ] Verify emotion detection

## 5. Campaign Creation
- [ ] Click "Create Campaign"
- [ ] Set up basic details
- [ ] Add email sequence (2-3 steps)
- [ ] Select test leads
- [ ] Preview emails
- [ ] Save as draft

## 6. Lead Management
### Import Leads
- [ ] Go to Leads section
- [ ] Click "Import CSV"
- [ ] Upload test CSV file
- [ ] Map fields correctly
- [ ] Verify import success

### Lead Enrichment
- [ ] Select a lead
- [ ] Click "Enrich"
- [ ] Check enrichment data
- [ ] Verify caching works

## 7. Email Sending
### Test Email
- [ ] Create simple campaign
- [ ] Add your email as lead
- [ ] Send test email
- [ ] Verify delivery
- [ ] Check tracking pixels

### Email Tracking
- [ ] Open sent email
- [ ] Click a link
- [ ] Check analytics update
- [ ] Verify open/click tracking

## 8. Team Features
### Team Inbox
- [ ] Check shared inbox
- [ ] Test conversation assignment
- [ ] Leave internal note
- [ ] Test reply functionality

### Team Management
- [ ] Go to Settings > Team
- [ ] Try inviting team member
- [ ] Check role permissions
- [ ] Test workspace switching

## 9. Integrations
### CRM Integration
- [ ] Go to Settings > Integrations
- [ ] Check HubSpot connection
- [ ] Test Salesforce OAuth
- [ ] Verify sync status

### Calendar Integration
- [ ] Connect Google Calendar
- [ ] Test availability detection
- [ ] Create booking page
- [ ] Test meeting scheduling

## 10. Billing & Payments
- [ ] Go to Settings > Billing
- [ ] View current plan (Free)
- [ ] Click "Upgrade"
- [ ] Test Stripe checkout
- [ ] Use test card: 4242 4242 4242 4242
- [ ] Verify subscription active

## 11. Performance & Infrastructure
### Redis Caching
- [ ] Visit /redis-status
- [ ] Verify Redis connected
- [ ] Check cache statistics
- [ ] Test page load speeds

### API Performance
- [ ] Navigate quickly between pages
- [ ] Check for any slow queries
- [ ] Verify no console errors
- [ ] Test concurrent actions

## 12. White Label Features
- [ ] Go to Settings > White Label
- [ ] Test custom branding preview
- [ ] Check domain settings
- [ ] Verify CSS customization

## 13. Analytics & Reporting
- [ ] Go to Analytics section
- [ ] Check campaign metrics
- [ ] Test date filtering
- [ ] Export report (CSV/PDF)
- [ ] Verify chart rendering

## 14. GDPR & Compliance
- [ ] Test unsubscribe link
- [ ] Check privacy center
- [ ] Request data export
- [ ] Verify cookie consent

## 15. Mobile Experience
- [ ] Test on mobile device
- [ ] Check responsive layouts
- [ ] Test touch interactions
- [ ] Verify mobile menu

## Common Issues to Check

### Authentication Issues
- **Infinite loading on login**: Fixed ✓
- **Session timeout**: Should persist
- **Password reset delivery**: Check spam

### AI Issues
- **API key errors**: Keys are configured ✓
- **Rate limiting**: Should show clear message
- **Model selection**: Both GPT-4 and Claude work

### Email Issues
- **SES sandbox**: Limited to verified emails
- **Tracking pixel blocked**: Normal for some clients
- **Spam folder**: Check sender reputation

### Performance Issues
- **Slow dashboard**: Redis should help
- **Large imports**: Should handle 10k+ leads
- **Analytics loading**: Check date ranges

## Test Results Log

### ✅ Working Features
- 

### ⚠️ Minor Issues
- 

### ❌ Critical Issues
- 

### 📝 Notes
- 

## Next Steps After Testing
1. Fix any critical issues found
2. Document minor issues for later
3. Create user onboarding flow
4. Set up monitoring alerts
5. Prepare for first real users

---

**Test Date**: ___________
**Tested By**: ___________
**Platform Version**: Production
**Overall Status**: ⬜ Pass / ⬜ Fail