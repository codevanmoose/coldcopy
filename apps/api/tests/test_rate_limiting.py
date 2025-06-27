"""
Tests for rate limiting functionality.
"""
import pytest
import asyncio
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, patch, MagicMock

from fastapi import Request, HTTPException
from fastapi.testclient import TestClient

from middleware.rate_limiting import RateLimitMiddleware, TokenBucketRateLimit
from utils.advanced_rate_limiting import (
    AdaptiveRateLimiter,
    DistributedRateLimiter,
    CircuitBreakerRateLimit,
    GeographicRateLimit,
    RateLimitMonitor
)
from utils.rate_limit_decorators import (
    rate_limit,
    adaptive_rate_limit,
    circuit_breaker_rate_limit,
    geographic_rate_limit,
    daily_quota_limit
)


class TestRateLimitMiddleware:
    """Test the main rate limiting middleware."""
    
    @pytest.fixture
    def mock_rate_cache(self):
        """Mock rate cache for testing."""
        cache = AsyncMock()
        cache.check_rate_limit = AsyncMock(return_value={
            "allowed": True,
            "current_usage": 1,
            "limit": 60,
            "reset_time": "2024-01-15T10:30:00Z"
        })
        return cache
    
    @pytest.fixture
    def rate_limit_middleware(self):
        """Create rate limit middleware instance."""
        return RateLimitMiddleware(
            app=None,
            default_requests_per_minute=60,
            default_requests_per_hour=1000,
            burst_requests_per_minute=100
        )
    
    @pytest.fixture
    def mock_request(self):
        """Create mock request."""
        request = MagicMock()
        request.url.path = "/api/test"
        request.method = "GET"
        request.headers = {"authorization": "Bearer test-token"}
        request.client.host = "127.0.0.1"
        return request
    
    def test_should_skip_rate_limiting(self, rate_limit_middleware, mock_request):
        """Test paths that should skip rate limiting."""
        skip_paths = ["/health", "/docs", "/openapi.json", "/metrics"]
        
        for path in skip_paths:
            mock_request.url.path = path
            assert rate_limit_middleware._should_skip_rate_limiting(mock_request)
        
        # Normal API path should not skip
        mock_request.url.path = "/api/campaigns"
        assert not rate_limit_middleware._should_skip_rate_limiting(mock_request)
    
    def test_get_client_ip(self, rate_limit_middleware, mock_request):
        """Test client IP extraction."""
        # Test x-forwarded-for header
        mock_request.headers = {"x-forwarded-for": "192.168.1.100, 10.0.0.1"}
        ip = rate_limit_middleware._get_client_ip(mock_request)
        assert ip == "192.168.1.100"
        
        # Test x-real-ip header
        mock_request.headers = {"x-real-ip": "192.168.1.200"}
        ip = rate_limit_middleware._get_client_ip(mock_request)
        assert ip == "192.168.1.200"
        
        # Test fallback to client host
        mock_request.headers = {}
        mock_request.client.host = "192.168.1.300"
        ip = rate_limit_middleware._get_client_ip(mock_request)
        assert ip == "192.168.1.300"
    
    @pytest.mark.asyncio
    async def test_get_identifier_and_limits_authenticated(self, rate_limit_middleware):
        """Test identifier and limits for authenticated user."""
        mock_request = MagicMock()
        mock_request.method = "GET"
        mock_request.url.path = "/api/campaigns"
        mock_request.headers = {"authorization": "Bearer test-token"}
        
        mock_user = MagicMock()
        mock_user.id = "user123"
        mock_user.plan = "pro"
        
        with patch('middleware.rate_limiting.get_current_user_from_token', return_value=mock_user):
            identifier, limits = await rate_limit_middleware._get_identifier_and_limits(mock_request)
            
            assert identifier == "user:user123"
            assert limits["rpm"] == 100  # Pro tier limit
            assert limits["rph"] == 2000
    
    @pytest.mark.asyncio
    async def test_get_identifier_and_limits_unauthenticated(self, rate_limit_middleware):
        """Test identifier and limits for unauthenticated request."""
        mock_request = MagicMock()
        mock_request.method = "GET"
        mock_request.url.path = "/api/campaigns"
        mock_request.headers = {}
        mock_request.client.host = "192.168.1.100"
        
        with patch('middleware.rate_limiting.get_current_user_from_token', side_effect=Exception("No token")):
            identifier, limits = await rate_limit_middleware._get_identifier_and_limits(mock_request)
            
            assert identifier == "ip:192.168.1.100"
            assert limits["rpm"] == 20  # IP default limit
            assert limits["rph"] == 200
    
    @pytest.mark.asyncio
    async def test_rate_limit_exceeded_response(self, rate_limit_middleware):
        """Test rate limit exceeded response creation."""
        minute_check = {
            "allowed": False,
            "current_usage": 61,
            "limit": 60,
            "reset_time": "2024-01-15T10:31:00Z"
        }
        
        hour_check = {
            "allowed": True,
            "current_usage": 100,
            "limit": 1000,
            "reset_time": "2024-01-15T11:30:00Z"
        }
        
        limits = {"rpm": 60, "rph": 1000, "description": "Test limit"}
        
        response = await rate_limit_middleware._create_rate_limit_response(
            minute_check, hour_check, limits
        )
        
        assert response.status_code == 429
        assert "Rate limit exceeded" in response.body.decode()
        assert response.headers["Retry-After"] == "60"


class TestTokenBucketRateLimit:
    """Test token bucket rate limiting."""
    
    @pytest.fixture
    def token_bucket(self):
        """Create token bucket instance."""
        return TokenBucketRateLimit(
            max_tokens=100,
            refill_rate=10.0,  # 10 tokens per minute
            refill_period=60
        )
    
    @pytest.fixture
    def mock_rate_cache(self):
        """Mock rate cache."""
        cache = AsyncMock()
        cache.cache = AsyncMock()
        cache.cache.get = AsyncMock(return_value={
            "tokens": 50,
            "last_refill": datetime.utcnow().isoformat()
        })
        cache.cache.set = AsyncMock()
        return cache
    
    @pytest.mark.asyncio
    async def test_consume_tokens_success(self, token_bucket, mock_rate_cache):
        """Test successful token consumption."""
        result = await token_bucket.consume_tokens(
            "test_user", 10, mock_rate_cache
        )
        
        assert result["allowed"] is True
        assert result["tokens_consumed"] == 10
        assert result["tokens_remaining"] == 40
    
    @pytest.mark.asyncio
    async def test_consume_tokens_insufficient(self, token_bucket, mock_rate_cache):
        """Test token consumption with insufficient tokens."""
        # Set up cache to return low token count
        mock_rate_cache.cache.get.return_value = {
            "tokens": 5,
            "last_refill": datetime.utcnow().isoformat()
        }
        
        result = await token_bucket.consume_tokens(
            "test_user", 10, mock_rate_cache
        )
        
        assert result["allowed"] is False
        assert result["tokens_requested"] == 10
        assert result["tokens_remaining"] == 5
    
    @pytest.mark.asyncio
    async def test_token_refill(self, token_bucket, mock_rate_cache):
        """Test token bucket refill mechanism."""
        # Set up cache with old timestamp
        old_time = datetime.utcnow() - timedelta(minutes=5)
        mock_rate_cache.cache.get.return_value = {
            "tokens": 0,
            "last_refill": old_time.isoformat()
        }
        
        result = await token_bucket.consume_tokens(
            "test_user", 5, mock_rate_cache
        )
        
        # Should have refilled some tokens
        assert result["allowed"] is True


class TestAdaptiveRateLimiter:
    """Test adaptive rate limiting."""
    
    @pytest.fixture
    def adaptive_limiter(self):
        """Create adaptive rate limiter."""
        return AdaptiveRateLimiter()
    
    @pytest.mark.asyncio
    async def test_calculate_adaptive_limit_high_reputation(self, adaptive_limiter):
        """Test adaptive limit calculation with high reputation."""
        base_config = adaptive_limiter.base_configs["api_call"]
        
        # High reputation, low system load
        adaptive_config = await adaptive_limiter._calculate_adaptive_limit(
            base_config, user_reputation=1.5, system_load=0.2
        )
        
        # Should increase limit due to high reputation and low load
        assert adaptive_config.limit >= base_config.limit
    
    @pytest.mark.asyncio
    async def test_calculate_adaptive_limit_low_reputation(self, adaptive_limiter):
        """Test adaptive limit calculation with low reputation."""
        base_config = adaptive_limiter.base_configs["api_call"]
        
        # Low reputation, high system load
        adaptive_config = await adaptive_limiter._calculate_adaptive_limit(
            base_config, user_reputation=0.3, system_load=0.8
        )
        
        # Should decrease limit due to low reputation and high load
        assert adaptive_config.limit < base_config.limit
        assert adaptive_config.limit >= 1  # At least 1 request allowed


class TestCircuitBreakerRateLimit:
    """Test circuit breaker rate limiting."""
    
    @pytest.fixture
    def circuit_breaker(self):
        """Create circuit breaker instance."""
        return CircuitBreakerRateLimit(
            failure_threshold=3,
            recovery_timeout=60,
            half_open_max_calls=2
        )
    
    @pytest.fixture
    def mock_rate_cache(self):
        """Mock rate cache."""
        cache = AsyncMock()
        cache.cache = AsyncMock()
        cache.cache.get = AsyncMock(return_value={
            "state": "closed",
            "failure_count": 0,
            "last_failure": None,
            "half_open_calls": 0
        })
        cache.cache.set = AsyncMock()
        return cache
    
    @pytest.mark.asyncio
    async def test_circuit_closed_success(self, circuit_breaker):
        """Test circuit breaker in closed state with successful check."""
        from utils.advanced_rate_limiting import RateLimitStatus
        
        async def mock_normal_check():
            return RateLimitStatus(
                allowed=True,
                current_usage=10,
                limit=100,
                window_seconds=60,
                remaining=90,
                reset_time=datetime.utcnow().isoformat()
            )
        
        with patch('utils.advanced_rate_limiting.get_rate_limit_cache') as mock_cache:
            mock_cache.return_value.cache.get.return_value = {
                "state": "closed",
                "failure_count": 0,
                "last_failure": None,
                "half_open_calls": 0
            }
            
            result = await circuit_breaker.check_circuit_breaker(
                "test_id", mock_normal_check
            )
            
            assert result.allowed is True
    
    @pytest.mark.asyncio
    async def test_circuit_open_blocks_requests(self, circuit_breaker):
        """Test circuit breaker in open state blocks requests."""
        recent_failure = datetime.utcnow() - timedelta(seconds=30)
        
        async def mock_normal_check():
            # This shouldn't be called when circuit is open
            assert False, "Normal check should not be called when circuit is open"
        
        with patch('utils.advanced_rate_limiting.get_rate_limit_cache') as mock_cache:
            mock_cache.return_value.cache.get.return_value = {
                "state": "open",
                "failure_count": 5,
                "last_failure": recent_failure.isoformat(),
                "half_open_calls": 0
            }
            
            result = await circuit_breaker.check_circuit_breaker(
                "test_id", mock_normal_check
            )
            
            assert result.allowed is False
            assert "circuit breaker open" in result.error_message.lower()


class TestGeographicRateLimit:
    """Test geographic rate limiting."""
    
    @pytest.fixture
    def geo_limiter(self):
        """Create geographic rate limiter."""
        return GeographicRateLimit()
    
    def test_get_region_from_country(self, geo_limiter):
        """Test country to region mapping."""
        assert geo_limiter._get_region_from_country("US") == "US"
        assert geo_limiter._get_region_from_country("DE") == "EU"
        assert geo_limiter._get_region_from_country("JP") == "AS"
        assert geo_limiter._get_region_from_country("BR") == "SA"
        assert geo_limiter._get_region_from_country("ZA") == "AF"
        assert geo_limiter._get_region_from_country("AU") == "OC"
        assert geo_limiter._get_region_from_country("XX") == "unknown"
    
    @pytest.mark.asyncio
    async def test_geographic_limit_calculation(self, geo_limiter):
        """Test geographic limit calculation."""
        base_limit = 100
        
        # Test different regions
        test_cases = [
            ("US", 100),    # 1.0 multiplier
            ("DE", 100),    # EU: 1.0 multiplier  
            ("JP", 80),     # AS: 0.8 multiplier
            ("BR", 60),     # SA: 0.6 multiplier
            ("ZA", 40),     # AF: 0.4 multiplier
            ("XX", 50),     # unknown: 0.5 multiplier
        ]
        
        with patch('utils.advanced_rate_limiting.get_rate_limit_cache') as mock_cache:
            mock_cache.return_value.check_rate_limit = AsyncMock(return_value={
                "allowed": True,
                "current_usage": 10,
                "reset_time": datetime.utcnow().isoformat()
            })
            
            for country, expected_limit in test_cases:
                result = await geo_limiter.check_geographic_limit(
                    "test_id", base_limit, 60, country
                )
                
                assert result.limit == expected_limit
                assert result.allowed is True


class TestRateLimitDecorators:
    """Test rate limiting decorators."""
    
    @pytest.mark.asyncio
    async def test_rate_limit_decorator_success(self):
        """Test rate limit decorator allows request."""
        mock_request = MagicMock()
        mock_request.headers = {}
        mock_request.client.host = "127.0.0.1"
        
        @rate_limit(requests_per_minute=60, per_ip=True)
        async def test_endpoint(request: Request):
            return {"message": "success"}
        
        with patch('utils.rate_limit_decorators._check_endpoint_rate_limits') as mock_check:
            mock_check.return_value = None  # No exception means allowed
            
            result = await test_endpoint(mock_request)
            assert result["message"] == "success"
    
    @pytest.mark.asyncio
    async def test_rate_limit_decorator_exceeded(self):
        """Test rate limit decorator blocks request when exceeded."""
        mock_request = MagicMock()
        mock_request.headers = {}
        mock_request.client.host = "127.0.0.1"
        
        @rate_limit(requests_per_minute=60, per_ip=True)
        async def test_endpoint(request: Request):
            return {"message": "success"}
        
        with patch('utils.rate_limit_decorators._check_endpoint_rate_limits') as mock_check:
            mock_check.side_effect = HTTPException(status_code=429, detail="Rate limit exceeded")
            
            with pytest.raises(HTTPException) as exc_info:
                await test_endpoint(mock_request)
            
            assert exc_info.value.status_code == 429
    
    @pytest.mark.asyncio
    async def test_daily_quota_decorator(self):
        """Test daily quota decorator."""
        mock_request = MagicMock()
        mock_request.headers = {}
        mock_request.client.host = "127.0.0.1"
        
        @daily_quota_limit(daily_limit=100, per_ip=True)
        async def test_endpoint(request: Request):
            return {"message": "success"}
        
        with patch('utils.rate_limit_decorators.get_rate_limit_cache') as mock_cache:
            mock_cache.return_value.cache.get.return_value = 50  # Current usage
            mock_cache.return_value.cache.set = AsyncMock()
            
            result = await test_endpoint(mock_request)
            assert result["message"] == "success"
            
            # Verify usage was incremented
            mock_cache.return_value.cache.set.assert_called_once()


class TestRateLimitMonitor:
    """Test rate limit monitoring."""
    
    @pytest.fixture
    def monitor(self):
        """Create rate limit monitor."""
        return RateLimitMonitor()
    
    @pytest.mark.asyncio
    async def test_get_rate_limit_analytics(self, monitor):
        """Test rate limit analytics generation."""
        with patch('utils.advanced_rate_limiting.get_rate_limit_cache') as mock_cache:
            # Mock Redis keys
            mock_cache.return_value.cache.redis.keys.return_value = [
                "rate_limit:user:123:minute",
                "rate_limit:ip:192.168.1.1:hour"
            ]
            
            # Mock usage data
            mock_cache.return_value.cache.get.side_effect = [
                {"current_usage": 50, "limit": 100},
                {"current_usage": 200, "limit": 1000}
            ]
            
            analytics = await monitor.get_rate_limit_analytics()
            
            assert "total_identifiers" in analytics
            assert "top_consumers" in analytics
            assert "limit_breaches" in analytics
    
    def test_generate_recommendations(self, monitor):
        """Test recommendation generation."""
        analytics = {
            "total_identifiers": 100,
            "limit_breaches": [
                {"identifier": "user:123", "usage": 110, "limit": 100, "severity": "high"},
                {"identifier": "user:456", "usage": 95, "limit": 100, "severity": "warning"}
            ],
            "top_consumers": [
                {"identifier": "user:123", "usage": 1000},
                {"identifier": "user:456", "usage": 100}
            ]
        }
        
        recommendations = monitor._generate_recommendations(analytics)
        
        assert len(recommendations) > 0
        assert any("high-severity" in rec.lower() for rec in recommendations)


class TestIntegration:
    """Integration tests for rate limiting system."""
    
    @pytest.mark.asyncio
    async def test_full_rate_limiting_flow(self):
        """Test complete rate limiting flow."""
        # This would test the full middleware integration
        # Mock the FastAPI app and test actual HTTP requests
        pass
    
    @pytest.mark.asyncio
    async def test_concurrent_rate_limiting(self):
        """Test rate limiting under concurrent load."""
        # Test multiple concurrent requests hitting rate limits
        tasks = []
        
        async def make_request(identifier):
            # Mock rate limit check
            with patch('utils.advanced_rate_limiting.get_rate_limit_cache') as mock_cache:
                mock_cache.return_value.check_rate_limit.return_value = {
                    "allowed": True,
                    "current_usage": 1,
                    "limit": 100,
                    "reset_time": datetime.utcnow().isoformat()
                }
                
                from utils.advanced_rate_limiting import adaptive_limiter
                result = await adaptive_limiter.check_adaptive_limit(
                    f"concurrent_test_{identifier}", "api_call"
                )
                return result.allowed
        
        # Create 10 concurrent requests
        for i in range(10):
            tasks.append(make_request(i))
        
        results = await asyncio.gather(*tasks)
        
        # All should be allowed in this test scenario
        assert all(results)
    
    @pytest.mark.asyncio
    async def test_rate_limit_persistence(self):
        """Test rate limit state persistence across requests."""
        # Test that rate limit counters persist correctly
        with patch('utils.advanced_rate_limiting.get_rate_limit_cache') as mock_cache:
            # Mock incrementing usage
            usage_values = [1, 2, 3, 4, 5]
            mock_cache.return_value.check_rate_limit.side_effect = [
                {
                    "allowed": True,
                    "current_usage": usage,
                    "limit": 10,
                    "reset_time": datetime.utcnow().isoformat()
                }
                for usage in usage_values
            ]
            
            from utils.advanced_rate_limiting import adaptive_limiter
            
            # Make multiple requests
            for expected_usage in usage_values:
                result = await adaptive_limiter.check_adaptive_limit(
                    "persistence_test", "api_call"
                )
                assert result.current_usage == expected_usage


if __name__ == "__main__":
    pytest.main([__file__])