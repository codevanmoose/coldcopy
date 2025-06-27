"""
ColdCopy FastAPI Application Entry Point
"""
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse

from core.config import get_settings
from core.database import create_db_and_tables, close_db_connection
from utils.redis_manager import initialize_redis, shutdown_redis
from services.cache_warming_service import start_cache_warming, stop_cache_warming
from middleware.rate_limiting import RateLimitMiddleware
from middleware.cache_middleware import CacheMiddleware
from core.versioning import VersionMiddleware, version_registry, version_extractor
from routers import health, auth, campaigns, leads, workspaces, gdpr, email, system, webhooks, rate_limits, api_versions, ses_email, cache_management, email_templates, warmup, calendar
from integrations.pipedrive.routers import router as pipedrive_router


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan events."""
    # Startup
    await create_db_and_tables()
    await initialize_redis()
    await start_cache_warming()  # Start cache warming service
    yield
    # Shutdown
    await stop_cache_warming()  # Stop cache warming service
    await close_db_connection()
    await shutdown_redis()


def create_app() -> FastAPI:
    """Create and configure FastAPI application."""
    settings = get_settings()
    
    app = FastAPI(
        title="ColdCopy API",
        description="AI-powered cold outreach automation platform",
        version="1.0.0",
        docs_url="/docs" if settings.ENVIRONMENT != "production" else None,
        redoc_url="/redoc" if settings.ENVIRONMENT != "production" else None,
        lifespan=lifespan,
    )

    # Security middleware
    if settings.ALLOWED_HOSTS:
        app.add_middleware(
            TrustedHostMiddleware,
            allowed_hosts=settings.ALLOWED_HOSTS.split(",")
        )

    # CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ALLOWED_ORIGINS.split(","),
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
        allow_headers=["*"],
    )
    
    # API versioning middleware
    app.add_middleware(
        VersionMiddleware,
        registry=version_registry,
        extractor=version_extractor,
        strict_mode=settings.ENVIRONMENT == "production"
    )
    
    # Rate limiting middleware
    app.add_middleware(
        RateLimitMiddleware,
        default_requests_per_minute=60,
        default_requests_per_hour=1000,
        burst_requests_per_minute=100
    )
    
    # Cache middleware
    app.add_middleware(
        CacheMiddleware,
        default_ttl=300,  # 5 minutes default
        cacheable_paths=[
            "/api/campaigns",
            "/api/leads",
            "/api/analytics",
            "/api/workspaces/settings",
            "/api/system/stats"
        ],
        excluded_paths=[
            "/api/auth",
            "/api/webhooks",
            "/api/gdpr",
            "/health"
        ]
    )

    # Include routers
    app.include_router(health.router, prefix="/health", tags=["health"])
    app.include_router(auth.router, prefix="/api/auth", tags=["authentication"])
    app.include_router(workspaces.router, prefix="/api/workspaces", tags=["workspaces"])
    app.include_router(campaigns.router, prefix="/api/campaigns", tags=["campaigns"])
    app.include_router(leads.router, prefix="/api/leads", tags=["leads"])
    app.include_router(email.router, prefix="/api/email", tags=["email"])
    app.include_router(ses_email.router, prefix="/api/ses", tags=["ses-email"])
    app.include_router(gdpr.router, prefix="/api/gdpr", tags=["gdpr"])
    app.include_router(system.router, prefix="/api/system", tags=["system"])
    app.include_router(webhooks.router, prefix="/api/webhooks", tags=["webhooks"])
    app.include_router(rate_limits.router, prefix="/api/rate-limits", tags=["rate-limits"])
    app.include_router(api_versions.router, prefix="/api/versions", tags=["api-versions"])
    app.include_router(cache_management.router, tags=["cache"])
    app.include_router(pipedrive_router, tags=["integrations"])
    app.include_router(email_templates.router, tags=["templates"])
    app.include_router(warmup.router, tags=["warmup"])
    app.include_router(calendar.router, tags=["calendar"])

    @app.exception_handler(404)
    async def not_found_handler(request, exc):
        return JSONResponse(
            status_code=404,
            content={"detail": "Endpoint not found"}
        )

    @app.exception_handler(500)
    async def internal_error_handler(request, exc):
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error"}
        )

    return app


app = create_app()

if __name__ == "__main__":
    import uvicorn
    
    settings = get_settings()
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.ENVIRONMENT == "development",
        log_level="info",
    )