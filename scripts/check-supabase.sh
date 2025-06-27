#!/bin/bash
# Check if Supabase database is ready and run migrations

echo "🔍 Checking Supabase database status..."

cd /Users/jasper/Documents/Poetsen/Van\ Moose\ Projects/ColdCopy

export SUPABASE_ACCESS_TOKEN=sbp_b37b7baeceee3f4c4aa02f74aaabc3a0bbb7753f

# Try to connect
echo "ColdCopy2024!Secure#DB" | supabase db push 2>&1

if [ $? -eq 0 ]; then
    echo "✅ Database is ready and migrations are complete!"
    echo "🎉 Your database schema has been created successfully!"
else
    echo "⏳ Database is still initializing. Try again in 1-2 minutes."
    echo "Run this command to check again:"
    echo "./scripts/check-supabase.sh"
fi