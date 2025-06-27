# HubSpot Integration Test Suite

This directory contains comprehensive tests for the HubSpot integration module, covering all major functionality with mocked API responses and edge cases.

## Test Coverage

### 1. Authentication Tests (`auth.test.ts`)
- **OAuth Flow**: Authorization URL generation, token exchange, refresh tokens
- **Integration Management**: Save, retrieve, delete integrations
- **Token Validation**: Expiry checks, auto-refresh, scope verification
- **Error Handling**: Invalid credentials, network errors, rate limiting

### 2. Contact Operations Tests (`contacts.test.ts`)
- **CRUD Operations**: Create, read, update, delete contacts
- **Batch Operations**: Bulk create/update with size limits and failure handling
- **Search & Filtering**: Complex queries, pagination, duplicate detection
- **Sync Operations**: Bidirectional sync between ColdCopy and HubSpot
- **Field Mapping**: Custom field transformations and nested properties
- **Deduplication**: Merge duplicate contacts, conflict resolution

### 3. Activity Logging Tests (`activities.test.ts`)
- **Email Activities**: Sent, opened, clicked, replied, bounced events
- **Call Activities**: Connected, missed, follow-up calls with recordings
- **Meeting Activities**: Scheduled meetings, multiple attendees
- **Custom Activities**: Website visits, form submissions, engagement scoring
- **Batch Logging**: Multiple activities with partial failures
- **Sync Status**: Track activity sync status and error recovery

### 4. Field Mapping Tests (`field-mapping.test.ts`)
- **Property Management**: Get HubSpot properties, create custom properties
- **Mapping CRUD**: Create, read, update, delete field mappings
- **Transform Functions**: Built-in transforms (capitalize, join, split, etc.)
- **Validation**: Property existence, read-only checks, type validation
- **Bulk Operations**: Create multiple mappings, default mapping templates
- **Nested Fields**: Deep object property mapping, array handling

### 5. Workflow Tests (`workflows.test.ts`)
- **Workflow Management**: Create, read, update, delete workflows
- **Enrollment**: Single and batch contact enrollment/unenrollment
- **Templates**: Pre-built workflow templates for common use cases
- **Triggers**: Campaign launch, lead status change, email engagement triggers
- **Analytics**: Performance metrics, comparison reports
- **Error Handling**: Validation errors, enrollment failures, state management

### 6. Webhook Processing Tests (`webhook-processor.test.ts`)
- **Signature Verification**: HMAC signature validation for security
- **Event Processing**: Contact, deal, company, engagement events
- **Error Handling**: Unknown events, missing integrations, API failures
- **Deduplication**: Skip duplicate events, retry failed processing
- **Logging**: Comprehensive webhook event logging and status tracking
- **Retry Logic**: Automatic retry with exponential backoff

### 7. Client & Rate Limiting Tests (`client.test.ts`, `rate-limiting.test.ts`)
- **HTTP Methods**: GET, POST, PATCH, DELETE with proper headers
- **Authentication**: Bearer token handling, automatic token refresh
- **Rate Limiting**: Daily, burst, and interval limits with queuing
- **Error Handling**: Network errors, API errors, validation errors
- **Retry Logic**: Exponential backoff, circuit breaker pattern
- **Request/Response**: Custom headers, query parameters, timeout handling

## Test Configuration

### Setup Files
- `setup.ts` - Global test configuration, mocks, and utilities
- `jest.config.js` - Jest configuration for HubSpot integration tests

### Test Utilities
The setup file provides several utility functions and mock data factories:

```typescript
// Mock data factories
createMockContact(overrides?)
createMockLead(overrides?)
createMockIntegration(overrides?)
createMockWebhookEvent(overrides?)
createMockFieldMapping(overrides?)

// HTTP response helpers
mockSuccessResponse(data, status?)
mockErrorResponse(error, status?)
mockRateLimitResponse(retryAfter?)

// Custom Jest matchers
expect(value).toBeValidUUID()
expect(value).toBeValidEmail()
expect(value).toBeValidUrl()
expect(value).toBeValidTimestamp()
```

## Running Tests

### Run All HubSpot Integration Tests
```bash
cd apps/web/src/lib/integrations/hubspot/__tests__
npm test
```

### Run Specific Test File
```bash
npm test auth.test.ts
npm test contacts.test.ts
npm test activities.test.ts
# etc.
```

### Run with Coverage
```bash
npm test -- --coverage
```

### Watch Mode
```bash
npm test -- --watch
```

## Test Scenarios Covered

### Success Scenarios
- ✅ Successful OAuth flow and token management
- ✅ Contact CRUD operations with field mapping
- ✅ Activity logging across all engagement types
- ✅ Workflow creation and enrollment automation
- ✅ Webhook processing with proper security validation
- ✅ Rate limiting with proactive throttling
- ✅ Batch operations with appropriate size limits

### Error Scenarios
- ❌ Invalid authentication credentials
- ❌ Expired/invalid tokens with refresh failures
- ❌ Rate limiting exceeded with retry mechanisms
- ❌ Network timeouts and connection failures
- ❌ Invalid webhook signatures
- ❌ Missing or malformed data validation
- ❌ API endpoint errors (4xx/5xx responses)
- ❌ Database connection and query failures

### Edge Cases
- 🔍 Large batch operations exceeding API limits
- 🔍 Duplicate contact/activity detection and merging
- 🔍 Webhook retry scenarios and deduplication
- 🔍 Complex field mapping with nested objects
- 🔍 Multiple workspace isolation and data segregation
- 🔍 Concurrent request handling and race conditions
- 🔍 Long-running workflow executions
- 🔍 Circuit breaker activation and recovery

## Test Data Management

### Mock Data Strategy
- **Realistic Data**: All test data mirrors real HubSpot API responses
- **Edge Cases**: Include boundary conditions and invalid data scenarios
- **Consistency**: Maintain consistent IDs and relationships across tests
- **Isolation**: Each test uses independent data to avoid interference

### Environment Variables
Tests use mock environment variables defined in `setup.ts`:
- `HUBSPOT_CLIENT_ID` - OAuth client ID
- `HUBSPOT_CLIENT_SECRET` - OAuth client secret
- `HUBSPOT_REDIRECT_URI` - OAuth callback URL
- `HUBSPOT_WEBHOOK_SECRET` - Webhook signature verification key

## Coverage Requirements

The test suite maintains high coverage standards:
- **Branches**: 80% minimum
- **Functions**: 80% minimum  
- **Lines**: 80% minimum
- **Statements**: 80% minimum

### Coverage Reports
- **Text**: Console output during test runs
- **LCOV**: Machine-readable format for CI/CD
- **HTML**: Detailed browser-viewable reports in `/coverage` directory

## Debugging Tests

### Debug Mode
Set environment variable for verbose logging:
```bash
DEBUG=hubspot:* npm test
```

### Test-Specific Debugging
Use `console.log` or debugger statements in tests, but ensure they're removed before committing.

### Mock Inspection
Access mock call history:
```typescript
expect(mockClient.post).toHaveBeenCalledWith(
  expectedUrl,
  expectedPayload
);
expect(mockClient.post).toHaveBeenCalledTimes(2);
```

## Integration with CI/CD

### GitHub Actions
Tests run automatically on:
- Pull request creation/updates
- Pushes to main branch
- Scheduled nightly runs

### Test Results
- Coverage reports uploaded to code coverage services
- Test results displayed in PR comments
- Failed tests block merge to main branch

### Performance Testing
- Rate limiting simulation with timing validation
- Large dataset processing performance benchmarks
- Memory usage monitoring for bulk operations

## Maintenance Guidelines

### Adding New Tests
1. Follow existing naming conventions (`feature.test.ts`)
2. Use descriptive test names that explain the scenario
3. Include both success and failure cases
4. Add edge cases and boundary conditions
5. Update this README with new test coverage

### Updating Existing Tests
1. Maintain backward compatibility with existing test data
2. Update mock responses to match current HubSpot API versions
3. Ensure all tests still pass after modifications
4. Update coverage requirements if new code paths added

### Test Refactoring
1. Extract common test utilities to shared helpers
2. Reduce test duplication through parameterized tests
3. Keep test files focused on single responsibility
4. Maintain clear separation between unit and integration tests

## Troubleshooting

### Common Issues

#### Mock Not Working
```typescript
// Ensure mocks are properly reset between tests
beforeEach(() => {
  jest.clearAllMocks();
});
```

#### Async Test Failures
```typescript
// Always await async operations
await expect(asyncFunction()).resolves.toEqual(expectedResult);
await expect(asyncFunction()).rejects.toThrow(ExpectedError);
```

#### Timer Issues
```typescript
// Use fake timers for time-dependent tests
jest.useFakeTimers();
jest.advanceTimersByTime(1000);
jest.useRealTimers();
```

#### Memory Leaks
```typescript
// Clean up subscriptions and timeouts in afterEach
afterEach(() => {
  jest.clearAllTimers();
  jest.restoreAllMocks();
});
```

For additional help or questions about the test suite, please refer to the main project documentation or create an issue in the repository.