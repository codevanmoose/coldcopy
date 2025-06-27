"""
API endpoints for database optimization and index management.

This module provides admin-only endpoints for monitoring and optimizing
database performance, including index analysis and recommendations.
"""
from typing import List, Dict, Optional, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from core.database import get_db
from core.security import get_current_user
from utils.index_monitor import (
    IndexMonitor, 
    quick_index_check,
    optimize_table_indexes,
    IndexInfo,
    TableStats,
    IndexRecommendation
)
from models.user import User

router = APIRouter(prefix="/api/system/database", tags=["database-optimization"])


# Response Models
class IndexUsageResponse(BaseModel):
    """Index usage statistics response."""
    schema_name: str
    table_name: str
    index_name: str
    index_size: str
    scan_count: int
    tuples_read: int
    status: str
    columns: List[str]


class TableStatsResponse(BaseModel):
    """Table statistics response."""
    table_name: str
    row_count: int
    table_size: str
    sequential_scans: int
    index_scans: int
    sequential_scan_ratio: float
    needs_indexing: bool


class IndexRecommendationResponse(BaseModel):
    """Index recommendation response."""
    table_name: str
    columns: List[str]
    reason: str
    estimated_improvement: str
    priority: str
    create_statement: str


class IndexHealthSummary(BaseModel):
    """Index health summary response."""
    timestamp: str
    total_indexes: int
    unused_indexes: int
    bloated_indexes: int
    total_index_size: int
    status: str


class MaintenanceCommandResponse(BaseModel):
    """Database maintenance command response."""
    command_type: str
    target: str
    sql: str
    estimated_impact: str
    priority: str


class OptimizationReportResponse(BaseModel):
    """Comprehensive optimization report response."""
    generated_at: str
    summary: Dict[str, int]
    recommendations: List[IndexRecommendationResponse]
    maintenance_needed: List[Dict[str, Any]]
    slow_queries: List[Dict[str, Any]]


@router.get("/indexes/usage", response_model=List[IndexUsageResponse])
async def get_index_usage(
    table_name: Optional[str] = Query(None, description="Filter by table name"),
    include_unused: bool = Query(True, description="Include unused indexes"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get index usage statistics for all tables.
    
    Requires admin privileges.
    """
    # Check admin privileges
    if current_user.role not in ["admin", "super_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions for database optimization"
        )
    
    try:
        monitor = IndexMonitor(db)
        index_stats = await monitor.get_index_usage_stats()
        
        # Filter by table if specified
        if table_name:
            index_stats = [idx for idx in index_stats if idx.table_name == table_name]
        
        # Filter unused indexes if requested
        if not include_unused:
            index_stats = [idx for idx in index_stats if idx.scan_count > 0]
        
        return [
            IndexUsageResponse(
                schema_name=idx.schema_name,
                table_name=idx.table_name,
                index_name=idx.index_name,
                index_size=idx.index_size,
                scan_count=idx.scan_count,
                tuples_read=idx.tuples_read,
                status=idx.status.value,
                columns=idx.columns
            )
            for idx in index_stats
        ]
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get index usage: {str(e)}"
        )


@router.get("/tables/stats", response_model=List[TableStatsResponse])
async def get_table_statistics(
    min_size_mb: int = Query(10, ge=1, description="Minimum table size in MB"),
    only_problematic: bool = Query(False, description="Only show tables needing optimization"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get table statistics to identify optimization opportunities.
    
    Requires admin privileges.
    """
    if current_user.role not in ["admin", "super_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions"
        )
    
    try:
        monitor = IndexMonitor(db)
        table_stats = await monitor.get_table_statistics(min_size_mb)
        
        # Filter if requested
        if only_problematic:
            table_stats = [t for t in table_stats if t.needs_indexing]
        
        return [
            TableStatsResponse(
                table_name=table.table_name,
                row_count=table.row_count,
                table_size=table.table_size,
                sequential_scans=table.sequential_scans,
                index_scans=table.index_scans,
                sequential_scan_ratio=table.sequential_scan_ratio,
                needs_indexing=table.needs_indexing
            )
            for table in table_stats
        ]
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get table statistics: {str(e)}"
        )


@router.get("/indexes/recommendations", response_model=List[IndexRecommendationResponse])
async def get_index_recommendations(
    priority: Optional[str] = Query(None, regex="^(high|medium|low)$"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get index creation recommendations based on usage patterns.
    
    Requires admin privileges.
    """
    if current_user.role not in ["admin", "super_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions"
        )
    
    try:
        monitor = IndexMonitor(db)
        recommendations = await monitor.get_index_recommendations()
        
        # Filter by priority if specified
        if priority:
            recommendations = [r for r in recommendations if r.priority == priority]
        
        return [
            IndexRecommendationResponse(
                table_name=rec.table_name,
                columns=rec.columns,
                reason=rec.reason,
                estimated_improvement=rec.estimated_improvement,
                priority=rec.priority,
                create_statement=rec.create_statement
            )
            for rec in recommendations
        ]
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get index recommendations: {str(e)}"
        )


@router.get("/indexes/health", response_model=IndexHealthSummary)
async def get_index_health_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get quick index health summary.
    
    Requires admin privileges.
    """
    if current_user.role not in ["admin", "super_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions"
        )
    
    try:
        health_check = await quick_index_check(db)
        
        return IndexHealthSummary(**health_check)
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get index health: {str(e)}"
        )


@router.get("/indexes/bloat")
async def check_index_bloat(
    bloat_threshold: float = Query(0.2, ge=0.1, le=0.9, description="Bloat threshold (0.2 = 20%)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Check for bloated indexes that need maintenance.
    
    Requires admin privileges.
    """
    if current_user.role not in ["admin", "super_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions"
        )
    
    try:
        monitor = IndexMonitor(db)
        bloated_indexes = await monitor.check_index_bloat(bloat_threshold)
        
        return {
            "bloated_indexes": bloated_indexes,
            "total_count": len(bloated_indexes),
            "threshold_used": bloat_threshold,
            "recommendation": "Run REINDEX CONCURRENTLY for bloated indexes during low-traffic periods"
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to check index bloat: {str(e)}"
        )


@router.get("/optimization/report", response_model=OptimizationReportResponse)
async def get_optimization_report(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Generate comprehensive database optimization report.
    
    This may take a while to generate. Requires admin privileges.
    """
    if current_user.role not in ["admin", "super_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions"
        )
    
    try:
        monitor = IndexMonitor(db)
        report = await monitor.generate_index_report()
        
        if "error" in report:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=report["error"]
            )
        
        # Transform recommendations for response
        recommendations = []
        for rec in report.get("recommendations", []):
            recommendations.append(IndexRecommendationResponse(
                table_name=rec["table"],
                columns=rec["columns"],
                reason=rec["reason"],
                estimated_improvement="See detailed report",
                priority=rec["priority"],
                create_statement=rec["sql"]
            ))
        
        return OptimizationReportResponse(
            generated_at=report["generated_at"],
            summary=report["summary"],
            recommendations=recommendations,
            maintenance_needed=report.get("maintenance_needed", []),
            slow_queries=report.get("slow_queries", [])
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate optimization report: {str(e)}"
        )


@router.get("/maintenance/commands", response_model=List[MaintenanceCommandResponse])
async def get_maintenance_commands(
    include_reindex: bool = Query(True, description="Include REINDEX commands"),
    include_vacuum: bool = Query(True, description="Include VACUUM commands"),
    include_analyze: bool = Query(True, description="Include ANALYZE commands"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get recommended database maintenance commands.
    
    Requires admin privileges.
    """
    if current_user.role not in ["admin", "super_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions"
        )
    
    try:
        monitor = IndexMonitor(db)
        commands = []
        
        if include_reindex:
            # Get bloated indexes
            bloated = await monitor.check_index_bloat()
            for idx in bloated[:5]:  # Limit to top 5
                commands.append(MaintenanceCommandResponse(
                    command_type="REINDEX",
                    target=idx["index_name"],
                    sql=f"REINDEX INDEX CONCURRENTLY {idx['index_name']};",
                    estimated_impact=f"Recovers {idx['bloat_size']} of space",
                    priority="medium"
                ))
        
        if include_vacuum:
            # Get tables needing vacuum
            table_stats = await monitor.get_table_statistics()
            for table in table_stats[:5]:  # Limit to top 5
                if table.last_vacuum is None or (datetime.utcnow() - table.last_vacuum).days > 7:
                    commands.append(MaintenanceCommandResponse(
                        command_type="VACUUM",
                        target=table.table_name,
                        sql=f"VACUUM ANALYZE {table.table_name};",
                        estimated_impact="Recovers dead tuples and updates statistics",
                        priority="low"
                    ))
        
        if include_analyze:
            # Always good to update statistics
            commands.append(MaintenanceCommandResponse(
                command_type="ANALYZE",
                target="all tables",
                sql="ANALYZE;",
                estimated_impact="Updates query planner statistics",
                priority="low"
            ))
        
        return commands
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get maintenance commands: {str(e)}"
        )


@router.post("/optimize/table/{table_name}")
async def optimize_specific_table(
    table_name: str,
    execute: bool = Query(False, description="Execute the optimization commands"),
    background_tasks: BackgroundTasks = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get or execute optimization commands for a specific table.
    
    Requires admin privileges.
    """
    if current_user.role not in ["admin", "super_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions"
        )
    
    try:
        # Get optimization commands
        commands = await optimize_table_indexes(db, table_name)
        
        if not commands:
            return {
                "table": table_name,
                "status": "optimal",
                "message": "No optimization needed for this table"
            }
        
        if execute:
            # Execute commands in background
            if background_tasks:
                for cmd in commands:
                    background_tasks.add_task(execute_sql_command, db, cmd)
            
            return {
                "table": table_name,
                "status": "optimizing",
                "message": f"Executing {len(commands)} optimization commands in background",
                "commands": commands
            }
        else:
            return {
                "table": table_name,
                "status": "recommendations",
                "message": f"Found {len(commands)} optimization opportunities",
                "commands": commands
            }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to optimize table: {str(e)}"
        )


@router.get("/slow-queries")
async def get_slow_queries(
    min_duration_ms: int = Query(100, ge=10, description="Minimum query duration in ms"),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get slow queries for analysis.
    
    Requires admin privileges and pg_stat_statements extension.
    """
    if current_user.role not in ["admin", "super_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions"
        )
    
    try:
        monitor = IndexMonitor(db)
        slow_queries = await monitor.analyze_slow_queries(min_duration_ms)
        
        # Limit results
        slow_queries = slow_queries[:limit]
        
        return {
            "slow_queries": [
                {
                    "query": q.query_sample[:200] + "..." if len(q.query_sample) > 200 else q.query_sample,
                    "mean_time_ms": q.mean_time_ms,
                    "max_time_ms": q.max_time_ms,
                    "total_calls": q.total_calls,
                    "hit_ratio": q.hit_ratio,
                    "suggested_indexes": q.suggested_indexes
                }
                for q in slow_queries
            ],
            "total_count": len(slow_queries),
            "min_duration_ms": min_duration_ms
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to analyze slow queries: {str(e)}"
        )


# Helper function for background execution
async def execute_sql_command(db: AsyncSession, command: str):
    """Execute SQL command in background."""
    try:
        await db.execute(text(command))
        await db.commit()
        logger.info(f"Successfully executed: {command}")
    except Exception as e:
        logger.error(f"Failed to execute {command}: {str(e)}")
        await db.rollback()


# Import necessary modules at the top
from datetime import datetime
from sqlalchemy import text
import logging

logger = logging.getLogger(__name__)