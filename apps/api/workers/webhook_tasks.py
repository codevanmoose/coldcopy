"""
Background tasks for processing webhook events.
"""
import logging
from typing import Dict, Any, Optional
from datetime import datetime, timedelta
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_async_session
from models.email_event import EmailEvent
from models.lead import Lead
from models.campaign import Campaign
from utils.redis_manager import get_analytics_cache, get_deliverability_cache
from workers.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, max_retries=3)
def process_webhook_event(self, event_data: Dict[str, Any]):
    """Process webhook event from email providers."""
    import asyncio
    
    async def _process_event():
        try:
            provider = event_data.get("provider")
            event_type = event_data.get("event_type")
            message_id = event_data.get("message_id")
            recipient_email = event_data.get("recipient_email")
            timestamp = datetime.fromisoformat(event_data.get("timestamp"))
            
            logger.info(f"Processing {provider} webhook: {event_type} for {recipient_email}")
            
            async with get_async_session() as db:
                # Find the email event by message ID
                stmt = select(EmailEvent).where(
                    EmailEvent.external_id == message_id
                )
                result = await db.execute(stmt)
                email_event = result.scalar_one_or_none()
                
                if not email_event:
                    logger.warning(f"Email event not found for message ID: {message_id}")
                    # Create a new email event if we can't find the original
                    await _create_orphaned_email_event(db, event_data)
                    return
                
                # Update email event based on webhook type
                await _update_email_event(db, email_event, event_data)
                
                # Update lead and campaign statistics
                await _update_statistics(db, email_event, event_data)
                
                # Update deliverability cache
                await _update_deliverability_cache(event_data)
                
                # Handle special events
                await _handle_special_events(db, email_event, event_data)
                
                await db.commit()
                
                logger.info(f"Successfully processed {provider} webhook event")
        
        except Exception as e:
            logger.error(f"Error processing webhook event: {str(e)}")
            # Retry the task
            raise self.retry(countdown=60, exc=e)
    
    # Run the async function
    asyncio.run(_process_event())


async def _update_email_event(
    db: AsyncSession,
    email_event: EmailEvent,
    event_data: Dict[str, Any]
) -> None:
    """Update email event with webhook data."""
    provider = event_data.get("provider")
    event_type = event_data.get("event_type")
    timestamp = datetime.fromisoformat(event_data.get("timestamp"))
    raw_event_data = event_data.get("event_data", {})
    
    # Map provider-specific event types to our standard types
    status_mapping = {
        "ses": {
            "send": "sent",
            "delivery": "delivered",
            "bounce": "bounced",
            "complaint": "complained",
            "open": "opened",
            "click": "clicked",
            "reject": "rejected"
        },
        "sendgrid": {
            "delivered": "delivered",
            "bounce": "bounced",
            "dropped": "dropped",
            "spamreport": "complained",
            "unsubscribe": "unsubscribed",
            "group_unsubscribe": "unsubscribed",
            "open": "opened",
            "click": "clicked",
            "processed": "sent"
        },
        "mailgun": {
            "delivered": "delivered",
            "failed": "failed",
            "opened": "opened",
            "clicked": "clicked",
            "unsubscribed": "unsubscribed",
            "complained": "complained"
        },
        "postmark": {
            "delivery": "delivered",
            "bounce": "bounced",
            "spamcomplaint": "complained",
            "open": "opened",
            "click": "clicked"
        }
    }
    
    # Get standardized status
    provider_mapping = status_mapping.get(provider, {})
    standard_status = provider_mapping.get(event_type, event_type)
    
    # Update email event
    update_data = {
        "status": standard_status,
        "updated_at": timestamp
    }
    
    # Add provider-specific data
    if standard_status == "delivered":
        update_data["delivered_at"] = timestamp
    elif standard_status == "opened":
        update_data["opened_at"] = timestamp
        update_data["open_count"] = (email_event.open_count or 0) + 1
        
        # Extract user agent and IP if available
        if provider == "sendgrid":
            update_data["user_agent"] = raw_event_data.get("useragent")
            update_data["ip_address"] = raw_event_data.get("ip")
        elif provider == "mailgun":
            client_info = raw_event_data.get("client_info", {})
            update_data["user_agent"] = client_info.get("user-agent")
            update_data["ip_address"] = raw_event_data.get("ip")
    
    elif standard_status == "clicked":
        update_data["clicked_at"] = timestamp
        update_data["click_count"] = (email_event.click_count or 0) + 1
        
        # Extract clicked URL
        if provider == "sendgrid":
            update_data["clicked_url"] = raw_event_data.get("url")
        elif provider == "mailgun":
            update_data["clicked_url"] = raw_event_data.get("url")
    
    elif standard_status in ["bounced", "failed"]:
        update_data["bounced_at"] = timestamp
        
        # Extract bounce reason
        if provider == "ses":
            bounce_data = raw_event_data.get("bounce", {})
            update_data["bounce_reason"] = bounce_data.get("bounceType")
            update_data["bounce_sub_type"] = bounce_data.get("bounceSubType")
        elif provider == "sendgrid":
            update_data["bounce_reason"] = raw_event_data.get("reason")
            update_data["bounce_sub_type"] = raw_event_data.get("status")
        elif provider == "mailgun":
            delivery_status = raw_event_data.get("delivery_status", {})
            update_data["bounce_reason"] = delivery_status.get("description")
    
    elif standard_status == "complained":
        update_data["complained_at"] = timestamp
        
        # Extract complaint feedback
        if provider == "ses":
            complaint_data = raw_event_data.get("complaint", {})
            update_data["complaint_feedback_type"] = complaint_data.get("complaintFeedbackType")
    
    # Update the email event
    stmt = update(EmailEvent).where(
        EmailEvent.id == email_event.id
    ).values(**update_data)
    
    await db.execute(stmt)


async def _update_statistics(
    db: AsyncSession,
    email_event: EmailEvent,
    event_data: Dict[str, Any]
) -> None:
    """Update lead and campaign statistics."""
    try:
        analytics_cache = await get_analytics_cache()
        event_type = event_data.get("event_type")
        
        # Update analytics cache
        if email_event.campaign_id:
            # Campaign-level metrics
            await analytics_cache.increment_metric(
                email_event.workspace_id,
                f"campaign:{email_event.campaign_id}:{event_type}",
                1
            )
            
            # Update campaign open/click rates
            if event_type in ["opened", "clicked"]:
                await _update_campaign_engagement_rates(
                    analytics_cache,
                    email_event.workspace_id,
                    email_event.campaign_id
                )
        
        # Workspace-level metrics
        await analytics_cache.increment_metric(
            email_event.workspace_id,
            f"total_{event_type}",
            1
        )
        
        # Update daily metrics
        today = datetime.utcnow().date().isoformat()
        await analytics_cache.increment_metric(
            email_event.workspace_id,
            f"daily:{today}:{event_type}",
            1
        )
    
    except Exception as e:
        logger.error(f"Error updating statistics: {str(e)}")


async def _update_campaign_engagement_rates(
    analytics_cache,
    workspace_id: UUID,
    campaign_id: UUID
) -> None:
    """Update campaign engagement rates."""
    try:
        # Get campaign metrics
        sent_count = await analytics_cache.get_metric(
            workspace_id, f"campaign:{campaign_id}:sent"
        ) or 0
        
        opened_count = await analytics_cache.get_metric(
            workspace_id, f"campaign:{campaign_id}:opened"
        ) or 0
        
        clicked_count = await analytics_cache.get_metric(
            workspace_id, f"campaign:{campaign_id}:clicked"
        ) or 0
        
        # Calculate rates
        if sent_count > 0:
            open_rate = (opened_count / sent_count) * 100
            click_rate = (clicked_count / sent_count) * 100
            
            await analytics_cache.cache_metric(
                workspace_id, f"campaign:{campaign_id}:open_rate", open_rate
            )
            await analytics_cache.cache_metric(
                workspace_id, f"campaign:{campaign_id}:click_rate", click_rate
            )
    
    except Exception as e:
        logger.error(f"Error updating engagement rates: {str(e)}")


async def _update_deliverability_cache(event_data: Dict[str, Any]) -> None:
    """Update deliverability cache with event data."""
    try:
        deliverability_cache = await get_deliverability_cache()
        recipient_email = event_data.get("recipient_email", "")
        event_type = event_data.get("event_type")
        
        if not recipient_email:
            return
        
        # Extract domain from email
        domain = recipient_email.split("@")[-1].lower()
        
        # Update domain statistics
        if event_type == "delivered":
            await deliverability_cache.increment_domain_stat(domain, "delivered")
        elif event_type in ["bounced", "failed"]:
            await deliverability_cache.increment_domain_stat(domain, "bounced")
        elif event_type == "complained":
            await deliverability_cache.increment_domain_stat(domain, "complained")
        
        # Update overall deliverability score
        await deliverability_cache.update_domain_score(domain)
    
    except Exception as e:
        logger.error(f"Error updating deliverability cache: {str(e)}")


async def _handle_special_events(
    db: AsyncSession,
    email_event: EmailEvent,
    event_data: Dict[str, Any]
) -> None:
    """Handle special webhook events that require additional processing."""
    event_type = event_data.get("event_type")
    
    # Handle unsubscribes
    if event_type in ["unsubscribed", "group_unsubscribe"]:
        await _handle_unsubscribe(db, email_event, event_data)
    
    # Handle spam complaints
    elif event_type in ["complained", "spamreport"]:
        await _handle_spam_complaint(db, email_event, event_data)
    
    # Handle hard bounces
    elif event_type == "bounced":
        await _handle_bounce(db, email_event, event_data)


async def _handle_unsubscribe(
    db: AsyncSession,
    email_event: EmailEvent,
    event_data: Dict[str, Any]
) -> None:
    """Handle unsubscribe events."""
    try:
        # Update lead to mark as unsubscribed
        if email_event.lead_id:
            stmt = update(Lead).where(
                Lead.id == email_event.lead_id
            ).values(
                is_unsubscribed=True,
                unsubscribed_at=datetime.utcnow(),
                unsubscribe_reason="webhook_unsubscribe"
            )
            await db.execute(stmt)
        
        logger.info(f"Lead {email_event.lead_id} marked as unsubscribed")
    
    except Exception as e:
        logger.error(f"Error handling unsubscribe: {str(e)}")


async def _handle_spam_complaint(
    db: AsyncSession,
    email_event: EmailEvent,
    event_data: Dict[str, Any]
) -> None:
    """Handle spam complaint events."""
    try:
        # Update lead to mark as complained
        if email_event.lead_id:
            stmt = update(Lead).where(
                Lead.id == email_event.lead_id
            ).values(
                is_complained=True,
                complained_at=datetime.utcnow()
            )
            await db.execute(stmt)
        
        logger.warning(f"Spam complaint received for lead {email_event.lead_id}")
    
    except Exception as e:
        logger.error(f"Error handling spam complaint: {str(e)}")


async def _handle_bounce(
    db: AsyncSession,
    email_event: EmailEvent,
    event_data: Dict[str, Any]
) -> None:
    """Handle bounce events."""
    try:
        provider = event_data.get("provider")
        raw_event_data = event_data.get("event_data", {})
        
        # Determine if it's a hard bounce
        is_hard_bounce = False
        
        if provider == "ses":
            bounce_data = raw_event_data.get("bounce", {})
            bounce_type = bounce_data.get("bounceType", "").lower()
            is_hard_bounce = bounce_type == "permanent"
        
        elif provider == "sendgrid":
            reason = raw_event_data.get("reason", "").lower()
            is_hard_bounce = any(keyword in reason for keyword in [
                "invalid", "not exist", "unknown user", "mailbox unavailable"
            ])
        
        elif provider == "mailgun":
            delivery_status = raw_event_data.get("delivery_status", {})
            code = delivery_status.get("code", 0)
            is_hard_bounce = 500 <= code < 600
        
        # Update lead if hard bounce
        if is_hard_bounce and email_event.lead_id:
            stmt = update(Lead).where(
                Lead.id == email_event.lead_id
            ).values(
                is_bounced=True,
                bounced_at=datetime.utcnow(),
                bounce_type="hard"
            )
            await db.execute(stmt)
            
            logger.warning(f"Hard bounce recorded for lead {email_event.lead_id}")
    
    except Exception as e:
        logger.error(f"Error handling bounce: {str(e)}")


async def _create_orphaned_email_event(
    db: AsyncSession,
    event_data: Dict[str, Any]
) -> None:
    """Create email event for webhook without existing record."""
    try:
        # This can happen if the webhook arrives before our send confirmation
        # or if there's a timing issue
        
        email_event = EmailEvent(
            external_id=event_data.get("message_id"),
            recipient_email=event_data.get("recipient_email"),
            status="unknown",
            provider=event_data.get("provider"),
            created_at=datetime.fromisoformat(event_data.get("timestamp")),
            metadata={"orphaned": True, "webhook_data": event_data.get("event_data")}
        )
        
        db.add(email_event)
        await db.flush()
        
        # Process the event normally
        await _update_email_event(db, email_event, event_data)
        
        logger.info(f"Created orphaned email event for message {event_data.get('message_id')}")
    
    except Exception as e:
        logger.error(f"Error creating orphaned email event: {str(e)}")


@celery_app.task
def cleanup_old_webhook_events():
    """Clean up old webhook event data."""
    import asyncio
    
    async def _cleanup():
        try:
            async with get_async_session() as db:
                # Delete email events older than 90 days
                cutoff_date = datetime.utcnow() - timedelta(days=90)
                
                stmt = EmailEvent.__table__.delete().where(
                    EmailEvent.created_at < cutoff_date
                )
                
                result = await db.execute(stmt)
                await db.commit()
                
                logger.info(f"Cleaned up {result.rowcount} old email events")
        
        except Exception as e:
            logger.error(f"Error cleaning up webhook events: {str(e)}")
    
    asyncio.run(_cleanup())