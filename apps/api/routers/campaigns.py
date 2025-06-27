"""
Campaign management endpoints.
"""
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import get_current_active_user, require_permissions
from models.user import User
from models.campaign import CampaignCreate, CampaignResponse, CampaignUpdate
from services.campaign_service import CampaignService
from workers.email_tasks import start_campaign, pause_campaign

router = APIRouter()


class CampaignStatsResponse(BaseModel):
    id: UUID
    name: str
    status: str
    total_leads: int
    emails_sent: int
    emails_delivered: int
    emails_opened: int
    emails_clicked: int
    emails_replied: int
    open_rate: float
    click_rate: float
    reply_rate: float
    created_at: datetime
    updated_at: datetime


class CampaignActionRequest(BaseModel):
    action: str  # start, pause, resume, stop
    scheduled_at: Optional[datetime] = None


class CampaignPreviewRequest(BaseModel):
    lead_ids: List[UUID]
    template_id: Optional[UUID] = None


class CampaignAnalyticsResponse(BaseModel):
    campaign_id: UUID
    date_range: Dict[str, str]
    metrics: Dict[str, Any]
    performance: Dict[str, float]
    timeline: List[Dict[str, Any]]


@router.get("/", response_model=List[CampaignResponse])
async def get_campaigns(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = Query(None, description="Filter by campaign status"),
    search: Optional[str] = Query(None, description="Search campaigns by name"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> List[CampaignResponse]:
    """Get campaigns for the current user's workspace with filtering."""
    campaign_service = CampaignService(db)
    campaigns = await campaign_service.get_campaigns_by_workspace(
        workspace_id=current_user.workspace_id,
        skip=skip,
        limit=limit,
        status_filter=status,
        search_query=search
    )
    return campaigns


@router.get("/stats", response_model=List[CampaignStatsResponse])
async def get_campaign_stats(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> List[CampaignStatsResponse]:
    """Get campaign statistics for the current user's workspace."""
    campaign_service = CampaignService(db)
    return await campaign_service.get_campaign_stats(
        workspace_id=current_user.workspace_id,
        skip=skip,
        limit=limit
    )


@router.post("/", response_model=CampaignResponse)
async def create_campaign(
    campaign: CampaignCreate,
    current_user: User = Depends(require_permissions({"campaigns:write"})),
    db: AsyncSession = Depends(get_db)
) -> CampaignResponse:
    """Create a new campaign."""
    campaign_service = CampaignService(db)
    return await campaign_service.create_campaign(
        campaign=campaign,
        workspace_id=current_user.workspace_id,
        created_by=current_user.id
    )


@router.get("/{campaign_id}", response_model=CampaignResponse)
async def get_campaign(
    campaign_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> CampaignResponse:
    """Get a specific campaign."""
    campaign_service = CampaignService(db)
    campaign = await campaign_service.get_campaign_by_id(campaign_id)
    
    if not campaign:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Campaign not found"
        )
    
    # Check workspace access
    if campaign.workspace_id != current_user.workspace_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to campaign"
        )
    
    return campaign


@router.put("/{campaign_id}", response_model=CampaignResponse)
async def update_campaign(
    campaign_id: UUID,
    campaign_update: CampaignUpdate,
    current_user: User = Depends(require_permissions({"campaigns:write"})),
    db: AsyncSession = Depends(get_db)
) -> CampaignResponse:
    """Update a campaign."""
    campaign_service = CampaignService(db)
    campaign = await campaign_service.get_campaign_by_id(campaign_id)
    
    if not campaign:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Campaign not found"
        )
    
    # Check workspace access
    if campaign.workspace_id != current_user.workspace_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to campaign"
        )
    
    # Prevent updating active campaigns
    if campaign.status in ["running", "scheduled"] and campaign_update.settings:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot modify settings of active campaign"
        )
    
    return await campaign_service.update_campaign(campaign_id, campaign_update)


@router.delete("/{campaign_id}")
async def delete_campaign(
    campaign_id: UUID,
    current_user: User = Depends(require_permissions({"campaigns:delete"})),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, str]:
    """Delete a campaign."""
    campaign_service = CampaignService(db)
    campaign = await campaign_service.get_campaign_by_id(campaign_id)
    
    if not campaign:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Campaign not found"
        )
    
    # Check workspace access
    if campaign.workspace_id != current_user.workspace_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to campaign"
        )
    
    # Prevent deleting active campaigns
    if campaign.status in ["running", "scheduled"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete active campaign. Pause it first."
        )
    
    await campaign_service.delete_campaign(campaign_id)
    return {"message": "Campaign deleted successfully"}


@router.post("/{campaign_id}/action")
async def execute_campaign_action(
    campaign_id: UUID,
    action_request: CampaignActionRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_permissions({"campaigns:write"})),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, str]:
    """Execute campaign actions: start, pause, resume, stop."""
    campaign_service = CampaignService(db)
    campaign = await campaign_service.get_campaign_by_id(campaign_id)
    
    if not campaign:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Campaign not found"
        )
    
    # Check workspace access
    if campaign.workspace_id != current_user.workspace_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to campaign"
        )
    
    action = action_request.action.lower()
    
    if action == "start":
        if campaign.status != "draft":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only draft campaigns can be started"
            )
        
        # Update campaign status
        await campaign_service.update_campaign_status(campaign_id, "running")
        
        # Queue campaign start task
        if action_request.scheduled_at:
            background_tasks.add_task(
                start_campaign.apply_async,
                (str(campaign_id),),
                eta=action_request.scheduled_at
            )
        else:
            background_tasks.add_task(start_campaign, str(campaign_id))
        
        return {"message": "Campaign started successfully"}
    
    elif action == "pause":
        if campaign.status != "running":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only running campaigns can be paused"
            )
        
        await campaign_service.update_campaign_status(campaign_id, "paused")
        background_tasks.add_task(pause_campaign, str(campaign_id))
        
        return {"message": "Campaign paused successfully"}
    
    elif action == "resume":
        if campaign.status != "paused":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only paused campaigns can be resumed"
            )
        
        await campaign_service.update_campaign_status(campaign_id, "running")
        background_tasks.add_task(start_campaign, str(campaign_id))
        
        return {"message": "Campaign resumed successfully"}
    
    elif action == "stop":
        if campaign.status not in ["running", "paused", "scheduled"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot stop inactive campaign"
            )
        
        await campaign_service.update_campaign_status(campaign_id, "stopped")
        background_tasks.add_task(pause_campaign, str(campaign_id))
        
        return {"message": "Campaign stopped successfully"}
    
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid action. Use: start, pause, resume, or stop"
        )


@router.post("/{campaign_id}/duplicate", response_model=CampaignResponse)
async def duplicate_campaign(
    campaign_id: UUID,
    name: Optional[str] = None,
    current_user: User = Depends(require_permissions({"campaigns:write"})),
    db: AsyncSession = Depends(get_db)
) -> CampaignResponse:
    """Duplicate an existing campaign."""
    campaign_service = CampaignService(db)
    campaign = await campaign_service.get_campaign_by_id(campaign_id)
    
    if not campaign:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Campaign not found"
        )
    
    # Check workspace access
    if campaign.workspace_id != current_user.workspace_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to campaign"
        )
    
    return await campaign_service.duplicate_campaign(
        campaign_id=campaign_id,
        new_name=name or f"{campaign.name} (Copy)",
        created_by=current_user.id
    )


@router.post("/{campaign_id}/preview")
async def preview_campaign_emails(
    campaign_id: UUID,
    preview_request: CampaignPreviewRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Preview emails that will be sent for a campaign."""
    campaign_service = CampaignService(db)
    campaign = await campaign_service.get_campaign_by_id(campaign_id)
    
    if not campaign:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Campaign not found"
        )
    
    # Check workspace access
    if campaign.workspace_id != current_user.workspace_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to campaign"
        )
    
    return await campaign_service.preview_campaign_emails(
        campaign_id=campaign_id,
        lead_ids=preview_request.lead_ids,
        template_id=preview_request.template_id
    )


@router.get("/{campaign_id}/analytics", response_model=CampaignAnalyticsResponse)
async def get_campaign_analytics(
    campaign_id: UUID,
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> CampaignAnalyticsResponse:
    """Get detailed analytics for a campaign."""
    campaign_service = CampaignService(db)
    campaign = await campaign_service.get_campaign_by_id(campaign_id)
    
    if not campaign:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Campaign not found"
        )
    
    # Check workspace access
    if campaign.workspace_id != current_user.workspace_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to campaign"
        )
    
    return await campaign_service.get_campaign_analytics(
        campaign_id=campaign_id,
        start_date=start_date,
        end_date=end_date
    )


@router.get("/{campaign_id}/leads")
async def get_campaign_leads(
    campaign_id: UUID,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = Query(None, description="Filter by lead status"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Get leads associated with a campaign."""
    campaign_service = CampaignService(db)
    campaign = await campaign_service.get_campaign_by_id(campaign_id)
    
    if not campaign:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Campaign not found"
        )
    
    # Check workspace access
    if campaign.workspace_id != current_user.workspace_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to campaign"
        )
    
    return await campaign_service.get_campaign_leads(
        campaign_id=campaign_id,
        skip=skip,
        limit=limit,
        status_filter=status
    )


@router.post("/{campaign_id}/leads")
async def add_leads_to_campaign(
    campaign_id: UUID,
    lead_ids: List[UUID],
    current_user: User = Depends(require_permissions({"campaigns:write"})),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Add leads to a campaign."""
    campaign_service = CampaignService(db)
    campaign = await campaign_service.get_campaign_by_id(campaign_id)
    
    if not campaign:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Campaign not found"
        )
    
    # Check workspace access
    if campaign.workspace_id != current_user.workspace_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to campaign"
        )
    
    # Prevent adding leads to active campaigns
    if campaign.status in ["running"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot add leads to running campaign"
        )
    
    result = await campaign_service.add_leads_to_campaign(
        campaign_id=campaign_id,
        lead_ids=lead_ids,
        workspace_id=current_user.workspace_id
    )
    
    return {
        "message": f"Added {result['added']} leads to campaign",
        "added": result["added"],
        "skipped": result["skipped"],
        "errors": result["errors"]
    }


@router.delete("/{campaign_id}/leads/{lead_id}")
async def remove_lead_from_campaign(
    campaign_id: UUID,
    lead_id: UUID,
    current_user: User = Depends(require_permissions({"campaigns:write"})),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, str]:
    """Remove a lead from a campaign."""
    campaign_service = CampaignService(db)
    campaign = await campaign_service.get_campaign_by_id(campaign_id)
    
    if not campaign:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Campaign not found"
        )
    
    # Check workspace access
    if campaign.workspace_id != current_user.workspace_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to campaign"
        )
    
    await campaign_service.remove_lead_from_campaign(
        campaign_id=campaign_id,
        lead_id=lead_id
    )
    
    return {"message": "Lead removed from campaign successfully"}


@router.get("/{campaign_id}/emails")
async def get_campaign_emails(
    campaign_id: UUID,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = Query(None, description="Filter by email status"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Get emails sent for a campaign."""
    campaign_service = CampaignService(db)
    campaign = await campaign_service.get_campaign_by_id(campaign_id)
    
    if not campaign:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Campaign not found"
        )
    
    # Check workspace access
    if campaign.workspace_id != current_user.workspace_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to campaign"
        )
    
    return await campaign_service.get_campaign_emails(
        campaign_id=campaign_id,
        skip=skip,
        limit=limit,
        status_filter=status
    )


@router.post("/{campaign_id}/test")
async def send_test_email(
    campaign_id: UUID,
    test_email: str,
    lead_id: Optional[UUID] = None,
    current_user: User = Depends(require_permissions({"campaigns:write"})),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, str]:
    """Send a test email for a campaign."""
    campaign_service = CampaignService(db)
    campaign = await campaign_service.get_campaign_by_id(campaign_id)
    
    if not campaign:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Campaign not found"
        )
    
    # Check workspace access
    if campaign.workspace_id != current_user.workspace_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to campaign"
        )
    
    await campaign_service.send_test_email(
        campaign_id=campaign_id,
        test_email=test_email,
        lead_id=lead_id
    )
    
    return {"message": f"Test email sent to {test_email}"}