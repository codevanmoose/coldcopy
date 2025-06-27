"""
Pipedrive activity models
"""
from typing import Optional, Dict, Any, List
from datetime import datetime, date, time
from pydantic import BaseModel, Field
from enum import Enum


class ActivityType(str, Enum):
    """Standard Pipedrive activity types"""
    CALL = "call"
    MEETING = "meeting"
    TASK = "task"
    DEADLINE = "deadline"
    EMAIL = "email"
    LUNCH = "lunch"


class PipedriveActivityType(BaseModel):
    """Activity type configuration"""
    id: int
    name: str
    icon_key: ActivityType
    color: Optional[str] = None
    order_nr: int
    is_custom_flag: bool = False
    active_flag: bool = True
    add_time: Optional[datetime] = None
    update_time: Optional[datetime] = None


class PipedriveActivity(BaseModel):
    """Pipedrive Activity model"""
    id: Optional[int] = None
    
    # Basic info
    subject: str
    type: str  # Activity type key
    done: bool = False
    
    # Timing
    due_date: date
    due_time: Optional[time] = None
    duration: Optional[str] = None  # Format: "HH:MM"
    add_time: Optional[datetime] = None
    update_time: Optional[datetime] = None
    marked_as_done_time: Optional[datetime] = None
    
    # Related entities
    user_id: int  # Assigned to
    deal_id: Optional[int] = None
    person_id: Optional[int] = None
    org_id: Optional[int] = None
    
    # Additional info
    note: Optional[str] = None
    location: Optional[str] = None
    public_description: Optional[str] = None
    
    # Participants
    participants: List[Dict[str, Any]] = []  # [{"person_id": 1, "primary_flag": true}]
    
    # Conference details
    conference_meeting_client: Optional[str] = None
    conference_meeting_url: Optional[str] = None
    conference_meeting_id: Optional[str] = None
    
    # Busy flag
    busy_flag: bool = False
    
    # Metadata
    created_by_user_id: Optional[int] = None
    
    # Custom fields
    custom_fields: Dict[str, Any] = {}
    
    # ColdCopy mapping
    coldcopy_email_event_id: Optional[str] = None
    workspace_id: Optional[str] = None


class ActivityStats(BaseModel):
    """Activity statistics for a deal/person"""
    activities_count: int = 0
    done_activities_count: int = 0
    undone_activities_count: int = 0
    reference_activities_count: int = 0
    overdue_activities_count: int = 0
    planned_activities_count: int = 0