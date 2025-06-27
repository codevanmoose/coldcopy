"""
Security utilities and authentication.
"""
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, Optional, Set
from uuid import UUID

import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from passlib.context import CryptContext
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import get_settings
from core.database import get_db
from models.user import User
from services.user_service import UserService

logger = logging.getLogger(__name__)

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT token scheme
security = HTTPBearer()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hash a password."""
    return pwd_context.hash(password)


def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token."""
    settings = get_settings()
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(hours=24)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm="HS256")
    return encoded_jwt


def verify_token(token: str) -> Dict[str, Any]:
    """Verify and decode a JWT token."""
    settings = get_settings()
    
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired"
        )
    except jwt.JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials"
        )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> User:
    """Get the current authenticated user."""
    token = credentials.credentials
    payload = verify_token(token)
    
    user_id: str = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials"
        )
    
    try:
        user_uuid = UUID(user_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user ID format"
        )
    
    user_service = UserService(db)
    user = await user_service.get_user_by_id(user_uuid)
    
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
    
    return user


async def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """Get the current active user."""
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    return current_user


def require_workspace_access(workspace_id: UUID):
    """Dependency to check workspace access."""
    async def _check_workspace_access(
        current_user: User = Depends(get_current_active_user)
    ) -> User:
        if current_user.workspace_id != workspace_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to workspace"
            )
        return current_user
    
    return _check_workspace_access


def require_role(required_role: str):
    """Dependency to check user role."""
    async def _check_role(
        current_user: User = Depends(get_current_active_user)
    ) -> User:
        if current_user.role != required_role and current_user.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{required_role}' required"
            )
        return current_user
    
    return _check_role


def require_permissions(required_permissions: Set[str]):
    """Dependency to check user permissions."""
    async def _check_permissions(
        current_user: User = Depends(get_current_active_user)
    ) -> User:
        user_permissions = get_role_permissions(current_user.role)
        
        if not required_permissions.issubset(user_permissions):
            missing_permissions = required_permissions - user_permissions
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing permissions: {', '.join(missing_permissions)}"
            )
        return current_user
    
    return _check_permissions


def get_role_permissions(role: str) -> Set[str]:
    """Get permissions for a given role."""
    role_permissions = {
        "admin": {
            "workspaces:read", "workspaces:write", "workspaces:delete",
            "users:read", "users:write", "users:delete",
            "campaigns:read", "campaigns:write", "campaigns:delete",
            "leads:read", "leads:write", "leads:delete",
            "analytics:read", "billing:read", "gdpr:read", "gdpr:write"
        },
        "owner": {
            "workspaces:read", "workspaces:write",
            "users:read", "users:write", "users:delete",
            "campaigns:read", "campaigns:write", "campaigns:delete",
            "leads:read", "leads:write", "leads:delete",
            "analytics:read", "billing:read", "gdpr:read", "gdpr:write"
        },
        "manager": {
            "campaigns:read", "campaigns:write", "campaigns:delete",
            "leads:read", "leads:write", "leads:delete",
            "analytics:read", "gdpr:read"
        },
        "user": {
            "campaigns:read", "campaigns:write",
            "leads:read", "leads:write",
            "analytics:read"
        },
        "viewer": {
            "campaigns:read", "leads:read", "analytics:read"
        }
    }
    
    return role_permissions.get(role, set())


async def get_current_user_with_workspace(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Get current user with workspace information."""
    user = await get_current_user(credentials, db)
    user_service = UserService(db)
    workspace = await user_service.get_workspace_by_id(user.workspace_id)
    
    return {
        "user": user,
        "workspace": workspace,
        "permissions": get_role_permissions(user.role)
    }


class OptionalBearer(HTTPBearer):
    """Optional Bearer token for endpoints that work with and without auth."""
    
    async def __call__(self, request: Request) -> Optional[HTTPAuthorizationCredentials]:
        try:
            return await super().__call__(request)
        except HTTPException:
            return None


optional_security = OptionalBearer()


async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(optional_security),
    db: AsyncSession = Depends(get_db)
) -> Optional[User]:
    """Get current user if authenticated, otherwise None."""
    if not credentials:
        return None
    
    try:
        return await get_current_user(credentials, db)
    except HTTPException:
        return None


def create_refresh_token(user_id: UUID, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT refresh token."""
    settings = get_settings()
    to_encode = {"sub": str(user_id), "type": "refresh"}
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(days=30)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm="HS256")
    return encoded_jwt


def verify_refresh_token(token: str) -> UUID:
    """Verify refresh token and return user ID."""
    payload = verify_token(token)
    
    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type"
        )
    
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload"
        )
    
    try:
        return UUID(user_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user ID format"
        )


async def authenticate_api_key(
    request: Request,
    db: AsyncSession = Depends(get_db)
) -> Optional[User]:
    """Authenticate using API key from header."""
    api_key = request.headers.get("X-API-Key")
    if not api_key:
        return None
    
    user_service = UserService(db)
    user = await user_service.get_user_by_api_key(api_key)
    
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key"
        )
    
    return user


class AuthenticationMiddleware:
    """Middleware for handling authentication context."""
    
    def __init__(self, app):
        self.app = app
    
    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        
        request = Request(scope, receive)
        
        # Add authentication context to request state
        request.state.user = None
        request.state.workspace = None
        request.state.permissions = set()
        
        # Try API key authentication first
        try:
            db = next(get_db())
            user = await authenticate_api_key(request, db)
            if user:
                user_service = UserService(db)
                workspace = await user_service.get_workspace_by_id(user.workspace_id)
                request.state.user = user
                request.state.workspace = workspace
                request.state.permissions = get_role_permissions(user.role)
        except Exception as e:
            logger.debug(f"API key authentication failed: {e}")
        
        await self.app(scope, receive, send)