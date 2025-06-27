"""
Workspace model and schemas.
"""
from typing import Optional, Dict, Any
from uuid import UUID, uuid4

from pydantic import BaseModel
from sqlalchemy import String, UUID as SQLAlchemyUUID, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base


class Workspace(Base):
    """Workspace database model."""
    
    __tablename__ = "workspaces"
    
    id: Mapped[UUID] = mapped_column(
        SQLAlchemyUUID(as_uuid=True),
        primary_key=True,
        default=uuid4
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    domain: Mapped[Optional[str]] = mapped_column(String(255), unique=True, nullable=True)
    settings: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)
    
    # Relationships
    users = relationship("User", back_populates="workspace")
    campaigns = relationship("Campaign", back_populates="workspace")
    leads = relationship("Lead", back_populates="workspace")


# Pydantic schemas
class WorkspaceBase(BaseModel):
    """Base workspace schema."""
    name: str
    domain: Optional[str] = None
    settings: Optional[Dict[str, Any]] = None


class WorkspaceCreate(WorkspaceBase):
    """Workspace creation schema."""
    pass


class WorkspaceUpdate(BaseModel):
    """Workspace update schema."""
    name: Optional[str] = None
    domain: Optional[str] = None
    settings: Optional[Dict[str, Any]] = None


class WorkspaceResponse(WorkspaceBase):
    """Workspace response schema."""
    id: UUID
    created_at: str
    updated_at: str
    
    class Config:
        from_attributes = True