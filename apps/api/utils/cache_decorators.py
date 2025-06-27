"""
Cache decorators for FastAPI endpoints and service methods.
"""
import asyncio
import functools
import hashlib
import json
import logging
from typing import Any, Callable, Dict, List, Optional, Union
from datetime import datetime, timedelta

from core.redis import get_cache_manager

logger = logging.getLogger(__name__)


def cache_result(
    ttl_seconds: int = 300,
    key_prefix: str = "",
    include_user: bool = True,
    include_workspace: bool = True,
    exclude_params: Optional[List[str]] = None,
    vary_on: Optional[List[str]] = None
):
    """
    Decorator to cache function results in Redis.
    
    Args:
        ttl_seconds: Time to live in seconds
        key_prefix: Prefix for cache key
        include_user: Include user ID in cache key
        include_workspace: Include workspace ID in cache key
        exclude_params: Parameters to exclude from cache key
        vary_on: Specific parameters to include in cache key
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            # Get cache manager
            cache_manager = await get_cache_manager()
            
            # Generate cache key
            cache_key = _generate_cache_key(
                func.__name__,
                args,
                kwargs,
                key_prefix,
                include_user,
                include_workspace,
                exclude_params,
                vary_on
            )
            
            # Try to get from cache
            try:
                cached_result = await cache_manager.get(cache_key)
                if cached_result is not None:
                    logger.debug(f"Cache hit for key: {cache_key}")
                    return cached_result
            except Exception as e:
                logger.error(f"Cache get error for key {cache_key}: {str(e)}")
            
            # Execute function if not in cache
            result = await func(*args, **kwargs)
            
            # Store result in cache
            try:
                await cache_manager.set(cache_key, result, ttl_seconds)
                logger.debug(f"Cached result for key: {cache_key}")
            except Exception as e:
                logger.error(f"Cache set error for key {cache_key}: {str(e)}")
            
            return result
        
        return wrapper
    return decorator


def cache_invalidate(
    pattern: str = "",
    key_prefix: str = "",
    include_user: bool = True,
    include_workspace: bool = True
):
    """
    Decorator to invalidate cache entries after function execution.
    
    Args:
        pattern: Pattern to match cache keys for invalidation
        key_prefix: Prefix for cache key pattern
        include_user: Include user ID in pattern
        include_workspace: Include workspace ID in pattern
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            result = await func(*args, **kwargs)
            
            # Invalidate cache after successful execution
            try:
                cache_manager = await get_cache_manager()
                
                # Generate invalidation pattern
                invalidation_pattern = _generate_invalidation_pattern(
                    pattern,
                    args,
                    kwargs,
                    key_prefix,
                    include_user,
                    include_workspace
                )
                
                # Clear matching cache entries
                cleared_count = await cache_manager.clear_pattern(invalidation_pattern)
                logger.debug(f"Invalidated {cleared_count} cache entries with pattern: {invalidation_pattern}")
                
            except Exception as e:
                logger.error(f"Cache invalidation error: {str(e)}")
            
            return result
        
        return wrapper
    return decorator


def memoize(ttl_seconds: int = 3600, max_size: int = 128):
    """
    In-memory memoization decorator with LRU eviction and TTL.
    
    Args:
        ttl_seconds: Time to live for cached results
        max_size: Maximum number of items to cache
    """
    def decorator(func: Callable) -> Callable:
        cache = {}
        access_times = {}
        
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            # Generate key for memoization
            key = _generate_memo_key(func.__name__, args, kwargs)
            now = datetime.utcnow()
            
            # Check if result is cached and not expired
            if key in cache:
                cached_time, result = cache[key]
                if (now - cached_time).total_seconds() < ttl_seconds:
                    access_times[key] = now
                    return result
                else:
                    # Remove expired entry
                    del cache[key]
                    del access_times[key]
            
            # Execute function
            result = await func(*args, **kwargs)
            
            # Store in cache
            cache[key] = (now, result)
            access_times[key] = now
            
            # Evict oldest entries if cache is full
            if len(cache) > max_size:
                # Find least recently accessed key
                oldest_key = min(access_times.keys(), key=lambda k: access_times[k])
                del cache[oldest_key]
                del access_times[oldest_key]
            
            return result
        
        # Add cache management methods
        wrapper.cache_clear = lambda: cache.clear() or access_times.clear()
        wrapper.cache_info = lambda: {
            "size": len(cache),
            "max_size": max_size,
            "ttl_seconds": ttl_seconds
        }
        
        return wrapper
    return decorator


def cached_property_with_ttl(ttl_seconds: int = 300):
    """
    Property decorator that caches the result for a specified TTL.
    
    Args:
        ttl_seconds: Time to live for cached property value
    """
    def decorator(func: Callable) -> property:
        cache_attr = f"_{func.__name__}_cache"
        time_attr = f"_{func.__name__}_time"
        
        @functools.wraps(func)
        async def wrapper(self):
            now = datetime.utcnow()
            
            # Check if cached value exists and is not expired
            if hasattr(self, cache_attr) and hasattr(self, time_attr):
                cached_time = getattr(self, time_attr)
                if (now - cached_time).total_seconds() < ttl_seconds:
                    return getattr(self, cache_attr)
            
            # Compute and cache the value
            result = await func(self)
            setattr(self, cache_attr, result)
            setattr(self, time_attr, now)
            
            return result
        
        return property(wrapper)
    return decorator


class CacheWarmer:
    """Utility class for warming up caches proactively."""
    
    def __init__(self, cache_manager):
        self.cache_manager = cache_manager
    
    async def warm_workspace_cache(self, workspace_id: str):
        """Pre-populate cache for a workspace."""
        try:
            # Import here to avoid circular imports
            from services.analytics_service import AnalyticsService
            from services.campaign_service import CampaignService
            
            # Warm up analytics cache
            analytics_service = AnalyticsService(None)  # Pass db session in real usage
            
            # Cache recent metrics
            await analytics_service.get_workspace_metrics(workspace_id)
            
            # Cache campaign stats
            campaign_service = CampaignService(None)  # Pass db session in real usage
            await campaign_service.get_campaigns_by_workspace(workspace_id)
            
            logger.info(f"Cache warmed for workspace: {workspace_id}")
            
        except Exception as e:
            logger.error(f"Cache warming error for workspace {workspace_id}: {str(e)}")
    
    async def warm_user_cache(self, user_id: str):
        """Pre-populate cache for a user."""
        try:
            # Warm up user-specific data
            # This would typically include recent activity, preferences, etc.
            logger.info(f"Cache warmed for user: {user_id}")
            
        except Exception as e:
            logger.error(f"Cache warming error for user {user_id}: {str(e)}")


def cache_key_builder(
    prefix: str = "",
    include_timestamp: bool = False,
    timestamp_granularity: str = "hour"  # "minute", "hour", "day"
):
    """
    Helper to build consistent cache keys with optional timestamp component.
    
    Args:
        prefix: Key prefix
        include_timestamp: Whether to include timestamp in key
        timestamp_granularity: Granularity of timestamp ("minute", "hour", "day")
    """
    def builder(*args, **kwargs) -> str:
        parts = [prefix] if prefix else []
        
        # Add string representations of args
        for arg in args:
            if hasattr(arg, 'id'):
                parts.append(str(arg.id))
            else:
                parts.append(str(arg))
        
        # Add kwargs
        for key, value in sorted(kwargs.items()):
            parts.append(f"{key}:{value}")
        
        # Add timestamp if requested
        if include_timestamp:
            now = datetime.utcnow()
            if timestamp_granularity == "minute":
                timestamp = now.strftime("%Y%m%d%H%M")
            elif timestamp_granularity == "hour":
                timestamp = now.strftime("%Y%m%d%H")
            elif timestamp_granularity == "day":
                timestamp = now.strftime("%Y%m%d")
            else:
                timestamp = now.strftime("%Y%m%d%H")
            
            parts.append(f"ts:{timestamp}")
        
        return ":".join(parts)
    
    return builder


# Helper functions
def _generate_cache_key(
    func_name: str,
    args: tuple,
    kwargs: dict,
    key_prefix: str,
    include_user: bool,
    include_workspace: bool,
    exclude_params: Optional[List[str]],
    vary_on: Optional[List[str]]
) -> str:
    """Generate a cache key for function call."""
    
    key_parts = []
    
    if key_prefix:
        key_parts.append(key_prefix)
    
    key_parts.append(func_name)
    
    # Handle vary_on parameters specifically
    if vary_on:
        for param_name in vary_on:
            if param_name in kwargs:
                key_parts.append(f"{param_name}:{kwargs[param_name]}")
    else:
        # Include all parameters except excluded ones
        exclude_params = exclude_params or []
        
        # Add args
        for i, arg in enumerate(args):
            if hasattr(arg, 'id'):
                key_parts.append(f"arg{i}:{arg.id}")
            elif not isinstance(arg, (dict, list, set)):
                key_parts.append(f"arg{i}:{arg}")
        
        # Add kwargs
        for key, value in sorted(kwargs.items()):
            if key not in exclude_params:
                if hasattr(value, 'id'):
                    key_parts.append(f"{key}:{value.id}")
                elif not isinstance(value, (dict, list, set)):
                    key_parts.append(f"{key}:{value}")
    
    # Add user context if requested
    if include_user and 'current_user' in kwargs:
        user = kwargs['current_user']
        if hasattr(user, 'id'):
            key_parts.append(f"user:{user.id}")
    
    # Add workspace context if requested
    if include_workspace:
        if 'workspace_id' in kwargs:
            key_parts.append(f"workspace:{kwargs['workspace_id']}")
        elif 'current_user' in kwargs and hasattr(kwargs['current_user'], 'workspace_id'):
            key_parts.append(f"workspace:{kwargs['current_user'].workspace_id}")
    
    return ":".join(str(part) for part in key_parts)


def _generate_invalidation_pattern(
    pattern: str,
    args: tuple,
    kwargs: dict,
    key_prefix: str,
    include_user: bool,
    include_workspace: bool
) -> str:
    """Generate cache invalidation pattern."""
    
    if pattern:
        return pattern
    
    pattern_parts = []
    
    if key_prefix:
        pattern_parts.append(key_prefix)
    
    # Add workspace context if available
    if include_workspace:
        if 'workspace_id' in kwargs:
            pattern_parts.append(f"workspace:{kwargs['workspace_id']}")
        elif 'current_user' in kwargs and hasattr(kwargs['current_user'], 'workspace_id'):
            pattern_parts.append(f"workspace:{kwargs['current_user'].workspace_id}")
    
    # Add user context if requested
    if include_user and 'current_user' in kwargs:
        user = kwargs['current_user']
        if hasattr(user, 'id'):
            pattern_parts.append(f"user:{user.id}")
    
    pattern_parts.append("*")
    
    return ":".join(str(part) for part in pattern_parts)


def _generate_memo_key(func_name: str, args: tuple, kwargs: dict) -> str:
    """Generate key for in-memory memoization."""
    
    # Create a hashable representation
    key_data = {
        "func": func_name,
        "args": args,
        "kwargs": tuple(sorted(kwargs.items()))
    }
    
    # Create hash of the key data
    key_str = json.dumps(key_data, sort_keys=True, default=str)
    return hashlib.md5(key_str.encode()).hexdigest()