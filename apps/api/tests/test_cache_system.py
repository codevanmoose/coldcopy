"""
Comprehensive tests for the Redis caching system.
"""
import pytest
import asyncio
import json
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, patch, MagicMock
import redis.asyncio as redis

from utils.cache_manager import (
    CacheManager,
    CacheNamespace,
    CacheConfig,
    CacheStats,
    LeadEnrichmentCache,
    AIResponseCache,
    AnalyticsCache,
    get_cache,
    close_cache
)
from middleware.cache_middleware import CacheMiddleware, cache_endpoint, invalidate_cache
from services.cached_ai_service import CachedAIService, AIModel, AIResponse
from services.cached_enrichment_service import CachedEnrichmentService, EnrichmentSource, EnrichmentResult


class TestCacheManager:
    """Test the core cache manager functionality."""
    
    @pytest.fixture
    async def cache_manager(self):
        """Create a cache manager for testing."""
        # Use a test Redis instance or mock
        cache = CacheManager(
            redis_url="redis://localhost:6379/15",  # Use test database
            prefix="test",
            default_ttl=60
        )
        await cache.initialize()
        yield cache
        # Cleanup
        await cache.clear_namespace(CacheNamespace.API_RESPONSES)
        await cache.close()
    
    @pytest.fixture
    async def mock_redis(self):
        """Mock Redis client."""
        mock = AsyncMock()
        mock.ping = AsyncMock(return_value=True)
        mock.pipeline = MagicMock(return_value=AsyncMock())
        return mock
    
    async def test_basic_get_set(self, cache_manager):
        """Test basic cache get/set operations."""
        # Set a value
        success = await cache_manager.set(
            "test_key",
            {"data": "test_value"},
            ttl=60
        )
        assert success is True
        
        # Get the value
        value = await cache_manager.get("test_key")
        assert value is not None
        assert value["data"] == "test_value"
        
        # Delete the value
        deleted = await cache_manager.delete("test_key")
        assert deleted is True
        
        # Verify it's gone
        value = await cache_manager.get("test_key")
        assert value is None
    
    async def test_compression(self, cache_manager):
        """Test value compression."""
        # Create large data
        large_data = {
            "items": [f"item_{i}" for i in range(1000)],
            "metadata": {"size": "large"}
        }
        
        # Set with compression
        success = await cache_manager.set(
            "compressed_key",
            large_data,
            compress=True
        )
        assert success is True
        
        # Get and verify
        value = await cache_manager.get("compressed_key")
        assert value is not None
        assert len(value["items"]) == 1000
        assert value["metadata"]["size"] == "large"
    
    async def test_namespaces(self, cache_manager):
        """Test namespace isolation."""
        # Set values in different namespaces
        await cache_manager.set(
            "shared_key",
            {"ns": "api"},
            namespace=CacheNamespace.API_RESPONSES
        )
        
        await cache_manager.set(
            "shared_key",
            {"ns": "analytics"},
            namespace=CacheNamespace.ANALYTICS
        )
        
        # Get from different namespaces
        api_value = await cache_manager.get(
            "shared_key",
            namespace=CacheNamespace.API_RESPONSES
        )
        analytics_value = await cache_manager.get(
            "shared_key",
            namespace=CacheNamespace.ANALYTICS
        )
        
        assert api_value["ns"] == "api"
        assert analytics_value["ns"] == "analytics"
    
    async def test_tags(self, cache_manager):
        """Test cache tagging and bulk deletion."""
        # Set multiple values with tags
        await cache_manager.set(
            "item1",
            {"id": 1},
            tags=["workspace_123", "campaign_456"]
        )
        await cache_manager.set(
            "item2",
            {"id": 2},
            tags=["workspace_123", "campaign_789"]
        )
        await cache_manager.set(
            "item3",
            {"id": 3},
            tags=["workspace_456", "campaign_456"]
        )
        
        # Delete by tag
        deleted = await cache_manager.delete_by_tag("workspace_123")
        assert deleted >= 2  # Should delete item1 and item2
        
        # Verify deletion
        assert await cache_manager.get("item1") is None
        assert await cache_manager.get("item2") is None
        assert await cache_manager.get("item3") is not None
    
    async def test_pattern_deletion(self, cache_manager):
        """Test pattern-based deletion."""
        # Set multiple values
        await cache_manager.set("user:123:profile", {"name": "John"})
        await cache_manager.set("user:123:settings", {"theme": "dark"})
        await cache_manager.set("user:456:profile", {"name": "Jane"})
        
        # Delete by pattern
        deleted = await cache_manager.delete_pattern("user:123:*")
        assert deleted == 2
        
        # Verify
        assert await cache_manager.get("user:123:profile") is None
        assert await cache_manager.get("user:123:settings") is None
        assert await cache_manager.get("user:456:profile") is not None
    
    async def test_refresh_callback(self, cache_manager):
        """Test automatic refresh with callback."""
        refresh_count = 0
        
        async def refresh_callback():
            nonlocal refresh_count
            refresh_count += 1
            return {"refreshed": True, "count": refresh_count}
        
        # Get with refresh callback (cache miss)
        value = await cache_manager.get(
            "refresh_test",
            refresh_callback=refresh_callback
        )
        
        assert value is not None
        assert value["refreshed"] is True
        assert refresh_count == 1
        
        # Get again (cache hit)
        value = await cache_manager.get(
            "refresh_test",
            refresh_callback=refresh_callback
        )
        
        assert value is not None
        assert refresh_count == 1  # Should not refresh
    
    async def test_cache_stats(self, cache_manager):
        """Test cache statistics tracking."""
        # Perform some operations
        await cache_manager.set("stat_test1", {"data": 1})
        await cache_manager.get("stat_test1")  # Hit
        await cache_manager.get("stat_test2")  # Miss
        await cache_manager.get("stat_test1")  # Hit
        
        # Get stats
        stats = await cache_manager.get_stats(CacheNamespace.API_RESPONSES)
        
        assert stats["hits"] >= 2
        assert stats["misses"] >= 1
        assert stats["hit_rate"] > 0
    
    async def test_decorator(self, cache_manager):
        """Test cache decorator."""
        call_count = 0
        
        @cache_manager.cached(
            namespace=CacheNamespace.API_RESPONSES,
            ttl=60
        )
        async def expensive_function(param1: str, param2: int):
            nonlocal call_count
            call_count += 1
            return {"result": f"{param1}_{param2}", "calls": call_count}
        
        # First call
        result1 = await expensive_function("test", 123)
        assert result1["calls"] == 1
        
        # Second call (cached)
        result2 = await expensive_function("test", 123)
        assert result2["calls"] == 1  # Same as first
        
        # Different parameters
        result3 = await expensive_function("test", 456)
        assert result3["calls"] == 2


class TestSpecializedCaches:
    """Test specialized cache implementations."""
    
    @pytest.fixture
    async def cache_manager(self):
        """Create a cache manager for testing."""
        cache = CacheManager(redis_url="redis://localhost:6379/15", prefix="test")
        await cache.initialize()
        yield cache
        await cache.close()
    
    async def test_lead_enrichment_cache(self, cache_manager):
        """Test lead enrichment cache."""
        enrichment_cache = LeadEnrichmentCache(cache_manager)
        
        # Set enrichment data
        enrichment_data = {
            "company": "Acme Corp",
            "industry": "Software",
            "size": "50-100",
            "location": "San Francisco, CA"
        }
        
        success = await enrichment_cache.set_enrichment(
            "lead_123",
            "workspace_456",
            enrichment_data
        )
        assert success is True
        
        # Get enrichment data
        data = await enrichment_cache.get_enrichment(
            "lead_123",
            "workspace_456"
        )
        assert data is not None
        assert data["company"] == "Acme Corp"
        
        # Invalidate workspace
        deleted = await enrichment_cache.invalidate_workspace("workspace_456")
        assert deleted >= 1
        
        # Verify deletion
        data = await enrichment_cache.get_enrichment(
            "lead_123",
            "workspace_456"
        )
        assert data is None
    
    async def test_ai_response_cache(self, cache_manager):
        """Test AI response cache."""
        ai_cache = AIResponseCache(cache_manager)
        
        # Cache AI response
        success = await ai_cache.set_response(
            prompt="Write a cold email",
            model="gpt-4",
            temperature=0.7,
            workspace_id="workspace_123",
            response="Dear [Name], I hope this email finds you well...",
            tokens_used=150
        )
        assert success is True
        
        # Get cached response
        cached = await ai_cache.get_response(
            prompt="Write a cold email",
            model="gpt-4",
            temperature=0.7,
            workspace_id="workspace_123"
        )
        assert cached is not None
        assert cached["response"].startswith("Dear [Name]")
        assert cached["tokens_used"] == 150
        
        # Different temperature should miss
        cached = await ai_cache.get_response(
            prompt="Write a cold email",
            model="gpt-4",
            temperature=0.8,  # Different
            workspace_id="workspace_123"
        )
        assert cached is None
    
    async def test_analytics_cache(self, cache_manager):
        """Test analytics cache."""
        analytics_cache = AnalyticsCache(cache_manager)
        
        # Cache campaign stats
        stats = {
            "sent": 1000,
            "opened": 450,
            "clicked": 120,
            "replied": 25,
            "open_rate": 0.45,
            "click_rate": 0.12
        }
        
        success = await analytics_cache.set_campaign_stats(
            "campaign_123",
            "workspace_456",
            stats
        )
        assert success is True
        
        # Get cached stats
        cached_stats = await analytics_cache.get_campaign_stats(
            "campaign_123",
            "workspace_456"
        )
        assert cached_stats is not None
        assert cached_stats["sent"] == 1000
        assert cached_stats["open_rate"] == 0.45
        
        # Cache dashboard data
        dashboard = {
            "total_campaigns": 10,
            "active_campaigns": 3,
            "total_leads": 5000,
            "total_sent": 15000
        }
        
        success = await analytics_cache.set_workspace_dashboard(
            "workspace_456",
            dashboard
        )
        assert success is True
        
        # Get cached dashboard
        cached_dashboard = await analytics_cache.get_workspace_dashboard(
            "workspace_456"
        )
        assert cached_dashboard is not None
        assert cached_dashboard["total_campaigns"] == 10


class TestCacheMiddleware:
    """Test cache middleware for FastAPI."""
    
    @pytest.fixture
    def mock_request(self):
        """Create mock request."""
        request = MagicMock()
        request.method = "GET"
        request.url.path = "/api/campaigns"
        request.query_params = {"page": "1", "limit": "10"}
        request.headers = {"accept": "application/json"}
        request.state = MagicMock(workspace_id="workspace_123")
        return request
    
    @pytest.fixture
    def mock_cache_manager(self):
        """Create mock cache manager."""
        cache = AsyncMock()
        cache.get = AsyncMock(return_value=None)
        cache.set = AsyncMock(return_value=True)
        return cache
    
    async def test_cache_middleware_miss(self, mock_request, mock_cache_manager):
        """Test cache middleware on cache miss."""
        # Create middleware
        app = MagicMock()
        middleware = CacheMiddleware(app, cache_manager=mock_cache_manager)
        
        # Mock call_next
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.headers = {}
        mock_response.body_iterator = AsyncMock()
        
        async def mock_call_next(request):
            return mock_response
        
        # Process request
        response = await middleware.dispatch(mock_request, mock_call_next)
        
        # Verify cache was checked
        mock_cache_manager.get.assert_called_once()
        
        # Verify response headers
        assert response.headers["X-Cache"] == "MISS"
    
    async def test_cache_middleware_hit(self, mock_request, mock_cache_manager):
        """Test cache middleware on cache hit."""
        # Mock cache hit
        cached_data = {
            "content": {"data": "cached"},
            "status_code": 200,
            "headers": {}
        }
        mock_cache_manager.get.return_value = cached_data
        
        # Create middleware
        app = MagicMock()
        middleware = CacheMiddleware(app, cache_manager=mock_cache_manager)
        
        # Process request
        response = await middleware.dispatch(mock_request, lambda r: None)
        
        # Verify response
        assert response.status_code == 200
        assert response.headers["X-Cache"] == "HIT"
    
    async def test_cache_endpoint_decorator(self):
        """Test cache endpoint decorator."""
        call_count = 0
        
        @cache_endpoint(ttl=60)
        async def test_endpoint(request=None):
            nonlocal call_count
            call_count += 1
            return {"data": "test", "calls": call_count}
        
        # Mock request
        request = MagicMock()
        request.state.workspace_id = "workspace_123"
        request.url.path = "/test"
        request.query_params = {}
        
        # Mock cache
        with patch('middleware.cache_middleware.get_cache') as mock_get_cache:
            mock_cache = AsyncMock()
            mock_cache.get = AsyncMock(return_value=None)
            mock_cache.set = AsyncMock(return_value=True)
            mock_get_cache.return_value = mock_cache
            
            # First call
            result1 = await test_endpoint(request=request)
            assert result1["calls"] == 1
            
            # Mock cache hit for second call
            mock_cache.get.return_value = {"data": "test", "calls": 1}
            
            # Second call (cached)
            result2 = await test_endpoint(request=request)
            assert result2["calls"] == 1  # Should be cached


class TestCachedServices:
    """Test cached service implementations."""
    
    @pytest.fixture
    def mock_db_session(self):
        """Create mock database session."""
        session = AsyncMock()
        session.execute = AsyncMock()
        session.add = MagicMock()
        session.commit = AsyncMock()
        session.rollback = AsyncMock()
        return session
    
    @pytest.fixture
    async def mock_cache_manager(self):
        """Create mock cache manager."""
        cache = AsyncMock()
        cache.get = AsyncMock(return_value=None)
        cache.set = AsyncMock(return_value=True)
        
        # Create specialized caches
        cache.AIResponseCache = lambda c: AsyncMock(
            get_response=AsyncMock(return_value=None),
            set_response=AsyncMock(return_value=True)
        )
        cache.LeadEnrichmentCache = lambda c: AsyncMock(
            get_enrichment=AsyncMock(return_value=None),
            set_enrichment=AsyncMock(return_value=True)
        )
        
        return cache
    
    async def test_cached_ai_service(self, mock_db_session, mock_cache_manager):
        """Test cached AI service."""
        # Create service
        service = CachedAIService(mock_db_session, mock_cache_manager)
        await service.initialize()
        
        # Mock AI provider
        with patch.object(service, '_generate_fresh') as mock_generate:
            mock_generate.return_value = AIResponse(
                content="Generated response",
                model=AIModel.GPT_35_TURBO,
                tokens_used=100,
                tokens_prompt=50,
                tokens_completion=50,
                cost=0.001,
                cached=False,
                processing_time_ms=500,
                provider="openai"
            )
            
            # Generate response
            response = await service.generate(
                prompt="Test prompt",
                model=AIModel.GPT_35_TURBO,
                workspace_id="workspace_123"
            )
            
            assert response.content == "Generated response"
            assert response.cached is False
            assert response.tokens_used == 100
    
    async def test_cached_enrichment_service(self, mock_db_session, mock_cache_manager):
        """Test cached enrichment service."""
        # Create service
        service = CachedEnrichmentService(mock_db_session, mock_cache_manager)
        await service.initialize()
        
        # Mock lead fetch
        mock_lead = MagicMock(
            id="lead_123",
            email="test@example.com",
            first_name="John",
            last_name="Doe",
            company="Acme Corp"
        )
        
        with patch.object(service, '_get_lead') as mock_get_lead:
            mock_get_lead.return_value = mock_lead
            
            # Mock enrichment provider
            with patch.object(service, '_fetch_enrichment') as mock_fetch:
                mock_fetch.return_value = EnrichmentResult(
                    success=True,
                    source=EnrichmentSource.CLEARBIT,
                    data={"company": "Acme Corp", "industry": "Software"},
                    cost=0.05
                )
                
                # Enrich lead
                result = await service.enrich_lead(
                    "lead_123",
                    "workspace_123"
                )
                
                assert result.success is True
                assert result.source == EnrichmentSource.CLEARBIT
                assert result.data["industry"] == "Software"


class TestCacheIntegration:
    """Test cache integration with API endpoints."""
    
    async def test_cache_management_endpoints(self, client, auth_headers_admin):
        """Test cache management API endpoints."""
        # Get cache stats
        response = await client.get(
            "/api/cache/stats",
            headers=auth_headers_admin
        )
        assert response.status_code == 200
        data = response.json()
        assert "stats" in data
        assert "memory" in data
        
        # Test cache health
        response = await client.get("/api/cache/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] in ["healthy", "unhealthy"]
        
        # Clear namespace
        response = await client.post(
            "/api/cache/clear",
            headers=auth_headers_admin,
            json={"namespace": "api_responses"}
        )
        assert response.status_code == 200
        
        # Invalidate by pattern
        response = await client.post(
            "/api/cache/invalidate",
            headers=auth_headers_admin,
            params={
                "namespace": "api_responses",
                "pattern": "test:*"
            }
        )
        assert response.status_code == 200
    
    async def test_cached_endpoint(self, client, auth_headers):
        """Test endpoint with caching."""
        # First request (cache miss)
        response1 = await client.get(
            "/api/cache/campaigns/123/analytics",
            headers=auth_headers,
            params={"workspace_id": "workspace_123"}
        )
        assert response1.status_code == 200
        assert response1.headers.get("X-Cache") == "MISS"
        
        # Second request (cache hit)
        response2 = await client.get(
            "/api/cache/campaigns/123/analytics",
            headers=auth_headers,
            params={"workspace_id": "workspace_123"}
        )
        assert response2.status_code == 200
        assert response2.headers.get("X-Cache") == "HIT"
        
        # Data should be identical
        assert response1.json() == response2.json()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])