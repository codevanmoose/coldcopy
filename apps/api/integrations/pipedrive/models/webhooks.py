"""
Pipedrive webhook models
"""
from typing import Optional, Dict, Any, List
from datetime import datetime
from pydantic import BaseModel, Field
from enum import Enum


class WebhookAction(str, Enum):
    """Webhook action types"""
    ADDED = "added"
    UPDATED = "updated"
    MERGED = "merged"
    DELETED = "deleted"


class WebhookObject(str, Enum):
    """Webhook object types"""
    ACTIVITY = "activity"
    ACTIVITY_TYPE = "activityType"
    DEAL = "deal"
    NOTE = "note"
    ORGANIZATION = "organization"
    PERSON = "person"
    PIPELINE = "pipeline"
    PRODUCT = "product"
    STAGE = "stage"
    USER = "user"


class PipedriveWebhookEvent(BaseModel):
    """Pipedrive webhook event payload"""
    v: int = 1  # API version
    matches_filters: Optional[Dict[str, Any]] = None
    meta: Dict[str, Any]
    
    # Event details
    event: str  # Format: "object.action" e.g., "deal.added"
    object: WebhookObject
    action: WebhookAction
    
    # Timestamp
    event_timestamp: datetime = Field(default_factory=datetime.utcnow)
    
    # Data
    current: Optional[Dict[str, Any]] = None
    previous: Optional[Dict[str, Any]] = None
    
    # Additional metadata
    user_id: Optional[int] = None
    company_id: Optional[int] = None
    
    @property
    def object_id(self) -> Optional[int]:
        """Extract object ID from current data"""
        if self.current and "id" in self.current:
            return self.current["id"]
        return None


class PipedriveWebhook(BaseModel):
    """Webhook subscription configuration"""
    id: Optional[str] = None
    company_id: int
    owner_id: int
    user_id: int
    event_action: str  # "*" for all actions
    event_object: str  # "*" for all objects
    subscription_url: str
    is_active: int  # 0 or 1
    add_time: datetime
    update_time: Optional[datetime] = None
    remove_time: Optional[datetime] = None
    type: str = "webhook"
    http_auth_user: Optional[str] = None
    http_auth_password: Optional[str] = None
    
    # ColdCopy metadata
    workspace_id: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)