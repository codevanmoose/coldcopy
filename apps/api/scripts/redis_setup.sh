#!/bin/bash

# Redis setup and configuration script for ColdCopy

set -e

echo "Setting up Redis for ColdCopy..."

# Check if Redis is installed
if ! command -v redis-server &> /dev/null; then
    echo "Redis is not installed. Installing Redis..."
    
    # Detect OS and install Redis
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Ubuntu/Debian
        if command -v apt-get &> /dev/null; then
            sudo apt-get update
            sudo apt-get install -y redis-server
        # CentOS/RHEL
        elif command -v yum &> /dev/null; then
            sudo yum install -y redis
        # Fedora
        elif command -v dnf &> /dev/null; then
            sudo dnf install -y redis
        else
            echo "Unsupported Linux distribution. Please install Redis manually."
            exit 1
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        if command -v brew &> /dev/null; then
            brew install redis
        else
            echo "Homebrew not found. Please install Redis manually."
            exit 1
        fi
    else
        echo "Unsupported operating system. Please install Redis manually."
        exit 1
    fi
else
    echo "Redis is already installed."
fi

# Create Redis configuration directory
sudo mkdir -p /etc/redis
sudo mkdir -p /var/log/redis
sudo mkdir -p /var/lib/redis

# Create Redis configuration file for ColdCopy
cat > /tmp/coldcopy-redis.conf << 'EOF'
# Redis configuration for ColdCopy

# Network
bind 127.0.0.1
port 6379
timeout 300
tcp-keepalive 300

# General
daemonize yes
pidfile /var/run/redis/redis-server.pid
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
# slave-serve-stale-data yes
# slave-read-only yes

# Security
# requirepass your_secure_password_here

# Limits
maxclients 10000
maxmemory 2gb
maxmemory-policy allkeys-lru

# Append only file
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
notify-keyspace-events "Ex"

# Advanced config
hash-max-ziplist-entries 512
hash-max-ziplist-value 64
list-max-ziplist-entries 512
list-max-ziplist-value 64
set-max-intset-entries 512
zset-max-ziplist-entries 128
zset-max-ziplist-value 64
activerehashing yes

# Client output buffer limits
client-output-buffer-limit normal 0 0 0
client-output-buffer-limit slave 256mb 64mb 60
client-output-buffer-limit pubsub 32mb 8mb 60

# Performance tuning for ColdCopy workloads
hz 10
EOF

# Move configuration file
sudo mv /tmp/coldcopy-redis.conf /etc/redis/redis.conf

# Create Redis user and set permissions
if ! id "redis" &>/dev/null; then
    sudo useradd --system --home /var/lib/redis --shell /bin/false redis
fi

sudo chown redis:redis /var/lib/redis
sudo chown redis:redis /var/log/redis
sudo chmod 750 /var/lib/redis
sudo chmod 750 /var/log/redis

# Create systemd service file
cat > /tmp/redis.service << 'EOF'
[Unit]
Description=Advanced key-value store for ColdCopy
After=network.target
Documentation=http://redis.io/documentation, man:redis-server(1)

[Service]
Type=forking
ExecStart=/usr/bin/redis-server /etc/redis/redis.conf
ExecReload=/bin/kill -USR2 $MAINPID
ExecStop=/usr/bin/redis-cli shutdown
TimeoutStopSec=0
Restart=always
User=redis
Group=redis
RuntimeDirectory=redis
RuntimeDirectoryMode=0755

[Install]
WantedBy=multi-user.target
EOF

sudo mv /tmp/redis.service /etc/systemd/system/redis.service

# Reload systemd and enable Redis
sudo systemctl daemon-reload
sudo systemctl enable redis
sudo systemctl start redis

# Test Redis connection
echo "Testing Redis connection..."
if redis-cli ping | grep -q "PONG"; then
    echo "✓ Redis is running and responding to commands"
else
    echo "✗ Redis is not responding"
    exit 1
fi

# Create Redis monitoring script
cat > /tmp/redis-monitor.sh << 'EOF'
#!/bin/bash

# Redis monitoring script for ColdCopy

echo "=== Redis Status ==="
systemctl status redis --no-pager

echo ""
echo "=== Redis Info ==="
redis-cli info | grep -E "redis_version|uptime_in_seconds|connected_clients|used_memory_human|keyspace_hits|keyspace_misses"

echo ""
echo "=== Memory Usage ==="
redis-cli info memory | grep -E "used_memory_human|used_memory_peak_human|mem_fragmentation_ratio"

echo ""
echo "=== Keyspace ==="
redis-cli info keyspace

echo ""
echo "=== Slow Log ==="
redis-cli slowlog get 5

echo ""
echo "=== Client List ==="
redis-cli client list | head -10
EOF

sudo mv /tmp/redis-monitor.sh /usr/local/bin/redis-monitor
sudo chmod +x /usr/local/bin/redis-monitor

# Create Redis backup script
cat > /tmp/redis-backup.sh << 'EOF'
#!/bin/bash

# Redis backup script for ColdCopy

BACKUP_DIR="/var/backups/redis"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/redis_backup_$DATE.rdb"

# Create backup directory
mkdir -p $BACKUP_DIR

# Create backup
echo "Creating Redis backup..."
redis-cli --rdb $BACKUP_FILE

# Compress backup
gzip $BACKUP_FILE

echo "Backup created: ${BACKUP_FILE}.gz"

# Clean up old backups (keep last 7 days)
find $BACKUP_DIR -name "redis_backup_*.rdb.gz" -mtime +7 -delete

echo "Old backups cleaned up"
EOF

sudo mv /tmp/redis-backup.sh /usr/local/bin/redis-backup
sudo chmod +x /usr/local/bin/redis-backup

# Create logrotate configuration
cat > /tmp/redis-logrotate << 'EOF'
/var/log/redis/*.log {
    weekly
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 640 redis redis
    postrotate
        systemctl reload redis > /dev/null 2>&1 || true
    endscript
}
EOF

sudo mv /tmp/redis-logrotate /etc/logrotate.d/redis

# Set up daily backup cron job
(crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/redis-backup") | sudo crontab -

# Create Redis CLI configuration for easier access
mkdir -p ~/.config/redis
cat > ~/.config/redis/redis-cli.conf << 'EOF'
# Redis CLI configuration for ColdCopy
127.0.0.1:6379
EOF

echo ""
echo "=== Redis Setup Complete ==="
echo "Redis server is running on 127.0.0.1:6379"
echo ""
echo "Useful commands:"
echo "  sudo systemctl status redis    - Check Redis status"
echo "  redis-monitor                  - Monitor Redis performance"
echo "  redis-backup                   - Create backup"
echo "  redis-cli                      - Access Redis CLI"
echo ""
echo "Configuration file: /etc/redis/redis.conf"
echo "Log file: /var/log/redis/redis-server.log"
echo "Data directory: /var/lib/redis"
echo ""
echo "Redis is ready for ColdCopy!"