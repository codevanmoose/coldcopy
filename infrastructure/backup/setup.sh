#!/bin/bash
# ColdCopy Backup System Setup Script

set -e

echo "=== ColdCopy Backup System Setup ==="
echo

# Check prerequisites
echo "Checking prerequisites..."

# Check for Docker
if ! command -v docker &> /dev/null; then
    echo "Error: Docker is not installed"
    exit 1
fi

# Check for Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo "Error: Docker Compose is not installed"
    exit 1
fi

# Check for required environment variables
required_vars=(
    "DB_HOST"
    "DB_NAME"
    "DB_USER"
    "DB_PASSWORD"
    "DO_SPACES_KEY"
    "DO_SPACES_SECRET"
    "DO_SPACES_BUCKET"
)

missing_vars=()
for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        missing_vars+=("$var")
    fi
done

if [ ${#missing_vars[@]} -ne 0 ]; then
    echo "Error: Missing required environment variables:"
    printf '%s\n' "${missing_vars[@]}"
    echo
    echo "Please set these variables in your .env file"
    exit 1
fi

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "Creating .env file from template..."
    cat > .env << EOF
# Database Configuration
DB_HOST=${DB_HOST}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME}
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}

# Digital Ocean Spaces
DO_SPACES_KEY=${DO_SPACES_KEY}
DO_SPACES_SECRET=${DO_SPACES_SECRET}
DO_SPACES_BUCKET=${DO_SPACES_BUCKET}
DO_SPACES_REGION=${DO_SPACES_REGION:-nyc3}
DO_SPACES_ENDPOINT=${DO_SPACES_ENDPOINT:-https://nyc3.digitaloceanspaces.com}

# Alert Configuration (Optional)
ALERT_EMAIL=${ALERT_EMAIL}
SMTP_HOST=${SMTP_HOST}
SMTP_USER=${SMTP_USER}
SMTP_PASSWORD=${SMTP_PASSWORD}

# Encryption (Recommended)
BACKUP_ENCRYPTION_KEY=${BACKUP_ENCRYPTION_KEY}
EOF
    echo ".env file created"
fi

# Create log directory
echo "Creating log directory..."
sudo mkdir -p /var/log/coldcopy
sudo chown -R $USER:$USER /var/log/coldcopy

# Build Docker images
echo "Building Docker images..."
docker-compose build

# Create Digital Ocean Spaces bucket if needed
echo "Checking Digital Ocean Spaces access..."
docker run --rm \
    -e AWS_ACCESS_KEY_ID="$DO_SPACES_KEY" \
    -e AWS_SECRET_ACCESS_KEY="$DO_SPACES_SECRET" \
    amazon/aws-cli s3 ls "s3://$DO_SPACES_BUCKET" \
    --endpoint-url="$DO_SPACES_ENDPOINT" || {
    echo "Creating bucket: $DO_SPACES_BUCKET"
    docker run --rm \
        -e AWS_ACCESS_KEY_ID="$DO_SPACES_KEY" \
        -e AWS_SECRET_ACCESS_KEY="$DO_SPACES_SECRET" \
        amazon/aws-cli s3 mb "s3://$DO_SPACES_BUCKET" \
        --endpoint-url="$DO_SPACES_ENDPOINT"
}

# Create bucket structure
echo "Setting up bucket structure..."
docker run --rm \
    -e AWS_ACCESS_KEY_ID="$DO_SPACES_KEY" \
    -e AWS_SECRET_ACCESS_KEY="$DO_SPACES_SECRET" \
    amazon/aws-cli s3api put-object \
    --bucket "$DO_SPACES_BUCKET" \
    --key "backups/" \
    --endpoint-url="$DO_SPACES_ENDPOINT"

docker run --rm \
    -e AWS_ACCESS_KEY_ID="$DO_SPACES_KEY" \
    -e AWS_SECRET_ACCESS_KEY="$DO_SPACES_SECRET" \
    amazon/aws-cli s3api put-object \
    --bucket "$DO_SPACES_BUCKET" \
    --key "backups/metadata/" \
    --endpoint-url="$DO_SPACES_ENDPOINT"

docker run --rm \
    -e AWS_ACCESS_KEY_ID="$DO_SPACES_KEY" \
    -e AWS_SECRET_ACCESS_KEY="$DO_SPACES_SECRET" \
    amazon/aws-cli s3api put-object \
    --bucket "$DO_SPACES_BUCKET" \
    --key "wal_archive/" \
    --endpoint-url="$DO_SPACES_ENDPOINT"

# Set bucket lifecycle policy for cost optimization
echo "Setting up lifecycle policies..."
cat > lifecycle.json << EOF
{
    "Rules": [
        {
            "ID": "Archive old backups",
            "Status": "Enabled",
            "Prefix": "backups/",
            "Transitions": [
                {
                    "Days": 7,
                    "StorageClass": "GLACIER"
                }
            ]
        },
        {
            "ID": "Delete old WAL files",
            "Status": "Enabled",
            "Prefix": "wal_archive/",
            "Expiration": {
                "Days": 30
            }
        }
    ]
}
EOF

docker run --rm \
    -v "$(pwd)/lifecycle.json:/lifecycle.json" \
    -e AWS_ACCESS_KEY_ID="$DO_SPACES_KEY" \
    -e AWS_SECRET_ACCESS_KEY="$DO_SPACES_SECRET" \
    amazon/aws-cli s3api put-bucket-lifecycle-configuration \
    --bucket "$DO_SPACES_BUCKET" \
    --lifecycle-configuration file:///lifecycle.json \
    --endpoint-url="$DO_SPACES_ENDPOINT" || true

rm -f lifecycle.json

# Start services
echo "Starting backup services..."
docker-compose up -d

# Wait for services to be ready
echo "Waiting for services to start..."
sleep 10

# Check service health
echo "Checking service health..."
curl -f http://localhost:8090/health || {
    echo "Error: Backup monitor service is not healthy"
    docker-compose logs
    exit 1
}

# Perform initial backup
echo "Performing initial backup..."
docker-compose exec backup-scheduler python backup_manager.py backup || {
    echo "Warning: Initial backup failed. Check logs for details."
}

# Setup cron job for system monitoring
echo "Setting up system monitoring..."
cat > /tmp/coldcopy-backup-monitor << EOF
#!/bin/bash
# Check if backup services are running
if ! docker-compose -f $(pwd)/docker-compose.yml ps | grep -q "Up"; then
    echo "ColdCopy backup services are down!" | mail -s "ColdCopy Backup Alert" ${ALERT_EMAIL:-root}
    docker-compose -f $(pwd)/docker-compose.yml up -d
fi
EOF

chmod +x /tmp/coldcopy-backup-monitor
sudo mv /tmp/coldcopy-backup-monitor /etc/cron.hourly/

echo
echo "=== Setup Complete ==="
echo
echo "Backup services are now running!"
echo "Monitor dashboard: http://localhost:8090"
echo "Prometheus metrics: http://localhost:8090/metrics"
echo
echo "Useful commands:"
echo "  View status:        docker-compose exec backup-scheduler python backup_manager.py status"
echo "  Manual backup:      docker-compose exec backup-scheduler python backup_manager.py backup"
echo "  List backups:       docker-compose exec backup-scheduler python restore_manager.py list-backups"
echo "  View logs:          docker-compose logs -f"
echo "  Stop services:      docker-compose down"
echo
echo "Next steps:"
echo "1. Configure PostgreSQL for WAL archiving (if you have superuser access)"
echo "2. Set up monitoring alerts in Prometheus/Grafana"
echo "3. Test restore procedure with: python restore_manager.py plan disaster"
echo "4. Schedule regular restore tests"