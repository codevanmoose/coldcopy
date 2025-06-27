"""
Workspace management endpoints.
"""
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import get_current_active_user, require_role
from models.user import User
from models.workspace import WorkspaceCreate, WorkspaceResponse, WorkspaceUpdate
from services.workspace_service import WorkspaceService

router = APIRouter()


@router.get("/current", response_model=WorkspaceResponse)
async def get_current_workspace(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get the current user's workspace."""
    workspace_service = WorkspaceService(db)
    workspace = await workspace_service.get_workspace_by_id(current_user.workspace_id)
    
    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found"
        )
    
    return workspace


@router.put("/current", response_model=WorkspaceResponse)
async def update_current_workspace(
    workspace_update: WorkspaceUpdate,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db)
):
    """Update the current user's workspace."""
    workspace_service = WorkspaceService(db)
    workspace = await workspace_service.get_workspace_by_id(current_user.workspace_id)
    
    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found"
        )
    
    return await workspace_service.update_workspace(current_user.workspace_id, workspace_update)


@router.get("/", response_model=List[WorkspaceResponse])
async def get_workspaces(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(require_role("super_admin")),
    db: AsyncSession = Depends(get_db)
):
    """Get all workspaces (super admin only)."""
    workspace_service = WorkspaceService(db)
    return await workspace_service.get_workspaces(skip=skip, limit=limit)


@router.post("/", response_model=WorkspaceResponse)
async def create_workspace(
    workspace: WorkspaceCreate,
    current_user: User = Depends(require_role("super_admin")),
    db: AsyncSession = Depends(get_db)
):
    """Create a new workspace (super admin only)."""
    workspace_service = WorkspaceService(db)
    return await workspace_service.create_workspace(workspace)


@router.get("/{workspace_id}", response_model=WorkspaceResponse)
async def get_workspace(
    workspace_id: UUID,
    current_user: User = Depends(require_role("super_admin")),
    db: AsyncSession = Depends(get_db)
):
    """Get a specific workspace (super admin only)."""
    workspace_service = WorkspaceService(db)
    workspace = await workspace_service.get_workspace_by_id(workspace_id)
    
    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found"
        )
    
    return workspace


@router.put("/{workspace_id}", response_model=WorkspaceResponse)
async def update_workspace(
    workspace_id: UUID,
    workspace_update: WorkspaceUpdate,
    current_user: User = Depends(require_role("super_admin")),
    db: AsyncSession = Depends(get_db)
):
    """Update a workspace (super admin only)."""
    workspace_service = WorkspaceService(db)
    workspace = await workspace_service.get_workspace_by_id(workspace_id)
    
    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found"
        )
    
    return await workspace_service.update_workspace(workspace_id, workspace_update)


@router.delete("/{workspace_id}")
async def delete_workspace(
    workspace_id: UUID,
    current_user: User = Depends(require_role("super_admin")),
    db: AsyncSession = Depends(get_db)
):
    """Delete a workspace (super admin only)."""
    workspace_service = WorkspaceService(db)
    workspace = await workspace_service.get_workspace_by_id(workspace_id)
    
    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found"
        )
    
    await workspace_service.delete_workspace(workspace_id)
    return {"message": "Workspace deleted successfully"}