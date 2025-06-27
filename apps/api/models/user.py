"""
User model and schemas.
"""
from typing import Optional
from uuid import UUID, uuid4

from pydantic import BaseModel, EmailStr
from sqlalchemy import Boolean, String, UUID as SQLAlchemyUUID, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base


class User(Base):
    """User database model."""
    
    __tablename__ = "users"
    
    id: Mapped[UUID] = mapped_column(
        SQLAlchemyUUID(as_uuid=True),
        primary_key=True,
        default=uuid4
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(50), default="user", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    
    # Foreign key to workspace
    workspace_id: Mapped[UUID] = mapped_column(
        SQLAlchemyUUID(as_uuid=True),
        ForeignKey("workspaces.id"),
        nullable=False
    )
    
    # Relationships
    workspace = relationship("Workspace", back_populates="users")


# Pydantic schemas
class UserBase(BaseModel):
    """Base user schema."""
    email: EmailStr
    role: str = "user"
    is_active: bool = True


class UserCreate(UserBase):
    """User creation schema."""
    password: str
    workspace_id: UUID


class UserUpdate(BaseModel):
    """User update schema."""
    email: Optional[EmailStr] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None


class UserResponse(UserBase):
    """User response schema."""
    id: UUID
    workspace_id: UUID
    created_at: str
    updated_at: str
    
    class Config:
        from_attributes = True