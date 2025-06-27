"""
Workspace service for business logic.
"""
from typing import Optional, List
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.workspace import Workspace, WorkspaceCreate, WorkspaceUpdate


class WorkspaceService:
    """Service class for workspace operations."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get_workspace_by_id(self, workspace_id: UUID) -> Optional[Workspace]:
        """Get workspace by ID."""
        result = await self.db.execute(
            select(Workspace).where(Workspace.id == workspace_id)
        )
        return result.scalar_one_or_none()
    
    async def get_workspace_by_domain(self, domain: str) -> Optional[Workspace]:
        """Get workspace by domain."""
        result = await self.db.execute(
            select(Workspace).where(Workspace.domain == domain)
        )
        return result.scalar_one_or_none()
    
    async def get_workspaces(self, skip: int = 0, limit: int = 100) -> List[Workspace]:
        """Get all workspaces."""
        result = await self.db.execute(
            select(Workspace).offset(skip).limit(limit)
        )
        return list(result.scalars().all())
    
    async def create_workspace(self, workspace: WorkspaceCreate) -> Workspace:
        """Create a new workspace."""
        db_workspace = Workspace(
            name=workspace.name,
            domain=workspace.domain,
            settings=workspace.settings or {}
        )
        
        self.db.add(db_workspace)
        await self.db.commit()
        await self.db.refresh(db_workspace)
        
        return db_workspace
    
    async def update_workspace(
        self, 
        workspace_id: UUID, 
        workspace_update: WorkspaceUpdate
    ) -> Optional[Workspace]:
        """Update a workspace."""
        result = await self.db.execute(
            select(Workspace).where(Workspace.id == workspace_id)
        )
        db_workspace = result.scalar_one_or_none()
        
        if not db_workspace:
            return None
        
        update_data = workspace_update.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            if field == "settings" and value is not None:
                # Merge settings instead of replacing
                current_settings = db_workspace.settings or {}
                current_settings.update(value)
                setattr(db_workspace, field, current_settings)
            else:
                setattr(db_workspace, field, value)
        
        await self.db.commit()
        await self.db.refresh(db_workspace)
        
        return db_workspace
    
    async def delete_workspace(self, workspace_id: UUID) -> bool:
        """Delete a workspace."""
        result = await self.db.execute(
            select(Workspace).where(Workspace.id == workspace_id)
        )
        db_workspace = result.scalar_one_or_none()
        
        if not db_workspace:
            return False
        
        await self.db.delete(db_workspace)
        await self.db.commit()
        
        return True