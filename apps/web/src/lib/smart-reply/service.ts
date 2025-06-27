import { createClient } from '@/utils/supabase/server';
import { OpenAI } from 'openai';
import {
  MessageAnalysis,
  ReplySuggestion,
  ConversationContext,
  AnalyzeMessageRequest,
  GenerateSuggestionsRequest,
  SmartReplyResponse,
  MessageIntent,
  MessageSentiment,
  SuggestionType,
  ReplyTone,
} from './types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export class SmartReplyService {
  /**
   * Analyze incoming message for sentiment, intent, and key information
   */
  static async analyzeMessage(
    request: AnalyzeMessageRequest
  ): Promise<MessageAnalysis> {
    const supabase = createClient();
    const startTime = Date.now();

    try {
      // Get conversation context if available
      let context: ConversationContext | null = null;
      if (request.conversation_thread_id) {
        const { data: contextData } = await supabase
          .from('conversation_context')
          .select('*')
          .eq('conversation_thread_id', request.conversation_thread_id)
          .single();
        
        context = contextData;
      }

      // Prepare the analysis prompt
      const analysisPrompt = `
Analyze the following message and extract key information:

Message: "${request.message_content}"
${request.sender_name ? `Sender: ${request.sender_name}` : ''}
${context ? `Previous interactions: ${context.message_count}` : ''}
${context?.summary ? `Conversation context: ${context.summary}` : ''}

Please provide:
1. Sentiment (positive/negative/neutral/mixed) with score (-1.0 to 1.0)
2. Primary intent (question/complaint/interest/objection/meeting_request/pricing_inquiry/feature_request/support_request/unsubscribe/other) with confidence (0.0 to 1.0)
3. Key topics discussed (as an array)
4. Named entities (people, companies, dates, locations, products)
5. Brief conversation summary (if context provided)

Format as JSON.`;

      // Call OpenAI for analysis
      const completion = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at analyzing business communication to understand sentiment, intent, and extract key information.',
          },
          {
            role: 'user',
            content: analysisPrompt,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 500,
      });

      const analysisResult = JSON.parse(completion.choices[0].message.content || '{}');
      const tokensUsed = completion.usage?.total_tokens || 0;

      // Save analysis to database
      const { data: analysis, error } = await supabase
        .from('message_analysis')
        .insert({
          workspace_id: request.workspace_id,
          message_id: request.message_id,
          message_type: request.message_type,
          message_content: request.message_content,
          sender_name: request.sender_name,
          sender_email: request.sender_email,
          sentiment: analysisResult.sentiment as MessageSentiment,
          sentiment_score: analysisResult.sentiment_score,
          intent: analysisResult.intent as MessageIntent,
          intent_confidence: analysisResult.intent_confidence,
          topics: analysisResult.topics || [],
          entities: analysisResult.entities || {},
          conversation_summary: analysisResult.conversation_summary,
          previous_interactions: context?.message_count || 0,
          analysis_model: 'gpt-4-turbo-preview',
          analysis_tokens_used: tokensUsed,
        })
        .select()
        .single();

      if (error) throw error;

      // Update conversation context if needed
      if (request.conversation_thread_id) {
        await this.updateConversationContext(
          request.workspace_id,
          request.conversation_thread_id,
          analysis,
          analysisResult
        );
      }

      return analysis;
    } catch (error) {
      console.error('Message analysis error:', error);
      throw new Error('Failed to analyze message');
    }
  }

  /**
   * Generate smart reply suggestions based on message analysis
   */
  static async generateSuggestions(
    request: GenerateSuggestionsRequest
  ): Promise<ReplySuggestion[]> {
    const supabase = createClient();

    try {
      // Get the analysis
      const { data: analysis, error: analysisError } = await supabase
        .from('message_analysis')
        .select('*')
        .eq('id', request.analysis_id)
        .single();

      if (analysisError) throw analysisError;

      // Get conversation context
      const { data: context } = await supabase
        .from('conversation_context')
        .select('*')
        .eq('workspace_id', request.workspace_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      // Get relevant templates if requested
      let templates: any[] = [];
      if (request.use_templates) {
        const { data: templateData } = await supabase
          .from('reply_templates')
          .select('*')
          .eq('workspace_id', request.workspace_id)
          .eq('is_active', true)
          .eq('intent', analysis.intent);
        
        templates = templateData || [];
      }

      // Determine suggestion types based on intent
      const suggestionTypes = request.suggestion_types || this.getSuggestionTypesForIntent(analysis.intent);
      const tones = request.tones || this.getTonesForIntent(analysis.intent);
      const maxSuggestions = request.max_suggestions || 3;

      const suggestions: ReplySuggestion[] = [];

      for (let i = 0; i < Math.min(suggestionTypes.length, maxSuggestions); i++) {
        const suggestionType = suggestionTypes[i];
        const tone = tones[i % tones.length];

        const suggestion = await this.generateSingleSuggestion(
          analysis,
          suggestionType,
          tone,
          context,
          templates
        );

        // Save suggestion to database
        const { data: savedSuggestion, error: saveError } = await supabase
          .from('reply_suggestions')
          .insert({
            workspace_id: request.workspace_id,
            analysis_id: request.analysis_id,
            suggestion_type: suggestionType,
            content: suggestion.content,
            tone: tone,
            personalization_used: suggestion.personalization_used,
            relevance_score: suggestion.relevance_score,
            personalization_score: suggestion.personalization_score,
            ai_model: 'gpt-4-turbo-preview',
            ai_tokens_used: suggestion.tokens_used,
            generation_time_ms: suggestion.generation_time_ms,
          })
          .select()
          .single();

        if (saveError) throw saveError;
        suggestions.push(savedSuggestion);
      }

      return suggestions;
    } catch (error) {
      console.error('Suggestion generation error:', error);
      throw new Error('Failed to generate suggestions');
    }
  }

  /**
   * Generate a single reply suggestion
   */
  private static async generateSingleSuggestion(
    analysis: MessageAnalysis,
    suggestionType: SuggestionType,
    tone: ReplyTone,
    context: ConversationContext | null,
    templates: any[]
  ): Promise<any> {
    const startTime = Date.now();

    // Build the prompt
    const prompt = `
Generate a ${suggestionType} reply for the following message:

Original Message: "${analysis.message_content}"
Sender: ${analysis.sender_name || 'Unknown'}
Message Sentiment: ${analysis.sentiment} (${analysis.sentiment_score})
Message Intent: ${analysis.intent}
Key Topics: ${analysis.topics.join(', ')}

${context ? `
Conversation Context:
- Stage: ${context.conversation_stage}
- Pain Points: ${context.pain_points.join(', ')}
- Objectives: ${context.objectives.join(', ')}
- Previous Messages: ${context.message_count}
` : ''}

Requirements:
- Type: ${suggestionType}
- Tone: ${tone}
- Keep it concise and relevant
- Personalize based on available information
- Address the sender's intent directly
${suggestionType === 'meeting_proposal' ? '- Include specific time suggestions' : ''}
${suggestionType === 'objection_handling' ? '- Address concerns empathetically' : ''}

${templates.length > 0 ? `
You may use these templates as inspiration:
${templates.map(t => t.template_content).join('\n')}
` : ''}

Generate a natural, personalized response.`;

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: 'You are an expert sales communication specialist. Generate concise, effective, and personalized responses.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 300,
      });

      const content = completion.choices[0].message.content || '';
      const tokensUsed = completion.usage?.total_tokens || 0;

      // Calculate scores
      const personalizationElements = this.detectPersonalization(content, analysis);
      const relevanceScore = this.calculateRelevanceScore(content, analysis);
      const personalizationScore = personalizationElements.length / 5; // Max 5 elements

      return {
        content,
        personalization_used: personalizationElements,
        relevance_score: Math.min(relevanceScore, 1.0),
        personalization_score: Math.min(personalizationScore, 1.0),
        tokens_used: tokensUsed,
        generation_time_ms: Date.now() - startTime,
      };
    } catch (error) {
      console.error('Single suggestion generation error:', error);
      throw error;
    }
  }

  /**
   * Get full smart reply response with analysis and suggestions
   */
  static async getSmartReply(
    request: AnalyzeMessageRequest
  ): Promise<SmartReplyResponse> {
    // Analyze the message
    const analysis = await this.analyzeMessage(request);

    // Generate suggestions if requested
    let suggestions: ReplySuggestion[] = [];
    if (request.include_suggestions !== false) {
      const suggestionRequest: GenerateSuggestionsRequest = {
        workspace_id: request.workspace_id,
        analysis_id: analysis.id,
        max_suggestions: request.suggestion_count || 3,
        use_templates: true,
      };
      
      suggestions = await this.generateSuggestions(suggestionRequest);
    }

    // Get conversation context
    const supabase = createClient();
    let context: ConversationContext | null = null;
    if (request.conversation_thread_id) {
      const { data: contextData } = await supabase
        .from('conversation_context')
        .select('*')
        .eq('conversation_thread_id', request.conversation_thread_id)
        .single();
      
      context = contextData;
    }

    // Determine recommended suggestion
    const recommendedSuggestion = suggestions.reduce((best, current) => {
      const currentScore = (current.relevance_score + current.personalization_score) / 2;
      const bestScore = (best.relevance_score + best.personalization_score) / 2;
      return currentScore > bestScore ? current : best;
    }, suggestions[0]);

    return {
      analysis,
      suggestions,
      context: context || undefined,
      recommended_suggestion_id: recommendedSuggestion?.id,
    };
  }

  /**
   * Track reply performance
   */
  static async trackReplyPerformance(
    workspace_id: string,
    suggestion_id: string,
    sent_message_id: string,
    sent_message_type: 'email' | 'linkedin' | 'twitter',
    sent_content: string,
    was_edited: boolean
  ): Promise<void> {
    const supabase = createClient();

    try {
      // Update suggestion usage
      await supabase
        .from('reply_suggestions')
        .update({
          was_selected: true,
          was_edited,
          final_content: was_edited ? sent_content : undefined,
          selected_at: new Date().toISOString(),
        })
        .eq('id', suggestion_id);

      // Create performance tracking record
      await supabase
        .from('reply_performance')
        .insert({
          workspace_id,
          suggestion_id,
          sent_message_id,
          sent_message_type,
          sent_content,
        });
    } catch (error) {
      console.error('Failed to track reply performance:', error);
    }
  }

  /**
   * Update conversation context based on new analysis
   */
  private static async updateConversationContext(
    workspace_id: string,
    conversation_thread_id: string,
    analysis: MessageAnalysis,
    analysisResult: any
  ): Promise<void> {
    const supabase = createClient();

    try {
      const { data: existing } = await supabase
        .from('conversation_context')
        .select('*')
        .eq('conversation_thread_id', conversation_thread_id)
        .single();

      if (existing) {
        // Update existing context
        await supabase
          .from('conversation_context')
          .update({
            message_count: existing.message_count + 1,
            last_message_at: new Date().toISOString(),
            overall_sentiment: analysis.sentiment,
            sentiment_trend: this.calculateSentimentTrend(existing.overall_sentiment, analysis.sentiment),
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
      } else {
        // Create new context
        await supabase
          .from('conversation_context')
          .insert({
            workspace_id,
            conversation_thread_id,
            channel: analysis.message_type,
            message_count: 1,
            last_message_at: new Date().toISOString(),
            overall_sentiment: analysis.sentiment,
            pain_points: analysisResult.pain_points || [],
            objectives: analysisResult.objectives || [],
          });
      }
    } catch (error) {
      console.error('Failed to update conversation context:', error);
    }
  }

  /**
   * Helper: Get appropriate suggestion types for intent
   */
  private static getSuggestionTypesForIntent(intent: MessageIntent): SuggestionType[] {
    const mapping: Record<MessageIntent, SuggestionType[]> = {
      question: ['detailed_response', 'quick_reply'],
      complaint: ['objection_handling', 'detailed_response'],
      interest: ['meeting_proposal', 'detailed_response', 'follow_up'],
      objection: ['objection_handling', 'detailed_response'],
      meeting_request: ['meeting_proposal', 'quick_reply'],
      pricing_inquiry: ['detailed_response', 'meeting_proposal'],
      feature_request: ['detailed_response', 'follow_up'],
      support_request: ['quick_reply', 'detailed_response'],
      unsubscribe: ['quick_reply'],
      other: ['quick_reply', 'detailed_response'],
    };

    return mapping[intent] || ['quick_reply', 'detailed_response'];
  }

  /**
   * Helper: Get appropriate tones for intent
   */
  private static getTonesForIntent(intent: MessageIntent): ReplyTone[] {
    const mapping: Record<MessageIntent, ReplyTone[]> = {
      question: ['professional', 'friendly'],
      complaint: ['professional', 'formal'],
      interest: ['enthusiastic', 'professional'],
      objection: ['professional', 'friendly'],
      meeting_request: ['professional', 'enthusiastic'],
      pricing_inquiry: ['professional', 'friendly'],
      feature_request: ['professional', 'friendly'],
      support_request: ['friendly', 'professional'],
      unsubscribe: ['professional', 'formal'],
      other: ['professional', 'friendly'],
    };

    return mapping[intent] || ['professional'];
  }

  /**
   * Helper: Detect personalization elements
   */
  private static detectPersonalization(content: string, analysis: MessageAnalysis): string[] {
    const elements: string[] = [];
    
    if (analysis.sender_name && content.includes(analysis.sender_name)) {
      elements.push('name');
    }
    
    if (analysis.entities.companies?.some(company => content.includes(company))) {
      elements.push('company');
    }
    
    if (analysis.topics.some(topic => content.toLowerCase().includes(topic.toLowerCase()))) {
      elements.push('topic_reference');
    }
    
    if (content.includes('previous') || content.includes('last time')) {
      elements.push('previous_interaction');
    }
    
    if (analysis.entities.dates?.some(date => content.includes(date))) {
      elements.push('date_reference');
    }

    return elements;
  }

  /**
   * Helper: Calculate relevance score
   */
  private static calculateRelevanceScore(content: string, analysis: MessageAnalysis): number {
    let score = 0.5; // Base score
    
    // Check if reply addresses the intent
    const intentKeywords: Record<MessageIntent, string[]> = {
      question: ['answer', 'here', 'yes', 'no', 'solution'],
      complaint: ['apologize', 'sorry', 'understand', 'resolve'],
      interest: ['great', 'excellent', 'love to', 'happy to'],
      objection: ['understand', 'however', 'consider', 'actually'],
      meeting_request: ['available', 'schedule', 'calendar', 'time'],
      pricing_inquiry: ['pricing', 'cost', 'investment', 'plan'],
      feature_request: ['feature', 'consider', 'roadmap', 'feedback'],
      support_request: ['help', 'assist', 'support', 'resolve'],
      unsubscribe: ['removed', 'unsubscribed', 'sorry to see'],
      other: [],
    };
    
    const keywords = intentKeywords[analysis.intent] || [];
    const contentLower = content.toLowerCase();
    
    keywords.forEach(keyword => {
      if (contentLower.includes(keyword)) {
        score += 0.1;
      }
    });
    
    // Check topic coverage
    analysis.topics.forEach(topic => {
      if (contentLower.includes(topic.toLowerCase())) {
        score += 0.1;
      }
    });
    
    return Math.min(score, 1.0);
  }

  /**
   * Helper: Calculate sentiment trend
   */
  private static calculateSentimentTrend(
    previous: MessageSentiment | null,
    current: MessageSentiment
  ): 'improving' | 'declining' | 'stable' {
    if (!previous) return 'stable';
    
    const sentimentValues: Record<MessageSentiment, number> = {
      positive: 1,
      neutral: 0,
      negative: -1,
      mixed: 0,
    };
    
    const prevValue = sentimentValues[previous];
    const currValue = sentimentValues[current];
    
    if (currValue > prevValue) return 'improving';
    if (currValue < prevValue) return 'declining';
    return 'stable';
  }
}