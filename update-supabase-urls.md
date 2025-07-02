# Update Supabase Auth URLs

## Manual Steps Required

The Supabase Site URL must be updated through the web dashboard:

1. Go to: https://supabase.com/dashboard/project/zicipvpablahehxstbfr/auth/url-configuration

2. Update these settings:
   - **Site URL**: `https://www.coldcopy.cc`
   - **Redirect URLs**: 
     - `https://www.coldcopy.cc/**`
     - `https://coldcopy.cc/**`
     - `http://localhost:3000/**` (for development)

3. Save the changes

## Why This Is Needed

When users sign up, Supabase sends verification emails. The links in these emails use the Site URL configuration. If it's set to localhost, users will get broken links.

## Testing

After updating, test by:
1. Going to https://www.coldcopy.cc/signup
2. Creating a new account
3. Checking that the verification email has the correct production URL

## Note

This is a one-time configuration that persists. You only need to do this once per Supabase project.