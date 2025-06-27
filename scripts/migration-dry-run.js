#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const readFile = promisify(fs.readFile);
const readdir = promisify(fs.readdir);

// Parse command line arguments
const args = process.argv.slice(2);
const type = args.find(arg => arg.startsWith('--type='))?.split('=')[1] || 'up';
const specificMigration = args.find(arg => arg.startsWith('--migration='))?.split('=')[1];

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const MIGRATION_TABLE = 'schema_migrations';

async function getExecutedMigrations() {
  const { data, error } = await supabase
    .from(MIGRATION_TABLE)
    .select('version')
    .order('version', { ascending: true });
  
  if (error && error.code !== 'PGRST116') {
    console.error('Failed to get executed migrations:', error);
    process.exit(1);
  }
  
  return (data || []).map(m => m.version);
}

async function getMigrationFiles() {
  const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');
  const files = await readdir(migrationsDir);
  
  return files
    .filter(f => f.endsWith('.sql'))
    .sort();
}

async function previewMigration(filename, direction) {
  const filepath = path.join(__dirname, '..', 'supabase', 'migrations', filename);
  const content = await readFile(filepath, 'utf8');
  
  // Parse UP and DOWN sections
  const upMatch = content.match(/-- UP\n([\s\S]*?)(?=-- DOWN|$)/);
  const downMatch = content.match(/-- DOWN\n([\s\S]*?)$/);
  
  let sql;
  if (direction === 'up') {
    sql = upMatch ? upMatch[1].trim() : content;
  } else {
    sql = downMatch ? downMatch[1].trim() : null;
    if (!sql) {
      console.log(`⚠️  No DOWN migration found in ${filename}`);
      return;
    }
  }
  
  console.log(`\n### ${filename}`);
  console.log('```sql');
  console.log(sql);
  console.log('```');
}

async function main() {
  console.log(`## Migration Dry Run (${type.toUpperCase()})\n`);
  
  const executed = await getExecutedMigrations();
  const allFiles = await getMigrationFiles();
  
  let filesToPreview = [];
  
  if (type === 'up') {
    // Show pending migrations
    filesToPreview = specificMigration 
      ? [specificMigration].filter(f => !executed.includes(f))
      : allFiles.filter(f => !executed.includes(f));
    
    if (filesToPreview.length === 0) {
      console.log('No pending migrations to preview');
      return;
    }
    
    console.log(`Will execute ${filesToPreview.length} migration(s):\n`);
  } else {
    // Show migrations to rollback
    filesToPreview = specificMigration 
      ? [specificMigration].filter(f => executed.includes(f))
      : executed.slice().reverse().slice(0, 1);
    
    if (filesToPreview.length === 0) {
      console.log('No migrations to rollback');
      return;
    }
    
    console.log(`Will rollback ${filesToPreview.length} migration(s):\n`);
  }
  
  // Show migration list
  filesToPreview.forEach((file, index) => {
    console.log(`${index + 1}. ${file}`);
  });
  
  console.log('\n## SQL Preview');
  
  // Preview each migration
  for (const file of filesToPreview) {
    await previewMigration(file, type);
  }
  
  console.log('\n## Summary');
  console.log(`- Direction: ${type.toUpperCase()}`);
  console.log(`- Migrations: ${filesToPreview.length}`);
  console.log('- This is a dry run - no changes will be made');
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});