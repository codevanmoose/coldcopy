"""
Email event model and schemas.
"""
from typing import Optional, Dict, Any
from uuid import UUID, uuid4
from datetime import datetime

from pydantic import BaseModel
from sqlalchemy import String, UUID as SQLAlchemyUUID, ForeignKey, JSON, DateTime, Index
from sqlalchemy.orm import Mapped, mapped_column

from core.database import Base


class EmailEvent(Base):
    """Email event database model with partitioning support."""
    
    __tablename__ = "email_events"
    
    id: Mapped[UUID] = mapped_column(
        SQLAlchemyUUID(as_uuid=True),
        primary_key=True,
        default=uuid4
    )
    event_type: Mapped[str] = mapped_column(String(50), nullable=False)
    event_data: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    
    # Foreign keys
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
    
    # Indexes for performance
    __table_args__ = (
        Index('ix_email_events_workspace_timestamp', 'workspace_id', 'timestamp'),
        Index('ix_email_events_lead_timestamp', 'lead_id', 'timestamp'),
        Index('ix_email_events_campaign_timestamp', 'campaign_id', 'timestamp'),
        Index('ix_email_events_type_timestamp', 'event_type', 'timestamp'),
    )


# Pydantic schemas
class EmailEventBase(BaseModel):
    """Base email event schema."""
    event_type: str
    event_data: Optional[Dict[str, Any]] = None
    timestamp: datetime
    lead_id: UUID
    campaign_id: UUID


class EmailEventCreate(EmailEventBase):
    """Email event creation schema."""
    pass


class EmailEventResponse(EmailEventBase):
    """Email event response schema."""
    id: UUID
    workspace_id: UUID
    created_at: str
    updated_at: str
    
    class Config:
        from_attributes = True