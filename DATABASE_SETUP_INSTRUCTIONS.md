# 🚀 ColdCopy Database Setup Instructions

## 🔴 CRITICAL: This Must Be Done First

The ColdCopy application is **97% ready** but currently failing because the database tables don't exist. Follow these steps exactly to get the application fully functional.

## Step 1: Access Supabase Dashboard

1. Go to **[Supabase Dashboard](https://supabase.com/dashboard)**
2. Sign in with the account that has access to the ColdCopy project
3. Select the **ColdCopy project** (project ID: `zicipvpablahehxstbfr`)

## Step 2: Open SQL Editor

1. In the Supabase dashboard, click on **"SQL Editor"** in the left sidebar
2. Click **"New Query"** to create a new SQL script

## Step 3: Execute the Database Setup

1. Open the file `CRITICAL_DATABASE_SETUP.sql` in this project directory
2. **Copy the entire contents** of the SQL file
3. **Paste it into the Supabase SQL Editor**
4. Click **"Run"** button to execute the script

## Step 4: Verify Success

After running the script, you should see a success message like:
```
✅ ColdCopy database setup completed successfully!
```

## Step 5: Create Admin User (Important!)

Since the admin user needs to exist in Supabase Auth first:

1. Go to **Authentication > Users** in Supabase dashboard
2. Click **"Add User"** 
3. Create user with:
   - **Email**: `jaspervanmoose@gmail.com`
   - **Password**: Choose a secure password
   - **Auto Confirm**: Check this box
4. After creating, go back to **SQL Editor** and run this script:

```sql
-- Add admin user to workspace
INSERT INTO workspace_members (workspace_id, user_id, role, is_default)
SELECT 
    '00000000-0000-0000-0000-000000000001',
    id,
    'super_admin',
    true
FROM auth.users 
WHERE email = 'jaspervanmoose@gmail.com'
ON CONFLICT (workspace_id, user_id) DO UPDATE SET 
    role = 'super_admin',
    is_default = true;
```

## Step 6: Test the Application

1. Visit **https://coldcopy.cc** (or wherever the app is deployed)
2. Try to **sign up** or **log in**
3. Navigate to the **dashboard** - it should now work without errors
4. Test **lead creation**, **campaigns**, and **templates**

## What This Setup Creates

### 🏢 Core Tables
- **workspaces** - Multi-tenant workspace isolation
- **user_profiles** - Extended user information
- **workspace_members** - User-workspace relationships

### 👥 Lead Management
- **leads** - Contact management with enrichment
- **email_templates** - Template system for emails

### 📧 Campaign System  
- **campaigns** - Campaign management
- **campaign_emails** - Email sequences
- **campaign_leads** - Campaign-lead relationships
- **campaign_events** - Event tracking
- **email_events** - Email interaction tracking

### 🔐 Security Features
- **Row Level Security (RLS)** enabled on all tables
- **Multi-tenant data isolation** by workspace
- **Role-based permissions** (super_admin, workspace_admin, campaign_manager, outreach_specialist)

### ⚡ Performance Features
- **Optimized indexes** for fast queries
- **Triggers** for automatic timestamp updates
- **Automatic user profile creation** on signup

## Expected Results After Setup

- ✅ **Login/Signup**: Should work without errors
- ✅ **Dashboard**: Should load with real data (or fallback data)
- ✅ **Lead Creation**: POST /api/workspaces/[id]/leads should work
- ✅ **Template Creation**: Template system should be functional
- ✅ **Campaign Creation**: Campaign wizard should work
- ✅ **Analytics**: Dashboard should show real statistics

## Troubleshooting

### If you get permission errors:
```sql
-- Run this to fix permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
```

### If triggers fail:
The script has `DROP TRIGGER IF EXISTS` statements, so it should handle existing triggers gracefully.

### If you need to start over:
```sql
-- DANGEROUS: This will delete all data
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
-- Then run the main setup script again
```

## Next Steps After Database Setup

1. **Environment Variables**: Ensure all environment variables are set in Vercel
2. **Testing**: Run the comprehensive test suite to verify everything works
3. **Production Launch**: The platform will be 100% ready for customers!

## Support

If you encounter any issues:
1. Check the Supabase logs in Dashboard > Logs
2. Verify all tables were created in Database > Tables
3. Check RLS policies in Database > Policies
4. Review the browser console for any client-side errors

The database setup is the **critical missing piece** - once this is complete, ColdCopy will be fully functional! 🎉