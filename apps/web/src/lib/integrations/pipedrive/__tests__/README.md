# Pipedrive Integration Test Suite

Comprehensive test coverage for the Pipedrive integration in ColdCopy.

## Test Structure

### Unit Tests

1. **auth.test.ts** - Authentication and authorization
   - OAuth2 flow (authorization, token exchange, refresh)
   - API key authentication
   - Token management and encryption
   - Webhook signature verification
   - Session management

2. **client.test.ts** - API client functionality
   - Request building and authentication
   - Rate limiting (token bucket, sliding window)
   - Error handling and retries
   - Pagination handling
   - Response caching
   - Request queuing and batching

3. **persons.test.ts** - Person/Lead management
   - CRUD operations
   - Field mapping and custom fields
   - Bulk sync operations
   - Two-way synchronization
   - Data validation and sanitization
   - Webhook integration

4. **deal-management.test.ts** - Deal operations
   - Deal CRUD and lifecycle
   - Pipeline and stage management
   - Analytics and metrics
   - Activities and timeline
   - Custom fields
   - Automation and workflows
   - Bulk operations

5. **activity-timeline.test.ts** - Activity tracking
   - Activity creation (email, call, meeting, task)
   - Email event synchronization
   - Timeline retrieval and filtering
   - Activity updates and notes
   - Templates and workflows
   - Analytics and performance tracking

6. **webhooks.test.ts** - Webhook handling
   - Registration and management
   - Signature verification
   - Event processing
   - Deduplication
   - Error handling and retries
   - Monitoring and metrics

7. **bulk-sync.test.ts** - Large-scale synchronization
   - Initial sync
   - Incremental sync
   - Chunking and batching
   - Progress tracking
   - Performance optimization
   - Error recovery

8. **conflict-resolution.test.ts** - Conflict detection and resolution
   - Conflict detection algorithms
   - Resolution strategies (local wins, remote wins, merge)
   - Batch conflict resolution
   - Conflict prevention (optimistic locking)
   - History tracking and pattern analysis

### Integration Tests

9. **integration.test.ts** - End-to-end workflows
   - Complete setup flow
   - Lead to deal conversion
   - Campaign integration
   - Real-time bidirectional sync
   - Analytics integration
   - Error recovery scenarios
   - Security and compliance

### Performance Tests

10. **performance.test.ts** - Performance benchmarks
    - API call latency (p50, p95, p99)
    - Bulk sync throughput
    - Memory efficiency
    - Webhook processing speed
    - Search and filtering performance
    - Caching effectiveness
    - Resource optimization

## Running Tests

### Run all tests
```bash
npm test pipedrive
```

### Run specific test file
```bash
npm test pipedrive/auth
npm test pipedrive/bulk-sync
```

### Run with coverage
```bash
npm test pipedrive -- --coverage
```

### Run performance tests
```bash
npm test pipedrive/performance -- --testTimeout=30000
```

### Run integration tests
```bash
npm test pipedrive/integration -- --runInBand
```

## Test Configuration

Tests use mock implementations for external dependencies:
- Supabase client
- Redis client
- Fetch API

Configuration is provided through:
- `test-utils.ts` - Mock implementations and helpers
- `test.config.ts` - Test data and scenarios

## Performance Benchmarks

The test suite validates against these performance targets:

- **API Calls**:
  - p50: < 200ms
  - p95: < 500ms
  - p99: < 1000ms

- **Bulk Sync**:
  - Throughput: > 100 items/second
  - Memory usage: < 512MB
  - Concurrent requests: <= 10

- **Webhook Processing**:
  - Latency: < 100ms
  - Queue size: <= 1000
  - Retry attempts: <= 3

## Mock Data Generators

The test suite includes comprehensive mock data generators:

- `createMockPerson()` - Generate person/lead data
- `createMockDeal()` - Generate deal data
- `createMockActivity()` - Generate activity data
- `createMockOrganization()` - Generate organization data
- `createWebhookEvent()` - Generate webhook events
- `createBulkItems()` - Generate large datasets

## Test Scenarios

Pre-configured scenarios for different business sizes:

- **Small Business**: 100 persons, 50 deals, daily sync
- **Enterprise**: 10,000 persons, 5,000 deals, hourly sync
- **High Volume**: 100,000 persons, 50,000 deals, real-time sync

## Debugging Tests

### Enable verbose logging
```bash
DEBUG=pipedrive:* npm test
```

### Run single test
```bash
npm test -- -t "should create a person"
```

### Run tests in watch mode
```bash
npm test -- --watch
```

## Writing New Tests

1. Import necessary utilities from `test-utils.ts`
2. Use appropriate mock data generators
3. Follow existing patterns for consistency
4. Include both success and failure cases
5. Test edge cases and error scenarios
6. Validate performance where applicable

## CI/CD Integration

Tests are automatically run on:
- Pull requests
- Commits to main branch
- Nightly performance regression tests

Failed tests will block deployment to production.