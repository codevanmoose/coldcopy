import { OpenAI } from 'openai'
import type { AIProvider, AIGenerateOptions, AIResponse } from '../types'

export class OpenAIProvider implements AIProvider {
  private client: OpenAI
  
  constructor(apiKey: string) {
    this.client = new OpenAI({
      apiKey,
    })
  }

  async generateEmail(options: AIGenerateOptions): Promise<AIResponse> {
    try {
      const systemPrompt = this.buildSystemPrompt(options)
      const userPrompt = this.buildUserPrompt(options)

      const completion = await this.client.chat.completions.create({
        model: options.model || 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 500,
      })

      const content = completion.choices[0]?.message?.content || ''
      const usage = completion.usage

      return {
        success: true,
        content,
        usage: {
          promptTokens: usage?.prompt_tokens || 0,
          completionTokens: usage?.completion_tokens || 0,
          totalTokens: usage?.total_tokens || 0,
        },
        model: completion.model,
      }
    } catch (error) {
      console.error('OpenAI generation error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate email',
      }
    }
  }

  private buildSystemPrompt(options: AIGenerateOptions): string {
    const { tone, style, includeUnsubscribe } = options
    
    return `You are an expert cold email copywriter. Generate professional, engaging cold emails that:
- Are personalized and relevant to the recipient
- Have a clear value proposition
- Include a specific call-to-action
- Are concise and respect the reader's time
- Use a ${tone || 'professional'} tone
- Follow a ${style || 'direct'} writing style
${includeUnsubscribe ? '- Include a polite unsubscribe option at the end' : ''}

Important guidelines:
- Keep the email under 150 words
- Use short paragraphs (2-3 sentences max)
- Avoid spam trigger words
- Don't use excessive punctuation or ALL CAPS
- Make the subject line compelling but not clickbait`
  }

  private buildUserPrompt(options: AIGenerateOptions): string {
    const { leadInfo, companyInfo, productInfo, template, customInstructions } = options
    
    let prompt = 'Generate a cold email with the following information:\n\n'
    
    if (leadInfo) {
      prompt += `RECIPIENT INFORMATION:\n`
      prompt += `- Name: ${leadInfo.name || 'Unknown'}\n`
      prompt += `- Title: ${leadInfo.title || 'Unknown'}\n`
      prompt += `- Company: ${leadInfo.company || 'Unknown'}\n`
      if (leadInfo.industry) prompt += `- Industry: ${leadInfo.industry}\n`
      if (leadInfo.customFields) {
        Object.entries(leadInfo.customFields).forEach(([key, value]) => {
          prompt += `- ${key}: ${value}\n`
        })
      }
      prompt += '\n'
    }
    
    if (companyInfo) {
      prompt += `SENDER COMPANY:\n`
      prompt += `- Name: ${companyInfo.name}\n`
      if (companyInfo.description) prompt += `- Description: ${companyInfo.description}\n`
      if (companyInfo.website) prompt += `- Website: ${companyInfo.website}\n`
      prompt += '\n'
    }
    
    if (productInfo) {
      prompt += `PRODUCT/SERVICE:\n`
      prompt += `- Name: ${productInfo.name}\n`
      if (productInfo.description) prompt += `- Description: ${productInfo.description}\n`
      if (productInfo.benefits) prompt += `- Key Benefits: ${productInfo.benefits.join(', ')}\n`
      if (productInfo.useCase) prompt += `- Use Case: ${productInfo.useCase}\n`
      prompt += '\n'
    }
    
    if (template) {
      prompt += `TEMPLATE TO FOLLOW:\n${template}\n\n`
      prompt += `Use this template as a guide but personalize it based on the recipient information.\n\n`
    }
    
    if (customInstructions) {
      prompt += `ADDITIONAL INSTRUCTIONS:\n${customInstructions}\n\n`
    }
    
    prompt += 'Generate both a subject line and email body. Format as:\nSubject: [subject line]\n\n[email body]'
    
    return prompt
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await this.client.models.list()
      return !!response.data
    } catch (error) {
      console.error('OpenAI connection test failed:', error)
      return false
    }
  }
}