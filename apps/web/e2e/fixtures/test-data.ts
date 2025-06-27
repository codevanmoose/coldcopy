import { faker } from '@faker-js/faker'

/**
 * Test data factories for E2E tests
 */

export interface TestUser {
  email: string
  password: string
  fullName: string
  firstName: string
  lastName: string
  jobTitle: string
  phone: string
  company: string
}

export interface TestLead {
  id: string
  email: string
  firstName: string
  lastName: string
  company: string
  jobTitle: string
  phone: string
  website: string
  industry: string
  companySize: string
  status: string
  tags: string[]
  notes: string
  source: string
}

export interface TestCampaign {
  id: string
  name: string
  description: string
  type: string
  status: string
  totalLeads: number
  emailsSent: number
  openRate: number
  clickRate: number
  replyRate: number
}

export interface TestEmailSequence {
  subject: string
  body: string
  delay: number
  delayUnit: string
}

export interface TestPaymentMethod {
  cardNumber: string
  expiry: string
  cvc: string
  cardholderName: string
  address: string
  city: string
  state: string
  zip: string
  country: string
}

export class TestDataFactory {
  static createUser(overrides: Partial<TestUser> = {}): TestUser {
    const firstName = faker.person.firstName()
    const lastName = faker.person.lastName()
    
    return {
      email: faker.internet.email({ firstName, lastName }),
      password: 'TestPassword123!',
      fullName: `${firstName} ${lastName}`,
      firstName,
      lastName,
      jobTitle: faker.person.jobTitle(),
      phone: faker.phone.number(),
      company: faker.company.name(),
      ...overrides
    }
  }

  static createLead(overrides: Partial<TestLead> = {}): TestLead {
    const firstName = faker.person.firstName()
    const lastName = faker.person.lastName()
    const company = faker.company.name()
    
    return {
      id: faker.string.uuid(),
      email: faker.internet.email({ firstName, lastName }),
      firstName,
      lastName,
      company,
      jobTitle: faker.person.jobTitle(),
      phone: faker.phone.number(),
      website: faker.internet.url(),
      industry: faker.helpers.arrayElement([
        'Technology', 'Healthcare', 'Finance', 'Education', 
        'Manufacturing', 'Retail', 'Consulting', 'Real Estate'
      ]),
      companySize: faker.helpers.arrayElement([
        '1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'
      ]),
      status: faker.helpers.arrayElement([
        'new', 'contacted', 'qualified', 'opportunity', 'customer', 'unqualified'
      ]),
      tags: faker.helpers.arrayElements([
        'enterprise', 'smb', 'hot-lead', 'cold-lead', 'decision-maker', 
        'influencer', 'champion', 'technical', 'budget-holder'
      ], { min: 1, max: 3 }),
      notes: faker.lorem.paragraph(),
      source: faker.helpers.arrayElement([
        'website', 'referral', 'cold-outreach', 'social-media', 'conference', 'webinar'
      ]),
      ...overrides
    }
  }

  static createLeads(count: number, overrides: Partial<TestLead> = {}): TestLead[] {
    return Array.from({ length: count }, () => this.createLead(overrides))
  }

  static createCampaign(overrides: Partial<TestCampaign> = {}): TestCampaign {
    const totalLeads = faker.number.int({ min: 100, max: 10000 })
    const emailsSent = faker.number.int({ min: 50, max: totalLeads })
    
    return {
      id: faker.string.uuid(),
      name: `${faker.company.buzzAdjective()} ${faker.company.buzzNoun()} Campaign`,
      description: faker.lorem.sentence(),
      type: faker.helpers.arrayElement(['email_sequence', 'drip_campaign', 'one_time']),
      status: faker.helpers.arrayElement(['draft', 'active', 'paused', 'completed', 'cancelled']),
      totalLeads,
      emailsSent,
      openRate: faker.number.float({ min: 15, max: 35, multipleOf: 0.1 }),
      clickRate: faker.number.float({ min: 2, max: 15, multipleOf: 0.1 }),
      replyRate: faker.number.float({ min: 0.5, max: 5, multipleOf: 0.1 }),
      ...overrides
    }
  }

  static createEmailSequence(stepCount: number = 3): TestEmailSequence[] {
    const sequence: TestEmailSequence[] = []
    
    for (let i = 0; i < stepCount; i++) {
      sequence.push({
        subject: i === 0 
          ? `Introduction: ${faker.company.buzzPhrase()}`
          : i === 1
          ? `Follow-up: ${faker.company.catchPhrase()}`
          : `Final follow-up: ${faker.company.buzzPhrase()}`,
        body: `Hi {{firstName}},\n\n${faker.lorem.paragraphs(2)}\n\nBest regards,\n{{senderName}}`,
        delay: i === 0 ? 0 : faker.number.int({ min: 1, max: 7 }),
        delayUnit: 'days'
      })
    }
    
    return sequence
  }

  static createPaymentMethod(overrides: Partial<TestPaymentMethod> = {}): TestPaymentMethod {
    return {
      cardNumber: '4242424242424242', // Stripe test card
      expiry: '12/28',
      cvc: '123',
      cardholderName: faker.person.fullName(),
      address: faker.location.streetAddress(),
      city: faker.location.city(),
      state: faker.location.state(),
      zip: faker.location.zipCode(),
      country: 'US',
      ...overrides
    }
  }

  static createWorkspaceData() {
    return {
      name: faker.company.name(),
      description: faker.company.catchPhrase(),
      industry: faker.helpers.arrayElement([
        'Technology', 'Healthcare', 'Finance', 'Education', 'Manufacturing'
      ]),
      companySize: faker.helpers.arrayElement(['1-10', '11-50', '51-200', '201-500'])
    }
  }

  static createOnboardingData() {
    return {
      workspace: this.createWorkspaceData(),
      profile: {
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        jobTitle: faker.person.jobTitle(),
        phone: faker.phone.number(),
        timezone: faker.helpers.arrayElement([
          'America/New_York', 'America/Los_Angeles', 'Europe/London', 
          'Europe/Berlin', 'Asia/Tokyo', 'Australia/Sydney'
        ])
      },
      preferences: {
        goals: faker.helpers.arrayElements([
          'lead-generation', 'customer-outreach', 'sales-automation', 
          'marketing-campaigns', 'partnership-outreach'
        ], { min: 2, max: 3 }),
        emailVolume: faker.helpers.arrayElement(['0-100', '100-500', '500-1000', '1000+']),
        useCase: faker.helpers.arrayElement(['sales', 'marketing', 'recruiting', 'partnerships']),
        teamSize: faker.number.int({ min: 1, max: 50 }).toString()
      },
      email: {
        provider: faker.helpers.arrayElement(['gmail', 'outlook', 'custom'])
      }
    }
  }

  static createCSVLeadsData(count: number = 100): string {
    const headers = 'email,firstName,lastName,company,jobTitle,phone,website,industry,companySize'
    const rows = Array.from({ length: count }, () => {
      const lead = this.createLead()
      return [
        lead.email,
        lead.firstName,
        lead.lastName,
        lead.company,
        lead.jobTitle,
        lead.phone,
        lead.website,
        lead.industry,
        lead.companySize
      ].join(',')
    })
    
    return [headers, ...rows].join('\n')
  }

  static createInvalidCSVData(): string {
    return `email,name,company
invalid-email,John Doe,Acme Corp
valid@email.com,Jane Doe,Tech Co
,Missing Email,Another Company
duplicate@example.com,First Duplicate,Company A
duplicate@example.com,Second Duplicate,Company B`
  }

  static createEmailTrackingData() {
    return {
      opens: Array.from({ length: 50 }, () => ({
        leadId: faker.string.uuid(),
        timestamp: faker.date.recent().toISOString(),
        location: `${faker.location.city()}, ${faker.location.state()}`,
        userAgent: faker.internet.userAgent(),
        ipAddress: faker.internet.ip()
      })),
      clicks: Array.from({ length: 20 }, () => ({
        leadId: faker.string.uuid(),
        url: faker.internet.url(),
        timestamp: faker.date.recent().toISOString(),
        location: `${faker.location.city()}, ${faker.location.state()}`
      })),
      replies: Array.from({ length: 10 }, () => ({
        leadId: faker.string.uuid(),
        subject: `Re: ${faker.lorem.words(3)}`,
        timestamp: faker.date.recent().toISOString(),
        sentiment: faker.helpers.arrayElement(['positive', 'neutral', 'negative']),
        intent: faker.helpers.arrayElement(['interested', 'not_interested', 'meeting_request', 'out_of_office'])
      })),
      bounces: Array.from({ length: 15 }, () => ({
        leadId: faker.string.uuid(),
        type: faker.helpers.arrayElement(['permanent', 'temporary']),
        reason: faker.helpers.arrayElement([
          'No such user', 'Mailbox full', 'Domain does not exist', 
          'Blocked by recipient', 'Message too large'
        ]),
        bounceCode: faker.helpers.arrayElement(['5.1.1', '4.2.2', '5.1.2', '5.7.1']),
        timestamp: faker.date.recent().toISOString()
      }))
    }
  }

  static createBillingData() {
    return {
      subscription: {
        plan: faker.helpers.arrayElement(['basic', 'professional', 'enterprise']),
        status: faker.helpers.arrayElement(['active', 'trialing', 'cancelled', 'past_due']),
        price: faker.commerce.price({ min: 29, max: 199, dec: 0 }),
        billingCycle: faker.helpers.arrayElement(['monthly', 'yearly']),
        nextBillingDate: faker.date.future().toISOString()
      },
      usage: {
        emailsSent: { current: faker.number.int({ min: 500, max: 4500 }), limit: 5000 },
        leads: { current: faker.number.int({ min: 5000, max: 9500 }), limit: 10000 },
        storage: { current: faker.number.float({ min: 1, max: 4.5 }), limit: 5.0 }
      },
      invoices: Array.from({ length: 12 }, (_, i) => ({
        id: `in_${faker.string.alphanumeric(10)}`,
        date: faker.date.past({ years: 1 }),
        amount: faker.commerce.price({ min: 29, max: 199, dec: 0 }),
        status: faker.helpers.arrayElement(['paid', 'pending', 'failed']),
        downloadUrl: `/invoices/in_${faker.string.alphanumeric(10)}.pdf`
      }))
    }
  }

  static createGDPRRequestData() {
    return {
      requests: Array.from({ length: 10 }, () => ({
        id: faker.string.uuid(),
        type: faker.helpers.arrayElement(['data_export', 'data_deletion', 'consent_withdrawal']),
        status: faker.helpers.arrayElement(['pending', 'processing', 'completed', 'rejected']),
        requestedAt: faker.date.recent().toISOString(),
        userEmail: faker.internet.email(),
        reason: faker.lorem.sentence(),
        completedAt: faker.helpers.maybe(() => faker.date.recent().toISOString())
      }))
    }
  }

  static createEnrichmentData() {
    return {
      providers: ['clearbit', 'hunter', 'apollo'],
      fields: [
        'job_title', 'company_size', 'industry', 'annual_revenue',
        'employee_count', 'technologies', 'social_profiles', 'funding_info'
      ],
      results: {
        enriched: faker.number.int({ min: 70, max: 95 }),
        failed: faker.number.int({ min: 5, max: 25 }),
        credits_used: faker.number.int({ min: 75, max: 120 })
      }
    }
  }

  static createAnalyticsData() {
    return {
      overview: {
        total_sent: faker.number.int({ min: 10000, max: 100000 }),
        delivered: faker.number.int({ min: 9000, max: 95000 }),
        opened: faker.number.int({ min: 2000, max: 25000 }),
        clicked: faker.number.int({ min: 500, max: 7500 }),
        replied: faker.number.int({ min: 50, max: 1000 }),
        bounced: faker.number.int({ min: 100, max: 2000 }),
        unsubscribed: faker.number.int({ min: 10, max: 200 })
      },
      geographic: Array.from({ length: 10 }, () => ({
        country: faker.location.country(),
        sent: faker.number.int({ min: 100, max: 5000 }),
        opened: faker.number.int({ min: 20, max: 1500 }),
        rate: faker.number.float({ min: 15, max: 35, multipleOf: 0.1 })
      })),
      timeBreakdown: Array.from({ length: 24 }, (_, hour) => ({
        hour,
        sent: faker.number.int({ min: 50, max: 500 }),
        opened: faker.number.int({ min: 10, max: 150 }),
        rate: faker.number.float({ min: 15, max: 35, multipleOf: 0.1 })
      }))
    }
  }

  // Utility methods for test scenarios
  static createHighVolumeScenario() {
    return {
      campaign: this.createCampaign({
        totalLeads: 50000,
        emailsSent: 45000,
        status: 'active'
      }),
      leads: this.createLeads(50000),
      dailyLimit: 5000,
      sendingRate: 150 // emails per minute
    }
  }

  static createTrialUserScenario() {
    return {
      user: this.createUser(),
      subscription: {
        plan: 'trial',
        status: 'trialing',
        daysRemaining: faker.number.int({ min: 1, max: 14 }),
        trialEndsAt: faker.date.future({ days: 14 }).toISOString()
      },
      usage: {
        emailsSent: { current: faker.number.int({ min: 100, max: 800 }), limit: 1000 },
        leads: { current: faker.number.int({ min: 200, max: 1800 }), limit: 2000 }
      }
    }
  }

  static createBounceScenario() {
    return {
      bounces: [
        {
          email: 'nonexistent@fake-domain-12345.com',
          type: 'permanent',
          reason: 'Domain does not exist',
          bounceCode: '5.1.2'
        },
        {
          email: 'full-mailbox@example.com',
          type: 'temporary',
          reason: 'Mailbox full',
          bounceCode: '4.2.2'
        },
        {
          email: 'blocked-sender@company.com',
          type: 'permanent',
          reason: 'Blocked by recipient policy',
          bounceCode: '5.7.1'
        }
      ]
    }
  }

  static createComplaintScenario() {
    return {
      complaints: [
        {
          email: 'spam-reporter@gmail.com',
          type: 'spam',
          source: 'gmail',
          timestamp: faker.date.recent().toISOString()
        },
        {
          email: 'abuse-reporter@outlook.com',
          type: 'abuse',
          source: 'outlook',
          timestamp: faker.date.recent().toISOString()
        }
      ],
      complaint_rate: 0.08, // 0.08%
      threshold: 0.1 // 0.1%
    }
  }

  static createReplyScenario() {
    return {
      replies: [
        {
          email: 'interested@customer.com',
          subject: 'Re: Partnership Opportunity',
          body: 'Thanks for reaching out! I\'m very interested in learning more about your solution. Can we schedule a call this week?',
          sentiment: 'positive',
          intent: 'meeting_request',
          tags: ['interested', 'meeting_request', 'hot_lead']
        },
        {
          email: 'not-interested@company.com',
          subject: 'Re: Partnership Opportunity',
          body: 'Thank you for your email, but we\'re not interested at this time. Please remove me from your mailing list.',
          sentiment: 'negative',
          intent: 'unsubscribe',
          tags: ['not_interested', 'unsubscribe']
        },
        {
          email: 'out-of-office@business.com',
          subject: 'Auto-Reply: Out of Office',
          body: 'I am currently out of the office and will return on January 15th. For urgent matters, please contact my assistant.',
          sentiment: 'neutral',
          intent: 'out_of_office',
          tags: ['out_of_office', 'auto_reply']
        }
      ]
    }
  }
}

// Export commonly used test data
export const TEST_USER = TestDataFactory.createUser()
export const TEST_ADMIN_USER = TestDataFactory.createUser({
  email: 'admin@example.com',
  fullName: 'Test Admin'
})
export const TEST_LEADS = TestDataFactory.createLeads(10)
export const TEST_CAMPAIGN = TestDataFactory.createCampaign()
export const TEST_EMAIL_SEQUENCE = TestDataFactory.createEmailSequence()
export const TEST_PAYMENT_METHOD = TestDataFactory.createPaymentMethod()
export const TEST_ONBOARDING_DATA = TestDataFactory.createOnboardingData()

// Test scenarios
export const HIGH_VOLUME_SCENARIO = TestDataFactory.createHighVolumeScenario()
export const TRIAL_USER_SCENARIO = TestDataFactory.createTrialUserScenario()
export const BOUNCE_SCENARIO = TestDataFactory.createBounceScenario()
export const COMPLAINT_SCENARIO = TestDataFactory.createComplaintScenario()
export const REPLY_SCENARIO = TestDataFactory.createReplyScenario()

// CSV test data
export const VALID_CSV_DATA = TestDataFactory.createCSVLeadsData(100)
export const INVALID_CSV_DATA = TestDataFactory.createInvalidCSVData()
export const LARGE_CSV_DATA = TestDataFactory.createCSVLeadsData(10000)