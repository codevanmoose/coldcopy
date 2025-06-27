import { OpenAIProvider } from './providers/openai';
import { AnthropicProvider } from './providers/anthropic';
import type { AIProvider, AIProviderType } from './types';

export interface SentimentResult {
  sentiment: 'positive' | 'negative' | 'neutral';
  confidence: number; // 0-1 score
  reasoning: string;
  intent: 'interested' | 'not_interested' | 'meeting_request' | 'question' | 'complaint' | 'unsubscribe' | 'unclear';
  qualificationScore: number; // 0-100 score for lead qualification
  keyPhrases: string[];
  urgency: 'low' | 'medium' | 'high';
}

export interface EmailReplyContext {
  originalSubject: string;
  originalContent: string;
  replyContent: string;
  senderEmail: string;
  leadInfo?: {
    name?: string;
    company?: string;
    title?: string;
    industry?: string;
  };
  campaignInfo?: {
    name: string;
    type: string;
    stage: string;
  };
}

export interface SentimentAnalysisConfig {
  provider: AIProviderType;
  apiKey: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export class SentimentAnalysisService {
  private provider: AIProvider;
  private config: SentimentAnalysisConfig;

  constructor(config: SentimentAnalysisConfig) {
    this.config = config;
    
    switch (config.provider) {
      case 'openai':
        this.provider = new OpenAIProvider(config.apiKey);
        break;
      case 'anthropic':
        this.provider = new AnthropicProvider(config.apiKey);
        break;
      default:
        throw new Error(`Unsupported AI provider: ${config.provider}`);
    }
  }

  /**
   * Analyze email reply sentiment and intent
   */
  async analyzeReply(context: EmailReplyContext): Promise<SentimentResult> {
    const prompt = this.buildAnalysisPrompt(context);
    
    const response = await this.provider.generateEmail({
      leadInfo: { email: context.senderEmail },
      template: prompt,
      temperature: this.config.temperature || 0.3,
      maxTokens: this.config.maxTokens || 500,
      model: this.config.model,
    });

    if (!response.success || !response.content) {
      throw new Error(`Sentiment analysis failed: ${response.error}`);
    }

    try {
      const result = JSON.parse(response.content);
      return this.validateAndNormalizeSentimentResult(result);
    } catch (error) {
      throw new Error(`Failed to parse sentiment analysis result: ${error}`);
    }
  }

  /**
   * Build the AI prompt for sentiment analysis
   */
  private buildAnalysisPrompt(context: EmailReplyContext): string {
    return `
You are an expert email sentiment analyzer for sales and marketing. Analyze the following email reply and return a JSON response with detailed sentiment and intent analysis.

ORIGINAL EMAIL:
Subject: ${context.originalSubject}
Content: ${context.originalContent}

REPLY EMAIL:
From: ${context.senderEmail}
Content: ${context.replyContent}

${context.leadInfo ? `
LEAD INFO:
Name: ${context.leadInfo.name || 'Unknown'}
Company: ${context.leadInfo.company || 'Unknown'}
Title: ${context.leadInfo.title || 'Unknown'}
Industry: ${context.leadInfo.industry || 'Unknown'}
` : ''}

${context.campaignInfo ? `
CAMPAIGN INFO:
Campaign: ${context.campaignInfo.name}
Type: ${context.campaignInfo.type}
Stage: ${context.campaignInfo.stage}
` : ''}

Analyze the reply and return a JSON object with the following structure (no additional text, just the JSON):

{
  "sentiment": "positive|negative|neutral",
  "confidence": 0.85,
  "reasoning": "Brief explanation of why this sentiment was assigned",
  "intent": "interested|not_interested|meeting_request|question|complaint|unsubscribe|unclear",
  "qualificationScore": 75,
  "keyPhrases": ["phrase1", "phrase2", "phrase3"],
  "urgency": "low|medium|high"
}

ANALYSIS GUIDELINES:
- sentiment: Overall emotional tone of the reply
- confidence: How confident you are in the sentiment (0-1)
- reasoning: 1-2 sentence explanation of the analysis
- intent: Primary purpose/intent of the reply
- qualificationScore: Lead qualification score 0-100 based on engagement level, authority indicators, buying signals
- keyPhrases: Important phrases that influenced your analysis (max 5)
- urgency: How quickly this reply should be prioritized

SCORING CRITERIA:
- High qualification (80-100): Clear buying signals, authority indicators, meeting requests, detailed questions
- Medium qualification (50-79): General interest, asking for more info, engaged responses
- Low qualification (0-49): Polite declines, low engagement, unclear responses
- Negative scores: Unsubscribe requests, complaints, clear rejection

Return only the JSON object, no other text.
`;
  }

  /**
   * Validate and normalize the sentiment analysis result
   */
  private validateAndNormalizeSentimentResult(result: any): SentimentResult {
    // Validate required fields
    const requiredFields = ['sentiment', 'confidence', 'reasoning', 'intent', 'qualificationScore', 'keyPhrases', 'urgency'];
    for (const field of requiredFields) {
      if (!(field in result)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Validate sentiment values
    const validSentiments = ['positive', 'negative', 'neutral'];
    if (!validSentiments.includes(result.sentiment)) {
      result.sentiment = 'neutral';
    }

    // Validate intent values
    const validIntents = ['interested', 'not_interested', 'meeting_request', 'question', 'complaint', 'unsubscribe', 'unclear'];
    if (!validIntents.includes(result.intent)) {
      result.intent = 'unclear';
    }

    // Validate urgency values
    const validUrgency = ['low', 'medium', 'high'];
    if (!validUrgency.includes(result.urgency)) {
      result.urgency = 'medium';
    }

    // Normalize numeric values
    result.confidence = Math.max(0, Math.min(1, parseFloat(result.confidence) || 0.5));
    result.qualificationScore = Math.max(0, Math.min(100, parseInt(result.qualificationScore) || 0));

    // Ensure keyPhrases is an array
    if (!Array.isArray(result.keyPhrases)) {
      result.keyPhrases = [];
    }
    result.keyPhrases = result.keyPhrases.slice(0, 5); // Max 5 phrases

    // Ensure reasoning is a string
    result.reasoning = String(result.reasoning || 'No reasoning provided');

    return result as SentimentResult;
  }

  /**
   * Batch analyze multiple replies
   */
  async batchAnalyzeReplies(contexts: EmailReplyContext[]): Promise<SentimentResult[]> {
    const results: SentimentResult[] = [];
    
    // Process in batches to avoid rate limits
    const batchSize = 5;
    for (let i = 0; i < contexts.length; i += batchSize) {
      const batch = contexts.slice(i, i + batchSize);
      const batchPromises = batch.map(context => this.analyzeReply(context));
      
      try {
        const batchResults = await Promise.allSettled(batchPromises);
        
        for (const result of batchResults) {
          if (result.status === 'fulfilled') {
            results.push(result.value);
          } else {
            // Add a default negative result for failed analyses
            results.push({
              sentiment: 'neutral',
              confidence: 0,
              reasoning: `Analysis failed: ${result.reason}`,
              intent: 'unclear',
              qualificationScore: 0,
              keyPhrases: [],
              urgency: 'low',
            });
          }
        }
        
        // Add delay between batches to respect rate limits
        if (i + batchSize < contexts.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error('Batch sentiment analysis error:', error);
        // Add default results for the entire batch
        for (let j = 0; j < batch.length; j++) {
          results.push({
            sentiment: 'neutral',
            confidence: 0,
            reasoning: `Batch analysis failed: ${error}`,
            intent: 'unclear',
            qualificationScore: 0,
            keyPhrases: [],
            urgency: 'low',
          });
        }
      }
    }
    
    return results;
  }

  /**
   * Test the sentiment analysis service
   */
  async testConnection(): Promise<boolean> {
    try {
      const testContext: EmailReplyContext = {
        originalSubject: 'Test Subject',
        originalContent: 'This is a test email.',
        replyContent: 'Thanks for reaching out!',
        senderEmail: 'test@example.com',
      };
      
      const result = await this.analyzeReply(testContext);
      return result.sentiment !== undefined;
    } catch {
      return false;
    }
  }

  /**
   * Get sentiment analysis statistics
   */
  static calculateStats(results: SentimentResult[]) {
    if (results.length === 0) {
      return {
        totalAnalyzed: 0,
        sentimentDistribution: { positive: 0, negative: 0, neutral: 0 },
        intentDistribution: {},
        averageQualificationScore: 0,
        averageConfidence: 0,
        urgencyDistribution: { low: 0, medium: 0, high: 0 },
      };
    }

    const sentimentCounts = { positive: 0, negative: 0, neutral: 0 };
    const intentCounts: Record<string, number> = {};
    const urgencyCounts = { low: 0, medium: 0, high: 0 };
    
    let totalQualificationScore = 0;
    let totalConfidence = 0;

    for (const result of results) {
      sentimentCounts[result.sentiment]++;
      urgencyCounts[result.urgency]++;
      
      intentCounts[result.intent] = (intentCounts[result.intent] || 0) + 1;
      totalQualificationScore += result.qualificationScore;
      totalConfidence += result.confidence;
    }

    return {
      totalAnalyzed: results.length,
      sentimentDistribution: {
        positive: (sentimentCounts.positive / results.length) * 100,
        negative: (sentimentCounts.negative / results.length) * 100,
        neutral: (sentimentCounts.neutral / results.length) * 100,
      },
      intentDistribution: Object.entries(intentCounts).reduce((acc, [intent, count]) => {
        acc[intent] = (count / results.length) * 100;
        return acc;
      }, {} as Record<string, number>),
      averageQualificationScore: totalQualificationScore / results.length,
      averageConfidence: totalConfidence / results.length,
      urgencyDistribution: {
        low: (urgencyCounts.low / results.length) * 100,
        medium: (urgencyCounts.medium / results.length) * 100,
        high: (urgencyCounts.high / results.length) * 100,
      },
    };
  }
}

// Factory function to create sentiment analysis service from environment
export function createSentimentAnalysisService(): SentimentAnalysisService | null {
  const provider = process.env.AI_PROVIDER as AIProviderType;
  const apiKey = process.env.AI_API_KEY;
  
  if (!provider || !apiKey) {
    console.warn('Sentiment analysis service not configured: Missing AI_PROVIDER or AI_API_KEY');
    return null;
  }
  
  return new SentimentAnalysisService({
    provider,
    apiKey,
    model: process.env.AI_MODEL,
    temperature: parseFloat(process.env.AI_TEMPERATURE || '0.3'),
    maxTokens: parseInt(process.env.AI_MAX_TOKENS || '500'),
  });
}