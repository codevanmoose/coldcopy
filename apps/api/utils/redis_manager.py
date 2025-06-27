"""
Redis connection manager and health monitoring for ColdCopy.
"""
import asyncio
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
import json

import aioredis
from aioredis import Redis
from aioredis.exceptions import RedisError, ConnectionError as RedisConnectionError

from core.config import get_settings

logger = logging.getLogger(__name__)


class RedisConnectionPool:
    """Manages Redis connections with health monitoring and failover."""
    
    def __init__(self):
        self.settings = get_settings()
        self._pools: Dict[str, Redis] = {}
        self._health_status: Dict[str, bool] = {}
        self._last_health_check: Dict[str, datetime] = {}
        self._health_check_interval = 30  # seconds
        
        # Connection configurations
        self.connection_configs = {
            "default": {
                "url": self.settings.REDIS_URL,
                "max_connections": 20,
                "retry_on_timeout": True,
                "health_check_interval": 30,
                "socket_keepalive": True,
                "encoding": "utf-8",
                "decode_responses": True
            },
            
            # Separate connection for Celery
            "celery": {
                "url": self.settings.REDIS_URL,
                "max_connections": 50,
                "retry_on_timeout": True,
                "health_check_interval": 30,
                "socket_keepalive": True,
                "encoding": "utf-8",
                "decode_responses": False  # Celery needs binary data
            },
            
            # High-performance connection for caching
            "cache": {
                "url": self.settings.REDIS_URL,
                "max_connections": 30,
                "retry_on_timeout": True,
                "health_check_interval": 30,
                "socket_keepalive": True,
                "encoding": "utf-8",
                "decode_responses": True
            },
            
            # Rate limiting specific connection
            "rate_limit": {
                "url": self.settings.REDIS_URL,
                "max_connections": 10,
                "retry_on_timeout": True,
                "health_check_interval": 30,
                "socket_keepalive": True,
                "encoding": "utf-8",
                "decode_responses": True
            }
        }
    
    async def get_pool(self, pool_name: str = "default") -> Redis:
        """Get Redis connection pool by name."""
        if pool_name not in self._pools:
            await self._create_pool(pool_name)
        
        # Check health before returning
        if not await self._check_pool_health(pool_name):
            # Try to recreate pool if unhealthy
            await self._recreate_pool(pool_name)
        
        return self._pools[pool_name]
    
    async def _create_pool(self, pool_name: str):
        """Create a new Redis connection pool."""
        if pool_name not in self.connection_configs:
            raise ValueError(f"Unknown pool name: {pool_name}")
        
        config = self.connection_configs[pool_name]
        
        try:
            pool = aioredis.from_url(
                config["url"],
                max_connections=config["max_connections"],
                retry_on_timeout=config["retry_on_timeout"],
                health_check_interval=config["health_check_interval"],
                socket_keepalive=config["socket_keepalive"],
                encoding=config["encoding"],
                decode_responses=config["decode_responses"]
            )
            
            # Test connection
            await pool.ping()
            
            self._pools[pool_name] = pool
            self._health_status[pool_name] = True
            self._last_health_check[pool_name] = datetime.utcnow()
            
            logger.info(f"Created Redis pool '{pool_name}' successfully")
            
        except Exception as e:
            logger.error(f"Failed to create Redis pool '{pool_name}': {str(e)}")
            self._health_status[pool_name] = False
            raise
    
    async def _check_pool_health(self, pool_name: str) -> bool:
        """Check health of Redis pool."""
        if pool_name not in self._pools:
            return False
        
        now = datetime.utcnow()
        last_check = self._last_health_check.get(pool_name, datetime.min)
        
        # Skip check if recent
        if (now - last_check).total_seconds() < self._health_check_interval:
            return self._health_status.get(pool_name, False)
        
        try:
            pool = self._pools[pool_name]
            await pool.ping()
            
            self._health_status[pool_name] = True
            self._last_health_check[pool_name] = now
            
            return True
            
        except Exception as e:
            logger.warning(f"Redis pool '{pool_name}' health check failed: {str(e)}")
            self._health_status[pool_name] = False
            self._last_health_check[pool_name] = now
            
            return False
    
    async def _recreate_pool(self, pool_name: str):
        """Recreate a Redis pool."""
        logger.info(f"Recreating Redis pool '{pool_name}'")
        
        # Close existing pool
        if pool_name in self._pools:
            try:
                await self._pools[pool_name].close()
            except:
                pass
            del self._pools[pool_name]
        
        # Create new pool
        await self._create_pool(pool_name)
    
    async def close_all(self):
        """Close all Redis connection pools."""
        for pool_name, pool in self._pools.items():
            try:
                await pool.close()
                logger.info(f"Closed Redis pool '{pool_name}'")
            except Exception as e:
                logger.error(f"Error closing Redis pool '{pool_name}': {str(e)}")
        
        self._pools.clear()
        self._health_status.clear()
        self._last_health_check.clear()
    
    async def get_pool_stats(self) -> Dict[str, Any]:
        """Get statistics for all pools."""
        stats = {}
        
        for pool_name in self.connection_configs.keys():
            try:
                pool = await self.get_pool(pool_name)
                connection_pool = pool.connection_pool
                
                stats[pool_name] = {
                    "available_connections": len(connection_pool._available_connections),
                    "created_connections": connection_pool._created_connections,
                    "max_connections": connection_pool.max_connections,
                    "health_status": self._health_status.get(pool_name, False),
                    "last_health_check": self._last_health_check.get(pool_name, datetime.min).isoformat()
                }
                
            except Exception as e:
                stats[pool_name] = {
                    "error": str(e),
                    "health_status": False
                }
        
        return stats


class RedisMonitor:
    """Monitor Redis performance and health metrics."""
    
    def __init__(self, redis_pool: RedisConnectionPool):
        self.redis_pool = redis_pool
    
    async def get_redis_info(self, pool_name: str = "default") -> Dict[str, Any]:
        """Get Redis server information."""
        try:
            redis = await self.redis_pool.get_pool(pool_name)
            info = await redis.info()
            
            return {
                "version": info.get("redis_version"),
                "uptime_seconds": info.get("uptime_in_seconds"),
                "connected_clients": info.get("connected_clients"),
                "used_memory": info.get("used_memory"),
                "used_memory_human": info.get("used_memory_human"),
                "used_memory_peak": info.get("used_memory_peak"),
                "used_memory_peak_human": info.get("used_memory_peak_human"),
                "keyspace_hits": info.get("keyspace_hits"),
                "keyspace_misses": info.get("keyspace_misses"),
                "instantaneous_ops_per_sec": info.get("instantaneous_ops_per_sec"),
                "total_commands_processed": info.get("total_commands_processed"),
                "rejected_connections": info.get("rejected_connections"),
                "expired_keys": info.get("expired_keys"),
                "evicted_keys": info.get("evicted_keys")
            }
            
        except Exception as e:
            logger.error(f"Error getting Redis info: {str(e)}")
            return {"error": str(e)}
    
    async def get_cache_hit_ratio(self, pool_name: str = "default") -> float:
        """Calculate cache hit ratio."""
        try:
            info = await self.get_redis_info(pool_name)
            hits = info.get("keyspace_hits", 0)
            misses = info.get("keyspace_misses", 0)
            
            if hits + misses == 0:
                return 0.0
            
            return hits / (hits + misses)
            
        except Exception as e:
            logger.error(f"Error calculating cache hit ratio: {str(e)}")
            return 0.0
    
    async def get_memory_usage(self, pool_name: str = "default") -> Dict[str, Any]:
        """Get memory usage information."""
        try:
            info = await self.get_redis_info(pool_name)
            
            return {
                "used_memory_bytes": info.get("used_memory", 0),
                "used_memory_human": info.get("used_memory_human", "0B"),
                "peak_memory_bytes": info.get("used_memory_peak", 0),
                "peak_memory_human": info.get("used_memory_peak_human", "0B"),
                "memory_fragmentation_ratio": info.get("mem_fragmentation_ratio", 1.0)
            }
            
        except Exception as e:
            logger.error(f"Error getting memory usage: {str(e)}")
            return {"error": str(e)}
    
    async def get_key_statistics(self, pool_name: str = "default") -> Dict[str, Any]:
        """Get key statistics by pattern."""
        try:
            redis = await self.redis_pool.get_pool(pool_name)
            
            # Get keys by pattern
            patterns_to_check = [
                "coldcopy:*",
                "enrichment:*",
                "session:*",
                "rate_limit:*",
                "metrics:*",
                "reports:*",
                "reputation:*"
            ]
            
            statistics = {}
            
            for pattern in patterns_to_check:
                keys = await redis.keys(pattern)
                pattern_name = pattern.replace("*", "").rstrip(":")
                statistics[pattern_name] = {
                    "count": len(keys),
                    "sample_keys": keys[:5] if keys else []
                }
            
            # Get total key count
            all_keys = await redis.dbsize()
            statistics["total_keys"] = all_keys
            
            return statistics
            
        except Exception as e:
            logger.error(f"Error getting key statistics: {str(e)}")
            return {"error": str(e)}
    
    async def cleanup_expired_keys(self, pool_name: str = "default") -> Dict[str, int]:
        """Clean up expired keys manually."""
        try:
            redis = await self.redis_pool.get_pool(pool_name)
            
            # Patterns for different types of temporary data
            cleanup_patterns = [
                "session:*",
                "rate_limit:*:minute",  # Clean old minute-based rate limits
                "token_bucket:*",
                "temp:*"
            ]
            
            cleaned_counts = {}
            
            for pattern in cleanup_patterns:
                keys = await redis.keys(pattern)
                deleted = 0
                
                for key in keys:
                    ttl = await redis.ttl(key)
                    if ttl == -1:  # No expiration set
                        # Set expiration for orphaned keys
                        await redis.expire(key, 3600)  # 1 hour
                    elif ttl == -2:  # Key doesn't exist
                        deleted += 1
                
                pattern_name = pattern.replace("*", "").rstrip(":")
                cleaned_counts[pattern_name] = deleted
            
            return cleaned_counts
            
        except Exception as e:
            logger.error(f"Error cleaning up expired keys: {str(e)}")
            return {"error": str(e)}
    
    async def analyze_slow_operations(self, pool_name: str = "default") -> List[Dict[str, Any]]:
        """Analyze slow Redis operations."""
        try:
            redis = await self.redis_pool.get_pool(pool_name)
            
            # Get slow log
            slow_log = await redis.slowlog_get(10)  # Last 10 slow operations
            
            analyzed_operations = []
            
            for entry in slow_log:
                analyzed_operations.append({
                    "id": entry["id"],
                    "timestamp": datetime.fromtimestamp(entry["start_time"]).isoformat(),
                    "duration_microseconds": entry["duration"],
                    "command": " ".join(str(arg) for arg in entry["command"][:3])  # First 3 args
                })
            
            return analyzed_operations
            
        except Exception as e:
            logger.error(f"Error analyzing slow operations: {str(e)}")
            return [{"error": str(e)}]


# Global connection pool
redis_pool = RedisConnectionPool()
redis_monitor = RedisMonitor(redis_pool)


async def initialize_redis():
    """Initialize Redis connections."""
    try:
        # Create default pools
        await redis_pool.get_pool("default")
        await redis_pool.get_pool("cache")
        await redis_pool.get_pool("rate_limit")
        
        logger.info("Redis connections initialized successfully")
        
    except Exception as e:
        logger.error(f"Failed to initialize Redis connections: {str(e)}")
        raise


async def shutdown_redis():
    """Shutdown Redis connections."""
    try:
        await redis_pool.close_all()
        logger.info("Redis connections closed successfully")
        
    except Exception as e:
        logger.error(f"Error shutting down Redis connections: {str(e)}")


async def get_redis_pool(pool_name: str = "default") -> Redis:
    """Get Redis pool by name."""
    return await redis_pool.get_pool(pool_name)


async def health_check_redis() -> Dict[str, Any]:
    """Comprehensive Redis health check."""
    health_status = {
        "status": "healthy",
        "checks": {},
        "timestamp": datetime.utcnow().isoformat()
    }
    
    try:
        # Check all pools
        pool_stats = await redis_pool.get_pool_stats()
        
        for pool_name, stats in pool_stats.items():
            if "error" in stats or not stats.get("health_status", False):
                health_status["status"] = "unhealthy"
                health_status["checks"][pool_name] = {
                    "status": "failed",
                    "error": stats.get("error", "Pool unhealthy")
                }
            else:
                health_status["checks"][pool_name] = {
                    "status": "passed",
                    "stats": stats
                }
        
        # Check cache performance
        hit_ratio = await redis_monitor.get_cache_hit_ratio()
        if hit_ratio < 0.7:  # Less than 70% hit ratio
            health_status["checks"]["cache_performance"] = {
                "status": "warning",
                "hit_ratio": hit_ratio,
                "message": "Cache hit ratio below optimal threshold"
            }
        else:
            health_status["checks"]["cache_performance"] = {
                "status": "passed",
                "hit_ratio": hit_ratio
            }
        
        # Check memory usage
        memory_info = await redis_monitor.get_memory_usage()
        if "error" not in memory_info:
            health_status["checks"]["memory"] = {
                "status": "passed",
                "usage": memory_info
            }
        
        return health_status
        
    except Exception as e:
        logger.error(f"Redis health check failed: {str(e)}")
        return {
            "status": "unhealthy",
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }