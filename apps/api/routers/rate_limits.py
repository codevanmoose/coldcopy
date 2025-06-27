"""
Rate limiting management endpoints for administrators.
"""
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, Field

from core.security import require_permissions
from models.user import User
from utils.advanced_rate_limiting import rate_limit_monitor, RateLimitConfig
from core.redis import get_rate_limit_cache

router = APIRouter()
logger = logging.getLogger(__name__)


class RateLimitConfigModel(BaseModel):
    """Rate limit configuration model."""
    limit: int = Field(..., description="Number of requests allowed")
    window_seconds: int = Field(..., description="Time window in seconds")
    burst_limit: Optional[int] = Field(None, description="Burst capacity limit")
    description: str = Field("", description="Description of the rate limit")


class RateLimitOverride(BaseModel):
    """Rate limit override for specific users or IPs."""
    identifier_type: str = Field(..., description="Type: user, ip, workspace")
    identifier_value: str = Field(..., description="User ID, IP address, or workspace ID")
    endpoint: Optional[str] = Field(None, description="Specific endpoint or * for all")
    config: RateLimitConfigModel
    expires_at: Optional[datetime] = Field(None, description="Override expiration")
    reason: str = Field("", description="Reason for override")


class RateLimitStatus(BaseModel):
    """Current rate limit status."""
    identifier: str
    current_usage: int
    limit: int
    window_seconds: int
    remaining: int
    reset_time: str
    last_request: Optional[str] = None


class RateLimitAnalytics(BaseModel):
    """Rate limit analytics response."""
    total_identifiers: int
    time_range_hours: int
    top_consumers: List[Dict[str, Any]]
    limit_breaches: List[Dict[str, Any]]
    summary: Dict[str, Any]
    recommendations: List[str]


@router.get("/analytics", response_model=RateLimitAnalytics)
async def get_rate_limit_analytics(
    workspace_id: Optional[str] = Query(None, description="Filter by workspace ID"),
    time_range_hours: int = Query(24, description="Time range in hours"),
    current_user: User = Depends(require_permissions({"analytics:read"}))
):
    """Get rate limit analytics and usage patterns."""
    
    try:
        # Generate comprehensive report
        report = await rate_limit_monitor.generate_rate_limit_report(workspace_id)
        
        return RateLimitAnalytics(
            total_identifiers=report["summary"]["total_identifiers"],
            time_range_hours=time_range_hours,
            top_consumers=report["analytics"]["top_consumers"],
            limit_breaches=report["analytics"]["limit_breaches"],
            summary=report["summary"],
            recommendations=report["recommendations"]
        )
    
    except Exception as e:
        logger.error(f"Error getting rate limit analytics: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving analytics: {str(e)}"
        )


@router.get("/status/{identifier}")
async def get_rate_limit_status(
    identifier: str,
    endpoint: str = Query("*", description="Specific endpoint or * for general"),
    current_user: User = Depends(require_permissions({"analytics:read"}))
) -> Dict[str, Any]:
    """Get current rate limit status for an identifier."""
    
    try:
        rate_cache = await get_rate_limit_cache()
        
        # Get status for different time windows
        windows = {
            "minute": 60,
            "hour": 3600,
            "day": 86400
        }
        
        status_data = {}
        
        for window_name, window_seconds in windows.items():
            key = f"rate_limit:{identifier}:{window_name}"
            if endpoint != "*":
                key = f"{key}:{endpoint}"
            
            # Get current usage
            usage_data = await rate_cache.get_rate_limit_status(
                identifier, 1000, window_seconds  # Use high limit for status check
            )
            
            status_data[window_name] = {
                "current_usage": usage_data.get("current_usage", 0),
                "limit": usage_data.get("limit", 1000),
                "remaining": usage_data.get("remaining", 1000),
                "reset_time": usage_data.get("reset_time", datetime.utcnow().isoformat())
            }
        
        return {
            "identifier": identifier,
            "endpoint": endpoint,
            "status": status_data,
            "checked_at": datetime.utcnow().isoformat()
        }
    
    except Exception as e:
        logger.error(f"Error getting rate limit status: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving status: {str(e)}"
        )


@router.post("/override")
async def create_rate_limit_override(
    override: RateLimitOverride,
    current_user: User = Depends(require_permissions({"admin:write"}))
):
    """Create a rate limit override for specific user, IP, or workspace."""
    
    try:
        rate_cache = await get_rate_limit_cache()
        
        # Create override key
        override_key = f"rate_limit_override:{override.identifier_type}:{override.identifier_value}"
        if override.endpoint and override.endpoint != "*":
            override_key = f"{override_key}:{override.endpoint}"
        
        # Store override configuration
        override_data = {
            "config": override.config.dict(),
            "created_by": current_user.id,
            "created_at": datetime.utcnow().isoformat(),
            "expires_at": override.expires_at.isoformat() if override.expires_at else None,
            "reason": override.reason
        }
        
        # Set TTL based on expiration
        ttl = None
        if override.expires_at:
            ttl = int((override.expires_at - datetime.utcnow()).total_seconds())
        
        await rate_cache.cache.set(override_key, override_data, ttl)
        
        logger.info(
            f"Rate limit override created by {current_user.id} for "
            f"{override.identifier_type}:{override.identifier_value}"
        )
        
        return {
            "message": "Rate limit override created successfully",
            "override_key": override_key,
            "expires_at": override.expires_at.isoformat() if override.expires_at else None
        }
    
    except Exception as e:
        logger.error(f"Error creating rate limit override: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating override: {str(e)}"
        )


@router.get("/overrides")
async def list_rate_limit_overrides(
    identifier_type: Optional[str] = Query(None, description="Filter by type"),
    current_user: User = Depends(require_permissions({"admin:read"}))
):
    """List all active rate limit overrides."""
    
    try:
        rate_cache = await get_rate_limit_cache()
        
        # Get all override keys
        pattern = "rate_limit_override:*"
        if identifier_type:
            pattern = f"rate_limit_override:{identifier_type}:*"
        
        keys = await rate_cache.cache.redis.keys(pattern)
        
        overrides = []
        for key in keys:
            try:
                override_data = await rate_cache.cache.get(key)
                if override_data:
                    # Parse key to extract identifier info
                    key_parts = key.split(":")
                    if len(key_parts) >= 4:
                        override_info = {
                            "override_key": key,
                            "identifier_type": key_parts[2],
                            "identifier_value": key_parts[3],
                            "endpoint": ":".join(key_parts[4:]) if len(key_parts) > 4 else "*",
                            "config": override_data.get("config", {}),
                            "created_by": override_data.get("created_by"),
                            "created_at": override_data.get("created_at"),
                            "expires_at": override_data.get("expires_at"),
                            "reason": override_data.get("reason", "")
                        }
                        overrides.append(override_info)
            
            except Exception as e:
                logger.error(f"Error processing override key {key}: {str(e)}")
                continue
        
        return {
            "overrides": overrides,
            "total_count": len(overrides)
        }
    
    except Exception as e:
        logger.error(f"Error listing rate limit overrides: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error listing overrides: {str(e)}"
        )


@router.delete("/override/{override_key}")
async def delete_rate_limit_override(
    override_key: str,
    current_user: User = Depends(require_permissions({"admin:write"}))
):
    """Delete a rate limit override."""
    
    try:
        rate_cache = await get_rate_limit_cache()
        
        # Check if override exists
        override_data = await rate_cache.cache.get(override_key)
        if not override_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Rate limit override not found"
            )
        
        # Delete the override
        await rate_cache.cache.delete(override_key)
        
        logger.info(f"Rate limit override {override_key} deleted by {current_user.id}")
        
        return {
            "message": "Rate limit override deleted successfully",
            "deleted_key": override_key
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting rate limit override: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting override: {str(e)}"
        )


@router.post("/reset/{identifier}")
async def reset_rate_limit(
    identifier: str,
    endpoint: str = Query("*", description="Specific endpoint or * for all"),
    current_user: User = Depends(require_permissions({"admin:write"}))
):
    """Reset rate limit counters for an identifier."""
    
    try:
        rate_cache = await get_rate_limit_cache()
        
        # Reset different time windows
        windows = ["minute", "hour", "day"]
        deleted_keys = []
        
        for window in windows:
            key = f"rate_limit:{identifier}:{window}"
            if endpoint != "*":
                key = f"{key}:{endpoint}"
            
            # Delete the rate limit key to reset counter
            await rate_cache.cache.delete(key)
            deleted_keys.append(key)
        
        logger.info(
            f"Rate limits reset for {identifier} by {current_user.id}. "
            f"Keys: {deleted_keys}"
        )
        
        return {
            "message": "Rate limits reset successfully",
            "identifier": identifier,
            "endpoint": endpoint,
            "reset_keys": deleted_keys,
            "reset_at": datetime.utcnow().isoformat()
        }
    
    except Exception as e:
        logger.error(f"Error resetting rate limit: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error resetting rate limit: {str(e)}"
        )


@router.get("/top-consumers")
async def get_top_rate_limit_consumers(
    limit: int = Query(20, description="Number of top consumers to return"),
    time_range_hours: int = Query(24, description="Time range in hours"),
    current_user: User = Depends(require_permissions({"analytics:read"}))
):
    """Get top rate limit consumers."""
    
    try:
        analytics = await rate_limit_monitor.get_rate_limit_analytics("*", time_range_hours)
        
        top_consumers = analytics["top_consumers"][:limit]
        
        # Add additional details for each consumer
        enhanced_consumers = []
        for consumer in top_consumers:
            enhanced_consumer = consumer.copy()
            
            # Try to get more details about the identifier
            identifier = consumer["identifier"]
            if identifier.startswith("user:"):
                enhanced_consumer["type"] = "user"
                enhanced_consumer["user_id"] = identifier.split(":")[1]
            elif identifier.startswith("ip:"):
                enhanced_consumer["type"] = "ip"
                enhanced_consumer["ip_address"] = identifier.split(":")[1]
            elif identifier.startswith("workspace:"):
                enhanced_consumer["type"] = "workspace"
                enhanced_consumer["workspace_id"] = identifier.split(":")[1]
            else:
                enhanced_consumer["type"] = "unknown"
            
            enhanced_consumers.append(enhanced_consumer)
        
        return {
            "top_consumers": enhanced_consumers,
            "time_range_hours": time_range_hours,
            "total_found": len(analytics["top_consumers"]),
            "generated_at": datetime.utcnow().isoformat()
        }
    
    except Exception as e:
        logger.error(f"Error getting top consumers: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving top consumers: {str(e)}"
        )


@router.get("/breach-alerts")
async def get_rate_limit_breach_alerts(
    severity: Optional[str] = Query(None, description="Filter by severity: high, warning"),
    current_user: User = Depends(require_permissions({"analytics:read"}))
):
    """Get current rate limit breach alerts."""
    
    try:
        analytics = await rate_limit_monitor.get_rate_limit_analytics()
        
        breaches = analytics["limit_breaches"]
        
        # Filter by severity if specified
        if severity:
            breaches = [b for b in breaches if b.get("severity") == severity]
        
        # Add additional context to breaches
        enhanced_breaches = []
        for breach in breaches:
            enhanced_breach = breach.copy()
            
            # Calculate breach percentage
            usage = breach["usage"]
            limit = breach["limit"]
            enhanced_breach["breach_percentage"] = (usage / limit * 100) if limit > 0 else 0
            
            # Categorize breach severity
            if usage >= limit:
                enhanced_breach["status"] = "exceeded"
            elif (usage / limit) > 0.95:
                enhanced_breach["status"] = "critical"
            elif (usage / limit) > 0.90:
                enhanced_breach["status"] = "warning"
            else:
                enhanced_breach["status"] = "normal"
            
            enhanced_breaches.append(enhanced_breach)
        
        return {
            "breaches": enhanced_breaches,
            "total_breaches": len(breaches),
            "high_severity_count": len([b for b in breaches if b.get("severity") == "high"]),
            "warning_count": len([b for b in breaches if b.get("severity") == "warning"]),
            "checked_at": datetime.utcnow().isoformat()
        }
    
    except Exception as e:
        logger.error(f"Error getting breach alerts: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving breach alerts: {str(e)}"
        )


@router.get("/config")
async def get_rate_limit_configuration(
    current_user: User = Depends(require_permissions({"admin:read"}))
):
    """Get current rate limiting configuration."""
    
    try:
        # This would typically come from a configuration management system
        # For now, return the middleware configuration
        from middleware.rate_limiting import RateLimitMiddleware
        
        # Create a dummy instance to get configuration
        middleware = RateLimitMiddleware(None)
        
        config = {
            "default_limits": {
                "requests_per_minute": middleware.default_rpm,
                "requests_per_hour": middleware.default_rph,
                "burst_requests_per_minute": middleware.burst_rpm
            },
            "endpoint_limits": {},
            "user_type_limits": {},
            "ip_limits": {}
        }
        
        # Organize rate limits by category
        for key, limits in middleware.rate_limits.items():
            if key.startswith("POST:") or key.startswith("GET:"):
                config["endpoint_limits"][key] = limits
            elif key.startswith("user_type:"):
                user_type = key.replace("user_type:", "")
                config["user_type_limits"][user_type] = limits
            elif key.startswith("ip_"):
                config["ip_limits"][key] = limits
        
        rate_cache = await get_rate_limit_cache()
        override_keys = await rate_cache.cache.redis.keys("rate_limit_override:*")
        
        return {
            "configuration": config,
            "last_updated": datetime.utcnow().isoformat(),
            "active_overrides_count": len(override_keys)
        }
    
    except Exception as e:
        logger.error(f"Error getting rate limit configuration: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving configuration: {str(e)}"
        )