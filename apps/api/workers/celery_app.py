"""
Celery application configuration for ColdCopy background processing.
"""
import os
from celery import Celery
from celery.schedules import crontab
from core.config import get_settings

settings = get_settings()

# Create Celery app
celery_app = Celery(
    "coldcopy",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=[
        "workers.email_tasks",
        "workers.campaign_tasks", 
        "workers.analytics_tasks",
        "workers.gdpr_tasks"
    ]
)

# Celery configuration
celery_app.conf.update(
    # Task routing
    task_routes={
        "workers.email_tasks.*": {"queue": "email"},
        "workers.campaign_tasks.*": {"queue": "campaigns"},
        "workers.analytics_tasks.*": {"queue": "analytics"},
        "workers.gdpr_tasks.*": {"queue": "gdpr"}
    },
    
    # Worker configuration
    worker_prefetch_multiplier=1,
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    worker_max_tasks_per_child=1000,
    
    # Result backend settings
    result_backend=settings.REDIS_URL,
    result_expires=3600,  # 1 hour
    
    # Serialization
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    
    # Timezone
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    
    # Time limits
    task_time_limit=30 * 60,  # 30 minutes
    task_soft_time_limit=25 * 60,  # 25 minutes
    
    # Rate limiting
    task_annotations={
        "workers.email_tasks.send_single_email": {"rate_limit": "10/s"},
        "workers.email_tasks.send_bulk_emails": {"rate_limit": "5/s"},
        "workers.email_tasks.process_email_queue": {"rate_limit": "1/s"},
    },
    
    # Retry configuration
    task_default_retry_delay=60,  # 1 minute
    task_max_retries=3,
    
    # Beat schedule for periodic tasks
    beat_schedule={
        # Email queue processing every minute
        "process-email-queue": {
            "task": "workers.email_tasks.scheduled_queue_processing",
            "schedule": crontab(minute="*"),  # Every minute
            "options": {"queue": "email"}
        },
        
        # Deliverability monitoring every hour
        "monitor-deliverability": {
            "task": "workers.email_tasks.scheduled_deliverability_check", 
            "schedule": crontab(minute=0),  # Every hour
            "options": {"queue": "email"}
        },
        
        # Data cleanup daily at 2 AM
        "cleanup-old-data": {
            "task": "workers.email_tasks.scheduled_cleanup",
            "schedule": crontab(hour=2, minute=0),  # Daily at 2 AM
            "options": {"queue": "email"}
        },
        
        # Campaign status updates every 5 minutes
        "update-campaign-stats": {
            "task": "workers.campaign_tasks.update_all_campaign_stats",
            "schedule": crontab(minute="*/5"),  # Every 5 minutes
            "options": {"queue": "campaigns"}
        },
        
        # Analytics aggregation hourly
        "aggregate-analytics": {
            "task": "workers.analytics_tasks.aggregate_hourly_stats",
            "schedule": crontab(minute=0),  # Every hour
            "options": {"queue": "analytics"}
        },
        
        # GDPR compliance checks daily
        "gdpr-compliance-check": {
            "task": "workers.gdpr_tasks.check_data_retention",
            "schedule": crontab(hour=1, minute=0),  # Daily at 1 AM
            "options": {"queue": "gdpr"}
        },
        
        # Token usage calculation daily
        "calculate-token-usage": {
            "task": "workers.analytics_tasks.calculate_daily_token_usage",
            "schedule": crontab(hour=3, minute=0),  # Daily at 3 AM
            "options": {"queue": "analytics"}
        }
    }
)

# Health check task
@celery_app.task
def health_check():
    """Simple health check task for monitoring."""
    return {"status": "healthy", "message": "Celery is running"}

if __name__ == "__main__":
    celery_app.start()