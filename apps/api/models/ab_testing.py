"""
A/B Testing models for email campaigns.
"""
from sqlalchemy import Column, String, Integer, Float, DateTime, Boolean, ForeignKey, JSON, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime
import enum

from ..core.database import Base


class TestType(str, enum.Enum):
    """Types of A/B tests."""
    SUBJECT_LINE = "subject_line"
    EMAIL_CONTENT = "email_content"
    SEND_TIME = "send_time"
    FROM_NAME = "from_name"
    CTA_BUTTON = "cta_button"


class TestStatus(str, enum.Enum):
    """Status of an A/B test."""
    DRAFT = "draft"
    RUNNING = "running"
    COMPLETED = "completed"
    PAUSED = "paused"
    CANCELLED = "cancelled"


class WinnerSelectionMethod(str, enum.Enum):
    """Method for selecting the winning variant."""
    MANUAL = "manual"
    OPEN_RATE = "open_rate"
    CLICK_RATE = "click_rate"
    REPLY_RATE = "reply_rate"
    CONVERSION_RATE = "conversion_rate"
    ENGAGEMENT_SCORE = "engagement_score"


class ABTest(Base):
    """A/B test configuration for campaigns."""
    __tablename__ = "ab_tests"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id"), nullable=False)
    campaign_id = Column(UUID(as_uuid=True), ForeignKey("campaigns.id"), nullable=False)
    
    # Test configuration
    name = Column(String(255), nullable=False)
    description = Column(String)
    test_type = Column(Enum(TestType), nullable=False)
    status = Column(Enum(TestStatus), default=TestStatus.DRAFT, nullable=False)
    
    # Test parameters
    test_percentage = Column(Integer, default=20)  # Percentage of audience for testing
    confidence_threshold = Column(Float, default=95.0)  # Statistical confidence level
    minimum_sample_size = Column(Integer, default=100)  # Min recipients per variant
    test_duration_hours = Column(Integer, default=24)  # How long to run the test
    
    # Winner selection
    winner_selection_method = Column(Enum(WinnerSelectionMethod), default=WinnerSelectionMethod.OPEN_RATE)
    winner_variant_id = Column(UUID(as_uuid=True), ForeignKey("ab_test_variants.id"))
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    
    # Relationships
    campaign = relationship("Campaign", back_populates="ab_tests")
    variants = relationship("ABTestVariant", back_populates="test", cascade="all, delete-orphan")
    winner_variant = relationship("ABTestVariant", foreign_keys=[winner_variant_id], post_update=True)


class ABTestVariant(Base):
    """Individual variant in an A/B test."""
    __tablename__ = "ab_test_variants"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    test_id = Column(UUID(as_uuid=True), ForeignKey("ab_tests.id"), nullable=False)
    
    # Variant details
    name = Column(String(255), nullable=False)  # e.g., "Variant A", "Control"
    is_control = Column(Boolean, default=False)
    
    # Content that varies
    subject_line = Column(String(255))
    preview_text = Column(String(255))
    from_name = Column(String(255))
    from_email = Column(String(255))
    email_content = Column(JSON)  # Store HTML/text content
    send_time = Column(DateTime)  # For send time tests
    
    # Allocation
    traffic_percentage = Column(Float, default=50.0)  # Percentage of test traffic
    
    # Results
    recipients_count = Column(Integer, default=0)
    sent_count = Column(Integer, default=0)
    delivered_count = Column(Integer, default=0)
    opened_count = Column(Integer, default=0)
    clicked_count = Column(Integer, default=0)
    replied_count = Column(Integer, default=0)
    unsubscribed_count = Column(Integer, default=0)
    bounced_count = Column(Integer, default=0)
    
    # Calculated metrics
    open_rate = Column(Float, default=0.0)
    click_rate = Column(Float, default=0.0)
    reply_rate = Column(Float, default=0.0)
    engagement_score = Column(Float, default=0.0)
    
    # Statistical significance
    is_statistically_significant = Column(Boolean, default=False)
    confidence_level = Column(Float)
    p_value = Column(Float)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    test = relationship("ABTest", back_populates="variants", foreign_keys=[test_id])
    recipients = relationship("ABTestRecipient", back_populates="variant", cascade="all, delete-orphan")


class ABTestRecipient(Base):
    """Tracks which variant each recipient received."""
    __tablename__ = "ab_test_recipients"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    test_id = Column(UUID(as_uuid=True), ForeignKey("ab_tests.id"), nullable=False)
    variant_id = Column(UUID(as_uuid=True), ForeignKey("ab_test_variants.id"), nullable=False)
    lead_id = Column(UUID(as_uuid=True), ForeignKey("leads.id"), nullable=False)
    campaign_email_id = Column(UUID(as_uuid=True), ForeignKey("campaign_emails.id"))
    
    # Assignment details
    assigned_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    sent_at = Column(DateTime)
    
    # Tracking
    opened = Column(Boolean, default=False)
    clicked = Column(Boolean, default=False)
    replied = Column(Boolean, default=False)
    converted = Column(Boolean, default=False)
    
    # Relationships
    variant = relationship("ABTestVariant", back_populates="recipients")
    lead = relationship("Lead")
    campaign_email = relationship("CampaignEmail")


class ABTestResult(Base):
    """Stores final results and analysis of A/B tests."""
    __tablename__ = "ab_test_results"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    test_id = Column(UUID(as_uuid=True), ForeignKey("ab_tests.id"), nullable=False, unique=True)
    
    # Winner details
    winner_variant_id = Column(UUID(as_uuid=True), ForeignKey("ab_test_variants.id"))
    winner_confidence = Column(Float)
    
    # Test summary
    total_recipients = Column(Integer)
    test_duration_actual = Column(Integer)  # Actual hours the test ran
    
    # Statistical analysis
    statistical_power = Column(Float)
    effect_size = Column(Float)
    sample_size_recommendation = Column(Integer)  # For future tests
    
    # Insights
    key_findings = Column(JSON)  # Array of insights
    recommendations = Column(JSON)  # Array of recommendations
    
    # Performance lift
    lift_percentage = Column(Float)  # Winner vs control performance lift
    projected_impact = Column(JSON)  # Projected impact if rolled out to full list
    
    # Metadata
    analysis_timestamp = Column(DateTime, default=datetime.utcnow)
    analysis_version = Column(String(50))  # Version of analysis algorithm
    
    # Relationships
    test = relationship("ABTest", backref="result", uselist=False)
    winner_variant = relationship("ABTestVariant")