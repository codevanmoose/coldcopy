# 🧪 ColdCopy User Journey Test

## Test Objective
Verify the complete user experience from landing page to sending first email.

## Prerequisites
- [ ] Clear browser cache
- [ ] Use incognito/private browsing
- [ ] Have test email address ready
- [ ] Prepare 2-3 test leads (CSV or manual entry)

## Test Steps

### Step 1: Landing Page Experience
1. **Visit**: https://coldcopy.cc
2. **Check**: Page loads in <3 seconds
3. **Verify**: All sections visible (hero, features, pricing, etc.)
4. **Test**: Click "Start Free Trial" button

**Expected**: Redirects to signup page

---

### Step 2: Sign Up Flow
1. **Enter**: Test email address
2. **Create**: Strong password
3. **Click**: "Create Account"
4. **Check**: Email verification sent
5. **Open**: Verification email
6. **Click**: Verification link

**Expected**: Account verified, redirected to workspace creation

---

### Step 3: Workspace Creation
1. **Enter**: Workspace name (e.g., "Test Company")
2. **Enter**: Workspace slug (e.g., "test-company")
3. **Click**: "Create Workspace"
4. **Wait**: 2-3 seconds for demo content to load

**Expected**: Dashboard loads with demo content

---

### Step 4: Demo Content Verification
Check the following sections have demo data:

**Templates Section**:
- [ ] 8 email templates visible
- [ ] Categories: SaaS, E-commerce, Recruiting, etc.
- [ ] Can preview template content

**Campaigns Section**:
- [ ] 6 sample campaigns visible
- [ ] Metrics showing (emails sent, open rates, etc.)
- [ ] Different statuses (active, paused, completed, draft)

**Leads Section**:
- [ ] 5 sample leads imported
- [ ] Contact information filled out
- [ ] Enrichment data visible

**Inbox Section**:
- [ ] Welcome message from ColdCopy team
- [ ] Explains demo content and next steps

---

### Step 5: AI Email Generation Test
1. **Navigate**: Templates → Create New
2. **Select**: AI Email Generator
3. **Enter**: Prompt (e.g., "Write a cold email to a SaaS founder")
4. **Add**: Lead data (name, company, industry)
5. **Choose**: GPT-4 or Claude
6. **Click**: Generate

**Expected**: 
- Email generated in 2-5 seconds
- Professional, personalized content
- Variables properly replaced

---

### Step 6: Campaign Creation
1. **Navigate**: Campaigns → Create New
2. **Fill out**:
   - Campaign name: "Test Campaign"
   - Description: "Testing email functionality"
3. **Set up sequence**:
   - Step 1: Select a template or use AI-generated email
   - Add 2-day delay
   - Step 2: Follow-up email
4. **Select leads**: Choose 1-2 test leads
5. **Save**: As draft

**Expected**: Campaign created successfully

---

### Step 7: Email Sending Test
1. **Add yourself**: As a lead in the system
2. **Create simple campaign**: With your email as recipient
3. **Send test email**: Use "Send Test" or activate campaign
4. **Check inbox**: Verify email received
5. **Click tracking**: Click any links in email
6. **Return**: Check analytics for open/click tracking

**Expected**: 
- Email delivered to inbox (not spam)
- Tracking pixels working
- Analytics updated

---

### Step 8: Team Features Test
1. **Navigate**: Settings → Team
2. **Try**: Invite team member (use test email)
3. **Check**: Invitation email sent
4. **Test**: Different role permissions

**Expected**: Team management functional

---

### Step 9: Integrations Check
1. **Navigate**: Settings → Integrations
2. **View**: Available integrations (HubSpot, Salesforce, etc.)
3. **Test**: OAuth flow for one integration (optional)

**Expected**: Integration options available

---

### Step 10: Billing Test
1. **Navigate**: Settings → Billing
2. **View**: Current plan (Free tier)
3. **Click**: "Upgrade" or "View Plans"
4. **Test**: Stripe checkout (use test card: 4242 4242 4242 4242)
5. **Cancel**: Before completing (unless you want to upgrade)

**Expected**: Stripe checkout loads correctly

---

## Issue Tracking

### ✅ Working Features
- Landing page performance: ⏱️ _____ seconds
- Signup flow: ✅ / ❌
- Email verification: ✅ / ❌
- Workspace creation: ✅ / ❌
- Demo content loading: ✅ / ❌
- AI email generation: ✅ / ❌
- Campaign creation: ✅ / ❌
- Email sending: ✅ / ❌

### 🐛 Issues Found
1. **Issue**: ________________________________
   **Severity**: High / Medium / Low
   **Steps to reproduce**: ________________________________

2. **Issue**: ________________________________
   **Severity**: High / Medium / Low
   **Steps to reproduce**: ________________________________

### 📝 Notes
- Browser used: ________________________________
- Device: ________________________________
- Network: ________________________________
- Time taken: ________________________________

---

## Success Criteria

**Test PASSES if**:
- [ ] User can sign up and verify email
- [ ] Workspace creation works with demo content
- [ ] AI email generation produces quality content
- [ ] Can create and send test campaign
- [ ] Email delivery and tracking work
- [ ] No critical errors in browser console

**Test FAILS if**:
- [ ] Signup process broken
- [ ] Demo content doesn't load
- [ ] AI generation fails or produces poor content
- [ ] Cannot send emails
- [ ] Critical UI/UX issues

---

## Next Steps After Testing

**If test passes**:
1. Platform is ready for real users
2. Set up monitoring and analytics
3. Prepare launch materials
4. Start user acquisition

**If test fails**:
1. Document all issues found
2. Prioritize fixes (critical → nice-to-have)
3. Fix critical issues first
4. Re-test after fixes