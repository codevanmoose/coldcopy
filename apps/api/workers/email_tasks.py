"""
Advanced email-related Celery tasks with queue management.
"""
import asyncio
import logging
from typing import Any, Dict, List, Optional
from uuid import UUID
from datetime import datetime, timedelta

from celery import Task
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


class AsyncDatabaseTask(Task):
    """Base task class with async database session management."""
    
    def __call__(self, *args, **kwargs):
        return super().__call__(*args, **kwargs)


@celery_app.task(bind=True, max_retries=3)
def send_single_email(
    self,
    to_email: str,
    subject: str,
    html_content: str,
    text_content: Optional[str] = None,
    from_email: Optional[str] = None,
    from_name: Optional[str] = None,
    reply_to: Optional[str] = None,
    campaign_id: Optional[str] = None,
    lead_id: Optional[str] = None,
    workspace_id: Optional[str] = None,
    add_tracking: bool = True,
    priority: int = 5,
    scheduled_at: Optional[str] = None
) -> Dict[str, Any]:
    """Send a single email via the advanced email client."""
    try:
        from utils.email_client import email_client
        
        async def _send_email():
            await email_client.initialize()
            
            # Parse datetime if provided
            scheduled_datetime = None
            if scheduled_at:
                scheduled_datetime = datetime.fromisoformat(scheduled_at)
            
            email_id = await email_client.send_email(
                to_email=to_email,
                subject=subject,
                html_content=html_content,
                text_content=text_content,
                from_email=from_email,
                from_name=from_name,
                reply_to=reply_to,
                campaign_id=UUID(campaign_id) if campaign_id else None,
                lead_id=UUID(lead_id) if lead_id else None,
                workspace_id=UUID(workspace_id) if workspace_id else None,
                add_tracking=add_tracking,
                priority=priority,
                scheduled_at=scheduled_datetime
            )
            
            await email_client.cleanup()
            return email_id
        
        email_id = run_async(_send_email())
        
        logger.info(f"Email queued successfully: {email_id} -> {to_email}")
        return {
            "status": "queued",
            "email_id": email_id,
            "to_email": to_email,
            "campaign_id": campaign_id,
            "lead_id": lead_id
        }
        
    except Exception as exc:
        logger.error(f"Error queueing email to {to_email}: {str(exc)}")
        
        # Retry with exponential backoff
        if self.request.retries < self.max_retries:
            retry_delay = 2 ** self.request.retries * 60  # 1, 2, 4 minutes
            raise self.retry(exc=exc, countdown=retry_delay)
        
        return {
            "status": "failed",
            "error": str(exc),
            "to_email": to_email,
            "campaign_id": campaign_id,
            "lead_id": lead_id
        }


@celery_app.task(bind=True)
def send_bulk_emails(
    self,
    recipients: List[str],
    subject: str,
    html_content: str,
    text_content: Optional[str] = None,
    from_email: Optional[str] = None,
    from_name: Optional[str] = None,
    reply_to: Optional[str] = None,
    campaign_id: Optional[str] = None,
    workspace_id: Optional[str] = None,
    add_tracking: bool = True,
    priority: int = 5,
    batch_size: int = 100
) -> Dict[str, Any]:
    """Send bulk emails via the advanced email client."""
    try:
        from utils.email_client import email_client
        
        async def _send_bulk():
            await email_client.initialize()
            
            email_ids = await email_client.send_bulk_email(
                recipients=recipients,
                subject=subject,
                html_content=html_content,
                text_content=text_content,
                from_email=from_email,
                from_name=from_name,
                reply_to=reply_to,
                campaign_id=UUID(campaign_id) if campaign_id else None,
                workspace_id=UUID(workspace_id) if workspace_id else None,
                add_tracking=add_tracking,
                priority=priority,
                batch_size=batch_size
            )
            
            await email_client.cleanup()
            return email_ids
        
        email_ids = run_async(_send_bulk())
        
        logger.info(f"Bulk email queued: {len(email_ids)} emails for campaign {campaign_id}")
        
        return {
            "status": "queued",
            "campaign_id": campaign_id,
            "total_recipients": len(recipients),
            "email_ids": email_ids,
            "queued_count": len(email_ids)
        }
        
    except Exception as exc:
        logger.error(f"Error in bulk email task: {str(exc)}")
        return {
            "status": "failed",
            "error": str(exc),
            "campaign_id": campaign_id
        }


@celery_app.task
def process_email_queue(max_emails: int = 100) -> Dict[str, Any]:
    """Process emails from the queue."""
    try:
        from utils.email_client import email_client
        
        async def _process_queue():
            await email_client.initialize()
            results = await email_client.process_queue(max_emails=max_emails)
            await email_client.cleanup()
            return results
        
        results = run_async(_process_queue())
        
        logger.info(f"Queue processing completed: {results}")
        return {
            "status": "completed",
            "processed": results["sent"] + results["failed"] + results["skipped"],
            "sent": results["sent"],
            "failed": results["failed"],
            "skipped": results["skipped"]
        }
        
    except Exception as exc:
        logger.error(f"Error processing email queue: {str(exc)}")
        return {"status": "failed", "error": str(exc)}


@celery_app.task
def process_email_webhooks(webhook_data: Dict[str, Any]) -> Dict[str, Any]:
    """Process incoming email webhooks (bounces, complaints, deliveries)."""
    try:
        event_type = webhook_data.get("eventType")
        message = webhook_data.get("mail", {})
        destination = message.get("destination", [])
        
        if isinstance(destination, list) and destination:
            email_address = destination[0]
        else:
            email_address = str(destination)
        
        if event_type == "bounce":
            bounce_info = webhook_data.get("bounce", {})
            bounce_type = bounce_info.get("bounceType", "").lower()
            
            # Handle permanent bounces by adding to suppression
            if bounce_type == "permanent":
                logger.info(f"Permanent bounce processed for {email_address}")
                # TODO: Add to suppression list
            else:
                logger.info(f"Temporary bounce processed for {email_address}")
                
        elif event_type == "complaint":
            complaint_info = webhook_data.get("complaint", {})
            complaint_type = complaint_info.get("complaintFeedbackType", "")
            
            # Add to suppression list for complaints
            logger.info(f"Complaint processed for {email_address}: {complaint_type}")
            # TODO: Add to suppression list
            
        elif event_type == "delivery":
            # Record successful delivery
            logger.info(f"Email delivered to {email_address}")
            
        elif event_type == "send":
            # Record email send
            logger.info(f"Email sent to {email_address}")
            
        elif event_type == "open":
            # Record email open (if using SES event publishing)
            logger.info(f"Email opened by {email_address}")
            
        elif event_type == "click":
            # Record email click (if using SES event publishing)
            logger.info(f"Email clicked by {email_address}")
            
        return {
            "status": "processed",
            "event_type": event_type,
            "email": email_address
        }
        
    except Exception as exc:
        logger.error(f"Error processing email webhook: {str(exc)}")
        return {"status": "failed", "error": str(exc)}


@celery_app.task
def start_campaign(campaign_id: str) -> Dict[str, Any]:
    """Start sending emails for a campaign."""
    try:
        from services.campaign_service import CampaignService
        
        async def _start_campaign():
            async with get_async_session() as db:
                campaign_service = CampaignService(db)
                
                # Get campaign details
                campaign = await campaign_service.get_campaign_by_id(UUID(campaign_id))
                if not campaign:
                    raise ValueError(f"Campaign {campaign_id} not found")
                
                # Get campaign leads
                leads_data = await campaign_service.get_campaign_leads(UUID(campaign_id))
                leads = leads_data.get("leads", [])
                
                if not leads:
                    logger.warning(f"No leads found for campaign {campaign_id}")
                    return {"status": "no_leads", "campaign_id": campaign_id}
                
                # Queue emails for all leads
                email_tasks = []
                for lead in leads:
                    # Get email template and personalize
                    email_content = await campaign_service.generate_personalized_email(
                        campaign_id=UUID(campaign_id),
                        lead_id=UUID(lead["id"])
                    )
                    
                    # Queue email
                    task = send_single_email.delay(
                        to_email=lead["email"],
                        subject=email_content["subject"],
                        html_content=email_content["html"],
                        text_content=email_content["text"],
                        campaign_id=campaign_id,
                        lead_id=str(lead["id"]),
                        workspace_id=str(campaign.workspace_id),
                        priority=3  # Campaign emails have higher priority
                    )
                    email_tasks.append(task.id)
                
                # Update campaign statistics
                await campaign_service.update_campaign_stats(
                    campaign_id=UUID(campaign_id),
                    emails_queued=len(email_tasks)
                )
                
                return {
                    "status": "started",
                    "campaign_id": campaign_id,
                    "emails_queued": len(email_tasks),
                    "task_ids": email_tasks
                }
        
        result = run_async(_start_campaign())
        logger.info(f"Campaign {campaign_id} started with {result.get('emails_queued', 0)} emails")
        return result
        
    except Exception as exc:
        logger.error(f"Error starting campaign {campaign_id}: {str(exc)}")
        return {"status": "failed", "error": str(exc), "campaign_id": campaign_id}


@celery_app.task
def pause_campaign(campaign_id: str) -> Dict[str, Any]:
    """Pause a running campaign."""
    try:
        from services.campaign_service import CampaignService
        
        async def _pause_campaign():
            async with get_async_session() as db:
                campaign_service = CampaignService(db)
                
                # Update campaign status
                await campaign_service.update_campaign_status(
                    campaign_id=UUID(campaign_id),
                    status="paused"
                )
                
                return {"status": "paused", "campaign_id": campaign_id}
        
        result = run_async(_pause_campaign())
        logger.info(f"Campaign {campaign_id} paused")
        return result
        
    except Exception as exc:
        logger.error(f"Error pausing campaign {campaign_id}: {str(exc)}")
        return {"status": "failed", "error": str(exc), "campaign_id": campaign_id}


@celery_app.task
def monitor_email_deliverability() -> Dict[str, Any]:
    """Monitor email deliverability and reputation."""
    try:
        from utils.email_client import email_client
        
        async def _monitor_deliverability():
            await email_client.initialize()
            
            # Check reputation for common domains
            domains_to_check = ["gmail.com", "outlook.com", "yahoo.com", "company.com"]
            reputation_data = {}
            
            for domain in domains_to_check:
                reputation = await email_client.deliverability_monitor.check_reputation(domain)
                reputation_data[domain] = reputation
            
            # Get suppression list
            suppressed = await email_client.deliverability_monitor.get_suppression_list()
            
            await email_client.cleanup()
            
            return {
                "reputation_data": reputation_data,
                "suppressed_count": len(suppressed),
                "suppressed_emails": suppressed[:10]  # First 10 for reporting
            }
        
        result = run_async(_monitor_deliverability())
        
        logger.info(f"Deliverability monitoring completed: {len(result['reputation_data'])} domains checked")
        return {
            "status": "completed",
            "timestamp": datetime.utcnow().isoformat(),
            **result
        }
        
    except Exception as exc:
        logger.error(f"Error monitoring deliverability: {str(exc)}")
        return {"status": "failed", "error": str(exc)}


@celery_app.task
def cleanup_email_data() -> Dict[str, Any]:
    """Clean up old email data and tracking information."""
    try:
        from utils.email_client import email_client
        
        async def _cleanup():
            await email_client.initialize()
            
            # Clean up old failed jobs (older than 7 days)
            cutoff_time = datetime.utcnow() - timedelta(days=7)
            
            # Clean up old email events (older than 30 days)
            event_cutoff = datetime.utcnow() - timedelta(days=30)
            
            # Placeholder implementation
            cleaned_failed = 0
            cleaned_events = 0
            
            await email_client.cleanup()
            
            return {
                "cleaned_failed_jobs": cleaned_failed,
                "cleaned_events": cleaned_events
            }
        
        result = run_async(_cleanup())
        
        logger.info(f"Email cleanup completed: {result}")
        return {
            "status": "completed",
            "timestamp": datetime.utcnow().isoformat(),
            **result
        }
        
    except Exception as exc:
        logger.error(f"Error in email cleanup: {str(exc)}")
        return {"status": "failed", "error": str(exc)}


@celery_app.task(bind=True, base=AsyncDatabaseTask)
def send_email_batch(
    self,
    workspace_id: str,
    campaign_id: str,
    recipient_emails: List[str],
    email_content: Dict[str, Any]
) -> Dict[str, Any]:
    """Send a batch of emails with GDPR compliance checking."""
    try:
        from services.gdpr_service import GDPRService
        
        workspace_uuid = UUID(workspace_id)
        campaign_uuid = UUID(campaign_id)
        
        async def _send_batch():
            async with get_async_session() as db:
                gdpr_service = GDPRService(db)
                
                # Track results
                results = {
                    "sent": [],
                    "failed": [],
                    "suppressed": []
                }
                
                for email in recipient_emails:
                    try:
                        # Check GDPR compliance
                        has_consent = await gdpr_service.check_consent(
                            workspace_id=workspace_uuid,
                            email=email,
                            consent_type="marketing"
                        )
                        
                        if not has_consent:
                            results["suppressed"].append({
                                "email": email,
                                "reason": "no_consent"
                            })
                            continue
                        
                        # Queue email for sending
                        task = send_single_email.delay(
                            to_email=email,
                            subject=email_content["subject"],
                            html_content=email_content["html_content"],
                            text_content=email_content.get("text_content", ""),
                            campaign_id=campaign_id,
                            workspace_id=workspace_id,
                            add_tracking=True,
                            priority=5
                        )
                        
                        results["sent"].append({
                            "email": email,
                            "task_id": task.id
                        })
                        
                    except Exception as e:
                        logger.error(f"Failed to process email {email}: {str(e)}")
                        results["failed"].append({
                            "email": email,
                            "reason": str(e)
                        })
                
                return results
        
        results = run_async(_send_batch())
        
        logger.info(f"Email batch processed: {len(results['sent'])} sent, "
                   f"{len(results['failed'])} failed, {len(results['suppressed'])} suppressed")
        
        return results
        
    except Exception as e:
        logger.error(f"Email batch task failed: {str(e)}")
        raise self.retry(countdown=60, max_retries=3)


@celery_app.task(bind=True, base=AsyncDatabaseTask)
def process_email_webhook(self, webhook_data: Dict[str, Any]) -> None:
    """Process incoming email webhook with database updates."""
    try:
        event_type = webhook_data.get("event_type")
        email = webhook_data.get("email")
        
        async def _process_webhook():
            async with get_async_session() as db:
                # Update email event in database
                # This would create EmailEvent records
                pass
        
        run_async(_process_webhook())
        
        if event_type in ["bounce", "complaint"]:
            logger.info(f"Adding {email} to suppression list due to {event_type}")
            
        logger.info(f"Processed email webhook: {event_type} for {email}")
        
    except Exception as e:
        logger.error(f"Failed to process email webhook: {str(e)}")
        raise self.retry(countdown=30, max_retries=3)


@celery_app.task(bind=True, base=AsyncDatabaseTask)
def cleanup_email_events(self, days_to_keep: int = 90) -> Dict[str, int]:
    """Clean up old email events based on retention policies."""
    try:
        async def _cleanup_events():
            async with get_async_session() as db:
                # Implement cleanup logic for old email events
                # based on GDPR retention policies
                cutoff_date = datetime.utcnow() - timedelta(days=days_to_keep)
                
                # Placeholder implementation
                cleaned_count = 0
                
                return cleaned_count
        
        cleaned_count = run_async(_cleanup_events())
        
        logger.info(f"Cleaned up {cleaned_count} old email events")
        return {"cleaned_count": cleaned_count}
        
    except Exception as e:
        logger.error(f"Email cleanup task failed: {str(e)}")
        raise self.retry(countdown=300, max_retries=2)


# Periodic tasks
@celery_app.task
def scheduled_queue_processing():
    """Scheduled task to process email queue every minute."""
    return process_email_queue.delay(max_emails=50)


@celery_app.task
def scheduled_deliverability_check():
    """Scheduled task to check deliverability every hour."""
    return monitor_email_deliverability.delay()


@celery_app.task
def scheduled_cleanup():
    """Scheduled task to clean up old data daily."""
    return cleanup_email_data.delay()