#!/bin/bash

# ColdCopy Performance Benchmarking Script
# Comprehensive performance testing and optimization validation

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="${BASE_URL:-http://localhost:3000}"
DB_CONNECTION="${DATABASE_URL:-postgresql://localhost:5432/coldcopy}"
RESULTS_DIR="./performance-results/$(date +%Y%m%d-%H%M%S)"
K6_BINARY="${K6_BINARY:-k6}"

echo -e "${BLUE}ColdCopy Performance Benchmark Suite${NC}"
echo "====================================="
echo ""
echo "Base URL: $BASE_URL"
echo "Results Directory: $RESULTS_DIR"
echo ""

# Create results directory
mkdir -p "$RESULTS_DIR"

# Function to log results
log_result() {
    local test_name="$1"
    local result="$2"
    local status="$3"
    
    echo "$(date '+%Y-%m-%d %H:%M:%S') | $test_name | $status | $result" >> "$RESULTS_DIR/benchmark.log"
    
    if [ "$status" = "PASS" ]; then
        echo -e "${GREEN}✓ $test_name: $result${NC}"
    elif [ "$status" = "WARN" ]; then
        echo -e "${YELLOW}⚠ $test_name: $result${NC}"
    else
        echo -e "${RED}✗ $test_name: $result${NC}"
    fi
}

# Function to check prerequisites
check_prerequisites() {
    echo "Checking prerequisites..."
    
    # Check if k6 is installed
    if ! command -v $K6_BINARY &> /dev/null; then
        log_result "K6 Installation" "k6 not found. Install from https://k6.io/docs/getting-started/installation/" "FAIL"
        exit 1
    fi
    
    # Check if PostgreSQL client is available
    if ! command -v psql &> /dev/null; then
        log_result "PostgreSQL Client" "psql not found. Install postgresql-client" "WARN"
    fi
    
    # Check if application is accessible
    if ! curl -s "$BASE_URL/api/health" > /dev/null; then
        log_result "Application Health" "Application not accessible at $BASE_URL" "FAIL"
        exit 1
    fi
    
    log_result "Prerequisites" "All prerequisites met" "PASS"
}

# Function to run database performance tests
test_database_performance() {
    echo ""
    echo "Testing database performance..."
    
    if command -v psql &> /dev/null && [ -n "$DB_CONNECTION" ]; then
        # Test database connection
        if psql "$DB_CONNECTION" -c "SELECT 1;" > /dev/null 2>&1; then
            log_result "Database Connection" "Connected successfully" "PASS"
            
            # Run database benchmarks
            local db_results="$RESULTS_DIR/database-benchmark.txt"
            
            # Test simple query performance
            local simple_query_time=$(psql "$DB_CONNECTION" -t -c "
                \timing on
                SELECT COUNT(*) FROM leads;
            " 2>&1 | grep "Time:" | awk '{print $2}' | head -1)
            
            if [ -n "$simple_query_time" ]; then
                log_result "Simple Query Performance" "$simple_query_time" "PASS"
            fi
            
            # Test complex query performance
            local complex_query_time=$(psql "$DB_CONNECTION" -t -c "
                \timing on
                SELECT 
                    w.name,
                    COUNT(l.id) as lead_count,
                    COUNT(c.id) as campaign_count,
                    COUNT(ce.id) as email_count
                FROM workspaces w
                LEFT JOIN leads l ON w.id = l.workspace_id
                LEFT JOIN campaigns c ON w.id = c.workspace_id
                LEFT JOIN campaign_emails ce ON c.id = ce.campaign_id
                GROUP BY w.id, w.name
                ORDER BY lead_count DESC
                LIMIT 10;
            " 2>&1 | grep "Time:" | awk '{print $2}' | head -1)
            
            if [ -n "$complex_query_time" ]; then
                log_result "Complex Query Performance" "$complex_query_time" "PASS"
            fi
            
            # Check index usage
            psql "$DB_CONNECTION" -c "
                SELECT 
                    schemaname,
                    tablename,
                    indexname,
                    idx_scan,
                    idx_tup_read,
                    idx_tup_fetch
                FROM pg_stat_user_indexes 
                WHERE idx_scan = 0 
                AND schemaname = 'public'
                ORDER BY pg_relation_size(indexrelid) DESC;
            " > "$db_results"
            
            local unused_indexes=$(cat "$db_results" | wc -l)
            if [ "$unused_indexes" -gt 1 ]; then
                log_result "Unused Indexes" "Found $((unused_indexes - 1)) unused indexes" "WARN"
            else
                log_result "Index Usage" "All indexes are being used" "PASS"
            fi
            
        else
            log_result "Database Connection" "Failed to connect to database" "FAIL"
        fi
    else
        log_result "Database Tests" "Skipped - psql not available or no connection string" "WARN"
    fi
}

# Function to run load tests
run_load_tests() {
    echo ""
    echo "Running load tests..."
    
    local test_types=("light" "moderate" "heavy")
    
    for test_type in "${test_types[@]}"; do
        echo "Running $test_type load test..."
        
        local output_file="$RESULTS_DIR/k6-$test_type.json"
        
        # Run k6 load test
        if TEST_TYPE="$test_type" BASE_URL="$BASE_URL" $K6_BINARY run \
            --out json="$output_file" \
            "$(dirname "$0")/load-test/k6-performance-tests.js" 2>&1 | tee "$RESULTS_DIR/k6-$test_type.log"; then
            
            # Parse results
            if [ -f "$output_file" ]; then
                local avg_response_time=$(cat "$output_file" | jq -r '.metrics.http_req_duration.values.avg // 0' | tail -1)
                local error_rate=$(cat "$output_file" | jq -r '.metrics.http_req_failed.values.rate // 0' | tail -1)
                local rps=$(cat "$output_file" | jq -r '.metrics.http_reqs.values.rate // 0' | tail -1)
                
                # Convert to readable format
                avg_response_time=$(echo "$avg_response_time" | awk '{printf "%.2f ms", $1}')
                error_rate=$(echo "$error_rate" | awk '{printf "%.2f%%", $1 * 100}')
                rps=$(echo "$rps" | awk '{printf "%.2f req/s", $1}')
                
                log_result "$test_type Load Test - Response Time" "$avg_response_time" "PASS"
                log_result "$test_type Load Test - Error Rate" "$error_rate" "PASS"
                log_result "$test_type Load Test - Throughput" "$rps" "PASS"
            else
                log_result "$test_type Load Test" "Results file not found" "FAIL"
            fi
        else
            log_result "$test_type Load Test" "Test execution failed" "FAIL"
        fi
    done
}

# Function to test specific API endpoints
test_api_performance() {
    echo ""
    echo "Testing API endpoint performance..."
    
    local endpoints=(
        "GET /api/health"
        "GET /api/leads"
        "GET /api/campaigns"
        "GET /api/analytics/overview"
        "GET /api/admin/performance"
    )
    
    for endpoint in "${endpoints[@]}"; do
        local method=$(echo "$endpoint" | awk '{print $1}')
        local path=$(echo "$endpoint" | awk '{print $2}')
        local url="$BASE_URL$path"
        
        # Test endpoint response time
        local response_time=$(curl -w "%{time_total}" -s -o /dev/null "$url" 2>/dev/null || echo "failed")
        
        if [ "$response_time" != "failed" ]; then
            local response_time_ms=$(echo "$response_time * 1000" | bc | awk '{printf "%.0f ms", $1}')
            
            # Check if response time is acceptable
            local response_time_num=$(echo "$response_time * 1000" | bc | awk '{printf "%.0f", $1}')
            if [ "$response_time_num" -lt 1000 ]; then
                log_result "API $endpoint" "$response_time_ms" "PASS"
            elif [ "$response_time_num" -lt 2000 ]; then
                log_result "API $endpoint" "$response_time_ms" "WARN"
            else
                log_result "API $endpoint" "$response_time_ms" "FAIL"
            fi
        else
            log_result "API $endpoint" "Request failed" "FAIL"
        fi
    done
}

# Function to test static asset performance
test_static_assets() {
    echo ""
    echo "Testing static asset performance..."
    
    local assets=(
        "/"
        "/favicon.ico"
        "/_next/static/css/app.css"
        "/_next/static/js/app.js"
    )
    
    for asset in "${assets[@]}"; do
        local url="$BASE_URL$asset"
        
        # Test asset loading time
        local response_time=$(curl -w "%{time_total}" -s -o /dev/null "$url" 2>/dev/null || echo "failed")
        
        if [ "$response_time" != "failed" ]; then
            local response_time_ms=$(echo "$response_time * 1000" | bc | awk '{printf "%.0f ms", $1}')
            
            # Check if response time is acceptable for static assets
            local response_time_num=$(echo "$response_time * 1000" | bc | awk '{printf "%.0f", $1}')
            if [ "$response_time_num" -lt 500 ]; then
                log_result "Static Asset $asset" "$response_time_ms" "PASS"
            elif [ "$response_time_num" -lt 1000 ]; then
                log_result "Static Asset $asset" "$response_time_ms" "WARN"
            else
                log_result "Static Asset $asset" "$response_time_ms" "FAIL"
            fi
        else
            log_result "Static Asset $asset" "Request failed" "FAIL"
        fi
    done
}

# Function to generate performance report
generate_report() {
    echo ""
    echo "Generating performance report..."
    
    local report_file="$RESULTS_DIR/performance-report.md"
    
    cat > "$report_file" << EOF
# ColdCopy Performance Benchmark Report

**Generated:** $(date)  
**Base URL:** $BASE_URL  
**Test Duration:** $(date -r "$RESULTS_DIR" '+%Y-%m-%d %H:%M:%S') - $(date '+%Y-%m-%d %H:%M:%S')

## Summary

EOF

    # Add test results summary
    local total_tests=$(cat "$RESULTS_DIR/benchmark.log" | wc -l)
    local passed_tests=$(grep "PASS" "$RESULTS_DIR/benchmark.log" | wc -l)
    local warned_tests=$(grep "WARN" "$RESULTS_DIR/benchmark.log" | wc -l)
    local failed_tests=$(grep "FAIL" "$RESULTS_DIR/benchmark.log" | wc -l)
    
    cat >> "$report_file" << EOF
- **Total Tests:** $total_tests
- **Passed:** $passed_tests
- **Warnings:** $warned_tests  
- **Failed:** $failed_tests
- **Success Rate:** $(echo "scale=1; $passed_tests * 100 / $total_tests" | bc)%

## Detailed Results

EOF

    # Add detailed results
    while IFS='|' read -r timestamp test_name result status; do
        local clean_status=$(echo "$status" | xargs)
        local clean_test=$(echo "$test_name" | xargs)
        local clean_result=$(echo "$result" | xargs)
        
        if [ "$clean_status" = "PASS" ]; then
            echo "✅ **$clean_test:** $clean_result" >> "$report_file"
        elif [ "$clean_status" = "WARN" ]; then
            echo "⚠️ **$clean_test:** $clean_result" >> "$report_file"
        else
            echo "❌ **$clean_test:** $clean_result" >> "$report_file"
        fi
    done < "$RESULTS_DIR/benchmark.log"
    
    cat >> "$report_file" << EOF

## Recommendations

EOF

    # Add recommendations based on results
    if [ "$failed_tests" -gt 0 ]; then
        echo "- **Critical:** Address failed tests immediately" >> "$report_file"
    fi
    
    if [ "$warned_tests" -gt 0 ]; then
        echo "- **Warning:** Review and optimize tests with warnings" >> "$report_file"
    fi
    
    if grep -q "Unused Indexes" "$RESULTS_DIR/benchmark.log"; then
        echo "- **Database:** Consider removing unused indexes to improve write performance" >> "$report_file"
    fi
    
    echo "- **Monitoring:** Set up continuous performance monitoring in production" >> "$report_file"
    echo "- **Optimization:** Regular performance reviews and optimizations" >> "$report_file"
    
    log_result "Performance Report" "Generated at $report_file" "PASS"
}

# Function to display final summary
display_summary() {
    echo ""
    echo -e "${BLUE}Performance Benchmark Complete${NC}"
    echo "=============================="
    echo ""
    echo "Results saved to: $RESULTS_DIR"
    echo ""
    echo "Quick Summary:"
    
    local total_tests=$(cat "$RESULTS_DIR/benchmark.log" | wc -l)
    local passed_tests=$(grep "PASS" "$RESULTS_DIR/benchmark.log" | wc -l)
    local warned_tests=$(grep "WARN" "$RESULTS_DIR/benchmark.log" | wc -l)
    local failed_tests=$(grep "FAIL" "$RESULTS_DIR/benchmark.log" | wc -l)
    
    echo -e "  ${GREEN}Passed: $passed_tests${NC}"
    echo -e "  ${YELLOW}Warnings: $warned_tests${NC}"
    echo -e "  ${RED}Failed: $failed_tests${NC}"
    echo ""
    
    if [ "$failed_tests" -gt 0 ]; then
        echo -e "${RED}⚠ Some tests failed. Review the results and address issues.${NC}"
    elif [ "$warned_tests" -gt 0 ]; then
        echo -e "${YELLOW}⚠ Some tests have warnings. Consider optimization.${NC}"
    else
        echo -e "${GREEN}✅ All tests passed! Performance is good.${NC}"
    fi
    echo ""
    echo "View the full report: $RESULTS_DIR/performance-report.md"
}

# Main execution
main() {
    check_prerequisites
    test_database_performance
    test_api_performance
    test_static_assets
    run_load_tests
    generate_report
    display_summary
}

# Run main function
main "$@"