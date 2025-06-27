#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const readFile = promisify(fs.readFile);
const readdir = promisify(fs.readdir);

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Migration tracking table
const MIGRATION_TABLE = 'schema_migrations';

// Initialize migration tracking
async function initializeMigrationTable() {
  const { error } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS ${MIGRATION_TABLE} (
        version VARCHAR(255) PRIMARY KEY,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `
  });
  
  if (error) {
    console.error('Failed to create migration table:', error);
    process.exit(1);
  }
}

// Get list of executed migrations
async function getExecutedMigrations() {
  const { data, error } = await supabase
    .from(MIGRATION_TABLE)
    .select('version')
    .order('version', { ascending: true });
  
  if (error) {
    console.error('Failed to get executed migrations:', error);
    process.exit(1);
  }
  
  return data.map(m => m.version);
}

// Get all migration files
async function getMigrationFiles() {
  const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');
  const files = await readdir(migrationsDir);
  
  return files
    .filter(f => f.endsWith('.sql'))
    .sort();
}

// Execute a migration
async function executeMigration(filename, direction = 'up') {
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
      console.error(`No DOWN migration found in ${filename}`);
      process.exit(1);
    }
  }
  
  console.log(`Executing ${direction} migration: ${filename}`);
  
  // Execute in transaction
  const { error } = await supabase.rpc('exec_sql', { sql });
  
  if (error) {
    console.error(`Migration failed: ${filename}`, error);
    throw error;
  }
  
  // Update migration tracking
  if (direction === 'up') {
    await supabase
      .from(MIGRATION_TABLE)
      .insert({ version: filename });
  } else {
    await supabase
      .from(MIGRATION_TABLE)
      .delete()
      .eq('version', filename);
  }
  
  console.log(`✅ Migration ${direction} completed: ${filename}`);
}

// Main migration runner
async function main() {
  const command = process.argv[2];
  const specificFile = process.argv.find(arg => arg.startsWith('--file='))?.split('=')[1];
  
  if (!['up', 'down'].includes(command)) {
    console.error('Usage: node migrate.js [up|down] [--file=specific_migration.sql]');
    process.exit(1);
  }
  
  // Initialize migration tracking
  await initializeMigrationTable();
  
  // Get migration status
  const executed = await getExecutedMigrations();
  const allFiles = await getMigrationFiles();
  
  if (command === 'up') {
    // Run pending migrations
    const pending = specificFile 
      ? [specificFile].filter(f => !executed.includes(f))
      : allFiles.filter(f => !executed.includes(f));
    
    if (pending.length === 0) {
      console.log('No pending migrations');
      return;
    }
    
    console.log(`Found ${pending.length} pending migration(s)`);
    
    for (const file of pending) {
      try {
        await executeMigration(file, 'up');
      } catch (error) {
        console.error('Migration failed, stopping execution');
        process.exit(1);
      }
    }
  } else {
    // Rollback migrations
    const toRollback = specificFile 
      ? [specificFile].filter(f => executed.includes(f))
      : executed.slice().reverse().slice(0, 1); // Only rollback the last one by default
    
    if (toRollback.length === 0) {
      console.log('No migrations to rollback');
      return;
    }
    
    console.log(`Rolling back ${toRollback.length} migration(s)`);
    
    for (const file of toRollback) {
      try {
        await executeMigration(file, 'down');
      } catch (error) {
        console.error('Rollback failed, stopping execution');
        process.exit(1);
      }
    }
  }
  
  console.log('Migration completed successfully');
}

// Run migrations
main().catch(error => {
  console.error('Migration error:', error);
  process.exit(1);
});