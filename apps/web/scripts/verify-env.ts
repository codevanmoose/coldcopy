#!/usr/bin/env tsx

/**
 * Environment Variable Verification Script
 * Run this to check if all required environment variables are set
 * Usage: npx tsx scripts/verify-env.ts
 */

interface EnvVariable {
  name: string
  required: boolean
  category: string
  description: string
  validator?: (value: string) => boolean
}

const envVariables: EnvVariable[] = [
  // Supabase
  {
    name: 'NEXT_PUBLIC_SUPABASE_URL',
    required: true,
    category: 'Supabase',
    description: 'Supabase project URL',
    validator: (value) => value.includes('supabase.co'),
  },
  {
    name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    required: true,
    category: 'Supabase',
    description: 'Supabase anonymous key',
    validator: (value) => value.length > 20,
  },
  {
    name: 'SUPABASE_SERVICE_ROLE_KEY',
    required: true,
    category: 'Supabase',
    description: 'Supabase service role key (secret)',
    validator: (value) => value.length > 20,
  },

  // Authentication
  {
    name: 'NEXTAUTH_SECRET',
    required: true,
    category: 'Authentication',
    description: 'NextAuth secret for JWT signing',
    validator: (value) => value.length >= 32,
  },
  {
    name: 'NEXTAUTH_URL',
    required: true,
    category: 'Authentication',
    description: 'NextAuth callback URL',
    validator: (value) => value.startsWith('http'),
  },
  {
    name: 'JWT_SECRET',
    required: true,
    category: 'Authentication',
    description: 'JWT signing secret',
    validator: (value) => value.length >= 32,
  },
  {
    name: 'ENCRYPTION_KEY',
    required: true,
    category: 'Authentication',
    description: 'Encryption key for sensitive data',
    validator: (value) => value.length === 64, // 32 bytes hex = 64 chars
  },

  // API Configuration
  {
    name: 'NEXT_PUBLIC_API_URL',
    required: true,
    category: 'API',
    description: 'Backend API URL',
    validator: (value) => value.startsWith('http'),
  },
  {
    name: 'NEXT_PUBLIC_APP_URL',
    required: true,
    category: 'API',
    description: 'Frontend application URL',
    validator: (value) => value.startsWith('http'),
  },

  // Email (AWS SES)
  {
    name: 'AWS_ACCESS_KEY_ID',
    required: true,
    category: 'Email',
    description: 'AWS access key for SES',
    validator: (value) => value.startsWith('AKIA'),
  },
  {
    name: 'AWS_SECRET_ACCESS_KEY',
    required: true,
    category: 'Email',
    description: 'AWS secret key for SES',
    validator: (value) => value.length > 20,
  },
  {
    name: 'AWS_REGION',
    required: true,
    category: 'Email',
    description: 'AWS region for SES',
    validator: (value) => /^[a-z]{2}-[a-z]+-\d$/.test(value),
  },
  {
    name: 'SES_CONFIGURATION_SET',
    required: true,
    category: 'Email',
    description: 'SES configuration set name',
  },
  {
    name: 'SES_FROM_EMAIL',
    required: true,
    category: 'Email',
    description: 'Default from email address',
    validator: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
  },

  // AI Services
  {
    name: 'OPENAI_API_KEY',
    required: true,
    category: 'AI',
    description: 'OpenAI API key',
    validator: (value) => value.startsWith('sk-'),
  },
  {
    name: 'ANTHROPIC_API_KEY',
    required: true,
    category: 'AI',
    description: 'Anthropic API key',
    validator: (value) => value.startsWith('sk-ant-'),
  },

  // Stripe
  {
    name: 'STRIPE_SECRET_KEY',
    required: true,
    category: 'Billing',
    description: 'Stripe secret key',
    validator: (value) => value.startsWith('sk_'),
  },
  {
    name: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
    required: true,
    category: 'Billing',
    description: 'Stripe publishable key',
    validator: (value) => value.startsWith('pk_'),
  },
  {
    name: 'STRIPE_WEBHOOK_SECRET',
    required: true,
    category: 'Billing',
    description: 'Stripe webhook signing secret',
    validator: (value) => value.startsWith('whsec_'),
  },

  // Lead Enrichment
  {
    name: 'HUNTER_API_KEY',
    required: false,
    category: 'Enrichment',
    description: 'Hunter.io API key',
  },
  {
    name: 'CLEARBIT_API_KEY',
    required: false,
    category: 'Enrichment',
    description: 'Clearbit API key',
  },
  {
    name: 'APOLLO_API_KEY',
    required: false,
    category: 'Enrichment',
    description: 'Apollo.io API key',
  },

  // Social Media
  {
    name: 'LINKEDIN_CLIENT_ID',
    required: false,
    category: 'Social',
    description: 'LinkedIn OAuth client ID',
  },
  {
    name: 'LINKEDIN_CLIENT_SECRET',
    required: false,
    category: 'Social',
    description: 'LinkedIn OAuth client secret',
  },
  {
    name: 'TWITTER_API_KEY',
    required: false,
    category: 'Social',
    description: 'Twitter API key',
  },
  {
    name: 'TWITTER_API_SECRET',
    required: false,
    category: 'Social',
    description: 'Twitter API secret',
  },

  // Redis
  {
    name: 'REDIS_URL',
    required: false,
    category: 'Cache',
    description: 'Redis connection URL',
    validator: (value) => value.startsWith('redis://'),
  },

  // Digital Ocean Spaces
  {
    name: 'DO_SPACES_KEY',
    required: false,
    category: 'Storage',
    description: 'Digital Ocean Spaces access key',
  },
  {
    name: 'DO_SPACES_SECRET',
    required: false,
    category: 'Storage',
    description: 'Digital Ocean Spaces secret key',
  },

  // Monitoring
  {
    name: 'SENTRY_DSN',
    required: false,
    category: 'Monitoring',
    description: 'Sentry error tracking DSN',
    validator: (value) => value.includes('sentry.io'),
  },
  {
    name: 'NEXT_PUBLIC_POSTHOG_KEY',
    required: false,
    category: 'Analytics',
    description: 'PostHog project API key',
  },

  // Cron Jobs
  {
    name: 'CRON_SECRET',
    required: true,
    category: 'System',
    description: 'Secret for authenticating cron jobs',
    validator: (value) => value.length >= 32,
  },

  // Feature Flags
  {
    name: 'ENABLE_LINKEDIN_INTEGRATION',
    required: false,
    category: 'Features',
    description: 'Enable LinkedIn integration',
    validator: (value) => ['true', 'false'].includes(value),
  },
  {
    name: 'ENABLE_TWITTER_INTEGRATION',
    required: false,
    category: 'Features',
    description: 'Enable Twitter integration',
    validator: (value) => ['true', 'false'].includes(value),
  },
]

function checkEnvironmentVariables() {
  console.log('🔍 ColdCopy Environment Variable Verification\n')

  const results = {
    total: envVariables.length,
    required: envVariables.filter(v => v.required).length,
    optional: envVariables.filter(v => !v.required).length,
    set: 0,
    missing: 0,
    invalid: 0,
  }

  const missingRequired: string[] = []
  const missingOptional: string[] = []
  const invalidVars: string[] = []

  // Group by category
  const categories = [...new Set(envVariables.map(v => v.category))]

  categories.forEach(category => {
    console.log(`\n📁 ${category}:`)
    
    const categoryVars = envVariables.filter(v => v.category === category)
    
    categoryVars.forEach(envVar => {
      const value = process.env[envVar.name]
      const isSet = value !== undefined && value !== ''
      
      let status = ''
      let message = ''
      
      if (!isSet) {
        if (envVar.required) {
          status = '❌'
          message = 'MISSING (Required)'
          missingRequired.push(envVar.name)
          results.missing++
        } else {
          status = '⚠️'
          message = 'Not set (Optional)'
          missingOptional.push(envVar.name)
        }
      } else {
        results.set++
        
        if (envVar.validator) {
          const isValid = envVar.validator(value)
          if (!isValid) {
            status = '⚠️'
            message = 'Set but may be invalid'
            invalidVars.push(envVar.name)
            results.invalid++
          } else {
            status = '✅'
            message = 'Set and valid'
          }
        } else {
          status = '✅'
          message = 'Set'
        }
      }
      
      console.log(`  ${status} ${envVar.name}: ${message}`)
      if (envVar.description) {
        console.log(`     → ${envVar.description}`)
      }
    })
  })

  // Summary
  console.log('\n' + '='.repeat(60))
  console.log('📊 Summary:')
  console.log(`  Total variables: ${results.total}`)
  console.log(`  Required: ${results.required}`)
  console.log(`  Optional: ${results.optional}`)
  console.log(`  ✅ Set: ${results.set}`)
  console.log(`  ❌ Missing: ${results.missing}`)
  console.log(`  ⚠️  Invalid: ${results.invalid}`)

  if (missingRequired.length > 0) {
    console.log('\n❌ Missing Required Variables:')
    missingRequired.forEach(name => {
      const envVar = envVariables.find(v => v.name === name)!
      console.log(`  - ${name} (${envVar.description})`)
    })
  }

  if (invalidVars.length > 0) {
    console.log('\n⚠️  Potentially Invalid Variables:')
    invalidVars.forEach(name => {
      const envVar = envVariables.find(v => v.name === name)!
      console.log(`  - ${name} (${envVar.description})`)
    })
  }

  if (missingOptional.length > 0) {
    console.log('\n💡 Optional Variables Not Set:')
    missingOptional.forEach(name => {
      const envVar = envVariables.find(v => v.name === name)!
      console.log(`  - ${name} (${envVar.description})`)
    })
  }

  // Exit code
  if (missingRequired.length > 0) {
    console.log('\n❌ Missing required environment variables. Please set them before deployment.')
    process.exit(1)
  } else if (invalidVars.length > 0) {
    console.log('\n⚠️  Some variables may be invalid. Please verify them.')
    process.exit(0)
  } else {
    console.log('\n✅ All required environment variables are set!')
    process.exit(0)
  }
}

// Run the check
checkEnvironmentVariables()