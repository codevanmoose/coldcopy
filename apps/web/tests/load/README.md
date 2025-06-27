# ColdCopy Load Testing Suite

Comprehensive load testing framework for ColdCopy using K6, designed to ensure performance and scalability across all system components.

## Overview

This load testing suite provides:
- **Email System Performance Testing** - Bulk sending, SES rate limiting, tracking
- **API Performance Testing** - Authentication, CRUD operations, concurrent users
- **Database Performance Testing** - RLS policies, multi-tenancy, complex queries
- **Billing System Testing** - Stripe webhooks, subscriptions, payment processing
- **GDPR Compliance Testing** - Data exports, consent management, deletion operations
- **Performance Monitoring** - Regression detection, scalability recommendations
- **CI/CD Integration** - Automated testing, performance gates, reporting

## Quick Start

### Prerequisites

1. Install K6:
```bash
# macOS
brew install k6

# Linux
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Windows
choco install k6
```

2. Setup environment variables:
```bash
export BASE_URL="http://localhost:3000"
export TEST_USER_EMAIL="test@coldcopy.test"
export TEST_USER_PASSWORD="TestPassword123!"
export WORKSPACE_ID="test-workspace-id"
```

### Running Tests

#### Individual Test Suites

```bash
# Email performance tests
k6 run email-load.js

# API performance tests  
k6 run api-load.js

# Database performance tests
k6 run database-load.js

# Billing system tests
k6 run billing-load.js

# GDPR compliance tests
k6 run gdpr-load.js
```

#### Comprehensive Test Suite

```bash
# Light load test (for CI/CD)
TEST_TYPE=light k6 run run-tests.js

# Moderate load test (default)
TEST_TYPE=moderate k6 run run-tests.js

# Heavy load test (stress testing)
TEST_TYPE=heavy k6 run run-tests.js

# Spike test (sudden traffic spikes)
TEST_TYPE=spike k6 run run-tests.js

# Soak test (long-running stability)
TEST_TYPE=soak k6 run run-tests.js
```

## Test Configuration

### Load Test Stages

The suite includes predefined load patterns:

- **Light** (5 users, 4 minutes) - CI/CD and quick validation
- **Moderate** (50 users, 16 minutes) - Regular performance testing
- **Heavy** (200 users, 29 minutes) - Stress testing and capacity planning
- **Spike** (1000 users, 6 minutes) - Traffic spike simulation
- **Soak** (30 users, 70 minutes) - Long-term stability testing

### Performance Thresholds

Global thresholds:
- Response time P95 < 3 seconds
- Error rate < 5%
- Throughput > 5 requests/second

Component-specific thresholds:
- Email processing P95 < 10 seconds
- API responses P95 < 2 seconds
- Database queries P95 < 2 seconds
- Billing operations P95 < 5 seconds
- GDPR operations P95 < 10 seconds

## Test Components

### 1. Email System Tests (`email-load.js`)

Tests email sending performance and reliability:

**Test Scenarios:**
- Single email sending
- Bulk email operations (10-60 emails per batch)
- Campaign execution with sequences
- Email tracking (opens/clicks)
- Template rendering performance
- SES rate limiting handling

**Key Metrics:**
- Email processing time
- Send success rate
- Queue depth
- Template rendering time
- SES rate limit hits

### 2. API Performance Tests (`api-load.js`)

Tests API endpoints under various load conditions:

**Test Scenarios:**
- Authentication performance
- CRUD operations on leads/campaigns
- Read-heavy workloads (analytics)
- Write-heavy workloads (imports)
- Mixed realistic workflows
- Endpoint stress testing

**Key Metrics:**
- API response times
- Authentication success rate
- Concurrent user handling
- Database query performance
- Error rates by endpoint

### 3. Database Performance Tests (`database-load.js`)

Tests database performance with focus on multi-tenancy:

**Test Scenarios:**
- Row Level Security (RLS) policy performance
- Multi-tenant workload simulation
- Large dataset operations
- Connection pool stress testing
- Complex analytical queries
- Read/write intensive workloads

**Key Metrics:**
- Query execution time
- RLS policy overhead
- Connection pool utilization
- Index effectiveness
- Data volume processed

### 4. Billing System Tests (`billing-load.js`)

Tests billing and payment processing performance:

**Test Scenarios:**
- Stripe webhook processing
- Subscription management
- Usage tracking and metering
- Payment processing workflows
- Token purchase flows
- Billing analytics queries

**Key Metrics:**
- Webhook processing time
- Payment success rates
- Usage tracking latency
- Stripe API response times
- Transaction volume handling

### 5. GDPR Compliance Tests (`gdpr-load.js`)

Tests GDPR operations performance:

**Test Scenarios:**
- Data export requests (Article 20)
- Consent management and checking
- Data deletion (Right to be Forgotten)
- Audit logging performance
- Privacy compliance checks
- Data retention policy execution

**Key Metrics:**
- Data export completion time
- Consent check latency
- Deletion processing time
- Audit log performance
- Compliance verification

## Performance Monitoring

The suite includes comprehensive performance monitoring:

### Regression Detection

Automatically detects performance regressions:
- 20% degradation threshold for time-based metrics
- Baseline comparison for all key metrics
- Severity classification (info/warning/critical)
- Automated alerting on critical regressions

### Scalability Recommendations

Provides actionable recommendations:
- Database optimization suggestions
- API scaling recommendations
- Resource utilization analysis
- Bottleneck identification
- Capacity planning guidance

### Performance Scoring

Calculates overall performance score (0-100):
- Weighted scoring across all components
- Baseline comparison methodology
- Trend analysis over time
- Build quality gates

## CI/CD Integration

### GitHub Actions Workflow

The suite integrates with GitHub Actions for:

**Pull Request Testing:**
- Light performance tests on every PR
- Performance regression detection
- Automatic PR comments with results
- Build failure on critical regressions

**Main Branch Testing:**
- Comprehensive performance tests
- Performance trend tracking
- Slack notifications on issues
- Artifact storage for analysis

**Scheduled Testing:**
- Nightly comprehensive tests
- Multiple test types (moderate/heavy/soak)
- Production environment validation
- Long-term performance trending

### Environment Configuration

Set up the following secrets in your repository:

```
# Test Environment URLs
STAGING_BASE_URL=https://staging.coldcopy.com
PRODUCTION_BASE_URL=https://app.coldcopy.com

# Test Credentials
TEST_USER_EMAIL=test@example.com
TEST_USER_PASSWORD=SecurePassword123!
TEST_WORKSPACE_ID=workspace-12345
PROD_TEST_USER_EMAIL=prod-test@example.com
PROD_TEST_USER_PASSWORD=ProdPassword123!
PROD_TEST_WORKSPACE_ID=prod-workspace-12345

# Monitoring Integration
DATADOG_API_KEY=your-datadog-key
ELASTIC_URL=https://your-elastic-cluster.com
ELASTIC_API_KEY=your-elastic-key
SLACK_WEBHOOK=https://hooks.slack.com/your-webhook
```

## Running in Different Environments

### Local Development

```bash
# Start local application
npm run dev

# Run light performance tests
BASE_URL=http://localhost:3000 TEST_TYPE=light k6 run run-tests.js
```

### Staging Environment

```bash
# Run against staging
BASE_URL=https://staging.coldcopy.com \
TEST_USER_EMAIL=staging-test@example.com \
TEST_USER_PASSWORD=StagingPassword123! \
TEST_TYPE=moderate k6 run run-tests.js
```

### Production Environment

```bash
# Run production performance monitoring (carefully!)
BASE_URL=https://app.coldcopy.com \
TEST_USER_EMAIL=prod-monitor@example.com \
TEST_USER_PASSWORD=ProdPassword123! \
TEST_TYPE=light k6 run run-tests.js
```

## Analyzing Results

### HTML Reports

K6 generates detailed HTML reports showing:
- Request metrics and trends
- Response time distributions
- Error rate analysis
- Virtual user activity
- Custom metric visualization

### JSON Reports

Machine-readable results for integration:
- Complete test metrics
- Performance analysis
- Regression detection results
- Scalability recommendations
- Environment metadata

### CSV Exports

For analysis in external tools:
- Key performance metrics
- Threshold compliance
- Trend data
- Comparative analysis

## Customization

### Adding New Tests

1. Create test functions in appropriate module
2. Add scenarios to `run-tests.js`
3. Define component-specific thresholds
4. Update performance monitoring baselines

### Modifying Thresholds

Update thresholds in:
- `k6-config.js` - Global thresholds
- Individual test files - Component thresholds
- `performance-monitor.js` - Baseline values

### Custom Metrics

Add custom metrics:
```javascript
import { Rate, Trend, Counter } from 'k6/metrics';

const customMetric = new Trend('custom_metric_duration');

export function customTest() {
  const startTime = Date.now();
  // Your test logic
  const duration = Date.now() - startTime;
  customMetric.add(duration);
}
```

## Best Practices

### Test Design

1. **Realistic Workloads** - Model actual user behavior
2. **Gradual Load Increase** - Use ramping patterns
3. **Think Time** - Include realistic pauses
4. **Data Isolation** - Use unique test data
5. **Error Handling** - Gracefully handle failures

### Performance Targets

1. **Response Times** - Target P95 < 3 seconds
2. **Error Rates** - Keep below 5% for all components
3. **Throughput** - Maintain > 5 RPS minimum
4. **Scalability** - Plan for 10x growth
5. **Availability** - Target 99.9% uptime

### Monitoring Strategy

1. **Continuous Monitoring** - Regular automated tests
2. **Trend Analysis** - Track performance over time
3. **Proactive Alerting** - Catch issues early
4. **Root Cause Analysis** - Investigate regressions
5. **Capacity Planning** - Use data for scaling decisions

## Troubleshooting

### Common Issues

**High Response Times:**
- Check database query performance
- Verify connection pool settings
- Review application logs
- Monitor resource utilization

**Connection Errors:**
- Verify endpoint URLs
- Check network connectivity
- Validate authentication credentials
- Review rate limiting settings

**Test Failures:**
- Check environment variables
- Verify test data setup
- Review application status
- Validate test thresholds

### Debug Mode

Run tests with verbose output:
```bash
k6 run --verbose run-tests.js
```

### Performance Profiling

Enable detailed metrics:
```bash
k6 run --out json=results.json --summary-trend-stats="avg,min,med,max,p(95),p(99),count" run-tests.js
```

## Contributing

When adding new tests:

1. Follow existing patterns and conventions
2. Include comprehensive error handling
3. Add appropriate metrics and thresholds
4. Update documentation
5. Test in multiple environments
6. Consider performance impact

## Support

For questions or issues:

1. Check this documentation
2. Review test logs and results
3. Consult K6 documentation
4. Open GitHub issue with details
5. Contact the performance team