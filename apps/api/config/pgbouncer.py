"""
PgBouncer configuration and connection management for FastAPI.
"""
import os
from typing import Optional, Dict, Any
from dataclasses import dataclass
import asyncpg
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool, QueuePool
import logging

logger = logging.getLogger(__name__)


@dataclass
class PgBouncerConfig:
    """PgBouncer connection configuration."""
    
    # Connection settings
    host: str = os.getenv("PGBOUNCER_HOST", "localhost")
    port: int = int(os.getenv("PGBOUNCER_PORT", "6432"))
    
    # Database pools
    main_db: str = os.getenv("PGBOUNCER_MAIN_DB", "coldcopy_main")
    analytics_db: str = os.getenv("PGBOUNCER_ANALYTICS_DB", "coldcopy_analytics")
    jobs_db: str = os.getenv("PGBOUNCER_JOBS_DB", "coldcopy_jobs")
    replica_db: str = os.getenv("PGBOUNCER_REPLICA_DB", "coldcopy_replica")
    
    # Authentication
    user: str = os.getenv("PGBOUNCER_USER", "app_user")
    password: str = os.getenv("PGBOUNCER_PASSWORD", "")
    
    # Pool settings
    pool_size: int = int(os.getenv("PGBOUNCER_POOL_SIZE", "20"))
    max_overflow: int = int(os.getenv("PGBOUNCER_MAX_OVERFLOW", "10"))
    pool_timeout: int = int(os.getenv("PGBOUNCER_POOL_TIMEOUT", "30"))
    pool_recycle: int = int(os.getenv("PGBOUNCER_POOL_RECYCLE", "3600"))
    
    # Connection settings
    connect_timeout: int = int(os.getenv("PGBOUNCER_CONNECT_TIMEOUT", "10"))
    command_timeout: int = int(os.getenv("PGBOUNCER_COMMAND_TIMEOUT", "10"))
    
    # SSL settings
    sslmode: str = os.getenv("PGBOUNCER_SSLMODE", "prefer")
    sslcert: Optional[str] = os.getenv("PGBOUNCER_SSLCERT")
    sslkey: Optional[str] = os.getenv("PGBOUNCER_SSLKEY")
    sslrootcert: Optional[str] = os.getenv("PGBOUNCER_SSLROOTCERT")
    
    # Application settings
    application_name: str = os.getenv("APP_NAME", "coldcopy-api")
    
    def get_dsn(self, database: str = None) -> str:
        """Get PostgreSQL DSN for SQLAlchemy."""
        db = database or self.main_db
        return f"postgresql+asyncpg://{self.user}:{self.password}@{self.host}:{self.port}/{db}"
    
    def get_asyncpg_dsn(self, database: str = None) -> str:
        """Get PostgreSQL DSN for asyncpg."""
        db = database or self.main_db
        return f"postgresql://{self.user}:{self.password}@{self.host}:{self.port}/{db}"


class PgBouncerConnectionManager:
    """
    Manages database connections through PgBouncer with proper pooling.
    
    Features:
    - Multiple database pools (main, analytics, jobs, replica)
    - Automatic failover to replica
    - Connection health monitoring
    - Performance metrics
    """
    
    def __init__(self, config: PgBouncerConfig):
        self.config = config
        self._engines: Dict[str, Any] = {}
        self._sessions: Dict[str, sessionmaker] = {}
        self._initialized = False
    
    async def initialize(self):
        """Initialize database engines and session makers."""
        if self._initialized:
            return
        
        try:
            # Create main database engine
            self._engines["main"] = await self._create_engine(
                self.config.get_dsn(self.config.main_db),
                pool_size=self.config.pool_size,
                max_overflow=self.config.max_overflow
            )
            
            # Create analytics engine with larger pool
            self._engines["analytics"] = await self._create_engine(
                self.config.get_dsn(self.config.analytics_db),
                pool_size=self.config.pool_size * 2,  # More connections for analytics
                max_overflow=self.config.max_overflow * 2
            )
            
            # Create jobs engine
            self._engines["jobs"] = await self._create_engine(
                self.config.get_dsn(self.config.jobs_db),
                pool_size=self.config.pool_size // 2,  # Fewer connections for jobs
                max_overflow=self.config.max_overflow // 2
            )
            
            # Create read replica engine (if configured)
            if self.config.replica_db:
                self._engines["replica"] = await self._create_engine(
                    self.config.get_dsn(self.config.replica_db),
                    pool_size=self.config.pool_size,
                    max_overflow=self.config.max_overflow
                )
            
            # Create session makers
            for name, engine in self._engines.items():
                self._sessions[name] = sessionmaker(
                    bind=engine,
                    class_=AsyncSession,
                    expire_on_commit=False
                )
            
            self._initialized = True
            logger.info("PgBouncer connection manager initialized")
            
        except Exception as e:
            logger.error(f"Failed to initialize PgBouncer connections: {e}")
            raise
    
    async def _create_engine(self, dsn: str, pool_size: int, max_overflow: int):
        """Create SQLAlchemy async engine with proper pooling."""
        return create_async_engine(
            dsn,
            pool_size=pool_size,
            max_overflow=max_overflow,
            pool_timeout=self.config.pool_timeout,
            pool_recycle=self.config.pool_recycle,
            pool_pre_ping=True,  # Verify connections before use
            connect_args={
                "server_settings": {
                    "application_name": self.config.application_name,
                    "jit": "off"  # Disable JIT for more predictable performance
                },
                "command_timeout": self.config.command_timeout,
                "timeout": self.config.connect_timeout,
            }
        )
    
    async def get_session(self, pool: str = "main") -> AsyncSession:
        """
        Get database session from specific pool.
        
        Args:
            pool: Pool name (main, analytics, jobs, replica)
            
        Returns:
            AsyncSession instance
        """
        if not self._initialized:
            await self.initialize()
        
        if pool not in self._sessions:
            raise ValueError(f"Unknown pool: {pool}")
        
        return self._sessions[pool]()
    
    async def get_read_session(self) -> AsyncSession:
        """Get session for read operations (prefers replica if available)."""
        if "replica" in self._sessions:
            try:
                return await self.get_session("replica")
            except Exception as e:
                logger.warning(f"Failed to get replica session, falling back to main: {e}")
        
        return await self.get_session("main")
    
    async def get_analytics_session(self) -> AsyncSession:
        """Get session optimized for analytics queries."""
        return await self.get_session("analytics")
    
    async def get_job_session(self) -> AsyncSession:
        """Get session for background job processing."""
        return await self.get_session("jobs")
    
    async def health_check(self) -> Dict[str, Any]:
        """Perform health check on all connection pools."""
        health_status = {
            "healthy": True,
            "pools": {}
        }
        
        for pool_name, engine in self._engines.items():
            try:
                # Test connection
                async with engine.connect() as conn:
                    result = await conn.execute("SELECT 1")
                    await result.fetchone()
                
                # Get pool stats
                pool = engine.pool
                health_status["pools"][pool_name] = {
                    "status": "healthy",
                    "size": pool.size(),
                    "checked_in": pool.checkedin(),
                    "checked_out": pool.checkedout(),
                    "overflow": pool.overflow(),
                    "total": pool.total()
                }
                
            except Exception as e:
                health_status["healthy"] = False
                health_status["pools"][pool_name] = {
                    "status": "unhealthy",
                    "error": str(e)
                }
        
        return health_status
    
    async def get_connection_stats(self) -> Dict[str, Any]:
        """Get detailed connection statistics."""
        stats = {}
        
        for pool_name, engine in self._engines.items():
            pool = engine.pool
            stats[pool_name] = {
                "size": pool.size(),
                "checked_in": pool.checkedin(),
                "checked_out": pool.checkedout(),
                "overflow": pool.overflow(),
                "total": pool.total(),
                "max_overflow": self.config.max_overflow,
                "pool_size": self.config.pool_size
            }
        
        return stats
    
    async def close(self):
        """Close all database connections."""
        for name, engine in self._engines.items():
            await engine.dispose()
            logger.info(f"Closed {name} connection pool")
        
        self._engines.clear()
        self._sessions.clear()
        self._initialized = False


# Global instances
_pgbouncer_config: Optional[PgBouncerConfig] = None
_connection_manager: Optional[PgBouncerConnectionManager] = None


def get_pgbouncer_config() -> PgBouncerConfig:
    """Get PgBouncer configuration."""
    global _pgbouncer_config
    if not _pgbouncer_config:
        _pgbouncer_config = PgBouncerConfig()
    return _pgbouncer_config


async def get_connection_manager() -> PgBouncerConnectionManager:
    """Get PgBouncer connection manager."""
    global _connection_manager
    if not _connection_manager:
        config = get_pgbouncer_config()
        _connection_manager = PgBouncerConnectionManager(config)
        await _connection_manager.initialize()
    return _connection_manager


async def get_db_session(pool: str = "main") -> AsyncSession:
    """Get database session from connection pool."""
    manager = await get_connection_manager()
    return await manager.get_session(pool)


async def close_connections():
    """Close all database connections."""
    global _connection_manager
    if _connection_manager:
        await _connection_manager.close()
        _connection_manager = None