#!/bin/bash

# Database Setup Script for ColdCopy
# Run this after logging in to Supabase CLI

echo "🚀 Setting up ColdCopy database..."

# Navigate to project root
cd "$(dirname "$0")"

# Step 1: Link Supabase project
echo "📎 Linking Supabase project..."
npx supabase link --project-ref zicipvpablahehxstbfr

# Step 2: Push database migrations
echo "📊 Pushing database migrations..."
npx supabase db push

# Step 3: Verify the setup
echo "✅ Database setup complete!"
echo ""
echo "Next steps:"
echo "1. Visit https://coldcopy-moose.vercel.app"
echo "2. Test login/signup functionality"
echo "3. Check Supabase dashboard for database tables"

# Optional: Run quick setup if available
if [ -f "supabase/quick-setup.sql" ]; then
    echo ""
    echo "📝 Found quick-setup.sql. You can run it manually in Supabase SQL editor if needed."
fi