FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    postgresql-client \
    s3cmd \
    openssl \
    gzip \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create directories
RUN mkdir -p /app /var/log/coldcopy /tmp/coldcopy_backups /var/lib/postgresql/wal_archive

WORKDIR /app

# Copy requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY backup_manager.py .
COPY backup_monitor.py .
COPY restore_manager.py .

# Create non-root user
RUN useradd -m -u 1000 backup && \
    chown -R backup:backup /app /var/log/coldcopy /tmp/coldcopy_backups /var/lib/postgresql/wal_archive

USER backup

# Default command
CMD ["python", "backup_manager.py", "schedule"]