"""
Rate limiting middleware using Redis for ColdCopy API.
"""
import logging
from typing import Callable, Dict, Any, Optional
from datetime import datetime, timedelta

from fastapi import Request, Response, HTTPException, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from core.redis import get_rate_limit_cache
from core.security import get_current_user_from_token

logger = logging.getLogger(__name__)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Rate limiting middleware with different limits for different user types and endpoints.
    """
    
    def __init__(
        self,
        app,
        default_requests_per_minute: int = 60,
        default_requests_per_hour: int = 1000,
        burst_requests_per_minute: int = 100,
    ):
        super().__init__(app)
        self.default_rpm = default_requests_per_minute
        self.default_rph = default_requests_per_hour
        self.burst_rpm = burst_requests_per_minute
        
        # Rate limit configurations for different endpoints and user types
        self.rate_limits = {
            # API endpoints with specific limits
            "POST:/api/email/send": {
                "rpm": 10,  # 10 emails per minute
                "rph": 100,  # 100 emails per hour
                "description": "Email sending"
            },
            "POST:/api/email/send-bulk": {
                "rpm": 2,   # 2 bulk operations per minute
                "rph": 20,  # 20 bulk operations per hour
                "description": "Bulk email sending"
            },
            "POST:/api/campaigns/{campaign_id}/action": {
                "rpm": 5,   # 5 campaign actions per minute
                "rph": 50,  # 50 campaign actions per hour
                "description": "Campaign actions"
            },
            "POST:/api/auth/login": {
                "rpm": 5,   # 5 login attempts per minute
                "rph": 20,  # 20 login attempts per hour
                "description": "Authentication"
            },
            "POST:/api/auth/refresh": {
                "rpm": 10,  # 10 token refreshes per minute
                "rph": 100, # 100 token refreshes per hour
                "description": "Token refresh"
            },
            
            # User type specific limits
            "user_type:free": {
                "rpm": 30,
                "rph": 500,
                "description": "Free tier user"
            },
            "user_type:pro": {
                "rpm": 100,
                "rph": 2000,
                "description": "Pro tier user"
            },
            "user_type:enterprise": {
                "rpm": 500,
                "rph": 10000,
                "description": "Enterprise tier user"
            },
            
            # IP-based limits for unauthenticated requests
            "ip_default": {
                "rpm": 20,
                "rph": 200,
                "description": "IP-based limit"
            }
        }
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Process request with rate limiting."""
        
        # Skip rate limiting for certain paths
        if self._should_skip_rate_limiting(request):
            return await call_next(request)
        
        try:
            # Get rate limit cache
            rate_cache = await get_rate_limit_cache()
            
            # Determine identifier and limits
            identifier, limits = await self._get_identifier_and_limits(request)
            
            # Check rate limits (minute and hour windows)
            minute_check = await rate_cache.check_rate_limit(
                f"{identifier}:minute",
                limits["rpm"],
                60,  # 60 seconds
                1    # cost
            )
            
            hour_check = await rate_cache.check_rate_limit(
                f"{identifier}:hour",
                limits["rph"],
                3600,  # 3600 seconds
                1      # cost
            )
            
            # If either limit is exceeded, return 429
            if not minute_check["allowed"] or not hour_check["allowed"]:
                return await self._create_rate_limit_response(minute_check, hour_check, limits)
            
            # Add rate limit headers to response
            response = await call_next(request)
            
            # Add rate limit info to response headers
            self._add_rate_limit_headers(response, minute_check, hour_check)
            
            return response
            
        except Exception as e:
            logger.error(f"Rate limiting error: {str(e)}")
            # On error, allow request to proceed (fail open)
            return await call_next(request)
    
    def _should_skip_rate_limiting(self, request: Request) -> bool:
        """Determine if rate limiting should be skipped for this request."""
        skip_paths = [
            "/health",
            "/docs",
            "/openapi.json",
            "/metrics",
            "/api/track/",  # Email tracking endpoints
        ]
        
        path = request.url.path
        return any(path.startswith(skip_path) for skip_path in skip_paths)
    
    async def _get_identifier_and_limits(self, request: Request) -> tuple[str, Dict[str, Any]]:
        """Get rate limit identifier and applicable limits for the request."""
        
        # Try to get user from token
        user = None
        try:
            auth_header = request.headers.get("authorization")
            if auth_header and auth_header.startswith("Bearer "):
                token = auth_header.split(" ")[1]
                user = await get_current_user_from_token(token)
        except:
            pass  # User not authenticated or invalid token
        
        # Get method and path for endpoint-specific limits
        method = request.method
        path = request.url.path
        endpoint_key = f"{method}:{path}"
        
        # Check for specific endpoint limits first
        if endpoint_key in self.rate_limits:
            if user:
                identifier = f"user:{user.id}:endpoint:{endpoint_key}"
            else:
                identifier = f"ip:{self._get_client_ip(request)}:endpoint:{endpoint_key}"
            return identifier, self.rate_limits[endpoint_key]
        
        # Use user-type specific limits if user is authenticated
        if user:
            user_plan = getattr(user, 'plan', 'free')
            user_type_key = f"user_type:{user_plan}"
            
            if user_type_key in self.rate_limits:
                identifier = f"user:{user.id}"
                return identifier, self.rate_limits[user_type_key]
            else:
                # Default authenticated user limits
                identifier = f"user:{user.id}"
                return identifier, {
                    "rpm": self.default_rpm,
                    "rph": self.default_rph,
                    "description": "Default authenticated user"
                }
        
        # Use IP-based limits for unauthenticated requests
        client_ip = self._get_client_ip(request)
        identifier = f"ip:{client_ip}"
        return identifier, self.rate_limits["ip_default"]
    
    def _get_client_ip(self, request: Request) -> str:
        """Get client IP address from request."""
        # Check for forwarded headers first (for reverse proxy setups)
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
    
    async def _create_rate_limit_response(
        self, 
        minute_check: Dict[str, Any], 
        hour_check: Dict[str, Any], 
        limits: Dict[str, Any]
    ) -> JSONResponse:
        """Create rate limit exceeded response."""
        
        # Determine which limit was exceeded
        if not minute_check["allowed"]:
            retry_after = 60  # Retry after 1 minute
            limit_type = "minute"
            current = minute_check["current_usage"]
            limit = minute_check["limit"]
        else:
            retry_after = 3600  # Retry after 1 hour
            limit_type = "hour"
            current = hour_check["current_usage"]
            limit = hour_check["limit"]
        
        response_data = {
            "error": "Rate limit exceeded",
            "message": f"Too many requests. {limits.get('description', 'Rate limit')} exceeded.",
            "limit_type": limit_type,
            "current_usage": current,
            "limit": limit,
            "retry_after": retry_after,
            "reset_time": minute_check["reset_time"] if not minute_check["allowed"] else hour_check["reset_time"]
        }
        
        headers = {
            "Retry-After": str(retry_after),
            "X-RateLimit-Limit-Minute": str(limits["rpm"]),
            "X-RateLimit-Limit-Hour": str(limits["rph"]),
            "X-RateLimit-Remaining-Minute": str(max(0, limits["rpm"] - minute_check["current_usage"])),
            "X-RateLimit-Remaining-Hour": str(max(0, limits["rph"] - hour_check["current_usage"])),
            "X-RateLimit-Reset-Minute": minute_check["reset_time"],
            "X-RateLimit-Reset-Hour": hour_check["reset_time"]
        }
        
        return JSONResponse(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            content=response_data,
            headers=headers
        )
    
    def _add_rate_limit_headers(
        self, 
        response: Response, 
        minute_check: Dict[str, Any], 
        hour_check: Dict[str, Any]
    ):
        """Add rate limit headers to successful response."""
        response.headers["X-RateLimit-Remaining-Minute"] = str(max(0, minute_check["limit"] - minute_check["current_usage"]))
        response.headers["X-RateLimit-Remaining-Hour"] = str(max(0, hour_check["limit"] - hour_check["current_usage"]))
        response.headers["X-RateLimit-Reset-Minute"] = minute_check["reset_time"]
        response.headers["X-RateLimit-Reset-Hour"] = hour_check["reset_time"]


class TokenBucketRateLimit:
    """
    Token bucket rate limiter for specific use cases requiring burst capacity.
    """
    
    def __init__(self, max_tokens: int, refill_rate: float, refill_period: int = 60):
        self.max_tokens = max_tokens
        self.refill_rate = refill_rate  # tokens per period
        self.refill_period = refill_period  # seconds
    
    async def consume_tokens(
        self, 
        identifier: str, 
        tokens_requested: int, 
        rate_cache
    ) -> Dict[str, Any]:
        """Consume tokens from bucket if available."""
        
        key = f"token_bucket:{identifier}"
        now = datetime.utcnow()
        
        # Get current bucket state
        bucket_data = await rate_cache.cache.get(key, {
            "tokens": self.max_tokens,
            "last_refill": now.isoformat()
        })
        
        # Calculate tokens to add based on time elapsed
        last_refill = datetime.fromisoformat(bucket_data["last_refill"])
        time_elapsed = (now - last_refill).total_seconds()
        periods_elapsed = time_elapsed / self.refill_period
        
        # Add tokens based on elapsed time
        tokens_to_add = int(periods_elapsed * self.refill_rate)
        current_tokens = min(
            self.max_tokens, 
            bucket_data["tokens"] + tokens_to_add
        )
        
        # Check if request can be satisfied
        if current_tokens >= tokens_requested:
            # Consume tokens
            remaining_tokens = current_tokens - tokens_requested
            
            # Update bucket state
            new_bucket_data = {
                "tokens": remaining_tokens,
                "last_refill": now.isoformat()
            }
            await rate_cache.cache.set(key, new_bucket_data, self.refill_period * 2)
            
            return {
                "allowed": True,
                "tokens_remaining": remaining_tokens,
                "tokens_consumed": tokens_requested,
                "refill_time": (now + timedelta(seconds=self.refill_period)).isoformat()
            }
        else:
            # Request denied
            return {
                "allowed": False,
                "tokens_remaining": current_tokens,
                "tokens_requested": tokens_requested,
                "refill_time": (now + timedelta(seconds=self.refill_period)).isoformat()
            }


# Specialized rate limiters for different use cases
class EmailSendingRateLimit:
    """Specialized rate limiter for email sending with daily limits."""
    
    def __init__(self):
        self.daily_limits = {
            "free": 100,
            "pro": 1000,
            "enterprise": 10000
        }
    
    async def check_daily_email_limit(
        self, 
        workspace_id: str, 
        user_plan: str, 
        emails_to_send: int,
        rate_cache
    ) -> Dict[str, Any]:
        """Check if user can send emails within daily limit."""
        
        # Get daily limit for user plan
        daily_limit = self.daily_limits.get(user_plan, self.daily_limits["free"])
        
        # Check current daily usage
        today = datetime.utcnow().strftime("%Y-%m-%d")
        key = f"daily_emails:{workspace_id}:{today}"
        
        current_usage = await rate_cache.cache.get(key, 0)
        
        if (current_usage + emails_to_send) <= daily_limit:
            # Update usage
            new_usage = current_usage + emails_to_send
            await rate_cache.cache.set(key, new_usage, 86400)  # 24 hours
            
            return {
                "allowed": True,
                "current_usage": new_usage,
                "daily_limit": daily_limit,
                "remaining": daily_limit - new_usage
            }
        else:
            return {
                "allowed": False,
                "current_usage": current_usage,
                "daily_limit": daily_limit,
                "remaining": daily_limit - current_usage,
                "emails_requested": emails_to_send
            }


class APIKeyRateLimit:
    """Rate limiter for API key based access."""
    
    async def check_api_key_limit(
        self, 
        api_key_id: str, 
        endpoint: str, 
        rate_cache,
        requests_per_hour: int = 1000
    ) -> Dict[str, Any]:
        """Check rate limit for API key."""
        
        identifier = f"api_key:{api_key_id}:{endpoint}"
        
        return await rate_cache.check_rate_limit(
            identifier,
            requests_per_hour,
            3600,  # 1 hour
            1      # cost
        )