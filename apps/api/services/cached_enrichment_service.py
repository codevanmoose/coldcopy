"""
Cached lead enrichment service that integrates with multiple data providers.
"""
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
from dataclasses import dataclass
from enum import Enum

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from models.lead import Lead, LeadEnrichment
from utils.cache_manager import LeadEnrichmentCache, get_cache
from services.enrichment_providers import (
    ClearbitProvider,
    HunterProvider,
    FullContactProvider,
    EnrichmentProvider
)

logger = logging.getLogger(__name__)


class EnrichmentSource(Enum):
    """Enrichment data sources."""
    CLEARBIT = "clearbit"
    HUNTER = "hunter"
    FULLCONTACT = "fullcontact"
    APOLLO = "apollo"
    ZOOMINFO = "zoominfo"
    CACHE = "cache"


@dataclass
class EnrichmentResult:
    """Result from enrichment operation."""
    success: bool
    source: EnrichmentSource
    data: Dict[str, Any]
    cached: bool = False
    cost: float = 0.0
    processing_time_ms: int = 0
    error: Optional[str] = None


class CachedEnrichmentService:
    """
    Lead enrichment service with intelligent caching and provider fallback.
    
    Features:
    - Multi-level caching (memory + Redis)
    - Provider fallback strategy
    - Cost optimization
    - Rate limiting per provider
    - Data normalization
    """
    
    def __init__(
        self,
        db: AsyncSession,
        cache_manager: Optional[LeadEnrichmentCache] = None
    ):
        self.db = db
        self._cache = cache_manager
        self._providers: Dict[EnrichmentSource, EnrichmentProvider] = {}
        self._memory_cache: Dict[str, EnrichmentResult] = {}
        self._memory_cache_ttl = 300  # 5 minutes
        self._initialized = False
    
    async def initialize(self):
        """Initialize enrichment providers and cache."""
        if self._initialized:
            return
        
        # Initialize cache if not provided
        if not self._cache:
            cache_manager = await get_cache()
            self._cache = LeadEnrichmentCache(cache_manager)
        
        # Initialize providers based on configuration
        # In production, these would come from environment/database
        import os
        
        if os.getenv("CLEARBIT_API_KEY"):
            self._providers[EnrichmentSource.CLEARBIT] = ClearbitProvider(
                api_key=os.getenv("CLEARBIT_API_KEY")
            )
        
        if os.getenv("HUNTER_API_KEY"):
            self._providers[EnrichmentSource.HUNTER] = HunterProvider(
                api_key=os.getenv("HUNTER_API_KEY")
            )
        
        if os.getenv("FULLCONTACT_API_KEY"):
            self._providers[EnrichmentSource.FULLCONTACT] = FullContactProvider(
                api_key=os.getenv("FULLCONTACT_API_KEY")
            )
        
        self._initialized = True
        logger.info(f"Initialized enrichment service with {len(self._providers)} providers")
    
    async def enrich_lead(
        self,
        lead_id: str,
        workspace_id: str,
        force_refresh: bool = False,
        preferred_sources: Optional[List[EnrichmentSource]] = None
    ) -> EnrichmentResult:
        """
        Enrich a lead with data from multiple sources.
        
        Args:
            lead_id: Lead ID to enrich
            workspace_id: Workspace ID
            force_refresh: Skip cache and fetch fresh data
            preferred_sources: Ordered list of preferred sources
            
        Returns:
            EnrichmentResult with enriched data
        """
        start_time = datetime.utcnow()
        
        # Initialize if needed
        await self.initialize()
        
        # Get lead data
        lead = await self._get_lead(lead_id, workspace_id)
        if not lead:
            return EnrichmentResult(
                success=False,
                source=EnrichmentSource.CACHE,
                data={},
                error="Lead not found"
            )
        
        # Check memory cache first
        cache_key = f"{workspace_id}:{lead_id}"
        if not force_refresh and cache_key in self._memory_cache:
            cached_result = self._memory_cache[cache_key]
            if self._is_memory_cache_valid(cached_result):
                return cached_result
        
        # Check Redis cache
        if not force_refresh:
            cached_data = await self._cache.get_enrichment(lead_id, workspace_id)
            if cached_data:
                result = EnrichmentResult(
                    success=True,
                    source=EnrichmentSource.CACHE,
                    data=cached_data,
                    cached=True,
                    processing_time_ms=int((datetime.utcnow() - start_time).total_seconds() * 1000)
                )
                # Update memory cache
                self._memory_cache[cache_key] = result
                return result
        
        # Fetch fresh enrichment data
        result = await self._fetch_enrichment(
            lead,
            workspace_id,
            preferred_sources
        )
        
        # Cache successful results
        if result.success:
            # Cache in Redis
            await self._cache.set_enrichment(
                lead_id,
                workspace_id,
                result.data
            )
            
            # Cache in memory
            self._memory_cache[cache_key] = result
            
            # Store in database
            await self._store_enrichment(lead_id, workspace_id, result)
        
        result.processing_time_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)
        return result
    
    async def enrich_bulk(
        self,
        lead_ids: List[str],
        workspace_id: str,
        batch_size: int = 10
    ) -> Dict[str, EnrichmentResult]:
        """
        Enrich multiple leads in bulk with optimized caching.
        
        Args:
            lead_ids: List of lead IDs to enrich
            workspace_id: Workspace ID
            batch_size: Batch size for processing
            
        Returns:
            Dictionary mapping lead_id to EnrichmentResult
        """
        results = {}
        
        # Process in batches to avoid overwhelming providers
        for i in range(0, len(lead_ids), batch_size):
            batch = lead_ids[i:i + batch_size]
            
            # Check cache for entire batch first
            cached_results = await self._get_bulk_cached(batch, workspace_id)
            
            # Process uncached leads
            for lead_id in batch:
                if lead_id in cached_results:
                    results[lead_id] = cached_results[lead_id]
                else:
                    # Fetch individual enrichment
                    result = await self.enrich_lead(lead_id, workspace_id)
                    results[lead_id] = result
            
            # Small delay between batches to respect rate limits
            await asyncio.sleep(0.5)
        
        return results
    
    async def get_enrichment_stats(
        self,
        workspace_id: str,
        days: int = 30
    ) -> Dict[str, Any]:
        """Get enrichment statistics for a workspace."""
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        
        # Query database for enrichment stats
        query = select(LeadEnrichment).where(
            LeadEnrichment.workspace_id == workspace_id,
            LeadEnrichment.enriched_at >= cutoff_date
        )
        
        result = await self.db.execute(query)
        enrichments = result.scalars().all()
        
        # Calculate statistics
        stats = {
            "total_enrichments": len(enrichments),
            "sources": {},
            "total_cost": 0.0,
            "cache_hit_rate": 0.0,
            "average_processing_time_ms": 0,
            "enriched_fields": {}
        }
        
        cache_hits = 0
        total_time = 0
        
        for enrichment in enrichments:
            source = enrichment.provider
            if source not in stats["sources"]:
                stats["sources"][source] = {
                    "count": 0,
                    "cost": 0.0,
                    "success_rate": 0.0
                }
            
            stats["sources"][source]["count"] += 1
            
            # Check if it was a cache hit
            if enrichment.metadata and enrichment.metadata.get("cached"):
                cache_hits += 1
            
            # Sum costs and times
            if enrichment.metadata:
                stats["total_cost"] += enrichment.metadata.get("cost", 0.0)
                total_time += enrichment.metadata.get("processing_time_ms", 0)
            
            # Count enriched fields
            if enrichment.enrichment_data:
                for field in enrichment.enrichment_data.keys():
                    stats["enriched_fields"][field] = stats["enriched_fields"].get(field, 0) + 1
        
        # Calculate rates
        if stats["total_enrichments"] > 0:
            stats["cache_hit_rate"] = (cache_hits / stats["total_enrichments"]) * 100
            stats["average_processing_time_ms"] = total_time / stats["total_enrichments"]
        
        return stats
    
    async def invalidate_cache(
        self,
        lead_id: Optional[str] = None,
        workspace_id: Optional[str] = None
    ) -> int:
        """
        Invalidate cached enrichment data.
        
        Args:
            lead_id: Specific lead to invalidate
            workspace_id: Invalidate all leads in workspace
            
        Returns:
            Number of cache entries invalidated
        """
        invalidated = 0
        
        if lead_id and workspace_id:
            # Invalidate specific lead
            cache_key = f"{workspace_id}:{lead_id}"
            if cache_key in self._memory_cache:
                del self._memory_cache[cache_key]
                invalidated += 1
            
            # Invalidate in Redis
            if await self._cache.cache.delete(
                cache_key,
                namespace=self._cache.namespace
            ):
                invalidated += 1
        
        elif workspace_id:
            # Invalidate entire workspace
            # Clear memory cache for workspace
            keys_to_delete = [
                k for k in self._memory_cache.keys()
                if k.startswith(f"{workspace_id}:")
            ]
            for key in keys_to_delete:
                del self._memory_cache[key]
                invalidated += 1
            
            # Invalidate in Redis
            invalidated += await self._cache.invalidate_workspace(workspace_id)
        
        logger.info(f"Invalidated {invalidated} cache entries")
        return invalidated
    
    # Private methods
    
    async def _get_lead(self, lead_id: str, workspace_id: str) -> Optional[Lead]:
        """Get lead from database."""
        query = select(Lead).where(
            Lead.id == lead_id,
            Lead.workspace_id == workspace_id
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()
    
    async def _fetch_enrichment(
        self,
        lead: Lead,
        workspace_id: str,
        preferred_sources: Optional[List[EnrichmentSource]] = None
    ) -> EnrichmentResult:
        """Fetch enrichment from providers with fallback."""
        # Determine provider order
        if preferred_sources:
            provider_order = [
                s for s in preferred_sources 
                if s in self._providers
            ]
        else:
            # Default order based on cost/quality
            provider_order = [
                EnrichmentSource.CLEARBIT,
                EnrichmentSource.FULLCONTACT,
                EnrichmentSource.HUNTER
            ]
        
        # Try each provider
        for source in provider_order:
            if source not in self._providers:
                continue
            
            provider = self._providers[source]
            
            try:
                # Check rate limits
                if not await provider.check_rate_limit():
                    logger.warning(f"Rate limit exceeded for {source}")
                    continue
                
                # Fetch enrichment
                data = await provider.enrich(
                    email=lead.email,
                    first_name=lead.first_name,
                    last_name=lead.last_name,
                    company=lead.company
                )
                
                if data:
                    # Normalize data
                    normalized_data = self._normalize_enrichment_data(
                        data,
                        source
                    )
                    
                    return EnrichmentResult(
                        success=True,
                        source=source,
                        data=normalized_data,
                        cost=provider.get_cost_per_enrichment()
                    )
                    
            except Exception as e:
                logger.error(f"Provider {source} failed: {e}")
                continue
        
        # All providers failed
        return EnrichmentResult(
            success=False,
            source=EnrichmentSource.CACHE,
            data={},
            error="All enrichment providers failed"
        )
    
    def _normalize_enrichment_data(
        self,
        data: Dict[str, Any],
        source: EnrichmentSource
    ) -> Dict[str, Any]:
        """Normalize enrichment data from different providers."""
        normalized = {
            "source": source.value,
            "enriched_at": datetime.utcnow().isoformat()
        }
        
        # Map provider-specific fields to standard fields
        field_mappings = {
            EnrichmentSource.CLEARBIT: {
                "company.name": "company_name",
                "company.domain": "company_domain",
                "company.industry": "industry",
                "company.employeesRange": "company_size",
                "person.bio": "bio",
                "person.location": "location",
                "person.title": "job_title"
            },
            EnrichmentSource.HUNTER: {
                "organization": "company_name",
                "position": "job_title",
                "linkedin": "linkedin_url",
                "twitter": "twitter_handle"
            },
            EnrichmentSource.FULLCONTACT: {
                "organization.name": "company_name",
                "organization.title": "job_title",
                "demographics.locationGeneral": "location",
                "social.linkedin": "linkedin_url"
            }
        }
        
        # Apply mappings
        mappings = field_mappings.get(source, {})
        for source_field, target_field in mappings.items():
            value = self._get_nested_value(data, source_field)
            if value:
                normalized[target_field] = value
        
        # Add raw data
        normalized["raw_data"] = data
        
        return normalized
    
    def _get_nested_value(self, data: Dict, path: str) -> Any:
        """Get nested value from dictionary using dot notation."""
        keys = path.split(".")
        value = data
        
        for key in keys:
            if isinstance(value, dict) and key in value:
                value = value[key]
            else:
                return None
        
        return value
    
    async def _store_enrichment(
        self,
        lead_id: str,
        workspace_id: str,
        result: EnrichmentResult
    ):
        """Store enrichment result in database."""
        try:
            enrichment = LeadEnrichment(
                lead_id=lead_id,
                workspace_id=workspace_id,
                provider=result.source.value,
                enrichment_data=result.data,
                metadata={
                    "cost": result.cost,
                    "processing_time_ms": result.processing_time_ms,
                    "cached": result.cached
                },
                enriched_at=datetime.utcnow()
            )
            
            self.db.add(enrichment)
            await self.db.commit()
            
        except Exception as e:
            logger.error(f"Failed to store enrichment: {e}")
            await self.db.rollback()
    
    def _is_memory_cache_valid(self, result: EnrichmentResult) -> bool:
        """Check if memory cached result is still valid."""
        if "enriched_at" in result.data:
            try:
                enriched_at = datetime.fromisoformat(result.data["enriched_at"])
                age = (datetime.utcnow() - enriched_at).total_seconds()
                return age < self._memory_cache_ttl
            except:
                pass
        return False
    
    async def _get_bulk_cached(
        self,
        lead_ids: List[str],
        workspace_id: str
    ) -> Dict[str, EnrichmentResult]:
        """Get multiple cached enrichments efficiently."""
        results = {}
        
        # Check memory cache
        for lead_id in lead_ids:
            cache_key = f"{workspace_id}:{lead_id}"
            if cache_key in self._memory_cache:
                cached_result = self._memory_cache[cache_key]
                if self._is_memory_cache_valid(cached_result):
                    results[lead_id] = cached_result
        
        # For remaining, check Redis in bulk
        # (This could be optimized with pipeline/mget)
        remaining = [lid for lid in lead_ids if lid not in results]
        for lead_id in remaining:
            cached_data = await self._cache.get_enrichment(lead_id, workspace_id)
            if cached_data:
                result = EnrichmentResult(
                    success=True,
                    source=EnrichmentSource.CACHE,
                    data=cached_data,
                    cached=True
                )
                results[lead_id] = result
                # Update memory cache
                cache_key = f"{workspace_id}:{lead_id}"
                self._memory_cache[cache_key] = result
        
        return results


# Import asyncio at the top
import asyncio


# Mock enrichment providers (these would be real implementations)
class EnrichmentProvider:
    """Base enrichment provider interface."""
    
    async def enrich(self, **kwargs) -> Optional[Dict[str, Any]]:
        raise NotImplementedError
    
    async def check_rate_limit(self) -> bool:
        return True
    
    def get_cost_per_enrichment(self) -> float:
        return 0.0


class ClearbitProvider(EnrichmentProvider):
    def __init__(self, api_key: str):
        self.api_key = api_key
    
    async def enrich(self, **kwargs) -> Optional[Dict[str, Any]]:
        # Mock implementation
        return {
            "company": {
                "name": "Acme Corp",
                "domain": "acme.com",
                "industry": "Software"
            },
            "person": {
                "bio": "Software Engineer",
                "location": "San Francisco, CA"
            }
        }
    
    def get_cost_per_enrichment(self) -> float:
        return 0.05


class HunterProvider(EnrichmentProvider):
    def __init__(self, api_key: str):
        self.api_key = api_key
    
    async def enrich(self, **kwargs) -> Optional[Dict[str, Any]]:
        # Mock implementation
        return {
            "organization": "Tech Startup",
            "position": "CTO",
            "linkedin": "linkedin.com/in/example"
        }
    
    def get_cost_per_enrichment(self) -> float:
        return 0.02


class FullContactProvider(EnrichmentProvider):
    def __init__(self, api_key: str):
        self.api_key = api_key
    
    async def enrich(self, **kwargs) -> Optional[Dict[str, Any]]:
        # Mock implementation
        return {
            "organization": {
                "name": "Innovation Inc",
                "title": "VP Engineering"
            },
            "demographics": {
                "locationGeneral": "New York, NY"
            }
        }
    
    def get_cost_per_enrichment(self) -> float:
        return 0.03