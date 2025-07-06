# ColdCopy Admin Setup Guide

## 🔐 Security Notice
The admin setup script has been updated to use environment variables instead of hardcoded credentials. This is a critical security improvement.

## Setting Up Admin User

### Method 1: Using Environment Variables (Recommended)
```bash
ADMIN_EMAIL=admin@coldcopy.cc \
ADMIN_PASSWORD=YourSecurePassword123! \
ADMIN_NAME="Your Name" \
node setup-admin.js
```

### Method 2: Using .env file
Create a `.env` file in the project root:
```env
ADMIN_EMAIL=admin@coldcopy.cc
ADMIN_PASSWORD=YourSecurePassword123!
ADMIN_NAME=Your Name
```

Then run:
```bash
node setup-admin.js
```

## Password Requirements
- Minimum 8 characters
- Include uppercase and lowercase letters
- Include numbers
- Include special characters
- Avoid common patterns or dictionary words

## Example Secure Passwords
- `ColdCopy#2025$Admin`
- `Secure*Platform&96`
- `Admin@ColdCopy!2025`

## Important Security Steps

1. **Never commit credentials to Git**
   - The old hardcoded credentials have been removed
   - Always use environment variables

2. **Change default admin immediately**
   - If you used the old hardcoded credentials, change them NOW
   - Old credentials: jaspervanmoose@gmail.com / okkenbollen33

3. **Rotate credentials regularly**
   - Change admin password every 90 days
   - Use a password manager

4. **Enable 2FA when available**
   - Future feature for enhanced security

## Verifying Admin Setup

After running the setup script:

1. Login at https://coldcopy.cc with your admin credentials
2. Check that you have super_admin role in the dashboard
3. Access admin panel at https://coldcopy.cc/admin (when available)

## Troubleshooting

If you encounter issues:

1. **User already exists error**
   - The email is already registered
   - Use a different email or delete the existing user first

2. **Authentication error**
   - Check your Supabase service role key
   - Ensure environment variables are loaded

3. **Role update error**
   - The user might not have a workspace
   - Check the workspace_members table

## Production Checklist

- [ ] Changed admin credentials from defaults
- [ ] Used strong, unique password
- [ ] Stored credentials securely (password manager)
- [ ] Tested admin login
- [ ] Documented admin email for team
- [ ] Set up admin email forwarding if needed

---

*Security is critical. Never use default or weak credentials in production.*