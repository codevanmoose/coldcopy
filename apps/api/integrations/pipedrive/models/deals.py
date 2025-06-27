"""
Pipedrive deal models
"""
from typing import Optional, Dict, Any, List
from datetime import datetime, date
from decimal import Decimal
from pydantic import BaseModel, Field
from enum import Enum


class DealStatus(str, Enum):
    """Deal status in Pipedrive"""
    OPEN = "open"
    WON = "won"
    LOST = "lost"
    DELETED = "deleted"


class PipedriveStage(BaseModel):
    """Pipeline stage model"""
    id: int
    name: str
    pipeline_id: int
    pipeline_name: Optional[str] = None
    order_nr: int
    deal_probability: Optional[int] = None  # 0-100
    active_flag: bool = True
    rotten_flag: bool = False
    rotten_days: Optional[int] = None


class PipedrivePipeline(BaseModel):
    """Sales pipeline model"""
    id: int
    name: str
    url_title: str
    order_nr: int
    active: bool = True
    deal_probability: bool = False
    add_time: datetime
    update_time: Optional[datetime] = None
    stages: List[PipedriveStage] = []


class PipedriveDeal(BaseModel):
    """Pipedrive Deal model"""
    id: Optional[int] = None
    title: str
    value: Optional[Decimal] = None
    currency: str = "USD"
    
    # Related entities
    user_id: Optional[int] = None  # Owner
    person_id: Optional[int] = None
    org_id: Optional[int] = None
    
    # Pipeline info
    stage_id: int
    pipeline_id: Optional[int] = None
    
    # Status
    status: DealStatus = DealStatus.OPEN
    lost_reason: Optional[str] = None
    
    # Timing
    add_time: Optional[datetime] = None
    update_time: Optional[datetime] = None
    stage_change_time: Optional[datetime] = None
    close_time: Optional[datetime] = None
    won_time: Optional[datetime] = None
    lost_time: Optional[datetime] = None
    expected_close_date: Optional[date] = None
    
    # Probability
    probability: Optional[int] = None  # 0-100
    
    # Activity tracking
    activities_count: int = 0
    done_activities_count: int = 0
    undone_activities_count: int = 0
    
    # Email tracking
    email_messages_count: int = 0
    
    # Additional info
    visible_to: str = "3"
    
    # Custom fields
    custom_fields: Dict[str, Any] = {}
    
    # ColdCopy mapping
    coldcopy_campaign_id: Optional[str] = None
    workspace_id: Optional[str] = None


class DealField(BaseModel):
    """Custom deal field definition"""
    id: int
    key: str
    name: str
    field_type: str
    edit_flag: bool = True
    active_flag: bool = True
    is_subfield: bool = False
    mandatory_flag: bool = False