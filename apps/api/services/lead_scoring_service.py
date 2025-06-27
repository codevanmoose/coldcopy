"""
Lead scoring and segmentation service.
"""
import json
import statistics
from typing import List, Dict, Optional, Any, Tuple
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, and_, or_, func, case, text
from sqlalchemy.orm import selectinload
import numpy as np
from sklearn.preprocessing import MinMaxScaler

from ..models.lead_scoring import (
    LeadScore, LeadScoreHistory, ScoringRule, Segment, 
    SegmentMember, LeadActivity, ScoringModel, SegmentType,
    SegmentStatus, RuleOperator
)
from ..models.lead import Lead
from ..models.campaign import CampaignEmail
from ..models.email_events import EmailEvent
from ..utils.cache_decorators import cache_result, cache_invalidate


class LeadScoringService:
    """Service for lead scoring and segmentation."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
        
    async def calculate_lead_score(
        self, 
        lead_id: str, 
        workspace_id: str,
        trigger_event: Optional[str] = None
    ) -> LeadScore:
        """Calculate or recalculate a lead's score."""
        
        # Get lead with all related data
        lead = await self._get_lead_with_data(lead_id)
        if not lead:
            raise ValueError(f"Lead {lead_id} not found")
            
        # Get scoring rules for workspace
        scoring_rule = await self._get_scoring_rules(workspace_id)
        
        # Get or create lead score
        lead_score = await self._get_or_create_lead_score(lead_id, workspace_id)
        
        # Store previous score for history
        previous_score = lead_score.total_score
        
        # Calculate component scores
        engagement_score = await self._calculate_engagement_score(lead, scoring_rule)
        quality_score = await self._calculate_quality_score(lead, scoring_rule)
        intent_score = await self._calculate_intent_score(lead, scoring_rule)
        
        # Calculate weighted total score
        lead_score.engagement_score = engagement_score
        lead_score.quality_score = quality_score
        lead_score.intent_score = intent_score
        lead_score.total_score = int((
            engagement_score * 0.4 + 
            quality_score * 0.3 + 
            intent_score * 0.3
        ))
        
        # Calculate individual point components
        lead_score.email_engagement_points = await self._calculate_email_points(lead, scoring_rule)
        lead_score.profile_completeness_points = self._calculate_profile_points(lead)
        lead_score.company_fit_points = await self._calculate_company_fit_points(lead, scoring_rule)
        lead_score.behavior_points = await self._calculate_behavior_points(lead, scoring_rule)
        lead_score.recency_points = await self._calculate_recency_points(lead, scoring_rule)
        
        # Assign grade and temperature
        lead_score.grade = self._calculate_grade(lead_score.total_score, scoring_rule)
        lead_score.temperature = self._calculate_temperature(lead_score.total_score, engagement_score)
        
        # Store scoring factors for transparency
        lead_score.scoring_factors = {
            'engagement_breakdown': {
                'email_opens': await self._count_email_opens(lead),
                'email_clicks': await self._count_email_clicks(lead),
                'email_replies': await self._count_email_replies(lead),
                'last_engagement': await self._get_last_engagement_date(lead)
            },
            'quality_factors': {
                'profile_completeness': self._calculate_profile_completeness_percentage(lead),
                'email_validity': lead.email_status == 'valid',
                'enrichment_confidence': lead.enrichment_confidence or 0
            },
            'scoring_weights': {
                'email_open': scoring_rule.email_open_weight,
                'email_click': scoring_rule.email_click_weight,
                'email_reply': scoring_rule.email_reply_weight
            }
        }
        
        # Update timestamps
        lead_score.last_calculated_at = datetime.utcnow()
        if previous_score != lead_score.total_score:
            lead_score.score_changed_at = datetime.utcnow()
            
            # Create history record
            history = LeadScoreHistory(
                lead_score_id=lead_score.id,
                previous_total_score=previous_score,
                new_total_score=lead_score.total_score,
                score_change=lead_score.total_score - previous_score,
                trigger_event=trigger_event,
                trigger_details={'timestamp': datetime.utcnow().isoformat()}
            )
            self.db.add(history)
        
        await self.db.commit()
        
        # Check segment membership after score update
        await self._update_segment_memberships(lead_id, workspace_id)
        
        return lead_score
    
    async def _calculate_engagement_score(
        self, 
        lead: Lead, 
        scoring_rule: ScoringRule
    ) -> int:
        """Calculate engagement score based on email interactions."""
        score = 0
        max_score = 100
        
        # Get email engagement metrics
        opens = await self._count_email_opens(lead)
        clicks = await self._count_email_clicks(lead)
        replies = await self._count_email_replies(lead)
        
        # Apply weights
        score += min(opens * scoring_rule.email_open_weight, max_score * 0.3)
        score += min(clicks * scoring_rule.email_click_weight, max_score * 0.3)
        score += min(replies * scoring_rule.email_reply_weight, max_score * 0.4)
        
        # Apply time decay if enabled
        if scoring_rule.enable_time_decay:
            last_engagement = await self._get_last_engagement_date(lead)
            if last_engagement:
                days_since = (datetime.utcnow() - last_engagement).days
                decay_factor = 0.5 ** (days_since / scoring_rule.decay_half_life_days)
                score *= decay_factor
        
        return min(int(score), max_score)
    
    async def _calculate_quality_score(
        self, 
        lead: Lead, 
        scoring_rule: ScoringRule
    ) -> int:
        """Calculate quality score based on lead profile."""
        score = 0
        
        # Profile completeness (40 points max)
        completeness = self._calculate_profile_completeness_percentage(lead)
        score += int(completeness * 0.4)
        
        # Email validity (20 points)
        if lead.email_status == 'valid':
            score += 20
        elif lead.email_status == 'catch_all':
            score += 10
            
        # Company fit (20 points)
        company_fit = await self._calculate_company_fit_points(lead, scoring_rule)
        score += min(company_fit, 20)
        
        # Enrichment confidence (20 points)
        if lead.enrichment_confidence:
            score += int(lead.enrichment_confidence * 20)
            
        return min(score, 100)
    
    async def _calculate_intent_score(
        self, 
        lead: Lead, 
        scoring_rule: ScoringRule
    ) -> int:
        """Calculate intent score based on behavior patterns."""
        score = 0
        
        # Recent engagement frequency
        recent_activities = await self._get_recent_activities(lead.id, days=7)
        if len(recent_activities) >= 3:
            score += 40
        elif len(recent_activities) >= 1:
            score += 20
            
        # Multiple email opens (shows interest)
        opens = await self._count_email_opens(lead)
        if opens >= 5:
            score += 30
        elif opens >= 3:
            score += 15
            
        # Click-through behavior
        clicks = await self._count_email_clicks(lead)
        if clicks > 0:
            score += 30
            
        return min(score, 100)
    
    def _calculate_grade(self, total_score: int, scoring_rule: ScoringRule) -> str:
        """Convert numeric score to letter grade."""
        thresholds = scoring_rule.grade_thresholds
        
        if total_score >= thresholds.get('A+', 90):
            return 'A+'
        elif total_score >= thresholds.get('A', 80):
            return 'A'
        elif total_score >= thresholds.get('B+', 70):
            return 'B+'
        elif total_score >= thresholds.get('B', 60):
            return 'B'
        elif total_score >= thresholds.get('C', 50):
            return 'C'
        elif total_score >= thresholds.get('D', 40):
            return 'D'
        else:
            return 'F'
    
    def _calculate_temperature(self, total_score: int, engagement_score: int) -> str:
        """Calculate lead temperature based on scores."""
        # Consider both total score and recent engagement
        combined = (total_score + engagement_score) / 2
        
        if combined >= 75:
            return 'hot'
        elif combined >= 50:
            return 'warm'
        elif combined >= 25:
            return 'cool'
        else:
            return 'cold'
    
    async def create_segment(
        self,
        workspace_id: str,
        name: str,
        type: SegmentType,
        rules: Optional[List[Dict]] = None,
        **kwargs
    ) -> Segment:
        """Create a new segment."""
        segment = Segment(
            workspace_id=workspace_id,
            name=name,
            type=type,
            rules=rules or [],
            **kwargs
        )
        self.db.add(segment)
        await self.db.commit()
        
        # Calculate initial membership if dynamic
        if type == SegmentType.DYNAMIC:
            await self._calculate_segment_membership(segment)
            
        return segment
    
    async def update_segment(
        self,
        segment_id: str,
        **updates
    ) -> Segment:
        """Update segment configuration."""
        segment = await self.db.get(Segment, segment_id)
        if not segment:
            raise ValueError(f"Segment {segment_id} not found")
            
        for key, value in updates.items():
            setattr(segment, key, value)
            
        await self.db.commit()
        
        # Recalculate membership if rules changed
        if 'rules' in updates and segment.type == SegmentType.DYNAMIC:
            await self._calculate_segment_membership(segment)
            
        return segment
    
    async def add_to_segment(
        self,
        segment_id: str,
        lead_ids: List[str],
        added_by: str = "manual"
    ) -> int:
        """Manually add leads to a segment."""
        segment = await self.db.get(Segment, segment_id)
        if not segment:
            raise ValueError(f"Segment {segment_id} not found")
            
        added_count = 0
        for lead_id in lead_ids:
            # Check if already member
            existing = await self.db.execute(
                select(SegmentMember).where(
                    and_(
                        SegmentMember.segment_id == segment_id,
                        SegmentMember.lead_id == lead_id
                    )
                )
            )
            if not existing.scalar_one_or_none():
                member = SegmentMember(
                    segment_id=segment_id,
                    lead_id=lead_id,
                    added_by=added_by
                )
                self.db.add(member)
                added_count += 1
                
        # Update member count
        segment.member_count = await self._count_segment_members(segment_id)
        
        await self.db.commit()
        return added_count
    
    async def remove_from_segment(
        self,
        segment_id: str,
        lead_ids: List[str]
    ) -> int:
        """Remove leads from a segment."""
        result = await self.db.execute(
            select(SegmentMember).where(
                and_(
                    SegmentMember.segment_id == segment_id,
                    SegmentMember.lead_id.in_(lead_ids)
                )
            )
        )
        
        removed_count = 0
        for member in result.scalars():
            await self.db.delete(member)
            removed_count += 1
            
        # Update member count
        segment = await self.db.get(Segment, segment_id)
        segment.member_count = await self._count_segment_members(segment_id)
        
        await self.db.commit()
        return removed_count
    
    @cache_result(ttl=300, namespace="segments")
    async def get_workspace_segments(
        self,
        workspace_id: str,
        status: Optional[SegmentStatus] = None,
        limit: int = 50
    ) -> List[Segment]:
        """Get segments for a workspace."""
        query = select(Segment).where(Segment.workspace_id == workspace_id)
        
        if status:
            query = query.where(Segment.status == status)
            
        query = query.order_by(Segment.created_at.desc()).limit(limit)
        
        result = await self.db.execute(query)
        return result.scalars().all()
    
    @cache_result(ttl=300, namespace="lead_segments")
    async def get_lead_segments(
        self,
        lead_id: str
    ) -> List[Segment]:
        """Get all segments a lead belongs to."""
        query = (
            select(Segment)
            .join(SegmentMember)
            .where(SegmentMember.lead_id == lead_id)
            .order_by(Segment.name)
        )
        
        result = await self.db.execute(query)
        return result.scalars().all()
    
    async def _calculate_segment_membership(
        self,
        segment: Segment
    ) -> int:
        """Calculate which leads belong to a dynamic segment."""
        if segment.type != SegmentType.DYNAMIC:
            return 0
            
        # Clear existing dynamic memberships
        await self.db.execute(
            select(SegmentMember).where(
                and_(
                    SegmentMember.segment_id == segment.id,
                    SegmentMember.added_by == 'system'
                )
            )
        )
        
        # Build query based on rules
        leads_query = await self._build_segment_query(segment)
        result = await self.db.execute(leads_query)
        leads = result.scalars().all()
        
        # Add qualifying leads
        for lead in leads:
            member = SegmentMember(
                segment_id=segment.id,
                lead_id=lead.id,
                added_by='system',
                matched_rules=segment.rules
            )
            self.db.add(member)
            
        # Update counts
        segment.member_count = len(leads)
        segment.last_calculated_at = datetime.utcnow()
        
        await self.db.commit()
        return len(leads)
    
    async def _build_segment_query(self, segment: Segment):
        """Build SQLAlchemy query from segment rules."""
        query = select(Lead).where(Lead.workspace_id == segment.workspace_id)
        
        # Parse rules and build conditions
        conditions = []
        for rule in segment.rules:
            condition = await self._build_rule_condition(rule)
            if condition is not None:
                conditions.append(condition)
                
        # Apply match type
        if segment.rule_match_type == 'all':
            query = query.where(and_(*conditions))
        else:
            query = query.where(or_(*conditions))
            
        return query
    
    async def _build_rule_condition(self, rule: Dict) -> Any:
        """Build SQLAlchemy condition from rule."""
        field = rule.get('field_name')
        operator = rule.get('operator')
        value = rule.get('value')
        
        # Map field names to model attributes
        field_map = {
            'email': Lead.email,
            'first_name': Lead.first_name,
            'last_name': Lead.last_name,
            'company': Lead.company,
            'lead_score': LeadScore.total_score,
            'grade': LeadScore.grade,
            'temperature': LeadScore.temperature,
            'created_at': Lead.created_at
        }
        
        field_attr = field_map.get(field)
        if not field_attr:
            return None
            
        # Build condition based on operator
        if operator == RuleOperator.EQUALS.value:
            return field_attr == value
        elif operator == RuleOperator.NOT_EQUALS.value:
            return field_attr != value
        elif operator == RuleOperator.CONTAINS.value:
            return field_attr.contains(value)
        elif operator == RuleOperator.NOT_CONTAINS.value:
            return ~field_attr.contains(value)
        elif operator == RuleOperator.GREATER_THAN.value:
            return field_attr > value
        elif operator == RuleOperator.LESS_THAN.value:
            return field_attr < value
        elif operator == RuleOperator.IN.value:
            return field_attr.in_(value)
        elif operator == RuleOperator.IS_EMPTY.value:
            return or_(field_attr == None, field_attr == '')
        elif operator == RuleOperator.IS_NOT_EMPTY.value:
            return and_(field_attr != None, field_attr != '')
            
        return None
    
    async def _update_segment_memberships(
        self,
        lead_id: str,
        workspace_id: str
    ):
        """Update segment memberships after lead score change."""
        # Get all dynamic segments for workspace
        segments = await self.get_workspace_segments(
            workspace_id,
            status=SegmentStatus.ACTIVE
        )
        
        for segment in segments:
            if segment.type != SegmentType.DYNAMIC:
                continue
                
            # Check if lead qualifies
            qualifies = await self._check_lead_qualifies_for_segment(lead_id, segment)
            
            # Get current membership
            existing = await self.db.execute(
                select(SegmentMember).where(
                    and_(
                        SegmentMember.segment_id == segment.id,
                        SegmentMember.lead_id == lead_id
                    )
                )
            )
            member = existing.scalar_one_or_none()
            
            if qualifies and not member:
                # Add to segment
                new_member = SegmentMember(
                    segment_id=segment.id,
                    lead_id=lead_id,
                    added_by='system'
                )
                self.db.add(new_member)
            elif not qualifies and member and member.added_by == 'system':
                # Remove from segment (only if added by system)
                await self.db.delete(member)
                
        await self.db.commit()
    
    # Helper methods for score calculation
    async def _get_lead_with_data(self, lead_id: str) -> Optional[Lead]:
        """Get lead with all related data."""
        result = await self.db.execute(
            select(Lead)
            .options(
                selectinload(Lead.campaign_emails),
                selectinload(Lead.enrichment_data)
            )
            .where(Lead.id == lead_id)
        )
        return result.scalar_one_or_none()
    
    async def _get_scoring_rules(self, workspace_id: str) -> ScoringRule:
        """Get or create scoring rules for workspace."""
        result = await self.db.execute(
            select(ScoringRule).where(
                and_(
                    ScoringRule.workspace_id == workspace_id,
                    ScoringRule.is_active == True
                )
            )
        )
        rule = result.scalar_one_or_none()
        
        if not rule:
            # Create default rules
            rule = ScoringRule(
                workspace_id=workspace_id,
                name="Default Scoring Rules",
                model_type=ScoringModel.ENGAGEMENT
            )
            self.db.add(rule)
            await self.db.commit()
            
        return rule
    
    async def _get_or_create_lead_score(
        self, 
        lead_id: str, 
        workspace_id: str
    ) -> LeadScore:
        """Get existing or create new lead score."""
        result = await self.db.execute(
            select(LeadScore).where(LeadScore.lead_id == lead_id)
        )
        score = result.scalar_one_or_none()
        
        if not score:
            score = LeadScore(
                lead_id=lead_id,
                workspace_id=workspace_id
            )
            self.db.add(score)
            
        return score
    
    async def _count_email_opens(self, lead: Lead) -> int:
        """Count email opens for a lead."""
        result = await self.db.execute(
            select(func.count(EmailEvent.id))
            .join(CampaignEmail)
            .where(
                and_(
                    CampaignEmail.lead_id == lead.id,
                    EmailEvent.event_type == 'opened'
                )
            )
        )
        return result.scalar() or 0
    
    async def _count_email_clicks(self, lead: Lead) -> int:
        """Count email clicks for a lead."""
        result = await self.db.execute(
            select(func.count(EmailEvent.id))
            .join(CampaignEmail)
            .where(
                and_(
                    CampaignEmail.lead_id == lead.id,
                    EmailEvent.event_type == 'clicked'
                )
            )
        )
        return result.scalar() or 0
    
    async def _count_email_replies(self, lead: Lead) -> int:
        """Count email replies for a lead."""
        result = await self.db.execute(
            select(func.count(EmailEvent.id))
            .join(CampaignEmail)
            .where(
                and_(
                    CampaignEmail.lead_id == lead.id,
                    EmailEvent.event_type == 'replied'
                )
            )
        )
        return result.scalar() or 0
    
    async def _get_last_engagement_date(self, lead: Lead) -> Optional[datetime]:
        """Get date of last engagement."""
        result = await self.db.execute(
            select(func.max(EmailEvent.created_at))
            .join(CampaignEmail)
            .where(
                and_(
                    CampaignEmail.lead_id == lead.id,
                    EmailEvent.event_type.in_(['opened', 'clicked', 'replied'])
                )
            )
        )
        return result.scalar()
    
    async def _get_recent_activities(
        self, 
        lead_id: str, 
        days: int = 7
    ) -> List[LeadActivity]:
        """Get recent activities for a lead."""
        since = datetime.utcnow() - timedelta(days=days)
        result = await self.db.execute(
            select(LeadActivity)
            .where(
                and_(
                    LeadActivity.lead_id == lead_id,
                    LeadActivity.occurred_at >= since
                )
            )
            .order_by(LeadActivity.occurred_at.desc())
        )
        return result.scalars().all()
    
    def _calculate_profile_completeness_percentage(self, lead: Lead) -> float:
        """Calculate how complete a lead's profile is."""
        fields = [
            lead.email,
            lead.first_name,
            lead.last_name,
            lead.company,
            lead.job_title,
            lead.phone,
            lead.linkedin_url,
            lead.company_website
        ]
        
        filled = sum(1 for field in fields if field)
        return (filled / len(fields)) * 100
    
    async def _calculate_email_points(
        self, 
        lead: Lead, 
        scoring_rule: ScoringRule
    ) -> int:
        """Calculate points from email engagement."""
        opens = await self._count_email_opens(lead)
        clicks = await self._count_email_clicks(lead)
        replies = await self._count_email_replies(lead)
        
        points = (
            opens * scoring_rule.email_open_weight +
            clicks * scoring_rule.email_click_weight +
            replies * scoring_rule.email_reply_weight
        )
        
        return int(min(points, 100))
    
    def _calculate_profile_points(self, lead: Lead) -> int:
        """Calculate points from profile completeness."""
        return int(self._calculate_profile_completeness_percentage(lead))
    
    async def _calculate_company_fit_points(
        self, 
        lead: Lead, 
        scoring_rule: ScoringRule
    ) -> int:
        """Calculate company fit points based on rules."""
        if not scoring_rule.company_fit_rules:
            return 50  # Default middle score
            
        points = 0
        rules = scoring_rule.company_fit_rules
        
        # Example company fit criteria
        if lead.company_size:
            if lead.company_size in rules.get('ideal_company_sizes', []):
                points += 30
            elif lead.company_size in rules.get('acceptable_company_sizes', []):
                points += 15
                
        if lead.industry:
            if lead.industry in rules.get('target_industries', []):
                points += 40
            elif lead.industry in rules.get('acceptable_industries', []):
                points += 20
                
        if lead.company_revenue:
            revenue_range = rules.get('revenue_range', {})
            if revenue_range.get('min', 0) <= lead.company_revenue <= revenue_range.get('max', float('inf')):
                points += 30
                
        return min(points, 100)
    
    async def _calculate_behavior_points(
        self, 
        lead: Lead, 
        scoring_rule: ScoringRule
    ) -> int:
        """Calculate points from behavior patterns."""
        points = 0
        
        # Multiple opens of same email (shows interest)
        email_open_counts = await self._get_email_open_counts(lead.id)
        for count in email_open_counts.values():
            if count >= 3:
                points += 10
            elif count >= 2:
                points += 5
                
        # Quick response time
        response_times = await self._get_response_times(lead.id)
        if response_times:
            avg_response_time = statistics.mean(response_times)
            if avg_response_time < 3600:  # Within 1 hour
                points += 20
            elif avg_response_time < 86400:  # Within 1 day
                points += 10
                
        return min(points, 100)
    
    async def _calculate_recency_points(
        self, 
        lead: Lead, 
        scoring_rule: ScoringRule
    ) -> int:
        """Calculate points based on recency of engagement."""
        last_engagement = await self._get_last_engagement_date(lead)
        if not last_engagement:
            return 0
            
        days_since = (datetime.utcnow() - last_engagement).days
        
        if days_since <= 1:
            return 100
        elif days_since <= 7:
            return 80
        elif days_since <= 14:
            return 60
        elif days_since <= 30:
            return 40
        elif days_since <= 60:
            return 20
        else:
            return 0
    
    async def _get_email_open_counts(self, lead_id: str) -> Dict[str, int]:
        """Get count of opens per email."""
        result = await self.db.execute(
            select(
                CampaignEmail.id,
                func.count(EmailEvent.id).label('open_count')
            )
            .join(EmailEvent)
            .where(
                and_(
                    CampaignEmail.lead_id == lead_id,
                    EmailEvent.event_type == 'opened'
                )
            )
            .group_by(CampaignEmail.id)
        )
        
        return {str(row[0]): row[1] for row in result}
    
    async def _get_response_times(self, lead_id: str) -> List[float]:
        """Get response times in seconds."""
        # This would calculate time between email sent and reply
        # For now, return empty list
        return []
    
    async def _count_segment_members(self, segment_id: str) -> int:
        """Count members in a segment."""
        result = await self.db.execute(
            select(func.count(SegmentMember.id))
            .where(SegmentMember.segment_id == segment_id)
        )
        return result.scalar() or 0
    
    async def _check_lead_qualifies_for_segment(
        self, 
        lead_id: str, 
        segment: Segment
    ) -> bool:
        """Check if a lead qualifies for a segment."""
        # Build and execute query for single lead
        query = await self._build_segment_query(segment)
        query = query.where(Lead.id == lead_id)
        
        result = await self.db.execute(query)
        return result.scalar_one_or_none() is not None