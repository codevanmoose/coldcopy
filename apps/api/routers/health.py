"""
Health check endpoints.
"""
import asyncio
from datetime import datetime
from typing import Dict, Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.config import get_settings

router = APIRouter()


@router.get("/")
async def health_check() -> Dict[str, Any]:
    """Basic health check endpoint."""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "service": "coldcopy-api",
        "version": "1.0.0"
    }


@router.get("/detailed")
async def detailed_health_check(
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Detailed health check with database connectivity."""
    settings = get_settings()
    health_data = {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "service": "coldcopy-api",
        "version": "1.0.0",
        "environment": settings.ENVIRONMENT,
        "checks": {}
    }
    
    # Database connectivity check
    try:
        result = await db.execute(text("SELECT 1"))
        await result.fetchone()
        health_data["checks"]["database"] = {
            "status": "healthy",
            "response_time_ms": 0  # Could measure actual response time
        }
    except Exception as e:
        health_data["status"] = "unhealthy"
        health_data["checks"]["database"] = {
            "status": "unhealthy",
            "error": str(e)
        }
    
    # Redis connectivity check (if needed)
    # TODO: Add Redis health check when implemented
    
    if health_data["status"] == "unhealthy":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=health_data
        )
    
    return health_data


@router.get("/readiness")
async def readiness_check(
    db: AsyncSession = Depends(get_db)
) -> Dict[str, str]:
    """Kubernetes readiness probe endpoint."""
    try:
        # Check if database is ready
        result = await db.execute(text("SELECT 1"))
        await result.fetchone()
        return {"status": "ready"}
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"status": "not ready"}
        )


@router.get("/liveness")
async def liveness_check() -> Dict[str, str]:
    """Kubernetes liveness probe endpoint."""
    return {"status": "alive"}