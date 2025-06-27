"""
Performance benchmarking tests for ColdCopy API.
"""
import pytest
import time
import asyncio
from datetime import datetime
from unittest.mock import patch

from httpx import AsyncClient


class TestAPIPerformance:
    """Test API endpoint performance."""
    
    @pytest.mark.performance
    async def test_campaign_list_performance(self, client: AsyncClient, auth_headers, mock_auth):
        """Test campaign list endpoint performance."""
        start_time = time.time()
        
        response = await client.get("/api/campaigns", headers=auth_headers)
        
        end_time = time.time()
        response_time = end_time - start_time
        
        assert response.status_code in [200, 401, 403]
        # Should respond within 500ms
        assert response_time < 0.5
    
    @pytest.mark.performance
    async def test_lead_creation_performance(self, client: AsyncClient, auth_headers, mock_auth):
        """Test lead creation performance."""
        lead_data = {
            "email": "performance@example.com",
            "first_name": "Performance",
            "last_name": "Test",
            "company": "Test Corp"
        }
        
        start_time = time.time()
        
        response = await client.post(
            "/api/leads",
            headers=auth_headers,
            json=lead_data
        )
        
        end_time = time.time()
        response_time = end_time - start_time
        
        assert response.status_code in [201, 401, 403, 422]
        # Should create lead within 300ms
        assert response_time < 0.3
    
    @pytest.mark.performance
    async def test_bulk_lead_creation_performance(
        self, 
        client: AsyncClient, 
        auth_headers, 
        performance_test_data, 
        mock_auth
    ):
        """Test bulk lead creation performance."""
        # Use 50 leads for performance test
        bulk_data = {
            "leads": performance_test_data["bulk_leads"][:50]
        }
        
        start_time = time.time()
        
        response = await client.post(
            "/api/leads/bulk",
            headers=auth_headers,
            json=bulk_data
        )
        
        end_time = time.time()
        response_time = end_time - start_time
        
        assert response.status_code in [201, 401, 403, 422]
        # Should process 50 leads within 2 seconds
        assert response_time < 2.0
        
        if response.status_code == 201:
            data = response.json()
            print(f"Processed {data.get('created_count', 0)} leads in {response_time:.2f}s")
    
    @pytest.mark.performance
    async def test_search_performance(self, client: AsyncClient, auth_headers, mock_auth):
        """Test search endpoint performance."""
        start_time = time.time()
        
        response = await client.get(
            "/api/leads/search",
            headers=auth_headers,
            params={"q": "test", "field": "email"}
        )
        
        end_time = time.time()
        response_time = end_time - start_time
        
        assert response.status_code in [200, 401, 403]
        # Search should be fast
        assert response_time < 0.5
    
    @pytest.mark.performance
    async def test_analytics_performance(self, client: AsyncClient, auth_headers, mock_auth):
        """Test analytics endpoint performance."""
        # Create a test campaign first
        campaign_data = {
            "name": "Performance Test Campaign",
            "settings": {"email_subject": "Test", "email_template": "Hello"}
        }
        
        campaign_response = await client.post(
            "/api/campaigns",
            headers=auth_headers,
            json=campaign_data
        )
        
        if campaign_response.status_code != 201:
            return
        
        campaign = campaign_response.json()
        campaign_id = campaign["id"]
        
        start_time = time.time()
        
        response = await client.get(
            f"/api/campaigns/{campaign_id}/analytics",
            headers=auth_headers
        )
        
        end_time = time.time()
        response_time = end_time - start_time
        
        assert response.status_code in [200, 401, 403, 404]
        # Analytics should load within 1 second
        assert response_time < 1.0


class TestConcurrentPerformance:
    """Test performance under concurrent load."""
    
    @pytest.mark.performance
    async def test_concurrent_read_performance(self, client: AsyncClient, auth_headers, mock_auth):
        """Test concurrent read performance."""
        concurrent_requests = 10
        
        async def make_request():
            start = time.time()
            response = await client.get("/api/campaigns", headers=auth_headers)
            end = time.time()
            return response, end - start
        
        start_time = time.time()
        
        # Make concurrent requests
        tasks = [make_request() for _ in range(concurrent_requests)]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        total_time = time.time() - start_time
        
        # Process results
        successful_requests = 0
        total_response_time = 0
        
        for result in results:
            if isinstance(result, tuple):
                response, response_time = result
                if hasattr(response, 'status_code') and response.status_code in [200, 401, 403]:
                    successful_requests += 1
                    total_response_time += response_time
        
        if successful_requests > 0:
            avg_response_time = total_response_time / successful_requests
            print(f"Concurrent requests: {concurrent_requests}")
            print(f"Successful: {successful_requests}")
            print(f"Total time: {total_time:.2f}s")
            print(f"Average response time: {avg_response_time:.2f}s")
            
            # Average response time should be reasonable
            assert avg_response_time < 1.0
    
    @pytest.mark.performance
    async def test_concurrent_write_performance(self, client: AsyncClient, auth_headers, mock_auth):
        """Test concurrent write performance."""
        concurrent_requests = 5
        
        async def create_lead(index):
            lead_data = {
                "email": f"concurrent{index}@example.com",
                "first_name": f"User{index}",
                "last_name": "Test",
                "company": "Test Corp"
            }
            
            start = time.time()
            response = await client.post(
                "/api/leads",
                headers=auth_headers,
                json=lead_data
            )
            end = time.time()
            return response, end - start
        
        start_time = time.time()
        
        # Make concurrent write requests
        tasks = [create_lead(i) for i in range(concurrent_requests)]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        total_time = time.time() - start_time
        
        # Process results
        successful_writes = 0
        total_response_time = 0
        
        for result in results:
            if isinstance(result, tuple):
                response, response_time = result
                if hasattr(response, 'status_code') and response.status_code == 201:
                    successful_writes += 1
                    total_response_time += response_time
        
        if successful_writes > 0:
            avg_response_time = total_response_time / successful_writes
            print(f"Concurrent writes: {concurrent_requests}")
            print(f"Successful: {successful_writes}")
            print(f"Total time: {total_time:.2f}s")
            print(f"Average response time: {avg_response_time:.2f}s")
            
            # Write operations should complete reasonably fast
            assert avg_response_time < 2.0


class TestMemoryAndResourceUsage:
    """Test memory and resource usage patterns."""
    
    @pytest.mark.performance
    async def test_large_response_handling(self, client: AsyncClient, auth_headers, mock_auth):
        """Test handling of large response payloads."""
        # Request with large page size
        response = await client.get(
            "/api/leads",
            headers=auth_headers,
            params={"per_page": 100}
        )
        
        assert response.status_code in [200, 401, 403]
        
        if response.status_code == 200:
            data = response.json()
            # Should handle pagination properly
            assert "items" in data
            assert "total" in data
            assert "per_page" in data
            assert data["per_page"] <= 100
    
    @pytest.mark.performance
    async def test_webhook_processing_performance(self, client: AsyncClient, mock_celery):
        """Test webhook processing performance."""
        webhook_payload = {
            "Type": "Notification",
            "Message": '''{
                "eventType": "delivery",
                "mail": {
                    "messageId": "perf_test_msg_123",
                    "timestamp": "2024-01-15T10:30:00.000Z",
                    "destination": ["test@example.com"]
                },
                "delivery": {
                    "timestamp": "2024-01-15T10:30:05.000Z",
                    "recipients": ["test@example.com"]
                }
            }'''
        }
        
        start_time = time.time()
        
        response = await client.post("/api/webhooks/ses", json=webhook_payload)
        
        end_time = time.time()
        response_time = end_time - start_time
        
        assert response.status_code == 200
        # Webhook processing should be very fast
        assert response_time < 0.1
    
    @pytest.mark.performance
    async def test_authentication_performance(self, client: AsyncClient):
        """Test authentication performance."""
        login_data = {
            "email": "test@example.com",
            "password": "testpassword"
        }
        
        start_time = time.time()
        
        with patch('core.security.verify_password', return_value=True):
            with patch('core.security.create_access_token', return_value="test.jwt.token"):
                response = await client.post("/api/auth/login", json=login_data)
        
        end_time = time.time()
        response_time = end_time - start_time
        
        assert response.status_code in [200, 401]
        # Authentication should be fast
        assert response_time < 0.5


class TestScalabilityPatterns:
    """Test scalability patterns and bottlenecks."""
    
    @pytest.mark.performance
    async def test_rate_limiting_performance(self, client: AsyncClient, auth_headers, mock_redis):
        """Test rate limiting performance impact."""
        # Mock rate limit check to return quickly
        mock_redis.check_rate_limit.return_value = {
            "allowed": True,
            "current_usage": 1,
            "limit": 100,
            "reset_time": datetime.utcnow().isoformat(),
            "remaining": 99
        }
        
        start_time = time.time()
        
        response = await client.get("/api/campaigns", headers=auth_headers)
        
        end_time = time.time()
        response_time = end_time - start_time
        
        assert response.status_code in [200, 401, 403]
        # Rate limiting should add minimal overhead
        assert response_time < 0.6  # Allowing for network/processing time
    
    @pytest.mark.performance
    async def test_database_query_performance(self, client: AsyncClient, auth_headers, mock_auth):
        """Test database query performance patterns."""
        # Test pagination performance
        pages_to_test = 3
        page_times = []
        
        for page in range(1, pages_to_test + 1):
            start_time = time.time()
            
            response = await client.get(
                "/api/leads",
                headers=auth_headers,
                params={"page": page, "per_page": 20}
            )
            
            end_time = time.time()
            response_time = end_time - start_time
            page_times.append(response_time)
            
            assert response.status_code in [200, 401, 403]
        
        if page_times:
            avg_page_time = sum(page_times) / len(page_times)
            print(f"Average page load time: {avg_page_time:.2f}s")
            
            # Pagination should have consistent performance
            assert avg_page_time < 1.0
            
            # Performance shouldn't degrade significantly across pages
            if len(page_times) > 1:
                time_variance = max(page_times) - min(page_times)
                assert time_variance < 1.0  # Less than 1 second variance


class TestCacheEffectiveness:
    """Test caching effectiveness and performance."""
    
    @pytest.mark.performance
    async def test_cache_hit_performance(self, client: AsyncClient, auth_headers, mock_redis, mock_auth):
        """Test performance improvement from cache hits."""
        # Mock cache hit
        mock_redis.get.return_value = '{"cached": "data"}'
        
        start_time = time.time()
        
        response = await client.get("/api/campaigns", headers=auth_headers)
        
        end_time = time.time()
        cached_response_time = end_time - start_time
        
        # Reset cache to miss
        mock_redis.get.return_value = None
        
        start_time = time.time()
        
        response = await client.get("/api/campaigns", headers=auth_headers)
        
        end_time = time.time()
        uncached_response_time = end_time - start_time
        
        assert response.status_code in [200, 401, 403]
        
        # Cache hits should be faster (if caching is implemented)
        print(f"Cached response time: {cached_response_time:.3f}s")
        print(f"Uncached response time: {uncached_response_time:.3f}s")
    
    @pytest.mark.performance
    async def test_cache_miss_fallback_performance(self, client: AsyncClient, auth_headers, mock_redis, mock_auth):
        """Test performance when cache is unavailable."""
        # Mock cache failure
        mock_redis.get.side_effect = Exception("Cache unavailable")
        
        start_time = time.time()
        
        response = await client.get("/api/campaigns", headers=auth_headers)
        
        end_time = time.time()
        response_time = end_time - start_time
        
        assert response.status_code in [200, 401, 403, 500]
        
        # Should gracefully handle cache failures without significant slowdown
        assert response_time < 2.0
        print(f"Cache failure fallback time: {response_time:.3f}s")


@pytest.fixture
def performance_benchmark():
    """Fixture to track performance benchmarks."""
    benchmarks = {}
    
    def record_benchmark(test_name: str, duration: float, threshold: float):
        benchmarks[test_name] = {
            "duration": duration,
            "threshold": threshold,
            "passed": duration <= threshold
        }
    
    yield record_benchmark
    
    # Print benchmark summary
    print("\n=== Performance Benchmark Summary ===")
    for test_name, result in benchmarks.items():
        status = "PASS" if result["passed"] else "FAIL"
        print(f"{test_name}: {result['duration']:.3f}s (threshold: {result['threshold']:.3f}s) [{status}]")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-m", "performance"])