FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    git \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create non-root user
RUN useradd -m -u 1000 emailservice && \
    chown -R emailservice:emailservice /app

USER emailservice

# Default to running the reputation monitor
CMD ["python", "reputation_monitor.py"]

# Expose ports
EXPOSE 8091 8092 8093