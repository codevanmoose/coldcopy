#!/bin/bash
set -euo pipefail

# ColdCopy Database Backup Script
# Handles automated database backups with encryption and upload to cloud storage

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ACTION=${1:-backup}
ENVIRONMENT=${2:-production}
BACKUP_TYPE=${3:-full}  # full, incremental, schema-only
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"
LOG_FILE="/tmp/coldcopy-db-backup-$(date +%Y%m%d-%H%M%S).log"

# Backup configuration
BACKUP_DIR="/var/backups/coldcopy/database"
BACKUP_RETENTION_DAYS=30
BACKUP_RETENTION_MONTHS=12
SPACES_BUCKET="coldcopy-backups"
ENCRYPTION_KEY_FILE="/etc/coldcopy/backup-encryption.key"

# Database configuration (loaded from environment)
source "$ROOT_DIR/.env.$ENVIRONMENT" 2>/dev/null || true

# Initialize log
echo "ColdCopy Database Backup - $(date)" > "$LOG_FILE"
echo "Action: $ACTION" >> "$LOG_FILE"
echo "Environment: $ENVIRONMENT" >> "$LOG_FILE"
echo "Type: $BACKUP_TYPE" >> "$LOG_FILE"
echo "========================================" >> "$LOG_FILE"

# Function to log messages
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Function to create encryption key if it doesn't exist
ensure_encryption_key() {
    if [ ! -f "$ENCRYPTION_KEY_FILE" ]; then
        log "Creating encryption key..."
        mkdir -p "$(dirname "$ENCRYPTION_KEY_FILE")"
        openssl rand -base64 32 > "$ENCRYPTION_KEY_FILE"
        chmod 600 "$ENCRYPTION_KEY_FILE"
        log "Encryption key created"
    fi
}

# Function to get database size
get_database_size() {
    local size=$(psql "$DATABASE_URL" -t -c "SELECT pg_size_pretty(pg_database_size(current_database()))" 2>/dev/null | tr -d ' ')
    echo "$size"
}

# Function to perform full backup
perform_full_backup() {
    local timestamp=$(date +%Y%m%d-%H%M%S)
    local backup_name="coldcopy-${ENVIRONMENT}-full-${timestamp}"
    local backup_file="$BACKUP_DIR/${backup_name}.sql"
    local compressed_file="${backup_file}.gz"
    local encrypted_file="${compressed_file}.enc"
    
    echo -e "${YELLOW}Performing full database backup...${NC}"
    log "Backup name: $backup_name"
    
    # Create backup directory
    mkdir -p "$BACKUP_DIR"
    
    # Get database info
    db_size=$(get_database_size)
    log "Database size: $db_size"
    
    # Perform backup with progress
    echo -e "${YELLOW}Dumping database...${NC}"
    start_time=$(date +%s)
    
    pg_dump "$DATABASE_URL" \
        --verbose \
        --no-owner \
        --no-acl \
        --clean \
        --if-exists \
        --format=plain \
        --file="$backup_file" 2>&1 | \
        while read line; do
            echo "$line" >> "$LOG_FILE"
        done
    
    end_time=$(date +%s)
    duration=$((end_time - start_time))
    log "Database dump completed in ${duration} seconds"
    
    # Compress backup
    echo -e "${YELLOW}Compressing backup...${NC}"
    gzip -9 "$backup_file"
    compressed_size=$(du -h "$compressed_file" | cut -f1)
    log "Compressed size: $compressed_size"
    
    # Encrypt backup
    echo -e "${YELLOW}Encrypting backup...${NC}"
    ensure_encryption_key
    openssl enc -aes-256-cbc -salt -in "$compressed_file" -out "$encrypted_file" -pass file:"$ENCRYPTION_KEY_FILE"
    rm "$compressed_file"
    
    # Calculate checksums
    checksum=$(sha256sum "$encrypted_file" | cut -d' ' -f1)
    log "SHA256 checksum: $checksum"
    
    # Create metadata file
    cat > "${encrypted_file}.meta" <<EOF
{
    "backup_name": "$backup_name",
    "environment": "$ENVIRONMENT",
    "type": "full",
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "database_size": "$db_size",
    "compressed_size": "$compressed_size",
    "encrypted_size": "$(du -h "$encrypted_file" | cut -f1)",
    "checksum": "$checksum",
    "duration_seconds": $duration,
    "pg_version": "$(psql "$DATABASE_URL" -t -c 'SELECT version()' | head -1)",
    "schema_version": "$(psql "$DATABASE_URL" -t -c 'SELECT MAX(version) FROM schema_migrations' 2>/dev/null || echo 'unknown')"
}
EOF
    
    echo -e "${GREEN}✅ Backup created: $encrypted_file${NC}"
    echo "$encrypted_file"
}

# Function to perform incremental backup (using WAL archives)
perform_incremental_backup() {
    local timestamp=$(date +%Y%m%d-%H%M%S)
    local backup_name="coldcopy-${ENVIRONMENT}-incr-${timestamp}"
    local wal_dir="/var/lib/postgresql/wal_archive"
    local backup_file="$BACKUP_DIR/${backup_name}.tar"
    local encrypted_file="${backup_file}.gz.enc"
    
    echo -e "${YELLOW}Performing incremental backup (WAL archive)...${NC}"
    
    # Archive WAL files
    echo -e "${YELLOW}Archiving WAL files...${NC}"
    tar -cf "$backup_file" -C "$wal_dir" .
    
    # Compress and encrypt
    gzip -9 "$backup_file"
    ensure_encryption_key
    openssl enc -aes-256-cbc -salt -in "${backup_file}.gz" -out "$encrypted_file" -pass file:"$ENCRYPTION_KEY_FILE"
    rm "${backup_file}.gz"
    
    echo -e "${GREEN}✅ Incremental backup created: $encrypted_file${NC}"
    echo "$encrypted_file"
}

# Function to perform schema-only backup
perform_schema_backup() {
    local timestamp=$(date +%Y%m%d-%H%M%S)
    local backup_name="coldcopy-${ENVIRONMENT}-schema-${timestamp}"
    local backup_file="$BACKUP_DIR/${backup_name}.sql"
    
    echo -e "${YELLOW}Performing schema-only backup...${NC}"
    
    pg_dump "$DATABASE_URL" \
        --schema-only \
        --no-owner \
        --no-acl \
        --file="$backup_file"
    
    gzip -9 "$backup_file"
    
    echo -e "${GREEN}✅ Schema backup created: ${backup_file}.gz${NC}"
    echo "${backup_file}.gz"
}

# Function to upload backup to cloud storage
upload_backup() {
    local backup_file=$1
    local remote_path="database/${ENVIRONMENT}/$(date +%Y/%m)/$(basename "$backup_file")"
    
    echo -e "${YELLOW}Uploading backup to Digital Ocean Spaces...${NC}"
    
    # Upload backup file
    s3cmd put "$backup_file" "s3://$SPACES_BUCKET/$remote_path" \
        --access_key="$DO_SPACES_ACCESS_KEY" \
        --secret_key="$DO_SPACES_SECRET_KEY" \
        --host="$DO_SPACES_ENDPOINT" \
        --host-bucket="%(bucket)s.$DO_SPACES_ENDPOINT" \
        --progress
    
    # Upload metadata if exists
    if [ -f "${backup_file}.meta" ]; then
        s3cmd put "${backup_file}.meta" "s3://$SPACES_BUCKET/${remote_path}.meta" \
            --access_key="$DO_SPACES_ACCESS_KEY" \
            --secret_key="$DO_SPACES_SECRET_KEY" \
            --host="$DO_SPACES_ENDPOINT" \
            --host-bucket="%(bucket)s.$DO_SPACES_ENDPOINT"
    fi
    
    echo -e "${GREEN}✅ Backup uploaded to: s3://$SPACES_BUCKET/$remote_path${NC}"
}

# Function to clean old backups
cleanup_old_backups() {
    echo -e "${YELLOW}Cleaning up old backups...${NC}"
    
    # Clean local backups
    find "$BACKUP_DIR" -name "*.enc" -mtime +$BACKUP_RETENTION_DAYS -delete
    find "$BACKUP_DIR" -name "*.meta" -mtime +$BACKUP_RETENTION_DAYS -delete
    
    # Clean remote backups (keep monthly backups for longer)
    # This would require listing and filtering S3 objects
    log "Local cleanup completed"
}

# Function to verify backup
verify_backup() {
    local backup_file=$1
    
    echo -e "${YELLOW}Verifying backup integrity...${NC}"
    
    # Check file exists and has size
    if [ ! -f "$backup_file" ]; then
        log "ERROR: Backup file not found: $backup_file"
        return 1
    fi
    
    local size=$(du -h "$backup_file" | cut -f1)
    if [ "$size" = "0" ]; then
        log "ERROR: Backup file is empty"
        return 1
    fi
    
    # Verify encryption
    ensure_encryption_key
    if ! openssl enc -aes-256-cbc -d -in "$backup_file" -pass file:"$ENCRYPTION_KEY_FILE" | gzip -t 2>/dev/null; then
        log "ERROR: Backup verification failed - decryption or decompression error"
        return 1
    fi
    
    echo -e "${GREEN}✅ Backup verification passed${NC}"
    return 0
}

# Function to restore backup
restore_backup() {
    local backup_identifier=$1
    local target_db=${2:-$DATABASE_URL}
    
    echo -e "${YELLOW}🔄 Database Restore Process${NC}"
    echo -e "${RED}⚠️  WARNING: This will overwrite the target database!${NC}"
    
    # Find backup file
    local backup_file
    if [ -f "$backup_identifier" ]; then
        backup_file="$backup_identifier"
    else
        # Search for backup by name pattern
        backup_file=$(find "$BACKUP_DIR" -name "*${backup_identifier}*.enc" | head -1)
    fi
    
    if [ -z "$backup_file" ] || [ ! -f "$backup_file" ]; then
        echo -e "${RED}Backup file not found: $backup_identifier${NC}"
        exit 1
    fi
    
    echo -e "Backup file: ${YELLOW}$backup_file${NC}"
    echo -e "Target database: ${YELLOW}$target_db${NC}"
    
    read -p "Are you sure you want to restore? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        echo "Restore cancelled."
        exit 0
    fi
    
    # Create safety backup of current state
    echo -e "${YELLOW}Creating safety backup of current database...${NC}"
    safety_backup=$(perform_full_backup)
    echo -e "${GREEN}Safety backup created: $safety_backup${NC}"
    
    # Decrypt and decompress backup
    echo -e "${YELLOW}Decrypting and decompressing backup...${NC}"
    temp_file="/tmp/restore-$(date +%s).sql"
    ensure_encryption_key
    openssl enc -aes-256-cbc -d -in "$backup_file" -pass file:"$ENCRYPTION_KEY_FILE" | gunzip > "$temp_file"
    
    # Restore database
    echo -e "${YELLOW}Restoring database...${NC}"
    if psql "$target_db" < "$temp_file"; then
        echo -e "${GREEN}✅ Database restored successfully${NC}"
        rm "$temp_file"
    else
        echo -e "${RED}❌ Restore failed. Safety backup available at: $safety_backup${NC}"
        rm "$temp_file"
        exit 1
    fi
    
    # Run post-restore tasks
    echo -e "${YELLOW}Running post-restore tasks...${NC}"
    psql "$target_db" -c "ANALYZE;"
    
    echo -e "${GREEN}✅ Restore completed successfully${NC}"
}

# Function to list backups
list_backups() {
    echo -e "${YELLOW}Available Database Backups${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    # List local backups
    echo -e "\n${YELLOW}Local Backups:${NC}"
    if [ -d "$BACKUP_DIR" ]; then
        find "$BACKUP_DIR" -name "*.enc" -printf "%T+ %s %p\n" | \
            sort -r | \
            while read date size path; do
                size_human=$(numfmt --to=iec-i --suffix=B "$size")
                basename=$(basename "$path")
                echo -e "$date  ${GREEN}$size_human${NC}  $basename"
            done
    else
        echo "No local backups found"
    fi
    
    # List remote backups
    echo -e "\n${YELLOW}Remote Backups (Digital Ocean Spaces):${NC}"
    s3cmd ls "s3://$SPACES_BUCKET/database/$ENVIRONMENT/" \
        --access_key="$DO_SPACES_ACCESS_KEY" \
        --secret_key="$DO_SPACES_SECRET_KEY" \
        --host="$DO_SPACES_ENDPOINT" \
        --host-bucket="%(bucket)s.$DO_SPACES_ENDPOINT" \
        --recursive | \
        grep -E "\.enc$" | \
        sort -r | \
        head -20
}

# Main execution
case "$ACTION" in
    backup)
        # Perform backup based on type
        case "$BACKUP_TYPE" in
            full)
                backup_file=$(perform_full_backup)
                verify_backup "$backup_file"
                upload_backup "$backup_file"
                cleanup_old_backups
                ;;
            incremental|incr)
                backup_file=$(perform_incremental_backup)
                verify_backup "$backup_file"
                upload_backup "$backup_file"
                ;;
            schema)
                backup_file=$(perform_schema_backup)
                upload_backup "$backup_file"
                ;;
            *)
                echo -e "${RED}Unknown backup type: $BACKUP_TYPE${NC}"
                echo "Valid types: full, incremental, schema"
                exit 1
                ;;
        esac
        
        echo -e "\n${GREEN}✅ Backup completed successfully!${NC}"
        echo -e "Log file: $LOG_FILE"
        ;;
        
    restore)
        restore_backup "$ENVIRONMENT" "$BACKUP_TYPE"
        ;;
        
    list)
        list_backups
        ;;
        
    verify)
        if [ -z "$ENVIRONMENT" ]; then
            echo -e "${RED}Please specify backup file to verify${NC}"
            exit 1
        fi
        verify_backup "$ENVIRONMENT"
        ;;
        
    cleanup)
        cleanup_old_backups
        echo -e "${GREEN}✅ Cleanup completed${NC}"
        ;;
        
    *)
        echo -e "${BLUE}ColdCopy Database Backup Manager${NC}"
        echo -e "\nUsage: $0 [action] [environment/file] [type]"
        echo -e "\nActions:"
        echo -e "  ${YELLOW}backup${NC}   - Create a new backup"
        echo -e "  ${YELLOW}restore${NC}  - Restore from backup"
        echo -e "  ${YELLOW}list${NC}     - List available backups"
        echo -e "  ${YELLOW}verify${NC}   - Verify backup integrity"
        echo -e "  ${YELLOW}cleanup${NC}  - Clean old backups"
        echo -e "\nBackup Types:"
        echo -e "  ${YELLOW}full${NC}         - Complete database backup (default)"
        echo -e "  ${YELLOW}incremental${NC}  - WAL-based incremental backup"
        echo -e "  ${YELLOW}schema${NC}       - Schema-only backup"
        echo -e "\nExamples:"
        echo -e "  $0 backup production full"
        echo -e "  $0 restore backup-20240101.enc"
        echo -e "  $0 list production"
        exit 0
        ;;
esac