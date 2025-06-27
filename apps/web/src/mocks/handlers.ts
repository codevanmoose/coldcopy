import { http, HttpResponse } from 'msw'
import { faker } from '@faker-js/faker'

// Mock API handlers for MSW
export const handlers = [
  // Auth endpoints
  http.post('/api/auth/login', async ({ request }) => {
    const body = await request.json()
    const { email, password } = body as any

    if (email === 'test@example.com' && password === 'password123') {
      return HttpResponse.json({
        user: {
          id: faker.string.uuid(),
          email,
          full_name: 'Test User',
        },
        session: {
          access_token: faker.string.alphanumeric(32),
          refresh_token: faker.string.alphanumeric(32),
        },
      })
    }

    return HttpResponse.json(
      { error: 'Invalid credentials' },
      { status: 401 }
    )
  }),

  http.post('/api/auth/signup', async ({ request }) => {
    const body = await request.json()
    const { email, password, full_name } = body as any

    return HttpResponse.json({
      user: {
        id: faker.string.uuid(),
        email,
        full_name,
      },
      message: 'Please check your email to verify your account',
    })
  }),

  http.post('/api/auth/logout', () => {
    return HttpResponse.json({ success: true })
  }),

  // Campaign endpoints
  http.get('/api/campaigns', ({ request }) => {
    const url = new URL(request.url)
    const page = Number(url.searchParams.get('page') || 1)
    const limit = Number(url.searchParams.get('limit') || 10)

    const campaigns = Array.from({ length: limit }, () => ({
      id: faker.string.uuid(),
      name: faker.commerce.productName() + ' Campaign',
      status: faker.helpers.arrayElement(['draft', 'active', 'paused', 'completed']),
      created_at: faker.date.recent().toISOString(),
      stats: {
        sent: faker.number.int({ min: 0, max: 1000 }),
        opened: faker.number.int({ min: 0, max: 500 }),
        clicked: faker.number.int({ min: 0, max: 200 }),
        replied: faker.number.int({ min: 0, max: 50 }),
      },
    }))

    return HttpResponse.json({
      data: campaigns,
      page,
      limit,
      total: 100,
    })
  }),

  http.post('/api/campaigns', async ({ request }) => {
    const body = await request.json()
    
    return HttpResponse.json({
      id: faker.string.uuid(),
      ...body,
      status: 'draft',
      created_at: new Date().toISOString(),
    }, { status: 201 })
  }),

  http.get('/api/campaigns/:id', ({ params }) => {
    const { id } = params

    return HttpResponse.json({
      id,
      name: faker.commerce.productName() + ' Campaign',
      subject: faker.lorem.sentence(),
      body: faker.lorem.paragraphs(3),
      status: 'active',
      settings: {
        daily_limit: 50,
        tracking: {
          open_tracking: true,
          click_tracking: true,
        },
      },
      stats: {
        sent: faker.number.int({ min: 0, max: 1000 }),
        opened: faker.number.int({ min: 0, max: 500 }),
        clicked: faker.number.int({ min: 0, max: 200 }),
        replied: faker.number.int({ min: 0, max: 50 }),
      },
      created_at: faker.date.recent().toISOString(),
    })
  }),

  // Lead endpoints
  http.get('/api/leads', ({ request }) => {
    const url = new URL(request.url)
    const page = Number(url.searchParams.get('page') || 1)
    const limit = Number(url.searchParams.get('limit') || 10)

    const leads = Array.from({ length: limit }, () => ({
      id: faker.string.uuid(),
      email: faker.internet.email(),
      first_name: faker.person.firstName(),
      last_name: faker.person.lastName(),
      company: faker.company.name(),
      title: faker.person.jobTitle(),
      status: faker.helpers.arrayElement(['active', 'unsubscribed', 'bounced']),
      created_at: faker.date.recent().toISOString(),
    }))

    return HttpResponse.json({
      data: leads,
      page,
      limit,
      total: 500,
    })
  }),

  http.post('/api/leads/import', async ({ request }) => {
    const formData = await request.formData()
    const file = formData.get('file')

    return HttpResponse.json({
      imported: faker.number.int({ min: 50, max: 200 }),
      duplicates: faker.number.int({ min: 0, max: 20 }),
      errors: faker.number.int({ min: 0, max: 5 }),
      job_id: faker.string.uuid(),
    })
  }),

  // Email tracking endpoints
  http.get('/api/track/open', ({ request }) => {
    const url = new URL(request.url)
    const id = url.searchParams.get('id')

    // Return a 1x1 transparent pixel
    return new HttpResponse(null, {
      status: 200,
      headers: {
        'Content-Type': 'image/gif',
      },
    })
  }),

  http.get('/api/track/click', ({ request }) => {
    const url = new URL(request.url)
    const id = url.searchParams.get('id')
    const redirect = url.searchParams.get('url')

    // Redirect to the target URL
    return new HttpResponse(null, {
      status: 302,
      headers: {
        'Location': redirect || 'https://example.com',
      },
    })
  }),

  // Analytics endpoints
  http.get('/api/analytics/campaign/:id', ({ params }) => {
    const { id } = params

    return HttpResponse.json({
      campaign_id: id,
      metrics: {
        sent: faker.number.int({ min: 500, max: 1000 }),
        delivered: faker.number.int({ min: 450, max: 950 }),
        opened: faker.number.int({ min: 200, max: 400 }),
        clicked: faker.number.int({ min: 50, max: 150 }),
        replied: faker.number.int({ min: 10, max: 50 }),
        bounced: faker.number.int({ min: 0, max: 20 }),
        unsubscribed: faker.number.int({ min: 0, max: 10 }),
      },
      timeline: Array.from({ length: 7 }, (_, i) => ({
        date: faker.date.recent({ days: 7 - i }).toISOString(),
        sent: faker.number.int({ min: 50, max: 150 }),
        opened: faker.number.int({ min: 20, max: 60 }),
        clicked: faker.number.int({ min: 5, max: 20 }),
      })),
      devices: {
        desktop: faker.number.int({ min: 40, max: 60 }),
        mobile: faker.number.int({ min: 30, max: 50 }),
        tablet: faker.number.int({ min: 5, max: 15 }),
      },
    })
  }),

  // Billing endpoints
  http.get('/api/billing/subscription', () => {
    return HttpResponse.json({
      plan: 'pro',
      status: 'active',
      current_period_end: faker.date.future().toISOString(),
      usage: {
        emails_sent: faker.number.int({ min: 0, max: 5000 }),
        emails_limit: 10000,
        team_members: faker.number.int({ min: 1, max: 5 }),
        team_members_limit: 10,
        enrichments_used: faker.number.int({ min: 0, max: 500 }),
        enrichments_limit: 1000,
      },
    })
  }),

  http.post('/api/billing/subscription', async ({ request }) => {
    const body = await request.json()
    const { plan } = body as any

    return HttpResponse.json({
      plan,
      status: 'active',
      checkout_url: 'https://checkout.stripe.com/test_session',
    })
  }),

  // Enrichment endpoints
  http.post('/api/enrichment/enrich', async ({ request }) => {
    const body = await request.json()
    const { email } = body as any

    return HttpResponse.json({
      email,
      enriched: true,
      data: {
        full_name: faker.person.fullName(),
        company: faker.company.name(),
        title: faker.person.jobTitle(),
        linkedin: `https://linkedin.com/in/${faker.internet.username()}`,
        phone: faker.phone.number(),
        location: faker.location.city() + ', ' + faker.location.country(),
      },
      confidence: faker.number.float({ min: 0.7, max: 1, fractionDigits: 2 }),
      provider: 'clearbit',
    })
  }),

  // AI endpoints
  http.post('/api/ai/generate-email', async ({ request }) => {
    const body = await request.json()
    const { prompt } = body as any

    return HttpResponse.json({
      subject: faker.lorem.sentence(),
      body: faker.lorem.paragraphs(3),
      variations: Array.from({ length: 3 }, () => ({
        subject: faker.lorem.sentence(),
        body: faker.lorem.paragraphs(3),
      })),
    })
  }),

  // GDPR endpoints
  http.post('/api/gdpr/export', async ({ request }) => {
    const body = await request.json()
    
    return HttpResponse.json({
      request_id: faker.string.uuid(),
      status: 'processing',
      message: 'Your data export request has been received. You will receive an email when it\'s ready.',
    })
  }),

  http.post('/api/gdpr/delete', async ({ request }) => {
    const body = await request.json()
    
    return HttpResponse.json({
      request_id: faker.string.uuid(),
      status: 'processing',
      message: 'Your deletion request has been received. You will receive a confirmation email.',
    })
  }),

  // Webhook endpoints
  http.post('/api/webhooks/stripe', async ({ request }) => {
    return HttpResponse.json({ received: true })
  }),

  http.post('/api/webhooks/email', async ({ request }) => {
    return HttpResponse.json({ received: true })
  }),
]

// Error response handlers for testing error states
export const errorHandlers = [
  http.get('/api/campaigns', () => {
    return HttpResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }),

  http.post('/api/campaigns', () => {
    return HttpResponse.json(
      { error: 'Rate limit exceeded' },
      { status: 429 }
    )
  }),

  http.get('/api/leads', () => {
    return HttpResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }),
]