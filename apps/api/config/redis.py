"""
Redis configuration and connection management.
"""
import os
from typing import Optional
from dataclasses import dataclass
import redis.asyncio as redis
from redis.asyncio.sentinel import Sentinel
import logging

logger = logging.getLogger(__name__)


@dataclass
class RedisConfig:
    """Redis configuration settings."""
    # Connection settings
    url: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    password: Optional[str] = os.getenv("REDIS_PASSWORD")
    
    # Connection pool settings
    max_connections: int = int(os.getenv("REDIS_MAX_CONNECTIONS", "100"))
    min_connections: int = int(os.getenv("REDIS_MIN_CONNECTIONS", "10"))
    connection_timeout: int = int(os.getenv("REDIS_CONNECTION_TIMEOUT", "20"))
    socket_keepalive: bool = True
    socket_keepalive_options: dict = None
    
    # Retry settings
    retry_on_timeout: bool = True
    retry_on_error: list = [ConnectionError, TimeoutError]
    max_retries: int = 3
    retry_delay: float = 0.1
    
    # Sentinel settings (for HA)
    use_sentinel: bool = os.getenv("REDIS_USE_SENTINEL", "false").lower() == "true"
    sentinel_hosts: list = os.getenv("REDIS_SENTINEL_HOSTS", "").split(",") if os.getenv("REDIS_SENTINEL_HOSTS") else []
    sentinel_master: str = os.getenv("REDIS_SENTINEL_MASTER", "mymaster")
    
    # SSL settings
    ssl_enabled: bool = os.getenv("REDIS_SSL_ENABLED", "false").lower() == "true"
    ssl_certfile: Optional[str] = os.getenv("REDIS_SSL_CERTFILE")
    ssl_keyfile: Optional[str] = os.getenv("REDIS_SSL_KEYFILE")
    ssl_ca_certs: Optional[str] = os.getenv("REDIS_SSL_CA_CERTS")
    
    # Cache settings
    cache_prefix: str = os.getenv("REDIS_CACHE_PREFIX", "coldcopy")
    default_ttl: int = int(os.getenv("REDIS_DEFAULT_TTL", "3600"))
    
    # Feature flags
    enable_compression: bool = os.getenv("REDIS_ENABLE_COMPRESSION", "true").lower() == "true"
    compression_threshold: int = int(os.getenv("REDIS_COMPRESSION_THRESHOLD", "1024"))  # bytes
    
    def __post_init__(self):
        """Post-initialization setup."""
        if self.socket_keepalive and not self.socket_keepalive_options:
            # Default TCP keepalive options
            self.socket_keepalive_options = {
                # TCP_KEEPIDLE
                1: 120,
                # TCP_KEEPINTVL
                2: 30,
                # TCP_KEEPCNT
                3: 3,
            }


class RedisConnectionManager:
    """Manages Redis connections with health checking and failover."""
    
    def __init__(self, config: RedisConfig):
        self.config = config
        self._redis: Optional[redis.Redis] = None
        self._sentinel: Optional[Sentinel] = None
        self._pool: Optional[redis.ConnectionPool] = None
    
    async def initialize(self) -> redis.Redis:
        """Initialize Redis connection."""
        try:
            if self.config.use_sentinel:
                # Use Sentinel for high availability
                self._sentinel = Sentinel(
                    [(host.split(":")[0], int(host.split(":")[1])) 
                     for host in self.config.sentinel_hosts],
                    password=self.config.password,
                    socket_timeout=self.config.connection_timeout,
                    socket_keepalive=self.config.socket_keepalive,
                    socket_keepalive_options=self.config.socket_keepalive_options,
                )
                
                # Get master connection
                self._redis = await self._sentinel.master_for(
                    self.config.sentinel_master,
                    redis_class=redis.Redis,
                    decode_responses=False,
                    max_connections=self.config.max_connections,
                )
                
                logger.info(f"Connected to Redis via Sentinel (master: {self.config.sentinel_master})")
            
            else:
                # Direct connection
                self._pool = redis.ConnectionPool.from_url(
                    self.config.url,
                    password=self.config.password,
                    max_connections=self.config.max_connections,
                    decode_responses=False,
                    socket_timeout=self.config.connection_timeout,
                    socket_keepalive=self.config.socket_keepalive,
                    socket_keepalive_options=self.config.socket_keepalive_options,
                    retry_on_timeout=self.config.retry_on_timeout,
                    health_check_interval=30,
                )
                
                self._redis = redis.Redis(
                    connection_pool=self._pool,
                    retry_on_error=self.config.retry_on_error,
                )
                
                # Test connection
                await self._redis.ping()
                logger.info(f"Connected to Redis at {self.config.url}")
            
            return self._redis
            
        except Exception as e:
            logger.error(f"Failed to connect to Redis: {e}")
            raise
    
    async def get_connection(self) -> redis.Redis:
        """Get Redis connection, initializing if needed."""
        if not self._redis:
            await self.initialize()
        return self._redis
    
    async def health_check(self) -> dict:
        """Perform health check on Redis connection."""
        try:
            if not self._redis:
                return {
                    "healthy": False,
                    "error": "Not connected"
                }
            
            # Ping Redis
            await self._redis.ping()
            
            # Get info
            info = await self._redis.info()
            
            # Get memory info
            memory_info = await self._redis.info("memory")
            
            return {
                "healthy": True,
                "connected_clients": info.get("connected_clients", 0),
                "used_memory_mb": memory_info.get("used_memory", 0) / 1024 / 1024,
                "used_memory_peak_mb": memory_info.get("used_memory_peak", 0) / 1024 / 1024,
                "uptime_days": info.get("uptime_in_seconds", 0) / 86400,
                "version": info.get("redis_version", "unknown"),
                "role": info.get("role", "unknown"),
            }
            
        except Exception as e:
            logger.error(f"Redis health check failed: {e}")
            return {
                "healthy": False,
                "error": str(e)
            }
    
    async def close(self):
        """Close Redis connections."""
        if self._redis:
            await self._redis.close()
        if self._pool:
            await self._pool.disconnect()
        logger.info("Redis connections closed")


# Global instances
_redis_config: Optional[RedisConfig] = None
_redis_manager: Optional[RedisConnectionManager] = None


def get_redis_config() -> RedisConfig:
    """Get Redis configuration."""
    global _redis_config
    if not _redis_config:
        _redis_config = RedisConfig()
    return _redis_config


async def get_redis_connection() -> redis.Redis:
    """Get Redis connection."""
    global _redis_manager
    if not _redis_manager:
        config = get_redis_config()
        _redis_manager = RedisConnectionManager(config)
    return await _redis_manager.get_connection()


async def close_redis_connection():
    """Close Redis connection."""
    global _redis_manager
    if _redis_manager:
        await _redis_manager.close()
        _redis_manager = None