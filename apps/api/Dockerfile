FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY apps/api/requirements-do.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements-do.txt

# Copy application code
COPY apps/api/ .

# Expose port
EXPOSE 8000

# Run the application
CMD ["uvicorn", "main_simple:app", "--host", "0.0.0.0", "--port", "8000"]