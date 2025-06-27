"""
Email event tracking models.
"""
from typing import Optional, Dict, Any
from uuid import UUID, uuid4
from datetime import datetime

from sqlalchemy import String, UUID as SQLAlchemyUUID, ForeignKey, JSON, DateTime, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..core.database import Base


class EmailEvent(Base):
    """Email event tracking with partitioning support."""
    
    __tablename__ = "email_events"
    
    id: Mapped[UUID] = mapped_column(
        SQLAlchemyUUID(as_uuid=True),
        primary_key=True,
        default=uuid4
    )
    
    # Event details
    event_type: Mapped[str] = mapped_column(String(50), nullable=False)  # sent, delivered, opened, clicked, replied, bounced
    event_data: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)
    
    # Foreign keys
    campaign_email_id: Mapped[UUID] = mapped_column(
        SQLAlchemyUUID(as_uuid=True),
        ForeignKey("campaign_emails.id"),
        nullable=False
    )
    lead_id: Mapped[UUID] = mapped_column(
        SQLAlchemyUUID(as_uuid=True),
        ForeignKey("leads.id"),
        nullable=False
    )
    campaign_id: Mapped[UUID] = mapped_column(
        SQLAlchemyUUID(as_uuid=True),
        ForeignKey("campaigns.id"),
        nullable=False
    )
    workspace_id: Mapped[UUID] = mapped_column(
        SQLAlchemyUUID(as_uuid=True),
        ForeignKey("workspaces.id"),
        nullable=False
    )
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        nullable=False
    )
    
    # Relationships
    campaign_email = relationship("CampaignEmail")
    lead = relationship("Lead")
    campaign = relationship("Campaign")
    workspace = relationship("Workspace")
    
    # Indexes for performance
    __table_args__ = (
        Index('ix_email_events_workspace_created', 'workspace_id', 'created_at'),
        Index('ix_email_events_lead_created', 'lead_id', 'created_at'),
        Index('ix_email_events_campaign_created', 'campaign_id', 'created_at'),
        Index('ix_email_events_type_created', 'event_type', 'created_at'),
    )