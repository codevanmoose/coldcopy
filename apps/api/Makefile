# ColdCopy API Development Makefile

.PHONY: help install test test-unit test-integration test-security test-performance lint typecheck format clean dev

# Default target
help:
	@echo "ColdCopy API Development Commands"
	@echo ""
	@echo "Setup:"
	@echo "  install         Install dependencies"
	@echo "  dev             Start development server"
	@echo ""
	@echo "Testing:"
	@echo "  test            Run all tests"
	@echo "  test-unit       Run unit tests only"
	@echo "  test-integration Run integration tests only"
	@echo "  test-security   Run security tests only"
	@echo "  test-performance Run performance tests only"
	@echo "  test-coverage   Run tests with coverage report"
	@echo ""
	@echo "Code Quality:"
	@echo "  lint            Run linting (ruff)"
	@echo "  typecheck       Run type checking (mypy)"
	@echo "  format          Format code (black + ruff)"
	@echo "  check           Run all quality checks"
	@echo ""
	@echo "Utilities:"
	@echo "  clean           Clean temporary files"
	@echo "  docs            Generate API documentation"

# Installation
install:
	pip install -r requirements.txt
	pip install -r requirements-dev.txt

# Development server
dev:
	uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Testing
test:
	python -m pytest tests/ -v

test-unit:
	python -m pytest tests/ -v -m "unit"

test-integration:
	python -m pytest tests/ -v -m "integration"

test-security:
	python -m pytest tests/ -v -m "security"

test-performance:
	python -m pytest tests/ -v -m "performance"

test-coverage:
	python -m pytest tests/ --cov=. --cov-report=html --cov-report=term-missing

test-specific:
	@if [ -z "$(FILE)" ]; then echo "Usage: make test-specific FILE=test_filename.py"; exit 1; fi
	python -m pytest tests/$(FILE) -v

# Code quality
lint:
	ruff check .

typecheck:
	mypy . --ignore-missing-imports

format:
	black .
	ruff check . --fix

check: lint typecheck
	@echo "All quality checks passed!"

# Documentation
docs:
	python -c "from utils.documentation import doc_generator; doc_generator.save_documentation('docs/api')"

# Utilities
clean:
	find . -type f -name "*.pyc" -delete
	find . -type d -name "__pycache__" -delete
	find . -type d -name "*.egg-info" -exec rm -rf {} +
	rm -rf .coverage htmlcov/ .pytest_cache/

# Docker
docker-build:
	docker build -t coldcopy-api .

docker-run:
	docker run -p 8000:8000 coldcopy-api

# Database
migrate:
	alembic upgrade head

migrate-create:
	@if [ -z "$(NAME)" ]; then echo "Usage: make migrate-create NAME=migration_name"; exit 1; fi
	alembic revision --autogenerate -m "$(NAME)"

# Production
prod-check: check test
	@echo "Production readiness check passed!"

# Quick development cycle
quick: format lint test-unit
	@echo "Quick development cycle completed!"