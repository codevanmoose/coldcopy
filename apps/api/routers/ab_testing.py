"""
API endpoints for A/B testing functionality.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field
from datetime import datetime
from uuid import UUID

from ..core.database import get_db
from ..core.security import get_current_user
from ..models.user import User
from ..models.ab_testing import TestType, TestStatus, WinnerSelectionMethod
from ..services.ab_testing_service import ABTestingService


router = APIRouter(prefix="/api/ab-testing", tags=["A/B Testing"])


# Request/Response Models
class ABTestVariantCreate(BaseModel):
    """Variant creation model."""
    name: str = Field(..., max_length=255)
    is_control: bool = False
    traffic_percentage: Optional[float] = None
    subject_line: Optional[str] = Field(None, max_length=255)
    preview_text: Optional[str] = Field(None, max_length=255)
    from_name: Optional[str] = Field(None, max_length=255)
    from_email: Optional[str] = Field(None, max_length=255)
    email_content: Optional[dict] = None
    send_time: Optional[datetime] = None


class ABTestCreate(BaseModel):
    """A/B test creation model."""
    campaign_id: UUID
    name: str = Field(..., max_length=255)
    description: Optional[str] = None
    test_type: TestType
    variants: List[ABTestVariantCreate] = Field(..., min_items=2, max_items=5)
    test_percentage: int = Field(20, ge=10, le=50)
    confidence_threshold: float = Field(95.0, ge=80.0, le=99.9)
    test_duration_hours: int = Field(24, ge=1, le=168)  # Max 1 week
    winner_selection_method: WinnerSelectionMethod = WinnerSelectionMethod.OPEN_RATE
    minimum_sample_size: int = Field(100, ge=50, le=10000)


class ABTestResponse(BaseModel):
    """A/B test response model."""
    id: UUID
    campaign_id: UUID
    name: str
    description: Optional[str]
    test_type: TestType
    status: TestStatus
    test_percentage: int
    confidence_threshold: float
    test_duration_hours: int
    winner_selection_method: WinnerSelectionMethod
    winner_variant_id: Optional[UUID]
    created_at: datetime
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    variants: List[dict]


class VariantAssignment(BaseModel):
    """Variant assignment response."""
    variant_id: UUID
    variant_name: str
    subject_line: Optional[str]
    from_name: Optional[str]
    email_content: Optional[dict]


@router.post("/tests", response_model=ABTestResponse)
async def create_ab_test(
    test_data: ABTestCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new A/B test for a campaign."""
    service = ABTestingService(db)
    
    # Validate total traffic percentage
    total_percentage = sum(v.traffic_percentage or (100 / len(test_data.variants)) 
                          for v in test_data.variants)
    if abs(total_percentage - 100) > 0.01:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Variant traffic percentages must sum to 100%"
        )
    
    # Create test
    ab_test = await service.create_ab_test(
        workspace_id=current_user.workspace_id,
        campaign_id=str(test_data.campaign_id),
        name=test_data.name,
        test_type=test_data.test_type,
        variants_data=[v.dict() for v in test_data.variants],
        test_percentage=test_data.test_percentage,
        confidence_threshold=test_data.confidence_threshold,
        test_duration_hours=test_data.test_duration_hours,
        winner_selection_method=test_data.winner_selection_method
    )
    
    return ABTestResponse(
        id=ab_test.id,
        campaign_id=ab_test.campaign_id,
        name=ab_test.name,
        description=ab_test.description,
        test_type=ab_test.test_type,
        status=ab_test.status,
        test_percentage=ab_test.test_percentage,
        confidence_threshold=ab_test.confidence_threshold,
        test_duration_hours=ab_test.test_duration_hours,
        winner_selection_method=ab_test.winner_selection_method,
        winner_variant_id=ab_test.winner_variant_id,
        created_at=ab_test.created_at,
        started_at=ab_test.started_at,
        completed_at=ab_test.completed_at,
        variants=[{
            'id': str(v.id),
            'name': v.name,
            'is_control': v.is_control,
            'traffic_percentage': v.traffic_percentage
        } for v in ab_test.variants]
    )


@router.get("/tests", response_model=List[ABTestResponse])
async def list_ab_tests(
    status: Optional[TestStatus] = None,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List A/B tests for the workspace."""
    service = ABTestingService(db)
    
    tests = await service.get_workspace_tests(
        workspace_id=current_user.workspace_id,
        status=status,
        limit=limit
    )
    
    return [
        ABTestResponse(
            id=test.id,
            campaign_id=test.campaign_id,
            name=test.name,
            description=test.description,
            test_type=test.test_type,
            status=test.status,
            test_percentage=test.test_percentage,
            confidence_threshold=test.confidence_threshold,
            test_duration_hours=test.test_duration_hours,
            winner_selection_method=test.winner_selection_method,
            winner_variant_id=test.winner_variant_id,
            created_at=test.created_at,
            started_at=test.started_at,
            completed_at=test.completed_at,
            variants=[{
                'id': str(v.id),
                'name': v.name,
                'is_control': v.is_control,
                'traffic_percentage': v.traffic_percentage,
                'metrics': {
                    'open_rate': v.open_rate,
                    'click_rate': v.click_rate,
                    'reply_rate': v.reply_rate,
                    'recipients': v.recipients_count
                }
            } for v in test.variants]
        )
        for test in tests
    ]


@router.post("/tests/{test_id}/start")
async def start_ab_test(
    test_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Start an A/B test."""
    service = ABTestingService(db)
    
    try:
        ab_test = await service.start_ab_test(str(test_id))
        return {"message": "A/B test started successfully", "test_id": str(ab_test.id)}
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/tests/{test_id}/assign", response_model=VariantAssignment)
async def assign_variant(
    test_id: UUID,
    lead_id: UUID,
    deterministic: bool = True,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Assign a lead to a variant."""
    service = ABTestingService(db)
    
    try:
        variant = await service.assign_variant(
            test_id=str(test_id),
            lead_id=str(lead_id),
            deterministic=deterministic
        )
        
        return VariantAssignment(
            variant_id=variant.id,
            variant_name=variant.name,
            subject_line=variant.subject_line,
            from_name=variant.from_name,
            email_content=variant.email_content
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/tests/{test_id}/check-completion")
async def check_test_completion(
    test_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Check if test should be completed and analyze results."""
    service = ABTestingService(db)
    
    completed = await service.check_test_completion(str(test_id))
    
    return {
        "test_id": str(test_id),
        "completed": completed,
        "message": "Test completed and winner selected" if completed else "Test still running"
    }


@router.get("/tests/{test_id}/results")
async def get_test_results(
    test_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get comprehensive test results."""
    service = ABTestingService(db)
    
    results = await service.get_test_results(str(test_id))
    
    if not results:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="A/B test not found"
        )
    
    return results


@router.post("/variants/{variant_id}/event")
async def update_variant_metrics(
    variant_id: UUID,
    event_type: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update variant metrics based on email events."""
    service = ABTestingService(db)
    
    await service.update_variant_metrics(
        variant_id=str(variant_id),
        email_event={'event_type': event_type}
    )
    
    return {"message": "Variant metrics updated"}


@router.get("/campaigns/{campaign_id}/tests", response_model=List[ABTestResponse])
async def get_campaign_tests(
    campaign_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all A/B tests for a specific campaign."""
    service = ABTestingService(db)
    
    # Get tests and filter by campaign
    tests = await service.get_workspace_tests(
        workspace_id=current_user.workspace_id,
        limit=100
    )
    
    campaign_tests = [t for t in tests if str(t.campaign_id) == str(campaign_id)]
    
    return [
        ABTestResponse(
            id=test.id,
            campaign_id=test.campaign_id,
            name=test.name,
            description=test.description,
            test_type=test.test_type,
            status=test.status,
            test_percentage=test.test_percentage,
            confidence_threshold=test.confidence_threshold,
            test_duration_hours=test.test_duration_hours,
            winner_selection_method=test.winner_selection_method,
            winner_variant_id=test.winner_variant_id,
            created_at=test.created_at,
            started_at=test.started_at,
            completed_at=test.completed_at,
            variants=[{
                'id': str(v.id),
                'name': v.name,
                'is_control': v.is_control,
                'traffic_percentage': v.traffic_percentage,
                'metrics': {
                    'open_rate': v.open_rate,
                    'click_rate': v.click_rate,
                    'reply_rate': v.reply_rate,
                    'recipients': v.recipients_count
                }
            } for v in test.variants]
        )
        for test in campaign_tests
    ]