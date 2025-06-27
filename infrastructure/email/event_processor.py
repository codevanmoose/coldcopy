#!/usr/bin/env python3
"""
SES Event Processor
Handles bounces, complaints, deliveries, and other SES events
"""

import os
import json
import boto3
import logging
import asyncio
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
from dataclasses import dataclass
from enum import Enum
import redis
from flask import Flask, request, jsonify
import hmac
import hashlib
import base64
from urllib.parse import urlparse
from ses_manager import SESManager, SESConfig
import psycopg2
from psycopg2.extras import RealDictCursor

logger = logging.getLogger(__name__)

app = Flask(__name__)


class EventType(Enum):
    """SES event types"""
    BOUNCE = "Bounce"
    COMPLAINT = "Complaint"
    DELIVERY = "Delivery"
    SEND = "Send"
    REJECT = "Reject"
    OPEN = "Open"
    CLICK = "Click"
    RENDERING_FAILURE = "Rendering Failure"
    DELIVERY_DELAY = "DeliveryDelay"
    SUBSCRIPTION = "Subscription"


class BounceType(Enum):
    """Types of bounces"""
    PERMANENT = "Permanent"
    TRANSIENT = "Transient"
    UNDETERMINED = "Undetermined"


class BounceSubType(Enum):
    """Bounce subtypes"""
    GENERAL = "General"
    NO_EMAIL = "NoEmail"
    SUPPRESSED = "Suppressed"
    MAILBOX_FULL = "MailboxFull"
    MESSAGE_TOO_LARGE = "MessageTooLarge"
    CONTENT_REJECTED = "ContentRejected"
    ATTACHMENT_REJECTED = "AttachmentRejected"


@dataclass
class EmailEvent:
    """Email event data"""
    event_type: EventType
    email: str
    timestamp: datetime
    message_id: str
    workspace_id: Optional[str] = None
    campaign_id: Optional[str] = None
    lead_id: Optional[str] = None
    bounce_type: Optional[BounceType] = None
    bounce_subtype: Optional[BounceSubType] = None
    complaint_type: Optional[str] = None
    feedback_id: Optional[str] = None
    reason: Optional[str] = None
    user_agent: Optional[str] = None
    ip_address: Optional[str] = None
    link: Optional[str] = None
    raw_event: Dict[str, Any] = None


class EventProcessor:
    """Processes SES events and updates database"""
    
    def __init__(self, ses_config: SESConfig, db_config: Dict[str, str], 
                 redis_url: str = "redis://localhost:6379"):
        self.ses_config = ses_config
        self.db_config = db_config
        self.redis_client = redis.from_url(redis_url, decode_responses=True)
        self.ses_manager = SESManager(ses_config)
        
    def get_db_connection(self):
        """Get database connection"""
        return psycopg2.connect(
            host=self.db_config['host'],
            port=self.db_config['port'],
            database=self.db_config['database'],
            user=self.db_config['user'],
            password=self.db_config['password']
        )
    
    async def process_sns_notification(self, notification: Dict[str, Any]) -> bool:
        """Process SNS notification containing SES event"""
        try:
            # Verify SNS signature
            if not self._verify_sns_signature(notification):
                logger.error("Invalid SNS signature")
                return False
            
            # Handle subscription confirmation
            if notification.get('Type') == 'SubscriptionConfirmation':
                await self._confirm_subscription(notification)
                return True
            
            # Parse message
            message = json.loads(notification.get('Message', '{}'))
            
            # Determine event type
            event_type = self._determine_event_type(message)
            if not event_type:
                logger.warning(f"Unknown event type in message: {message}")
                return False
            
            # Process based on event type
            if event_type == EventType.BOUNCE:
                await self._process_bounce(message)
            elif event_type == EventType.COMPLAINT:
                await self._process_complaint(message)
            elif event_type == EventType.DELIVERY:
                await self._process_delivery(message)
            elif event_type == EventType.OPEN:
                await self._process_open(message)
            elif event_type == EventType.CLICK:
                await self._process_click(message)
            elif event_type == EventType.REJECT:
                await self._process_reject(message)
            else:
                logger.info(f"Processed {event_type.value} event")
            
            return True
            
        except Exception as e:
            logger.error(f"Error processing SNS notification: {str(e)}")
            return False
    
    def _verify_sns_signature(self, notification: Dict[str, Any]) -> bool:
        """Verify SNS message signature"""
        # In production, implement full SNS signature verification
        # https://docs.aws.amazon.com/sns/latest/dg/SendMessageToHttp.verify.signature.html
        return True
    
    async def _confirm_subscription(self, notification: Dict[str, Any]):
        """Confirm SNS subscription"""
        subscribe_url = notification.get('SubscribeURL')
        if subscribe_url:
            import requests
            response = requests.get(subscribe_url)
            logger.info(f"Subscription confirmed: {response.status_code}")
    
    def _determine_event_type(self, message: Dict[str, Any]) -> Optional[EventType]:
        """Determine event type from message"""
        event_type_str = message.get('eventType') or message.get('notificationType')
        
        try:
            return EventType(event_type_str)
        except ValueError:
            return None
    
    async def _process_bounce(self, message: Dict[str, Any]):
        """Process bounce event"""
        bounce = message.get('bounce', {})
        mail = message.get('mail', {})
        
        bounce_type = BounceType(bounce.get('bounceType', 'Undetermined'))
        bounce_subtype = BounceSubType(bounce.get('bounceSubType', 'General'))
        
        # Process each bounced recipient
        for recipient in bounce.get('bouncedRecipients', []):
            email = recipient.get('emailAddress')
            
            event = EmailEvent(
                event_type=EventType.BOUNCE,
                email=email,
                timestamp=datetime.fromisoformat(bounce.get('timestamp', datetime.utcnow().isoformat())),
                message_id=mail.get('messageId'),
                workspace_id=mail.get('tags', {}).get('workspace_id'),
                campaign_id=mail.get('tags', {}).get('campaign_id'),
                lead_id=mail.get('tags', {}).get('lead_id'),
                bounce_type=bounce_type,
                bounce_subtype=bounce_subtype,
                reason=recipient.get('diagnosticCode'),
                feedback_id=bounce.get('feedbackId'),
                raw_event=message
            )
            
            # Store event
            await self._store_event(event)
            
            # Handle based on bounce type
            if bounce_type == BounceType.PERMANENT:
                # Add to suppression list
                await self.ses_manager.add_to_suppression_list(
                    email, 
                    f"Hard bounce: {bounce_subtype.value}"
                )
                
                # Update lead status
                await self._update_lead_status(email, 'bounced', bounce_subtype.value)
            
            elif bounce_type == BounceType.TRANSIENT:
                # Track transient bounce
                await self._track_transient_bounce(email)
            
            # Update campaign statistics
            if event.campaign_id:
                await self._update_campaign_stats(event.campaign_id, 'bounces')
    
    async def _process_complaint(self, message: Dict[str, Any]):
        """Process complaint event"""
        complaint = message.get('complaint', {})
        mail = message.get('mail', {})
        
        # Process each complained recipient
        for recipient in complaint.get('complainedRecipients', []):
            email = recipient.get('emailAddress')
            
            event = EmailEvent(
                event_type=EventType.COMPLAINT,
                email=email,
                timestamp=datetime.fromisoformat(complaint.get('timestamp', datetime.utcnow().isoformat())),
                message_id=mail.get('messageId'),
                workspace_id=mail.get('tags', {}).get('workspace_id'),
                campaign_id=mail.get('tags', {}).get('campaign_id'),
                lead_id=mail.get('tags', {}).get('lead_id'),
                complaint_type=complaint.get('complaintFeedbackType'),
                feedback_id=complaint.get('feedbackId'),
                raw_event=message
            )
            
            # Store event
            await self._store_event(event)
            
            # Always add complaints to suppression list
            await self.ses_manager.add_to_suppression_list(
                email,
                f"Spam complaint: {complaint.get('complaintFeedbackType', 'abuse')}"
            )
            
            # Update lead status
            await self._update_lead_status(email, 'complained', 'spam complaint')
            
            # Update campaign statistics
            if event.campaign_id:
                await self._update_campaign_stats(event.campaign_id, 'complaints')
    
    async def _process_delivery(self, message: Dict[str, Any]):
        """Process delivery event"""
        delivery = message.get('delivery', {})
        mail = message.get('mail', {})
        
        for recipient in delivery.get('recipients', []):
            event = EmailEvent(
                event_type=EventType.DELIVERY,
                email=recipient,
                timestamp=datetime.fromisoformat(delivery.get('timestamp', datetime.utcnow().isoformat())),
                message_id=mail.get('messageId'),
                workspace_id=mail.get('tags', {}).get('workspace_id'),
                campaign_id=mail.get('tags', {}).get('campaign_id'),
                lead_id=mail.get('tags', {}).get('lead_id'),
                raw_event=message
            )
            
            # Store event
            await self._store_event(event)
            
            # Update campaign statistics
            if event.campaign_id:
                await self._update_campaign_stats(event.campaign_id, 'delivered')
    
    async def _process_open(self, message: Dict[str, Any]):
        """Process email open event"""
        open_event = message.get('open', {})
        mail = message.get('mail', {})
        
        event = EmailEvent(
            event_type=EventType.OPEN,
            email=mail.get('destination', [None])[0],
            timestamp=datetime.fromisoformat(open_event.get('timestamp', datetime.utcnow().isoformat())),
            message_id=mail.get('messageId'),
            workspace_id=mail.get('tags', {}).get('workspace_id'),
            campaign_id=mail.get('tags', {}).get('campaign_id'),
            lead_id=mail.get('tags', {}).get('lead_id'),
            user_agent=open_event.get('userAgent'),
            ip_address=open_event.get('ipAddress'),
            raw_event=message
        )
        
        # Store event
        await self._store_event(event)
        
        # Update campaign statistics
        if event.campaign_id:
            await self._update_campaign_stats(event.campaign_id, 'opens')
        
        # Update lead engagement
        if event.lead_id:
            await self._update_lead_engagement(event.lead_id, 'opened')
    
    async def _process_click(self, message: Dict[str, Any]):
        """Process link click event"""
        click = message.get('click', {})
        mail = message.get('mail', {})
        
        event = EmailEvent(
            event_type=EventType.CLICK,
            email=mail.get('destination', [None])[0],
            timestamp=datetime.fromisoformat(click.get('timestamp', datetime.utcnow().isoformat())),
            message_id=mail.get('messageId'),
            workspace_id=mail.get('tags', {}).get('workspace_id'),
            campaign_id=mail.get('tags', {}).get('campaign_id'),
            lead_id=mail.get('tags', {}).get('lead_id'),
            user_agent=click.get('userAgent'),
            ip_address=click.get('ipAddress'),
            link=click.get('link'),
            raw_event=message
        )
        
        # Store event
        await self._store_event(event)
        
        # Update campaign statistics
        if event.campaign_id:
            await self._update_campaign_stats(event.campaign_id, 'clicks')
        
        # Update lead engagement
        if event.lead_id:
            await self._update_lead_engagement(event.lead_id, 'clicked')
    
    async def _process_reject(self, message: Dict[str, Any]):
        """Process email rejection"""
        reject = message.get('reject', {})
        mail = message.get('mail', {})
        
        for recipient in mail.get('destination', []):
            event = EmailEvent(
                event_type=EventType.REJECT,
                email=recipient,
                timestamp=datetime.utcnow(),
                message_id=mail.get('messageId'),
                workspace_id=mail.get('tags', {}).get('workspace_id'),
                campaign_id=mail.get('tags', {}).get('campaign_id'),
                lead_id=mail.get('tags', {}).get('lead_id'),
                reason=reject.get('reason'),
                raw_event=message
            )
            
            # Store event
            await self._store_event(event)
            
            # Log rejection reason
            logger.warning(f"Email rejected for {recipient}: {reject.get('reason')}")
    
    async def _store_event(self, event: EmailEvent):
        """Store event in database"""
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        try:
            # Insert into email_events table
            cursor.execute("""
                INSERT INTO email_events (
                    event_type, email, timestamp, message_id,
                    workspace_id, campaign_id, lead_id,
                    bounce_type, bounce_subtype, complaint_type,
                    feedback_id, reason, user_agent, ip_address,
                    link, raw_event
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s, %s
                )
            """, (
                event.event_type.value,
                event.email,
                event.timestamp,
                event.message_id,
                event.workspace_id,
                event.campaign_id,
                event.lead_id,
                event.bounce_type.value if event.bounce_type else None,
                event.bounce_subtype.value if event.bounce_subtype else None,
                event.complaint_type,
                event.feedback_id,
                event.reason,
                event.user_agent,
                event.ip_address,
                event.link,
                json.dumps(event.raw_event) if event.raw_event else None
            ))
            
            conn.commit()
            
            # Cache recent events
            self._cache_event(event)
            
        except Exception as e:
            logger.error(f"Failed to store event: {str(e)}")
            conn.rollback()
        finally:
            cursor.close()
            conn.close()
    
    def _cache_event(self, event: EmailEvent):
        """Cache event in Redis for real-time access"""
        key = f"email:event:{event.event_type.value}:{event.email}:{event.timestamp.timestamp()}"
        
        data = {
            'event_type': event.event_type.value,
            'email': event.email,
            'timestamp': event.timestamp.isoformat(),
            'message_id': event.message_id,
            'workspace_id': event.workspace_id,
            'campaign_id': event.campaign_id,
            'lead_id': event.lead_id
        }
        
        self.redis_client.setex(
            key,
            timedelta(days=7),
            json.dumps(data)
        )
        
        # Add to event stream
        stream_key = f"email:events:{event.workspace_id or 'global'}"
        self.redis_client.xadd(
            stream_key,
            data,
            maxlen=1000  # Keep last 1000 events
        )
    
    async def _track_transient_bounce(self, email: str):
        """Track transient bounces"""
        key = f"transient:bounce:{email.lower()}"
        count = self.redis_client.incr(key)
        self.redis_client.expire(key, timedelta(days=30))
        
        # If too many transient bounces, consider suppressing
        if count >= 5:
            await self.ses_manager.add_to_suppression_list(
                email,
                "Multiple transient bounces"
            )
    
    async def _update_lead_status(self, email: str, status: str, reason: str):
        """Update lead status in database"""
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute("""
                UPDATE leads
                SET 
                    email_status = %s,
                    email_status_reason = %s,
                    email_status_updated_at = CURRENT_TIMESTAMP
                WHERE email = %s
            """, (status, reason, email))
            
            conn.commit()
            
        except Exception as e:
            logger.error(f"Failed to update lead status: {str(e)}")
            conn.rollback()
        finally:
            cursor.close()
            conn.close()
    
    async def _update_campaign_stats(self, campaign_id: str, metric: str):
        """Update campaign statistics"""
        # Increment counter in Redis for real-time stats
        key = f"campaign:stats:{campaign_id}:{metric}"
        self.redis_client.incr(key)
        
        # Update database periodically (handled by background job)
    
    async def _update_lead_engagement(self, lead_id: str, action: str):
        """Update lead engagement tracking"""
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        try:
            # Record engagement
            cursor.execute("""
                INSERT INTO lead_engagement (
                    lead_id, action, timestamp
                ) VALUES (%s, %s, CURRENT_TIMESTAMP)
            """, (lead_id, action))
            
            # Update last engagement
            cursor.execute("""
                UPDATE leads
                SET 
                    last_engagement = CURRENT_TIMESTAMP,
                    engagement_score = engagement_score + %s
                WHERE id = %s
            """, (
                10 if action == 'clicked' else 5,  # Clicks worth more than opens
                lead_id
            ))
            
            conn.commit()
            
        except Exception as e:
            logger.error(f"Failed to update lead engagement: {str(e)}")
            conn.rollback()
        finally:
            cursor.close()
            conn.close()
    
    async def get_event_statistics(self, workspace_id: str, 
                                  start_date: datetime,
                                  end_date: datetime) -> Dict[str, Any]:
        """Get event statistics for a workspace"""
        conn = self.get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        try:
            # Get event counts by type
            cursor.execute("""
                SELECT 
                    event_type,
                    COUNT(*) as count
                FROM email_events
                WHERE workspace_id = %s
                    AND timestamp BETWEEN %s AND %s
                GROUP BY event_type
            """, (workspace_id, start_date, end_date))
            
            event_counts = {row['event_type']: row['count'] for row in cursor.fetchall()}
            
            # Get bounce breakdown
            cursor.execute("""
                SELECT 
                    bounce_type,
                    bounce_subtype,
                    COUNT(*) as count
                FROM email_events
                WHERE workspace_id = %s
                    AND event_type = 'Bounce'
                    AND timestamp BETWEEN %s AND %s
                GROUP BY bounce_type, bounce_subtype
            """, (workspace_id, start_date, end_date))
            
            bounce_breakdown = cursor.fetchall()
            
            # Get top bouncing domains
            cursor.execute("""
                SELECT 
                    SUBSTRING(email FROM '@(.*)$') as domain,
                    COUNT(*) as count
                FROM email_events
                WHERE workspace_id = %s
                    AND event_type = 'Bounce'
                    AND timestamp BETWEEN %s AND %s
                GROUP BY domain
                ORDER BY count DESC
                LIMIT 10
            """, (workspace_id, start_date, end_date))
            
            top_bounce_domains = cursor.fetchall()
            
            return {
                'event_counts': event_counts,
                'bounce_breakdown': bounce_breakdown,
                'top_bounce_domains': top_bounce_domains,
                'period': {
                    'start': start_date.isoformat(),
                    'end': end_date.isoformat()
                }
            }
            
        finally:
            cursor.close()
            conn.close()


# Flask webhook endpoints

processor = None

def init_processor():
    """Initialize event processor"""
    global processor
    
    ses_config = SESConfig(
        aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
        aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY')
    )
    
    db_config = {
        'host': os.getenv('DB_HOST'),
        'port': os.getenv('DB_PORT', 5432),
        'database': os.getenv('DB_NAME'),
        'user': os.getenv('DB_USER'),
        'password': os.getenv('DB_PASSWORD')
    }
    
    processor = EventProcessor(ses_config, db_config)


@app.route('/webhooks/ses', methods=['POST'])
async def ses_webhook():
    """Handle SES webhook notifications"""
    try:
        # Parse SNS notification
        notification = request.get_json()
        
        if not notification:
            return jsonify({'error': 'Invalid request'}), 400
        
        # Process notification
        success = await processor.process_sns_notification(notification)
        
        if success:
            return '', 204
        else:
            return jsonify({'error': 'Processing failed'}), 500
            
    except Exception as e:
        logger.error(f"Webhook error: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/events/stats/<workspace_id>')
async def get_event_stats(workspace_id):
    """Get event statistics for a workspace"""
    try:
        # Parse date range
        start_date = datetime.fromisoformat(request.args.get('start_date'))
        end_date = datetime.fromisoformat(request.args.get('end_date'))
        
        stats = await processor.get_event_statistics(workspace_id, start_date, end_date)
        
        return jsonify(stats)
        
    except Exception as e:
        logger.error(f"Failed to get stats: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/suppression/list')
async def get_suppression_list():
    """Get suppression list"""
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 100))
    
    result = await processor.ses_manager.get_suppression_list(page, per_page)
    
    return jsonify(result)


@app.route('/api/suppression/remove', methods=['POST'])
async def remove_from_suppression():
    """Remove email from suppression list"""
    data = request.get_json()
    email = data.get('email')
    
    if not email:
        return jsonify({'error': 'Email required'}), 400
    
    await processor.ses_manager.remove_from_suppression_list(email)
    
    return jsonify({'message': 'Email removed from suppression list'})


if __name__ == "__main__":
    init_processor()
    app.run(host='0.0.0.0', port=8092, debug=False)