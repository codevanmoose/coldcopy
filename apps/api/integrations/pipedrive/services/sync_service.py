"""
Pipedrive data synchronization service
"""
import logging
from typing import Optional, Dict, Any, List, Tuple
from datetime import datetime, timedelta
import asyncio
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from models.lead import Lead
from models.campaign import Campaign
from models.email_event import EmailEvent, EventType
from models.workspace import Workspace
from utils.cache_manager import CacheManager, CacheNamespace
from ..models.contacts import PipedrivePerson, PipedriveOrganization
from ..models.deals import PipedriveDeal, DealStatus
from ..models.activities import PipedriveActivity
from .api_client import PipedriveAPIClient
from .auth_service import PipedriveAuthService

logger = logging.getLogger(__name__)


class PipedriveSyncService:
    """Handle data synchronization between ColdCopy and Pipedrive"""
    
    def __init__(
        self,
        db: AsyncSession,
        workspace_id: str,
        cache: Optional[CacheManager] = None
    ):
        self.db = db
        self.workspace_id = workspace_id
        self.cache = cache
        self.auth_service = PipedriveAuthService(db, cache)
        self._client: Optional[PipedriveAPIClient] = None
        self._field_mappings: Optional[Dict[str, Any]] = None
    
    async def _get_client(self) -> Optional[PipedriveAPIClient]:
        """Get or create API client"""
        if not self._client:
            auth = await self.auth_service.get_auth(self.workspace_id)
            if auth:
                self._client = PipedriveAPIClient(auth, self.cache)
        return self._client
    
    async def _get_field_mappings(self) -> Dict[str, Any]:
        """Get field mappings from workspace settings"""
        if self._field_mappings:
            return self._field_mappings
        
        # Get from workspace settings
        query = select(Workspace).where(Workspace.id == self.workspace_id)
        result = await self.db.execute(query)
        workspace = result.scalar_one_or_none()
        
        if workspace and workspace.settings.get("pipedrive_field_mappings"):
            self._field_mappings = workspace.settings["pipedrive_field_mappings"]
        else:
            # Default mappings
            self._field_mappings = {
                "person": {
                    "email": "email",
                    "first_name": "first_name",
                    "last_name": "last_name",
                    "company": "org_name",
                    "job_title": "job_title",
                    "phone": "phone",
                    "linkedin_url": "linkedin",  # Custom field
                    "tags": "labels"
                },
                "deal": {
                    "campaign_name": "title",
                    "campaign_status": "status",
                    "lead_score": "probability"
                }
            }
        
        return self._field_mappings
    
    # Lead/Person synchronization
    
    async def sync_lead_to_person(self, lead_id: str) -> Optional[int]:
        """Sync a ColdCopy lead to Pipedrive person"""
        try:
            client = await self._get_client()
            if not client:
                return None
            
            # Get lead from database
            query = select(Lead).where(
                Lead.id == lead_id,
                Lead.workspace_id == self.workspace_id
            )
            result = await self.db.execute(query)
            lead = result.scalar_one_or_none()
            
            if not lead:
                return None
            
            # Check if person already exists
            person_id = lead.external_ids.get("pipedrive_person_id") if lead.external_ids else None
            
            if person_id:
                # Update existing person
                person_data = await self._prepare_person_data(lead)
                updated = await client.update_person(person_id, person_data)
                if updated:
                    logger.info(f"Updated Pipedrive person {person_id} for lead {lead_id}")
                return person_id
            else:
                # Search for existing person by email
                existing = await client.search_persons(lead.email, ["email"])
                
                if existing:
                    # Link to existing person
                    person_id = existing[0]["item"]["id"]
                    
                    # Update lead with Pipedrive ID
                    if not lead.external_ids:
                        lead.external_ids = {}
                    lead.external_ids["pipedrive_person_id"] = person_id
                    await self.db.commit()
                    
                    # Update person data
                    person_data = await self._prepare_person_data(lead)
                    await client.update_person(person_id, person_data)
                    
                    logger.info(f"Linked lead {lead_id} to existing Pipedrive person {person_id}")
                    return person_id
                else:
                    # Create new person
                    person_data = await self._prepare_person_data(lead)
                    created = await client.create_person(person_data)
                    
                    if created:
                        person_id = created["id"]
                        
                        # Update lead with Pipedrive ID
                        if not lead.external_ids:
                            lead.external_ids = {}
                        lead.external_ids["pipedrive_person_id"] = person_id
                        await self.db.commit()
                        
                        logger.info(f"Created Pipedrive person {person_id} for lead {lead_id}")
                        return person_id
            
        except Exception as e:
            logger.error(f"Error syncing lead to person: {e}")
        
        return None
    
    async def sync_person_to_lead(self, person_id: int) -> Optional[str]:
        """Sync a Pipedrive person to ColdCopy lead"""
        try:
            client = await self._get_client()
            if not client:
                return None
            
            # Get person from Pipedrive
            person_data = await client.get_person(person_id)
            if not person_data:
                return None
            
            # Extract email
            email = None
            if person_data.get("email"):
                for email_obj in person_data["email"]:
                    if email_obj.get("primary") or not email:
                        email = email_obj.get("value")
            
            if not email:
                logger.warning(f"Pipedrive person {person_id} has no email")
                return None
            
            # Check if lead exists
            query = select(Lead).where(
                Lead.email == email,
                Lead.workspace_id == self.workspace_id
            )
            result = await self.db.execute(query)
            lead = result.scalar_one_or_none()
            
            if lead:
                # Update existing lead
                await self._update_lead_from_person(lead, person_data)
                await self.db.commit()
                logger.info(f"Updated lead {lead.id} from Pipedrive person {person_id}")
                return lead.id
            else:
                # Create new lead
                lead = await self._create_lead_from_person(person_data)
                self.db.add(lead)
                await self.db.commit()
                logger.info(f"Created lead {lead.id} from Pipedrive person {person_id}")
                return lead.id
                
        except Exception as e:
            logger.error(f"Error syncing person to lead: {e}")
        
        return None
    
    # Campaign/Deal synchronization
    
    async def sync_campaign_to_deal(self, campaign_id: str) -> Optional[int]:
        """Sync a ColdCopy campaign to Pipedrive deal"""
        try:
            client = await self._get_client()
            if not client:
                return None
            
            # Get campaign from database
            query = select(Campaign).where(
                Campaign.id == campaign_id,
                Campaign.workspace_id == self.workspace_id
            )
            result = await self.db.execute(query)
            campaign = result.scalar_one_or_none()
            
            if not campaign:
                return None
            
            # Get default pipeline and stage
            pipelines = await client.get_pipelines()
            if not pipelines:
                logger.error("No pipelines found in Pipedrive")
                return None
            
            pipeline_id = pipelines[0]["id"]
            stages = await client.get_pipeline_stages(pipeline_id)
            if not stages:
                logger.error("No stages found in pipeline")
                return None
            
            stage_id = stages[0]["id"]  # First stage
            
            # Check if deal already exists
            deal_id = campaign.metadata.get("pipedrive_deal_id") if campaign.metadata else None
            
            if deal_id:
                # Update existing deal
                deal_data = await self._prepare_deal_data(campaign, stage_id)
                updated = await client.update_deal(deal_id, deal_data)
                if updated:
                    logger.info(f"Updated Pipedrive deal {deal_id} for campaign {campaign_id}")
                return deal_id
            else:
                # Create new deal
                deal_data = await self._prepare_deal_data(campaign, stage_id)
                created = await client.create_deal(deal_data)
                
                if created:
                    deal_id = created["id"]
                    
                    # Update campaign with Pipedrive ID
                    if not campaign.metadata:
                        campaign.metadata = {}
                    campaign.metadata["pipedrive_deal_id"] = deal_id
                    await self.db.commit()
                    
                    logger.info(f"Created Pipedrive deal {deal_id} for campaign {campaign_id}")
                    return deal_id
                    
        except Exception as e:
            logger.error(f"Error syncing campaign to deal: {e}")
        
        return None
    
    # Email event/Activity synchronization
    
    async def sync_email_event_to_activity(self, event_id: str) -> Optional[int]:
        """Sync email event to Pipedrive activity"""
        try:
            client = await self._get_client()
            if not client:
                return None
            
            # Get email event
            query = select(EmailEvent).where(EmailEvent.id == event_id)
            result = await self.db.execute(query)
            event = result.scalar_one_or_none()
            
            if not event:
                return None
            
            # Get lead's Pipedrive person ID
            lead_query = select(Lead).where(Lead.id == event.lead_id)
            lead_result = await self.db.execute(lead_query)
            lead = lead_result.scalar_one_or_none()
            
            if not lead or not lead.external_ids or not lead.external_ids.get("pipedrive_person_id"):
                # Sync lead first
                person_id = await self.sync_lead_to_person(event.lead_id)
                if not person_id:
                    return None
            else:
                person_id = lead.external_ids["pipedrive_person_id"]
            
            # Create activity based on event type
            activity_data = await self._prepare_activity_data(event, person_id)
            
            if activity_data:
                created = await client.create_activity(activity_data)
                if created:
                    activity_id = created["id"]
                    
                    # Mark as done if event already happened
                    if event.event_type in [EventType.OPENED, EventType.CLICKED, EventType.REPLIED]:
                        await client.mark_activity_done(activity_id)
                    
                    logger.info(f"Created Pipedrive activity {activity_id} for event {event_id}")
                    return activity_id
                    
        except Exception as e:
            logger.error(f"Error syncing email event to activity: {e}")
        
        return None
    
    # Bulk sync operations
    
    async def bulk_sync_leads(self, limit: int = 100) -> Dict[str, Any]:
        """Bulk sync leads to Pipedrive"""
        results = {
            "synced": 0,
            "failed": 0,
            "errors": []
        }
        
        try:
            # Get leads without Pipedrive ID
            query = select(Lead).where(
                Lead.workspace_id == self.workspace_id,
                Lead.external_ids["pipedrive_person_id"].is_(None)
            ).limit(limit)
            result = await self.db.execute(query)
            leads = result.scalars().all()
            
            for lead in leads:
                try:
                    person_id = await self.sync_lead_to_person(lead.id)
                    if person_id:
                        results["synced"] += 1
                    else:
                        results["failed"] += 1
                except Exception as e:
                    results["failed"] += 1
                    results["errors"].append(str(e))
                
                # Small delay between syncs
                await asyncio.sleep(0.1)
                
        except Exception as e:
            logger.error(f"Error in bulk sync: {e}")
            results["errors"].append(str(e))
        
        return results
    
    # Helper methods
    
    async def _prepare_person_data(self, lead: Lead) -> Dict[str, Any]:
        """Prepare person data for Pipedrive API"""
        mappings = await self._get_field_mappings()
        person_mappings = mappings.get("person", {})
        
        person_data = {
            "name": f"{lead.first_name or ''} {lead.last_name or ''}".strip() or lead.email,
            "email": [{"value": lead.email, "primary": True}]
        }
        
        # Map fields
        if lead.first_name and "first_name" in person_mappings:
            person_data[person_mappings["first_name"]] = lead.first_name
            
        if lead.last_name and "last_name" in person_mappings:
            person_data[person_mappings["last_name"]] = lead.last_name
            
        if lead.company and "company" in person_mappings:
            person_data[person_mappings["company"]] = lead.company
            
        if lead.job_title and "job_title" in person_mappings:
            person_data[person_mappings["job_title"]] = lead.job_title
            
        if lead.phone and "phone" in person_mappings:
            person_data["phone"] = [{"value": lead.phone, "primary": True}]
        
        # Add custom fields from enrichment data
        if lead.enrichment_data:
            if lead.enrichment_data.get("linkedin_url") and "linkedin_url" in person_mappings:
                person_data[person_mappings["linkedin_url"]] = lead.enrichment_data["linkedin_url"]
        
        return person_data
    
    async def _prepare_deal_data(self, campaign: Campaign, stage_id: int) -> Dict[str, Any]:
        """Prepare deal data for Pipedrive API"""
        mappings = await self._get_field_mappings()
        deal_mappings = mappings.get("deal", {})
        
        # Calculate deal value based on campaign size
        lead_count = campaign.settings.get("total_leads", 0)
        avg_deal_size = 50  # Average revenue per lead
        deal_value = lead_count * avg_deal_size
        
        deal_data = {
            "title": campaign.name,
            "stage_id": stage_id,
            "value": deal_value,
            "currency": "USD",
            "status": DealStatus.OPEN.value
        }
        
        # Map campaign status
        if campaign.status == "completed":
            deal_data["status"] = DealStatus.WON.value
        elif campaign.status == "cancelled":
            deal_data["status"] = DealStatus.LOST.value
        
        # Add probability based on campaign performance
        if campaign.stats:
            open_rate = campaign.stats.get("open_rate", 0)
            reply_rate = campaign.stats.get("reply_rate", 0)
            probability = min(100, int((open_rate + reply_rate * 2) / 3))
            deal_data["probability"] = probability
        
        return deal_data
    
    async def _prepare_activity_data(self, event: EmailEvent, person_id: int) -> Optional[Dict[str, Any]]:
        """Prepare activity data for Pipedrive API"""
        # Map event types to activity types
        activity_map = {
            EventType.SENT: ("email", "Email sent", False),
            EventType.OPENED: ("email", "Email opened", True),
            EventType.CLICKED: ("email", "Email link clicked", True),
            EventType.REPLIED: ("email", "Email reply received", True),
            EventType.BOUNCED: ("email", "Email bounced", True),
            EventType.UNSUBSCRIBED: ("email", "Unsubscribed", True)
        }
        
        if event.event_type not in activity_map:
            return None
        
        activity_type, subject, done = activity_map[event.event_type]
        
        # Get campaign info
        campaign_query = select(Campaign).where(Campaign.id == event.campaign_id)
        campaign_result = await self.db.execute(campaign_query)
        campaign = campaign_result.scalar_one_or_none()
        
        activity_data = {
            "subject": f"{subject} - {campaign.name if campaign else 'Campaign'}",
            "type": activity_type,
            "person_id": person_id,
            "done": done,
            "due_date": event.created_at.date().isoformat()
        }
        
        # Add deal if campaign has one
        if campaign and campaign.metadata and campaign.metadata.get("pipedrive_deal_id"):
            activity_data["deal_id"] = campaign.metadata["pipedrive_deal_id"]
        
        # Add note with email details
        if event.metadata:
            note_parts = []
            if event.metadata.get("subject"):
                note_parts.append(f"Subject: {event.metadata['subject']}")
            if event.metadata.get("user_agent"):
                note_parts.append(f"Device: {event.metadata['user_agent']}")
            if note_parts:
                activity_data["note"] = "\n".join(note_parts)
        
        return activity_data
    
    async def _update_lead_from_person(self, lead: Lead, person_data: Dict[str, Any]):
        """Update lead with Pipedrive person data"""
        # Update basic fields
        if person_data.get("name"):
            parts = person_data["name"].split(" ", 1)
            lead.first_name = parts[0]
            if len(parts) > 1:
                lead.last_name = parts[1]
        
        if person_data.get("org_name"):
            lead.company = person_data["org_name"]
            
        # Update external IDs
        if not lead.external_ids:
            lead.external_ids = {}
        lead.external_ids["pipedrive_person_id"] = person_data["id"]
        
        if person_data.get("org_id"):
            lead.external_ids["pipedrive_org_id"] = person_data["org_id"]
        
        lead.updated_at = datetime.utcnow()
    
    async def _create_lead_from_person(self, person_data: Dict[str, Any]) -> Lead:
        """Create new lead from Pipedrive person data"""
        # Extract email
        email = None
        for email_obj in person_data.get("email", []):
            if email_obj.get("primary") or not email:
                email = email_obj.get("value")
        
        # Parse name
        first_name = ""
        last_name = ""
        if person_data.get("name"):
            parts = person_data["name"].split(" ", 1)
            first_name = parts[0]
            if len(parts) > 1:
                last_name = parts[1]
        
        lead = Lead(
            workspace_id=self.workspace_id,
            email=email,
            first_name=first_name,
            last_name=last_name,
            company=person_data.get("org_name"),
            source="pipedrive",
            external_ids={
                "pipedrive_person_id": person_data["id"],
                "pipedrive_org_id": person_data.get("org_id")
            }
        )
        
        return lead