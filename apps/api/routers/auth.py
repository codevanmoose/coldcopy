"""
Authentication endpoints.
"""
from datetime import timedelta
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import (
    create_access_token,
    create_refresh_token,
    get_current_active_user,
    get_current_user_with_workspace,
    verify_password,
    verify_refresh_token
)
from models.user import User
from services.user_service import UserService

router = APIRouter()


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = 86400  # 24 hours


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class UserWithWorkspaceResponse(BaseModel):
    user: Dict[str, Any]
    workspace: Dict[str, Any]
    permissions: List[str]


@router.post("/login", response_model=TokenResponse)
async def login(
    login_data: LoginRequest,
    db: AsyncSession = Depends(get_db)
) -> TokenResponse:
    """User login endpoint with refresh token support."""
    user_service = UserService(db)
    user = await user_service.get_user_by_email(login_data.email)
    
    if not user or not verify_password(login_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    
    # Create access and refresh tokens
    access_token_expires = timedelta(hours=24)
    access_token = create_access_token(
        data={"sub": str(user.id)},
        expires_delta=access_token_expires
    )
    
    refresh_token = create_refresh_token(user.id)
    
    # Update last login timestamp
    await user_service.update_last_login(user.id)
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token
    )


@router.post("/login/oauth", response_model=Dict[str, Any])
async def login_oauth(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """OAuth2 compatible login endpoint."""
    user_service = UserService(db)
    user = await user_service.get_user_by_email(form_data.username)
    
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    
    access_token_expires = timedelta(hours=24)
    access_token = create_access_token(
        data={"sub": str(user.id)},
        expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": str(user.id),
            "email": user.email,
            "role": user.role,
            "workspace_id": str(user.workspace_id)
        }
    }


@router.post("/refresh", response_model=TokenResponse)
async def refresh_access_token(
    refresh_data: RefreshTokenRequest,
    db: AsyncSession = Depends(get_db)
) -> TokenResponse:
    """Refresh access token using refresh token."""
    try:
        user_id = verify_refresh_token(refresh_data.refresh_token)
    except HTTPException:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )
    
    user_service = UserService(db)
    user = await user_service.get_user_by_id(user_id)
    
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive"
        )
    
    # Create new access and refresh tokens
    access_token_expires = timedelta(hours=24)
    access_token = create_access_token(
        data={"sub": str(user.id)},
        expires_delta=access_token_expires
    )
    
    refresh_token = create_refresh_token(user.id)
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token
    )


@router.get("/me")
async def get_current_user_info(
    current_user: User = Depends(get_current_active_user)
) -> Dict[str, Any]:
    """Get current user information."""
    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "role": current_user.role,
        "workspace_id": str(current_user.workspace_id),
        "is_active": current_user.is_active,
        "created_at": current_user.created_at.isoformat(),
        "updated_at": current_user.updated_at.isoformat()
    }


@router.get("/me/workspace", response_model=UserWithWorkspaceResponse)
async def get_current_user_with_workspace_info(
    user_data: Dict = Depends(get_current_user_with_workspace)
) -> UserWithWorkspaceResponse:
    """Get current user with workspace and permissions."""
    user = user_data["user"]
    workspace = user_data["workspace"]
    
    return UserWithWorkspaceResponse(
        user={
            "id": str(user.id),
            "email": user.email,
            "role": user.role,
            "workspace_id": str(user.workspace_id),
            "is_active": user.is_active,
            "created_at": user.created_at.isoformat(),
            "updated_at": user.updated_at.isoformat()
        },
        workspace={
            "id": str(workspace.id),
            "name": workspace.name,
            "domain": workspace.domain,
            "settings": workspace.settings,
            "created_at": workspace.created_at.isoformat(),
            "updated_at": workspace.updated_at.isoformat()
        },
        permissions=list(user_data["permissions"])
    )


@router.post("/logout")
async def logout(
    current_user: User = Depends(get_current_active_user)
) -> Dict[str, str]:
    """User logout endpoint."""
    # In a stateless JWT setup, logout is handled client-side
    # by removing the token. For more security, implement token blacklisting
    return {"message": "Successfully logged out"}


@router.post("/change-password")
async def change_password(
    current_password: str,
    new_password: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, str]:
    """Change user password."""
    if not verify_password(current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )
    
    user_service = UserService(db)
    await user_service.update_password(current_user.id, new_password)
    
    return {"message": "Password updated successfully"}


@router.post("/verify-token")
async def verify_token(
    current_user: User = Depends(get_current_active_user)
) -> Dict[str, Any]:
    """Verify if the current token is valid."""
    return {
        "valid": True,
        "user_id": str(current_user.id),
        "workspace_id": str(current_user.workspace_id),
        "role": current_user.role
    }