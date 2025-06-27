#!/bin/bash

# Start Celery workers for ColdCopy background processing

# Set working directory
cd "$(dirname "$0")/.."

# Activate virtual environment if exists
if [ -d "venv" ]; then
    source venv/bin/activate
fi

# Set Python path
export PYTHONPATH="${PYTHONPATH}:$(pwd)"

# Start workers for different queues
echo "Starting Celery workers..."

# Email worker (high priority, more workers)
celery -A workers.celery_app worker \
    --loglevel=info \
    --concurrency=4 \
    --queues=email \
    --hostname=email@%h \
    --pidfile=/var/run/celery/email.pid \
    --logfile=/var/log/celery/email.log \
    --detach

# Campaign worker 
celery -A workers.celery_app worker \
    --loglevel=info \
    --concurrency=2 \
    --queues=campaigns \
    --hostname=campaigns@%h \
    --pidfile=/var/run/celery/campaigns.pid \
    --logfile=/var/log/celery/campaigns.log \
    --detach

# Analytics worker
celery -A workers.celery_app worker \
    --loglevel=info \
    --concurrency=2 \
    --queues=analytics \
    --hostname=analytics@%h \
    --pidfile=/var/run/celery/analytics.pid \
    --logfile=/var/log/celery/analytics.log \
    --detach

# GDPR worker (single worker for data consistency)
celery -A workers.celery_app worker \
    --loglevel=info \
    --concurrency=1 \
    --queues=gdpr \
    --hostname=gdpr@%h \
    --pidfile=/var/run/celery/gdpr.pid \
    --logfile=/var/log/celery/gdpr.log \
    --detach

# Start beat scheduler
celery -A workers.celery_app beat \
    --loglevel=info \
    --pidfile=/var/run/celery/beat.pid \
    --logfile=/var/log/celery/beat.log \
    --detach

echo "Celery workers started successfully!"
echo "Worker logs available in /var/log/celery/"
echo ""
echo "To monitor workers, use:"
echo "  celery -A workers.celery_app inspect active"
echo "  celery -A workers.celery_app inspect stats"
echo ""
echo "To stop workers, use:"
echo "  ./scripts/stop_workers.sh"