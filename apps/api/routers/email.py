"""
Email management and sending endpoints.
"""
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import get_current_active_user, require_permissions
from models.user import User
from services.campaign_service import CampaignService
from services.lead_service import LeadService
from utils.email_client import AdvancedEmailClient, EmailTemplate, email_client
from workers.email_tasks import send_single_email, send_bulk_emails, process_email_queue

router = APIRouter()


class SendEmailRequest(BaseModel):
    to_email: EmailStr
    subject: str
    html_content: str
    text_content: Optional[str] = None
    from_name: Optional[str] = None
    reply_to: Optional[EmailStr] = None
    campaign_id: Optional[UUID] = None
    lead_id: Optional[UUID] = None
    add_tracking: bool = True
    priority: int = 5
    scheduled_at: Optional[datetime] = None


class SendBulkEmailRequest(BaseModel):
    recipients: List[EmailStr]
    subject: str
    html_content: str
    text_content: Optional[str] = None
    from_name: Optional[str] = None
    reply_to: Optional[EmailStr] = None
    campaign_id: Optional[UUID] = None
    add_tracking: bool = True
    priority: int = 5
    batch_size: int = 100


class SendTemplateEmailRequest(BaseModel):
    to_email: EmailStr
    template_subject: str
    template_html: str
    template_text: Optional[str] = None
    variables: Dict[str, Any]
    from_name: Optional[str] = None
    reply_to: Optional[EmailStr] = None
    campaign_id: Optional[UUID] = None
    lead_id: Optional[UUID] = None
    add_tracking: bool = True
    priority: int = 5


class EmailStatsResponse(BaseModel):
    email_id: str
    status: str
    events: List[Dict[str, Any]]
    sent_at: Optional[datetime]
    opened_at: Optional[datetime]
    clicked_at: Optional[datetime]
    open_count: int
    click_count: int


class QueueStatsResponse(BaseModel):
    queued: int
    scheduled: int
    processing: int
    failed: int
    total_processed: int
    success_rate: float


@router.post("/send")
async def send_email(
    email_request: SendEmailRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_permissions({"campaigns:write"})),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, str]:
    """Send a single email."""
    
    # Validate campaign and lead access if provided
    if email_request.campaign_id:
        campaign_service = CampaignService(db)
        campaign = await campaign_service.get_campaign_by_id(email_request.campaign_id)
        if not campaign or campaign.workspace_id != current_user.workspace_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to campaign"
            )
    
    if email_request.lead_id:
        lead_service = LeadService(db)
        lead = await lead_service.get_lead_by_id(email_request.lead_id)
        if not lead or lead.workspace_id != current_user.workspace_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to lead"
            )
    
    # Queue email for sending
    background_tasks.add_task(
        send_single_email,
        to_email=email_request.to_email,
        subject=email_request.subject,
        html_content=email_request.html_content,
        text_content=email_request.text_content,
        from_name=email_request.from_name,
        reply_to=email_request.reply_to,
        campaign_id=email_request.campaign_id,
        lead_id=email_request.lead_id,
        workspace_id=current_user.workspace_id,
        add_tracking=email_request.add_tracking,
        priority=email_request.priority,
        scheduled_at=email_request.scheduled_at
    )
    
    return {"message": "Email queued successfully"}


@router.post("/send-bulk")
async def send_bulk_email(
    bulk_request: SendBulkEmailRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_permissions({"campaigns:write"})),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Send bulk emails."""
    
    # Validate campaign access if provided
    if bulk_request.campaign_id:
        campaign_service = CampaignService(db)
        campaign = await campaign_service.get_campaign_by_id(bulk_request.campaign_id)
        if not campaign or campaign.workspace_id != current_user.workspace_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to campaign"
            )
    
    # Limit bulk size for protection
    if len(bulk_request.recipients) > 10000:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bulk email limited to 10,000 recipients per request"
        )
    
    # Queue bulk emails
    background_tasks.add_task(
        send_bulk_emails,
        recipients=bulk_request.recipients,
        subject=bulk_request.subject,
        html_content=bulk_request.html_content,
        text_content=bulk_request.text_content,
        from_name=bulk_request.from_name,
        reply_to=bulk_request.reply_to,
        campaign_id=bulk_request.campaign_id,
        workspace_id=current_user.workspace_id,
        add_tracking=bulk_request.add_tracking,
        priority=bulk_request.priority,
        batch_size=bulk_request.batch_size
    )
    
    return {
        "message": f"Bulk email queued for {len(bulk_request.recipients)} recipients",
        "recipient_count": len(bulk_request.recipients)
    }


@router.post("/send-template")
async def send_template_email(
    template_request: SendTemplateEmailRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_permissions({"campaigns:write"})),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, str]:
    """Send email using template with variables."""
    
    # Validate campaign and lead access if provided
    if template_request.campaign_id:
        campaign_service = CampaignService(db)
        campaign = await campaign_service.get_campaign_by_id(template_request.campaign_id)
        if not campaign or campaign.workspace_id != current_user.workspace_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to campaign"
            )
    
    if template_request.lead_id:
        lead_service = LeadService(db)
        lead = await lead_service.get_lead_by_id(template_request.lead_id)
        if not lead or lead.workspace_id != current_user.workspace_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to lead"
            )
    
    try:
        # Create and render template
        template = EmailTemplate(
            subject=template_request.template_subject,
            html_content=template_request.template_html,
            text_content=template_request.template_text
        )
        rendered = template.render(template_request.variables)
        
        # Queue email for sending
        background_tasks.add_task(
            send_single_email,
            to_email=template_request.to_email,
            subject=rendered["subject"],
            html_content=rendered["html"],
            text_content=rendered["text"],
            from_name=template_request.from_name,
            reply_to=template_request.reply_to,
            campaign_id=template_request.campaign_id,
            lead_id=template_request.lead_id,
            workspace_id=current_user.workspace_id,
            add_tracking=template_request.add_tracking,
            priority=template_request.priority
        )
        
        return {"message": "Template email queued successfully"}
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Template rendering error: {str(e)}"
        )


@router.get("/stats/{email_id}", response_model=EmailStatsResponse)
async def get_email_stats(
    email_id: str,
    current_user: User = Depends(get_current_active_user)
) -> EmailStatsResponse:
    """Get statistics and events for a specific email."""
    
    try:
        # Get email events from Redis
        events = await email_client.get_email_events(email_id)
        
        # Process events
        open_events = [e for e in events if e["event"] == "open"]
        click_events = [e for e in events if e["event"] == "click"]
        
        # Determine status
        status_value = "sent"
        if open_events:
            status_value = "opened"
        if click_events:
            status_value = "clicked"
        
        # Get timestamps
        sent_at = None
        opened_at = open_events[0]["timestamp"] if open_events else None
        clicked_at = click_events[0]["timestamp"] if click_events else None
        
        return EmailStatsResponse(
            email_id=email_id,
            status=status_value,
            events=events,
            sent_at=sent_at,
            opened_at=datetime.fromisoformat(opened_at) if opened_at else None,
            clicked_at=datetime.fromisoformat(clicked_at) if clicked_at else None,
            open_count=len(open_events),
            click_count=len(click_events)
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Email not found: {str(e)}"
        )


@router.get("/queue/stats", response_model=QueueStatsResponse)
async def get_queue_stats(
    current_user: User = Depends(require_permissions({"analytics:read"}))
) -> QueueStatsResponse:
    """Get email queue statistics."""
    
    try:
        stats = await email_client.get_queue_stats()
        
        # Calculate additional metrics
        total_processed = stats.get("sent", 0) + stats.get("failed", 0)
        success_rate = (stats.get("sent", 0) / total_processed * 100) if total_processed > 0 else 0
        
        return QueueStatsResponse(
            queued=stats["queued"],
            scheduled=stats["scheduled"],
            processing=stats["processing"],
            failed=stats["failed"],
            total_processed=total_processed,
            success_rate=round(success_rate, 2)
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting queue stats: {str(e)}"
        )


@router.post("/queue/process")
async def process_queue(
    max_emails: int = Query(100, ge=1, le=1000),
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_permissions({"campaigns:write"}))
) -> Dict[str, str]:
    """Manually trigger email queue processing."""
    
    background_tasks.add_task(process_email_queue, max_emails)
    
    return {"message": f"Email queue processing triggered for up to {max_emails} emails"}


@router.get("/track/open/{email_id}")
async def track_email_open(
    email_id: str,
    request: Request
) -> bytes:
    """Track email open event."""
    
    try:
        # Get client info
        user_agent = request.headers.get("user-agent", "")
        ip_address = request.client.host if request.client else ""
        
        # Record open event
        await email_client.tracker.record_open(email_id, user_agent, ip_address)
        
        # Return 1x1 transparent pixel
        pixel_data = b'\x47\x49\x46\x38\x39\x61\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff\x00\x00\x00\x21\xf9\x04\x01\x00\x00\x00\x00\x2c\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02\x04\x01\x00\x3b'
        
        return pixel_data
        
    except Exception as e:
        logger.error(f"Error tracking email open {email_id}: {str(e)}")
        return b''


@router.get("/track/click/{email_id}")
async def track_email_click(
    email_id: str,
    url: str = Query(..., description="Original URL to redirect to"),
    request: Request
) -> Dict[str, str]:
    """Track email click event and redirect."""
    
    try:
        # Get client info
        user_agent = request.headers.get("user-agent", "")
        ip_address = request.client.host if request.client else ""
        
        # Record click event
        await email_client.tracker.record_click(email_id, url, user_agent, ip_address)
        
        # Return redirect URL
        return {"redirect_url": url}
        
    except Exception as e:
        logger.error(f"Error tracking email click {email_id}: {str(e)}")
        return {"redirect_url": url}


@router.get("/deliverability/reputation/{domain}")
async def get_domain_reputation(
    domain: str,
    current_user: User = Depends(require_permissions({"analytics:read"}))
) -> Dict[str, Any]:
    """Get deliverability reputation for a domain."""
    
    try:
        reputation = await email_client.deliverability_monitor.check_reputation(domain)
        return reputation
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error checking domain reputation: {str(e)}"
        )


@router.get("/deliverability/suppression-list")
async def get_suppression_list(
    current_user: User = Depends(require_permissions({"analytics:read"}))
) -> Dict[str, List[str]]:
    """Get SES suppression list."""
    
    try:
        suppressed = await email_client.deliverability_monitor.get_suppression_list()
        return {"suppressed_emails": suppressed}
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting suppression list: {str(e)}"
        )


@router.post("/test")
async def send_test_email(
    to_email: EmailStr,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_active_user)
) -> Dict[str, str]:
    """Send a test email to verify email sending functionality."""
    
    subject = "ColdCopy Test Email"
    html_content = f"""
    <html>
    <body>
        <h2>ColdCopy Test Email</h2>
        <p>Hello,</p>
        <p>This is a test email from ColdCopy to verify that email sending is working correctly.</p>
        <p>Sent by: {current_user.email}</p>
        <p>Workspace: {current_user.workspace_id}</p>
        <p>Timestamp: {datetime.utcnow().isoformat()}</p>
        <br>
        <p>Best regards,<br>The ColdCopy Team</p>
    </body>
    </html>
    """
    
    text_content = f"""
    ColdCopy Test Email
    
    Hello,
    
    This is a test email from ColdCopy to verify that email sending is working correctly.
    
    Sent by: {current_user.email}
    Workspace: {current_user.workspace_id}
    Timestamp: {datetime.utcnow().isoformat()}
    
    Best regards,
    The ColdCopy Team
    """
    
    # Queue test email
    background_tasks.add_task(
        send_single_email,
        to_email=to_email,
        subject=subject,
        html_content=html_content,
        text_content=text_content,
        workspace_id=current_user.workspace_id,
        add_tracking=True,
        priority=1  # High priority for test emails
    )
    
    return {"message": f"Test email queued for {to_email}"}


@router.get("/templates/variables")
async def get_template_variables(
    current_user: User = Depends(get_current_active_user)
) -> Dict[str, Any]:
    """Get available template variables for email composition."""
    
    return {
        "lead_variables": [
            "first_name", "last_name", "full_name", "email", "company",
            "title", "phone", "website", "industry", "location"
        ],
        "campaign_variables": [
            "campaign_name", "campaign_id", "sender_name", "sender_email"
        ],
        "workspace_variables": [
            "workspace_name", "workspace_domain"
        ],
        "system_variables": [
            "current_date", "current_time", "unsubscribe_url", "tracking_pixel"
        ],
        "custom_variables": [
            "custom_field_1", "custom_field_2", "custom_field_3"
        ]
    }