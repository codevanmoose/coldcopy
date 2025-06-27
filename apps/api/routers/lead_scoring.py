"""
API endpoints for lead scoring and segmentation.
"""
from typing import List, Optional, Dict
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field
from datetime import datetime
from uuid import UUID

from ..core.database import get_db
from ..core.security import get_current_user
from ..models.user import User
from ..models.lead_scoring import (
    ScoringModel, SegmentType, SegmentStatus, RuleOperator
)
from ..services.lead_scoring_service import LeadScoringService


router = APIRouter(prefix="/api/lead-scoring", tags=["Lead Scoring"])


# Request/Response Models
class ScoringRuleUpdate(BaseModel):
    """Update scoring rules."""
    name: Optional[str] = None
    email_open_weight: Optional[float] = Field(None, ge=0, le=100)
    email_click_weight: Optional[float] = Field(None, ge=0, le=100)
    email_reply_weight: Optional[float] = Field(None, ge=0, le=100)
    website_visit_weight: Optional[float] = Field(None, ge=0, le=100)
    form_submission_weight: Optional[float] = Field(None, ge=0, le=100)
    enable_time_decay: Optional[bool] = None
    decay_half_life_days: Optional[int] = Field(None, ge=1, le=365)
    grade_thresholds: Optional[Dict[str, int]] = None


class LeadScoreResponse(BaseModel):
    """Lead score response."""
    lead_id: UUID
    engagement_score: int
    quality_score: int
    intent_score: int
    total_score: int
    grade: str
    temperature: str
    scoring_factors: Dict
    last_calculated_at: datetime
    score_history: List[Dict] = []


class SegmentRuleCreate(BaseModel):
    """Create a segment rule."""
    field_name: str
    field_type: str = "string"
    operator: RuleOperator
    value: Any
    group_id: Optional[str] = None
    group_operator: Optional[str] = "and"


class SegmentCreate(BaseModel):
    """Create a new segment."""
    name: str = Field(..., max_length=255)
    description: Optional[str] = None
    type: SegmentType = SegmentType.DYNAMIC
    color: Optional[str] = Field(None, regex="^#[0-9A-Fa-f]{6}$")
    icon: Optional[str] = None
    rules: Optional[List[Dict]] = None
    rule_match_type: str = Field("all", regex="^(all|any)$")
    auto_add_to_campaigns: bool = False
    auto_remove_inactive: bool = False
    inactive_days_threshold: int = Field(90, ge=1, le=365)


class SegmentUpdate(BaseModel):
    """Update segment configuration."""
    name: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    status: Optional[SegmentStatus] = None
    color: Optional[str] = Field(None, regex="^#[0-9A-Fa-f]{6}$")
    icon: Optional[str] = None
    rules: Optional[List[Dict]] = None
    rule_match_type: Optional[str] = Field(None, regex="^(all|any)$")
    auto_add_to_campaigns: Optional[bool] = None
    auto_remove_inactive: Optional[bool] = None
    inactive_days_threshold: Optional[int] = Field(None, ge=1, le=365)


class SegmentResponse(BaseModel):
    """Segment response."""
    id: UUID
    name: str
    description: Optional[str]
    type: SegmentType
    status: SegmentStatus
    color: Optional[str]
    icon: Optional[str]
    member_count: int
    rules: List[Dict]
    rule_match_type: str
    auto_add_to_campaigns: bool
    created_at: datetime
    last_calculated_at: Optional[datetime]


class SegmentMembershipUpdate(BaseModel):
    """Update segment membership."""
    lead_ids: List[UUID]
    action: str = Field(..., regex="^(add|remove)$")


class BulkScoreCalculation(BaseModel):
    """Bulk score calculation request."""
    lead_ids: List[UUID]
    trigger_event: Optional[str] = None


@router.post("/scores/calculate/{lead_id}", response_model=LeadScoreResponse)
async def calculate_lead_score(
    lead_id: UUID,
    trigger_event: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Calculate or recalculate a lead's score."""
    service = LeadScoringService(db)
    
    try:
        lead_score = await service.calculate_lead_score(
            str(lead_id),
            current_user.workspace_id,
            trigger_event
        )
        
        # Get score history
        history = [
            {
                'date': h.created_at.isoformat(),
                'previous_score': h.previous_total_score,
                'new_score': h.new_total_score,
                'change': h.score_change,
                'trigger': h.trigger_event
            }
            for h in lead_score.history[-10:]  # Last 10 changes
        ]
        
        return LeadScoreResponse(
            lead_id=lead_score.lead_id,
            engagement_score=lead_score.engagement_score,
            quality_score=lead_score.quality_score,
            intent_score=lead_score.intent_score,
            total_score=lead_score.total_score,
            grade=lead_score.grade,
            temperature=lead_score.temperature,
            scoring_factors=lead_score.scoring_factors or {},
            last_calculated_at=lead_score.last_calculated_at,
            score_history=history
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.post("/scores/bulk-calculate")
async def bulk_calculate_scores(
    request: BulkScoreCalculation,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Calculate scores for multiple leads."""
    service = LeadScoringService(db)
    
    results = []
    errors = []
    
    for lead_id in request.lead_ids:
        try:
            lead_score = await service.calculate_lead_score(
                str(lead_id),
                current_user.workspace_id,
                request.trigger_event
            )
            results.append({
                'lead_id': str(lead_id),
                'total_score': lead_score.total_score,
                'grade': lead_score.grade
            })
        except Exception as e:
            errors.append({
                'lead_id': str(lead_id),
                'error': str(e)
            })
    
    return {
        'processed': len(results),
        'failed': len(errors),
        'results': results,
        'errors': errors
    }


@router.get("/scores/{lead_id}", response_model=LeadScoreResponse)
async def get_lead_score(
    lead_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get current lead score."""
    # Query lead score from database
    from sqlalchemy import select
    from ..models.lead_scoring import LeadScore, LeadScoreHistory
    
    result = await db.execute(
        select(LeadScore)
        .where(LeadScore.lead_id == str(lead_id))
        .where(LeadScore.workspace_id == current_user.workspace_id)
    )
    lead_score = result.scalar_one_or_none()
    
    if not lead_score:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead score not found"
        )
    
    # Get history
    history_result = await db.execute(
        select(LeadScoreHistory)
        .where(LeadScoreHistory.lead_score_id == lead_score.id)
        .order_by(LeadScoreHistory.created_at.desc())
        .limit(10)
    )
    history = history_result.scalars().all()
    
    return LeadScoreResponse(
        lead_id=lead_score.lead_id,
        engagement_score=lead_score.engagement_score,
        quality_score=lead_score.quality_score,
        intent_score=lead_score.intent_score,
        total_score=lead_score.total_score,
        grade=lead_score.grade,
        temperature=lead_score.temperature,
        scoring_factors=lead_score.scoring_factors or {},
        last_calculated_at=lead_score.last_calculated_at,
        score_history=[
            {
                'date': h.created_at.isoformat(),
                'previous_score': h.previous_total_score,
                'new_score': h.new_total_score,
                'change': h.score_change,
                'trigger': h.trigger_event
            }
            for h in history
        ]
    )


@router.patch("/rules")
async def update_scoring_rules(
    updates: ScoringRuleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update workspace scoring rules."""
    from sqlalchemy import select, and_
    from ..models.lead_scoring import ScoringRule
    
    # Get current rules
    result = await db.execute(
        select(ScoringRule).where(
            and_(
                ScoringRule.workspace_id == current_user.workspace_id,
                ScoringRule.is_active == True
            )
        )
    )
    scoring_rule = result.scalar_one_or_none()
    
    if not scoring_rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scoring rules not found"
        )
    
    # Update rules
    update_data = updates.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(scoring_rule, field, value)
    
    scoring_rule.updated_at = datetime.utcnow()
    await db.commit()
    
    return {"message": "Scoring rules updated successfully"}


@router.post("/segments", response_model=SegmentResponse)
async def create_segment(
    segment_data: SegmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new segment."""
    service = LeadScoringService(db)
    
    segment = await service.create_segment(
        workspace_id=current_user.workspace_id,
        name=segment_data.name,
        type=segment_data.type,
        rules=segment_data.rules,
        description=segment_data.description,
        color=segment_data.color,
        icon=segment_data.icon,
        rule_match_type=segment_data.rule_match_type,
        auto_add_to_campaigns=segment_data.auto_add_to_campaigns,
        auto_remove_inactive=segment_data.auto_remove_inactive,
        inactive_days_threshold=segment_data.inactive_days_threshold
    )
    
    return SegmentResponse(
        id=segment.id,
        name=segment.name,
        description=segment.description,
        type=segment.type,
        status=segment.status,
        color=segment.color,
        icon=segment.icon,
        member_count=segment.member_count,
        rules=segment.rules or [],
        rule_match_type=segment.rule_match_type,
        auto_add_to_campaigns=segment.auto_add_to_campaigns,
        created_at=segment.created_at,
        last_calculated_at=segment.last_calculated_at
    )


@router.get("/segments", response_model=List[SegmentResponse])
async def list_segments(
    status: Optional[SegmentStatus] = None,
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List workspace segments."""
    service = LeadScoringService(db)
    
    segments = await service.get_workspace_segments(
        workspace_id=current_user.workspace_id,
        status=status,
        limit=limit
    )
    
    return [
        SegmentResponse(
            id=s.id,
            name=s.name,
            description=s.description,
            type=s.type,
            status=s.status,
            color=s.color,
            icon=s.icon,
            member_count=s.member_count,
            rules=s.rules or [],
            rule_match_type=s.rule_match_type,
            auto_add_to_campaigns=s.auto_add_to_campaigns,
            created_at=s.created_at,
            last_calculated_at=s.last_calculated_at
        )
        for s in segments
    ]


@router.get("/segments/{segment_id}", response_model=SegmentResponse)
async def get_segment(
    segment_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get segment details."""
    from ..models.lead_scoring import Segment
    
    segment = await db.get(Segment, str(segment_id))
    
    if not segment or segment.workspace_id != current_user.workspace_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Segment not found"
        )
    
    return SegmentResponse(
        id=segment.id,
        name=segment.name,
        description=segment.description,
        type=segment.type,
        status=segment.status,
        color=segment.color,
        icon=segment.icon,
        member_count=segment.member_count,
        rules=segment.rules or [],
        rule_match_type=segment.rule_match_type,
        auto_add_to_campaigns=segment.auto_add_to_campaigns,
        created_at=segment.created_at,
        last_calculated_at=segment.last_calculated_at
    )


@router.patch("/segments/{segment_id}", response_model=SegmentResponse)
async def update_segment(
    segment_id: UUID,
    updates: SegmentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update segment configuration."""
    service = LeadScoringService(db)
    
    try:
        segment = await service.update_segment(
            str(segment_id),
            **updates.dict(exclude_unset=True)
        )
        
        return SegmentResponse(
            id=segment.id,
            name=segment.name,
            description=segment.description,
            type=segment.type,
            status=segment.status,
            color=segment.color,
            icon=segment.icon,
            member_count=segment.member_count,
            rules=segment.rules or [],
            rule_match_type=segment.rule_match_type,
            auto_add_to_campaigns=segment.auto_add_to_campaigns,
            created_at=segment.created_at,
            last_calculated_at=segment.last_calculated_at
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.post("/segments/{segment_id}/members")
async def update_segment_membership(
    segment_id: UUID,
    request: SegmentMembershipUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Add or remove leads from a segment."""
    service = LeadScoringService(db)
    
    lead_ids = [str(lid) for lid in request.lead_ids]
    
    if request.action == "add":
        count = await service.add_to_segment(
            str(segment_id),
            lead_ids,
            added_by="manual"
        )
        return {"message": f"Added {count} leads to segment"}
    else:
        count = await service.remove_from_segment(
            str(segment_id),
            lead_ids
        )
        return {"message": f"Removed {count} leads from segment"}


@router.get("/segments/{segment_id}/members")
async def get_segment_members(
    segment_id: UUID,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get members of a segment."""
    from sqlalchemy import select
    from ..models.lead_scoring import SegmentMember
    from ..models.lead import Lead
    
    # Get segment members with lead data
    result = await db.execute(
        select(Lead, SegmentMember)
        .join(SegmentMember, SegmentMember.lead_id == Lead.id)
        .where(SegmentMember.segment_id == str(segment_id))
        .limit(limit)
        .offset(offset)
    )
    
    members = []
    for lead, membership in result:
        if lead.workspace_id == current_user.workspace_id:
            members.append({
                'lead_id': lead.id,
                'email': lead.email,
                'first_name': lead.first_name,
                'last_name': lead.last_name,
                'company': lead.company,
                'added_at': membership.added_at.isoformat(),
                'added_by': membership.added_by,
                'match_score': membership.match_score
            })
    
    return {
        'members': members,
        'total': len(members),
        'limit': limit,
        'offset': offset
    }


@router.get("/leads/{lead_id}/segments", response_model=List[SegmentResponse])
async def get_lead_segments(
    lead_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all segments a lead belongs to."""
    service = LeadScoringService(db)
    
    segments = await service.get_lead_segments(str(lead_id))
    
    # Filter to workspace segments only
    workspace_segments = [s for s in segments if s.workspace_id == current_user.workspace_id]
    
    return [
        SegmentResponse(
            id=s.id,
            name=s.name,
            description=s.description,
            type=s.type,
            status=s.status,
            color=s.color,
            icon=s.icon,
            member_count=s.member_count,
            rules=s.rules or [],
            rule_match_type=s.rule_match_type,
            auto_add_to_campaigns=s.auto_add_to_campaigns,
            created_at=s.created_at,
            last_calculated_at=s.last_calculated_at
        )
        for s in workspace_segments
    ]


@router.post("/segments/{segment_id}/recalculate")
async def recalculate_segment(
    segment_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Recalculate dynamic segment membership."""
    from ..models.lead_scoring import Segment, SegmentType
    
    segment = await db.get(Segment, str(segment_id))
    
    if not segment or segment.workspace_id != current_user.workspace_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Segment not found"
        )
    
    if segment.type != SegmentType.DYNAMIC:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only dynamic segments can be recalculated"
        )
    
    service = LeadScoringService(db)
    member_count = await service._calculate_segment_membership(segment)
    
    return {
        "message": "Segment recalculated successfully",
        "member_count": member_count
    }


@router.get("/analytics/score-distribution")
async def get_score_distribution(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get lead score distribution for workspace."""
    from sqlalchemy import select, func, case
    from ..models.lead_scoring import LeadScore
    
    # Get score distribution
    result = await db.execute(
        select(
            case(
                (LeadScore.total_score >= 90, "90-100"),
                (LeadScore.total_score >= 80, "80-89"),
                (LeadScore.total_score >= 70, "70-79"),
                (LeadScore.total_score >= 60, "60-69"),
                (LeadScore.total_score >= 50, "50-59"),
                (LeadScore.total_score >= 40, "40-49"),
                (LeadScore.total_score >= 30, "30-39"),
                (LeadScore.total_score >= 20, "20-29"),
                (LeadScore.total_score >= 10, "10-19"),
                else_="0-9"
            ).label("score_range"),
            func.count(LeadScore.id).label("count")
        )
        .where(LeadScore.workspace_id == current_user.workspace_id)
        .group_by("score_range")
        .order_by("score_range")
    )
    
    distribution = [{"range": row[0], "count": row[1]} for row in result]
    
    # Get grade distribution
    grade_result = await db.execute(
        select(
            LeadScore.grade,
            func.count(LeadScore.id).label("count")
        )
        .where(LeadScore.workspace_id == current_user.workspace_id)
        .group_by(LeadScore.grade)
        .order_by(LeadScore.grade)
    )
    
    grade_distribution = [{"grade": row[0], "count": row[1]} for row in grade_result]
    
    # Get temperature distribution
    temp_result = await db.execute(
        select(
            LeadScore.temperature,
            func.count(LeadScore.id).label("count")
        )
        .where(LeadScore.workspace_id == current_user.workspace_id)
        .group_by(LeadScore.temperature)
    )
    
    temperature_distribution = [{"temperature": row[0], "count": row[1]} for row in temp_result]
    
    return {
        "score_distribution": distribution,
        "grade_distribution": grade_distribution,
        "temperature_distribution": temperature_distribution
    }