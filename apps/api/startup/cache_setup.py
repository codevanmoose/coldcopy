"""
Cache system startup and integration for FastAPI.
"""
import logging
from fastapi import FastAPI
from contextlib import asynccontextmanager

from config.redis import get_redis_config, get_redis_connection, close_redis_connection
from utils.cache_manager import CacheManager, get_cache, close_cache
from middleware.cache_middleware import CacheMiddleware
from routers import cache_management

logger = logging.getLogger(__name__)


async def initialize_cache_system(app: FastAPI):
    """
    Initialize the cache system during application startup.
    
    This function:
    1. Establishes Redis connection
    2. Initializes cache manager
    3. Adds cache middleware
    4. Registers cache management routes
    """
    try:
        # Get Redis configuration
        redis_config = get_redis_config()
        logger.info(f"Initializing cache system with prefix: {redis_config.cache_prefix}")
        
        # Initialize Redis connection
        redis_conn = await get_redis_connection()
        logger.info("Redis connection established")
        
        # Initialize cache manager
        cache_manager = CacheManager(
            redis_url=redis_config.url,
            prefix=redis_config.cache_prefix,
            default_ttl=redis_config.default_ttl,
            max_connections=redis_config.max_connections
        )
        await cache_manager.initialize()
        
        # Store cache manager for global access
        app.state.cache_manager = cache_manager
        
        # Add cache middleware
        app.add_middleware(
            CacheMiddleware,
            cache_manager=cache_manager,
            default_ttl=300,  # 5 minutes default
            cacheable_paths=[
                "/api/campaigns",
                "/api/leads",
                "/api/analytics",
                "/api/templates",
                "/api/workspace/settings",
                "/api/enrichment/status"
            ],
            excluded_paths=[
                "/api/auth",
                "/api/webhooks",
                "/api/system",
                "/api/cache"  # Don't cache cache management endpoints
            ]
        )
        
        logger.info("Cache middleware added to application")
        
        # Register cache management routes
        app.include_router(cache_management.router)
        logger.info("Cache management endpoints registered")
        
        # Warm up cache with critical data
        await warm_up_cache(cache_manager)
        
        logger.info("Cache system initialization complete")
        
    except Exception as e:
        logger.error(f"Failed to initialize cache system: {e}")
        # Don't fail startup, but log the error
        # Application can run without cache, just slower


async def shutdown_cache_system(app: FastAPI):
    """
    Gracefully shutdown the cache system.
    
    This function:
    1. Flushes pending cache operations
    2. Closes Redis connections
    3. Cleans up resources
    """
    try:
        logger.info("Shutting down cache system...")
        
        # Get cache manager from app state
        cache_manager = getattr(app.state, "cache_manager", None)
        
        if cache_manager:
            # Log final stats
            stats = await cache_manager.get_stats()
            logger.info(f"Final cache statistics: {stats}")
            
            # Close cache manager
            await cache_manager.close()
        
        # Close global cache instance
        await close_cache()
        
        # Close Redis connection
        await close_redis_connection()
        
        logger.info("Cache system shutdown complete")
        
    except Exception as e:
        logger.error(f"Error during cache shutdown: {e}")


async def warm_up_cache(cache_manager: CacheManager):
    """
    Pre-populate cache with frequently accessed data.
    
    This improves initial response times after startup.
    """
    try:
        logger.info("Warming up cache...")
        
        # Add feature flags to cache
        from utils.cache_manager import CacheNamespace
        
        # Example: Cache feature flags
        feature_flags = {
            "new_ai_models": True,
            "advanced_analytics": True,
            "bulk_operations": True,
            "gdpr_compliance": True
        }
        
        await cache_manager.set(
            "global:feature_flags",
            feature_flags,
            namespace=CacheNamespace.FEATURE_FLAGS,
            ttl=3600  # 1 hour
        )
        
        # Cache system configuration
        system_config = {
            "max_campaigns_per_workspace": 100,
            "max_leads_per_campaign": 10000,
            "ai_rate_limit_per_hour": 1000,
            "enrichment_rate_limit_per_day": 5000
        }
        
        await cache_manager.set(
            "global:system_config",
            system_config,
            namespace=CacheNamespace.WORKSPACE_SETTINGS,
            ttl=3600
        )
        
        logger.info("Cache warm-up complete")
        
    except Exception as e:
        logger.error(f"Cache warm-up failed: {e}")


@asynccontextmanager
async def cache_lifespan(app: FastAPI):
    """
    Lifespan context manager for cache system.
    
    Use this with FastAPI's lifespan parameter for proper
    startup and shutdown of the cache system.
    """
    # Startup
    await initialize_cache_system(app)
    
    yield
    
    # Shutdown
    await shutdown_cache_system(app)


# Health check endpoint for cache
async def cache_health_check() -> dict:
    """
    Perform cache system health check.
    
    Returns:
        Dict with health status and metrics
    """
    try:
        # Get cache manager
        cache = await get_cache()
        
        # Test basic operations
        test_key = "health_check_test"
        test_value = {"timestamp": str(datetime.utcnow())}
        
        # Test set
        set_success = await cache.set(test_key, test_value, ttl=60)
        
        # Test get
        get_value = await cache.get(test_key)
        
        # Test delete
        delete_success = await cache.delete(test_key)
        
        # Get memory usage
        memory_info = await cache.get_memory_usage()
        
        # Get stats
        stats = await cache.get_stats()
        
        return {
            "status": "healthy" if set_success and get_value and delete_success else "degraded",
            "operations": {
                "set": set_success,
                "get": get_value is not None,
                "delete": delete_success
            },
            "memory": memory_info,
            "stats": stats,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Cache health check failed: {e}")
        return {
            "status": "unhealthy",
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }


# Import datetime
from datetime import datetime