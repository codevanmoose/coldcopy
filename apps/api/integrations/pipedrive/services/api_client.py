"""
Pipedrive API client with rate limiting and retry logic
"""
import asyncio
import logging
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
import httpx
from httpx import Response

from ..models.auth import PipedriveAuth
from utils.cache_manager import CacheManager, CacheNamespace

logger = logging.getLogger(__name__)


class PipedriveAPIClient:
    """
    Pipedrive API client with rate limiting and caching
    
    Rate limits:
    - 10 requests per second per company
    - 1000 requests per day for OAuth apps
    """
    
    def __init__(
        self,
        auth: PipedriveAuth,
        cache: Optional[CacheManager] = None
    ):
        self.auth = auth
        self.cache = cache
        self.base_url = f"https://{auth.api_domain}/api/v1"
        
        # Rate limiting
        self._request_times: List[datetime] = []
        self._daily_requests = 0
        self._daily_reset = datetime.utcnow().replace(hour=0, minute=0, second=0)
    
    async def _check_rate_limit(self):
        """Check and enforce rate limits"""
        now = datetime.utcnow()
        
        # Reset daily counter if needed
        if now >= self._daily_reset + timedelta(days=1):
            self._daily_requests = 0
            self._daily_reset = now.replace(hour=0, minute=0, second=0)
        
        # Check daily limit
        if self._daily_requests >= 1000:
            wait_time = (self._daily_reset + timedelta(days=1) - now).total_seconds()
            logger.warning(f"Daily rate limit reached. Waiting {wait_time}s")
            await asyncio.sleep(wait_time)
            self._daily_requests = 0
        
        # Check per-second limit (10 req/s)
        self._request_times = [t for t in self._request_times if t > now - timedelta(seconds=1)]
        
        if len(self._request_times) >= 10:
            wait_time = 1 - (now - self._request_times[0]).total_seconds()
            if wait_time > 0:
                await asyncio.sleep(wait_time)
        
        self._request_times.append(now)
        self._daily_requests += 1
    
    async def _make_request(
        self,
        method: str,
        endpoint: str,
        params: Optional[Dict[str, Any]] = None,
        json_data: Optional[Dict[str, Any]] = None,
        retry_count: int = 3
    ) -> Optional[Response]:
        """Make API request with retry logic"""
        await self._check_rate_limit()
        
        url = f"{self.base_url}{endpoint}"
        
        # Add API token to params
        if params is None:
            params = {}
        params["api_token"] = self.auth.access_token
        
        for attempt in range(retry_count):
            try:
                async with httpx.AsyncClient(timeout=30.0) as client:
                    response = await client.request(
                        method=method,
                        url=url,
                        params=params,
                        json=json_data
                    )
                    
                    if response.status_code == 429:  # Rate limited
                        retry_after = int(response.headers.get("Retry-After", 60))
                        logger.warning(f"Rate limited. Waiting {retry_after}s")
                        await asyncio.sleep(retry_after)
                        continue
                    
                    if response.status_code >= 500:  # Server error
                        if attempt < retry_count - 1:
                            await asyncio.sleep(2 ** attempt)  # Exponential backoff
                            continue
                    
                    return response
                    
            except httpx.TimeoutException:
                logger.error(f"Timeout on attempt {attempt + 1}")
                if attempt < retry_count - 1:
                    await asyncio.sleep(2 ** attempt)
                    continue
            except Exception as e:
                logger.error(f"Request error: {e}")
                return None
        
        return None
    
    # Person (Contact) methods
    
    async def get_person(self, person_id: int) -> Optional[Dict[str, Any]]:
        """Get a single person by ID"""
        cache_key = f"person:{self.auth.workspace_id}:{person_id}"
        
        # Check cache
        if self.cache:
            cached = await self.cache.get(cache_key, namespace=CacheNamespace.LEAD_ENRICHMENT)
            if cached:
                return cached
        
        response = await self._make_request("GET", f"/persons/{person_id}")
        
        if response and response.status_code == 200:
            data = response.json().get("data")
            
            # Cache the result
            if data and self.cache:
                await self.cache.set(
                    cache_key,
                    data,
                    ttl=3600,  # 1 hour
                    namespace=CacheNamespace.LEAD_ENRICHMENT
                )
            
            return data
        
        return None
    
    async def create_person(self, person_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Create a new person"""
        response = await self._make_request("POST", "/persons", json_data=person_data)
        
        if response and response.status_code == 201:
            return response.json().get("data")
        
        return None
    
    async def update_person(self, person_id: int, person_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Update an existing person"""
        response = await self._make_request("PUT", f"/persons/{person_id}", json_data=person_data)
        
        if response and response.status_code == 200:
            # Invalidate cache
            if self.cache:
                cache_key = f"person:{self.auth.workspace_id}:{person_id}"
                await self.cache.delete(cache_key, namespace=CacheNamespace.LEAD_ENRICHMENT)
            
            return response.json().get("data")
        
        return None
    
    async def search_persons(self, term: str, fields: Optional[List[str]] = None) -> List[Dict[str, Any]]:
        """Search for persons"""
        params = {
            "term": term,
            "fields": ",".join(fields) if fields else None,
            "limit": 50
        }
        
        response = await self._make_request("GET", "/persons/search", params=params)
        
        if response and response.status_code == 200:
            return response.json().get("data", {}).get("items", [])
        
        return []
    
    # Organization methods
    
    async def get_organization(self, org_id: int) -> Optional[Dict[str, Any]]:
        """Get a single organization by ID"""
        response = await self._make_request("GET", f"/organizations/{org_id}")
        
        if response and response.status_code == 200:
            return response.json().get("data")
        
        return None
    
    async def create_organization(self, org_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Create a new organization"""
        response = await self._make_request("POST", "/organizations", json_data=org_data)
        
        if response and response.status_code == 201:
            return response.json().get("data")
        
        return None
    
    # Deal methods
    
    async def get_deal(self, deal_id: int) -> Optional[Dict[str, Any]]:
        """Get a single deal by ID"""
        response = await self._make_request("GET", f"/deals/{deal_id}")
        
        if response and response.status_code == 200:
            return response.json().get("data")
        
        return None
    
    async def create_deal(self, deal_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Create a new deal"""
        response = await self._make_request("POST", "/deals", json_data=deal_data)
        
        if response and response.status_code == 201:
            return response.json().get("data")
        
        return None
    
    async def update_deal(self, deal_id: int, deal_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Update an existing deal"""
        response = await self._make_request("PUT", f"/deals/{deal_id}", json_data=deal_data)
        
        if response and response.status_code == 200:
            return response.json().get("data")
        
        return None
    
    # Activity methods
    
    async def create_activity(self, activity_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Create a new activity"""
        response = await self._make_request("POST", "/activities", json_data=activity_data)
        
        if response and response.status_code == 201:
            return response.json().get("data")
        
        return None
    
    async def mark_activity_done(self, activity_id: int) -> bool:
        """Mark an activity as done"""
        response = await self._make_request(
            "PUT",
            f"/activities/{activity_id}",
            json_data={"done": True}
        )
        
        return response and response.status_code == 200
    
    # Pipeline methods
    
    async def get_pipelines(self) -> List[Dict[str, Any]]:
        """Get all pipelines"""
        response = await self._make_request("GET", "/pipelines")
        
        if response and response.status_code == 200:
            return response.json().get("data", [])
        
        return []
    
    async def get_pipeline_stages(self, pipeline_id: int) -> List[Dict[str, Any]]:
        """Get stages for a pipeline"""
        response = await self._make_request("GET", f"/pipelines/{pipeline_id}/stages")
        
        if response and response.status_code == 200:
            return response.json().get("data", [])
        
        return []
    
    # Webhook methods
    
    async def create_webhook(self, event_action: str, event_object: str, subscription_url: str) -> Optional[Dict[str, Any]]:
        """Create a webhook subscription"""
        webhook_data = {
            "event_action": event_action,
            "event_object": event_object,
            "subscription_url": subscription_url
        }
        
        response = await self._make_request("POST", "/webhooks", json_data=webhook_data)
        
        if response and response.status_code == 201:
            return response.json().get("data")
        
        return None
    
    async def delete_webhook(self, webhook_id: int) -> bool:
        """Delete a webhook subscription"""
        response = await self._make_request("DELETE", f"/webhooks/{webhook_id}")
        
        return response and response.status_code == 200
    
    # Batch operations
    
    async def batch_create_persons(self, persons: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Create multiple persons in batches"""
        created = []
        batch_size = 10  # Process 10 at a time
        
        for i in range(0, len(persons), batch_size):
            batch = persons[i:i + batch_size]
            
            # Create persons in parallel within batch
            tasks = [self.create_person(person) for person in batch]
            results = await asyncio.gather(*tasks)
            
            created.extend([r for r in results if r is not None])
            
            # Small delay between batches
            if i + batch_size < len(persons):
                await asyncio.sleep(1)
        
        return created
    
    # Field management
    
    async def get_person_fields(self) -> List[Dict[str, Any]]:
        """Get all person fields including custom fields"""
        response = await self._make_request("GET", "/personFields")
        
        if response and response.status_code == 200:
            return response.json().get("data", [])
        
        return []
    
    async def get_deal_fields(self) -> List[Dict[str, Any]]:
        """Get all deal fields including custom fields"""
        response = await self._make_request("GET", "/dealFields")
        
        if response and response.status_code == 200:
            return response.json().get("data", [])
        
        return []