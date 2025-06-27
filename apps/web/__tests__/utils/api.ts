import { NextRequest } from 'next/server'
import { faker } from '@faker-js/faker'

// API test client for testing API routes
export class ApiTestClient {
  private baseUrl: string
  private headers: Record<string, string>

  constructor(baseUrl = 'http://localhost:3000') {
    this.baseUrl = baseUrl
    this.headers = {
      'Content-Type': 'application/json',
    }
  }

  // Set authorization header
  setAuth(token: string) {
    this.headers['Authorization'] = `Bearer ${token}`
    return this
  }

  // Set custom headers
  setHeaders(headers: Record<string, string>) {
    this.headers = { ...this.headers, ...headers }
    return this
  }

  // Make a GET request
  async get(path: string, params?: Record<string, any>) {
    const url = new URL(path, this.baseUrl)
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, String(value))
      })
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: this.headers,
    })

    return {
      status: response.status,
      data: await response.json().catch(() => null),
      headers: response.headers,
    }
  }

  // Make a POST request
  async post(path: string, body?: any) {
    const response = await fetch(new URL(path, this.baseUrl).toString(), {
      method: 'POST',
      headers: this.headers,
      body: body ? JSON.stringify(body) : undefined,
    })

    return {
      status: response.status,
      data: await response.json().catch(() => null),
      headers: response.headers,
    }
  }

  // Make a PUT request
  async put(path: string, body?: any) {
    const response = await fetch(new URL(path, this.baseUrl).toString(), {
      method: 'PUT',
      headers: this.headers,
      body: body ? JSON.stringify(body) : undefined,
    })

    return {
      status: response.status,
      data: await response.json().catch(() => null),
      headers: response.headers,
    }
  }

  // Make a PATCH request
  async patch(path: string, body?: any) {
    const response = await fetch(new URL(path, this.baseUrl).toString(), {
      method: 'PATCH',
      headers: this.headers,
      body: body ? JSON.stringify(body) : undefined,
    })

    return {
      status: response.status,
      data: await response.json().catch(() => null),
      headers: response.headers,
    }
  }

  // Make a DELETE request
  async delete(path: string) {
    const response = await fetch(new URL(path, this.baseUrl).toString(), {
      method: 'DELETE',
      headers: this.headers,
    })

    return {
      status: response.status,
      data: await response.json().catch(() => null),
      headers: response.headers,
    }
  }
}

// Mock Next.js request for testing API routes directly
export function createMockRequest(
  url: string,
  options: {
    method?: string
    headers?: Record<string, string>
    body?: any
    params?: Record<string, string>
    searchParams?: Record<string, string>
  } = {}
): NextRequest {
  const { method = 'GET', headers = {}, body, searchParams = {} } = options

  const requestUrl = new URL(url, 'http://localhost:3000')
  Object.entries(searchParams).forEach(([key, value]) => {
    requestUrl.searchParams.set(key, value)
  })

  const init: RequestInit = {
    method,
    headers: new Headers({
      'Content-Type': 'application/json',
      ...headers,
    }),
  }

  if (body && method !== 'GET') {
    init.body = JSON.stringify(body)
  }

  return new NextRequest(requestUrl.toString(), init)
}

// Helper to test API route handlers
export async function testApiRoute(
  handler: Function,
  request: NextRequest,
  context?: any
) {
  try {
    const response = await handler(request, context)
    const data = await response.json().catch(() => null)
    
    return {
      status: response.status,
      data,
      headers: response.headers,
    }
  } catch (error) {
    return {
      status: 500,
      data: { error: error.message },
      headers: new Headers(),
    }
  }
}

// Mock API responses
export const mockApiResponses = {
  // Success responses
  success: (data: any, status = 200) => 
    new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),

  // Error responses
  error: (message: string, status = 400) =>
    new Response(JSON.stringify({ error: message }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),

  // Unauthorized response
  unauthorized: () =>
    new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    }),

  // Not found response
  notFound: () =>
    new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    }),

  // Rate limit response
  rateLimit: () =>
    new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
      status: 429,
      headers: { 
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': '100',
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Date.now() + 3600000),
      },
    }),
}

// Common API test scenarios
export const apiTestScenarios = {
  // Test authentication
  async testAuth(client: ApiTestClient, endpoint: string) {
    // Test without auth
    const noAuthResponse = await client.get(endpoint)
    expect(noAuthResponse.status).toBe(401)

    // Test with invalid auth
    const invalidAuthResponse = await client
      .setAuth('invalid-token')
      .get(endpoint)
    expect(invalidAuthResponse.status).toBe(401)

    // Test with valid auth
    const validToken = faker.string.alphanumeric(32)
    const validAuthResponse = await client
      .setAuth(validToken)
      .get(endpoint)
    
    return validAuthResponse
  },

  // Test CRUD operations
  async testCrud(client: ApiTestClient, endpoint: string, testData: any) {
    // Create
    const createResponse = await client.post(endpoint, testData)
    expect(createResponse.status).toBe(201)
    const createdItem = createResponse.data

    // Read
    const readResponse = await client.get(`${endpoint}/${createdItem.id}`)
    expect(readResponse.status).toBe(200)
    expect(readResponse.data).toMatchObject(testData)

    // Update
    const updateData = { name: 'Updated Name' }
    const updateResponse = await client.patch(
      `${endpoint}/${createdItem.id}`,
      updateData
    )
    expect(updateResponse.status).toBe(200)
    expect(updateResponse.data.name).toBe('Updated Name')

    // Delete
    const deleteResponse = await client.delete(`${endpoint}/${createdItem.id}`)
    expect(deleteResponse.status).toBe(204)

    // Verify deletion
    const verifyResponse = await client.get(`${endpoint}/${createdItem.id}`)
    expect(verifyResponse.status).toBe(404)
  },

  // Test pagination
  async testPagination(client: ApiTestClient, endpoint: string) {
    // Test default pagination
    const defaultResponse = await client.get(endpoint)
    expect(defaultResponse.status).toBe(200)
    expect(defaultResponse.data).toHaveProperty('data')
    expect(defaultResponse.data).toHaveProperty('total')
    expect(defaultResponse.data).toHaveProperty('page')
    expect(defaultResponse.data).toHaveProperty('limit')

    // Test custom pagination
    const customResponse = await client.get(endpoint, { page: 2, limit: 5 })
    expect(customResponse.status).toBe(200)
    expect(customResponse.data.page).toBe(2)
    expect(customResponse.data.limit).toBe(5)
  },

  // Test validation
  async testValidation(
    client: ApiTestClient, 
    endpoint: string, 
    invalidData: any,
    expectedErrors: string[]
  ) {
    const response = await client.post(endpoint, invalidData)
    expect(response.status).toBe(400)
    expect(response.data).toHaveProperty('errors')
    
    expectedErrors.forEach(error => {
      expect(JSON.stringify(response.data.errors)).toContain(error)
    })
  },
}

// Mock external API calls
export const mockExternalApis = {
  // Mock Stripe API
  mockStripe: () => {
    global.fetch = jest.fn((url) => {
      if (url.includes('api.stripe.com')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            id: `cus_${faker.string.alphanumeric(14)}`,
            object: 'customer',
            created: Date.now() / 1000,
          }),
        })
      }
      return Promise.reject(new Error('Not mocked'))
    })
  },

  // Mock email service
  mockEmailService: () => {
    global.fetch = jest.fn((url) => {
      if (url.includes('email-api')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            messageId: faker.string.uuid(),
            status: 'sent',
          }),
        })
      }
      return Promise.reject(new Error('Not mocked'))
    })
  },

  // Mock enrichment APIs
  mockEnrichmentApis: () => {
    global.fetch = jest.fn((url) => {
      if (url.includes('clearbit.com') || url.includes('hunter.io')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            email: faker.internet.email(),
            company: faker.company.name(),
            enriched: true,
          }),
        })
      }
      return Promise.reject(new Error('Not mocked'))
    })
  },

  // Reset mocks
  reset: () => {
    global.fetch = undefined
  },
}