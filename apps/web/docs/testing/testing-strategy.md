# ColdCopy Testing Strategy

## Overview

Our testing strategy is designed to ensure high code quality, catch bugs early, and maintain confidence in our codebase. We follow a testing pyramid approach with a strong foundation of unit tests, supported by integration tests, and validated with end-to-end tests.

## Testing Pyramid

```
         /\
        /E2E\
       /------\
      /  INT   \
     /----------\
    /    UNIT    \
   /--------------\
```

### 1. Unit Tests (70%)
- Fast, isolated tests for individual functions and components
- Mock external dependencies
- Test business logic and edge cases
- Run on every commit

### 2. Integration Tests (20%)
- Test interactions between components
- Verify API endpoints with database
- Test service integrations
- Run on pull requests

### 3. End-to-End Tests (10%)
- Test complete user workflows
- Verify critical paths
- Visual regression testing
- Run before deployment

## What to Test

### Components
- **Rendering**: Component renders without errors
- **Props**: Component responds to prop changes
- **State**: State updates trigger correct re-renders
- **Events**: User interactions work correctly
- **Accessibility**: ARIA attributes and keyboard navigation

Example:
```typescript
describe('CampaignCard', () => {
  it('renders campaign details', () => {})
  it('handles click events', () => {})
  it('shows correct status badge', () => {})
  it('is keyboard accessible', () => {})
})
```

### API Routes
- **Success Cases**: Returns correct data and status
- **Error Handling**: Handles invalid input gracefully
- **Authentication**: Enforces access control
- **Validation**: Validates request data
- **Rate Limiting**: Respects rate limits

Example:
```typescript
describe('POST /api/campaigns', () => {
  it('creates campaign with valid data', () => {})
  it('returns 400 for invalid data', () => {})
  it('returns 401 for unauthenticated requests', () => {})
  it('returns 429 when rate limited', () => {})
})
```

### Business Logic
- **Calculations**: Verify formulas and algorithms
- **Data Transformation**: Test data mapping and formatting
- **Validation Rules**: Ensure business rules are enforced
- **Error Scenarios**: Handle edge cases gracefully

Example:
```typescript
describe('EmailScheduler', () => {
  it('respects daily send limits', () => {})
  it('skips weekends when configured', () => {})
  it('handles timezone conversions', () => {})
  it('pauses on bounce threshold', () => {})
})
```

## Testing Guidelines

### 1. Test Naming Convention
Use descriptive names that explain what is being tested:
```typescript
// Good
it('should display error message when email is invalid')

// Bad
it('test email validation')
```

### 2. AAA Pattern
Structure tests with Arrange, Act, Assert:
```typescript
it('should update lead status', async () => {
  // Arrange
  const lead = await createTestLead({ status: 'active' })
  
  // Act
  const updated = await updateLeadStatus(lead.id, 'unsubscribed')
  
  // Assert
  expect(updated.status).toBe('unsubscribed')
})
```

### 3. Test Data
Use factories for consistent test data:
```typescript
const campaign = factories.campaign.create({
  status: 'active',
  settings: {
    daily_limit: 100
  }
})
```

### 4. Mocking
Mock external dependencies:
```typescript
jest.mock('@/lib/email/ses-client', () => ({
  sendEmail: jest.fn().mockResolvedValue({ messageId: 'test-123' })
}))
```

### 5. Async Testing
Handle promises and async operations properly:
```typescript
// Use async/await
it('fetches user data', async () => {
  const user = await fetchUser('123')
  expect(user.email).toBe('test@example.com')
})

// Or return promises
it('fetches user data', () => {
  return fetchUser('123').then(user => {
    expect(user.email).toBe('test@example.com')
  })
})
```

## Coverage Requirements

### Minimum Coverage Thresholds
- **Statements**: 70%
- **Branches**: 70%
- **Functions**: 70%
- **Lines**: 70%

### Priority Areas (90%+ coverage)
- Authentication logic
- Billing calculations
- Email sending logic
- Data validation
- Security functions

### Acceptable Lower Coverage (50%+)
- UI utility functions
- Simple getters/setters
- Configuration files
- Type definitions

## Test Organization

### File Structure
```
src/
├── components/
│   └── Button/
│       ├── Button.tsx
│       └── Button.test.tsx
├── lib/
│   └── email/
│       ├── sender.ts
│       └── __tests__/
│           └── sender.test.ts
```

### Test Suites
Group related tests:
```typescript
describe('EmailSender', () => {
  describe('sendCampaignEmail', () => {
    it('sends email successfully', () => {})
    it('tracks email in database', () => {})
    it('handles SES errors', () => {})
  })
  
  describe('sendTransactionalEmail', () => {
    it('bypasses campaign limits', () => {})
    it('uses high priority queue', () => {})
  })
})
```

## Performance Testing

### Load Testing
- Test API endpoints under load
- Verify database query performance
- Check memory usage
- Monitor response times

### Optimization Tests
```typescript
it('paginates large result sets', async () => {
  // Create 1000 leads
  await factories.lead.createMany(1000)
  
  const response = await api.get('/api/leads?limit=50')
  expect(response.data.length).toBe(50)
  expect(response.headers['x-response-time']).toBeLessThan(200)
})
```

## Security Testing

### Authentication Tests
```typescript
describe('Authentication', () => {
  it('blocks unauthenticated requests', () => {})
  it('validates JWT tokens', () => {})
  it('enforces workspace permissions', () => {})
  it('prevents CSRF attacks', () => {})
})
```

### Input Validation
```typescript
describe('Input Validation', () => {
  it('sanitizes HTML in email content', () => {})
  it('prevents SQL injection', () => {})
  it('validates file uploads', () => {})
  it('enforces rate limits', () => {})
})
```

## Continuous Integration

### Pre-commit Hooks
- Run unit tests for changed files
- Lint and format code
- Check types

### Pull Request Checks
1. All unit tests pass
2. Integration tests pass
3. Coverage thresholds met
4. No security vulnerabilities
5. Performance benchmarks pass

### Deployment Pipeline
1. Run full test suite
2. E2E tests on staging
3. Visual regression tests
4. Performance tests
5. Security scan

## Testing Tools

### Development
- **Jest**: Test runner
- **React Testing Library**: Component testing
- **MSW**: API mocking
- **Faker.js**: Test data

### CI/CD
- **GitHub Actions**: Automated testing
- **Codecov**: Coverage reporting
- **Playwright**: E2E testing
- **Lighthouse**: Performance testing

### Monitoring
- **Sentry**: Error tracking
- **DataDog**: Performance monitoring
- **LogRocket**: Session replay
- **Bugsnag**: Bug reporting

## Test Maintenance

### Regular Reviews
- Monthly test suite performance review
- Quarterly coverage analysis
- Remove obsolete tests
- Update test data

### Flaky Test Protocol
1. Identify flaky tests through CI logs
2. Add to quarantine list
3. Fix within 1 sprint
4. Monitor for 1 week after fix

### Test Refactoring
- Keep tests DRY with shared utilities
- Extract common setup
- Update tests with code changes
- Remove duplicate tests