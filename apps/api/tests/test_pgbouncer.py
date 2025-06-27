"""
Tests for PgBouncer connection pooling functionality.
"""
import pytest
import asyncio
from datetime import datetime
from unittest.mock import AsyncMock, patch, MagicMock

from config.pgbouncer import (
    PgBouncerConfig,
    PgBouncerConnectionManager,
    get_connection_manager,
    get_db_session
)
from utils.db_pool_monitor import (
    PgBouncerMonitor,
    ConnectionPoolOptimizer,
    PoolStats,
    ConnectionInfo
)


class TestPgBouncerConfig:
    """Test PgBouncer configuration."""
    
    def test_default_config(self):
        """Test default configuration values."""
        config = PgBouncerConfig()
        
        assert config.host == "localhost"
        assert config.port == 6432
        assert config.main_db == "coldcopy_main"
        assert config.pool_size == 20
        assert config.sslmode == "prefer"
    
    def test_dsn_generation(self):
        """Test DSN generation for different databases."""
        config = PgBouncerConfig()
        config.user = "test_user"
        config.password = "test_pass"
        
        # Test main database DSN
        main_dsn = config.get_dsn()
        assert "test_user:test_pass" in main_dsn
        assert "coldcopy_main" in main_dsn
        assert "postgresql+asyncpg://" in main_dsn
        
        # Test analytics database DSN
        analytics_dsn = config.get_dsn("coldcopy_analytics")
        assert "coldcopy_analytics" in analytics_dsn
    
    def test_asyncpg_dsn(self):
        """Test asyncpg DSN generation."""
        config = PgBouncerConfig()
        config.user = "test_user"
        config.password = "test_pass"
        
        dsn = config.get_asyncpg_dsn()
        assert "postgresql://" in dsn
        assert "test_user:test_pass" in dsn


class TestPgBouncerConnectionManager:
    """Test connection manager functionality."""
    
    @pytest.fixture
    async def manager(self):
        """Create test connection manager."""
        config = PgBouncerConfig()
        manager = PgBouncerConnectionManager(config)
        yield manager
        # Cleanup
        if manager._initialized:
            await manager.close()
    
    @pytest.mark.asyncio
    async def test_initialization(self, manager):
        """Test connection manager initialization."""
        with patch('config.pgbouncer.create_async_engine') as mock_create_engine:
            mock_engine = AsyncMock()
            mock_create_engine.return_value = mock_engine
            
            await manager.initialize()
            
            assert manager._initialized is True
            assert "main" in manager._engines
            assert "analytics" in manager._engines
            assert "jobs" in manager._engines
            
            # Verify engine creation calls
            assert mock_create_engine.call_count >= 3
    
    @pytest.mark.asyncio
    async def test_get_session(self, manager):
        """Test getting database sessions."""
        with patch('config.pgbouncer.create_async_engine') as mock_create_engine:
            mock_engine = AsyncMock()
            mock_create_engine.return_value = mock_engine
            
            # Get main session
            session = await manager.get_session("main")
            assert session is not None
            
            # Test invalid pool
            with pytest.raises(ValueError):
                await manager.get_session("invalid_pool")
    
    @pytest.mark.asyncio
    async def test_get_read_session(self, manager):
        """Test getting read-optimized session."""
        with patch('config.pgbouncer.create_async_engine') as mock_create_engine:
            mock_engine = AsyncMock()
            mock_create_engine.return_value = mock_engine
            
            # Without replica - should return main
            session = await manager.get_read_session()
            assert session is not None
            
            # With replica configured
            manager.config.replica_db = "coldcopy_replica"
            await manager.initialize()
            
            session = await manager.get_read_session()
            assert session is not None
    
    @pytest.mark.asyncio
    async def test_health_check(self, manager):
        """Test connection pool health check."""
        with patch('config.pgbouncer.create_async_engine') as mock_create_engine:
            # Mock engine with pool
            mock_pool = MagicMock()
            mock_pool.size.return_value = 20
            mock_pool.checkedin.return_value = 15
            mock_pool.checkedout.return_value = 5
            mock_pool.overflow.return_value = 0
            mock_pool.total.return_value = 20
            
            mock_engine = AsyncMock()
            mock_engine.pool = mock_pool
            mock_engine.connect = AsyncMock()
            
            mock_create_engine.return_value = mock_engine
            
            await manager.initialize()
            health = await manager.health_check()
            
            assert health["healthy"] is True
            assert "main" in health["pools"]
            assert health["pools"]["main"]["status"] == "healthy"
            assert health["pools"]["main"]["checked_out"] == 5


class TestPgBouncerMonitor:
    """Test PgBouncer monitoring functionality."""
    
    @pytest.fixture
    def mock_connection(self):
        """Mock asyncpg connection."""
        conn = AsyncMock()
        return conn
    
    @pytest.fixture
    async def monitor(self, mock_connection):
        """Create test monitor."""
        monitor = PgBouncerMonitor()
        with patch('asyncpg.connect', return_value=mock_connection):
            monitor._conn = mock_connection
            yield monitor
    
    @pytest.mark.asyncio
    async def test_get_pool_stats(self, monitor, mock_connection):
        """Test getting pool statistics."""
        # Mock query results
        mock_connection.fetch.return_value = [
            {
                'database': 'coldcopy_main',
                'pool_user': 'app_user',
                'cl_active': 10,
                'cl_waiting': 2,
                'sv_active': 8,
                'sv_idle': 12,
                'sv_used': 0,
                'sv_tested': 0,
                'sv_login': 0,
                'maxwait': 0,
                'maxwait_us': 50000,
                'pool_mode': 'transaction'
            }
        ]
        
        stats = await monitor.get_pool_stats()
        
        assert len(stats) == 1
        assert isinstance(stats[0], PoolStats)
        assert stats[0].database == 'coldcopy_main'
        assert stats[0].active_connections == 10
        assert stats[0].waiting_clients == 2
    
    @pytest.mark.asyncio
    async def test_get_database_stats(self, monitor, mock_connection):
        """Test getting database statistics."""
        # Mock query results
        mock_connection.fetch.return_value = [
            {
                'database': 'coldcopy_main',
                'total_xact_count': 100000,
                'total_query_count': 500000,
                'total_received': 1024000000,
                'total_sent': 2048000000,
                'total_xact_time': 3600000000,
                'total_query_time': 1800000000,
                'total_wait_time': 60000000,
                'avg_xact_count': 100,
                'avg_query_count': 500,
                'avg_recv': 1024000,
                'avg_sent': 2048000,
                'avg_xact_time': 3600,
                'avg_query_time': 1800,
                'avg_wait_time': 60
            }
        ]
        
        stats = await monitor.get_database_stats()
        
        assert 'coldcopy_main' in stats
        assert stats['coldcopy_main']['total_queries'] == 500000
        assert stats['coldcopy_main']['queries_per_second'] == 500
    
    @pytest.mark.asyncio
    async def test_check_pool_health(self, monitor, mock_connection):
        """Test pool health check."""
        # Mock healthy pool stats
        mock_connection.fetch.side_effect = [
            # Pool stats
            [{
                'database': 'coldcopy_main',
                'pool_user': 'app_user',
                'cl_active': 10,
                'cl_waiting': 0,
                'sv_active': 8,
                'sv_idle': 12,
                'sv_used': 0,
                'sv_tested': 0,
                'sv_login': 0,
                'maxwait': 0,
                'maxwait_us': 10000,
                'pool_mode': 'transaction'
            }],
            # Database stats
            [{
                'database': 'coldcopy_main',
                'total_xact_count': 100000,
                'total_query_count': 500000,
                'total_received': 1024000000,
                'total_sent': 2048000000,
                'avg_query_time': 1800,
                'avg_wait_time': 60,
                'queries_per_second': 500
            }]
        ]
        
        health = await monitor.check_pool_health()
        
        assert health["status"] == "healthy"
        assert len(health["issues"]) == 0
        assert "databases" in health["metrics"]
    
    @pytest.mark.asyncio
    async def test_check_pool_health_with_issues(self, monitor, mock_connection):
        """Test pool health check with issues."""
        # Mock problematic pool stats
        mock_connection.fetch.side_effect = [
            # Pool stats with high wait queue
            [{
                'database': 'coldcopy_main',
                'pool_user': 'app_user',
                'cl_active': 95,
                'cl_waiting': 20,  # High wait queue
                'sv_active': 95,
                'sv_idle': 5,
                'sv_used': 0,
                'sv_tested': 0,
                'sv_login': 0,
                'maxwait': 0,
                'maxwait_us': 2000000,  # 2 seconds
                'pool_mode': 'transaction'
            }],
            # Database stats
            [{}]
        ]
        
        health = await monitor.check_pool_health()
        
        assert health["status"] in ["warning", "critical"]
        assert len(health["issues"]) > 0
        
        # Check for specific issues
        issues = {issue["issue"] for issue in health["issues"]}
        assert any("wait queue" in issue for issue in issues)


class TestConnectionPoolOptimizer:
    """Test connection pool optimization."""
    
    @pytest.fixture
    async def optimizer(self):
        """Create test optimizer."""
        monitor = AsyncMock()
        optimizer = ConnectionPoolOptimizer(monitor)
        return optimizer
    
    @pytest.mark.asyncio
    async def test_analyze_usage_patterns(self, optimizer):
        """Test usage pattern analysis."""
        # Mock pool stats
        optimizer.monitor.get_pool_stats.return_value = [
            PoolStats(
                pool_name="coldcopy_main_app",
                database="coldcopy_main",
                active_connections=85,
                idle_connections=15,
                waiting_clients=5,
                max_connections=100,
                total_connections=100,
                avg_query_time=0.05,
                avg_wait_time=0.8,
                total_queries=100000,
                total_errors=10,
                uptime_seconds=3600
            )
        ]
        
        optimizer.monitor.get_database_stats.return_value = {
            "coldcopy_main": {
                "total_queries": 100000,
                "queries_per_second": 100
            }
        }
        
        analysis = await optimizer.analyze_usage_patterns()
        
        assert "recommendations" in analysis
        assert len(analysis["recommendations"]) > 0
        
        # Should recommend increasing pool size due to high utilization
        rec = analysis["recommendations"][0]
        assert rec["action"] == "increase_pool_size"
        assert rec["current"] == 100
        assert rec["recommended"] > 100
    
    def test_generate_config_recommendations(self, optimizer):
        """Test configuration recommendation generation."""
        analysis = {
            "recommendations": [
                {
                    "pool": "coldcopy_main",
                    "action": "increase_pool_size",
                    "current": 25,
                    "recommended": 40,
                    "reason": "High utilization detected"
                }
            ]
        }
        
        config = optimizer.generate_config_recommendations(analysis)
        
        assert "PgBouncer Configuration Recommendations" in config
        assert "default_pool_size = 40" in config
        assert "High utilization detected" in config


class TestDatabasePoolingAPI:
    """Test database pooling API endpoints."""
    
    @pytest.mark.asyncio
    async def test_get_pool_statistics(self, client, auth_headers_admin):
        """Test getting pool statistics via API."""
        with patch('routers.database_pooling.get_connection_manager') as mock_get_manager:
            with patch('routers.database_pooling.PgBouncerMonitor') as mock_monitor_class:
                # Mock connection manager
                mock_manager = AsyncMock()
                mock_manager.get_connection_stats.return_value = {
                    "main": {"checked_out": 5, "total": 20}
                }
                mock_get_manager.return_value = mock_manager
                
                # Mock monitor
                mock_monitor = AsyncMock()
                mock_monitor_class.return_value = mock_monitor
                
                mock_monitor.get_pool_stats.return_value = []
                mock_monitor.get_database_stats.return_value = {}
                
                response = await client.get(
                    "/api/database/pool/stats",
                    headers=auth_headers_admin
                )
                
                assert response.status_code == 200
                data = response.json()
                assert "sqlalchemy_pools" in data
                assert "pgbouncer_pools" in data
    
    @pytest.mark.asyncio
    async def test_pool_health_check(self, client):
        """Test pool health check endpoint."""
        with patch('routers.database_pooling.get_connection_manager') as mock_get_manager:
            with patch('routers.database_pooling.PgBouncerMonitor') as mock_monitor_class:
                # Mock healthy responses
                mock_manager = AsyncMock()
                mock_manager.health_check.return_value = {"healthy": True}
                mock_get_manager.return_value = mock_manager
                
                mock_monitor = AsyncMock()
                mock_monitor_class.return_value = mock_monitor
                mock_monitor.check_pool_health.return_value = {"status": "healthy"}
                
                response = await client.get("/api/database/pool/health")
                
                assert response.status_code == 200
                data = response.json()
                assert data["status"] == "healthy"
    
    @pytest.mark.asyncio
    async def test_non_admin_access_denied(self, client, auth_headers_non_admin):
        """Test that non-admin users cannot access pool management."""
        response = await client.get(
            "/api/database/pool/stats",
            headers=auth_headers_non_admin
        )
        
        assert response.status_code == 403


if __name__ == "__main__":
    pytest.main([__file__, "-v"])