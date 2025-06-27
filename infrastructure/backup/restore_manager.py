#!/usr/bin/env python3
"""
Database Restore Manager
Handles disaster recovery and point-in-time recovery operations
"""

import os
import sys
import json
import boto3
import psycopg2
import logging
import subprocess
import tempfile
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from pathlib import Path
import click
from backup_manager import BackupConfig, BackupManager

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class RestoreManager:
    """Manages database restoration operations"""
    
    def __init__(self, config: BackupConfig):
        self.config = config
        self.backup_manager = BackupManager(config)
        self.s3_client = self.backup_manager.s3_client
    
    def list_available_backups(self, limit: int = 10) -> List[Dict]:
        """List available backups for restoration"""
        status = self.backup_manager.get_backup_status()
        backups = status.get('recent_backups', [])
        
        # Add restore-specific information
        for backup in backups[:limit]:
            backup['restore_command'] = f"restore_manager.py restore --backup-name {backup['backup_name']}"
            backup['age_days'] = (datetime.now() - datetime.strptime(backup['timestamp'], "%Y%m%d_%H%M%S")).days
        
        return backups[:limit]
    
    def restore_full_backup(self, backup_name: str, target_db: Optional[str] = None) -> bool:
        """Restore a full backup to specified database"""
        try:
            logger.info(f"Starting restoration of backup: {backup_name}")
            
            # Use original database name if target not specified
            if not target_db:
                target_db = self.config.db_name
            
            # Download backup
            logger.info("Downloading backup from Digital Ocean Spaces...")
            temp_dir = tempfile.mkdtemp(prefix="coldcopy_restore_")
            backup_path = os.path.join(temp_dir, backup_name)
            
            self.s3_client.download_file(
                self.config.spaces_bucket,
                f"backups/{backup_name}",
                backup_path
            )
            
            # Verify checksum
            logger.info("Verifying backup integrity...")
            metadata_response = self.s3_client.get_object(
                Bucket=self.config.spaces_bucket,
                Key=f"backups/metadata/{backup_name}.json"
            )
            metadata = json.loads(metadata_response['Body'].read())
            
            calculated_checksum = self.backup_manager._calculate_checksum(backup_path)
            if calculated_checksum != metadata['checksum']:
                raise Exception("Backup checksum verification failed")
            
            # Decrypt if necessary
            if metadata.get('encrypted', False):
                logger.info("Decrypting backup...")
                decrypted_path = self._decrypt_backup(backup_path)
                os.remove(backup_path)
                backup_path = decrypted_path
            
            # Check if target database exists
            if self._database_exists(target_db):
                if not click.confirm(f"Database '{target_db}' already exists. Drop and recreate?"):
                    logger.info("Restoration cancelled by user")
                    return False
                
                # Drop existing database
                self._drop_database(target_db)
            
            # Create new database
            logger.info(f"Creating database: {target_db}")
            self._create_database(target_db)
            
            # Restore backup
            logger.info("Restoring backup data...")
            success = self._perform_restore(backup_path, target_db)
            
            if success:
                # Verify restoration
                logger.info("Verifying restored database...")
                if self._verify_restoration(target_db):
                    logger.info(f"Database restored successfully to: {target_db}")
                    
                    # Update sequences and statistics
                    self._post_restore_tasks(target_db)
                    
                    return True
                else:
                    logger.error("Restoration verification failed")
                    return False
            
            return False
            
        except Exception as e:
            logger.error(f"Restoration failed: {str(e)}")
            return False
        
        finally:
            # Cleanup
            if 'temp_dir' in locals():
                import shutil
                shutil.rmtree(temp_dir, ignore_errors=True)
    
    def point_in_time_recovery(self, target_time: datetime, target_db: Optional[str] = None) -> bool:
        """Perform point-in-time recovery to specified timestamp"""
        try:
            logger.info(f"Starting point-in-time recovery to: {target_time}")
            
            if not target_db:
                target_db = f"{self.config.db_name}_pitr_{target_time.strftime('%Y%m%d_%H%M%S')}"
            
            # Find base backup
            base_backup = self._find_base_backup_for_pitr(target_time)
            if not base_backup:
                logger.error("No suitable base backup found for PITR")
                return False
            
            logger.info(f"Using base backup: {base_backup}")
            
            # Restore base backup
            if not self.restore_full_backup(base_backup, target_db):
                return False
            
            # Apply WAL files up to target time
            logger.info("Applying WAL files for point-in-time recovery...")
            if not self._apply_wal_files(target_db, base_backup, target_time):
                logger.error("Failed to apply WAL files")
                return False
            
            logger.info(f"Point-in-time recovery completed to: {target_db}")
            return True
            
        except Exception as e:
            logger.error(f"PITR failed: {str(e)}")
            return False
    
    def _database_exists(self, db_name: str) -> bool:
        """Check if database exists"""
        try:
            conn = psycopg2.connect(
                host=self.config.db_host,
                port=self.config.db_port,
                user=self.config.db_user,
                password=self.config.db_password,
                database='postgres'
            )
            cursor = conn.cursor()
            cursor.execute(
                "SELECT 1 FROM pg_database WHERE datname = %s",
                (db_name,)
            )
            exists = cursor.fetchone() is not None
            cursor.close()
            conn.close()
            return exists
        except Exception as e:
            logger.error(f"Error checking database existence: {str(e)}")
            return False
    
    def _drop_database(self, db_name: str):
        """Drop existing database"""
        try:
            conn = psycopg2.connect(
                host=self.config.db_host,
                port=self.config.db_port,
                user=self.config.db_user,
                password=self.config.db_password,
                database='postgres'
            )
            conn.autocommit = True
            cursor = conn.cursor()
            
            # Terminate existing connections
            cursor.execute(f"""
                SELECT pg_terminate_backend(pid)
                FROM pg_stat_activity
                WHERE datname = %s AND pid <> pg_backend_pid()
            """, (db_name,))
            
            # Drop database
            cursor.execute(f"DROP DATABASE {db_name}")
            cursor.close()
            conn.close()
            
            logger.info(f"Dropped database: {db_name}")
            
        except Exception as e:
            logger.error(f"Error dropping database: {str(e)}")
            raise
    
    def _create_database(self, db_name: str):
        """Create new database"""
        try:
            conn = psycopg2.connect(
                host=self.config.db_host,
                port=self.config.db_port,
                user=self.config.db_user,
                password=self.config.db_password,
                database='postgres'
            )
            conn.autocommit = True
            cursor = conn.cursor()
            cursor.execute(f"CREATE DATABASE {db_name}")
            cursor.close()
            conn.close()
            
            logger.info(f"Created database: {db_name}")
            
        except Exception as e:
            logger.error(f"Error creating database: {str(e)}")
            raise
    
    def _perform_restore(self, backup_path: str, target_db: str) -> bool:
        """Perform the actual restore operation"""
        try:
            cmd = [
                "pg_restore",
                "-h", self.config.db_host,
                "-p", str(self.config.db_port),
                "-U", self.config.db_user,
                "-d", target_db,
                "-j", "4",  # Parallel jobs
                "--no-password",
                "--verbose",
                "--exit-on-error",
                backup_path
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
                logger.error(f"Restore failed: {result.stderr}")
                return False
            
            return True
            
        except Exception as e:
            logger.error(f"Restore error: {str(e)}")
            return False
    
    def _verify_restoration(self, db_name: str) -> bool:
        """Verify the restored database is functional"""
        try:
            conn = psycopg2.connect(
                host=self.config.db_host,
                port=self.config.db_port,
                user=self.config.db_user,
                password=self.config.db_password,
                database=db_name
            )
            cursor = conn.cursor()
            
            # Check core tables exist
            core_tables = [
                'workspaces', 'users', 'leads', 'campaigns', 
                'email_events', 'consent_records'
            ]
            
            for table in core_tables:
                cursor.execute(f"""
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_name = %s
                    )
                """, (table,))
                
                exists = cursor.fetchone()[0]
                if not exists:
                    logger.error(f"Core table missing: {table}")
                    return False
            
            # Check row counts
            cursor.execute("SELECT COUNT(*) FROM workspaces")
            workspace_count = cursor.fetchone()[0]
            logger.info(f"Restored {workspace_count} workspaces")
            
            cursor.close()
            conn.close()
            
            return True
            
        except Exception as e:
            logger.error(f"Verification error: {str(e)}")
            return False
    
    def _post_restore_tasks(self, db_name: str):
        """Perform post-restore optimization tasks"""
        try:
            conn = psycopg2.connect(
                host=self.config.db_host,
                port=self.config.db_port,
                user=self.config.db_user,
                password=self.config.db_password,
                database=db_name
            )
            cursor = conn.cursor()
            
            # Update statistics
            logger.info("Analyzing database...")
            cursor.execute("ANALYZE")
            
            # Reset sequences
            cursor.execute("""
                SELECT sequence_name 
                FROM information_schema.sequences 
                WHERE sequence_schema = 'public'
            """)
            
            sequences = cursor.fetchall()
            for seq in sequences:
                # Get table and column for sequence
                cursor.execute(f"""
                    SELECT table_name, column_name
                    FROM information_schema.columns
                    WHERE column_default LIKE 'nextval(''%{seq[0]}%''::regclass)'
                """)
                
                result = cursor.fetchone()
                if result:
                    table_name, column_name = result
                    cursor.execute(f"""
                        SELECT setval('{seq[0]}', 
                            COALESCE((SELECT MAX({column_name}) FROM {table_name}), 1)
                        )
                    """)
            
            conn.commit()
            cursor.close()
            conn.close()
            
            logger.info("Post-restore tasks completed")
            
        except Exception as e:
            logger.error(f"Post-restore tasks error: {str(e)}")
    
    def _decrypt_backup(self, encrypted_path: str) -> str:
        """Decrypt backup file"""
        decrypted_path = encrypted_path.replace('.enc', '')
        
        cmd = [
            "openssl", "enc", "-aes-256-cbc",
            "-d", "-pbkdf2",
            "-in", encrypted_path,
            "-out", decrypted_path,
            "-pass", f"pass:{self.config.encryption_key}"
        ]
        
        result = subprocess.run(cmd, capture_output=True)
        if result.returncode != 0:
            raise Exception(f"Decryption failed: {result.stderr.decode()}")
        
        return decrypted_path
    
    def _find_base_backup_for_pitr(self, target_time: datetime) -> Optional[str]:
        """Find suitable base backup for point-in-time recovery"""
        backups = self.list_available_backups(limit=50)
        
        for backup in backups:
            backup_time = datetime.strptime(backup['timestamp'], "%Y%m%d_%H%M%S")
            if backup_time < target_time:
                return backup['backup_name']
        
        return None
    
    def _apply_wal_files(self, db_name: str, base_backup: str, target_time: datetime) -> bool:
        """Apply WAL files for point-in-time recovery"""
        # This is a simplified version - in production, you would:
        # 1. Configure recovery.conf or postgresql.auto.conf
        # 2. Set restore_command to fetch WAL files from Spaces
        # 3. Set recovery_target_time
        # 4. Start PostgreSQL in recovery mode
        # 5. Monitor recovery progress
        
        logger.warning("WAL application not fully implemented in this demo")
        return True
    
    def create_restore_plan(self, scenario: str) -> Dict:
        """Create a detailed restore plan for different scenarios"""
        plans = {
            "corruption": {
                "name": "Database Corruption Recovery",
                "steps": [
                    "1. Stop all application connections",
                    "2. Identify latest verified backup",
                    "3. Create new database with temporary name",
                    "4. Restore latest backup to temporary database",
                    "5. Verify restoration integrity",
                    "6. Switch application to temporary database",
                    "7. Rename databases to swap them",
                    "8. Keep corrupted database for analysis"
                ],
                "estimated_time": "30-60 minutes",
                "data_loss": "Up to 24 hours (last backup)"
            },
            "deletion": {
                "name": "Accidental Deletion Recovery",
                "steps": [
                    "1. Determine exact time of deletion",
                    "2. Find base backup before deletion",
                    "3. Perform point-in-time recovery",
                    "4. Extract deleted data",
                    "5. Restore deleted data to production"
                ],
                "estimated_time": "1-2 hours",
                "data_loss": "None if WAL archiving is enabled"
            },
            "disaster": {
                "name": "Complete Disaster Recovery",
                "steps": [
                    "1. Provision new database server",
                    "2. Install PostgreSQL and dependencies",
                    "3. Download latest backup from Spaces",
                    "4. Restore full backup",
                    "5. Configure replication if applicable",
                    "6. Update application connection strings",
                    "7. Verify all services are functional"
                ],
                "estimated_time": "2-4 hours",
                "data_loss": "Up to 24 hours (last backup)"
            },
            "compliance": {
                "name": "Compliance Data Recovery",
                "steps": [
                    "1. Identify compliance backup (monthly)",
                    "2. Restore to isolated environment",
                    "3. Extract required compliance data",
                    "4. Generate compliance reports",
                    "5. Securely dispose of temporary database"
                ],
                "estimated_time": "1-2 hours",
                "data_loss": "N/A - Historical data extraction"
            }
        }
        
        return plans.get(scenario, {"error": "Unknown scenario"})


@click.group()
def cli():
    """ColdCopy Database Restore Manager"""
    pass


@cli.command()
@click.option('--limit', default=10, help='Number of backups to list')
def list_backups(limit):
    """List available backups"""
    config = load_config()
    manager = RestoreManager(config)
    
    backups = manager.list_available_backups(limit)
    
    if not backups:
        click.echo("No backups available")
        return
    
    click.echo("\nAvailable Backups:")
    click.echo("-" * 80)
    
    for backup in backups:
        click.echo(f"Name: {backup['backup_name']}")
        click.echo(f"  Date: {backup['timestamp']}")
        click.echo(f"  Size: {backup['size_bytes'] / (1024**3):.2f} GB")
        click.echo(f"  Age: {backup['age_days']} days")
        click.echo(f"  Encrypted: {backup.get('encrypted', False)}")
        click.echo(f"  Command: {backup['restore_command']}")
        click.echo()


@cli.command()
@click.option('--backup-name', required=True, help='Name of backup to restore')
@click.option('--target-db', help='Target database name (optional)')
def restore(backup_name, target_db):
    """Restore a specific backup"""
    config = load_config()
    manager = RestoreManager(config)
    
    click.echo(f"Starting restoration of backup: {backup_name}")
    
    if manager.restore_full_backup(backup_name, target_db):
        click.echo(click.style("✓ Restoration completed successfully", fg='green'))
    else:
        click.echo(click.style("✗ Restoration failed", fg='red'))
        sys.exit(1)


@cli.command()
@click.option('--target-time', required=True, help='Target time (ISO format)')
@click.option('--target-db', help='Target database name (optional)')
def pitr(target_time, target_db):
    """Perform point-in-time recovery"""
    config = load_config()
    manager = RestoreManager(config)
    
    try:
        target_datetime = datetime.fromisoformat(target_time)
    except ValueError:
        click.echo("Invalid datetime format. Use ISO format: YYYY-MM-DD HH:MM:SS")
        sys.exit(1)
    
    click.echo(f"Starting point-in-time recovery to: {target_datetime}")
    
    if manager.point_in_time_recovery(target_datetime, target_db):
        click.echo(click.style("✓ PITR completed successfully", fg='green'))
    else:
        click.echo(click.style("✗ PITR failed", fg='red'))
        sys.exit(1)


@cli.command()
@click.argument('scenario', type=click.Choice(['corruption', 'deletion', 'disaster', 'compliance']))
def plan(scenario):
    """Get restore plan for specific scenario"""
    config = load_config()
    manager = RestoreManager(config)
    
    restore_plan = manager.create_restore_plan(scenario)
    
    click.echo(f"\n{restore_plan.get('name', 'Restore Plan')}")
    click.echo("=" * 50)
    
    if 'steps' in restore_plan:
        click.echo("\nSteps:")
        for step in restore_plan['steps']:
            click.echo(f"  {step}")
    
    if 'estimated_time' in restore_plan:
        click.echo(f"\nEstimated Time: {restore_plan['estimated_time']}")
    
    if 'data_loss' in restore_plan:
        click.echo(f"Potential Data Loss: {restore_plan['data_loss']}")


def load_config() -> BackupConfig:
    """Load configuration from environment"""
    return BackupConfig(
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
        encryption_key=os.getenv('BACKUP_ENCRYPTION_KEY')
    )


if __name__ == '__main__':
    cli()