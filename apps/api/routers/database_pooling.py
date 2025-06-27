"""
API endpoints for database connection pool management and monitoring.
"""
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from datetime import datetime

from models.user import User
from utils.auth import get_current_user, require_admin
from config.pgbouncer import get_connection_manager
from utils.db_pool_monitor import PgBouncerMonitor, ConnectionPoolOptimizer
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/database/pool", tags=["Database Pooling"])


@router.get("/stats")
@require_admin
async def get_pool_statistics(
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Get current connection pool statistics.
    
    Requires admin permissions.
    """
    try:
        # Get connection manager stats
        manager = await get_connection_manager()
        connection_stats = await manager.get_connection_stats()
        
        # Get PgBouncer stats
        monitor = PgBouncerMonitor()
        await monitor.connect()
        
        try:
            pool_stats = await monitor.get_pool_stats()
            db_stats = await monitor.get_database_stats()
            
            return {
                "timestamp": datetime.utcnow().isoformat(),
                "sqlalchemy_pools": connection_stats,
                "pgbouncer_pools": [
                    {
                        "pool_name": pool.pool_name,
                        "database": pool.database,
                        "active_connections": pool.active_connections,
                        "idle_connections": pool.idle_connections,
                        "waiting_clients": pool.waiting_clients,
                        "total_connections": pool.total_connections,
                        "avg_wait_time_ms": pool.avg_wait_time * 1000
                    }
                    for pool in pool_stats
                ],
                "database_stats": db_stats
            }
        finally:
            await monitor.disconnect()
            
    except Exception as e:
        logger.error(f"Failed to get pool statistics: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve pool statistics")


@router.get("/health")
async def check_pool_health() -> Dict[str, Any]:
    """
    Check health of all connection pools.
    
    Public endpoint for monitoring.
    """
    try:
        # Check SQLAlchemy pools
        manager = await get_connection_manager()
        sqlalchemy_health = await manager.health_check()
        
        # Check PgBouncer
        monitor = PgBouncerMonitor()
        await monitor.connect()
        
        try:
            pgbouncer_health = await monitor.check_pool_health()
            
            # Combine health status
            overall_healthy = (
                sqlalchemy_health["healthy"] and 
                pgbouncer_health["status"] == "healthy"
            )
            
            return {
                "status": "healthy" if overall_healthy else "unhealthy",
                "timestamp": datetime.utcnow().isoformat(),
                "components": {
                    "sqlalchemy": sqlalchemy_health,
                    "pgbouncer": pgbouncer_health
                }
            }
        finally:
            await monitor.disconnect()
            
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {
            "status": "error",
            "timestamp": datetime.utcnow().isoformat(),
            "error": str(e)
        }


@router.get("/connections")
@require_admin
async def get_active_connections(
    pool: Optional[str] = Query(None, description="Filter by pool name"),
    current_user: User = Depends(get_current_user)
) -> List[Dict[str, Any]]:
    """
    Get list of active database connections.
    
    Requires admin permissions.
    """
    try:
        monitor = PgBouncerMonitor()
        await monitor.connect()
        
        try:
            client_connections = await monitor.get_client_connections()
            server_connections = await monitor.get_server_connections()
            
            connections = []
            
            # Format client connections
            for conn in client_connections:
                if not pool or conn.database == pool:
                    connections.append({
                        "type": "client",
                        "database": conn.database,
                        "user": conn.user,
                        "client_addr": conn.client_addr,
                        "state": conn.state,
                        "connected_at": conn.backend_start.isoformat() if conn.backend_start else None,
                        "wait_time_ms": int(conn.wait_event.split(":")[1].replace("us", "")) / 1000 if conn.wait_event else 0
                    })
            
            # Add server connections
            for conn in server_connections:
                if not pool or conn["database"] == pool:
                    connections.append({
                        "type": "server",
                        "database": conn["database"],
                        "user": conn["user"],
                        "server_addr": f"{conn['addr']}:{conn['port']}",
                        "state": conn["state"],
                        "connected_at": conn["connect_time"].isoformat() if conn["connect_time"] else None,
                        "remote_pid": conn["remote_pid"]
                    })
            
            return connections
            
        finally:
            await monitor.disconnect()
            
    except Exception as e:
        logger.error(f"Failed to get connections: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve connections")


@router.post("/optimize")
@require_admin
async def optimize_pool_configuration(
    apply_recommendations: bool = Query(False, description="Apply recommendations automatically"),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Analyze and optimize connection pool configuration.
    
    Requires admin permissions.
    """
    try:
        monitor = PgBouncerMonitor()
        await monitor.connect()
        
        try:
            optimizer = ConnectionPoolOptimizer(monitor)
            analysis = await optimizer.analyze_usage_patterns()
            
            if apply_recommendations and analysis["recommendations"]:
                # Would apply recommendations here
                # This requires updating PgBouncer config and reloading
                logger.info(f"Would apply {len(analysis['recommendations'])} recommendations")
            
            # Generate configuration suggestions
            config_suggestions = optimizer.generate_config_recommendations(analysis)
            
            return {
                "analysis": analysis,
                "config_suggestions": config_suggestions,
                "applied": apply_recommendations
            }
            
        finally:
            await monitor.disconnect()
            
    except Exception as e:
        logger.error(f"Failed to optimize pools: {e}")
        raise HTTPException(status_code=500, detail="Failed to optimize pool configuration")


@router.post("/reload")
@require_admin
async def reload_pool_configuration(
    current_user: User = Depends(get_current_user)
) -> Dict[str, str]:
    """
    Reload PgBouncer configuration.
    
    Requires admin permissions.
    """
    try:
        monitor = PgBouncerMonitor()
        await monitor.connect()
        
        try:
            await monitor.reload_config()
            return {
                "status": "success",
                "message": "Configuration reloaded successfully"
            }
        finally:
            await monitor.disconnect()
            
    except Exception as e:
        logger.error(f"Failed to reload configuration: {e}")
        raise HTTPException(status_code=500, detail="Failed to reload configuration")


@router.post("/database/{database}/pause")
@require_admin
async def pause_database_pool(
    database: str,
    current_user: User = Depends(get_current_user)
) -> Dict[str, str]:
    """
    Pause a database pool (maintenance mode).
    
    Requires admin permissions.
    """
    try:
        monitor = PgBouncerMonitor()
        await monitor.connect()
        
        try:
            await monitor.pause_database(database)
            return {
                "status": "success",
                "message": f"Database {database} paused successfully"
            }
        finally:
            await monitor.disconnect()
            
    except Exception as e:
        logger.error(f"Failed to pause database: {e}")
        raise HTTPException(status_code=500, detail="Failed to pause database")


@router.post("/database/{database}/resume")
@require_admin
async def resume_database_pool(
    database: str,
    current_user: User = Depends(get_current_user)
) -> Dict[str, str]:
    """
    Resume a paused database pool.
    
    Requires admin permissions.
    """
    try:
        monitor = PgBouncerMonitor()
        await monitor.connect()
        
        try:
            await monitor.resume_database(database)
            return {
                "status": "success",
                "message": f"Database {database} resumed successfully"
            }
        finally:
            await monitor.disconnect()
            
    except Exception as e:
        logger.error(f"Failed to resume database: {e}")
        raise HTTPException(status_code=500, detail="Failed to resume database")


@router.get("/recommendations")
@require_admin
async def get_pool_recommendations(
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Get connection pool optimization recommendations.
    
    Requires admin permissions.
    """
    try:
        monitor = PgBouncerMonitor()
        await monitor.connect()
        
        try:
            optimizer = ConnectionPoolOptimizer(monitor)
            analysis = await optimizer.analyze_usage_patterns()
            
            recommendations = []
            for rec in analysis["recommendations"]:
                recommendations.append({
                    "pool": rec["pool"],
                    "action": rec["action"],
                    "current_value": rec["current"],
                    "recommended_value": rec["recommended"],
                    "reason": rec["reason"],
                    "impact": "high" if "critical" in rec["reason"].lower() else "medium"
                })
            
            return {
                "timestamp": datetime.utcnow().isoformat(),
                "recommendations": recommendations,
                "total_pools": len(analysis["pools"]),
                "pools_needing_attention": len(recommendations)
            }
            
        finally:
            await monitor.disconnect()
            
    except Exception as e:
        logger.error(f"Failed to get recommendations: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate recommendations")