#!/usr/bin/env python3
"""
IP Warm-up Manager for Amazon SES
Gradually increases sending volume to establish IP reputation
"""

import os
import json
import boto3
import logging
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, field
from datetime import datetime, timedelta
import asyncio
from enum import Enum
import redis
from ses_manager import SESManager, EmailMessage, EmailType, SESConfig

logger = logging.getLogger(__name__)


class WarmupPhase(Enum):
    """IP warm-up phases"""
    INITIAL = "initial"
    RAMP_UP = "ramp_up"
    STEADY = "steady"
    COMPLETED = "completed"


@dataclass
class WarmupSchedule:
    """Daily sending limits for warm-up"""
    day: int
    volume: int
    hourly_rate: float
    
    @classmethod
    def get_standard_schedule(cls) -> List['WarmupSchedule']:
        """Get standard 30-day warm-up schedule"""
        return [
            cls(1, 50, 2.1),
            cls(2, 100, 4.2),
            cls(3, 500, 20.8),
            cls(4, 1000, 41.7),
            cls(5, 5000, 208.3),
            cls(6, 10000, 416.7),
            cls(7, 25000, 1041.7),
            cls(8, 50000, 2083.3),
            cls(9, 100000, 4166.7),
            cls(10, 250000, 10416.7),
            cls(11, 500000, 20833.3),
            cls(12, 750000, 31250.0),
            cls(13, 1000000, 41666.7),
            cls(14, 1500000, 62500.0),
            cls(15, 2000000, 83333.3),
            # Continue ramping up
            cls(16, 2500000, 104166.7),
            cls(17, 3000000, 125000.0),
            cls(18, 3500000, 145833.3),
            cls(19, 4000000, 166666.7),
            cls(20, 4500000, 187500.0),
            cls(21, 5000000, 208333.3),
            cls(22, 5500000, 229166.7),
            cls(23, 6000000, 250000.0),
            cls(24, 6500000, 270833.3),
            cls(25, 7000000, 291666.7),
            cls(26, 7500000, 312500.0),
            cls(27, 8000000, 333333.3),
            cls(28, 8500000, 354166.7),
            cls(29, 9000000, 375000.0),
            cls(30, 10000000, 416666.7),
        ]


@dataclass
class IPWarmupStatus:
    """Status of IP warm-up"""
    ip_address: str
    pool_name: str
    start_date: datetime
    current_day: int
    current_phase: WarmupPhase
    emails_sent_today: int
    emails_sent_total: int
    bounce_rate: float
    complaint_rate: float
    reputation_score: float
    is_healthy: bool
    last_check: datetime
    notes: List[str] = field(default_factory=list)


class WarmupManager:
    """Manages IP warm-up process"""
    
    def __init__(self, ses_config: SESConfig, redis_url: str = "redis://localhost:6379"):
        self.ses_config = ses_config
        self.redis_client = redis.from_url(redis_url, decode_responses=True)
        self.ses_manager = SESManager(ses_config)
        self.warmup_schedule = WarmupSchedule.get_standard_schedule()
        
    def start_warmup(self, ip_address: str, pool_name: str = "coldcopy-sending-pool") -> bool:
        """Start warm-up process for an IP"""
        try:
            # Check if already warming up
            if self._is_warming_up(ip_address):
                logger.warning(f"IP {ip_address} is already in warm-up")
                return False
            
            # Initialize warm-up status
            status = IPWarmupStatus(
                ip_address=ip_address,
                pool_name=pool_name,
                start_date=datetime.utcnow(),
                current_day=1,
                current_phase=WarmupPhase.INITIAL,
                emails_sent_today=0,
                emails_sent_total=0,
                bounce_rate=0.0,
                complaint_rate=0.0,
                reputation_score=0.0,
                is_healthy=True,
                last_check=datetime.utcnow(),
                notes=["Warm-up started"]
            )
            
            # Save to Redis
            self._save_warmup_status(status)
            
            logger.info(f"Started warm-up for IP {ip_address}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to start warm-up: {str(e)}")
            return False
    
    def _is_warming_up(self, ip_address: str) -> bool:
        """Check if IP is currently warming up"""
        key = f"warmup:status:{ip_address}"
        return self.redis_client.exists(key)
    
    def _save_warmup_status(self, status: IPWarmupStatus):
        """Save warm-up status to Redis"""
        key = f"warmup:status:{status.ip_address}"
        data = {
            'ip_address': status.ip_address,
            'pool_name': status.pool_name,
            'start_date': status.start_date.isoformat(),
            'current_day': status.current_day,
            'current_phase': status.current_phase.value,
            'emails_sent_today': status.emails_sent_today,
            'emails_sent_total': status.emails_sent_total,
            'bounce_rate': status.bounce_rate,
            'complaint_rate': status.complaint_rate,
            'reputation_score': status.reputation_score,
            'is_healthy': status.is_healthy,
            'last_check': status.last_check.isoformat(),
            'notes': status.notes
        }
        
        self.redis_client.set(key, json.dumps(data))
        self.redis_client.expire(key, timedelta(days=60))  # Keep for 60 days
    
    def _load_warmup_status(self, ip_address: str) -> Optional[IPWarmupStatus]:
        """Load warm-up status from Redis"""
        key = f"warmup:status:{ip_address}"
        data = self.redis_client.get(key)
        
        if not data:
            return None
        
        data = json.loads(data)
        return IPWarmupStatus(
            ip_address=data['ip_address'],
            pool_name=data['pool_name'],
            start_date=datetime.fromisoformat(data['start_date']),
            current_day=data['current_day'],
            current_phase=WarmupPhase(data['current_phase']),
            emails_sent_today=data['emails_sent_today'],
            emails_sent_total=data['emails_sent_total'],
            bounce_rate=data['bounce_rate'],
            complaint_rate=data['complaint_rate'],
            reputation_score=data['reputation_score'],
            is_healthy=data['is_healthy'],
            last_check=datetime.fromisoformat(data['last_check']),
            notes=data.get('notes', [])
        )
    
    async def can_send_email(self, ip_address: str) -> Tuple[bool, Optional[str]]:
        """Check if we can send an email through this IP"""
        status = self._load_warmup_status(ip_address)
        
        if not status:
            return True, None  # Not in warm-up, can send
        
        # Check if warm-up is complete
        if status.current_phase == WarmupPhase.COMPLETED:
            return True, None
        
        # Check health
        if not status.is_healthy:
            return False, "IP is not healthy - warm-up paused"
        
        # Get today's limit
        if status.current_day <= len(self.warmup_schedule):
            daily_limit = self.warmup_schedule[status.current_day - 1].volume
        else:
            # Beyond schedule, use last day's limit
            daily_limit = self.warmup_schedule[-1].volume
        
        # Check if we've reached daily limit
        if status.emails_sent_today >= daily_limit:
            return False, f"Daily warm-up limit reached ({daily_limit})"
        
        # Check hourly rate
        hourly_limit = self.warmup_schedule[min(status.current_day - 1, len(self.warmup_schedule) - 1)].hourly_rate
        if not await self._check_hourly_rate(ip_address, hourly_limit):
            return False, f"Hourly rate limit reached ({hourly_limit}/hour)"
        
        return True, None
    
    async def _check_hourly_rate(self, ip_address: str, hourly_limit: float) -> bool:
        """Check if we're within hourly rate limit"""
        key = f"warmup:hourly:{ip_address}:{datetime.utcnow().strftime('%Y%m%d%H')}"
        current_count = int(self.redis_client.get(key) or 0)
        
        return current_count < hourly_limit
    
    async def record_email_sent(self, ip_address: str):
        """Record that an email was sent through this IP"""
        status = self._load_warmup_status(ip_address)
        
        if not status:
            return  # Not in warm-up
        
        # Update counts
        status.emails_sent_today += 1
        status.emails_sent_total += 1
        
        # Update hourly counter
        hourly_key = f"warmup:hourly:{ip_address}:{datetime.utcnow().strftime('%Y%m%d%H')}"
        self.redis_client.incr(hourly_key)
        self.redis_client.expire(hourly_key, timedelta(hours=2))
        
        # Save status
        self._save_warmup_status(status)
    
    async def update_warmup_metrics(self, ip_address: str):
        """Update warm-up metrics and check health"""
        status = self._load_warmup_status(ip_address)
        
        if not status or status.current_phase == WarmupPhase.COMPLETED:
            return
        
        try:
            # Get metrics from SES
            metrics = await self._get_ip_metrics(ip_address)
            
            # Update status
            status.bounce_rate = metrics.get('bounce_rate', 0.0)
            status.complaint_rate = metrics.get('complaint_rate', 0.0)
            status.reputation_score = metrics.get('reputation_score', 0.0)
            status.last_check = datetime.utcnow()
            
            # Check health thresholds
            health_issues = []
            
            if status.bounce_rate > 0.05:  # 5% bounce rate
                health_issues.append(f"High bounce rate: {status.bounce_rate:.2%}")
            
            if status.complaint_rate > 0.001:  # 0.1% complaint rate
                health_issues.append(f"High complaint rate: {status.complaint_rate:.2%}")
            
            if status.reputation_score < 0.90 and status.reputation_score > 0:
                health_issues.append(f"Low reputation score: {status.reputation_score:.2f}")
            
            # Update health status
            if health_issues:
                status.is_healthy = False
                status.notes.append(f"Health issues detected: {', '.join(health_issues)}")
                logger.warning(f"IP {ip_address} health issues: {health_issues}")
                
                # Send alert
                await self._send_warmup_alert(ip_address, health_issues)
            else:
                status.is_healthy = True
            
            # Check if we should advance phase
            self._check_phase_advancement(status)
            
            # Save status
            self._save_warmup_status(status)
            
        except Exception as e:
            logger.error(f"Failed to update warm-up metrics: {str(e)}")
    
    def _check_phase_advancement(self, status: IPWarmupStatus):
        """Check if we should advance to next phase"""
        # Check if day should advance
        if (datetime.utcnow() - status.start_date).days > status.current_day:
            status.current_day += 1
            status.emails_sent_today = 0
            status.notes.append(f"Advanced to day {status.current_day}")
        
        # Update phase based on day
        if status.current_day <= 5:
            status.current_phase = WarmupPhase.INITIAL
        elif status.current_day <= 15:
            status.current_phase = WarmupPhase.RAMP_UP
        elif status.current_day <= 30:
            status.current_phase = WarmupPhase.STEADY
        else:
            status.current_phase = WarmupPhase.COMPLETED
            status.notes.append("Warm-up completed successfully")
    
    async def _get_ip_metrics(self, ip_address: str) -> Dict[str, float]:
        """Get metrics for specific IP from SES"""
        # In production, you would use SES API to get IP-specific metrics
        # For now, we'll simulate with overall metrics
        
        try:
            # This would typically be an API call to get IP-specific reputation
            # For demonstration, we'll use cached values
            
            metrics_key = f"warmup:metrics:{ip_address}"
            cached_metrics = self.redis_client.get(metrics_key)
            
            if cached_metrics:
                return json.loads(cached_metrics)
            
            # Default metrics
            return {
                'bounce_rate': 0.001,
                'complaint_rate': 0.0001,
                'reputation_score': 0.95
            }
            
        except Exception as e:
            logger.error(f"Failed to get IP metrics: {str(e)}")
            return {}
    
    async def pause_warmup(self, ip_address: str, reason: str):
        """Pause warm-up for an IP"""
        status = self._load_warmup_status(ip_address)
        
        if not status:
            logger.warning(f"No warm-up found for IP {ip_address}")
            return
        
        status.is_healthy = False
        status.notes.append(f"Warm-up paused: {reason}")
        
        self._save_warmup_status(status)
        logger.info(f"Paused warm-up for IP {ip_address}: {reason}")
    
    async def resume_warmup(self, ip_address: str):
        """Resume warm-up for an IP"""
        status = self._load_warmup_status(ip_address)
        
        if not status:
            logger.warning(f"No warm-up found for IP {ip_address}")
            return
        
        status.is_healthy = True
        status.notes.append("Warm-up resumed")
        
        self._save_warmup_status(status)
        logger.info(f"Resumed warm-up for IP {ip_address}")
    
    async def get_warmup_status_all(self) -> List[IPWarmupStatus]:
        """Get warm-up status for all IPs"""
        pattern = "warmup:status:*"
        statuses = []
        
        for key in self.redis_client.scan_iter(match=pattern):
            ip_address = key.split(":")[-1]
            status = self._load_warmup_status(ip_address)
            if status:
                statuses.append(status)
        
        return statuses
    
    async def generate_warmup_report(self, ip_address: str) -> Dict[str, Any]:
        """Generate detailed warm-up report"""
        status = self._load_warmup_status(ip_address)
        
        if not status:
            return {"error": "No warm-up found for this IP"}
        
        # Calculate progress
        total_days = 30
        progress_percentage = min((status.current_day / total_days) * 100, 100)
        
        # Get current limits
        if status.current_day <= len(self.warmup_schedule):
            current_schedule = self.warmup_schedule[status.current_day - 1]
        else:
            current_schedule = self.warmup_schedule[-1]
        
        # Calculate estimated completion
        days_remaining = max(0, total_days - status.current_day)
        estimated_completion = status.start_date + timedelta(days=total_days)
        
        report = {
            'ip_address': status.ip_address,
            'pool_name': status.pool_name,
            'status': {
                'phase': status.current_phase.value,
                'is_healthy': status.is_healthy,
                'current_day': status.current_day,
                'progress_percentage': round(progress_percentage, 2)
            },
            'metrics': {
                'emails_sent_today': status.emails_sent_today,
                'emails_sent_total': status.emails_sent_total,
                'bounce_rate': round(status.bounce_rate * 100, 3),
                'complaint_rate': round(status.complaint_rate * 100, 4),
                'reputation_score': round(status.reputation_score, 2)
            },
            'limits': {
                'daily_limit': current_schedule.volume,
                'hourly_limit': round(current_schedule.hourly_rate, 1),
                'remaining_today': max(0, current_schedule.volume - status.emails_sent_today)
            },
            'timeline': {
                'start_date': status.start_date.isoformat(),
                'days_elapsed': status.current_day,
                'days_remaining': days_remaining,
                'estimated_completion': estimated_completion.isoformat()
            },
            'recent_notes': status.notes[-10:]  # Last 10 notes
        }
        
        return report
    
    async def _send_warmup_alert(self, ip_address: str, issues: List[str]):
        """Send alert about warm-up issues"""
        if not self.ses_config.alert_email:
            return
        
        subject = f"ColdCopy IP Warm-up Alert: {ip_address}"
        body = f"""
        IP Warm-up Health Alert
        
        IP Address: {ip_address}
        Issues Detected:
        {chr(10).join(f"- {issue}" for issue in issues)}
        
        The warm-up process has been automatically paused.
        Please investigate and resume when resolved.
        
        View details at: https://app.coldcopy.ai/admin/warmup/{ip_address}
        """
        
        # Send alert email
        message = EmailMessage(
            to_addresses=[self.ses_config.alert_email],
            from_address="alerts@coldcopy.ai",
            from_name="ColdCopy Alerts",
            subject=subject,
            html_body=f"<pre>{body}</pre>",
            text_body=body,
            email_type=EmailType.SYSTEM
        )
        
        await self.ses_manager.send_email(message)
    
    async def create_warmup_emails(self, count: int) -> List[EmailMessage]:
        """Create warm-up emails to send"""
        # Use a mix of major providers for warm-up
        providers = [
            '@gmail.com', '@yahoo.com', '@outlook.com', '@hotmail.com',
            '@aol.com', '@icloud.com', '@mail.com', '@protonmail.com'
        ]
        
        emails = []
        
        for i in range(count):
            # Rotate through providers
            provider = providers[i % len(providers)]
            
            # Generate test recipient
            recipient = f"warmup.test.{datetime.utcnow().strftime('%Y%m%d')}.{i}{provider}"
            
            # Create engaging content (varies to avoid spam filters)
            subjects = [
                "Your weekly productivity tips",
                "5 ways to improve your email campaigns",
                "Industry insights for this month",
                "Quick question about our meeting",
                "Following up on our conversation",
                "Your requested information",
                "Updates from the team",
                "New features you might like"
            ]
            
            subject = subjects[i % len(subjects)]
            
            # Create email
            email = EmailMessage(
                to_addresses=[recipient],
                from_address="warmup@coldcopy.ai",
                from_name="ColdCopy Team",
                subject=subject,
                html_body=self._generate_warmup_content_html(i),
                text_body=self._generate_warmup_content_text(i),
                email_type=EmailType.TRANSACTIONAL,
                tags=["warmup", f"day-{datetime.utcnow().day}"],
                tracking_enabled=False  # Don't track warm-up emails
            )
            
            emails.append(email)
        
        return emails
    
    def _generate_warmup_content_html(self, index: int) -> str:
        """Generate HTML content for warm-up emails"""
        templates = [
            """
            <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <h2>Weekly Productivity Tips</h2>
                <p>Hi there,</p>
                <p>Here are this week's top productivity tips to help you get more done:</p>
                <ol>
                    <li>Start your day with the most important task</li>
                    <li>Use time blocking for focused work</li>
                    <li>Take regular breaks to maintain energy</li>
                    <li>Review and plan for tomorrow before ending your day</li>
                </ol>
                <p>Best regards,<br>The ColdCopy Team</p>
                <p style="font-size: 12px; color: #666;">
                    You're receiving this because you subscribed to our newsletter.
                    <a href="#">Unsubscribe</a> | <a href="#">Update preferences</a>
                </p>
            </body>
            </html>
            """,
            """
            <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <h2>Improve Your Email Campaigns</h2>
                <p>Hello,</p>
                <p>Want better results from your email campaigns? Try these proven strategies:</p>
                <ul>
                    <li><strong>Personalize subject lines</strong> - Use the recipient's name or company</li>
                    <li><strong>Keep it concise</strong> - Aim for 50-125 words</li>
                    <li><strong>Clear CTA</strong> - One clear call-to-action per email</li>
                    <li><strong>Mobile optimize</strong> - 60% of emails are opened on mobile</li>
                    <li><strong>Test send times</strong> - Find when your audience is most active</li>
                </ul>
                <p>Happy emailing!<br>The ColdCopy Team</p>
            </body>
            </html>
            """
        ]
        
        return templates[index % len(templates)]
    
    def _generate_warmup_content_text(self, index: int) -> str:
        """Generate text content for warm-up emails"""
        return "This is a plain text version of the email. Please view the HTML version for better formatting."


async def warmup_scheduler(warmup_manager: WarmupManager):
    """Background task to manage warm-up sending"""
    while True:
        try:
            # Get all IPs in warm-up
            statuses = await warmup_manager.get_warmup_status_all()
            
            for status in statuses:
                if status.is_healthy and status.current_phase != WarmupPhase.COMPLETED:
                    # Check if we need to send emails
                    can_send, reason = await warmup_manager.can_send_email(status.ip_address)
                    
                    if can_send:
                        # Calculate how many to send this hour
                        schedule = warmup_manager.warmup_schedule[
                            min(status.current_day - 1, len(warmup_manager.warmup_schedule) - 1)
                        ]
                        
                        hourly_target = int(schedule.hourly_rate)
                        
                        # Create and send warm-up emails
                        emails = await warmup_manager.create_warmup_emails(min(hourly_target, 10))
                        
                        for email in emails:
                            # Force sending through specific IP
                            email.headers['X-SES-SOURCE-IP'] = status.ip_address
                            
                            success, _ = await warmup_manager.ses_manager.send_email(email)
                            
                            if success:
                                await warmup_manager.record_email_sent(status.ip_address)
                    
                    # Update metrics
                    await warmup_manager.update_warmup_metrics(status.ip_address)
            
        except Exception as e:
            logger.error(f"Warm-up scheduler error: {str(e)}")
        
        # Run every 5 minutes
        await asyncio.sleep(300)


if __name__ == "__main__":
    # Example usage
    import asyncio
    
    async def main():
        config = SESConfig(
            aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
            aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY')
        )
        
        manager = WarmupManager(config)
        
        # Start warm-up for an IP
        manager.start_warmup("192.0.2.1")
        
        # Check status
        report = await manager.generate_warmup_report("192.0.2.1")
        print(json.dumps(report, indent=2))
        
        # Run scheduler
        await warmup_scheduler(manager)
    
    asyncio.run(main())