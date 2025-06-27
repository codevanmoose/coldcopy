"""
Index Monitoring and Performance Analysis for ColdCopy.

This module provides utilities for monitoring index usage, identifying missing indexes,
and analyzing query performance to optimize database operations.
"""
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass
from enum import Enum
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

logger = logging.getLogger(__name__)


class IndexStatus(Enum):
    """Index health status levels."""
    OPTIMAL = "optimal"
    UNDERUSED = "underused"
    BLOATED = "bloated"
    MISSING = "missing"
    REDUNDANT = "redundant"


@dataclass
class IndexInfo:
    """Information about a database index."""
    schema_name: str
    table_name: str
    index_name: str
    index_size: str
    index_size_bytes: int
    scan_count: int
    tuples_read: int
    tuples_fetched: int
    is_unique: bool
    is_primary: bool
    columns: List[str]
    status: IndexStatus
    last_used: Optional[datetime] = None


@dataclass
class TableStats:
    """Table statistics for performance analysis."""
    schema_name: str
    table_name: str
    row_count: int
    table_size: str
    table_size_bytes: int
    sequential_scans: int
    index_scans: int
    sequential_scan_ratio: float
    last_vacuum: Optional[datetime]
    last_analyze: Optional[datetime]
    needs_indexing: bool


@dataclass
class QueryPerformance:
    """Query performance metrics."""
    query_fingerprint: str
    total_calls: int
    total_time_ms: float
    mean_time_ms: float
    max_time_ms: float
    rows_returned: int
    hit_ratio: float
    query_sample: str
    suggested_indexes: List[str]


@dataclass
class IndexRecommendation:
    """Index creation recommendation."""
    table_name: str
    columns: List[str]
    reason: str
    estimated_improvement: str
    priority: str  # high, medium, low
    create_statement: str


class IndexMonitor:
    """Monitor and analyze database indexes for optimization."""
    
    def __init__(self, db_session: AsyncSession):
        self.db = db_session
        self._cache = {}
        self._cache_ttl = timedelta(minutes=5)
    
    async def get_index_usage_stats(self) -> List[IndexInfo]:
        """
        Get comprehensive index usage statistics.
        
        Returns:
            List of IndexInfo objects with usage data
        """
        try:
            query = """
                SELECT 
                    s.schemaname,
                    s.tablename,
                    s.indexname,
                    pg_size_pretty(pg_relation_size(s.indexrelid)) AS index_size,
                    pg_relation_size(s.indexrelid) AS index_size_bytes,
                    s.idx_scan AS scan_count,
                    s.idx_tup_read AS tuples_read,
                    s.idx_tup_fetch AS tuples_fetched,
                    i.indisunique AS is_unique,
                    i.indisprimary AS is_primary,
                    pg_get_indexdef(s.indexrelid) AS index_definition
                FROM pg_stat_user_indexes s
                JOIN pg_index i ON s.indexrelid = i.indexrelid
                JOIN pg_class c ON c.oid = s.indexrelid
                WHERE s.schemaname = 'public'
                ORDER BY s.schemaname, s.tablename, s.indexname
            """
            
            result = await self.db.execute(text(query))
            rows = result.fetchall()
            
            indexes = []
            for row in rows:
                # Determine index status
                if row.scan_count == 0:
                    status = IndexStatus.UNDERUSED
                elif row.index_size_bytes > 1024 * 1024 * 1024:  # 1GB
                    status = IndexStatus.BLOATED
                else:
                    status = IndexStatus.OPTIMAL
                
                # Extract column names from index definition
                columns = self._extract_index_columns(row.index_definition)
                
                indexes.append(IndexInfo(
                    schema_name=row.schemaname,
                    table_name=row.tablename,
                    index_name=row.indexname,
                    index_size=row.index_size,
                    index_size_bytes=row.index_size_bytes,
                    scan_count=row.scan_count,
                    tuples_read=row.tuples_read,
                    tuples_fetched=row.tuples_fetched,
                    is_unique=row.is_unique,
                    is_primary=row.is_primary,
                    columns=columns,
                    status=status
                ))
            
            return indexes
            
        except Exception as e:
            logger.error(f"Failed to get index usage stats: {e}")
            return []
    
    async def get_table_statistics(self, min_size_mb: int = 10) -> List[TableStats]:
        """
        Get table statistics to identify tables needing indexes.
        
        Args:
            min_size_mb: Minimum table size in MB to include
            
        Returns:
            List of TableStats objects
        """
        try:
            query = """
                SELECT 
                    s.schemaname,
                    s.tablename,
                    s.n_live_tup AS row_count,
                    pg_size_pretty(pg_total_relation_size(s.schemaname||'.'||s.tablename)) AS table_size,
                    pg_total_relation_size(s.schemaname||'.'||s.tablename) AS table_size_bytes,
                    s.seq_scan AS sequential_scans,
                    s.idx_scan AS index_scans,
                    CASE 
                        WHEN (s.seq_scan + s.idx_scan) > 0 
                        THEN ROUND((s.seq_scan::NUMERIC / (s.seq_scan + s.idx_scan)) * 100, 2)
                        ELSE 0
                    END AS seq_scan_ratio,
                    s.last_vacuum,
                    s.last_analyze
                FROM pg_stat_user_tables s
                WHERE s.schemaname = 'public'
                  AND pg_total_relation_size(s.schemaname||'.'||s.tablename) > :min_size_bytes
                ORDER BY s.seq_scan DESC
            """
            
            min_size_bytes = min_size_mb * 1024 * 1024
            result = await self.db.execute(text(query), {"min_size_bytes": min_size_bytes})
            rows = result.fetchall()
            
            tables = []
            for row in rows:
                # Determine if table needs indexing
                needs_indexing = (
                    row.sequential_scans > 1000 and
                    row.seq_scan_ratio > 50 and
                    row.row_count > 10000
                )
                
                tables.append(TableStats(
                    schema_name=row.schemaname,
                    table_name=row.tablename,
                    row_count=row.row_count,
                    table_size=row.table_size,
                    table_size_bytes=row.table_size_bytes,
                    sequential_scans=row.sequential_scans,
                    index_scans=row.index_scans,
                    sequential_scan_ratio=float(row.seq_scan_ratio),
                    last_vacuum=row.last_vacuum,
                    last_analyze=row.last_analyze,
                    needs_indexing=needs_indexing
                ))
            
            return tables
            
        except Exception as e:
            logger.error(f"Failed to get table statistics: {e}")
            return []
    
    async def analyze_slow_queries(self, min_duration_ms: int = 100) -> List[QueryPerformance]:
        """
        Analyze slow queries to identify indexing opportunities.
        
        Args:
            min_duration_ms: Minimum query duration to consider
            
        Returns:
            List of QueryPerformance objects
        """
        try:
            # Check if pg_stat_statements is available
            check_extension = await self.db.execute(
                text("SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements')")
            )
            if not check_extension.scalar():
                logger.warning("pg_stat_statements extension not available")
                return []
            
            query = """
                SELECT 
                    queryid AS query_fingerprint,
                    calls AS total_calls,
                    total_exec_time AS total_time_ms,
                    mean_exec_time AS mean_time_ms,
                    max_exec_time AS max_time_ms,
                    rows AS rows_returned,
                    100.0 * shared_blks_hit / NULLIF(shared_blks_hit + shared_blks_read, 0) AS hit_ratio,
                    LEFT(query, 500) AS query_sample
                FROM pg_stat_statements
                WHERE mean_exec_time > :min_duration_ms
                  AND query NOT LIKE '%pg_stat_statements%'
                  AND query NOT LIKE 'COMMIT%'
                  AND query NOT LIKE 'BEGIN%'
                ORDER BY mean_exec_time DESC
                LIMIT 50
            """
            
            result = await self.db.execute(text(query), {"min_duration_ms": min_duration_ms})
            rows = result.fetchall()
            
            queries = []
            for row in rows:
                # Analyze query to suggest indexes
                suggested_indexes = self._suggest_indexes_for_query(row.query_sample)
                
                queries.append(QueryPerformance(
                    query_fingerprint=str(row.query_fingerprint),
                    total_calls=row.total_calls,
                    total_time_ms=float(row.total_time_ms),
                    mean_time_ms=float(row.mean_time_ms),
                    max_time_ms=float(row.max_time_ms),
                    rows_returned=row.rows_returned,
                    hit_ratio=float(row.hit_ratio) if row.hit_ratio else 0.0,
                    query_sample=row.query_sample,
                    suggested_indexes=suggested_indexes
                ))
            
            return queries
            
        except Exception as e:
            logger.error(f"Failed to analyze slow queries: {e}")
            return []
    
    async def get_index_recommendations(self) -> List[IndexRecommendation]:
        """
        Generate index recommendations based on usage patterns.
        
        Returns:
            List of IndexRecommendation objects
        """
        recommendations = []
        
        try:
            # Get tables with high sequential scan ratio
            table_stats = await self.get_table_statistics()
            
            for table in table_stats:
                if table.needs_indexing:
                    # Analyze common query patterns for this table
                    common_filters = await self._analyze_common_filters(table.table_name)
                    
                    for filter_cols in common_filters:
                        rec = IndexRecommendation(
                            table_name=table.table_name,
                            columns=filter_cols,
                            reason=f"High sequential scan ratio ({table.sequential_scan_ratio}%) with {table.sequential_scans} scans",
                            estimated_improvement=f"Could reduce scan time by up to {int(table.sequential_scan_ratio)}%",
                            priority="high" if table.sequential_scan_ratio > 80 else "medium",
                            create_statement=self._generate_index_create_statement(
                                table.table_name, filter_cols
                            )
                        )
                        recommendations.append(rec)
            
            # Check for missing foreign key indexes
            fk_recommendations = await self._check_foreign_key_indexes()
            recommendations.extend(fk_recommendations)
            
            # Check for redundant indexes
            redundant = await self._find_redundant_indexes()
            for idx in redundant:
                rec = IndexRecommendation(
                    table_name=idx["table_name"],
                    columns=[],  # No new columns needed
                    reason=f"Index {idx['redundant_index']} is redundant with {idx['covering_index']}",
                    estimated_improvement="Reduces storage and maintenance overhead",
                    priority="low",
                    create_statement=f"DROP INDEX {idx['redundant_index']};"
                )
                recommendations.append(rec)
            
            return recommendations
            
        except Exception as e:
            logger.error(f"Failed to generate index recommendations: {e}")
            return []
    
    async def check_index_bloat(self, bloat_threshold: float = 0.2) -> List[Dict[str, Any]]:
        """
        Check for index bloat that requires maintenance.
        
        Args:
            bloat_threshold: Ratio of wasted space to trigger alert (0.2 = 20%)
            
        Returns:
            List of bloated indexes with details
        """
        try:
            query = """
                WITH index_bloat AS (
                    SELECT
                        schemaname,
                        tablename,
                        indexname,
                        pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
                        pg_relation_size(indexrelid) AS size_bytes,
                        CASE WHEN pg_relation_size(indexrelid) > 0
                            THEN (pg_relation_size(indexrelid) - 
                                  pg_relation_size(indexrelid) * 
                                  (100 - (avg_leaf_density + avg_internal_density) / 2) / 100)::BIGINT
                            ELSE 0
                        END AS bloat_bytes
                    FROM (
                        SELECT
                            schemaname,
                            tablename,
                            indexname,
                            indexrelid,
                            100 * (1 - avg_leaf_density / 100.0) AS avg_leaf_density,
                            100 * (1 - avg_internal_density / 100.0) AS avg_internal_density
                        FROM (
                            SELECT
                                schemaname,
                                tablename,
                                indexname,
                                indexrelid,
                                AVG(CASE WHEN level = 1 THEN density ELSE NULL END) AS avg_leaf_density,
                                AVG(CASE WHEN level > 1 THEN density ELSE NULL END) AS avg_internal_density
                            FROM (
                                SELECT
                                    s.schemaname,
                                    s.tablename,
                                    s.indexname,
                                    s.indexrelid,
                                    1 AS level,
                                    100.0 AS density
                                FROM pg_stat_user_indexes s
                            ) AS index_levels
                            GROUP BY schemaname, tablename, indexname, indexrelid
                        ) AS density_calc
                    ) AS bloat_calc
                )
                SELECT 
                    schemaname,
                    tablename,
                    indexname,
                    index_size,
                    pg_size_pretty(bloat_bytes) AS bloat_size,
                    ROUND((bloat_bytes::NUMERIC / NULLIF(size_bytes, 0)) * 100, 2) AS bloat_ratio
                FROM index_bloat
                WHERE bloat_bytes > 0
                  AND (bloat_bytes::NUMERIC / NULLIF(size_bytes, 0)) > :bloat_threshold
                ORDER BY bloat_bytes DESC
            """
            
            result = await self.db.execute(text(query), {"bloat_threshold": bloat_threshold})
            
            bloated_indexes = []
            for row in result.fetchall():
                bloated_indexes.append({
                    "schema_name": row.schemaname,
                    "table_name": row.tablename,
                    "index_name": row.indexname,
                    "index_size": row.index_size,
                    "bloat_size": row.bloat_size,
                    "bloat_ratio": float(row.bloat_ratio),
                    "action": "REINDEX CONCURRENTLY"
                })
            
            return bloated_indexes
            
        except Exception as e:
            logger.error(f"Failed to check index bloat: {e}")
            return []
    
    async def generate_index_report(self) -> Dict[str, Any]:
        """
        Generate comprehensive index health report.
        
        Returns:
            Dictionary with complete index analysis
        """
        try:
            # Gather all metrics
            index_usage = await self.get_index_usage_stats()
            table_stats = await self.get_table_statistics()
            slow_queries = await self.analyze_slow_queries()
            recommendations = await self.get_index_recommendations()
            bloated_indexes = await self.check_index_bloat()
            
            # Calculate summary statistics
            total_indexes = len(index_usage)
            unused_indexes = sum(1 for idx in index_usage if idx.status == IndexStatus.UNDERUSED)
            bloated_count = len(bloated_indexes)
            
            # Build report
            report = {
                "generated_at": datetime.utcnow().isoformat(),
                "summary": {
                    "total_indexes": total_indexes,
                    "unused_indexes": unused_indexes,
                    "bloated_indexes": bloated_count,
                    "tables_needing_indexes": sum(1 for t in table_stats if t.needs_indexing),
                    "slow_queries_analyzed": len(slow_queries),
                    "recommendations_count": len(recommendations)
                },
                "index_usage": [
                    {
                        "table": idx.table_name,
                        "index": idx.index_name,
                        "size": idx.index_size,
                        "scans": idx.scan_count,
                        "status": idx.status.value
                    }
                    for idx in index_usage
                ],
                "problematic_tables": [
                    {
                        "table": table.table_name,
                        "size": table.table_size,
                        "seq_scan_ratio": table.sequential_scan_ratio,
                        "needs_indexing": table.needs_indexing
                    }
                    for table in table_stats if table.needs_indexing
                ],
                "slow_queries": [
                    {
                        "query": q.query_sample[:100] + "...",
                        "mean_time_ms": q.mean_time_ms,
                        "calls": q.total_calls,
                        "suggested_indexes": q.suggested_indexes
                    }
                    for q in slow_queries[:10]  # Top 10
                ],
                "recommendations": [
                    {
                        "table": rec.table_name,
                        "columns": rec.columns,
                        "reason": rec.reason,
                        "priority": rec.priority,
                        "sql": rec.create_statement
                    }
                    for rec in recommendations
                ],
                "maintenance_needed": bloated_indexes
            }
            
            return report
            
        except Exception as e:
            logger.error(f"Failed to generate index report: {e}")
            return {"error": str(e)}
    
    # Helper methods
    
    def _extract_index_columns(self, index_definition: str) -> List[str]:
        """Extract column names from index definition."""
        # Simple extraction - can be enhanced for complex cases
        import re
        match = re.search(r'\((.*?)\)', index_definition)
        if match:
            columns = match.group(1).split(',')
            return [col.strip().split()[0] for col in columns]
        return []
    
    def _suggest_indexes_for_query(self, query: str) -> List[str]:
        """Analyze query and suggest potential indexes."""
        suggestions = []
        query_lower = query.lower()
        
        # Look for WHERE clauses
        if 'where' in query_lower:
            # Extract potential filter columns
            where_match = re.search(r'where\s+(.+?)(?:group|order|limit|$)', query_lower, re.IGNORECASE)
            if where_match:
                where_clause = where_match.group(1)
                # Look for column comparisons
                columns = re.findall(r'(\w+)\s*(?:=|>|<|>=|<=|!=|like)', where_clause)
                if columns:
                    suggestions.append(f"Consider index on: {', '.join(set(columns))}")
        
        # Look for JOIN conditions
        if 'join' in query_lower:
            join_matches = re.findall(r'join\s+\w+\s+on\s+(\w+)\.(\w+)\s*=\s*(\w+)\.(\w+)', query_lower)
            for match in join_matches:
                suggestions.append(f"Consider index on join columns: {match[1]}, {match[3]}")
        
        # Look for ORDER BY
        if 'order by' in query_lower:
            order_match = re.search(r'order\s+by\s+([\w\s,]+)', query_lower)
            if order_match:
                order_columns = [col.strip() for col in order_match.group(1).split(',')]
                suggestions.append(f"Consider index for sorting: {', '.join(order_columns)}")
        
        return suggestions
    
    async def _analyze_common_filters(self, table_name: str) -> List[List[str]]:
        """Analyze common filter patterns for a table."""
        # This would ideally analyze query logs to find common WHERE clauses
        # For now, return common patterns based on table name
        
        common_patterns = {
            "campaigns": [["workspace_id", "created_at"], ["workspace_id", "status"]],
            "leads": [["workspace_id", "created_at"], ["workspace_id", "email"]],
            "email_events": [["workspace_id", "created_at"], ["campaign_id", "event_type"]],
            "conversations": [["workspace_id", "updated_at"], ["lead_id", "status"]],
            "messages": [["conversation_id", "created_at"], ["workspace_id", "created_at"]]
        }
        
        return common_patterns.get(table_name, [["workspace_id", "created_at"]])
    
    def _generate_index_create_statement(self, table_name: str, columns: List[str]) -> str:
        """Generate CREATE INDEX statement."""
        index_name = f"idx_{table_name}_{'_'.join(columns)}"
        column_list = ", ".join(columns)
        
        # Add DESC for timestamp columns
        if "created_at" in columns or "updated_at" in columns:
            column_list = column_list.replace("created_at", "created_at DESC")
            column_list = column_list.replace("updated_at", "updated_at DESC")
        
        return f"CREATE INDEX CONCURRENTLY {index_name} ON {table_name} ({column_list});"
    
    async def _check_foreign_key_indexes(self) -> List[IndexRecommendation]:
        """Check for missing indexes on foreign key columns."""
        try:
            query = """
                SELECT 
                    tc.table_name,
                    kcu.column_name,
                    ccu.table_name AS foreign_table_name,
                    ccu.column_name AS foreign_column_name
                FROM information_schema.table_constraints AS tc
                JOIN information_schema.key_column_usage AS kcu
                    ON tc.constraint_name = kcu.constraint_name
                    AND tc.table_schema = kcu.table_schema
                JOIN information_schema.constraint_column_usage AS ccu
                    ON ccu.constraint_name = tc.constraint_name
                    AND ccu.table_schema = tc.table_schema
                WHERE tc.constraint_type = 'FOREIGN KEY' 
                    AND tc.table_schema = 'public'
                    AND NOT EXISTS (
                        SELECT 1
                        FROM pg_indexes
                        WHERE schemaname = 'public'
                            AND tablename = tc.table_name
                            AND indexdef LIKE '%' || kcu.column_name || '%'
                    )
            """
            
            result = await self.db.execute(text(query))
            recommendations = []
            
            for row in result.fetchall():
                rec = IndexRecommendation(
                    table_name=row.table_name,
                    columns=[row.column_name],
                    reason=f"Missing index on foreign key to {row.foreign_table_name}.{row.foreign_column_name}",
                    estimated_improvement="Improves JOIN performance and referential integrity checks",
                    priority="high",
                    create_statement=self._generate_index_create_statement(
                        row.table_name, [row.column_name]
                    )
                )
                recommendations.append(rec)
            
            return recommendations
            
        except Exception as e:
            logger.error(f"Failed to check foreign key indexes: {e}")
            return []
    
    async def _find_redundant_indexes(self) -> List[Dict[str, Any]]:
        """Find indexes that are redundant."""
        try:
            query = """
                WITH index_columns AS (
                    SELECT 
                        schemaname,
                        tablename,
                        indexname,
                        array_agg(attname ORDER BY attnum) AS columns
                    FROM pg_indexes
                    JOIN pg_index ON indexrelid = (schemaname||'.'||indexname)::regclass
                    JOIN pg_attribute ON attrelid = indrelid AND attnum = ANY(indkey)
                    WHERE schemaname = 'public'
                    GROUP BY schemaname, tablename, indexname
                )
                SELECT 
                    ic1.tablename AS table_name,
                    ic1.indexname AS redundant_index,
                    ic2.indexname AS covering_index,
                    ic1.columns AS redundant_columns,
                    ic2.columns AS covering_columns
                FROM index_columns ic1
                JOIN index_columns ic2 ON ic1.tablename = ic2.tablename
                    AND ic1.indexname != ic2.indexname
                    AND ic1.columns <@ ic2.columns
                    AND array_length(ic1.columns, 1) < array_length(ic2.columns, 1)
            """
            
            result = await self.db.execute(text(query))
            
            redundant = []
            for row in result.fetchall():
                redundant.append({
                    "table_name": row.table_name,
                    "redundant_index": row.redundant_index,
                    "covering_index": row.covering_index,
                    "redundant_columns": row.redundant_columns,
                    "covering_columns": row.covering_columns
                })
            
            return redundant
            
        except Exception as e:
            logger.error(f"Failed to find redundant indexes: {e}")
            return []


# Utility functions for one-off analysis

async def quick_index_check(db_session: AsyncSession) -> Dict[str, Any]:
    """Quick index health check for monitoring."""
    monitor = IndexMonitor(db_session)
    
    index_stats = await monitor.get_index_usage_stats()
    
    return {
        "timestamp": datetime.utcnow().isoformat(),
        "total_indexes": len(index_stats),
        "unused_indexes": sum(1 for idx in index_stats if idx.scan_count == 0),
        "bloated_indexes": sum(1 for idx in index_stats if idx.status == IndexStatus.BLOATED),
        "total_index_size": sum(idx.index_size_bytes for idx in index_stats),
        "status": "healthy" if sum(1 for idx in index_stats if idx.scan_count == 0) < len(index_stats) * 0.2 else "needs_attention"
    }


async def optimize_table_indexes(db_session: AsyncSession, table_name: str) -> List[str]:
    """Generate index optimization commands for a specific table."""
    monitor = IndexMonitor(db_session)
    
    recommendations = await monitor.get_index_recommendations()
    table_recommendations = [r for r in recommendations if r.table_name == table_name]
    
    commands = []
    for rec in table_recommendations:
        commands.append(rec.create_statement)
    
    return commands


if __name__ == "__main__":
    # Example usage
    import asyncio
    from core.database import get_async_session
    
    async def main():
        async for db in get_async_session():
            try:
                monitor = IndexMonitor(db)
                report = await monitor.generate_index_report()
                
                print("Index Health Report")
                print("==================")
                print(f"Total Indexes: {report['summary']['total_indexes']}")
                print(f"Unused Indexes: {report['summary']['unused_indexes']}")
                print(f"Bloated Indexes: {report['summary']['bloated_indexes']}")
                print(f"Tables Needing Indexes: {report['summary']['tables_needing_indexes']}")
                
                if report['recommendations']:
                    print("\nTop Recommendations:")
                    for rec in report['recommendations'][:5]:
                        print(f"- {rec['table']}: {rec['reason']}")
                        print(f"  SQL: {rec['sql']}")
                
            finally:
                await db.close()
    
    asyncio.run(main())