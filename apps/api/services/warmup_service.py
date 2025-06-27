"""
Email warm-up service for building sender reputation.
"""
import random
import string
from typing import List, Dict, Optional, Tuple, Any
from datetime import datetime, timedelta, time
import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, and_, or_, func
from sqlalchemy.orm import selectinload
import aiosmtplib
import aioimaplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import pytz

from ..models.email_warmup import (
    WarmupPool, WarmupAccount, WarmupCampaign, WarmupEmail,
    WarmupDailyStat, WarmupTemplate, WarmupSchedule,
    WarmupStatus, WarmupStrategy, EmailProvider
)
from ..utils.encryption import encrypt_password, decrypt_password
from ..utils.cache_decorators import cache_result
from ..core.config import settings


class WarmupService:
    """Service for managing email warm-up operations."""
    
    # Warm-up strategy configurations
    STRATEGY_CONFIGS = {
        WarmupStrategy.CONSERVATIVE: {
            'initial_daily': 5,
            'daily_increment': 5,
            'max_daily': 500,
            'min_days': 45,
            'engagement_rate': 0.5
        },
        WarmupStrategy.MODERATE: {
            'initial_daily': 10,
            'daily_increment': 10,
            'max_daily': 1000,
            'min_days': 30,
            'engagement_rate': 0.4
        },
        WarmupStrategy.AGGRESSIVE: {
            'initial_daily': 20,
            'daily_increment': 20,
            'max_daily': 2000,
            'min_days': 20,
            'engagement_rate': 0.3
        }
    }
    
    def __init__(self, db: AsyncSession):
        self.db = db
        
    async def create_warmup_pool(
        self,
        workspace_id: str,
        name: str,
        target_size: int = 50,
        **kwargs
    ) -> WarmupPool:
        """Create a new warm-up pool."""
        pool = WarmupPool(
            workspace_id=workspace_id,
            name=name,
            target_size=target_size,
            **kwargs
        )
        
        self.db.add(pool)
        await self.db.commit()
        
        return pool
    
    async def add_account_to_pool(
        self,
        pool_id: str,
        email: str,
        provider: EmailProvider,
        smtp_config: Dict[str, Any],
        imap_config: Dict[str, Any],
        display_name: Optional[str] = None
    ) -> WarmupAccount:
        """Add an email account to warm-up pool."""
        
        # Encrypt credentials
        smtp_password_encrypted = await encrypt_password(smtp_config['password'])
        
        account = WarmupAccount(
            pool_id=pool_id,
            email=email,
            display_name=display_name or email.split('@')[0],
            provider=provider,
            smtp_host=smtp_config['host'],
            smtp_port=smtp_config['port'],
            smtp_username=smtp_config['username'],
            smtp_password_encrypted=smtp_password_encrypted,
            imap_host=imap_config['host'],
            imap_port=imap_config['port'],
            status=WarmupStatus.PENDING
        )
        
        self.db.add(account)
        
        # Update pool size
        pool = await self.db.get(WarmupPool, pool_id)
        pool.current_size += 1
        
        await self.db.commit()
        
        # Test connection
        if await self._test_account_connection(account):
            account.status = WarmupStatus.ACTIVE
            await self.db.commit()
        
        return account
    
    async def create_warmup_campaign(
        self,
        workspace_id: str,
        name: str,
        email_address: str,
        strategy: WarmupStrategy = WarmupStrategy.MODERATE,
        target_daily_volume: int = 1000,
        custom_schedule: Optional[Dict] = None
    ) -> WarmupCampaign:
        """Create a new warm-up campaign."""
        
        domain = email_address.split('@')[1]
        
        # Generate ramp-up schedule
        schedule = self._generate_rampup_schedule(
            strategy,
            target_daily_volume,
            custom_schedule
        )
        
        campaign = WarmupCampaign(
            workspace_id=workspace_id,
            name=name,
            email_address=email_address,
            domain=domain,
            strategy=strategy,
            target_daily_volume=target_daily_volume,
            rampup_schedule=schedule,
            total_days_planned=len(schedule['days'])
        )
        
        self.db.add(campaign)
        
        # Create default schedule
        default_schedule = WarmupSchedule(
            campaign_id=campaign.id,
            timezone='UTC',
            sending_days=[1, 2, 3, 4, 5],  # Monday-Friday
            sending_hours=list(range(9, 17)),  # 9 AM - 5 PM
            vary_sending_times=True,
            time_variance_minutes=30,
            min_interval_minutes=5,
            max_interval_minutes=60
        )
        self.db.add(default_schedule)
        
        await self.db.commit()
        
        return campaign
    
    async def start_campaign(self, campaign_id: str) -> bool:
        """Start a warm-up campaign."""
        campaign = await self.db.get(WarmupCampaign, campaign_id)
        
        if not campaign:
            raise ValueError(f"Campaign {campaign_id} not found")
            
        if campaign.status != WarmupStatus.PENDING:
            raise ValueError(f"Campaign must be in PENDING status to start")
        
        # Check DNS records
        dns_valid = await self._check_domain_authentication(campaign.domain)
        campaign.spf_valid = dns_valid['spf']
        campaign.dkim_valid = dns_valid['dkim']
        campaign.dmarc_valid = dns_valid['dmarc']
        
        # Start campaign
        campaign.status = WarmupStatus.WARMING
        campaign.started_at = datetime.utcnow()
        campaign.day_number = 1
        
        await self.db.commit()
        
        # Schedule first day's emails
        await self._schedule_daily_warmup(campaign)
        
        return True
    
    async def execute_daily_warmup(self, campaign_id: str) -> Dict[str, Any]:
        """Execute daily warm-up activities for a campaign."""
        campaign = await self.db.get(WarmupCampaign, campaign_id)
        
        if not campaign or campaign.status != WarmupStatus.WARMING:
            return {'status': 'skipped', 'reason': 'Campaign not active'}
        
        # Get today's schedule
        today_schedule = self._get_daily_schedule(campaign)
        if not today_schedule:
            return {'status': 'completed', 'reason': 'No schedule for today'}
        
        # Get available pool accounts
        pool_accounts = await self._get_available_pool_accounts(
            campaign.workspace_id,
            today_schedule['limit']
        )
        
        if len(pool_accounts) < 2:
            return {'status': 'error', 'reason': 'Insufficient pool accounts'}
        
        # Send warm-up emails
        results = await self._send_warmup_batch(
            campaign,
            pool_accounts,
            today_schedule['limit']
        )
        
        # Update daily stats
        await self._update_daily_stats(campaign, results)
        
        # Check if campaign should progress
        await self._check_campaign_progress(campaign)
        
        return {
            'status': 'success',
            'emails_sent': results['sent'],
            'emails_failed': results['failed'],
            'day_number': campaign.day_number
        }
    
    async def _send_warmup_batch(
        self,
        campaign: WarmupCampaign,
        pool_accounts: List[WarmupAccount],
        daily_limit: int
    ) -> Dict[str, int]:
        """Send a batch of warm-up emails."""
        sent = 0
        failed = 0
        
        # Get warm-up templates
        templates = await self._get_warmup_templates(campaign.workspace_id)
        if not templates:
            templates = self._generate_default_templates()
        
        # Calculate emails per account
        emails_per_account = max(1, daily_limit // len(pool_accounts))
        
        for sender in pool_accounts:
            if sent >= daily_limit:
                break
                
            # Skip if sender reached daily limit
            if sender.sends_today >= sender.max_sends_per_day:
                continue
            
            # Select recipients (excluding sender)
            recipients = [a for a in pool_accounts if a.id != sender.id]
            random.shuffle(recipients)
            
            for recipient in recipients[:emails_per_account]:
                if sent >= daily_limit:
                    break
                
                try:
                    # Create warm-up email
                    email = await self._create_warmup_email(
                        campaign,
                        sender,
                        recipient,
                        random.choice(templates)
                    )
                    
                    # Send email
                    success = await self._send_email(sender, recipient, email)
                    
                    if success:
                        sent += 1
                        sender.sends_today += 1
                        sender.total_sent += 1
                        recipient.total_received += 1
                        
                        # Schedule engagement actions
                        await self._schedule_engagement(email)
                    else:
                        failed += 1
                        
                except Exception as e:
                    failed += 1
                    sender.last_error = str(e)
        
        await self.db.commit()
        
        return {'sent': sent, 'failed': failed}
    
    async def _create_warmup_email(
        self,
        campaign: WarmupCampaign,
        sender: WarmupAccount,
        recipient: WarmupAccount,
        template: Dict[str, Any]
    ) -> WarmupEmail:
        """Create a warm-up email record."""
        
        # Select random subject and body
        subject = random.choice(template['subject_lines'])
        body = random.choice(template['body_templates'])
        
        # Personalize content
        subject = subject.format(
            sender_name=sender.display_name,
            recipient_name=recipient.display_name
        )
        body = body.format(
            sender_name=sender.display_name,
            recipient_name=recipient.display_name,
            date=datetime.now().strftime('%B %d'),
            time=datetime.now().strftime('%I:%M %p')
        )
        
        # Determine engagement actions
        pool = await self.db.get(WarmupPool, sender.pool_id)
        should_open = random.random() < pool.min_engagement_rate
        should_click = should_open and random.random() < 0.3
        should_reply = should_open and random.random() < pool.reply_probability
        
        email = WarmupEmail(
            campaign_id=campaign.id,
            sender_account_id=sender.id,
            recipient_account_id=recipient.id,
            subject=subject,
            body_text=body,
            message_id=self._generate_message_id(sender.email),
            should_open=should_open,
            should_click=should_click,
            should_reply=should_reply,
            open_delay_minutes=random.randint(5, 120) if should_open else None
        )
        
        self.db.add(email)
        await self.db.commit()
        
        return email
    
    async def _send_email(
        self,
        sender: WarmupAccount,
        recipient: WarmupAccount,
        warmup_email: WarmupEmail
    ) -> bool:
        """Send an actual email via SMTP."""
        try:
            # Create message
            msg = MIMEMultipart('alternative')
            msg['From'] = f"{sender.display_name} <{sender.email}>"
            msg['To'] = f"{recipient.display_name} <{recipient.email}>"
            msg['Subject'] = warmup_email.subject
            msg['Message-ID'] = f"<{warmup_email.message_id}>"
            
            # Add text part
            text_part = MIMEText(warmup_email.body_text, 'plain')
            msg.attach(text_part)
            
            # Add HTML part (simple formatting)
            html_body = warmup_email.body_text.replace('\n', '<br>')
            html_part = MIMEText(f"<html><body>{html_body}</body></html>", 'html')
            msg.attach(html_part)
            
            # Decrypt password
            password = await decrypt_password(sender.smtp_password_encrypted)
            
            # Send via SMTP
            async with aiosmtplib.SMTP(
                hostname=sender.smtp_host,
                port=sender.smtp_port,
                use_tls=True
            ) as smtp:
                await smtp.login(sender.smtp_username, password)
                await smtp.send_message(msg)
            
            # Update last send time
            sender.last_send_at = datetime.utcnow()
            warmup_email.delivered_at = datetime.utcnow()
            warmup_email.is_delivered = True
            
            return True
            
        except Exception as e:
            warmup_email.is_bounced = True
            return False
    
    async def _schedule_engagement(self, email: WarmupEmail):
        """Schedule engagement actions for an email."""
        if not email.should_open:
            return
            
        # Schedule open action
        open_time = datetime.utcnow() + timedelta(minutes=email.open_delay_minutes)
        
        # In production, this would use a task queue like Celery
        # For now, we'll just mark it for processing
        # asyncio.create_task(self._simulate_open(email, open_time))
    
    async def simulate_engagement_batch(self) -> Dict[str, int]:
        """Simulate engagement for pending emails."""
        # Get emails pending engagement
        result = await self.db.execute(
            select(WarmupEmail)
            .where(
                and_(
                    WarmupEmail.is_delivered == True,
                    WarmupEmail.should_open == True,
                    WarmupEmail.is_opened == False,
                    WarmupEmail.delivered_at <= datetime.utcnow() - timedelta(minutes=5)
                )
            )
            .limit(100)
        )
        emails = result.scalars().all()
        
        opened = 0
        clicked = 0
        replied = 0
        
        for email in emails:
            # Check if it's time to open
            if email.delivered_at + timedelta(minutes=email.open_delay_minutes) <= datetime.utcnow():
                # Simulate open
                email.opened_at = datetime.utcnow()
                email.is_opened = True
                opened += 1
                
                # Update recipient stats
                recipient = await self.db.get(WarmupAccount, email.recipient_account_id)
                recipient.total_opened += 1
                
                # Simulate click if scheduled
                if email.should_click and random.random() < 0.7:
                    email.clicked_at = datetime.utcnow()
                    email.is_clicked = True
                    clicked += 1
                    recipient.total_clicked += 1
                
                # Simulate reply if scheduled
                if email.should_reply:
                    reply_sent = await self._send_reply(email)
                    if reply_sent:
                        email.replied_at = datetime.utcnow()
                        email.is_replied = True
                        replied += 1
                        recipient.total_replied += 1
        
        await self.db.commit()
        
        return {
            'opened': opened,
            'clicked': clicked,
            'replied': replied
        }
    
    async def _send_reply(self, original_email: WarmupEmail) -> bool:
        """Send a reply to a warm-up email."""
        try:
            # Get accounts
            original_sender = await self.db.get(WarmupAccount, original_email.sender_account_id)
            original_recipient = await self.db.get(WarmupAccount, original_email.recipient_account_id)
            
            # Create reply content
            reply_subjects = [
                f"Re: {original_email.subject}",
                f"RE: {original_email.subject}",
            ]
            
            reply_bodies = [
                "Thanks for reaching out! This sounds interesting.",
                "Got your message. Let's discuss this further.",
                "Appreciate the email. When would be a good time to connect?",
                "Thanks for the update. Looking forward to our next steps.",
            ]
            
            # Create reply email
            reply = WarmupEmail(
                campaign_id=original_email.campaign_id,
                sender_account_id=original_recipient.id,  # Swap sender/recipient
                recipient_account_id=original_sender.id,
                subject=random.choice(reply_subjects),
                body_text=random.choice(reply_bodies),
                message_id=self._generate_message_id(original_recipient.email),
                thread_id=original_email.message_id,  # Thread reference
                should_open=True,
                open_delay_minutes=random.randint(10, 60)
            )
            
            self.db.add(reply)
            
            # Send the reply
            success = await self._send_email(original_recipient, original_sender, reply)
            
            if success:
                original_recipient.sends_today += 1
                original_recipient.total_sent += 1
                original_sender.total_received += 1
            
            await self.db.commit()
            return success
            
        except Exception:
            return False
    
    async def _update_daily_stats(
        self,
        campaign: WarmupCampaign,
        results: Dict[str, int]
    ):
        """Update daily statistics for a campaign."""
        today = datetime.utcnow().date()
        
        # Get or create today's stats
        result = await self.db.execute(
            select(WarmupDailyStat)
            .where(
                and_(
                    WarmupDailyStat.campaign_id == campaign.id,
                    func.date(WarmupDailyStat.date) == today
                )
            )
        )
        stats = result.scalar_one_or_none()
        
        if not stats:
            stats = WarmupDailyStat(
                campaign_id=campaign.id,
                date=datetime.utcnow(),
                day_number=campaign.day_number
            )
            self.db.add(stats)
        
        # Update counts
        stats.emails_sent = results['sent']
        stats.emails_failed = results['failed']
        
        # Calculate rates
        if stats.emails_sent > 0:
            stats.delivery_rate = (stats.emails_sent - stats.emails_failed) / stats.emails_sent
        
        # Check health
        stats.is_healthy = stats.delivery_rate >= 0.95 and stats.spam_rate <= 0.01
        
        await self.db.commit()
    
    async def _check_campaign_progress(self, campaign: WarmupCampaign):
        """Check if campaign should progress to next day or complete."""
        # Check if day is complete
        schedule = campaign.rampup_schedule
        current_day = next(
            (d for d in schedule['days'] if d['day'] == campaign.day_number),
            None
        )
        
        if not current_day:
            return
        
        # Progress to next day
        if campaign.day_number < campaign.total_days_planned:
            campaign.day_number += 1
            campaign.current_daily_limit = self._get_daily_limit(campaign, campaign.day_number)
        else:
            # Campaign complete
            campaign.status = WarmupStatus.COMPLETED
            campaign.completed_at = datetime.utcnow()
            
            # Calculate final metrics
            await self._calculate_campaign_metrics(campaign)
        
        await self.db.commit()
    
    async def _calculate_campaign_metrics(self, campaign: WarmupCampaign):
        """Calculate overall campaign metrics."""
        # Get all campaign emails
        result = await self.db.execute(
            select(
                func.count(WarmupEmail.id).label('total'),
                func.sum(func.cast(WarmupEmail.is_opened, Integer)).label('opened'),
                func.sum(func.cast(WarmupEmail.is_clicked, Integer)).label('clicked'),
                func.sum(func.cast(WarmupEmail.is_replied, Integer)).label('replied'),
                func.sum(func.cast(WarmupEmail.is_bounced, Integer)).label('bounced'),
                func.sum(func.cast(WarmupEmail.is_spam, Integer)).label('spam')
            )
            .where(WarmupEmail.campaign_id == campaign.id)
        )
        
        metrics = result.first()
        
        if metrics.total > 0:
            campaign.average_open_rate = (metrics.opened or 0) / metrics.total
            campaign.average_click_rate = (metrics.clicked or 0) / metrics.total
            campaign.bounce_rate = (metrics.bounced or 0) / metrics.total
            campaign.spam_rate = (metrics.spam or 0) / metrics.total
        
        await self.db.commit()
    
    @cache_result(ttl=300, namespace="warmup_pools")
    async def get_workspace_pools(
        self,
        workspace_id: str,
        active_only: bool = True
    ) -> List[WarmupPool]:
        """Get warm-up pools for a workspace."""
        query = select(WarmupPool).where(
            WarmupPool.workspace_id == workspace_id
        )
        
        if active_only:
            query = query.where(WarmupPool.is_active == True)
        
        result = await self.db.execute(query)
        return result.scalars().all()
    
    @cache_result(ttl=300, namespace="warmup_campaigns")
    async def get_workspace_campaigns(
        self,
        workspace_id: str,
        status: Optional[WarmupStatus] = None
    ) -> List[WarmupCampaign]:
        """Get warm-up campaigns for a workspace."""
        query = select(WarmupCampaign).where(
            WarmupCampaign.workspace_id == workspace_id
        )
        
        if status:
            query = query.where(WarmupCampaign.status == status)
        
        query = query.order_by(WarmupCampaign.created_at.desc())
        
        result = await self.db.execute(query)
        return result.scalars().all()
    
    # Helper methods
    
    def _generate_rampup_schedule(
        self,
        strategy: WarmupStrategy,
        target_volume: int,
        custom_schedule: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """Generate daily ramp-up schedule."""
        if custom_schedule:
            return custom_schedule
        
        config = self.STRATEGY_CONFIGS[strategy]
        schedule = {'days': []}
        
        current_limit = config['initial_daily']
        day = 1
        
        while current_limit < min(target_volume, config['max_daily']) and day <= config['min_days']:
            schedule['days'].append({
                'day': day,
                'limit': current_limit,
                'actual': 0
            })
            
            # Increment for next day
            current_limit = min(
                current_limit + config['daily_increment'],
                target_volume,
                config['max_daily']
            )
            day += 1
        
        # Add final days at target volume
        while day <= config['min_days']:
            schedule['days'].append({
                'day': day,
                'limit': min(target_volume, config['max_daily']),
                'actual': 0
            })
            day += 1
        
        return schedule
    
    def _get_daily_schedule(self, campaign: WarmupCampaign) -> Optional[Dict]:
        """Get schedule for current day."""
        if not campaign.rampup_schedule:
            return None
        
        return next(
            (d for d in campaign.rampup_schedule['days'] if d['day'] == campaign.day_number),
            None
        )
    
    def _get_daily_limit(self, campaign: WarmupCampaign, day: int) -> int:
        """Get sending limit for specific day."""
        schedule = self._get_daily_schedule(campaign)
        return schedule['limit'] if schedule else 0
    
    async def _get_available_pool_accounts(
        self,
        workspace_id: str,
        needed: int
    ) -> List[WarmupAccount]:
        """Get available accounts from pools."""
        result = await self.db.execute(
            select(WarmupAccount)
            .join(WarmupPool)
            .where(
                and_(
                    WarmupPool.workspace_id == workspace_id,
                    WarmupPool.is_active == True,
                    WarmupAccount.status == WarmupStatus.ACTIVE,
                    WarmupAccount.is_active == True
                )
            )
            .order_by(func.random())
            .limit(min(needed * 2, 100))  # Get more than needed for flexibility
        )
        
        return result.scalars().all()
    
    async def _test_account_connection(self, account: WarmupAccount) -> bool:
        """Test SMTP/IMAP connection for an account."""
        try:
            # Test SMTP
            password = await decrypt_password(account.smtp_password_encrypted)
            
            async with aiosmtplib.SMTP(
                hostname=account.smtp_host,
                port=account.smtp_port,
                use_tls=True
            ) as smtp:
                await smtp.login(account.smtp_username, password)
            
            return True
            
        except Exception as e:
            account.last_error = str(e)
            return False
    
    async def _check_domain_authentication(self, domain: str) -> Dict[str, bool]:
        """Check SPF, DKIM, DMARC records for domain."""
        # In production, this would check actual DNS records
        # For now, return mock results
        return {
            'spf': True,
            'dkim': True,
            'dmarc': True
        }
    
    async def _get_warmup_templates(self, workspace_id: str) -> List[Dict]:
        """Get warm-up email templates."""
        result = await self.db.execute(
            select(WarmupTemplate)
            .where(
                and_(
                    WarmupTemplate.workspace_id == workspace_id,
                    WarmupTemplate.is_active == True
                )
            )
        )
        templates = result.scalars().all()
        
        return [
            {
                'subject_lines': t.subject_lines,
                'body_templates': t.body_templates
            }
            for t in templates
        ]
    
    def _generate_default_templates(self) -> List[Dict]:
        """Generate default warm-up templates."""
        return [
            {
                'subject_lines': [
                    "Quick question about our meeting",
                    "Following up on our discussion",
                    "Re: Project update",
                    "Thoughts on the proposal?",
                    "Schedule for next week"
                ],
                'body_templates': [
                    "Hi {recipient_name},\n\nHope you're having a great day. Just wanted to check in on our project timeline.\n\nBest,\n{sender_name}",
                    "Hey {recipient_name},\n\nThanks for the chat earlier. Let me know if you need any clarification on the points we discussed.\n\nRegards,\n{sender_name}",
                    "Hi {recipient_name},\n\nI've reviewed the documents you sent. Everything looks good to proceed.\n\nTalk soon,\n{sender_name}"
                ]
            }
        ]
    
    def _generate_message_id(self, email: str) -> str:
        """Generate unique message ID."""
        timestamp = datetime.utcnow().timestamp()
        random_str = ''.join(random.choices(string.ascii_lowercase + string.digits, k=10))
        domain = email.split('@')[1]
        return f"{timestamp}.{random_str}@{domain}"