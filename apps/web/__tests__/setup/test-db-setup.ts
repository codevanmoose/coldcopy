#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

// Test database configuration
const TEST_DB_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:54322/postgres'
const TEST_SUPABASE_URL = process.env.TEST_SUPABASE_URL || 'http://localhost:54322'
const TEST_SUPABASE_ANON_KEY = process.env.TEST_SUPABASE_ANON_KEY || 'test-anon-key'
const TEST_SUPABASE_SERVICE_KEY = process.env.TEST_SUPABASE_SERVICE_KEY || 'test-service-key'

// Create test environment file
function createTestEnvFile() {
  const envContent = `
# Test Environment Variables
DATABASE_URL=${TEST_DB_URL}
NEXT_PUBLIC_SUPABASE_URL=${TEST_SUPABASE_URL}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${TEST_SUPABASE_ANON_KEY}
SUPABASE_SERVICE_ROLE_KEY=${TEST_SUPABASE_SERVICE_KEY}

# Test Stripe Keys
STRIPE_SECRET_KEY=sk_test_fake_key
STRIPE_WEBHOOK_SECRET=whsec_test_fake_secret
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_fake_key

# Test AWS Keys
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=test-access-key
AWS_SECRET_ACCESS_KEY=test-secret-key
SES_FROM_EMAIL=test@example.com

# Test AI Keys
OPENAI_API_KEY=test-openai-key
ANTHROPIC_API_KEY=test-anthropic-key

# Other Test Settings
NODE_ENV=test
NEXT_PUBLIC_APP_URL=http://localhost:3000
`

  fs.writeFileSync('.env.test', envContent.trim())
  console.log('✅ Created .env.test file')
}

// Setup test database schema
async function setupTestDatabase() {
  console.log('🔧 Setting up test database...')

  const supabase = createClient(TEST_SUPABASE_URL, TEST_SUPABASE_SERVICE_KEY)

  try {
    // Run migrations
    const migrationsDir = path.join(__dirname, '../../src/lib/supabase/migrations')
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort()

    for (const file of migrationFiles) {
      console.log(`Running migration: ${file}`)
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8')
      
      const { error } = await supabase.rpc('exec_sql', { sql_query: sql })
      if (error) {
        console.error(`Error running migration ${file}:`, error)
        throw error
      }
    }

    console.log('✅ Database migrations completed')

    // Create test data
    await createTestData(supabase)
    
    console.log('✅ Test database setup completed')
  } catch (error) {
    console.error('❌ Error setting up test database:', error)
    throw error
  }
}

// Create initial test data
async function createTestData(supabase: any) {
  console.log('📝 Creating test data...')

  // Create test workspace plans
  const plans = [
    {
      name: 'Free',
      stripe_price_id: 'price_free',
      price_monthly: 0,
      price_yearly: 0,
      features: {
        emails_per_month: 100,
        team_members: 1,
        enrichments_per_month: 10,
        custom_domains: false,
        api_access: false,
      },
    },
    {
      name: 'Starter',
      stripe_price_id: 'price_starter_monthly',
      price_monthly: 49,
      price_yearly: 490,
      features: {
        emails_per_month: 1000,
        team_members: 3,
        enrichments_per_month: 100,
        custom_domains: false,
        api_access: true,
      },
    },
    {
      name: 'Pro',
      stripe_price_id: 'price_pro_monthly',
      price_monthly: 149,
      price_yearly: 1490,
      features: {
        emails_per_month: 10000,
        team_members: 10,
        enrichments_per_month: 1000,
        custom_domains: true,
        api_access: true,
      },
    },
  ]

  for (const plan of plans) {
    const { error } = await supabase
      .from('billing_plans')
      .upsert(plan, { onConflict: 'name' })
    
    if (error) {
      console.error('Error creating plan:', error)
    }
  }

  // Create email templates
  const templates = [
    {
      name: 'Welcome Email',
      category: 'onboarding',
      subject: 'Welcome to {{company_name}}!',
      body: 'Hi {{first_name}},\n\nWelcome to our platform!',
      variables: ['first_name', 'company_name'],
    },
    {
      name: 'Follow Up',
      category: 'sales',
      subject: 'Following up on our conversation',
      body: 'Hi {{first_name}},\n\nI wanted to follow up on our previous conversation.',
      variables: ['first_name'],
    },
  ]

  for (const template of templates) {
    const { error } = await supabase
      .from('email_templates')
      .upsert(template, { onConflict: 'name' })
    
    if (error) {
      console.error('Error creating template:', error)
    }
  }

  console.log('✅ Test data created')
}

// Clean test database
export async function cleanTestDatabase() {
  console.log('🧹 Cleaning test database...')

  const supabase = createClient(TEST_SUPABASE_URL, TEST_SUPABASE_SERVICE_KEY)

  const tables = [
    'email_tracking_events',
    'email_logs',
    'campaign_leads',
    'campaign_sequences',
    'campaigns',
    'lead_enrichment',
    'leads',
    'workspace_invitations',
    'workspace_members',
    'workspaces',
    'billing_usage',
    'billing_subscriptions',
  ]

  for (const table of tables) {
    try {
      const { error } = await supabase
        .from(table)
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000')
      
      if (error) {
        console.error(`Error cleaning ${table}:`, error)
      }
    } catch (error) {
      console.error(`Error cleaning ${table}:`, error)
    }
  }

  console.log('✅ Test database cleaned')
}

// Reset test database
export async function resetTestDatabase() {
  await cleanTestDatabase()
  await setupTestDatabase()
}

// Run setup if called directly
if (require.main === module) {
  createTestEnvFile()
  setupTestDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1))
}