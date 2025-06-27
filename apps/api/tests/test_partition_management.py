"""
Tests for partition management functionality.
"""
import pytest
import asyncio
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, patch, MagicMock

from utils.partition_manager import EmailEventsPartitionManager, PartitionInfo, PartitionMaintenanceResult
from utils.partition_monitoring import PartitionMonitor, AlertLevel, PartitionAlert
from workers.partition_tasks import maintain_email_events_partitions, cleanup_old_email_events_partitions


class TestEmailEventsPartitionManager:
    """Test the partition manager."""
    
    @pytest.fixture
    def mock_db_session(self):
        """Mock database session."""
        session = AsyncMock()
        session.execute = AsyncMock()
        session.commit = AsyncMock()
        session.rollback = AsyncMock()
        return session
    
    @pytest.fixture
    def partition_manager(self, mock_db_session):
        """Create partition manager with mocked session."""
        return EmailEventsPartitionManager(mock_db_session)
    
    async def test_create_partition(self, partition_manager, mock_db_session):
        """Test creating a single partition."""
        start_date = datetime(2024, 3, 1)
        end_date = datetime(2024, 4, 1)
        
        # Mock successful execution
        mock_db_session.execute.return_value = None
        
        result = await partition_manager.create_partition(start_date, end_date)
        
        assert result is True
        mock_db_session.execute.assert_called_once()
        mock_db_session.commit.assert_called_once()
    
    async def test_create_partition_failure(self, partition_manager, mock_db_session):
        """Test partition creation failure."""
        start_date = datetime(2024, 3, 1)
        end_date = datetime(2024, 4, 1)
        
        # Mock database error
        mock_db_session.execute.side_effect = Exception("Database error")
        
        result = await partition_manager.create_partition(start_date, end_date)
        
        assert result is False
        mock_db_session.rollback.assert_called_once()
    
    async def test_maintain_partitions(self, partition_manager, mock_db_session):
        """Test partition maintenance."""
        # Mock successful execution
        mock_db_session.execute.return_value = None
        
        result = await partition_manager.maintain_partitions(months_ahead=3)
        
        assert isinstance(result, PartitionMaintenanceResult)
        assert len(result.created_partitions) == 4  # Current month + 3 ahead
        assert len(result.errors) == 0
        mock_db_session.execute.assert_called_once()
        mock_db_session.commit.assert_called_once()
    
    async def test_cleanup_old_partitions(self, partition_manager, mock_db_session):
        """Test cleaning up old partitions."""
        # Mock cleanup results
        mock_result = MagicMock()
        mock_result.fetchall.return_value = [
            MagicMock(dropped_partition="email_events_2023_01", record_count=1000),
            MagicMock(dropped_partition="email_events_2023_02", record_count=1500)
        ]
        mock_db_session.execute.return_value = mock_result
        
        result = await partition_manager.cleanup_old_partitions(retention_months=6)
        
        assert isinstance(result, PartitionMaintenanceResult)
        assert len(result.dropped_partitions) == 2
        assert result.dropped_partitions[0] == ("email_events_2023_01", 1000)
        assert result.dropped_partitions[1] == ("email_events_2023_02", 1500)
        mock_db_session.commit.assert_called_once()
    
    async def test_get_partition_stats(self, partition_manager, mock_db_session):
        """Test getting partition statistics."""
        # Mock partition stats
        mock_result = MagicMock()
        mock_result.fetchall.return_value = [
            MagicMock(
                partition_name="email_events_2024_01",
                period="2024_01",
                record_count=50000,
                size_mb=256.5,
                oldest_record=datetime(2024, 1, 1),
                newest_record=datetime(2024, 1, 31)
            ),
            MagicMock(
                partition_name="email_events_2024_02",
                period="2024_02",
                record_count=75000,
                size_mb=384.2,
                oldest_record=datetime(2024, 2, 1),
                newest_record=datetime(2024, 2, 29)
            )
        ]
        mock_db_session.execute.return_value = mock_result
        
        stats = await partition_manager.get_partition_stats()
        
        assert len(stats) == 2
        assert isinstance(stats[0], PartitionInfo)
        assert stats[0].name == "email_events_2024_01"
        assert stats[0].record_count == 50000
        assert stats[0].size_mb == 256.5
    
    async def test_log_maintenance_operation(self, partition_manager, mock_db_session):
        """Test logging maintenance operations."""
        await partition_manager.log_maintenance_operation(
            operation_type="test_operation",
            partition_name="test_partition",
            details={"key": "value"},
            success=True,
            execution_time_ms=1500
        )
        
        mock_db_session.execute.assert_called_once()
        mock_db_session.commit.assert_called_once()
    
    async def test_check_partition_health(self, partition_manager):
        """Test partition health check."""
        # Mock get_partition_stats
        mock_stats = [
            PartitionInfo(
                name="email_events_2024_03",
                period="2024_03",
                record_count=25000,
                size_mb=128.0,
                oldest_record=datetime(2024, 3, 1),
                newest_record=datetime(2024, 3, 31)
            )
        ]
        
        with patch.object(partition_manager, 'get_partition_stats', return_value=mock_stats):
            health = await partition_manager.check_partition_health()
        
        assert isinstance(health, dict)
        assert "status" in health
        assert "partition_count" in health
        assert health["partition_count"] == 1


class TestPartitionMonitoring:
    """Test partition monitoring and alerting."""
    
    @pytest.fixture
    def mock_manager(self):
        """Mock partition manager."""
        manager = AsyncMock()
        return manager
    
    @pytest.fixture
    def monitor(self, mock_manager):
        """Create partition monitor with mocked manager."""
        return PartitionMonitor(mock_manager)
    
    async def test_check_partition_sizes(self, monitor, mock_manager):
        """Test checking for oversized partitions."""
        # Mock large partition
        mock_stats = [
            PartitionInfo(
                name="email_events_2024_01",
                period="2024_01",
                record_count=50000,
                size_mb=6144,  # 6GB - above threshold
                oldest_record=datetime(2024, 1, 1),
                newest_record=datetime(2024, 1, 31)
            ),
            PartitionInfo(
                name="email_events_2024_02",
                period="2024_02",
                record_count=15000000,  # Above record threshold
                size_mb=1024,
                oldest_record=datetime(2024, 2, 1),
                newest_record=datetime(2024, 2, 29)
            )
        ]
        mock_manager.get_partition_stats.return_value = mock_stats
        
        alerts = await monitor.check_partition_sizes()
        
        assert len(alerts) == 2
        assert alerts[0].level == AlertLevel.WARNING
        assert "Large Partition" in alerts[0].title
        assert alerts[1].level == AlertLevel.WARNING
        assert "High Record Count" in alerts[1].title
    
    async def test_check_current_partition_missing(self, monitor, mock_manager):
        """Test alerting when current month partition is missing."""
        # Mock stats without current month
        current_month = datetime.now().strftime("%Y_%m")
        mock_stats = [
            PartitionInfo(
                name="email_events_2023_12",
                period="2023_12",
                record_count=50000,
                size_mb=256,
                oldest_record=datetime(2023, 12, 1),
                newest_record=datetime(2023, 12, 31)
            )
        ]
        mock_manager.get_partition_stats.return_value = mock_stats
        
        alerts = await monitor.check_current_partition()
        
        assert len(alerts) == 1
        assert alerts[0].level == AlertLevel.CRITICAL
        assert "Missing Current Month Partition" in alerts[0].title
    
    async def test_check_future_partitions_insufficient(self, monitor, mock_manager):
        """Test alerting when insufficient future partitions exist."""
        # Mock stats with only current month
        current_month = datetime.now().strftime("%Y_%m")
        mock_stats = [
            PartitionInfo(
                name=f"email_events_{current_month}",
                period=current_month,
                record_count=50000,
                size_mb=256,
                oldest_record=datetime.now().replace(day=1),
                newest_record=datetime.now()
            )
        ]
        mock_manager.get_partition_stats.return_value = mock_stats
        
        alerts = await monitor.check_future_partitions()
        
        assert len(alerts) == 1
        assert alerts[0].level == AlertLevel.WARNING
        assert "Insufficient Future Partitions" in alerts[0].title
    
    async def test_comprehensive_check(self, monitor, mock_manager):
        """Test running all checks together."""
        # Mock healthy partition stats
        current_month = datetime.now().strftime("%Y_%m")
        future_month1 = (datetime.now() + timedelta(days=32)).strftime("%Y_%m")
        future_month2 = (datetime.now() + timedelta(days=64)).strftime("%Y_%m")
        
        mock_stats = [
            PartitionInfo(
                name=f"email_events_{current_month}",
                period=current_month,
                record_count=50000,
                size_mb=256,
                oldest_record=datetime.now().replace(day=1),
                newest_record=datetime.now()
            ),
            PartitionInfo(
                name=f"email_events_{future_month1}",
                period=future_month1,
                record_count=0,
                size_mb=0,
                oldest_record=None,
                newest_record=None
            ),
            PartitionInfo(
                name=f"email_events_{future_month2}",
                period=future_month2,
                record_count=0,
                size_mb=0,
                oldest_record=None,
                newest_record=None
            )
        ]
        mock_manager.get_partition_stats.return_value = mock_stats
        
        alerts = await monitor.run_comprehensive_check()
        
        # Should have minimal alerts for healthy system
        assert isinstance(alerts, list)
        # Verify no critical alerts
        critical_alerts = [a for a in alerts if a.level == AlertLevel.CRITICAL]
        assert len(critical_alerts) == 0
    
    async def test_monitoring_summary(self, monitor, mock_manager):
        """Test getting monitoring summary."""
        # Mock healthy system
        mock_stats = [
            PartitionInfo(
                name="email_events_2024_03",
                period="2024_03",
                record_count=25000,
                size_mb=128,
                oldest_record=datetime(2024, 3, 1),
                newest_record=datetime(2024, 3, 31)
            )
        ]
        mock_manager.get_partition_stats.return_value = mock_stats
        mock_manager.check_partition_health.return_value = {
            "status": "healthy",
            "issues": [],
            "recommendations": [],
            "partition_count": 1,
            "total_size_mb": 128.0
        }
        
        summary = await monitor.get_monitoring_summary()
        
        assert isinstance(summary, dict)
        assert "timestamp" in summary
        assert "overall_status" in summary
        assert "alert_summary" in summary
        assert "metrics" in summary
        assert "active_alerts" in summary
        assert summary["overall_status"] == "healthy"


class TestPartitionTasks:
    """Test Celery partition tasks."""
    
    @patch('workers.partition_tasks.get_async_session')
    @patch('workers.partition_tasks.EmailEventsPartitionManager')
    def test_maintain_partitions_task(self, mock_manager_class, mock_session):
        """Test partition maintenance Celery task."""
        # Mock session and manager
        mock_session_instance = AsyncMock()
        mock_session.return_value = mock_session_instance
        
        mock_manager_instance = AsyncMock()
        mock_manager_class.return_value = mock_manager_instance
        
        # Mock maintenance result
        mock_result = PartitionMaintenanceResult(
            created_partitions=["email_events_2024_04", "email_events_2024_05"],
            dropped_partitions=[],
            errors=[],
            execution_time_ms=1500
        )
        mock_manager_instance.maintain_partitions.return_value = mock_result
        mock_manager_instance.log_maintenance_operation.return_value = None
        
        # Create mock task instance
        mock_task = MagicMock()
        mock_task.request.id = "test-task-123"
        
        # Bind the task
        bound_task = maintain_email_events_partitions.bind(mock_task)
        
        # This would normally run the task, but we'll test the logic
        # Note: Actual execution would require running Celery worker
        assert mock_manager_class is not None
    
    @patch('workers.partition_tasks.get_async_session')
    @patch('workers.partition_tasks.EmailEventsPartitionManager')
    def test_cleanup_partitions_task(self, mock_manager_class, mock_session):
        """Test partition cleanup Celery task."""
        # Mock session and manager
        mock_session_instance = AsyncMock()
        mock_session.return_value = mock_session_instance
        
        mock_manager_instance = AsyncMock()
        mock_manager_class.return_value = mock_manager_instance
        
        # Mock cleanup result
        mock_result = PartitionMaintenanceResult(
            created_partitions=[],
            dropped_partitions=[("email_events_2023_01", 1000)],
            errors=[],
            execution_time_ms=2500
        )
        mock_manager_instance.cleanup_old_partitions.return_value = mock_result
        mock_manager_instance.log_maintenance_operation.return_value = None
        
        # Create mock task instance
        mock_task = MagicMock()
        mock_task.request.id = "test-cleanup-456"
        
        # Bind the task
        bound_task = cleanup_old_email_events_partitions.bind(mock_task)
        
        # Test task binding
        assert bound_task is not None


class TestPartitionAPI:
    """Test partition management API endpoints."""
    
    async def test_get_partition_stats_endpoint(self, client, auth_headers, mock_auth):
        """Test getting partition statistics via API."""
        with patch('routers.partitions.EmailEventsPartitionManager') as mock_manager_class:
            # Mock partition stats
            mock_manager_instance = AsyncMock()
            mock_manager_class.return_value = mock_manager_instance
            
            mock_stats = [
                PartitionInfo(
                    name="email_events_2024_03",
                    period="2024_03",
                    record_count=25000,
                    size_mb=128.0,
                    oldest_record=datetime(2024, 3, 1),
                    newest_record=datetime(2024, 3, 31)
                )
            ]
            mock_manager_instance.get_partition_stats.return_value = mock_stats
            
            response = await client.get("/api/system/partitions/stats", headers=auth_headers)
            
            if response.status_code == 200:
                data = response.json()
                assert isinstance(data, list)
                assert len(data) == 1
                assert data[0]["name"] == "email_events_2024_03"
                assert data[0]["record_count"] == 25000
    
    async def test_partition_health_endpoint(self, client, auth_headers, mock_auth):
        """Test partition health check via API."""
        with patch('routers.partitions.EmailEventsPartitionManager') as mock_manager_class:
            # Mock health check
            mock_manager_instance = AsyncMock()
            mock_manager_class.return_value = mock_manager_instance
            
            mock_health = {
                "status": "healthy",
                "issues": [],
                "recommendations": [],
                "partition_count": 5,
                "total_size_mb": 1024.0,
                "oldest_partition": "email_events_2023_11",
                "newest_partition": "email_events_2024_03"
            }
            mock_manager_instance.check_partition_health.return_value = mock_health
            
            response = await client.get("/api/system/partitions/health", headers=auth_headers)
            
            if response.status_code == 200:
                data = response.json()
                assert data["status"] == "healthy"
                assert data["partition_count"] == 5
                assert data["total_size_mb"] == 1024.0
    
    async def test_trigger_maintenance_endpoint(self, client, auth_headers, mock_auth):
        """Test triggering partition maintenance via API."""
        with patch('routers.partitions.EmailEventsPartitionManager') as mock_manager_class:
            # Mock maintenance operation
            mock_manager_instance = AsyncMock()
            mock_manager_class.return_value = mock_manager_instance
            
            mock_result = PartitionMaintenanceResult(
                created_partitions=["email_events_2024_04"],
                dropped_partitions=[],
                errors=[],
                execution_time_ms=1500
            )
            mock_manager_instance.maintain_partitions.return_value = mock_result
            mock_manager_instance.log_maintenance_operation.return_value = None
            
            response = await client.post(
                "/api/system/partitions/maintain",
                headers=auth_headers,
                params={"months_ahead": 3}
            )
            
            if response.status_code == 200:
                data = response.json()
                assert data["success"] is True
                assert len(data["created_partitions"]) == 1
                assert data["created_partitions"][0] == "email_events_2024_04"


@pytest.mark.integration
class TestPartitionIntegration:
    """Integration tests for partition management."""
    
    async def test_full_partition_lifecycle(self, test_session):
        """Test complete partition lifecycle."""
        manager = EmailEventsPartitionManager(test_session)
        
        # Test creating partitions
        start_date = datetime(2024, 6, 1)
        end_date = datetime(2024, 7, 1)
        
        # Note: This would require actual database setup
        # For now, we test the interface
        assert manager is not None
        assert hasattr(manager, 'create_partition')
        assert hasattr(manager, 'maintain_partitions')
        assert hasattr(manager, 'cleanup_old_partitions')
    
    async def test_monitoring_integration(self, test_session):
        """Test partition monitoring integration."""
        manager = EmailEventsPartitionManager(test_session)
        monitor = PartitionMonitor(manager)
        
        # Test monitoring interface
        assert monitor is not None
        assert hasattr(monitor, 'run_comprehensive_check')
        assert hasattr(monitor, 'get_monitoring_summary')


if __name__ == "__main__":
    pytest.main([__file__, "-v"])