"""
API endpoints for campaign analytics and materialized views.
"""
from typing import List, Dict, Optional, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from core.database import get_db
from core.security import get_current_user
from utils.analytics_manager import (
    CampaignAnalyticsManager, 
    CampaignPerformance, 
    WorkspaceAnalytics,
    LeadEngagement,
    OptimalSendTime,
    DailyTrend,
    AnalyticsTimeframe,
    EngagementSegment
)
from models.user import User

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


# Response Models
class CampaignPerformanceResponse(BaseModel):
    """Campaign performance response model."""
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
    last_activity: Optional[str] = None
    total_leads: int


class WorkspaceAnalyticsResponse(BaseModel):
    """Workspace analytics response model."""
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


class LeadEngagementResponse(BaseModel):
    """Lead engagement response model."""
    lead_id: str
    workspace_id: str
    lead_email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    company: Optional[str] = None
    emails_received: int
    total_opens: int
    total_clicks: int
    personal_open_rate: float
    personal_click_rate: float
    engagement_score: int
    engagement_segment: str
    first_contact_date: Optional[str] = None
    last_activity_date: Optional[str] = None
    has_clicked: bool


class OptimalSendTimeResponse(BaseModel):
    """Optimal send time response model."""
    send_hour: int
    day_of_week: int
    day_name: str
    time_period: str
    day_type: str
    open_rate: float
    click_rate: float
    emails_sent: int
    performance_score: float


class DailyTrendResponse(BaseModel):
    """Daily trend response model."""
    campaign_id: str
    trend_date: str
    daily_sent: int
    daily_delivered: int
    daily_unique_opens: int
    daily_unique_clicks: int
    daily_delivery_rate: float
    daily_open_rate: float
    day_type: str


class MaterializedViewRefreshResponse(BaseModel):
    """Materialized view refresh response."""
    started_at: str
    completed_at: Optional[str] = None
    view_results: Dict[str, Any]
    total_time_ms: int
    success: bool
    error: Optional[str] = None


# Helper function to convert datetime to string
def datetime_to_str(dt):
    return dt.isoformat() if dt else None


@router.get("/campaigns", response_model=List[CampaignPerformanceResponse])
async def get_campaign_analytics(
    limit: int = Query(50, ge=1, le=500),
    sort_by: str = Query("performance_score", regex="^(performance_score|open_rate|emails_sent|last_activity)$"),
    sort_desc: bool = Query(True),
    campaign_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get campaign performance analytics.
    
    Args:
        limit: Maximum number of campaigns to return (1-500)
        sort_by: Sort field (performance_score, open_rate, emails_sent, last_activity)
        sort_desc: Sort descending if True
        campaign_id: Optional specific campaign ID filter
    """
    try:
        manager = CampaignAnalyticsManager(db)
        campaigns = await manager.get_campaign_performance(
            workspace_id=current_user.workspace_id,
            campaign_id=campaign_id,
            limit=limit,
            sort_by=sort_by,
            sort_desc=sort_desc
        )
        
        return [
            CampaignPerformanceResponse(
                campaign_id=c.campaign_id,
                campaign_name=c.campaign_name,
                workspace_id=c.workspace_id,
                emails_sent=c.emails_sent,
                emails_delivered=c.emails_delivered,
                unique_opens=c.unique_opens,
                unique_clicks=c.unique_clicks,
                delivery_rate=c.delivery_rate,
                open_rate=c.open_rate,
                click_through_rate=c.click_through_rate,
                bounce_rate=c.bounce_rate,
                performance_score=c.performance_score,
                last_activity=datetime_to_str(c.last_activity),
                total_leads=c.total_leads
            )
            for c in campaigns
        ]
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get campaign analytics: {str(e)}"
        )


@router.get("/workspace", response_model=WorkspaceAnalyticsResponse)
async def get_workspace_analytics(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get workspace-level analytics summary."""
    try:
        manager = CampaignAnalyticsManager(db)
        analytics = await manager.get_workspace_analytics(current_user.workspace_id)
        
        if not analytics:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workspace analytics not found"
            )
        
        return WorkspaceAnalyticsResponse(
            workspace_id=analytics.workspace_id,
            workspace_name=analytics.workspace_name,
            total_campaigns=analytics.total_campaigns,
            active_campaigns=analytics.active_campaigns,
            total_emails_sent=analytics.total_emails_sent,
            overall_delivery_rate=analytics.overall_delivery_rate,
            overall_open_rate=analytics.overall_open_rate,
            overall_click_through_rate=analytics.overall_click_through_rate,
            avg_campaign_performance=analytics.avg_campaign_performance,
            campaigns_created_last_30_days=analytics.campaigns_created_last_30_days,
            emails_sent_last_30_days=analytics.emails_sent_last_30_days,
            total_leads_contacted=analytics.total_leads_contacted
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get workspace analytics: {str(e)}"
        )


@router.get("/leads", response_model=List[LeadEngagementResponse])
async def get_lead_engagement(
    segment: Optional[str] = Query(None, regex="^(hot|warm|lukewarm|cold)$"),
    min_score: Optional[int] = Query(None, ge=0, le=100),
    limit: int = Query(100, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get lead engagement analytics.
    
    Args:
        segment: Filter by engagement segment (hot, warm, lukewarm, cold)
        min_score: Minimum engagement score (0-100)
        limit: Maximum number of leads to return (1-1000)
    """
    try:
        manager = CampaignAnalyticsManager(db)
        
        segment_enum = None
        if segment:
            segment_enum = EngagementSegment(segment)
        
        leads = await manager.get_lead_engagement(
            workspace_id=current_user.workspace_id,
            segment=segment_enum,
            min_score=min_score,
            limit=limit
        )
        
        return [
            LeadEngagementResponse(
                lead_id=l.lead_id,
                workspace_id=l.workspace_id,
                lead_email=l.lead_email,
                first_name=l.first_name,
                last_name=l.last_name,
                company=l.company,
                emails_received=l.emails_received,
                total_opens=l.total_opens,
                total_clicks=l.total_clicks,
                personal_open_rate=l.personal_open_rate,
                personal_click_rate=l.personal_click_rate,
                engagement_score=l.engagement_score,
                engagement_segment=l.engagement_segment,
                first_contact_date=datetime_to_str(l.first_contact_date),
                last_activity_date=datetime_to_str(l.last_activity_date),
                has_clicked=l.has_clicked
            )
            for l in leads
        ]
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get lead engagement: {str(e)}"
        )


@router.get("/optimal-send-times", response_model=List[OptimalSendTimeResponse])
async def get_optimal_send_times(
    limit: int = Query(5, ge=1, le=20),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get optimal send times based on historical performance.
    
    Args:
        limit: Number of top send times to return (1-20)
    """
    try:
        manager = CampaignAnalyticsManager(db)
        send_times = await manager.get_optimal_send_times(
            workspace_id=current_user.workspace_id,
            limit=limit
        )
        
        return [
            OptimalSendTimeResponse(
                send_hour=st.send_hour,
                day_of_week=st.day_of_week,
                day_name=st.day_name,
                time_period=st.time_period,
                day_type=st.day_type,
                open_rate=st.open_rate,
                click_rate=st.click_rate,
                emails_sent=st.emails_sent,
                performance_score=st.performance_score
            )
            for st in send_times
        ]
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get optimal send times: {str(e)}"
        )


@router.get("/trends", response_model=List[DailyTrendResponse])
async def get_daily_trends(
    days: int = Query(30, ge=1, le=365),
    campaign_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get daily performance trends.
    
    Args:
        days: Number of days to look back (1-365)
        campaign_id: Optional specific campaign ID filter
    """
    try:
        manager = CampaignAnalyticsManager(db)
        trends = await manager.get_daily_trends(
            workspace_id=current_user.workspace_id,
            campaign_id=campaign_id,
            days=days
        )
        
        return [
            DailyTrendResponse(
                campaign_id=t.campaign_id,
                trend_date=t.trend_date.isoformat(),
                daily_sent=t.daily_sent,
                daily_delivered=t.daily_delivered,
                daily_unique_opens=t.daily_unique_opens,
                daily_unique_clicks=t.daily_unique_clicks,
                daily_delivery_rate=t.daily_delivery_rate,
                daily_open_rate=t.daily_open_rate,
                day_type=t.day_type
            )
            for t in trends
        ]
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get daily trends: {str(e)}"
        )


@router.get("/engagement-distribution")
async def get_engagement_distribution(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get lead engagement segment distribution."""
    try:
        manager = CampaignAnalyticsManager(db)
        distribution = await manager.get_engagement_distribution(current_user.workspace_id)
        
        return {
            "workspace_id": current_user.workspace_id,
            "distribution": distribution,
            "total_leads": sum(distribution.values())
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get engagement distribution: {str(e)}"
        )


@router.get("/performance-comparison")
async def get_performance_comparison(
    timeframe: str = Query("30d", regex="^(7d|30d|90d|6m|1y|all)$"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get performance comparison between current and previous periods.
    
    Args:
        timeframe: Timeframe for comparison (7d, 30d, 90d, 6m, 1y, all)
    """
    try:
        manager = CampaignAnalyticsManager(db)
        timeframe_enum = AnalyticsTimeframe(timeframe)
        
        comparison = await manager.get_performance_comparison(
            workspace_id=current_user.workspace_id,
            timeframe=timeframe_enum
        )
        
        return comparison
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get performance comparison: {str(e)}"
        )


@router.get("/dashboard")
async def get_dashboard_data(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get comprehensive dashboard data for the workspace."""
    try:
        from utils.analytics_manager import get_workspace_dashboard_data
        
        dashboard_data = await get_workspace_dashboard_data(current_user.workspace_id)
        
        # Convert datetime objects to strings for JSON serialization
        if dashboard_data.get("workspace_analytics"):
            ws = dashboard_data["workspace_analytics"]
            dashboard_data["workspace_analytics"] = WorkspaceAnalyticsResponse(
                workspace_id=ws.workspace_id,
                workspace_name=ws.workspace_name,
                total_campaigns=ws.total_campaigns,
                active_campaigns=ws.active_campaigns,
                total_emails_sent=ws.total_emails_sent,
                overall_delivery_rate=ws.overall_delivery_rate,
                overall_open_rate=ws.overall_open_rate,
                overall_click_through_rate=ws.overall_click_through_rate,
                avg_campaign_performance=ws.avg_campaign_performance,
                campaigns_created_last_30_days=ws.campaigns_created_last_30_days,
                emails_sent_last_30_days=ws.emails_sent_last_30_days,
                total_leads_contacted=ws.total_leads_contacted
            ).dict()
        
        # Convert campaign data
        if dashboard_data.get("top_campaigns"):
            dashboard_data["top_campaigns"] = [
                CampaignPerformanceResponse(
                    campaign_id=c.campaign_id,
                    campaign_name=c.campaign_name,
                    workspace_id=c.workspace_id,
                    emails_sent=c.emails_sent,
                    emails_delivered=c.emails_delivered,
                    unique_opens=c.unique_opens,
                    unique_clicks=c.unique_clicks,
                    delivery_rate=c.delivery_rate,
                    open_rate=c.open_rate,
                    click_through_rate=c.click_through_rate,
                    bounce_rate=c.bounce_rate,
                    performance_score=c.performance_score,
                    last_activity=datetime_to_str(c.last_activity),
                    total_leads=c.total_leads
                ).dict()
                for c in dashboard_data["top_campaigns"]
            ]
        
        # Convert optimal send times
        if dashboard_data.get("optimal_send_times"):
            dashboard_data["optimal_send_times"] = [
                OptimalSendTimeResponse(
                    send_hour=st.send_hour,
                    day_of_week=st.day_of_week,
                    day_name=st.day_name,
                    time_period=st.time_period,
                    day_type=st.day_type,
                    open_rate=st.open_rate,
                    click_rate=st.click_rate,
                    emails_sent=st.emails_sent,
                    performance_score=st.performance_score
                ).dict()
                for st in dashboard_data["optimal_send_times"]
            ]
        
        dashboard_data["generated_at"] = datetime_to_str(dashboard_data.get("generated_at"))
        
        return dashboard_data
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get dashboard data: {str(e)}"
        )


@router.get("/system/status")
async def get_analytics_system_status(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get analytics system status and materialized view health."""
    try:
        manager = CampaignAnalyticsManager(db)
        summary = await manager.get_analytics_dashboard_summary()
        
        return {
            "status": summary.get("health_status", "unknown"),
            "materialized_views": summary.get("materialized_views", {}),
            "stale_views": summary.get("stale_views", []),
            "last_updated": datetime_to_str(summary.get("last_updated")),
            "error": summary.get("error")
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get analytics system status: {str(e)}"
        )


@router.post("/system/refresh", response_model=MaterializedViewRefreshResponse)
async def refresh_materialized_views(
    background_tasks: BackgroundTasks,
    view_names: Optional[List[str]] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Manually refresh materialized views.
    
    Args:
        view_names: Optional list of specific view names to refresh. If None, refreshes all.
    """
    # Only allow admin users to refresh views
    if current_user.role not in ["admin", "super_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to refresh materialized views"
        )
    
    try:
        manager = CampaignAnalyticsManager(db)
        
        # Run refresh in background for better UX
        refresh_result = await manager.refresh_materialized_views(view_names)
        
        return MaterializedViewRefreshResponse(
            started_at=datetime_to_str(refresh_result["started_at"]),
            completed_at=datetime_to_str(refresh_result.get("completed_at")),
            view_results=refresh_result["view_results"],
            total_time_ms=refresh_result["total_time_ms"],
            success=refresh_result["success"],
            error=refresh_result.get("error")
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to refresh materialized views: {str(e)}"
        )


@router.get("/campaigns/{campaign_id}/details")
async def get_campaign_details(
    campaign_id: str,
    include_trends: bool = Query(True),
    trend_days: int = Query(30, ge=1, le=90),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get detailed analytics for a specific campaign.
    
    Args:
        campaign_id: Campaign UUID
        include_trends: Whether to include daily trend data
        trend_days: Number of days of trend data to include (1-90)
    """
    try:
        manager = CampaignAnalyticsManager(db)
        
        # Get campaign performance
        campaigns = await manager.get_campaign_performance(
            workspace_id=current_user.workspace_id,
            campaign_id=campaign_id,
            limit=1
        )
        
        if not campaigns:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Campaign not found"
            )
        
        campaign = campaigns[0]
        result = {
            "campaign": CampaignPerformanceResponse(
                campaign_id=campaign.campaign_id,
                campaign_name=campaign.campaign_name,
                workspace_id=campaign.workspace_id,
                emails_sent=campaign.emails_sent,
                emails_delivered=campaign.emails_delivered,
                unique_opens=campaign.unique_opens,
                unique_clicks=campaign.unique_clicks,
                delivery_rate=campaign.delivery_rate,
                open_rate=campaign.open_rate,
                click_through_rate=campaign.click_through_rate,
                bounce_rate=campaign.bounce_rate,
                performance_score=campaign.performance_score,
                last_activity=datetime_to_str(campaign.last_activity),
                total_leads=campaign.total_leads
            ).dict()
        }
        
        # Include trends if requested
        if include_trends:
            trends = await manager.get_daily_trends(
                workspace_id=current_user.workspace_id,
                campaign_id=campaign_id,
                days=trend_days
            )
            
            result["daily_trends"] = [
                DailyTrendResponse(
                    campaign_id=t.campaign_id,
                    trend_date=t.trend_date.isoformat(),
                    daily_sent=t.daily_sent,
                    daily_delivered=t.daily_delivered,
                    daily_unique_opens=t.daily_unique_opens,
                    daily_unique_clicks=t.daily_unique_clicks,
                    daily_delivery_rate=t.daily_delivery_rate,
                    daily_open_rate=t.daily_open_rate,
                    day_type=t.day_type
                ).dict()
                for t in trends
            ]
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get campaign details: {str(e)}"
        )


@router.get("/content/performance")
async def get_content_performance(
    metric: str = Query("engagement_score", regex="^(engagement_score|open_rate|click_rate|reply_rate)$"),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get best performing email content based on metrics.
    
    Args:
        metric: Metric to sort by (engagement_score, open_rate, click_rate, reply_rate)
        limit: Number of results to return (1-100)
    """
    try:
        manager = CampaignAnalyticsManager(db)
        content = await manager.get_content_performance(
            workspace_id=current_user.workspace_id,
            metric=metric,
            limit=limit
        )
        
        return {
            "content": content,
            "metric": metric,
            "count": len(content)
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get content performance: {str(e)}"
        )


@router.get("/conversion/funnel")
async def get_conversion_funnel(
    campaign_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get conversion funnel metrics showing drop-off at each stage.
    
    Args:
        campaign_id: Optional specific campaign ID filter
    """
    try:
        manager = CampaignAnalyticsManager(db)
        funnel = await manager.get_conversion_funnel(
            workspace_id=current_user.workspace_id,
            campaign_id=campaign_id
        )
        
        return funnel
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get conversion funnel: {str(e)}"
        )


@router.get("/cohort/analysis")
async def get_cohort_analysis(
    cohort_type: str = Query("weekly", regex="^(daily|weekly|monthly)$"),
    periods: int = Query(8, ge=1, le=24),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get cohort analysis for lead engagement over time.
    
    Args:
        cohort_type: Type of cohort grouping (daily, weekly, monthly)
        periods: Number of periods to analyze (1-24)
    """
    try:
        manager = CampaignAnalyticsManager(db)
        cohort_data = await manager.get_cohort_analysis(
            workspace_id=current_user.workspace_id,
            cohort_type=cohort_type,
            periods=periods
        )
        
        return cohort_data
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get cohort analysis: {str(e)}"
        )


@router.get("/attribution/sources")
async def get_attribution_sources(
    attribution_window: int = Query(30, ge=1, le=90),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get attribution analysis for lead sources and channels.
    
    Args:
        attribution_window: Days to look back for attribution (1-90)
    """
    try:
        manager = CampaignAnalyticsManager(db)
        attribution = await manager.get_attribution_analysis(
            workspace_id=current_user.workspace_id,
            window_days=attribution_window
        )
        
        return attribution
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get attribution analysis: {str(e)}"
        )


@router.post("/export")
async def export_analytics_data(
    export_type: str = Query(..., regex="^(csv|json|excel)$"),
    report_type: str = Query(..., regex="^(campaign|lead|engagement|performance)$"),
    date_range: int = Query(30, ge=1, le=365),
    campaign_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Export analytics data in various formats.
    
    Args:
        export_type: Format to export (csv, json, excel)
        report_type: Type of report (campaign, lead, engagement, performance)
        date_range: Days of data to export (1-365)
        campaign_id: Optional specific campaign filter
    """
    try:
        manager = CampaignAnalyticsManager(db)
        
        # Generate export
        export_id = await manager.generate_export(
            workspace_id=current_user.workspace_id,
            export_type=export_type,
            report_type=report_type,
            date_range=date_range,
            campaign_id=campaign_id
        )
        
        return {
            "export_id": export_id,
            "format": export_type,
            "report_type": report_type,
            "status": "processing",
            "date_range": date_range,
            "created_at": datetime.utcnow().isoformat(),
            "download_url": f"/api/analytics/export/download/{export_id}"
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate export: {str(e)}"
        )


@router.get("/ai/insights")
async def get_ai_insights(
    insight_type: str = Query("general", regex="^(general|campaign|lead|content)$"),
    campaign_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get AI-powered insights and recommendations based on analytics data.
    
    Args:
        insight_type: Type of insights (general, campaign, lead, content)
        campaign_id: Optional campaign ID for campaign-specific insights
    """
    try:
        manager = CampaignAnalyticsManager(db)
        
        # Get AI insights
        insights = await manager.generate_ai_insights(
            workspace_id=current_user.workspace_id,
            insight_type=insight_type,
            campaign_id=campaign_id
        )
        
        return {
            "insights": insights,
            "generated_at": datetime.utcnow().isoformat(),
            "type": insight_type
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate AI insights: {str(e)}"
        )