"""
Email template service for ColdCopy
"""
import logging
import re
from typing import Optional, Dict, Any, List
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, and_, or_, func
from sqlalchemy.orm import selectinload

from models.email_template import (
    EmailTemplate, TemplateVariable, TemplateBlock, 
    TemplateUsage, TemplateLibrary, TemplateType, TemplateCategory
)
from models.user import User
from models.workspace import Workspace
from models.lead import Lead
from utils.cache_manager import CacheManager, CacheNamespace

logger = logging.getLogger(__name__)


class EmailTemplateService:
    """Service for managing email templates"""
    
    def __init__(self, db: AsyncSession, cache: Optional[CacheManager] = None):
        self.db = db
        self.cache = cache
    
    # Template CRUD operations
    
    async def create_template(
        self,
        workspace_id: str,
        user_id: str,
        name: str,
        subject: str,
        template_type: str = TemplateType.CUSTOM.value,
        category: str = TemplateCategory.SALES.value,
        description: Optional[str] = None,
        html_content: Optional[str] = None,
        text_content: Optional[str] = None,
        builder_data: Optional[Dict[str, Any]] = None,
        variables: Optional[Dict[str, Any]] = None,
        tags: Optional[List[str]] = None
    ) -> EmailTemplate:
        """Create a new email template"""
        
        template = EmailTemplate(
            workspace_id=workspace_id,
            created_by=user_id,
            name=name,
            subject=subject,
            template_type=template_type,
            category=category,
            description=description,
            html_content=html_content,
            text_content=text_content,
            builder_data=builder_data or {},
            variables=variables or {},
            tags=tags or []
        )
        
        self.db.add(template)
        await self.db.commit()
        await self.db.refresh(template)
        
        # Extract and validate variables from content
        await self._extract_template_variables(template)
        
        # Clear cache
        if self.cache:
            await self.cache.delete_pattern(
                f"templates:{workspace_id}:*",
                namespace=CacheNamespace.EMAIL_TEMPLATES
            )
        
        logger.info(f"Created template {template.id} for workspace {workspace_id}")
        return template
    
    async def get_template(
        self,
        template_id: str,
        workspace_id: Optional[str] = None
    ) -> Optional[EmailTemplate]:
        """Get a template by ID"""
        
        # Check cache first
        cache_key = f"template:{template_id}"
        if self.cache:
            cached = await self.cache.get(cache_key, namespace=CacheNamespace.EMAIL_TEMPLATES)
            if cached:
                return EmailTemplate(**cached)
        
        query = select(EmailTemplate).where(EmailTemplate.id == template_id)
        
        if workspace_id:
            query = query.where(
                or_(
                    EmailTemplate.workspace_id == workspace_id,
                    EmailTemplate.is_public == True,
                    EmailTemplate.is_system == True
                )
            )
        
        result = await self.db.execute(query)
        template = result.scalar_one_or_none()
        
        # Cache the result
        if template and self.cache:
            await self.cache.set(
                cache_key,
                template.__dict__,
                ttl=1800,  # 30 minutes
                namespace=CacheNamespace.EMAIL_TEMPLATES
            )
        
        return template
    
    async def get_templates(
        self,
        workspace_id: str,
        template_type: Optional[str] = None,
        category: Optional[str] = None,
        tags: Optional[List[str]] = None,
        search: Optional[str] = None,
        include_public: bool = True,
        include_system: bool = True,
        limit: int = 50,
        offset: int = 0
    ) -> List[EmailTemplate]:
        """Get templates with filtering"""
        
        query = select(EmailTemplate).where(
            or_(
                EmailTemplate.workspace_id == workspace_id,
                and_(EmailTemplate.is_public == True, include_public),
                and_(EmailTemplate.is_system == True, include_system)
            )
        ).where(EmailTemplate.is_active == True)
        
        if template_type:
            query = query.where(EmailTemplate.template_type == template_type)
        
        if category:
            query = query.where(EmailTemplate.category == category)
        
        if tags:
            # Filter by tags (JSON array contains any of the specified tags)
            for tag in tags:
                query = query.where(EmailTemplate.tags.op("@>")([tag]))
        
        if search:
            search_pattern = f"%{search}%"
            query = query.where(
                or_(
                    EmailTemplate.name.ilike(search_pattern),
                    EmailTemplate.description.ilike(search_pattern),
                    EmailTemplate.subject.ilike(search_pattern)
                )
            )
        
        query = query.order_by(EmailTemplate.usage_count.desc(), EmailTemplate.created_at.desc())
        query = query.limit(limit).offset(offset)
        
        result = await self.db.execute(query)
        return result.scalars().all()
    
    async def update_template(
        self,
        template_id: str,
        workspace_id: str,
        **updates
    ) -> Optional[EmailTemplate]:
        """Update a template"""
        
        # Get existing template
        template = await self.get_template(template_id, workspace_id)
        if not template or template.workspace_id != workspace_id:
            return None
        
        # Update fields
        for field, value in updates.items():
            if hasattr(template, field):
                setattr(template, field, value)
        
        template.updated_at = datetime.utcnow()
        template.version += 1
        
        await self.db.commit()
        
        # Extract variables if content changed
        if 'html_content' in updates or 'text_content' in updates or 'subject' in updates:
            await self._extract_template_variables(template)
        
        # Clear cache
        if self.cache:
            await self.cache.delete(
                f"template:{template_id}",
                namespace=CacheNamespace.EMAIL_TEMPLATES
            )
        
        return template
    
    async def delete_template(self, template_id: str, workspace_id: str) -> bool:
        """Soft delete a template"""
        
        query = update(EmailTemplate).where(
            and_(
                EmailTemplate.id == template_id,
                EmailTemplate.workspace_id == workspace_id
            )
        ).values(
            is_active=False,
            updated_at=datetime.utcnow()
        )
        
        result = await self.db.execute(query)
        await self.db.commit()
        
        # Clear cache
        if self.cache:
            await self.cache.delete(
                f"template:{template_id}",
                namespace=CacheNamespace.EMAIL_TEMPLATES
            )
        
        return result.rowcount > 0
    
    # Template rendering and variable substitution
    
    async def render_template(
        self,
        template_id: str,
        variables: Dict[str, Any],
        lead: Optional[Lead] = None,
        workspace_id: Optional[str] = None
    ) -> Dict[str, str]:
        """Render template with variables substituted"""
        
        template = await self.get_template(template_id, workspace_id)
        if not template:
            raise ValueError(f"Template {template_id} not found")
        
        # Merge lead data with provided variables
        all_variables = {}
        
        if lead:
            all_variables.update({
                'first_name': lead.first_name or '',
                'last_name': lead.last_name or '',
                'email': lead.email,
                'company': lead.company or '',
                'job_title': lead.job_title or '',
                'phone': lead.phone or '',
                'linkedin_url': getattr(lead.enrichment_data, 'linkedin_url', '') if lead.enrichment_data else ''
            })
        
        all_variables.update(variables)
        
        # Render subject and content
        rendered_subject = self._substitute_variables(template.subject, all_variables)
        rendered_html = self._substitute_variables(template.html_content or '', all_variables)
        rendered_text = self._substitute_variables(template.text_content or '', all_variables)
        
        return {
            'subject': rendered_subject,
            'html_content': rendered_html,
            'text_content': rendered_text
        }
    
    async def preview_template(
        self,
        template_id: str,
        sample_variables: Optional[Dict[str, Any]] = None,
        workspace_id: Optional[str] = None
    ) -> Dict[str, str]:
        """Generate a preview of the template with sample data"""
        
        template = await self.get_template(template_id, workspace_id)
        if not template:
            raise ValueError(f"Template {template_id} not found")
        
        # Use sample variables or defaults
        variables = sample_variables or {}
        
        # Add default sample data
        default_variables = {
            'first_name': 'John',
            'last_name': 'Doe',
            'email': 'john.doe@example.com',
            'company': 'Example Corp',
            'job_title': 'CEO',
            'phone': '+1 (555) 123-4567',
            'linkedin_url': 'https://linkedin.com/in/johndoe'
        }
        
        final_variables = {**default_variables, **variables}
        
        return await self.render_template(template_id, final_variables, workspace_id=workspace_id)
    
    # Template variables management
    
    async def get_template_variables(self, workspace_id: str) -> List[TemplateVariable]:
        """Get all available template variables for a workspace"""
        
        query = select(TemplateVariable).where(
            or_(
                TemplateVariable.workspace_id == workspace_id,
                TemplateVariable.is_system == True
            )
        ).order_by(TemplateVariable.category, TemplateVariable.name)
        
        result = await self.db.execute(query)
        return result.scalars().all()
    
    async def create_custom_variable(
        self,
        workspace_id: str,
        name: str,
        display_name: str,
        description: Optional[str] = None,
        data_type: str = "string",
        default_value: Optional[str] = None,
        is_required: bool = False,
        category: str = "custom"
    ) -> TemplateVariable:
        """Create a custom template variable"""
        
        variable = TemplateVariable(
            workspace_id=workspace_id,
            name=name,
            display_name=display_name,
            description=description,
            data_type=data_type,
            default_value=default_value,
            is_required=is_required,
            category=category
        )
        
        self.db.add(variable)
        await self.db.commit()
        
        return variable
    
    # Template blocks for drag-and-drop builder
    
    async def get_template_blocks(
        self,
        workspace_id: Optional[str] = None,
        category: Optional[str] = None,
        block_type: Optional[str] = None
    ) -> List[TemplateBlock]:
        """Get available template blocks"""
        
        query = select(TemplateBlock).where(
            or_(
                TemplateBlock.workspace_id == workspace_id,
                TemplateBlock.is_system == True
            )
        )
        
        if category:
            query = query.where(TemplateBlock.category == category)
        
        if block_type:
            query = query.where(TemplateBlock.block_type == block_type)
        
        query = query.order_by(TemplateBlock.category, TemplateBlock.name)
        
        result = await self.db.execute(query)
        return result.scalars().all()
    
    # Template usage tracking
    
    async def track_template_usage(
        self,
        template_id: str,
        workspace_id: str,
        used_by: str,
        campaign_id: Optional[str] = None,
        recipient_email: Optional[str] = None,
        subject_used: Optional[str] = None,
        variables_used: Optional[Dict[str, Any]] = None,
        usage_type: str = "campaign"
    ) -> TemplateUsage:
        """Track template usage for analytics"""
        
        usage = TemplateUsage(
            template_id=template_id,
            workspace_id=workspace_id,
            used_by=used_by,
            campaign_id=campaign_id,
            recipient_email=recipient_email,
            subject_used=subject_used,
            variables_used=variables_used,
            usage_type=usage_type,
            sent_at=datetime.utcnow() if usage_type == "campaign" else None
        )
        
        self.db.add(usage)
        
        # Update template usage count
        await self.db.execute(
            update(EmailTemplate)
            .where(EmailTemplate.id == template_id)
            .values(usage_count=EmailTemplate.usage_count + 1)
        )
        
        await self.db.commit()
        
        return usage
    
    async def update_template_performance(
        self,
        usage_id: str,
        opened_at: Optional[datetime] = None,
        clicked_at: Optional[datetime] = None,
        replied_at: Optional[datetime] = None,
        bounced_at: Optional[datetime] = None
    ):
        """Update template performance metrics"""
        
        updates = {}
        if opened_at:
            updates['opened_at'] = opened_at
        if clicked_at:
            updates['clicked_at'] = clicked_at
        if replied_at:
            updates['replied_at'] = replied_at
        if bounced_at:
            updates['bounced_at'] = bounced_at
        
        if updates:
            await self.db.execute(
                update(TemplateUsage)
                .where(TemplateUsage.id == usage_id)
                .values(**updates)
            )
            await self.db.commit()
    
    # Template library
    
    async def submit_to_library(
        self,
        template_id: str,
        user_id: str,
        title: str,
        description: str,
        industry: Optional[str] = None,
        use_case: Optional[str] = None
    ) -> TemplateLibrary:
        """Submit template to public library"""
        
        library_entry = TemplateLibrary(
            template_id=template_id,
            title=title,
            description=description,
            industry=industry,
            use_case=use_case,
            submitted_by=user_id
        )
        
        self.db.add(library_entry)
        await self.db.commit()
        
        return library_entry
    
    async def get_library_templates(
        self,
        industry: Optional[str] = None,
        use_case: Optional[str] = None,
        featured_only: bool = False,
        limit: int = 20,
        offset: int = 0
    ) -> List[TemplateLibrary]:
        """Get templates from public library"""
        
        query = select(TemplateLibrary).options(
            selectinload(TemplateLibrary.template)
        ).where(
            and_(
                TemplateLibrary.is_approved == True,
                TemplateLibrary.is_active == True
            )
        )
        
        if industry:
            query = query.where(TemplateLibrary.industry == industry)
        
        if use_case:
            query = query.where(TemplateLibrary.use_case == use_case)
        
        if featured_only:
            query = query.where(TemplateLibrary.is_featured == True)
        
        query = query.order_by(
            TemplateLibrary.is_featured.desc(),
            TemplateLibrary.rating.desc(),
            TemplateLibrary.download_count.desc()
        ).limit(limit).offset(offset)
        
        result = await self.db.execute(query)
        return result.scalars().all()
    
    # Helper methods
    
    def _substitute_variables(self, content: str, variables: Dict[str, Any]) -> str:
        """Substitute variables in content using {{variable}} syntax"""
        
        if not content:
            return ''
        
        def replace_var(match):
            var_name = match.group(1).strip()
            return str(variables.get(var_name, f"{{{{{var_name}}}}}"))
        
        # Replace {{variable}} patterns
        return re.sub(r'\{\{\s*([^}]+)\s*\}\}', replace_var, content)
    
    async def _extract_template_variables(self, template: EmailTemplate):
        """Extract variables from template content and update template.variables"""
        
        content_to_scan = [
            template.subject or '',
            template.html_content or '',
            template.text_content or ''
        ]
        
        variables = set()
        
        for content in content_to_scan:
            # Find all {{variable}} patterns
            matches = re.findall(r'\{\{\s*([^}]+)\s*\}\}', content)
            variables.update(match.strip() for match in matches)
        
        # Update template variables
        existing_vars = template.variables or {}
        for var in variables:
            if var not in existing_vars:
                existing_vars[var] = {
                    'type': 'string',
                    'required': False,
                    'default': ''
                }
        
        template.variables = existing_vars
        await self.db.commit()