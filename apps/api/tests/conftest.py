"""
Comprehensive pytest configuration and fixtures for ColdCopy API tests.
"""
import asyncio
import uuid
from datetime import datetime, timedelta
from typing import AsyncGenerator, Generator
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.pool import StaticPool

from main import app
from core.database import get_db, Base
from core.config import get_settings
from core.redis import get_cache_manager
from models.user import User
from models.workspace import Workspace
from models.campaign import Campaign
from models.lead import Lead
from models.email_event import EmailEvent

# Test database URL - using in-memory SQLite for speed
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture(scope="session")
def event_loop() -> Generator[asyncio.AbstractEventLoop, None, None]:
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
async def test_engine():
    """Create test database engine."""
    engine = create_async_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        echo=False,
    )
    
    # Create all tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    yield engine
    
    # Clean up
    await engine.dispose()


@pytest.fixture
async def test_session(test_engine) -> AsyncGenerator[AsyncSession, None]:
    """Create test database session."""
    async_session_factory = async_sessionmaker(
        test_engine, class_=AsyncSession, expire_on_commit=False
    )
    
    async with async_session_factory() as session:
        yield session
        await session.rollback()


@pytest.fixture
def mock_redis():
    """Mock Redis cache for testing."""
    mock_cache = AsyncMock()
    mock_cache.get = AsyncMock(return_value=None)
    mock_cache.set = AsyncMock(return_value=True)
    mock_cache.delete = AsyncMock(return_value=True)
    mock_cache.exists = AsyncMock(return_value=False)
    mock_cache.increment = AsyncMock(return_value=1)
    mock_cache.get_many = AsyncMock(return_value={})
    mock_cache.set_many = AsyncMock(return_value=True)
    
    # Mock rate limiting
    mock_cache.check_rate_limit = AsyncMock(return_value={
        "allowed": True,
        "current_usage": 1,
        "limit": 100,
        "reset_time": datetime.utcnow().isoformat(),
        "remaining": 99
    })
    
    # Mock Redis instance methods
    mock_cache.redis = AsyncMock()
    mock_cache.redis.keys = AsyncMock(return_value=[])
    
    return mock_cache


@pytest.fixture
def test_settings():
    """Override settings for testing."""
    settings = get_settings()
    settings.ENVIRONMENT = "test"
    settings.DEBUG = True
    settings.SECRET_KEY = "test-secret-key-super-long-and-secure-for-testing"
    settings.VERIFY_WEBHOOK_SIGNATURES = False
    return settings


@pytest.fixture
async def client(test_session: AsyncSession, mock_redis, test_settings) -> AsyncGenerator[AsyncClient, None]:
    """Create test HTTP client with mocked dependencies."""
    
    def override_get_db():
        yield test_session
    
    def override_get_cache():
        return mock_redis
    
    def override_get_settings():
        return test_settings
    
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_cache_manager] = override_get_cache
    app.dependency_overrides[get_settings] = override_get_settings
    
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac
    
    app.dependency_overrides.clear()


# Test data fixtures
@pytest.fixture
async def test_workspace(test_session):
    """Create test workspace."""
    workspace = Workspace(
        id=str(uuid.uuid4()),
        name="Test Workspace",
        domain="test.example.com",
        plan="pro",
        settings={
            "email_sending_enabled": True,
            "rate_limit_multiplier": 1.0
        },
        created_at=datetime.utcnow()
    )
    
    test_session.add(workspace)
    await test_session.commit()
    await test_session.refresh(workspace)
    
    return workspace


@pytest.fixture
async def test_user(test_session, test_workspace):
    """Create test user."""
    user = User(
        id=str(uuid.uuid4()),
        email="test@example.com",
        hashed_password="$2b$12$test.hashed.password",
        workspace_id=test_workspace.id,
        role="admin",
        is_active=True,
        email_verified=True,
        created_at=datetime.utcnow()
    )
    
    test_session.add(user)
    await test_session.commit()
    await test_session.refresh(user)
    
    return user


@pytest.fixture
async def test_campaign(test_session, test_workspace, test_user):
    """Create test campaign."""
    campaign = Campaign(
        id=str(uuid.uuid4()),
        name="Test Campaign",
        workspace_id=test_workspace.id,
        created_by=test_user.id,
        status="active",
        settings={
            "email_subject": "Test Subject {{first_name}}",
            "email_template": "Hello {{first_name}}, test email.",
            "daily_limit": 100
        },
        created_at=datetime.utcnow()
    )
    
    test_session.add(campaign)
    await test_session.commit()
    await test_session.refresh(campaign)
    
    return campaign


@pytest.fixture
async def test_lead(test_session, test_workspace, test_campaign):
    """Create test lead."""
    lead = Lead(
        id=str(uuid.uuid4()),
        email="lead@example.com",
        first_name="John",
        last_name="Doe",
        company="Example Corp",
        workspace_id=test_workspace.id,
        campaign_id=test_campaign.id,
        status="active",
        enrichment_data={
            "title": "VP of Sales",
            "linkedin": "https://linkedin.com/in/johndoe"
        },
        created_at=datetime.utcnow()
    )
    
    test_session.add(lead)
    await test_session.commit()
    await test_session.refresh(lead)
    
    return lead


@pytest.fixture
async def test_email_event(test_session, test_workspace, test_campaign, test_lead):
    """Create test email event."""
    email_event = EmailEvent(
        id=str(uuid.uuid4()),
        workspace_id=test_workspace.id,
        campaign_id=test_campaign.id,
        lead_id=test_lead.id,
        recipient_email=test_lead.email,
        subject="Test Email",
        status="sent",
        external_id="msg_123456",
        provider="ses",
        created_at=datetime.utcnow()
    )
    
    test_session.add(email_event)
    await test_session.commit()
    await test_session.refresh(email_event)
    
    return email_event


# Authentication fixtures
@pytest.fixture
def auth_headers():
    """Create authentication headers."""
    return {
        "Authorization": "Bearer mock.jwt.token",
        "API-Version": "v2",
        "Content-Type": "application/json"
    }


@pytest.fixture
def mock_auth():
    """Mock authentication for tests."""
    with patch('core.security.get_current_user') as mock_get_user:
        mock_user = MagicMock()
        mock_user.id = "test-user-id"
        mock_user.email = "test@example.com"
        mock_user.workspace_id = "test-workspace-id"
        mock_user.role = "admin"
        mock_user.is_active = True
        mock_get_user.return_value = mock_user
        yield mock_user


# Sample data fixtures
@pytest.fixture
def sample_lead_data():
    """Sample lead data for testing."""
    return {
        "email": "newlead@example.com",
        "first_name": "Jane",
        "last_name": "Smith", 
        "company": "Test Corp",
        "title": "CEO",
        "phone": "+1-555-123-4567"
    }


@pytest.fixture
def sample_campaign_data():
    """Sample campaign data for testing."""
    return {
        "name": "New Test Campaign",
        "description": "A test campaign for pytest",
        "settings": {
            "email_subject": "Test Subject {{first_name}}",
            "email_template": "Hello {{first_name}}, this is a test.",
            "daily_limit": 50
        }
    }


@pytest.fixture
def sample_email_data():
    """Sample email data for testing."""
    return {
        "to_email": "recipient@example.com",
        "subject": "Test Email Subject",
        "html_content": "<h1>Test Email</h1><p>This is a test.</p>",
        "template_variables": {
            "first_name": "John",
            "company": "Example Corp"
        }
    }


# Mock external services
@pytest.fixture
def mock_email_client():
    """Mock email client for testing."""
    mock_client = AsyncMock()
    mock_client.send_email = AsyncMock(return_value={
        "message_id": "msg_123456",
        "status": "sent",
        "provider": "ses"
    })
    return mock_client


@pytest.fixture
def mock_celery():
    """Mock Celery tasks for testing."""
    with patch('workers.email_tasks.send_email.delay') as mock_task:
        mock_task.return_value = MagicMock(id="task-123")
        yield mock_task


# Utility fixtures
@pytest.fixture
def api_utils(client):
    """API testing utilities."""
    class APIUtils:
        def __init__(self, test_client):
            self.client = test_client
        
        async def assert_success_response(self, response, expected_status=200):
            """Assert successful API response."""
            assert response.status_code == expected_status
            if response.headers.get("content-type", "").startswith("application/json"):
                data = response.json()
                assert "error" not in data or data.get("error") is None
            return response
        
        async def assert_error_response(self, response, expected_status, expected_error=None):
            """Assert error API response."""
            assert response.status_code == expected_status
            if expected_error:
                data = response.json()
                assert expected_error in str(data.get("detail", ""))
            return response
        
        async def make_authenticated_request(self, method, url, headers=None, **kwargs):
            """Make authenticated API request."""
            auth_headers = {
                "Authorization": "Bearer mock.jwt.token",
                "API-Version": "v2"
            }
            if headers:
                auth_headers.update(headers)
            
            return await self.client.request(method, url, headers=auth_headers, **kwargs)
    
    return APIUtils(client)


# Performance test data
@pytest.fixture
def performance_test_data():
    """Generate data for performance tests."""
    return {
        "bulk_leads": [
            {
                "email": f"test{i}@example.com",
                "first_name": f"User{i}",
                "last_name": "Test",
                "company": f"Company {i}"
            }
            for i in range(100)
        ]
    }