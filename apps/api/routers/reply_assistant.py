"""
API endpoints for AI Reply Assistant.
"""
from typing import List, Optional, Dict
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field
from datetime import datetime
from uuid import UUID

from ..core.database import get_db
from ..core.security import get_current_user
from ..models.user import User
from ..models.reply_assistant import (
    ReplyTone, ReplyIntent, ReplyLength
)
from ..services.reply_assistant_service import ReplyAssistantService


router = APIRouter(prefix="/api/reply-assistant", tags=["Reply Assistant"])


# Request/Response Models
class AnalyzeReplyRequest(BaseModel):
    """Request to analyze a reply."""
    email_message_id: UUID


class ReplyAnalysisResponse(BaseModel):
    """Reply analysis response."""
    id: UUID
    detected_intent: ReplyIntent
    intent_confidence: float
    sentiment_score: float
    extracted_entities: Dict
    key_phrases: List[str]
    questions_detected: List[str]
    requires_action: bool
    urgency_level: int
    language_detected: str
    suggested_reply_tone: ReplyTone
    suggested_reply_length: ReplyLength
    suggested_next_steps: List[str]
    analyzed_at: datetime


class GenerateSuggestionsRequest(BaseModel):
    """Request to generate reply suggestions."""
    email_message_id: UUID
    num_suggestions: int = Field(3, ge=1, le=5)
    custom_instructions: Optional[str] = None
    preferred_tone: Optional[ReplyTone] = None


class ReplySuggestionResponse(BaseModel):
    """Reply suggestion response."""
    id: UUID
    suggestion_text: str
    tone: ReplyTone
    length: ReplyLength
    confidence_score: float
    model_used: str
    personalization_factors: Dict
    template_used: Optional[str] = None


class CreateTemplateRequest(BaseModel):
    """Create reply template request."""
    name: str = Field(..., max_length=255)
    description: Optional[str] = None
    intent: ReplyIntent
    tone: ReplyTone = ReplyTone.PROFESSIONAL
    template_text: str
    variables: Optional[List[str]] = None


class TemplateResponse(BaseModel):
    """Reply template response."""
    id: UUID
    name: str
    description: Optional[str]
    intent: ReplyIntent
    tone: ReplyTone
    template_text: str
    variables: List[str]
    usage_count: int
    success_rate: Optional[float]
    is_active: bool
    created_at: datetime


class WorkflowRequest(BaseModel):
    """Apply workflow request."""
    email_message_id: UUID
    workflow_id: Optional[UUID] = None
    auto_execute: bool = False


class OptimizationRequest(BaseModel):
    """Request optimization analysis."""
    intent_type: ReplyIntent
    days: int = Field(30, ge=7, le=90)


@router.post("/analyze", response_model=ReplyAnalysisResponse)
async def analyze_reply(
    request: AnalyzeReplyRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Analyze an incoming email reply."""
    service = ReplyAssistantService(db)
    
    try:
        analysis = await service.analyze_reply(
            str(request.email_message_id),
            current_user.workspace_id
        )
        
        return ReplyAnalysisResponse(
            id=analysis.id,
            detected_intent=analysis.detected_intent,
            intent_confidence=analysis.intent_confidence,
            sentiment_score=analysis.sentiment_score,
            extracted_entities=analysis.extracted_entities or {},
            key_phrases=analysis.key_phrases or [],
            questions_detected=analysis.questions_detected or [],
            requires_action=analysis.requires_action,
            urgency_level=analysis.urgency_level,
            language_detected=analysis.language_detected,
            suggested_reply_tone=analysis.suggested_reply_tone,
            suggested_reply_length=analysis.suggested_reply_length,
            suggested_next_steps=analysis.suggested_next_steps or [],
            analyzed_at=analysis.analyzed_at
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.post("/suggestions", response_model=List[ReplySuggestionResponse])
async def generate_suggestions(
    request: GenerateSuggestionsRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Generate AI-powered reply suggestions."""
    service = ReplyAssistantService(db)
    
    try:
        suggestions = await service.generate_reply_suggestions(
            str(request.email_message_id),
            request.num_suggestions,
            request.custom_instructions
        )
        
        return [
            ReplySuggestionResponse(
                id=s.id,
                suggestion_text=s.suggestion_text,
                tone=s.tone,
                length=s.length,
                confidence_score=s.confidence_score,
                model_used=s.model_used,
                personalization_factors=s.personalization_factors or {},
                template_used=s.template.name if s.template else None
            )
            for s in suggestions
        ]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate suggestions: {str(e)}"
        )


@router.post("/suggestions/{suggestion_id}/select")
async def select_suggestion(
    suggestion_id: UUID,
    edited_text: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Mark a suggestion as selected and optionally save edits."""
    from ..models.reply_assistant import AISuggestedReply
    
    suggestion = await db.get(AISuggestedReply, str(suggestion_id))
    
    if not suggestion:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Suggestion not found"
        )
    
    # Update suggestion
    suggestion.was_selected = True
    if edited_text and edited_text != suggestion.suggestion_text:
        suggestion.was_edited = True
        suggestion.final_text = edited_text
    
    suggestion.sent_at = datetime.utcnow()
    
    # Update template usage if applicable
    if suggestion.template_id:
        template = await db.get(ReplyTemplate, suggestion.template_id)
        if template:
            template.usage_count += 1
    
    await db.commit()
    
    return {
        "message": "Suggestion selected successfully",
        "final_text": edited_text or suggestion.suggestion_text
    }


@router.post("/suggestions/{suggestion_id}/feedback")
async def provide_feedback(
    suggestion_id: UUID,
    positive_response: bool,
    response_time_hours: Optional[float] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Provide feedback on suggestion effectiveness."""
    from ..models.reply_assistant import AISuggestedReply
    
    suggestion = await db.get(AISuggestedReply, str(suggestion_id))
    
    if not suggestion:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Suggestion not found"
        )
    
    # Update suggestion metrics
    suggestion.led_to_positive_response = positive_response
    if response_time_hours:
        suggestion.response_time_hours = response_time_hours
    
    # Update template success rate if applicable
    if suggestion.template_id:
        # This would require more complex calculation in production
        # tracking success/failure ratios
        pass
    
    await db.commit()
    
    return {"message": "Feedback recorded successfully"}


@router.post("/templates", response_model=TemplateResponse)
async def create_template(
    template_data: CreateTemplateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new reply template."""
    service = ReplyAssistantService(db)
    
    template = await service.create_template(
        workspace_id=current_user.workspace_id,
        name=template_data.name,
        intent=template_data.intent,
        template_text=template_data.template_text,
        tone=template_data.tone,
        variables=template_data.variables,
        created_by=current_user.id
    )
    
    return TemplateResponse(
        id=template.id,
        name=template.name,
        description=template.description,
        intent=template.intent,
        tone=template.tone,
        template_text=template.template_text,
        variables=template.variables or [],
        usage_count=template.usage_count,
        success_rate=template.success_rate,
        is_active=template.is_active,
        created_at=template.created_at
    )


@router.get("/templates", response_model=List[TemplateResponse])
async def list_templates(
    intent: Optional[ReplyIntent] = None,
    active_only: bool = True,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List reply templates for workspace."""
    service = ReplyAssistantService(db)
    
    templates = await service.get_workspace_templates(
        workspace_id=current_user.workspace_id,
        intent=intent,
        active_only=active_only
    )
    
    return [
        TemplateResponse(
            id=t.id,
            name=t.name,
            description=t.description,
            intent=t.intent,
            tone=t.tone,
            template_text=t.template_text,
            variables=t.variables or [],
            usage_count=t.usage_count,
            success_rate=t.success_rate,
            is_active=t.is_active,
            created_at=t.created_at
        )
        for t in templates
    ]


@router.put("/templates/{template_id}")
async def update_template(
    template_id: UUID,
    updates: Dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a reply template."""
    from ..models.reply_assistant import ReplyTemplate
    
    template = await db.get(ReplyTemplate, str(template_id))
    
    if not template or template.workspace_id != current_user.workspace_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found"
        )
    
    # Update allowed fields
    allowed_fields = ['name', 'description', 'tone', 'template_text', 'variables', 'is_active']
    for field, value in updates.items():
        if field in allowed_fields:
            setattr(template, field, value)
    
    await db.commit()
    
    return {"message": "Template updated successfully"}


@router.delete("/templates/{template_id}")
async def delete_template(
    template_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a reply template."""
    from ..models.reply_assistant import ReplyTemplate
    
    template = await db.get(ReplyTemplate, str(template_id))
    
    if not template or template.workspace_id != current_user.workspace_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found"
        )
    
    # Soft delete by marking inactive
    template.is_active = False
    await db.commit()
    
    return {"message": "Template deleted successfully"}


@router.post("/workflows/apply")
async def apply_workflow(
    request: WorkflowRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Apply an automated workflow to a reply."""
    service = ReplyAssistantService(db)
    
    try:
        result = await service.apply_workflow(
            str(request.email_message_id),
            str(request.workflow_id) if request.workflow_id else None
        )
        
        return result
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/workflows")
async def list_workflows(
    intent: Optional[ReplyIntent] = None,
    active_only: bool = True,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List available workflows."""
    from sqlalchemy import select, and_
    from ..models.reply_assistant import ReplyWorkflow
    
    query = select(ReplyWorkflow).where(
        ReplyWorkflow.workspace_id == current_user.workspace_id
    )
    
    if intent:
        query = query.where(ReplyWorkflow.trigger_intent == intent)
    
    if active_only:
        query = query.where(ReplyWorkflow.is_active == True)
    
    result = await db.execute(query)
    workflows = result.scalars().all()
    
    return [
        {
            "id": w.id,
            "name": w.name,
            "description": w.description,
            "trigger_intent": w.trigger_intent.value,
            "auto_execute": w.auto_execute,
            "execution_count": w.execution_count,
            "success_count": w.success_count,
            "success_rate": w.success_count / w.execution_count if w.execution_count > 0 else 0
        }
        for w in workflows
    ]


@router.post("/optimize", response_model=Dict)
async def optimize_performance(
    request: OptimizationRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Analyze and optimize reply performance."""
    service = ReplyAssistantService(db)
    
    result = await service.optimize_reply_performance(
        workspace_id=current_user.workspace_id,
        intent_type=request.intent_type,
        days=request.days
    )
    
    return result


@router.get("/conversation/{lead_id}/{campaign_id}/context")
async def get_conversation_context(
    lead_id: UUID,
    campaign_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get conversation context for a lead and campaign."""
    from sqlalchemy import select, and_
    from ..models.reply_assistant import ConversationContext
    
    result = await db.execute(
        select(ConversationContext).where(
            and_(
                ConversationContext.lead_id == str(lead_id),
                ConversationContext.campaign_id == str(campaign_id)
            )
        )
    )
    context = result.scalar_one_or_none()
    
    if not context:
        return {
            "message": "No conversation context found",
            "lead_id": str(lead_id),
            "campaign_id": str(campaign_id)
        }
    
    return {
        "thread_summary": context.thread_summary,
        "key_topics": context.key_topics or [],
        "commitments_made": context.commitments_made or [],
        "communication_preferences": context.communication_preferences or {},
        "detected_pain_points": context.detected_pain_points or [],
        "interests_expressed": context.interests_expressed or [],
        "current_stage": context.current_stage,
        "next_steps": context.next_steps or [],
        "message_count": context.message_count,
        "positive_interactions": context.positive_interactions,
        "negative_interactions": context.negative_interactions,
        "last_meaningful_interaction": context.last_meaningful_interaction.isoformat() if context.last_meaningful_interaction else None
    }


@router.get("/stats/intent-distribution")
async def get_intent_distribution(
    days: int = Query(30, ge=1, le=90),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get distribution of reply intents."""
    from sqlalchemy import select, func
    from datetime import timedelta
    from ..models.reply_assistant import ReplyAnalysis
    from ..models.email_messages import EmailMessage
    
    since_date = datetime.utcnow() - timedelta(days=days)
    
    result = await db.execute(
        select(
            ReplyAnalysis.detected_intent,
            func.count(ReplyAnalysis.id).label('count'),
            func.avg(ReplyAnalysis.intent_confidence).label('avg_confidence'),
            func.avg(ReplyAnalysis.sentiment_score).label('avg_sentiment')
        )
        .join(EmailMessage)
        .where(
            and_(
                EmailMessage.workspace_id == current_user.workspace_id,
                ReplyAnalysis.analyzed_at >= since_date
            )
        )
        .group_by(ReplyAnalysis.detected_intent)
    )
    
    distribution = []
    for row in result:
        distribution.append({
            'intent': row.detected_intent.value,
            'count': row.count,
            'percentage': 0,  # Will calculate after getting total
            'avg_confidence': round(row.avg_confidence, 2),
            'avg_sentiment': round(row.avg_sentiment, 2)
        })
    
    # Calculate percentages
    total = sum(item['count'] for item in distribution)
    for item in distribution:
        item['percentage'] = round((item['count'] / total * 100), 1) if total > 0 else 0
    
    return {
        'period_days': days,
        'total_replies_analyzed': total,
        'distribution': sorted(distribution, key=lambda x: x['count'], reverse=True)
    }