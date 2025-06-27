"""
Redis Cache Manager for ColdCopy.

This module provides a comprehensive caching layer for hot data like lead enrichment,
AI responses, analytics data, and other frequently accessed information.
"""
import json
import logging
import hashlib
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Union, Callable, TypeVar, Generic
from dataclasses import dataclass, asdict
from enum import Enum
import asyncio
from functools import wraps

import redis.asyncio as redis
from redis.asyncio.lock import Lock
from redis.exceptions import RedisError, ConnectionError, TimeoutError

logger = logging.getLogger(__name__)

T = TypeVar('T')


class CacheNamespace(Enum):
    """Cache namespaces for different data types."""
    LEAD_ENRICHMENT = "lead_enrichment"
    AI_RESPONSES = "ai_responses"
    ANALYTICS = "analytics"
    WORKSPACE_SETTINGS = "workspace_settings"
    USER_SESSIONS = "user_sessions"
    API_RESPONSES = "api_responses"
    EMAIL_TEMPLATES = "email_templates"
    CAMPAIGN_STATS = "campaign_stats"
    FEATURE_FLAGS = "feature_flags"
    RATE_LIMITS = "rate_limits"


@dataclass
class CacheConfig:
    """Configuration for cache behavior."""
    ttl: int = 3600  # Default 1 hour
    namespace: CacheNamespace = CacheNamespace.API_RESPONSES
    compress: bool = False
    version: int = 1
    max_retries: int = 3
    retry_delay: float = 0.1
    lock_timeout: int = 10
    refresh_on_expire: bool = False


@dataclass
class CacheStats:
    """Cache performance statistics."""
    hits: int = 0
    misses: int = 0
    errors: int = 0
    evictions: int = 0
    avg_get_time_ms: float = 0.0
    avg_set_time_ms: float = 0.0
    memory_usage_mb: float = 0.0
    
    @property
    def hit_rate(self) -> float:
        """Calculate cache hit rate."""
        total = self.hits + self.misses
        return (self.hits / total * 100) if total > 0 else 0.0


class CacheManager:
    """
    Manages Redis caching with advanced features like namespacing,
    compression, versioning, and automatic refresh.
    """
    
    def __init__(
        self,
        redis_url: str = "redis://localhost:6379",
        prefix: str = "coldcopy",
        default_ttl: int = 3600,
        max_connections: int = 50
    ):
        self.redis_url = redis_url
        self.prefix = prefix
        self.default_ttl = default_ttl
        self._redis: Optional[redis.Redis] = None
        self._pool = None
        self._stats: Dict[str, CacheStats] = {}
        self._refresh_callbacks: Dict[str, Callable] = {}
        self.max_connections = max_connections
    
    async def initialize(self):
        """Initialize Redis connection pool."""
        try:
            self._pool = redis.ConnectionPool.from_url(
                self.redis_url,
                max_connections=self.max_connections,
                decode_responses=False  # We'll handle decoding ourselves
            )
            self._redis = redis.Redis(connection_pool=self._pool)
            
            # Test connection
            await self._redis.ping()
            logger.info(f"Redis cache initialized with prefix: {self.prefix}")
            
        except Exception as e:
            logger.error(f"Failed to initialize Redis: {e}")
            raise
    
    async def close(self):
        """Close Redis connections."""
        if self._redis:
            await self._redis.close()
            await self._pool.disconnect()
    
    def _make_key(self, key: str, namespace: CacheNamespace, version: int = 1) -> str:
        """Generate namespaced cache key."""
        return f"{self.prefix}:{namespace.value}:v{version}:{key}"
    
    def _serialize(self, value: Any, compress: bool = False) -> bytes:
        """Serialize value for storage."""
        json_str = json.dumps(value, default=str)
        data = json_str.encode('utf-8')
        
        if compress:
            import zlib
            data = zlib.compress(data)
        
        return data
    
    def _deserialize(self, data: bytes, compress: bool = False) -> Any:
        """Deserialize value from storage."""
        if compress:
            import zlib
            data = zlib.decompress(data)
        
        json_str = data.decode('utf-8')
        return json.loads(json_str)
    
    async def get(
        self,
        key: str,
        namespace: CacheNamespace = CacheNamespace.API_RESPONSES,
        version: int = 1,
        refresh_callback: Optional[Callable] = None
    ) -> Optional[Any]:
        """
        Get value from cache with automatic refresh support.
        
        Args:
            key: Cache key
            namespace: Cache namespace
            version: Cache version for invalidation
            refresh_callback: Async function to refresh expired data
            
        Returns:
            Cached value or None if not found
        """
        if not self._redis:
            logger.warning("Redis not initialized, skipping cache get")
            return None
        
        full_key = self._make_key(key, namespace, version)
        stats = self._get_stats(namespace)
        
        try:
            start_time = asyncio.get_event_loop().time()
            
            # Get value and TTL in pipeline
            pipe = self._redis.pipeline()
            pipe.get(full_key)
            pipe.ttl(full_key)
            results = await pipe.execute()
            
            data, ttl = results[0], results[1]
            
            elapsed_ms = (asyncio.get_event_loop().time() - start_time) * 1000
            stats.avg_get_time_ms = (stats.avg_get_time_ms + elapsed_ms) / 2
            
            if data is None:
                stats.misses += 1
                
                # Try to refresh if callback provided
                if refresh_callback:
                    logger.info(f"Cache miss for {full_key}, refreshing...")
                    fresh_value = await refresh_callback()
                    if fresh_value is not None:
                        await self.set(
                            key, fresh_value, 
                            namespace=namespace,
                            version=version
                        )
                    return fresh_value
                
                return None
            
            stats.hits += 1
            
            # Check if nearing expiration and refresh
            if ttl > 0 and ttl < 60 and refresh_callback:  # Less than 1 minute
                asyncio.create_task(self._background_refresh(
                    key, namespace, version, refresh_callback
                ))
            
            # Deserialize based on metadata
            metadata = await self._redis.hget(f"{full_key}:meta", "compress")
            compress = metadata == b"true" if metadata else False
            
            return self._deserialize(data, compress)
            
        except Exception as e:
            stats.errors += 1
            logger.error(f"Cache get error for {full_key}: {e}")
            return None
    
    async def set(
        self,
        key: str,
        value: Any,
        ttl: Optional[int] = None,
        namespace: CacheNamespace = CacheNamespace.API_RESPONSES,
        version: int = 1,
        compress: bool = False,
        tags: Optional[List[str]] = None
    ) -> bool:
        """
        Set value in cache with metadata.
        
        Args:
            key: Cache key
            value: Value to cache
            ttl: Time to live in seconds
            namespace: Cache namespace
            version: Cache version
            compress: Whether to compress the value
            tags: Optional tags for bulk invalidation
            
        Returns:
            True if successful
        """
        if not self._redis:
            logger.warning("Redis not initialized, skipping cache set")
            return False
        
        full_key = self._make_key(key, namespace, version)
        stats = self._get_stats(namespace)
        
        try:
            start_time = asyncio.get_event_loop().time()
            
            # Serialize value
            data = self._serialize(value, compress)
            
            # Use pipeline for atomic operations
            pipe = self._redis.pipeline()
            
            # Set main value
            if ttl is None:
                ttl = self.default_ttl
            pipe.setex(full_key, ttl, data)
            
            # Set metadata
            meta_key = f"{full_key}:meta"
            pipe.hset(meta_key, mapping={
                "compress": str(compress).lower(),
                "created_at": datetime.utcnow().isoformat(),
                "ttl": str(ttl),
                "size": str(len(data))
            })
            pipe.expire(meta_key, ttl)
            
            # Add to tags if provided
            if tags:
                for tag in tags:
                    tag_key = f"{self.prefix}:tags:{tag}"
                    pipe.sadd(tag_key, full_key)
                    pipe.expire(tag_key, ttl)
            
            await pipe.execute()
            
            elapsed_ms = (asyncio.get_event_loop().time() - start_time) * 1000
            stats.avg_set_time_ms = (stats.avg_set_time_ms + elapsed_ms) / 2
            
            return True
            
        except Exception as e:
            stats.errors += 1
            logger.error(f"Cache set error for {full_key}: {e}")
            return False
    
    async def delete(
        self,
        key: str,
        namespace: CacheNamespace = CacheNamespace.API_RESPONSES,
        version: int = 1
    ) -> bool:
        """Delete a cached value."""
        if not self._redis:
            return False
        
        full_key = self._make_key(key, namespace, version)
        
        try:
            # Delete value and metadata
            pipe = self._redis.pipeline()
            pipe.delete(full_key)
            pipe.delete(f"{full_key}:meta")
            results = await pipe.execute()
            
            return results[0] > 0
            
        except Exception as e:
            logger.error(f"Cache delete error for {full_key}: {e}")
            return False
    
    async def delete_pattern(
        self,
        pattern: str,
        namespace: CacheNamespace = CacheNamespace.API_RESPONSES
    ) -> int:
        """Delete all keys matching a pattern."""
        if not self._redis:
            return 0
        
        full_pattern = f"{self.prefix}:{namespace.value}:*:{pattern}"
        deleted = 0
        
        try:
            # Use SCAN to find matching keys
            cursor = 0
            while True:
                cursor, keys = await self._redis.scan(
                    cursor, match=full_pattern, count=100
                )
                
                if keys:
                    deleted += await self._redis.delete(*keys)
                
                if cursor == 0:
                    break
            
            return deleted
            
        except Exception as e:
            logger.error(f"Cache delete pattern error: {e}")
            return 0
    
    async def delete_by_tag(self, tag: str) -> int:
        """Delete all cached values with a specific tag."""
        if not self._redis:
            return 0
        
        tag_key = f"{self.prefix}:tags:{tag}"
        deleted = 0
        
        try:
            # Get all keys with this tag
            keys = await self._redis.smembers(tag_key)
            
            if keys:
                # Delete all keys and their metadata
                pipe = self._redis.pipeline()
                for key in keys:
                    pipe.delete(key)
                    pipe.delete(f"{key}:meta")
                results = await pipe.execute()
                deleted = sum(1 for r in results if r > 0)
            
            # Delete the tag set
            await self._redis.delete(tag_key)
            
            return deleted
            
        except Exception as e:
            logger.error(f"Cache delete by tag error: {e}")
            return 0
    
    async def clear_namespace(self, namespace: CacheNamespace) -> int:
        """Clear all keys in a namespace."""
        return await self.delete_pattern("*", namespace)
    
    async def get_stats(self, namespace: Optional[CacheNamespace] = None) -> Dict[str, Any]:
        """Get cache statistics."""
        if namespace:
            stats = self._get_stats(namespace)
            return asdict(stats)
        
        # Return all stats
        return {
            ns.value: asdict(self._get_stats(ns))
            for ns in CacheNamespace
        }
    
    async def get_memory_usage(self) -> Dict[str, Any]:
        """Get Redis memory usage information."""
        if not self._redis:
            return {}
        
        try:
            info = await self._redis.info("memory")
            return {
                "used_memory_mb": info.get("used_memory", 0) / 1024 / 1024,
                "used_memory_peak_mb": info.get("used_memory_peak", 0) / 1024 / 1024,
                "used_memory_overhead_mb": info.get("used_memory_overhead", 0) / 1024 / 1024,
                "maxmemory_mb": info.get("maxmemory", 0) / 1024 / 1024,
                "mem_fragmentation_ratio": info.get("mem_fragmentation_ratio", 0)
            }
        except Exception as e:
            logger.error(f"Failed to get memory usage: {e}")
            return {}
    
    def _get_stats(self, namespace: CacheNamespace) -> CacheStats:
        """Get or create stats for namespace."""
        if namespace.value not in self._stats:
            self._stats[namespace.value] = CacheStats()
        return self._stats[namespace.value]
    
    async def _background_refresh(
        self,
        key: str,
        namespace: CacheNamespace,
        version: int,
        refresh_callback: Callable
    ):
        """Background task to refresh cache."""
        try:
            logger.info(f"Background refresh for {key}")
            fresh_value = await refresh_callback()
            if fresh_value is not None:
                await self.set(
                    key, fresh_value,
                    namespace=namespace,
                    version=version
                )
        except Exception as e:
            logger.error(f"Background refresh failed: {e}")
    
    # Decorator for automatic caching
    def cached(
        self,
        namespace: CacheNamespace = CacheNamespace.API_RESPONSES,
        ttl: Optional[int] = None,
        key_func: Optional[Callable] = None,
        compress: bool = False,
        version: int = 1
    ):
        """
        Decorator for automatic function result caching.
        
        Args:
            namespace: Cache namespace
            ttl: Time to live
            key_func: Function to generate cache key from arguments
            compress: Whether to compress cached values
            version: Cache version
        """
        def decorator(func: Callable) -> Callable:
            @wraps(func)
            async def wrapper(*args, **kwargs):
                # Generate cache key
                if key_func:
                    cache_key = key_func(*args, **kwargs)
                else:
                    # Default key generation
                    key_parts = [func.__name__]
                    key_parts.extend(str(arg) for arg in args)
                    key_parts.extend(f"{k}={v}" for k, v in sorted(kwargs.items()))
                    cache_key = ":".join(key_parts)
                
                # Try to get from cache
                cached_value = await self.get(
                    cache_key,
                    namespace=namespace,
                    version=version
                )
                
                if cached_value is not None:
                    return cached_value
                
                # Execute function
                result = await func(*args, **kwargs)
                
                # Cache the result
                await self.set(
                    cache_key,
                    result,
                    ttl=ttl,
                    namespace=namespace,
                    compress=compress,
                    version=version
                )
                
                return result
            
            return wrapper
        return decorator


class LeadEnrichmentCache:
    """Specialized cache for lead enrichment data."""
    
    def __init__(self, cache_manager: CacheManager):
        self.cache = cache_manager
        self.namespace = CacheNamespace.LEAD_ENRICHMENT
        self.ttl = 7 * 24 * 3600  # 7 days
    
    async def get_enrichment(
        self,
        lead_id: str,
        workspace_id: str
    ) -> Optional[Dict[str, Any]]:
        """Get cached enrichment data for a lead."""
        key = f"{workspace_id}:{lead_id}"
        return await self.cache.get(key, namespace=self.namespace)
    
    async def set_enrichment(
        self,
        lead_id: str,
        workspace_id: str,
        enrichment_data: Dict[str, Any]
    ) -> bool:
        """Cache enrichment data for a lead."""
        key = f"{workspace_id}:{lead_id}"
        return await self.cache.set(
            key,
            enrichment_data,
            ttl=self.ttl,
            namespace=self.namespace,
            compress=True,  # Enrichment data can be large
            tags=[workspace_id, "enrichment"]
        )
    
    async def invalidate_workspace(self, workspace_id: str) -> int:
        """Invalidate all enrichment data for a workspace."""
        return await self.cache.delete_by_tag(workspace_id)


class AIResponseCache:
    """Specialized cache for AI-generated responses."""
    
    def __init__(self, cache_manager: CacheManager):
        self.cache = cache_manager
        self.namespace = CacheNamespace.AI_RESPONSES
        self.ttl = 24 * 3600  # 24 hours
    
    def _generate_key(
        self,
        prompt: str,
        model: str,
        temperature: float,
        workspace_id: str
    ) -> str:
        """Generate deterministic key for AI response."""
        content = f"{prompt}:{model}:{temperature}:{workspace_id}"
        return hashlib.sha256(content.encode()).hexdigest()[:16]
    
    async def get_response(
        self,
        prompt: str,
        model: str,
        temperature: float,
        workspace_id: str
    ) -> Optional[str]:
        """Get cached AI response."""
        key = self._generate_key(prompt, model, temperature, workspace_id)
        return await self.cache.get(key, namespace=self.namespace)
    
    async def set_response(
        self,
        prompt: str,
        model: str,
        temperature: float,
        workspace_id: str,
        response: str,
        tokens_used: int
    ) -> bool:
        """Cache AI response with metadata."""
        key = self._generate_key(prompt, model, temperature, workspace_id)
        
        data = {
            "response": response,
            "model": model,
            "temperature": temperature,
            "tokens_used": tokens_used,
            "cached_at": datetime.utcnow().isoformat()
        }
        
        return await self.cache.set(
            key,
            data,
            ttl=self.ttl,
            namespace=self.namespace,
            compress=True,
            tags=[workspace_id, model, "ai_response"]
        )


class AnalyticsCache:
    """Specialized cache for analytics data."""
    
    def __init__(self, cache_manager: CacheManager):
        self.cache = cache_manager
        self.namespace = CacheNamespace.ANALYTICS
        self.ttl = 300  # 5 minutes for real-time analytics
    
    async def get_campaign_stats(
        self,
        campaign_id: str,
        workspace_id: str
    ) -> Optional[Dict[str, Any]]:
        """Get cached campaign statistics."""
        key = f"campaign_stats:{workspace_id}:{campaign_id}"
        return await self.cache.get(key, namespace=self.namespace)
    
    async def set_campaign_stats(
        self,
        campaign_id: str,
        workspace_id: str,
        stats: Dict[str, Any]
    ) -> bool:
        """Cache campaign statistics."""
        key = f"campaign_stats:{workspace_id}:{campaign_id}"
        return await self.cache.set(
            key,
            stats,
            ttl=self.ttl,
            namespace=self.namespace,
            tags=[workspace_id, campaign_id, "campaign_stats"]
        )
    
    async def get_workspace_dashboard(
        self,
        workspace_id: str
    ) -> Optional[Dict[str, Any]]:
        """Get cached workspace dashboard data."""
        key = f"dashboard:{workspace_id}"
        return await self.cache.get(key, namespace=self.namespace)
    
    async def set_workspace_dashboard(
        self,
        workspace_id: str,
        dashboard_data: Dict[str, Any]
    ) -> bool:
        """Cache workspace dashboard data."""
        key = f"dashboard:{workspace_id}"
        return await self.cache.set(
            key,
            dashboard_data,
            ttl=60,  # 1 minute for dashboard
            namespace=self.namespace,
            compress=True,
            tags=[workspace_id, "dashboard"]
        )


# Global cache instance
_cache_instance: Optional[CacheManager] = None


async def get_cache() -> CacheManager:
    """Get global cache instance."""
    global _cache_instance
    
    if _cache_instance is None:
        import os
        redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
        _cache_instance = CacheManager(redis_url=redis_url)
        await _cache_instance.initialize()
    
    return _cache_instance


async def close_cache():
    """Close global cache instance."""
    global _cache_instance
    
    if _cache_instance:
        await _cache_instance.close()
        _cache_instance = None


if __name__ == "__main__":
    # Example usage
    async def test_cache():
        cache = await get_cache()
        
        # Basic get/set
        await cache.set("test_key", {"data": "value"}, ttl=60)
        value = await cache.get("test_key")
        print(f"Retrieved: {value}")
        
        # With compression
        large_data = {"items": [f"item_{i}" for i in range(1000)]}
        await cache.set("large_key", large_data, compress=True)
        
        # Get stats
        stats = await cache.get_stats()
        print(f"Cache stats: {stats}")
        
        # Specialized caches
        lead_cache = LeadEnrichmentCache(cache)
        await lead_cache.set_enrichment(
            "lead_123", "workspace_456",
            {"company": "Acme Corp", "industry": "Software"}
        )
        
        await close_cache()
    
    asyncio.run(test_cache())