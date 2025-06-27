"""
Pipedrive integration API endpoints
"""
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from models.user import User
from models.workspace import Workspace
from utils.auth import get_current_user
from utils.cache_manager import get_cache, CacheManager
from ..models.auth import PipedriveConnectionStatus
from ..services.auth_service import PipedriveAuthService
from ..services.sync_service import PipedriveSyncService
from ..services.webhook_service import PipedriveWebhookService
from ..services.api_client import PipedriveAPIClient

router = APIRouter(prefix="/api/integrations/pipedrive", tags=["Pipedrive"])


@router.get("/auth/url")
async def get_auth_url(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache)
) -> Dict[str, str]:
    """Get Pipedrive OAuth authorization URL"""
    if not current_user.workspace_id:
        raise HTTPException(status_code=400, detail="User must belong to a workspace")
    
    auth_service = PipedriveAuthService(db, cache)
    auth_url = await auth_service.generate_oauth_url(
        workspace_id=current_user.workspace_id,
        user_id=current_user.id
    )
    
    return {"auth_url": auth_url}


@router.post("/auth/callback")
async def handle_auth_callback(
    code: str,
    state: str,
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache)
) -> Dict[str, Any]:
    """Handle OAuth callback from Pipedrive"""
    auth_service = PipedriveAuthService(db, cache)
    auth = await auth_service.exchange_code_for_token(code, state)
    
    if not auth:
        raise HTTPException(status_code=400, detail="Failed to authenticate with Pipedrive")
    
    return {
        "success": True,
        "workspace_id": auth.workspace_id,
        "api_domain": auth.api_domain
    }


@router.get("/connection/status")
async def get_connection_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache)
) -> PipedriveConnectionStatus:
    """Get Pipedrive connection status"""
    # Check cache first
    cache_key = f"pipedrive_connection:{current_user.workspace_id}"
    cached_status = await cache.get(cache_key)
    if cached_status:
        return PipedriveConnectionStatus(**cached_status)
    
    auth_service = PipedriveAuthService(db, cache)
    auth = await auth_service.get_auth(current_user.workspace_id)
    
    if not auth:
        return PipedriveConnectionStatus(is_connected=False)
    
    # Get additional info from Pipedrive
    try:
        client = PipedriveAPIClient(auth, cache)
        
        # Get user info
        user_info = await auth_service._get_user_info(auth.access_token)
        
        # Get basic stats
        persons_response = await client._make_request("GET", "/persons", params={"limit": 1})
        deals_response = await client._make_request("GET", "/deals", params={"limit": 1})
        activities_response = await client._make_request("GET", "/activities", params={"limit": 1})
        
        status = PipedriveConnectionStatus(
            is_connected=True,
            api_domain=auth.api_domain,
            company_name=user_info.get("company_name"),
            user_name=user_info.get("name"),
            last_sync=auth.updated_at,
            total_persons=persons_response.json().get("additional_data", {}).get("pagination", {}).get("total_items", 0) if persons_response else 0,
            total_deals=deals_response.json().get("additional_data", {}).get("pagination", {}).get("total_items", 0) if deals_response else 0,
            total_activities=activities_response.json().get("additional_data", {}).get("pagination", {}).get("total_items", 0) if activities_response else 0
        )
        
        # Cache the status
        await cache.set(cache_key, status.dict(), ttl=300)
        
        return status
        
    except Exception as e:
        logger.error(f"Error getting connection status: {e}")
        return PipedriveConnectionStatus(
            is_connected=True,
            api_domain=auth.api_domain,
            last_sync=auth.updated_at
        )


@router.delete("/connection")
async def disconnect_pipedrive(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache)
) -> Dict[str, bool]:
    """Disconnect Pipedrive integration"""
    auth_service = PipedriveAuthService(db, cache)
    success = await auth_service.disconnect(current_user.workspace_id)
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to disconnect Pipedrive")
    
    return {"success": True}


# Sync endpoints

@router.post("/sync/lead/{lead_id}")
async def sync_lead(
    lead_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache)
) -> Dict[str, Any]:
    """Sync a single lead to Pipedrive"""
    sync_service = PipedriveSyncService(db, current_user.workspace_id, cache)
    person_id = await sync_service.sync_lead_to_person(lead_id)
    
    if not person_id:
        raise HTTPException(status_code=500, detail="Failed to sync lead")
    
    return {
        "success": True,
        "pipedrive_person_id": person_id
    }


@router.post("/sync/campaign/{campaign_id}")
async def sync_campaign(
    campaign_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache)
) -> Dict[str, Any]:
    """Sync a campaign to Pipedrive deal"""
    sync_service = PipedriveSyncService(db, current_user.workspace_id, cache)
    deal_id = await sync_service.sync_campaign_to_deal(campaign_id)
    
    if not deal_id:
        raise HTTPException(status_code=500, detail="Failed to sync campaign")
    
    return {
        "success": True,
        "pipedrive_deal_id": deal_id
    }


@router.post("/sync/bulk/leads")
async def bulk_sync_leads(
    background_tasks: BackgroundTasks,
    limit: int = Query(100, ge=1, le=1000),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache)
) -> Dict[str, Any]:
    """Bulk sync leads to Pipedrive"""
    sync_service = PipedriveSyncService(db, current_user.workspace_id, cache)
    
    # Run sync in background
    background_tasks.add_task(
        sync_service.bulk_sync_leads,
        limit=limit
    )
    
    return {
        "status": "started",
        "message": f"Bulk sync started for up to {limit} leads"
    }


# Field mapping endpoints

@router.get("/fields/persons")
async def get_person_fields(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache)
) -> List[Dict[str, Any]]:
    """Get available person fields from Pipedrive"""
    auth_service = PipedriveAuthService(db, cache)
    auth = await auth_service.get_auth(current_user.workspace_id)
    
    if not auth:
        raise HTTPException(status_code=400, detail="Pipedrive not connected")
    
    client = PipedriveAPIClient(auth, cache)
    fields = await client.get_person_fields()
    
    return fields


@router.get("/fields/deals")
async def get_deal_fields(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache)
) -> List[Dict[str, Any]]:
    """Get available deal fields from Pipedrive"""
    auth_service = PipedriveAuthService(db, cache)
    auth = await auth_service.get_auth(current_user.workspace_id)
    
    if not auth:
        raise HTTPException(status_code=400, detail="Pipedrive not connected")
    
    client = PipedriveAPIClient(auth, cache)
    fields = await client.get_deal_fields()
    
    return fields


@router.get("/fields/mappings")
async def get_field_mappings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Get current field mappings"""
    query = select(Workspace).where(Workspace.id == current_user.workspace_id)
    result = await db.execute(query)
    workspace = result.scalar_one_or_none()
    
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    return workspace.settings.get("pipedrive_field_mappings", {})


@router.put("/fields/mappings")
async def update_field_mappings(
    mappings: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Update field mappings"""
    query = select(Workspace).where(Workspace.id == current_user.workspace_id)
    result = await db.execute(query)
    workspace = result.scalar_one_or_none()
    
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    if not workspace.settings:
        workspace.settings = {}
    
    workspace.settings["pipedrive_field_mappings"] = mappings
    await db.commit()
    
    return {"success": True}


# Webhook endpoints

@router.post("/webhooks/setup")
async def setup_webhooks(
    webhook_url: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache)
) -> Dict[str, Any]:
    """Setup Pipedrive webhooks"""
    webhook_service = PipedriveWebhookService(db, cache)
    success = await webhook_service.setup_webhooks(
        current_user.workspace_id,
        webhook_url
    )
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to setup webhooks")
    
    return {"success": True}


@router.post("/webhooks/process")
async def process_webhook(
    request: Request,
    workspace_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache)
) -> Dict[str, Any]:
    """Process incoming Pipedrive webhook"""
    # Get webhook data
    webhook_data = await request.json()
    
    # Get signature if provided
    signature = request.headers.get("X-Pipedrive-Signature")
    
    webhook_service = PipedriveWebhookService(db, cache)
    success = await webhook_service.process_webhook(
        workspace_id,
        webhook_data,
        signature
    )
    
    if not success:
        raise HTTPException(status_code=400, detail="Failed to process webhook")
    
    return {"success": True}


@router.delete("/webhooks")
async def remove_webhooks(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache)
) -> Dict[str, Any]:
    """Remove Pipedrive webhooks"""
    webhook_service = PipedriveWebhookService(db, cache)
    success = await webhook_service.remove_webhooks(current_user.workspace_id)
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to remove webhooks")
    
    return {"success": True}


# Pipeline and stage endpoints

@router.get("/pipelines")
async def get_pipelines(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache)
) -> List[Dict[str, Any]]:
    """Get available pipelines"""
    auth_service = PipedriveAuthService(db, cache)
    auth = await auth_service.get_auth(current_user.workspace_id)
    
    if not auth:
        raise HTTPException(status_code=400, detail="Pipedrive not connected")
    
    client = PipedriveAPIClient(auth, cache)
    pipelines = await client.get_pipelines()
    
    return pipelines


@router.get("/pipelines/{pipeline_id}/stages")
async def get_pipeline_stages(
    pipeline_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache)
) -> List[Dict[str, Any]]:
    """Get stages for a pipeline"""
    auth_service = PipedriveAuthService(db, cache)
    auth = await auth_service.get_auth(current_user.workspace_id)
    
    if not auth:
        raise HTTPException(status_code=400, detail="Pipedrive not connected")
    
    client = PipedriveAPIClient(auth, cache)
    stages = await client.get_pipeline_stages(pipeline_id)
    
    return stages


import logging
logger = logging.getLogger(__name__)