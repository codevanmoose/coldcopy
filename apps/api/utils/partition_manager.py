"""
PostgreSQL Partition Management for ColdCopy Email Events.

This module provides automated partition management for the email_events table,
including creation, maintenance, and cleanup of monthly partitions.
"""
import logging
import asyncio
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from core.database import get_db

logger = logging.getLogger(__name__)


@dataclass
class PartitionInfo:
    """Information about a table partition."""
    name: str
    period: str
    record_count: int
    size_mb: float
    oldest_record: Optional[datetime]
    newest_record: Optional[datetime]


@dataclass
class PartitionMaintenanceResult:
    """Result of partition maintenance operation."""
    created_partitions: List[str]
    dropped_partitions: List[Tuple[str, int]]  # (name, record_count)
    errors: List[str]
    execution_time_ms: int


class EmailEventsPartitionManager:
    """Manages PostgreSQL partitions for the email_events table."""
    
    def __init__(self, db_session: AsyncSession):
        self.db = db_session
        self.table_name = "email_events"
        self.retention_months = 12  # Default retention period
    
    async def create_partition(
        self, 
        partition_start: datetime, 
        partition_end: datetime
    ) -> bool:
        """
        Create a single monthly partition for the specified date range.
        
        Args:
            partition_start: Start date for the partition (inclusive)
            partition_end: End date for the partition (exclusive)
            
        Returns:
            True if partition was created successfully, False otherwise
        """
        try:
            result = await self.db.execute(
                text("SELECT create_email_events_partition(:start_date, :end_date)"),
                {
                    "start_date": partition_start.date(),
                    "end_date": partition_end.date()
                }
            )
            await self.db.commit()
            
            partition_name = f"email_events_{partition_start.strftime('%Y_%m')}"
            logger.info(f"Successfully created partition: {partition_name}")
            return True
            
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Failed to create partition for {partition_start}: {e}")
            return False
    
    async def maintain_partitions(self, months_ahead: int = 6) -> PartitionMaintenanceResult:
        """
        Maintain partitions by creating future partitions and optionally cleaning old ones.
        
        Args:
            months_ahead: Number of months ahead to create partitions for
            
        Returns:
            PartitionMaintenanceResult with details of the operation
        """
        start_time = datetime.now()
        created_partitions = []
        errors = []
        
        try:
            # Call the database function to maintain partitions
            await self.db.execute(text("SELECT maintain_email_events_partitions()"))
            await self.db.commit()
            
            # Get list of created partitions by checking recent ones
            current_month = datetime.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            for i in range(months_ahead + 1):
                future_month = current_month + timedelta(days=32*i)
                future_month = future_month.replace(day=1)
                partition_name = f"email_events_{future_month.strftime('%Y_%m')}"
                created_partitions.append(partition_name)
            
            logger.info(f"Partition maintenance completed. Created/verified {len(created_partitions)} partitions")
            
        except Exception as e:
            await self.db.rollback()
            error_msg = f"Failed to maintain partitions: {e}"
            logger.error(error_msg)
            errors.append(error_msg)
        
        execution_time = int((datetime.now() - start_time).total_seconds() * 1000)
        
        return PartitionMaintenanceResult(
            created_partitions=created_partitions,
            dropped_partitions=[],
            errors=errors,
            execution_time_ms=execution_time
        )
    
    async def cleanup_old_partitions(
        self, 
        retention_months: Optional[int] = None
    ) -> PartitionMaintenanceResult:
        """
        Clean up old partitions beyond the retention period.
        
        Args:
            retention_months: Number of months to retain (default: 12)
            
        Returns:
            PartitionMaintenanceResult with details of dropped partitions
        """
        start_time = datetime.now()
        dropped_partitions = []
        errors = []
        
        if retention_months is None:
            retention_months = self.retention_months
        
        try:
            # Call the cleanup function
            result = await self.db.execute(
                text("SELECT * FROM cleanup_old_email_events_partitions(:retention_months)"),
                {"retention_months": retention_months}
            )
            
            # Process results
            for row in result.fetchall():
                dropped_partitions.append((row.dropped_partition, row.record_count))
            
            await self.db.commit()
            
            logger.info(f"Cleanup completed. Dropped {len(dropped_partitions)} old partitions")
            
        except Exception as e:
            await self.db.rollback()
            error_msg = f"Failed to cleanup old partitions: {e}"
            logger.error(error_msg)
            errors.append(error_msg)
        
        execution_time = int((datetime.now() - start_time).total_seconds() * 1000)
        
        return PartitionMaintenanceResult(
            created_partitions=[],
            dropped_partitions=dropped_partitions,
            errors=errors,
            execution_time_ms=execution_time
        )
    
    async def get_partition_stats(self) -> List[PartitionInfo]:
        """
        Get statistics for all email_events partitions.
        
        Returns:
            List of PartitionInfo objects with partition statistics
        """
        try:
            result = await self.db.execute(
                text("SELECT * FROM get_email_events_partition_stats() ORDER BY partition_name")
            )
            
            partitions = []
            for row in result.fetchall():
                partitions.append(PartitionInfo(
                    name=row.partition_name,
                    period=row.period,
                    record_count=row.record_count,
                    size_mb=float(row.size_mb),
                    oldest_record=row.oldest_record,
                    newest_record=row.newest_record
                ))
            
            return partitions
            
        except Exception as e:
            logger.error(f"Failed to get partition stats: {e}")
            return []
    
    async def get_partition_info_view(self) -> List[Dict]:
        """
        Get partition information from the database view.
        
        Returns:
            List of dictionaries with partition information
        """
        try:
            result = await self.db.execute(
                text("SELECT * FROM email_events_partition_info ORDER BY partition_name")
            )
            
            partitions = []
            for row in result.fetchall():
                partitions.append({
                    "schema": row.schemaname,
                    "partition_name": row.partition_name,
                    "period": row.partition_period,
                    "size_bytes": row.size_bytes,
                    "size_pretty": row.size_pretty,
                    "estimated_rows": row.row_estimate
                })
            
            return partitions
            
        except Exception as e:
            logger.error(f"Failed to get partition info: {e}")
            return []
    
    async def log_maintenance_operation(
        self, 
        operation_type: str,
        partition_name: Optional[str] = None,
        details: Optional[Dict] = None,
        success: bool = True,
        error_message: Optional[str] = None,
        execution_time_ms: Optional[int] = None
    ):
        """
        Log partition maintenance operations for auditing.
        
        Args:
            operation_type: Type of operation ('create', 'cleanup', 'maintenance')
            partition_name: Name of the partition affected
            details: Additional details as JSON
            success: Whether the operation was successful
            error_message: Error message if operation failed
            execution_time_ms: Execution time in milliseconds
        """
        try:
            await self.db.execute(
                text("""
                    INSERT INTO partition_maintenance_log 
                    (operation_type, partition_name, details, success, error_message, execution_time_ms)
                    VALUES (:op_type, :partition, :details, :success, :error, :exec_time)
                """),
                {
                    "op_type": operation_type,
                    "partition": partition_name,
                    "details": details or {},
                    "success": success,
                    "error": error_message,
                    "exec_time": execution_time_ms
                }
            )
            await self.db.commit()
            
        except Exception as e:
            logger.error(f"Failed to log maintenance operation: {e}")
    
    async def check_partition_health(self) -> Dict[str, any]:
        """
        Check the health of the partitioning system.
        
        Returns:
            Dictionary with health status and recommendations
        """
        health_info = {
            "status": "healthy",
            "issues": [],
            "recommendations": [],
            "partition_count": 0,
            "total_size_mb": 0,
            "oldest_partition": None,
            "newest_partition": None
        }
        
        try:
            partitions = await self.get_partition_stats()
            
            if not partitions:
                health_info["status"] = "warning"
                health_info["issues"].append("No partitions found")
                return health_info
            
            health_info["partition_count"] = len(partitions)
            health_info["total_size_mb"] = sum(p.size_mb for p in partitions)
            
            # Sort partitions by name to get oldest and newest
            sorted_partitions = sorted(partitions, key=lambda x: x.name)
            health_info["oldest_partition"] = sorted_partitions[0].name
            health_info["newest_partition"] = sorted_partitions[-1].name
            
            # Check for potential issues
            current_month = datetime.now().strftime("%Y_%m")
            current_partition = f"email_events_{current_month}"
            
            if not any(p.name == current_partition for p in partitions):
                health_info["status"] = "critical"
                health_info["issues"].append(f"Missing current month partition: {current_partition}")
            
            # Check if we have future partitions
            future_months = []
            base_date = datetime.now()
            for i in range(1, 4):  # Check next 3 months
                future_date = base_date + timedelta(days=32*i)
                future_month = future_date.strftime("%Y_%m")
                future_partition = f"email_events_{future_month}"
                if any(p.name == future_partition for p in partitions):
                    future_months.append(future_partition)
            
            if len(future_months) < 2:
                health_info["status"] = "warning"
                health_info["recommendations"].append("Consider creating more future partitions")
            
            # Check for oversized partitions
            large_partitions = [p for p in partitions if p.size_mb > 1000]  # > 1GB
            if large_partitions:
                health_info["recommendations"].append(
                    f"Large partitions detected: {[p.name for p in large_partitions]}"
                )
            
        except Exception as e:
            health_info["status"] = "error"
            health_info["issues"].append(f"Health check failed: {e}")
        
        return health_info


# Utility functions for scheduled maintenance
async def scheduled_partition_maintenance():
    """
    Scheduled function for partition maintenance.
    Should be called by cron or task scheduler.
    """
    async for db in get_db():
        try:
            manager = EmailEventsPartitionManager(db)
            
            # Perform maintenance
            result = await manager.maintain_partitions(months_ahead=6)
            
            # Log the operation
            await manager.log_maintenance_operation(
                operation_type="scheduled_maintenance",
                details={
                    "created_partitions": result.created_partitions,
                    "errors": result.errors
                },
                success=len(result.errors) == 0,
                error_message="; ".join(result.errors) if result.errors else None,
                execution_time_ms=result.execution_time_ms
            )
            
            logger.info(f"Scheduled partition maintenance completed: {result}")
            
        except Exception as e:
            logger.error(f"Scheduled partition maintenance failed: {e}")
        finally:
            await db.close()


async def scheduled_partition_cleanup(retention_months: int = 12):
    """
    Scheduled function for partition cleanup.
    Should be called monthly or as needed.
    """
    async for db in get_db():
        try:
            manager = EmailEventsPartitionManager(db)
            
            # Perform cleanup
            result = await manager.cleanup_old_partitions(retention_months)
            
            # Log the operation
            await manager.log_maintenance_operation(
                operation_type="scheduled_cleanup",
                details={
                    "dropped_partitions": result.dropped_partitions,
                    "retention_months": retention_months,
                    "errors": result.errors
                },
                success=len(result.errors) == 0,
                error_message="; ".join(result.errors) if result.errors else None,
                execution_time_ms=result.execution_time_ms
            )
            
            logger.info(f"Scheduled partition cleanup completed: {result}")
            
        except Exception as e:
            logger.error(f"Scheduled partition cleanup failed: {e}")
        finally:
            await db.close()


# Command-line interface for manual partition management
if __name__ == "__main__":
    import sys
    
    async def main():
        if len(sys.argv) < 2:
            print("Usage: python partition_manager.py [maintain|cleanup|stats|health]")
            return
        
        command = sys.argv[1].lower()
        
        async for db in get_db():
            try:
                manager = EmailEventsPartitionManager(db)
                
                if command == "maintain":
                    result = await manager.maintain_partitions()
                    print(f"Maintenance result: {result}")
                    
                elif command == "cleanup":
                    retention = int(sys.argv[2]) if len(sys.argv) > 2 else 12
                    result = await manager.cleanup_old_partitions(retention)
                    print(f"Cleanup result: {result}")
                    
                elif command == "stats":
                    stats = await manager.get_partition_stats()
                    for stat in stats:
                        print(f"{stat.name}: {stat.record_count} records, {stat.size_mb}MB")
                        
                elif command == "health":
                    health = await manager.check_partition_health()
                    print(f"Health status: {health}")
                    
                else:
                    print(f"Unknown command: {command}")
                    
            finally:
                await db.close()
    
    asyncio.run(main())