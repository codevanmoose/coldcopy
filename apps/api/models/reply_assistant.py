"""
AI Reply Assistant models for intelligent email responses.
"""
from sqlalchemy import Column, String, Integer, Float, DateTime, Boolean, ForeignKey, JSON, Enum, Text, Index
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime
import enum

from ..core.database import Base


class ReplyTone(str, enum.Enum):
    """Tone options for replies."""
    PROFESSIONAL = "professional"
    FRIENDLY = "friendly"
    CASUAL = "casual"
    FORMAL = "formal"
    ENTHUSIASTIC = "enthusiastic"
    EMPATHETIC = "empathetic"


class ReplyIntent(str, enum.Enum):
    """Intent classification for replies."""
    INTERESTED = "interested"
    NOT_INTERESTED = "not_interested"
    NEEDS_INFO = "needs_info"
    SCHEDULING = "scheduling"
    OBJECTION = "objection"
    REFERRAL = "referral"
    UNSUBSCRIBE = "unsubscribe"
    OTHER = "other"


class ReplyLength(str, enum.Enum):
    """Reply length preferences."""
    SHORT = "short"  # 1-2 sentences
    MEDIUM = "medium"  # 3-5 sentences
    LONG = "long"  # 6+ sentences


class ReplyTemplate(Base):
    """Templates for common reply scenarios."""
    __tablename__ = "reply_templates"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id"), nullable=False)
    
    # Template details
    name = Column(String(255), nullable=False)
    description = Column(Text)
    intent = Column(Enum(ReplyIntent), nullable=False)
    tone = Column(Enum(ReplyTone), default=ReplyTone.PROFESSIONAL)
    
    # Template content
    template_text = Column(Text, nullable=False)
    variables = Column(JSON)  # List of variables used in template
    
    # Usage tracking
    usage_count = Column(Integer, default=0)
    success_rate = Column(Float)  # Based on positive responses
    
    # Metadata
    is_active = Column(Boolean, default=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    workspace = relationship("Workspace")
    creator = relationship("User")
    
    # Indexes
    __table_args__ = (
        Index("idx_reply_templates_workspace_intent", "workspace_id", "intent"),
        Index("idx_reply_templates_usage", "usage_count"),
    )


class ReplyAnalysis(Base):
    """Analysis of incoming replies for context and intent."""
    __tablename__ = "reply_analyses"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email_message_id = Column(UUID(as_uuid=True), ForeignKey("email_messages.id"), nullable=False)
    
    # Analysis results
    detected_intent = Column(Enum(ReplyIntent), nullable=False)
    intent_confidence = Column(Float, nullable=False)  # 0-1 confidence score
    sentiment_score = Column(Float)  # -1 (negative) to 1 (positive)
    
    # Key information extraction
    extracted_entities = Column(JSON)  # Names, dates, companies, etc.
    key_phrases = Column(JSON)  # Important phrases identified
    questions_detected = Column(JSON)  # Questions that need answering
    
    # Context understanding
    requires_action = Column(Boolean, default=False)
    urgency_level = Column(Integer, default=1)  # 1-5 scale
    language_detected = Column(String(10), default="en")
    
    # Suggested actions
    suggested_reply_tone = Column(Enum(ReplyTone))
    suggested_reply_length = Column(Enum(ReplyLength))
    suggested_next_steps = Column(JSON)
    
    # Timestamps
    analyzed_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    email_message = relationship("EmailMessage")


class AISuggestedReply(Base):
    """AI-generated reply suggestions."""
    __tablename__ = "ai_suggested_replies"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email_message_id = Column(UUID(as_uuid=True), ForeignKey("email_messages.id"), nullable=False)
    reply_analysis_id = Column(UUID(as_uuid=True), ForeignKey("reply_analyses.id"), nullable=False)
    
    # Suggestion details
    suggestion_text = Column(Text, nullable=False)
    tone = Column(Enum(ReplyTone), nullable=False)
    length = Column(Enum(ReplyLength), nullable=False)
    confidence_score = Column(Float, nullable=False)  # 0-1 confidence
    
    # AI model details
    model_used = Column(String(50), nullable=False)  # gpt-4, claude, etc.
    prompt_tokens = Column(Integer)
    completion_tokens = Column(Integer)
    
    # Personalization used
    personalization_factors = Column(JSON)  # What data was used to personalize
    template_id = Column(UUID(as_uuid=True), ForeignKey("reply_templates.id"))
    
    # User interaction
    was_selected = Column(Boolean, default=False)
    was_edited = Column(Boolean, default=False)
    final_text = Column(Text)  # If edited, store the final version
    
    # Performance tracking
    led_to_positive_response = Column(Boolean)
    response_time_hours = Column(Float)  # Time to get response after sending
    
    # Timestamps
    generated_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    sent_at = Column(DateTime)
    
    # Relationships
    email_message = relationship("EmailMessage")
    reply_analysis = relationship("ReplyAnalysis")
    template = relationship("ReplyTemplate")


class ReplyWorkflow(Base):
    """Automated reply workflows based on intent."""
    __tablename__ = "reply_workflows"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id"), nullable=False)
    
    # Workflow configuration
    name = Column(String(255), nullable=False)
    description = Column(Text)
    trigger_intent = Column(Enum(ReplyIntent), nullable=False)
    is_active = Column(Boolean, default=True)
    
    # Workflow steps
    workflow_steps = Column(JSON, nullable=False)  # Array of step configurations
    """
    Example workflow_steps:
    [
        {
            "step": 1,
            "action": "send_reply",
            "template_id": "uuid",
            "delay_minutes": 0
        },
        {
            "step": 2,
            "action": "create_task",
            "task_type": "follow_up",
            "delay_minutes": 1440  # 24 hours
        },
        {
            "step": 3,
            "action": "update_lead_status",
            "new_status": "qualified"
        }
    ]
    """
    
    # Automation settings
    auto_execute = Column(Boolean, default=False)
    require_approval = Column(Boolean, default=True)
    max_executions_per_day = Column(Integer, default=50)
    
    # Performance metrics
    execution_count = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    workspace = relationship("Workspace")


class ReplyOptimization(Base):
    """A/B testing and optimization for reply strategies."""
    __tablename__ = "reply_optimizations"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id"), nullable=False)
    
    # Test configuration
    name = Column(String(255), nullable=False)
    intent_type = Column(Enum(ReplyIntent), nullable=False)
    is_active = Column(Boolean, default=True)
    
    # Variants being tested
    variants = Column(JSON, nullable=False)
    """
    Example variants:
    [
        {
            "id": "a",
            "tone": "professional",
            "length": "short",
            "template_id": "uuid",
            "weight": 50
        },
        {
            "id": "b",
            "tone": "friendly",
            "length": "medium",
            "template_id": "uuid",
            "weight": 50
        }
    ]
    """
    
    # Results tracking
    total_tests = Column(Integer, default=0)
    results = Column(JSON)  # Detailed results per variant
    winning_variant = Column(String(10))
    confidence_level = Column(Float)
    
    # Timestamps
    started_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    completed_at = Column(DateTime)
    
    # Relationships
    workspace = relationship("Workspace")


class ConversationContext(Base):
    """Maintains context across email threads."""
    __tablename__ = "conversation_contexts"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lead_id = Column(UUID(as_uuid=True), ForeignKey("leads.id"), nullable=False)
    campaign_id = Column(UUID(as_uuid=True), ForeignKey("campaigns.id"), nullable=False)
    
    # Conversation summary
    thread_summary = Column(Text)  # AI-generated summary of conversation
    key_topics = Column(JSON)  # Topics discussed
    commitments_made = Column(JSON)  # Promises or commitments tracked
    
    # Lead preferences learned
    communication_preferences = Column(JSON)
    detected_pain_points = Column(JSON)
    interests_expressed = Column(JSON)
    
    # Conversation state
    current_stage = Column(String(50))  # discovery, qualification, negotiation, etc.
    next_steps = Column(JSON)
    last_meaningful_interaction = Column(DateTime)
    
    # Metadata
    message_count = Column(Integer, default=0)
    positive_interactions = Column(Integer, default=0)
    negative_interactions = Column(Integer, default=0)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    lead = relationship("Lead")
    campaign = relationship("Campaign")
    
    # Indexes
    __table_args__ = (
        Index("idx_conversation_context_lead_campaign", "lead_id", "campaign_id", unique=True),
    )