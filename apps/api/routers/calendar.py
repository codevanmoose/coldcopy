"""
API endpoints for calendar integration and booking system.
"""
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field, EmailStr, validator
from datetime import datetime, date, timedelta
from uuid import UUID
import pytz

from ..core.database import get_db
from ..core.security import get_current_user
from ..models.user import User
from ..models.calendar import (
    CalendarProvider, BookingStatus, MeetingType, TimeZonePreference
)
from ..services.calendar_service import CalendarService, CalendarIntegrationError


router = APIRouter(prefix="/api/calendar", tags=["Calendar & Booking"])


# Request/Response Models

class ConnectCalendarRequest(BaseModel):
    """Connect calendar account request."""
    provider: CalendarProvider
    authorization_code: str
    redirect_uri: str


class CalendarAccountResponse(BaseModel):
    """Calendar account response."""
    id: UUID
    provider: CalendarProvider
    email: str
    display_name: str
    is_primary: bool
    is_active: bool
    timezone: str
    sync_enabled: bool
    last_sync_at: Optional[datetime]
    sync_error: Optional[str]
    calendar_list: Optional[List[Dict]]
    connected_at: datetime


class CreateBookingPageRequest(BaseModel):
    """Create booking page request."""
    calendar_account_id: UUID
    name: str = Field(..., max_length=255)
    slug: str = Field(..., max_length=100, regex=r"^[a-z0-9-]+$")
    description: Optional[str] = None
    meeting_type: MeetingType = MeetingType.DISCOVERY_CALL
    duration_minutes: int = Field(30, ge=15, le=480)
    
    # Availability settings
    timezone: str = "UTC"
    timezone_preference: TimeZonePreference = TimeZonePreference.DETECT_AUTOMATICALLY
    working_hours: Dict[str, Any] = Field(default_factory=dict)
    
    # Booking restrictions
    min_notice_hours: int = Field(24, ge=0)
    max_advance_days: int = Field(60, ge=1, le=365)
    max_bookings_per_day: Optional[int] = Field(None, ge=1)
    
    # Form configuration
    required_fields: List[str] = Field(default_factory=lambda: ["name", "email"])
    custom_fields: List[Dict] = Field(default_factory=list)
    
    # Branding
    brand_color: Optional[str] = Field(None, regex=r"^#[0-9A-Fa-f]{6}$")
    logo_url: Optional[str] = None
    
    # Confirmation settings
    confirmation_message: Optional[str] = None
    redirect_url: Optional[str] = None
    
    # Meeting platform
    meeting_location: Optional[str] = None
    auto_generate_meeting_link: bool = False
    meeting_platform: Optional[str] = None

    @validator('working_hours', pre=True, always=True)
    def validate_working_hours(cls, v):
        if not v:
            # Default working hours
            return {
                "monday": {"enabled": True, "start": "09:00", "end": "17:00"},
                "tuesday": {"enabled": True, "start": "09:00", "end": "17:00"},
                "wednesday": {"enabled": True, "start": "09:00", "end": "17:00"},
                "thursday": {"enabled": True, "start": "09:00", "end": "17:00"},
                "friday": {"enabled": True, "start": "09:00", "end": "17:00"},
                "saturday": {"enabled": False},
                "sunday": {"enabled": False}
            }
        return v


class UpdateBookingPageRequest(BaseModel):
    """Update booking page request."""
    name: Optional[str] = None
    description: Optional[str] = None
    duration_minutes: Optional[int] = Field(None, ge=15, le=480)
    working_hours: Optional[Dict[str, Any]] = None
    min_notice_hours: Optional[int] = Field(None, ge=0)
    max_advance_days: Optional[int] = Field(None, ge=1, le=365)
    is_active: Optional[bool] = None
    brand_color: Optional[str] = Field(None, regex=r"^#[0-9A-Fa-f]{6}$")
    meeting_location: Optional[str] = None


class BookingPageResponse(BaseModel):
    """Booking page response."""
    id: UUID
    slug: str
    name: str
    description: Optional[str]
    meeting_type: MeetingType
    duration_minutes: int
    timezone: str
    working_hours: Dict[str, Any]
    min_notice_hours: int
    max_advance_days: int
    required_fields: List[str]
    custom_fields: List[Dict]
    brand_color: Optional[str]
    logo_url: Optional[str]
    meeting_location: Optional[str]
    is_active: bool
    total_bookings: int
    calendar_account_email: str
    created_at: datetime


class AvailabilityRequest(BaseModel):
    """Get availability request."""
    start_date: date
    end_date: date
    timezone: str = "UTC"


class AvailabilitySlotResponse(BaseModel):
    """Available time slot response."""
    start_time: str  # ISO format
    end_time: str    # ISO format
    timezone: str
    duration_minutes: int


class BookMeetingRequest(BaseModel):
    """Book meeting request."""
    start_time: datetime
    timezone: str
    attendee_name: str = Field(..., max_length=255)
    attendee_email: EmailStr
    attendee_phone: Optional[str] = Field(None, max_length=50)
    attendee_company: Optional[str] = Field(None, max_length=255)
    attendee_notes: Optional[str] = None
    form_data: Dict[str, Any] = Field(default_factory=dict)
    booking_source: str = "direct"
    utm_source: Optional[str] = None
    utm_campaign: Optional[str] = None
    utm_medium: Optional[str] = None


class MeetingResponse(BaseModel):
    """Meeting response."""
    id: UUID
    title: str
    start_time: datetime
    end_time: datetime
    timezone: str
    attendee_name: str
    attendee_email: str
    attendee_phone: Optional[str]
    attendee_company: Optional[str]
    meeting_location: Optional[str]
    meeting_link: Optional[str]
    status: BookingStatus
    booking_page_name: str
    confirmation_sent_at: Optional[datetime]
    booked_at: datetime


class RescheduleRequest(BaseModel):
    """Reschedule meeting request."""
    new_start_time: datetime
    timezone: str
    reason: Optional[str] = None


class BookingAnalyticsResponse(BaseModel):
    """Booking analytics response."""
    total_bookings: int
    completed_meetings: int
    no_shows: int
    cancellations: int
    completion_rate: float
    no_show_rate: float
    booking_page_name: str


# Calendar Account Endpoints

@router.post("/accounts/connect", response_model=CalendarAccountResponse)
async def connect_calendar_account(
    request: ConnectCalendarRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Connect a calendar account."""
    service = CalendarService(db)
    
    try:
        if request.provider == CalendarProvider.GOOGLE:
            account = await service.connect_google_calendar(
                workspace_id=current_user.workspace_id,
                user_id=current_user.id,
                authorization_code=request.authorization_code,
                redirect_uri=request.redirect_uri
            )
        elif request.provider in [CalendarProvider.MICROSOFT, CalendarProvider.OUTLOOK, CalendarProvider.OFFICE365]:
            account = await service.connect_microsoft_calendar(
                workspace_id=current_user.workspace_id,
                user_id=current_user.id,
                authorization_code=request.authorization_code,
                redirect_uri=request.redirect_uri
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Provider {request.provider} not yet supported"
            )
        
        return CalendarAccountResponse(
            id=account.id,
            provider=account.provider,
            email=account.email,
            display_name=account.display_name,
            is_primary=account.is_primary,
            is_active=account.is_active,
            timezone=account.timezone,
            sync_enabled=account.sync_enabled,
            last_sync_at=account.last_sync_at,
            sync_error=account.sync_error,
            calendar_list=account.calendar_list,
            connected_at=account.connected_at
        )
        
    except CalendarIntegrationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/accounts", response_model=List[CalendarAccountResponse])
async def list_calendar_accounts(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List connected calendar accounts."""
    from sqlalchemy import select
    from ..models.calendar import CalendarAccount
    
    result = await db.execute(
        select(CalendarAccount)
        .where(CalendarAccount.user_id == current_user.id)
        .order_by(CalendarAccount.is_primary.desc(), CalendarAccount.connected_at.desc())
    )
    accounts = result.scalars().all()
    
    return [
        CalendarAccountResponse(
            id=account.id,
            provider=account.provider,
            email=account.email,
            display_name=account.display_name,
            is_primary=account.is_primary,
            is_active=account.is_active,
            timezone=account.timezone,
            sync_enabled=account.sync_enabled,
            last_sync_at=account.last_sync_at,
            sync_error=account.sync_error,
            calendar_list=account.calendar_list,
            connected_at=account.connected_at
        )
        for account in accounts
    ]


@router.delete("/accounts/{account_id}")
async def disconnect_calendar_account(
    account_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Disconnect a calendar account."""
    from ..models.calendar import CalendarAccount
    
    account = await db.get(CalendarAccount, str(account_id))
    if not account or account.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Calendar account not found"
        )
    
    await db.delete(account)
    await db.commit()
    
    return {"message": "Calendar account disconnected successfully"}


# Booking Page Endpoints

@router.post("/booking-pages", response_model=BookingPageResponse)
async def create_booking_page(
    request: CreateBookingPageRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new booking page."""
    service = CalendarService(db)
    
    # Verify calendar account belongs to user
    from ..models.calendar import CalendarAccount
    calendar_account = await db.get(CalendarAccount, str(request.calendar_account_id))
    if not calendar_account or calendar_account.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Calendar account not found"
        )
    
    try:
        booking_page = await service.create_booking_page(
            workspace_id=current_user.workspace_id,
            calendar_account_id=str(request.calendar_account_id),
            name=request.name,
            slug=request.slug,
            description=request.description,
            meeting_type=request.meeting_type,
            duration_minutes=request.duration_minutes,
            timezone=request.timezone,
            timezone_preference=request.timezone_preference,
            working_hours=request.working_hours,
            min_notice_hours=request.min_notice_hours,
            max_advance_days=request.max_advance_days,
            max_bookings_per_day=request.max_bookings_per_day,
            required_fields=request.required_fields,
            custom_fields=request.custom_fields,
            brand_color=request.brand_color,
            logo_url=request.logo_url,
            confirmation_message=request.confirmation_message,
            redirect_url=request.redirect_url,
            meeting_location=request.meeting_location,
            auto_generate_meeting_link=request.auto_generate_meeting_link,
            meeting_platform=request.meeting_platform
        )
        
        return BookingPageResponse(
            id=booking_page.id,
            slug=booking_page.slug,
            name=booking_page.name,
            description=booking_page.description,
            meeting_type=booking_page.meeting_type,
            duration_minutes=booking_page.duration_minutes,
            timezone=booking_page.timezone,
            working_hours=booking_page.working_hours,
            min_notice_hours=booking_page.min_notice_hours,
            max_advance_days=booking_page.max_advance_days,
            required_fields=booking_page.required_fields,
            custom_fields=booking_page.custom_fields,
            brand_color=booking_page.brand_color,
            logo_url=booking_page.logo_url,
            meeting_location=booking_page.meeting_location,
            is_active=booking_page.is_active,
            total_bookings=booking_page.total_bookings,
            calendar_account_email=calendar_account.email,
            created_at=booking_page.created_at
        )
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/booking-pages", response_model=List[BookingPageResponse])
async def list_booking_pages(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List booking pages for the current user."""
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    from ..models.calendar import BookingPage, CalendarAccount
    
    result = await db.execute(
        select(BookingPage)
        .join(CalendarAccount)
        .where(CalendarAccount.user_id == current_user.id)
        .options(selectinload(BookingPage.calendar_account))
        .order_by(BookingPage.created_at.desc())
    )
    booking_pages = result.scalars().all()
    
    return [
        BookingPageResponse(
            id=page.id,
            slug=page.slug,
            name=page.name,
            description=page.description,
            meeting_type=page.meeting_type,
            duration_minutes=page.duration_minutes,
            timezone=page.timezone,
            working_hours=page.working_hours,
            min_notice_hours=page.min_notice_hours,
            max_advance_days=page.max_advance_days,
            required_fields=page.required_fields,
            custom_fields=page.custom_fields,
            brand_color=page.brand_color,
            logo_url=page.logo_url,
            meeting_location=page.meeting_location,
            is_active=page.is_active,
            total_bookings=page.total_bookings,
            calendar_account_email=page.calendar_account.email,
            created_at=page.created_at
        )
        for page in booking_pages
    ]


@router.get("/booking-pages/{page_id}", response_model=BookingPageResponse)
async def get_booking_page(
    page_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific booking page."""
    from sqlalchemy.orm import selectinload
    from ..models.calendar import BookingPage, CalendarAccount
    
    booking_page = await db.get(
        BookingPage,
        str(page_id),
        options=[selectinload(BookingPage.calendar_account)]
    )
    
    if not booking_page or booking_page.calendar_account.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking page not found"
        )
    
    return BookingPageResponse(
        id=booking_page.id,
        slug=booking_page.slug,
        name=booking_page.name,
        description=booking_page.description,
        meeting_type=booking_page.meeting_type,
        duration_minutes=booking_page.duration_minutes,
        timezone=booking_page.timezone,
        working_hours=booking_page.working_hours,
        min_notice_hours=booking_page.min_notice_hours,
        max_advance_days=booking_page.max_advance_days,
        required_fields=booking_page.required_fields,
        custom_fields=booking_page.custom_fields,
        brand_color=booking_page.brand_color,
        logo_url=booking_page.logo_url,
        meeting_location=booking_page.meeting_location,
        is_active=booking_page.is_active,
        total_bookings=booking_page.total_bookings,
        calendar_account_email=booking_page.calendar_account.email,
        created_at=booking_page.created_at
    )


@router.patch("/booking-pages/{page_id}", response_model=BookingPageResponse)
async def update_booking_page(
    page_id: UUID,
    request: UpdateBookingPageRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a booking page."""
    from sqlalchemy.orm import selectinload
    from ..models.calendar import BookingPage, CalendarAccount
    
    booking_page = await db.get(
        BookingPage,
        str(page_id),
        options=[selectinload(BookingPage.calendar_account)]
    )
    
    if not booking_page or booking_page.calendar_account.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking page not found"
        )
    
    # Update fields
    update_data = request.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(booking_page, field, value)
    
    await db.commit()
    
    return BookingPageResponse(
        id=booking_page.id,
        slug=booking_page.slug,
        name=booking_page.name,
        description=booking_page.description,
        meeting_type=booking_page.meeting_type,
        duration_minutes=booking_page.duration_minutes,
        timezone=booking_page.timezone,
        working_hours=booking_page.working_hours,
        min_notice_hours=booking_page.min_notice_hours,
        max_advance_days=booking_page.max_advance_days,
        required_fields=booking_page.required_fields,
        custom_fields=booking_page.custom_fields,
        brand_color=booking_page.brand_color,
        logo_url=booking_page.logo_url,
        meeting_location=booking_page.meeting_location,
        is_active=booking_page.is_active,
        total_bookings=booking_page.total_bookings,
        calendar_account_email=booking_page.calendar_account.email,
        created_at=booking_page.created_at
    )


@router.delete("/booking-pages/{page_id}")
async def delete_booking_page(
    page_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a booking page."""
    from ..models.calendar import BookingPage, CalendarAccount
    
    booking_page = await db.get(BookingPage, str(page_id))
    if not booking_page:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking page not found"
        )
    
    # Verify ownership
    calendar_account = await db.get(CalendarAccount, booking_page.calendar_account_id)
    if not calendar_account or calendar_account.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking page not found"
        )
    
    await db.delete(booking_page)
    await db.commit()
    
    return {"message": "Booking page deleted successfully"}


# Public Booking Endpoints (no authentication required)

@router.get("/public/{slug}/availability", response_model=List[AvailabilitySlotResponse])
async def get_public_availability(
    slug: str,
    request: AvailabilityRequest = Depends(),
    db: AsyncSession = Depends(get_db)
):
    """Get available time slots for a booking page (public endpoint)."""
    from sqlalchemy import select
    from ..models.calendar import BookingPage
    
    # Get booking page by slug
    result = await db.execute(
        select(BookingPage).where(
            and_(
                BookingPage.slug == slug,
                BookingPage.is_active == True
            )
        )
    )
    booking_page = result.scalar_one_or_none()
    
    if not booking_page:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking page not found"
        )
    
    # Get availability
    service = CalendarService(db)
    
    start_datetime = datetime.combine(request.start_date, datetime.min.time())
    end_datetime = datetime.combine(request.end_date, datetime.max.time())
    
    slots = await service.get_available_slots(
        booking_page_id=str(booking_page.id),
        start_date=start_datetime,
        end_date=end_datetime,
        timezone=request.timezone
    )
    
    return [
        AvailabilitySlotResponse(
            start_time=slot["start_time"],
            end_time=slot["end_time"],
            timezone=slot["timezone"],
            duration_minutes=slot["duration_minutes"]
        )
        for slot in slots
    ]


@router.post("/public/{slug}/book", response_model=MeetingResponse)
async def book_public_meeting(
    slug: str,
    request: BookMeetingRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """Book a meeting on a public booking page."""
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    from ..models.calendar import BookingPage
    
    # Get booking page by slug
    result = await db.execute(
        select(BookingPage)
        .where(
            and_(
                BookingPage.slug == slug,
                BookingPage.is_active == True
            )
        )
        .options(selectinload(BookingPage.calendar_account))
    )
    booking_page = result.scalar_one_or_none()
    
    if not booking_page:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking page not found"
        )
    
    # Book meeting
    service = CalendarService(db)
    
    try:
        meeting = await service.book_meeting(
            booking_page_id=str(booking_page.id),
            start_time=request.start_time,
            attendee_name=request.attendee_name,
            attendee_email=request.attendee_email,
            timezone=request.timezone,
            attendee_phone=request.attendee_phone,
            attendee_company=request.attendee_company,
            attendee_notes=request.attendee_notes,
            form_data=request.form_data,
            booking_source=request.booking_source,
            utm_source=request.utm_source,
            utm_campaign=request.utm_campaign,
            utm_medium=request.utm_medium
        )
        
        return MeetingResponse(
            id=meeting.id,
            title=meeting.title,
            start_time=meeting.start_time,
            end_time=meeting.end_time,
            timezone=meeting.timezone,
            attendee_name=meeting.attendee_name,
            attendee_email=meeting.attendee_email,
            attendee_phone=meeting.attendee_phone,
            attendee_company=meeting.attendee_company,
            meeting_location=meeting.meeting_location,
            meeting_link=meeting.meeting_link,
            status=meeting.status,
            booking_page_name=booking_page.name,
            confirmation_sent_at=meeting.confirmation_sent_at,
            booked_at=meeting.booked_at
        )
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


# Meeting Management

@router.get("/meetings", response_model=List[MeetingResponse])
async def list_meetings(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    status: Optional[BookingStatus] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List meetings for the current user."""
    from sqlalchemy import select, and_
    from sqlalchemy.orm import selectinload
    from ..models.calendar import Meeting, BookingPage, CalendarAccount
    
    # Build query
    query = (
        select(Meeting)
        .join(BookingPage)
        .join(CalendarAccount)
        .where(CalendarAccount.user_id == current_user.id)
        .options(selectinload(Meeting.booking_page))
    )
    
    # Add filters
    conditions = []
    if start_date:
        conditions.append(Meeting.start_time >= datetime.combine(start_date, datetime.min.time()))
    if end_date:
        conditions.append(Meeting.start_time < datetime.combine(end_date, datetime.max.time()))
    if status:
        conditions.append(Meeting.status == status)
    
    if conditions:
        query = query.where(and_(*conditions))
    
    query = query.order_by(Meeting.start_time.desc())
    
    result = await db.execute(query)
    meetings = result.scalars().all()
    
    return [
        MeetingResponse(
            id=meeting.id,
            title=meeting.title,
            start_time=meeting.start_time,
            end_time=meeting.end_time,
            timezone=meeting.timezone,
            attendee_name=meeting.attendee_name,
            attendee_email=meeting.attendee_email,
            attendee_phone=meeting.attendee_phone,
            attendee_company=meeting.attendee_company,
            meeting_location=meeting.meeting_location,
            meeting_link=meeting.meeting_link,
            status=meeting.status,
            booking_page_name=meeting.booking_page.name,
            confirmation_sent_at=meeting.confirmation_sent_at,
            booked_at=meeting.booked_at
        )
        for meeting in meetings
    ]


@router.patch("/meetings/{meeting_id}/reschedule", response_model=MeetingResponse)
async def reschedule_meeting(
    meeting_id: UUID,
    request: RescheduleRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Reschedule a meeting."""
    from sqlalchemy.orm import selectinload
    from ..models.calendar import Meeting, BookingPage, CalendarAccount
    
    # Get meeting with ownership check
    meeting = await db.get(
        Meeting,
        str(meeting_id),
        options=[
            selectinload(Meeting.booking_page),
            selectinload(Meeting.calendar_account)
        ]
    )
    
    if not meeting or meeting.calendar_account.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meeting not found"
        )
    
    # TODO: Implement rescheduling logic
    # This would involve:
    # 1. Checking availability of new time slot
    # 2. Updating calendar event
    # 3. Sending reschedule notifications
    
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Rescheduling not yet implemented"
    )


@router.patch("/meetings/{meeting_id}/cancel")
async def cancel_meeting(
    meeting_id: UUID,
    reason: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Cancel a meeting."""
    from sqlalchemy.orm import selectinload
    from ..models.calendar import Meeting, CalendarAccount
    
    # Get meeting with ownership check
    meeting = await db.get(
        Meeting,
        str(meeting_id),
        options=[selectinload(Meeting.calendar_account)]
    )
    
    if not meeting or meeting.calendar_account.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meeting not found"
        )
    
    # Update meeting status
    meeting.status = BookingStatus.CANCELLED
    if reason:
        meeting.internal_notes = f"Cancelled: {reason}"
    
    await db.commit()
    
    # TODO: Cancel calendar event and send notifications
    
    return {"message": "Meeting cancelled successfully"}


# Analytics

@router.get("/booking-pages/{page_id}/analytics", response_model=BookingAnalyticsResponse)
async def get_booking_page_analytics(
    page_id: UUID,
    start_date: date = Query(...),
    end_date: date = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get analytics for a booking page."""
    from ..models.calendar import BookingPage, CalendarAccount
    
    # Verify ownership
    booking_page = await db.get(BookingPage, str(page_id))
    if not booking_page:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking page not found"
        )
    
    calendar_account = await db.get(CalendarAccount, booking_page.calendar_account_id)
    if not calendar_account or calendar_account.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking page not found"
        )
    
    # Get analytics
    service = CalendarService(db)
    
    start_datetime = datetime.combine(start_date, datetime.min.time())
    end_datetime = datetime.combine(end_date, datetime.max.time())
    
    analytics = await service.get_booking_page_analytics(
        booking_page_id=str(page_id),
        start_date=start_datetime,
        end_date=end_datetime
    )
    
    return BookingAnalyticsResponse(**analytics)