# ColdCopy Testing Documentation

## Overview

ColdCopy uses a comprehensive testing strategy to ensure code quality and reliability. Our testing infrastructure includes unit tests, integration tests, and end-to-end tests.

## Testing Stack

- **Jest**: Unit and integration testing
- **React Testing Library**: Component testing
- **Playwright**: End-to-end testing
- **Mock Service Worker (MSW)**: API mocking
- **Faker.js**: Test data generation

## Test Structure

```
__tests__/
├── setup/              # Test setup and configuration
│   └── test-db-setup.ts
├── utils/              # Test utilities and helpers
│   ├── api.ts         # API testing utilities
│   ├── auth.ts        # Authentication helpers
│   ├── db.ts          # Database helpers
│   └── factories.ts   # Data factories
└── integration/       # Integration tests

e2e/
├── fixtures/          # Playwright fixtures
├── helpers/           # E2E test helpers
└── tests/            # E2E test suites

src/
├── components/
│   └── __tests__/    # Component unit tests
├── lib/
│   └── __tests__/    # Library unit tests
└── mocks/            # MSW mock handlers
```

## Running Tests

### All Tests
```bash
npm test
```

### Unit Tests
```bash
npm run test:unit
```

### Integration Tests
```bash
npm run test:integration
```

### E2E Tests
```bash
npm run test:e2e
```

### Test Coverage
```bash
npm run test:coverage
```

### Watch Mode
```bash
npm run test:watch
```

## Test Database Setup

Before running integration tests, set up the test database:

```bash
npm run test:db:setup
```

Clean the test database:

```bash
npm run test:db:clean
```

## Environment Variables

Create a `.env.test` file with test-specific environment variables:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54322
NEXT_PUBLIC_SUPABASE_ANON_KEY=test-anon-key
SUPABASE_SERVICE_ROLE_KEY=test-service-role-key
```

## Writing Tests

### Unit Tests

```typescript
import { render, screen } from '@testing-library/react'
import { Button } from '@/components/ui/button'

describe('Button', () => {
  it('renders with text', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByText('Click me')).toBeInTheDocument()
  })
})
```

### Integration Tests

```typescript
import { dbHelpers } from '@/__tests__/utils/db'
import { createCampaign } from '@/lib/campaigns'

describe('Campaign Creation', () => {
  beforeEach(async () => {
    await dbHelpers.cleanupTestData()
  })

  it('creates a campaign with sequences', async () => {
    const user = await dbHelpers.createTestUser()
    const workspace = await dbHelpers.createTestWorkspace(user.id)
    
    const campaign = await createCampaign({
      name: 'Test Campaign',
      workspace_id: workspace.id,
      user_id: user.id,
    })
    
    expect(campaign).toHaveProperty('id')
    expect(campaign.name).toBe('Test Campaign')
  })
})
```

### E2E Tests

```typescript
import { test, expect } from '@/e2e/fixtures/auth'

test('user can create a campaign', async ({ authenticatedPage }) => {
  // Navigate to campaigns
  await authenticatedPage.goto('/campaigns')
  
  // Click new campaign button
  await authenticatedPage.click('text=New Campaign')
  
  // Fill in campaign details
  await authenticatedPage.fill('input[name="name"]', 'Test Campaign')
  await authenticatedPage.fill('textarea[name="subject"]', 'Test Subject')
  
  // Submit form
  await authenticatedPage.click('button[type="submit"]')
  
  // Verify campaign was created
  await expect(authenticatedPage).toHaveURL(/\/campaigns\/[a-z0-9-]+/)
  await expect(authenticatedPage.locator('h1')).toContainText('Test Campaign')
})
```

## API Mocking

Use MSW to mock API responses in tests:

```typescript
import { server } from '@/mocks/server'
import { http, HttpResponse } from 'msw'

test('handles API errors', async () => {
  // Override the default handler
  server.use(
    http.get('/api/campaigns', () => {
      return HttpResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    })
  )
  
  // Test error handling
  const response = await fetch('/api/campaigns')
  expect(response.status).toBe(500)
})
```

## Test Data Generation

Use factories to generate test data:

```typescript
import { factories } from '@/__tests__/utils/factories'

const campaign = factories.campaign.create({
  name: 'Custom Campaign',
  status: 'active',
})

const leads = factories.lead.createMany(10, {
  status: 'active',
})
```

## Visual Regression Testing

Use Playwright for visual regression testing:

```typescript
import { visualRegressionHelpers } from '@/e2e/helpers/visual-regression'

test('dashboard layout', async ({ page }) => {
  await page.goto('/dashboard')
  await visualRegressionHelpers.takeScreenshot(page, 'dashboard', {
    fullPage: true,
  })
})
```

## CI/CD Integration

Tests run automatically on:
- Pull requests
- Commits to main branch
- Pre-deployment

GitHub Actions workflow example:

```yaml
name: Test
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run test:unit
      - run: npm run test:integration
      - run: npx playwright install
      - run: npm run test:e2e
```

## Best Practices

1. **Test Isolation**: Each test should be independent
2. **Use Factories**: Generate test data consistently
3. **Mock External Services**: Use MSW for API mocking
4. **Test User Flows**: Focus on real user scenarios
5. **Clean Up**: Always clean up test data
6. **Descriptive Names**: Use clear test descriptions
7. **AAA Pattern**: Arrange, Act, Assert
8. **Test Coverage**: Aim for 70%+ coverage

## Debugging Tests

### Jest Tests
```bash
# Run specific test file
npm test -- Button.test.tsx

# Run tests matching pattern
npm test -- --testNamePattern="should render"

# Debug mode
node --inspect-brk node_modules/.bin/jest --runInBand
```

### Playwright Tests
```bash
# Debug mode
npm run test:e2e -- --debug

# UI mode
npm run test:e2e:ui

# Headed mode
npm run test:e2e -- --headed
```

## Common Issues

### Test Database Connection
- Ensure Supabase is running locally
- Check `.env.test` configuration
- Run `npm run test:db:setup`

### Flaky Tests
- Add proper waits for async operations
- Use `waitFor` for dynamic content
- Check for race conditions

### Memory Leaks
- Clean up event listeners
- Cancel subscriptions
- Clear timers