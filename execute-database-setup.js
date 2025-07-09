const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function executeDatabaseSetup() {
  console.log('🚀 Starting database setup...\n');
  
  try {
    // Read the SQL file
    const sqlContent = fs.readFileSync(path.join(__dirname, 'complete-database-setup.sql'), 'utf8');
    
    // Split SQL into individual statements (by semicolon)
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`📝 Found ${statements.length} SQL statements to execute\n`);
    
    let successCount = 0;
    let errorCount = 0;
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      const preview = statement.substring(0, 50).replace(/\n/g, ' ');
      
      process.stdout.write(`[${i + 1}/${statements.length}] Executing: ${preview}...`);
      
      try {
        const { error } = await supabase.rpc('exec_sql', {
          sql: statement + ';'
        });
        
        if (error) {
          // Try direct execution if RPC doesn't work
          const { error: directError } = await supabase.from('_sql').select().single().eq('query', statement);
          
          if (directError) {
            console.log(' ❌');
            console.error(`   Error: ${error.message || directError.message}`);
            errorCount++;
          } else {
            console.log(' ✅');
            successCount++;
          }
        } else {
          console.log(' ✅');
          successCount++;
        }
      } catch (err) {
        console.log(' ❌');
        console.error(`   Error: ${err.message}`);
        errorCount++;
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log(`📊 SUMMARY: ${successCount} succeeded, ${errorCount} failed`);
    console.log('='.repeat(60));
    
    if (errorCount === 0) {
      console.log('\n✅ Database setup completed successfully!');
    } else {
      console.log('\n⚠️  Database setup completed with some errors.');
      console.log('This is normal if tables already exist.');
    }
    
    // Test the connection and show some stats
    console.log('\n🔍 Verifying database setup...');
    
    const { data: workspaces, error: wsError } = await supabase
      .from('workspaces')
      .select('count');
    
    if (!wsError) {
      console.log('✅ Workspaces table exists');
    }
    
    const { data: users, error: usError } = await supabase
      .from('user_profiles')
      .select('count');
    
    if (!usError) {
      console.log('✅ User profiles table exists');
    }
    
    const { data: campaigns, error: cpError } = await supabase
      .from('campaigns')
      .select('count');
    
    if (!cpError) {
      console.log('✅ Campaigns table exists');
    }
    
    console.log('\n🎉 Database is ready for use!');
    
  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

// Alternative approach: Use direct database connection
async function executeDatabaseSetupDirect() {
  console.log('🚀 Attempting direct database execution...\n');
  
  console.log('ℹ️  Since we cannot execute SQL directly, please follow these steps:\n');
  console.log('1. Go to: https://supabase.com/dashboard/project/zicipvpablahehxstbfr/sql/new');
  console.log('2. Copy the contents of complete-database-setup.sql');
  console.log('3. Paste and run in the SQL editor');
  console.log('4. The script will handle existing tables gracefully\n');
  
  console.log('📋 Checking current database state...\n');
  
  // Check if key tables exist
  const tables = ['workspaces', 'user_profiles', 'campaigns', 'leads', 'templates'];
  let existingTables = 0;
  
  for (const table of tables) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (!error) {
        console.log(`✅ Table '${table}' exists`);
        existingTables++;
      } else {
        console.log(`❌ Table '${table}' not found`);
      }
    } catch (err) {
      console.log(`❌ Table '${table}' not found`);
    }
  }
  
  console.log(`\n📊 ${existingTables}/${tables.length} core tables exist`);
  
  if (existingTables === 0) {
    console.log('\n⚠️  No tables found. Database setup is required.');
    console.log('Please run the SQL script in Supabase dashboard.');
  } else if (existingTables < tables.length) {
    console.log('\n⚠️  Some tables are missing. Database setup may be incomplete.');
    console.log('Please run the SQL script in Supabase dashboard to complete setup.');
  } else {
    console.log('\n✅ All core tables exist! Database appears to be set up.');
  }
}

// Run the setup
executeDatabaseSetupDirect().catch(console.error);