import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/client'

export interface AIProvider {
  id: string
  name: string
  models: AIModel[]
  capabilities: string[]
  costPerToken: number
}

export interface AIModel {
  id: string
  name: string
  description: string
  contextWindow: number
  multiModal: boolean
  capabilities: string[]
  costPer1kTokens: {
    input: number
    output: number
  }
}

export interface AIRequest {
  workspaceId: string
  userId: string
  provider: string
  model: string
  prompt: string
  context?: any
  images?: string[] // Base64 encoded images
  maxTokens?: number
  temperature?: number
  systemPrompt?: string
}

export interface AIResponse {
  content: string
  usage: {
    inputTokens: number
    outputTokens: number
    totalTokens: number
    cost: number
  }
  metadata: {
    model: string
    provider: string
    timestamp: string
    requestId: string
  }
}

// Available AI providers and models
const AI_PROVIDERS: AIProvider[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    models: [
      {
        id: 'gpt-4o',
        name: 'GPT-4o',
        description: 'Most advanced multimodal model with vision capabilities',
        contextWindow: 128000,
        multiModal: true,
        capabilities: ['text', 'vision', 'code', 'reasoning'],
        costPer1kTokens: { input: 0.005, output: 0.015 }
      },
      {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        description: 'Faster, more efficient version of GPT-4o',
        contextWindow: 128000,
        multiModal: true,
        capabilities: ['text', 'vision', 'code'],
        costPer1kTokens: { input: 0.00015, output: 0.0006 }
      },
      {
        id: 'gpt-4-turbo',
        name: 'GPT-4 Turbo',
        description: 'Previous generation flagship model',
        contextWindow: 128000,
        multiModal: true,
        capabilities: ['text', 'vision', 'code'],
        costPer1kTokens: { input: 0.01, output: 0.03 }
      }
    ],
    capabilities: ['chat', 'completion', 'vision', 'function-calling'],
    costPerToken: 0.005
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    models: [
      {
        id: 'claude-3-5-sonnet-20241022',
        name: 'Claude 3.5 Sonnet',
        description: 'Most intelligent model with advanced reasoning',
        contextWindow: 200000,
        multiModal: true,
        capabilities: ['text', 'vision', 'code', 'analysis', 'reasoning'],
        costPer1kTokens: { input: 0.003, output: 0.015 }
      },
      {
        id: 'claude-3-5-haiku-20241022',
        name: 'Claude 3.5 Haiku',
        description: 'Fastest model for quick tasks',
        contextWindow: 200000,
        multiModal: true,
        capabilities: ['text', 'vision', 'code'],
        costPer1kTokens: { input: 0.00025, output: 0.00125 }
      },
      {
        id: 'claude-3-opus-20240229',
        name: 'Claude 3 Opus',
        description: 'Most powerful model for complex tasks',
        contextWindow: 200000,
        multiModal: true,
        capabilities: ['text', 'vision', 'code', 'analysis'],
        costPer1kTokens: { input: 0.015, output: 0.075 }
      }
    ],
    capabilities: ['chat', 'completion', 'vision', 'analysis'],
    costPerToken: 0.003
  }
]

export class AdvancedAIService {
  private openai: OpenAI
  private anthropic: Anthropic
  private supabase = createClient()

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
    })

    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
    })
  }

  getProviders(): AIProvider[] {
    return AI_PROVIDERS
  }

  getModel(providerId: string, modelId: string): AIModel | null {
    const provider = AI_PROVIDERS.find(p => p.id === providerId)
    return provider?.models.find(m => m.id === modelId) || null
  }

  async generateText(request: AIRequest): Promise<AIResponse> {
    const model = this.getModel(request.provider, request.model)
    if (!model) {
      throw new Error(`Model ${request.model} not found for provider ${request.provider}`)
    }

    // Check token balance
    await this.checkTokenBalance(request.workspaceId, model.costPer1kTokens.input)

    let response: AIResponse

    if (request.provider === 'openai') {
      response = await this.generateWithOpenAI(request, model)
    } else if (request.provider === 'anthropic') {
      response = await this.generateWithAnthropic(request, model)
    } else {
      throw new Error(`Provider ${request.provider} not supported`)
    }

    // Log usage and deduct tokens
    await this.logUsage(request, response)

    return response
  }

  private async generateWithOpenAI(request: AIRequest, model: AIModel): Promise<AIResponse> {
    const messages: any[] = []

    if (request.systemPrompt) {
      messages.push({
        role: 'system',
        content: request.systemPrompt
      })
    }

    // Handle multimodal content
    if (request.images && request.images.length > 0 && model.multiModal) {
      const content = [
        { type: 'text', text: request.prompt }
      ]

      for (const image of request.images) {
        content.push({
          type: 'image_url',
          image_url: {
            url: `data:image/jpeg;base64,${image}`,
            detail: 'high'
          }
        })
      }

      messages.push({
        role: 'user',
        content
      })
    } else {
      messages.push({
        role: 'user',
        content: request.prompt
      })
    }

    const completion = await this.openai.chat.completions.create({
      model: request.model,
      messages,
      max_tokens: request.maxTokens || 2000,
      temperature: request.temperature || 0.7,
    })

    const usage = completion.usage!
    const cost = this.calculateCost(usage.prompt_tokens, usage.completion_tokens, model.costPer1kTokens)

    return {
      content: completion.choices[0].message.content || '',
      usage: {
        inputTokens: usage.prompt_tokens,
        outputTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
        cost
      },
      metadata: {
        model: request.model,
        provider: request.provider,
        timestamp: new Date().toISOString(),
        requestId: completion.id
      }
    }
  }

  private async generateWithAnthropic(request: AIRequest, model: AIModel): Promise<AIResponse> {
    const messages: any[] = []

    // Handle multimodal content
    if (request.images && request.images.length > 0 && model.multiModal) {
      const content = [
        { type: 'text', text: request.prompt }
      ]

      for (const image of request.images) {
        content.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: 'image/jpeg',
            data: image
          }
        })
      }

      messages.push({
        role: 'user',
        content
      })
    } else {
      messages.push({
        role: 'user',
        content: request.prompt
      })
    }

    const response = await this.anthropic.messages.create({
      model: request.model,
      max_tokens: request.maxTokens || 2000,
      temperature: request.temperature || 0.7,
      system: request.systemPrompt,
      messages
    })

    const cost = this.calculateCost(response.usage.input_tokens, response.usage.output_tokens, model.costPer1kTokens)

    return {
      content: response.content[0].type === 'text' ? response.content[0].text : '',
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
        cost
      },
      metadata: {
        model: request.model,
        provider: request.provider,
        timestamp: new Date().toISOString(),
        requestId: response.id
      }
    }
  }

  async generateEmailWithContext(workspaceId: string, userId: string, context: {
    leadName?: string
    leadEmail: string
    leadCompany?: string
    leadJobTitle?: string
    campaignGoal: string
    tone: 'professional' | 'casual' | 'friendly' | 'direct'
    length: 'short' | 'medium' | 'long'
    includeCall: boolean
    leadWebsite?: string
    leadLinkedIn?: string
    companyDescription?: string
    recentNews?: string[]
    previousEmails?: string[]
    leadImages?: string[] // Photos of the lead or company for multimodal analysis
  }): Promise<AIResponse> {
    const systemPrompt = `You are an expert cold email writer specializing in B2B outreach. 
    Your goal is to write personalized, engaging emails that get responses.
    
    Key principles:
    - Personalization is crucial - use specific details about the lead and company
    - Keep the tone ${context.tone}
    - Make it ${context.length} in length
    - Focus on value proposition, not just selling
    - Include a clear but soft call-to-action
    - Avoid spam triggers and overly salesy language
    - Use social proof when relevant
    - Reference current events or company news when available`

    let prompt = `Write a cold outreach email with these details:

    LEAD INFORMATION:
    - Name: ${context.leadName || 'there'}
    - Email: ${context.leadEmail}
    - Company: ${context.leadCompany || 'their company'}
    - Job Title: ${context.leadJobTitle || 'professional'}
    
    CAMPAIGN CONTEXT:
    - Goal: ${context.campaignGoal}
    - Tone: ${context.tone}
    - Length: ${context.length}
    - Include call to action: ${context.includeCall ? 'Yes' : 'No'}`

    if (context.leadWebsite) {
      prompt += `\n- Lead Website: ${context.leadWebsite}`
    }

    if (context.companyDescription) {
      prompt += `\n- Company Description: ${context.companyDescription}`
    }

    if (context.recentNews && context.recentNews.length > 0) {
      prompt += `\n- Recent Company News: ${context.recentNews.join(', ')}`
    }

    if (context.previousEmails && context.previousEmails.length > 0) {
      prompt += `\n\nPREVIOUS EMAIL CONTEXT (for follow-ups):
      ${context.previousEmails.join('\n\n---\n\n')}`
    }

    prompt += `\n\nPlease write a compelling, personalized email that would get a response. 
    Include a subject line and email body. Format as:
    
    Subject: [subject line]
    
    [email body]`

    // Use Claude 3.5 Sonnet for best quality email generation
    return this.generateText({
      workspaceId,
      userId,
      provider: 'anthropic',
      model: 'claude-3-5-sonnet-20241022',
      prompt,
      systemPrompt,
      images: context.leadImages,
      temperature: 0.8,
      maxTokens: 1000
    })
  }

  async analyzeLeadImages(workspaceId: string, userId: string, images: string[], context?: {
    leadName?: string
    company?: string
    purpose: 'profile_analysis' | 'company_analysis' | 'personalization'
  }): Promise<AIResponse> {
    const systemPrompt = `You are an expert at analyzing professional images to extract insights for business outreach.
    Extract relevant details that could be used for personalization in business communications.
    
    Focus on:
    - Professional appearance and setting
    - Company branding and culture
    - Office environment and technology
    - Industry indicators
    - Personality traits that could inform communication style
    
    Provide actionable insights for personalized outreach.`

    const prompt = `Analyze these images for business outreach personalization:
    
    ${context?.leadName ? `Lead: ${context.leadName}` : ''}
    ${context?.company ? `Company: ${context.company}` : ''}
    Purpose: ${context?.purpose || 'general analysis'}
    
    Provide insights that could be used to personalize a business email or LinkedIn message.
    Focus on details that show you've done your research without being creepy.`

    return this.generateText({
      workspaceId,
      userId,
      provider: 'openai',
      model: 'gpt-4o',
      prompt,
      systemPrompt,
      images,
      temperature: 0.3,
      maxTokens: 500
    })
  }

  async optimizeEmailContent(workspaceId: string, userId: string, emailContent: string, context: {
    target: 'deliverability' | 'engagement' | 'conversion'
    industry?: string
    audience?: string
  }): Promise<AIResponse> {
    const systemPrompt = `You are an email optimization expert. Analyze and improve email content for:
    - Deliverability (avoiding spam filters)
    - Engagement (higher open and click rates)  
    - Conversion (better response rates)
    
    Provide specific suggestions and an optimized version.`

    const prompt = `Optimize this email for ${context.target}:
    
    ORIGINAL EMAIL:
    ${emailContent}
    
    CONTEXT:
    - Industry: ${context.industry || 'General B2B'}
    - Audience: ${context.audience || 'Business professionals'}
    - Optimization Target: ${context.target}
    
    Please provide:
    1. Analysis of current issues
    2. Specific improvement suggestions
    3. Optimized version of the email
    4. Expected improvement score (1-10)`

    return this.generateText({
      workspaceId,
      userId,
      provider: 'anthropic',
      model: 'claude-3-5-sonnet-20241022',
      prompt,
      systemPrompt,
      temperature: 0.5,
      maxTokens: 1500
    })
  }

  private calculateCost(inputTokens: number, outputTokens: number, pricing: { input: number, output: number }): number {
    return (inputTokens / 1000 * pricing.input) + (outputTokens / 1000 * pricing.output)
  }

  private async checkTokenBalance(workspaceId: string, estimatedCost: number): Promise<void> {
    const { data: workspace } = await this.supabase
      .from('workspaces')
      .select('ai_tokens_balance')
      .eq('id', workspaceId)
      .single()

    if (!workspace) {
      throw new Error('Workspace not found')
    }

    const requiredTokens = Math.ceil(estimatedCost * 1000) // Convert to token count
    if (workspace.ai_tokens_balance < requiredTokens) {
      throw new Error('Insufficient AI tokens. Please purchase more tokens.')
    }
  }

  private async logUsage(request: AIRequest, response: AIResponse): Promise<void> {
    // Deduct tokens from workspace balance
    await this.supabase.rpc('deduct_ai_tokens', {
      p_workspace_id: request.workspaceId,
      p_tokens_used: response.usage.totalTokens
    })

    // Log the usage for analytics
    await this.supabase
      .from('ai_usage_logs')
      .insert({
        workspace_id: request.workspaceId,
        user_id: request.userId,
        provider: request.provider,
        model: request.model,
        input_tokens: response.usage.inputTokens,
        output_tokens: response.usage.outputTokens,
        total_tokens: response.usage.totalTokens,
        cost: response.usage.cost,
        request_type: 'text_generation',
        metadata: {
          has_images: !!(request.images && request.images.length > 0),
          prompt_length: request.prompt.length,
          response_length: response.content.length,
        }
      })
  }
}

// Export singleton instance
export const advancedAI = new AdvancedAIService()