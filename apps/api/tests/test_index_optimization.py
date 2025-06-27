"""
Tests for index optimization and monitoring functionality.
"""
import pytest
from datetime import datetime
from unittest.mock import AsyncMock, patch, MagicMock

from utils.index_monitor import (
    IndexMonitor,
    IndexInfo,
    TableStats,
    IndexRecommendation,
    IndexStatus,
    quick_index_check,
    optimize_table_indexes
)


class TestIndexMonitor:
    """Test the index monitoring functionality."""
    
    @pytest.fixture
    def mock_db_session(self):
        """Mock database session."""
        session = AsyncMock()
        session.execute = AsyncMock()
        return session
    
    @pytest.fixture
    def index_monitor(self, mock_db_session):
        """Create index monitor with mocked session."""
        return IndexMonitor(mock_db_session)
    
    async def test_get_index_usage_stats(self, index_monitor, mock_db_session):
        """Test getting index usage statistics."""
        # Mock query results
        mock_result = MagicMock()
        mock_result.fetchall.return_value = [
            MagicMock(
                schemaname="public",
                tablename="campaigns",
                indexname="idx_campaigns_workspace_created",
                index_size="45 MB",
                index_size_bytes=47185920,
                scan_count=158420,
                tuples_read=5000000,
                tuples_fetched=4500000,
                is_unique=False,
                is_primary=False,
                index_definition="CREATE INDEX idx_campaigns_workspace_created ON campaigns(workspace_id, created_at DESC)"
            ),
            MagicMock(
                schemaname="public",
                tablename="campaigns",
                indexname="idx_campaigns_unused",
                index_size="10 MB",
                index_size_bytes=10485760,
                scan_count=0,
                tuples_read=0,
                tuples_fetched=0,
                is_unique=False,
                is_primary=False,
                index_definition="CREATE INDEX idx_campaigns_unused ON campaigns(old_column)"
            )
        ]
        mock_db_session.execute.return_value = mock_result
        
        # Get index stats
        stats = await index_monitor.get_index_usage_stats()
        
        assert len(stats) == 2
        assert isinstance(stats[0], IndexInfo)
        
        # Check first index (used)
        assert stats[0].table_name == "campaigns"
        assert stats[0].index_name == "idx_campaigns_workspace_created"
        assert stats[0].scan_count == 158420
        assert stats[0].status == IndexStatus.OPTIMAL
        
        # Check second index (unused)
        assert stats[1].index_name == "idx_campaigns_unused"
        assert stats[1].scan_count == 0
        assert stats[1].status == IndexStatus.UNDERUSED
    
    async def test_get_table_statistics(self, index_monitor, mock_db_session):
        """Test getting table statistics."""
        # Mock query results
        mock_result = MagicMock()
        mock_result.fetchall.return_value = [
            MagicMock(
                schemaname="public",
                tablename="email_events",
                row_count=5000000,
                table_size="2.5 GB",
                table_size_bytes=2684354560,
                sequential_scans=50000,
                index_scans=10000,
                seq_scan_ratio=83.33,
                last_vacuum=datetime(2024, 3, 1),
                last_analyze=datetime(2024, 3, 10)
            )
        ]
        mock_db_session.execute.return_value = mock_result
        
        # Get table stats
        stats = await index_monitor.get_table_statistics(min_size_mb=100)
        
        assert len(stats) == 1
        assert isinstance(stats[0], TableStats)
        assert stats[0].table_name == "email_events"
        assert stats[0].sequential_scan_ratio == 83.33
        assert stats[0].needs_indexing is True  # High seq scan ratio
    
    async def test_get_index_recommendations(self, index_monitor, mock_db_session):
        """Test generating index recommendations."""
        # Mock table stats for recommendations
        with patch.object(index_monitor, 'get_table_statistics') as mock_get_stats:
            mock_get_stats.return_value = [
                TableStats(
                    schema_name="public",
                    table_name="messages",
                    row_count=1000000,
                    table_size="500 MB",
                    table_size_bytes=524288000,
                    sequential_scans=75000,
                    index_scans=25000,
                    sequential_scan_ratio=75.0,
                    last_vacuum=None,
                    last_analyze=None,
                    needs_indexing=True
                )
            ]
            
            # Mock common filters analysis
            with patch.object(index_monitor, '_analyze_common_filters') as mock_filters:
                mock_filters.return_value = [["workspace_id", "created_at"]]
                
                # Mock foreign key check
                mock_fk_result = MagicMock()
                mock_fk_result.fetchall.return_value = []
                mock_db_session.execute.return_value = mock_fk_result
                
                # Get recommendations
                recommendations = await index_monitor.get_index_recommendations()
                
                assert len(recommendations) >= 1
                assert isinstance(recommendations[0], IndexRecommendation)
                assert recommendations[0].table_name == "messages"
                assert recommendations[0].columns == ["workspace_id", "created_at"]
                assert "High sequential scan ratio" in recommendations[0].reason
                assert recommendations[0].priority in ["high", "medium"]
    
    async def test_check_index_bloat(self, index_monitor, mock_db_session):
        """Test checking for index bloat."""
        # Mock bloat query results
        mock_result = MagicMock()
        mock_result.fetchall.return_value = [
            MagicMock(
                schemaname="public",
                tablename="campaigns",
                indexname="idx_campaigns_old",
                index_size="100 MB",
                bloat_size="25 MB",
                bloat_ratio=25.0
            )
        ]
        mock_db_session.execute.return_value = mock_result
        
        # Check bloat
        bloated = await index_monitor.check_index_bloat(bloat_threshold=0.2)
        
        assert len(bloated) == 1
        assert bloated[0]["index_name"] == "idx_campaigns_old"
        assert bloated[0]["bloat_ratio"] == 25.0
        assert bloated[0]["action"] == "REINDEX CONCURRENTLY"
    
    async def test_generate_index_report(self, index_monitor):
        """Test generating comprehensive index report."""
        # Mock all the component methods
        with patch.object(index_monitor, 'get_index_usage_stats') as mock_usage:
            mock_usage.return_value = [
                IndexInfo(
                    schema_name="public",
                    table_name="campaigns",
                    index_name="idx_test",
                    index_size="10 MB",
                    index_size_bytes=10485760,
                    scan_count=1000,
                    tuples_read=10000,
                    tuples_fetched=9000,
                    is_unique=False,
                    is_primary=False,
                    columns=["workspace_id"],
                    status=IndexStatus.OPTIMAL
                )
            ]
            
            with patch.object(index_monitor, 'get_table_statistics') as mock_tables:
                mock_tables.return_value = []
                
                with patch.object(index_monitor, 'analyze_slow_queries') as mock_slow:
                    mock_slow.return_value = []
                    
                    with patch.object(index_monitor, 'get_index_recommendations') as mock_recs:
                        mock_recs.return_value = []
                        
                        with patch.object(index_monitor, 'check_index_bloat') as mock_bloat:
                            mock_bloat.return_value = []
                            
                            # Generate report
                            report = await index_monitor.generate_index_report()
                            
                            assert "summary" in report
                            assert report["summary"]["total_indexes"] == 1
                            assert report["summary"]["unused_indexes"] == 0
                            assert "index_usage" in report
                            assert len(report["index_usage"]) == 1


class TestIndexOptimizationAPI:
    """Test the database optimization API endpoints."""
    
    async def test_get_index_usage_endpoint(self, client, auth_headers, mock_auth):
        """Test getting index usage via API."""
        with patch('routers.database_optimization.IndexMonitor') as mock_monitor_class:
            # Mock index monitor
            mock_monitor = AsyncMock()
            mock_monitor_class.return_value = mock_monitor
            
            # Mock index stats
            mock_monitor.get_index_usage_stats.return_value = [
                IndexInfo(
                    schema_name="public",
                    table_name="campaigns",
                    index_name="idx_campaigns_workspace_created",
                    index_size="45 MB",
                    index_size_bytes=47185920,
                    scan_count=158420,
                    tuples_read=5000000,
                    tuples_fetched=4500000,
                    is_unique=False,
                    is_primary=False,
                    columns=["workspace_id", "created_at"],
                    status=IndexStatus.OPTIMAL
                )
            ]
            
            response = await client.get(
                "/api/system/database/indexes/usage",
                headers=auth_headers
            )
            
            assert response.status_code == 200
            data = response.json()
            assert len(data) == 1
            assert data[0]["table_name"] == "campaigns"
            assert data[0]["scan_count"] == 158420
            assert data[0]["status"] == "optimal"
    
    async def test_get_index_recommendations_endpoint(self, client, auth_headers, mock_auth):
        """Test getting index recommendations via API."""
        with patch('routers.database_optimization.IndexMonitor') as mock_monitor_class:
            # Mock index monitor
            mock_monitor = AsyncMock()
            mock_monitor_class.return_value = mock_monitor
            
            # Mock recommendations
            mock_monitor.get_index_recommendations.return_value = [
                IndexRecommendation(
                    table_name="messages",
                    columns=["workspace_id", "created_at"],
                    reason="High sequential scan ratio (75%)",
                    estimated_improvement="Could reduce scan time by up to 75%",
                    priority="high",
                    create_statement="CREATE INDEX CONCURRENTLY idx_messages_workspace_created ON messages (workspace_id, created_at DESC);"
                )
            ]
            
            response = await client.get(
                "/api/system/database/indexes/recommendations",
                headers=auth_headers
            )
            
            assert response.status_code == 200
            data = response.json()
            assert len(data) == 1
            assert data[0]["table_name"] == "messages"
            assert data[0]["priority"] == "high"
            assert "CREATE INDEX" in data[0]["create_statement"]
    
    async def test_index_health_summary_endpoint(self, client, auth_headers, mock_auth):
        """Test getting index health summary via API."""
        with patch('routers.database_optimization.quick_index_check') as mock_check:
            # Mock health check
            mock_check.return_value = {
                "timestamp": datetime.utcnow().isoformat(),
                "total_indexes": 50,
                "unused_indexes": 5,
                "bloated_indexes": 2,
                "total_index_size": 524288000,
                "status": "healthy"
            }
            
            response = await client.get(
                "/api/system/database/indexes/health",
                headers=auth_headers
            )
            
            assert response.status_code == 200
            data = response.json()
            assert data["total_indexes"] == 50
            assert data["unused_indexes"] == 5
            assert data["status"] == "healthy"
    
    async def test_optimization_report_endpoint(self, client, auth_headers, mock_auth):
        """Test generating optimization report via API."""
        with patch('routers.database_optimization.IndexMonitor') as mock_monitor_class:
            # Mock index monitor
            mock_monitor = AsyncMock()
            mock_monitor_class.return_value = mock_monitor
            
            # Mock report generation
            mock_monitor.generate_index_report.return_value = {
                "generated_at": datetime.utcnow().isoformat(),
                "summary": {
                    "total_indexes": 50,
                    "unused_indexes": 5,
                    "bloated_indexes": 2,
                    "tables_needing_indexes": 3,
                    "slow_queries_analyzed": 10,
                    "recommendations_count": 4
                },
                "recommendations": [
                    {
                        "table": "messages",
                        "columns": ["workspace_id", "created_at"],
                        "reason": "High sequential scan ratio",
                        "priority": "high",
                        "sql": "CREATE INDEX ..."
                    }
                ],
                "maintenance_needed": [],
                "slow_queries": []
            }
            
            response = await client.get(
                "/api/system/database/optimization/report",
                headers=auth_headers
            )
            
            assert response.status_code == 200
            data = response.json()
            assert "summary" in data
            assert data["summary"]["total_indexes"] == 50
            assert len(data["recommendations"]) == 1
    
    async def test_non_admin_access_denied(self, client, auth_headers_non_admin):
        """Test that non-admin users cannot access optimization endpoints."""
        response = await client.get(
            "/api/system/database/indexes/usage",
            headers=auth_headers_non_admin
        )
        
        assert response.status_code == 403
        assert "Insufficient permissions" in response.json()["detail"]


class TestUtilityFunctions:
    """Test utility functions."""
    
    async def test_quick_index_check(self, mock_db_session):
        """Test quick index health check."""
        with patch('utils.index_monitor.IndexMonitor') as mock_monitor_class:
            # Mock monitor instance
            mock_monitor = AsyncMock()
            mock_monitor_class.return_value = mock_monitor
            
            # Mock index stats
            mock_monitor.get_index_usage_stats.return_value = [
                IndexInfo(
                    schema_name="public",
                    table_name="campaigns",
                    index_name="idx1",
                    index_size="10 MB",
                    index_size_bytes=10485760,
                    scan_count=1000,
                    tuples_read=10000,
                    tuples_fetched=9000,
                    is_unique=False,
                    is_primary=False,
                    columns=["col1"],
                    status=IndexStatus.OPTIMAL
                ),
                IndexInfo(
                    schema_name="public",
                    table_name="leads",
                    index_name="idx2",
                    index_size="5 MB",
                    index_size_bytes=5242880,
                    scan_count=0,
                    tuples_read=0,
                    tuples_fetched=0,
                    is_unique=False,
                    is_primary=False,
                    columns=["col2"],
                    status=IndexStatus.UNDERUSED
                )
            ]
            
            # Run quick check
            result = await quick_index_check(mock_db_session)
            
            assert result["total_indexes"] == 2
            assert result["unused_indexes"] == 1
            assert result["total_index_size"] == 15728640
            assert result["status"] == "healthy"  # Only 50% unused, below 20% threshold
    
    async def test_optimize_table_indexes(self, mock_db_session):
        """Test generating optimization commands for a table."""
        with patch('utils.index_monitor.IndexMonitor') as mock_monitor_class:
            # Mock monitor instance
            mock_monitor = AsyncMock()
            mock_monitor_class.return_value = mock_monitor
            
            # Mock recommendations
            mock_monitor.get_index_recommendations.return_value = [
                IndexRecommendation(
                    table_name="messages",
                    columns=["workspace_id", "created_at"],
                    reason="High sequential scan ratio",
                    estimated_improvement="75% improvement",
                    priority="high",
                    create_statement="CREATE INDEX CONCURRENTLY idx_messages_workspace_created ON messages (workspace_id, created_at DESC);"
                ),
                IndexRecommendation(
                    table_name="other_table",
                    columns=["col1"],
                    reason="Missing FK index",
                    estimated_improvement="JOIN improvement",
                    priority="medium",
                    create_statement="CREATE INDEX CONCURRENTLY idx_other_table_col1 ON other_table (col1);"
                )
            ]
            
            # Get commands for specific table
            commands = await optimize_table_indexes(mock_db_session, "messages")
            
            assert len(commands) == 1
            assert "idx_messages_workspace_created" in commands[0]
            assert "CREATE INDEX CONCURRENTLY" in commands[0]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])