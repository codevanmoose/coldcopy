#!/bin/bash
# PgBouncer setup script for ColdCopy

set -e

echo "Setting up PgBouncer for ColdCopy..."

# Function to generate MD5 password
generate_md5_password() {
    local user=$1
    local password=$2
    echo -n "md5$(echo -n "$password$user" | md5sum | cut -d' ' -f1)"
}

# Check if required environment variables are set
required_vars=("DB_HOST" "DB_PORT" "DB_NAME" "DB_USER" "DB_PASSWORD" "PGBOUNCER_ADMIN_PASSWORD" "PGBOUNCER_STATS_PASSWORD")
for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo "Error: $var is not set"
        exit 1
    fi
done

# Create directories
mkdir -p /etc/pgbouncer
mkdir -p /var/log/pgbouncer
mkdir -p /var/run/pgbouncer

# Generate userlist.txt with proper MD5 passwords
cat > /etc/pgbouncer/userlist.txt <<EOF
;; PgBouncer user authentication file
;; Generated on $(date)

;; Application users
"app_user" "$(generate_md5_password "app_user" "$DB_PASSWORD")" ""
"analytics_user" "$(generate_md5_password "analytics_user" "$DB_PASSWORD")" ""
"job_runner" "$(generate_md5_password "job_runner" "$DB_PASSWORD")" ""

;; Admin users
"postgres" "$(generate_md5_password "postgres" "$DB_PASSWORD")" ""
"admin" "$(generate_md5_password "admin" "$PGBOUNCER_ADMIN_PASSWORD")" ""

;; Monitoring users
"stats" "$(generate_md5_password "stats" "$PGBOUNCER_STATS_PASSWORD")" "stats"
"monitoring" "$(generate_md5_password "monitoring" "$PGBOUNCER_STATS_PASSWORD")" "stats"

;; Read-only user
"readonly_user" "$(generate_md5_password "readonly_user" "$DB_PASSWORD")" ""
EOF

# Set permissions
chmod 600 /etc/pgbouncer/userlist.txt
chown postgres:postgres /etc/pgbouncer/userlist.txt

# Update pgbouncer.ini with actual database connection details
sed -i "s/supabase-db.example.com/$DB_HOST/g" /etc/pgbouncer/pgbouncer.ini
sed -i "s/SUPABASE_PASSWORD/$DB_PASSWORD/g" /etc/pgbouncer/pgbouncer.ini
sed -i "s/5432/$DB_PORT/g" /etc/pgbouncer/pgbouncer.ini
sed -i "s/dbname=postgres/dbname=$DB_NAME/g" /etc/pgbouncer/pgbouncer.ini

# Create systemd service file
cat > /etc/systemd/system/pgbouncer.service <<EOF
[Unit]
Description=PgBouncer connection pooler
After=network.target

[Service]
Type=notify
User=postgres
Group=postgres
ExecStart=/usr/bin/pgbouncer /etc/pgbouncer/pgbouncer.ini
ExecReload=/bin/kill -HUP \$MAINPID
KillSignal=SIGINT
Restart=on-failure
RestartSec=10s

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/log/pgbouncer /var/run/pgbouncer

[Install]
WantedBy=multi-user.target
EOF

# Create log rotation configuration
cat > /etc/logrotate.d/pgbouncer <<EOF
/var/log/pgbouncer/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 0640 postgres postgres
    sharedscripts
    postrotate
        /bin/kill -USR2 \$(cat /var/run/pgbouncer/pgbouncer.pid 2>/dev/null) 2>/dev/null || true
    endscript
}
EOF

# Enable and start PgBouncer
systemctl daemon-reload
systemctl enable pgbouncer
systemctl start pgbouncer

# Test connection
echo "Testing PgBouncer connection..."
export PGPASSWORD=$PGBOUNCER_STATS_PASSWORD
if psql -h localhost -p 6432 -U stats -d pgbouncer -c "SHOW POOLS;" > /dev/null 2>&1; then
    echo "✓ PgBouncer is running and accepting connections"
else
    echo "✗ Failed to connect to PgBouncer"
    exit 1
fi

# Create monitoring script
cat > /usr/local/bin/pgbouncer-health.sh <<'EOF'
#!/bin/bash
# PgBouncer health check script

PGPASSWORD=$PGBOUNCER_STATS_PASSWORD psql -h localhost -p 6432 -U stats -d pgbouncer -t -c "SHOW POOLS;" | grep -q "coldcopy_main"
if [ $? -eq 0 ]; then
    echo "OK - PgBouncer is healthy"
    exit 0
else
    echo "CRITICAL - PgBouncer pools not available"
    exit 2
fi
EOF

chmod +x /usr/local/bin/pgbouncer-health.sh

echo "PgBouncer setup completed successfully!"
echo ""
echo "Connection details:"
echo "  Host: localhost"
echo "  Port: 6432"
echo "  Databases:"
echo "    - coldcopy_main (transaction pooling)"
echo "    - coldcopy_analytics (session pooling)"
echo "    - coldcopy_jobs (transaction pooling)"
echo ""
echo "Admin interface:"
echo "  psql -h localhost -p 6432 -U admin -d pgbouncer"
echo ""
echo "Stats interface:"
echo "  psql -h localhost -p 6432 -U stats -d pgbouncer"