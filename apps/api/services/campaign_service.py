"""
Campaign service for business logic.
"""
from typing import Optional, List
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.campaign import Campaign, CampaignCreate, CampaignUpdate


class CampaignService:
    """Service class for campaign operations."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get_campaign_by_id(self, campaign_id: UUID) -> Optional[Campaign]:
        """Get campaign by ID."""
        result = await self.db.execute(
            select(Campaign).where(Campaign.id == campaign_id)
        )
        return result.scalar_one_or_none()
    
    async def get_campaigns_by_workspace(
        self, 
        workspace_id: UUID, 
        skip: int = 0, 
        limit: int = 100
    ) -> List[Campaign]:
        """Get campaigns by workspace ID."""
        result = await self.db.execute(
            select(Campaign)
            .where(Campaign.workspace_id == workspace_id)
            .offset(skip)
            .limit(limit)
        )
        return list(result.scalars().all())
    
    async def create_campaign(
        self, 
        campaign: CampaignCreate, 
        workspace_id: UUID, 
        created_by: UUID
    ) -> Campaign:
        """Create a new campaign."""
        db_campaign = Campaign(
            name=campaign.name,
            description=campaign.description,
            status=campaign.status,
            settings=campaign.settings or {},
            workspace_id=workspace_id,
            created_by=created_by
        )
        
        self.db.add(db_campaign)
        await self.db.commit()
        await self.db.refresh(db_campaign)
        
        return db_campaign
    
    async def update_campaign(
        self, 
        campaign_id: UUID, 
        campaign_update: CampaignUpdate
    ) -> Optional[Campaign]:
        """Update a campaign."""
        result = await self.db.execute(
            select(Campaign).where(Campaign.id == campaign_id)
        )
        db_campaign = result.scalar_one_or_none()
        
        if not db_campaign:
            return None
        
        update_data = campaign_update.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            if field == "settings" and value is not None:
                # Merge settings instead of replacing
                current_settings = db_campaign.settings or {}
                current_settings.update(value)
                setattr(db_campaign, field, current_settings)
            else:
                setattr(db_campaign, field, value)
        
        await self.db.commit()
        await self.db.refresh(db_campaign)
        
        return db_campaign
    
    async def delete_campaign(self, campaign_id: UUID) -> bool:
        """Delete a campaign."""
        result = await self.db.execute(
            select(Campaign).where(Campaign.id == campaign_id)
        )
        db_campaign = result.scalar_one_or_none()
        
        if not db_campaign:
            return False
        
        await self.db.delete(db_campaign)
        await self.db.commit()
        
        return True