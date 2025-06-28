#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');

// Configuration
const SUPABASE_PROJECT_REF = 'zicipvpablahehxstbfr';
const MIGRATIONS_DIR = path.join(__dirname, 'supabase', 'migrations');

console.log('🚀 Direct Database Migration Script');
console.log('===================================');
console.log('');
console.log('⚠️  IMPORTANT: This script requires a Supabase access token.');
console.log('');
console.log('To get your access token:');
console.log('1. Go to https://app.supabase.com/account/tokens');
console.log('2. Click "Generate new token"');
console.log('3. Give it a name like "ColdCopy Migrations"');
console.log('4. Copy the token');
console.log('');
console.log('Then run this script with:');
console.log('SUPABASE_ACCESS_TOKEN=your-token-here node push-migrations-direct.js');
console.log('');

if (!process.env.SUPABASE_ACCESS_TOKEN) {
  console.error('❌ SUPABASE_ACCESS_TOKEN environment variable is required');
  process.exit(1);
}

// Alternative: Since we can't use Supabase CLI without interactive auth,
// let's create a SQL script that combines all migrations
console.log('📝 Creating combined migration script...');

const migrations = fs.readdirSync(MIGRATIONS_DIR)
  .filter(file => file.endsWith('.sql'))
  .sort();

let combinedSQL = `-- Combined migrations for ColdCopy
-- Generated on ${new Date().toISOString()}
-- Total migrations: ${migrations.length}

`;

migrations.forEach(file => {
  const content = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
  combinedSQL += `
-- ========================================
-- Migration: ${file}
-- ========================================

${content}

`;
});

// Write combined SQL
const outputPath = path.join(__dirname, 'supabase', 'combined-migrations.sql');
fs.writeFileSync(outputPath, combinedSQL);

console.log(`✅ Created combined migration file at: ${outputPath}`);
console.log('');
console.log('📋 Next steps:');
console.log('1. Go to your Supabase dashboard: https://app.supabase.com/project/' + SUPABASE_PROJECT_REF);
console.log('2. Navigate to SQL Editor');
console.log('3. Create a new query');
console.log('4. Paste the contents of combined-migrations.sql');
console.log('5. Run the query');
console.log('');
console.log('Or use the Supabase CLI after logging in:');
console.log('npx supabase login');
console.log('npx supabase link --project-ref ' + SUPABASE_PROJECT_REF);
console.log('npx supabase db push');