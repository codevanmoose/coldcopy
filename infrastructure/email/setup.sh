#!/bin/bash
# ColdCopy Email Infrastructure Setup Script

set -e

echo "=== ColdCopy Email Infrastructure Setup ==="
echo

# Check for required tools
echo "Checking prerequisites..."
command -v docker >/dev/null 2>&1 || { echo "Docker is required but not installed. Aborting." >&2; exit 1; }
command -v docker-compose >/dev/null 2>&1 || { echo "Docker Compose is required but not installed. Aborting." >&2; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "Python 3 is required but not installed. Aborting." >&2; exit 1; }

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "Creating .env file from template..."
    cp .env.example .env
    echo "Please edit .env file with your configuration values"
    echo "Press enter when ready to continue..."
    read
fi

# Load environment variables
set -a
source .env
set +a

# Validate required environment variables
required_vars=(
    "AWS_ACCESS_KEY_ID"
    "AWS_SECRET_ACCESS_KEY"
    "DB_HOST"
    "DB_PASSWORD"
)

for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo "Error: $var is not set in .env file"
        exit 1
    fi
done

# Install Python dependencies locally for initialization
echo "Installing Python dependencies..."
pip3 install -r requirements.txt

# Initialize SES
echo "Initializing Amazon SES..."
python3 init_ses.py init

# Create database tables
echo "Creating database tables..."
cat > create_tables.sql << 'EOF'
-- Email events table (partitioned by month)
CREATE TABLE IF NOT EXISTS email_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,
    email VARCHAR(255) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    message_id VARCHAR(255),
    workspace_id UUID,
    campaign_id UUID,
    lead_id UUID,
    bounce_type VARCHAR(50),
    bounce_subtype VARCHAR(50),
    complaint_type VARCHAR(50),
    feedback_id VARCHAR(255),
    reason TEXT,
    user_agent TEXT,
    ip_address INET,
    link TEXT,
    raw_event JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
) PARTITION BY RANGE (timestamp);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_email_events_email ON email_events(email);
CREATE INDEX IF NOT EXISTS idx_email_events_workspace ON email_events(workspace_id);
CREATE INDEX IF NOT EXISTS idx_email_events_campaign ON email_events(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_events_type_timestamp ON email_events(event_type, timestamp);

-- Create initial partitions
DO $$
DECLARE
    start_date DATE := DATE_TRUNC('month', CURRENT_DATE);
    partition_name TEXT;
BEGIN
    FOR i IN 0..2 LOOP
        partition_name := 'email_events_' || TO_CHAR(start_date + (i || ' months')::INTERVAL, 'YYYY_MM');
        
        IF NOT EXISTS (
            SELECT 1 FROM pg_tables 
            WHERE tablename = partition_name
        ) THEN
            EXECUTE format('CREATE TABLE %I PARTITION OF email_events FOR VALUES FROM (%L) TO (%L)',
                partition_name,
                start_date + (i || ' months')::INTERVAL,
                start_date + ((i + 1) || ' months')::INTERVAL
            );
        END IF;
    END LOOP;
END $$;

-- Lead engagement tracking
CREATE TABLE IF NOT EXISTS lead_engagement (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    lead_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB,
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_lead_engagement_lead ON lead_engagement(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_engagement_timestamp ON lead_engagement(timestamp);

-- Add email status columns to leads table if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'leads' AND column_name = 'email_status') THEN
        ALTER TABLE leads ADD COLUMN email_status VARCHAR(50) DEFAULT 'active';
        ALTER TABLE leads ADD COLUMN email_status_reason TEXT;
        ALTER TABLE leads ADD COLUMN email_status_updated_at TIMESTAMPTZ;
        ALTER TABLE leads ADD COLUMN last_engagement TIMESTAMPTZ;
        ALTER TABLE leads ADD COLUMN engagement_score INTEGER DEFAULT 0;
    END IF;
END $$;
EOF

# Execute SQL
echo "Executing database migrations..."
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p ${DB_PORT:-5432} -U $DB_USER -d $DB_NAME -f create_tables.sql

# Build Docker images
echo "Building Docker images..."
docker-compose build

# Start services
echo "Starting email services..."
docker-compose up -d

# Wait for services to be ready
echo "Waiting for services to start..."
sleep 10

# Check service health
echo "Checking service health..."
services=("reputation-monitor:8091" "event-processor:8092")

for service in "${services[@]}"; do
    IFS=':' read -r name port <<< "$service"
    if curl -f "http://localhost:$port/health" >/dev/null 2>&1; then
        echo "✅ $name is healthy"
    else
        echo "❌ $name is not responding"
    fi
done

# Display service URLs
echo
echo "=== Email Infrastructure is Ready! ==="
echo
echo "Service URLs:"
echo "  Reputation Dashboard: http://localhost:8091"
echo "  Event Processor API: http://localhost:8092"
echo "  Redis: redis://localhost:6379"
echo
echo "Webhook URL for SES:"
echo "  https://your-domain.com/webhooks/ses"
echo
echo "Next steps:"
echo "1. Configure DNS records shown above"
echo "2. Update SES webhook URL in AWS console"
echo "3. Test email sending with: python test_email.py"
echo "4. Monitor services with: docker-compose logs -f"
echo
echo "To stop services: docker-compose down"
echo "To view logs: docker-compose logs [service-name]"

# Cleanup
rm -f create_tables.sql