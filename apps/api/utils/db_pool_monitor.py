"""
Database connection pool monitoring and management utilities.
"""
import asyncio
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from dataclasses import dataclass
import asyncpg
from prometheus_client import Gauge, Counter, Histogram
import psutil

logger = logging.getLogger(__name__)

# Prometheus metrics
pool_connections_active = Gauge(
    'pgbouncer_pool_connections_active',
    'Active connections in pool',
    ['pool', 'database']
)

pool_connections_waiting = Gauge(
    'pgbouncer_pool_connections_waiting',
    'Clients waiting for connection',
    ['pool', 'database']
)

pool_connections_total = Gauge(
    'pgbouncer_pool_connections_total',
    'Total connections in pool',
    ['pool', 'database']
)

query_duration_seconds = Histogram(
    'pgbouncer_query_duration_seconds',
    'Query execution time',
    ['pool', 'operation']
)

connection_errors_total = Counter(
    'pgbouncer_connection_errors_total',
    'Total connection errors',
    ['pool', 'error_type']
)


@dataclass
class PoolStats:
    """Connection pool statistics."""
    pool_name: str
    database: str
    active_connections: int
    idle_connections: int
    waiting_clients: int
    max_connections: int
    total_connections: int
    avg_query_time: float
    avg_wait_time: float
    total_queries: int
    total_errors: int
    uptime_seconds: int


@dataclass
class ConnectionInfo:
    """Individual connection information."""
    pid: int
    database: str
    user: str
    client_addr: str
    state: str
    query: Optional[str]
    query_start: Optional[datetime]
    backend_start: datetime
    xact_start: Optional[datetime]
    wait_event: Optional[str]


class PgBouncerMonitor:
    """
    Monitor PgBouncer connection pools and performance.
    
    Features:
    - Real-time pool statistics
    - Connection tracking
    - Performance metrics
    - Alert generation
    - Auto-recovery actions
    """
    
    def __init__(
        self,
        pgbouncer_host: str = "localhost",
        pgbouncer_port: int = 6432,
        stats_user: str = "stats",
        stats_password: str = ""
    ):
        self.host = pgbouncer_host
        self.port = pgbouncer_port
        self.user = stats_user
        self.password = stats_password
        self._conn: Optional[asyncpg.Connection] = None
    
    async def connect(self):
        """Connect to PgBouncer stats database."""
        try:
            self._conn = await asyncpg.connect(
                host=self.host,
                port=self.port,
                user=self.user,
                password=self.password,
                database="pgbouncer",
                timeout=10
            )
            logger.info("Connected to PgBouncer stats database")
        except Exception as e:
            logger.error(f"Failed to connect to PgBouncer: {e}")
            raise
    
    async def disconnect(self):
        """Disconnect from PgBouncer."""
        if self._conn:
            await self._conn.close()
            self._conn = None
    
    async def get_pool_stats(self) -> List[PoolStats]:
        """Get statistics for all connection pools."""
        if not self._conn:
            await self.connect()
        
        # Query pool statistics
        query = """
        SELECT 
            database,
            user as pool_user,
            cl_active,
            cl_waiting,
            sv_active,
            sv_idle,
            sv_used,
            sv_tested,
            sv_login,
            maxwait,
            maxwait_us,
            pool_mode
        FROM pgbouncer.pools
        WHERE database NOT IN ('pgbouncer')
        """
        
        rows = await self._conn.fetch(query)
        stats = []
        
        for row in rows:
            pool_stat = PoolStats(
                pool_name=f"{row['database']}_{row['pool_user']}",
                database=row['database'],
                active_connections=row['cl_active'],
                idle_connections=row['sv_idle'],
                waiting_clients=row['cl_waiting'],
                max_connections=row['sv_active'] + row['sv_idle'] + row['sv_used'],
                total_connections=row['sv_active'] + row['sv_idle'],
                avg_query_time=0,  # Calculate from stats
                avg_wait_time=row['maxwait_us'] / 1000000.0 if row['maxwait_us'] else 0,
                total_queries=0,  # Get from stats
                total_errors=0,  # Get from stats
                uptime_seconds=0  # Get from stats
            )
            
            stats.append(pool_stat)
            
            # Update Prometheus metrics
            pool_connections_active.labels(
                pool=pool_stat.pool_name,
                database=pool_stat.database
            ).set(pool_stat.active_connections)
            
            pool_connections_waiting.labels(
                pool=pool_stat.pool_name,
                database=pool_stat.database
            ).set(pool_stat.waiting_clients)
            
            pool_connections_total.labels(
                pool=pool_stat.pool_name,
                database=pool_stat.database
            ).set(pool_stat.total_connections)
        
        return stats
    
    async def get_database_stats(self) -> Dict[str, Any]:
        """Get per-database statistics."""
        if not self._conn:
            await self.connect()
        
        query = """
        SELECT 
            database,
            total_xact_count,
            total_query_count,
            total_received,
            total_sent,
            total_xact_time,
            total_query_time,
            total_wait_time,
            avg_xact_count,
            avg_query_count,
            avg_recv,
            avg_sent,
            avg_xact_time,
            avg_query_time,
            avg_wait_time
        FROM pgbouncer.stats
        WHERE database NOT IN ('pgbouncer')
        """
        
        rows = await self._conn.fetch(query)
        stats = {}
        
        for row in rows:
            stats[row['database']] = {
                'total_transactions': row['total_xact_count'],
                'total_queries': row['total_query_count'],
                'total_received_bytes': row['total_received'],
                'total_sent_bytes': row['total_sent'],
                'avg_transaction_time_us': row['avg_xact_time'],
                'avg_query_time_us': row['avg_query_time'],
                'avg_wait_time_us': row['avg_wait_time'],
                'queries_per_second': row['avg_query_count']
            }
        
        return stats
    
    async def get_client_connections(self) -> List[ConnectionInfo]:
        """Get information about client connections."""
        if not self._conn:
            await self.connect()
        
        query = """
        SELECT 
            type,
            user,
            database,
            state,
            addr,
            port,
            local_addr,
            local_port,
            connect_time,
            request_time,
            wait,
            wait_us,
            close_needed,
            ptr,
            link,
            remote_pid,
            tls
        FROM pgbouncer.clients
        """
        
        rows = await self._conn.fetch(query)
        connections = []
        
        for row in rows:
            conn_info = ConnectionInfo(
                pid=row['ptr'],  # PgBouncer internal pointer
                database=row['database'],
                user=row['user'],
                client_addr=f"{row['addr']}:{row['port']}",
                state=row['state'],
                query=None,  # Not available in PgBouncer
                query_start=row['request_time'],
                backend_start=row['connect_time'],
                xact_start=None,
                wait_event=f"wait: {row['wait_us']}us" if row['wait_us'] else None
            )
            connections.append(conn_info)
        
        return connections
    
    async def get_server_connections(self) -> List[Dict[str, Any]]:
        """Get information about server connections."""
        if not self._conn:
            await self.connect()
        
        query = """
        SELECT 
            type,
            user,
            database,
            state,
            addr,
            port,
            local_addr,
            local_port,
            connect_time,
            request_time,
            wait,
            wait_us,
            close_needed,
            ptr,
            link,
            remote_pid,
            tls
        FROM pgbouncer.servers
        """
        
        rows = await self._conn.fetch(query)
        return [dict(row) for row in rows]
    
    async def check_pool_health(self) -> Dict[str, Any]:
        """Perform comprehensive pool health check."""
        health_report = {
            "timestamp": datetime.utcnow().isoformat(),
            "status": "healthy",
            "issues": [],
            "metrics": {}
        }
        
        try:
            # Get pool stats
            pool_stats = await self.get_pool_stats()
            
            # Check for issues
            for pool in pool_stats:
                # High wait queue
                if pool.waiting_clients > 10:
                    health_report["issues"].append({
                        "severity": "warning",
                        "pool": pool.pool_name,
                        "issue": f"High wait queue: {pool.waiting_clients} clients waiting"
                    })
                
                # Connection saturation
                utilization = (pool.active_connections / pool.max_connections * 100) if pool.max_connections > 0 else 0
                if utilization > 90:
                    health_report["issues"].append({
                        "severity": "critical",
                        "pool": pool.pool_name,
                        "issue": f"Connection pool near saturation: {utilization:.1f}% utilized"
                    })
                
                # Long wait times
                if pool.avg_wait_time > 1.0:  # More than 1 second
                    health_report["issues"].append({
                        "severity": "warning",
                        "pool": pool.pool_name,
                        "issue": f"Long average wait time: {pool.avg_wait_time:.2f}s"
                    })
            
            # Get database stats
            db_stats = await self.get_database_stats()
            health_report["metrics"]["databases"] = db_stats
            
            # Set overall status
            if any(issue["severity"] == "critical" for issue in health_report["issues"]):
                health_report["status"] = "critical"
            elif health_report["issues"]:
                health_report["status"] = "warning"
            
        except Exception as e:
            health_report["status"] = "error"
            health_report["error"] = str(e)
            logger.error(f"Health check failed: {e}")
        
        return health_report
    
    async def kill_idle_connections(self, idle_timeout_seconds: int = 300):
        """Kill connections that have been idle for too long."""
        if not self._conn:
            await self.connect()
        
        # This would require ADMIN access to PgBouncer
        # Example command: KILL connection_ptr
        logger.info(f"Would kill connections idle for more than {idle_timeout_seconds}s")
    
    async def reload_config(self):
        """Reload PgBouncer configuration."""
        if not self._conn:
            await self.connect()
        
        try:
            await self._conn.execute("RELOAD")
            logger.info("PgBouncer configuration reloaded")
        except Exception as e:
            logger.error(f"Failed to reload configuration: {e}")
            raise
    
    async def pause_database(self, database: str):
        """Pause a database (stop accepting new queries)."""
        if not self._conn:
            await self.connect()
        
        try:
            await self._conn.execute(f"PAUSE {database}")
            logger.info(f"Database {database} paused")
        except Exception as e:
            logger.error(f"Failed to pause database: {e}")
            raise
    
    async def resume_database(self, database: str):
        """Resume a paused database."""
        if not self._conn:
            await self.connect()
        
        try:
            await self._conn.execute(f"RESUME {database}")
            logger.info(f"Database {database} resumed")
        except Exception as e:
            logger.error(f"Failed to resume database: {e}")
            raise


class ConnectionPoolOptimizer:
    """
    Automatically optimize connection pool settings based on usage patterns.
    """
    
    def __init__(self, monitor: PgBouncerMonitor):
        self.monitor = monitor
        self.history: List[Dict[str, Any]] = []
        self.recommendations: List[Dict[str, Any]] = []
    
    async def analyze_usage_patterns(self, days: int = 7) -> Dict[str, Any]:
        """Analyze connection pool usage patterns."""
        # Collect current stats
        pool_stats = await self.monitor.get_pool_stats()
        db_stats = await self.monitor.get_database_stats()
        
        analysis = {
            "timestamp": datetime.utcnow().isoformat(),
            "pools": {},
            "recommendations": []
        }
        
        for pool in pool_stats:
            pool_analysis = {
                "current_size": pool.max_connections,
                "avg_active": pool.active_connections,
                "peak_active": pool.active_connections,  # Would need historical data
                "avg_wait_time": pool.avg_wait_time,
                "utilization": (pool.active_connections / pool.max_connections * 100) if pool.max_connections > 0 else 0
            }
            
            # Generate recommendations
            if pool_analysis["utilization"] > 80:
                analysis["recommendations"].append({
                    "pool": pool.pool_name,
                    "action": "increase_pool_size",
                    "current": pool.max_connections,
                    "recommended": int(pool.max_connections * 1.5),
                    "reason": "High utilization detected"
                })
            elif pool_analysis["utilization"] < 20 and pool.max_connections > 10:
                analysis["recommendations"].append({
                    "pool": pool.pool_name,
                    "action": "decrease_pool_size",
                    "current": pool.max_connections,
                    "recommended": max(10, int(pool.max_connections * 0.7)),
                    "reason": "Low utilization detected"
                })
            
            if pool.avg_wait_time > 0.5:  # 500ms
                analysis["recommendations"].append({
                    "pool": pool.pool_name,
                    "action": "increase_pool_size",
                    "current": pool.max_connections,
                    "recommended": pool.max_connections + 10,
                    "reason": "High wait times detected"
                })
            
            analysis["pools"][pool.pool_name] = pool_analysis
        
        return analysis
    
    def generate_config_recommendations(self, analysis: Dict[str, Any]) -> str:
        """Generate PgBouncer configuration recommendations."""
        config_lines = []
        config_lines.append(";; PgBouncer Configuration Recommendations")
        config_lines.append(f";; Generated: {datetime.utcnow().isoformat()}")
        config_lines.append("")
        
        for rec in analysis["recommendations"]:
            if rec["action"] == "increase_pool_size":
                config_lines.append(f";; Pool: {rec['pool']}")
                config_lines.append(f";; Reason: {rec['reason']}")
                config_lines.append(f";; Current size: {rec['current']}")
                config_lines.append(f";; Recommended: default_pool_size = {rec['recommended']}")
                config_lines.append("")
        
        return "\n".join(config_lines)


async def monitor_pools_continuously(
    monitor: PgBouncerMonitor,
    interval_seconds: int = 60
):
    """Continuously monitor connection pools."""
    while True:
        try:
            health = await monitor.check_pool_health()
            
            if health["status"] != "healthy":
                logger.warning(f"Pool health issue detected: {health}")
                
                # Take corrective actions
                for issue in health["issues"]:
                    if issue["severity"] == "critical":
                        logger.error(f"Critical issue in pool {issue['pool']}: {issue['issue']}")
                        # Could trigger alerts, auto-scaling, etc.
            
            await asyncio.sleep(interval_seconds)
            
        except Exception as e:
            logger.error(f"Monitoring error: {e}")
            await asyncio.sleep(interval_seconds)