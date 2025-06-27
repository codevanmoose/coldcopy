#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const readdir = promisify(fs.readdir);

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const MIGRATION_TABLE = 'schema_migrations';

async function getMigrationStatus() {
  // Get executed migrations
  const { data: executed, error } = await supabase
    .from(MIGRATION_TABLE)
    .select('version, executed_at')
    .order('version', { ascending: true });
  
  if (error && error.code !== 'PGRST116') { // Table doesn't exist
    console.error('Failed to get migration status:', error);
    process.exit(1);
  }
  
  const executedMap = new Map((executed || []).map(m => [m.version, m.executed_at]));
  
  // Get all migration files
  const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');
  const files = await readdir(migrationsDir);
  const allFiles = files.filter(f => f.endsWith('.sql')).sort();
  
  // Display status
  console.log('## Migration Status\n');
  console.log('| Migration File | Status | Executed At |');
  console.log('|----------------|--------|-------------|');
  
  let pendingCount = 0;
  
  for (const file of allFiles) {
    const executedAt = executedMap.get(file);
    if (executedAt) {
      const date = new Date(executedAt).toLocaleString();
      console.log(`| ${file} | ✅ Executed | ${date} |`);
    } else {
      console.log(`| ${file} | ⏳ Pending | - |`);
      pendingCount++;
    }
  }
  
  console.log(`\n### Summary`);
  console.log(`- Total migrations: ${allFiles.length}`);
  console.log(`- Executed: ${allFiles.length - pendingCount}`);
  console.log(`- Pending: ${pendingCount}`);
  
  // Check for orphaned migrations (in DB but not in files)
  const orphaned = Array.from(executedMap.keys()).filter(v => !allFiles.includes(v));
  if (orphaned.length > 0) {
    console.log(`\n⚠️  Warning: Found ${orphaned.length} orphaned migration(s) in database:`);
    orphaned.forEach(o => console.log(`  - ${o}`));
  }
}

getMigrationStatus().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});