#!/bin/bash

# ColdCopy Materialized Views Refresh Script
# Run this script to manually refresh all materialized views

set -e

# Load environment variables
source /etc/coldcopy/.env 2>/dev/null || true

# Database connection
DATABASE_URL="${DATABASE_URL:-$SUPABASE_DB_URL}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}ColdCopy Materialized Views Refresh${NC}"
echo "======================================"
echo ""

# Function to refresh a view and measure time
refresh_view() {
    local view_name=$1
    echo -n "Refreshing $view_name... "
    
    start_time=$(date +%s)
    
    if psql "$DATABASE_URL" -c "REFRESH MATERIALIZED VIEW CONCURRENTLY $view_name;" 2>/dev/null; then
        end_time=$(date +%s)
        duration=$((end_time - start_time))
        echo -e "${GREEN}✓${NC} (${duration}s)"
        return 0
    else
        echo -e "${RED}✗ Failed${NC}"
        return 1
    fi
}

# List of materialized views to refresh
views=(
    "campaign_analytics_mv"
    "workspace_usage_analytics_mv"
    "lead_engagement_scores_mv"
    "email_deliverability_metrics_mv"
)

# Track results
total=${#views[@]}
successful=0
failed=0

echo "Found $total materialized views to refresh"
echo ""

# Refresh each view
for view in "${views[@]}"; do
    if refresh_view "$view"; then
        ((successful++))
    else
        ((failed++))
    fi
done

echo ""
echo "======================================"
echo -e "Summary: ${GREEN}$successful successful${NC}, ${RED}$failed failed${NC}"

# Get view sizes and last refresh times
echo ""
echo "View Statistics:"
echo "----------------"

psql "$DATABASE_URL" << EOF
SELECT 
    matviewname AS "View Name",
    pg_size_pretty(pg_total_relation_size(matviewname::regclass)) AS "Size",
    CASE 
        WHEN last_refreshed IS NOT NULL 
        THEN to_char(last_refreshed, 'YYYY-MM-DD HH24:MI:SS')
        ELSE 'Never'
    END AS "Last Refreshed"
FROM pg_matviews
LEFT JOIN LATERAL (
    SELECT last_refreshed 
    FROM campaign_analytics_mv 
    LIMIT 1
) refresh ON matviewname = 'campaign_analytics_mv'
WHERE schemaname = 'public'
ORDER BY matviewname;
EOF

# Check if any views need urgent refresh
echo ""
echo "Checking view freshness..."

stale_views=$(psql -t "$DATABASE_URL" << EOF
WITH view_freshness AS (
    SELECT 'campaign_analytics_mv' as view_name,
           MAX(last_refreshed) as last_refreshed
    FROM campaign_analytics_mv
    UNION ALL
    SELECT 'workspace_usage_analytics_mv',
           MAX(last_refreshed)
    FROM workspace_usage_analytics_mv
    UNION ALL
    SELECT 'lead_engagement_scores_mv',
           MAX(last_refreshed)
    FROM lead_engagement_scores_mv
    UNION ALL
    SELECT 'email_deliverability_metrics_mv',
           MAX(last_refreshed)
    FROM email_deliverability_metrics_mv
)
SELECT COUNT(*)
FROM view_freshness
WHERE last_refreshed < NOW() - INTERVAL '2 hours'
   OR last_refreshed IS NULL;
EOF
)

if [ "$stale_views" -gt 0 ]; then
    echo -e "${YELLOW}⚠ Warning: $stale_views views are stale (>2 hours old)${NC}"
else
    echo -e "${GREEN}✓ All views are fresh${NC}"
fi

exit $failed