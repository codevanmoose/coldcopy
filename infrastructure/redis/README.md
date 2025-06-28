# ColdCopy Redis Cache Infrastructure

## Overview

ColdCopy uses Redis as a high-performance caching layer to reduce database load and improve response times. The implementation includes connection pooling, automatic compression, multi-layer caching, and comprehensive monitoring.

## Architecture

### Cache Layers
1. **In-Memory LRU Cache** - Ultra-fast access for hot data (1000 items, 1-minute TTL)
2. **Redis Cache** - Distributed cache for all application instances
3. **Database** - Persistent storage (Supabase PostgreSQL)

### Key Features
- ✅ Connection pooling with automatic retry
- ✅ Automatic compression for values > 1KB
- ✅ Namespace-based key organization
- ✅ TTL management with refresh on access
- ✅ Cache statistics and monitoring
- ✅ Decorator-based caching for methods
- ✅ Pattern-based cache invalidation

## Deployment Options

### Option 1: Digital Ocean Managed Redis (Recommended)

**Pros:**
- Fully managed service
- Automatic backups
- High availability
- Easy scaling
- Monitoring included

**Cons:**
- Higher cost ($15-100/month)
- Less configuration control

**Setup:**
```bash
# Create managed Redis database
doctl databases create coldcopy-redis \
  --engine redis \
  --version 7 \
  --size db-s-1vcpu-1gb \
  --region nyc1

# Get connection string
doctl databases connection coldcopy-redis --format URI
```

### Option 2: Self-Managed Redis on Droplet

**Pros:**
- Full control
- Lower cost ($6-20/month)
- Custom configuration

**Cons:**
- Manual management
- Need to handle backups
- Security configuration

**Setup:**
```bash
# Create droplet
doctl compute droplet create redis-server \
  --image ubuntu-22-04-x64 \
  --size s-1vcpu-1gb \
  --region nyc1 \
  --ssh-keys [your-key-id]
```

## Redis Configuration

### Production Configuration
```conf
# /etc/redis/redis.conf

# Network
bind 0.0.0.0
protected-mode yes
port 6379
tcp-backlog 511
timeout 0
tcp-keepalive 300

# General
daemonize yes
supervised systemd
pidfile /var/run/redis_6379.pid
loglevel notice
logfile /var/log/redis/redis-server.log
databases 16

# Snapshotting
save 900 1
save 300 10
save 60 10000
stop-writes-on-bgsave-error yes
rdbcompression yes
rdbchecksum yes
dbfilename dump.rdb
dir /var/lib/redis

# Replication
replica-read-only yes

# Security
requirepass your_secure_password_here

# Memory Management
maxmemory 512mb
maxmemory-policy allkeys-lru
maxmemory-samples 5

# Append Only Mode
appendonly yes
appendfilename "appendonly.aof"
appendfsync everysec
no-appendfsync-on-rewrite no
auto-aof-rewrite-percentage 100
auto-aof-rewrite-min-size 64mb

# Lua scripting
lua-time-limit 5000

# Slow log
slowlog-log-slower-than 10000
slowlog-max-len 128

# Event notification
notify-keyspace-events ""

# Advanced config
hash-max-ziplist-entries 512
hash-max-ziplist-value 64
list-max-ziplist-size -2
list-compress-depth 0
set-max-intset-entries 512
zset-max-ziplist-entries 128
zset-max-ziplist-value 64
hll-sparse-max-bytes 3000
stream-node-max-bytes 4096
stream-node-max-entries 100

# Active rehashing
activerehashing yes

# Client output buffer limits
client-output-buffer-limit normal 0 0 0
client-output-buffer-limit replica 256mb 64mb 60
client-output-buffer-limit pubsub 32mb 8mb 60

# Frequency
hz 10

# AOF rewrite
aof-rewrite-incremental-fsync yes

# RDB saves
rdb-save-incremental-fsync yes
```

### Development Configuration
```yaml
# docker-compose.yml
redis:
  image: redis:7-alpine
  ports:
    - "6379:6379"
  volumes:
    - redis_data:/data
  command: >
    redis-server
    --appendonly yes
    --maxmemory 256mb
    --maxmemory-policy allkeys-lru
```

## Cache Strategy

### What to Cache

1. **Always Cache:**
   - User profiles and workspace data (5-minute TTL)
   - Lead enrichment data (7-day TTL)
   - AI responses (24-hour TTL)
   - Campaign analytics (5-minute TTL)
   - Email templates (1-hour TTL)
   - Domain reputation scores (1-day TTL)

2. **Conditionally Cache:**
   - Search results (based on complexity)
   - Report data (if generation > 1 second)
   - API responses (for rate-limited endpoints)

3. **Never Cache:**
   - Payment/billing data
   - Authentication tokens
   - Real-time collaboration data
   - Webhook payloads
   - Audit logs

### Cache Keys Structure

```
Pattern: namespace:entity:id:attribute

Examples:
- user:123e4567-e89b-12d3-a456-426614174000
- workspace:123:members
- lead:456:enrichment
- campaign:789:performance
- analytics:workspace:123:daily
- ai:gpt4:prompt_hash_abc123
```

### TTL Strategy

| Data Type | TTL | Reasoning |
|-----------|-----|-----------|
| User profiles | 5 minutes | Frequently accessed, rarely changed |
| Workspace data | 5 minutes | Team shared data |
| Lead enrichment | 7 days | Expensive to fetch, stable data |
| AI responses | 24 hours | Expensive to generate |
| Campaign analytics | 5 minutes | Real-time importance |
| Email deliverability | 1 hour | Changes slowly |
| Search results | 1 minute | User expectations |
| Session data | 15 minutes | Security balance |

## Monitoring

### Key Metrics

1. **Performance Metrics:**
   - Hit rate (target: > 80%)
   - Response time (target: < 5ms)
   - Commands per second
   - Network throughput

2. **Resource Metrics:**
   - Memory usage (< 80% of max)
   - CPU usage (< 70%)
   - Connection count
   - Key count

3. **Health Metrics:**
   - Replication lag
   - Persistence status
   - Error rate
   - Slow queries

### Monitoring Setup

```bash
# Install Redis Exporter for Prometheus
docker run -d \
  --name redis_exporter \
  -p 9121:9121 \
  oliver006/redis_exporter \
  --redis.addr=redis://localhost:6379 \
  --redis.password=your_password
```

### Grafana Dashboard

Import dashboard ID: 763 (Redis Dashboard for Prometheus)

## Cache Warming

### Automated Warming Strategy

1. **Popular Data** - Most accessed items in last 24 hours
2. **Recent Data** - Items created/modified in last hour
3. **Predictive** - Based on access patterns
4. **Scheduled** - Time-based (e.g., before business hours)
5. **Priority** - High-value customer data

### Implementation

```typescript
// Cron job runs every 30 minutes
/api/cron/cache-warming

// Warms:
- Top 100 active leads
- Active campaign analytics  
- Popular workspace dashboards
- Recent AI responses
```

## Security

### Best Practices

1. **Network Security:**
   - Use private networking
   - Firewall rules (only allow app servers)
   - SSL/TLS for connections
   - VPC isolation

2. **Access Control:**
   - Strong passwords (32+ characters)
   - Different passwords per environment
   - Rename dangerous commands
   - Disable unused commands

3. **Data Protection:**
   - No sensitive data in cache
   - Encrypt data before caching
   - Regular security audits
   - Monitor for suspicious patterns

### Security Configuration

```bash
# Rename dangerous commands
rename-command FLUSHDB ""
rename-command FLUSHALL ""
rename-command KEYS ""
rename-command CONFIG ""

# Set ACL rules (Redis 6+)
ACL SETUSER app_user +@all -@dangerous ~* &* on >app_password
ACL SETUSER readonly_user +@read ~* on >readonly_password
```

## Backup Strategy

### For Managed Redis
- Automatic daily backups
- 7-day retention
- Point-in-time recovery

### For Self-Managed Redis

```bash
#!/bin/bash
# redis-backup.sh

BACKUP_DIR="/backup/redis"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REDIS_CLI="redis-cli -a $REDIS_PASSWORD"

# Create backup directory
mkdir -p $BACKUP_DIR

# Trigger background save
$REDIS_CLI BGSAVE

# Wait for save to complete
while [ $($REDIS_CLI LASTSAVE) -eq $($REDIS_CLI LASTSAVE) ]; do
  sleep 1
done

# Copy RDB file
cp /var/lib/redis/dump.rdb $BACKUP_DIR/dump_$TIMESTAMP.rdb

# Keep only last 7 days
find $BACKUP_DIR -name "dump_*.rdb" -mtime +7 -delete

# Upload to object storage (optional)
# aws s3 cp $BACKUP_DIR/dump_$TIMESTAMP.rdb s3://backups/redis/
```

## Troubleshooting

### Common Issues

1. **High Memory Usage**
   ```bash
   # Check memory info
   redis-cli INFO memory
   
   # Find large keys
   redis-cli --bigkeys
   
   # Clear specific pattern
   redis-cli --scan --pattern "temp:*" | xargs redis-cli DEL
   ```

2. **Slow Performance**
   ```bash
   # Check slow log
   redis-cli SLOWLOG GET 10
   
   # Monitor commands
   redis-cli MONITOR
   
   # Check client connections
   redis-cli CLIENT LIST
   ```

3. **Connection Issues**
   ```bash
   # Test connection
   redis-cli PING
   
   # Check max clients
   redis-cli CONFIG GET maxclients
   
   # Increase connection limit
   redis-cli CONFIG SET maxclients 10000
   ```

4. **Persistence Issues**
   ```bash
   # Check last save
   redis-cli LASTSAVE
   
   # Check AOF status
   redis-cli INFO persistence
   
   # Fix AOF file
   redis-check-aof --fix appendonly.aof
   ```

## Performance Optimization

### 1. Pipeline Commands
```typescript
// Instead of multiple round trips
await redis.set('key1', 'value1');
await redis.set('key2', 'value2');
await redis.set('key3', 'value3');

// Use pipeline
const pipeline = redis.pipeline();
pipeline.set('key1', 'value1');
pipeline.set('key2', 'value2');
pipeline.set('key3', 'value3');
await pipeline.exec();
```

### 2. Use Appropriate Data Structures
- Strings for simple key-value
- Hashes for objects
- Lists for queues
- Sets for unique collections
- Sorted sets for rankings

### 3. Avoid Large Keys
- Keep values < 1MB
- Split large objects
- Use compression
- Consider Redis Modules

### 4. Connection Pooling
```typescript
// Configure in ioredis
const redis = new Redis({
  host: 'localhost',
  port: 6379,
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  enableOfflineQueue: true,
});
```

## Cost Estimation

### Digital Ocean Managed Redis
| Size | Memory | Connections | Cost/Month |
|------|--------|-------------|------------|
| Basic | 1GB | 100 | $15 |
| Standard | 2GB | 200 | $30 |
| Premium | 4GB | 500 | $60 |
| Advanced | 8GB | 1000 | $120 |

### Self-Managed on Droplet
| Droplet | Memory | Cost/Month | With Backup |
|---------|--------|------------|-------------|
| s-1vcpu-1gb | 1GB | $6 | $7.20 |
| s-2vcpu-2gb | 2GB | $12 | $14.40 |
| s-2vcpu-4gb | 4GB | $24 | $28.80 |

## Next Steps

1. **Choose deployment option** (Managed vs Self-managed)
2. **Provision Redis instance**
3. **Configure security settings**
4. **Set up monitoring**
5. **Test cache implementation**
6. **Configure backup strategy**
7. **Document connection details**

## Resources

- [Redis Documentation](https://redis.io/documentation)
- [Digital Ocean Redis Guide](https://docs.digitalocean.com/products/databases/redis/)
- [Redis Best Practices](https://redis.io/docs/manual/patterns/)
- [ioredis Documentation](https://github.com/luin/ioredis)