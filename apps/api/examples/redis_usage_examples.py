"""
Redis Usage Examples for ColdCopy

This file demonstrates how to use the Redis caching system in ColdCopy.
"""

import asyncio
import json
from datetime import datetime, timedelta
from typing import Dict, List, Any

from core.redis import (
    get_cache_manager,
    get_enrichment_cache,
    get_session_cache,
    get_rate_limit_cache,
    get_analytics_cache,
    get_deliverability_cache
)
from utils.cache_decorators import cache_result, cache_invalidate, memoize
from utils.redis_manager import get_redis_pool


async def basic_caching_example():
    """Example of basic caching operations."""
    print("=== Basic Caching Example ===")
    
    # Get cache manager
    cache = await get_cache_manager()
    
    # Store a simple value
    await cache.set("user:12345:profile", {
        "name": "John Doe",
        "email": "john@example.com",
        "last_seen": datetime.utcnow().isoformat()
    }, ttl_seconds=3600)
    
    # Retrieve the value
    profile = await cache.get("user:12345:profile")
    print(f"Retrieved profile: {profile}")
    
    # Check if key exists
    exists = await cache.exists("user:12345:profile")
    print(f"Profile exists: {exists}")
    
    # Set multiple values at once
    user_data = {
        "user:12345:preferences": {"theme": "dark", "notifications": True},
        "user:12345:stats": {"login_count": 42, "last_campaign": "campaign_123"}
    }
    await cache.set_many(user_data, ttl_seconds=1800)
    
    # Get multiple values at once
    retrieved_data = await cache.get_many(["user:12345:preferences", "user:12345:stats"])
    print(f"Retrieved multiple values: {retrieved_data}")
    
    # Increment a counter
    daily_logins = await cache.increment("user:12345:daily_logins:2024-01-15")
    print(f"Daily logins: {daily_logins}")
    
    # Clean up
    await cache.delete("user:12345:profile")
    print("✓ Basic caching example completed")


async def enrichment_caching_example():
    """Example of lead enrichment caching."""
    print("\n=== Enrichment Caching Example ===")
    
    enrichment_cache = await get_enrichment_cache()
    
    # Cache enrichment data for an email
    email = "jane.smith@example.com"
    enrichment_data = {
        "first_name": "Jane",
        "last_name": "Smith",
        "company": "Example Corp",
        "title": "VP of Sales",
        "linkedin": "https://linkedin.com/in/janesmith",
        "phone": "+1-555-987-6543",
        "location": "New York, NY",
        "industry": "Technology",
        "company_size": "51-200",
        "confidence_score": 0.95
    }
    
    await enrichment_cache.set_enrichment(email, enrichment_data)
    print(f"✓ Cached enrichment data for {email}")
    
    # Retrieve enrichment data
    cached_data = await enrichment_cache.get_enrichment(email)
    if cached_data:
        print(f"Retrieved enrichment: {cached_data['data']['first_name']} {cached_data['data']['last_name']}")
        print(f"Cached at: {cached_data['cached_at']}")
    
    # Cache company enrichment
    domain = "example.com"
    company_data = {
        "name": "Example Corp",
        "industry": "Technology",
        "size": "51-200",
        "founded": 2010,
        "headquarters": "San Francisco, CA",
        "website": "https://example.com",
        "description": "Leading technology company"
    }
    
    await enrichment_cache.set_company_enrichment(domain, company_data)
    print(f"✓ Cached company data for {domain}")
    
    # Retrieve company data
    company_info = await enrichment_cache.get_company_enrichment(domain)
    if company_info:
        print(f"Company: {company_info['name']} ({company_info['size']} employees)")
    
    print("✓ Enrichment caching example completed")


async def session_caching_example():
    """Example of session management with caching."""
    print("\n=== Session Caching Example ===")
    
    session_cache = await get_session_cache()
    
    # Store user session
    user_id = "user_12345"
    session_data = {
        "user_id": user_id,
        "workspace_id": "workspace_67890",
        "role": "admin",
        "permissions": ["campaigns:read", "campaigns:write", "analytics:read"],
        "login_time": datetime.utcnow().isoformat(),
        "ip_address": "192.168.1.100",
        "user_agent": "Mozilla/5.0 (Chrome/96.0)"
    }
    
    session_id = await session_cache.store_session(user_id, session_data)
    print(f"✓ Created session: {session_id}")
    
    # Retrieve session
    retrieved_session = await session_cache.get_session(session_id)
    if retrieved_session:
        print(f"Session user: {retrieved_session['user_id']}")
        print(f"Session role: {retrieved_session['role']}")
    
    # Store refresh token
    token_hash = "hashed_refresh_token_abc123"
    await session_cache.store_refresh_token(user_id, token_hash)
    print("✓ Stored refresh token")
    
    # Validate refresh token
    is_valid = await session_cache.validate_refresh_token(user_id, token_hash)
    print(f"Refresh token valid: {is_valid}")
    
    # Invalidate session
    await session_cache.invalidate_session(session_id)
    print("✓ Session invalidated")
    
    print("✓ Session caching example completed")


async def rate_limiting_example():
    """Example of rate limiting with Redis."""
    print("\n=== Rate Limiting Example ===")
    
    rate_cache = await get_rate_limit_cache()
    
    # Test rate limiting for a user
    user_identifier = "user:12345"
    
    print("Testing rate limit (5 requests per minute):")
    for i in range(7):  # Try 7 requests (2 should be denied)
        result = await rate_cache.check_rate_limit(
            identifier=user_identifier,
            limit=5,
            window_seconds=60,
            cost=1
        )
        
        if result["allowed"]:
            print(f"  Request {i+1}: ✓ Allowed (usage: {result['current_usage']}/{result['limit']})")
        else:
            print(f"  Request {i+1}: ✗ Denied (usage: {result['current_usage']}/{result['limit']})")
            print(f"    Retry after: {result['retry_after']} seconds")
    
    # Check current rate limit status
    status = await rate_cache.get_rate_limit_status(user_identifier, 5, 60)
    print(f"Current status: {status['current_usage']}/{status['limit']} (remaining: {status['remaining']})")
    
    print("✓ Rate limiting example completed")


async def analytics_caching_example():
    """Example of analytics data caching."""
    print("\n=== Analytics Caching Example ===")
    
    analytics_cache = await get_analytics_cache()
    
    workspace_id = "workspace_12345"
    
    # Cache some metrics
    metrics = {
        "emails_sent_today": 1247,
        "open_rate_7d": 23.5,
        "click_rate_7d": 4.2,
        "bounce_rate_7d": 2.1,
        "active_campaigns": 8
    }
    
    for metric_name, value in metrics.items():
        await analytics_cache.cache_metric(workspace_id, metric_name, value)
    
    print("✓ Cached metrics")
    
    # Retrieve metrics
    open_rate = await analytics_cache.get_metric(workspace_id, "open_rate_7d")
    print(f"Open rate (7d): {open_rate}%")
    
    # Cache a report
    report_data = {
        "report_type": "campaign_performance",
        "date_range": "2024-01-01 to 2024-01-15",
        "campaigns": [
            {
                "id": "campaign_123",
                "name": "Q1 Outreach",
                "emails_sent": 1500,
                "open_rate": 25.3,
                "click_rate": 5.1,
                "replies": 23
            },
            {
                "id": "campaign_456", 
                "name": "Product Launch",
                "emails_sent": 800,
                "open_rate": 22.1,
                "click_rate": 3.8,
                "replies": 12
            }
        ],
        "totals": {
            "emails_sent": 2300,
            "avg_open_rate": 23.7,
            "avg_click_rate": 4.45,
            "total_replies": 35
        },
        "generated_at": datetime.utcnow().isoformat()
    }
    
    await analytics_cache.cache_report(workspace_id, "campaign_performance", report_data)
    print("✓ Cached campaign performance report")
    
    # Retrieve report
    cached_report = await analytics_cache.get_report(workspace_id, "campaign_performance")
    if cached_report:
        print(f"Report campaigns: {len(cached_report['campaigns'])}")
        print(f"Total emails sent: {cached_report['totals']['emails_sent']}")
    
    print("✓ Analytics caching example completed")


async def deliverability_caching_example():
    """Example of email deliverability caching."""
    print("\n=== Deliverability Caching Example ===")
    
    deliverability_cache = await get_deliverability_cache()
    
    # Cache domain reputation
    domain = "example.com"
    reputation_data = {
        "domain": domain,
        "reputation_score": 85,
        "bounce_rate": 2.3,
        "complaint_rate": 0.05,
        "delivery_rate": 97.2,
        "blacklist_status": "clean",
        "last_checked": datetime.utcnow().isoformat(),
        "status": "good",
        "recommendations": [
            "Monitor bounce rate",
            "Maintain current sending practices"
        ]
    }
    
    await deliverability_cache.cache_domain_reputation(domain, reputation_data)
    print(f"✓ Cached reputation for {domain}")
    
    # Retrieve reputation
    cached_reputation = await deliverability_cache.get_domain_reputation(domain)
    if cached_reputation:
        print(f"Reputation score: {cached_reputation['reputation_score']}")
        print(f"Status: {cached_reputation['status']}")
    
    # Cache MX records
    mx_records = [
        "10 mx1.example.com",
        "20 mx2.example.com",
        "30 mx3.example.com"
    ]
    
    await deliverability_cache.cache_mx_records(domain, mx_records)
    print(f"✓ Cached MX records for {domain}")
    
    # Retrieve MX records
    cached_mx = await deliverability_cache.get_mx_records(domain)
    if cached_mx:
        print(f"MX records: {', '.join(cached_mx)}")
    
    print("✓ Deliverability caching example completed")


@cache_result(ttl_seconds=300, key_prefix="expensive_calculation")
async def expensive_calculation(user_id: str, workspace_id: str, calculation_type: str) -> Dict[str, Any]:
    """Example of using cache decorator for expensive operations."""
    print(f"Performing expensive calculation for user {user_id}...")
    
    # Simulate expensive operation
    await asyncio.sleep(0.1)
    
    result = {
        "user_id": user_id,
        "workspace_id": workspace_id,
        "calculation_type": calculation_type,
        "result": 42,
        "computed_at": datetime.utcnow().isoformat()
    }
    
    return result


@cache_invalidate(key_prefix="expensive_calculation", include_user=True, include_workspace=True)
async def update_user_data(user_id: str, workspace_id: str, new_data: Dict[str, Any]):
    """Example of cache invalidation decorator."""
    print(f"Updating data for user {user_id}, invalidating related caches...")
    # Simulate data update
    return {"status": "updated", "user_id": user_id}


async def cache_decorator_example():
    """Example of using cache decorators."""
    print("\n=== Cache Decorator Example ===")
    
    user_id = "user_12345"
    workspace_id = "workspace_67890"
    
    # First call - will compute and cache
    result1 = await expensive_calculation(user_id, workspace_id, "revenue_forecast")
    print(f"First call result: {result1['result']}")
    
    # Second call - should come from cache
    result2 = await expensive_calculation(user_id, workspace_id, "revenue_forecast")
    print(f"Second call result: {result2['result']} (from cache)")
    
    # Update data - will invalidate cache
    await update_user_data(user_id, workspace_id, {"new_field": "value"})
    
    # Third call - will recompute since cache was invalidated
    result3 = await expensive_calculation(user_id, workspace_id, "revenue_forecast")
    print(f"Third call result: {result3['result']} (recomputed)")
    
    print("✓ Cache decorator example completed")


@memoize(ttl_seconds=60, max_size=100)
async def memoized_function(param1: str, param2: int) -> str:
    """Example of in-memory memoization."""
    print(f"Computing memoized function for {param1}, {param2}")
    await asyncio.sleep(0.05)  # Simulate work
    return f"result_{param1}_{param2}"


async def memoization_example():
    """Example of in-memory memoization."""
    print("\n=== Memoization Example ===")
    
    # First call - will compute
    result1 = await memoized_function("test", 123)
    print(f"First call: {result1}")
    
    # Second call - from memory cache
    result2 = await memoized_function("test", 123)
    print(f"Second call: {result2} (from memory)")
    
    # Different parameters - will compute
    result3 = await memoized_function("other", 456)
    print(f"Different params: {result3}")
    
    # Check cache info
    cache_info = memoized_function.cache_info()
    print(f"Cache info: {cache_info}")
    
    print("✓ Memoization example completed")


async def pipeline_example():
    """Example of using Redis pipeline for bulk operations."""
    print("\n=== Pipeline Example ===")
    
    redis = await get_redis_pool("cache")
    
    # Prepare data for bulk insert
    user_sessions = {}
    for i in range(100):
        user_sessions[f"session:bulk:{i}"] = json.dumps({
            "user_id": f"user_{i}",
            "created_at": datetime.utcnow().isoformat(),
            "expires_at": (datetime.utcnow() + timedelta(hours=1)).isoformat()
        })
    
    # Bulk insert using pipeline
    pipe = redis.pipeline()
    for key, value in user_sessions.items():
        pipe.setex(key, 3600, value)  # 1 hour TTL
    
    await pipe.execute()
    print("✓ Bulk inserted 100 sessions using pipeline")
    
    # Bulk retrieve using pipeline
    pipe = redis.pipeline()
    for key in user_sessions.keys():
        pipe.get(key)
    
    results = await pipe.execute()
    retrieved_count = sum(1 for result in results if result is not None)
    print(f"✓ Bulk retrieved {retrieved_count} sessions using pipeline")
    
    # Cleanup
    await redis.delete(*user_sessions.keys())
    print("✓ Pipeline example completed")


async def main():
    """Run all Redis usage examples."""
    print("ColdCopy Redis Usage Examples")
    print("=" * 50)
    
    try:
        await basic_caching_example()
        await enrichment_caching_example()
        await session_caching_example()
        await rate_limiting_example()
        await analytics_caching_example()
        await deliverability_caching_example()
        await cache_decorator_example()
        await memoization_example()
        await pipeline_example()
        
        print("\n" + "=" * 50)
        print("✅ All Redis examples completed successfully!")
        print("\nKey takeaways:")
        print("• Use specialized cache classes for different data types")
        print("• Leverage cache decorators for automatic caching")
        print("• Use pipelines for bulk operations")
        print("• Set appropriate TTL values for different data types")
        print("• Monitor cache hit ratios and performance")
        
    except Exception as e:
        print(f"❌ Error running examples: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())