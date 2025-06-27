"""
API endpoints for email warm-up system.
"""
from typing import List, Optional, Dict
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field, EmailStr
from datetime import datetime, date
from uuid import UUID

from ..core.database import get_db
from ..core.security import get_current_user
from ..models.user import User
from ..models.email_warmup import (
    WarmupStatus, WarmupStrategy, EmailProvider
)
from ..services.warmup_service import WarmupService


router = APIRouter(prefix="/api/warmup", tags=["Email Warmup"])


# Request/Response Models
class CreatePoolRequest(BaseModel):
    """Create warm-up pool request."""
    name: str = Field(..., max_length=255)
    description: Optional[str] = None
    target_size: int = Field(50, ge=10, le=500)
    min_engagement_rate: float = Field(0.3, ge=0.1, le=0.9)
    max_engagement_rate: float = Field(0.7, ge=0.1, le=0.9)
    reply_probability: float = Field(0.1, ge=0, le=0.5)


class AddAccountRequest(BaseModel):
    """Add account to pool request."""
    email: EmailStr
    display_name: Optional[str] = None
    provider: EmailProvider
    smtp_host: str
    smtp_port: int = 587
    smtp_username: str
    smtp_password: str
    imap_host: str
    imap_port: int = 993


class CreateCampaignRequest(BaseModel):
    """Create warm-up campaign request."""
    name: str = Field(..., max_length=255)
    email_address: EmailStr
    strategy: WarmupStrategy = WarmupStrategy.MODERATE
    target_daily_volume: int = Field(1000, ge=100, le=10000)
    custom_schedule: Optional[Dict] = None


class PoolResponse(BaseModel):
    """Warm-up pool response."""
    id: UUID
    name: str
    description: Optional[str]
    current_size: int
    target_size: int
    min_engagement_rate: float
    max_engagement_rate: float
    reply_probability: float
    is_active: bool
    created_at: datetime


class AccountResponse(BaseModel):
    """Warm-up account response."""
    id: UUID
    email: str
    display_name: str
    provider: EmailProvider
    status: WarmupStatus
    reputation_score: float
    sends_today: int
    max_sends_per_day: int
    total_sent: int
    total_received: int
    last_send_at: Optional[datetime]
    last_error: Optional[str]


class CampaignResponse(BaseModel):
    """Warm-up campaign response."""
    id: UUID
    name: str
    email_address: str
    domain: str
    strategy: WarmupStrategy
    status: WarmupStatus
    day_number: int
    total_days_planned: int
    current_daily_limit: int
    target_daily_volume: int
    average_open_rate: float
    average_click_rate: float
    bounce_rate: float
    spam_rate: float
    spf_valid: Optional[bool]
    dkim_valid: Optional[bool]
    dmarc_valid: Optional[bool]
    started_at: Optional[datetime]
    created_at: datetime


class DailyStatResponse(BaseModel):
    """Daily statistics response."""
    date: date
    day_number: int
    emails_sent: int
    emails_delivered: int
    emails_opened: int
    emails_clicked: int
    emails_replied: int
    delivery_rate: float
    open_rate: float
    click_rate: float
    reply_rate: float
    spam_rate: float
    is_healthy: bool
    health_issues: Optional[List[str]]


@router.post("/pools", response_model=PoolResponse)
async def create_pool(
    request: CreatePoolRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new warm-up pool."""
    service = WarmupService(db)
    
    # Validate engagement rates
    if request.min_engagement_rate >= request.max_engagement_rate:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Min engagement rate must be less than max engagement rate"
        )
    
    pool = await service.create_warmup_pool(
        workspace_id=current_user.workspace_id,
        name=request.name,
        description=request.description,
        target_size=request.target_size,
        min_engagement_rate=request.min_engagement_rate,
        max_engagement_rate=request.max_engagement_rate,
        reply_probability=request.reply_probability
    )
    
    return PoolResponse(
        id=pool.id,
        name=pool.name,
        description=pool.description,
        current_size=pool.current_size,
        target_size=pool.target_size,
        min_engagement_rate=pool.min_engagement_rate,
        max_engagement_rate=pool.max_engagement_rate,
        reply_probability=pool.reply_probability,
        is_active=pool.is_active,
        created_at=pool.created_at
    )


@router.get("/pools", response_model=List[PoolResponse])
async def list_pools(
    active_only: bool = True,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List warm-up pools for workspace."""
    service = WarmupService(db)
    
    pools = await service.get_workspace_pools(
        workspace_id=current_user.workspace_id,
        active_only=active_only
    )
    
    return [
        PoolResponse(
            id=p.id,
            name=p.name,
            description=p.description,
            current_size=p.current_size,
            target_size=p.target_size,
            min_engagement_rate=p.min_engagement_rate,
            max_engagement_rate=p.max_engagement_rate,
            reply_probability=p.reply_probability,
            is_active=p.is_active,
            created_at=p.created_at
        )
        for p in pools
    ]


@router.post("/pools/{pool_id}/accounts", response_model=AccountResponse)
async def add_account_to_pool(
    pool_id: UUID,
    request: AddAccountRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Add an email account to a warm-up pool."""
    service = WarmupService(db)
    
    # Verify pool belongs to workspace
    from ..models.email_warmup import WarmupPool
    pool = await db.get(WarmupPool, str(pool_id))
    
    if not pool or pool.workspace_id != current_user.workspace_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pool not found"
        )
    
    # Check if pool is full
    if pool.current_size >= pool.target_size:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Pool has reached target size"
        )
    
    try:
        account = await service.add_account_to_pool(
            pool_id=str(pool_id),
            email=request.email,
            display_name=request.display_name,
            provider=request.provider,
            smtp_config={
                'host': request.smtp_host,
                'port': request.smtp_port,
                'username': request.smtp_username,
                'password': request.smtp_password
            },
            imap_config={
                'host': request.imap_host,
                'port': request.imap_port
            }
        )
        
        return AccountResponse(
            id=account.id,
            email=account.email,
            display_name=account.display_name,
            provider=account.provider,
            status=account.status,
            reputation_score=account.reputation_score,
            sends_today=account.sends_today,
            max_sends_per_day=account.max_sends_per_day,
            total_sent=account.total_sent,
            total_received=account.total_received,
            last_send_at=account.last_send_at,
            last_error=account.last_error
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to add account: {str(e)}"
        )


@router.get("/pools/{pool_id}/accounts", response_model=List[AccountResponse])
async def get_pool_accounts(
    pool_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get accounts in a warm-up pool."""
    from sqlalchemy import select
    from ..models.email_warmup import WarmupPool, WarmupAccount
    
    # Verify pool access
    pool = await db.get(WarmupPool, str(pool_id))
    if not pool or pool.workspace_id != current_user.workspace_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pool not found"
        )
    
    # Get accounts
    result = await db.execute(
        select(WarmupAccount)
        .where(WarmupAccount.pool_id == str(pool_id))
        .order_by(WarmupAccount.created_at)
    )
    accounts = result.scalars().all()
    
    return [
        AccountResponse(
            id=a.id,
            email=a.email,
            display_name=a.display_name,
            provider=a.provider,
            status=a.status,
            reputation_score=a.reputation_score,
            sends_today=a.sends_today,
            max_sends_per_day=a.max_sends_per_day,
            total_sent=a.total_sent,
            total_received=a.total_received,
            last_send_at=a.last_send_at,
            last_error=a.last_error
        )
        for a in accounts
    ]


@router.post("/campaigns", response_model=CampaignResponse)
async def create_campaign(
    request: CreateCampaignRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new warm-up campaign."""
    service = WarmupService(db)
    
    try:
        campaign = await service.create_warmup_campaign(
            workspace_id=current_user.workspace_id,
            name=request.name,
            email_address=request.email_address,
            strategy=request.strategy,
            target_daily_volume=request.target_daily_volume,
            custom_schedule=request.custom_schedule
        )
        
        return CampaignResponse(
            id=campaign.id,
            name=campaign.name,
            email_address=campaign.email_address,
            domain=campaign.domain,
            strategy=campaign.strategy,
            status=campaign.status,
            day_number=campaign.day_number,
            total_days_planned=campaign.total_days_planned,
            current_daily_limit=campaign.current_daily_limit,
            target_daily_volume=campaign.target_daily_volume,
            average_open_rate=campaign.average_open_rate,
            average_click_rate=campaign.average_click_rate,
            bounce_rate=campaign.bounce_rate,
            spam_rate=campaign.spam_rate,
            spf_valid=campaign.spf_valid,
            dkim_valid=campaign.dkim_valid,
            dmarc_valid=campaign.dmarc_valid,
            started_at=campaign.started_at,
            created_at=campaign.created_at
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to create campaign: {str(e)}"
        )


@router.get("/campaigns", response_model=List[CampaignResponse])
async def list_campaigns(
    status: Optional[WarmupStatus] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List warm-up campaigns for workspace."""
    service = WarmupService(db)
    
    campaigns = await service.get_workspace_campaigns(
        workspace_id=current_user.workspace_id,
        status=status
    )
    
    return [
        CampaignResponse(
            id=c.id,
            name=c.name,
            email_address=c.email_address,
            domain=c.domain,
            strategy=c.strategy,
            status=c.status,
            day_number=c.day_number,
            total_days_planned=c.total_days_planned,
            current_daily_limit=c.current_daily_limit,
            target_daily_volume=c.target_daily_volume,
            average_open_rate=c.average_open_rate,
            average_click_rate=c.average_click_rate,
            bounce_rate=c.bounce_rate,
            spam_rate=c.spam_rate,
            spf_valid=c.spf_valid,
            dkim_valid=c.dkim_valid,
            dmarc_valid=c.dmarc_valid,
            started_at=c.started_at,
            created_at=c.created_at
        )
        for c in campaigns
    ]


@router.post("/campaigns/{campaign_id}/start")
async def start_campaign(
    campaign_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Start a warm-up campaign."""
    service = WarmupService(db)
    
    # Verify campaign access
    from ..models.email_warmup import WarmupCampaign
    campaign = await db.get(WarmupCampaign, str(campaign_id))
    
    if not campaign or campaign.workspace_id != current_user.workspace_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Campaign not found"
        )
    
    try:
        success = await service.start_campaign(str(campaign_id))
        
        return {
            "message": "Campaign started successfully" if success else "Failed to start campaign",
            "campaign_id": str(campaign_id),
            "status": campaign.status.value
        }
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/campaigns/{campaign_id}/pause")
async def pause_campaign(
    campaign_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Pause a warm-up campaign."""
    from ..models.email_warmup import WarmupCampaign
    
    campaign = await db.get(WarmupCampaign, str(campaign_id))
    
    if not campaign or campaign.workspace_id != current_user.workspace_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Campaign not found"
        )
    
    if campaign.status != WarmupStatus.WARMING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Campaign must be active to pause"
        )
    
    campaign.status = WarmupStatus.PAUSED
    await db.commit()
    
    return {"message": "Campaign paused successfully"}


@router.post("/campaigns/{campaign_id}/execute")
async def execute_daily_warmup(
    campaign_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Manually execute daily warm-up for a campaign."""
    service = WarmupService(db)
    
    # Verify campaign access
    from ..models.email_warmup import WarmupCampaign
    campaign = await db.get(WarmupCampaign, str(campaign_id))
    
    if not campaign or campaign.workspace_id != current_user.workspace_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Campaign not found"
        )
    
    result = await service.execute_daily_warmup(str(campaign_id))
    
    return result


@router.get("/campaigns/{campaign_id}/stats", response_model=List[DailyStatResponse])
async def get_campaign_stats(
    campaign_id: UUID,
    days: int = Query(30, ge=1, le=90),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get daily statistics for a campaign."""
    from sqlalchemy import select
    from ..models.email_warmup import WarmupCampaign, WarmupDailyStat
    
    # Verify campaign access
    campaign = await db.get(WarmupCampaign, str(campaign_id))
    if not campaign or campaign.workspace_id != current_user.workspace_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Campaign not found"
        )
    
    # Get stats
    result = await db.execute(
        select(WarmupDailyStat)
        .where(WarmupDailyStat.campaign_id == str(campaign_id))
        .order_by(WarmupDailyStat.date.desc())
        .limit(days)
    )
    stats = result.scalars().all()
    
    return [
        DailyStatResponse(
            date=s.date.date(),
            day_number=s.day_number,
            emails_sent=s.emails_sent,
            emails_delivered=s.emails_delivered,
            emails_opened=s.emails_opened,
            emails_clicked=s.emails_clicked,
            emails_replied=s.emails_replied,
            delivery_rate=s.delivery_rate,
            open_rate=s.open_rate,
            click_rate=s.click_rate,
            reply_rate=s.reply_rate,
            spam_rate=s.spam_rate,
            is_healthy=s.is_healthy,
            health_issues=s.health_issues
        )
        for s in reversed(stats)  # Show oldest first
    ]


@router.get("/campaigns/{campaign_id}/schedule")
async def get_campaign_schedule(
    campaign_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get ramp-up schedule for a campaign."""
    from ..models.email_warmup import WarmupCampaign
    
    campaign = await db.get(WarmupCampaign, str(campaign_id))
    
    if not campaign or campaign.workspace_id != current_user.workspace_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Campaign not found"
        )
    
    return {
        "campaign_id": str(campaign_id),
        "strategy": campaign.strategy.value,
        "current_day": campaign.day_number,
        "total_days": campaign.total_days_planned,
        "schedule": campaign.rampup_schedule
    }


@router.post("/simulate-engagement")
async def simulate_engagement(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Simulate engagement for pending warm-up emails."""
    if not current_user.is_superadmin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    
    service = WarmupService(db)
    result = await service.simulate_engagement_batch()
    
    return {
        "message": "Engagement simulation completed",
        **result
    }


@router.get("/analytics/overview")
async def get_warmup_analytics(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get warm-up system analytics overview."""
    from sqlalchemy import select, func
    from ..models.email_warmup import WarmupPool, WarmupAccount, WarmupCampaign, WarmupEmail
    
    # Get pool statistics
    pool_result = await db.execute(
        select(
            func.count(WarmupPool.id).label('total_pools'),
            func.sum(WarmupPool.current_size).label('total_accounts')
        )
        .where(WarmupPool.workspace_id == current_user.workspace_id)
    )
    pool_stats = pool_result.first()
    
    # Get campaign statistics
    campaign_result = await db.execute(
        select(
            func.count(WarmupCampaign.id).label('total_campaigns'),
            func.count(
                func.distinct(
                    func.case(
                        (WarmupCampaign.status == WarmupStatus.WARMING, WarmupCampaign.id)
                    )
                )
            ).label('active_campaigns')
        )
        .where(WarmupCampaign.workspace_id == current_user.workspace_id)
    )
    campaign_stats = campaign_result.first()
    
    # Get email statistics (last 7 days)
    since = datetime.utcnow() - timedelta(days=7)
    email_result = await db.execute(
        select(
            func.count(WarmupEmail.id).label('total_sent'),
            func.sum(func.cast(WarmupEmail.is_opened, Integer)).label('total_opened'),
            func.sum(func.cast(WarmupEmail.is_replied, Integer)).label('total_replied')
        )
        .join(WarmupCampaign)
        .where(
            and_(
                WarmupCampaign.workspace_id == current_user.workspace_id,
                WarmupEmail.sent_at >= since
            )
        )
    )
    email_stats = email_result.first()
    
    return {
        "pools": {
            "total": pool_stats.total_pools or 0,
            "total_accounts": pool_stats.total_accounts or 0
        },
        "campaigns": {
            "total": campaign_stats.total_campaigns or 0,
            "active": campaign_stats.active_campaigns or 0
        },
        "emails_last_7_days": {
            "sent": email_stats.total_sent or 0,
            "opened": email_stats.total_opened or 0,
            "replied": email_stats.total_replied or 0,
            "open_rate": (email_stats.total_opened or 0) / (email_stats.total_sent or 1),
            "reply_rate": (email_stats.total_replied or 0) / (email_stats.total_sent or 1)
        }
    }