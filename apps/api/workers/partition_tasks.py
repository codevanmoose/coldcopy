"""
Celery tasks for automated partition management.
"""
import logging
from datetime import datetime, timedelta
from celery import Celery
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_async_session
from utils.partition_manager import EmailEventsPartitionManager
from core.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)

# Initialize Celery app
celery_app = Celery(
    "partition_tasks",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL
)

# Configure Celery
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=30 * 60,  # 30 minutes
    task_soft_time_limit=25 * 60,  # 25 minutes
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=1000,
)


@celery_app.task(bind=True, name="partition_tasks.maintain_partitions")
def maintain_email_events_partitions(self, months_ahead: int = 6):
    """
    Celery task to maintain email_events partitions.
    
    This task should be scheduled to run weekly or monthly.
    
    Args:
        months_ahead: Number of months ahead to create partitions for
    """
    import asyncio
    
    async def _maintain_partitions():
        session = None
        try:
            # Get database session
            session = get_async_session()
            manager = EmailEventsPartitionManager(session)
            
            # Perform maintenance
            result = await manager.maintain_partitions(months_ahead)
            
            # Log the operation
            await manager.log_maintenance_operation(
                operation_type="scheduled_maintenance",
                details={
                    "task_id": self.request.id,
                    "months_ahead": months_ahead,
                    "created_partitions": result.created_partitions,
                    "errors": result.errors
                },
                success=len(result.errors) == 0,
                error_message="; ".join(result.errors) if result.errors else None,
                execution_time_ms=result.execution_time_ms
            )
            
            logger.info(
                f"Partition maintenance completed. "
                f"Created: {len(result.created_partitions)}, "
                f"Errors: {len(result.errors)}, "
                f"Time: {result.execution_time_ms}ms"
            )
            
            return {
                "success": len(result.errors) == 0,
                "created_partitions": result.created_partitions,
                "errors": result.errors,
                "execution_time_ms": result.execution_time_ms
            }
            
        except Exception as e:
            error_msg = f"Partition maintenance failed: {str(e)}"
            logger.error(error_msg)
            
            if session:
                try:
                    manager = EmailEventsPartitionManager(session)
                    await manager.log_maintenance_operation(
                        operation_type="scheduled_maintenance",
                        details={"task_id": self.request.id, "months_ahead": months_ahead},
                        success=False,
                        error_message=error_msg
                    )
                except Exception as log_error:
                    logger.error(f"Failed to log maintenance error: {log_error}")
            
            raise self.retry(exc=e, countdown=60, max_retries=3)
            
        finally:
            if session:
                await session.close()
    
    # Run the async function
    return asyncio.run(_maintain_partitions())


@celery_app.task(bind=True, name="partition_tasks.cleanup_old_partitions")
def cleanup_old_email_events_partitions(self, retention_months: int = 12):
    """
    Celery task to cleanup old email_events partitions.
    
    This task should be scheduled to run monthly.
    
    Args:
        retention_months: Number of months to retain data
    """
    import asyncio
    
    async def _cleanup_partitions():
        session = None
        try:
            # Get database session
            session = get_async_session()
            manager = EmailEventsPartitionManager(session)
            
            # Perform cleanup
            result = await manager.cleanup_old_partitions(retention_months)
            
            # Log the operation
            await manager.log_maintenance_operation(
                operation_type="scheduled_cleanup",
                details={
                    "task_id": self.request.id,
                    "retention_months": retention_months,
                    "dropped_partitions": result.dropped_partitions,
                    "errors": result.errors
                },
                success=len(result.errors) == 0,
                error_message="; ".join(result.errors) if result.errors else None,
                execution_time_ms=result.execution_time_ms
            )
            
            dropped_count = len(result.dropped_partitions)
            total_records = sum(count for _, count in result.dropped_partitions)
            
            logger.info(
                f"Partition cleanup completed. "
                f"Dropped: {dropped_count} partitions, "
                f"Records: {total_records}, "
                f"Errors: {len(result.errors)}, "
                f"Time: {result.execution_time_ms}ms"
            )
            
            return {
                "success": len(result.errors) == 0,
                "dropped_partitions": result.dropped_partitions,
                "errors": result.errors,
                "execution_time_ms": result.execution_time_ms
            }
            
        except Exception as e:
            error_msg = f"Partition cleanup failed: {str(e)}"
            logger.error(error_msg)
            
            if session:
                try:
                    manager = EmailEventsPartitionManager(session)
                    await manager.log_maintenance_operation(
                        operation_type="scheduled_cleanup",
                        details={"task_id": self.request.id, "retention_months": retention_months},
                        success=False,
                        error_message=error_msg
                    )
                except Exception as log_error:
                    logger.error(f"Failed to log cleanup error: {log_error}")
            
            raise self.retry(exc=e, countdown=60, max_retries=3)
            
        finally:
            if session:
                await session.close()
    
    # Run the async function
    return asyncio.run(_cleanup_partitions())


@celery_app.task(bind=True, name="partition_tasks.health_check")
def check_partition_health(self):
    """
    Celery task to check partition system health.
    
    This task should be scheduled to run daily.
    """
    import asyncio
    
    async def _health_check():
        session = None
        try:
            # Get database session
            session = get_async_session()
            manager = EmailEventsPartitionManager(session)
            
            # Check health
            health = await manager.check_partition_health()
            
            # Log health status
            await manager.log_maintenance_operation(
                operation_type="health_check",
                details={
                    "task_id": self.request.id,
                    "health_status": health["status"],
                    "partition_count": health["partition_count"],
                    "total_size_mb": health["total_size_mb"],
                    "issues": health["issues"],
                    "recommendations": health["recommendations"]
                },
                success=health["status"] not in ["critical", "error"]
            )
            
            # Log warnings or critical issues
            if health["status"] == "warning":
                logger.warning(f"Partition health warning: {health['issues']}")
            elif health["status"] == "critical":
                logger.error(f"Partition health critical: {health['issues']}")
            elif health["status"] == "error":
                logger.error(f"Partition health error: {health['issues']}")
            else:
                logger.info(f"Partition health check passed: {health['partition_count']} partitions")
            
            return health
            
        except Exception as e:
            error_msg = f"Partition health check failed: {str(e)}"
            logger.error(error_msg)
            
            if session:
                try:
                    manager = EmailEventsPartitionManager(session)
                    await manager.log_maintenance_operation(
                        operation_type="health_check",
                        details={"task_id": self.request.id},
                        success=False,
                        error_message=error_msg
                    )
                except Exception as log_error:
                    logger.error(f"Failed to log health check error: {log_error}")
            
            raise self.retry(exc=e, countdown=60, max_retries=2)
            
        finally:
            if session:
                await session.close()
    
    # Run the async function
    return asyncio.run(_health_check())


@celery_app.task(bind=True, name="partition_tasks.generate_statistics")
def generate_partition_statistics(self):
    """
    Celery task to generate and cache partition statistics.
    
    This task should be scheduled to run daily.
    """
    import asyncio
    
    async def _generate_stats():
        session = None
        try:
            # Get database session
            session = get_async_session()
            manager = EmailEventsPartitionManager(session)
            
            # Get partition stats
            stats = await manager.get_partition_stats()
            
            # Calculate aggregated statistics
            total_partitions = len(stats)
            total_records = sum(stat.record_count for stat in stats)
            total_size_mb = sum(stat.size_mb for stat in stats)
            avg_size_mb = total_size_mb / total_partitions if total_partitions > 0 else 0
            
            # Find largest and smallest partitions
            largest_partition = max(stats, key=lambda x: x.size_mb) if stats else None
            smallest_partition = min(stats, key=lambda x: x.size_mb) if stats else None
            
            # Get partition info
            partition_info = await manager.get_partition_info_view()
            
            statistics = {
                "generated_at": datetime.utcnow().isoformat(),
                "summary": {
                    "total_partitions": total_partitions,
                    "total_records": total_records,
                    "total_size_mb": round(total_size_mb, 2),
                    "avg_size_mb": round(avg_size_mb, 2)
                },
                "extremes": {
                    "largest_partition": {
                        "name": largest_partition.name,
                        "size_mb": largest_partition.size_mb,
                        "record_count": largest_partition.record_count
                    } if largest_partition else None,
                    "smallest_partition": {
                        "name": smallest_partition.name,
                        "size_mb": smallest_partition.size_mb,
                        "record_count": smallest_partition.record_count
                    } if smallest_partition else None
                },
                "partition_details": [
                    {
                        "name": stat.name,
                        "period": stat.period,
                        "record_count": stat.record_count,
                        "size_mb": stat.size_mb,
                        "oldest_record": stat.oldest_record.isoformat() if stat.oldest_record else None,
                        "newest_record": stat.newest_record.isoformat() if stat.newest_record else None
                    }
                    for stat in stats
                ],
                "partition_info": partition_info
            }
            
            # Log the statistics generation
            await manager.log_maintenance_operation(
                operation_type="generate_statistics",
                details={
                    "task_id": self.request.id,
                    "statistics": statistics["summary"]
                },
                success=True
            )
            
            logger.info(
                f"Partition statistics generated: "
                f"{total_partitions} partitions, "
                f"{total_records} records, "
                f"{total_size_mb:.2f}MB"
            )
            
            # Cache the statistics in Redis (if available)
            try:
                from core.redis import get_cache_manager
                cache = get_cache_manager()
                if cache:
                    await cache.set(
                        "partition_statistics",
                        statistics,
                        expire=86400  # 24 hours
                    )
            except Exception as cache_error:
                logger.warning(f"Failed to cache partition statistics: {cache_error}")
            
            return statistics
            
        except Exception as e:
            error_msg = f"Statistics generation failed: {str(e)}"
            logger.error(error_msg)
            
            if session:
                try:
                    manager = EmailEventsPartitionManager(session)
                    await manager.log_maintenance_operation(
                        operation_type="generate_statistics",
                        details={"task_id": self.request.id},
                        success=False,
                        error_message=error_msg
                    )
                except Exception as log_error:
                    logger.error(f"Failed to log statistics error: {log_error}")
            
            raise self.retry(exc=e, countdown=60, max_retries=2)
            
        finally:
            if session:
                await session.close()
    
    # Run the async function
    return asyncio.run(_generate_stats())


# Celery Beat Schedule (for periodic tasks)
celery_app.conf.beat_schedule = {
    # Weekly partition maintenance
    "maintain-partitions-weekly": {
        "task": "partition_tasks.maintain_partitions",
        "schedule": 604800.0,  # 7 days in seconds
        "args": (6,),  # 6 months ahead
    },
    
    # Monthly partition cleanup
    "cleanup-partitions-monthly": {
        "task": "partition_tasks.cleanup_old_partitions",
        "schedule": 2592000.0,  # 30 days in seconds
        "args": (12,),  # 12 months retention
    },
    
    # Daily health check
    "health-check-daily": {
        "task": "partition_tasks.health_check",
        "schedule": 86400.0,  # 24 hours in seconds
    },
    
    # Daily statistics generation
    "generate-statistics-daily": {
        "task": "partition_tasks.generate_statistics",
        "schedule": 86400.0,  # 24 hours in seconds
    },
}


# Task routing
celery_app.conf.task_routes = {
    "partition_tasks.*": {"queue": "partition_maintenance"},
}


# Manual task execution functions
def trigger_partition_maintenance(months_ahead: int = 6):
    """Manually trigger partition maintenance."""
    return maintain_email_events_partitions.delay(months_ahead)


def trigger_partition_cleanup(retention_months: int = 12):
    """Manually trigger partition cleanup."""
    return cleanup_old_email_events_partitions.delay(retention_months)


def trigger_health_check():
    """Manually trigger health check."""
    return check_partition_health.delay()


def trigger_statistics_generation():
    """Manually trigger statistics generation."""
    return generate_partition_statistics.delay()


if __name__ == "__main__":
    # For running worker directly
    celery_app.start()