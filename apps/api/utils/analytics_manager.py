"""
Analytics Manager for ColdCopy Campaign Analytics.

This module provides high-level access to materialized views and analytics data,
with automatic caching and efficient querying capabilities.
"""
import logging
import asyncio
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass
from enum import Enum
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from core.database import get_db

logger = logging.getLogger(__name__)


class AnalyticsTimeframe(Enum):
    """Analytics timeframe options."""
    LAST_7_DAYS = "7d"
    LAST_30_DAYS = "30d"
    LAST_90_DAYS = "90d"
    LAST_6_MONTHS = "6m"
    LAST_YEAR = "1y"
    ALL_TIME = "all"


class EngagementSegment(Enum):
    """Lead engagement segments."""
    HOT = "hot"
    WARM = "warm"
    LUKEWARM = "lukewarm"
    COLD = "cold"


@dataclass
class CampaignPerformance:
    """Campaign performance metrics."""
    campaign_id: str
    campaign_name: str
    workspace_id: str
    emails_sent: int
    emails_delivered: int
    unique_opens: int
    unique_clicks: int
    delivery_rate: float
    open_rate: float
    click_through_rate: float
    bounce_rate: float
    performance_score: float
    last_activity: Optional[datetime]
    total_leads: int


@dataclass
class WorkspaceAnalytics:
    """Workspace-level analytics summary."""
    workspace_id: str
    workspace_name: str
    total_campaigns: int
    active_campaigns: int
    total_emails_sent: int
    overall_delivery_rate: float
    overall_open_rate: float
    overall_click_through_rate: float
    avg_campaign_performance: float
    campaigns_created_last_30_days: int
    emails_sent_last_30_days: int
    total_leads_contacted: int


@dataclass
class LeadEngagement:
    """Lead engagement analytics."""
    lead_id: str
    workspace_id: str
    lead_email: str
    first_name: Optional[str]
    last_name: Optional[str]
    company: Optional[str]
    emails_received: int
    total_opens: int
    total_clicks: int
    personal_open_rate: float
    personal_click_rate: float
    engagement_score: int
    engagement_segment: str
    first_contact_date: Optional[datetime]
    last_activity_date: Optional[datetime]
    has_clicked: bool


@dataclass
class OptimalSendTime:
    """Optimal send time recommendation."""
    send_hour: int
    day_of_week: int
    day_name: str
    time_period: str
    day_type: str
    open_rate: float
    click_rate: float
    emails_sent: int
    performance_score: float


@dataclass
class DailyTrend:
    """Daily performance trend."""
    campaign_id: str
    trend_date: datetime
    daily_sent: int
    daily_delivered: int
    daily_unique_opens: int
    daily_unique_clicks: int
    daily_delivery_rate: float
    daily_open_rate: float
    day_type: str


class CampaignAnalyticsManager:
    """Manages campaign analytics and materialized view operations."""
    
    def __init__(self, db_session: AsyncSession):
        self.db = db_session
    
    async def get_campaign_performance(
        self, 
        workspace_id: str, 
        campaign_id: Optional[str] = None,
        limit: int = 100,
        sort_by: str = "performance_score",
        sort_desc: bool = True
    ) -> List[CampaignPerformance]:
        """
        Get campaign performance metrics from materialized view.
        
        Args:
            workspace_id: Workspace UUID
            campaign_id: Optional specific campaign ID
            limit: Maximum number of results
            sort_by: Sort field (performance_score, open_rate, emails_sent, etc.)
            sort_desc: Sort descending if True
            
        Returns:
            List of CampaignPerformance objects
        """
        try:
            # Build the query
            where_clause = "WHERE workspace_id = :workspace_id"
            params = {"workspace_id": workspace_id, "limit": limit}
            
            if campaign_id:
                where_clause += " AND campaign_id = :campaign_id"
                params["campaign_id"] = campaign_id
            
            order_direction = "DESC" if sort_desc else "ASC"
            
            query = f"""
                SELECT 
                    campaign_id, campaign_name, workspace_id, emails_sent, emails_delivered,
                    unique_opens, unique_clicks, delivery_rate, open_rate, click_through_rate,
                    bounce_rate, performance_score, last_activity, total_leads
                FROM campaign_performance_analytics_mv
                {where_clause}
                ORDER BY {sort_by} {order_direction}
                LIMIT :limit
            """
            
            result = await self.db.execute(text(query), params)
            
            campaigns = []
            for row in result.fetchall():
                campaigns.append(CampaignPerformance(
                    campaign_id=str(row.campaign_id),
                    campaign_name=row.campaign_name,
                    workspace_id=str(row.workspace_id),
                    emails_sent=row.emails_sent,
                    emails_delivered=row.emails_delivered,
                    unique_opens=row.unique_opens,
                    unique_clicks=row.unique_clicks,
                    delivery_rate=float(row.delivery_rate),
                    open_rate=float(row.open_rate),
                    click_through_rate=float(row.click_through_rate),
                    bounce_rate=float(row.bounce_rate),
                    performance_score=float(row.performance_score),
                    last_activity=row.last_activity,
                    total_leads=row.total_leads
                ))
            
            return campaigns
            
        except Exception as e:
            logger.error(f"Failed to get campaign performance: {e}")
            return []
    
    async def get_workspace_analytics(self, workspace_id: str) -> Optional[WorkspaceAnalytics]:
        """
        Get workspace-level analytics summary.
        
        Args:
            workspace_id: Workspace UUID
            
        Returns:
            WorkspaceAnalytics object or None if not found
        """
        try:
            query = """
                SELECT 
                    workspace_id, workspace_name, total_campaigns, active_campaigns,
                    total_emails_sent, overall_delivery_rate, overall_open_rate,
                    overall_click_through_rate, avg_campaign_performance,
                    campaigns_created_last_30_days, emails_sent_last_30_days,
                    total_leads_contacted
                FROM workspace_analytics_summary_mv
                WHERE workspace_id = :workspace_id
            """
            
            result = await self.db.execute(text(query), {"workspace_id": workspace_id})
            row = result.fetchone()
            
            if not row:
                return None
            
            return WorkspaceAnalytics(
                workspace_id=str(row.workspace_id),
                workspace_name=row.workspace_name,
                total_campaigns=row.total_campaigns,
                active_campaigns=row.active_campaigns,
                total_emails_sent=row.total_emails_sent,
                overall_delivery_rate=float(row.overall_delivery_rate),
                overall_open_rate=float(row.overall_open_rate),
                overall_click_through_rate=float(row.overall_click_through_rate),
                avg_campaign_performance=float(row.avg_campaign_performance),
                campaigns_created_last_30_days=row.campaigns_created_last_30_days,
                emails_sent_last_30_days=row.emails_sent_last_30_days,
                total_leads_contacted=row.total_leads_contacted
            )
            
        except Exception as e:
            logger.error(f"Failed to get workspace analytics: {e}")
            return None
    
    async def get_lead_engagement(
        self,
        workspace_id: str,
        segment: Optional[EngagementSegment] = None,
        min_score: Optional[int] = None,
        limit: int = 100
    ) -> List[LeadEngagement]:
        """
        Get lead engagement analytics.
        
        Args:
            workspace_id: Workspace UUID
            segment: Filter by engagement segment
            min_score: Minimum engagement score filter
            limit: Maximum number of results
            
        Returns:
            List of LeadEngagement objects
        """
        try:
            where_clause = "WHERE workspace_id = :workspace_id"
            params = {"workspace_id": workspace_id, "limit": limit}
            
            if segment:
                where_clause += " AND engagement_segment = :segment"
                params["segment"] = segment.value
            
            if min_score is not None:
                where_clause += " AND engagement_score >= :min_score"
                params["min_score"] = min_score
            
            query = f"""
                SELECT 
                    lead_id, workspace_id, lead_email, first_name, last_name, company,
                    emails_received, total_opens, total_clicks, personal_open_rate,
                    personal_click_rate, engagement_score, engagement_segment,
                    first_contact_date, last_activity_date, has_clicked
                FROM lead_engagement_analytics_mv
                {where_clause}
                ORDER BY engagement_score DESC, last_activity_date DESC
                LIMIT :limit
            """
            
            result = await self.db.execute(text(query), params)
            
            leads = []
            for row in result.fetchall():
                leads.append(LeadEngagement(
                    lead_id=str(row.lead_id),
                    workspace_id=str(row.workspace_id),
                    lead_email=row.lead_email,
                    first_name=row.first_name,
                    last_name=row.last_name,
                    company=row.company,
                    emails_received=row.emails_received,
                    total_opens=row.total_opens,
                    total_clicks=row.total_clicks,
                    personal_open_rate=float(row.personal_open_rate),
                    personal_click_rate=float(row.personal_click_rate),
                    engagement_score=row.engagement_score,
                    engagement_segment=row.engagement_segment,
                    first_contact_date=row.first_contact_date,
                    last_activity_date=row.last_activity_date,
                    has_clicked=row.has_clicked
                ))
            
            return leads
            
        except Exception as e:
            logger.error(f"Failed to get lead engagement: {e}")
            return []
    
    async def get_optimal_send_times(
        self, 
        workspace_id: str, 
        limit: int = 5
    ) -> List[OptimalSendTime]:
        """
        Get optimal send times for a workspace.
        
        Args:
            workspace_id: Workspace UUID
            limit: Number of top send times to return
            
        Returns:
            List of OptimalSendTime objects
        """
        try:
            query = """
                SELECT * FROM get_optimal_send_times(:workspace_id, :limit)
            """
            
            result = await self.db.execute(text(query), {
                "workspace_id": workspace_id,
                "limit": limit
            })
            
            send_times = []
            for row in result.fetchall():
                send_times.append(OptimalSendTime(
                    send_hour=row.send_hour,
                    day_of_week=row.day_of_week,
                    day_name=row.day_name,
                    time_period=row.time_period,
                    day_type=row.day_type,
                    open_rate=float(row.open_rate),
                    click_rate=float(row.click_rate),
                    emails_sent=row.emails_sent,
                    performance_score=float(row.performance_score)
                ))
            
            return send_times
            
        except Exception as e:
            logger.error(f"Failed to get optimal send times: {e}")
            return []
    
    async def get_daily_trends(
        self,
        workspace_id: str,
        campaign_id: Optional[str] = None,
        days: int = 30
    ) -> List[DailyTrend]:
        """
        Get daily performance trends.
        
        Args:
            workspace_id: Workspace UUID
            campaign_id: Optional specific campaign ID
            days: Number of days to look back
            
        Returns:
            List of DailyTrend objects
        """
        try:
            where_clause = "WHERE workspace_id = :workspace_id AND trend_date >= :start_date"
            params = {
                "workspace_id": workspace_id,
                "start_date": datetime.now().date() - timedelta(days=days)
            }
            
            if campaign_id:
                where_clause += " AND campaign_id = :campaign_id"
                params["campaign_id"] = campaign_id
            
            query = f"""
                SELECT 
                    campaign_id, trend_date, daily_sent, daily_delivered,
                    daily_unique_opens, daily_unique_clicks, daily_delivery_rate,
                    daily_open_rate, day_type
                FROM daily_campaign_trends_analytics_mv
                {where_clause}
                ORDER BY trend_date DESC
            """
            
            result = await self.db.execute(text(query), params)
            
            trends = []
            for row in result.fetchall():
                trends.append(DailyTrend(
                    campaign_id=str(row.campaign_id),
                    trend_date=row.trend_date,
                    daily_sent=row.daily_sent,
                    daily_delivered=row.daily_delivered,
                    daily_unique_opens=row.daily_unique_opens,
                    daily_unique_clicks=row.daily_unique_clicks,
                    daily_delivery_rate=float(row.daily_delivery_rate),
                    daily_open_rate=float(row.daily_open_rate),
                    day_type=row.day_type
                ))
            
            return trends
            
        except Exception as e:
            logger.error(f"Failed to get daily trends: {e}")
            return []
    
    async def get_analytics_dashboard_summary(self) -> Dict[str, Any]:
        """
        Get summary of all analytics materialized views for dashboard.
        
        Returns:
            Dictionary with analytics summary information
        """
        try:
            query = """
                SELECT metric_type, total_records, last_refresh, avg_score
                FROM analytics_dashboard_summary
                ORDER BY metric_type
            """
            
            result = await self.db.execute(text(query))
            
            summary = {
                "last_updated": datetime.utcnow(),
                "materialized_views": {},
                "health_status": "healthy"
            }
            
            for row in result.fetchall():
                summary["materialized_views"][row.metric_type] = {
                    "total_records": row.total_records,
                    "last_refresh": row.last_refresh,
                    "avg_score": float(row.avg_score) if row.avg_score else 0
                }
            
            # Check if views are stale (older than 2 hours)
            stale_views = []
            for view_name, data in summary["materialized_views"].items():
                if data["last_refresh"]:
                    age = datetime.utcnow() - data["last_refresh"].replace(tzinfo=None)
                    if age > timedelta(hours=2):
                        stale_views.append(view_name)
            
            if stale_views:
                summary["health_status"] = "warning"
                summary["stale_views"] = stale_views
            
            return summary
            
        except Exception as e:
            logger.error(f"Failed to get analytics dashboard summary: {e}")
            return {"error": str(e), "health_status": "error"}
    
    async def refresh_materialized_views(self, view_names: Optional[List[str]] = None) -> Dict[str, Any]:
        """
        Refresh materialized views manually.
        
        Args:
            view_names: Optional list of specific views to refresh. If None, refreshes all.
            
        Returns:
            Dictionary with refresh results
        """
        start_time = datetime.utcnow()
        results = {
            "started_at": start_time,
            "view_results": {},
            "total_time_ms": 0,
            "success": True
        }
        
        try:
            if view_names is None:
                # Refresh all analytics views
                await self.db.execute(text("SELECT refresh_all_analytics_views()"))
                results["view_results"]["all_views"] = {"status": "refreshed"}
            else:
                # Refresh specific views
                for view_name in view_names:
                    try:
                        await self.db.execute(
                            text(f"REFRESH MATERIALIZED VIEW CONCURRENTLY {view_name}")
                        )
                        results["view_results"][view_name] = {"status": "refreshed"}
                    except Exception as e:
                        results["view_results"][view_name] = {
                            "status": "failed",
                            "error": str(e)
                        }
                        results["success"] = False
            
            await self.db.commit()
            
        except Exception as e:
            await self.db.rollback()
            results["success"] = False
            results["error"] = str(e)
            logger.error(f"Failed to refresh materialized views: {e}")
        
        end_time = datetime.utcnow()
        results["completed_at"] = end_time
        results["total_time_ms"] = int((end_time - start_time).total_seconds() * 1000)
        
        return results
    
    async def get_engagement_distribution(self, workspace_id: str) -> Dict[str, int]:
        """
        Get lead engagement segment distribution.
        
        Args:
            workspace_id: Workspace UUID
            
        Returns:
            Dictionary with segment counts
        """
        try:
            query = """
                SELECT engagement_segment, COUNT(*) as count
                FROM lead_engagement_analytics_mv
                WHERE workspace_id = :workspace_id
                GROUP BY engagement_segment
                ORDER BY count DESC
            """
            
            result = await self.db.execute(text(query), {"workspace_id": workspace_id})
            
            distribution = {}
            for row in result.fetchall():
                distribution[row.engagement_segment] = row.count
            
            return distribution
            
        except Exception as e:
            logger.error(f"Failed to get engagement distribution: {e}")
            return {}
    
    async def get_performance_comparison(
        self,
        workspace_id: str,
        timeframe: AnalyticsTimeframe = AnalyticsTimeframe.LAST_30_DAYS
    ) -> Dict[str, Any]:
        """
        Get performance comparison metrics for different timeframes.
        
        Args:
            workspace_id: Workspace UUID
            timeframe: Timeframe for comparison
            
        Returns:
            Dictionary with comparison metrics
        """
        try:
            # Calculate date ranges
            end_date = datetime.now().date()
            
            if timeframe == AnalyticsTimeframe.LAST_7_DAYS:
                days = 7
            elif timeframe == AnalyticsTimeframe.LAST_30_DAYS:
                days = 30
            elif timeframe == AnalyticsTimeframe.LAST_90_DAYS:
                days = 90
            else:
                days = 30  # Default
            
            current_start = end_date - timedelta(days=days)
            previous_start = current_start - timedelta(days=days)
            
            query = """
                WITH current_period AS (
                    SELECT 
                        SUM(daily_sent) as sent,
                        SUM(daily_delivered) as delivered,
                        SUM(daily_unique_opens) as opens,
                        SUM(daily_unique_clicks) as clicks,
                        AVG(daily_open_rate) as avg_open_rate,
                        COUNT(DISTINCT campaign_id) as active_campaigns
                    FROM daily_campaign_trends_analytics_mv
                    WHERE workspace_id = :workspace_id
                      AND trend_date >= :current_start
                      AND trend_date <= :end_date
                ),
                previous_period AS (
                    SELECT 
                        SUM(daily_sent) as sent,
                        SUM(daily_delivered) as delivered,
                        SUM(daily_unique_opens) as opens,
                        SUM(daily_unique_clicks) as clicks,
                        AVG(daily_open_rate) as avg_open_rate,
                        COUNT(DISTINCT campaign_id) as active_campaigns
                    FROM daily_campaign_trends_analytics_mv
                    WHERE workspace_id = :workspace_id
                      AND trend_date >= :previous_start
                      AND trend_date < :current_start
                )
                SELECT 
                    cp.sent as current_sent,
                    cp.delivered as current_delivered,
                    cp.opens as current_opens,
                    cp.clicks as current_clicks,
                    cp.avg_open_rate as current_open_rate,
                    cp.active_campaigns as current_campaigns,
                    pp.sent as previous_sent,
                    pp.delivered as previous_delivered,
                    pp.opens as previous_opens,
                    pp.clicks as previous_clicks,
                    pp.avg_open_rate as previous_open_rate,
                    pp.active_campaigns as previous_campaigns
                FROM current_period cp, previous_period pp
            """
            
            result = await self.db.execute(text(query), {
                "workspace_id": workspace_id,
                "current_start": current_start,
                "end_date": end_date,
                "previous_start": previous_start
            })
            
            row = result.fetchone()
            if not row:
                return {}
            
            # Calculate percentage changes
            def calc_change(current, previous):
                if not previous or previous == 0:
                    return None
                return round(((current - previous) / previous) * 100, 1)
            
            comparison = {
                "timeframe": timeframe.value,
                "current_period": {
                    "emails_sent": row.current_sent or 0,
                    "emails_delivered": row.current_delivered or 0,
                    "unique_opens": row.current_opens or 0,
                    "unique_clicks": row.current_clicks or 0,
                    "avg_open_rate": float(row.current_open_rate or 0),
                    "active_campaigns": row.current_campaigns or 0
                },
                "previous_period": {
                    "emails_sent": row.previous_sent or 0,
                    "emails_delivered": row.previous_delivered or 0,
                    "unique_opens": row.previous_opens or 0,
                    "unique_clicks": row.previous_clicks or 0,
                    "avg_open_rate": float(row.previous_open_rate or 0),
                    "active_campaigns": row.previous_campaigns or 0
                },
                "changes": {
                    "emails_sent": calc_change(row.current_sent or 0, row.previous_sent or 0),
                    "emails_delivered": calc_change(row.current_delivered or 0, row.previous_delivered or 0),
                    "unique_opens": calc_change(row.current_opens or 0, row.previous_opens or 0),
                    "unique_clicks": calc_change(row.current_clicks or 0, row.previous_clicks or 0),
                    "avg_open_rate": calc_change(
                        float(row.current_open_rate or 0), 
                        float(row.previous_open_rate or 0)
                    ),
                    "active_campaigns": calc_change(row.current_campaigns or 0, row.previous_campaigns or 0)
                }
            }
            
            return comparison
            
        except Exception as e:
            logger.error(f"Failed to get performance comparison: {e}")
            return {}


# Utility functions for common analytics operations
async def get_top_performing_campaigns(workspace_id: str, limit: int = 10) -> List[CampaignPerformance]:
    """Get top performing campaigns for a workspace."""
    async for db in get_db():
        try:
            manager = CampaignAnalyticsManager(db)
            return await manager.get_campaign_performance(
                workspace_id=workspace_id,
                limit=limit,
                sort_by="performance_score",
                sort_desc=True
            )
        finally:
            await db.close()


async def get_workspace_dashboard_data(workspace_id: str) -> Dict[str, Any]:
    """Get comprehensive dashboard data for a workspace."""
    async for db in get_db():
        try:
            manager = CampaignAnalyticsManager(db)
            
            # Get all dashboard data concurrently
            workspace_analytics, top_campaigns, engagement_dist, optimal_times, comparison = await asyncio.gather(
                manager.get_workspace_analytics(workspace_id),
                manager.get_campaign_performance(workspace_id, limit=5),
                manager.get_engagement_distribution(workspace_id),
                manager.get_optimal_send_times(workspace_id, limit=3),
                manager.get_performance_comparison(workspace_id),
                return_exceptions=True
            )
            
            return {
                "workspace_analytics": workspace_analytics,
                "top_campaigns": top_campaigns if not isinstance(top_campaigns, Exception) else [],
                "engagement_distribution": engagement_dist if not isinstance(engagement_dist, Exception) else {},
                "optimal_send_times": optimal_times if not isinstance(optimal_times, Exception) else [],
                "performance_comparison": comparison if not isinstance(comparison, Exception) else {},
                "generated_at": datetime.utcnow()
            }
        finally:
            await db.close()


if __name__ == "__main__":
    # Test the analytics manager
    import asyncio
    
    async def test_analytics():
        async for db in get_db():
            try:
                manager = CampaignAnalyticsManager(db)
                summary = await manager.get_analytics_dashboard_summary()
                print(f"Analytics Summary: {summary}")
            finally:
                await db.close()
    
    asyncio.run(test_analytics())