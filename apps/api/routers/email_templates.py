"""
Email template management API endpoints
"""
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from core.database import get_db
from models.user import User
from models.email_template import TemplateType, TemplateCategory
from utils.auth import get_current_user
from utils.cache_manager import get_cache, CacheManager
from services.email_template_service import EmailTemplateService

router = APIRouter(prefix="/api/templates", tags=["Email Templates"])


# Pydantic models for request/response

class CreateTemplateRequest(BaseModel):
    name: str
    subject: str
    template_type: str = TemplateType.CUSTOM.value
    category: str = TemplateCategory.SALES.value
    description: Optional[str] = None
    html_content: Optional[str] = None
    text_content: Optional[str] = None
    builder_data: Optional[Dict[str, Any]] = None
    variables: Optional[Dict[str, Any]] = None
    tags: Optional[List[str]] = None


class UpdateTemplateRequest(BaseModel):
    name: Optional[str] = None
    subject: Optional[str] = None
    description: Optional[str] = None
    html_content: Optional[str] = None
    text_content: Optional[str] = None
    builder_data: Optional[Dict[str, Any]] = None
    variables: Optional[Dict[str, Any]] = None
    tags: Optional[List[str]] = None
    category: Optional[str] = None


class RenderTemplateRequest(BaseModel):
    variables: Dict[str, Any]
    lead_id: Optional[str] = None


class CreateVariableRequest(BaseModel):
    name: str
    display_name: str
    description: Optional[str] = None
    data_type: str = "string"
    default_value: Optional[str] = None
    is_required: bool = False
    category: str = "custom"


class SubmitToLibraryRequest(BaseModel):
    title: str
    description: str
    industry: Optional[str] = None
    use_case: Optional[str] = None


# Template endpoints

@router.post("/")
async def create_template(
    request: CreateTemplateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache)
) -> Dict[str, Any]:
    """Create a new email template"""
    
    if not current_user.workspace_id:
        raise HTTPException(status_code=400, detail="User must belong to a workspace")
    
    service = EmailTemplateService(db, cache)
    
    template = await service.create_template(
        workspace_id=current_user.workspace_id,
        user_id=current_user.id,
        **request.dict()
    )
    
    return {
        "id": template.id,
        "name": template.name,
        "template_type": template.template_type,
        "created_at": template.created_at.isoformat()
    }


@router.get("/")
async def get_templates(
    template_type: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    tags: Optional[str] = Query(None),  # Comma-separated tags
    include_public: bool = Query(True),
    include_system: bool = Query(True),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache)
) -> List[Dict[str, Any]]:
    """Get templates with filtering"""
    
    if not current_user.workspace_id:
        raise HTTPException(status_code=400, detail="User must belong to a workspace")
    
    service = EmailTemplateService(db, cache)
    
    # Parse tags
    tag_list = tags.split(",") if tags else None
    
    templates = await service.get_templates(
        workspace_id=current_user.workspace_id,
        template_type=template_type,
        category=category,
        tags=tag_list,
        search=search,
        include_public=include_public,
        include_system=include_system,
        limit=limit,
        offset=offset
    )
    
    return [
        {
            "id": t.id,
            "name": t.name,
            "subject": t.subject,
            "template_type": t.template_type,
            "category": t.category,
            "description": t.description,
            "tags": t.tags,
            "usage_count": t.usage_count,
            "is_public": t.is_public,
            "is_system": t.is_system,
            "created_at": t.created_at.isoformat(),
            "updated_at": t.updated_at.isoformat()
        }
        for t in templates
    ]


@router.get("/{template_id}")
async def get_template(
    template_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache)
) -> Dict[str, Any]:
    """Get a specific template"""
    
    service = EmailTemplateService(db, cache)
    
    template = await service.get_template(
        template_id=template_id,
        workspace_id=current_user.workspace_id
    )
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    return {
        "id": template.id,
        "name": template.name,
        "subject": template.subject,
        "template_type": template.template_type,
        "category": template.category,
        "description": template.description,
        "html_content": template.html_content,
        "text_content": template.text_content,
        "builder_data": template.builder_data,
        "variables": template.variables,
        "tags": template.tags,
        "usage_count": template.usage_count,
        "performance_stats": template.performance_stats,
        "is_public": template.is_public,
        "is_system": template.is_system,
        "version": template.version,
        "created_at": template.created_at.isoformat(),
        "updated_at": template.updated_at.isoformat()
    }


@router.put("/{template_id}")
async def update_template(
    template_id: str,
    request: UpdateTemplateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache)
) -> Dict[str, Any]:
    """Update a template"""
    
    if not current_user.workspace_id:
        raise HTTPException(status_code=400, detail="User must belong to a workspace")
    
    service = EmailTemplateService(db, cache)
    
    # Filter out None values
    updates = {k: v for k, v in request.dict().items() if v is not None}
    
    template = await service.update_template(
        template_id=template_id,
        workspace_id=current_user.workspace_id,
        **updates
    )
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    return {
        "id": template.id,
        "name": template.name,
        "version": template.version,
        "updated_at": template.updated_at.isoformat()
    }


@router.delete("/{template_id}")
async def delete_template(
    template_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache)
) -> Dict[str, bool]:
    """Delete a template"""
    
    if not current_user.workspace_id:
        raise HTTPException(status_code=400, detail="User must belong to a workspace")
    
    service = EmailTemplateService(db, cache)
    
    success = await service.delete_template(
        template_id=template_id,
        workspace_id=current_user.workspace_id
    )
    
    if not success:
        raise HTTPException(status_code=404, detail="Template not found")
    
    return {"success": True}


# Template rendering endpoints

@router.post("/{template_id}/render")
async def render_template(
    template_id: str,
    request: RenderTemplateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache)
) -> Dict[str, str]:
    """Render template with variables"""
    
    service = EmailTemplateService(db, cache)
    
    # Get lead if provided
    lead = None
    if request.lead_id:
        from models.lead import Lead
        from sqlalchemy import select
        
        query = select(Lead).where(
            Lead.id == request.lead_id,
            Lead.workspace_id == current_user.workspace_id
        )
        result = await db.execute(query)
        lead = result.scalar_one_or_none()
    
    try:
        rendered = await service.render_template(
            template_id=template_id,
            variables=request.variables,
            lead=lead,
            workspace_id=current_user.workspace_id
        )
        return rendered
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/{template_id}/preview")
async def preview_template(
    template_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache)
) -> Dict[str, str]:
    """Get template preview with sample data"""
    
    service = EmailTemplateService(db, cache)
    
    try:
        preview = await service.preview_template(
            template_id=template_id,
            workspace_id=current_user.workspace_id
        )
        return preview
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# Variable management endpoints

@router.get("/variables/available")
async def get_available_variables(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache)
) -> List[Dict[str, Any]]:
    """Get all available template variables"""
    
    if not current_user.workspace_id:
        raise HTTPException(status_code=400, detail="User must belong to a workspace")
    
    service = EmailTemplateService(db, cache)
    
    variables = await service.get_template_variables(current_user.workspace_id)
    
    return [
        {
            "id": v.id,
            "name": v.name,
            "display_name": v.display_name,
            "description": v.description,
            "data_type": v.data_type,
            "default_value": v.default_value,
            "is_required": v.is_required,
            "category": v.category,
            "is_system": v.is_system
        }
        for v in variables
    ]


@router.post("/variables")
async def create_custom_variable(
    request: CreateVariableRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache)
) -> Dict[str, Any]:
    """Create a custom template variable"""
    
    if not current_user.workspace_id:
        raise HTTPException(status_code=400, detail="User must belong to a workspace")
    
    service = EmailTemplateService(db, cache)
    
    variable = await service.create_custom_variable(
        workspace_id=current_user.workspace_id,
        **request.dict()
    )
    
    return {
        "id": variable.id,
        "name": variable.name,
        "display_name": variable.display_name,
        "data_type": variable.data_type
    }


# Template blocks for drag-and-drop builder

@router.get("/blocks/available")
async def get_template_blocks(
    category: Optional[str] = Query(None),
    block_type: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache)
) -> List[Dict[str, Any]]:
    """Get available template blocks for drag-and-drop builder"""
    
    service = EmailTemplateService(db, cache)
    
    blocks = await service.get_template_blocks(
        workspace_id=current_user.workspace_id,
        category=category,
        block_type=block_type
    )
    
    return [
        {
            "id": b.id,
            "block_type": b.block_type,
            "name": b.name,
            "description": b.description,
            "category": b.category,
            "content": b.content,
            "styles": b.styles,
            "settings": b.settings,
            "preview_image_url": b.preview_image_url,
            "is_system": b.is_system
        }
        for b in blocks
    ]


# Template library endpoints

@router.post("/{template_id}/submit-to-library")
async def submit_template_to_library(
    template_id: str,
    request: SubmitToLibraryRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache)
) -> Dict[str, Any]:
    """Submit template to public library"""
    
    service = EmailTemplateService(db, cache)
    
    library_entry = await service.submit_to_library(
        template_id=template_id,
        user_id=current_user.id,
        **request.dict()
    )
    
    return {
        "id": library_entry.id,
        "status": "submitted",
        "message": "Template submitted for review"
    }


@router.get("/library/browse")
async def browse_template_library(
    industry: Optional[str] = Query(None),
    use_case: Optional[str] = Query(None),
    featured_only: bool = Query(False),
    limit: int = Query(20, ge=1, le=50),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache)
) -> List[Dict[str, Any]]:
    """Browse public template library"""
    
    service = EmailTemplateService(db, cache)
    
    library_templates = await service.get_library_templates(
        industry=industry,
        use_case=use_case,
        featured_only=featured_only,
        limit=limit,
        offset=offset
    )
    
    return [
        {
            "id": lt.id,
            "title": lt.title,
            "description": lt.description,
            "industry": lt.industry,
            "use_case": lt.use_case,
            "rating": lt.rating,
            "download_count": lt.download_count,
            "is_featured": lt.is_featured,
            "template": {
                "id": lt.template.id,
                "name": lt.template.name,
                "subject": lt.template.subject,
                "template_type": lt.template.template_type,
                "category": lt.template.category
            }
        }
        for lt in library_templates
    ]


# Usage tracking endpoint

@router.post("/{template_id}/track-usage")
async def track_template_usage(
    template_id: str,
    campaign_id: Optional[str] = None,
    recipient_email: Optional[str] = None,
    subject_used: Optional[str] = None,
    variables_used: Optional[Dict[str, Any]] = None,
    usage_type: str = "campaign",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache)
) -> Dict[str, Any]:
    """Track template usage for analytics"""
    
    if not current_user.workspace_id:
        raise HTTPException(status_code=400, detail="User must belong to a workspace")
    
    service = EmailTemplateService(db, cache)
    
    usage = await service.track_template_usage(
        template_id=template_id,
        workspace_id=current_user.workspace_id,
        used_by=current_user.id,
        campaign_id=campaign_id,
        recipient_email=recipient_email,
        subject_used=subject_used,
        variables_used=variables_used,
        usage_type=usage_type
    )
    
    return {
        "usage_id": usage.id,
        "tracked_at": usage.created_at.isoformat()
    }