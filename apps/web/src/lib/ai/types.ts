export interface LeadInfo {
  name?: string
  email: string
  title?: string
  company?: string
  industry?: string
  location?: string
  customFields?: Record<string, string>
}

export interface CompanyInfo {
  name: string
  description?: string
  website?: string
  industry?: string
}

export interface ProductInfo {
  name: string
  description?: string
  benefits?: string[]
  useCase?: string
  pricing?: string
}

export type EmailTone = 'professional' | 'friendly' | 'casual' | 'formal' | 'enthusiastic'
export type EmailStyle = 'direct' | 'storytelling' | 'problem-solution' | 'benefit-focused' | 'question-based'

export interface AIGenerateOptions {
  leadInfo: LeadInfo
  companyInfo?: CompanyInfo
  productInfo?: ProductInfo
  template?: string
  tone?: EmailTone
  style?: EmailStyle
  temperature?: number
  maxTokens?: number
  model?: string
  customInstructions?: string
  includeUnsubscribe?: boolean
}

export interface AIUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

export interface AIResponse {
  success: boolean
  content?: string
  error?: string
  usage?: AIUsage
  model?: string
}

export interface AIProvider {
  generateEmail(options: AIGenerateOptions): Promise<AIResponse>
  testConnection(): Promise<boolean>
}

export type AIProviderType = 'openai' | 'anthropic'

export interface AIConfig {
  provider: AIProviderType
  apiKey: string
  model?: string
  defaultTone?: EmailTone
  defaultStyle?: EmailStyle
  maxTokensPerRequest?: number
}