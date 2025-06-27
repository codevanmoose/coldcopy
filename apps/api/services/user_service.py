"""
User service for business logic.
"""
from typing import Optional, List
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.user import User, UserCreate, UserUpdate
from core.security import get_password_hash


class UserService:
    """Service class for user operations."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get_user_by_id(self, user_id: UUID) -> Optional[User]:
        """Get user by ID."""
        result = await self.db.execute(
            select(User).where(User.id == user_id)
        )
        return result.scalar_one_or_none()
    
    async def get_user_by_email(self, email: str) -> Optional[User]:
        """Get user by email."""
        result = await self.db.execute(
            select(User).where(User.email == email)
        )
        return result.scalar_one_or_none()
    
    async def get_users_by_workspace(
        self, 
        workspace_id: UUID, 
        skip: int = 0, 
        limit: int = 100
    ) -> List[User]:
        """Get users by workspace ID."""
        result = await self.db.execute(
            select(User)
            .where(User.workspace_id == workspace_id)
            .offset(skip)
            .limit(limit)
        )
        return list(result.scalars().all())
    
    async def create_user(self, user: UserCreate) -> User:
        """Create a new user."""
        hashed_password = get_password_hash(user.password)
        
        db_user = User(
            email=user.email,
            password_hash=hashed_password,
            role=user.role,
            is_active=user.is_active,
            workspace_id=user.workspace_id
        )
        
        self.db.add(db_user)
        await self.db.commit()
        await self.db.refresh(db_user)
        
        return db_user
    
    async def update_user(self, user_id: UUID, user_update: UserUpdate) -> Optional[User]:
        """Update a user."""
        result = await self.db.execute(
            select(User).where(User.id == user_id)
        )
        db_user = result.scalar_one_or_none()
        
        if not db_user:
            return None
        
        update_data = user_update.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_user, field, value)
        
        await self.db.commit()
        await self.db.refresh(db_user)
        
        return db_user
    
    async def delete_user(self, user_id: UUID) -> bool:
        """Delete a user."""
        result = await self.db.execute(
            select(User).where(User.id == user_id)
        )
        db_user = result.scalar_one_or_none()
        
        if not db_user:
            return False
        
        await self.db.delete(db_user)
        await self.db.commit()
        
        return True