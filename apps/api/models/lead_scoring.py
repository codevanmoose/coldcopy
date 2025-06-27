"""
Lead scoring and segmentation models.
"""
from sqlalchemy import Column, String, Integer, Float, DateTime, Boolean, ForeignKey, JSON, Enum, Index, CheckConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime
import enum

from ..core.database import Base


class ScoringModel(str, enum.Enum):
    """Types of scoring models."""
    ENGAGEMENT = "engagement"
    PREDICTIVE = "predictive"
    CUSTOM = "custom"
    HYBRID = "hybrid"


class SegmentType(str, enum.Enum):
    """Types of segments."""
    STATIC = "static"  # Manual membership
    DYNAMIC = "dynamic"  # Rule-based membership
    SMART = "smart"  # AI-powered membership


class SegmentStatus(str, enum.Enum):
    """Status of a segment."""
    ACTIVE = "active"
    PAUSED = "paused"
    ARCHIVED = "archived"


class RuleOperator(str, enum.Enum):
    """Operators for segment rules."""
    EQUALS = "equals"
    NOT_EQUALS = "not_equals"
    CONTAINS = "contains"
    NOT_CONTAINS = "not_contains"
    STARTS_WITH = "starts_with"
    ENDS_WITH = "ends_with"
    GREATER_THAN = "greater_than"
    LESS_THAN = "less_than"
    GREATER_EQUAL = "greater_equal"
    LESS_EQUAL = "less_equal"
    IN = "in"
    NOT_IN = "not_in"
    IS_EMPTY = "is_empty"
    IS_NOT_EMPTY = "is_not_empty"
    DATE_BEFORE = "date_before"
    DATE_AFTER = "date_after"
    DATE_BETWEEN = "date_between"


class LeadScore(Base):
    """Lead scoring configuration and history."""
    __tablename__ = "lead_scores"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id"), nullable=False)
    lead_id = Column(UUID(as_uuid=True), ForeignKey("leads.id"), nullable=False)
    
    # Current scores
    engagement_score = Column(Integer, default=0)  # 0-100
    quality_score = Column(Integer, default=0)  # 0-100
    intent_score = Column(Integer, default=0)  # 0-100
    total_score = Column(Integer, default=0)  # 0-100
    
    # Score components
    email_engagement_points = Column(Integer, default=0)
    profile_completeness_points = Column(Integer, default=0)
    company_fit_points = Column(Integer, default=0)
    behavior_points = Column(Integer, default=0)
    recency_points = Column(Integer, default=0)
    
    # Scoring factors (cached for transparency)
    scoring_factors = Column(JSON)  # Detailed breakdown of score calculation
    
    # Grade assignment
    grade = Column(String(2))  # A+, A, B+, B, C, D, F
    temperature = Column(String(10))  # hot, warm, cool, cold
    
    # Timestamps
    last_calculated_at = Column(DateTime, default=datetime.utcnow)
    score_changed_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    lead = relationship("Lead", back_populates="score")
    history = relationship("LeadScoreHistory", back_populates="lead_score", cascade="all, delete-orphan")
    
    # Indexes for performance
    __table_args__ = (
        Index("idx_lead_scores_workspace_score", "workspace_id", "total_score"),
        Index("idx_lead_scores_workspace_grade", "workspace_id", "grade"),
        Index("idx_lead_scores_lead", "lead_id"),
        CheckConstraint("engagement_score >= 0 AND engagement_score <= 100"),
        CheckConstraint("quality_score >= 0 AND quality_score <= 100"),
        CheckConstraint("intent_score >= 0 AND intent_score <= 100"),
        CheckConstraint("total_score >= 0 AND total_score <= 100"),
    )


class LeadScoreHistory(Base):
    """Historical record of lead score changes."""
    __tablename__ = "lead_score_history"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lead_score_id = Column(UUID(as_uuid=True), ForeignKey("lead_scores.id"), nullable=False)
    
    # Previous scores
    previous_total_score = Column(Integer)
    new_total_score = Column(Integer)
    score_change = Column(Integer)  # Can be negative
    
    # What triggered the change
    trigger_event = Column(String(50))  # email_opened, profile_updated, etc.
    trigger_details = Column(JSON)
    
    # Timestamp
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    lead_score = relationship("LeadScore", back_populates="history")


class ScoringRule(Base):
    """Custom scoring rules per workspace."""
    __tablename__ = "scoring_rules"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id"), nullable=False)
    
    # Rule configuration
    name = Column(String(255), nullable=False)
    description = Column(String)
    model_type = Column(Enum(ScoringModel), default=ScoringModel.ENGAGEMENT)
    is_active = Column(Boolean, default=True)
    
    # Scoring weights
    email_open_weight = Column(Float, default=5.0)
    email_click_weight = Column(Float, default=10.0)
    email_reply_weight = Column(Float, default=25.0)
    website_visit_weight = Column(Float, default=15.0)
    form_submission_weight = Column(Float, default=30.0)
    
    # Decay settings
    enable_time_decay = Column(Boolean, default=True)
    decay_half_life_days = Column(Integer, default=30)  # Score halves every X days
    
    # Profile scoring
    profile_scoring_rules = Column(JSON)  # Custom rules for profile completeness
    company_fit_rules = Column(JSON)  # Rules for company fit scoring
    
    # Thresholds for grades
    grade_thresholds = Column(JSON, default={
        "A+": 90, "A": 80, "B+": 70, "B": 60, 
        "C": 50, "D": 40, "F": 0
    })
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Segment(Base):
    """Lead segments for grouping and targeting."""
    __tablename__ = "segments"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id"), nullable=False)
    
    # Segment details
    name = Column(String(255), nullable=False)
    description = Column(String)
    color = Column(String(7))  # Hex color for UI
    icon = Column(String(50))  # Icon identifier
    
    # Segment configuration
    type = Column(Enum(SegmentType), default=SegmentType.DYNAMIC)
    status = Column(Enum(SegmentStatus), default=SegmentStatus.ACTIVE)
    
    # Rules (for dynamic segments)
    rules = Column(JSON)  # Complex rule structure
    rule_match_type = Column(String(10), default="all")  # all, any
    
    # Smart segment settings
    ai_description = Column(String)  # Natural language description for AI
    ai_model_version = Column(String(50))
    ai_confidence_threshold = Column(Float, default=0.8)
    
    # Statistics (cached)
    member_count = Column(Integer, default=0)
    last_calculated_at = Column(DateTime)
    
    # Automation settings
    auto_add_to_campaigns = Column(Boolean, default=False)
    auto_remove_inactive = Column(Boolean, default=False)
    inactive_days_threshold = Column(Integer, default=90)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    members = relationship("SegmentMember", back_populates="segment", cascade="all, delete-orphan")
    campaigns = relationship("Campaign", secondary="segment_campaigns")


class SegmentRule(Base):
    """Individual rules for dynamic segments."""
    __tablename__ = "segment_rules"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    segment_id = Column(UUID(as_uuid=True), ForeignKey("segments.id"), nullable=False)
    
    # Rule configuration
    field_name = Column(String(255), nullable=False)  # e.g., "lead_score", "email", "company_size"
    field_type = Column(String(50))  # string, number, date, boolean
    operator = Column(Enum(RuleOperator), nullable=False)
    value = Column(JSON)  # Can be string, number, array, etc.
    
    # Grouping
    group_id = Column(String(50))  # For complex rule grouping
    group_operator = Column(String(10), default="and")  # and, or
    
    # Order
    rule_order = Column(Integer, default=0)
    
    # Relationships
    segment = relationship("Segment")


class SegmentMember(Base):
    """Membership tracking for segments."""
    __tablename__ = "segment_members"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    segment_id = Column(UUID(as_uuid=True), ForeignKey("segments.id"), nullable=False)
    lead_id = Column(UUID(as_uuid=True), ForeignKey("leads.id"), nullable=False)
    
    # Membership details
    added_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    added_by = Column(String(50), default="system")  # system, manual, import
    match_score = Column(Float)  # For smart segments
    
    # For dynamic segments - why they match
    matched_rules = Column(JSON)
    
    # Relationships
    segment = relationship("Segment", back_populates="members")
    lead = relationship("Lead")
    
    # Unique constraint
    __table_args__ = (
        Index("idx_segment_members_unique", "segment_id", "lead_id", unique=True),
    )


class SegmentCampaign(Base):
    """Association between segments and campaigns."""
    __tablename__ = "segment_campaigns"
    
    segment_id = Column(UUID(as_uuid=True), ForeignKey("segments.id"), primary_key=True)
    campaign_id = Column(UUID(as_uuid=True), ForeignKey("campaigns.id"), primary_key=True)
    added_at = Column(DateTime, default=datetime.utcnow)


class LeadActivity(Base):
    """Track all lead activities for scoring."""
    __tablename__ = "lead_activities"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id"), nullable=False)
    lead_id = Column(UUID(as_uuid=True), ForeignKey("leads.id"), nullable=False)
    
    # Activity details
    activity_type = Column(String(50), nullable=False)  # email_open, click, reply, etc.
    activity_source = Column(String(50))  # campaign, automation, manual
    activity_value = Column(Float, default=1.0)  # Weight of this activity
    
    # Context
    campaign_id = Column(UUID(as_uuid=True), ForeignKey("campaigns.id"))
    email_id = Column(UUID(as_uuid=True))
    metadata = Column(JSON)
    
    # Timestamp
    occurred_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    lead = relationship("Lead")
    campaign = relationship("Campaign")
    
    # Indexes
    __table_args__ = (
        Index("idx_lead_activities_lead_time", "lead_id", "occurred_at"),
        Index("idx_lead_activities_workspace_type", "workspace_id", "activity_type"),
    )