"""
Lead management endpoints.
"""
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import get_current_active_user
from models.user import User
from models.lead import LeadCreate, LeadResponse, LeadUpdate
from services.lead_service import LeadService

router = APIRouter()


@router.get("/", response_model=List[LeadResponse])
async def get_leads(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get leads for the current user's workspace."""
    lead_service = LeadService(db)
    leads = await lead_service.get_leads_by_workspace(
        workspace_id=current_user.workspace_id,
        skip=skip,
        limit=limit
    )
    return leads


@router.post("/", response_model=LeadResponse)
async def create_lead(
    lead: LeadCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new lead."""
    lead_service = LeadService(db)
    return await lead_service.create_lead(
        lead=lead,
        workspace_id=current_user.workspace_id
    )


@router.get("/{lead_id}", response_model=LeadResponse)
async def get_lead(
    lead_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get a specific lead."""
    lead_service = LeadService(db)
    lead = await lead_service.get_lead_by_id(lead_id)
    
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found"
        )
    
    # Check workspace access
    if lead.workspace_id != current_user.workspace_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to lead"
        )
    
    return lead


@router.put("/{lead_id}", response_model=LeadResponse)
async def update_lead(
    lead_id: UUID,
    lead_update: LeadUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Update a lead."""
    lead_service = LeadService(db)
    lead = await lead_service.get_lead_by_id(lead_id)
    
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found"
        )
    
    # Check workspace access
    if lead.workspace_id != current_user.workspace_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to lead"
        )
    
    return await lead_service.update_lead(lead_id, lead_update)


@router.delete("/{lead_id}")
async def delete_lead(
    lead_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a lead."""
    lead_service = LeadService(db)
    lead = await lead_service.get_lead_by_id(lead_id)
    
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found"
        )
    
    # Check workspace access
    if lead.workspace_id != current_user.workspace_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to lead"
        )
    
    await lead_service.delete_lead(lead_id)
    return {"message": "Lead deleted successfully"}


@router.post("/{lead_id}/enrich")
async def enrich_lead(
    lead_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Trigger lead enrichment."""
    lead_service = LeadService(db)
    lead = await lead_service.get_lead_by_id(lead_id)
    
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found"
        )
    
    # Check workspace access
    if lead.workspace_id != current_user.workspace_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to lead"
        )
    
    # Trigger enrichment task
    await lead_service.enrich_lead(lead_id)
    return {"message": "Lead enrichment started"}