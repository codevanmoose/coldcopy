"""
API versioning strategy for ColdCopy.
"""
import logging
import functools
from typing import Optional, Dict, Any, Callable
from datetime import datetime, timedelta
from enum import Enum

from fastapi import Request, HTTPException, status
from fastapi.routing import APIRoute
from pydantic import BaseModel

logger = logging.getLogger(__name__)


class VersioningStrategy(Enum):
    """Supported versioning strategies."""
    HEADER = "header"
    URL_PATH = "url_path"
    QUERY_PARAM = "query_param"
    ACCEPT_HEADER = "accept_header"


class APIVersion(BaseModel):
    """API version model."""
    version: str
    release_date: datetime
    deprecation_date: Optional[datetime] = None
    sunset_date: Optional[datetime] = None
    status: str = "active"  # active, deprecated, sunset
    changelog: Optional[str] = None
    breaking_changes: Optional[list[str]] = None


class VersionRegistry:
    """Registry for API versions and their configurations."""
    
    def __init__(self):
        self.versions: Dict[str, APIVersion] = {}
        self.default_version = "v1"
        self.latest_version = "v1"
        
        # Initialize default versions
        self._initialize_default_versions()
    
    def _initialize_default_versions(self):
        """Initialize default API versions."""
        self.register_version(APIVersion(
            version="v1",
            release_date=datetime(2024, 1, 1),
            status="active",
            changelog="Initial API release with core functionality"
        ))
        
        self.register_version(APIVersion(
            version="v2",
            release_date=datetime(2024, 6, 1),
            status="active", 
            changelog="Enhanced API with improved rate limiting and new endpoints",
            breaking_changes=[
                "Changed response format for /api/campaigns endpoint",
                "Removed deprecated /api/legacy endpoints",
                "Updated authentication token format"
            ]
        ))
        
        self.latest_version = "v2"
    
    def register_version(self, version: APIVersion):
        """Register a new API version."""
        self.versions[version.version] = version
        logger.info(f"Registered API version {version.version}")
    
    def get_version(self, version: str) -> Optional[APIVersion]:
        """Get version information."""
        return self.versions.get(version)
    
    def get_all_versions(self) -> Dict[str, APIVersion]:
        """Get all registered versions."""
        return self.versions.copy()
    
    def get_supported_versions(self) -> list[str]:
        """Get list of currently supported versions."""
        return [
            version for version, info in self.versions.items()
            if info.status in ["active", "deprecated"]
        ]
    
    def is_version_supported(self, version: str) -> bool:
        """Check if a version is supported."""
        version_info = self.get_version(version)
        return version_info is not None and version_info.status in ["active", "deprecated"]
    
    def deprecate_version(self, version: str, deprecation_date: datetime, sunset_date: datetime):
        """Mark a version as deprecated."""
        if version in self.versions:
            self.versions[version].status = "deprecated"
            self.versions[version].deprecation_date = deprecation_date
            self.versions[version].sunset_date = sunset_date
            logger.warning(f"API version {version} marked as deprecated")
    
    def sunset_version(self, version: str):
        """Mark a version as sunset (no longer supported)."""
        if version in self.versions:
            self.versions[version].status = "sunset"
            logger.warning(f"API version {version} marked as sunset")
    
    def get_version_headers(self, version: str) -> Dict[str, str]:
        """Get version-specific headers for responses."""
        version_info = self.get_version(version)
        if not version_info:
            return {}
        
        headers = {
            "API-Version": version,
            "API-Version-Latest": self.latest_version,
            "API-Supported-Versions": ",".join(self.get_supported_versions())
        }
        
        if version_info.status == "deprecated" and version_info.sunset_date:
            headers["API-Deprecation-Date"] = version_info.deprecation_date.isoformat()
            headers["API-Sunset-Date"] = version_info.sunset_date.isoformat()
            headers["Warning"] = f'299 - "API version {version} is deprecated and will be sunset on {version_info.sunset_date.date()}"'
        
        return headers


class VersionExtractor:
    """Extract version information from requests."""
    
    def __init__(self, strategy: VersioningStrategy = VersioningStrategy.HEADER):
        self.strategy = strategy
        self.default_version = "v1"
    
    def extract_version(self, request: Request) -> str:
        """Extract version from request based on strategy."""
        if self.strategy == VersioningStrategy.HEADER:
            return self._extract_from_header(request)
        elif self.strategy == VersioningStrategy.URL_PATH:
            return self._extract_from_url_path(request)
        elif self.strategy == VersioningStrategy.QUERY_PARAM:
            return self._extract_from_query_param(request)
        elif self.strategy == VersioningStrategy.ACCEPT_HEADER:
            return self._extract_from_accept_header(request)
        else:
            return self.default_version
    
    def _extract_from_header(self, request: Request) -> str:
        """Extract version from API-Version header."""
        return request.headers.get("API-Version", self.default_version)
    
    def _extract_from_url_path(self, request: Request) -> str:
        """Extract version from URL path (e.g., /api/v2/campaigns)."""
        path = request.url.path
        parts = path.split("/")
        
        for part in parts:
            if part.startswith("v") and part[1:].isdigit():
                return part
        
        return self.default_version
    
    def _extract_from_query_param(self, request: Request) -> str:
        """Extract version from query parameter."""
        return request.query_params.get("version", self.default_version)
    
    def _extract_from_accept_header(self, request: Request) -> str:
        """Extract version from Accept header (e.g., application/vnd.coldcopy.v2+json)."""
        accept_header = request.headers.get("Accept", "")
        
        # Parse Accept header for version information
        if "vnd.coldcopy" in accept_header:
            parts = accept_header.split(".")
            for part in parts:
                if part.startswith("v") and part[1:].isdigit():
                    return part.split("+")[0]  # Remove media type suffix
        
        return self.default_version


class VersionMiddleware:
    """Middleware to handle API versioning."""
    
    def __init__(
        self,
        registry: VersionRegistry,
        extractor: VersionExtractor,
        strict_mode: bool = False
    ):
        self.registry = registry
        self.extractor = extractor
        self.strict_mode = strict_mode
    
    async def __call__(self, request: Request, call_next: Callable):
        """Process request with version handling."""
        # Extract version from request
        requested_version = self.extractor.extract_version(request)
        
        # Validate version
        if not self.registry.is_version_supported(requested_version):
            if self.strict_mode:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={
                        "error": "Unsupported API version",
                        "requested_version": requested_version,
                        "supported_versions": self.registry.get_supported_versions(),
                        "latest_version": self.registry.latest_version
                    }
                )
            else:
                # Fallback to default version
                requested_version = self.registry.default_version
        
        # Add version to request state
        request.state.api_version = requested_version
        
        # Check for sunset versions
        version_info = self.registry.get_version(requested_version)
        if version_info and version_info.status == "sunset":
            raise HTTPException(
                status_code=status.HTTP_410_GONE,
                detail={
                    "error": "API version no longer supported",
                    "sunset_version": requested_version,
                    "supported_versions": self.registry.get_supported_versions(),
                    "migration_guide": f"Please upgrade to version {self.registry.latest_version}"
                }
            )
        
        # Process request
        response = await call_next(request)
        
        # Add version headers to response
        version_headers = self.registry.get_version_headers(requested_version)
        for header, value in version_headers.items():
            response.headers[header] = value
        
        return response


class VersionedRoute(APIRoute):
    """Custom route class that supports versioning."""
    
    def __init__(self, *args, **kwargs):
        self.version_handlers: Dict[str, Callable] = {}
        self.default_handler: Optional[Callable] = None
        super().__init__(*args, **kwargs)
    
    def add_version_handler(self, version: str, handler: Callable):
        """Add a version-specific handler."""
        self.version_handlers[version] = handler
    
    def set_default_handler(self, handler: Callable):
        """Set the default handler for unsupported versions."""
        self.default_handler = handler
    
    async def __call__(self, request: Request):
        """Route request to appropriate version handler."""
        # Get version from request state (set by middleware)
        api_version = getattr(request.state, "api_version", "v1")
        
        # Find appropriate handler
        if api_version in self.version_handlers:
            handler = self.version_handlers[api_version]
        elif self.default_handler:
            handler = self.default_handler
        else:
            # Use the original endpoint
            return await super().__call__(request)
        
        # Execute version-specific handler
        return await handler(request)


def version(version_str: str):
    """Decorator to mark endpoints for specific API versions."""
    def decorator(func: Callable):
        func._api_version = version_str
        return func
    return decorator


def deprecated(sunset_date: str, migration_guide: str = ""):
    """Decorator to mark endpoints as deprecated."""
    def decorator(func: Callable):
        func._deprecated = True
        func._sunset_date = sunset_date
        func._migration_guide = migration_guide
        return func
    return decorator


class VersionCompatibility:
    """Handle backward compatibility between API versions."""
    
    def __init__(self):
        self.transformers: Dict[str, Dict[str, Callable]] = {}
    
    def register_transformer(
        self,
        from_version: str,
        to_version: str,
        transformer: Callable
    ):
        """Register a data transformer between versions."""
        if from_version not in self.transformers:
            self.transformers[from_version] = {}
        
        self.transformers[from_version][to_version] = transformer
        logger.info(f"Registered transformer from {from_version} to {to_version}")
    
    def transform_request(
        self,
        data: Dict[str, Any],
        from_version: str,
        to_version: str
    ) -> Dict[str, Any]:
        """Transform request data between versions."""
        if from_version == to_version:
            return data
        
        transformer = self.transformers.get(from_version, {}).get(to_version)
        if transformer:
            return transformer(data, direction="request")
        
        return data
    
    def transform_response(
        self,
        data: Dict[str, Any],
        from_version: str,
        to_version: str
    ) -> Dict[str, Any]:
        """Transform response data between versions."""
        if from_version == to_version:
            return data
        
        transformer = self.transformers.get(from_version, {}).get(to_version)
        if transformer:
            return transformer(data, direction="response")
        
        return data


# Example transformers for version compatibility
def transform_v1_to_v2_campaigns(data: Dict[str, Any], direction: str) -> Dict[str, Any]:
    """Transform campaign data between v1 and v2."""
    if direction == "response":
        # v2 adds metadata field and changes status format
        if "campaigns" in data:
            for campaign in data["campaigns"]:
                # Add metadata if not present
                if "metadata" not in campaign:
                    campaign["metadata"] = {}
                
                # Transform status from boolean to string
                if "is_active" in campaign:
                    campaign["status"] = "active" if campaign["is_active"] else "inactive"
                    del campaign["is_active"]
    
    elif direction == "request":
        # Transform v1 request format to v2
        if "is_active" in data:
            data["status"] = "active" if data["is_active"] else "inactive"
            del data["is_active"]
    
    return data


def transform_v1_to_v2_leads(data: Dict[str, Any], direction: str) -> Dict[str, Any]:
    """Transform lead data between v1 and v2."""
    if direction == "response":
        # v2 adds enrichment_data field and changes field names
        if "leads" in data:
            for lead in data["leads"]:
                # Rename fields
                if "first_name" in lead and "last_name" in lead:
                    lead["full_name"] = f"{lead['first_name']} {lead['last_name']}"
                
                # Add enrichment_data if not present
                if "enrichment_data" not in lead:
                    lead["enrichment_data"] = {}
    
    return data


# Global instances
version_registry = VersionRegistry()
version_extractor = VersionExtractor(VersioningStrategy.HEADER)
version_compatibility = VersionCompatibility()

# Register compatibility transformers
version_compatibility.register_transformer("v1", "v2", transform_v1_to_v2_campaigns)
version_compatibility.register_transformer("v1", "v2", transform_v1_to_v2_leads)


def get_api_version_from_request(request: Request) -> str:
    """Get API version from request state."""
    return getattr(request.state, "api_version", "v1")


def require_version(min_version: str):
    """Decorator to require minimum API version."""
    def decorator(func: Callable):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            # Find request in arguments
            request = None
            for arg in args:
                if isinstance(arg, Request):
                    request = arg
                    break
            
            if request:
                current_version = get_api_version_from_request(request)
                
                # Simple version comparison (assumes semantic versioning)
                if not _is_version_compatible(current_version, min_version):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail={
                            "error": "API version not supported for this endpoint",
                            "current_version": current_version,
                            "minimum_required": min_version,
                            "upgrade_message": f"Please upgrade to API version {min_version} or higher"
                        }
                    )
            
            return await func(*args, **kwargs)
        return wrapper
    return decorator


def _is_version_compatible(current: str, minimum: str) -> bool:
    """Check if current version meets minimum requirement."""
    try:
        # Extract version numbers (assumes format like "v1", "v2", etc.)
        current_num = int(current.replace("v", ""))
        minimum_num = int(minimum.replace("v", ""))
        return current_num >= minimum_num
    except ValueError:
        return False