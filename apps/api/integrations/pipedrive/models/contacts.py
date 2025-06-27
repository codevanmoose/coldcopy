"""
Pipedrive contact models (Person and Organization)
"""
from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field


class PipedriveCustomField(BaseModel):
    """Custom field definition"""
    key: str
    name: str
    field_type: str
    value: Any


class PipedrivePerson(BaseModel):
    """Pipedrive Person (contact) model"""
    id: Optional[int] = None
    name: str
    email: List[Dict[str, str]] = []  # [{"value": "email@example.com", "primary": true}]
    phone: List[Dict[str, str]] = []  # [{"value": "+1234567890", "primary": true}]
    org_id: Optional[int] = None
    org_name: Optional[str] = None
    owner_id: Optional[int] = None
    
    # Additional fields
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    job_title: Optional[str] = None
    label: Optional[int] = None  # Label ID
    
    # Contact info
    im: List[Dict[str, str]] = []  # Instant messaging
    
    # Tracking
    open_deals_count: int = 0
    closed_deals_count: int = 0
    won_deals_count: int = 0
    lost_deals_count: int = 0
    activities_count: int = 0
    done_activities_count: int = 0
    
    # Metadata
    add_time: Optional[datetime] = None
    update_time: Optional[datetime] = None
    visible_to: str = "3"  # 1=owner, 3=entire company
    
    # Custom fields (dynamic)
    custom_fields: Dict[str, Any] = {}
    
    # ColdCopy mapping
    coldcopy_lead_id: Optional[str] = None
    workspace_id: Optional[str] = None


class PipedriveOrganization(BaseModel):
    """Pipedrive Organization (company) model"""
    id: Optional[int] = None
    name: str
    owner_id: Optional[int] = None
    
    # Company details
    address: Optional[str] = None
    address_locality: Optional[str] = None
    address_country: Optional[str] = None
    address_postal_code: Optional[str] = None
    
    # Contact info
    cc_email: Optional[str] = None
    
    # Tracking
    people_count: int = 0
    open_deals_count: int = 0
    closed_deals_count: int = 0
    won_deals_count: int = 0
    lost_deals_count: int = 0
    activities_count: int = 0
    done_activities_count: int = 0
    
    # Metadata
    add_time: Optional[datetime] = None
    update_time: Optional[datetime] = None
    visible_to: str = "3"
    
    # Custom fields
    custom_fields: Dict[str, Any] = {}
    
    # ColdCopy mapping
    workspace_id: Optional[str] = None


class PersonOrganizationLink(BaseModel):
    """Link between Person and Organization"""
    person_id: int
    org_id: int
    job_title: Optional[str] = None
    is_primary: bool = True