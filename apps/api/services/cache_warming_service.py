"""
Advanced cache warming service for proactive cache population.

This service implements various strategies to keep frequently accessed data
in cache, reducing latency and database load.
"""
import asyncio
import logging
from typing import List, Dict, Any, Optional, Set
from datetime import datetime, timedelta
from dataclasses import dataclass
from enum import Enum

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from models.workspace import Workspace
from models.campaign import Campaign
from models.lead import Lead
from models.user import User
from utils.cache_manager import CacheManager, CacheNamespace, get_cache
from services.analytics_service import AnalyticsService
from services.campaign_service import CampaignService
from services.lead_service import LeadService
from core.database import get_db

logger = logging.getLogger(__name__)


class WarmingStrategy(Enum):
    """Cache warming strategies"""
    POPULAR = "popular"  # Most accessed items
    RECENT = "recent"   # Recently created/modified items
    PREDICTIVE = "predictive"  # Based on access patterns
    SCHEDULED = "scheduled"  # Time-based warming
    PRIORITY = "priority"  # High-priority workspaces/users


@dataclass
class WarmingTask:
    """Represents a cache warming task"""
    strategy: WarmingStrategy
    namespace: CacheNamespace
    priority: int  # 1-10, higher is more important
    data_fetcher: callable
    key_generator: callable
    ttl: int
    batch_size: int = 100


class CacheWarmingService:
    """
    Advanced cache warming service with multiple strategies.
    """
    
    def __init__(
        self,
        cache_manager: Optional[CacheManager] = None,
        db_session: Optional[AsyncSession] = None
    ):
        self.cache = cache_manager
        self.db = db_session
        self.warming_tasks: List[WarmingTask] = []
        self.access_patterns: Dict[str, List[datetime]] = {}
        self.is_running = False
        self._background_task = None
        
    async def initialize(self):
        """Initialize the warming service"""
        if not self.cache:
            self.cache = await get_cache()
            
        # Register warming tasks
        self._register_warming_tasks()
        
        logger.info("Cache warming service initialized")
    
    def _register_warming_tasks(self):
        """Register all cache warming tasks"""
        
        # Analytics warming - high priority
        self.warming_tasks.append(WarmingTask(
            strategy=WarmingStrategy.POPULAR,
            namespace=CacheNamespace.ANALYTICS,
            priority=9,
            data_fetcher=self._fetch_popular_analytics,
            key_generator=self._generate_analytics_key,
            ttl=300,  # 5 minutes
            batch_size=50
        ))
        
        # Campaign data warming
        self.warming_tasks.append(WarmingTask(
            strategy=WarmingStrategy.RECENT,
            namespace=CacheNamespace.CAMPAIGN_STATS,
            priority=8,
            data_fetcher=self._fetch_recent_campaigns,
            key_generator=self._generate_campaign_key,
            ttl=600,  # 10 minutes
            batch_size=100
        ))
        
        # Lead enrichment warming
        self.warming_tasks.append(WarmingTask(
            strategy=WarmingStrategy.PREDICTIVE,
            namespace=CacheNamespace.LEAD_ENRICHMENT,
            priority=7,
            data_fetcher=self._fetch_predictive_leads,
            key_generator=self._generate_lead_key,
            ttl=86400,  # 24 hours
            batch_size=200
        ))
        
        # Workspace settings warming
        self.warming_tasks.append(WarmingTask(
            strategy=WarmingStrategy.PRIORITY,
            namespace=CacheNamespace.WORKSPACE_SETTINGS,
            priority=10,
            data_fetcher=self._fetch_priority_workspaces,
            key_generator=self._generate_workspace_key,
            ttl=3600,  # 1 hour
            batch_size=50
        ))
        
        # AI response patterns warming
        self.warming_tasks.append(WarmingTask(
            strategy=WarmingStrategy.SCHEDULED,
            namespace=CacheNamespace.AI_RESPONSES,
            priority=6,
            data_fetcher=self._fetch_common_ai_prompts,
            key_generator=self._generate_ai_key,
            ttl=3600,  # 1 hour
            batch_size=100
        ))
    
    async def start_background_warming(self, interval_seconds: int = 300):
        """Start background cache warming process"""
        if self.is_running:
            logger.warning("Cache warming already running")
            return
            
        self.is_running = True
        self._background_task = asyncio.create_task(
            self._background_warming_loop(interval_seconds)
        )
        logger.info(f"Started background cache warming with {interval_seconds}s interval")
    
    async def stop_background_warming(self):
        """Stop background cache warming"""
        self.is_running = False
        if self._background_task:
            self._background_task.cancel()
            try:
                await self._background_task
            except asyncio.CancelledError:
                pass
        logger.info("Stopped background cache warming")
    
    async def _background_warming_loop(self, interval: int):
        """Background loop for cache warming"""
        while self.is_running:
            try:
                await self.warm_all_caches()
                await asyncio.sleep(interval)
            except Exception as e:
                logger.error(f"Error in cache warming loop: {e}")
                await asyncio.sleep(60)  # Wait before retry
    
    async def warm_all_caches(self):
        """Execute all cache warming tasks"""
        logger.info("Starting cache warming cycle")
        
        # Sort tasks by priority
        sorted_tasks = sorted(self.warming_tasks, key=lambda t: t.priority, reverse=True)
        
        for task in sorted_tasks:
            try:
                await self._execute_warming_task(task)
            except Exception as e:
                logger.error(f"Failed to execute warming task {task.strategy}: {e}")
        
        logger.info("Cache warming cycle completed")
    
    async def _execute_warming_task(self, task: WarmingTask):
        """Execute a single warming task"""
        logger.debug(f"Executing {task.strategy} warming for {task.namespace}")
        
        # Fetch data using the task's fetcher
        data_items = await task.data_fetcher(task.batch_size)
        
        if not data_items:
            logger.debug(f"No data to warm for {task.strategy}")
            return
        
        # Warm cache in batches
        warmed_count = 0
        for item in data_items:
            try:
                key = task.key_generator(item)
                await self.cache.set(
                    key,
                    item,
                    ttl=task.ttl,
                    namespace=task.namespace
                )
                warmed_count += 1
            except Exception as e:
                logger.error(f"Failed to warm cache item: {e}")
        
        logger.info(f"Warmed {warmed_count} items for {task.strategy}")
    
    async def warm_workspace_cache(self, workspace_id: str):
        """Warm cache for a specific workspace"""
        logger.info(f"Warming cache for workspace {workspace_id}")
        
        if not self.db:
            async for db in get_db():
                self.db = db
                break
        
        # Warm analytics
        analytics_service = AnalyticsService(self.db)
        analytics_data = await analytics_service.get_workspace_metrics(workspace_id)
        
        await self.cache.set(
            f"dashboard:{workspace_id}",
            analytics_data,
            ttl=300,
            namespace=CacheNamespace.ANALYTICS
        )
        
        # Warm recent campaigns
        campaign_service = CampaignService(self.db)
        campaigns = await campaign_service.get_campaigns_by_workspace(workspace_id, limit=10)
        
        for campaign in campaigns:
            await self.cache.set(
                f"campaign_stats:{workspace_id}:{campaign.id}",
                campaign.dict(),
                ttl=600,
                namespace=CacheNamespace.CAMPAIGN_STATS
            )
        
        logger.info(f"Completed cache warming for workspace {workspace_id}")
    
    async def warm_user_cache(self, user_id: str):
        """Warm cache for a specific user"""
        logger.info(f"Warming cache for user {user_id}")
        
        if not self.db:
            async for db in get_db():
                self.db = db
                break
        
        # Get user's workspace
        user = await self.db.get(User, user_id)
        if user and user.workspace_id:
            await self.warm_workspace_cache(user.workspace_id)
    
    def track_access_pattern(self, key: str):
        """Track access patterns for predictive warming"""
        if key not in self.access_patterns:
            self.access_patterns[key] = []
        
        self.access_patterns[key].append(datetime.utcnow())
        
        # Keep only last 100 accesses
        if len(self.access_patterns[key]) > 100:
            self.access_patterns[key] = self.access_patterns[key][-100:]
    
    async def _fetch_popular_analytics(self, limit: int) -> List[Dict[str, Any]]:
        """Fetch most popular analytics data"""
        if not self.db:
            return []
            
        # Get workspaces with most activity
        query = select(Workspace).order_by(Workspace.updated_at.desc()).limit(limit)
        result = await self.db.execute(query)
        workspaces = result.scalars().all()
        
        analytics_data = []
        analytics_service = AnalyticsService(self.db)
        
        for workspace in workspaces:
            try:
                data = await analytics_service.get_workspace_metrics(workspace.id)
                analytics_data.append({
                    "workspace_id": workspace.id,
                    "data": data
                })
            except Exception as e:
                logger.error(f"Failed to fetch analytics for workspace {workspace.id}: {e}")
        
        return analytics_data
    
    async def _fetch_recent_campaigns(self, limit: int) -> List[Dict[str, Any]]:
        """Fetch recently active campaigns"""
        if not self.db:
            return []
            
        query = select(Campaign).order_by(Campaign.updated_at.desc()).limit(limit)
        result = await self.db.execute(query)
        campaigns = result.scalars().all()
        
        return [campaign.dict() for campaign in campaigns]
    
    async def _fetch_predictive_leads(self, limit: int) -> List[Dict[str, Any]]:
        """Fetch leads likely to be accessed based on patterns"""
        if not self.db:
            return []
        
        # Analyze access patterns
        predicted_keys = self._predict_next_accesses()
        
        # For now, just get recently created leads
        query = select(Lead).order_by(Lead.created_at.desc()).limit(limit)
        result = await self.db.execute(query)
        leads = result.scalars().all()
        
        return [lead.dict() for lead in leads]
    
    async def _fetch_priority_workspaces(self, limit: int) -> List[Dict[str, Any]]:
        """Fetch high-priority workspace settings"""
        if not self.db:
            return []
            
        # Get workspaces based on plan tier or activity
        query = select(Workspace).order_by(
            Workspace.plan_tier.desc(),
            Workspace.updated_at.desc()
        ).limit(limit)
        result = await self.db.execute(query)
        workspaces = result.scalars().all()
        
        return [{"workspace_id": ws.id, "settings": ws.settings} for ws in workspaces]
    
    async def _fetch_common_ai_prompts(self, limit: int) -> List[Dict[str, Any]]:
        """Fetch common AI prompts and responses"""
        # This would typically query a table tracking AI usage
        # For now, return common templates
        common_prompts = [
            {
                "prompt": "Generate a cold email for software companies",
                "model": "gpt-4",
                "temperature": 0.7,
                "response": "Pre-cached response template..."
            },
            {
                "prompt": "Write a follow-up email for no response",
                "model": "gpt-4",
                "temperature": 0.7,
                "response": "Pre-cached follow-up template..."
            }
        ]
        
        return common_prompts[:limit]
    
    def _generate_analytics_key(self, item: Dict[str, Any]) -> str:
        """Generate cache key for analytics data"""
        return f"dashboard:{item['workspace_id']}"
    
    def _generate_campaign_key(self, item: Dict[str, Any]) -> str:
        """Generate cache key for campaign data"""
        return f"campaign:{item.get('workspace_id')}:{item.get('id')}"
    
    def _generate_lead_key(self, item: Dict[str, Any]) -> str:
        """Generate cache key for lead data"""
        return f"{item.get('workspace_id')}:{item.get('id')}"
    
    def _generate_workspace_key(self, item: Dict[str, Any]) -> str:
        """Generate cache key for workspace settings"""
        return f"settings:{item['workspace_id']}"
    
    def _generate_ai_key(self, item: Dict[str, Any]) -> str:
        """Generate cache key for AI responses"""
        import hashlib
        content = f"{item['prompt']}:{item['model']}:{item['temperature']}"
        return hashlib.sha256(content.encode()).hexdigest()[:16]
    
    def _predict_next_accesses(self) -> Set[str]:
        """Predict which keys will be accessed next based on patterns"""
        predicted = set()
        
        now = datetime.utcnow()
        
        for key, accesses in self.access_patterns.items():
            if len(accesses) < 3:
                continue
                
            # Calculate average time between accesses
            deltas = []
            for i in range(1, len(accesses)):
                delta = (accesses[i] - accesses[i-1]).total_seconds()
                deltas.append(delta)
            
            avg_delta = sum(deltas) / len(deltas)
            
            # Predict next access time
            last_access = accesses[-1]
            predicted_next = last_access + timedelta(seconds=avg_delta)
            
            # If predicted time is within next 5 minutes, warm it
            if predicted_next <= now + timedelta(minutes=5):
                predicted.add(key)
        
        return predicted
    
    async def get_warming_stats(self) -> Dict[str, Any]:
        """Get statistics about cache warming"""
        stats = {
            "is_running": self.is_running,
            "total_tasks": len(self.warming_tasks),
            "tasks_by_strategy": {},
            "access_patterns_tracked": len(self.access_patterns),
            "timestamp": datetime.utcnow().isoformat()
        }
        
        # Count tasks by strategy
        for task in self.warming_tasks:
            strategy = task.strategy.value
            if strategy not in stats["tasks_by_strategy"]:
                stats["tasks_by_strategy"][strategy] = 0
            stats["tasks_by_strategy"][strategy] += 1
        
        return stats


# Global instance
_warming_service: Optional[CacheWarmingService] = None


async def get_warming_service() -> CacheWarmingService:
    """Get or create warming service instance"""
    global _warming_service
    
    if _warming_service is None:
        _warming_service = CacheWarmingService()
        await _warming_service.initialize()
    
    return _warming_service


async def start_cache_warming():
    """Start the cache warming service"""
    service = await get_warming_service()
    await service.start_background_warming(interval_seconds=300)  # 5 minutes


async def stop_cache_warming():
    """Stop the cache warming service"""
    global _warming_service
    
    if _warming_service:
        await _warming_service.stop_background_warming()
        _warming_service = None