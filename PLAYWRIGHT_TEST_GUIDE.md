# 🎭 Playwright Testing Guide for ColdCopy

## Quick Start

### 1. Install Dependencies
```bash
npm install
npx playwright install  # Install browsers
```

### 2. Run Tests

#### Quick Tests (Individual Scripts)
```bash
# Quick platform check
npm run test:quick

# Test admin login only
npm run test:admin

# Full platform test
npm run test:full
```

#### Playwright Test Suite
```bash
# Run all tests
npm run test:e2e

# Run tests with UI (recommended for debugging)
npm run test:e2e:ui

# Run specific test file
npx playwright test tests/e2e/auth.spec.ts

# Run tests in headed mode (see browser)
npm run test:e2e:headed

# Debug mode (step through tests)
npm run test:e2e:debug
```

## Test Structure

```
tests/
├── e2e/                    # End-to-end tests
│   ├── auth.spec.ts       # Authentication tests
│   ├── dashboard.spec.ts  # Dashboard navigation
│   └── campaigns.spec.ts  # Campaign management
├── helpers/               # Test utilities
│   ├── test-utils.ts     # Reusable functions
│   └── custom-reporter.ts # Custom reporting
├── visual/               # Visual regression tests
└── api/                  # API tests
```

## Key Test Scenarios

### Authentication Tests (`auth.spec.ts`)
- ✅ Admin login with valid credentials
- ✅ Error handling for invalid credentials
- ✅ Session persistence after refresh
- ✅ Logout functionality
- ✅ Signup flow and validation
- ✅ Password reset navigation
- ✅ Protected route access

### Dashboard Tests (`dashboard.spec.ts`)
- ✅ Navigation to all sections
- ✅ Demo content verification
- ✅ User menu functionality
- ✅ Performance monitoring
- ✅ API health checks

### Campaign Tests (`campaigns.spec.ts`)
- ✅ Campaign list display
- ✅ Create new campaign
- ✅ AI email generation
- ✅ Campaign preview
- ✅ Lead assignment
- ✅ Campaign analytics

## Test Credentials

```javascript
// Admin (working)
email: 'jaspervanmoose@gmail.com'
password: 'okkenbollen33'

// Test user (for new signups)
email: 'test.user.{timestamp}@example.com'
password: 'TestPassword123!'
```

## Debugging Failed Tests

### 1. Check Screenshots
Failed tests automatically capture screenshots in `test-artifacts/`

### 2. View Test Reports
```bash
# Open HTML report
npx playwright show-report

# Check JSON report
cat test-results/results.json
```

### 3. Run Single Test in Debug Mode
```bash
npx playwright test tests/e2e/auth.spec.ts:15 --debug
```

### 4. Use UI Mode
```bash
npm run test:e2e:ui
```
- See tests run in real-time
- Time travel through test steps
- Inspect DOM at each step

## Writing New Tests

### Basic Test Structure
```typescript
import { test, expect } from '@playwright/test';
import { TestHelpers } from '../helpers/test-utils';

test.describe('Feature Name', () => {
  let helpers: TestHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page);
    await helpers.loginAsAdmin();
  });

  test('should do something', async ({ page }) => {
    await helpers.navigateTo('campaigns');
    await expect(page).toHaveURL(/.*campaigns/);
    
    // Your test logic here
  });
});
```

### Using Test Helpers
```typescript
// Login
await helpers.loginAsAdmin();
await helpers.login(email, password);

// Navigation
await helpers.navigateTo('leads');

// Error checking
const errors = await helpers.checkForErrors();

// Screenshots
await helpers.screenshot('test-name');

// API calls
const response = await helpers.callAPI('/api/health');

// Performance
const metrics = await helpers.measurePerformance();
```

## CI/CD Integration

Add to GitHub Actions:
```yaml
- name: Install Playwright
  run: |
    npm ci
    npx playwright install --with-deps

- name: Run Playwright tests
  run: npm run test:e2e
  env:
    BASE_URL: ${{ secrets.BASE_URL }}

- name: Upload test results
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: playwright-report
    path: test-results/
```

## Common Issues

### Tests Timing Out
- Increase timeout in test: `test.setTimeout(60000)`
- Check network conditions
- Verify site is accessible

### Login Fails
- Verify credentials are correct
- Check for email verification requirements
- Ensure test user has proper permissions

### 404/500 Errors
- Normal for some resources
- Focus on core functionality
- Check API health endpoints

## Best Practices

1. **Use Page Objects**: Create reusable page components
2. **Explicit Waits**: Use `waitForLoadState()` and `waitForSelector()`
3. **Meaningful Assertions**: Add custom error messages
4. **Clean Test Data**: Generate unique test data with timestamps
5. **Parallel Execution**: Tests run in parallel by default
6. **Retry Logic**: Configure retries for flaky tests

## Monitoring & Reporting

The custom reporter generates:
- Detailed test summaries
- Performance metrics
- Error categorization
- Actionable recommendations
- JSON reports for analysis

Reports are saved in `test-results/` with timestamps.

---

Happy Testing! 🚀