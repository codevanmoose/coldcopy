# ColdCopy E2E Test Suite

Comprehensive end-to-end test suite for ColdCopy's critical user journeys using Playwright.

## Overview

This test suite covers the most critical user flows in ColdCopy, ensuring reliability and performance across different browsers and devices. The tests are designed using the Page Object Model pattern for maintainability and include visual regression testing, accessibility testing, and performance monitoring.

## Test Structure

### 📁 Directory Structure
```
e2e/
├── fixtures/           # Test data and authentication setup
├── helpers/           # Utility functions and helpers
├── pages/            # Page Object Model classes
├── tests/            # Test specifications
└── README.md         # This file
```

### 🧪 Test Suites

#### 1. User Registration & Onboarding (`user-registration.spec.ts`)
- **Sign Up Flow**: Email validation, password strength, terms acceptance
- **Email Verification**: Valid/invalid codes, resend functionality
- **Onboarding Process**: Workspace setup, profile completion, trial setup
- **Payment Integration**: Payment method addition, validation
- **Visual & Accessibility**: Responsive design, keyboard navigation

#### 2. Campaign Creation & Execution (`campaign-flow.spec.ts`)
- **Campaign Management**: Create, edit, delete campaigns
- **Lead Import**: CSV upload, validation, column mapping
- **AI Email Generation**: Content generation, tone/length options
- **Sequence Building**: Multi-step sequences, delays, personalization
- **Campaign Launch**: Settings configuration, real-time monitoring
- **Performance Tracking**: Analytics, delivery rates, engagement metrics

#### 3. Billing & Subscription Flow (`billing-flow.spec.ts`)
- **Trial Management**: Trial status, upgrade flows, extensions
- **Plan Changes**: Upgrades, downgrades, billing cycle changes
- **Payment Methods**: Add, edit, delete, set default
- **Invoice Management**: View, download, payment failures
- **Usage Monitoring**: Limits, overages, alerts
- **Subscription Lifecycle**: Cancellation, reactivation, retention

#### 4. GDPR Compliance Journey (`gdpr-flow.spec.ts`)
- **Cookie Consent**: Banner display, preferences, persistence
- **Data Rights**: Export requests, deletion requests, consent withdrawal
- **Unsubscribe Flow**: Email unsubscribe, selective preferences
- **Privacy Controls**: Settings management, consent tracking
- **Admin Tools**: GDPR request management, compliance monitoring

#### 5. Lead Management Workflow (`lead-management.spec.ts`)
- **Lead Import**: CSV processing, validation, duplicate handling
- **Data Enrichment**: Provider integration, field selection, results
- **Manual Editing**: Individual lead updates, validation
- **Bulk Operations**: Mass updates, deletions, status changes
- **Search & Filtering**: Advanced filters, saved searches
- **Data Export**: Multiple formats, field selection

#### 6. Email Campaign Performance (`email-performance.spec.ts`)
- **High-Volume Sending**: Rate limiting, queue management, optimization
- **Delivery Tracking**: Real-time status, bounce categorization
- **Engagement Analytics**: Opens, clicks, replies, geographic breakdown
- **Performance Optimization**: Send time optimization, content suggestions
- **Compliance Monitoring**: Bounce handling, complaint management

## 🏗️ Architecture

### Page Object Model
Each page/component has a dedicated Page Object class that encapsulates:
- Element selectors
- Action methods
- Validation helpers
- Data retrieval methods

```typescript
// Example usage
const campaignPage = new CampaignPage(page)
await campaignPage.createCampaign({
  name: 'Test Campaign',
  description: 'E2E test campaign',
  type: 'email_sequence'
})
await campaignPage.expectCampaignCreated()
```

### Test Data Factory
Centralized test data generation using Faker.js:

```typescript
import { TestDataFactory } from '../fixtures/test-data'

const testUser = TestDataFactory.createUser()
const testCampaign = TestDataFactory.createCampaign()
const csvData = TestDataFactory.createCSVLeadsData(1000)
```

### Visual Regression Testing
Automated screenshot comparison for UI consistency:

```typescript
await visualRegressionHelpers.takeScreenshot(page, 'campaign-dashboard')
await visualRegressionHelpers.testResponsive(page, '/campaigns', 'campaigns-responsive')
```

## 🚀 Running Tests

### Prerequisites
```bash
npm install
npx playwright install
```

### Run All Tests
```bash
npm run test:e2e
```

### Run Specific Test Suite
```bash
npx playwright test user-registration.spec.ts
npx playwright test campaign-flow.spec.ts
npx playwright test billing-flow.spec.ts
npx playwright test gdpr-flow.spec.ts
npx playwright test lead-management.spec.ts
npx playwright test email-performance.spec.ts
```

### Run Tests in Different Browsers
```bash
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

### Run Tests on Mobile
```bash
npx playwright test --project="Mobile Chrome"
npx playwright test --project="Mobile Safari"
```

### Debug Mode
```bash
npx playwright test --debug
npx playwright test --headed
```

### Generate Test Report
```bash
npx playwright show-report
```

## 🔧 Configuration

### Playwright Config (`playwright.config.ts`)
- **Multi-browser testing**: Chrome, Firefox, Safari
- **Mobile testing**: iOS and Android viewports
- **Visual regression**: Screenshot comparison
- **Parallel execution**: Optimized for CI/CD
- **Retry logic**: Automatic retries on failures
- **Reporting**: HTML, JSON, JUnit formats

### Environment Variables
```bash
PLAYWRIGHT_BASE_URL=http://localhost:3000
TEST_USER_EMAIL=test@example.com
TEST_USER_PASSWORD=password123
CI=true  # Enables CI-specific settings
```

## 📊 Test Coverage

### Critical User Journeys
- ✅ User onboarding (signup → verification → setup)
- ✅ Campaign creation and execution
- ✅ Lead management and enrichment
- ✅ Billing and subscription management
- ✅ GDPR compliance workflows
- ✅ Email performance monitoring

### Cross-Browser Testing
- ✅ Chrome/Chromium
- ✅ Firefox
- ✅ Safari/WebKit
- ✅ Mobile Chrome
- ✅ Mobile Safari

### Test Types
- ✅ Functional testing
- ✅ Visual regression testing
- ✅ Accessibility testing
- ✅ Performance testing
- ✅ Mobile responsiveness
- ✅ API integration testing

## 🎯 Best Practices

### Test Organization
- **Single Responsibility**: Each test focuses on one scenario
- **Descriptive Names**: Clear test and describe block naming
- **Setup/Teardown**: Proper test isolation and cleanup
- **Data Independence**: Tests don't depend on each other

### Reliability
- **Wait Strategies**: Proper waiting for elements and network requests
- **Error Handling**: Graceful handling of test failures
- **Retry Logic**: Automatic retries for flaky tests
- **Assertions**: Clear and specific assertions

### Maintainability
- **Page Object Model**: Centralized element management
- **Test Data Factory**: Reusable test data generation
- **Helper Functions**: Common operations abstracted
- **Documentation**: Clear comments and documentation

## 🐛 Debugging

### Common Issues
1. **Element Not Found**: Check selectors and wait conditions
2. **Timing Issues**: Increase timeouts or add explicit waits
3. **Network Failures**: Mock API responses in tests
4. **Visual Regression Failures**: Update screenshots if UI changed

### Debug Tools
```bash
# Run with browser visible
npx playwright test --headed

# Run in debug mode with DevTools
npx playwright test --debug

# Generate trace files
npx playwright test --trace on

# Record test execution
npx playwright codegen http://localhost:3000
```

### Screenshots and Videos
- Screenshots on failure: `test-results/`
- Video recordings: `test-results/`
- Trace files: `test-results/`

## 📈 Performance Testing

### Metrics Tracked
- **Page Load Times**: Initial page load performance
- **Action Response Times**: Form submissions, API calls
- **Large Dataset Handling**: Pagination, virtualization
- **Memory Usage**: Browser memory consumption
- **Network Traffic**: Request/response patterns

### Performance Assertions
```typescript
const startTime = Date.now()
await campaignPage.goToCampaigns()
const loadTime = Date.now() - startTime
expect(loadTime).toBeLessThan(3000) // 3 second threshold
```

## 🔒 Security Testing

### Areas Covered
- **Authentication**: Login/logout flows, session management
- **Authorization**: Role-based access control
- **Data Validation**: Input sanitization, XSS prevention
- **GDPR Compliance**: Data handling, consent management

## 🌐 Accessibility Testing

### Standards
- **WCAG 2.1 AA**: Web Content Accessibility Guidelines
- **Keyboard Navigation**: Tab order, focus management
- **Screen Reader Support**: ARIA labels, semantic HTML
- **Color Contrast**: Sufficient contrast ratios

### Automated Checks
```typescript
await authPage.checkAccessibility()
// Validates:
// - Missing alt text on images
// - Buttons without accessible names
// - Form inputs without labels
// - Proper ARIA attributes
```

## 🚀 CI/CD Integration

### GitHub Actions Example
```yaml
name: E2E Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npx playwright install
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: test-results
          path: test-results/
```

### Test Execution Strategy
- **Pull Requests**: Run critical path tests
- **Main Branch**: Run full test suite
- **Nightly**: Run extended performance tests
- **Release**: Run complete regression suite

## 📝 Contributing

### Adding New Tests
1. Create page objects for new components
2. Add test data factories for new entities
3. Write comprehensive test scenarios
4. Include visual regression tests
5. Add accessibility checks
6. Update documentation

### Test Guidelines
- Follow existing naming conventions
- Include setup and teardown
- Add meaningful assertions
- Test both happy path and error scenarios
- Consider edge cases and boundary conditions

## 📞 Support

For questions or issues with the test suite:
- Check existing test patterns and examples
- Review Playwright documentation
- Create issues for test failures or improvements
- Update tests when features change

---

**Last Updated**: December 2024
**Playwright Version**: Latest
**Node.js Version**: 18+