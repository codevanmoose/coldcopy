"""
Rate limiting decorators for FastAPI endpoints.
"""
import functools
import logging
from typing import Callable, Optional, Dict, Any, Union
from datetime import datetime

from fastapi import Request, HTTPException, status, Depends
from fastapi.responses import JSONResponse

from core.redis import get_rate_limit_cache
from core.security import get_current_user_from_request
from utils.advanced_rate_limiting import (
    adaptive_limiter,
    distributed_limiter,
    circuit_breaker_limiter,
    geographic_limiter,
    RateLimitType,
    RateLimitConfig
)

logger = logging.getLogger(__name__)


def rate_limit(
    requests_per_minute: int = 60,
    requests_per_hour: int = 1000,
    requests_per_day: Optional[int] = None,
    per_user: bool = True,
    per_ip: bool = False,
    per_workspace: bool = False,
    burst_multiplier: float = 1.5,
    error_message: str = "Rate limit exceeded",
    skip_on_error: bool = True
):
    """
    Decorator for endpoint-specific rate limiting.
    
    Args:
        requests_per_minute: Requests allowed per minute
        requests_per_hour: Requests allowed per hour
        requests_per_day: Requests allowed per day (optional)
        per_user: Apply limit per authenticated user
        per_ip: Apply limit per IP address
        per_workspace: Apply limit per workspace
        burst_multiplier: Allow burst capacity (1.5 = 50% more)
        error_message: Custom error message
        skip_on_error: Skip rate limiting if an error occurs
    """
    
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            # Extract request object
            request = None
            for arg in args:
                if isinstance(arg, Request):
                    request = arg
                    break
            
            if not request:
                # Try to find request in kwargs
                request = kwargs.get('request')
            
            if not request:
                logger.warning(f"No request object found for rate limiting in {func.__name__}")
                if skip_on_error:
                    return await func(*args, **kwargs)
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Rate limiting configuration error"
                )
            
            try:
                # Build rate limit identifier
                identifiers = await _build_identifiers(
                    request, per_user, per_ip, per_workspace
                )
                
                if not identifiers:
                    logger.warning("No rate limit identifiers found")
                    if skip_on_error:
                        return await func(*args, **kwargs)
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail="Rate limiting identifier error"
                    )
                
                # Check rate limits for each identifier
                for identifier in identifiers:
                    await _check_endpoint_rate_limits(
                        identifier,
                        func.__name__,
                        requests_per_minute,
                        requests_per_hour,
                        requests_per_day,
                        burst_multiplier,
                        error_message
                    )
                
                # Execute the function
                return await func(*args, **kwargs)
                
            except HTTPException:
                raise
            except Exception as e:
                logger.error(f"Rate limiting error in {func.__name__}: {str(e)}")
                if skip_on_error:
                    return await func(*args, **kwargs)
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Rate limiting error"
                )
        
        return wrapper
    return decorator


def adaptive_rate_limit(
    limit_type: str = "api_call",
    base_requests_per_minute: int = 60,
    min_reputation: float = 0.1,
    max_reputation: float = 2.0,
    system_load_factor: bool = True
):
    """
    Decorator for adaptive rate limiting based on user reputation and system load.
    """
    
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            request = _extract_request(*args, **kwargs)
            if not request:
                return await func(*args, **kwargs)
            
            try:
                # Get user and calculate reputation
                user = await get_current_user_from_request(request)
                user_reputation = await _calculate_user_reputation(user) if user else 0.5
                
                # Get system load (simplified - in production, get from monitoring)
                system_load = await _get_system_load()
                
                # Build identifier
                if user:
                    identifier = f"adaptive:user:{user.id}:{func.__name__}"
                else:
                    ip = _get_client_ip(request)
                    identifier = f"adaptive:ip:{ip}:{func.__name__}"
                
                # Check adaptive rate limit
                status_result = await adaptive_limiter.check_adaptive_limit(
                    identifier, limit_type, user_reputation, system_load
                )
                
                if not status_result.allowed:
                    raise HTTPException(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        detail={
                            "error": "Adaptive rate limit exceeded",
                            "current_usage": status_result.current_usage,
                            "limit": status_result.limit,
                            "retry_after": status_result.retry_after,
                            "user_reputation": user_reputation,
                            "system_load": system_load
                        }
                    )
                
                return await func(*args, **kwargs)
                
            except HTTPException:
                raise
            except Exception as e:
                logger.error(f"Adaptive rate limiting error: {str(e)}")
                return await func(*args, **kwargs)
        
        return wrapper
    return decorator


def circuit_breaker_rate_limit(
    base_limit: int = 100,
    window_minutes: int = 1,
    failure_threshold: int = 5,
    recovery_timeout: int = 60
):
    """
    Decorator for circuit breaker rate limiting.
    """
    
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            request = _extract_request(*args, **kwargs)
            if not request:
                return await func(*args, **kwargs)
            
            try:
                # Build identifier
                user = await get_current_user_from_request(request)
                if user:
                    identifier = f"circuit:user:{user.id}:{func.__name__}"
                else:
                    ip = _get_client_ip(request)
                    identifier = f"circuit:ip:{ip}:{func.__name__}"
                
                # Define the normal rate limit check function
                async def normal_check():
                    rate_cache = await get_rate_limit_cache()
                    result = await rate_cache.check_rate_limit(
                        identifier,
                        base_limit,
                        window_minutes * 60,
                        1
                    )
                    
                    from utils.advanced_rate_limiting import RateLimitStatus
                    return RateLimitStatus(
                        allowed=result["allowed"],
                        current_usage=result["current_usage"],
                        limit=base_limit,
                        window_seconds=window_minutes * 60,
                        remaining=max(0, base_limit - result["current_usage"]),
                        reset_time=result["reset_time"]
                    )
                
                # Configure circuit breaker
                circuit_breaker = circuit_breaker_limiter
                circuit_breaker.failure_threshold = failure_threshold
                circuit_breaker.recovery_timeout = recovery_timeout
                
                # Check with circuit breaker
                status_result = await circuit_breaker.check_circuit_breaker(
                    identifier, normal_check
                )
                
                if not status_result.allowed:
                    raise HTTPException(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        detail={
                            "error": "Circuit breaker rate limit",
                            "message": status_result.error_message,
                            "retry_after": recovery_timeout if "circuit breaker" in (status_result.error_message or "") else 60
                        }
                    )
                
                return await func(*args, **kwargs)
                
            except HTTPException:
                raise
            except Exception as e:
                logger.error(f"Circuit breaker rate limiting error: {str(e)}")
                return await func(*args, **kwargs)
        
        return wrapper
    return decorator


def geographic_rate_limit(
    base_requests_per_minute: int = 60,
    country_header: str = "CF-IPCountry",  # Cloudflare header
    fallback_country: str = "unknown"
):
    """
    Decorator for geographic-based rate limiting.
    """
    
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            request = _extract_request(*args, **kwargs)
            if not request:
                return await func(*args, **kwargs)
            
            try:
                # Get country from headers
                country_code = request.headers.get(country_header, fallback_country)
                
                # Build identifier
                user = await get_current_user_from_request(request)
                if user:
                    identifier = f"geo:user:{user.id}:{func.__name__}"
                else:
                    ip = _get_client_ip(request)
                    identifier = f"geo:ip:{ip}:{func.__name__}"
                
                # Check geographic rate limit
                status_result = await geographic_limiter.check_geographic_limit(
                    identifier,
                    base_requests_per_minute,
                    60,  # 1 minute window
                    country_code
                )
                
                if not status_result.allowed:
                    raise HTTPException(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        detail={
                            "error": "Geographic rate limit exceeded",
                            "country": country_code,
                            "current_usage": status_result.current_usage,
                            "limit": status_result.limit,
                            "retry_after": 60
                        }
                    )
                
                return await func(*args, **kwargs)
                
            except HTTPException:
                raise
            except Exception as e:
                logger.error(f"Geographic rate limiting error: {str(e)}")
                return await func(*args, **kwargs)
        
        return wrapper
    return decorator


def token_bucket_rate_limit(
    max_tokens: int = 100,
    refill_rate: float = 10.0,  # tokens per minute
    tokens_per_request: int = 1
):
    """
    Decorator for token bucket rate limiting.
    """
    
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            request = _extract_request(*args, **kwargs)
            if not request:
                return await func(*args, **kwargs)
            
            try:
                # Build identifier
                user = await get_current_user_from_request(request)
                if user:
                    identifier = f"token:user:{user.id}:{func.__name__}"
                else:
                    ip = _get_client_ip(request)
                    identifier = f"token:ip:{ip}:{func.__name__}"
                
                # Create token bucket limiter
                from middleware.rate_limiting import TokenBucketRateLimit
                bucket = TokenBucketRateLimit(max_tokens, refill_rate, 60)
                
                # Check token bucket
                rate_cache = await get_rate_limit_cache()
                result = await bucket.consume_tokens(identifier, tokens_per_request, rate_cache)
                
                if not result["allowed"]:
                    raise HTTPException(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        detail={
                            "error": "Token bucket rate limit exceeded",
                            "tokens_remaining": result["tokens_remaining"],
                            "tokens_requested": tokens_per_request,
                            "refill_time": result["refill_time"]
                        }
                    )
                
                return await func(*args, **kwargs)
                
            except HTTPException:
                raise
            except Exception as e:
                logger.error(f"Token bucket rate limiting error: {str(e)}")
                return await func(*args, **kwargs)
        
        return wrapper
    return decorator


def daily_quota_limit(
    daily_limit: int = 1000,
    per_user: bool = True,
    per_workspace: bool = False,
    quota_type: str = "requests"
):
    """
    Decorator for daily quota limiting.
    """
    
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            request = _extract_request(*args, **kwargs)
            if not request:
                return await func(*args, **kwargs)
            
            try:
                # Build identifier
                user = await get_current_user_from_request(request)
                identifiers = []
                
                if per_user and user:
                    identifiers.append(f"daily:user:{user.id}:{quota_type}")
                
                if per_workspace and user and hasattr(user, 'workspace_id'):
                    identifiers.append(f"daily:workspace:{user.workspace_id}:{quota_type}")
                
                if not identifiers:
                    ip = _get_client_ip(request)
                    identifiers.append(f"daily:ip:{ip}:{quota_type}")
                
                # Check daily quotas
                rate_cache = await get_rate_limit_cache()
                today = datetime.utcnow().strftime("%Y-%m-%d")
                
                for identifier in identifiers:
                    daily_key = f"{identifier}:{today}"
                    current_usage = await rate_cache.cache.get(daily_key, 0)
                    
                    if current_usage >= daily_limit:
                        raise HTTPException(
                            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                            detail={
                                "error": "Daily quota exceeded",
                                "quota_type": quota_type,
                                "current_usage": current_usage,
                                "daily_limit": daily_limit,
                                "reset_time": f"{today}T23:59:59Z"
                            }
                        )
                    
                    # Increment usage
                    await rate_cache.cache.set(daily_key, current_usage + 1, 86400)  # 24 hours
                
                return await func(*args, **kwargs)
                
            except HTTPException:
                raise
            except Exception as e:
                logger.error(f"Daily quota limiting error: {str(e)}")
                return await func(*args, **kwargs)
        
        return wrapper
    return decorator


# Helper functions

def _extract_request(*args, **kwargs) -> Optional[Request]:
    """Extract Request object from function arguments."""
    for arg in args:
        if isinstance(arg, Request):
            return arg
    return kwargs.get('request')


async def _build_identifiers(
    request: Request,
    per_user: bool,
    per_ip: bool,
    per_workspace: bool
) -> list[str]:
    """Build rate limit identifiers based on configuration."""
    identifiers = []
    
    try:
        user = await get_current_user_from_request(request)
        
        if per_user and user:
            identifiers.append(f"user:{user.id}")
        
        if per_workspace and user and hasattr(user, 'workspace_id'):
            identifiers.append(f"workspace:{user.workspace_id}")
        
        if per_ip or not user:
            ip = _get_client_ip(request)
            identifiers.append(f"ip:{ip}")
    
    except Exception as e:
        logger.error(f"Error building rate limit identifiers: {str(e)}")
        # Fallback to IP-based limiting
        ip = _get_client_ip(request)
        identifiers.append(f"ip:{ip}")
    
    return identifiers


async def _check_endpoint_rate_limits(
    identifier: str,
    endpoint_name: str,
    requests_per_minute: int,
    requests_per_hour: int,
    requests_per_day: Optional[int],
    burst_multiplier: float,
    error_message: str
):
    """Check rate limits for an endpoint."""
    rate_cache = await get_rate_limit_cache()
    
    # Check minute limit
    minute_limit = int(requests_per_minute * burst_multiplier)
    minute_result = await rate_cache.check_rate_limit(
        f"{identifier}:minute:{endpoint_name}",
        minute_limit,
        60,
        1
    )
    
    if not minute_result["allowed"]:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "error": error_message,
                "limit_type": "minute",
                "current_usage": minute_result["current_usage"],
                "limit": minute_limit,
                "retry_after": 60
            }
        )
    
    # Check hour limit
    hour_result = await rate_cache.check_rate_limit(
        f"{identifier}:hour:{endpoint_name}",
        requests_per_hour,
        3600,
        1
    )
    
    if not hour_result["allowed"]:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "error": error_message,
                "limit_type": "hour",
                "current_usage": hour_result["current_usage"],
                "limit": requests_per_hour,
                "retry_after": 3600
            }
        )
    
    # Check daily limit if specified
    if requests_per_day:
        today = datetime.utcnow().strftime("%Y-%m-%d")
        daily_key = f"{identifier}:daily:{endpoint_name}:{today}"
        current_daily = await rate_cache.cache.get(daily_key, 0)
        
        if current_daily >= requests_per_day:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={
                    "error": error_message,
                    "limit_type": "daily",
                    "current_usage": current_daily,
                    "limit": requests_per_day,
                    "retry_after": 86400
                }
            )
        
        # Increment daily counter
        await rate_cache.cache.set(daily_key, current_daily + 1, 86400)


def _get_client_ip(request: Request) -> str:
    """Get client IP address from request."""
    # Check for forwarded headers first
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip
    
    # Fallback to client host
    if request.client:
        return request.client.host
    
    return "unknown"


async def _calculate_user_reputation(user) -> float:
    """Calculate user reputation score (0.1 to 2.0)."""
    if not user:
        return 0.5
    
    # Simple reputation calculation based on user attributes
    reputation = 1.0
    
    # Account age factor
    if hasattr(user, 'created_at'):
        account_age_days = (datetime.utcnow() - user.created_at).days
        if account_age_days > 365:  # Older accounts get bonus
            reputation *= 1.2
        elif account_age_days < 7:  # New accounts get penalty
            reputation *= 0.8
    
    # Plan level factor
    if hasattr(user, 'plan'):
        plan_multipliers = {
            "free": 0.8,
            "pro": 1.2,
            "enterprise": 1.5
        }
        reputation *= plan_multipliers.get(user.plan, 1.0)
    
    # Email verification factor
    if hasattr(user, 'email_verified') and user.email_verified:
        reputation *= 1.1
    
    # Clamp to valid range
    return max(0.1, min(2.0, reputation))


async def _get_system_load() -> float:
    """Get current system load (0.0 to 1.0)."""
    try:
        # In production, get this from monitoring system
        # For now, return a mock value
        import random
        return random.uniform(0.2, 0.8)
    except:
        return 0.5  # Default moderate load