"""
Lead model and schemas.
"""
from typing import Optional, Dict, Any
from uuid import UUID, uuid4

from pydantic import BaseModel, EmailStr
from sqlalchemy import String, UUID as SQLAlchemyUUID, ForeignKey, JSON, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base


class Lead(Base):
    """Lead database model."""
    
    __tablename__ = "leads"
    
    id: Mapped[UUID] = mapped_column(
        SQLAlchemyUUID(as_uuid=True),
        primary_key=True,
        default=uuid4
    )
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    first_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    last_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    company: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    title: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="new", nullable=False)
    
    # JSONB field for enrichment data
    enrichment_data: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)
    
    # Notes field
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Foreign key to workspace
    workspace_id: Mapped[UUID] = mapped_column(
        SQLAlchemyUUID(as_uuid=True),
        ForeignKey("workspaces.id"),
        nullable=False
    )
    
    # Additional fields for scoring
    job_title: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    linkedin_url: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    company_website: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    industry: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    company_size: Mapped[Optional[int]] = mapped_column(nullable=True)
    company_revenue: Mapped[Optional[float]] = mapped_column(nullable=True)
    email_status: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # valid, invalid, catch_all
    enrichment_confidence: Mapped[Optional[float]] = mapped_column(nullable=True)
    
    # Relationships
    workspace = relationship("Workspace", back_populates="leads")
    campaign_emails = relationship("CampaignEmail", back_populates="lead")
    score = relationship("LeadScore", back_populates="lead", uselist=False)


# Pydantic schemas
class LeadBase(BaseModel):
    """Base lead schema."""
    email: EmailStr
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    company: Optional[str] = None
    title: Optional[str] = None
    phone: Optional[str] = None
    status: str = "new"
    enrichment_data: Optional[Dict[str, Any]] = None
    notes: Optional[str] = None


class LeadCreate(LeadBase):
    """Lead creation schema."""
    pass


class LeadUpdate(BaseModel):
    """Lead update schema."""
    email: Optional[EmailStr] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    company: Optional[str] = None
    title: Optional[str] = None
    phone: Optional[str] = None
    status: Optional[str] = None
    enrichment_data: Optional[Dict[str, Any]] = None
    notes: Optional[str] = None


class LeadResponse(LeadBase):
    """Lead response schema."""
    id: UUID
    workspace_id: UUID
    created_at: str
    updated_at: str
    
    class Config:
        from_attributes = True