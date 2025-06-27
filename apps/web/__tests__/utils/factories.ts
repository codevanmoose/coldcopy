import { faker } from '@faker-js/faker'

// Factory functions for generating test data

export const userFactory = {
  create: (overrides = {}) => ({
    id: faker.string.uuid(),
    email: faker.internet.email(),
    full_name: faker.person.fullName(),
    avatar_url: faker.image.avatar(),
    created_at: faker.date.past().toISOString(),
    updated_at: faker.date.recent().toISOString(),
    ...overrides,
  }),

  createMany: (count: number, overrides = {}) => 
    Array.from({ length: count }, () => userFactory.create(overrides)),
}

export const workspaceFactory = {
  create: (overrides = {}) => ({
    id: faker.string.uuid(),
    name: faker.company.name(),
    owner_id: faker.string.uuid(),
    settings: {
      timezone: faker.location.timeZone(),
      daily_send_limit: faker.number.int({ min: 50, max: 500 }),
      warm_up_enabled: faker.datatype.boolean(),
      tracking_domain: faker.internet.domainName(),
      ...overrides.settings,
    },
    plan: faker.helpers.arrayElement(['free', 'starter', 'pro', 'enterprise']),
    created_at: faker.date.past().toISOString(),
    updated_at: faker.date.recent().toISOString(),
    ...overrides,
  }),

  createMany: (count: number, overrides = {}) => 
    Array.from({ length: count }, () => workspaceFactory.create(overrides)),
}

export const campaignFactory = {
  create: (overrides = {}) => ({
    id: faker.string.uuid(),
    name: faker.commerce.productName() + ' Campaign',
    workspace_id: faker.string.uuid(),
    user_id: faker.string.uuid(),
    status: faker.helpers.arrayElement(['draft', 'active', 'paused', 'completed']),
    subject: faker.lorem.sentence(),
    body: faker.lorem.paragraphs(3),
    from_name: faker.person.fullName(),
    from_email: faker.internet.email(),
    reply_to: faker.internet.email(),
    settings: {
      daily_limit: faker.number.int({ min: 10, max: 100 }),
      timezone: faker.location.timeZone(),
      tracking: {
        open_tracking: faker.datatype.boolean(),
        click_tracking: faker.datatype.boolean(),
        reply_tracking: faker.datatype.boolean(),
      },
      schedule: {
        start_date: faker.date.future().toISOString(),
        end_date: faker.date.future().toISOString(),
        send_days: faker.helpers.arrayElements(['mon', 'tue', 'wed', 'thu', 'fri'], 3),
        send_time_start: '09:00',
        send_time_end: '17:00',
      },
      ...overrides.settings,
    },
    stats: {
      total_sent: faker.number.int({ min: 0, max: 1000 }),
      total_opened: faker.number.int({ min: 0, max: 500 }),
      total_clicked: faker.number.int({ min: 0, max: 200 }),
      total_replied: faker.number.int({ min: 0, max: 50 }),
      total_bounced: faker.number.int({ min: 0, max: 20 }),
      total_unsubscribed: faker.number.int({ min: 0, max: 10 }),
    },
    created_at: faker.date.past().toISOString(),
    updated_at: faker.date.recent().toISOString(),
    ...overrides,
  }),

  createMany: (count: number, overrides = {}) => 
    Array.from({ length: count }, () => campaignFactory.create(overrides)),
}

export const leadFactory = {
  create: (overrides = {}) => ({
    id: faker.string.uuid(),
    workspace_id: faker.string.uuid(),
    email: faker.internet.email(),
    first_name: faker.person.firstName(),
    last_name: faker.person.lastName(),
    full_name: faker.person.fullName(),
    company: faker.company.name(),
    title: faker.person.jobTitle(),
    phone: faker.phone.number(),
    linkedin_url: `https://linkedin.com/in/${faker.internet.username()}`,
    website: faker.internet.url(),
    status: faker.helpers.arrayElement(['active', 'unsubscribed', 'bounced', 'invalid']),
    source: faker.helpers.arrayElement(['import', 'api', 'manual', 'enrichment']),
    tags: faker.helpers.arrayElements(['prospect', 'customer', 'partner', 'vendor', 'lead'], 2),
    custom_fields: {
      industry: faker.company.buzzNoun(),
      company_size: faker.helpers.arrayElement(['1-10', '11-50', '51-200', '201-500', '500+']),
      revenue: faker.helpers.arrayElement(['$0-1M', '$1-10M', '$10-50M', '$50M+']),
      location: faker.location.city() + ', ' + faker.location.country(),
      ...overrides.custom_fields,
    },
    enrichment_data: {
      enriched_at: faker.date.recent().toISOString(),
      provider: faker.helpers.arrayElement(['clearbit', 'hunter', 'apollo']),
      confidence: faker.number.float({ min: 0.5, max: 1, fractionDigits: 2 }),
      data: {
        company_description: faker.company.catchPhrase(),
        company_employees: faker.number.int({ min: 10, max: 10000 }),
        company_founded: faker.date.past({ years: 20 }).getFullYear(),
        technologies: faker.helpers.arrayElements(['React', 'Node.js', 'AWS', 'Python', 'Docker'], 3),
      },
    },
    created_at: faker.date.past().toISOString(),
    updated_at: faker.date.recent().toISOString(),
    ...overrides,
  }),

  createMany: (count: number, overrides = {}) => 
    Array.from({ length: count }, () => leadFactory.create(overrides)),
}

export const emailLogFactory = {
  create: (overrides = {}) => ({
    id: faker.string.uuid(),
    campaign_id: faker.string.uuid(),
    lead_id: faker.string.uuid(),
    user_id: faker.string.uuid(),
    workspace_id: faker.string.uuid(),
    message_id: faker.string.uuid(),
    subject: faker.lorem.sentence(),
    from_email: faker.internet.email(),
    to_email: faker.internet.email(),
    status: faker.helpers.arrayElement(['sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed']),
    sent_at: faker.date.recent().toISOString(),
    delivered_at: faker.datatype.boolean() ? faker.date.recent().toISOString() : null,
    opened_at: faker.datatype.boolean() ? faker.date.recent().toISOString() : null,
    clicked_at: faker.datatype.boolean() ? faker.date.recent().toISOString() : null,
    bounced_at: null,
    failed_at: null,
    bounce_type: null,
    bounce_reason: null,
    open_count: faker.number.int({ min: 0, max: 10 }),
    click_count: faker.number.int({ min: 0, max: 5 }),
    tracking_data: {
      ip_address: faker.internet.ip(),
      user_agent: faker.internet.userAgent(),
      device_type: faker.helpers.arrayElement(['desktop', 'mobile', 'tablet']),
      location: {
        city: faker.location.city(),
        country: faker.location.country(),
        country_code: faker.location.countryCode(),
      },
    },
    created_at: faker.date.past().toISOString(),
    updated_at: faker.date.recent().toISOString(),
    ...overrides,
  }),

  createMany: (count: number, overrides = {}) => 
    Array.from({ length: count }, () => emailLogFactory.create(overrides)),
}

export const sequenceFactory = {
  create: (overrides = {}) => ({
    id: faker.string.uuid(),
    campaign_id: faker.string.uuid(),
    name: faker.lorem.words(3),
    position: faker.number.int({ min: 1, max: 5 }),
    delay_days: faker.number.int({ min: 1, max: 7 }),
    subject: faker.lorem.sentence(),
    body: faker.lorem.paragraphs(2),
    enabled: faker.datatype.boolean(),
    settings: {
      stop_on_reply: true,
      personalization: {
        use_first_name: true,
        use_company_name: true,
        fallback_values: {
          first_name: 'there',
          company: 'your company',
        },
      },
      ...overrides.settings,
    },
    created_at: faker.date.past().toISOString(),
    updated_at: faker.date.recent().toISOString(),
    ...overrides,
  }),

  createMany: (count: number, overrides = {}) => 
    Array.from({ length: count }, () => sequenceFactory.create(overrides)),
}

export const billingFactory = {
  createSubscription: (overrides = {}) => ({
    id: faker.string.uuid(),
    workspace_id: faker.string.uuid(),
    stripe_subscription_id: `sub_${faker.string.alphanumeric(24)}`,
    stripe_customer_id: `cus_${faker.string.alphanumeric(14)}`,
    status: faker.helpers.arrayElement(['active', 'canceled', 'past_due', 'trialing']),
    plan: faker.helpers.arrayElement(['starter', 'pro', 'enterprise']),
    current_period_start: faker.date.recent().toISOString(),
    current_period_end: faker.date.future().toISOString(),
    cancel_at_period_end: faker.datatype.boolean(),
    trial_end: faker.date.future().toISOString(),
    created_at: faker.date.past().toISOString(),
    updated_at: faker.date.recent().toISOString(),
    ...overrides,
  }),

  createUsage: (overrides = {}) => ({
    id: faker.string.uuid(),
    workspace_id: faker.string.uuid(),
    period_start: faker.date.recent({ days: 30 }).toISOString(),
    period_end: faker.date.recent().toISOString(),
    emails_sent: faker.number.int({ min: 0, max: 10000 }),
    emails_limit: faker.number.int({ min: 1000, max: 50000 }),
    enrichments_used: faker.number.int({ min: 0, max: 1000 }),
    enrichments_limit: faker.number.int({ min: 100, max: 5000 }),
    team_members: faker.number.int({ min: 1, max: 10 }),
    team_members_limit: faker.number.int({ min: 3, max: 50 }),
    created_at: faker.date.past().toISOString(),
    updated_at: faker.date.recent().toISOString(),
    ...overrides,
  }),

  createInvoice: (overrides = {}) => ({
    id: faker.string.uuid(),
    workspace_id: faker.string.uuid(),
    stripe_invoice_id: `in_${faker.string.alphanumeric(24)}`,
    amount: faker.number.int({ min: 1000, max: 50000 }),
    currency: 'usd',
    status: faker.helpers.arrayElement(['paid', 'open', 'void', 'uncollectible']),
    period_start: faker.date.recent({ days: 30 }).toISOString(),
    period_end: faker.date.recent().toISOString(),
    paid_at: faker.date.recent().toISOString(),
    invoice_pdf: faker.internet.url(),
    created_at: faker.date.past().toISOString(),
    ...overrides,
  }),
}

// Helper to create related data
export const createFullCampaignData = () => {
  const workspace = workspaceFactory.create()
  const campaign = campaignFactory.create({ workspace_id: workspace.id })
  const sequences = sequenceFactory.createMany(3, { campaign_id: campaign.id })
  const leads = leadFactory.createMany(50, { workspace_id: workspace.id })
  const emailLogs = emailLogFactory.createMany(
    30, 
    { 
      campaign_id: campaign.id, 
      workspace_id: workspace.id,
      lead_id: () => faker.helpers.arrayElement(leads).id,
    }
  )

  return {
    workspace,
    campaign,
    sequences,
    leads,
    emailLogs,
  }
}

// Export all factories
export const factories = {
  user: userFactory,
  workspace: workspaceFactory,
  campaign: campaignFactory,
  lead: leadFactory,
  emailLog: emailLogFactory,
  sequence: sequenceFactory,
  billing: billingFactory,
  createFullCampaignData,
}