"""
Campaign-related Celery tasks.
"""
import asyncio
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from workers.celery_app import celery_app
from core.database import get_async_session

logger = logging.getLogger(__name__)


def run_async(coro):
    """Helper to run async functions in Celery tasks."""
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    
    return loop.run_until_complete(coro)


@celery_app.task
def update_all_campaign_stats() -> Dict[str, Any]:
    """Update statistics for all active campaigns."""
    try:
        from services.campaign_service import CampaignService
        
        async def _update_stats():
            async with get_async_session() as db:
                campaign_service = CampaignService(db)
                
                # Get all active campaigns
                active_campaigns = await campaign_service.get_active_campaigns()
                
                updated_count = 0
                for campaign in active_campaigns:
                    try:
                        await campaign_service.update_campaign_stats(
                            campaign_id=campaign.id,
                            calculate_rates=True
                        )
                        updated_count += 1
                    except Exception as e:
                        logger.error(f"Failed to update stats for campaign {campaign.id}: {str(e)}")
                
                return updated_count
        
        updated_count = run_async(_update_stats())
        
        logger.info(f"Updated stats for {updated_count} campaigns")
        return {
            "status": "completed",
            "updated_campaigns": updated_count,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as exc:
        logger.error(f"Error updating campaign stats: {str(exc)}")
        return {"status": "failed", "error": str(exc)}


@celery_app.task
def archive_completed_campaigns() -> Dict[str, Any]:
    """Archive campaigns that have been completed for more than 30 days."""
    try:
        from services.campaign_service import CampaignService
        
        async def _archive_campaigns():
            async with get_async_session() as db:
                campaign_service = CampaignService(db)
                
                # Archive campaigns completed more than 30 days ago
                cutoff_date = datetime.utcnow() - timedelta(days=30)
                archived_count = await campaign_service.archive_old_campaigns(cutoff_date)
                
                return archived_count
        
        archived_count = run_async(_archive_campaigns())
        
        logger.info(f"Archived {archived_count} old campaigns")
        return {
            "status": "completed",
            "archived_campaigns": archived_count,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as exc:
        logger.error(f"Error archiving campaigns: {str(exc)}")
        return {"status": "failed", "error": str(exc)}


@celery_app.task
def generate_campaign_report(campaign_id: str, report_type: str = "performance") -> Dict[str, Any]:
    """Generate detailed campaign report."""
    try:
        from services.campaign_service import CampaignService
        from services.analytics_service import AnalyticsService
        
        async def _generate_report():
            async with get_async_session() as db:
                campaign_service = CampaignService(db)
                analytics_service = AnalyticsService(db)
                
                campaign_uuid = UUID(campaign_id)
                
                # Get campaign details
                campaign = await campaign_service.get_campaign_by_id(campaign_uuid)
                if not campaign:
                    raise ValueError(f"Campaign {campaign_id} not found")
                
                # Generate report based on type
                if report_type == "performance":
                    report_data = await analytics_service.generate_performance_report(campaign_uuid)
                elif report_type == "deliverability":
                    report_data = await analytics_service.generate_deliverability_report(campaign_uuid)
                elif report_type == "engagement":
                    report_data = await analytics_service.generate_engagement_report(campaign_uuid)
                else:
                    raise ValueError(f"Unknown report type: {report_type}")
                
                return report_data
        
        report_data = run_async(_generate_report())
        
        logger.info(f"Generated {report_type} report for campaign {campaign_id}")
        return {
            "status": "completed",
            "campaign_id": campaign_id,
            "report_type": report_type,
            "report_data": report_data,
            "generated_at": datetime.utcnow().isoformat()
        }
        
    except Exception as exc:
        logger.error(f"Error generating campaign report: {str(exc)}")
        return {"status": "failed", "error": str(exc), "campaign_id": campaign_id}


@celery_app.task
def optimize_campaign_performance(campaign_id: str) -> Dict[str, Any]:
    """Analyze campaign performance and suggest optimizations."""
    try:
        from services.campaign_service import CampaignService
        from services.ai_service import AIService
        
        async def _optimize_campaign():
            async with get_async_session() as db:
                campaign_service = CampaignService(db)
                ai_service = AIService(db)
                
                campaign_uuid = UUID(campaign_id)
                
                # Get campaign analytics
                analytics_data = await campaign_service.get_campaign_analytics(
                    campaign_id=campaign_uuid,
                    start_date=datetime.utcnow() - timedelta(days=30)
                )
                
                # Generate AI-powered optimization suggestions
                optimizations = await ai_service.analyze_campaign_performance(
                    campaign_id=campaign_uuid,
                    analytics_data=analytics_data
                )
                
                return optimizations
        
        optimizations = run_async(_optimize_campaign())
        
        logger.info(f"Generated optimization suggestions for campaign {campaign_id}")
        return {
            "status": "completed",
            "campaign_id": campaign_id,
            "optimizations": optimizations,
            "analyzed_at": datetime.utcnow().isoformat()
        }
        
    except Exception as exc:
        logger.error(f"Error optimizing campaign: {str(exc)}")
        return {"status": "failed", "error": str(exc), "campaign_id": campaign_id}


@celery_app.task
def schedule_follow_up_sequence(campaign_id: str, lead_id: str, sequence_type: str = "no_reply") -> Dict[str, Any]:
    """Schedule follow-up email sequence for a lead."""
    try:
        from services.campaign_service import CampaignService
        from workers.email_tasks import send_single_email
        
        async def _schedule_sequence():
            async with get_async_session() as db:
                campaign_service = CampaignService(db)
                
                campaign_uuid = UUID(campaign_id)
                lead_uuid = UUID(lead_id)
                
                # Get follow-up sequence configuration
                sequence_config = await campaign_service.get_follow_up_sequence(
                    campaign_id=campaign_uuid,
                    sequence_type=sequence_type
                )
                
                if not sequence_config:
                    return {"scheduled_emails": 0, "reason": "No sequence configured"}
                
                scheduled_tasks = []
                
                # Schedule each email in the sequence
                for i, email_config in enumerate(sequence_config.get("emails", [])):
                    delay_days = email_config.get("delay_days", i + 1)
                    scheduled_at = datetime.utcnow() + timedelta(days=delay_days)
                    
                    # Generate personalized email content
                    email_content = await campaign_service.generate_personalized_email(
                        campaign_id=campaign_uuid,
                        lead_id=lead_uuid,
                        template_id=email_config.get("template_id")
                    )
                    
                    # Schedule email task
                    task = send_single_email.apply_async(
                        kwargs={
                            "to_email": email_content["recipient_email"],
                            "subject": email_content["subject"],
                            "html_content": email_content["html"],
                            "text_content": email_content["text"],
                            "campaign_id": campaign_id,
                            "lead_id": lead_id,
                            "priority": 4,  # Follow-up priority
                            "scheduled_at": scheduled_at.isoformat()
                        },
                        eta=scheduled_at
                    )
                    
                    scheduled_tasks.append({
                        "task_id": task.id,
                        "scheduled_at": scheduled_at.isoformat(),
                        "email_type": email_config.get("type", "follow_up")
                    })
                
                return {"scheduled_emails": len(scheduled_tasks), "tasks": scheduled_tasks}
        
        result = run_async(_schedule_sequence())
        
        logger.info(f"Scheduled {result['scheduled_emails']} follow-up emails for lead {lead_id}")
        return {
            "status": "completed",
            "campaign_id": campaign_id,
            "lead_id": lead_id,
            "sequence_type": sequence_type,
            **result
        }
        
    except Exception as exc:
        logger.error(f"Error scheduling follow-up sequence: {str(exc)}")
        return {
            "status": "failed",
            "error": str(exc),
            "campaign_id": campaign_id,
            "lead_id": lead_id
        }


@celery_app.task
def sync_campaign_integrations(campaign_id: str) -> Dict[str, Any]:
    """Sync campaign data with external integrations (HubSpot, Pipedrive, etc.)."""
    try:
        from services.campaign_service import CampaignService
        from services.integration_service import IntegrationService
        
        async def _sync_integrations():
            async with get_async_session() as db:
                campaign_service = CampaignService(db)
                integration_service = IntegrationService(db)
                
                campaign_uuid = UUID(campaign_id)
                
                # Get campaign and workspace
                campaign = await campaign_service.get_campaign_by_id(campaign_uuid)
                if not campaign:
                    raise ValueError(f"Campaign {campaign_id} not found")
                
                # Get enabled integrations for workspace
                integrations = await integration_service.get_workspace_integrations(
                    workspace_id=campaign.workspace_id,
                    enabled_only=True
                )
                
                sync_results = {}
                
                for integration in integrations:
                    try:
                        if integration.type == "hubspot":
                            result = await integration_service.sync_campaign_to_hubspot(
                                campaign_id=campaign_uuid,
                                integration_config=integration.config
                            )
                        elif integration.type == "pipedrive":
                            result = await integration_service.sync_campaign_to_pipedrive(
                                campaign_id=campaign_uuid,
                                integration_config=integration.config
                            )
                        else:
                            continue
                        
                        sync_results[integration.type] = result
                        
                    except Exception as e:
                        logger.error(f"Failed to sync {integration.type}: {str(e)}")
                        sync_results[integration.type] = {"status": "failed", "error": str(e)}
                
                return sync_results
        
        sync_results = run_async(_sync_integrations())
        
        logger.info(f"Synced campaign {campaign_id} with {len(sync_results)} integrations")
        return {
            "status": "completed",
            "campaign_id": campaign_id,
            "sync_results": sync_results,
            "synced_at": datetime.utcnow().isoformat()
        }
        
    except Exception as exc:
        logger.error(f"Error syncing campaign integrations: {str(exc)}")
        return {"status": "failed", "error": str(exc), "campaign_id": campaign_id}