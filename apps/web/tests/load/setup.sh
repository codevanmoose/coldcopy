#!/bin/bash

# ColdCopy Load Test Setup Script

set -e

echo "🚀 Setting up ColdCopy Load Testing Suite"

# Check if K6 is installed
if ! command -v k6 &> /dev/null; then
    echo "❌ K6 is not installed. Please install K6 first:"
    echo ""
    echo "macOS: brew install k6"
    echo "Linux: https://k6.io/docs/get-started/installation/"
    echo "Windows: choco install k6"
    echo ""
    exit 1
fi

echo "✅ K6 is installed ($(k6 version))"

# Create environment file if it doesn't exist
if [ ! -f .env.load-test ]; then
    echo "📝 Creating .env.load-test file..."
    cat > .env.load-test << EOF
# ColdCopy Load Test Environment Variables
# Copy this file to .env.load-test.local and customize for your environment

# Application URL
BASE_URL=http://localhost:3000

# Test credentials
TEST_USER_EMAIL=test@coldcopy.test
TEST_USER_PASSWORD=TestPassword123!
WORKSPACE_ID=test-workspace-id

# Test configuration
TEST_TYPE=moderate
ENVIRONMENT=test

# CI/CD variables (for GitHub Actions)
GIT_BRANCH=main
GIT_COMMIT=local
BUILD_ID=local-test

# Monitoring integration (optional)
DATADOG_API_KEY=
ELASTIC_URL=
ELASTIC_API_KEY=
SLACK_WEBHOOK=

# Performance thresholds (optional overrides)
API_RESPONSE_TIME_THRESHOLD=2000
DB_QUERY_TIME_THRESHOLD=1000
EMAIL_PROCESSING_TIME_THRESHOLD=10000
ERROR_RATE_THRESHOLD=0.05
EOF
    echo "✅ Created .env.load-test file"
    echo "📝 Please customize .env.load-test.local for your environment"
else
    echo "✅ .env.load-test file already exists"
fi

# Create local environment file if it doesn't exist
if [ ! -f .env.load-test.local ]; then
    echo "📝 Creating .env.load-test.local from template..."
    cp .env.load-test .env.load-test.local
    echo "⚠️  Please edit .env.load-test.local with your actual configuration"
fi

# Create results directory
mkdir -p results
echo "✅ Created results directory"

# Check if Node.js dependencies are installed
if [ ! -d "../../node_modules" ]; then
    echo "⚠️  Node.js dependencies not found. Please run 'npm install' in the project root."
fi

echo ""
echo "🎉 Load testing suite setup complete!"
echo ""
echo "Quick Start:"
echo "1. Edit .env.load-test.local with your configuration"
echo "2. Start your application (npm run dev)"
echo "3. Run a light load test: npm run test:load:light"
echo ""
echo "Available test commands:"
echo "  npm run test:load:light     - Light load test (5 users, 4 min)"
echo "  npm run test:load:moderate  - Moderate load test (50 users, 16 min)"
echo "  npm run test:load:heavy     - Heavy load test (200 users, 29 min)"
echo "  npm run test:load:spike     - Spike test (1000 users, 6 min)"
echo "  npm run test:load:soak      - Soak test (30 users, 70 min)"
echo ""
echo "Component-specific tests:"
echo "  npm run test:load:email     - Email system performance"
echo "  npm run test:load:api       - API performance"
echo "  npm run test:load:database  - Database performance"
echo "  npm run test:load:billing   - Billing system performance"
echo "  npm run test:load:gdpr      - GDPR operations performance"
echo ""
echo "For more information, see tests/load/README.md"