"""
Cache middleware for FastAPI to automatically cache API responses.
"""
import hashlib
import json
from typing import Optional, Callable, List
from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.datastructures import Headers

from utils.cache_manager import CacheManager, CacheNamespace, get_cache
import logging

logger = logging.getLogger(__name__)


class CacheMiddleware(BaseHTTPMiddleware):
    """
    Middleware to automatically cache GET API responses.
    
    Features:
    - Automatic caching of successful GET responses
    - Cache key generation from URL and query params
    - Workspace-aware caching
    - Cache control headers support
    - Conditional caching based on paths
    """
    
    def __init__(
        self,
        app,
        cache_manager: Optional[CacheManager] = None,
        default_ttl: int = 300,
        cacheable_paths: Optional[List[str]] = None,
        excluded_paths: Optional[List[str]] = None
    ):
        super().__init__(app)
        self.cache_manager = cache_manager
        self.default_ttl = default_ttl
        self.cacheable_paths = cacheable_paths or [
            "/api/campaigns",
            "/api/leads",
            "/api/analytics",
            "/api/templates",
            "/api/workspace/settings"
        ]
        self.excluded_paths = excluded_paths or [
            "/api/auth",
            "/api/webhooks",
            "/api/system"
        ]
    
    async def dispatch(self, request: Request, call_next):
        # Only cache GET requests
        if request.method != "GET":
            return await call_next(request)
        
        # Check if path should be cached
        path = request.url.path
        if not self._should_cache_path(path):
            return await call_next(request)
        
        # Initialize cache if needed
        if not self.cache_manager:
            try:
                self.cache_manager = await get_cache()
            except Exception as e:
                logger.error(f"Failed to initialize cache: {e}")
                return await call_next(request)
        
        # Generate cache key
        cache_key = await self._generate_cache_key(request)
        
        # Check cache
        cached_response = await self.cache_manager.get(
            cache_key,
            namespace=CacheNamespace.API_RESPONSES
        )
        
        if cached_response:
            # Return cached response
            return JSONResponse(
                content=cached_response["content"],
                status_code=cached_response["status_code"],
                headers={
                    **cached_response.get("headers", {}),
                    "X-Cache": "HIT",
                    "X-Cache-Key": cache_key
                }
            )
        
        # Call the actual endpoint
        response = await call_next(request)
        
        # Cache successful responses
        if response.status_code == 200:
            await self._cache_response(cache_key, response, request)
        
        # Add cache headers
        response.headers["X-Cache"] = "MISS"
        response.headers["X-Cache-Key"] = cache_key
        
        return response
    
    def _should_cache_path(self, path: str) -> bool:
        """Check if path should be cached."""
        # Check excluded paths
        for excluded in self.excluded_paths:
            if path.startswith(excluded):
                return False
        
        # Check cacheable paths
        for cacheable in self.cacheable_paths:
            if path.startswith(cacheable):
                return True
        
        return False
    
    async def _generate_cache_key(self, request: Request) -> str:
        """Generate cache key from request."""
        # Get workspace ID from request state or headers
        workspace_id = getattr(request.state, "workspace_id", None)
        if not workspace_id:
            # Try to get from auth token
            user = getattr(request.state, "user", None)
            if user:
                workspace_id = getattr(user, "workspace_id", "unknown")
            else:
                workspace_id = "unknown"
        
        # Build key components
        components = [
            str(workspace_id),
            request.url.path,
            str(sorted(request.query_params.items()))
        ]
        
        # Add relevant headers
        accept = request.headers.get("accept", "application/json")
        components.append(f"accept:{accept}")
        
        # Generate hash
        key_string = ":".join(components)
        return hashlib.md5(key_string.encode()).hexdigest()
    
    async def _cache_response(
        self,
        cache_key: str,
        response: Response,
        request: Request
    ):
        """Cache the response."""
        try:
            # Read response body
            body = b""
            async for chunk in response.body_iterator:
                body += chunk
            
            # Parse response
            try:
                content = json.loads(body.decode())
            except:
                # Don't cache non-JSON responses
                return
            
            # Determine TTL from cache-control header or use default
            ttl = self._get_ttl_from_headers(response.headers) or self.default_ttl
            
            # Prepare cache data
            cache_data = {
                "content": content,
                "status_code": response.status_code,
                "headers": dict(response.headers),
                "cached_at": datetime.utcnow().isoformat()
            }
            
            # Cache it
            await self.cache_manager.set(
                cache_key,
                cache_data,
                ttl=ttl,
                namespace=CacheNamespace.API_RESPONSES,
                compress=len(body) > 1024  # Compress if > 1KB
            )
            
            # Reset response body
            response = Response(
                content=body,
                status_code=response.status_code,
                headers=dict(response.headers),
                media_type=response.media_type
            )
            
        except Exception as e:
            logger.error(f"Failed to cache response: {e}")
    
    def _get_ttl_from_headers(self, headers: Headers) -> Optional[int]:
        """Extract TTL from cache-control headers."""
        cache_control = headers.get("cache-control", "")
        
        if "no-cache" in cache_control or "no-store" in cache_control:
            return 0
        
        # Look for max-age
        for directive in cache_control.split(","):
            directive = directive.strip()
            if directive.startswith("max-age="):
                try:
                    return int(directive.split("=")[1])
                except:
                    pass
        
        return None


def cache_endpoint(
    ttl: int = 300,
    namespace: CacheNamespace = CacheNamespace.API_RESPONSES,
    key_func: Optional[Callable] = None,
    condition: Optional[Callable] = None
):
    """
    Decorator to cache specific endpoint responses.
    
    Args:
        ttl: Time to live in seconds
        namespace: Cache namespace
        key_func: Custom key generation function
        condition: Function to determine if response should be cached
    
    Example:
        @app.get("/api/data")
        @cache_endpoint(ttl=600)
        async def get_data():
            return {"data": "value"}
    """
    def decorator(func: Callable) -> Callable:
        async def wrapper(*args, **kwargs):
            # Get request from kwargs or args
            request = None
            for arg in args:
                if isinstance(arg, Request):
                    request = arg
                    break
            if not request:
                request = kwargs.get("request")
            
            if not request:
                # No request object, just call the function
                return await func(*args, **kwargs)
            
            # Check condition
            if condition and not condition(request):
                return await func(*args, **kwargs)
            
            # Generate cache key
            if key_func:
                cache_key = key_func(request, *args, **kwargs)
            else:
                # Default key generation
                workspace_id = getattr(request.state, "workspace_id", "unknown")
                path = request.url.path
                params = str(sorted(request.query_params.items()))
                cache_key = f"{workspace_id}:{path}:{params}"
            
            # Get cache manager
            try:
                cache = await get_cache()
            except:
                # Cache not available, proceed without caching
                return await func(*args, **kwargs)
            
            # Try to get from cache
            cached = await cache.get(cache_key, namespace=namespace)
            if cached is not None:
                # Add cache headers if response object
                if hasattr(cached, "headers"):
                    cached.headers["X-Cache"] = "HIT"
                return cached
            
            # Call the function
            result = await func(*args, **kwargs)
            
            # Cache the result
            await cache.set(
                cache_key,
                result,
                ttl=ttl,
                namespace=namespace
            )
            
            # Add cache headers if response object
            if hasattr(result, "headers"):
                result.headers["X-Cache"] = "MISS"
            
            return result
        
        return wrapper
    return decorator


def invalidate_cache(
    pattern: str = "*",
    namespace: CacheNamespace = CacheNamespace.API_RESPONSES
):
    """
    Decorator to invalidate cache after endpoint execution.
    
    Example:
        @app.post("/api/campaigns")
        @invalidate_cache(pattern="campaigns:*")
        async def create_campaign():
            # This will invalidate all campaign caches after execution
            return {"id": "123"}
    """
    def decorator(func: Callable) -> Callable:
        async def wrapper(*args, **kwargs):
            # Execute the function first
            result = await func(*args, **kwargs)
            
            # Then invalidate cache
            try:
                cache = await get_cache()
                
                # Get workspace_id if available
                workspace_id = None
                for arg in args:
                    if isinstance(arg, Request):
                        workspace_id = getattr(arg.state, "workspace_id", None)
                        break
                
                # Build pattern with workspace
                if workspace_id and "{workspace_id}" in pattern:
                    final_pattern = pattern.format(workspace_id=workspace_id)
                else:
                    final_pattern = pattern
                
                deleted = await cache.delete_pattern(final_pattern, namespace)
                logger.info(f"Invalidated {deleted} cache entries matching {final_pattern}")
                
            except Exception as e:
                logger.error(f"Failed to invalidate cache: {e}")
            
            return result
        
        return wrapper
    return decorator


# Import datetime at the top
from datetime import datetime