"""
Cached AI service for cost-effective AI response generation.
"""
import logging
from typing import Dict, Any, Optional, List, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass
from enum import Enum
import hashlib
import asyncio

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from utils.cache_manager import AIResponseCache, get_cache
from services.ai_providers import OpenAIProvider, AnthropicProvider, AIProvider
from models.ai_generation import AIGeneration
from models.token_usage import TokenUsage

logger = logging.getLogger(__name__)


class AIModel(Enum):
    """Available AI models."""
    GPT_4 = "gpt-4"
    GPT_4_TURBO = "gpt-4-turbo"
    GPT_35_TURBO = "gpt-3.5-turbo"
    CLAUDE_3_OPUS = "claude-3-opus"
    CLAUDE_3_SONNET = "claude-3-sonnet"
    CLAUDE_3_HAIKU = "claude-3-haiku"


@dataclass
class AIResponse:
    """AI response with metadata."""
    content: str
    model: AIModel
    tokens_used: int
    tokens_prompt: int
    tokens_completion: int
    cost: float
    cached: bool
    processing_time_ms: int
    provider: str
    cache_key: Optional[str] = None


@dataclass
class PromptTemplate:
    """Reusable prompt template."""
    id: str
    name: str
    template: str
    model: AIModel
    temperature: float
    max_tokens: int
    system_prompt: Optional[str] = None
    variables: List[str] = None


class CachedAIService:
    """
    AI service with intelligent caching and cost optimization.
    
    Features:
    - Response caching to reduce API costs
    - Template-based prompts for consistency
    - Multi-provider support with fallback
    - Token usage tracking
    - Cost optimization strategies
    """
    
    def __init__(
        self,
        db: AsyncSession,
        cache_manager: Optional[AIResponseCache] = None
    ):
        self.db = db
        self._cache = cache_manager
        self._providers: Dict[str, AIProvider] = {}
        self._templates: Dict[str, PromptTemplate] = {}
        self._initialized = False
    
    async def initialize(self):
        """Initialize AI providers and cache."""
        if self._initialized:
            return
        
        # Initialize cache if not provided
        if not self._cache:
            cache_manager = await get_cache()
            self._cache = AIResponseCache(cache_manager)
        
        # Initialize providers
        import os
        
        if os.getenv("OPENAI_API_KEY"):
            self._providers["openai"] = OpenAIProvider(
                api_key=os.getenv("OPENAI_API_KEY")
            )
        
        if os.getenv("ANTHROPIC_API_KEY"):
            self._providers["anthropic"] = AnthropicProvider(
                api_key=os.getenv("ANTHROPIC_API_KEY")
            )
        
        # Load prompt templates
        await self._load_templates()
        
        self._initialized = True
        logger.info(f"Initialized AI service with {len(self._providers)} providers")
    
    async def generate(
        self,
        prompt: str,
        model: AIModel = AIModel.GPT_35_TURBO,
        temperature: float = 0.7,
        max_tokens: int = 500,
        workspace_id: str = None,
        user_id: str = None,
        use_cache: bool = True,
        cache_ttl: int = 86400,  # 24 hours
        system_prompt: Optional[str] = None
    ) -> AIResponse:
        """
        Generate AI response with caching.
        
        Args:
            prompt: User prompt
            model: AI model to use
            temperature: Creativity parameter (0-1)
            max_tokens: Maximum response tokens
            workspace_id: Workspace ID for tracking
            user_id: User ID for tracking
            use_cache: Whether to use cache
            cache_ttl: Cache time to live in seconds
            system_prompt: Optional system prompt
            
        Returns:
            AIResponse with generated content
        """
        start_time = datetime.utcnow()
        
        # Initialize if needed
        await self.initialize()
        
        # Check cache if enabled
        if use_cache and workspace_id:
            cached_response = await self._cache.get_response(
                prompt=prompt,
                model=model.value,
                temperature=temperature,
                workspace_id=workspace_id
            )
            
            if cached_response:
                processing_time = int((datetime.utcnow() - start_time).total_seconds() * 1000)
                
                return AIResponse(
                    content=cached_response["response"],
                    model=model,
                    tokens_used=cached_response["tokens_used"],
                    tokens_prompt=0,  # Not tracked in cache
                    tokens_completion=cached_response["tokens_used"],
                    cost=0.0,  # No cost for cached response
                    cached=True,
                    processing_time_ms=processing_time,
                    provider="cache",
                    cache_key=self._cache._generate_key(
                        prompt, model.value, temperature, workspace_id
                    )
                )
        
        # Generate fresh response
        response = await self._generate_fresh(
            prompt=prompt,
            model=model,
            temperature=temperature,
            max_tokens=max_tokens,
            system_prompt=system_prompt
        )
        
        # Cache if successful and caching enabled
        if response and use_cache and workspace_id:
            await self._cache.set_response(
                prompt=prompt,
                model=model.value,
                temperature=temperature,
                workspace_id=workspace_id,
                response=response.content,
                tokens_used=response.tokens_used
            )
        
        # Track usage if workspace provided
        if response and workspace_id:
            await self._track_usage(
                workspace_id=workspace_id,
                user_id=user_id,
                response=response
            )
        
        response.processing_time_ms = int(
            (datetime.utcnow() - start_time).total_seconds() * 1000
        )
        
        return response
    
    async def generate_from_template(
        self,
        template_id: str,
        variables: Dict[str, str],
        workspace_id: str = None,
        user_id: str = None,
        use_cache: bool = True
    ) -> AIResponse:
        """
        Generate AI response from a template.
        
        Args:
            template_id: Template ID
            variables: Variables to fill in template
            workspace_id: Workspace ID for tracking
            user_id: User ID for tracking
            use_cache: Whether to use cache
            
        Returns:
            AIResponse with generated content
        """
        # Get template
        template = self._templates.get(template_id)
        if not template:
            raise ValueError(f"Template {template_id} not found")
        
        # Fill template
        prompt = template.template
        for var, value in variables.items():
            prompt = prompt.replace(f"{{{var}}}", value)
        
        # Generate response
        return await self.generate(
            prompt=prompt,
            model=template.model,
            temperature=template.temperature,
            max_tokens=template.max_tokens,
            workspace_id=workspace_id,
            user_id=user_id,
            use_cache=use_cache,
            system_prompt=template.system_prompt
        )
    
    async def generate_bulk(
        self,
        prompts: List[Tuple[str, Dict[str, Any]]],
        workspace_id: str = None,
        batch_size: int = 5,
        use_cache: bool = True
    ) -> List[AIResponse]:
        """
        Generate multiple AI responses efficiently.
        
        Args:
            prompts: List of (prompt, options) tuples
            workspace_id: Workspace ID for tracking
            batch_size: Batch size for parallel processing
            use_cache: Whether to use cache
            
        Returns:
            List of AIResponse objects
        """
        responses = []
        
        # Process in batches
        for i in range(0, len(prompts), batch_size):
            batch = prompts[i:i + batch_size]
            
            # Generate responses in parallel
            tasks = []
            for prompt, options in batch:
                task = self.generate(
                    prompt=prompt,
                    model=options.get("model", AIModel.GPT_35_TURBO),
                    temperature=options.get("temperature", 0.7),
                    max_tokens=options.get("max_tokens", 500),
                    workspace_id=workspace_id,
                    use_cache=use_cache
                )
                tasks.append(task)
            
            batch_responses = await asyncio.gather(*tasks)
            responses.extend(batch_responses)
        
        return responses
    
    async def optimize_prompt(
        self,
        prompt: str,
        optimization_goal: str = "clarity",
        model: AIModel = AIModel.GPT_35_TURBO
    ) -> str:
        """
        Optimize a prompt for better results.
        
        Args:
            prompt: Original prompt
            optimization_goal: Goal (clarity, brevity, specificity)
            model: Model to use for optimization
            
        Returns:
            Optimized prompt
        """
        optimization_prompt = f"""
        Optimize the following prompt for {optimization_goal}.
        Make it clear, specific, and likely to produce high-quality results.
        
        Original prompt:
        {prompt}
        
        Optimized prompt:
        """
        
        response = await self.generate(
            prompt=optimization_prompt,
            model=model,
            temperature=0.3,  # Low temperature for consistency
            max_tokens=len(prompt) + 100,
            use_cache=True
        )
        
        return response.content.strip()
    
    async def get_usage_stats(
        self,
        workspace_id: str,
        days: int = 30
    ) -> Dict[str, Any]:
        """Get AI usage statistics for a workspace."""
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        
        # Query token usage
        query = select(TokenUsage).where(
            TokenUsage.workspace_id == workspace_id,
            TokenUsage.usage_date >= cutoff_date.date()
        )
        
        result = await self.db.execute(query)
        usage_records = result.scalars().all()
        
        # Calculate statistics
        stats = {
            "total_tokens": 0,
            "total_cost": 0.0,
            "by_model": {},
            "by_day": {},
            "cache_savings": 0.0,
            "average_tokens_per_request": 0
        }
        
        total_requests = 0
        
        for record in usage_records:
            model = record.model
            date_str = record.usage_date.isoformat()
            
            # Aggregate by model
            if model not in stats["by_model"]:
                stats["by_model"][model] = {
                    "tokens": 0,
                    "cost": 0.0,
                    "requests": 0
                }
            
            stats["by_model"][model]["tokens"] += record.tokens_used
            stats["by_model"][model]["cost"] += record.cost
            stats["by_model"][model]["requests"] += record.request_count
            
            # Aggregate by day
            if date_str not in stats["by_day"]:
                stats["by_day"][date_str] = {
                    "tokens": 0,
                    "cost": 0.0
                }
            
            stats["by_day"][date_str]["tokens"] += record.tokens_used
            stats["by_day"][date_str]["cost"] += record.cost
            
            # Totals
            stats["total_tokens"] += record.tokens_used
            stats["total_cost"] += record.cost
            total_requests += record.request_count
        
        # Calculate average
        if total_requests > 0:
            stats["average_tokens_per_request"] = stats["total_tokens"] / total_requests
        
        # Estimate cache savings (rough estimate based on cache hit rate)
        # In reality, this would be tracked more precisely
        cache_stats = await self._cache.cache.get_stats(self._cache.namespace)
        if cache_stats and cache_stats.get("hit_rate", 0) > 0:
            stats["cache_savings"] = stats["total_cost"] * (cache_stats["hit_rate"] / 100)
        
        return stats
    
    async def clear_cache(
        self,
        workspace_id: Optional[str] = None,
        model: Optional[str] = None
    ) -> int:
        """
        Clear AI response cache.
        
        Args:
            workspace_id: Clear cache for specific workspace
            model: Clear cache for specific model
            
        Returns:
            Number of cache entries cleared
        """
        if workspace_id:
            return await self._cache.cache.delete_by_tag(workspace_id)
        elif model:
            return await self._cache.cache.delete_by_tag(model)
        else:
            return await self._cache.cache.clear_namespace(self._cache.namespace)
    
    # Private methods
    
    async def _generate_fresh(
        self,
        prompt: str,
        model: AIModel,
        temperature: float,
        max_tokens: int,
        system_prompt: Optional[str] = None
    ) -> Optional[AIResponse]:
        """Generate fresh AI response from providers."""
        # Determine provider based on model
        provider_name = self._get_provider_for_model(model)
        if not provider_name or provider_name not in self._providers:
            logger.error(f"No provider available for model {model}")
            return None
        
        provider = self._providers[provider_name]
        
        try:
            # Generate response
            result = await provider.generate(
                prompt=prompt,
                model=model.value,
                temperature=temperature,
                max_tokens=max_tokens,
                system_prompt=system_prompt
            )
            
            if result:
                # Calculate cost
                cost = self._calculate_cost(
                    model=model,
                    tokens_prompt=result.get("usage", {}).get("prompt_tokens", 0),
                    tokens_completion=result.get("usage", {}).get("completion_tokens", 0)
                )
                
                return AIResponse(
                    content=result["content"],
                    model=model,
                    tokens_used=result.get("usage", {}).get("total_tokens", 0),
                    tokens_prompt=result.get("usage", {}).get("prompt_tokens", 0),
                    tokens_completion=result.get("usage", {}).get("completion_tokens", 0),
                    cost=cost,
                    cached=False,
                    processing_time_ms=0,  # Will be set by caller
                    provider=provider_name
                )
                
        except Exception as e:
            logger.error(f"AI generation failed: {e}")
            
        return None
    
    def _get_provider_for_model(self, model: AIModel) -> Optional[str]:
        """Get provider name for a model."""
        if model in [AIModel.GPT_4, AIModel.GPT_4_TURBO, AIModel.GPT_35_TURBO]:
            return "openai"
        elif model in [AIModel.CLAUDE_3_OPUS, AIModel.CLAUDE_3_SONNET, AIModel.CLAUDE_3_HAIKU]:
            return "anthropic"
        return None
    
    def _calculate_cost(
        self,
        model: AIModel,
        tokens_prompt: int,
        tokens_completion: int
    ) -> float:
        """Calculate cost for token usage."""
        # Pricing per 1K tokens (as of 2024)
        pricing = {
            AIModel.GPT_4: {"prompt": 0.03, "completion": 0.06},
            AIModel.GPT_4_TURBO: {"prompt": 0.01, "completion": 0.03},
            AIModel.GPT_35_TURBO: {"prompt": 0.0005, "completion": 0.0015},
            AIModel.CLAUDE_3_OPUS: {"prompt": 0.015, "completion": 0.075},
            AIModel.CLAUDE_3_SONNET: {"prompt": 0.003, "completion": 0.015},
            AIModel.CLAUDE_3_HAIKU: {"prompt": 0.00025, "completion": 0.00125}
        }
        
        model_pricing = pricing.get(model, {"prompt": 0, "completion": 0})
        
        prompt_cost = (tokens_prompt / 1000) * model_pricing["prompt"]
        completion_cost = (tokens_completion / 1000) * model_pricing["completion"]
        
        return round(prompt_cost + completion_cost, 6)
    
    async def _track_usage(
        self,
        workspace_id: str,
        user_id: Optional[str],
        response: AIResponse
    ):
        """Track AI usage in database."""
        try:
            # Store generation record
            generation = AIGeneration(
                workspace_id=workspace_id,
                user_id=user_id,
                model=response.model.value,
                prompt_tokens=response.tokens_prompt,
                completion_tokens=response.tokens_completion,
                total_tokens=response.tokens_used,
                cost=response.cost,
                cached=response.cached,
                provider=response.provider,
                created_at=datetime.utcnow()
            )
            
            self.db.add(generation)
            
            # Update or create daily token usage
            today = datetime.utcnow().date()
            
            query = select(TokenUsage).where(
                TokenUsage.workspace_id == workspace_id,
                TokenUsage.model == response.model.value,
                TokenUsage.usage_date == today
            )
            
            result = await self.db.execute(query)
            token_usage = result.scalar_one_or_none()
            
            if token_usage:
                token_usage.tokens_used += response.tokens_used
                token_usage.cost += response.cost
                token_usage.request_count += 1
            else:
                token_usage = TokenUsage(
                    workspace_id=workspace_id,
                    model=response.model.value,
                    usage_date=today,
                    tokens_used=response.tokens_used,
                    cost=response.cost,
                    request_count=1
                )
                self.db.add(token_usage)
            
            await self.db.commit()
            
        except Exception as e:
            logger.error(f"Failed to track usage: {e}")
            await self.db.rollback()
    
    async def _load_templates(self):
        """Load prompt templates."""
        # In production, these would come from database
        self._templates = {
            "cold_email": PromptTemplate(
                id="cold_email",
                name="Cold Email Generator",
                template="""
                Write a personalized cold email to {name} at {company}.
                Their role is {role}.
                Our product is {product}.
                Key value proposition: {value_prop}
                
                Make it concise, personalized, and end with a clear call to action.
                """,
                model=AIModel.GPT_4_TURBO,
                temperature=0.7,
                max_tokens=500,
                variables=["name", "company", "role", "product", "value_prop"]
            ),
            "email_reply": PromptTemplate(
                id="email_reply",
                name="Email Reply Generator",
                template="""
                Write a reply to this email:
                {original_email}
                
                Context: {context}
                Tone: {tone}
                
                Keep it professional and address their concerns.
                """,
                model=AIModel.GPT_35_TURBO,
                temperature=0.6,
                max_tokens=400,
                variables=["original_email", "context", "tone"]
            ),
            "subject_line": PromptTemplate(
                id="subject_line",
                name="Subject Line Optimizer",
                template="""
                Generate 5 compelling subject lines for this email:
                {email_content}
                
                Target audience: {audience}
                Goal: {goal}
                
                Make them attention-grabbing but not spammy.
                """,
                model=AIModel.GPT_35_TURBO,
                temperature=0.8,
                max_tokens=200,
                variables=["email_content", "audience", "goal"]
            )
        }


# Mock AI providers (these would be real implementations)
class AIProvider:
    """Base AI provider interface."""
    
    async def generate(self, **kwargs) -> Optional[Dict[str, Any]]:
        raise NotImplementedError


class OpenAIProvider(AIProvider):
    def __init__(self, api_key: str):
        self.api_key = api_key
    
    async def generate(self, **kwargs) -> Optional[Dict[str, Any]]:
        # Mock implementation
        return {
            "content": "This is a generated response from OpenAI.",
            "usage": {
                "prompt_tokens": 50,
                "completion_tokens": 100,
                "total_tokens": 150
            }
        }


class AnthropicProvider(AIProvider):
    def __init__(self, api_key: str):
        self.api_key = api_key
    
    async def generate(self, **kwargs) -> Optional[Dict[str, Any]]:
        # Mock implementation
        return {
            "content": "This is a generated response from Anthropic.",
            "usage": {
                "prompt_tokens": 60,
                "completion_tokens": 120,
                "total_tokens": 180
            }
        }