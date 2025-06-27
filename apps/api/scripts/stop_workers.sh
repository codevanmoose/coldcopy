#!/bin/bash

# Stop Celery workers for ColdCopy

echo "Stopping Celery workers..."

# Function to stop worker by pidfile
stop_worker() {
    local pidfile="$1"
    local name="$2"
    
    if [ -f "$pidfile" ]; then
        local pid=$(cat "$pidfile")
        echo "Stopping $name worker (PID: $pid)..."
        kill -TERM "$pid"
        
        # Wait for graceful shutdown
        local count=0
        while [ -f "$pidfile" ] && [ $count -lt 30 ]; do
            sleep 1
            count=$((count + 1))
        done
        
        # Force kill if still running
        if [ -f "$pidfile" ]; then
            echo "Force stopping $name worker..."
            kill -KILL "$pid" 2>/dev/null || true
            rm -f "$pidfile"
        fi
        
        echo "$name worker stopped."
    else
        echo "$name worker not running (no pidfile found)."
    fi
}

# Stop all workers
stop_worker "/var/run/celery/email.pid" "Email"
stop_worker "/var/run/celery/campaigns.pid" "Campaigns"
stop_worker "/var/run/celery/analytics.pid" "Analytics" 
stop_worker "/var/run/celery/gdpr.pid" "GDPR"
stop_worker "/var/run/celery/beat.pid" "Beat scheduler"

# Alternative: use celery multi to stop all workers
echo "Ensuring all workers are stopped..."
celery -A workers.celery_app control shutdown 2>/dev/null || true

echo "All Celery workers stopped!"