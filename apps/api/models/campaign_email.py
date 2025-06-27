"""
Campaign email model for tracking individual emails sent.
"""
from typing import Optional, Dict, Any
from uuid import UUID, uuid4
from datetime import datetime

from pydantic import BaseModel
from sqlalchemy import String, UUID as SQLAlchemyUUID, ForeignKey, JSON, DateTime, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..core.database import Base


class CampaignEmail(Base):
    """Individual email sent as part of a campaign."""
    
    __tablename__ = "campaign_emails"
    
    id: Mapped[UUID] = mapped_column(
        SQLAlchemyUUID(as_uuid=True),
        primary_key=True,
        default=uuid4
    )
    
    # Email details
    subject: Mapped[str] = mapped_column(String(255), nullable=False)
    body_html: Mapped[str] = mapped_column(nullable=False)
    body_text: Mapped[Optional[str]] = mapped_column(nullable=True)
    from_email: Mapped[str] = mapped_column(String(255), nullable=False)
    from_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    
    # Status tracking
    status: Mapped[str] = mapped_column(String(50), default="pending", nullable=False)
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    delivered_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    opened_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    clicked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    replied_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # Tracking
    open_count: Mapped[int] = mapped_column(default=0, nullable=False)
    click_count: Mapped[int] = mapped_column(default=0, nullable=False)
    
    # Foreign keys
    campaign_id: Mapped[UUID] = mapped_column(
        SQLAlchemyUUID(as_uuid=True),
        ForeignKey("campaigns.id"),
        nullable=False
    )
    lead_id: Mapped[UUID] = mapped_column(
        SQLAlchemyUUID(as_uuid=True),
        ForeignKey("leads.id"),
        nullable=False
    )
    workspace_id: Mapped[UUID] = mapped_column(
        SQLAlchemyUUID(as_uuid=True),
        ForeignKey("workspaces.id"),
        nullable=False
    )
    
    # A/B Testing
    ab_test_variant_id: Mapped[Optional[UUID]] = mapped_column(
        SQLAlchemyUUID(as_uuid=True),
        ForeignKey("ab_test_variants.id"),
        nullable=True
    )
    
    # Metadata
    metadata: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    
    # Relationships
    campaign = relationship("Campaign", back_populates="campaign_emails")
    lead = relationship("Lead", back_populates="campaign_emails")
    workspace = relationship("Workspace")
    ab_test_variant = relationship("ABTestVariant")