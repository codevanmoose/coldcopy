"""
Email warm-up system models for sender reputation building.
"""
from sqlalchemy import Column, String, Integer, Float, DateTime, Boolean, ForeignKey, JSON, Enum, Index, CheckConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime
import enum

from ..core.database import Base


class WarmupStatus(str, enum.Enum):
    """Status of warm-up account or campaign."""
    PENDING = "pending"
    WARMING = "warming"
    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"


class WarmupStrategy(str, enum.Enum):
    """Warm-up strategy types."""
    CONSERVATIVE = "conservative"  # Slow and steady
    MODERATE = "moderate"  # Balanced approach
    AGGRESSIVE = "aggressive"  # Faster ramp-up
    CUSTOM = "custom"  # User-defined


class EmailProvider(str, enum.Enum):
    """Email service providers."""
    GMAIL = "gmail"
    OUTLOOK = "outlook"
    YAHOO = "yahoo"
    CUSTOM = "custom"
    AMAZON_SES = "amazon_ses"
    SENDGRID = "sendgrid"


class WarmupPool(Base):
    """Pool of email accounts for warm-up network."""
    __tablename__ = "warmup_pools"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id"), nullable=False)
    
    # Pool details
    name = Column(String(255), nullable=False)
    description = Column(String)
    is_active = Column(Boolean, default=True)
    
    # Pool configuration
    target_size = Column(Integer, default=50)  # Target number of accounts
    current_size = Column(Integer, default=0)  # Current active accounts
    
    # Engagement settings
    min_engagement_rate = Column(Float, default=0.3)  # 30% minimum
    max_engagement_rate = Column(Float, default=0.7)  # 70% maximum
    reply_probability = Column(Float, default=0.1)  # 10% reply rate
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    workspace = relationship("Workspace")
    accounts = relationship("WarmupAccount", back_populates="pool", cascade="all, delete-orphan")
    
    # Indexes
    __table_args__ = (
        Index("idx_warmup_pools_workspace", "workspace_id"),
    )


class WarmupAccount(Base):
    """Individual email account in warm-up pool."""
    __tablename__ = "warmup_accounts"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pool_id = Column(UUID(as_uuid=True), ForeignKey("warmup_pools.id"), nullable=False)
    
    # Account details
    email = Column(String(255), nullable=False, unique=True)
    display_name = Column(String(255))
    provider = Column(Enum(EmailProvider), nullable=False)
    
    # Authentication (encrypted)
    smtp_host = Column(String(255))
    smtp_port = Column(Integer)
    smtp_username = Column(String(255))
    smtp_password_encrypted = Column(String)  # Encrypted
    imap_host = Column(String(255))
    imap_port = Column(Integer)
    
    # Status
    status = Column(Enum(WarmupStatus), default=WarmupStatus.PENDING)
    is_active = Column(Boolean, default=True)
    last_error = Column(String)
    
    # Reputation metrics
    reputation_score = Column(Float, default=50.0)  # 0-100
    sends_today = Column(Integer, default=0)
    max_sends_per_day = Column(Integer, default=10)
    
    # Activity tracking
    total_sent = Column(Integer, default=0)
    total_received = Column(Integer, default=0)
    total_opened = Column(Integer, default=0)
    total_clicked = Column(Integer, default=0)
    total_replied = Column(Integer, default=0)
    
    # Timestamps
    last_send_at = Column(DateTime)
    last_receive_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    pool = relationship("WarmupPool", back_populates="accounts")
    sent_emails = relationship("WarmupEmail", foreign_keys="WarmupEmail.sender_account_id", back_populates="sender")
    received_emails = relationship("WarmupEmail", foreign_keys="WarmupEmail.recipient_account_id", back_populates="recipient")
    
    # Constraints
    __table_args__ = (
        CheckConstraint("reputation_score >= 0 AND reputation_score <= 100"),
        CheckConstraint("max_sends_per_day > 0"),
        Index("idx_warmup_accounts_pool_status", "pool_id", "status"),
    )


class WarmupCampaign(Base):
    """Warm-up campaign for a sending domain/email."""
    __tablename__ = "warmup_campaigns"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id"), nullable=False)
    
    # Campaign details
    name = Column(String(255), nullable=False)
    email_address = Column(String(255), nullable=False)
    domain = Column(String(255), nullable=False)
    
    # Warm-up configuration
    strategy = Column(Enum(WarmupStrategy), default=WarmupStrategy.MODERATE)
    target_daily_volume = Column(Integer, default=1000)
    current_daily_limit = Column(Integer, default=10)
    
    # Progress tracking
    status = Column(Enum(WarmupStatus), default=WarmupStatus.PENDING)
    day_number = Column(Integer, default=0)
    total_days_planned = Column(Integer, default=30)
    
    # Volume ramp-up schedule
    rampup_schedule = Column(JSON)  # Daily sending limits
    """
    Example rampup_schedule:
    {
        "days": [
            {"day": 1, "limit": 10, "actual": 10},
            {"day": 2, "limit": 20, "actual": 18},
            {"day": 3, "limit": 30, "actual": 30},
            ...
        ]
    }
    """
    
    # Performance metrics
    average_open_rate = Column(Float, default=0.0)
    average_click_rate = Column(Float, default=0.0)
    bounce_rate = Column(Float, default=0.0)
    spam_rate = Column(Float, default=0.0)
    
    # IP/Domain specific
    dedicated_ip = Column(String(45))  # If using dedicated IP
    spf_valid = Column(Boolean)
    dkim_valid = Column(Boolean)
    dmarc_valid = Column(Boolean)
    
    # Timestamps
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    workspace = relationship("Workspace")
    daily_stats = relationship("WarmupDailyStat", back_populates="campaign", cascade="all, delete-orphan")
    
    # Indexes
    __table_args__ = (
        Index("idx_warmup_campaigns_workspace_status", "workspace_id", "status"),
        Index("idx_warmup_campaigns_domain", "domain"),
    )


class WarmupEmail(Base):
    """Individual warm-up email sent between accounts."""
    __tablename__ = "warmup_emails"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    campaign_id = Column(UUID(as_uuid=True), ForeignKey("warmup_campaigns.id"))
    
    # Email participants
    sender_account_id = Column(UUID(as_uuid=True), ForeignKey("warmup_accounts.id"), nullable=False)
    recipient_account_id = Column(UUID(as_uuid=True), ForeignKey("warmup_accounts.id"), nullable=False)
    
    # Email content
    subject = Column(String(500), nullable=False)
    body_text = Column(String, nullable=False)
    message_id = Column(String(255), unique=True)
    thread_id = Column(String(255))
    
    # Tracking
    sent_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    delivered_at = Column(DateTime)
    opened_at = Column(DateTime)
    clicked_at = Column(DateTime)
    replied_at = Column(DateTime)
    
    # Status
    is_delivered = Column(Boolean, default=False)
    is_opened = Column(Boolean, default=False)
    is_clicked = Column(Boolean, default=False)
    is_replied = Column(Boolean, default=False)
    is_spam = Column(Boolean, default=False)
    is_bounced = Column(Boolean, default=False)
    
    # Engagement simulation
    should_open = Column(Boolean, default=False)
    should_click = Column(Boolean, default=False)
    should_reply = Column(Boolean, default=False)
    open_delay_minutes = Column(Integer)  # When to open after delivery
    
    # Relationships
    campaign = relationship("WarmupCampaign")
    sender = relationship("WarmupAccount", foreign_keys=[sender_account_id], back_populates="sent_emails")
    recipient = relationship("WarmupAccount", foreign_keys=[recipient_account_id], back_populates="received_emails")
    
    # Indexes
    __table_args__ = (
        Index("idx_warmup_emails_campaign_sent", "campaign_id", "sent_at"),
        Index("idx_warmup_emails_sender_sent", "sender_account_id", "sent_at"),
    )


class WarmupDailyStat(Base):
    """Daily statistics for warm-up campaigns."""
    __tablename__ = "warmup_daily_stats"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    campaign_id = Column(UUID(as_uuid=True), ForeignKey("warmup_campaigns.id"), nullable=False)
    date = Column(DateTime, nullable=False)
    day_number = Column(Integer, nullable=False)
    
    # Volume metrics
    emails_sent = Column(Integer, default=0)
    emails_delivered = Column(Integer, default=0)
    emails_bounced = Column(Integer, default=0)
    emails_failed = Column(Integer, default=0)
    
    # Engagement metrics
    emails_opened = Column(Integer, default=0)
    unique_opens = Column(Integer, default=0)
    emails_clicked = Column(Integer, default=0)
    emails_replied = Column(Integer, default=0)
    
    # Reputation metrics
    spam_reports = Column(Integer, default=0)
    unsubscribes = Column(Integer, default=0)
    sender_score = Column(Float)  # External reputation score
    
    # Rates (calculated)
    delivery_rate = Column(Float, default=0.0)
    open_rate = Column(Float, default=0.0)
    click_rate = Column(Float, default=0.0)
    reply_rate = Column(Float, default=0.0)
    spam_rate = Column(Float, default=0.0)
    
    # Health indicators
    is_healthy = Column(Boolean, default=True)
    health_issues = Column(JSON)  # List of issues if any
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    campaign = relationship("WarmupCampaign", back_populates="daily_stats")
    
    # Indexes and constraints
    __table_args__ = (
        Index("idx_warmup_daily_stats_campaign_date", "campaign_id", "date", unique=True),
        CheckConstraint("delivery_rate >= 0 AND delivery_rate <= 1"),
        CheckConstraint("open_rate >= 0 AND open_rate <= 1"),
    )


class WarmupTemplate(Base):
    """Templates for warm-up email content."""
    __tablename__ = "warmup_templates"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id"), nullable=False)
    
    # Template details
    name = Column(String(255), nullable=False)
    category = Column(String(100))  # business, personal, newsletter, etc.
    
    # Content variations
    subject_lines = Column(JSON, nullable=False)  # Array of subject variations
    body_templates = Column(JSON, nullable=False)  # Array of body variations
    
    # Personalization
    variables = Column(JSON)  # Variables used in templates
    tone = Column(String(50))  # professional, casual, friendly
    
    # Usage tracking
    usage_count = Column(Integer, default=0)
    last_used_at = Column(DateTime)
    
    # Performance
    avg_open_rate = Column(Float)
    avg_reply_rate = Column(Float)
    
    # Status
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    workspace = relationship("Workspace")


class WarmupSchedule(Base):
    """Sending schedule patterns for warm-up."""
    __tablename__ = "warmup_schedules"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    campaign_id = Column(UUID(as_uuid=True), ForeignKey("warmup_campaigns.id"), nullable=False)
    
    # Schedule configuration
    timezone = Column(String(50), default="UTC")
    
    # Daily sending windows
    sending_days = Column(JSON)  # Array of days [1-7] (1=Monday)
    sending_hours = Column(JSON)  # Array of hours [0-23]
    
    # Patterns
    vary_sending_times = Column(Boolean, default=True)
    time_variance_minutes = Column(Integer, default=30)  # +/- variance
    
    # Intervals
    min_interval_minutes = Column(Integer, default=5)
    max_interval_minutes = Column(Integer, default=60)
    
    # Batch settings
    batch_size = Column(Integer, default=10)
    batch_delay_minutes = Column(Integer, default=15)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    campaign = relationship("WarmupCampaign")