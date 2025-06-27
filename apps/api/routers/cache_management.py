"""
Cache management API endpoints for monitoring and administration.
"""
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from datetime import datetime

from models.user import User
from utils.auth import get_current_user, require_admin
from utils.cache_manager import CacheNamespace, get_cache
from middleware.cache_middleware import cache_endpoint, invalidate_cache
from services.cache_warming_service import get_warming_service
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/cache", tags=["Cache Management"])


@router.get("/stats")
@require_admin
async def get_cache_statistics(
    namespace: Optional[CacheNamespace] = Query(None, description="Filter by namespace"),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Get cache statistics including hit rates and memory usage.
    
    Requires admin permissions.
    """
    try:
        cache = await get_cache()
        
        # Get stats
        stats = await cache.get_stats(namespace)
        
        # Get memory usage
        memory = await cache.get_memory_usage()
        
        return {
            "stats": stats,
            "memory": memory,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Failed to get cache stats: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve cache statistics")


@router.post("/invalidate")
@require_admin
async def invalidate_cache_entries(
    namespace: CacheNamespace,
    pattern: Optional[str] = Query("*", description="Key pattern to match"),
    tag: Optional[str] = Query(None, description="Tag to invalidate"),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Invalidate cache entries by pattern or tag.
    
    Requires admin permissions.
    """
    try:
        cache = await get_cache()
        
        if tag:
            # Invalidate by tag
            deleted = await cache.delete_by_tag(tag)
            return {
                "deleted": deleted,
                "method": "tag",
                "tag": tag,
                "namespace": namespace.value
            }
        else:
            # Invalidate by pattern
            deleted = await cache.delete_pattern(pattern, namespace)
            return {
                "deleted": deleted,
                "method": "pattern",
                "pattern": pattern,
                "namespace": namespace.value
            }
            
    except Exception as e:
        logger.error(f"Failed to invalidate cache: {e}")
        raise HTTPException(status_code=500, detail="Failed to invalidate cache entries")


@router.post("/clear")
@require_admin
async def clear_cache_namespace(
    namespace: CacheNamespace,
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Clear all entries in a cache namespace.
    
    Requires admin permissions.
    """
    try:
        cache = await get_cache()
        deleted = await cache.clear_namespace(namespace)
        
        return {
            "deleted": deleted,
            "namespace": namespace.value,
            "cleared_at": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Failed to clear cache namespace: {e}")
        raise HTTPException(status_code=500, detail="Failed to clear cache namespace")


@router.get("/workspace/{workspace_id}/stats")
async def get_workspace_cache_stats(
    workspace_id: str,
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Get cache statistics for a specific workspace.
    """
    # Verify user has access to workspace
    if current_user.workspace_id != workspace_id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Access denied")
    
    try:
        cache = await get_cache()
        
        # Get AI response cache stats
        ai_cache = cache.AIResponseCache(cache)
        
        # Get enrichment cache stats
        enrichment_cache = cache.LeadEnrichmentCache(cache)
        
        # Get analytics cache stats
        analytics_cache = cache.AnalyticsCache(cache)
        
        # Aggregate stats for workspace
        stats = {
            "workspace_id": workspace_id,
            "ai_responses": {
                "namespace": CacheNamespace.AI_RESPONSES.value,
                "estimated_savings": 0  # Would calculate based on cache hits
            },
            "lead_enrichment": {
                "namespace": CacheNamespace.LEAD_ENRICHMENT.value,
                "cached_leads": 0  # Would count cached entries
            },
            "analytics": {
                "namespace": CacheNamespace.ANALYTICS.value,
                "cached_reports": 0  # Would count cached entries
            }
        }
        
        return stats
        
    except Exception as e:
        logger.error(f"Failed to get workspace cache stats: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve workspace cache statistics")


@router.post("/workspace/{workspace_id}/invalidate")
async def invalidate_workspace_cache(
    workspace_id: str,
    namespace: Optional[CacheNamespace] = None,
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Invalidate all cache entries for a workspace.
    """
    # Verify user has access to workspace
    if current_user.workspace_id != workspace_id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Access denied")
    
    try:
        cache = await get_cache()
        total_deleted = 0
        
        if namespace:
            # Invalidate specific namespace
            deleted = await cache.delete_by_tag(workspace_id)
            total_deleted = deleted
        else:
            # Invalidate all namespaces for workspace
            for ns in CacheNamespace:
                deleted = await cache.delete_by_tag(workspace_id)
                total_deleted += deleted
        
        return {
            "workspace_id": workspace_id,
            "deleted": total_deleted,
            "namespace": namespace.value if namespace else "all"
        }
        
    except Exception as e:
        logger.error(f"Failed to invalidate workspace cache: {e}")
        raise HTTPException(status_code=500, detail="Failed to invalidate workspace cache")


@router.get("/health")
async def cache_health_check() -> Dict[str, Any]:
    """
    Check cache health and connectivity.
    """
    try:
        cache = await get_cache()
        
        # Test Redis connection
        await cache._redis.ping()
        
        # Get basic info
        memory = await cache.get_memory_usage()
        
        return {
            "status": "healthy",
            "connected": True,
            "memory_used_mb": memory.get("used_memory_mb", 0),
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Cache health check failed: {e}")
        return {
            "status": "unhealthy",
            "connected": False,
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }


# Example endpoints using cache decorators

@router.get("/campaigns/{campaign_id}/analytics")
@cache_endpoint(ttl=300, namespace=CacheNamespace.ANALYTICS)
async def get_campaign_analytics_cached(
    campaign_id: str,
    workspace_id: str = Query(...),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Get campaign analytics with caching.
    
    Results are cached for 5 minutes.
    """
    # This would normally fetch from database
    # For demonstration, returning mock data
    return {
        "campaign_id": campaign_id,
        "workspace_id": workspace_id,
        "metrics": {
            "sent": 1000,
            "opened": 450,
            "clicked": 120,
            "replied": 25
        },
        "generated_at": datetime.utcnow().isoformat()
    }


@router.post("/campaigns/{campaign_id}/analytics/refresh")
@invalidate_cache(pattern="{workspace_id}:campaigns:{campaign_id}:*")
async def refresh_campaign_analytics(
    campaign_id: str,
    workspace_id: str = Query(...),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Force refresh campaign analytics by invalidating cache.
    """
    # This would trigger recalculation
    return {
        "campaign_id": campaign_id,
        "workspace_id": workspace_id,
        "refreshed": True,
        "timestamp": datetime.utcnow().isoformat()
    }


@router.post("/warm/workspace/{workspace_id}")
async def warm_workspace_cache(
    workspace_id: str,
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Warm cache for a specific workspace.
    
    Pre-populates frequently accessed data.
    """
    # Verify user has access to workspace
    if current_user.workspace_id != workspace_id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Access denied")
    
    try:
        warming_service = await get_warming_service()
        await warming_service.warm_workspace_cache(workspace_id)
        
        return {
            "workspace_id": workspace_id,
            "status": "warmed",
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Failed to warm workspace cache: {e}")
        raise HTTPException(status_code=500, detail="Failed to warm workspace cache")


@router.post("/warm/user/{user_id}")
@require_admin
async def warm_user_cache(
    user_id: str,
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Warm cache for a specific user.
    
    Requires admin permissions.
    """
    try:
        warming_service = await get_warming_service()
        await warming_service.warm_user_cache(user_id)
        
        return {
            "user_id": user_id,
            "status": "warmed",
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Failed to warm user cache: {e}")
        raise HTTPException(status_code=500, detail="Failed to warm user cache")


@router.get("/warming/stats")
@require_admin
async def get_warming_statistics(
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Get cache warming service statistics.
    
    Requires admin permissions.
    """
    try:
        warming_service = await get_warming_service()
        stats = await warming_service.get_warming_stats()
        
        return stats
        
    except Exception as e:
        logger.error(f"Failed to get warming stats: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve warming statistics")


@router.post("/warming/start")
@require_admin
async def start_cache_warming(
    interval: int = Query(300, description="Warming interval in seconds"),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Start the cache warming service.
    
    Requires admin permissions.
    """
    try:
        warming_service = await get_warming_service()
        await warming_service.start_background_warming(interval)
        
        return {
            "status": "started",
            "interval_seconds": interval,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Failed to start cache warming: {e}")
        raise HTTPException(status_code=500, detail="Failed to start cache warming")


@router.post("/warming/stop")
@require_admin
async def stop_cache_warming(
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Stop the cache warming service.
    
    Requires admin permissions.
    """
    try:
        warming_service = await get_warming_service()
        await warming_service.stop_background_warming()
        
        return {
            "status": "stopped",
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Failed to stop cache warming: {e}")
        raise HTTPException(status_code=500, detail="Failed to stop cache warming")