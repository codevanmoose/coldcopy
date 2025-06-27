"""
A/B Testing service for managing email campaign experiments.
"""
import random
import statistics
from typing import List, Dict, Optional, Tuple
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, and_, or_, func
from sqlalchemy.orm import selectinload
import numpy as np
from scipy import stats
import hashlib

from ..models.ab_testing import (
    ABTest, ABTestVariant, ABTestRecipient, ABTestResult,
    TestType, TestStatus, WinnerSelectionMethod
)
from ..models.lead import Lead
from ..models.campaign import Campaign, CampaignEmail
from ..utils.cache_decorators import cache_result, cache_invalidate


class ABTestingService:
    """Service for managing A/B tests."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def create_ab_test(
        self,
        workspace_id: str,
        campaign_id: str,
        name: str,
        test_type: TestType,
        variants_data: List[Dict],
        test_percentage: int = 20,
        confidence_threshold: float = 95.0,
        test_duration_hours: int = 24,
        winner_selection_method: WinnerSelectionMethod = WinnerSelectionMethod.OPEN_RATE
    ) -> ABTest:
        """Create a new A/B test with variants."""
        
        # Create the test
        ab_test = ABTest(
            workspace_id=workspace_id,
            campaign_id=campaign_id,
            name=name,
            test_type=test_type,
            test_percentage=test_percentage,
            confidence_threshold=confidence_threshold,
            test_duration_hours=test_duration_hours,
            winner_selection_method=winner_selection_method,
            status=TestStatus.DRAFT
        )
        self.db.add(ab_test)
        await self.db.flush()
        
        # Create variants
        total_percentage = 0
        for i, variant_data in enumerate(variants_data):
            # Calculate traffic percentage
            if i == len(variants_data) - 1:
                # Last variant gets remaining percentage
                traffic_pct = 100 - total_percentage
            else:
                traffic_pct = variant_data.get('traffic_percentage', 100 / len(variants_data))
            
            total_percentage += traffic_pct
            
            variant = ABTestVariant(
                test_id=ab_test.id,
                name=variant_data.get('name', f'Variant {chr(65 + i)}'),
                is_control=variant_data.get('is_control', i == 0),
                traffic_percentage=traffic_pct,
                subject_line=variant_data.get('subject_line'),
                preview_text=variant_data.get('preview_text'),
                from_name=variant_data.get('from_name'),
                from_email=variant_data.get('from_email'),
                email_content=variant_data.get('email_content'),
                send_time=variant_data.get('send_time')
            )
            self.db.add(variant)
        
        await self.db.commit()
        return ab_test
    
    async def start_ab_test(self, test_id: str) -> ABTest:
        """Start an A/B test."""
        # Get test with variants
        result = await self.db.execute(
            select(ABTest).options(selectinload(ABTest.variants))
            .where(ABTest.id == test_id)
        )
        ab_test = result.scalar_one()
        
        if ab_test.status != TestStatus.DRAFT:
            raise ValueError(f"Test must be in DRAFT status to start. Current: {ab_test.status}")
        
        # Update status
        ab_test.status = TestStatus.RUNNING
        ab_test.started_at = datetime.utcnow()
        
        await self.db.commit()
        return ab_test
    
    async def assign_variant(
        self,
        test_id: str,
        lead_id: str,
        deterministic: bool = True
    ) -> ABTestVariant:
        """Assign a lead to a variant."""
        
        # Check if already assigned
        existing = await self.db.execute(
            select(ABTestRecipient)
            .where(and_(
                ABTestRecipient.test_id == test_id,
                ABTestRecipient.lead_id == lead_id
            ))
        )
        if existing.scalar_one_or_none():
            return existing.scalar_one().variant
        
        # Get test with variants
        result = await self.db.execute(
            select(ABTest).options(selectinload(ABTest.variants))
            .where(ABTest.id == test_id)
        )
        ab_test = result.scalar_one()
        
        if ab_test.status != TestStatus.RUNNING:
            raise ValueError("Test must be running to assign variants")
        
        # Select variant
        if deterministic:
            # Use consistent hashing for deterministic assignment
            variant = self._deterministic_variant_selection(
                lead_id, ab_test.variants
            )
        else:
            # Random selection based on traffic percentages
            variant = self._random_variant_selection(ab_test.variants)
        
        # Create assignment
        recipient = ABTestRecipient(
            test_id=test_id,
            variant_id=variant.id,
            lead_id=lead_id
        )
        self.db.add(recipient)
        
        # Update variant recipient count
        variant.recipients_count += 1
        
        await self.db.commit()
        return variant
    
    def _deterministic_variant_selection(
        self,
        lead_id: str,
        variants: List[ABTestVariant]
    ) -> ABTestVariant:
        """Select variant using consistent hashing."""
        # Create hash of lead_id
        hash_value = int(hashlib.md5(lead_id.encode()).hexdigest(), 16)
        
        # Map to percentage
        percentage = (hash_value % 10000) / 100
        
        # Find variant based on cumulative percentages
        cumulative = 0
        for variant in sorted(variants, key=lambda v: v.name):
            cumulative += variant.traffic_percentage
            if percentage < cumulative:
                return variant
        
        return variants[-1]
    
    def _random_variant_selection(
        self,
        variants: List[ABTestVariant]
    ) -> ABTestVariant:
        """Randomly select variant based on traffic percentages."""
        weights = [v.traffic_percentage for v in variants]
        return random.choices(variants, weights=weights)[0]
    
    async def update_variant_metrics(
        self,
        variant_id: str,
        email_event: Dict
    ):
        """Update variant metrics based on email events."""
        variant = await self.db.get(ABTestVariant, variant_id)
        if not variant:
            return
        
        # Update counts based on event type
        event_type = email_event.get('event_type')
        if event_type == 'sent':
            variant.sent_count += 1
        elif event_type == 'delivered':
            variant.delivered_count += 1
        elif event_type == 'opened':
            variant.opened_count += 1
        elif event_type == 'clicked':
            variant.clicked_count += 1
        elif event_type == 'replied':
            variant.replied_count += 1
        elif event_type == 'unsubscribed':
            variant.unsubscribed_count += 1
        elif event_type == 'bounced':
            variant.bounced_count += 1
        
        # Recalculate rates
        if variant.sent_count > 0:
            variant.open_rate = (variant.opened_count / variant.sent_count) * 100
            variant.click_rate = (variant.clicked_count / variant.sent_count) * 100
            variant.reply_rate = (variant.replied_count / variant.sent_count) * 100
            
            # Calculate engagement score
            variant.engagement_score = (
                variant.open_rate * 0.3 +
                variant.click_rate * 0.4 +
                variant.reply_rate * 0.3
            )
        
        await self.db.commit()
    
    async def check_test_completion(self, test_id: str) -> bool:
        """Check if test should be completed and analyze results."""
        # Get test with variants
        result = await self.db.execute(
            select(ABTest).options(selectinload(ABTest.variants))
            .where(ABTest.id == test_id)
        )
        ab_test = result.scalar_one()
        
        if ab_test.status != TestStatus.RUNNING:
            return False
        
        # Check time-based completion
        if ab_test.started_at:
            elapsed_hours = (datetime.utcnow() - ab_test.started_at).total_seconds() / 3600
            if elapsed_hours >= ab_test.test_duration_hours:
                await self._complete_test(ab_test)
                return True
        
        # Check sample size completion
        total_recipients = sum(v.recipients_count for v in ab_test.variants)
        min_per_variant = min(v.recipients_count for v in ab_test.variants)
        
        if min_per_variant >= ab_test.minimum_sample_size:
            # Check statistical significance
            if await self._check_statistical_significance(ab_test):
                await self._complete_test(ab_test)
                return True
        
        return False
    
    async def _check_statistical_significance(self, ab_test: ABTest) -> bool:
        """Check if results are statistically significant."""
        if len(ab_test.variants) != 2:
            # For now, only support two-variant tests
            return False
        
        control = next((v for v in ab_test.variants if v.is_control), ab_test.variants[0])
        variant = next((v for v in ab_test.variants if v.id != control.id), ab_test.variants[1])
        
        # Get the metric based on winner selection method
        metric_map = {
            WinnerSelectionMethod.OPEN_RATE: 'open_rate',
            WinnerSelectionMethod.CLICK_RATE: 'click_rate',
            WinnerSelectionMethod.REPLY_RATE: 'reply_rate',
            WinnerSelectionMethod.ENGAGEMENT_SCORE: 'engagement_score'
        }
        
        metric = metric_map.get(ab_test.winner_selection_method, 'open_rate')
        
        # Calculate statistical significance using chi-squared test
        control_successes = getattr(control, f"{metric.replace('_rate', '')}_count", 0)
        control_total = control.sent_count or 1
        
        variant_successes = getattr(variant, f"{metric.replace('_rate', '')}_count", 0)
        variant_total = variant.sent_count or 1
        
        # Perform chi-squared test
        contingency_table = [
            [control_successes, control_total - control_successes],
            [variant_successes, variant_total - variant_successes]
        ]
        
        chi2, p_value, _, _ = stats.chi2_contingency(contingency_table)
        
        # Update variants with statistical info
        confidence_level = (1 - p_value) * 100
        is_significant = confidence_level >= ab_test.confidence_threshold
        
        control.p_value = p_value
        control.confidence_level = confidence_level
        control.is_statistically_significant = is_significant
        
        variant.p_value = p_value
        variant.confidence_level = confidence_level
        variant.is_statistically_significant = is_significant
        
        await self.db.commit()
        
        return is_significant
    
    async def _complete_test(self, ab_test: ABTest):
        """Complete the test and determine winner."""
        # Determine winner
        winner = await self._determine_winner(ab_test)
        
        ab_test.status = TestStatus.COMPLETED
        ab_test.completed_at = datetime.utcnow()
        ab_test.winner_variant_id = winner.id if winner else None
        
        # Create result analysis
        result = await self._analyze_test_results(ab_test, winner)
        self.db.add(result)
        
        await self.db.commit()
    
    async def _determine_winner(self, ab_test: ABTest) -> Optional[ABTestVariant]:
        """Determine the winning variant."""
        if ab_test.winner_selection_method == WinnerSelectionMethod.MANUAL:
            return None
        
        # Get the metric to optimize
        metric_map = {
            WinnerSelectionMethod.OPEN_RATE: 'open_rate',
            WinnerSelectionMethod.CLICK_RATE: 'click_rate',
            WinnerSelectionMethod.REPLY_RATE: 'reply_rate',
            WinnerSelectionMethod.ENGAGEMENT_SCORE: 'engagement_score'
        }
        
        metric = metric_map.get(ab_test.winner_selection_method, 'open_rate')
        
        # Find variant with highest metric
        winner = max(ab_test.variants, key=lambda v: getattr(v, metric, 0))
        
        # Only declare winner if statistically significant
        if not winner.is_statistically_significant:
            return None
        
        return winner
    
    async def _analyze_test_results(
        self,
        ab_test: ABTest,
        winner: Optional[ABTestVariant]
    ) -> ABTestResult:
        """Analyze test results and generate insights."""
        control = next((v for v in ab_test.variants if v.is_control), ab_test.variants[0])
        
        # Calculate lift if there's a winner
        lift_percentage = 0
        if winner and winner.id != control.id:
            metric_map = {
                WinnerSelectionMethod.OPEN_RATE: 'open_rate',
                WinnerSelectionMethod.CLICK_RATE: 'click_rate',
                WinnerSelectionMethod.REPLY_RATE: 'reply_rate',
                WinnerSelectionMethod.ENGAGEMENT_SCORE: 'engagement_score'
            }
            metric = metric_map.get(ab_test.winner_selection_method, 'open_rate')
            
            control_value = getattr(control, metric, 0)
            winner_value = getattr(winner, metric, 0)
            
            if control_value > 0:
                lift_percentage = ((winner_value - control_value) / control_value) * 100
        
        # Generate insights
        insights = []
        recommendations = []
        
        # Analyze performance
        for variant in ab_test.variants:
            if variant.open_rate > 30:
                insights.append(f"{variant.name} achieved exceptional open rate of {variant.open_rate:.1f}%")
            if variant.reply_rate > 5:
                insights.append(f"{variant.name} generated high engagement with {variant.reply_rate:.1f}% reply rate")
        
        # Sample size insights
        total_recipients = sum(v.recipients_count for v in ab_test.variants)
        if total_recipients < 1000:
            recommendations.append("Consider larger sample size for more reliable results")
        
        # Time-based insights
        if ab_test.test_type == TestType.SEND_TIME:
            recommendations.append("Test send times across different days of the week")
        
        # Create result
        result = ABTestResult(
            test_id=ab_test.id,
            winner_variant_id=winner.id if winner else None,
            winner_confidence=winner.confidence_level if winner else None,
            total_recipients=total_recipients,
            test_duration_actual=int(
                (ab_test.completed_at - ab_test.started_at).total_seconds() / 3600
            ) if ab_test.started_at and ab_test.completed_at else 0,
            lift_percentage=lift_percentage,
            key_findings=insights,
            recommendations=recommendations,
            projected_impact={
                'additional_opens_per_1000': lift_percentage * 10 if lift_percentage > 0 else 0,
                'additional_replies_per_1000': lift_percentage * 2 if lift_percentage > 0 else 0
            }
        )
        
        return result
    
    @cache_result(ttl=300, namespace="ab_tests")
    async def get_workspace_tests(
        self,
        workspace_id: str,
        status: Optional[TestStatus] = None,
        limit: int = 50
    ) -> List[ABTest]:
        """Get A/B tests for a workspace."""
        query = select(ABTest).options(
            selectinload(ABTest.variants),
            selectinload(ABTest.campaign)
        ).where(ABTest.workspace_id == workspace_id)
        
        if status:
            query = query.where(ABTest.status == status)
        
        query = query.order_by(ABTest.created_at.desc()).limit(limit)
        
        result = await self.db.execute(query)
        return result.scalars().all()
    
    async def get_test_results(self, test_id: str) -> Dict:
        """Get comprehensive test results."""
        # Get test with all relationships
        result = await self.db.execute(
            select(ABTest).options(
                selectinload(ABTest.variants).selectinload(ABTestVariant.recipients),
                selectinload(ABTest.result),
                selectinload(ABTest.campaign)
            ).where(ABTest.id == test_id)
        )
        ab_test = result.scalar_one_or_none()
        
        if not ab_test:
            return None
        
        # Build comprehensive results
        return {
            'test': {
                'id': str(ab_test.id),
                'name': ab_test.name,
                'type': ab_test.test_type.value,
                'status': ab_test.status.value,
                'started_at': ab_test.started_at.isoformat() if ab_test.started_at else None,
                'completed_at': ab_test.completed_at.isoformat() if ab_test.completed_at else None,
                'confidence_threshold': ab_test.confidence_threshold,
                'winner_selection_method': ab_test.winner_selection_method.value
            },
            'variants': [
                {
                    'id': str(v.id),
                    'name': v.name,
                    'is_control': v.is_control,
                    'traffic_percentage': v.traffic_percentage,
                    'recipients_count': v.recipients_count,
                    'metrics': {
                        'sent': v.sent_count,
                        'delivered': v.delivered_count,
                        'opened': v.opened_count,
                        'clicked': v.clicked_count,
                        'replied': v.replied_count,
                        'open_rate': v.open_rate,
                        'click_rate': v.click_rate,
                        'reply_rate': v.reply_rate,
                        'engagement_score': v.engagement_score
                    },
                    'statistical_significance': {
                        'is_significant': v.is_statistically_significant,
                        'confidence_level': v.confidence_level,
                        'p_value': v.p_value
                    },
                    'is_winner': str(v.id) == str(ab_test.winner_variant_id) if ab_test.winner_variant_id else False
                }
                for v in ab_test.variants
            ],
            'result': {
                'winner_variant_id': str(ab_test.result.winner_variant_id) if ab_test.result and ab_test.result.winner_variant_id else None,
                'lift_percentage': ab_test.result.lift_percentage if ab_test.result else None,
                'key_findings': ab_test.result.key_findings if ab_test.result else [],
                'recommendations': ab_test.result.recommendations if ab_test.result else [],
                'projected_impact': ab_test.result.projected_impact if ab_test.result else {}
            } if ab_test.result else None
        }