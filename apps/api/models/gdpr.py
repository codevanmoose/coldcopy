"""
GDPR compliance models and schemas.
"""
from typing import Optional, Dict, Any
from uuid import UUID, uuid4
from datetime import datetime, date
from enum import Enum

from pydantic import BaseModel, EmailStr
from sqlalchemy import (
    String, UUID as SQLAlchemyUUID, ForeignKey, JSON, 
    DateTime, Date, Integer, Text, Boolean, Enum as SQLEnum
)
from sqlalchemy.orm import Mapped, mapped_column

from core.database import Base


class ConsentType(str, Enum):
    """Consent types for GDPR compliance."""
    MARKETING = "marketing"
    ANALYTICS = "analytics" 
    FUNCTIONAL = "functional"
    NECESSARY = "necessary"
    DATA_PROCESSING = "data_processing"


class ConsentStatus(str, Enum):
    """Consent status values."""
    GIVEN = "given"
    WITHDRAWN = "withdrawn"
    EXPIRED = "expired"


class RequestType(str, Enum):
    """Data subject request types."""
    ACCESS = "access"
    DELETION = "deletion"
    RECTIFICATION = "rectification"
    RESTRICTION = "restriction"
    PORTABILITY = "portability"
    OBJECTION = "objection"


class RequestStatus(str, Enum):
    """Request status values."""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    REJECTED = "rejected"
    EXPIRED = "expired"


# Database Models
class ConsentRecord(Base):
    """Consent record database model."""
    
    __tablename__ = "consent_records"
    
    id: Mapped[UUID] = mapped_column(
        SQLAlchemyUUID(as_uuid=True),
        primary_key=True,
        default=uuid4
    )
    workspace_id: Mapped[UUID] = mapped_column(
        SQLAlchemyUUID(as_uuid=True),
        ForeignKey("workspaces.id"),
        nullable=False
    )
    lead_id: Mapped[Optional[UUID]] = mapped_column(
        SQLAlchemyUUID(as_uuid=True),
        ForeignKey("leads.id"),
        nullable=True
    )
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    consent_type: Mapped[ConsentType] = mapped_column(SQLEnum(ConsentType), nullable=False)
    status: Mapped[ConsentStatus] = mapped_column(SQLEnum(ConsentStatus), nullable=False)
    version: Mapped[str] = mapped_column(String(50), nullable=False)
    expiry_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    metadata: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)


class DataSubjectRequestModel(Base):
    """Data subject request database model."""
    
    __tablename__ = "data_subject_requests"
    
    id: Mapped[UUID] = mapped_column(
        SQLAlchemyUUID(as_uuid=True),
        primary_key=True,
        default=uuid4
    )
    workspace_id: Mapped[UUID] = mapped_column(
        SQLAlchemyUUID(as_uuid=True),
        ForeignKey("workspaces.id"),
        nullable=False
    )
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    request_type: Mapped[RequestType] = mapped_column(SQLEnum(RequestType), nullable=False)
    status: Mapped[RequestStatus] = mapped_column(SQLEnum(RequestStatus), default=RequestStatus.PENDING)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    deadline: Mapped[date] = mapped_column(Date, nullable=False)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    response_data: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)


class DataRetentionPolicy(Base):
    """Data retention policy database model."""
    
    __tablename__ = "data_retention_policies"
    
    id: Mapped[UUID] = mapped_column(
        SQLAlchemyUUID(as_uuid=True),
        primary_key=True,
        default=uuid4
    )
    workspace_id: Mapped[UUID] = mapped_column(
        SQLAlchemyUUID(as_uuid=True),
        ForeignKey("workspaces.id"),
        nullable=False
    )
    data_type: Mapped[str] = mapped_column(String(100), nullable=False)
    retention_days: Mapped[int] = mapped_column(Integer, nullable=False)
    deletion_strategy: Mapped[str] = mapped_column(String(50), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class GDPRAuditLog(Base):
    """GDPR audit log database model."""
    
    __tablename__ = "gdpr_audit_logs"
    
    id: Mapped[UUID] = mapped_column(
        SQLAlchemyUUID(as_uuid=True),
        primary_key=True,
        default=uuid4
    )
    workspace_id: Mapped[UUID] = mapped_column(
        SQLAlchemyUUID(as_uuid=True),
        ForeignKey("workspaces.id"),
        nullable=False
    )
    user_id: Mapped[Optional[UUID]] = mapped_column(
        SQLAlchemyUUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=True
    )
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    action_category: Mapped[str] = mapped_column(String(50), nullable=False)
    resource_type: Mapped[str] = mapped_column(String(50), nullable=False)
    resource_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    details: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class SuppressionListModel(Base):
    """Suppression list database model."""
    
    __tablename__ = "suppression_list"
    
    id: Mapped[UUID] = mapped_column(
        SQLAlchemyUUID(as_uuid=True),
        primary_key=True,
        default=uuid4
    )
    workspace_id: Mapped[UUID] = mapped_column(
        SQLAlchemyUUID(as_uuid=True),
        ForeignKey("workspaces.id"),
        nullable=False
    )
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    suppression_type: Mapped[str] = mapped_column(String(50), nullable=False)
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    added_by: Mapped[Optional[UUID]] = mapped_column(
        SQLAlchemyUUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=True
    )


# Pydantic Schemas
class ConsentRequest(BaseModel):
    """Consent request schema."""
    email: EmailStr
    consent_type: ConsentType
    status: ConsentStatus
    version: str = "1.0"
    expiry_date: Optional[date] = None
    metadata: Optional[Dict[str, Any]] = None


class ConsentResponse(BaseModel):
    """Consent response schema."""
    id: UUID
    email: str
    consent_type: ConsentType
    status: ConsentStatus
    version: str
    expiry_date: Optional[date]
    created_at: str
    
    class Config:
        from_attributes = True


class DataSubjectRequest(BaseModel):
    """Data subject request schema."""
    email: EmailStr
    request_type: RequestType
    description: Optional[str] = None


class DataSubjectRequestResponse(BaseModel):
    """Data subject request response schema."""
    id: UUID
    email: str
    request_type: RequestType
    status: RequestStatus
    description: Optional[str]
    deadline: date
    completed_at: Optional[datetime]
    created_at: str
    
    class Config:
        from_attributes = True


class SuppressionRequest(BaseModel):
    """Suppression request schema."""
    email: EmailStr
    suppression_type: str = "unsubscribe"
    reason: Optional[str] = None


class GDPRAuditLogResponse(BaseModel):
    """GDPR audit log response schema."""
    id: UUID
    action: str
    action_category: str
    resource_type: str
    resource_id: Optional[str]
    details: Optional[Dict[str, Any]]
    timestamp: datetime
    created_at: str
    
    class Config:
        from_attributes = True