#!/usr/bin/env python3
"""
Backup Monitoring Service
Provides HTTP API and Prometheus metrics for backup status
"""

import os
import json
from datetime import datetime, timedelta
from flask import Flask, jsonify, Response, request
from prometheus_client import Counter, Gauge, Histogram, generate_latest
import logging
from backup_manager import BackupManager, BackupConfig
import threading
import time

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Flask app
app = Flask(__name__)

# Prometheus metrics
backup_total = Counter('coldcopy_backups_total', 'Total number of backups')
backup_success = Counter('coldcopy_backups_success', 'Successful backups')
backup_failed = Counter('coldcopy_backups_failed', 'Failed backups')
backup_size_bytes = Gauge('coldcopy_backup_size_bytes', 'Size of last backup in bytes')
backup_duration_seconds = Histogram('coldcopy_backup_duration_seconds', 'Backup duration')
last_backup_timestamp = Gauge('coldcopy_last_backup_timestamp', 'Timestamp of last backup')
total_backup_size_gb = Gauge('coldcopy_total_backup_size_gb', 'Total size of all backups in GB')
backup_count = Gauge('coldcopy_backup_count', 'Current number of backups')
wal_archive_size_mb = Gauge('coldcopy_wal_archive_size_mb', 'Size of WAL archive in MB')
verification_success_rate = Gauge('coldcopy_backup_verification_success_rate', 'Backup verification success rate')

# Global backup manager
backup_manager = None


def init_backup_manager():
    """Initialize backup manager from environment"""
    global backup_manager
    
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
    
    backup_manager = BackupManager(config)
    logger.info("Backup manager initialized")


def update_metrics():
    """Update Prometheus metrics with current backup status"""
    try:
        status = backup_manager.get_backup_status()
        
        # Update metrics
        backup_count.set(status.get('total_backups', 0))
        total_backup_size_gb.set(status.get('total_size_gb', 0))
        
        # Update last backup timestamp
        if status.get('last_backup_time'):
            last_time = datetime.fromisoformat(status['last_backup_time'])
            last_backup_timestamp.set(last_time.timestamp())
        
        # Get recent backup for size
        recent_backups = status.get('recent_backups', [])
        if recent_backups:
            backup_size_bytes.set(recent_backups[0].get('size_bytes', 0))
        
        logger.info("Metrics updated successfully")
        
    except Exception as e:
        logger.error(f"Failed to update metrics: {str(e)}")


def metrics_updater():
    """Background thread to update metrics periodically"""
    while True:
        update_metrics()
        time.sleep(300)  # Update every 5 minutes


@app.route('/health')
def health():
    """Health check endpoint"""
    try:
        # Check if we can connect to Spaces
        backup_manager.s3_client.head_bucket(Bucket=backup_manager.config.spaces_bucket)
        return jsonify({
            "status": "healthy",
            "timestamp": datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({
            "status": "unhealthy",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }), 503


@app.route('/status')
def status():
    """Get current backup status"""
    try:
        status = backup_manager.get_backup_status()
        
        # Add health indicators
        last_backup_time = None
        if status.get('last_backup_time'):
            last_backup_time = datetime.fromisoformat(status['last_backup_time'])
            hours_since_backup = (datetime.now() - last_backup_time).total_seconds() / 3600
            status['hours_since_last_backup'] = round(hours_since_backup, 2)
            status['backup_health'] = "healthy" if hours_since_backup < 25 else "warning" if hours_since_backup < 48 else "critical"
        else:
            status['backup_health'] = "critical"
            status['hours_since_last_backup'] = None
        
        return jsonify(status)
        
    except Exception as e:
        return jsonify({
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }), 500


@app.route('/backups')
def list_backups():
    """List all backups with pagination"""
    try:
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 20))
        
        status = backup_manager.get_backup_status()
        all_backups = status.get('recent_backups', [])
        
        # Paginate
        start = (page - 1) * per_page
        end = start + per_page
        backups = all_backups[start:end]
        
        return jsonify({
            "backups": backups,
            "total": len(all_backups),
            "page": page,
            "per_page": per_page,
            "total_pages": (len(all_backups) + per_page - 1) // per_page
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/backup/<backup_name>')
def get_backup_details(backup_name):
    """Get details for a specific backup"""
    try:
        # Get metadata
        metadata_key = f"backups/metadata/{backup_name}.json"
        response = backup_manager.s3_client.get_object(
            Bucket=backup_manager.config.spaces_bucket,
            Key=metadata_key
        )
        metadata = json.loads(response['Body'].read())
        
        # Add download URL (pre-signed)
        metadata['download_url'] = backup_manager.s3_client.generate_presigned_url(
            'get_object',
            Params={
                'Bucket': backup_manager.config.spaces_bucket,
                'Key': f"backups/{backup_name}"
            },
            ExpiresIn=3600  # 1 hour
        )
        
        return jsonify(metadata)
        
    except Exception as e:
        return jsonify({"error": str(e)}), 404


@app.route('/verify/<backup_name>', methods=['POST'])
def verify_backup(backup_name):
    """Trigger verification for a specific backup"""
    try:
        # Run verification in background
        def run_verification():
            success = backup_manager.verify_backup(backup_name)
            if success:
                logger.info(f"Backup verification successful: {backup_name}")
            else:
                logger.error(f"Backup verification failed: {backup_name}")
        
        thread = threading.Thread(target=run_verification)
        thread.start()
        
        return jsonify({
            "message": "Verification started",
            "backup_name": backup_name
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/metrics')
def metrics():
    """Prometheus metrics endpoint"""
    return Response(generate_latest(), mimetype='text/plain')


@app.route('/alerts')
def get_alerts():
    """Get current backup alerts"""
    alerts = []
    
    try:
        status = backup_manager.get_backup_status()
        
        # Check last backup time
        if status.get('last_backup_time'):
            last_backup_time = datetime.fromisoformat(status['last_backup_time'])
            hours_since = (datetime.now() - last_backup_time).total_seconds() / 3600
            
            if hours_since > 48:
                alerts.append({
                    "severity": "critical",
                    "message": f"No backup for {round(hours_since, 1)} hours",
                    "timestamp": datetime.now().isoformat()
                })
            elif hours_since > 25:
                alerts.append({
                    "severity": "warning", 
                    "message": f"No backup for {round(hours_since, 1)} hours",
                    "timestamp": datetime.now().isoformat()
                })
        else:
            alerts.append({
                "severity": "critical",
                "message": "No backups found",
                "timestamp": datetime.now().isoformat()
            })
        
        # Check backup size growth
        if len(status.get('recent_backups', [])) > 1:
            recent = status['recent_backups'][0]
            previous = status['recent_backups'][1]
            size_change = (recent['size_bytes'] - previous['size_bytes']) / previous['size_bytes'] * 100
            
            if abs(size_change) > 50:
                alerts.append({
                    "severity": "warning",
                    "message": f"Backup size changed by {round(size_change, 1)}%",
                    "timestamp": datetime.now().isoformat()
                })
        
        return jsonify({"alerts": alerts})
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/restore-test', methods=['POST'])
def trigger_restore_test():
    """Trigger a test restore of the latest backup"""
    try:
        status = backup_manager.get_backup_status()
        recent_backups = status.get('recent_backups', [])
        
        if not recent_backups:
            return jsonify({"error": "No backups available"}), 404
        
        latest_backup = recent_backups[0]['backup_name']
        
        # Run test in background
        def run_test():
            success = backup_manager.verify_backup(latest_backup)
            if success:
                logger.info("Restore test successful")
            else:
                logger.error("Restore test failed")
                backup_manager._send_alert("Automated restore test failed")
        
        thread = threading.Thread(target=run_test)
        thread.start()
        
        return jsonify({
            "message": "Restore test started",
            "backup_name": latest_backup
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/recovery-time')
def estimate_recovery_time():
    """Estimate recovery time based on backup size and network speed"""
    try:
        status = backup_manager.get_backup_status()
        
        if not status.get('recent_backups'):
            return jsonify({"error": "No backups available"}), 404
        
        latest_backup = status['recent_backups'][0]
        size_gb = latest_backup['size_bytes'] / (1024**3)
        
        # Estimate based on different network speeds
        estimates = {
            "gigabit_network": {
                "download_time_minutes": round(size_gb * 8 / 60, 2),
                "restore_time_minutes": round(size_gb * 2, 2),  # Rough estimate
                "total_time_minutes": round(size_gb * 8 / 60 + size_gb * 2, 2)
            },
            "100mbps_network": {
                "download_time_minutes": round(size_gb * 80 / 60, 2),
                "restore_time_minutes": round(size_gb * 2, 2),
                "total_time_minutes": round(size_gb * 80 / 60 + size_gb * 2, 2)
            }
        }
        
        return jsonify({
            "backup_size_gb": round(size_gb, 2),
            "estimates": estimates,
            "note": "Times are estimates and may vary based on system load and other factors"
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    # Initialize backup manager
    init_backup_manager()
    
    # Start metrics updater thread
    metrics_thread = threading.Thread(target=metrics_updater, daemon=True)
    metrics_thread.start()
    
    # Run Flask app
    app.run(host='0.0.0.0', port=8090, debug=False)