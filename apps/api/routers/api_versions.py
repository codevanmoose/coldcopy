"""
API version management endpoints.
"""
import logging
from typing import Dict, Any, List
from datetime import datetime

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel

from core.versioning import version_registry, get_api_version_from_request
from core.security import require_permissions
from models.user import User

router = APIRouter()
logger = logging.getLogger(__name__)


class APIVersionResponse(BaseModel):
    """API version information response."""
    version: str
    release_date: str
    status: str
    deprecation_date: str = None
    sunset_date: str = None
    changelog: str = None
    breaking_changes: List[str] = None


class APIVersionsResponse(BaseModel):
    """Response containing all API versions."""
    current_version: str
    latest_version: str
    default_version: str
    versions: List[APIVersionResponse]


class APICapabilitiesResponse(BaseModel):
    """API capabilities for a specific version."""
    version: str
    endpoints: List[str]
    features: List[str]
    rate_limits: Dict[str, Any]
    authentication_methods: List[str]


@router.get("/", response_model=APIVersionsResponse)
async def get_api_versions(request: Request):
    """Get information about all API versions."""
    
    current_version = get_api_version_from_request(request)
    all_versions = version_registry.get_all_versions()
    
    version_responses = []
    for version_str, version_info in all_versions.items():
        version_response = APIVersionResponse(
            version=version_info.version,
            release_date=version_info.release_date.isoformat(),
            status=version_info.status,
            deprecation_date=version_info.deprecation_date.isoformat() if version_info.deprecation_date else None,
            sunset_date=version_info.sunset_date.isoformat() if version_info.sunset_date else None,
            changelog=version_info.changelog,
            breaking_changes=version_info.breaking_changes or []
        )
        version_responses.append(version_response)
    
    # Sort by version number
    version_responses.sort(key=lambda x: x.version)
    
    return APIVersionsResponse(
        current_version=current_version,
        latest_version=version_registry.latest_version,
        default_version=version_registry.default_version,
        versions=version_responses
    )


@router.get("/{version}", response_model=APIVersionResponse)
async def get_api_version_details(version: str):
    """Get detailed information about a specific API version."""
    
    version_info = version_registry.get_version(version)
    if not version_info:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"API version '{version}' not found"
        )
    
    return APIVersionResponse(
        version=version_info.version,
        release_date=version_info.release_date.isoformat(),
        status=version_info.status,
        deprecation_date=version_info.deprecation_date.isoformat() if version_info.deprecation_date else None,
        sunset_date=version_info.sunset_date.isoformat() if version_info.sunset_date else None,
        changelog=version_info.changelog,
        breaking_changes=version_info.breaking_changes or []
    )


@router.get("/{version}/capabilities", response_model=APICapabilitiesResponse)
async def get_api_version_capabilities(version: str):
    """Get capabilities and features available in a specific API version."""
    
    version_info = version_registry.get_version(version)
    if not version_info:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"API version '{version}' not found"
        )
    
    # Define capabilities per version
    capabilities = {
        "v1": {
            "endpoints": [
                "/api/auth/login",
                "/api/auth/refresh", 
                "/api/campaigns",
                "/api/campaigns/{id}",
                "/api/leads",
                "/api/leads/{id}",
                "/api/email/send",
                "/api/workspaces",
                "/api/gdpr/consent"
            ],
            "features": [
                "Basic authentication",
                "Campaign management",
                "Lead management",
                "Email sending",
                "Basic rate limiting",
                "GDPR compliance"
            ],
            "rate_limits": {
                "default_requests_per_minute": 60,
                "default_requests_per_hour": 1000,
                "email_sending_per_minute": 10
            },
            "authentication_methods": [
                "JWT Bearer tokens",
                "API keys"
            ]
        },
        "v2": {
            "endpoints": [
                "/api/auth/login",
                "/api/auth/refresh",
                "/api/auth/2fa",
                "/api/campaigns",
                "/api/campaigns/{id}",
                "/api/campaigns/{id}/analytics",
                "/api/leads",
                "/api/leads/{id}",
                "/api/leads/bulk",
                "/api/email/send",
                "/api/email/send-bulk",
                "/api/email/templates",
                "/api/workspaces",
                "/api/workspaces/{id}/settings",
                "/api/gdpr/consent",
                "/api/gdpr/requests",
                "/api/integrations/hubspot",
                "/api/integrations/pipedrive",
                "/api/webhooks",
                "/api/system/health",
                "/api/rate-limits"
            ],
            "features": [
                "Enhanced authentication with 2FA",
                "Advanced campaign management",
                "Bulk operations",
                "Email templates",
                "CRM integrations",
                "Webhook support",
                "Advanced rate limiting",
                "System monitoring",
                "GDPR compliance",
                "Real-time analytics"
            ],
            "rate_limits": {
                "default_requests_per_minute": 100,
                "default_requests_per_hour": 2000,
                "email_sending_per_minute": 50,
                "bulk_operations_per_hour": 10,
                "adaptive_rate_limiting": True
            },
            "authentication_methods": [
                "JWT Bearer tokens",
                "API keys",
                "OAuth2",
                "Two-factor authentication"
            ]
        }
    }
    
    version_capabilities = capabilities.get(version, capabilities["v1"])
    
    return APICapabilitiesResponse(
        version=version,
        endpoints=version_capabilities["endpoints"],
        features=version_capabilities["features"],
        rate_limits=version_capabilities["rate_limits"],
        authentication_methods=version_capabilities["authentication_methods"]
    )


@router.get("/{version}/changelog")
async def get_api_version_changelog(version: str):
    """Get detailed changelog for a specific API version."""
    
    version_info = version_registry.get_version(version)
    if not version_info:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"API version '{version}' not found"
        )
    
    # Extended changelog information
    detailed_changelogs = {
        "v1": {
            "summary": "Initial API release with core functionality",
            "new_features": [
                "JWT-based authentication",
                "Basic campaign management",
                "Lead management with CRUD operations",
                "Email sending capabilities",
                "Workspace management",
                "Basic GDPR compliance"
            ],
            "improvements": [],
            "bug_fixes": [],
            "breaking_changes": [],
            "deprecations": [],
            "migration_notes": []
        },
        "v2": {
            "summary": "Enhanced API with improved rate limiting and new endpoints",
            "new_features": [
                "Two-factor authentication",
                "Advanced campaign analytics",
                "Bulk operations for leads and campaigns",
                "Email template management",
                "CRM integrations (HubSpot, Pipedrive)",
                "Webhook support for real-time events",
                "System monitoring endpoints",
                "Advanced rate limiting with adaptive capabilities",
                "Enhanced GDPR compliance features"
            ],
            "improvements": [
                "Improved authentication flow with refresh tokens",
                "Enhanced error handling and validation",
                "Better rate limiting with user-based limits",
                "Optimized database queries",
                "Improved API response times"
            ],
            "bug_fixes": [
                "Fixed timezone handling in campaign scheduling",
                "Resolved memory leak in email processing",
                "Fixed race condition in lead deduplication",
                "Corrected pagination in large result sets"
            ],
            "breaking_changes": [
                "Changed response format for /api/campaigns endpoint",
                "Removed deprecated /api/legacy endpoints", 
                "Updated authentication token format",
                "Modified error response structure"
            ],
            "deprecations": [
                "Deprecated is_active field in campaigns (use status instead)",
                "Deprecated single email sending endpoint (use batch endpoint)"
            ],
            "migration_notes": [
                "Update campaign status checks from boolean to string",
                "Migrate to new authentication token format",
                "Update error handling to use new response structure",
                "Use new bulk endpoints for better performance"
            ]
        }
    }
    
    changelog = detailed_changelogs.get(version, detailed_changelogs["v1"])
    
    return {
        "version": version,
        "release_date": version_info.release_date.isoformat(),
        "changelog": changelog
    }


@router.get("/current/info")
async def get_current_api_version_info(request: Request):
    """Get information about the currently used API version."""
    
    current_version = get_api_version_from_request(request)
    version_info = version_registry.get_version(current_version)
    
    if not version_info:
        return {
            "version": current_version,
            "status": "unknown",
            "message": "Version information not available"
        }
    
    response_data = {
        "version": current_version,
        "status": version_info.status,
        "release_date": version_info.release_date.isoformat(),
        "is_latest": current_version == version_registry.latest_version,
        "is_supported": version_registry.is_version_supported(current_version)
    }
    
    # Add deprecation/sunset information if applicable
    if version_info.status == "deprecated":
        response_data["deprecation_date"] = version_info.deprecation_date.isoformat()
        response_data["sunset_date"] = version_info.sunset_date.isoformat()
        response_data["migration_required"] = True
        response_data["recommended_version"] = version_registry.latest_version
    
    # Add upgrade recommendations
    if current_version != version_registry.latest_version:
        response_data["upgrade_available"] = True
        response_data["latest_version"] = version_registry.latest_version
        response_data["upgrade_benefits"] = [
            "Access to latest features",
            "Improved performance",
            "Enhanced security",
            "Better rate limits",
            "New integrations"
        ]
    
    return response_data


@router.post("/{version}/deprecate")
async def deprecate_api_version(
    version: str,
    deprecation_date: datetime,
    sunset_date: datetime,
    current_user: User = Depends(require_permissions({"admin:write"}))
):
    """Deprecate an API version (admin only)."""
    
    version_info = version_registry.get_version(version)
    if not version_info:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"API version '{version}' not found"
        )
    
    if version_info.status == "sunset":
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot deprecate version '{version}' - already sunset"
        )
    
    # Deprecate the version
    version_registry.deprecate_version(version, deprecation_date, sunset_date)
    
    logger.warning(
        f"API version {version} deprecated by admin {current_user.id}. "
        f"Sunset date: {sunset_date}"
    )
    
    return {
        "message": f"API version {version} has been deprecated",
        "version": version,
        "deprecation_date": deprecation_date.isoformat(),
        "sunset_date": sunset_date.isoformat(),
        "migration_deadline": sunset_date.isoformat()
    }


@router.post("/{version}/sunset")
async def sunset_api_version(
    version: str,
    current_user: User = Depends(require_permissions({"admin:write"}))
):
    """Sunset an API version (admin only)."""
    
    version_info = version_registry.get_version(version)
    if not version_info:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"API version '{version}' not found"
        )
    
    if version == version_registry.latest_version:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot sunset the latest API version"
        )
    
    # Sunset the version
    version_registry.sunset_version(version)
    
    logger.critical(
        f"API version {version} sunset by admin {current_user.id}"
    )
    
    return {
        "message": f"API version {version} has been sunset and is no longer available",
        "version": version,
        "sunset_date": datetime.utcnow().isoformat(),
        "active_versions": version_registry.get_supported_versions()
    }


@router.get("/migration/guide")
async def get_migration_guide(
    from_version: str,
    to_version: str = None
):
    """Get migration guide between API versions."""
    
    if not to_version:
        to_version = version_registry.latest_version
    
    # Check if versions exist
    from_info = version_registry.get_version(from_version)
    to_info = version_registry.get_version(to_version)
    
    if not from_info or not to_info:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="One or both API versions not found"
        )
    
    # Migration guides
    migration_guides = {
        ("v1", "v2"): {
            "overview": "Migration from v1 to v2 introduces breaking changes and new features",
            "breaking_changes": [
                {
                    "change": "Campaign response format updated",
                    "description": "The campaigns endpoint now returns additional metadata and changed field names",
                    "action_required": "Update client code to handle new response structure",
                    "code_example": {
                        "before": "campaign.is_active",
                        "after": "campaign.status === 'active'"
                    }
                },
                {
                    "change": "Authentication token format changed",
                    "description": "JWT tokens now include additional claims and have longer expiry",
                    "action_required": "Re-authenticate to get new token format",
                    "code_example": {
                        "before": "Authorization: Bearer <old-token>",
                        "after": "Authorization: Bearer <new-token>"
                    }
                }
            ],
            "new_features": [
                "Two-factor authentication support",
                "Bulk operations for improved performance",
                "CRM integrations",
                "Advanced rate limiting",
                "Real-time webhooks"
            ],
            "migration_steps": [
                "1. Review breaking changes and update client code",
                "2. Test authentication flow with new token format",
                "3. Update campaign status handling from boolean to string",
                "4. Migrate to bulk endpoints where applicable",
                "5. Update error handling for new response format",
                "6. Test all functionality thoroughly",
                "7. Update API version header to v2"
            ],
            "compatibility": {
                "backward_compatible": False,
                "data_migration_required": True,
                "estimated_effort": "4-8 hours for typical integration"
            }
        }
    }
    
    guide_key = (from_version, to_version)
    guide = migration_guides.get(guide_key)
    
    if not guide:
        # Generate basic migration guide
        guide = {
            "overview": f"Migration guide from {from_version} to {to_version}",
            "breaking_changes": to_info.breaking_changes or [],
            "new_features": [],
            "migration_steps": [
                "1. Review API documentation for target version",
                "2. Test endpoints in development environment",
                "3. Update client code as needed",
                "4. Deploy and monitor"
            ],
            "compatibility": {
                "backward_compatible": len(to_info.breaking_changes or []) == 0,
                "data_migration_required": False,
                "estimated_effort": "2-4 hours"
            }
        }
    
    return {
        "from_version": from_version,
        "to_version": to_version,
        "migration_guide": guide,
        "support_resources": {
            "documentation": f"/docs/api/{to_version}",
            "examples": f"/examples/{to_version}",
            "support_email": "api-support@coldcopy.cc"
        }
    }