"""
Pipedrive authentication models
"""
from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field


class PipedriveAuth(BaseModel):
    """Pipedrive OAuth authentication data"""
    workspace_id: str
    access_token: str
    refresh_token: str
    expires_at: datetime
    api_domain: str  # e.g., "mycompany.pipedrive.com"
    company_id: int
    user_id: int
    scope: str = "admin"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    is_active: bool = True


class PipedriveTokenResponse(BaseModel):
    """Pipedrive OAuth token response"""
    access_token: str
    token_type: str = "Bearer"
    refresh_token: str
    scope: str
    expires_in: int
    api_domain: str


class PipedriveOAuthState(BaseModel):
    """OAuth state for security"""
    workspace_id: str
    user_id: str
    redirect_uri: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class PipedriveConnectionStatus(BaseModel):
    """Connection status for UI"""
    is_connected: bool
    api_domain: Optional[str] = None
    company_name: Optional[str] = None
    user_name: Optional[str] = None
    last_sync: Optional[datetime] = None
    total_persons: Optional[int] = None
    total_deals: Optional[int] = None
    total_activities: Optional[int] = None