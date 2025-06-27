#!/bin/bash
# Build script for Digital Ocean App Platform

echo "Starting ColdCopy API build..."

# Navigate to API directory
cd apps/api

# Install dependencies
pip install -r requirements-do.txt

echo "Build completed successfully!"