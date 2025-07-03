# ColdCopy Manual Testing Checklist

## Test Account Credentials
- **Email**: jaspervanmoose@gmail.com
- **Password**: okkenbollen33
- **Expected Role**: Admin/Super Admin

## 1. Landing Page Testing (https://coldcopy.cc)
- [ ] Page loads without errors
- [ ] All images load properly
- [ ] Navigation menu works
- [ ] CTA buttons are clickable
- [ ] Footer links work
- [ ] Mobile responsive (resize browser)

## 2. Authentication Testing

### Login Flow (https://coldcopy.cc/login)
- [ ] Login page loads
- [ ] Can enter email and password
- [ ] Login with test credentials works
- [ ] Error messages display for wrong credentials
- [ ] "Forgot password" link works
- [ ] "Sign up" link works
- [ ] Remember me checkbox works

### Signup Flow (https://coldcopy.cc/signup or /register)
- [ ] Signup page loads
- [ ] Form validation works (email format, password strength)
- [ ] Can create a new account
- [ ] Email verification sent
- [ ] Redirect after signup works
- [ ] Terms and privacy links work

## 3. Dashboard Testing (After Login)
- [ ] Dashboard loads successfully
- [ ] User name/email displayed correctly
- [ ] Workspace selector visible
- [ ] Navigation sidebar works
- [ ] Dashboard metrics load
- [ ] Quick actions work
- [ ] Logout functionality works

## 4. Core Features Testing

### Campaigns
- [ ] Can navigate to Campaigns section
- [ ] Campaign list loads
- [ ] "Create Campaign" button works
- [ ] Campaign creation wizard loads
- [ ] Can fill in campaign details
- [ ] AI email generation works
- [ ] Can save draft campaign
- [ ] Can launch campaign

### Leads
- [ ] Can navigate to Leads section
- [ ] Lead list loads
- [ ] "Add Lead" button works
- [ ] Can add single lead manually
- [ ] CSV import option visible
- [ ] Lead search/filter works
- [ ] Lead details page loads
- [ ] Can edit lead information

### Templates
- [ ] Can navigate to Templates section
- [ ] Template list loads
- [ ] Can view template details
- [ ] Can create new template
- [ ] Template editor works
- [ ] Variables/merge tags work
- [ ] Can save template

### Inbox
- [ ] Can navigate to Inbox section
- [ ] Message list loads
- [ ] Can view message threads
- [ ] Reply functionality works
- [ ] Mark as read/unread works
- [ ] Search messages works

## 5. AI Features Testing
- [ ] Email generation with GPT-4
- [ ] Email generation with Claude
- [ ] Personalization works
- [ ] Tone adjustment works
- [ ] Template suggestions work

## 6. Settings Testing
- [ ] Can access Settings
- [ ] Profile settings load
- [ ] Can update profile information
- [ ] Workspace settings accessible
- [ ] Team members section works
- [ ] Billing section loads
- [ ] API keys section visible

## 7. Admin Features (If Super Admin)
- [ ] Admin panel link visible
- [ ] Admin dashboard loads
- [ ] Can view all workspaces
- [ ] User management works
- [ ] System metrics visible
- [ ] Can impersonate users

## 8. Performance Testing
- [ ] Pages load within 3 seconds
- [ ] No JavaScript errors in console
- [ ] Search results appear quickly
- [ ] Form submissions responsive
- [ ] Real-time updates work

## 9. Error Handling
- [ ] 404 page works
- [ ] Error messages are user-friendly
- [ ] Form validation clear
- [ ] Network errors handled gracefully
- [ ] Session timeout handled properly

## 10. Mobile Testing (Resize Browser)
- [ ] Navigation menu becomes hamburger
- [ ] Tables become scrollable
- [ ] Forms remain usable
- [ ] Buttons are tappable size
- [ ] Text remains readable

## Common Issues to Look For:
1. **Database Errors**: "relation does not exist" errors
2. **Auth Issues**: Login loops, session drops
3. **UI Bugs**: Broken layouts, missing images
4. **Form Issues**: Validation not working, can't submit
5. **API Errors**: 500 errors, timeouts
6. **Missing Features**: Buttons that don't work

## How to Report Issues:
1. Take a screenshot
2. Note the URL
3. Copy any error messages from browser console (F12)
4. Describe steps to reproduce
5. Add to TESTING_REPORT.md

---

## Browser Console Commands (F12):
```javascript
// Check for errors
console.error

// Check network requests
Network tab → Failed requests (red)

// Check localStorage
localStorage.getItem('supabase.auth.token')

// Check current user
JSON.parse(localStorage.getItem('supabase.auth.token'))?.user
```