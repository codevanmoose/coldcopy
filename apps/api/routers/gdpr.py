"""
GDPR compliance endpoints.
"""
from typing import List, Dict, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import get_current_active_user
from models.user import User
from models.gdpr import (
    ConsentRequest,
    ConsentResponse,
    DataSubjectRequest,
    DataSubjectRequestResponse,
    SuppressionRequest
)
from services.gdpr_service import GDPRService

router = APIRouter()


@router.post("/consent", response_model=ConsentResponse)
async def record_consent(
    consent_request: ConsentRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Record consent for data processing."""
    gdpr_service = GDPRService(db)
    return await gdpr_service.record_consent(
        workspace_id=current_user.workspace_id,
        consent_request=consent_request
    )


@router.get("/consent/check")
async def check_consent(
    email: str,
    consent_type: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Check consent status for an email address."""
    gdpr_service = GDPRService(db)
    has_consent = await gdpr_service.check_consent(
        workspace_id=current_user.workspace_id,
        email=email,
        consent_type=consent_type
    )
    
    return {
        "email": email,
        "consent_type": consent_type,
        "has_consent": has_consent
    }


@router.post("/requests", response_model=DataSubjectRequestResponse)
async def create_data_subject_request(
    request: DataSubjectRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a data subject request (access, deletion, etc.)."""
    gdpr_service = GDPRService(db)
    return await gdpr_service.create_data_subject_request(
        workspace_id=current_user.workspace_id,
        request=request
    )


@router.get("/requests", response_model=List[DataSubjectRequestResponse])
async def get_data_subject_requests(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get data subject requests for the workspace."""
    gdpr_service = GDPRService(db)
    return await gdpr_service.get_data_subject_requests(
        workspace_id=current_user.workspace_id,
        skip=skip,
        limit=limit
    )


@router.get("/export")
async def export_personal_data(
    email: str,
    format: str = "json",
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Export personal data for a given email address."""
    gdpr_service = GDPRService(db)
    
    if format not in ["json", "csv", "pdf"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid format. Supported formats: json, csv, pdf"
        )
    
    data = await gdpr_service.export_personal_data(
        workspace_id=current_user.workspace_id,
        email=email,
        export_format=format
    )
    
    return data


@router.delete("/data")
async def delete_personal_data(
    email: str,
    deletion_strategy: str = "anonymize",
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete personal data for a given email address."""
    gdpr_service = GDPRService(db)
    
    if deletion_strategy not in ["hard_delete", "anonymize", "pseudonymize"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid deletion strategy. Supported: hard_delete, anonymize, pseudonymize"
        )
    
    await gdpr_service.delete_personal_data(
        workspace_id=current_user.workspace_id,
        email=email,
        deletion_strategy=deletion_strategy
    )
    
    return {"message": f"Personal data for {email} has been processed for deletion"}


@router.post("/suppression")
async def add_to_suppression_list(
    suppression_request: SuppressionRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Add email to suppression list."""
    gdpr_service = GDPRService(db)
    await gdpr_service.add_to_suppression_list(
        workspace_id=current_user.workspace_id,
        suppression_request=suppression_request
    )
    
    return {"message": f"Email {suppression_request.email} added to suppression list"}


@router.get("/suppression")
async def get_suppression_list(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get suppression list for the workspace."""
    gdpr_service = GDPRService(db)
    return await gdpr_service.get_suppression_list(
        workspace_id=current_user.workspace_id,
        skip=skip,
        limit=limit
    )


@router.get("/audit-logs")
async def get_gdpr_audit_logs(
    skip: int = 0,
    limit: int = 100,
    action_category: str = None,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get GDPR audit logs for the workspace."""
    gdpr_service = GDPRService(db)
    return await gdpr_service.get_audit_logs(
        workspace_id=current_user.workspace_id,
        skip=skip,
        limit=limit,
        action_category=action_category
    )