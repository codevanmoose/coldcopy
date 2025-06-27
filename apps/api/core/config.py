"""
Application configuration using Pydantic settings.
"""
from functools import lru_cache
from typing import Optional

from pydantic import Field, PostgresDsn, RedisDsn
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings."""
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )

    # Environment
    ENVIRONMENT: str = Field(default="development", description="Environment name")
    DEBUG: bool = Field(default=False, description="Debug mode")
    
    # Server
    HOST: str = Field(default="0.0.0.0", description="Server host")
    PORT: int = Field(default=8000, description="Server port")
    
    # Security
    SECRET_KEY: str = Field(..., description="Application secret key")
    ALLOWED_HOSTS: str = Field(default="*", description="Allowed hosts (comma-separated)")
    ALLOWED_ORIGINS: str = Field(
        default="http://localhost:3000,http://127.0.0.1:3000",
        description="Allowed CORS origins (comma-separated)"
    )
    
    # Database
    DATABASE_URL: PostgresDsn = Field(..., description="PostgreSQL database URL")
    DATABASE_POOL_SIZE: int = Field(default=10, description="Database connection pool size")
    DATABASE_MAX_OVERFLOW: int = Field(default=20, description="Database max overflow connections")
    
    # Redis
    REDIS_URL: RedisDsn = Field(..., description="Redis URL for caching and sessions")
    REDIS_POOL_SIZE: int = Field(default=10, description="Redis connection pool size")
    
    # Supabase
    SUPABASE_URL: str = Field(..., description="Supabase project URL")
    SUPABASE_ANON_KEY: str = Field(..., description="Supabase anonymous key")
    SUPABASE_SERVICE_ROLE_KEY: str = Field(..., description="Supabase service role key")
    
    # AWS Services
    AWS_ACCESS_KEY_ID: str = Field(..., description="AWS access key ID")
    AWS_SECRET_ACCESS_KEY: str = Field(..., description="AWS secret access key")
    AWS_REGION: str = Field(default="us-east-1", description="AWS region")
    
    # Amazon SES
    SES_FROM_EMAIL: str = Field(..., description="Default from email address")
    SES_CONFIGURATION_SET: Optional[str] = Field(default=None, description="SES configuration set")
    
    # Webhook Configuration
    VERIFY_WEBHOOK_SIGNATURES: bool = Field(default=True, description="Verify webhook signatures")
    AWS_SNS_SECRET: Optional[str] = Field(default=None, description="AWS SNS webhook secret")
    SENDGRID_WEBHOOK_KEY: Optional[str] = Field(default=None, description="SendGrid webhook verification key")
    MAILGUN_WEBHOOK_KEY: Optional[str] = Field(default=None, description="Mailgun webhook signing key")
    POSTMARK_WEBHOOK_KEY: Optional[str] = Field(default=None, description="Postmark webhook secret")
    
    # Digital Ocean Spaces
    DO_SPACES_REGION: str = Field(..., description="Digital Ocean Spaces region")
    DO_SPACES_BUCKET: str = Field(..., description="Digital Ocean Spaces bucket name")
    DO_SPACES_ENDPOINT: str = Field(..., description="Digital Ocean Spaces endpoint")
    
    # AI Services
    OPENAI_API_KEY: str = Field(..., description="OpenAI API key")
    ANTHROPIC_API_KEY: str = Field(..., description="Anthropic API key")
    
    # Celery
    CELERY_BROKER_URL: str = Field(..., description="Celery broker URL (Redis)")
    CELERY_RESULT_BACKEND: str = Field(..., description="Celery result backend (Redis)")
    
    # Rate Limiting
    RATE_LIMIT_PER_MINUTE: int = Field(default=60, description="API rate limit per minute")
    RATE_LIMIT_BURST: int = Field(default=100, description="API rate limit burst")
    
    # Email Settings
    EMAIL_BATCH_SIZE: int = Field(default=100, description="Email batch size for sending")
    EMAIL_RETRY_ATTEMPTS: int = Field(default=3, description="Email retry attempts")
    EMAIL_RETRY_DELAY: int = Field(default=60, description="Email retry delay in seconds")
    
    # Token Limits
    DEFAULT_TOKEN_LIMIT: int = Field(default=10000, description="Default monthly token limit")
    TOKEN_BUFFER_PERCENTAGE: float = Field(default=0.1, description="Token usage buffer percentage")
    
    # GDPR Settings
    DATA_RETENTION_DAYS: int = Field(default=2555, description="Default data retention period (7 years)")
    GDPR_REQUEST_EXPIRY_DAYS: int = Field(default=30, description="GDPR request expiry period")
    
    # Monitoring
    SENTRY_DSN: Optional[str] = Field(default=None, description="Sentry DSN for error tracking")
    LOG_LEVEL: str = Field(default="INFO", description="Logging level")


@lru_cache()
def get_settings() -> Settings:
    """Get cached application settings."""
    return Settings()