#!/usr/bin/env python3
"""
High-level Email Service API
Provides simple interface for sending emails through the infrastructure
"""

import os
from typing import List, Dict, Optional, Any, Union
from datetime import datetime
import asyncio
import logging
from dataclasses import dataclass
from pydantic import BaseModel, EmailStr, validator
from ses_manager import SESManager, EmailMessage, EmailType, SESConfig
from warmup_manager import WarmupManager
from reputation_monitor import ReputationMonitor
import redis
import json

logger = logging.getLogger(__name__)


class EmailRecipient(BaseModel):
    """Email recipient model"""
    email: EmailStr
    name: Optional[str] = None
    merge_vars: Dict[str, Any] = {}


class EmailTemplate(BaseModel):
    """Email template model"""
    subject: str
    html_body: str
    text_body: Optional[str] = None
    
    @validator('text_body', always=True)
    def ensure_text_body(cls, v, values):
        if not v and 'html_body' in values:
            # Simple HTML to text conversion
            import re
            text = re.sub('<[^<]+?>', '', values['html_body'])
            return text.strip()
        return v


class SendEmailRequest(BaseModel):
    """Email send request model"""
    recipients: List[EmailRecipient]
    template: EmailTemplate
    from_email: Optional[EmailStr] = None
    from_name: Optional[str] = None
    reply_to: Optional[EmailStr] = None
    email_type: str = "transactional"
    workspace_id: Optional[str] = None
    campaign_id: Optional[str] = None
    lead_ids: Optional[List[str]] = None
    tags: List[str] = []
    tracking_enabled: bool = True
    send_at: Optional[datetime] = None
    
    @validator('email_type')
    def validate_email_type(cls, v):
        valid_types = ["transactional", "marketing", "notification", "system"]
        if v not in valid_types:
            raise ValueError(f"email_type must be one of {valid_types}")
        return v


class BulkEmailRequest(BaseModel):
    """Bulk email send request"""
    template: EmailTemplate
    recipients_csv: Optional[str] = None  # CSV data or file path
    from_email: Optional[EmailStr] = None
    from_name: Optional[str] = None
    email_type: str = "marketing"
    workspace_id: str
    campaign_id: str
    tags: List[str] = []
    daily_limit: int = 10000
    send_time_start: int = 9  # 9 AM
    send_time_end: int = 17   # 5 PM
    timezone: str = "America/New_York"


@dataclass
class EmailServiceConfig:
    """Email service configuration"""
    ses_config: SESConfig
    redis_url: str = "redis://localhost:6379"
    default_from_email: str = "noreply@coldcopy.ai"
    default_from_name: str = "ColdCopy"
    max_retries: int = 3
    retry_delay: int = 60  # seconds
    batch_size: int = 50


class EmailService:
    """High-level email service for application integration"""
    
    def __init__(self, config: EmailServiceConfig):
        self.config = config
        self.ses_manager = SESManager(config.ses_config)
        self.warmup_manager = WarmupManager(config.ses_config)
        self.reputation_monitor = ReputationMonitor(config.ses_config)
        self.redis_client = redis.from_url(config.redis_url, decode_responses=True)
        
    async def send_email(self, request: SendEmailRequest) -> Dict[str, Any]:
        """Send email to one or more recipients"""
        results = {
            'successful': [],
            'failed': [],
            'queued': [],
            'suppressed': []
        }
        
        # Map email type
        email_type_map = {
            'transactional': EmailType.TRANSACTIONAL,
            'marketing': EmailType.MARKETING,
            'notification': EmailType.NOTIFICATION,
            'system': EmailType.SYSTEM
        }
        email_type = email_type_map.get(request.email_type, EmailType.TRANSACTIONAL)
        
        # Process each recipient
        for idx, recipient in enumerate(request.recipients):
            try:
                # Apply merge variables to template
                subject = self._apply_merge_vars(request.template.subject, recipient.merge_vars)
                html_body = self._apply_merge_vars(request.template.html_body, recipient.merge_vars)
                text_body = self._apply_merge_vars(request.template.text_body, recipient.merge_vars)
                
                # Create email message
                message = EmailMessage(
                    to_addresses=[recipient.email],
                    from_address=request.from_email or self.config.default_from_email,
                    from_name=request.from_name or self.config.default_from_name,
                    subject=subject,
                    html_body=html_body,
                    text_body=text_body,
                    email_type=email_type,
                    workspace_id=request.workspace_id,
                    campaign_id=request.campaign_id,
                    lead_id=request.lead_ids[idx] if request.lead_ids and idx < len(request.lead_ids) else None,
                    reply_to=request.reply_to,
                    tags=request.tags,
                    tracking_enabled=request.tracking_enabled
                )
                
                # Check if scheduled
                if request.send_at and request.send_at > datetime.utcnow():
                    await self._schedule_email(message, request.send_at)
                    results['queued'].append({
                        'email': recipient.email,
                        'scheduled_for': request.send_at.isoformat()
                    })
                else:
                    # Send immediately
                    success, message_id = await self.ses_manager.send_email(message)
                    
                    if success:
                        results['successful'].append({
                            'email': recipient.email,
                            'message_id': message_id
                        })
                    else:
                        if 'suppressed' in message_id.lower():
                            results['suppressed'].append({
                                'email': recipient.email,
                                'reason': message_id
                            })
                        else:
                            results['failed'].append({
                                'email': recipient.email,
                                'error': message_id
                            })
                
            except Exception as e:
                logger.error(f"Failed to send to {recipient.email}: {str(e)}")
                results['failed'].append({
                    'email': recipient.email,
                    'error': str(e)
                })
        
        # Calculate summary
        total = len(request.recipients)
        results['summary'] = {
            'total': total,
            'successful': len(results['successful']),
            'failed': len(results['failed']),
            'queued': len(results['queued']),
            'suppressed': len(results['suppressed']),
            'success_rate': (len(results['successful']) / total * 100) if total > 0 else 0
        }
        
        return results
    
    def _apply_merge_vars(self, template: str, merge_vars: Dict[str, Any]) -> str:
        """Apply merge variables to template"""
        if not merge_vars:
            return template
        
        for key, value in merge_vars.items():
            placeholder = f"{{{{{key}}}}}"  # {{variable}}
            template = template.replace(placeholder, str(value))
        
        return template
    
    async def _schedule_email(self, message: EmailMessage, send_at: datetime):
        """Schedule email for future delivery"""
        # Store in Redis sorted set with timestamp as score
        key = "scheduled_emails"
        data = {
            'message': message.__dict__,
            'scheduled_at': send_at.isoformat()
        }
        
        self.redis_client.zadd(
            key,
            {json.dumps(data): send_at.timestamp()}
        )
    
    async def send_transactional_email(self, 
                                     to_email: str,
                                     subject: str,
                                     html_body: str,
                                     text_body: Optional[str] = None,
                                     **kwargs) -> Dict[str, Any]:
        """Convenience method for sending transactional emails"""
        request = SendEmailRequest(
            recipients=[EmailRecipient(email=to_email)],
            template=EmailTemplate(
                subject=subject,
                html_body=html_body,
                text_body=text_body
            ),
            email_type="transactional",
            tracking_enabled=False,  # Usually disabled for transactional
            **kwargs
        )
        
        return await self.send_email(request)
    
    async def send_campaign_email(self,
                                 campaign_id: str,
                                 workspace_id: str,
                                 recipients: List[Dict[str, Any]],
                                 template: EmailTemplate,
                                 **kwargs) -> Dict[str, Any]:
        """Send marketing campaign emails"""
        # Convert recipients
        email_recipients = []
        lead_ids = []
        
        for recipient in recipients:
            email_recipients.append(EmailRecipient(
                email=recipient['email'],
                name=recipient.get('name'),
                merge_vars=recipient.get('merge_vars', {})
            ))
            lead_ids.append(recipient.get('lead_id'))
        
        request = SendEmailRequest(
            recipients=email_recipients,
            template=template,
            email_type="marketing",
            workspace_id=workspace_id,
            campaign_id=campaign_id,
            lead_ids=lead_ids,
            tracking_enabled=True,
            **kwargs
        )
        
        return await self.send_email(request)
    
    async def get_email_status(self, message_id: str) -> Dict[str, Any]:
        """Get status of a sent email"""
        # Query events from Redis
        pattern = f"email:event:*:*:{message_id}"
        events = []
        
        for key in self.redis_client.scan_iter(match=pattern):
            event_data = self.redis_client.get(key)
            if event_data:
                events.append(json.loads(event_data))
        
        # Sort events by timestamp
        events.sort(key=lambda x: x['timestamp'])
        
        # Determine current status
        status = "sent"
        if any(e['event_type'] == 'Delivery' for e in events):
            status = "delivered"
        elif any(e['event_type'] == 'Bounce' for e in events):
            status = "bounced"
        elif any(e['event_type'] == 'Complaint' for e in events):
            status = "complained"
        
        # Check engagement
        opens = sum(1 for e in events if e['event_type'] == 'Open')
        clicks = sum(1 for e in events if e['event_type'] == 'Click')
        
        return {
            'message_id': message_id,
            'status': status,
            'events': events,
            'engagement': {
                'opened': opens > 0,
                'open_count': opens,
                'clicked': clicks > 0,
                'click_count': clicks
            }
        }
    
    async def validate_email(self, email: str) -> Dict[str, Any]:
        """Validate email address"""
        from email_validator import validate_email as _validate_email, EmailNotValidError
        
        try:
            # Validate format
            validation = _validate_email(email, check_deliverability=True)
            
            # Check suppression list
            is_suppressed = await self.ses_manager._is_suppressed(email)
            
            # Check recent bounce history
            bounce_key = f"ses:bounces:{email.lower()}"
            bounce_count = int(self.redis_client.get(bounce_key) or 0)
            
            return {
                'valid': True,
                'normalized': validation.email,
                'local': validation.local,
                'domain': validation.domain,
                'is_suppressed': is_suppressed,
                'bounce_count': bounce_count,
                'risk_level': 'high' if is_suppressed or bounce_count > 0 else 'low'
            }
            
        except EmailNotValidError as e:
            return {
                'valid': False,
                'error': str(e),
                'risk_level': 'invalid'
            }
    
    async def get_sending_stats(self, workspace_id: Optional[str] = None,
                               period_hours: int = 24) -> Dict[str, Any]:
        """Get sending statistics"""
        stats = await self.ses_manager.get_email_statistics(workspace_id)
        
        # Get reputation metrics
        current_metrics = await self.reputation_monitor.collect_metrics()
        
        # Combine stats
        combined_stats = {
            'period': {
                'hours': period_hours,
                'start': (datetime.utcnow() - timedelta(hours=period_hours)).isoformat(),
                'end': datetime.utcnow().isoformat()
            },
            'volume': stats['totals'],
            'reputation': {},
            'health': {}
        }
        
        # Add reputation data
        for region, metrics in current_metrics.items():
            combined_stats['reputation'][region] = {
                'bounce_rate': metrics.bounce_rate,
                'complaint_rate': metrics.complaint_rate,
                'reputation_score': metrics.reputation_score,
                'health_status': metrics.health_status
            }
        
        # Overall health
        health_statuses = [m.health_status for m in current_metrics.values()]
        if 'critical' in health_statuses:
            combined_stats['health']['overall'] = 'critical'
        elif 'warning' in health_statuses:
            combined_stats['health']['overall'] = 'warning'
        else:
            combined_stats['health']['overall'] = 'healthy'
        
        return combined_stats
    
    async def process_scheduled_emails(self):
        """Process scheduled emails (run as background task)"""
        while True:
            try:
                # Get emails due for sending
                now = datetime.utcnow().timestamp()
                key = "scheduled_emails"
                
                # Get emails with score (timestamp) <= now
                due_emails = self.redis_client.zrangebyscore(key, 0, now, withscores=True)
                
                for email_data, score in due_emails:
                    try:
                        data = json.loads(email_data)
                        message_dict = data['message']
                        
                        # Recreate EmailMessage
                        message = EmailMessage(**message_dict)
                        
                        # Send email
                        await self.ses_manager.send_email(message)
                        
                        # Remove from scheduled set
                        self.redis_client.zrem(key, email_data)
                        
                    except Exception as e:
                        logger.error(f"Failed to send scheduled email: {str(e)}")
                
            except Exception as e:
                logger.error(f"Scheduled email processor error: {str(e)}")
            
            # Check every minute
            await asyncio.sleep(60)


# FastAPI integration example
def create_email_service() -> EmailService:
    """Create email service instance for FastAPI"""
    ses_config = SESConfig(
        aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
        aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
        primary_region=os.getenv('AWS_REGION', 'us-east-1'),
        backup_regions=os.getenv('AWS_BACKUP_REGIONS', 'eu-west-1').split(','),
        redis_url=os.getenv('REDIS_URL', 'redis://localhost:6379'),
        marketing_config_set=os.getenv('MARKETING_CONFIG_SET', 'coldcopy-marketing'),
        transactional_config_set=os.getenv('TRANSACTIONAL_CONFIG_SET', 'coldcopy-transactional'),
        tracking_domain=os.getenv('TRACKING_DOMAIN', 'track.coldcopy.ai'),
        tracking_pixel_url=os.getenv('TRACKING_PIXEL_URL', 'https://track.coldcopy.ai/pixel'),
        click_tracking_url=os.getenv('CLICK_TRACKING_URL', 'https://track.coldcopy.ai/click'),
        unsubscribe_url=os.getenv('UNSUBSCRIBE_URL', 'https://app.coldcopy.ai/unsubscribe')
    )
    
    service_config = EmailServiceConfig(
        ses_config=ses_config,
        redis_url=os.getenv('REDIS_URL', 'redis://localhost:6379'),
        default_from_email=os.getenv('FROM_EMAIL', 'noreply@coldcopy.ai'),
        default_from_name=os.getenv('FROM_NAME', 'ColdCopy')
    )
    
    return EmailService(service_config)