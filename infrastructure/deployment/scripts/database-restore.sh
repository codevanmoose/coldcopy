#!/bin/bash
set -euo pipefail

# ColdCopy Database Restore Script
# Comprehensive database restoration with validation and recovery options

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Configuration
BACKUP_SOURCE=${1:-}
TARGET_ENV=${2:-staging}
RESTORE_OPTIONS=${3:-full}  # full, schema, data, specific-tables
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"
LOG_FILE="/tmp/coldcopy-db-restore-$(date +%Y%m%d-%H%M%S).log"

# Paths
BACKUP_DIR="/var/backups/coldcopy/database"
TEMP_DIR="/tmp/coldcopy-restore-$$"
ENCRYPTION_KEY_FILE="/etc/coldcopy/backup-encryption.key"

# Initialize log
echo "ColdCopy Database Restore - $(date)" > "$LOG_FILE"
echo "Source: $BACKUP_SOURCE" >> "$LOG_FILE"
echo "Target Environment: $TARGET_ENV" >> "$LOG_FILE"
echo "Options: $RESTORE_OPTIONS" >> "$LOG_FILE"
echo "========================================" >> "$LOG_FILE"

# Function to log messages
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Function to cleanup temp files
cleanup() {
    if [ -d "$TEMP_DIR" ]; then
        rm -rf "$TEMP_DIR"
    fi
}
trap cleanup EXIT

# Function to validate backup file
validate_backup_file() {
    local backup_file=$1
    
    echo -e "${YELLOW}Validating backup file...${NC}"
    
    # Check if file exists
    if [ ! -f "$backup_file" ]; then
        echo -e "${RED}Backup file not found: $backup_file${NC}"
        return 1
    fi
    
    # Check file extension
    if [[ ! "$backup_file" =~ \.(enc|gz|sql)$ ]]; then
        echo -e "${RED}Invalid backup file format${NC}"
        return 1
    fi
    
    # Check metadata if exists
    if [ -f "${backup_file}.meta" ]; then
        echo -e "${GREEN}Found metadata file${NC}"
        cat "${backup_file}.meta" | jq '.' 2>/dev/null || echo "Invalid metadata format"
    fi
    
    echo -e "${GREEN}✅ Backup file validated${NC}"
    return 0
}

# Function to download backup from cloud
download_from_cloud() {
    local backup_identifier=$1
    local local_file="$TEMP_DIR/$(basename "$backup_identifier")"
    
    echo -e "${YELLOW}Downloading backup from cloud storage...${NC}"
    
    mkdir -p "$TEMP_DIR"
    
    # Download from Digital Ocean Spaces
    s3cmd get "s3://$SPACES_BUCKET/$backup_identifier" "$local_file" \
        --access_key="$DO_SPACES_ACCESS_KEY" \
        --secret_key="$DO_SPACES_SECRET_KEY" \
        --host="$DO_SPACES_ENDPOINT" \
        --host-bucket="%(bucket)s.$DO_SPACES_ENDPOINT" \
        --progress
    
    # Download metadata if exists
    s3cmd get "s3://$SPACES_BUCKET/${backup_identifier}.meta" "${local_file}.meta" \
        --access_key="$DO_SPACES_ACCESS_KEY" \
        --secret_key="$DO_SPACES_SECRET_KEY" \
        --host="$DO_SPACES_ENDPOINT" \
        --host-bucket="%(bucket)s.$DO_SPACES_ENDPOINT" 2>/dev/null || true
    
    echo -e "${GREEN}✅ Backup downloaded${NC}"
    echo "$local_file"
}

# Function to decrypt and decompress backup
prepare_backup() {
    local encrypted_file=$1
    local output_file="$TEMP_DIR/restore.sql"
    
    echo -e "${YELLOW}Preparing backup for restore...${NC}"
    
    mkdir -p "$TEMP_DIR"
    
    # Check encryption key
    if [ ! -f "$ENCRYPTION_KEY_FILE" ]; then
        echo -e "${RED}Encryption key not found: $ENCRYPTION_KEY_FILE${NC}"
        exit 1
    fi
    
    # Decrypt if encrypted
    if [[ "$encrypted_file" =~ \.enc$ ]]; then
        echo "Decrypting backup..."
        local decrypted_file="${encrypted_file%.enc}"
        openssl enc -aes-256-cbc -d -in "$encrypted_file" -out "$decrypted_file" -pass file:"$ENCRYPTION_KEY_FILE"
        encrypted_file="$decrypted_file"
    fi
    
    # Decompress if compressed
    if [[ "$encrypted_file" =~ \.gz$ ]]; then
        echo "Decompressing backup..."
        gunzip -c "$encrypted_file" > "$output_file"
    else
        cp "$encrypted_file" "$output_file"
    fi
    
    echo -e "${GREEN}✅ Backup prepared${NC}"
    echo "$output_file"
}

# Function to analyze backup contents
analyze_backup() {
    local sql_file=$1
    
    echo -e "${YELLOW}Analyzing backup contents...${NC}"
    
    # Get basic statistics
    local line_count=$(wc -l < "$sql_file")
    local size=$(du -h "$sql_file" | cut -f1)
    local table_count=$(grep -c "CREATE TABLE" "$sql_file" || echo 0)
    local index_count=$(grep -c "CREATE INDEX" "$sql_file" || echo 0)
    
    echo -e "File size: ${GREEN}$size${NC}"
    echo -e "Lines: ${GREEN}$line_count${NC}"
    echo -e "Tables: ${GREEN}$table_count${NC}"
    echo -e "Indexes: ${GREEN}$index_count${NC}"
    
    # Extract schema version if present
    local schema_version=$(grep -oP "INSERT INTO schema_migrations.*VALUES \('\K[^']*" "$sql_file" | tail -1 || echo "unknown")
    echo -e "Schema version: ${GREEN}$schema_version${NC}"
    
    # List tables
    echo -e "\n${YELLOW}Tables found in backup:${NC}"
    grep "CREATE TABLE" "$sql_file" | sed 's/CREATE TABLE//' | sed 's/IF NOT EXISTS//' | awk '{print $1}' | sort | uniq
}

# Function to create restore point
create_restore_point() {
    local target_db=$1
    local restore_point_name="restore_point_$(date +%Y%m%d_%H%M%S)"
    
    echo -e "${YELLOW}Creating restore point...${NC}"
    
    # Create a quick backup of current state
    local backup_file="$BACKUP_DIR/restore-point-${restore_point_name}.sql.gz"
    mkdir -p "$BACKUP_DIR"
    
    pg_dump "$target_db" | gzip -9 > "$backup_file"
    
    echo -e "${GREEN}✅ Restore point created: $backup_file${NC}"
    echo "$backup_file"
}

# Function to restore full database
restore_full_database() {
    local sql_file=$1
    local target_db=$2
    
    echo -e "${YELLOW}Performing full database restore...${NC}"
    
    # Drop and recreate database (optional, based on backup type)
    if grep -q "CREATE DATABASE" "$sql_file"; then
        echo "Backup contains database creation statements"
    fi
    
    # Restore database
    if psql "$target_db" < "$sql_file" 2>&1 | tee -a "$LOG_FILE"; then
        echo -e "${GREEN}✅ Database restored successfully${NC}"
    else
        echo -e "${RED}❌ Restore encountered errors${NC}"
        return 1
    fi
    
    # Run ANALYZE to update statistics
    echo "Updating database statistics..."
    psql "$target_db" -c "ANALYZE;" 2>&1 | tee -a "$LOG_FILE"
}

# Function to restore schema only
restore_schema_only() {
    local sql_file=$1
    local target_db=$2
    
    echo -e "${YELLOW}Restoring schema only...${NC}"
    
    # Extract schema-related statements
    local schema_file="$TEMP_DIR/schema-only.sql"
    grep -E "^(CREATE|ALTER|DROP) (TABLE|INDEX|SEQUENCE|TYPE|FUNCTION|TRIGGER|VIEW)" "$sql_file" > "$schema_file"
    
    if psql "$target_db" < "$schema_file" 2>&1 | tee -a "$LOG_FILE"; then
        echo -e "${GREEN}✅ Schema restored successfully${NC}"
    else
        echo -e "${RED}❌ Schema restore encountered errors${NC}"
        return 1
    fi
}

# Function to restore specific tables
restore_specific_tables() {
    local sql_file=$1
    local target_db=$2
    local tables=$3
    
    echo -e "${YELLOW}Restoring specific tables: $tables${NC}"
    
    # Extract table-specific statements
    local filtered_file="$TEMP_DIR/filtered-tables.sql"
    
    # Create a script to extract specific tables
    for table in $(echo "$tables" | tr ',' ' '); do
        echo "Extracting table: $table"
        
        # Extract CREATE TABLE
        sed -n "/CREATE TABLE.*$table/,/;/p" "$sql_file" >> "$filtered_file"
        
        # Extract INSERT statements
        grep "^INSERT INTO $table" "$sql_file" >> "$filtered_file"
        
        # Extract related sequences, indexes, constraints
        grep -E "(CREATE|ALTER).*(SEQUENCE|INDEX|CONSTRAINT).*$table" "$sql_file" >> "$filtered_file"
    done
    
    if psql "$target_db" < "$filtered_file" 2>&1 | tee -a "$LOG_FILE"; then
        echo -e "${GREEN}✅ Tables restored successfully${NC}"
    else
        echo -e "${RED}❌ Table restore encountered errors${NC}"
        return 1
    fi
}

# Function to verify restore
verify_restore() {
    local target_db=$1
    
    echo -e "\n${YELLOW}Verifying restore...${NC}"
    
    # Check connection
    if ! psql "$target_db" -c "SELECT 1" >/dev/null 2>&1; then
        echo -e "${RED}❌ Cannot connect to restored database${NC}"
        return 1
    fi
    
    # Check table counts
    local table_count=$(psql "$target_db" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'" | tr -d ' ')
    echo -e "Tables in database: ${GREEN}$table_count${NC}"
    
    # Check for critical tables
    critical_tables=("workspaces" "users" "leads" "campaigns" "email_events")
    for table in "${critical_tables[@]}"; do
        if psql "$target_db" -t -c "SELECT 1 FROM information_schema.tables WHERE table_name = '$table'" | grep -q 1; then
            row_count=$(psql "$target_db" -t -c "SELECT COUNT(*) FROM $table" | tr -d ' ')
            echo -e "✅ Table $table exists (${row_count} rows)"
        else
            echo -e "❌ Critical table missing: $table"
        fi
    done
    
    # Check schema version
    if psql "$target_db" -t -c "SELECT 1 FROM information_schema.tables WHERE table_name = 'schema_migrations'" | grep -q 1; then
        schema_version=$(psql "$target_db" -t -c "SELECT MAX(version) FROM schema_migrations" | tr -d ' ')
        echo -e "Schema version: ${GREEN}$schema_version${NC}"
    fi
    
    echo -e "${GREEN}✅ Restore verification completed${NC}"
}

# Function to show usage
show_usage() {
    echo -e "${BLUE}ColdCopy Database Restore Tool${NC}"
    echo -e "\nUsage: $0 [backup_source] [target_env] [options]"
    echo -e "\nBackup Sources:"
    echo -e "  - Local file path: /path/to/backup.sql.gz.enc"
    echo -e "  - Cloud path: database/production/2024/01/backup.sql.gz.enc"
    echo -e "  - Backup ID: coldcopy-production-full-20240101-120000"
    echo -e "\nTarget Environments:"
    echo -e "  ${YELLOW}development${NC} - Local development database"
    echo -e "  ${YELLOW}staging${NC}     - Staging database"
    echo -e "  ${YELLOW}production${NC}  - Production database (requires confirmation)"
    echo -e "\nRestore Options:"
    echo -e "  ${YELLOW}full${NC}              - Complete database restore (default)"
    echo -e "  ${YELLOW}schema${NC}            - Schema only (no data)"
    echo -e "  ${YELLOW}data${NC}              - Data only (schema must exist)"
    echo -e "  ${YELLOW}tables:t1,t2,t3${NC}   - Specific tables only"
    echo -e "\nExamples:"
    echo -e "  $0 /backups/backup.sql.gz.enc staging full"
    echo -e "  $0 database/production/2024/01/backup.enc development schema"
    echo -e "  $0 coldcopy-production-full-20240101 staging tables:users,leads"
}

# Main execution
if [ -z "$BACKUP_SOURCE" ]; then
    show_usage
    exit 0
fi

# Header
echo -e "${MAGENTA}🔄 ColdCopy Database Restore Manager${NC}"
echo -e "Source: ${YELLOW}$BACKUP_SOURCE${NC}"
echo -e "Target: ${YELLOW}$TARGET_ENV${NC}"
echo -e "Options: ${YELLOW}$RESTORE_OPTIONS${NC}"
echo -e "Log: ${YELLOW}$LOG_FILE${NC}\n"

# Load environment configuration
if [ -f "$ROOT_DIR/.env.$TARGET_ENV" ]; then
    source "$ROOT_DIR/.env.$TARGET_ENV"
else
    echo -e "${RED}Environment file not found: .env.$TARGET_ENV${NC}"
    exit 1
fi

# Determine backup file location
if [ -f "$BACKUP_SOURCE" ]; then
    # Local file
    backup_file="$BACKUP_SOURCE"
elif [[ "$BACKUP_SOURCE" =~ ^s3:// ]] || [[ "$BACKUP_SOURCE" =~ ^database/ ]]; then
    # Cloud storage
    backup_file=$(download_from_cloud "$BACKUP_SOURCE")
else
    # Search for backup by identifier
    backup_file=$(find "$BACKUP_DIR" -name "*${BACKUP_SOURCE}*" | head -1)
    if [ -z "$backup_file" ]; then
        echo -e "${RED}Backup not found: $BACKUP_SOURCE${NC}"
        exit 1
    fi
fi

# Validate backup file
validate_backup_file "$backup_file"

# Prepare backup for restore
sql_file=$(prepare_backup "$backup_file")

# Analyze backup
analyze_backup "$sql_file"

# Confirm restore for production
if [ "$TARGET_ENV" = "production" ]; then
    echo -e "\n${RED}⚠️  WARNING: You are about to restore to PRODUCTION!${NC}"
    echo -e "This will overwrite all data in the production database."
    read -p "Type 'RESTORE PRODUCTION' to confirm: " confirm
    if [ "$confirm" != "RESTORE PRODUCTION" ]; then
        echo "Restore cancelled."
        exit 0
    fi
else
    echo -e "\n${YELLOW}Ready to restore to $TARGET_ENV${NC}"
    read -p "Continue? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        echo "Restore cancelled."
        exit 0
    fi
fi

# Create restore point
restore_point=$(create_restore_point "$DATABASE_URL")

# Perform restore based on options
echo -e "\n${YELLOW}Starting restore process...${NC}"

case "$RESTORE_OPTIONS" in
    full)
        restore_full_database "$sql_file" "$DATABASE_URL"
        ;;
    schema)
        restore_schema_only "$sql_file" "$DATABASE_URL"
        ;;
    data)
        echo -e "${YELLOW}Data-only restore not yet implemented${NC}"
        exit 1
        ;;
    tables:*)
        tables="${RESTORE_OPTIONS#tables:}"
        restore_specific_tables "$sql_file" "$DATABASE_URL" "$tables"
        ;;
    *)
        echo -e "${RED}Unknown restore option: $RESTORE_OPTIONS${NC}"
        show_usage
        exit 1
        ;;
esac

# Verify restore
verify_restore "$DATABASE_URL"

# Post-restore tasks
echo -e "\n${YELLOW}Running post-restore tasks...${NC}"

# Update sequences
echo "Updating sequences..."
psql "$DATABASE_URL" <<EOF
DO \$\$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT schemaname, tablename, 
               schemaname||'.'||tablename AS full_table,
               schemaname||'.'||tablename||'_id_seq' AS seq_name
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename NOT LIKE '%_view'
    ) LOOP
        BEGIN
            EXECUTE format('SELECT setval(%L, COALESCE((SELECT MAX(id) FROM %I.%I), 1))',
                         r.seq_name, r.schemaname, r.tablename);
        EXCEPTION WHEN OTHERS THEN
            -- Sequence might not exist or table might not have id column
            NULL;
        END;
    END LOOP;
END\$\$;
EOF

# Clear caches if Redis is available
if command -v redis-cli >/dev/null 2>&1 && [ -n "${REDIS_URL:-}" ]; then
    echo "Clearing Redis cache..."
    redis-cli -u "$REDIS_URL" FLUSHDB
fi

# Summary
echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Database restore completed successfully!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "\nRestore point saved at: ${YELLOW}$restore_point${NC}"
echo -e "Log file: ${YELLOW}$LOG_FILE${NC}"
echo -e "\n${YELLOW}Next steps:${NC}"
echo -e "1. Verify application functionality"
echo -e "2. Run integration tests"
echo -e "3. Check for any data inconsistencies"
echo -e "4. Monitor application logs for errors"

# Cleanup is handled by trap