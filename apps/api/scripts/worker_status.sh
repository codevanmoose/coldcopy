#!/bin/bash

# Check status of Celery workers for ColdCopy

echo "=== Celery Worker Status ==="
echo ""

# Set working directory and Python path
cd "$(dirname "$0")/.."
export PYTHONPATH="${PYTHONPATH}:$(pwd)"

# Check if workers are running
echo "1. Worker Process Status:"
echo "------------------------"

check_worker() {
    local pidfile="$1"
    local name="$2"
    
    if [ -f "$pidfile" ]; then
        local pid=$(cat "$pidfile")
        if ps -p "$pid" > /dev/null 2>&1; then
            echo "✓ $name worker: Running (PID: $pid)"
        else
            echo "✗ $name worker: Dead (stale pidfile)"
        fi
    else
        echo "✗ $name worker: Not running"
    fi
}

check_worker "/var/run/celery/email.pid" "Email"
check_worker "/var/run/celery/campaigns.pid" "Campaigns"
check_worker "/var/run/celery/analytics.pid" "Analytics"
check_worker "/var/run/celery/gdpr.pid" "GDPR"
check_worker "/var/run/celery/beat.pid" "Beat scheduler"

echo ""
echo "2. Worker Connectivity:"
echo "----------------------"

# Check if workers are responsive
if celery -A workers.celery_app inspect ping 2>/dev/null | grep -q "OK"; then
    echo "✓ Workers are responsive"
else
    echo "✗ Workers are not responsive"
fi

echo ""
echo "3. Active Tasks:"
echo "---------------"

# Show active tasks
celery -A workers.celery_app inspect active 2>/dev/null || echo "Unable to fetch active tasks"

echo ""
echo "4. Queue Statistics:"
echo "------------------"

# Show queue lengths (requires Redis CLI)
if command -v redis-cli &> /dev/null; then
    echo "Email queue: $(redis-cli llen email_queue 2>/dev/null || echo 'N/A')"
    echo "Campaigns queue: $(redis-cli llen campaigns_queue 2>/dev/null || echo 'N/A')"
    echo "Analytics queue: $(redis-cli llen analytics_queue 2>/dev/null || echo 'N/A')"
    echo "GDPR queue: $(redis-cli llen gdpr_queue 2>/dev/null || echo 'N/A')"
else
    echo "Redis CLI not available - cannot check queue lengths"
fi

echo ""
echo "5. Worker Statistics:"
echo "-------------------"

# Show worker stats
celery -A workers.celery_app inspect stats 2>/dev/null || echo "Unable to fetch worker statistics"

echo ""
echo "6. Recent Log Entries:"
echo "--------------------"

# Show recent log entries
for logfile in /var/log/celery/*.log; do
    if [ -f "$logfile" ]; then
        echo "=== $(basename "$logfile") ==="
        tail -n 3 "$logfile" 2>/dev/null || echo "Cannot read $logfile"
        echo ""
    fi
done

echo "=== Status Check Complete ==="
echo ""
echo "Useful commands:"
echo "  ./scripts/start_workers.sh  - Start all workers"
echo "  ./scripts/stop_workers.sh   - Stop all workers"
echo "  celery -A workers.celery_app flower  - Start monitoring UI"