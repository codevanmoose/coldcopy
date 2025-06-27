# ColdCopy API

FastAPI backend for the ColdCopy AI-powered cold outreach automation platform.

## Overview

This is the FastAPI backend that powers ColdCopy's core functionality including:

- User authentication and workspace management
- Campaign creation and management
- Lead management with enrichment capabilities
- GDPR compliance features
- Email sending and tracking
- Background job processing with Celery

## Tech Stack

- **FastAPI** - Modern, fast web framework for building APIs
- **SQLAlchemy** - SQL toolkit and ORM with async support
- **PostgreSQL** - Primary database with JSONB support
- **Redis** - Caching and Celery message broker
- **Celery** - Distributed task queue for background jobs
- **Pydantic** - Data validation using Python type annotations
- **Alembic** - Database migration tool
- **Amazon SES** - Email sending service
- **AWS S3/Digital Ocean Spaces** - File storage

## Quick Start

### Prerequisites

- Python 3.11+
- PostgreSQL 13+
- Redis 6+
- Docker (optional)

### Local Development

1. **Clone and navigate to the API directory:**
   ```bash
   cd apps/api
   ```

2. **Create and activate virtual environment:**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements-dev.txt
   ```

4. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

5. **Run database migrations:**
   ```bash
   alembic upgrade head
   ```

6. **Start the development server:**
   ```bash
   uvicorn main:app --reload
   ```

The API will be available at `http://localhost:8000`

### Docker Development

1. **Start all services:**
   ```bash
   docker-compose up -d
   ```

2. **Run migrations:**
   ```bash
   docker-compose exec api alembic upgrade head
   ```

The API will be available at `http://localhost:8000`

## Project Structure

```
apps/api/
├── alembic/                # Database migrations
├── core/                   # Core application modules
│   ├── config.py          # Configuration management
│   ├── database.py        # Database setup and session management
│   └── security.py        # Authentication and security utilities
├── models/                 # SQLAlchemy models and Pydantic schemas
│   ├── user.py            # User model and schemas
│   ├── workspace.py       # Workspace model and schemas
│   ├── campaign.py        # Campaign model and schemas
│   ├── lead.py            # Lead model and schemas
│   ├── email_event.py     # Email event model and schemas
│   └── gdpr.py            # GDPR compliance models and schemas
├── routers/               # API route handlers
│   ├── auth.py            # Authentication endpoints
│   ├── campaigns.py       # Campaign management endpoints
│   ├── leads.py           # Lead management endpoints
│   ├── workspaces.py      # Workspace management endpoints
│   ├── gdpr.py            # GDPR compliance endpoints
│   └── health.py          # Health check endpoints
├── services/              # Business logic layer
│   ├── user_service.py    # User business logic
│   ├── campaign_service.py # Campaign business logic
│   ├── lead_service.py    # Lead business logic
│   ├── workspace_service.py # Workspace business logic
│   └── gdpr_service.py    # GDPR compliance business logic
├── workers/               # Celery background tasks
│   ├── celery_app.py      # Celery application configuration
│   ├── email_tasks.py     # Email sending tasks
│   ├── enrichment_tasks.py # Lead enrichment tasks
│   └── gdpr_tasks.py      # GDPR compliance tasks
├── utils/                 # Utility functions and helpers
│   ├── email_client.py    # Email sending utilities
│   └── enrichment_client.py # Lead enrichment utilities
├── tests/                 # Test suite
├── main.py               # FastAPI application entry point
├── requirements.txt      # Production dependencies
├── requirements-dev.txt  # Development dependencies
├── Dockerfile           # Docker container configuration
└── docker-compose.yml   # Docker Compose for local development
```

## Configuration

The application uses environment variables for configuration. Key variables include:

### Database
- `DATABASE_URL` - PostgreSQL connection string
- `DATABASE_POOL_SIZE` - Connection pool size (default: 10)

### Redis
- `REDIS_URL` - Redis connection string
- `CELERY_BROKER_URL` - Celery broker URL (usually same as Redis)

### Security
- `SECRET_KEY` - Application secret key for JWT tokens
- `ALLOWED_ORIGINS` - CORS allowed origins

### AWS/Email
- `AWS_ACCESS_KEY_ID` - AWS access key
- `AWS_SECRET_ACCESS_KEY` - AWS secret key
- `SES_FROM_EMAIL` - Default sender email address

### AI Services
- `OPENAI_API_KEY` - OpenAI API key for AI features
- `ANTHROPIC_API_KEY` - Anthropic API key for AI features

See `.env.example` for a complete list of configuration options.

## API Endpoints

### Authentication
- `POST /auth/login` - User login
- `GET /auth/me` - Get current user info
- `POST /auth/logout` - User logout

### Workspaces
- `GET /workspaces/current` - Get current workspace
- `PUT /workspaces/current` - Update current workspace

### Campaigns
- `GET /campaigns/` - List campaigns
- `POST /campaigns/` - Create campaign
- `GET /campaigns/{id}` - Get campaign details
- `PUT /campaigns/{id}` - Update campaign
- `DELETE /campaigns/{id}` - Delete campaign

### Leads
- `GET /leads/` - List leads
- `POST /leads/` - Create lead
- `GET /leads/{id}` - Get lead details
- `PUT /leads/{id}` - Update lead
- `DELETE /leads/{id}` - Delete lead
- `POST /leads/{id}/enrich` - Trigger lead enrichment

### GDPR Compliance
- `POST /gdpr/consent` - Record consent
- `GET /gdpr/consent/check` - Check consent status
- `POST /gdpr/requests` - Create data subject request
- `GET /gdpr/export` - Export personal data
- `DELETE /gdpr/data` - Delete personal data

### Health Checks
- `GET /health/` - Basic health check
- `GET /health/detailed` - Detailed health with dependencies
- `GET /health/readiness` - Kubernetes readiness probe
- `GET /health/liveness` - Kubernetes liveness probe

## Background Tasks

The application uses Celery for background task processing:

### Email Tasks
- Email batch sending
- Email webhook processing
- Email event cleanup

### Enrichment Tasks
- Lead data enrichment
- Bulk lead enrichment
- Enrichment cache management

### GDPR Tasks
- Data deletion request processing
- Data export generation
- Data retention policy enforcement
- Compliance auditing

### Running Celery Workers

```bash
# Start worker
celery -A workers.celery_app worker --loglevel=info

# Start beat scheduler
celery -A workers.celery_app beat --loglevel=info

# Monitor tasks
celery -A workers.celery_app flower
```

## Database Management

### Migrations

Create a new migration:
```bash
alembic revision --autogenerate -m "Description of changes"
```

Apply migrations:
```bash
alembic upgrade head
```

Rollback migration:
```bash
alembic downgrade -1
```

### Key Database Features

- **Multi-tenancy**: All data is isolated by workspace_id
- **JSONB Fields**: Flexible schema for lead enrichment data and settings
- **Partitioned Tables**: Email events table partitioned by date
- **Indexes**: Optimized for workspace-based queries
- **GDPR Compliance**: Built-in data retention and deletion capabilities

## Testing

Run the test suite:

```bash
# All tests
pytest

# Unit tests only
pytest tests/unit

# Integration tests only
pytest tests/integration

# With coverage
pytest --cov=. --cov-report=html
```

## Code Quality

The project uses several tools for code quality:

```bash
# Format code
black .

# Lint code
ruff check .

# Type checking
mypy .

# Run all checks
pre-commit run --all-files
```

## Deployment

### Production Deployment

1. Build Docker image:
   ```bash
   docker build -t coldcopy-api .
   ```

2. Run with production settings:
   ```bash
   docker run -p 8000:8000 --env-file .env.production coldcopy-api
   ```

### Environment Variables for Production

Ensure these are set in production:
- `ENVIRONMENT=production`
- `DEBUG=False`
- Strong `SECRET_KEY`
- Production database URLs
- AWS credentials for SES
- Monitoring configuration (Sentry, etc.)

## Monitoring and Logging

The application includes:
- Structured logging with structlog
- Health check endpoints for monitoring
- Optional Sentry integration for error tracking
- Prometheus metrics (can be added)

## Security Features

- JWT-based authentication
- Password hashing with bcrypt
- CORS protection
- Rate limiting
- SQL injection protection via SQLAlchemy
- Input validation with Pydantic
- GDPR compliance features

## Contributing

1. Follow the coding standards (Black, Ruff, MyPy)
2. Write tests for new features
3. Update documentation
4. Ensure all CI checks pass

## License

MIT License - see LICENSE file for details.