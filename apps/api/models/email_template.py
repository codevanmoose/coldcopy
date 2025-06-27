"""
Email template models for ColdCopy
"""
from typing import Optional, Dict, Any, List
from datetime import datetime
from enum import Enum
from sqlalchemy import Column, String, DateTime, JSON, Text, Boolean, Integer, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid

from core.database import Base


class TemplateType(str, Enum):
    """Email template types"""
    COLD_OUTREACH = "cold_outreach"
    FOLLOW_UP = "follow_up"
    MEETING_REQUEST = "meeting_request"
    NURTURE = "nurture"
    THANK_YOU = "thank_you"
    REACTIVATION = "reactivation"
    CUSTOM = "custom"


class TemplateCategory(str, Enum):
    """Template categories for organization"""
    SALES = "sales"
    MARKETING = "marketing"
    SUPPORT = "support"
    PERSONAL = "personal"
    AUTOMATED = "automated"


class EmailTemplate(Base):
    """Email template model with drag-and-drop builder support"""
    
    __tablename__ = "email_templates"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    workspace_id = Column(String, ForeignKey("workspaces.id"), nullable=False, index=True)
    
    # Basic template info
    name = Column(String(255), nullable=False)
    description = Column(Text)
    template_type = Column(String(50), nullable=False, default=TemplateType.CUSTOM.value)
    category = Column(String(50), nullable=False, default=TemplateCategory.SALES.value)
    
    # Template content
    subject = Column(String(255), nullable=False)
    html_content = Column(Text)  # Raw HTML content
    text_content = Column(Text)  # Plain text fallback
    
    # Drag-and-drop builder data
    builder_data = Column(JSON)  # MJML-like structure for the builder
    
    # Template metadata
    language = Column(String(10), default="en")
    tags = Column(JSON)  # List of tags for organization
    
    # Variables and personalization
    variables = Column(JSON)  # Available variables and their defaults
    required_variables = Column(JSON)  # List of required variables
    
    # Usage and performance
    is_active = Column(Boolean, default=True)
    is_public = Column(Boolean, default=False)  # Can be shared across workspaces
    is_system = Column(Boolean, default=False)  # System/default templates
    
    # Statistics
    usage_count = Column(Integer, default=0)
    performance_stats = Column(JSON)  # Open rates, click rates, etc.
    
    # Versioning
    version = Column(Integer, default=1)
    parent_template_id = Column(String, ForeignKey("email_templates.id"), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = Column(String, ForeignKey("users.id"), nullable=False)
    
    # Relationships
    workspace = relationship("Workspace", back_populates="email_templates")
    creator = relationship("User")
    versions = relationship("EmailTemplate", remote_side=[id])
    
    def __repr__(self):
        return f"<EmailTemplate(id={self.id}, name={self.name}, type={self.template_type})>"


class TemplateVariable(Base):
    """Template variable definitions"""
    
    __tablename__ = "template_variables"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    workspace_id = Column(String, ForeignKey("workspaces.id"), nullable=False, index=True)
    
    # Variable info
    name = Column(String(100), nullable=False)  # Variable name (e.g., "first_name")
    display_name = Column(String(255), nullable=False)  # Human-readable name
    description = Column(Text)
    data_type = Column(String(50), default="string")  # string, number, date, boolean, url
    
    # Default value and validation
    default_value = Column(String(500))
    validation_pattern = Column(String(500))  # Regex for validation
    is_required = Column(Boolean, default=False)
    
    # Data source
    source_type = Column(String(50), default="lead")  # lead, workspace, campaign, custom
    source_field = Column(String(100))  # Which field to pull from
    
    # Organization
    category = Column(String(50), default="personal")  # personal, company, campaign, system
    is_system = Column(Boolean, default=False)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    workspace = relationship("Workspace")
    
    def __repr__(self):
        return f"<TemplateVariable(name={self.name}, type={self.data_type})>"


class TemplateBlock(Base):
    """Individual template blocks for the drag-and-drop builder"""
    
    __tablename__ = "template_blocks"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # Block identification
    block_type = Column(String(50), nullable=False)  # text, image, button, divider, etc.
    name = Column(String(255), nullable=False)
    description = Column(Text)
    
    # Block content and configuration
    content = Column(JSON)  # Block-specific content structure
    styles = Column(JSON)   # CSS styles and properties
    settings = Column(JSON) # Block-specific settings
    
    # Block metadata
    category = Column(String(50), default="content")  # content, layout, marketing
    is_system = Column(Boolean, default=True)  # System blocks vs custom blocks
    workspace_id = Column(String, ForeignKey("workspaces.id"), nullable=True)  # Null for system blocks
    
    # Preview
    preview_image_url = Column(String(500))
    preview_html = Column(Text)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def __repr__(self):
        return f"<TemplateBlock(type={self.block_type}, name={self.name})>"


class TemplateUsage(Base):
    """Track template usage for analytics"""
    
    __tablename__ = "template_usage"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    template_id = Column(String, ForeignKey("email_templates.id"), nullable=False, index=True)
    campaign_id = Column(String, ForeignKey("campaigns.id"), nullable=True, index=True)
    workspace_id = Column(String, ForeignKey("workspaces.id"), nullable=False, index=True)
    
    # Usage context
    used_by = Column(String, ForeignKey("users.id"), nullable=False)
    usage_type = Column(String(50), default="campaign")  # campaign, test, preview
    
    # Email details
    recipient_email = Column(String(255))
    subject_used = Column(String(255))
    variables_used = Column(JSON)  # Variables and their values
    
    # Performance tracking
    sent_at = Column(DateTime)
    opened_at = Column(DateTime, nullable=True)
    clicked_at = Column(DateTime, nullable=True)
    replied_at = Column(DateTime, nullable=True)
    bounced_at = Column(DateTime, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    template = relationship("EmailTemplate")
    campaign = relationship("Campaign")
    workspace = relationship("Workspace")
    user = relationship("User")
    
    def __repr__(self):
        return f"<TemplateUsage(template_id={self.template_id}, campaign_id={self.campaign_id})>"


class TemplateLibrary(Base):
    """Public template library for sharing templates"""
    
    __tablename__ = "template_library"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    template_id = Column(String, ForeignKey("email_templates.id"), nullable=False)
    
    # Library metadata
    title = Column(String(255), nullable=False)
    description = Column(Text)
    industry = Column(String(100))  # tech, healthcare, finance, etc.
    use_case = Column(String(100))  # cold_outreach, follow_up, etc.
    
    # Sharing info
    submitted_by = Column(String, ForeignKey("users.id"), nullable=False)
    submitted_at = Column(DateTime, default=datetime.utcnow)
    approved_by = Column(String, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    
    # Metrics
    download_count = Column(Integer, default=0)
    rating = Column(Integer, default=0)  # 1-5 stars
    rating_count = Column(Integer, default=0)
    
    # Status
    is_featured = Column(Boolean, default=False)
    is_approved = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    
    # Relationships
    template = relationship("EmailTemplate")
    submitter = relationship("User", foreign_keys=[submitted_by])
    approver = relationship("User", foreign_keys=[approved_by])
    
    def __repr__(self):
        return f"<TemplateLibrary(title={self.title}, template_id={self.template_id})>"