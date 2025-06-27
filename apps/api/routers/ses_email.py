"""
Email Service Router for FastAPI
Integrates the email infrastructure with the main API
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from typing import List, Dict, Any, Optional
from datetime import datetime
import sys
import os

# Add email infrastructure to path
sys.path.append(os.path.join(os.path.dirname(__file__), '../../../infrastructure/email'))

from email_service import (
    EmailService, 
    SendEmailRequest, 
    BulkEmailRequest,
    EmailRecipient,
    EmailTemplate,
    create_email_service
)
from core.auth import get_current_user, User
from models.workspace import Workspace
from database import get_db
from sqlalchemy.orm import Session
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ses", tags=["ses-email"])

# Create email service instance
email_service = create_email_service()


@router.post("/send")
async def send_email(
    request: SendEmailRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Send email to one or more recipients"""
    try:
        # Add workspace context
        if not request.workspace_id:
            request.workspace_id = str(current_user.workspace_id)
        
        # Validate user has access to workspace
        workspace = db.query(Workspace).filter(
            Workspace.id == request.workspace_id,
            Workspace.id == current_user.workspace_id
        ).first()
        
        if not workspace:
            raise HTTPException(status_code=403, detail="Access denied to workspace")
        
        # Check sending limits
        # TODO: Implement rate limiting and quota checks
        
        # Send emails
        result = await email_service.send_email(request)
        
        # Log activity
        logger.info(f"User {current_user.id} sent {result['summary']['successful']} emails")
        
        return result
        
    except Exception as e:
        logger.error(f"Email send error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/send/transactional")
async def send_transactional_email(
    to_email: str,
    subject: str,
    html_body: str,
    text_body: Optional[str] = None,
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Send a transactional email"""
    try:
        result = await email_service.send_transactional_email(
            to_email=to_email,
            subject=subject,
            html_body=html_body,
            text_body=text_body,
            workspace_id=str(current_user.workspace_id)
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Transactional email error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/campaigns/{campaign_id}/send")
async def send_campaign_emails(
    campaign_id: str,
    recipients: List[Dict[str, Any]],
    template: EmailTemplate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Send campaign emails"""
    try:
        # Verify campaign ownership
        # TODO: Add campaign validation
        
        result = await email_service.send_campaign_email(
            campaign_id=campaign_id,
            workspace_id=str(current_user.workspace_id),
            recipients=recipients,
            template=template,
            from_email=current_user.workspace.from_email,
            from_name=current_user.workspace.from_name
        )
        
        # Update campaign stats in background
        background_tasks.add_task(
            update_campaign_stats,
            campaign_id,
            result['summary']
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Campaign send error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status/{message_id}")
async def get_email_status(
    message_id: str,
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get status of a sent email"""
    try:
        status = await email_service.get_email_status(message_id)
        return status
        
    except Exception as e:
        logger.error(f"Status check error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/validate")
async def validate_email_address(
    email: str,
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Validate an email address"""
    try:
        validation = await email_service.validate_email(email)
        return validation
        
    except Exception as e:
        logger.error(f"Validation error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats")
async def get_email_statistics(
    period_hours: int = 24,
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get email sending statistics"""
    try:
        stats = await email_service.get_sending_stats(
            workspace_id=str(current_user.workspace_id),
            period_hours=period_hours
        )
        
        return stats
        
    except Exception as e:
        logger.error(f"Stats error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/reputation")
async def get_reputation_status(
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get email reputation status"""
    try:
        # Get current reputation metrics
        metrics = await email_service.reputation_monitor.collect_metrics()
        
        # Get insights
        insights = await email_service.reputation_monitor.get_deliverability_insights()
        
        return {
            "metrics": {
                region: {
                    "bounce_rate": m.bounce_rate,
                    "complaint_rate": m.complaint_rate,
                    "reputation_score": m.reputation_score,
                    "health_status": m.health_status,
                    "issues": m.issues
                }
                for region, m in metrics.items()
            },
            "insights": insights
        }
        
    except Exception as e:
        logger.error(f"Reputation check error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/suppression-list")
async def get_suppression_list(
    page: int = 1,
    per_page: int = 100,
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get suppression list"""
    try:
        # Admin only
        if current_user.role != "admin":
            raise HTTPException(status_code=403, detail="Admin access required")
        
        result = await email_service.ses_manager.get_suppression_list(page, per_page)
        return result
        
    except Exception as e:
        logger.error(f"Suppression list error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/suppression/{email}")
async def remove_from_suppression(
    email: str,
    current_user: User = Depends(get_current_user)
) -> Dict[str, str]:
    """Remove email from suppression list"""
    try:
        # Admin only
        if current_user.role != "admin":
            raise HTTPException(status_code=403, detail="Admin access required")
        
        await email_service.ses_manager.remove_from_suppression_list(email)
        
        return {"message": f"{email} removed from suppression list"}
        
    except Exception as e:
        logger.error(f"Suppression removal error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# Background tasks
async def update_campaign_stats(campaign_id: str, summary: Dict[str, Any]):
    """Update campaign statistics in database"""
    # TODO: Implement campaign stats update
    logger.info(f"Updating campaign {campaign_id} stats: {summary}")


# WebSocket endpoint for real-time email events
from fastapi import WebSocket, WebSocketDisconnect
import asyncio

@router.websocket("/events")
async def email_events_websocket(
    websocket: WebSocket,
    current_user: User = Depends(get_current_user)
):
    """WebSocket for real-time email events"""
    await websocket.accept()
    
    # Subscribe to workspace events
    workspace_id = str(current_user.workspace_id)
    stream_key = f"email:events:{workspace_id}"
    
    try:
        while True:
            # Get latest events from Redis stream
            events = email_service.redis_client.xread(
                {stream_key: '$'},
                block=1000  # Block for 1 second
            )
            
            for stream, messages in events:
                for message_id, data in messages:
                    await websocket.send_json({
                        "event_id": message_id,
                        "data": data
                    })
            
            await asyncio.sleep(0.1)
            
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for user {current_user.id}")
    except Exception as e:
        logger.error(f"WebSocket error: {str(e)}")
        await websocket.close()


# Email templates management
@router.post("/templates")
async def create_email_template(
    name: str,
    subject: str,
    html_body: str,
    text_body: Optional[str] = None,
    tags: List[str] = [],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Create an email template"""
    # TODO: Implement template storage
    return {
        "id": "template_123",
        "name": name,
        "created_at": datetime.utcnow().isoformat()
    }


@router.get("/templates")
async def list_email_templates(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> List[Dict[str, Any]]:
    """List email templates for workspace"""
    # TODO: Implement template listing
    return []