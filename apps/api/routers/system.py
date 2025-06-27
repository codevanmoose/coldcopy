"""
System monitoring and health check endpoints.
"""
import logging
from typing import Any, Dict
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from core.security import require_permissions
from models.user import User
from utils.redis_manager import health_check_redis, redis_monitor, redis_pool
from workers.celery_app import celery_app

router = APIRouter()
logger = logging.getLogger(__name__)


class HealthCheckResponse(BaseModel):
    status: str
    timestamp: str
    services: Dict[str, Any]
    version: str = "1.0.0"


class SystemStatsResponse(BaseModel):
    redis: Dict[str, Any]
    celery: Dict[str, Any]
    system: Dict[str, Any]
    timestamp: str


@router.get("/health", response_model=HealthCheckResponse)
async def health_check():
    """Comprehensive system health check."""
    health_status = {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "services": {},
        "version": "1.0.0"
    }
    
    try:
        # Check Redis
        redis_health = await health_check_redis()
        health_status["services"]["redis"] = redis_health
        
        if redis_health["status"] != "healthy":
            health_status["status"] = "unhealthy"
        
        # Check Celery workers
        try:
            celery_inspect = celery_app.control.inspect()
            active_workers = celery_inspect.active()
            
            if active_workers:
                health_status["services"]["celery"] = {
                    "status": "healthy",
                    "active_workers": len(active_workers),
                    "worker_names": list(active_workers.keys())
                }
            else:
                health_status["services"]["celery"] = {
                    "status": "unhealthy",
                    "message": "No active Celery workers found"
                }
                health_status["status"] = "degraded"
        
        except Exception as e:
            health_status["services"]["celery"] = {
                "status": "unhealthy",
                "error": str(e)
            }
            health_status["status"] = "degraded"
        
        # Check database (basic connection test)
        try:
            from core.database import get_async_session
            async with get_async_session() as db:
                await db.execute("SELECT 1")
            
            health_status["services"]["database"] = {
                "status": "healthy"
            }
        
        except Exception as e:
            health_status["services"]["database"] = {
                "status": "unhealthy",
                "error": str(e)
            }
            health_status["status"] = "unhealthy"
        
        return HealthCheckResponse(**health_status)
        
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        health_status["status"] = "unhealthy"
        health_status["services"]["system"] = {
            "status": "unhealthy",
            "error": str(e)
        }
        
        return HealthCheckResponse(**health_status)


@router.get("/stats", response_model=SystemStatsResponse)
async def get_system_stats(
    current_user: User = Depends(require_permissions({"analytics:read"}))
):
    """Get detailed system statistics (admin only)."""
    
    try:
        stats = {
            "timestamp": datetime.utcnow().isoformat(),
            "redis": {},
            "celery": {},
            "system": {}
        }
        
        # Redis statistics
        try:
            redis_info = await redis_monitor.get_redis_info()
            memory_info = await redis_monitor.get_memory_usage()
            key_stats = await redis_monitor.get_key_statistics()
            pool_stats = await redis_pool.get_pool_stats()
            
            stats["redis"] = {
                "server_info": redis_info,
                "memory": memory_info,
                "keys": key_stats,
                "connection_pools": pool_stats,
                "cache_hit_ratio": await redis_monitor.get_cache_hit_ratio()
            }
        
        except Exception as e:
            stats["redis"] = {"error": str(e)}
        
        # Celery statistics
        try:
            celery_inspect = celery_app.control.inspect()
            
            stats["celery"] = {
                "active_tasks": celery_inspect.active(),
                "scheduled_tasks": celery_inspect.scheduled(),
                "reserved_tasks": celery_inspect.reserved(),
                "worker_stats": celery_inspect.stats(),
                "registered_tasks": list(celery_app.tasks.keys())
            }
        
        except Exception as e:
            stats["celery"] = {"error": str(e)}
        
        # System statistics
        try:
            import psutil
            import os
            
            stats["system"] = {
                "cpu_percent": psutil.cpu_percent(interval=1),
                "memory": {
                    "total": psutil.virtual_memory().total,
                    "available": psutil.virtual_memory().available,
                    "percent": psutil.virtual_memory().percent
                },
                "disk": {
                    "total": psutil.disk_usage('/').total,
                    "free": psutil.disk_usage('/').free,
                    "percent": psutil.disk_usage('/').percent
                },
                "load_average": os.getloadavg(),
                "process_count": len(psutil.pids())
            }
        
        except ImportError:
            stats["system"] = {"message": "psutil not available"}
        except Exception as e:
            stats["system"] = {"error": str(e)}
        
        return SystemStatsResponse(**stats)
        
    except Exception as e:
        logger.error(f"Error getting system stats: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting system statistics: {str(e)}"
        )


@router.get("/redis/info")
async def get_redis_info(
    current_user: User = Depends(require_permissions({"analytics:read"}))
):
    """Get detailed Redis information."""
    
    try:
        return {
            "server_info": await redis_monitor.get_redis_info(),
            "memory_usage": await redis_monitor.get_memory_usage(),
            "key_statistics": await redis_monitor.get_key_statistics(),
            "connection_pools": await redis_pool.get_pool_stats(),
            "cache_hit_ratio": await redis_monitor.get_cache_hit_ratio(),
            "slow_operations": await redis_monitor.analyze_slow_operations()
        }
        
    except Exception as e:
        logger.error(f"Error getting Redis info: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting Redis information: {str(e)}"
        )


@router.post("/redis/cleanup")
async def cleanup_redis_keys(
    current_user: User = Depends(require_permissions({"admin:write"}))
):
    """Clean up expired Redis keys (admin only)."""
    
    try:
        cleanup_results = await redis_monitor.cleanup_expired_keys()
        
        logger.info(f"Redis cleanup performed by user {current_user.id}: {cleanup_results}")
        
        return {
            "message": "Redis cleanup completed successfully",
            "cleanup_results": cleanup_results,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error cleaning up Redis keys: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error cleaning up Redis keys: {str(e)}"
        )


@router.get("/celery/workers")
async def get_celery_workers(
    current_user: User = Depends(require_permissions({"analytics:read"}))
):
    """Get Celery worker information."""
    
    try:
        celery_inspect = celery_app.control.inspect()
        
        return {
            "active_workers": celery_inspect.active(),
            "scheduled_tasks": celery_inspect.scheduled(),
            "reserved_tasks": celery_inspect.reserved(),
            "worker_stats": celery_inspect.stats(),
            "registered_tasks": list(celery_app.tasks.keys()),
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error getting Celery worker info: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting Celery worker information: {str(e)}"
        )


@router.post("/celery/purge")
async def purge_celery_queue(
    queue_name: str,
    current_user: User = Depends(require_permissions({"admin:write"}))
):
    """Purge a Celery queue (admin only)."""
    
    try:
        from celery import current_app
        
        # Purge the specified queue
        current_app.control.purge()
        
        logger.warning(f"Celery queue '{queue_name}' purged by user {current_user.id}")
        
        return {
            "message": f"Queue '{queue_name}' purged successfully",
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error purging Celery queue: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error purging Celery queue: {str(e)}"
        )


@router.get("/metrics")
async def get_system_metrics():
    """Get system metrics in Prometheus format."""
    
    try:
        metrics = []
        
        # Redis metrics
        try:
            redis_info = await redis_monitor.get_redis_info()
            memory_info = await redis_monitor.get_memory_usage()
            
            metrics.extend([
                f"redis_connected_clients {redis_info.get('connected_clients', 0)}",
                f"redis_used_memory_bytes {memory_info.get('used_memory_bytes', 0)}",
                f"redis_keyspace_hits_total {redis_info.get('keyspace_hits', 0)}",
                f"redis_keyspace_misses_total {redis_info.get('keyspace_misses', 0)}",
                f"redis_ops_per_sec {redis_info.get('instantaneous_ops_per_sec', 0)}",
                f"redis_cache_hit_ratio {await redis_monitor.get_cache_hit_ratio()}"
            ])
        
        except Exception as e:
            logger.error(f"Error collecting Redis metrics: {str(e)}")
        
        # Celery metrics
        try:
            celery_inspect = celery_app.control.inspect()
            active_tasks = celery_inspect.active()
            
            if active_tasks:
                total_active = sum(len(tasks) for tasks in active_tasks.values())
                metrics.append(f"celery_active_tasks {total_active}")
                metrics.append(f"celery_active_workers {len(active_tasks)}")
            else:
                metrics.extend([
                    "celery_active_tasks 0",
                    "celery_active_workers 0"
                ])
        
        except Exception as e:
            logger.error(f"Error collecting Celery metrics: {str(e)}")
        
        # System metrics
        try:
            import psutil
            
            metrics.extend([
                f"system_cpu_percent {psutil.cpu_percent(interval=1)}",
                f"system_memory_percent {psutil.virtual_memory().percent}",
                f"system_disk_percent {psutil.disk_usage('/').percent}",
                f"system_process_count {len(psutil.pids())}"
            ])
        
        except ImportError:
            pass
        except Exception as e:
            logger.error(f"Error collecting system metrics: {str(e)}")
        
        # Return metrics in Prometheus format
        return "\n".join(metrics)
        
    except Exception as e:
        logger.error(f"Error generating metrics: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating metrics: {str(e)}"
        )