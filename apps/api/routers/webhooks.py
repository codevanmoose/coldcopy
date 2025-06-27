"""
Email provider webhook handlers for delivery events.
"""
import logging
import hmac
import hashlib
import json
from typing import Dict, Any, Optional
from datetime import datetime

from fastapi import APIRouter, Request, HTTPException, status, Depends, BackgroundTasks
from pydantic import BaseModel, validator
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.config import get_settings
from workers.webhook_tasks import process_webhook_event

router = APIRouter()
logger = logging.getLogger(__name__)
settings = get_settings()


class WebhookEvent(BaseModel):
    """Generic webhook event model."""
    provider: str
    event_type: str
    message_id: str
    recipient_email: str
    timestamp: datetime
    event_data: Dict[str, Any]
    raw_payload: Optional[Dict[str, Any]] = None


class SESEvent(BaseModel):
    """Amazon SES webhook event model."""
    eventType: str
    mail: Dict[str, Any]
    bounce: Optional[Dict[str, Any]] = None
    complaint: Optional[Dict[str, Any]] = None
    delivery: Optional[Dict[str, Any]] = None
    send: Optional[Dict[str, Any]] = None
    open: Optional[Dict[str, Any]] = None
    click: Optional[Dict[str, Any]] = None
    reject: Optional[Dict[str, Any]] = None
    rendering_failure: Optional[Dict[str, Any]] = None
    delivery_delay: Optional[Dict[str, Any]] = None
    subscription: Optional[Dict[str, Any]] = None


class SendGridEvent(BaseModel):
    """SendGrid webhook event model."""
    event: str
    email: str
    timestamp: int
    sg_event_id: str
    sg_message_id: str
    useragent: Optional[str] = None
    ip: Optional[str] = None
    url: Optional[str] = None
    asm_group_id: Optional[int] = None
    reason: Optional[str] = None
    status: Optional[str] = None
    response: Optional[str] = None
    attempt: Optional[str] = None
    category: Optional[list] = None
    unique_args: Optional[Dict[str, Any]] = None
    marketing_campaign_id: Optional[str] = None
    marketing_campaign_name: Optional[str] = None


class MailgunEvent(BaseModel):
    """Mailgun webhook event model."""
    event: str
    recipient: str
    timestamp: float
    id: str
    message: Dict[str, Any]
    delivery_status: Optional[Dict[str, Any]] = None
    user_variables: Optional[Dict[str, Any]] = None
    client_info: Optional[Dict[str, Any]] = None
    geolocation: Optional[Dict[str, Any]] = None
    campaigns: Optional[list] = None
    tags: Optional[list] = None
    url: Optional[str] = None
    ip: Optional[str] = None


def verify_ses_signature(payload: str, signature: str, topic_arn: str) -> bool:
    """Verify Amazon SES webhook signature."""
    try:
        # SES uses SNS for webhooks, verify SNS signature
        # This is a simplified version - in production, you'd want to verify the full SNS message
        expected_signature = hmac.new(
            settings.AWS_SNS_SECRET.encode() if settings.AWS_SNS_SECRET else b'',
            payload.encode(),
            hashlib.sha256
        ).hexdigest()
        
        return hmac.compare_digest(signature, expected_signature)
    except Exception as e:
        logger.error(f"SES signature verification failed: {str(e)}")
        return False


def verify_sendgrid_signature(payload: str, signature: str, timestamp: str) -> bool:
    """Verify SendGrid webhook signature."""
    try:
        if not settings.SENDGRID_WEBHOOK_KEY:
            logger.warning("SendGrid webhook key not configured")
            return False
        
        # SendGrid uses ECDSA signature verification
        public_key = settings.SENDGRID_WEBHOOK_KEY
        
        # Simplified verification - in production, use proper ECDSA verification
        expected_signature = hmac.new(
            public_key.encode(),
            (timestamp + payload).encode(),
            hashlib.sha256
        ).hexdigest()
        
        return hmac.compare_digest(signature, expected_signature)
    except Exception as e:
        logger.error(f"SendGrid signature verification failed: {str(e)}")
        return False


def verify_mailgun_signature(payload: str, signature: str, timestamp: str) -> bool:
    """Verify Mailgun webhook signature."""
    try:
        if not settings.MAILGUN_WEBHOOK_KEY:
            logger.warning("Mailgun webhook key not configured")
            return False
        
        expected_signature = hmac.new(
            settings.MAILGUN_WEBHOOK_KEY.encode(),
            f"{timestamp}{payload}".encode(),
            hashlib.sha256
        ).hexdigest()
        
        return hmac.compare_digest(signature, expected_signature)
    except Exception as e:
        logger.error(f"Mailgun signature verification failed: {str(e)}")
        return False


async def parse_ses_event(event_data: Dict[str, Any]) -> WebhookEvent:
    """Parse Amazon SES event into standardized format."""
    try:
        # Handle SNS notification wrapper
        if "Message" in event_data:
            message = json.loads(event_data["Message"])
        else:
            message = event_data
        
        event_type = message.get("eventType", message.get("notificationType", "unknown"))
        mail = message.get("mail", {})
        
        # Extract recipient email
        recipient_email = ""
        if "destination" in mail and mail["destination"]:
            recipient_email = mail["destination"][0]
        
        # Extract message ID
        message_id = mail.get("messageId", "")
        
        # Convert timestamp
        timestamp_str = mail.get("timestamp")
        if timestamp_str:
            timestamp = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
        else:
            timestamp = datetime.utcnow()
        
        return WebhookEvent(
            provider="ses",
            event_type=event_type,
            message_id=message_id,
            recipient_email=recipient_email,
            timestamp=timestamp,
            event_data=message,
            raw_payload=event_data
        )
    
    except Exception as e:
        logger.error(f"Error parsing SES event: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid SES event format: {str(e)}"
        )


async def parse_sendgrid_events(events: list) -> list[WebhookEvent]:
    """Parse SendGrid events into standardized format."""
    parsed_events = []
    
    for event_data in events:
        try:
            event_type = event_data.get("event", "unknown")
            recipient_email = event_data.get("email", "")
            message_id = event_data.get("sg_message_id", "")
            timestamp = datetime.fromtimestamp(event_data.get("timestamp", 0))
            
            webhook_event = WebhookEvent(
                provider="sendgrid",
                event_type=event_type,
                message_id=message_id,
                recipient_email=recipient_email,
                timestamp=timestamp,
                event_data=event_data,
                raw_payload=event_data
            )
            
            parsed_events.append(webhook_event)
        
        except Exception as e:
            logger.error(f"Error parsing SendGrid event: {str(e)}")
            continue
    
    return parsed_events


async def parse_mailgun_event(event_data: Dict[str, Any]) -> WebhookEvent:
    """Parse Mailgun event into standardized format."""
    try:
        event_type = event_data.get("event", "unknown")
        recipient_email = event_data.get("recipient", "")
        message_id = event_data.get("id", "")
        timestamp = datetime.fromtimestamp(event_data.get("timestamp", 0))
        
        return WebhookEvent(
            provider="mailgun",
            event_type=event_type,
            message_id=message_id,
            recipient_email=recipient_email,
            timestamp=timestamp,
            event_data=event_data,
            raw_payload=event_data
        )
    
    except Exception as e:
        logger.error(f"Error parsing Mailgun event: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid Mailgun event format: {str(e)}"
        )


@router.post("/ses")
async def handle_ses_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """Handle Amazon SES webhook events."""
    try:
        # Get raw payload and headers
        payload = await request.body()
        payload_str = payload.decode('utf-8')
        
        # Parse JSON payload
        event_data = json.loads(payload_str)
        
        # Verify signature if enabled
        if settings.VERIFY_WEBHOOK_SIGNATURES:
            signature = request.headers.get("x-amz-sns-message-signature", "")
            topic_arn = request.headers.get("x-amz-sns-topic-arn", "")
            
            if not verify_ses_signature(payload_str, signature, topic_arn):
                logger.warning("SES webhook signature verification failed")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid webhook signature"
                )
        
        # Handle SNS subscription confirmation
        if event_data.get("Type") == "SubscriptionConfirmation":
            subscribe_url = event_data.get("SubscribeURL")
            if subscribe_url:
                logger.info(f"SES SNS subscription confirmation: {subscribe_url}")
                # In production, you might want to automatically confirm the subscription
                return {"message": "Subscription confirmation received", "subscribe_url": subscribe_url}
        
        # Parse the event
        webhook_event = await parse_ses_event(event_data)
        
        # Queue background processing
        background_tasks.add_task(
            process_webhook_event.delay,
            webhook_event.dict()
        )
        
        logger.info(f"SES webhook event queued: {webhook_event.event_type} for {webhook_event.recipient_email}")
        
        return {"message": "Event processed successfully"}
    
    except json.JSONDecodeError:
        logger.error("Invalid JSON in SES webhook payload")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid JSON payload"
        )
    
    except Exception as e:
        logger.error(f"Error processing SES webhook: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing webhook: {str(e)}"
        )


@router.post("/sendgrid")
async def handle_sendgrid_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """Handle SendGrid webhook events."""
    try:
        # Get raw payload and headers
        payload = await request.body()
        payload_str = payload.decode('utf-8')
        
        # Verify signature if enabled
        if settings.VERIFY_WEBHOOK_SIGNATURES:
            signature = request.headers.get("x-twilio-email-event-webhook-signature", "")
            timestamp = request.headers.get("x-twilio-email-event-webhook-timestamp", "")
            
            if not verify_sendgrid_signature(payload_str, signature, timestamp):
                logger.warning("SendGrid webhook signature verification failed")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid webhook signature"
                )
        
        # Parse JSON payload (SendGrid sends array of events)
        events = json.loads(payload_str)
        
        if not isinstance(events, list):
            events = [events]
        
        # Parse events
        webhook_events = await parse_sendgrid_events(events)
        
        # Queue background processing for each event
        for webhook_event in webhook_events:
            background_tasks.add_task(
                process_webhook_event.delay,
                webhook_event.dict()
            )
        
        logger.info(f"SendGrid webhook: {len(webhook_events)} events queued")
        
        return {"message": f"Processed {len(webhook_events)} events successfully"}
    
    except json.JSONDecodeError:
        logger.error("Invalid JSON in SendGrid webhook payload")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid JSON payload"
        )
    
    except Exception as e:
        logger.error(f"Error processing SendGrid webhook: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing webhook: {str(e)}"
        )


@router.post("/mailgun")
async def handle_mailgun_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """Handle Mailgun webhook events."""
    try:
        # Get form data (Mailgun sends form-encoded data)
        form_data = await request.form()
        
        # Convert form data to dict
        event_data = {}
        for key, value in form_data.items():
            if key == "event-data":
                # Event data is JSON-encoded
                event_data = json.loads(value)
            else:
                event_data[key] = value
        
        # Verify signature if enabled
        if settings.VERIFY_WEBHOOK_SIGNATURES:
            signature = form_data.get("signature", "")
            timestamp = form_data.get("timestamp", "")
            
            payload_str = json.dumps(event_data, sort_keys=True)
            
            if not verify_mailgun_signature(payload_str, signature, timestamp):
                logger.warning("Mailgun webhook signature verification failed")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid webhook signature"
                )
        
        # Parse the event
        webhook_event = await parse_mailgun_event(event_data)
        
        # Queue background processing
        background_tasks.add_task(
            process_webhook_event.delay,
            webhook_event.dict()
        )
        
        logger.info(f"Mailgun webhook event queued: {webhook_event.event_type} for {webhook_event.recipient_email}")
        
        return {"message": "Event processed successfully"}
    
    except json.JSONDecodeError:
        logger.error("Invalid JSON in Mailgun webhook payload")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid JSON payload"
        )
    
    except Exception as e:
        logger.error(f"Error processing Mailgun webhook: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing webhook: {str(e)}"
        )


@router.post("/postmark")
async def handle_postmark_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """Handle Postmark webhook events."""
    try:
        # Get raw payload
        payload = await request.body()
        payload_str = payload.decode('utf-8')
        
        # Parse JSON payload
        event_data = json.loads(payload_str)
        
        # Extract event details
        event_type = event_data.get("RecordType", "unknown").lower()
        recipient_email = event_data.get("Email", "")
        message_id = event_data.get("MessageID", "")
        
        # Convert timestamp
        delivered_at = event_data.get("DeliveredAt")
        bounced_at = event_data.get("BouncedAt")
        timestamp_str = delivered_at or bounced_at
        
        if timestamp_str:
            timestamp = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
        else:
            timestamp = datetime.utcnow()
        
        webhook_event = WebhookEvent(
            provider="postmark",
            event_type=event_type,
            message_id=message_id,
            recipient_email=recipient_email,
            timestamp=timestamp,
            event_data=event_data,
            raw_payload=event_data
        )
        
        # Queue background processing
        background_tasks.add_task(
            process_webhook_event.delay,
            webhook_event.dict()
        )
        
        logger.info(f"Postmark webhook event queued: {webhook_event.event_type} for {webhook_event.recipient_email}")
        
        return {"message": "Event processed successfully"}
    
    except json.JSONDecodeError:
        logger.error("Invalid JSON in Postmark webhook payload")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid JSON payload"
        )
    
    except Exception as e:
        logger.error(f"Error processing Postmark webhook: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing webhook: {str(e)}"
        )


@router.get("/health")
async def webhook_health_check():
    """Health check endpoint for webhook service."""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "supported_providers": ["ses", "sendgrid", "mailgun", "postmark"],
        "signature_verification": settings.VERIFY_WEBHOOK_SIGNATURES
    }


@router.get("/test/{provider}")
async def test_webhook_endpoint(
    provider: str,
    background_tasks: BackgroundTasks
):
    """Test webhook endpoint with sample data (development only)."""
    if settings.ENVIRONMENT == "production":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Test endpoints not available in production"
        )
    
    # Sample test events for each provider
    test_events = {
        "ses": {
            "eventType": "delivery",
            "mail": {
                "messageId": "test-message-id-123",
                "timestamp": datetime.utcnow().isoformat(),
                "destination": ["test@example.com"]
            },
            "delivery": {
                "timestamp": datetime.utcnow().isoformat(),
                "processingTimeMillis": 1234,
                "recipients": ["test@example.com"]
            }
        },
        "sendgrid": {
            "event": "delivered",
            "email": "test@example.com",
            "timestamp": int(datetime.utcnow().timestamp()),
            "sg_event_id": "test-event-id-123",
            "sg_message_id": "test-message-id-123"
        },
        "mailgun": {
            "event": "delivered",
            "recipient": "test@example.com",
            "timestamp": datetime.utcnow().timestamp(),
            "id": "test-message-id-123",
            "message": {
                "headers": {
                    "message-id": "test-message-id-123"
                }
            }
        }
    }
    
    if provider not in test_events:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown provider: {provider}"
        )
    
    # Create test webhook event
    if provider == "ses":
        webhook_event = await parse_ses_event(test_events[provider])
    elif provider == "sendgrid":
        webhook_events = await parse_sendgrid_events([test_events[provider]])
        webhook_event = webhook_events[0]
    elif provider == "mailgun":
        webhook_event = await parse_mailgun_event(test_events[provider])
    
    # Queue background processing
    background_tasks.add_task(
        process_webhook_event.delay,
        webhook_event.dict()
    )
    
    return {
        "message": f"Test {provider} webhook event queued",
        "event": webhook_event.dict()
    }