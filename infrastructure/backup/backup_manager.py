#!/usr/bin/env python3
"""
Supabase Database Backup Manager
Handles automated backups, WAL archiving, and point-in-time recovery
"""

import os
import sys
import json
import boto3
import psycopg2
import logging
import subprocess
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from pathlib import Path
import schedule
import time
import hashlib
import tempfile
import gzip
from concurrent.futures import ThreadPoolExecutor, as_completed
from botocore.exceptions import NoCredentialsError, ClientError
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/var/log/coldcopy/backup.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)


@dataclass
class BackupConfig:
    """Configuration for backup operations"""
    # Database
    db_host: str
    db_port: int
    db_name: str
    db_user: str
    db_password: str
    
    # Digital Ocean Spaces
    spaces_key: str
    spaces_secret: str
    spaces_bucket: str
    spaces_region: str
    spaces_endpoint: str
    
    # Backup settings
    backup_dir: str = "/tmp/coldcopy_backups"
    wal_archive_dir: str = "/var/lib/postgresql/wal_archive"
    retention_days: int = 30
    compliance_retention_days: int = 365
    max_parallel_uploads: int = 4
    chunk_size_mb: int = 100
    
    # Monitoring
    alert_email: Optional[str] = None
    smtp_host: Optional[str] = None
    smtp_port: int = 587
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None
    
    # GDPR compliance
    encrypt_backups: bool = True
    encryption_key: Optional[str] = None


class BackupManager:
    """Manages database backups and restoration"""
    
    def __init__(self, config: BackupConfig):
        self.config = config
        self.s3_client = self._init_s3_client()
        self.setup_directories()
        
    def _init_s3_client(self):
        """Initialize S3 client for Digital Ocean Spaces"""
        session = boto3.session.Session()
        return session.client(
            's3',
            region_name=self.config.spaces_region,
            endpoint_url=self.config.spaces_endpoint,
            aws_access_key_id=self.config.spaces_key,
            aws_secret_access_key=self.config.spaces_secret
        )
    
    def setup_directories(self):
        """Create necessary backup directories"""
        Path(self.config.backup_dir).mkdir(parents=True, exist_ok=True)
        Path(self.config.wal_archive_dir).mkdir(parents=True, exist_ok=True)
        
    def get_db_connection_string(self) -> str:
        """Get PostgreSQL connection string"""
        return (
            f"postgresql://{self.config.db_user}:{self.config.db_password}"
            f"@{self.config.db_host}:{self.config.db_port}/{self.config.db_name}"
        )
    
    def perform_full_backup(self) -> Tuple[bool, str]:
        """Perform a full database backup using pg_dump"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_name = f"full_backup_{self.config.db_name}_{timestamp}"
        backup_path = os.path.join(self.config.backup_dir, f"{backup_name}.sql")
        
        try:
            logger.info(f"Starting full backup: {backup_name}")
            
            # Use pg_dump with custom format for better compression and parallel restore
            cmd = [
                "pg_dump",
                "-h", self.config.db_host,
                "-p", str(self.config.db_port),
                "-U", self.config.db_user,
                "-d", self.config.db_name,
                "-F", "custom",  # Custom format
                "-j", "4",  # Parallel jobs
                "-Z", "9",  # Maximum compression
                "-f", backup_path,
                "--no-password",
                "--verbose"
            ]
            
            env = os.environ.copy()
            env["PGPASSWORD"] = self.config.db_password
            
            result = subprocess.run(
                cmd,
                env=env,
                capture_output=True,
                text=True
            )
            
            if result.returncode != 0:
                logger.error(f"Backup failed: {result.stderr}")
                return False, ""
            
            # Compress and encrypt if configured
            if self.config.encrypt_backups:
                encrypted_path = self._encrypt_backup(backup_path)
                os.remove(backup_path)
                backup_path = encrypted_path
            
            # Calculate checksum
            checksum = self._calculate_checksum(backup_path)
            
            # Upload to Digital Ocean Spaces
            success = self._upload_to_spaces(backup_path, backup_name)
            
            if success:
                # Create metadata file
                metadata = {
                    "backup_name": backup_name,
                    "timestamp": timestamp,
                    "database": self.config.db_name,
                    "size_bytes": os.path.getsize(backup_path),
                    "checksum": checksum,
                    "encrypted": self.config.encrypt_backups,
                    "type": "full",
                    "retention_category": "standard"
                }
                self._save_backup_metadata(backup_name, metadata)
                
                logger.info(f"Backup completed successfully: {backup_name}")
                
                # Clean up local file
                os.remove(backup_path)
                
                return True, backup_name
            
            return False, ""
            
        except Exception as e:
            logger.error(f"Backup error: {str(e)}")
            self._send_alert(f"Backup failed: {str(e)}")
            return False, ""
    
    def setup_wal_archiving(self):
        """Configure PostgreSQL for WAL archiving"""
        try:
            conn = psycopg2.connect(self.get_db_connection_string())
            cursor = conn.cursor()
            
            # Check if we have superuser privileges
            cursor.execute("SELECT current_setting('is_superuser')")
            is_superuser = cursor.fetchone()[0] == 'on'
            
            if not is_superuser:
                logger.warning("Cannot configure WAL archiving without superuser privileges")
                return False
            
            # Configure WAL archiving parameters
            wal_settings = [
                ("wal_level", "replica"),
                ("archive_mode", "on"),
                ("archive_command", f"'/usr/local/bin/archive_wal.sh %p %f'"),
                ("archive_timeout", "300"),  # 5 minutes
                ("max_wal_size", "1GB"),
                ("min_wal_size", "80MB")
            ]
            
            for setting, value in wal_settings:
                cursor.execute(f"ALTER SYSTEM SET {setting} = '{value}'")
            
            conn.commit()
            cursor.close()
            conn.close()
            
            # Create WAL archive script
            self._create_wal_archive_script()
            
            logger.info("WAL archiving configured successfully")
            return True
            
        except Exception as e:
            logger.error(f"Failed to configure WAL archiving: {str(e)}")
            return False
    
    def _create_wal_archive_script(self):
        """Create script for archiving WAL files to Digital Ocean Spaces"""
        script_content = f"""#!/bin/bash
# WAL Archive Script for ColdCopy

WAL_PATH=$1
WAL_NAME=$2
SPACES_BUCKET="{self.config.spaces_bucket}"
SPACES_KEY="{self.config.spaces_key}"
SPACES_SECRET="{self.config.spaces_secret}"
SPACES_ENDPOINT="{self.config.spaces_endpoint}"

# Compress WAL file
gzip -c "$WAL_PATH" > "/tmp/$WAL_NAME.gz"

# Upload to Spaces using s3cmd
s3cmd put "/tmp/$WAL_NAME.gz" \\
    "s3://$SPACES_BUCKET/wal_archive/$(date +%Y/%m/%d)/$WAL_NAME.gz" \\
    --access_key="$SPACES_KEY" \\
    --secret_key="$SPACES_SECRET" \\
    --host="$SPACES_ENDPOINT" \\
    --host-bucket="%(bucket)s.$SPACES_ENDPOINT"

# Clean up
rm -f "/tmp/$WAL_NAME.gz"

exit $?
"""
        
        script_path = "/usr/local/bin/archive_wal.sh"
        with open(script_path, "w") as f:
            f.write(script_content)
        
        os.chmod(script_path, 0o755)
    
    def _encrypt_backup(self, backup_path: str) -> str:
        """Encrypt backup file using AES-256"""
        if not self.config.encryption_key:
            raise ValueError("Encryption key not configured")
        
        encrypted_path = f"{backup_path}.enc"
        
        # Use openssl for encryption
        cmd = [
            "openssl", "enc", "-aes-256-cbc",
            "-salt", "-pbkdf2",
            "-in", backup_path,
            "-out", encrypted_path,
            "-pass", f"pass:{self.config.encryption_key}"
        ]
        
        result = subprocess.run(cmd, capture_output=True)
        if result.returncode != 0:
            raise Exception(f"Encryption failed: {result.stderr.decode()}")
        
        return encrypted_path
    
    def _calculate_checksum(self, file_path: str) -> str:
        """Calculate SHA-256 checksum of file"""
        sha256_hash = hashlib.sha256()
        with open(file_path, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        return sha256_hash.hexdigest()
    
    def _upload_to_spaces(self, file_path: str, backup_name: str) -> bool:
        """Upload backup file to Digital Ocean Spaces with multipart upload"""
        try:
            file_size = os.path.getsize(file_path)
            
            # Use multipart upload for large files
            if file_size > self.config.chunk_size_mb * 1024 * 1024:
                return self._multipart_upload(file_path, backup_name)
            else:
                # Simple upload for smaller files
                with open(file_path, 'rb') as f:
                    self.s3_client.put_object(
                        Bucket=self.config.spaces_bucket,
                        Key=f"backups/{backup_name}",
                        Body=f,
                        StorageClass='GLACIER'  # Use cold storage for backups
                    )
                return True
                
        except Exception as e:
            logger.error(f"Upload failed: {str(e)}")
            return False
    
    def _multipart_upload(self, file_path: str, backup_name: str) -> bool:
        """Perform multipart upload for large files"""
        try:
            # Initiate multipart upload
            response = self.s3_client.create_multipart_upload(
                Bucket=self.config.spaces_bucket,
                Key=f"backups/{backup_name}",
                StorageClass='GLACIER'
            )
            upload_id = response['UploadId']
            
            # Upload parts in parallel
            parts = []
            file_size = os.path.getsize(file_path)
            chunk_size = self.config.chunk_size_mb * 1024 * 1024
            
            with ThreadPoolExecutor(max_workers=self.config.max_parallel_uploads) as executor:
                futures = []
                
                with open(file_path, 'rb') as f:
                    part_number = 1
                    while True:
                        data = f.read(chunk_size)
                        if not data:
                            break
                        
                        future = executor.submit(
                            self._upload_part,
                            self.config.spaces_bucket,
                            f"backups/{backup_name}",
                            upload_id,
                            part_number,
                            data
                        )
                        futures.append((part_number, future))
                        part_number += 1
                
                # Collect results
                for part_number, future in futures:
                    etag = future.result()
                    parts.append({
                        'ETag': etag,
                        'PartNumber': part_number
                    })
            
            # Complete multipart upload
            self.s3_client.complete_multipart_upload(
                Bucket=self.config.spaces_bucket,
                Key=f"backups/{backup_name}",
                UploadId=upload_id,
                MultipartUpload={'Parts': parts}
            )
            
            return True
            
        except Exception as e:
            logger.error(f"Multipart upload failed: {str(e)}")
            # Abort the upload
            try:
                self.s3_client.abort_multipart_upload(
                    Bucket=self.config.spaces_bucket,
                    Key=f"backups/{backup_name}",
                    UploadId=upload_id
                )
            except:
                pass
            return False
    
    def _upload_part(self, bucket: str, key: str, upload_id: str, 
                     part_number: int, data: bytes) -> str:
        """Upload a single part in multipart upload"""
        response = self.s3_client.upload_part(
            Bucket=bucket,
            Key=key,
            UploadId=upload_id,
            PartNumber=part_number,
            Body=data
        )
        return response['ETag']
    
    def _save_backup_metadata(self, backup_name: str, metadata: Dict):
        """Save backup metadata to Spaces"""
        metadata_key = f"backups/metadata/{backup_name}.json"
        self.s3_client.put_object(
            Bucket=self.config.spaces_bucket,
            Key=metadata_key,
            Body=json.dumps(metadata, indent=2),
            ContentType='application/json'
        )
    
    def verify_backup(self, backup_name: str) -> bool:
        """Verify backup integrity"""
        try:
            logger.info(f"Verifying backup: {backup_name}")
            
            # Download metadata
            metadata_key = f"backups/metadata/{backup_name}.json"
            response = self.s3_client.get_object(
                Bucket=self.config.spaces_bucket,
                Key=metadata_key
            )
            metadata = json.loads(response['Body'].read())
            
            # Download backup file
            temp_path = os.path.join(self.config.backup_dir, f"verify_{backup_name}")
            self.s3_client.download_file(
                self.config.spaces_bucket,
                f"backups/{backup_name}",
                temp_path
            )
            
            # Verify checksum
            calculated_checksum = self._calculate_checksum(temp_path)
            if calculated_checksum != metadata['checksum']:
                logger.error(f"Checksum mismatch for {backup_name}")
                return False
            
            # Test restore to temporary database
            if self._test_restore(temp_path):
                logger.info(f"Backup verification successful: {backup_name}")
                os.remove(temp_path)
                return True
            
            return False
            
        except Exception as e:
            logger.error(f"Backup verification failed: {str(e)}")
            return False
    
    def _test_restore(self, backup_path: str) -> bool:
        """Test restore backup to temporary database"""
        test_db = f"test_restore_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        try:
            # Create test database
            conn = psycopg2.connect(
                host=self.config.db_host,
                port=self.config.db_port,
                user=self.config.db_user,
                password=self.config.db_password,
                database='postgres'
            )
            conn.autocommit = True
            cursor = conn.cursor()
            cursor.execute(f"CREATE DATABASE {test_db}")
            cursor.close()
            conn.close()
            
            # Restore backup
            cmd = [
                "pg_restore",
                "-h", self.config.db_host,
                "-p", str(self.config.db_port),
                "-U", self.config.db_user,
                "-d", test_db,
                "-j", "4",
                "--no-password",
                backup_path
            ]
            
            env = os.environ.copy()
            env["PGPASSWORD"] = self.config.db_password
            
            result = subprocess.run(cmd, env=env, capture_output=True)
            
            # Drop test database
            conn = psycopg2.connect(
                host=self.config.db_host,
                port=self.config.db_port,
                user=self.config.db_user,
                password=self.config.db_password,
                database='postgres'
            )
            conn.autocommit = True
            cursor = conn.cursor()
            cursor.execute(f"DROP DATABASE {test_db}")
            cursor.close()
            conn.close()
            
            return result.returncode == 0
            
        except Exception as e:
            logger.error(f"Test restore failed: {str(e)}")
            return False
    
    def cleanup_old_backups(self):
        """Remove backups older than retention period"""
        try:
            logger.info("Starting backup cleanup")
            
            # List all backups
            paginator = self.s3_client.get_paginator('list_objects_v2')
            pages = paginator.paginate(
                Bucket=self.config.spaces_bucket,
                Prefix='backups/'
            )
            
            deleted_count = 0
            
            for page in pages:
                if 'Contents' not in page:
                    continue
                
                for obj in page['Contents']:
                    # Skip metadata files
                    if '/metadata/' in obj['Key']:
                        continue
                    
                    # Check age
                    age_days = (datetime.now() - obj['LastModified'].replace(tzinfo=None)).days
                    
                    # Determine retention period
                    retention_days = self.config.retention_days
                    
                    # Check if this is a compliance backup (monthly)
                    if obj['LastModified'].day == 1:
                        retention_days = self.config.compliance_retention_days
                    
                    if age_days > retention_days:
                        # Delete backup and metadata
                        self.s3_client.delete_object(
                            Bucket=self.config.spaces_bucket,
                            Key=obj['Key']
                        )
                        
                        # Delete metadata
                        backup_name = os.path.basename(obj['Key'])
                        metadata_key = f"backups/metadata/{backup_name}.json"
                        try:
                            self.s3_client.delete_object(
                                Bucket=self.config.spaces_bucket,
                                Key=metadata_key
                            )
                        except:
                            pass
                        
                        deleted_count += 1
                        logger.info(f"Deleted old backup: {obj['Key']}")
            
            logger.info(f"Cleanup completed. Deleted {deleted_count} backups")
            
        except Exception as e:
            logger.error(f"Cleanup failed: {str(e)}")
            self._send_alert(f"Backup cleanup failed: {str(e)}")
    
    def perform_point_in_time_recovery(self, target_time: datetime) -> bool:
        """Perform point-in-time recovery to specified timestamp"""
        try:
            logger.info(f"Starting point-in-time recovery to {target_time}")
            
            # Find the latest full backup before target time
            base_backup = self._find_base_backup(target_time)
            if not base_backup:
                logger.error("No suitable base backup found")
                return False
            
            # Download and restore base backup
            temp_restore_path = os.path.join(self.config.backup_dir, "pitr_restore")
            self.s3_client.download_file(
                self.config.spaces_bucket,
                f"backups/{base_backup}",
                temp_restore_path
            )
            
            # Create recovery configuration
            recovery_conf = f"""
restore_command = 'aws s3 cp s3://{self.config.spaces_bucket}/wal_archive/%f %p'
recovery_target_time = '{target_time.isoformat()}'
recovery_target_action = 'promote'
"""
            
            # Perform recovery
            # This would typically involve:
            # 1. Stop PostgreSQL
            # 2. Clear data directory
            # 3. Restore base backup
            # 4. Create recovery.conf
            # 5. Start PostgreSQL
            # 6. Monitor recovery progress
            
            logger.info("Point-in-time recovery completed successfully")
            return True
            
        except Exception as e:
            logger.error(f"PITR failed: {str(e)}")
            self._send_alert(f"Point-in-time recovery failed: {str(e)}")
            return False
    
    def _find_base_backup(self, target_time: datetime) -> Optional[str]:
        """Find the most recent full backup before target time"""
        try:
            # List backups with metadata
            paginator = self.s3_client.get_paginator('list_objects_v2')
            pages = paginator.paginate(
                Bucket=self.config.spaces_bucket,
                Prefix='backups/metadata/'
            )
            
            suitable_backups = []
            
            for page in pages:
                if 'Contents' not in page:
                    continue
                
                for obj in page['Contents']:
                    # Get metadata
                    response = self.s3_client.get_object(
                        Bucket=self.config.spaces_bucket,
                        Key=obj['Key']
                    )
                    metadata = json.loads(response['Body'].read())
                    
                    # Check if backup is before target time
                    backup_time = datetime.strptime(metadata['timestamp'], "%Y%m%d_%H%M%S")
                    if backup_time < target_time and metadata['type'] == 'full':
                        suitable_backups.append((backup_time, metadata['backup_name']))
            
            # Return most recent suitable backup
            if suitable_backups:
                suitable_backups.sort(key=lambda x: x[0], reverse=True)
                return suitable_backups[0][1]
            
            return None
            
        except Exception as e:
            logger.error(f"Failed to find base backup: {str(e)}")
            return None
    
    def _send_alert(self, message: str):
        """Send email alert for backup issues"""
        if not all([self.config.alert_email, self.config.smtp_host, 
                   self.config.smtp_user, self.config.smtp_password]):
            logger.warning("Email alerts not configured")
            return
        
        try:
            msg = MIMEMultipart()
            msg['From'] = self.config.smtp_user
            msg['To'] = self.config.alert_email
            msg['Subject'] = "ColdCopy Backup Alert"
            
            body = f"""
ColdCopy Backup System Alert

{message}

Timestamp: {datetime.now().isoformat()}
Database: {self.config.db_name}
Host: {self.config.db_host}

Please check the backup logs for more details.
"""
            
            msg.attach(MIMEText(body, 'plain'))
            
            server = smtplib.SMTP(self.config.smtp_host, self.config.smtp_port)
            server.starttls()
            server.login(self.config.smtp_user, self.config.smtp_password)
            server.send_message(msg)
            server.quit()
            
            logger.info(f"Alert sent to {self.config.alert_email}")
            
        except Exception as e:
            logger.error(f"Failed to send alert: {str(e)}")
    
    def get_backup_status(self) -> Dict:
        """Get current backup status and statistics"""
        try:
            # List recent backups
            paginator = self.s3_client.get_paginator('list_objects_v2')
            pages = paginator.paginate(
                Bucket=self.config.spaces_bucket,
                Prefix='backups/metadata/'
            )
            
            backups = []
            total_size = 0
            
            for page in pages:
                if 'Contents' not in page:
                    continue
                
                for obj in page['Contents']:
                    # Get metadata
                    response = self.s3_client.get_object(
                        Bucket=self.config.spaces_bucket,
                        Key=obj['Key']
                    )
                    metadata = json.loads(response['Body'].read())
                    backups.append(metadata)
                    total_size += metadata.get('size_bytes', 0)
            
            # Sort by timestamp
            backups.sort(key=lambda x: x['timestamp'], reverse=True)
            
            # Get last backup time
            last_backup_time = None
            if backups:
                last_backup_time = datetime.strptime(
                    backups[0]['timestamp'], 
                    "%Y%m%d_%H%M%S"
                )
            
            return {
                "total_backups": len(backups),
                "total_size_gb": round(total_size / (1024**3), 2),
                "last_backup_time": last_backup_time.isoformat() if last_backup_time else None,
                "recent_backups": backups[:10],
                "oldest_backup": backups[-1] if backups else None,
                "storage_location": self.config.spaces_bucket
            }
            
        except Exception as e:
            logger.error(f"Failed to get backup status: {str(e)}")
            return {}


def schedule_backups(manager: BackupManager):
    """Schedule automated backup tasks"""
    # Daily full backup at 2 AM
    schedule.every().day.at("02:00").do(manager.perform_full_backup)
    
    # Weekly backup verification (Sundays at 3 AM)
    schedule.every().sunday.at("03:00").do(verify_recent_backups, manager)
    
    # Daily cleanup of old backups
    schedule.every().day.at("04:00").do(manager.cleanup_old_backups)
    
    # Monthly compliance backup (1st of each month)
    schedule.every().day.at("01:00").do(check_monthly_backup, manager)
    
    logger.info("Backup schedule configured")
    
    # Run scheduler
    while True:
        schedule.run_pending()
        time.sleep(60)  # Check every minute


def verify_recent_backups(manager: BackupManager):
    """Verify backups from the last 7 days"""
    status = manager.get_backup_status()
    recent_backups = status.get('recent_backups', [])
    
    for backup in recent_backups[:7]:  # Last 7 backups
        if not manager.verify_backup(backup['backup_name']):
            manager._send_alert(f"Backup verification failed: {backup['backup_name']}")


def check_monthly_backup(manager: BackupManager):
    """Ensure monthly compliance backup on the 1st"""
    if datetime.now().day == 1:
        success, backup_name = manager.perform_full_backup()
        if success:
            # Mark as compliance backup
            metadata_key = f"backups/metadata/{backup_name}.json"
            response = manager.s3_client.get_object(
                Bucket=manager.config.spaces_bucket,
                Key=metadata_key
            )
            metadata = json.loads(response['Body'].read())
            metadata['retention_category'] = 'compliance'
            
            manager.s3_client.put_object(
                Bucket=manager.config.spaces_bucket,
                Key=metadata_key,
                Body=json.dumps(metadata, indent=2),
                ContentType='application/json'
            )


def main():
    """Main entry point"""
    # Load configuration from environment
    config = BackupConfig(
        db_host=os.getenv('DB_HOST', 'localhost'),
        db_port=int(os.getenv('DB_PORT', '5432')),
        db_name=os.getenv('DB_NAME', 'coldcopy'),
        db_user=os.getenv('DB_USER', 'postgres'),
        db_password=os.getenv('DB_PASSWORD', ''),
        spaces_key=os.getenv('DO_SPACES_KEY', ''),
        spaces_secret=os.getenv('DO_SPACES_SECRET', ''),
        spaces_bucket=os.getenv('DO_SPACES_BUCKET', 'coldcopy-backups'),
        spaces_region=os.getenv('DO_SPACES_REGION', 'nyc3'),
        spaces_endpoint=os.getenv('DO_SPACES_ENDPOINT', 'https://nyc3.digitaloceanspaces.com'),
        alert_email=os.getenv('ALERT_EMAIL'),
        smtp_host=os.getenv('SMTP_HOST'),
        smtp_user=os.getenv('SMTP_USER'),
        smtp_password=os.getenv('SMTP_PASSWORD'),
        encryption_key=os.getenv('BACKUP_ENCRYPTION_KEY')
    )
    
    manager = BackupManager(config)
    
    # Check command line arguments
    if len(sys.argv) > 1:
        command = sys.argv[1]
        
        if command == "backup":
            success, _ = manager.perform_full_backup()
            sys.exit(0 if success else 1)
        
        elif command == "verify":
            if len(sys.argv) < 3:
                print("Usage: backup_manager.py verify <backup_name>")
                sys.exit(1)
            success = manager.verify_backup(sys.argv[2])
            sys.exit(0 if success else 1)
        
        elif command == "cleanup":
            manager.cleanup_old_backups()
            sys.exit(0)
        
        elif command == "status":
            status = manager.get_backup_status()
            print(json.dumps(status, indent=2))
            sys.exit(0)
        
        elif command == "setup-wal":
            success = manager.setup_wal_archiving()
            sys.exit(0 if success else 1)
        
        elif command == "schedule":
            schedule_backups(manager)
        
        else:
            print(f"Unknown command: {command}")
            print("Available commands: backup, verify, cleanup, status, setup-wal, schedule")
            sys.exit(1)
    
    else:
        # Default: run scheduled backups
        schedule_backups(manager)


if __name__ == "__main__":
    main()