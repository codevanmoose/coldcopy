import { OpenAIProvider } from './providers/openai'
import { AnthropicProvider } from './providers/anthropic'
import type { AIProvider, AIProviderType, AIConfig } from './types'

export * from './types'

export class AIService {
  private provider: AIProvider
  
  constructor(config: AIConfig) {
    switch (config.provider) {
      case 'openai':
        this.provider = new OpenAIProvider(config.apiKey)
        break
      case 'anthropic':
        this.provider = new AnthropicProvider(config.apiKey)
        break
      default:
        throw new Error(`Unsupported AI provider: ${config.provider}`)
    }
  }
  
  async generateEmail(options: Parameters<AIProvider['generateEmail']>[0]) {
    return this.provider.generateEmail(options)
  }
  
  async testConnection() {
    return this.provider.testConnection()
  }
}

// Factory function to create AI service from environment
export function createAIService(): AIService | null {
  const provider = process.env.AI_PROVIDER as AIProviderType
  const apiKey = process.env.AI_API_KEY
  
  if (!provider || !apiKey) {
    console.warn('AI service not configured: Missing AI_PROVIDER or AI_API_KEY')
    return null
  }
  
  return new AIService({
    provider,
    apiKey,
  })
}