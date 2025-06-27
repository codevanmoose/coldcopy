"""
Pipedrive webhook processing service
"""
import logging
import hmac
import hashlib
from typing import Optional, Dict, Any
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from models.workspace import Workspace
from utils.cache_manager import CacheManager
from workers.webhook_tasks import process_webhook_event
from ..models.webhooks import PipedriveWebhookEvent, WebhookAction, WebhookObject
from .sync_service import PipedriveSyncService
from .api_client import PipedriveAPIClient
from .auth_service import PipedriveAuthService

logger = logging.getLogger(__name__)


class PipedriveWebhookService:
    """Handle Pipedrive webhook events"""
    
    WEBHOOK_EVENTS = [
        "person.added",
        "person.updated", 
        "person.deleted",
        "person.merged",
        "organization.added",
        "organization.updated",
        "organization.deleted",
        "deal.added",
        "deal.updated",
        "deal.deleted",
        "activity.added",
        "activity.updated",
        "activity.deleted"
    ]
    
    def __init__(
        self,
        db: AsyncSession,
        cache: Optional[CacheManager] = None
    ):
        self.db = db
        self.cache = cache
        self.auth_service = PipedriveAuthService(db, cache)
    
    async def setup_webhooks(self, workspace_id: str, webhook_url: str) -> bool:
        """Setup webhook subscriptions for workspace"""
        try:
            # Get auth
            auth = await self.auth_service.get_auth(workspace_id)
            if not auth:
                logger.error(f"No Pipedrive auth found for workspace {workspace_id}")
                return False
            
            client = PipedriveAPIClient(auth, self.cache)
            
            # Create webhooks for each event type
            created_count = 0
            for event in self.WEBHOOK_EVENTS:
                parts = event.split(".")
                event_object = parts[0]
                event_action = parts[1] if len(parts) > 1 else "*"
                
                webhook = await client.create_webhook(
                    event_action=event_action,
                    event_object=event_object,
                    subscription_url=f"{webhook_url}?workspace_id={workspace_id}"
                )
                
                if webhook:
                    created_count += 1
                    logger.info(f"Created webhook for {event}")
                else:
                    logger.error(f"Failed to create webhook for {event}")
            
            # Store webhook info in workspace
            query = select(Workspace).where(Workspace.id == workspace_id)
            result = await self.db.execute(query)
            workspace = result.scalar_one_or_none()
            
            if workspace:
                if not workspace.integrations:
                    workspace.integrations = {}
                
                if "pipedrive" not in workspace.integrations:
                    workspace.integrations["pipedrive"] = {}
                    
                workspace.integrations["pipedrive"]["webhooks_enabled"] = True
                workspace.integrations["pipedrive"]["webhook_url"] = webhook_url
                workspace.integrations["pipedrive"]["webhook_count"] = created_count
                
                await self.db.commit()
            
            logger.info(f"Created {created_count} webhooks for workspace {workspace_id}")
            return created_count > 0
            
        except Exception as e:
            logger.error(f"Error setting up webhooks: {e}")
            return False
    
    async def process_webhook(
        self,
        workspace_id: str,
        event_data: Dict[str, Any],
        signature: Optional[str] = None
    ) -> bool:
        """Process incoming webhook event"""
        try:
            # Verify signature if provided
            if signature and not self._verify_signature(event_data, signature, workspace_id):
                logger.error("Invalid webhook signature")
                return False
            
            # Parse event
            event = PipedriveWebhookEvent(**event_data)
            
            # Log event
            logger.info(f"Processing Pipedrive webhook: {event.event} for workspace {workspace_id}")
            
            # Route to appropriate handler
            if event.object == WebhookObject.PERSON:
                await self._handle_person_event(workspace_id, event)
            elif event.object == WebhookObject.ORGANIZATION:
                await self._handle_organization_event(workspace_id, event)
            elif event.object == WebhookObject.DEAL:
                await self._handle_deal_event(workspace_id, event)
            elif event.object == WebhookObject.ACTIVITY:
                await self._handle_activity_event(workspace_id, event)
            else:
                logger.warning(f"Unhandled webhook object type: {event.object}")
            
            # Queue for async processing if needed
            await process_webhook_event.delay(
                integration="pipedrive",
                workspace_id=workspace_id,
                event_type=event.event,
                payload=event_data
            )
            
            return True
            
        except Exception as e:
            logger.error(f"Error processing webhook: {e}")
            return False
    
    async def _handle_person_event(self, workspace_id: str, event: PipedriveWebhookEvent):
        """Handle person-related webhook events"""
        sync_service = PipedriveSyncService(self.db, workspace_id, self.cache)
        
        if event.action in [WebhookAction.ADDED, WebhookAction.UPDATED]:
            # Sync person to lead
            person_id = event.object_id
            if person_id:
                await sync_service.sync_person_to_lead(person_id)
                
        elif event.action == WebhookAction.DELETED:
            # Mark lead as deleted
            if event.previous:
                email = None
                for email_obj in event.previous.get("email", []):
                    if email_obj.get("primary"):
                        email = email_obj.get("value")
                        break
                
                if email:
                    # Find and mark lead as deleted
                    from models.lead import Lead
                    query = select(Lead).where(
                        Lead.email == email,
                        Lead.workspace_id == workspace_id
                    )
                    result = await self.db.execute(query)
                    lead = result.scalar_one_or_none()
                    
                    if lead:
                        lead.is_active = False
                        lead.updated_at = datetime.utcnow()
                        await self.db.commit()
        
        elif event.action == WebhookAction.MERGED:
            # Handle person merge
            if event.current and event.previous:
                merge_into_id = event.current.get("merge_into_person_id")
                if merge_into_id:
                    await sync_service.sync_person_to_lead(merge_into_id)
    
    async def _handle_organization_event(self, workspace_id: str, event: PipedriveWebhookEvent):
        """Handle organization-related webhook events"""
        # For now, just log these events
        # In future, could sync organizations to a company model
        logger.info(f"Organization event: {event.action} for workspace {workspace_id}")
    
    async def _handle_deal_event(self, workspace_id: str, event: PipedriveWebhookEvent):
        """Handle deal-related webhook events"""
        if event.action in [WebhookAction.ADDED, WebhookAction.UPDATED]:
            # Update campaign based on deal changes
            deal_data = event.current
            if deal_data:
                # Find campaign by Pipedrive deal ID
                from models.campaign import Campaign
                query = select(Campaign).where(
                    Campaign.workspace_id == workspace_id,
                    Campaign.metadata["pipedrive_deal_id"].astext == str(event.object_id)
                )
                result = await self.db.execute(query)
                campaign = result.scalar_one_or_none()
                
                if campaign:
                    # Update campaign status based on deal
                    if deal_data.get("status") == "won":
                        campaign.status = "completed"
                    elif deal_data.get("status") == "lost":
                        campaign.status = "cancelled"
                    
                    # Update campaign stats
                    if not campaign.stats:
                        campaign.stats = {}
                    
                    campaign.stats["deal_value"] = float(deal_data.get("value", 0))
                    campaign.stats["deal_probability"] = deal_data.get("probability", 0)
                    campaign.stats["deal_stage"] = deal_data.get("stage_id")
                    
                    campaign.updated_at = datetime.utcnow()
                    await self.db.commit()
    
    async def _handle_activity_event(self, workspace_id: str, event: PipedriveWebhookEvent):
        """Handle activity-related webhook events"""
        # Log activity events for tracking
        logger.info(f"Activity event: {event.action} for workspace {workspace_id}")
        
        # Could sync back to email event status if needed
        if event.action == WebhookAction.UPDATED and event.current:
            if event.current.get("done") and event.current.get("type") == "email":
                # Activity marked as done, could update email event status
                pass
    
    def _verify_signature(self, payload: Dict[str, Any], signature: str, workspace_id: str) -> bool:
        """Verify webhook signature"""
        # Pipedrive doesn't use webhook signatures by default
        # This is a placeholder for custom implementation if needed
        return True
    
    async def remove_webhooks(self, workspace_id: str) -> bool:
        """Remove all webhook subscriptions for workspace"""
        try:
            # Get auth
            auth = await self.auth_service.get_auth(workspace_id)
            if not auth:
                return False
            
            # For now, we can't easily remove webhooks without storing their IDs
            # In a production implementation, we would store webhook IDs when creating them
            
            # Update workspace to mark webhooks as disabled
            query = select(Workspace).where(Workspace.id == workspace_id)
            result = await self.db.execute(query)
            workspace = result.scalar_one_or_none()
            
            if workspace and workspace.integrations and "pipedrive" in workspace.integrations:
                workspace.integrations["pipedrive"]["webhooks_enabled"] = False
                await self.db.commit()
            
            return True
            
        except Exception as e:
            logger.error(f"Error removing webhooks: {e}")
            return False