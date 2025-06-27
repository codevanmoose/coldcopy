"""
Email message model for inbox and conversations.
"""
from typing import Optional
from uuid import UUID, uuid4
from datetime import datetime

from sqlalchemy import String, UUID as SQLAlchemyUUID, ForeignKey, Text, DateTime, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..core.database import Base


class EmailMessage(Base):
    """Email messages in the shared team inbox."""
    
    __tablename__ = "email_messages"
    
    id: Mapped[UUID] = mapped_column(
        SQLAlchemyUUID(as_uuid=True),
        primary_key=True,
        default=uuid4
    )
    
    # Message details
    subject: Mapped[str] = mapped_column(String(500), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    direction: Mapped[str] = mapped_column(String(20), nullable=False)  # inbound, outbound
    
    # Email addresses
    from_email: Mapped[str] = mapped_column(String(255), nullable=False)
    from_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    to_email: Mapped[str] = mapped_column(String(255), nullable=False)
    to_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    
    # Threading
    thread_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    in_reply_to: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    message_id: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    
    # Status
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_replied: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    
    # Assignment
    assigned_to: Mapped[Optional[UUID]] = mapped_column(
        SQLAlchemyUUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=True
    )
    assigned_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # Foreign keys
    workspace_id: Mapped[UUID] = mapped_column(
        SQLAlchemyUUID(as_uuid=True),
        ForeignKey("workspaces.id"),
        nullable=False
    )
    lead_id: Mapped[UUID] = mapped_column(
        SQLAlchemyUUID(as_uuid=True),
        ForeignKey("leads.id"),
        nullable=False
    )
    campaign_id: Mapped[Optional[UUID]] = mapped_column(
        SQLAlchemyUUID(as_uuid=True),
        ForeignKey("campaigns.id"),
        nullable=True
    )
    campaign_email_id: Mapped[Optional[UUID]] = mapped_column(
        SQLAlchemyUUID(as_uuid=True),
        ForeignKey("campaign_emails.id"),
        nullable=True
    )
    
    # Timestamps
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    
    # Relationships
    workspace = relationship("Workspace")
    lead = relationship("Lead")
    campaign = relationship("Campaign")
    campaign_email = relationship("CampaignEmail")
    assigned_user = relationship("User")