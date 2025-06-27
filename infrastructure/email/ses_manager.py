#!/usr/bin/env python3
"""
Amazon SES Multi-Region Manager
Handles email sending with automatic failover, reputation monitoring, and compliance
"""

import os
import json
import boto3
import logging
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
import asyncio
from concurrent.futures import ThreadPoolExecutor
import time
from botocore.exceptions import ClientError
import redis
from prometheus_client import Counter, Histogram, Gauge
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formataddr
import hashlib
import re
from urllib.parse import urlencode
import base64
import hmac

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class EmailType(Enum):
    """Types of emails for different configuration sets"""
    TRANSACTIONAL = "transactional"
    MARKETING = "marketing"
    NOTIFICATION = "notification"
    SYSTEM = "system"


class EmailStatus(Enum):
    """Email sending status"""
    PENDING = "pending"
    SENT = "sent"
    BOUNCED = "bounced"
    COMPLAINED = "complained"
    DELIVERED = "delivered"
    FAILED = "failed"
    QUEUED = "queued"


@dataclass
class SESRegion:
    """SES region configuration"""
    name: str
    endpoint: str
    is_primary: bool = False
    sending_rate: float = 14.0  # emails per second
    daily_quota: int = 50000
    reputation_threshold: float = 0.95
    is_sandboxed: bool = False
    dedicated_ips: List[str] = field(default_factory=list)


@dataclass
class EmailMessage:
    """Email message structure"""
    to_addresses: List[str]
    from_address: str
    from_name: str
    subject: str
    html_body: str
    text_body: str
    email_type: EmailType = EmailType.TRANSACTIONAL
    workspace_id: Optional[str] = None
    campaign_id: Optional[str] = None
    lead_id: Optional[str] = None
    reply_to: Optional[str] = None
    headers: Dict[str, str] = field(default_factory=dict)
    tags: List[str] = field(default_factory=list)
    configuration_set: Optional[str] = None
    tracking_enabled: bool = True
    attachments: List[Dict[str, Any]] = field(default_factory=list)


@dataclass
class SESConfig:
    """SES configuration"""
    # AWS credentials
    aws_access_key_id: str
    aws_secret_access_key: str
    
    # Regions
    primary_region: str = "us-east-1"
    backup_regions: List[str] = field(default_factory=lambda: ["eu-west-1"])
    
    # Redis for caching and rate limiting
    redis_url: str = "redis://localhost:6379"
    
    # Configuration sets
    marketing_config_set: str = "coldcopy-marketing"
    transactional_config_set: str = "coldcopy-transactional"
    
    # Suppression settings
    suppression_ttl_days: int = 90
    hard_bounce_threshold: int = 1
    complaint_threshold: int = 2
    
    # Rate limiting
    rate_limit_per_second: float = 14.0
    burst_size: int = 100
    
    # IP warm-up
    warmup_enabled: bool = True
    warmup_daily_increment: int = 50
    warmup_target_volume: int = 10000
    
    # Monitoring
    alert_email: Optional[str] = None
    reputation_alert_threshold: float = 0.90
    bounce_rate_alert_threshold: float = 0.05
    complaint_rate_alert_threshold: float = 0.001
    
    # Tracking
    tracking_domain: str = "track.coldcopy.ai"
    tracking_pixel_url: str = "https://track.coldcopy.ai/pixel"
    click_tracking_url: str = "https://track.coldcopy.ai/click"
    unsubscribe_url: str = "https://app.coldcopy.ai/unsubscribe"


# Prometheus metrics
emails_sent = Counter('coldcopy_emails_sent_total', 'Total emails sent', ['region', 'type', 'status'])
email_send_duration = Histogram('coldcopy_email_send_duration_seconds', 'Email send duration', ['region'])
email_queue_size = Gauge('coldcopy_email_queue_size', 'Current email queue size')
reputation_score = Gauge('coldcopy_ses_reputation_score', 'SES reputation score', ['region'])
bounce_rate = Gauge('coldcopy_ses_bounce_rate', 'SES bounce rate', ['region'])
complaint_rate = Gauge('coldcopy_ses_complaint_rate', 'SES complaint rate', ['region'])
daily_send_count = Gauge('coldcopy_daily_send_count', 'Daily send count', ['region'])
suppression_list_size = Gauge('coldcopy_suppression_list_size', 'Suppression list size')


class SESManager:
    """Manages Amazon SES across multiple regions with failover"""
    
    def __init__(self, config: SESConfig):
        self.config = config
        self.regions = self._initialize_regions()
        self.ses_clients = self._initialize_ses_clients()
        self.redis_client = redis.from_url(config.redis_url, decode_responses=True)
        self.executor = ThreadPoolExecutor(max_workers=10)
        
    def _initialize_regions(self) -> Dict[str, SESRegion]:
        """Initialize SES regions"""
        regions = {}
        
        # Primary region
        regions[self.config.primary_region] = SESRegion(
            name=self.config.primary_region,
            endpoint=f"email.{self.config.primary_region}.amazonaws.com",
            is_primary=True
        )
        
        # Backup regions
        for region in self.config.backup_regions:
            regions[region] = SESRegion(
                name=region,
                endpoint=f"email.{region}.amazonaws.com",
                is_primary=False
            )
        
        return regions
    
    def _initialize_ses_clients(self) -> Dict[str, boto3.client]:
        """Initialize SES clients for each region"""
        clients = {}
        
        for region_name in self.regions:
            clients[region_name] = boto3.client(
                'ses',
                region_name=region_name,
                aws_access_key_id=self.config.aws_access_key_id,
                aws_secret_access_key=self.config.aws_secret_access_key
            )
        
        return clients
    
    async def send_email(self, message: EmailMessage) -> Tuple[bool, str]:
        """Send email with automatic region failover"""
        # Check suppression list
        if await self._is_suppressed(message.to_addresses[0]):
            logger.info(f"Email to {message.to_addresses[0]} suppressed")
            emails_sent.labels(region="suppressed", type=message.email_type.value, status="suppressed").inc()
            return False, "Recipient is suppressed"
        
        # Check rate limits
        if not await self._check_rate_limit():
            logger.warning("Rate limit exceeded, queueing email")
            await self._queue_email(message)
            return True, "Email queued"
        
        # Add tracking if enabled
        if message.tracking_enabled:
            message = self._add_tracking(message)
        
        # Try sending through regions
        for region_name, region in self.regions.items():
            try:
                # Check region health
                if not await self._check_region_health(region_name):
                    logger.warning(f"Region {region_name} unhealthy, skipping")
                    continue
                
                # Send email
                start_time = time.time()
                message_id = await self._send_via_region(region_name, message)
                duration = time.time() - start_time
                
                # Update metrics
                email_send_duration.labels(region=region_name).observe(duration)
                emails_sent.labels(
                    region=region_name, 
                    type=message.email_type.value, 
                    status="sent"
                ).inc()
                
                # Log success
                logger.info(f"Email sent via {region_name}: {message_id}")
                
                # Track send for rate limiting
                await self._track_send(message)
                
                return True, message_id
                
            except ClientError as e:
                error_code = e.response['Error']['Code']
                logger.error(f"Failed to send via {region_name}: {error_code}")
                
                # Handle specific errors
                if error_code == 'MessageRejected':
                    # Check if it's a bounce or complaint
                    await self._handle_rejection(message, e)
                    return False, "Message rejected"
                
                # Try next region
                continue
            
            except Exception as e:
                logger.error(f"Unexpected error sending via {region_name}: {str(e)}")
                continue
        
        # All regions failed
        logger.error("Failed to send email through all regions")
        emails_sent.labels(region="all", type=message.email_type.value, status="failed").inc()
        return False, "All regions failed"
    
    async def _send_via_region(self, region_name: str, message: EmailMessage) -> str:
        """Send email through specific region"""
        client = self.ses_clients[region_name]
        
        # Prepare email
        email_params = {
            'Source': formataddr((message.from_name, message.from_address)),
            'Destination': {
                'ToAddresses': message.to_addresses
            },
            'Message': {
                'Subject': {
                    'Data': message.subject,
                    'Charset': 'UTF-8'
                },
                'Body': {
                    'Html': {
                        'Data': message.html_body,
                        'Charset': 'UTF-8'
                    },
                    'Text': {
                        'Data': message.text_body,
                        'Charset': 'UTF-8'
                    }
                }
            }
        }
        
        # Add configuration set
        config_set = self._get_configuration_set(message.email_type)
        if config_set:
            email_params['ConfigurationSetName'] = config_set
        
        # Add reply-to
        if message.reply_to:
            email_params['ReplyToAddresses'] = [message.reply_to]
        
        # Add custom headers
        if message.headers or message.tags:
            email_params['RawMessage'] = self._build_raw_message(message)
            del email_params['Source']
            del email_params['Destination']
            del email_params['Message']
            
            response = await asyncio.get_event_loop().run_in_executor(
                self.executor,
                client.send_raw_email,
                email_params
            )
        else:
            response = await asyncio.get_event_loop().run_in_executor(
                self.executor,
                client.send_email,
                **email_params
            )
        
        return response['MessageId']
    
    def _build_raw_message(self, message: EmailMessage) -> Dict[str, Any]:
        """Build raw email message with custom headers"""
        from email.mime.multipart import MIMEMultipart
        from email.mime.text import MIMEText
        from email.mime.base import MIMEBase
        from email import encoders
        
        msg = MIMEMultipart('alternative')
        
        # Standard headers
        msg['Subject'] = message.subject
        msg['From'] = formataddr((message.from_name, message.from_address))
        msg['To'] = ', '.join(message.to_addresses)
        
        if message.reply_to:
            msg['Reply-To'] = message.reply_to
        
        # Custom headers
        for key, value in message.headers.items():
            msg[key] = value
        
        # Add tags as X-SES-MESSAGE-TAGS
        if message.tags:
            tags = []
            for tag in message.tags:
                tags.append(f"{tag}=1")
            msg['X-SES-MESSAGE-TAGS'] = ', '.join(tags)
        
        # Add tracking headers
        if message.workspace_id:
            msg['X-Workspace-ID'] = message.workspace_id
        if message.campaign_id:
            msg['X-Campaign-ID'] = message.campaign_id
        if message.lead_id:
            msg['X-Lead-ID'] = message.lead_id
        
        # Add unsubscribe header
        unsubscribe_link = self._generate_unsubscribe_link(message)
        msg['List-Unsubscribe'] = f"<{unsubscribe_link}>"
        msg['List-Unsubscribe-Post'] = "List-Unsubscribe=One-Click"
        
        # Add body parts
        msg.attach(MIMEText(message.text_body, 'plain'))
        msg.attach(MIMEText(message.html_body, 'html'))
        
        # Add attachments
        for attachment in message.attachments:
            part = MIMEBase('application', 'octet-stream')
            part.set_payload(attachment['content'])
            encoders.encode_base64(part)
            part.add_header(
                'Content-Disposition',
                f'attachment; filename="{attachment["filename"]}"'
            )
            msg.attach(part)
        
        return {'Data': msg.as_string()}
    
    def _get_configuration_set(self, email_type: EmailType) -> Optional[str]:
        """Get configuration set based on email type"""
        if email_type in [EmailType.MARKETING]:
            return self.config.marketing_config_set
        elif email_type in [EmailType.TRANSACTIONAL, EmailType.NOTIFICATION, EmailType.SYSTEM]:
            return self.config.transactional_config_set
        return None
    
    async def _check_rate_limit(self) -> bool:
        """Check if we can send an email based on rate limits"""
        key = "ses:rate_limit:tokens"
        
        # Initialize token bucket if needed
        if not self.redis_client.exists(key):
            self.redis_client.set(key, self.config.burst_size)
        
        # Try to get a token
        tokens = int(self.redis_client.get(key))
        if tokens > 0:
            self.redis_client.decr(key)
            return True
        
        return False
    
    async def _replenish_tokens(self):
        """Background task to replenish rate limit tokens"""
        while True:
            key = "ses:rate_limit:tokens"
            current = int(self.redis_client.get(key) or 0)
            
            # Add tokens based on rate
            new_tokens = min(
                current + self.config.rate_limit_per_second,
                self.config.burst_size
            )
            
            self.redis_client.set(key, int(new_tokens))
            await asyncio.sleep(1)
    
    async def _is_suppressed(self, email: str) -> bool:
        """Check if email is in suppression list"""
        key = f"ses:suppression:{email.lower()}"
        return self.redis_client.exists(key)
    
    async def add_to_suppression_list(self, email: str, reason: str):
        """Add email to suppression list"""
        key = f"ses:suppression:{email.lower()}"
        value = {
            "reason": reason,
            "timestamp": datetime.utcnow().isoformat(),
            "email": email
        }
        
        self.redis_client.setex(
            key,
            timedelta(days=self.config.suppression_ttl_days),
            json.dumps(value)
        )
        
        # Update metric
        suppression_list_size.inc()
        
        logger.info(f"Added {email} to suppression list: {reason}")
    
    async def remove_from_suppression_list(self, email: str):
        """Remove email from suppression list"""
        key = f"ses:suppression:{email.lower()}"
        if self.redis_client.delete(key):
            suppression_list_size.dec()
            logger.info(f"Removed {email} from suppression list")
    
    def _add_tracking(self, message: EmailMessage) -> EmailMessage:
        """Add tracking pixel and click tracking to email"""
        # Generate tracking ID
        tracking_id = self._generate_tracking_id(message)
        
        # Add tracking pixel
        pixel_params = {
            'id': tracking_id,
            'w': message.workspace_id,
            'c': message.campaign_id,
            'l': message.lead_id
        }
        pixel_url = f"{self.config.tracking_pixel_url}?{urlencode(pixel_params)}"
        
        tracking_pixel = f'<img src="{pixel_url}" width="1" height="1" style="display:none;" alt="">'
        message.html_body = message.html_body.replace('</body>', f'{tracking_pixel}</body>')
        
        # Add click tracking
        message.html_body = self._add_click_tracking(message.html_body, tracking_id)
        
        return message
    
    def _add_click_tracking(self, html: str, tracking_id: str) -> str:
        """Replace links with tracking links"""
        import re
        
        def replace_link(match):
            original_url = match.group(1)
            
            # Skip unsubscribe and tracking links
            if any(skip in original_url for skip in ['unsubscribe', 'tracking', 'mailto:', '#']):
                return match.group(0)
            
            # Create tracking URL
            click_params = {
                'id': tracking_id,
                'url': base64.urlsafe_b64encode(original_url.encode()).decode()
            }
            tracking_url = f"{self.config.click_tracking_url}?{urlencode(click_params)}"
            
            return f'href="{tracking_url}"'
        
        # Replace all href links
        pattern = r'href="([^"]+)"'
        return re.sub(pattern, replace_link, html)
    
    def _generate_tracking_id(self, message: EmailMessage) -> str:
        """Generate unique tracking ID for email"""
        data = f"{message.to_addresses[0]}:{message.campaign_id}:{datetime.utcnow().isoformat()}"
        return hashlib.sha256(data.encode()).hexdigest()[:16]
    
    def _generate_unsubscribe_link(self, message: EmailMessage) -> str:
        """Generate unsubscribe link"""
        params = {
            'email': base64.urlsafe_b64encode(message.to_addresses[0].encode()).decode(),
            'w': message.workspace_id,
            'c': message.campaign_id
        }
        
        # Generate signature
        data = f"{message.to_addresses[0]}:{message.workspace_id}:{message.campaign_id}"
        signature = hmac.new(
            self.config.aws_secret_access_key.encode(),
            data.encode(),
            hashlib.sha256
        ).hexdigest()
        
        params['sig'] = signature
        
        return f"{self.config.unsubscribe_url}?{urlencode(params)}"
    
    async def _check_region_health(self, region_name: str) -> bool:
        """Check if region is healthy for sending"""
        try:
            client = self.ses_clients[region_name]
            
            # Get send quota
            response = await asyncio.get_event_loop().run_in_executor(
                self.executor,
                client.get_send_quota
            )
            
            # Check if we have quota
            if response['SentLast24Hours'] >= response['Max24HourSend']:
                logger.warning(f"Region {region_name} quota exhausted")
                return False
            
            # Get send statistics
            stats = await self._get_send_statistics(region_name)
            
            # Check reputation metrics
            if stats['bounce_rate'] > self.config.bounce_rate_alert_threshold:
                logger.warning(f"Region {region_name} bounce rate too high: {stats['bounce_rate']}")
                return False
            
            if stats['complaint_rate'] > self.config.complaint_rate_alert_threshold:
                logger.warning(f"Region {region_name} complaint rate too high: {stats['complaint_rate']}")
                return False
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to check region {region_name} health: {str(e)}")
            return False
    
    async def _get_send_statistics(self, region_name: str) -> Dict[str, float]:
        """Get send statistics for region"""
        client = self.ses_clients[region_name]
        
        try:
            response = await asyncio.get_event_loop().run_in_executor(
                self.executor,
                client.get_send_statistics
            )
            
            # Calculate rates from last 24 hours
            total_send = 0
            total_bounce = 0
            total_complaint = 0
            
            for point in response['SendDataPoints']:
                total_send += point['DeliveryAttempts']
                total_bounce += point['Bounces']
                total_complaint += point['Complaints']
            
            bounce_rate = total_bounce / total_send if total_send > 0 else 0
            complaint_rate = total_complaint / total_send if total_send > 0 else 0
            
            # Update metrics
            bounce_rate_gauge = bounce_rate * 100
            complaint_rate_gauge = complaint_rate * 100
            
            bounce_rate.labels(region=region_name).set(bounce_rate_gauge)
            complaint_rate.labels(region=region_name).set(complaint_rate_gauge)
            
            return {
                'bounce_rate': bounce_rate,
                'complaint_rate': complaint_rate,
                'total_sent': total_send
            }
            
        except Exception as e:
            logger.error(f"Failed to get statistics for {region_name}: {str(e)}")
            return {'bounce_rate': 0, 'complaint_rate': 0, 'total_sent': 0}
    
    async def _handle_rejection(self, message: EmailMessage, error: ClientError):
        """Handle message rejection"""
        error_message = error.response['Error']['Message']
        
        # Check for bounce
        if 'bounce' in error_message.lower():
            await self.handle_bounce({
                'email': message.to_addresses[0],
                'bounceType': 'Permanent',
                'timestamp': datetime.utcnow().isoformat()
            })
        
        # Check for complaint
        elif 'complaint' in error_message.lower():
            await self.handle_complaint({
                'email': message.to_addresses[0],
                'timestamp': datetime.utcnow().isoformat()
            })
    
    async def handle_bounce(self, bounce_data: Dict[str, Any]):
        """Handle email bounce"""
        email = bounce_data['email']
        bounce_type = bounce_data.get('bounceType', 'Permanent')
        
        # Track bounce
        key = f"ses:bounces:{email.lower()}"
        count = self.redis_client.incr(key)
        self.redis_client.expire(key, timedelta(days=30))
        
        # Add to suppression list if threshold reached
        if bounce_type == 'Permanent' or count >= self.config.hard_bounce_threshold:
            await self.add_to_suppression_list(email, f"Bounce: {bounce_type}")
        
        logger.info(f"Handled bounce for {email}: {bounce_type} (count: {count})")
    
    async def handle_complaint(self, complaint_data: Dict[str, Any]):
        """Handle spam complaint"""
        email = complaint_data['email']
        
        # Track complaint
        key = f"ses:complaints:{email.lower()}"
        count = self.redis_client.incr(key)
        self.redis_client.expire(key, timedelta(days=90))
        
        # Always add complaints to suppression list
        await self.add_to_suppression_list(email, "Spam complaint")
        
        logger.info(f"Handled complaint for {email} (count: {count})")
    
    async def _queue_email(self, message: EmailMessage):
        """Queue email for later sending"""
        queue_key = "ses:email_queue"
        
        # Serialize message
        message_data = {
            'to_addresses': message.to_addresses,
            'from_address': message.from_address,
            'from_name': message.from_name,
            'subject': message.subject,
            'html_body': message.html_body,
            'text_body': message.text_body,
            'email_type': message.email_type.value,
            'workspace_id': message.workspace_id,
            'campaign_id': message.campaign_id,
            'lead_id': message.lead_id,
            'reply_to': message.reply_to,
            'headers': message.headers,
            'tags': message.tags,
            'tracking_enabled': message.tracking_enabled,
            'queued_at': datetime.utcnow().isoformat()
        }
        
        self.redis_client.lpush(queue_key, json.dumps(message_data))
        email_queue_size.inc()
        
    async def process_email_queue(self):
        """Process queued emails"""
        queue_key = "ses:email_queue"
        
        while True:
            # Get email from queue
            email_data = self.redis_client.rpop(queue_key)
            if not email_data:
                await asyncio.sleep(1)
                continue
            
            email_queue_size.dec()
            
            try:
                # Deserialize message
                data = json.loads(email_data)
                message = EmailMessage(
                    to_addresses=data['to_addresses'],
                    from_address=data['from_address'],
                    from_name=data['from_name'],
                    subject=data['subject'],
                    html_body=data['html_body'],
                    text_body=data['text_body'],
                    email_type=EmailType(data['email_type']),
                    workspace_id=data.get('workspace_id'),
                    campaign_id=data.get('campaign_id'),
                    lead_id=data.get('lead_id'),
                    reply_to=data.get('reply_to'),
                    headers=data.get('headers', {}),
                    tags=data.get('tags', []),
                    tracking_enabled=data.get('tracking_enabled', True)
                )
                
                # Try to send
                await self.send_email(message)
                
            except Exception as e:
                logger.error(f"Failed to process queued email: {str(e)}")
                # Re-queue on error
                self.redis_client.lpush(queue_key, email_data)
                email_queue_size.inc()
    
    async def _track_send(self, message: EmailMessage):
        """Track email send for analytics"""
        # Daily send count
        date_key = f"ses:daily_sends:{datetime.utcnow().strftime('%Y-%m-%d')}"
        self.redis_client.incr(date_key)
        self.redis_client.expire(date_key, timedelta(days=7))
        
        # Workspace send count
        if message.workspace_id:
            workspace_key = f"ses:workspace_sends:{message.workspace_id}:{datetime.utcnow().strftime('%Y-%m-%d')}"
            self.redis_client.incr(workspace_key)
            self.redis_client.expire(workspace_key, timedelta(days=30))
        
        # Campaign send count
        if message.campaign_id:
            campaign_key = f"ses:campaign_sends:{message.campaign_id}"
            self.redis_client.incr(campaign_key)
    
    async def get_suppression_list(self, page: int = 1, per_page: int = 100) -> Dict[str, Any]:
        """Get paginated suppression list"""
        pattern = "ses:suppression:*"
        cursor = (page - 1) * per_page
        
        # Get all suppression keys
        keys = []
        for key in self.redis_client.scan_iter(match=pattern):
            keys.append(key)
        
        # Paginate
        total = len(keys)
        keys = keys[cursor:cursor + per_page]
        
        # Get suppression details
        suppressions = []
        for key in keys:
            data = self.redis_client.get(key)
            if data:
                suppressions.append(json.loads(data))
        
        return {
            'suppressions': suppressions,
            'total': total,
            'page': page,
            'per_page': per_page,
            'total_pages': (total + per_page - 1) // per_page
        }
    
    async def get_email_statistics(self, workspace_id: Optional[str] = None) -> Dict[str, Any]:
        """Get email statistics"""
        stats = {
            'regions': {},
            'totals': {
                'sent_today': 0,
                'sent_this_week': 0,
                'sent_this_month': 0,
                'bounce_rate': 0,
                'complaint_rate': 0,
                'suppression_list_size': 0
            }
        }
        
        # Get stats for each region
        for region_name in self.regions:
            region_stats = await self._get_send_statistics(region_name)
            stats['regions'][region_name] = region_stats
        
        # Calculate totals
        today_key = f"ses:daily_sends:{datetime.utcnow().strftime('%Y-%m-%d')}"
        stats['totals']['sent_today'] = int(self.redis_client.get(today_key) or 0)
        
        # Get suppression list size
        suppression_count = 0
        for _ in self.redis_client.scan_iter(match="ses:suppression:*"):
            suppression_count += 1
        stats['totals']['suppression_list_size'] = suppression_count
        
        # Workspace-specific stats
        if workspace_id:
            workspace_key = f"ses:workspace_sends:{workspace_id}:{datetime.utcnow().strftime('%Y-%m-%d')}"
            stats['workspace_sent_today'] = int(self.redis_client.get(workspace_key) or 0)
        
        return stats