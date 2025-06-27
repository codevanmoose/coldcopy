"""
Calendar and booking system models.
"""
from sqlalchemy import Column, String, Integer, Float, DateTime, Boolean, ForeignKey, JSON, Enum, Index, CheckConstraint, Text
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime, timedelta
import enum

from ..core.database import Base


class CalendarProvider(str, enum.Enum):
    """Calendar service providers."""
    GOOGLE = "google"
    MICROSOFT = "microsoft"
    OUTLOOK = "outlook"
    OFFICE365 = "office365"
    APPLE = "apple"
    CALDAV = "caldav"
    EXCHANGE = "exchange"


class BookingStatus(str, enum.Enum):
    """Meeting booking status."""
    SCHEDULED = "scheduled"
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"
    COMPLETED = "completed"
    NO_SHOW = "no_show"
    RESCHEDULED = "rescheduled"


class MeetingType(str, enum.Enum):
    """Types of meetings."""
    DISCOVERY_CALL = "discovery_call"
    DEMO = "demo"
    CONSULTATION = "consultation"
    FOLLOW_UP = "follow_up"
    CLOSING_CALL = "closing_call"
    ONBOARDING = "onboarding"
    CUSTOM = "custom"


class TimeZonePreference(str, enum.Enum):
    """Timezone handling preferences."""
    DETECT_AUTOMATICALLY = "detect_automatically"
    USE_BOOKING_PAGE_DEFAULT = "use_booking_page_default"
    LET_ATTENDEE_CHOOSE = "let_attendee_choose"


class CalendarAccount(Base):
    """Connected calendar accounts for users."""
    __tablename__ = "calendar_accounts"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    # Provider details
    provider = Column(Enum(CalendarProvider), nullable=False)
    provider_account_id = Column(String(255), nullable=False)  # Provider's user ID
    email = Column(String(255), nullable=False)
    display_name = Column(String(255))
    
    # Authentication
    access_token_encrypted = Column(Text)  # Encrypted OAuth token
    refresh_token_encrypted = Column(Text)  # Encrypted refresh token
    token_expires_at = Column(DateTime)
    scopes = Column(JSON)  # Granted OAuth scopes
    
    # Configuration
    is_primary = Column(Boolean, default=False)  # Primary calendar for this user
    is_active = Column(Boolean, default=True)
    timezone = Column(String(100), default="UTC")
    
    # Sync settings
    sync_enabled = Column(Boolean, default=True)
    last_sync_at = Column(DateTime)
    sync_error = Column(String)
    
    # Calendar metadata
    calendar_list = Column(JSON)  # Available calendars from provider
    default_calendar_id = Column(String(255))  # Which calendar to use for bookings
    
    # Timestamps
    connected_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    workspace = relationship("Workspace")
    user = relationship("User")
    booking_pages = relationship("BookingPage", back_populates="calendar_account")
    meetings = relationship("Meeting", back_populates="calendar_account")
    
    # Indexes
    __table_args__ = (
        Index("idx_calendar_accounts_workspace_user", "workspace_id", "user_id"),
        Index("idx_calendar_accounts_provider_account", "provider", "provider_account_id"),
    )


class BookingPage(Base):
    """Customizable booking pages for different meeting types."""
    __tablename__ = "booking_pages"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id"), nullable=False)
    calendar_account_id = Column(UUID(as_uuid=True), ForeignKey("calendar_accounts.id"), nullable=False)
    
    # Page identification
    slug = Column(String(100), nullable=False)  # URL slug: /book/john-doe/demo
    name = Column(String(255), nullable=False)
    description = Column(Text)
    
    # Meeting configuration
    meeting_type = Column(Enum(MeetingType), default=MeetingType.DISCOVERY_CALL)
    duration_minutes = Column(Integer, default=30)
    buffer_before_minutes = Column(Integer, default=0)  # Buffer before meeting
    buffer_after_minutes = Column(Integer, default=0)   # Buffer after meeting
    
    # Availability settings
    timezone = Column(String(100), default="UTC")
    timezone_preference = Column(Enum(TimeZonePreference), default=TimeZonePreference.DETECT_AUTOMATICALLY)
    
    # Working hours (JSON array of day configurations)
    working_hours = Column(JSON, nullable=False)
    """
    Example working_hours:
    {
        "monday": {"enabled": true, "start": "09:00", "end": "17:00"},
        "tuesday": {"enabled": true, "start": "09:00", "end": "17:00"},
        "wednesday": {"enabled": true, "start": "09:00", "end": "17:00"},
        "thursday": {"enabled": true, "start": "09:00", "end": "17:00"},
        "friday": {"enabled": true, "start": "09:00", "end": "17:00"},
        "saturday": {"enabled": false},
        "sunday": {"enabled": false}
    }
    """
    
    # Booking restrictions
    min_notice_hours = Column(Integer, default=24)      # Minimum advance notice
    max_advance_days = Column(Integer, default=60)      # How far ahead can book
    max_bookings_per_day = Column(Integer)              # Daily booking limit
    
    # Custom availability
    date_overrides = Column(JSON)  # Specific date availability overrides
    blackout_dates = Column(JSON)  # Dates when booking is unavailable
    
    # Form fields
    required_fields = Column(JSON, default=list)  # Required form fields
    """
    Example required_fields:
    ["name", "email", "company", "phone", "message"]
    """
    
    custom_fields = Column(JSON, default=list)  # Custom form fields
    """
    Example custom_fields:
    [
        {"name": "company_size", "label": "Company Size", "type": "select", 
         "options": ["1-10", "11-50", "51-200", "200+"], "required": true},
        {"name": "budget", "label": "Budget Range", "type": "text", "required": false}
    ]
    """
    
    # Branding and customization
    brand_color = Column(String(7))  # Hex color
    logo_url = Column(String(500))
    custom_css = Column(Text)
    
    # Confirmation settings
    confirmation_message = Column(Text)
    redirect_url = Column(String(500))  # Redirect after booking
    
    # Integration settings
    send_calendar_invite = Column(Boolean, default=True)
    send_confirmation_email = Column(Boolean, default=True)
    send_reminder_email = Column(Boolean, default=True)
    reminder_hours_before = Column(Integer, default=24)
    
    # Meeting platform
    meeting_location = Column(String(500))  # Zoom, Meet, address, etc.
    auto_generate_meeting_link = Column(Boolean, default=False)
    meeting_platform = Column(String(50))  # zoom, google_meet, teams, etc.
    
    # Status and analytics
    is_active = Column(Boolean, default=True)
    total_bookings = Column(Integer, default=0)
    total_no_shows = Column(Integer, default=0)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    workspace = relationship("Workspace")
    calendar_account = relationship("CalendarAccount", back_populates="booking_pages")
    meetings = relationship("Meeting", back_populates="booking_page")
    
    # Constraints
    __table_args__ = (
        CheckConstraint("duration_minutes > 0 AND duration_minutes <= 480"),  # Max 8 hours
        CheckConstraint("min_notice_hours >= 0"),
        CheckConstraint("max_advance_days > 0"),
        Index("idx_booking_pages_workspace", "workspace_id"),
        Index("idx_booking_pages_slug", "slug", unique=True),
    )


class Meeting(Base):
    """Scheduled meetings from booking pages."""
    __tablename__ = "meetings"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id"), nullable=False)
    booking_page_id = Column(UUID(as_uuid=True), ForeignKey("booking_pages.id"), nullable=False)
    calendar_account_id = Column(UUID(as_uuid=True), ForeignKey("calendar_accounts.id"), nullable=False)
    
    # Meeting details
    title = Column(String(255), nullable=False)
    description = Column(Text)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    timezone = Column(String(100), nullable=False)
    
    # Attendee information
    attendee_name = Column(String(255), nullable=False)
    attendee_email = Column(String(255), nullable=False)
    attendee_phone = Column(String(50))
    attendee_company = Column(String(255))
    attendee_notes = Column(Text)
    
    # Custom form data
    form_data = Column(JSON)  # Responses to custom fields
    
    # Meeting platform
    meeting_location = Column(String(500))
    meeting_link = Column(String(500))  # Generated Zoom/Meet link
    meeting_platform = Column(String(50))
    meeting_platform_id = Column(String(255))  # Platform's meeting ID
    
    # Calendar integration
    calendar_event_id = Column(String(255))  # Provider's event ID
    calendar_sync_status = Column(String(50), default="pending")
    
    # Status tracking
    status = Column(Enum(BookingStatus), default=BookingStatus.SCHEDULED)
    confirmation_sent_at = Column(DateTime)
    reminder_sent_at = Column(DateTime)
    
    # Lead integration
    lead_id = Column(UUID(as_uuid=True), ForeignKey("leads.id"))
    campaign_id = Column(UUID(as_uuid=True), ForeignKey("campaigns.id"))
    
    # Rescheduling
    original_meeting_id = Column(UUID(as_uuid=True), ForeignKey("meetings.id"))
    reschedule_count = Column(Integer, default=0)
    
    # Analytics and tracking
    booking_source = Column(String(100))  # email, direct, etc.
    utm_source = Column(String(100))
    utm_campaign = Column(String(100))
    utm_medium = Column(String(100))
    
    # Feedback and outcomes
    meeting_outcome = Column(String(100))  # qualified, not_qualified, follow_up, etc.
    attendee_feedback = Column(Text)
    internal_notes = Column(Text)
    
    # Timestamps
    booked_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    workspace = relationship("Workspace")
    booking_page = relationship("BookingPage", back_populates="meetings")
    calendar_account = relationship("CalendarAccount", back_populates="meetings")
    lead = relationship("Lead")
    campaign = relationship("Campaign")
    original_meeting = relationship("Meeting", remote_side=[id])
    
    # Indexes
    __table_args__ = (
        Index("idx_meetings_workspace_start", "workspace_id", "start_time"),
        Index("idx_meetings_attendee_email", "attendee_email"),
        Index("idx_meetings_calendar_event", "calendar_event_id"),
        Index("idx_meetings_status_start", "status", "start_time"),
    )


class AvailabilitySlot(Base):
    """Pre-computed availability slots for faster booking."""
    __tablename__ = "availability_slots"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    booking_page_id = Column(UUID(as_uuid=True), ForeignKey("booking_pages.id"), nullable=False)
    
    # Slot details
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    timezone = Column(String(100), nullable=False)
    
    # Availability status
    is_available = Column(Boolean, default=True)
    is_booked = Column(Boolean, default=False)
    meeting_id = Column(UUID(as_uuid=True), ForeignKey("meetings.id"))
    
    # Metadata
    computed_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=False)  # When to recompute
    
    # Relationships
    booking_page = relationship("BookingPage")
    meeting = relationship("Meeting")
    
    # Indexes
    __table_args__ = (
        Index("idx_availability_slots_page_time", "booking_page_id", "start_time"),
        Index("idx_availability_slots_available", "booking_page_id", "is_available", "start_time"),
    )


class BookingPageAnalytics(Base):
    """Analytics for booking page performance."""
    __tablename__ = "booking_page_analytics"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    booking_page_id = Column(UUID(as_uuid=True), ForeignKey("booking_pages.id"), nullable=False)
    date = Column(DateTime, nullable=False)
    
    # Traffic metrics
    page_views = Column(Integer, default=0)
    unique_visitors = Column(Integer, default=0)
    
    # Conversion metrics
    bookings_started = Column(Integer, default=0)
    bookings_completed = Column(Integer, default=0)
    conversion_rate = Column(Float, default=0.0)
    
    # Meeting metrics
    meetings_scheduled = Column(Integer, default=0)
    meetings_completed = Column(Integer, default=0)
    no_shows = Column(Integer, default=0)
    cancellations = Column(Integer, default=0)
    
    # Revenue attribution
    qualified_leads = Column(Integer, default=0)
    estimated_revenue = Column(Float, default=0.0)
    
    # Source attribution
    source_breakdown = Column(JSON)  # Traffic sources
    """
    Example source_breakdown:
    {
        "email": {"views": 50, "bookings": 5},
        "direct": {"views": 30, "bookings": 8},
        "social": {"views": 20, "bookings": 2}
    }
    """
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    booking_page = relationship("BookingPage")
    
    # Indexes
    __table_args__ = (
        Index("idx_booking_analytics_page_date", "booking_page_id", "date", unique=True),
    )


class CalendarSyncLog(Base):
    """Log of calendar synchronization events."""
    __tablename__ = "calendar_sync_logs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    calendar_account_id = Column(UUID(as_uuid=True), ForeignKey("calendar_accounts.id"), nullable=False)
    
    # Sync details
    sync_type = Column(String(50), nullable=False)  # full, incremental, webhook
    started_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    completed_at = Column(DateTime)
    
    # Results
    status = Column(String(50), nullable=False)  # success, error, partial
    events_processed = Column(Integer, default=0)
    events_created = Column(Integer, default=0)
    events_updated = Column(Integer, default=0)
    events_deleted = Column(Integer, default=0)
    
    # Error handling
    error_message = Column(Text)
    error_code = Column(String(100))
    
    # Metadata
    sync_token = Column(String(500))  # For incremental syncs
    
    # Relationships
    calendar_account = relationship("CalendarAccount")
    
    # Indexes
    __table_args__ = (
        Index("idx_calendar_sync_logs_account_started", "calendar_account_id", "started_at"),
    )