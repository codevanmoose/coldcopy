"""
Partition monitoring and alerting utilities.
"""
import logging
import asyncio
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from enum import Enum

from utils.partition_manager import EmailEventsPartitionManager
from core.database import get_async_session

logger = logging.getLogger(__name__)


class AlertLevel(Enum):
    """Alert severity levels."""
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"
    ERROR = "error"


@dataclass
class PartitionAlert:
    """Partition monitoring alert."""
    level: AlertLevel
    title: str
    description: str
    partition_name: Optional[str] = None
    metric_value: Optional[float] = None
    threshold: Optional[float] = None
    recommendation: Optional[str] = None
    timestamp: datetime = None
    
    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.utcnow()


class PartitionMonitor:
    """Monitor partition health and generate alerts."""
    
    def __init__(self, manager: EmailEventsPartitionManager):
        self.manager = manager
        
        # Configurable thresholds
        self.thresholds = {
            "max_partition_size_gb": 5.0,  # Alert if partition > 5GB
            "min_future_partitions": 2,   # Alert if < 2 future partitions
            "max_records_per_partition": 10_000_000,  # 10M records
            "partition_size_growth_rate": 0.5,  # 50% month-over-month growth
            "missing_current_partition": True,  # Alert if current month missing
            "old_partition_threshold_days": 395,  # > 13 months old
        }
    
    async def check_partition_sizes(self) -> List[PartitionAlert]:
        """Check for oversized partitions."""
        alerts = []
        
        try:
            stats = await self.manager.get_partition_stats()
            
            for stat in stats:
                size_gb = stat.size_mb / 1024
                
                # Check if partition is too large
                if size_gb > self.thresholds["max_partition_size_gb"]:
                    alerts.append(PartitionAlert(
                        level=AlertLevel.WARNING,
                        title="Large Partition Detected",
                        description=f"Partition {stat.name} is {size_gb:.1f}GB",
                        partition_name=stat.name,
                        metric_value=size_gb,
                        threshold=self.thresholds["max_partition_size_gb"],
                        recommendation="Consider archiving old data or increasing partition frequency"
                    ))
                
                # Check if partition has too many records
                if stat.record_count > self.thresholds["max_records_per_partition"]:
                    alerts.append(PartitionAlert(
                        level=AlertLevel.WARNING,
                        title="High Record Count",
                        description=f"Partition {stat.name} has {stat.record_count:,} records",
                        partition_name=stat.name,
                        metric_value=stat.record_count,
                        threshold=self.thresholds["max_records_per_partition"],
                        recommendation="Monitor query performance and consider data archival"
                    ))
                    
        except Exception as e:
            alerts.append(PartitionAlert(
                level=AlertLevel.ERROR,
                title="Partition Size Check Failed",
                description=f"Unable to check partition sizes: {str(e)}",
                recommendation="Check database connectivity and permissions"
            ))
        
        return alerts
    
    async def check_future_partitions(self) -> List[PartitionAlert]:
        """Check if sufficient future partitions exist."""
        alerts = []
        
        try:
            stats = await self.manager.get_partition_stats()
            
            # Count future partitions
            current_month = datetime.now().strftime("%Y_%m")
            future_partitions = []
            
            for stat in stats:
                # Extract month from partition name (email_events_2024_03)
                if "_" in stat.period:
                    if stat.period > current_month:
                        future_partitions.append(stat.name)
            
            if len(future_partitions) < self.thresholds["min_future_partitions"]:
                alerts.append(PartitionAlert(
                    level=AlertLevel.WARNING,
                    title="Insufficient Future Partitions",
                    description=f"Only {len(future_partitions)} future partitions exist",
                    metric_value=len(future_partitions),
                    threshold=self.thresholds["min_future_partitions"],
                    recommendation="Run partition maintenance to create future partitions"
                ))
                
        except Exception as e:
            alerts.append(PartitionAlert(
                level=AlertLevel.ERROR,
                title="Future Partition Check Failed",
                description=f"Unable to check future partitions: {str(e)}",
                recommendation="Check database connectivity and permissions"
            ))
        
        return alerts
    
    async def check_current_partition(self) -> List[PartitionAlert]:
        """Check if current month partition exists."""
        alerts = []
        
        try:
            stats = await self.manager.get_partition_stats()
            current_month = datetime.now().strftime("%Y_%m")
            current_partition = f"email_events_{current_month}"
            
            # Check if current partition exists
            current_exists = any(stat.name == current_partition for stat in stats)
            
            if not current_exists:
                alerts.append(PartitionAlert(
                    level=AlertLevel.CRITICAL,
                    title="Missing Current Month Partition",
                    description=f"No partition found for current month: {current_partition}",
                    partition_name=current_partition,
                    recommendation="Immediately create current month partition to avoid data loss"
                ))
                
        except Exception as e:
            alerts.append(PartitionAlert(
                level=AlertLevel.ERROR,
                title="Current Partition Check Failed",
                description=f"Unable to check current partition: {str(e)}",
                recommendation="Check database connectivity and permissions"
            ))
        
        return alerts
    
    async def check_partition_growth(self) -> List[PartitionAlert]:
        """Check partition growth trends."""
        alerts = []
        
        try:
            stats = await self.manager.get_partition_stats()
            
            # Sort partitions by period
            sorted_stats = sorted(stats, key=lambda x: x.period)
            
            # Check growth rate between consecutive months
            for i in range(1, len(sorted_stats)):
                current = sorted_stats[i]
                previous = sorted_stats[i-1]
                
                if previous.size_mb > 0:
                    growth_rate = (current.size_mb - previous.size_mb) / previous.size_mb
                    
                    if growth_rate > self.thresholds["partition_size_growth_rate"]:
                        alerts.append(PartitionAlert(
                            level=AlertLevel.INFO,
                            title="High Partition Growth",
                            description=f"Partition {current.name} grew {growth_rate:.1%} from previous month",
                            partition_name=current.name,
                            metric_value=growth_rate,
                            threshold=self.thresholds["partition_size_growth_rate"],
                            recommendation="Monitor email volume trends and capacity planning"
                        ))
                        
        except Exception as e:
            alerts.append(PartitionAlert(
                level=AlertLevel.ERROR,
                title="Growth Analysis Failed",
                description=f"Unable to analyze partition growth: {str(e)}",
                recommendation="Check partition statistics availability"
            ))
        
        return alerts
    
    async def check_old_partitions(self) -> List[PartitionAlert]:
        """Check for very old partitions that should be archived."""
        alerts = []
        
        try:
            stats = await self.manager.get_partition_stats()
            cutoff_date = datetime.now() - timedelta(days=self.thresholds["old_partition_threshold_days"])
            
            old_partitions = []
            total_old_size = 0
            
            for stat in stats:
                if stat.oldest_record and stat.oldest_record < cutoff_date:
                    old_partitions.append(stat.name)
                    total_old_size += stat.size_mb
            
            if old_partitions:
                alerts.append(PartitionAlert(
                    level=AlertLevel.INFO,
                    title="Old Partitions Detected",
                    description=f"{len(old_partitions)} partitions older than {self.thresholds['old_partition_threshold_days']} days ({total_old_size:.1f}MB total)",
                    metric_value=len(old_partitions),
                    recommendation="Consider archiving or cleaning up old partitions to save space"
                ))
                
        except Exception as e:
            alerts.append(PartitionAlert(
                level=AlertLevel.ERROR,
                title="Old Partition Check Failed",
                description=f"Unable to check for old partitions: {str(e)}",
                recommendation="Check partition statistics availability"
            ))
        
        return alerts
    
    async def run_comprehensive_check(self) -> List[PartitionAlert]:
        """Run all partition checks and return combined alerts."""
        all_alerts = []
        
        # Run all checks concurrently
        check_tasks = [
            self.check_partition_sizes(),
            self.check_future_partitions(),
            self.check_current_partition(),
            self.check_partition_growth(),
            self.check_old_partitions()
        ]
        
        try:
            results = await asyncio.gather(*check_tasks, return_exceptions=True)
            
            for result in results:
                if isinstance(result, list):
                    all_alerts.extend(result)
                elif isinstance(result, Exception):
                    all_alerts.append(PartitionAlert(
                        level=AlertLevel.ERROR,
                        title="Monitoring Check Failed",
                        description=f"A monitoring check failed: {str(result)}",
                        recommendation="Check monitoring system logs"
                    ))
                    
        except Exception as e:
            all_alerts.append(PartitionAlert(
                level=AlertLevel.ERROR,
                title="Comprehensive Check Failed",
                description=f"Unable to run comprehensive partition check: {str(e)}",
                recommendation="Check monitoring system configuration"
            ))
        
        return all_alerts
    
    async def get_monitoring_summary(self) -> Dict:
        """Get a summary of partition monitoring status."""
        alerts = await self.run_comprehensive_check()
        health = await self.manager.check_partition_health()
        stats = await self.manager.get_partition_stats()
        
        # Count alerts by level
        alert_counts = {level.value: 0 for level in AlertLevel}
        for alert in alerts:
            alert_counts[alert.level.value] += 1
        
        # Calculate summary metrics
        total_size_gb = sum(stat.size_mb for stat in stats) / 1024
        total_records = sum(stat.record_count for stat in stats)
        avg_size_mb = sum(stat.size_mb for stat in stats) / len(stats) if stats else 0
        
        return {
            "timestamp": datetime.utcnow().isoformat(),
            "overall_status": health["status"],
            "alert_summary": alert_counts,
            "metrics": {
                "total_partitions": len(stats),
                "total_size_gb": round(total_size_gb, 2),
                "total_records": total_records,
                "avg_partition_size_mb": round(avg_size_mb, 2)
            },
            "health_issues": health["issues"],
            "recommendations": health["recommendations"],
            "active_alerts": [
                {
                    "level": alert.level.value,
                    "title": alert.title,
                    "description": alert.description,
                    "partition_name": alert.partition_name,
                    "recommendation": alert.recommendation,
                    "timestamp": alert.timestamp.isoformat()
                }
                for alert in alerts
            ]
        }


class PartitionAlerting:
    """Handle partition monitoring alerts."""
    
    def __init__(self):
        self.alert_handlers = []
    
    def add_handler(self, handler):
        """Add an alert handler function."""
        self.alert_handlers.append(handler)
    
    async def send_alerts(self, alerts: List[PartitionAlert]):
        """Send alerts through all configured handlers."""
        if not alerts:
            return
        
        # Group alerts by level
        critical_alerts = [a for a in alerts if a.level == AlertLevel.CRITICAL]
        warning_alerts = [a for a in alerts if a.level == AlertLevel.WARNING]
        error_alerts = [a for a in alerts if a.level == AlertLevel.ERROR]
        
        # Send critical alerts immediately
        if critical_alerts:
            for handler in self.alert_handlers:
                try:
                    await handler(critical_alerts, urgent=True)
                except Exception as e:
                    logger.error(f"Alert handler failed: {e}")
        
        # Send other alerts in batch
        other_alerts = warning_alerts + error_alerts
        if other_alerts:
            for handler in self.alert_handlers:
                try:
                    await handler(other_alerts, urgent=False)
                except Exception as e:
                    logger.error(f"Alert handler failed: {e}")


# Example alert handlers
async def log_alert_handler(alerts: List[PartitionAlert], urgent: bool = False):
    """Log alerts to application logs."""
    for alert in alerts:
        if alert.level == AlertLevel.CRITICAL:
            logger.critical(f"PARTITION ALERT: {alert.title} - {alert.description}")
        elif alert.level == AlertLevel.ERROR:
            logger.error(f"PARTITION ALERT: {alert.title} - {alert.description}")
        elif alert.level == AlertLevel.WARNING:
            logger.warning(f"PARTITION ALERT: {alert.title} - {alert.description}")
        else:
            logger.info(f"PARTITION ALERT: {alert.title} - {alert.description}")


async def email_alert_handler(alerts: List[PartitionAlert], urgent: bool = False):
    """Send email alerts (placeholder implementation)."""
    # This would integrate with your email service
    subject_prefix = "[URGENT] " if urgent else ""
    
    critical_count = len([a for a in alerts if a.level == AlertLevel.CRITICAL])
    warning_count = len([a for a in alerts if a.level == AlertLevel.WARNING])
    
    subject = f"{subject_prefix}Partition Monitoring: {critical_count} critical, {warning_count} warnings"
    
    # Build email body
    body_lines = ["Partition Monitoring Alert Summary", "=" * 40, ""]
    
    for alert in alerts:
        body_lines.extend([
            f"Level: {alert.level.value.upper()}",
            f"Title: {alert.title}",
            f"Description: {alert.description}",
        ])
        
        if alert.partition_name:
            body_lines.append(f"Partition: {alert.partition_name}")
        if alert.recommendation:
            body_lines.append(f"Recommendation: {alert.recommendation}")
        
        body_lines.append("")
    
    body = "\n".join(body_lines)
    
    logger.info(f"Email alert would be sent: {subject}")
    # TODO: Integrate with actual email service


# Scheduled monitoring function
async def scheduled_partition_monitoring():
    """Run scheduled partition monitoring."""
    session = None
    try:
        session = get_async_session()
        manager = EmailEventsPartitionManager(session)
        monitor = PartitionMonitor(manager)
        alerting = PartitionAlerting()
        
        # Add alert handlers
        alerting.add_handler(log_alert_handler)
        # alerting.add_handler(email_alert_handler)  # Enable when email is configured
        
        # Run monitoring
        alerts = await monitor.run_comprehensive_check()
        
        # Send alerts
        await alerting.send_alerts(alerts)
        
        # Log summary
        summary = await monitor.get_monitoring_summary()
        logger.info(f"Partition monitoring completed: {summary['alert_summary']}")
        
        return summary
        
    except Exception as e:
        logger.error(f"Scheduled partition monitoring failed: {e}")
        raise
    finally:
        if session:
            await session.close()


if __name__ == "__main__":
    # Manual monitoring execution
    asyncio.run(scheduled_partition_monitoring())