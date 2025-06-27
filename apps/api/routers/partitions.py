"""
API endpoints for partition management and monitoring.
"""
from typing import List, Dict, Optional
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from core.database import get_db
from core.security import get_current_user, require_admin
from utils.partition_manager import EmailEventsPartitionManager, PartitionInfo, PartitionMaintenanceResult
from models.user import User

router = APIRouter(prefix="/api/system/partitions", tags=["system", "partitions"])


class PartitionStatsResponse(BaseModel):
    """Response model for partition statistics."""
    name: str
    period: str
    record_count: int
    size_mb: float
    oldest_record: Optional[str] = None
    newest_record: Optional[str] = None


class PartitionHealthResponse(BaseModel):
    """Response model for partition health check."""
    status: str  # healthy, warning, critical, error
    issues: List[str]
    recommendations: List[str]
    partition_count: int
    total_size_mb: float
    oldest_partition: Optional[str] = None
    newest_partition: Optional[str] = None


class PartitionMaintenanceResponse(BaseModel):
    """Response model for partition maintenance operations."""
    success: bool
    created_partitions: List[str]
    dropped_partitions: List[tuple]  # [(name, record_count), ...]
    errors: List[str]
    execution_time_ms: int


class PartitionInfoResponse(BaseModel):
    """Response model for partition information view."""
    schema: str
    partition_name: str
    period: str
    size_bytes: int
    size_pretty: str
    estimated_rows: int


@router.get("/stats", response_model=List[PartitionStatsResponse])
async def get_partition_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Get statistics for all email_events partitions.
    
    Requires admin privileges.
    """
    try:
        manager = EmailEventsPartitionManager(db)
        stats = await manager.get_partition_stats()
        
        return [
            PartitionStatsResponse(
                name=stat.name,
                period=stat.period,
                record_count=stat.record_count,
                size_mb=stat.size_mb,
                oldest_record=stat.oldest_record.isoformat() if stat.oldest_record else None,
                newest_record=stat.newest_record.isoformat() if stat.newest_record else None
            )
            for stat in stats
        ]
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get partition stats: {str(e)}"
        )


@router.get("/info", response_model=List[PartitionInfoResponse])
async def get_partition_info(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Get partition information from database view.
    
    Requires admin privileges.
    """
    try:
        manager = EmailEventsPartitionManager(db)
        info = await manager.get_partition_info_view()
        
        return [
            PartitionInfoResponse(
                schema=item["schema"],
                partition_name=item["partition_name"],
                period=item["period"],
                size_bytes=item["size_bytes"],
                size_pretty=item["size_pretty"],
                estimated_rows=item["estimated_rows"]
            )
            for item in info
        ]
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get partition info: {str(e)}"
        )


@router.get("/health", response_model=PartitionHealthResponse)
async def check_partition_health(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Check the health of the partitioning system.
    
    Requires admin privileges.
    """
    try:
        manager = EmailEventsPartitionManager(db)
        health = await manager.check_partition_health()
        
        return PartitionHealthResponse(
            status=health["status"],
            issues=health["issues"],
            recommendations=health["recommendations"],
            partition_count=health["partition_count"],
            total_size_mb=health["total_size_mb"],
            oldest_partition=health["oldest_partition"],
            newest_partition=health["newest_partition"]
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to check partition health: {str(e)}"
        )


@router.post("/maintain", response_model=PartitionMaintenanceResponse)
async def maintain_partitions(
    background_tasks: BackgroundTasks,
    months_ahead: int = 6,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Trigger partition maintenance to create future partitions.
    
    Args:
        months_ahead: Number of months ahead to create partitions for (default: 6)
        
    Requires admin privileges.
    """
    if months_ahead < 1 or months_ahead > 12:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="months_ahead must be between 1 and 12"
        )
    
    try:
        manager = EmailEventsPartitionManager(db)
        result = await manager.maintain_partitions(months_ahead)
        
        # Log the operation in background
        background_tasks.add_task(
            manager.log_maintenance_operation,
            operation_type="manual_maintenance",
            details={
                "months_ahead": months_ahead,
                "triggered_by": current_user.email,
                "created_partitions": result.created_partitions
            },
            success=len(result.errors) == 0,
            error_message="; ".join(result.errors) if result.errors else None,
            execution_time_ms=result.execution_time_ms
        )
        
        return PartitionMaintenanceResponse(
            success=len(result.errors) == 0,
            created_partitions=result.created_partitions,
            dropped_partitions=result.dropped_partitions,
            errors=result.errors,
            execution_time_ms=result.execution_time_ms
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to maintain partitions: {str(e)}"
        )


@router.post("/cleanup", response_model=PartitionMaintenanceResponse)
async def cleanup_old_partitions(
    background_tasks: BackgroundTasks,
    retention_months: int = 12,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Clean up old partitions beyond the retention period.
    
    Args:
        retention_months: Number of months to retain (default: 12)
        
    Requires admin privileges.
    """
    if retention_months < 1 or retention_months > 60:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="retention_months must be between 1 and 60"
        )
    
    try:
        manager = EmailEventsPartitionManager(db)
        result = await manager.cleanup_old_partitions(retention_months)
        
        # Log the operation in background
        background_tasks.add_task(
            manager.log_maintenance_operation,
            operation_type="manual_cleanup",
            details={
                "retention_months": retention_months,
                "triggered_by": current_user.email,
                "dropped_partitions": result.dropped_partitions
            },
            success=len(result.errors) == 0,
            error_message="; ".join(result.errors) if result.errors else None,
            execution_time_ms=result.execution_time_ms
        )
        
        return PartitionMaintenanceResponse(
            success=len(result.errors) == 0,
            created_partitions=result.created_partitions,
            dropped_partitions=result.dropped_partitions,
            errors=result.errors,
            execution_time_ms=result.execution_time_ms
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to cleanup partitions: {str(e)}"
        )


@router.get("/maintenance-log")
async def get_partition_maintenance_log(
    limit: int = 50,
    offset: int = 0,
    operation_type: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Get partition maintenance operation logs.
    
    Args:
        limit: Maximum number of records to return (default: 50)
        offset: Number of records to skip (default: 0)
        operation_type: Filter by operation type (optional)
        
    Requires admin privileges.
    """
    try:
        from sqlalchemy import text
        
        # Build query based on filters
        where_clause = ""
        params = {"limit": limit, "offset": offset}
        
        if operation_type:
            where_clause = "WHERE operation_type = :operation_type"
            params["operation_type"] = operation_type
        
        query = f"""
            SELECT id, operation_type, partition_name, details, success, 
                   error_message, execution_time_ms, created_at
            FROM partition_maintenance_log
            {where_clause}
            ORDER BY created_at DESC
            LIMIT :limit OFFSET :offset
        """
        
        result = await db.execute(text(query), params)
        
        logs = []
        for row in result.fetchall():
            logs.append({
                "id": str(row.id),
                "operation_type": row.operation_type,
                "partition_name": row.partition_name,
                "details": row.details,
                "success": row.success,
                "error_message": row.error_message,
                "execution_time_ms": row.execution_time_ms,
                "created_at": row.created_at.isoformat()
            })
        
        # Get total count
        count_query = f"""
            SELECT COUNT(*) as total
            FROM partition_maintenance_log
            {where_clause}
        """
        
        count_params = {}
        if operation_type:
            count_params["operation_type"] = operation_type
            
        count_result = await db.execute(text(count_query), count_params)
        total = count_result.scalar()
        
        return {
            "logs": logs,
            "total": total,
            "limit": limit,
            "offset": offset
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get maintenance logs: {str(e)}"
        )


@router.get("/summary")
async def get_partition_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Get a summary of partition system status.
    
    Requires admin privileges.
    """
    try:
        manager = EmailEventsPartitionManager(db)
        
        # Get health check
        health = await manager.check_partition_health()
        
        # Get basic stats
        stats = await manager.get_partition_stats()
        
        # Calculate summary metrics
        total_records = sum(stat.record_count for stat in stats)
        avg_size_mb = sum(stat.size_mb for stat in stats) / len(stats) if stats else 0
        
        # Get recent maintenance activity
        from sqlalchemy import text
        recent_activity = await db.execute(
            text("""
                SELECT operation_type, COUNT(*) as count, 
                       MAX(created_at) as last_run,
                       AVG(execution_time_ms) as avg_execution_time
                FROM partition_maintenance_log
                WHERE created_at > NOW() - INTERVAL '30 days'
                GROUP BY operation_type
                ORDER BY last_run DESC
            """)
        )
        
        activity_summary = []
        for row in recent_activity.fetchall():
            activity_summary.append({
                "operation_type": row.operation_type,
                "count": row.count,
                "last_run": row.last_run.isoformat() if row.last_run else None,
                "avg_execution_time_ms": float(row.avg_execution_time) if row.avg_execution_time else 0
            })
        
        return {
            "health": health,
            "metrics": {
                "total_partitions": len(stats),
                "total_records": total_records,
                "total_size_mb": sum(stat.size_mb for stat in stats),
                "avg_partition_size_mb": round(avg_size_mb, 2)
            },
            "recent_activity": activity_summary
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get partition summary: {str(e)}"
        )