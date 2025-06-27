"""
Celery tasks for automated materialized view refresh and analytics maintenance.

This module provides scheduled tasks for maintaining campaign analytics materialized views,
generating reports, and ensuring data freshness across all analytics systems.
"""
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from celery import Celery
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_async_session
from utils.analytics_manager import CampaignAnalyticsManager
from workers.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, name="analytics.refresh_all_materialized_views")
def refresh_all_materialized_views(self, force: bool = False) -> Dict[str, Any]:
    """
    Refresh all analytics materialized views.
    
    This task runs hourly to ensure all analytics data is fresh and up-to-date.
    It refreshes views in dependency order to maintain data consistency.
    
    Args:
        force: If True, force refresh even if views are recent
        
    Returns:
        Dictionary with refresh results and timing information
    """
    task_id = self.request.id
    start_time = datetime.utcnow()
    
    logger.info(f"Starting materialized view refresh task {task_id}")
    
    try:
        # Use sync database session for Celery task
        import asyncio
        from core.database import get_db_sync
        
        with get_db_sync() as db:
            # Execute the scheduled refresh function
            result = db.execute("SELECT scheduled_analytics_refresh()")
            db.commit()
            
            end_time = datetime.utcnow()
            execution_time_ms = int((end_time - start_time).total_seconds() * 1000)
            
            # Log the refresh operation
            db.execute("""
                INSERT INTO materialized_view_refresh_log (
                    refresh_type, execution_time_ms, refreshed_at, success
                ) VALUES (%s, %s, %s, %s)
            """, ('celery_scheduled', execution_time_ms, start_time, True))
            db.commit()
            
            logger.info(f"Materialized view refresh completed in {execution_time_ms}ms")
            
            return {
                "task_id": task_id,
                "success": True,
                "started_at": start_time.isoformat(),
                "completed_at": end_time.isoformat(),
                "execution_time_ms": execution_time_ms,
                "views_refreshed": [
                    "campaign_performance_analytics_mv",
                    "workspace_analytics_summary_mv", 
                    "daily_campaign_trends_analytics_mv",
                    "lead_engagement_analytics_mv",
                    "hourly_performance_analytics_mv"
                ]
            }
            
    except Exception as e:
        end_time = datetime.utcnow()
        execution_time_ms = int((end_time - start_time).total_seconds() * 1000)
        
        logger.error(f"Materialized view refresh failed: {str(e)}", exc_info=True)
        
        # Log the failure
        try:
            with get_db_sync() as db:
                db.execute("""
                    INSERT INTO materialized_view_refresh_log (
                        refresh_type, execution_time_ms, refreshed_at, success, error_message
                    ) VALUES (%s, %s, %s, %s, %s)
                """, ('celery_scheduled', execution_time_ms, start_time, False, str(e)))
                db.commit()
        except Exception as log_error:
            logger.error(f"Failed to log refresh error: {log_error}")
        
        # Re-raise the exception to mark task as failed
        raise


@celery_app.task(bind=True, name="analytics.refresh_single_materialized_view")
def refresh_single_materialized_view(self, view_name: str) -> Dict[str, Any]:
    """
    Refresh a specific materialized view.
    
    Args:
        view_name: Name of the materialized view to refresh
        
    Returns:
        Dictionary with refresh results
    """
    task_id = self.request.id
    start_time = datetime.utcnow()
    
    logger.info(f"Starting single view refresh for {view_name} (task {task_id})")
    
    try:
        from core.database import get_db_sync
        
        with get_db_sync() as db:
            # Refresh the specific view
            db.execute(f"REFRESH MATERIALIZED VIEW CONCURRENTLY {view_name}")
            db.commit()
            
            end_time = datetime.utcnow()
            execution_time_ms = int((end_time - start_time).total_seconds() * 1000)
            
            # Log the operation
            db.execute("""
                INSERT INTO materialized_view_refresh_log (
                    view_name, refresh_type, execution_time_ms, refreshed_at, success
                ) VALUES (%s, %s, %s, %s, %s)
            """, (view_name, 'celery_single', execution_time_ms, start_time, True))
            db.commit()
            
            logger.info(f"View {view_name} refreshed in {execution_time_ms}ms")
            
            return {
                "task_id": task_id,
                "view_name": view_name,
                "success": True,
                "started_at": start_time.isoformat(),
                "completed_at": end_time.isoformat(),
                "execution_time_ms": execution_time_ms
            }
            
    except Exception as e:
        end_time = datetime.utcnow()
        execution_time_ms = int((end_time - start_time).total_seconds() * 1000)
        
        logger.error(f"Single view refresh failed for {view_name}: {str(e)}", exc_info=True)
        
        # Log the failure
        try:
            with get_db_sync() as db:
                db.execute("""
                    INSERT INTO materialized_view_refresh_log (
                        view_name, refresh_type, execution_time_ms, refreshed_at, success, error_message
                    ) VALUES (%s, %s, %s, %s, %s, %s)
                """, (view_name, 'celery_single', execution_time_ms, start_time, False, str(e)))
                db.commit()
        except Exception as log_error:
            logger.error(f"Failed to log refresh error: {log_error}")
        
        raise


@celery_app.task(bind=True, name="analytics.check_materialized_view_health")
def check_materialized_view_health(self) -> Dict[str, Any]:
    """
    Check the health of all materialized views and alert if stale.
    
    This task runs every 30 minutes to monitor view freshness and performance.
    
    Returns:
        Dictionary with health check results
    """
    task_id = self.request.id
    start_time = datetime.utcnow()
    
    logger.info(f"Starting materialized view health check (task {task_id})")
    
    try:
        from core.database import get_db_sync
        
        with get_db_sync() as db:
            # Get analytics dashboard summary
            result = db.execute("SELECT * FROM analytics_dashboard_summary ORDER BY metric_type")
            summary_rows = result.fetchall()
            
            health_status = "healthy"
            issues = []
            stale_views = []
            
            for row in summary_rows:
                # Check if views are stale (older than 2 hours)
                if row.last_refresh:
                    age = datetime.utcnow() - row.last_refresh.replace(tzinfo=None)
                    if age > timedelta(hours=2):
                        stale_views.append({
                            "view_type": row.metric_type,
                            "last_refresh": row.last_refresh.isoformat(),
                            "age_hours": round(age.total_seconds() / 3600, 1)
                        })
                        health_status = "warning"
                
                # Check for low record counts
                if row.total_records == 0:
                    issues.append(f"No records found in {row.metric_type}")
                    if health_status != "warning":
                        health_status = "warning"
            
            end_time = datetime.utcnow()
            execution_time_ms = int((end_time - start_time).total_seconds() * 1000)
            
            result = {
                "task_id": task_id,
                "checked_at": start_time.isoformat(),
                "health_status": health_status,
                "total_views": len(summary_rows),
                "stale_views": stale_views,
                "issues": issues,
                "execution_time_ms": execution_time_ms
            }
            
            # Log warnings if any issues found
            if stale_views:
                logger.warning(f"Found {len(stale_views)} stale materialized views")
            if issues:
                logger.warning(f"Health check found issues: {issues}")
            
            logger.info(f"Health check completed in {execution_time_ms}ms - Status: {health_status}")
            
            return result
            
    except Exception as e:
        logger.error(f"Materialized view health check failed: {str(e)}", exc_info=True)
        
        return {
            "task_id": task_id,
            "checked_at": start_time.isoformat(),
            "health_status": "error",
            "error": str(e),
            "execution_time_ms": int((datetime.utcnow() - start_time).total_seconds() * 1000)
        }


@celery_app.task(bind=True, name="analytics.generate_workspace_analytics_reports")
def generate_workspace_analytics_reports(self, workspace_ids: Optional[List[str]] = None) -> Dict[str, Any]:
    """
    Generate comprehensive analytics reports for workspaces.
    
    This task runs daily to create cached analytics reports for dashboard loading.
    
    Args:
        workspace_ids: Optional list of specific workspace IDs to process
        
    Returns:
        Dictionary with report generation results
    """
    task_id = self.request.id
    start_time = datetime.utcnow()
    
    logger.info(f"Starting workspace analytics report generation (task {task_id})")
    
    try:
        from core.database import get_db_sync
        
        with get_db_sync() as db:
            # Get list of active workspaces if not specified
            if workspace_ids is None:
                result = db.execute("""
                    SELECT id FROM workspaces 
                    WHERE deleted_at IS NULL 
                    ORDER BY created_at DESC
                """)
                workspace_ids = [str(row.id) for row in result.fetchall()]
            
            reports_generated = 0
            errors = []
            
            for workspace_id in workspace_ids:
                try:
                    # Generate cached analytics for this workspace
                    # This could involve creating summary tables or cached JSON
                    db.execute("""
                        INSERT INTO workspace_analytics_cache (
                            workspace_id, cached_data, generated_at
                        ) 
                        SELECT 
                            %s,
                            row_to_json(t),
                            NOW()
                        FROM (
                            SELECT * FROM workspace_analytics_summary_mv 
                            WHERE workspace_id = %s
                        ) t
                        ON CONFLICT (workspace_id) 
                        DO UPDATE SET 
                            cached_data = EXCLUDED.cached_data,
                            generated_at = EXCLUDED.generated_at
                    """, (workspace_id, workspace_id))
                    
                    reports_generated += 1
                    
                except Exception as workspace_error:
                    error_msg = f"Failed to generate report for workspace {workspace_id}: {str(workspace_error)}"
                    errors.append(error_msg)
                    logger.error(error_msg)
            
            db.commit()
            
            end_time = datetime.utcnow()
            execution_time_ms = int((end_time - start_time).total_seconds() * 1000)
            
            logger.info(f"Generated {reports_generated} analytics reports in {execution_time_ms}ms")
            
            return {
                "task_id": task_id,
                "generated_at": start_time.isoformat(),
                "completed_at": end_time.isoformat(),
                "reports_generated": reports_generated,
                "total_workspaces": len(workspace_ids),
                "errors": errors,
                "execution_time_ms": execution_time_ms
            }
            
    except Exception as e:
        logger.error(f"Analytics report generation failed: {str(e)}", exc_info=True)
        raise


@celery_app.task(bind=True, name="analytics.cleanup_old_analytics_data")
def cleanup_old_analytics_data(self, retention_days: int = 365) -> Dict[str, Any]:
    """
    Clean up old analytics data and logs.
    
    This task runs weekly to remove old materialized view refresh logs
    and other analytics metadata to prevent unbounded growth.
    
    Args:
        retention_days: Number of days to retain logs (default 365)
        
    Returns:
        Dictionary with cleanup results
    """
    task_id = self.request.id
    start_time = datetime.utcnow()
    
    logger.info(f"Starting analytics data cleanup (task {task_id})")
    
    try:
        from core.database import get_db_sync
        
        with get_db_sync() as db:
            cutoff_date = start_time - timedelta(days=retention_days)
            
            # Clean up old materialized view refresh logs
            result = db.execute("""
                DELETE FROM materialized_view_refresh_log 
                WHERE refreshed_at < %s
            """, (cutoff_date,))
            
            deleted_logs = result.rowcount
            
            # Clean up old workspace analytics cache (keep last 30 days)
            cache_cutoff = start_time - timedelta(days=30)
            result = db.execute("""
                DELETE FROM workspace_analytics_cache 
                WHERE generated_at < %s
            """, (cache_cutoff,))
            
            deleted_cache = result.rowcount
            
            db.commit()
            
            end_time = datetime.utcnow()
            execution_time_ms = int((end_time - start_time).total_seconds() * 1000)
            
            logger.info(f"Cleanup completed: {deleted_logs} logs, {deleted_cache} cache entries in {execution_time_ms}ms")
            
            return {
                "task_id": task_id,
                "cleaned_at": start_time.isoformat(),
                "retention_days": retention_days,
                "deleted_logs": deleted_logs,
                "deleted_cache_entries": deleted_cache,
                "execution_time_ms": execution_time_ms
            }
            
    except Exception as e:
        logger.error(f"Analytics cleanup failed: {str(e)}", exc_info=True)
        raise


# Scheduled task configuration for Celery Beat
ANALYTICS_TASK_SCHEDULE = {
    # Refresh all materialized views every hour
    "refresh-analytics-views-hourly": {
        "task": "analytics.refresh_all_materialized_views",
        "schedule": 3600.0,  # 1 hour
    },
    
    # Health check every 30 minutes
    "analytics-health-check": {
        "task": "analytics.check_materialized_view_health", 
        "schedule": 1800.0,  # 30 minutes
    },
    
    # Generate daily reports
    "generate-analytics-reports-daily": {
        "task": "analytics.generate_workspace_analytics_reports",
        "schedule": 86400.0,  # 24 hours
    },
    
    # Weekly cleanup
    "cleanup-analytics-data-weekly": {
        "task": "analytics.cleanup_old_analytics_data",
        "schedule": 604800.0,  # 7 days
        "args": (365,),  # Keep 1 year of logs
    },
}


# Task routing configuration
ANALYTICS_TASK_ROUTES = {
    "analytics.refresh_all_materialized_views": {"queue": "analytics"},
    "analytics.refresh_single_materialized_view": {"queue": "analytics"},
    "analytics.check_materialized_view_health": {"queue": "analytics"},
    "analytics.generate_workspace_analytics_reports": {"queue": "analytics_reports"},
    "analytics.cleanup_old_analytics_data": {"queue": "maintenance"},
}


# Manual task triggers for API endpoints
def trigger_refresh_all_views(force: bool = False) -> str:
    """Trigger immediate refresh of all materialized views."""
    task = refresh_all_materialized_views.delay(force=force)
    logger.info(f"Triggered materialized view refresh task: {task.id}")
    return task.id


def trigger_refresh_single_view(view_name: str) -> str:
    """Trigger immediate refresh of a specific materialized view."""
    task = refresh_single_materialized_view.delay(view_name)
    logger.info(f"Triggered single view refresh for {view_name}: {task.id}")
    return task.id


def trigger_health_check() -> str:
    """Trigger immediate health check of materialized views."""
    task = check_materialized_view_health.delay()
    logger.info(f"Triggered health check task: {task.id}")
    return task.id


def trigger_analytics_reports(workspace_ids: Optional[List[str]] = None) -> str:
    """Trigger immediate analytics report generation."""
    task = generate_workspace_analytics_reports.delay(workspace_ids)
    logger.info(f"Triggered analytics reports generation: {task.id}")
    return task.id


def trigger_analytics_cleanup(retention_days: int = 365) -> str:
    """Trigger immediate analytics data cleanup."""
    task = cleanup_old_analytics_data.delay(retention_days)
    logger.info(f"Triggered analytics cleanup task: {task.id}")
    return task.id


if __name__ == "__main__":
    # Test task execution
    print("Testing analytics tasks...")
    
    # Test health check
    result = check_materialized_view_health()
    print(f"Health check result: {result}")
    
    # Test single view refresh
    result = refresh_single_materialized_view("campaign_performance_analytics_mv")
    print(f"Single view refresh result: {result}")