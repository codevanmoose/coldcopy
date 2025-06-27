import { createClient } from '@/utils/supabase/server';
import { OpenAI } from 'openai';
import {
  ConversationThread,
  MessageSentiment,
  SentimentAlert,
  AnalyzeConversationRequest,
  SentimentAnalysisResponse,
  SentimentLevel,
  RiskLevel,
  AlertType,
  UrgencyLevel,
} from './types';
import { cache, cacheKeys } from '@/lib/cache/redis';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export class SentimentAnalysisService {
  /**
   * Analyze an entire conversation thread
   */
  static async analyzeConversation(
    request: AnalyzeConversationRequest
  ): Promise<SentimentAnalysisResponse> {
    const supabase = createClient();

    try {
      // Get or create conversation thread
      let thread = await this.getOrCreateThread(request);

      // Analyze each message
      const messageAnalyses: MessageSentiment[] = [];
      const alerts: SentimentAlert[] = [];

      for (let i = 0; i < request.messages.length; i++) {
        const message = request.messages[i];
        const previousSentiment = i > 0 ? messageAnalyses[i - 1].sentiment_score : null;

        // Analyze individual message
        const analysis = await this.analyzeMessage(
          request.workspace_id,
          thread.id,
          message,
          request.channel,
          i,
          previousSentiment
        );

        messageAnalyses.push(analysis);

        // Check for alerts
        const messageAlerts = await this.checkForAlerts(
          request.workspace_id,
          thread.id,
          analysis,
          thread
        );
        alerts.push(...messageAlerts);
      }

      // Update thread with latest analysis
      thread = await this.updateThreadAnalysis(thread.id, messageAnalyses);

      // Generate recommendations
      const recommendations = await this.generateRecommendations(thread, messageAnalyses);

      // Cache the analysis
      await cache.set(
        `sentiment:thread:${thread.id}`,
        { thread, messages: messageAnalyses, alerts },
        { ttl: 3600 } // 1 hour cache
      );

      return {
        thread,
        messages: messageAnalyses,
        alerts,
        recommendations,
      };
    } catch (error) {
      console.error('Conversation analysis error:', error);
      throw new Error('Failed to analyze conversation');
    }
  }

  /**
   * Analyze a single message for sentiment
   */
  private static async analyzeMessage(
    workspace_id: string,
    thread_id: string,
    message: {
      id: string;
      content: string;
      sender_email?: string;
      sender_name?: string;
      is_from_lead: boolean;
      timestamp: string;
    },
    channel: string,
    message_index: number,
    previous_sentiment: number | null
  ): Promise<MessageSentiment> {
    const supabase = createClient();

    // Check if already analyzed
    const { data: existing } = await supabase
      .from('message_sentiments')
      .select('*')
      .eq('message_id', message.id)
      .single();

    if (existing) return existing;

    // Prepare analysis prompt
    const prompt = `
Analyze the following message for sentiment, emotions, tone, and business signals:

Message: "${message.content}"
Sender: ${message.sender_name || 'Unknown'} (${message.is_from_lead ? 'Lead/Customer' : 'Sales Rep'})
Channel: ${channel}
Position in conversation: Message ${message_index + 1}

Please provide a comprehensive analysis including:
1. Overall sentiment (very_positive/positive/neutral/negative/very_negative) with score (-1.0 to 1.0)
2. Confidence level (0.0 to 1.0)
3. Detected emotions (joy, anger, fear, sadness, surprise, disgust) with scores
4. Tone analysis (professional, casual, formal, friendly, assertive) with scores
5. Politeness score (0.0 to 1.0)
6. Urgency level (none/low/medium/high/critical)
7. Key phrases that indicate sentiment
8. Main topics discussed
9. Named entities (people, companies, locations, dates, money)
10. Detected intents (question, complaint, praise, interest, objection, etc.)
11. Any buying signals detected
12. Any risk signals detected

Format the response as JSON.`;

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at analyzing business communication for sentiment, emotion, and intent. Provide detailed and accurate analysis.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 1000,
      });

      const analysis = JSON.parse(completion.choices[0].message.content || '{}');
      const tokensUsed = completion.usage?.total_tokens || 0;

      // Calculate sentiment change
      const sentimentChange = previous_sentiment !== null
        ? analysis.sentiment_score - previous_sentiment
        : 0;

      // Determine if this is a turning point
      const isTurningPoint = Math.abs(sentimentChange) > 0.3;

      // Save analysis
      const { data: sentiment, error } = await supabase
        .from('message_sentiments')
        .insert({
          workspace_id,
          thread_id,
          message_id: message.id,
          message_type: channel,
          sender_email: message.sender_email,
          sender_name: message.sender_name,
          is_from_lead: message.is_from_lead,
          message_content: message.content,
          message_timestamp: message.timestamp,
          sentiment: analysis.sentiment as SentimentLevel,
          sentiment_score: analysis.sentiment_score,
          confidence: analysis.confidence,
          emotions: analysis.emotions || {},
          dominant_emotion: analysis.dominant_emotion,
          tone: analysis.tone || {},
          politeness_score: analysis.politeness_score,
          urgency_level: analysis.urgency_level as UrgencyLevel,
          key_phrases: analysis.key_phrases || [],
          topics: analysis.topics || [],
          entities: analysis.entities || {},
          detected_intents: analysis.detected_intents || [],
          buying_signals: analysis.buying_signals || [],
          risk_signals: analysis.risk_signals || [],
          messages_before: message_index,
          sentiment_change_from_previous: sentimentChange,
          is_turning_point: isTurningPoint,
          analyzed_by: 'gpt-4-turbo-preview',
          tokens_used: tokensUsed,
        })
        .select()
        .single();

      if (error) throw error;
      return sentiment;
    } catch (error) {
      console.error('Message analysis error:', error);
      throw error;
    }
  }

  /**
   * Get or create conversation thread
   */
  private static async getOrCreateThread(
    request: AnalyzeConversationRequest
  ): Promise<ConversationThread> {
    const supabase = createClient();

    // Try to get existing thread
    const { data: existing } = await supabase
      .from('conversation_threads')
      .select('*')
      .eq('workspace_id', request.workspace_id)
      .eq('thread_key', request.thread_key)
      .single();

    if (existing) return existing;

    // Create new thread
    const participants = Array.from(
      new Set(request.messages.map(m => m.sender_email).filter(Boolean))
    ).map(email => ({ email }));

    const { data: thread, error } = await supabase
      .from('conversation_threads')
      .insert({
        workspace_id: request.workspace_id,
        lead_id: request.lead_id,
        thread_key: request.thread_key,
        channel: request.channel,
        subject: request.subject,
        participants,
        primary_contact_email: request.messages.find(m => m.is_from_lead)?.sender_email,
        primary_contact_name: request.messages.find(m => m.is_from_lead)?.sender_name,
      })
      .select()
      .single();

    if (error) throw error;
    return thread;
  }

  /**
   * Update thread analysis after message analysis
   */
  private static async updateThreadAnalysis(
    thread_id: string,
    messages: MessageSentiment[]
  ): Promise<ConversationThread> {
    const supabase = createClient();

    // Calculate thread metrics
    const avgSentiment = messages.reduce((sum, m) => sum + m.sentiment_score, 0) / messages.length;
    const avgConfidence = messages.reduce((sum, m) => sum + m.confidence, 0) / messages.length;

    // Find turning points, peaks, and valleys
    const turningPoints = messages
      .filter(m => m.is_turning_point)
      .map(m => ({
        message_id: m.message_id,
        timestamp: m.message_timestamp,
        to_sentiment: m.sentiment,
        change: m.sentiment_change_from_previous || 0,
      }));

    const peaks = messages
      .filter(m => m.sentiment_score > 0.5)
      .sort((a, b) => b.sentiment_score - a.sentiment_score)
      .slice(0, 3)
      .map(m => ({
        message_id: m.message_id,
        timestamp: m.message_timestamp,
        score: m.sentiment_score,
      }));

    const valleys = messages
      .filter(m => m.sentiment_score < -0.3)
      .sort((a, b) => a.sentiment_score - b.sentiment_score)
      .slice(0, 3)
      .map(m => ({
        message_id: m.message_id,
        timestamp: m.message_timestamp,
        score: m.sentiment_score,
      }));

    // Collect all risk signals
    const riskFactors = Array.from(
      new Set(messages.flatMap(m => m.risk_signals))
    );

    // Collect buying signals
    const buyingSignals = Array.from(
      new Set(messages.flatMap(m => m.buying_signals))
    );

    // Calculate engagement level
    const leadMessages = messages.filter(m => m.is_from_lead).length;
    const engagementRatio = leadMessages / messages.length;
    const engagementLevel = 
      engagementRatio > 0.4 ? 'high' :
      engagementRatio > 0.2 ? 'medium' : 'low';

    // Update thread
    const { data: updated, error } = await supabase
      .from('conversation_threads')
      .update({
        turning_points: turningPoints,
        positive_peaks: peaks,
        negative_valleys: valleys,
        risk_factors: riskFactors,
        buying_signals: buyingSignals,
        engagement_level: engagementLevel,
        opportunity_score: buyingSignals.length > 0 ? 0.7 : 0.3,
      })
      .eq('id', thread_id)
      .select()
      .single();

    if (error) throw error;
    return updated;
  }

  /**
   * Check for alerts based on sentiment analysis
   */
  private static async checkForAlerts(
    workspace_id: string,
    thread_id: string,
    message: MessageSentiment,
    thread: ConversationThread
  ): Promise<SentimentAlert[]> {
    const supabase = createClient();
    const alerts: SentimentAlert[] = [];

    // Check for negative sentiment alert
    if (message.sentiment_score < -0.5) {
      alerts.push({
        id: crypto.randomUUID(),
        workspace_id,
        thread_id,
        alert_type: 'negative_sentiment',
        severity: 'critical',
        title: 'Critical Negative Sentiment Detected',
        description: `Message sentiment score of ${message.sentiment_score.toFixed(2)} indicates strong negative emotion`,
        recommended_action: 'Immediate personal outreach recommended',
        triggered_by: 'sentiment_threshold',
        trigger_value: message.sentiment_score,
        threshold_value: -0.5,
        status: 'active',
        auto_action_taken: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    // Check for sentiment decline
    if (thread.sentiment_trend === 'declining' && message.sentiment_change_from_previous! < -0.3) {
      alerts.push({
        id: crypto.randomUUID(),
        workspace_id,
        thread_id,
        alert_type: 'sentiment_decline',
        severity: 'warning',
        title: 'Conversation Sentiment Declining',
        description: 'Sentiment has dropped significantly from previous message',
        recommended_action: 'Review conversation and consider intervention',
        triggered_by: 'sentiment_change',
        trigger_value: message.sentiment_change_from_previous!,
        threshold_value: -0.3,
        status: 'active',
        auto_action_taken: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    // Check for high urgency
    if (message.urgency_level === 'critical' || message.urgency_level === 'high') {
      alerts.push({
        id: crypto.randomUUID(),
        workspace_id,
        thread_id,
        alert_type: 'escalation_needed',
        severity: 'warning',
        title: 'High Urgency Message Detected',
        description: `Message indicates ${message.urgency_level} urgency level`,
        recommended_action: 'Prioritize response to this conversation',
        triggered_by: 'urgency_level',
        status: 'active',
        auto_action_taken: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    // Check for opportunity
    if (message.buying_signals.length > 0) {
      alerts.push({
        id: crypto.randomUUID(),
        workspace_id,
        thread_id,
        alert_type: 'opportunity_detected',
        severity: 'info',
        title: 'Buying Signals Detected',
        description: `Detected signals: ${message.buying_signals.join(', ')}`,
        recommended_action: 'Move to proposal or demo stage',
        triggered_by: 'buying_signals',
        status: 'active',
        auto_action_taken: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    // Save alerts
    if (alerts.length > 0) {
      const { error } = await supabase
        .from('sentiment_alerts')
        .insert(alerts);
      
      if (error) console.error('Error saving alerts:', error);
    }

    return alerts;
  }

  /**
   * Generate recommendations based on analysis
   */
  private static async generateRecommendations(
    thread: ConversationThread,
    messages: MessageSentiment[]
  ): Promise<any> {
    const latestMessage = messages[messages.length - 1];
    const recommendations: any = {};

    // Next best action
    if (thread.risk_level === 'high' || thread.risk_level === 'critical') {
      recommendations.next_best_action = 'Schedule immediate call to address concerns';
      recommendations.risk_mitigation = 'Personal touch needed - consider senior team involvement';
    } else if (thread.buying_signals.length > 0) {
      recommendations.next_best_action = 'Send proposal or schedule demo';
      recommendations.opportunity_actions = [
        'Highlight relevant case studies',
        'Offer limited-time incentive',
        'Connect with decision makers',
      ];
    } else if (thread.engagement_level === 'low') {
      recommendations.next_best_action = 'Re-engage with value proposition';
    } else {
      recommendations.next_best_action = 'Continue nurturing relationship';
    }

    // Suggested response tone
    if (latestMessage.sentiment_score < 0) {
      recommendations.suggested_response_tone = 'empathetic and solution-focused';
    } else if (latestMessage.sentiment_score > 0.5) {
      recommendations.suggested_response_tone = 'enthusiastic and action-oriented';
    } else {
      recommendations.suggested_response_tone = 'professional and informative';
    }

    return recommendations;
  }

  /**
   * Get sentiment trends for a workspace
   */
  static async getSentimentTrends(
    workspace_id: string,
    days: number = 30
  ): Promise<any> {
    const supabase = createClient();
    const cacheKey = `sentiment:trends:${workspace_id}:${days}`;

    // Check cache
    const cached = await cache.get(cacheKey);
    if (cached) return cached;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await supabase
      .from('conversation_threads')
      .select('*')
      .eq('workspace_id', workspace_id)
      .gte('last_message_at', startDate.toISOString())
      .order('last_message_at', { ascending: true });

    if (error) throw error;

    // Process data for trends
    const trends = this.processTrendData(data || []);

    // Cache for 1 hour
    await cache.set(cacheKey, trends, { ttl: 3600 });

    return trends;
  }

  /**
   * Process trend data for visualization
   */
  private static processTrendData(threads: ConversationThread[]): any {
    const dailyData: Record<string, any> = {};
    
    threads.forEach(thread => {
      const date = thread.last_message_at?.split('T')[0];
      if (!date) return;

      if (!dailyData[date]) {
        dailyData[date] = {
          date,
          positive: 0,
          neutral: 0,
          negative: 0,
          total: 0,
          sum_score: 0,
        };
      }

      dailyData[date].total++;
      dailyData[date].sum_score += thread.sentiment_score || 0;

      if (thread.sentiment_score && thread.sentiment_score > 0.2) {
        dailyData[date].positive++;
      } else if (thread.sentiment_score && thread.sentiment_score < -0.2) {
        dailyData[date].negative++;
      } else {
        dailyData[date].neutral++;
      }
    });

    return Object.values(dailyData).map(day => ({
      ...day,
      avg_score: day.total > 0 ? day.sum_score / day.total : 0,
    }));
  }

  /**
   * Get at-risk conversations
   */
  static async getAtRiskConversations(
    workspace_id: string
  ): Promise<ConversationThread[]> {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('conversation_threads')
      .select('*')
      .eq('workspace_id', workspace_id)
      .in('risk_level', ['high', 'critical'])
      .eq('is_active', true)
      .order('risk_level', { ascending: false })
      .limit(10);

    if (error) throw error;
    return data || [];
  }
}