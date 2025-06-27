"""
Pipedrive OAuth authentication service
"""
import secrets
import logging
from typing import Optional, Dict, Any
from datetime import datetime, timedelta
from urllib.parse import urlencode
import httpx

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from core.config import get_settings
from models.workspace import Workspace
from utils.cache_manager import CacheManager, CacheNamespace
from ..models.auth import PipedriveAuth, PipedriveTokenResponse, PipedriveOAuthState

logger = logging.getLogger(__name__)


class PipedriveAuthService:
    """Handle Pipedrive OAuth authentication flow"""
    
    OAUTH_BASE_URL = "https://oauth.pipedrive.com"
    API_BASE_URL = "https://api.pipedrive.com/v1"
    
    def __init__(self, db: AsyncSession, cache: Optional[CacheManager] = None):
        self.db = db
        self.cache = cache
        self.settings = get_settings()
        self.client_id = self.settings.PIPEDRIVE_CLIENT_ID
        self.client_secret = self.settings.PIPEDRIVE_CLIENT_SECRET
        self.redirect_uri = f"{self.settings.APP_URL}/integrations/pipedrive/callback"
    
    async def generate_oauth_url(self, workspace_id: str, user_id: str) -> str:
        """Generate OAuth authorization URL"""
        # Create state for security
        state = secrets.token_urlsafe(32)
        
        # Store state in cache
        state_data = PipedriveOAuthState(
            workspace_id=workspace_id,
            user_id=user_id,
            redirect_uri=self.redirect_uri
        )
        
        if self.cache:
            await self.cache.set(
                f"pipedrive_oauth_state:{state}",
                state_data.dict(),
                ttl=600,  # 10 minutes
                namespace=CacheNamespace.USER_SESSIONS
            )
        
        # Build OAuth URL
        params = {
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "response_type": "code",
            "state": state,
            "scope": "admin"  # Full access
        }
        
        return f"{self.OAUTH_BASE_URL}/authorize?{urlencode(params)}"
    
    async def exchange_code_for_token(
        self,
        code: str,
        state: str
    ) -> Optional[PipedriveAuth]:
        """Exchange authorization code for access token"""
        try:
            # Verify state
            state_data = None
            if self.cache:
                cached_state = await self.cache.get(
                    f"pipedrive_oauth_state:{state}",
                    namespace=CacheNamespace.USER_SESSIONS
                )
                if cached_state:
                    state_data = PipedriveOAuthState(**cached_state)
                    # Delete used state
                    await self.cache.delete(
                        f"pipedrive_oauth_state:{state}",
                        namespace=CacheNamespace.USER_SESSIONS
                    )
            
            if not state_data:
                logger.error("Invalid OAuth state")
                return None
            
            # Exchange code for token
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.OAUTH_BASE_URL}/token",
                    data={
                        "grant_type": "authorization_code",
                        "code": code,
                        "redirect_uri": self.redirect_uri,
                        "client_id": self.client_id,
                        "client_secret": self.client_secret
                    }
                )
                
                if response.status_code != 200:
                    logger.error(f"Token exchange failed: {response.text}")
                    return None
                
                token_data = PipedriveTokenResponse(**response.json())
                
                # Get user info to store company details
                user_info = await self._get_user_info(token_data.access_token)
                
                # Create auth record
                auth = PipedriveAuth(
                    workspace_id=state_data.workspace_id,
                    access_token=token_data.access_token,
                    refresh_token=token_data.refresh_token,
                    expires_at=datetime.utcnow() + timedelta(seconds=token_data.expires_in),
                    api_domain=token_data.api_domain,
                    company_id=user_info.get("company_id", 0),
                    user_id=user_info.get("id", 0),
                    scope=token_data.scope
                )
                
                # Store in database
                await self._store_auth(auth)
                
                # Invalidate any cached connection status
                if self.cache:
                    await self.cache.delete(
                        f"pipedrive_connection:{state_data.workspace_id}",
                        namespace=CacheNamespace.WORKSPACE_SETTINGS
                    )
                
                return auth
                
        except Exception as e:
            logger.error(f"Error exchanging code for token: {e}")
            return None
    
    async def refresh_access_token(self, workspace_id: str) -> Optional[PipedriveAuth]:
        """Refresh expired access token"""
        try:
            # Get current auth
            auth = await self.get_auth(workspace_id)
            if not auth:
                return None
            
            # Refresh token
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.OAUTH_BASE_URL}/token",
                    data={
                        "grant_type": "refresh_token",
                        "refresh_token": auth.refresh_token,
                        "client_id": self.client_id,
                        "client_secret": self.client_secret
                    }
                )
                
                if response.status_code != 200:
                    logger.error(f"Token refresh failed: {response.text}")
                    return None
                
                token_data = PipedriveTokenResponse(**response.json())
                
                # Update auth record
                auth.access_token = token_data.access_token
                auth.refresh_token = token_data.refresh_token
                auth.expires_at = datetime.utcnow() + timedelta(seconds=token_data.expires_in)
                auth.updated_at = datetime.utcnow()
                
                # Store updated auth
                await self._store_auth(auth)
                
                return auth
                
        except Exception as e:
            logger.error(f"Error refreshing token: {e}")
            return None
    
    async def get_auth(self, workspace_id: str) -> Optional[PipedriveAuth]:
        """Get Pipedrive auth for workspace"""
        # Check cache first
        if self.cache:
            cached = await self.cache.get(
                f"pipedrive_auth:{workspace_id}",
                namespace=CacheNamespace.WORKSPACE_SETTINGS
            )
            if cached:
                return PipedriveAuth(**cached)
        
        # Query database
        query = select(Workspace).where(Workspace.id == workspace_id)
        result = await self.db.execute(query)
        workspace = result.scalar_one_or_none()
        
        if not workspace or not workspace.integrations.get("pipedrive"):
            return None
        
        auth_data = workspace.integrations["pipedrive"]
        auth = PipedriveAuth(**auth_data)
        
        # Check if token needs refresh
        if auth.expires_at <= datetime.utcnow() + timedelta(minutes=5):
            auth = await self.refresh_access_token(workspace_id)
        
        # Cache the auth
        if auth and self.cache:
            await self.cache.set(
                f"pipedrive_auth:{workspace_id}",
                auth.dict(),
                ttl=300,  # 5 minutes
                namespace=CacheNamespace.WORKSPACE_SETTINGS
            )
        
        return auth
    
    async def disconnect(self, workspace_id: str) -> bool:
        """Disconnect Pipedrive integration"""
        try:
            # Remove from database
            query = update(Workspace).where(
                Workspace.id == workspace_id
            ).values(
                integrations=Workspace.integrations.op("-")("pipedrive"),
                updated_at=datetime.utcnow()
            )
            await self.db.execute(query)
            await self.db.commit()
            
            # Clear cache
            if self.cache:
                await self.cache.delete(
                    f"pipedrive_auth:{workspace_id}",
                    namespace=CacheNamespace.WORKSPACE_SETTINGS
                )
                await self.cache.delete(
                    f"pipedrive_connection:{workspace_id}",
                    namespace=CacheNamespace.WORKSPACE_SETTINGS
                )
            
            return True
            
        except Exception as e:
            logger.error(f"Error disconnecting Pipedrive: {e}")
            return False
    
    async def _store_auth(self, auth: PipedriveAuth):
        """Store auth in database"""
        # Update workspace integrations
        query = select(Workspace).where(Workspace.id == auth.workspace_id)
        result = await self.db.execute(query)
        workspace = result.scalar_one_or_none()
        
        if workspace:
            if not workspace.integrations:
                workspace.integrations = {}
            
            workspace.integrations["pipedrive"] = auth.dict()
            workspace.updated_at = datetime.utcnow()
            
            await self.db.commit()
    
    async def _get_user_info(self, access_token: str) -> Dict[str, Any]:
        """Get current user info from Pipedrive"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.API_BASE_URL}/users/me",
                    params={"api_token": access_token}
                )
                
                if response.status_code == 200:
                    data = response.json()
                    return data.get("data", {})
                    
        except Exception as e:
            logger.error(f"Error getting user info: {e}")
        
        return {}