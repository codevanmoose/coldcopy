"""
Unit tests for health check endpoints.
"""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_basic_health_check(client: AsyncClient):
    """Test basic health check endpoint."""
    response = await client.get("/health/")
    
    assert response.status_code == 200
    data = response.json()
    
    assert data["status"] == "healthy"
    assert "timestamp" in data
    assert data["service"] == "coldcopy-api"
    assert data["version"] == "1.0.0"


@pytest.mark.asyncio
async def test_detailed_health_check(client: AsyncClient):
    """Test detailed health check endpoint."""
    response = await client.get("/health/detailed")
    
    assert response.status_code == 200
    data = response.json()
    
    assert data["status"] == "healthy"
    assert "timestamp" in data
    assert data["service"] == "coldcopy-api"
    assert "environment" in data
    assert "checks" in data
    assert "database" in data["checks"]


@pytest.mark.asyncio
async def test_readiness_check(client: AsyncClient):
    """Test readiness probe endpoint."""
    response = await client.get("/health/readiness")
    
    assert response.status_code == 200
    data = response.json()
    
    assert data["status"] == "ready"


@pytest.mark.asyncio
async def test_liveness_check(client: AsyncClient):
    """Test liveness probe endpoint."""
    response = await client.get("/health/liveness")
    
    assert response.status_code == 200
    data = response.json()
    
    assert data["status"] == "alive"