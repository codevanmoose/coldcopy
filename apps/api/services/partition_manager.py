"""
Automated Partition Management Service
Handles creation and cleanup of database partitions
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any

import asyncpg
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

logger = logging.getLogger(__name__)


class PartitionManager:
    """Manages database partitions for time-series data"""
    
    def __init__(self, database_url: str):
        self.database_url = database_url
        self.pool: asyncpg.Pool = None
        self.scheduler = AsyncIOScheduler()
        
        # Configuration
        self.partitioned_tables = [
            {
                'table': 'email_events',
                'partition_by': 'month',
                'retention_months': 12,
                'future_partitions': 3,
            },
            {
                'table': 'audit_logs',
                'partition_by': 'month',
                'retention_months': 24,
                'future_partitions': 2,
            },
            {
                'table': 'email_webhook_events',
                'partition_by': 'month',
                'retention_months': 6,
                'future_partitions': 2,
            }
        ]
    
    async def initialize(self):
        """Initialize the partition manager"""
        self.pool = await asyncpg.create_pool(self.database_url)
        
        # Schedule partition maintenance
        self.scheduler.add_job(
            self.maintain_all_partitions,
            trigger=CronTrigger(day=1, hour=2, minute=0),  # Run on 1st of each month at 2 AM
            id='maintain_partitions',
            replace_existing=True
        )
        
        # Schedule analytics refresh
        self.scheduler.add_job(
            self.refresh_materialized_views,
            trigger=CronTrigger(hour='*/1'),  # Every hour
            id='refresh_analytics_hourly',
            replace_existing=True
        )
        
        self.scheduler.add_job(
            self.refresh_daily_views,
            trigger=CronTrigger(hour=3, minute=0),  # Daily at 3 AM
            id='refresh_analytics_daily',
            replace_existing=True
        )
        
        self.scheduler.start()
        logger.info("Partition manager initialized")
    
    async def shutdown(self):
        """Shutdown the partition manager"""
        self.scheduler.shutdown()
        if self.pool:
            await self.pool.close()
    
    async def maintain_all_partitions(self):
        """Maintain partitions for all configured tables"""
        async with self.pool.acquire() as conn:
            for table_config in self.partitioned_tables:
                try:
                    await self.maintain_table_partitions(conn, table_config)
                except Exception as e:
                    logger.error(f"Failed to maintain partitions for {table_config['table']}: {e}")
    
    async def maintain_table_partitions(self, conn: asyncpg.Connection, config: Dict[str, Any]):
        """Maintain partitions for a specific table"""
        table_name = config['table']
        retention_months = config['retention_months']
        future_partitions = config['future_partitions']
        
        logger.info(f"Maintaining partitions for {table_name}")
        
        # Create future partitions
        await self.create_future_partitions(conn, table_name, future_partitions)
        
        # Drop old partitions
        await self.drop_old_partitions(conn, table_name, retention_months)
        
        # Analyze parent table for query planning
        await conn.execute(f"ANALYZE {table_name}")
    
    async def create_future_partitions(self, conn: asyncpg.Connection, table_name: str, months_ahead: int):
        """Create partitions for future months"""
        current_date = datetime.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        
        for i in range(months_ahead + 1):
            partition_date = current_date + timedelta(days=32 * i)
            partition_date = partition_date.replace(day=1)
            
            partition_name = f"{table_name}_{partition_date.strftime('%Y_%m')}"
            start_date = partition_date.strftime('%Y-%m-%d')
            end_date = (partition_date + timedelta(days=32)).replace(day=1).strftime('%Y-%m-%d')
            
            # Check if partition exists
            exists = await conn.fetchval(
                """
                SELECT EXISTS (
                    SELECT 1 FROM pg_class c
                    JOIN pg_namespace n ON n.oid = c.relnamespace
                    WHERE c.relname = $1 AND n.nspname = 'public'
                )
                """,
                partition_name
            )
            
            if not exists:
                # Create partition
                await conn.execute(f"""
                    CREATE TABLE {partition_name} PARTITION OF {table_name}
                    FOR VALUES FROM ('{start_date}') TO ('{end_date}')
                """)
                
                # Create partition-specific indexes
                await self.create_partition_indexes(conn, table_name, partition_name)
                
                logger.info(f"Created partition {partition_name}")
    
    async def create_partition_indexes(self, conn: asyncpg.Connection, table_name: str, partition_name: str):
        """Create indexes specific to a partition"""
        if table_name == 'email_events':
            await conn.execute(f"""
                CREATE INDEX IF NOT EXISTS {partition_name}_workspace_event_idx 
                ON {partition_name} (workspace_id, event_type)
            """)
            await conn.execute(f"""
                CREATE INDEX IF NOT EXISTS {partition_name}_campaign_idx 
                ON {partition_name} (campaign_id, created_at DESC)
            """)
    
    async def drop_old_partitions(self, conn: asyncpg.Connection, table_name: str, retention_months: int):
        """Drop partitions older than retention period"""
        cutoff_date = datetime.now() - timedelta(days=retention_months * 30)
        cutoff_partition = f"{table_name}_{cutoff_date.strftime('%Y_%m')}"
        
        # Get list of partitions to drop
        partitions = await conn.fetch("""
            SELECT tablename 
            FROM pg_tables 
            WHERE schemaname = 'public' 
            AND tablename LIKE $1 || '_%'
            AND tablename < $2
            ORDER BY tablename
        """, table_name, cutoff_partition)
        
        for partition in partitions:
            partition_name = partition['tablename']
            
            # Optional: Archive data before dropping
            if await self.should_archive_partition(table_name):
                await self.archive_partition(conn, partition_name)
            
            # Drop partition
            await conn.execute(f"DROP TABLE IF EXISTS {partition_name}")
            logger.info(f"Dropped old partition {partition_name}")
    
    async def should_archive_partition(self, table_name: str) -> bool:
        """Determine if partition should be archived before dropping"""
        # Add logic here if you want to archive certain tables
        return table_name in ['audit_logs', 'email_events']
    
    async def archive_partition(self, conn: asyncpg.Connection, partition_name: str):
        """Archive partition data to cold storage"""
        # Example: Export to S3 or another storage system
        # This is a placeholder - implement based on your archival strategy
        logger.info(f"Archiving partition {partition_name} (not implemented)")
    
    async def refresh_materialized_views(self):
        """Refresh materialized views that need hourly updates"""
        views_to_refresh = [
            'campaign_analytics',
            'email_deliverability_metrics'
        ]
        
        async with self.pool.acquire() as conn:
            for view in views_to_refresh:
                try:
                    await conn.execute(f"REFRESH MATERIALIZED VIEW CONCURRENTLY {view}")
                    logger.info(f"Refreshed materialized view {view}")
                except Exception as e:
                    logger.error(f"Failed to refresh {view}: {e}")
    
    async def refresh_daily_views(self):
        """Refresh materialized views that need daily updates"""
        views_to_refresh = [
            'workspace_usage_analytics',
            'lead_engagement_scores'
        ]
        
        async with self.pool.acquire() as conn:
            for view in views_to_refresh:
                try:
                    await conn.execute(f"REFRESH MATERIALIZED VIEW CONCURRENTLY {view}")
                    logger.info(f"Refreshed materialized view {view}")
                except Exception as e:
                    logger.error(f"Failed to refresh {view}: {e}")
    
    async def get_partition_info(self, table_name: str) -> List[Dict[str, Any]]:
        """Get information about existing partitions"""
        async with self.pool.acquire() as conn:
            partitions = await conn.fetch("""
                SELECT 
                    c.relname as partition_name,
                    pg_size_pretty(pg_relation_size(c.oid)) as size,
                    s.n_live_tup as row_count,
                    s.last_vacuum,
                    s.last_analyze
                FROM pg_class c
                JOIN pg_namespace n ON n.oid = c.relnamespace
                LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
                WHERE n.nspname = 'public'
                AND c.relname LIKE $1 || '_%'
                AND c.relkind = 'r'
                ORDER BY c.relname DESC
            """, table_name)
            
            return [dict(p) for p in partitions]
    
    async def analyze_partition_performance(self, table_name: str) -> Dict[str, Any]:
        """Analyze partition performance and suggest optimizations"""
        async with self.pool.acquire() as conn:
            # Get partition access patterns
            stats = await conn.fetchrow("""
                SELECT 
                    COUNT(*) as partition_count,
                    SUM(s.seq_scan) as total_seq_scans,
                    SUM(s.idx_scan) as total_index_scans,
                    SUM(pg_relation_size(c.oid)) as total_size_bytes,
                    AVG(s.n_live_tup) as avg_rows_per_partition
                FROM pg_class c
                JOIN pg_namespace n ON n.oid = c.relnamespace
                LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
                WHERE n.nspname = 'public'
                AND c.relname LIKE $1 || '_%'
                AND c.relkind = 'r'
            """, table_name)
            
            return {
                'partition_count': stats['partition_count'],
                'total_seq_scans': stats['total_seq_scans'],
                'total_index_scans': stats['total_index_scans'],
                'total_size_mb': round(stats['total_size_bytes'] / 1024 / 1024, 2) if stats['total_size_bytes'] else 0,
                'avg_rows_per_partition': int(stats['avg_rows_per_partition'] or 0),
                'recommendations': self.get_partition_recommendations(stats)
            }
    
    def get_partition_recommendations(self, stats: Dict[str, Any]) -> List[str]:
        """Generate recommendations based on partition statistics"""
        recommendations = []
        
        if stats['total_seq_scans'] > stats['total_index_scans'] * 10:
            recommendations.append("High sequential scan rate detected. Consider adding more specific indexes.")
        
        if stats['avg_rows_per_partition'] > 10_000_000:
            recommendations.append("Large partition size. Consider using weekly partitions instead of monthly.")
        
        if stats['partition_count'] > 24:
            recommendations.append("Many partitions detected. Ensure retention policy is being enforced.")
        
        return recommendations


# Singleton instance
partition_manager = None


async def get_partition_manager(database_url: str) -> PartitionManager:
    """Get or create the partition manager instance"""
    global partition_manager
    
    if partition_manager is None:
        partition_manager = PartitionManager(database_url)
        await partition_manager.initialize()
    
    return partition_manager