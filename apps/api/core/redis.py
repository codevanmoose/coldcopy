"""
Redis client configuration and connection management for ColdCopy.
"""
import logging
from typing import Any, Dict, List, Optional, Union
import json
import asyncio
from datetime import datetime, timedelta

import aioredis
from aioredis import Redis

from core.config import get_settings

logger = logging.getLogger(__name__)


class RedisClient:
    """Redis client with connection pooling and error handling."""
    
    def __init__(self):
        self.settings = get_settings()
        self._client: Optional[Redis] = None
        self._connection_pool = None
    
    async def connect(self):
        """Initialize Redis connection."""
        if self._client is None:
            try:
                self._client = aioredis.from_url(
                    self.settings.REDIS_URL,
                    encoding="utf-8",
                    decode_responses=True,
                    socket_keepalive=True,
                    socket_keepalive_options={},
                    health_check_interval=30,
                    retry_on_timeout=True,
                    max_connections=20
                )
                
                # Test connection
                await self._client.ping()
                logger.info("Redis connection established successfully")
                
            except Exception as e:
                logger.error(f"Failed to connect to Redis: {str(e)}")
                raise
    
    async def disconnect(self):
        """Close Redis connection."""
        if self._client:
            await self._client.close()
            self._client = None
            logger.info("Redis connection closed")
    
    @property
    def client(self) -> Redis:
        """Get Redis client instance."""
        if self._client is None:
            raise RuntimeError("Redis client not initialized. Call connect() first.")
        return self._client
    
    async def health_check(self) -> bool:
        """Check Redis connection health."""
        try:
            if self._client:
                await self._client.ping()
                return True
        except Exception as e:
            logger.error(f"Redis health check failed: {str(e)}")
        return False


# Global Redis client instance
redis_client = RedisClient()


async def get_redis() -> Redis:
    """Dependency to get Redis client."""
    if redis_client._client is None:
        await redis_client.connect()
    return redis_client.client


class CacheManager:
    """High-level cache management with serialization and TTL support."""
    
    def __init__(self, redis_client: Redis, prefix: str = "coldcopy"):
        self.redis = redis_client
        self.prefix = prefix
    
    def _make_key(self, key: str) -> str:
        """Create prefixed cache key."""
        return f"{self.prefix}:{key}"
    
    async def get(self, key: str, default: Any = None) -> Any:
        """Get value from cache with JSON deserialization."""
        try:
            cached_value = await self.redis.get(self._make_key(key))
            if cached_value is None:
                return default
            return json.loads(cached_value)
        except Exception as e:
            logger.error(f"Cache get error for key {key}: {str(e)}")
            return default
    
    async def set(
        self, 
        key: str, 
        value: Any, 
        ttl_seconds: Optional[int] = None
    ) -> bool:
        """Set value in cache with JSON serialization."""
        try:
            serialized_value = json.dumps(value, default=str)
            cache_key = self._make_key(key)
            
            if ttl_seconds:
                await self.redis.setex(cache_key, ttl_seconds, serialized_value)
            else:
                await self.redis.set(cache_key, serialized_value)
            
            return True
        except Exception as e:
            logger.error(f"Cache set error for key {key}: {str(e)}")
            return False
    
    async def delete(self, key: str) -> bool:
        """Delete key from cache."""
        try:
            result = await self.redis.delete(self._make_key(key))
            return result > 0
        except Exception as e:
            logger.error(f"Cache delete error for key {key}: {str(e)}")
            return False
    
    async def exists(self, key: str) -> bool:
        """Check if key exists in cache."""
        try:
            result = await self.redis.exists(self._make_key(key))
            return result > 0
        except Exception as e:
            logger.error(f"Cache exists error for key {key}: {str(e)}")
            return False
    
    async def expire(self, key: str, ttl_seconds: int) -> bool:
        """Set TTL for existing key."""
        try:
            result = await self.redis.expire(self._make_key(key), ttl_seconds)
            return result > 0
        except Exception as e:
            logger.error(f"Cache expire error for key {key}: {str(e)}")
            return False
    
    async def increment(self, key: str, amount: int = 1) -> int:
        """Increment numeric value in cache."""
        try:
            return await self.redis.incrby(self._make_key(key), amount)
        except Exception as e:
            logger.error(f"Cache increment error for key {key}: {str(e)}")
            return 0
    
    async def get_many(self, keys: List[str]) -> Dict[str, Any]:
        """Get multiple values from cache."""
        try:
            cache_keys = [self._make_key(key) for key in keys]
            values = await self.redis.mget(cache_keys)
            
            result = {}
            for i, (original_key, value) in enumerate(zip(keys, values)):
                if value is not None:
                    try:
                        result[original_key] = json.loads(value)
                    except json.JSONDecodeError:
                        result[original_key] = value
                else:
                    result[original_key] = None
            
            return result
        except Exception as e:
            logger.error(f"Cache get_many error: {str(e)}")
            return {key: None for key in keys}
    
    async def set_many(
        self, 
        mapping: Dict[str, Any], 
        ttl_seconds: Optional[int] = None
    ) -> bool:
        """Set multiple values in cache."""
        try:
            pipe = self.redis.pipeline()
            
            for key, value in mapping.items():
                serialized_value = json.dumps(value, default=str)
                cache_key = self._make_key(key)
                
                if ttl_seconds:
                    pipe.setex(cache_key, ttl_seconds, serialized_value)
                else:
                    pipe.set(cache_key, serialized_value)
            
            await pipe.execute()
            return True
        except Exception as e:
            logger.error(f"Cache set_many error: {str(e)}")
            return False
    
    async def clear_pattern(self, pattern: str) -> int:
        """Clear all keys matching pattern."""
        try:
            pattern_key = self._make_key(pattern)
            keys = await self.redis.keys(pattern_key)
            if keys:
                return await self.redis.delete(*keys)
            return 0
        except Exception as e:
            logger.error(f"Cache clear_pattern error for pattern {pattern}: {str(e)}")
            return 0


class EnrichmentCache:
    """Specialized cache for lead enrichment data."""
    
    def __init__(self, cache_manager: CacheManager):
        self.cache = cache_manager
        self.ttl = 86400 * 7  # 7 days
    
    async def get_enrichment(self, email: str) -> Optional[Dict[str, Any]]:
        """Get cached enrichment data for email."""
        key = f"enrichment:email:{email.lower()}"
        return await self.cache.get(key)
    
    async def set_enrichment(self, email: str, data: Dict[str, Any]) -> bool:
        """Cache enrichment data for email."""
        key = f"enrichment:email:{email.lower()}"
        enrichment_data = {
            "data": data,
            "cached_at": datetime.utcnow().isoformat(),
            "ttl": self.ttl
        }
        return await self.cache.set(key, enrichment_data, self.ttl)
    
    async def get_company_enrichment(self, domain: str) -> Optional[Dict[str, Any]]:
        """Get cached company enrichment data."""
        key = f"enrichment:company:{domain.lower()}"
        return await self.cache.get(key)
    
    async def set_company_enrichment(self, domain: str, data: Dict[str, Any]) -> bool:
        """Cache company enrichment data."""
        key = f"enrichment:company:{domain.lower()}"
        return await self.cache.set(key, data, self.ttl)


class SessionCache:
    """User session and authentication cache."""
    
    def __init__(self, cache_manager: CacheManager):
        self.cache = cache_manager
        self.session_ttl = 86400  # 24 hours
        self.refresh_ttl = 86400 * 7  # 7 days
    
    async def store_session(self, user_id: str, session_data: Dict[str, Any]) -> str:
        """Store user session data."""
        session_id = f"session:{user_id}:{datetime.utcnow().timestamp()}"
        await self.cache.set(session_id, session_data, self.session_ttl)
        return session_id
    
    async def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get session data."""
        return await self.cache.get(session_id)
    
    async def invalidate_session(self, session_id: str) -> bool:
        """Invalidate user session."""
        return await self.cache.delete(session_id)
    
    async def store_refresh_token(self, user_id: str, token_hash: str) -> bool:
        """Store refresh token hash."""
        key = f"refresh_token:{user_id}"
        return await self.cache.set(key, token_hash, self.refresh_ttl)
    
    async def validate_refresh_token(self, user_id: str, token_hash: str) -> bool:
        """Validate refresh token."""
        cached_hash = await self.cache.get(f"refresh_token:{user_id}")
        return cached_hash == token_hash
    
    async def revoke_refresh_token(self, user_id: str) -> bool:
        """Revoke refresh token."""
        return await self.cache.delete(f"refresh_token:{user_id}")


class RateLimitCache:
    """Rate limiting cache with sliding window."""
    
    def __init__(self, cache_manager: CacheManager):
        self.cache = cache_manager
    
    async def check_rate_limit(
        self, 
        identifier: str, 
        limit: int, 
        window_seconds: int,
        cost: int = 1
    ) -> Dict[str, Any]:
        """Check rate limit with sliding window algorithm."""
        now = datetime.utcnow()
        window_start = now - timedelta(seconds=window_seconds)
        
        key = f"rate_limit:{identifier}"
        
        # Get current requests
        current_requests = await self.cache.get(key, [])
        
        # Filter requests within window
        valid_requests = [
            req for req in current_requests 
            if datetime.fromisoformat(req["timestamp"]) > window_start
        ]
        
        # Calculate current usage
        current_usage = sum(req["cost"] for req in valid_requests)
        
        # Check if request can be allowed
        allowed = (current_usage + cost) <= limit
        
        if allowed:
            # Add new request
            valid_requests.append({
                "timestamp": now.isoformat(),
                "cost": cost
            })
            
            # Store updated requests
            await self.cache.set(key, valid_requests, window_seconds)
        
        return {
            "allowed": allowed,
            "current_usage": current_usage,
            "limit": limit,
            "reset_time": (now + timedelta(seconds=window_seconds)).isoformat(),
            "retry_after": window_seconds if not allowed else 0
        }
    
    async def get_rate_limit_status(
        self, 
        identifier: str, 
        limit: int, 
        window_seconds: int
    ) -> Dict[str, Any]:
        """Get current rate limit status without consuming quota."""
        now = datetime.utcnow()
        window_start = now - timedelta(seconds=window_seconds)
        
        key = f"rate_limit:{identifier}"
        current_requests = await self.cache.get(key, [])
        
        valid_requests = [
            req for req in current_requests 
            if datetime.fromisoformat(req["timestamp"]) > window_start
        ]
        
        current_usage = sum(req["cost"] for req in valid_requests)
        
        return {
            "current_usage": current_usage,
            "limit": limit,
            "remaining": max(0, limit - current_usage),
            "reset_time": (now + timedelta(seconds=window_seconds)).isoformat()
        }


class AnalyticsCache:
    """Cache for analytics and metrics data."""
    
    def __init__(self, cache_manager: CacheManager):
        self.cache = cache_manager
        self.metrics_ttl = 300  # 5 minutes
        self.reports_ttl = 3600  # 1 hour
    
    async def cache_metric(
        self, 
        workspace_id: str, 
        metric_name: str, 
        value: Any,
        ttl_override: Optional[int] = None
    ) -> bool:
        """Cache a metric value."""
        key = f"metrics:{workspace_id}:{metric_name}"
        ttl = ttl_override or self.metrics_ttl
        return await self.cache.set(key, value, ttl)
    
    async def get_metric(self, workspace_id: str, metric_name: str) -> Any:
        """Get cached metric value."""
        key = f"metrics:{workspace_id}:{metric_name}"
        return await self.cache.get(key)
    
    async def cache_report(
        self, 
        workspace_id: str, 
        report_type: str, 
        report_data: Dict[str, Any],
        ttl_override: Optional[int] = None
    ) -> bool:
        """Cache report data."""
        key = f"reports:{workspace_id}:{report_type}"
        ttl = ttl_override or self.reports_ttl
        return await self.cache.set(key, report_data, ttl)
    
    async def get_report(self, workspace_id: str, report_type: str) -> Optional[Dict[str, Any]]:
        """Get cached report data."""
        key = f"reports:{workspace_id}:{report_type}"
        return await self.cache.get(key)
    
    async def invalidate_workspace_cache(self, workspace_id: str) -> int:
        """Invalidate all cache for a workspace."""
        pattern = f"*:{workspace_id}:*"
        return await self.cache.clear_pattern(pattern)


class EmailDeliverabilityCache:
    """Cache for email deliverability data."""
    
    def __init__(self, cache_manager: CacheManager):
        self.cache = cache_manager
        self.reputation_ttl = 1800  # 30 minutes
        self.mx_ttl = 86400  # 24 hours
    
    async def cache_domain_reputation(self, domain: str, reputation_data: Dict[str, Any]) -> bool:
        """Cache domain reputation data."""
        key = f"reputation:{domain.lower()}"
        return await self.cache.set(key, reputation_data, self.reputation_ttl)
    
    async def get_domain_reputation(self, domain: str) -> Optional[Dict[str, Any]]:
        """Get cached domain reputation."""
        key = f"reputation:{domain.lower()}"
        return await self.cache.get(key)
    
    async def cache_mx_records(self, domain: str, mx_records: List[str]) -> bool:
        """Cache MX records for domain."""
        key = f"mx_records:{domain.lower()}"
        return await self.cache.set(key, mx_records, self.mx_ttl)
    
    async def get_mx_records(self, domain: str) -> Optional[List[str]]:
        """Get cached MX records."""
        key = f"mx_records:{domain.lower()}"
        return await self.cache.get(key)


# Initialize cache managers
async def get_cache_manager() -> CacheManager:
    """Get initialized cache manager."""
    redis = await get_redis()
    return CacheManager(redis)


async def get_enrichment_cache() -> EnrichmentCache:
    """Get enrichment cache instance."""
    cache_manager = await get_cache_manager()
    return EnrichmentCache(cache_manager)


async def get_session_cache() -> SessionCache:
    """Get session cache instance."""
    cache_manager = await get_cache_manager()
    return SessionCache(cache_manager)


async def get_rate_limit_cache() -> RateLimitCache:
    """Get rate limit cache instance."""
    cache_manager = await get_cache_manager()
    return RateLimitCache(cache_manager)


async def get_analytics_cache() -> AnalyticsCache:
    """Get analytics cache instance."""
    cache_manager = await get_cache_manager()
    return AnalyticsCache(cache_manager)


async def get_deliverability_cache() -> EmailDeliverabilityCache:
    """Get deliverability cache instance."""
    cache_manager = await get_cache_manager()
    return EmailDeliverabilityCache(cache_manager)