"""
Campaign model and schemas.
"""
from typing import Optional, Dict, Any
from uuid import UUID, uuid4

from pydantic import BaseModel
from sqlalchemy import String, UUID as SQLAlchemyUUID, ForeignKey, JSON, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base


class Campaign(Base):
    """Campaign database model."""
    
    __tablename__ = "campaigns"
    
    id: Mapped[UUID] = mapped_column(
        SQLAlchemyUUID(as_uuid=True),
        primary_key=True,
        default=uuid4
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="draft", nullable=False)
    settings: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)
    
    # Foreign keys
    workspace_id: Mapped[UUID] = mapped_column(
        SQLAlchemyUUID(as_uuid=True),
        ForeignKey("workspaces.id"),
        nullable=False
    )
    created_by: Mapped[UUID] = mapped_column(
        SQLAlchemyUUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False
    )
    
    # Relationships
    workspace = relationship("Workspace", back_populates="campaigns")
    creator = relationship("User")
    campaign_emails = relationship("CampaignEmail", back_populates="campaign", cascade="all, delete-orphan")
    ab_tests = relationship("ABTest", back_populates="campaign", cascade="all, delete-orphan")


# Pydantic schemas
class CampaignBase(BaseModel):
    """Base campaign schema."""
    name: str
    description: Optional[str] = None
    status: str = "draft"
    settings: Optional[Dict[str, Any]] = None


class CampaignCreate(CampaignBase):
    """Campaign creation schema."""
    pass


class CampaignUpdate(BaseModel):
    """Campaign update schema."""
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    settings: Optional[Dict[str, Any]] = None


class CampaignResponse(CampaignBase):
    """Campaign response schema."""
    id: UUID
    workspace_id: UUID
    created_by: UUID
    created_at: str
    updated_at: str
    
    class Config:
        from_attributes = True