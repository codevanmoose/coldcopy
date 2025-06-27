"""
AI Reply Assistant service for intelligent email responses.
"""
import json
import re
from typing import List, Dict, Optional, Tuple, Any
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, and_, or_, func
from sqlalchemy.orm import selectinload
import openai
import anthropic
from langchain.text_splitter import RecursiveCharacterTextSplitter

from ..models.reply_assistant import (
    ReplyTemplate, ReplyAnalysis, AISuggestedReply, ReplyWorkflow,
    ConversationContext, ReplyTone, ReplyIntent, ReplyLength
)
from ..models.lead import Lead
from ..models.campaign import Campaign
from ..models.email_messages import EmailMessage
from ..utils.cache_decorators import cache_result
from ..core.config import settings


class ReplyAssistantService:
    """Service for AI-powered reply assistance."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self.openai_client = openai.AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        self.anthropic_client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
        
    async def analyze_reply(
        self,
        email_message_id: str,
        workspace_id: str
    ) -> ReplyAnalysis:
        """Analyze an incoming reply for intent and context."""
        
        # Get email message with full context
        message = await self._get_message_with_context(email_message_id)
        if not message:
            raise ValueError(f"Email message {email_message_id} not found")
            
        # Get conversation history
        conversation_history = await self._get_conversation_history(
            message.lead_id,
            message.campaign_id
        )
        
        # Prepare context for AI analysis
        analysis_prompt = self._build_analysis_prompt(message, conversation_history)
        
        # Perform AI analysis
        try:
            response = await self.openai_client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": self._get_analysis_system_prompt()},
                    {"role": "user", "content": analysis_prompt}
                ],
                temperature=0.3,
                response_format={"type": "json_object"}
            )
            
            analysis_data = json.loads(response.choices[0].message.content)
            
        except Exception as e:
            # Fallback to basic analysis
            analysis_data = self._basic_intent_detection(message.content)
            
        # Create analysis record
        analysis = ReplyAnalysis(
            email_message_id=email_message_id,
            detected_intent=ReplyIntent(analysis_data.get('intent', 'other')),
            intent_confidence=analysis_data.get('confidence', 0.5),
            sentiment_score=analysis_data.get('sentiment', 0),
            extracted_entities=analysis_data.get('entities', {}),
            key_phrases=analysis_data.get('key_phrases', []),
            questions_detected=analysis_data.get('questions', []),
            requires_action=analysis_data.get('requires_action', False),
            urgency_level=analysis_data.get('urgency', 1),
            language_detected=analysis_data.get('language', 'en'),
            suggested_reply_tone=ReplyTone(analysis_data.get('suggested_tone', 'professional')),
            suggested_reply_length=ReplyLength(analysis_data.get('suggested_length', 'medium')),
            suggested_next_steps=analysis_data.get('next_steps', [])
        )
        
        self.db.add(analysis)
        await self.db.commit()
        
        # Update conversation context
        await self._update_conversation_context(message, analysis)
        
        return analysis
    
    async def generate_reply_suggestions(
        self,
        email_message_id: str,
        num_suggestions: int = 3,
        custom_instructions: Optional[str] = None
    ) -> List[AISuggestedReply]:
        """Generate AI-powered reply suggestions."""
        
        # Get message and analysis
        message = await self._get_message_with_context(email_message_id)
        analysis = await self._get_or_create_analysis(email_message_id, message.workspace_id)
        
        # Get relevant templates
        templates = await self._get_relevant_templates(
            message.workspace_id,
            analysis.detected_intent
        )
        
        # Get conversation context
        context = await self._get_conversation_context(message.lead_id, message.campaign_id)
        
        # Generate suggestions with different tones/approaches
        suggestions = []
        tones = [ReplyTone.PROFESSIONAL, ReplyTone.FRIENDLY, ReplyTone.CASUAL]
        
        for i, tone in enumerate(tones[:num_suggestions]):
            suggestion = await self._generate_single_suggestion(
                message,
                analysis,
                context,
                tone,
                templates[i] if i < len(templates) else None,
                custom_instructions
            )
            suggestions.append(suggestion)
            
        return suggestions
    
    async def _generate_single_suggestion(
        self,
        message: EmailMessage,
        analysis: ReplyAnalysis,
        context: ConversationContext,
        tone: ReplyTone,
        template: Optional[ReplyTemplate],
        custom_instructions: Optional[str]
    ) -> AISuggestedReply:
        """Generate a single reply suggestion."""
        
        # Build prompt
        prompt = self._build_reply_prompt(
            message,
            analysis,
            context,
            tone,
            template,
            custom_instructions
        )
        
        # Determine model based on complexity
        model = "gpt-4" if analysis.urgency_level >= 4 else "gpt-3.5-turbo"
        
        # Generate reply
        try:
            response = await self.openai_client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": self._get_reply_system_prompt(tone)},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=500
            )
            
            suggestion_text = response.choices[0].message.content.strip()
            prompt_tokens = response.usage.prompt_tokens
            completion_tokens = response.usage.completion_tokens
            
        except Exception as e:
            # Fallback to template if available
            if template:
                suggestion_text = self._populate_template(template, message, context)
            else:
                suggestion_text = self._get_fallback_reply(analysis.detected_intent)
            prompt_tokens = 0
            completion_tokens = 0
            
        # Calculate confidence based on analysis confidence and template match
        confidence = analysis.intent_confidence
        if template:
            confidence = min(confidence + 0.2, 1.0)
            
        # Create suggestion record
        suggestion = AISuggestedReply(
            email_message_id=message.id,
            reply_analysis_id=analysis.id,
            suggestion_text=suggestion_text,
            tone=tone,
            length=self._calculate_reply_length(suggestion_text),
            confidence_score=confidence,
            model_used=model,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            personalization_factors={
                'lead_name': message.lead.first_name,
                'company': message.lead.company,
                'intent': analysis.detected_intent.value,
                'context_used': bool(context.thread_summary)
            },
            template_id=template.id if template else None
        )
        
        self.db.add(suggestion)
        await self.db.commit()
        
        return suggestion
    
    async def apply_workflow(
        self,
        email_message_id: str,
        workflow_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Apply an automated workflow based on reply intent."""
        
        # Get analysis
        analysis = await self._get_analysis(email_message_id)
        if not analysis:
            raise ValueError("Reply must be analyzed first")
            
        # Get applicable workflow
        if workflow_id:
            workflow = await self.db.get(ReplyWorkflow, workflow_id)
        else:
            workflow = await self._get_matching_workflow(
                analysis.email_message.workspace_id,
                analysis.detected_intent
            )
            
        if not workflow:
            return {"status": "no_workflow_found"}
            
        # Execute workflow steps
        results = []
        for step in workflow.workflow_steps:
            result = await self._execute_workflow_step(
                step,
                email_message_id,
                analysis
            )
            results.append(result)
            
            # Stop on failure unless configured to continue
            if not result.get('success') and not step.get('continue_on_failure'):
                break
                
        # Update workflow metrics
        workflow.execution_count += 1
        if all(r.get('success') for r in results):
            workflow.success_count += 1
            
        await self.db.commit()
        
        return {
            "workflow_id": workflow.id,
            "workflow_name": workflow.name,
            "steps_executed": len(results),
            "results": results
        }
    
    async def optimize_reply_performance(
        self,
        workspace_id: str,
        intent_type: ReplyIntent,
        days: int = 30
    ) -> Dict[str, Any]:
        """Analyze and optimize reply performance."""
        
        # Get recent suggestions and their outcomes
        since_date = datetime.utcnow() - timedelta(days=days)
        
        result = await self.db.execute(
            select(
                AISuggestedReply.tone,
                AISuggestedReply.length,
                func.count(AISuggestedReply.id).label('total'),
                func.sum(
                    func.cast(AISuggestedReply.was_selected, Integer)
                ).label('selected'),
                func.sum(
                    func.cast(AISuggestedReply.led_to_positive_response, Integer)
                ).label('positive'),
                func.avg(AISuggestedReply.response_time_hours).label('avg_response_time')
            )
            .join(ReplyAnalysis)
            .join(EmailMessage)
            .where(
                and_(
                    EmailMessage.workspace_id == workspace_id,
                    ReplyAnalysis.detected_intent == intent_type,
                    AISuggestedReply.generated_at >= since_date
                )
            )
            .group_by(AISuggestedReply.tone, AISuggestedReply.length)
        )
        
        performance_data = []
        for row in result:
            performance_data.append({
                'tone': row.tone,
                'length': row.length,
                'total_suggestions': row.total,
                'selection_rate': row.selected / row.total if row.total > 0 else 0,
                'success_rate': row.positive / row.selected if row.selected > 0 else 0,
                'avg_response_time': row.avg_response_time
            })
            
        # Identify best performing combination
        best_performer = max(
            performance_data,
            key=lambda x: x['success_rate'] * x['selection_rate']
        ) if performance_data else None
        
        # Get template performance
        template_performance = await self._analyze_template_performance(
            workspace_id,
            intent_type,
            since_date
        )
        
        return {
            'intent_type': intent_type.value,
            'analysis_period_days': days,
            'performance_by_variant': performance_data,
            'best_performer': best_performer,
            'template_performance': template_performance,
            'recommendations': self._generate_optimization_recommendations(
                performance_data,
                template_performance
            )
        }
    
    @cache_result(ttl=300, namespace="reply_templates")
    async def get_workspace_templates(
        self,
        workspace_id: str,
        intent: Optional[ReplyIntent] = None,
        active_only: bool = True
    ) -> List[ReplyTemplate]:
        """Get reply templates for a workspace."""
        
        query = select(ReplyTemplate).where(
            ReplyTemplate.workspace_id == workspace_id
        )
        
        if intent:
            query = query.where(ReplyTemplate.intent == intent)
            
        if active_only:
            query = query.where(ReplyTemplate.is_active == True)
            
        query = query.order_by(ReplyTemplate.usage_count.desc())
        
        result = await self.db.execute(query)
        return result.scalars().all()
    
    async def create_template(
        self,
        workspace_id: str,
        name: str,
        intent: ReplyIntent,
        template_text: str,
        tone: ReplyTone = ReplyTone.PROFESSIONAL,
        variables: Optional[List[str]] = None,
        created_by: Optional[str] = None
    ) -> ReplyTemplate:
        """Create a new reply template."""
        
        # Extract variables from template if not provided
        if not variables:
            variables = self._extract_template_variables(template_text)
            
        template = ReplyTemplate(
            workspace_id=workspace_id,
            name=name,
            intent=intent,
            tone=tone,
            template_text=template_text,
            variables=variables,
            created_by=created_by
        )
        
        self.db.add(template)
        await self.db.commit()
        
        return template
    
    # Helper methods
    
    def _get_analysis_system_prompt(self) -> str:
        """System prompt for reply analysis."""
        return """You are an expert email communication analyst. Analyze the email reply and provide structured insights.

Your response must be valid JSON with the following structure:
{
    "intent": "interested|not_interested|needs_info|scheduling|objection|referral|unsubscribe|other",
    "confidence": 0.0-1.0,
    "sentiment": -1.0 to 1.0,
    "entities": {
        "people": [],
        "companies": [],
        "dates": [],
        "products": []
    },
    "key_phrases": [],
    "questions": [],
    "requires_action": true|false,
    "urgency": 1-5,
    "language": "en",
    "suggested_tone": "professional|friendly|casual|formal|enthusiastic|empathetic",
    "suggested_length": "short|medium|long",
    "next_steps": []
}

Be accurate in intent detection and extract all relevant information."""
    
    def _get_reply_system_prompt(self, tone: ReplyTone) -> str:
        """System prompt for reply generation."""
        tone_guidelines = {
            ReplyTone.PROFESSIONAL: "Be professional, courteous, and business-focused.",
            ReplyTone.FRIENDLY: "Be warm, approachable, and personable while maintaining professionalism.",
            ReplyTone.CASUAL: "Be relaxed and conversational, like talking to a colleague.",
            ReplyTone.FORMAL: "Be formal, respectful, and use proper business etiquette.",
            ReplyTone.ENTHUSIASTIC: "Be energetic, positive, and show genuine excitement.",
            ReplyTone.EMPATHETIC: "Be understanding, compassionate, and acknowledge their perspective."
        }
        
        return f"""You are an expert sales communication specialist. Generate a reply that:

1. Directly addresses all questions and concerns raised
2. Maintains the conversation momentum toward the desired outcome
3. {tone_guidelines.get(tone, tone_guidelines[ReplyTone.PROFESSIONAL])}
4. Is concise and scannable
5. Includes a clear call-to-action when appropriate
6. Personalizes based on available context
7. Avoids jargon and overly salesy language

Focus on building genuine rapport and providing value."""
    
    def _build_analysis_prompt(
        self,
        message: EmailMessage,
        conversation_history: List[EmailMessage]
    ) -> str:
        """Build prompt for reply analysis."""
        
        context_parts = [
            f"Lead: {message.lead.first_name} {message.lead.last_name} from {message.lead.company}",
            f"Campaign: {message.campaign.name}",
            f"\nConversation History ({len(conversation_history)} messages):"
        ]
        
        for hist_msg in conversation_history[-5:]:  # Last 5 messages
            direction = "Sent" if hist_msg.direction == "outbound" else "Received"
            context_parts.append(f"\n{direction}: {hist_msg.content[:200]}...")
            
        context_parts.append(f"\n\nLatest Reply to Analyze:\n{message.content}")
        
        return "\n".join(context_parts)
    
    def _build_reply_prompt(
        self,
        message: EmailMessage,
        analysis: ReplyAnalysis,
        context: Optional[ConversationContext],
        tone: ReplyTone,
        template: Optional[ReplyTemplate],
        custom_instructions: Optional[str]
    ) -> str:
        """Build prompt for reply generation."""
        
        prompt_parts = [
            f"Generate a {tone.value} reply to this email:",
            f"\nLead: {message.lead.first_name} {message.lead.last_name}",
            f"Company: {message.lead.company}",
            f"Their Intent: {analysis.detected_intent.value}",
            f"Sentiment: {'Positive' if analysis.sentiment_score > 0 else 'Negative' if analysis.sentiment_score < 0 else 'Neutral'}",
        ]
        
        if analysis.questions_detected:
            prompt_parts.append(f"\nQuestions to answer: {', '.join(analysis.questions_detected)}")
            
        if context and context.thread_summary:
            prompt_parts.append(f"\nConversation context: {context.thread_summary}")
            
        if template:
            prompt_parts.append(f"\nUse this as inspiration: {template.template_text}")
            
        if custom_instructions:
            prompt_parts.append(f"\nAdditional instructions: {custom_instructions}")
            
        prompt_parts.append(f"\n\nTheir message:\n{message.content}")
        
        return "\n".join(prompt_parts)
    
    def _calculate_reply_length(self, text: str) -> ReplyLength:
        """Calculate reply length category."""
        sentences = len(re.findall(r'[.!?]+', text))
        
        if sentences <= 2:
            return ReplyLength.SHORT
        elif sentences <= 5:
            return ReplyLength.MEDIUM
        else:
            return ReplyLength.LONG
    
    def _basic_intent_detection(self, content: str) -> Dict[str, Any]:
        """Basic rule-based intent detection as fallback."""
        content_lower = content.lower()
        
        # Simple keyword matching
        if any(word in content_lower for word in ['interested', 'yes', 'definitely', 'love to']):
            intent = ReplyIntent.INTERESTED
            confidence = 0.7
        elif any(word in content_lower for word in ['not interested', 'no thanks', 'pass']):
            intent = ReplyIntent.NOT_INTERESTED
            confidence = 0.8
        elif any(word in content_lower for word in ['unsubscribe', 'remove me', 'stop']):
            intent = ReplyIntent.UNSUBSCRIBE
            confidence = 0.9
        elif any(word in content_lower for word in ['when', 'schedule', 'calendar', 'meet']):
            intent = ReplyIntent.SCHEDULING
            confidence = 0.6
        elif '?' in content:
            intent = ReplyIntent.NEEDS_INFO
            confidence = 0.5
        else:
            intent = ReplyIntent.OTHER
            confidence = 0.3
            
        return {
            'intent': intent.value,
            'confidence': confidence,
            'sentiment': 0,
            'entities': {},
            'key_phrases': [],
            'questions': re.findall(r'[^.!?]*\?', content),
            'requires_action': True,
            'urgency': 2,
            'language': 'en',
            'suggested_tone': 'professional',
            'suggested_length': 'medium',
            'next_steps': []
        }
    
    async def _get_message_with_context(self, email_message_id: str) -> Optional[EmailMessage]:
        """Get email message with full context."""
        result = await self.db.execute(
            select(EmailMessage)
            .options(
                selectinload(EmailMessage.lead),
                selectinload(EmailMessage.campaign)
            )
            .where(EmailMessage.id == email_message_id)
        )
        return result.scalar_one_or_none()
    
    async def _get_conversation_history(
        self,
        lead_id: str,
        campaign_id: str,
        limit: int = 10
    ) -> List[EmailMessage]:
        """Get conversation history between lead and campaign."""
        result = await self.db.execute(
            select(EmailMessage)
            .where(
                and_(
                    EmailMessage.lead_id == lead_id,
                    EmailMessage.campaign_id == campaign_id
                )
            )
            .order_by(EmailMessage.created_at.desc())
            .limit(limit)
        )
        return list(reversed(result.scalars().all()))
    
    async def _get_or_create_analysis(
        self,
        email_message_id: str,
        workspace_id: str
    ) -> ReplyAnalysis:
        """Get existing analysis or create new one."""
        result = await self.db.execute(
            select(ReplyAnalysis).where(
                ReplyAnalysis.email_message_id == email_message_id
            )
        )
        analysis = result.scalar_one_or_none()
        
        if not analysis:
            analysis = await self.analyze_reply(email_message_id, workspace_id)
            
        return analysis
    
    async def _get_relevant_templates(
        self,
        workspace_id: str,
        intent: ReplyIntent,
        limit: int = 5
    ) -> List[ReplyTemplate]:
        """Get relevant templates for the intent."""
        return await self.get_workspace_templates(
            workspace_id,
            intent,
            active_only=True
        )
    
    async def _get_conversation_context(
        self,
        lead_id: str,
        campaign_id: str
    ) -> Optional[ConversationContext]:
        """Get or create conversation context."""
        result = await self.db.execute(
            select(ConversationContext).where(
                and_(
                    ConversationContext.lead_id == lead_id,
                    ConversationContext.campaign_id == campaign_id
                )
            )
        )
        context = result.scalar_one_or_none()
        
        if not context:
            context = ConversationContext(
                lead_id=lead_id,
                campaign_id=campaign_id,
                message_count=0
            )
            self.db.add(context)
            
        return context
    
    def _populate_template(
        self,
        template: ReplyTemplate,
        message: EmailMessage,
        context: Optional[ConversationContext]
    ) -> str:
        """Populate template with actual values."""
        text = template.template_text
        
        # Replace common variables
        replacements = {
            '{first_name}': message.lead.first_name or 'there',
            '{last_name}': message.lead.last_name or '',
            '{company}': message.lead.company or 'your company',
            '{lead_name}': f"{message.lead.first_name or ''} {message.lead.last_name or ''}".strip() or 'there'
        }
        
        for var, value in replacements.items():
            text = text.replace(var, value)
            
        return text
    
    def _extract_template_variables(self, template_text: str) -> List[str]:
        """Extract variables from template text."""
        return list(set(re.findall(r'\{(\w+)\}', template_text)))
    
    async def _update_conversation_context(
        self,
        message: EmailMessage,
        analysis: ReplyAnalysis
    ):
        """Update conversation context with new insights."""
        context = await self._get_conversation_context(
            message.lead_id,
            message.campaign_id
        )
        
        # Update message count
        context.message_count += 1
        
        # Update sentiment tracking
        if analysis.sentiment_score > 0.3:
            context.positive_interactions += 1
        elif analysis.sentiment_score < -0.3:
            context.negative_interactions += 1
            
        # Extract and store key information
        if analysis.extracted_entities:
            if not context.key_topics:
                context.key_topics = []
            context.key_topics.extend(
                analysis.extracted_entities.get('products', [])
            )
            
        # Update last meaningful interaction
        if analysis.requires_action or analysis.detected_intent != ReplyIntent.OTHER:
            context.last_meaningful_interaction = datetime.utcnow()
            
        await self.db.commit()
    
    def _get_fallback_reply(self, intent: ReplyIntent) -> str:
        """Get fallback reply for each intent type."""
        fallbacks = {
            ReplyIntent.INTERESTED: "Thank you for your interest! I'd be happy to discuss this further. When would be a good time for a brief call?",
            ReplyIntent.NOT_INTERESTED: "I understand and appreciate your time. If anything changes, please don't hesitate to reach out.",
            ReplyIntent.NEEDS_INFO: "I'd be happy to provide more information. Could you let me know what specific aspects you'd like to learn more about?",
            ReplyIntent.SCHEDULING: "I have availability this week. Would Tuesday at 2 PM or Thursday at 10 AM work better for you?",
            ReplyIntent.OBJECTION: "I understand your concern. Many of our clients had similar thoughts initially. Could we discuss how we've addressed this for others in your industry?",
            ReplyIntent.REFERRAL: "Thank you for the referral! I'll be sure to mention you when I reach out. Is there anything specific I should know about their needs?",
            ReplyIntent.UNSUBSCRIBE: "You've been unsubscribed and won't receive any more emails from us. Thank you for your time.",
            ReplyIntent.OTHER: "Thank you for your message. I'll review this and get back to you shortly with a thoughtful response."
        }
        
        return fallbacks.get(intent, fallbacks[ReplyIntent.OTHER])