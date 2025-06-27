# Redis Caching Layer Documentation

## Overview

ColdCopy uses Redis as a high-performance caching layer to reduce database load, improve response times, and optimize costs for external API calls (AI providers, enrichment services).

## Architecture

### Cache Namespaces

We use namespaced caching to organize different types of cached data:

- `lead_enrichment` - Lead enrichment data from providers (7-day TTL)
- `ai_responses` - AI-generated content (24-hour TTL)
- `analytics` - Campaign and workspace analytics (5-minute TTL)
- `workspace_settings` - Workspace configurations (1-hour TTL)
- `api_responses` - General API response caching (5-minute TTL)
- `email_templates` - Email template cache (1-hour TTL)
- `campaign_stats` - Campaign statistics (5-minute TTL)
- `feature_flags` - Feature toggles (1-hour TTL)
- `rate_limits` - Rate limiting counters (dynamic TTL)

### Key Structure

Cache keys follow a consistent pattern:
```
{prefix}:{namespace}:v{version}:{key}
```

Example:
```
coldcopy:lead_enrichment:v1:workspace_123:lead_456
```

## Implementation

### Core Components

1. **CacheManager** (`utils/cache_manager.py`)
   - Central cache management with namespace support
   - Automatic serialization/compression
   - Version management for cache invalidation
   - Statistics tracking

2. **Specialized Caches**
   - `LeadEnrichmentCache` - Optimized for enrichment data
   - `AIResponseCache` - AI response caching with prompt hashing
   - `AnalyticsCache` - Short-lived analytics data

3. **Cache Middleware** (`middleware/cache_middleware.py`)
   - Automatic HTTP response caching
   - Cache-Control header support
   - Workspace-aware caching

4. **Cached Services**
   - `CachedAIService` - AI responses with cost optimization
   - `CachedEnrichmentService` - Lead enrichment with provider fallback

## Usage Examples

### Basic Cache Operations

```python
from utils.cache_manager import get_cache, CacheNamespace

# Get cache instance
cache = await get_cache()

# Set value with TTL
await cache.set(
    key="user:123:profile",
    value={"name": "John", "email": "john@example.com"},
    ttl=3600,  # 1 hour
    namespace=CacheNamespace.API_RESPONSES
)

# Get value
profile = await cache.get(
    key="user:123:profile",
    namespace=CacheNamespace.API_RESPONSES
)

# Delete value
await cache.delete(
    key="user:123:profile",
    namespace=CacheNamespace.API_RESPONSES
)
```

### Using Cache Decorators

```python
from utils.cache_manager import get_cache, CacheNamespace

cache = await get_cache()

@cache.cached(
    namespace=CacheNamespace.ANALYTICS,
    ttl=300,  # 5 minutes
    key_func=lambda campaign_id, workspace_id: f"{workspace_id}:{campaign_id}"
)
async def get_campaign_analytics(campaign_id: str, workspace_id: str):
    # Expensive analytics calculation
    return calculate_analytics(campaign_id)
```

### Endpoint Caching

```python
from middleware.cache_middleware import cache_endpoint

@router.get("/campaigns/{campaign_id}/stats")
@cache_endpoint(ttl=300)  # Cache for 5 minutes
async def get_campaign_stats(campaign_id: str):
    return await fetch_campaign_stats(campaign_id)
```

### Cache Invalidation

```python
from middleware.cache_middleware import invalidate_cache

@router.post("/campaigns/{campaign_id}")
@invalidate_cache(pattern="{workspace_id}:campaigns:*")
async def update_campaign(campaign_id: str, workspace_id: str):
    # Update campaign - will invalidate related caches
    return await update_campaign_in_db(campaign_id)
```

## Configuration

### Environment Variables

```env
# Redis connection
REDIS_URL=redis://localhost:6379/0
REDIS_PASSWORD=your_password

# Connection pool
REDIS_MAX_CONNECTIONS=100
REDIS_MIN_CONNECTIONS=10
REDIS_CONNECTION_TIMEOUT=20

# High availability (optional)
REDIS_USE_SENTINEL=false
REDIS_SENTINEL_HOSTS=sentinel1:26379,sentinel2:26379
REDIS_SENTINEL_MASTER=mymaster

# SSL/TLS (optional)
REDIS_SSL_ENABLED=false
REDIS_SSL_CERTFILE=/path/to/cert.pem
REDIS_SSL_KEYFILE=/path/to/key.pem
REDIS_SSL_CA_CERTS=/path/to/ca.pem

# Cache settings
REDIS_CACHE_PREFIX=coldcopy
REDIS_DEFAULT_TTL=3600
REDIS_ENABLE_COMPRESSION=true
REDIS_COMPRESSION_THRESHOLD=1024
```

### Redis Configuration (redis.conf)

```conf
# Persistence
save 900 1
save 300 10
save 60 10000

# Memory management
maxmemory 2gb
maxmemory-policy allkeys-lru

# Performance
tcp-keepalive 60
timeout 300

# Security
requirepass your_strong_password
```

## Monitoring

### Cache Statistics

Access cache statistics via the API:

```bash
# Get overall stats
GET /api/cache/stats

# Get namespace-specific stats
GET /api/cache/stats?namespace=ai_responses

# Get workspace cache stats
GET /api/cache/workspace/{workspace_id}/stats
```

### Health Checks

```bash
# Check cache health
GET /api/cache/health
```

### Grafana Dashboard

We provide a Grafana dashboard for monitoring:
- Cache hit/miss rates
- Memory usage
- Operation latencies
- Error rates
- Top cached keys

## Performance Optimization

### 1. Compression

Large values (>1KB) are automatically compressed using zlib:

```python
await cache.set(
    key="large_data",
    value=large_object,
    compress=True  # Auto-enabled for large values
)
```

### 2. Batch Operations

Use pipelines for multiple operations:

```python
# Use cache manager's bulk methods
results = await enrichment_service.enrich_bulk(
    lead_ids=["lead1", "lead2", "lead3"],
    batch_size=10
)
```

### 3. Background Refresh

Cache supports automatic background refresh for expiring data:

```python
async def refresh_analytics():
    return await calculate_fresh_analytics()

analytics = await cache.get(
    key="analytics",
    refresh_callback=refresh_analytics
)
```

## Troubleshooting

### Common Issues

1. **High Memory Usage**
   - Check `maxmemory` setting
   - Review TTL values
   - Enable eviction policy

2. **Low Hit Rate**
   - Verify key generation logic
   - Check TTL values
   - Review cache warming strategy

3. **Connection Errors**
   - Check Redis server status
   - Verify network connectivity
   - Review connection pool settings

### Debug Mode

Enable cache debugging:

```python
import logging
logging.getLogger("utils.cache_manager").setLevel(logging.DEBUG)
```

## Best Practices

1. **Cache Key Design**
   - Include workspace_id for multi-tenancy
   - Use consistent naming patterns
   - Avoid overly long keys

2. **TTL Strategy**
   - Shorter TTL for frequently changing data
   - Longer TTL for expensive operations
   - Use sliding expiration where appropriate

3. **Cache Warming**
   - Pre-populate critical data on startup
   - Use background tasks for refresh
   - Implement gradual cache warming

4. **Error Handling**
   - Always handle cache failures gracefully
   - Fall back to database on cache miss
   - Log cache errors for monitoring

5. **Security**
   - Use strong Redis passwords
   - Enable SSL/TLS in production
   - Restrict Redis network access
   - Don't cache sensitive unencrypted data

## Testing

### Unit Tests

```python
# Test cache operations
async def test_cache_operations():
    cache = await get_cache()
    
    # Test set/get
    await cache.set("test", "value")
    assert await cache.get("test") == "value"
    
    # Test expiration
    await cache.set("expire", "value", ttl=1)
    await asyncio.sleep(2)
    assert await cache.get("expire") is None
```

### Integration Tests

```python
# Test with real Redis
async def test_redis_integration():
    service = CachedAIService(db_session)
    
    # First call - cache miss
    response1 = await service.generate("prompt")
    assert not response1.cached
    
    # Second call - cache hit
    response2 = await service.generate("prompt")
    assert response2.cached
```

## Maintenance

### Regular Tasks

1. **Monitor Memory Usage**
   ```bash
   redis-cli info memory
   ```

2. **Check Slow Queries**
   ```bash
   redis-cli slowlog get 10
   ```

3. **Analyze Key Patterns**
   ```bash
   redis-cli --scan --pattern "coldcopy:*" | head -20
   ```

4. **Backup Cache Data** (if persistence enabled)
   ```bash
   redis-cli bgsave
   ```

### Cache Cleanup

Remove old/unused keys:

```python
# Via API
POST /api/cache/clear?namespace=analytics

# Via script
async def cleanup_old_cache():
    cache = await get_cache()
    deleted = await cache.delete_pattern("*:old_*")
    print(f"Deleted {deleted} old keys")
```