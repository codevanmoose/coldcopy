"""
Lead service for business logic.
"""
from typing import Optional, List
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.lead import Lead, LeadCreate, LeadUpdate


class LeadService:
    """Service class for lead operations."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get_lead_by_id(self, lead_id: UUID) -> Optional[Lead]:
        """Get lead by ID."""
        result = await self.db.execute(
            select(Lead).where(Lead.id == lead_id)
        )
        return result.scalar_one_or_none()
    
    async def get_lead_by_email(self, email: str, workspace_id: UUID) -> Optional[Lead]:
        """Get lead by email within workspace."""
        result = await self.db.execute(
            select(Lead).where(
                Lead.email == email,
                Lead.workspace_id == workspace_id
            )
        )
        return result.scalar_one_or_none()
    
    async def get_leads_by_workspace(
        self, 
        workspace_id: UUID, 
        skip: int = 0, 
        limit: int = 100
    ) -> List[Lead]:
        """Get leads by workspace ID."""
        result = await self.db.execute(
            select(Lead)
            .where(Lead.workspace_id == workspace_id)
            .offset(skip)
            .limit(limit)
        )
        return list(result.scalars().all())
    
    async def create_lead(self, lead: LeadCreate, workspace_id: UUID) -> Lead:
        """Create a new lead."""
        # Check if lead with same email already exists in workspace
        existing_lead = await self.get_lead_by_email(lead.email, workspace_id)
        if existing_lead:
            raise ValueError(f"Lead with email {lead.email} already exists in workspace")
        
        db_lead = Lead(
            email=lead.email,
            first_name=lead.first_name,
            last_name=lead.last_name,
            company=lead.company,
            title=lead.title,
            phone=lead.phone,
            status=lead.status,
            enrichment_data=lead.enrichment_data or {},
            notes=lead.notes,
            workspace_id=workspace_id
        )
        
        self.db.add(db_lead)
        await self.db.commit()
        await self.db.refresh(db_lead)
        
        return db_lead
    
    async def update_lead(self, lead_id: UUID, lead_update: LeadUpdate) -> Optional[Lead]:
        """Update a lead."""
        result = await self.db.execute(
            select(Lead).where(Lead.id == lead_id)
        )
        db_lead = result.scalar_one_or_none()
        
        if not db_lead:
            return None
        
        update_data = lead_update.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            if field == "enrichment_data" and value is not None:
                # Merge enrichment data instead of replacing
                current_data = db_lead.enrichment_data or {}
                current_data.update(value)
                setattr(db_lead, field, current_data)
            else:
                setattr(db_lead, field, value)
        
        await self.db.commit()
        await self.db.refresh(db_lead)
        
        return db_lead
    
    async def delete_lead(self, lead_id: UUID) -> bool:
        """Delete a lead."""
        result = await self.db.execute(
            select(Lead).where(Lead.id == lead_id)
        )
        db_lead = result.scalar_one_or_none()
        
        if not db_lead:
            return False
        
        await self.db.delete(db_lead)
        await self.db.commit()
        
        return True
    
    async def enrich_lead(self, lead_id: UUID) -> bool:
        """Trigger lead enrichment process."""
        # This would typically queue a background job
        # For now, just update the status
        result = await self.db.execute(
            select(Lead).where(Lead.id == lead_id)
        )
        db_lead = result.scalar_one_or_none()
        
        if not db_lead:
            return False
        
        # Set status to indicate enrichment is in progress
        db_lead.status = "enriching"
        await self.db.commit()
        
        # TODO: Queue Celery task for actual enrichment
        # from workers.enrichment_tasks import enrich_lead_task
        # enrich_lead_task.delay(str(lead_id))
        
        return True