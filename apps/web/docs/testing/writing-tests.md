# Writing Tests for ColdCopy

## Getting Started

This guide will help you write effective tests for the ColdCopy application. We use Jest for unit and integration tests, and Playwright for end-to-end tests.

## Setting Up Your Test Environment

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up test database**:
   ```bash
   npm run test:db:setup
   ```

3. **Run tests**:
   ```bash
   npm test
   ```

## Writing Unit Tests

### Component Testing

#### Basic Component Test
```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LeadCard } from '@/components/leads/LeadCard'
import { factories } from '@/__tests__/utils/factories'

describe('LeadCard', () => {
  const mockLead = factories.lead.create()
  
  it('renders lead information', () => {
    render(<LeadCard lead={mockLead} />)
    
    expect(screen.getByText(mockLead.full_name)).toBeInTheDocument()
    expect(screen.getByText(mockLead.email)).toBeInTheDocument()
    expect(screen.getByText(mockLead.company)).toBeInTheDocument()
  })
  
  it('handles click events', async () => {
    const handleClick = jest.fn()
    const user = userEvent.setup()
    
    render(<LeadCard lead={mockLead} onClick={handleClick} />)
    
    await user.click(screen.getByRole('article'))
    
    expect(handleClick).toHaveBeenCalledWith(mockLead.id)
  })
})
```

#### Testing Hooks
```typescript
import { renderHook, act } from '@testing-library/react'
import { useDebounce } from '@/hooks/useDebounce'

describe('useDebounce', () => {
  jest.useFakeTimers()
  
  it('debounces value changes', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 500 } }
    )
    
    expect(result.current).toBe('initial')
    
    // Change value
    rerender({ value: 'updated', delay: 500 })
    
    // Value hasn't changed yet
    expect(result.current).toBe('initial')
    
    // Fast forward time
    act(() => {
      jest.advanceTimersByTime(500)
    })
    
    // Now value has changed
    expect(result.current).toBe('updated')
  })
  
  afterEach(() => {
    jest.clearAllTimers()
  })
})
```

#### Testing with Context
```typescript
import { render, screen } from '@testing-library/react'
import { AuthProvider } from '@/components/providers/auth-provider'
import { Dashboard } from '@/components/dashboard/Dashboard'
import { authHelpers } from '@/__tests__/utils/auth'

describe('Dashboard', () => {
  const renderWithAuth = (component: React.ReactNode, authValue = {}) => {
    const mockAuth = authHelpers.createMockAuthContext(authValue)
    
    return render(
      <AuthProvider value={mockAuth}>
        {component}
      </AuthProvider>
    )
  }
  
  it('shows user greeting when authenticated', () => {
    const user = authHelpers.createMockUser({
      user_metadata: { full_name: 'John Doe' }
    })
    
    renderWithAuth(<Dashboard />, { user })
    
    expect(screen.getByText('Welcome back, John!')).toBeInTheDocument()
  })
  
  it('redirects when not authenticated', () => {
    renderWithAuth(<Dashboard />, { user: null })
    
    expect(mockRouter.push).toHaveBeenCalledWith('/login')
  })
})
```

### API Route Testing

#### Testing GET Endpoints
```typescript
import { createMockRequest, testApiRoute } from '@/__tests__/utils/api'
import { GET } from '@/app/api/campaigns/route'
import { dbHelpers } from '@/__tests__/utils/db'

describe('GET /api/campaigns', () => {
  beforeEach(async () => {
    await dbHelpers.cleanupTestData()
  })
  
  it('returns campaigns for authenticated user', async () => {
    // Setup
    const { user } = await dbHelpers.createTestUser()
    const workspace = await dbHelpers.createTestWorkspace(user.id)
    const campaigns = await Promise.all([
      dbHelpers.createTestCampaign(workspace.id, user.id),
      dbHelpers.createTestCampaign(workspace.id, user.id),
    ])
    
    // Create request
    const request = createMockRequest('/api/campaigns', {
      headers: {
        'Authorization': `Bearer ${user.access_token}`,
      },
    })
    
    // Test
    const response = await testApiRoute(GET, request)
    
    // Assert
    expect(response.status).toBe(200)
    expect(response.data.data).toHaveLength(2)
    expect(response.data.data[0].id).toBe(campaigns[0].id)
  })
  
  it('returns 401 for unauthenticated requests', async () => {
    const request = createMockRequest('/api/campaigns')
    const response = await testApiRoute(GET, request)
    
    expect(response.status).toBe(401)
    expect(response.data.error).toBe('Unauthorized')
  })
})
```

#### Testing POST Endpoints
```typescript
import { POST } from '@/app/api/leads/import/route'

describe('POST /api/leads/import', () => {
  it('imports CSV file successfully', async () => {
    const csvContent = `email,first_name,last_name,company
john@example.com,John,Doe,Acme Corp
jane@example.com,Jane,Smith,Tech Inc`
    
    const formData = new FormData()
    formData.append('file', new Blob([csvContent], { type: 'text/csv' }))
    formData.append('workspace_id', 'test-workspace-id')
    
    const request = createMockRequest('/api/leads/import', {
      method: 'POST',
      body: formData,
    })
    
    const response = await testApiRoute(POST, request)
    
    expect(response.status).toBe(201)
    expect(response.data.imported).toBe(2)
    expect(response.data.errors).toBe(0)
  })
  
  it('validates file format', async () => {
    const formData = new FormData()
    formData.append('file', new Blob(['invalid'], { type: 'text/plain' }))
    
    const request = createMockRequest('/api/leads/import', {
      method: 'POST',
      body: formData,
    })
    
    const response = await testApiRoute(POST, request)
    
    expect(response.status).toBe(400)
    expect(response.data.error).toContain('Invalid file format')
  })
})
```

### Service/Library Testing

#### Testing Email Service
```typescript
import { EmailService } from '@/lib/email/email-service'
import { sesClient } from '@/lib/email/ses-client'
import { factories } from '@/__tests__/utils/factories'

jest.mock('@/lib/email/ses-client')

describe('EmailService', () => {
  const emailService = new EmailService()
  const mockSend = sesClient.send as jest.MockedFunction<typeof sesClient.send>
  
  beforeEach(() => {
    jest.clearAllMocks()
  })
  
  describe('sendCampaignEmail', () => {
    it('sends email and tracks in database', async () => {
      // Arrange
      const campaign = factories.campaign.create()
      const lead = factories.lead.create()
      
      mockSend.mockResolvedValue({
        MessageId: 'test-message-id',
        $metadata: {},
      })
      
      // Act
      const result = await emailService.sendCampaignEmail({
        campaign,
        lead,
        subject: 'Test Subject',
        body: 'Test Body',
      })
      
      // Assert
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            Destination: { ToAddresses: [lead.email] },
            Message: {
              Subject: { Data: 'Test Subject' },
              Body: { Html: { Data: expect.stringContaining('Test Body') } },
            },
          }),
        })
      )
      
      expect(result.messageId).toBe('test-message-id')
      expect(result.tracked).toBe(true)
    })
    
    it('handles SES errors gracefully', async () => {
      mockSend.mockRejectedValue(new Error('SES rate limit exceeded'))
      
      const campaign = factories.campaign.create()
      const lead = factories.lead.create()
      
      await expect(
        emailService.sendCampaignEmail({ campaign, lead })
      ).rejects.toThrow('Failed to send email')
    })
  })
})
```

## Writing Integration Tests

### Database Integration Tests
```typescript
import { dbHelpers, testDb } from '@/__tests__/utils/db'
import { CampaignService } from '@/lib/campaigns/campaign-service'

describe('CampaignService Integration', () => {
  const campaignService = new CampaignService(testDb)
  
  beforeEach(async () => {
    await dbHelpers.cleanupTestData()
  })
  
  it('creates campaign with sequences', async () => {
    // Create test data
    const { user } = await dbHelpers.createTestUser()
    const workspace = await dbHelpers.createTestWorkspace(user.id)
    
    // Test campaign creation
    const campaign = await campaignService.createCampaign({
      workspace_id: workspace.id,
      user_id: user.id,
      name: 'Test Campaign',
      sequences: [
        { subject: 'Initial Email', body: 'Hello', delay_days: 0 },
        { subject: 'Follow Up', body: 'Following up', delay_days: 3 },
      ],
    })
    
    // Verify campaign
    expect(campaign.id).toBeDefined()
    expect(campaign.name).toBe('Test Campaign')
    
    // Verify sequences
    const sequences = await campaignService.getCampaignSequences(campaign.id)
    expect(sequences).toHaveLength(2)
    expect(sequences[0].subject).toBe('Initial Email')
    expect(sequences[1].delay_days).toBe(3)
  })
  
  it('enforces workspace limits', async () => {
    const { user } = await dbHelpers.createTestUser()
    const workspace = await dbHelpers.createTestWorkspace(user.id, {
      plan: 'free',
      settings: { campaign_limit: 1 },
    })
    
    // Create first campaign (should succeed)
    await campaignService.createCampaign({
      workspace_id: workspace.id,
      user_id: user.id,
      name: 'Campaign 1',
    })
    
    // Create second campaign (should fail)
    await expect(
      campaignService.createCampaign({
        workspace_id: workspace.id,
        user_id: user.id,
        name: 'Campaign 2',
      })
    ).rejects.toThrow('Campaign limit reached')
  })
})
```

### API Integration Tests
```typescript
import { ApiTestClient } from '@/__tests__/utils/api'
import { dbHelpers } from '@/__tests__/utils/db'
import { server } from '@/mocks/server'

describe('Campaign API Integration', () => {
  const api = new ApiTestClient()
  let authToken: string
  let workspace: any
  
  beforeAll(async () => {
    // Start MSW server
    server.listen()
    
    // Create test user and get auth token
    const { user } = await dbHelpers.createTestUser()
    authToken = user.access_token
    workspace = await dbHelpers.createTestWorkspace(user.id)
    
    api.setAuth(authToken)
  })
  
  afterAll(() => {
    server.close()
  })
  
  it('completes full campaign workflow', async () => {
    // 1. Create campaign
    const createResponse = await api.post('/api/campaigns', {
      name: 'Integration Test Campaign',
      workspace_id: workspace.id,
    })
    
    expect(createResponse.status).toBe(201)
    const campaign = createResponse.data
    
    // 2. Add sequences
    const sequenceResponse = await api.post(
      `/api/campaigns/${campaign.id}/sequences`,
      {
        sequences: [
          { subject: 'Email 1', body: 'Content 1', delay_days: 0 },
          { subject: 'Email 2', body: 'Content 2', delay_days: 3 },
        ],
      }
    )
    
    expect(sequenceResponse.status).toBe(201)
    
    // 3. Import leads
    const leads = await api.post('/api/leads/import', {
      workspace_id: workspace.id,
      leads: [
        { email: 'test1@example.com', first_name: 'Test', last_name: 'One' },
        { email: 'test2@example.com', first_name: 'Test', last_name: 'Two' },
      ],
    })
    
    expect(leads.status).toBe(201)
    
    // 4. Add leads to campaign
    const addLeadsResponse = await api.post(
      `/api/campaigns/${campaign.id}/leads`,
      { lead_ids: leads.data.ids }
    )
    
    expect(addLeadsResponse.status).toBe(200)
    
    // 5. Start campaign
    const startResponse = await api.patch(
      `/api/campaigns/${campaign.id}`,
      { status: 'active' }
    )
    
    expect(startResponse.status).toBe(200)
    expect(startResponse.data.status).toBe('active')
    
    // 6. Check campaign stats
    const statsResponse = await api.get(
      `/api/analytics/campaign/${campaign.id}`
    )
    
    expect(statsResponse.status).toBe(200)
    expect(statsResponse.data.metrics).toBeDefined()
  })
})
```

## Writing E2E Tests

### Basic E2E Test
```typescript
import { test, expect } from '@playwright/test'

test.describe('User Registration', () => {
  test('new user can sign up and access dashboard', async ({ page }) => {
    // Go to signup page
    await page.goto('/signup')
    
    // Fill signup form
    await page.fill('input[name="email"]', 'newuser@example.com')
    await page.fill('input[name="password"]', 'SecurePassword123!')
    await page.fill('input[name="fullName"]', 'New User')
    
    // Submit form
    await page.click('button[type="submit"]')
    
    // Should redirect to email verification
    await expect(page).toHaveURL('/signup/verify-email')
    await expect(page.locator('h1')).toContainText('Verify your email')
    
    // Simulate email verification (in real test, would click link in email)
    await page.goto('/auth/confirm?token=test-token')
    
    // Should redirect to dashboard
    await expect(page).toHaveURL('/dashboard')
    await expect(page.locator('h1')).toContainText('Welcome')
  })
})
```

### E2E Test with Fixtures
```typescript
import { test, expect } from '@/e2e/fixtures/auth'

test.describe('Campaign Management', () => {
  test('create and launch campaign', async ({ authenticatedPage }) => {
    // Navigate to campaigns
    await authenticatedPage.goto('/campaigns')
    
    // Create new campaign
    await authenticatedPage.click('text=New Campaign')
    
    // Fill campaign details
    await authenticatedPage.fill('input[name="name"]', 'E2E Test Campaign')
    await authenticatedPage.fill('input[name="subject"]', 'Test Subject')
    await authenticatedPage.fill('textarea[name="body"]', 'Test email body')
    
    // Add sequence
    await authenticatedPage.click('text=Add Sequence')
    await authenticatedPage.fill(
      'input[name="sequences.1.subject"]',
      'Follow up'
    )
    
    // Save campaign
    await authenticatedPage.click('button:has-text("Save Campaign")')
    
    // Verify campaign created
    await expect(authenticatedPage.locator('h1')).toContainText('E2E Test Campaign')
    
    // Add leads
    await authenticatedPage.click('text=Add Leads')
    await authenticatedPage.click('text=Import CSV')
    
    const fileInput = await authenticatedPage.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: 'leads.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(
        'email,name\ntest@example.com,Test User\n'
      ),
    })
    
    await authenticatedPage.click('button:has-text("Import")')
    
    // Launch campaign
    await authenticatedPage.click('button:has-text("Launch Campaign")')
    await authenticatedPage.click('button:has-text("Confirm")')
    
    // Verify campaign is active
    await expect(
      authenticatedPage.locator('[data-testid="campaign-status"]')
    ).toContainText('Active')
  })
})
```

### Visual Regression Test
```typescript
import { test } from '@playwright/test'
import { visualRegressionHelpers } from '@/e2e/helpers/visual-regression'

test.describe('Visual Regression', () => {
  test('dashboard layout', async ({ page }) => {
    await page.goto('/dashboard')
    
    // Test responsive design
    await visualRegressionHelpers.testResponsive(
      page,
      '/dashboard',
      'dashboard'
    )
    
    // Test dark mode
    await visualRegressionHelpers.testDarkMode(page, 'dashboard')
  })
  
  test('campaign builder', async ({ page }) => {
    await page.goto('/campaigns/new')
    
    // Test form states
    await visualRegressionHelpers.testFormStates(
      page,
      'form[data-testid="campaign-form"]',
      'campaign-form'
    )
    
    // Test hover states
    await visualRegressionHelpers.testHoverStates(page, [
      { selector: 'button[type="submit"]', name: 'submit-button' },
      { selector: '[data-testid="add-sequence"]', name: 'add-sequence' },
    ])
  })
})
```

## Testing Best Practices

### 1. Use Test IDs
Add `data-testid` attributes for reliable element selection:
```tsx
<button data-testid="submit-campaign" type="submit">
  Save Campaign
</button>
```

### 2. Wait for Elements
Always wait for elements before interacting:
```typescript
// Good
await page.waitForSelector('[data-testid="lead-table"]')
await page.click('[data-testid="import-leads"]')

// Bad
await page.click('[data-testid="import-leads"]') // May not be ready
```

### 3. Mock External Services
```typescript
beforeAll(() => {
  server.use(
    http.post('https://api.stripe.com/*', () => {
      return HttpResponse.json({ id: 'test_customer_id' })
    })
  )
})
```

### 4. Clean Up After Tests
```typescript
afterEach(async () => {
  await cleanup() // React Testing Library
  await dbHelpers.cleanupTestData() // Database
  jest.clearAllMocks() // Mock functions
})
```

### 5. Test Error States
```typescript
it('handles network errors gracefully', async () => {
  server.use(
    http.get('/api/campaigns', () => {
      return HttpResponse.error()
    })
  )
  
  render(<CampaignList />)
  
  await waitFor(() => {
    expect(screen.getByText('Failed to load campaigns')).toBeInTheDocument()
  })
})
```

## Debugging Tests

### Debug Unit Tests
```typescript
// Add console logs
it('complex calculation', () => {
  const result = calculatePrice(items)
  console.log('Result:', result)
  expect(result).toBe(150)
})

// Use debug from React Testing Library
const { debug } = render(<Component />)
debug() // Prints DOM
```

### Debug E2E Tests
```typescript
// Pause execution
await page.pause()

// Take screenshot
await page.screenshot({ path: 'debug.png' })

// Slow down execution
test.use({ 
  launchOptions: { slowMo: 1000 }
})
```

### Common Issues and Solutions

1. **Async Issues**
   ```typescript
   // Problem: Test finishes before async operation
   it('loads data', () => {
     render(<DataList />)
     expect(screen.getByText('Item 1')).toBeInTheDocument() // Fails
   })
   
   // Solution: Wait for element
   it('loads data', async () => {
     render(<DataList />)
     await waitFor(() => {
       expect(screen.getByText('Item 1')).toBeInTheDocument()
     })
   })
   ```

2. **State Not Updating**
   ```typescript
   // Problem: State doesn't update in test
   fireEvent.click(button)
   expect(screen.getByText('Updated')).toBeInTheDocument() // Fails
   
   // Solution: Use act for state updates
   await act(async () => {
     fireEvent.click(button)
   })
   expect(screen.getByText('Updated')).toBeInTheDocument()
   ```

3. **Test Isolation**
   ```typescript
   // Problem: Tests affect each other
   // Solution: Clean up properly
   beforeEach(() => {
     jest.clearAllMocks()
     localStorage.clear()
     sessionStorage.clear()
   })
   ```