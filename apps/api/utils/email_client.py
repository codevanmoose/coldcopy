"""
Advanced email client with queue management for ColdCopy.
"""
import asyncio
import json
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID, uuid4

import aioboto3
import aioredis
from botocore.exceptions import BotoCoreError, ClientError
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr
from jinja2 import Template

from core.config import get_settings

logger = logging.getLogger(__name__)


class EmailTemplate:
    """Email template handling with Jinja2."""
    
    def __init__(self, subject: str, html_content: str, text_content: Optional[str] = None):
        self.subject_template = Template(subject)
        self.html_template = Template(html_content)
        self.text_template = Template(text_content) if text_content else None
    
    def render(self, variables: Dict[str, Any]) -> Dict[str, str]:
        """Render template with variables."""
        return {
            "subject": self.subject_template.render(**variables),
            "html": self.html_template.render(**variables),
            "text": self.text_template.render(**variables) if self.text_template else None
        }


class EmailQueue:
    """Redis-based email queue with priority and scheduling."""
    
    def __init__(self, redis_client: aioredis.Redis):
        self.redis = redis_client
        self.queue_key = "email_queue"
        self.processing_key = "email_processing"
        self.failed_key = "email_failed"
        self.scheduled_key = "email_scheduled"
    
    async def enqueue(
        self,
        email_data: Dict[str, Any],
        priority: int = 5,
        scheduled_at: Optional[datetime] = None,
        max_retries: int = 3
    ) -> str:
        """Add email to queue with priority and scheduling."""
        email_id = str(uuid4())
        
        email_job = {
            "id": email_id,
            "data": email_data,
            "priority": priority,
            "max_retries": max_retries,
            "retry_count": 0,
            "created_at": datetime.utcnow().isoformat(),
            "scheduled_at": scheduled_at.isoformat() if scheduled_at else None,
            "status": "queued"
        }
        
        if scheduled_at and scheduled_at > datetime.utcnow():
            # Schedule for later
            await self.redis.zadd(
                self.scheduled_key,
                {json.dumps(email_job): scheduled_at.timestamp()}
            )
        else:
            # Add to immediate queue with priority
            await self.redis.zadd(
                self.queue_key,
                {json.dumps(email_job): priority}
            )
        
        return email_id
    
    async def dequeue(self) -> Optional[Dict[str, Any]]:
        """Get next email from queue (highest priority first)."""
        # First, check for scheduled emails that are ready
        await self._process_scheduled_emails()
        
        # Get highest priority email
        result = await self.redis.zpopmax(self.queue_key)
        if not result:
            return None
        
        email_job_json, priority = result[0]
        email_job = json.loads(email_job_json)
        
        # Move to processing
        email_job["status"] = "processing"
        email_job["processing_started"] = datetime.utcnow().isoformat()
        
        await self.redis.setex(
            f"{self.processing_key}:{email_job['id']}",
            3600,  # 1 hour TTL
            json.dumps(email_job)
        )
        
        return email_job
    
    async def _process_scheduled_emails(self):
        """Move ready scheduled emails to main queue."""
        now = datetime.utcnow().timestamp()
        ready_emails = await self.redis.zrangebyscore(
            self.scheduled_key, 0, now, withscores=False
        )
        
        for email_job_json in ready_emails:
            email_job = json.loads(email_job_json)
            # Move to main queue
            await self.redis.zadd(
                self.queue_key,
                {email_job_json: email_job["priority"]}
            )
            # Remove from scheduled
            await self.redis.zrem(self.scheduled_key, email_job_json)
    
    async def mark_completed(self, email_id: str):
        """Mark email as successfully sent."""
        await self.redis.delete(f"{self.processing_key}:{email_id}")
    
    async def mark_failed(self, email_id: str, error: str):
        """Mark email as failed and handle retries."""
        processing_key = f"{self.processing_key}:{email_id}"
        email_job_json = await self.redis.get(processing_key)
        
        if not email_job_json:
            return
        
        email_job = json.loads(email_job_json)
        email_job["retry_count"] += 1
        email_job["last_error"] = error
        email_job["last_attempt"] = datetime.utcnow().isoformat()
        
        if email_job["retry_count"] < email_job["max_retries"]:
            # Retry with exponential backoff
            delay = 2 ** email_job["retry_count"] * 60  # Minutes
            retry_at = datetime.utcnow() + timedelta(seconds=delay)
            
            email_job["status"] = "queued"
            email_job["scheduled_at"] = retry_at.isoformat()
            
            await self.redis.zadd(
                self.scheduled_key,
                {json.dumps(email_job): retry_at.timestamp()}
            )
        else:
            # Max retries reached, move to failed
            email_job["status"] = "failed"
            await self.redis.setex(
                f"{self.failed_key}:{email_id}",
                86400 * 7,  # Keep for 7 days
                json.dumps(email_job)
            )
        
        await self.redis.delete(processing_key)
    
    async def get_queue_stats(self) -> Dict[str, int]:
        """Get queue statistics."""
        return {
            "queued": await self.redis.zcard(self.queue_key),
            "scheduled": await self.redis.zcard(self.scheduled_key),
            "processing": len(await self.redis.keys(f"{self.processing_key}:*")),
            "failed": len(await self.redis.keys(f"{self.failed_key}:*"))
        }


class EmailTracker:
    """Email tracking with open/click tracking."""
    
    def __init__(self, base_url: str, redis_client: aioredis.Redis):
        self.base_url = base_url.rstrip('/')
        self.redis = redis_client
    
    def add_tracking_pixel(self, email_id: str, html_content: str) -> str:
        """Add tracking pixel to HTML content."""
        tracking_url = f"{self.base_url}/api/track/open/{email_id}"
        pixel_html = f'<img src="{tracking_url}" width="1" height="1" style="display:none;" />'
        
        # Insert before closing body tag, or append if no body tag
        if '</body>' in html_content:
            html_content = html_content.replace('</body>', f'{pixel_html}</body>')
        else:
            html_content += pixel_html
        
        return html_content
    
    def add_click_tracking(self, email_id: str, html_content: str) -> str:
        """Add click tracking to all links in HTML content."""
        import re
        
        def replace_link(match):
            original_url = match.group(1)
            tracked_url = f"{self.base_url}/api/track/click/{email_id}?url={original_url}"
            return f'href="{tracked_url}"'
        
        # Replace href attributes
        tracked_content = re.sub(r'href="([^"]+)"', replace_link, html_content)
        return tracked_content
    
    async def record_open(self, email_id: str, user_agent: str, ip_address: str):
        """Record email open event."""
        event = {
            "event": "open",
            "email_id": email_id,
            "timestamp": datetime.utcnow().isoformat(),
            "user_agent": user_agent,
            "ip_address": ip_address
        }
        
        await self.redis.lpush(f"email_events:{email_id}", json.dumps(event))
        await self.redis.expire(f"email_events:{email_id}", 86400 * 30)  # 30 days
    
    async def record_click(self, email_id: str, url: str, user_agent: str, ip_address: str):
        """Record email click event."""
        event = {
            "event": "click",
            "email_id": email_id,
            "url": url,
            "timestamp": datetime.utcnow().isoformat(),
            "user_agent": user_agent,
            "ip_address": ip_address
        }
        
        await self.redis.lpush(f"email_events:{email_id}", json.dumps(event))
        await self.redis.expire(f"email_events:{email_id}", 86400 * 30)  # 30 days


class EmailDeliverabilityMonitor:
    """Monitor email deliverability and reputation."""
    
    def __init__(self, ses_client, redis_client: aioredis.Redis):
        self.ses = ses_client
        self.redis = redis_client
    
    async def check_reputation(self, domain: str) -> Dict[str, Any]:
        """Check sending reputation for domain."""
        try:
            # Get SES reputation metrics
            response = await self.ses.get_account_sending_enabled()
            sending_enabled = response.get('Enabled', False)
            
            # Get bounce and complaint rates
            stats = await self.ses.get_send_statistics()
            
            recent_stats = stats.get('SendDataPoints', [])[-10:]  # Last 10 data points
            
            if recent_stats:
                total_sends = sum(point.get('DeliveryAttempts', 0) for point in recent_stats)
                total_bounces = sum(point.get('Bounces', 0) for point in recent_stats)
                total_complaints = sum(point.get('Complaints', 0) for point in recent_stats)
                
                bounce_rate = (total_bounces / total_sends * 100) if total_sends > 0 else 0
                complaint_rate = (total_complaints / total_sends * 100) if total_sends > 0 else 0
            else:
                bounce_rate = complaint_rate = 0
            
            # Determine reputation status
            reputation_status = "good"
            if bounce_rate > 5 or complaint_rate > 0.1:
                reputation_status = "poor"
            elif bounce_rate > 2 or complaint_rate > 0.05:
                reputation_status = "warning"
            
            reputation_data = {
                "domain": domain,
                "sending_enabled": sending_enabled,
                "bounce_rate": round(bounce_rate, 3),
                "complaint_rate": round(complaint_rate, 3),
                "status": reputation_status,
                "last_checked": datetime.utcnow().isoformat()
            }
            
            # Cache reputation data
            await self.redis.setex(
                f"reputation:{domain}",
                1800,  # 30 minutes
                json.dumps(reputation_data)
            )
            
            return reputation_data
            
        except Exception as e:
            logger.error(f"Error checking reputation for {domain}: {str(e)}")
            return {"domain": domain, "status": "unknown", "error": str(e)}
    
    async def get_suppression_list(self) -> List[str]:
        """Get suppressed email addresses."""
        try:
            response = await self.ses.get_suppressed_destination()
            return [item['EmailAddress'] for item in response.get('SuppressedDestinations', [])]
        except Exception as e:
            logger.error(f"Error getting suppression list: {str(e)}")
            return []


class AdvancedEmailClient:
    """Advanced email client with queue management, tracking, and deliverability monitoring."""
    
    def __init__(self):
        self.settings = get_settings()
        self._ses_session = None
        self._redis_client = None
        self.queue = None
        self.tracker = None
        self.deliverability_monitor = None
    
    async def initialize(self):
        """Initialize async clients."""
        # Initialize SES client
        self._ses_session = aioboto3.Session()
        
        # Initialize Redis client
        self._redis_client = aioredis.from_url(
            self.settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True
        )
        
        # Initialize components
        self.queue = EmailQueue(self._redis_client)
        self.tracker = EmailTracker(self.settings.API_BASE_URL, self._redis_client)
        
        async with self._ses_session.client(
            'ses',
            aws_access_key_id=self.settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=self.settings.AWS_SECRET_ACCESS_KEY,
            region_name=self.settings.AWS_REGION
        ) as ses_client:
            self.deliverability_monitor = EmailDeliverabilityMonitor(ses_client, self._redis_client)
    
    async def send_email(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None,
        from_email: Optional[str] = None,
        from_name: Optional[str] = None,
        reply_to: Optional[str] = None,
        campaign_id: Optional[UUID] = None,
        lead_id: Optional[UUID] = None,
        workspace_id: Optional[UUID] = None,
        add_tracking: bool = True,
        priority: int = 5,
        scheduled_at: Optional[datetime] = None
    ) -> str:
        """Send email with comprehensive tracking and queue management."""
        
        email_id = str(uuid4())
        
        # Add tracking if enabled
        if add_tracking:
            html_content = self.tracker.add_tracking_pixel(email_id, html_content)
            html_content = self.tracker.add_click_tracking(email_id, html_content)
        
        # Prepare email data
        email_data = {
            "id": email_id,
            "to_email": to_email,
            "subject": subject,
            "html_content": html_content,
            "text_content": text_content,
            "from_email": from_email or self.settings.SES_FROM_EMAIL,
            "from_name": from_name,
            "reply_to": reply_to,
            "campaign_id": str(campaign_id) if campaign_id else None,
            "lead_id": str(lead_id) if lead_id else None,
            "workspace_id": str(workspace_id) if workspace_id else None,
            "tracking_enabled": add_tracking
        }
        
        # Queue email
        await self.queue.enqueue(
            email_data=email_data,
            priority=priority,
            scheduled_at=scheduled_at
        )
        
        return email_id
    
    async def send_template_email(
        self,
        to_email: str,
        template: EmailTemplate,
        variables: Dict[str, Any],
        **kwargs
    ) -> str:
        """Send email using template with variables."""
        rendered = template.render(variables)
        
        return await self.send_email(
            to_email=to_email,
            subject=rendered["subject"],
            html_content=rendered["html"],
            text_content=rendered["text"],
            **kwargs
        )
    
    async def send_bulk_email(
        self,
        recipients: List[str],
        subject: str,
        html_content: str,
        text_content: Optional[str] = None,
        priority: int = 5,
        batch_size: int = 100,
        **kwargs
    ) -> List[str]:
        """Send bulk emails with queue management."""
        email_ids = []
        
        for i in range(0, len(recipients), batch_size):
            batch = recipients[i:i + batch_size]
            
            for email in batch:
                email_id = await self.send_email(
                    to_email=email,
                    subject=subject,
                    html_content=html_content,
                    text_content=text_content,
                    priority=priority,
                    **kwargs
                )
                email_ids.append(email_id)
        
        return email_ids
    
    async def process_queue(self, max_emails: int = 100) -> Dict[str, int]:
        """Process emails from queue."""
        if not self.queue:
            await self.initialize()
        
        results = {"sent": 0, "failed": 0, "skipped": 0}
        
        async with self._ses_session.client(
            'ses',
            aws_access_key_id=self.settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=self.settings.AWS_SECRET_ACCESS_KEY,
            region_name=self.settings.AWS_REGION
        ) as ses_client:
            
            for _ in range(max_emails):
                email_job = await self.queue.dequeue()
                if not email_job:
                    break
                
                try:
                    # Check deliverability before sending
                    domain = email_job["data"]["to_email"].split("@")[1]
                    reputation = await self.deliverability_monitor.check_reputation(domain)
                    
                    if reputation.get("status") == "poor":
                        await self.queue.mark_failed(
                            email_job["id"],
                            f"Poor reputation for domain {domain}"
                        )
                        results["skipped"] += 1
                        continue
                    
                    # Send email via SES
                    success = await self._send_via_ses(ses_client, email_job["data"])
                    
                    if success:
                        await self.queue.mark_completed(email_job["id"])
                        results["sent"] += 1
                    else:
                        await self.queue.mark_failed(email_job["id"], "SES send failed")
                        results["failed"] += 1
                        
                except Exception as e:
                    logger.error(f"Error processing email {email_job['id']}: {str(e)}")
                    await self.queue.mark_failed(email_job["id"], str(e))
                    results["failed"] += 1
                
                # Rate limiting
                await asyncio.sleep(0.1)  # 10 emails per second max
        
        return results
    
    async def _send_via_ses(self, ses_client, email_data: Dict[str, Any]) -> bool:
        """Send email via SES."""
        try:
            # Prepare from address
            if email_data.get("from_name"):
                from_address = formataddr((email_data["from_name"], email_data["from_email"]))
            else:
                from_address = email_data["from_email"]
            
            # Prepare email body
            body = {"Html": {"Data": email_data["html_content"], "Charset": "UTF-8"}}
            if email_data.get("text_content"):
                body["Text"] = {"Data": email_data["text_content"], "Charset": "UTF-8"}
            
            # Prepare SES parameters
            params = {
                "Source": from_address,
                "Destination": {"ToAddresses": [email_data["to_email"]]},
                "Message": {
                    "Subject": {"Data": email_data["subject"], "Charset": "UTF-8"},
                    "Body": body
                }
            }
            
            # Add optional parameters
            if email_data.get("reply_to"):
                params["ReplyToAddresses"] = [email_data["reply_to"]]
            
            if self.settings.SES_CONFIGURATION_SET:
                params["ConfigurationSetName"] = self.settings.SES_CONFIGURATION_SET
            
            # Send email
            response = await ses_client.send_email(**params)
            
            logger.info(f"Email sent: {email_data['id']} -> {email_data['to_email']} (MessageId: {response['MessageId']})")
            return True
            
        except (ClientError, BotoCoreError) as e:
            logger.error(f"SES error sending email {email_data['id']}: {str(e)}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error sending email {email_data['id']}: {str(e)}")
            return False
    
    async def get_queue_stats(self) -> Dict[str, Any]:
        """Get comprehensive queue statistics."""
        if not self.queue:
            await self.initialize()
        
        return await self.queue.get_queue_stats()
    
    async def get_email_events(self, email_id: str) -> List[Dict[str, Any]]:
        """Get tracking events for an email."""
        if not self._redis_client:
            await self.initialize()
        
        events_json = await self._redis_client.lrange(f"email_events:{email_id}", 0, -1)
        return [json.loads(event) for event in events_json]
    
    async def cleanup(self):
        """Cleanup resources."""
        if self._redis_client:
            await self._redis_client.close()


# Global email client instance
email_client = AdvancedEmailClient()