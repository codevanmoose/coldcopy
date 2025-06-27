"""
Calendar integration service for booking system.
"""
import asyncio
from typing import List, Dict, Optional, Any, Tuple
from datetime import datetime, timedelta, time
import pytz
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, and_, or_, func
from sqlalchemy.orm import selectinload
import httpx
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
import msal

from ..models.calendar import (
    CalendarAccount, BookingPage, Meeting, AvailabilitySlot,
    BookingPageAnalytics, CalendarSyncLog,
    CalendarProvider, BookingStatus, MeetingType, TimeZonePreference
)
from ..utils.encryption import encrypt_data, decrypt_data
from ..utils.cache_decorators import cache_result
from ..core.config import settings


class CalendarIntegrationError(Exception):
    """Base exception for calendar integration errors."""
    pass


class CalendarService:
    """Service for calendar integration and booking management."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
        
    # Calendar Account Management
    
    async def connect_google_calendar(
        self,
        workspace_id: str,
        user_id: str,
        authorization_code: str,
        redirect_uri: str
    ) -> CalendarAccount:
        """Connect a Google Calendar account."""
        try:
            # Exchange authorization code for tokens
            token_data = await self._exchange_google_auth_code(
                authorization_code, 
                redirect_uri
            )
            
            # Get user info from Google
            user_info = await self._get_google_user_info(token_data['access_token'])
            
            # Encrypt tokens
            access_token_encrypted = await encrypt_data(token_data['access_token'])
            refresh_token_encrypted = await encrypt_data(token_data.get('refresh_token', ''))
            
            # Create calendar account
            account = CalendarAccount(
                workspace_id=workspace_id,
                user_id=user_id,
                provider=CalendarProvider.GOOGLE,
                provider_account_id=user_info['id'],
                email=user_info['email'],
                display_name=user_info.get('name', user_info['email']),
                access_token_encrypted=access_token_encrypted,
                refresh_token_encrypted=refresh_token_encrypted,
                token_expires_at=datetime.utcnow() + timedelta(seconds=token_data.get('expires_in', 3600)),
                scopes=token_data.get('scope', '').split(),
                timezone=user_info.get('timezone', 'UTC')
            )
            
            self.db.add(account)
            await self.db.commit()
            
            # Initial calendar sync
            await self._sync_google_calendars(account)
            
            return account
            
        except Exception as e:
            raise CalendarIntegrationError(f"Failed to connect Google Calendar: {str(e)}")
    
    async def connect_microsoft_calendar(
        self,
        workspace_id: str,
        user_id: str,
        authorization_code: str,
        redirect_uri: str
    ) -> CalendarAccount:
        """Connect a Microsoft Calendar account."""
        try:
            # Exchange authorization code for tokens
            token_data = await self._exchange_microsoft_auth_code(
                authorization_code,
                redirect_uri
            )
            
            # Get user info from Microsoft Graph
            user_info = await self._get_microsoft_user_info(token_data['access_token'])
            
            # Encrypt tokens
            access_token_encrypted = await encrypt_data(token_data['access_token'])
            refresh_token_encrypted = await encrypt_data(token_data.get('refresh_token', ''))
            
            # Create calendar account
            account = CalendarAccount(
                workspace_id=workspace_id,
                user_id=user_id,
                provider=CalendarProvider.MICROSOFT,
                provider_account_id=user_info['id'],
                email=user_info['mail'] or user_info['userPrincipalName'],
                display_name=user_info.get('displayName', user_info['userPrincipalName']),
                access_token_encrypted=access_token_encrypted,
                refresh_token_encrypted=refresh_token_encrypted,
                token_expires_at=datetime.utcnow() + timedelta(seconds=token_data.get('expires_in', 3600)),
                scopes=token_data.get('scope', '').split(),
                timezone=user_info.get('mailboxSettings', {}).get('timeZone', 'UTC')
            )
            
            self.db.add(account)
            await self.db.commit()
            
            # Initial calendar sync
            await self._sync_microsoft_calendars(account)
            
            return account
            
        except Exception as e:
            raise CalendarIntegrationError(f"Failed to connect Microsoft Calendar: {str(e)}")
    
    # Booking Page Management
    
    async def create_booking_page(
        self,
        workspace_id: str,
        calendar_account_id: str,
        name: str,
        slug: str,
        **kwargs
    ) -> BookingPage:
        """Create a new booking page."""
        
        # Check if slug is unique
        existing = await self.db.execute(
            select(BookingPage).where(BookingPage.slug == slug)
        )
        if existing.scalar_one_or_none():
            raise ValueError(f"Booking page slug '{slug}' already exists")
        
        # Default working hours (9 AM - 5 PM, Monday-Friday)
        default_working_hours = {
            "monday": {"enabled": True, "start": "09:00", "end": "17:00"},
            "tuesday": {"enabled": True, "start": "09:00", "end": "17:00"},
            "wednesday": {"enabled": True, "start": "09:00", "end": "17:00"},
            "thursday": {"enabled": True, "start": "09:00", "end": "17:00"},
            "friday": {"enabled": True, "start": "09:00", "end": "17:00"},
            "saturday": {"enabled": False},
            "sunday": {"enabled": False}
        }
        
        booking_page = BookingPage(
            workspace_id=workspace_id,
            calendar_account_id=calendar_account_id,
            slug=slug,
            name=name,
            working_hours=kwargs.get('working_hours', default_working_hours),
            required_fields=kwargs.get('required_fields', ["name", "email"]),
            **{k: v for k, v in kwargs.items() if k not in ['working_hours', 'required_fields']}
        )
        
        self.db.add(booking_page)
        await self.db.commit()
        
        # Generate initial availability slots
        await self._generate_availability_slots(booking_page)
        
        return booking_page
    
    async def get_available_slots(
        self,
        booking_page_id: str,
        start_date: datetime,
        end_date: datetime,
        timezone: str = "UTC"
    ) -> List[Dict[str, Any]]:
        """Get available booking slots for a date range."""
        
        booking_page = await self.db.get(BookingPage, booking_page_id)
        if not booking_page:
            raise ValueError("Booking page not found")
        
        # Get availability slots
        result = await self.db.execute(
            select(AvailabilitySlot)
            .where(
                and_(
                    AvailabilitySlot.booking_page_id == booking_page_id,
                    AvailabilitySlot.start_time >= start_date,
                    AvailabilitySlot.start_time < end_date,
                    AvailabilitySlot.is_available == True,
                    AvailabilitySlot.is_booked == False
                )
            )
            .order_by(AvailabilitySlot.start_time)
        )
        slots = result.scalars().all()
        
        # Convert to requested timezone
        target_tz = pytz.timezone(timezone)
        
        available_slots = []
        for slot in slots:
            start_local = slot.start_time.replace(tzinfo=pytz.UTC).astimezone(target_tz)
            end_local = slot.end_time.replace(tzinfo=pytz.UTC).astimezone(target_tz)
            
            available_slots.append({
                "start_time": start_local.isoformat(),
                "end_time": end_local.isoformat(),
                "timezone": timezone,
                "duration_minutes": booking_page.duration_minutes
            })
        
        return available_slots
    
    async def book_meeting(
        self,
        booking_page_id: str,
        start_time: datetime,
        attendee_name: str,
        attendee_email: str,
        timezone: str,
        **kwargs
    ) -> Meeting:
        """Book a meeting on a booking page."""
        
        booking_page = await self.db.get(
            BookingPage, 
            booking_page_id,
            options=[selectinload(BookingPage.calendar_account)]
        )
        if not booking_page:
            raise ValueError("Booking page not found")
        
        # Convert to UTC
        if timezone != "UTC":
            local_tz = pytz.timezone(timezone)
            start_time_utc = local_tz.localize(start_time).astimezone(pytz.UTC).replace(tzinfo=None)
        else:
            start_time_utc = start_time
        
        end_time_utc = start_time_utc + timedelta(minutes=booking_page.duration_minutes)
        
        # Check availability
        is_available = await self._check_slot_availability(
            booking_page_id,
            start_time_utc,
            end_time_utc
        )
        
        if not is_available:
            raise ValueError("Selected time slot is no longer available")
        
        # Create meeting
        meeting = Meeting(
            workspace_id=booking_page.workspace_id,
            booking_page_id=booking_page_id,
            calendar_account_id=booking_page.calendar_account_id,
            title=f"{booking_page.name} with {attendee_name}",
            description=kwargs.get('attendee_notes', ''),
            start_time=start_time_utc,
            end_time=end_time_utc,
            timezone=timezone,
            attendee_name=attendee_name,
            attendee_email=attendee_email,
            attendee_phone=kwargs.get('attendee_phone'),
            attendee_company=kwargs.get('attendee_company'),
            attendee_notes=kwargs.get('attendee_notes'),
            form_data=kwargs.get('form_data', {}),
            meeting_location=booking_page.meeting_location,
            booking_source=kwargs.get('booking_source', 'direct')
        )
        
        self.db.add(meeting)
        
        # Mark availability slot as booked
        await self._mark_slot_booked(booking_page_id, start_time_utc, meeting.id)
        
        # Update booking page stats
        booking_page.total_bookings += 1
        
        await self.db.commit()
        
        # Create calendar event
        try:
            await self._create_calendar_event(meeting)
        except Exception as e:
            # Log error but don't fail the booking
            print(f"Failed to create calendar event: {e}")
        
        # Send confirmation email
        if booking_page.send_confirmation_email:
            await self._send_booking_confirmation(meeting)
        
        return meeting
    
    # Availability Management
    
    async def _generate_availability_slots(
        self,
        booking_page: BookingPage,
        days_ahead: int = 60
    ):
        """Generate availability slots for a booking page."""
        
        # Clear existing future slots
        await self.db.execute(
            select(AvailabilitySlot)
            .where(
                and_(
                    AvailabilitySlot.booking_page_id == booking_page.id,
                    AvailabilitySlot.start_time >= datetime.utcnow()
                )
            )
        )
        
        # Get calendar account for timezone
        calendar_account = await self.db.get(CalendarAccount, booking_page.calendar_account_id)
        page_tz = pytz.timezone(booking_page.timezone)
        
        # Generate slots for each day
        for day_offset in range(days_ahead):
            date = datetime.utcnow().date() + timedelta(days=day_offset)
            
            # Skip if before minimum notice
            if day_offset == 0:
                min_notice_time = datetime.utcnow() + timedelta(hours=booking_page.min_notice_hours)
            else:
                min_notice_time = None
            
            await self._generate_slots_for_date(
                booking_page,
                date,
                page_tz,
                min_notice_time
            )
        
        await self.db.commit()
    
    async def _generate_slots_for_date(
        self,
        booking_page: BookingPage,
        date: datetime.date,
        timezone: pytz.BaseTzInfo,
        min_notice_time: Optional[datetime] = None
    ):
        """Generate availability slots for a specific date."""
        
        # Get day of week (0=Monday, 6=Sunday)
        weekday = date.weekday()
        day_names = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
        day_name = day_names[weekday]
        
        # Check if this day is enabled
        day_config = booking_page.working_hours.get(day_name, {})
        if not day_config.get("enabled", False):
            return
        
        # Parse working hours
        start_time_str = day_config.get("start", "09:00")
        end_time_str = day_config.get("end", "17:00")
        
        start_hour, start_minute = map(int, start_time_str.split(":"))
        end_hour, end_minute = map(int, end_time_str.split(":"))
        
        # Create datetime objects in the booking page's timezone
        start_datetime = timezone.localize(
            datetime.combine(date, time(start_hour, start_minute))
        )
        end_datetime = timezone.localize(
            datetime.combine(date, time(end_hour, end_minute))
        )
        
        # Generate 15-minute slots
        slot_duration = timedelta(minutes=15)
        meeting_duration = timedelta(minutes=booking_page.duration_minutes)
        
        current_time = start_datetime
        while current_time + meeting_duration <= end_datetime:
            slot_end = current_time + meeting_duration
            
            # Convert to UTC for storage
            slot_start_utc = current_time.astimezone(pytz.UTC).replace(tzinfo=None)
            slot_end_utc = slot_end.astimezone(pytz.UTC).replace(tzinfo=None)
            
            # Check minimum notice requirement
            if min_notice_time and slot_start_utc < min_notice_time:
                current_time += slot_duration
                continue
            
            # Create availability slot
            slot = AvailabilitySlot(
                booking_page_id=booking_page.id,
                start_time=slot_start_utc,
                end_time=slot_end_utc,
                timezone=str(timezone),
                expires_at=datetime.utcnow() + timedelta(hours=24)  # Recompute daily
            )
            
            self.db.add(slot)
            current_time += slot_duration
    
    async def _check_slot_availability(
        self,
        booking_page_id: str,
        start_time: datetime,
        end_time: datetime
    ) -> bool:
        """Check if a time slot is available for booking."""
        
        # Check if slot exists and is available
        result = await self.db.execute(
            select(AvailabilitySlot)
            .where(
                and_(
                    AvailabilitySlot.booking_page_id == booking_page_id,
                    AvailabilitySlot.start_time == start_time,
                    AvailabilitySlot.end_time == end_time,
                    AvailabilitySlot.is_available == True,
                    AvailabilitySlot.is_booked == False
                )
            )
        )
        
        return result.scalar_one_or_none() is not None
    
    async def _mark_slot_booked(
        self,
        booking_page_id: str,
        start_time: datetime,
        meeting_id: str
    ):
        """Mark an availability slot as booked."""
        
        await self.db.execute(
            update(AvailabilitySlot)
            .where(
                and_(
                    AvailabilitySlot.booking_page_id == booking_page_id,
                    AvailabilitySlot.start_time == start_time
                )
            )
            .values(is_booked=True, meeting_id=meeting_id)
        )
    
    # Calendar Provider Integration
    
    async def _exchange_google_auth_code(
        self,
        auth_code: str,
        redirect_uri: str
    ) -> Dict[str, Any]:
        """Exchange Google authorization code for access tokens."""
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "code": auth_code,
                    "client_id": settings.GOOGLE_CLIENT_ID,
                    "client_secret": settings.GOOGLE_CLIENT_SECRET,
                    "redirect_uri": redirect_uri,
                    "grant_type": "authorization_code"
                }
            )
            response.raise_for_status()
            return response.json()
    
    async def _get_google_user_info(self, access_token: str) -> Dict[str, Any]:
        """Get Google user information."""
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://www.googleapis.com/oauth2/v2/userinfo",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            response.raise_for_status()
            return response.json()
    
    async def _sync_google_calendars(self, account: CalendarAccount):
        """Sync calendar list from Google."""
        
        try:
            # Get access token
            access_token = await decrypt_data(account.access_token_encrypted)
            
            # Build Google Calendar service
            credentials = Credentials(token=access_token)
            service = build('calendar', 'v3', credentials=credentials)
            
            # Get calendar list
            calendar_list = service.calendarList().list().execute()
            
            # Update account with calendar information
            account.calendar_list = calendar_list.get('items', [])
            if not account.default_calendar_id and calendar_list.get('items'):
                # Set primary calendar as default
                for cal in calendar_list['items']:
                    if cal.get('primary'):
                        account.default_calendar_id = cal['id']
                        break
            
            account.last_sync_at = datetime.utcnow()
            await self.db.commit()
            
        except Exception as e:
            account.sync_error = str(e)
            await self.db.commit()
            raise
    
    async def _exchange_microsoft_auth_code(
        self,
        auth_code: str,
        redirect_uri: str
    ) -> Dict[str, Any]:
        """Exchange Microsoft authorization code for access tokens."""
        
        app = msal.ConfidentialClientApplication(
            settings.MICROSOFT_CLIENT_ID,
            authority=f"https://login.microsoftonline.com/common",
            client_credential=settings.MICROSOFT_CLIENT_SECRET
        )
        
        result = app.acquire_token_by_authorization_code(
            auth_code,
            scopes=["https://graph.microsoft.com/calendars.readwrite"],
            redirect_uri=redirect_uri
        )
        
        if "error" in result:
            raise CalendarIntegrationError(f"Microsoft auth error: {result['error_description']}")
        
        return result
    
    async def _get_microsoft_user_info(self, access_token: str) -> Dict[str, Any]:
        """Get Microsoft user information."""
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://graph.microsoft.com/v1.0/me",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            response.raise_for_status()
            return response.json()
    
    async def _sync_microsoft_calendars(self, account: CalendarAccount):
        """Sync calendar list from Microsoft."""
        
        try:
            # Get access token
            access_token = await decrypt_data(account.access_token_encrypted)
            
            # Get calendar list from Microsoft Graph
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    "https://graph.microsoft.com/v1.0/me/calendars",
                    headers={"Authorization": f"Bearer {access_token}"}
                )
                response.raise_for_status()
                calendar_data = response.json()
            
            # Update account with calendar information
            account.calendar_list = calendar_data.get('value', [])
            if not account.default_calendar_id and calendar_data.get('value'):
                # Set default calendar
                account.default_calendar_id = calendar_data['value'][0]['id']
            
            account.last_sync_at = datetime.utcnow()
            await self.db.commit()
            
        except Exception as e:
            account.sync_error = str(e)
            await self.db.commit()
            raise
    
    async def _create_calendar_event(self, meeting: Meeting):
        """Create calendar event for a meeting."""
        
        # Get calendar account
        calendar_account = await self.db.get(CalendarAccount, meeting.calendar_account_id)
        if not calendar_account:
            raise ValueError("Calendar account not found")
        
        if calendar_account.provider == CalendarProvider.GOOGLE:
            await self._create_google_event(meeting, calendar_account)
        elif calendar_account.provider == CalendarProvider.MICROSOFT:
            await self._create_microsoft_event(meeting, calendar_account)
    
    async def _create_google_event(self, meeting: Meeting, account: CalendarAccount):
        """Create Google Calendar event."""
        
        access_token = await decrypt_data(account.access_token_encrypted)
        credentials = Credentials(token=access_token)
        service = build('calendar', 'v3', credentials=credentials)
        
        # Format datetime for Google Calendar
        start_time_iso = meeting.start_time.isoformat() + 'Z'
        end_time_iso = meeting.end_time.isoformat() + 'Z'
        
        event = {
            'summary': meeting.title,
            'description': meeting.description,
            'start': {'dateTime': start_time_iso, 'timeZone': 'UTC'},
            'end': {'dateTime': end_time_iso, 'timeZone': 'UTC'},
            'attendees': [
                {'email': meeting.attendee_email, 'displayName': meeting.attendee_name}
            ],
            'reminders': {
                'useDefault': False,
                'overrides': [
                    {'method': 'email', 'minutes': 60},
                    {'method': 'popup', 'minutes': 10}
                ]
            }
        }
        
        if meeting.meeting_location:
            event['location'] = meeting.meeting_location
        
        # Create event
        created_event = service.events().insert(
            calendarId=account.default_calendar_id or 'primary',
            body=event,
            sendUpdates='all'
        ).execute()
        
        # Update meeting with calendar event ID
        meeting.calendar_event_id = created_event['id']
        meeting.calendar_sync_status = 'synced'
        await self.db.commit()
    
    async def _create_microsoft_event(self, meeting: Meeting, account: CalendarAccount):
        """Create Microsoft Calendar event."""
        
        access_token = await decrypt_data(account.access_token_encrypted)
        
        event = {
            "subject": meeting.title,
            "body": {
                "contentType": "HTML",
                "content": meeting.description or ""
            },
            "start": {
                "dateTime": meeting.start_time.isoformat(),
                "timeZone": "UTC"
            },
            "end": {
                "dateTime": meeting.end_time.isoformat(), 
                "timeZone": "UTC"
            },
            "attendees": [
                {
                    "emailAddress": {
                        "address": meeting.attendee_email,
                        "name": meeting.attendee_name
                    },
                    "type": "required"
                }
            ]
        }
        
        if meeting.meeting_location:
            event["location"] = {"displayName": meeting.meeting_location}
        
        # Create event
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"https://graph.microsoft.com/v1.0/me/calendars/{account.default_calendar_id}/events",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json"
                },
                json=event
            )
            response.raise_for_status()
            created_event = response.json()
        
        # Update meeting with calendar event ID
        meeting.calendar_event_id = created_event['id']
        meeting.calendar_sync_status = 'synced'
        await self.db.commit()
    
    async def _send_booking_confirmation(self, meeting: Meeting):
        """Send booking confirmation email."""
        # TODO: Integrate with email service
        pass
    
    # Analytics
    
    @cache_result(ttl=300, namespace="booking_analytics")
    async def get_booking_page_analytics(
        self,
        booking_page_id: str,
        start_date: datetime,
        end_date: datetime
    ) -> Dict[str, Any]:
        """Get analytics for a booking page."""
        
        # Get meetings in date range
        result = await self.db.execute(
            select(Meeting)
            .where(
                and_(
                    Meeting.booking_page_id == booking_page_id,
                    Meeting.booked_at >= start_date,
                    Meeting.booked_at < end_date
                )
            )
        )
        meetings = result.scalars().all()
        
        # Calculate metrics
        total_bookings = len(meetings)
        completed_meetings = len([m for m in meetings if m.status == BookingStatus.COMPLETED])
        no_shows = len([m for m in meetings if m.status == BookingStatus.NO_SHOW])
        cancellations = len([m for m in meetings if m.status == BookingStatus.CANCELLED])
        
        # Get booking page
        booking_page = await self.db.get(BookingPage, booking_page_id)
        
        return {
            "total_bookings": total_bookings,
            "completed_meetings": completed_meetings,
            "no_shows": no_shows,
            "cancellations": cancellations,
            "completion_rate": completed_meetings / total_bookings if total_bookings > 0 else 0,
            "no_show_rate": no_shows / total_bookings if total_bookings > 0 else 0,
            "booking_page_name": booking_page.name if booking_page else "Unknown"
        }