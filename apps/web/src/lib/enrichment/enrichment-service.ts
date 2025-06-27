import { createClient } from '@/lib/supabase/client'
import { SupabaseClient } from '@supabase/supabase-js'

// ====================================
// Type Definitions
// ====================================

export interface EnrichmentProvider {
  id: string
  name: string
  type: ProviderType
  apiEndpoint?: string
  apiKeyRequired: boolean
  rateLimits: RateLimits
  costPerRequest: number
  isActive: boolean
  config: Record<string, any>
}

export type ProviderType = 
  | 'email_finder'
  | 'company_data'
  | 'social_profiles'
  | 'contact_info'
  | 'technographics'
  | 'firmographics'
  | 'intent_data'
  | 'news_monitoring'

export interface RateLimits {
  requestsPerMinute: number
  requestsPerHour: number
  requestsPerDay: number
}

export interface EnrichmentRequest {
  workspaceId: string
  leadId?: string
  providerId: string
  requestType: string
  inputData: Record<string, any>
  priority?: number
}

export interface EnrichmentResult {
  id: string
  requestId: string
  provider: string
  dataType: EnrichedDataType
  data: Record<string, any>
  confidenceScore: number
  verificationStatus: VerificationStatus
  sourceUrl?: string
  processingTimeMs: number
  creditsUsed: number
  error?: {
    message: string
    code: string
  }
}

export type EnrichedDataType = 
  | 'email'
  | 'phone'
  | 'company_info'
  | 'social_profiles'
  | 'job_history'
  | 'technologies'
  | 'funding'
  | 'news'
  | 'intent_signals'
  | 'contact_info'
  | 'demographics'

export type VerificationStatus = 'unverified' | 'verified' | 'invalid' | 'outdated'

export interface EnrichmentCredits {
  workspaceId: string
  providerId?: string
  creditsAvailable: number
  creditsUsed: number
  creditsAllocated: number
  resetPeriod: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'never'
  autoRefill: boolean
  autoRefillAmount?: number
  autoRefillThreshold?: number
}

export interface CacheEntry {
  cacheKey: string
  providerId: string
  queryType: string
  queryParams: Record<string, any>
  cachedData: Record<string, any>
  expiresAt: Date
}

export interface BatchEnrichmentRequest {
  requests: EnrichmentRequest[]
  maxConcurrency?: number
  stopOnError?: boolean
}

export interface EmailValidationResult {
  email: string
  isValid: boolean
  isDeliverable: boolean
  isCatchAll: boolean
  isDisposable: boolean
  score: number
  reason?: string
}

export interface EmailFinderRequest {
  firstName?: string
  lastName?: string
  fullName?: string
  domain: string
  companyName?: string
}

export interface CompanyEnrichmentRequest {
  domain?: string
  companyName?: string
  linkedinUrl?: string
}

// ====================================
// Abstract Provider Interface
// ====================================

export abstract class EnrichmentProviderAdapter {
  protected provider: EnrichmentProvider
  protected apiKey?: string
  protected requestQueue: Array<() => Promise<any>> = []
  protected isProcessing = false
  protected lastRequestTime = 0
  protected requestCounts = {
    minute: 0,
    hour: 0,
    day: 0,
    minuteResetTime: Date.now(),
    hourResetTime: Date.now(),
    dayResetTime: Date.now()
  }

  constructor(provider: EnrichmentProvider, apiKey?: string) {
    this.provider = provider
    this.apiKey = apiKey
  }

  abstract enrichLead(request: EnrichmentRequest): Promise<EnrichmentResult>
  abstract validateEmail(email: string): Promise<EmailValidationResult>
  abstract findEmail(request: EmailFinderRequest): Promise<string | null>
  abstract getCompanyInfo(request: CompanyEnrichmentRequest): Promise<Record<string, any>>

  protected async enforceRateLimit(): Promise<void> {
    const now = Date.now()
    
    // Reset counters if needed
    if (now - this.requestCounts.minuteResetTime > 60000) {
      this.requestCounts.minute = 0
      this.requestCounts.minuteResetTime = now
    }
    if (now - this.requestCounts.hourResetTime > 3600000) {
      this.requestCounts.hour = 0
      this.requestCounts.hourResetTime = now
    }
    if (now - this.requestCounts.dayResetTime > 86400000) {
      this.requestCounts.day = 0
      this.requestCounts.dayResetTime = now
    }

    // Check rate limits
    const { rateLimits } = this.provider
    if (
      this.requestCounts.minute >= rateLimits.requestsPerMinute ||
      this.requestCounts.hour >= rateLimits.requestsPerHour ||
      this.requestCounts.day >= rateLimits.requestsPerDay
    ) {
      // Calculate wait time
      const waitTimes = []
      if (this.requestCounts.minute >= rateLimits.requestsPerMinute) {
        waitTimes.push(60000 - (now - this.requestCounts.minuteResetTime))
      }
      if (this.requestCounts.hour >= rateLimits.requestsPerHour) {
        waitTimes.push(3600000 - (now - this.requestCounts.hourResetTime))
      }
      if (this.requestCounts.day >= rateLimits.requestsPerDay) {
        waitTimes.push(86400000 - (now - this.requestCounts.dayResetTime))
      }
      
      const waitTime = Math.min(...waitTimes)
      await new Promise(resolve => setTimeout(resolve, waitTime))
      return this.enforceRateLimit() // Recursively check again
    }

    // Enforce minimum time between requests
    const minTimeBetweenRequests = 60000 / rateLimits.requestsPerMinute
    const timeSinceLastRequest = now - this.lastRequestTime
    if (timeSinceLastRequest < minTimeBetweenRequests) {
      await new Promise(resolve => setTimeout(resolve, minTimeBetweenRequests - timeSinceLastRequest))
    }

    // Update counters
    this.requestCounts.minute++
    this.requestCounts.hour++
    this.requestCounts.day++
    this.lastRequestTime = Date.now()
  }

  protected async executeWithRetry<T>(
    fn: () => Promise<T>,
    maxRetries = 3,
    baseDelay = 1000
  ): Promise<T> {
    let lastError: any
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        await this.enforceRateLimit()
        return await fn()
      } catch (error: any) {
        lastError = error
        
        // Don't retry on certain errors
        if (
          error.statusCode === 401 || // Unauthorized
          error.statusCode === 403 || // Forbidden
          error.statusCode === 404    // Not found
        ) {
          throw error
        }
        
        if (attempt < maxRetries) {
          // Exponential backoff
          const delay = baseDelay * Math.pow(2, attempt)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }
    
    throw lastError
  }
}

// ====================================
// Provider Registry
// ====================================

export class ProviderRegistry {
  private providers = new Map<string, EnrichmentProviderAdapter>()
  private providerHealthStatus = new Map<string, {
    isHealthy: boolean
    lastCheck: Date
    errorCount: number
    lastError?: string
  }>()

  registerProvider(providerId: string, adapter: EnrichmentProviderAdapter): void {
    this.providers.set(providerId, adapter)
    this.providerHealthStatus.set(providerId, {
      isHealthy: true,
      lastCheck: new Date(),
      errorCount: 0
    })
  }

  getProvider(providerId: string): EnrichmentProviderAdapter | undefined {
    return this.providers.get(providerId)
  }

  getAllProviders(): Map<string, EnrichmentProviderAdapter> {
    return new Map(this.providers)
  }

  async checkProviderHealth(providerId: string): Promise<boolean> {
    const provider = this.providers.get(providerId)
    if (!provider) return false

    try {
      // Perform a simple health check (could be customized per provider)
      await provider.validateEmail('test@example.com')
      
      this.providerHealthStatus.set(providerId, {
        isHealthy: true,
        lastCheck: new Date(),
        errorCount: 0
      })
      
      return true
    } catch (error: any) {
      const status = this.providerHealthStatus.get(providerId)!
      status.isHealthy = false
      status.lastCheck = new Date()
      status.errorCount++
      status.lastError = error.message
      
      return false
    }
  }

  getHealthyProviders(type?: ProviderType): string[] {
    const healthyProviders: string[] = []
    
    for (const [providerId, status] of this.providerHealthStatus) {
      if (status.isHealthy) {
        healthyProviders.push(providerId)
      }
    }
    
    return healthyProviders
  }

  getFallbackProvider(primaryProviderId: string, type: ProviderType): string | null {
    const healthyProviders = this.getHealthyProviders(type)
    return healthyProviders.find(id => id !== primaryProviderId) || null
  }
}

// ====================================
// Enrichment Orchestrator
// ====================================

export class EnrichmentOrchestrator {
  private supabase: SupabaseClient
  private registry: ProviderRegistry

  constructor(supabase: SupabaseClient, registry: ProviderRegistry) {
    this.supabase = supabase
    this.registry = registry
  }

  async enrichFromMultipleProviders(
    request: EnrichmentRequest,
    providerIds: string[]
  ): Promise<EnrichmentResult[]> {
    const results = await Promise.allSettled(
      providerIds.map(providerId => 
        this.enrichWithProvider({ ...request, providerId })
      )
    )

    return results
      .filter(result => result.status === 'fulfilled')
      .map(result => (result as PromiseFulfilledResult<EnrichmentResult>).value)
  }

  async enrichWithProvider(request: EnrichmentRequest): Promise<EnrichmentResult> {
    const provider = this.registry.getProvider(request.providerId)
    if (!provider) {
      throw new Error(`Provider ${request.providerId} not found`)
    }

    const startTime = Date.now()
    
    try {
      const result = await provider.enrichLead(request)
      const processingTime = Date.now() - startTime
      
      return {
        ...result,
        processingTimeMs: processingTime
      }
    } catch (error: any) {
      // Try fallback provider if available
      const fallbackId = this.registry.getFallbackProvider(
        request.providerId,
        'contact_info' // This should be dynamic based on request type
      )
      
      if (fallbackId) {
        return this.enrichWithProvider({ ...request, providerId: fallbackId })
      }
      
      throw error
    }
  }

  mergeEnrichmentResults(results: EnrichmentResult[]): EnrichmentResult {
    if (results.length === 0) {
      throw new Error('No results to merge')
    }
    
    if (results.length === 1) {
      return results[0]
    }

    // Sort by confidence score
    const sortedResults = results.sort((a, b) => b.confidenceScore - a.confidenceScore)
    
    // Start with the highest confidence result
    const merged = { ...sortedResults[0] }
    
    // Merge data from other results
    for (let i = 1; i < sortedResults.length; i++) {
      const result = sortedResults[i]
      
      // Merge data fields that don't exist in the merged result
      for (const [key, value] of Object.entries(result.data)) {
        if (!merged.data[key] && value !== null && value !== undefined) {
          merged.data[key] = value
        }
      }
    }
    
    // Recalculate confidence score as weighted average
    const totalWeight = results.reduce((sum, r) => sum + r.confidenceScore, 0)
    merged.confidenceScore = totalWeight / results.length
    
    // Combine processing times
    merged.processingTimeMs = results.reduce((sum, r) => sum + r.processingTimeMs, 0)
    
    // Sum credits used
    merged.creditsUsed = results.reduce((sum, r) => sum + r.creditsUsed, 0)
    
    return merged
  }

  calculateConfidenceScore(data: Record<string, any>, provider: string): number {
    let score = 0.5 // Base score
    
    // Increase score based on data completeness
    const fields = Object.keys(data)
    const filledFields = fields.filter(key => 
      data[key] !== null && 
      data[key] !== undefined && 
      data[key] !== ''
    )
    
    score += (filledFields.length / fields.length) * 0.3
    
    // Provider-specific adjustments
    const providerScores: Record<string, number> = {
      'clearbit': 0.15,
      'hunter': 0.10,
      'apollo': 0.12,
      'zoominfo': 0.18
    }
    
    score += providerScores[provider.toLowerCase()] || 0.1
    
    return Math.min(score, 1.0)
  }

  normalizeData(data: Record<string, any>, dataType: EnrichedDataType): Record<string, any> {
    switch (dataType) {
      case 'email':
        return this.normalizeEmailData(data)
      case 'company_info':
        return this.normalizeCompanyData(data)
      case 'contact_info':
        return this.normalizeContactData(data)
      default:
        return data
    }
  }

  private normalizeEmailData(data: Record<string, any>): Record<string, any> {
    return {
      email: data.email || data.value || data.address,
      type: data.type || 'work',
      isPrimary: data.isPrimary || data.is_primary || true,
      isVerified: data.isVerified || data.is_verified || data.verified || false,
      verifiedAt: data.verifiedAt || data.verified_at || null
    }
  }

  private normalizeCompanyData(data: Record<string, any>): Record<string, any> {
    return {
      name: data.name || data.companyName || data.company_name,
      domain: data.domain || data.website || data.url,
      industry: data.industry || data.sector,
      size: data.size || data.employeeCount || data.employee_count,
      revenue: data.revenue || data.annual_revenue,
      description: data.description || data.bio,
      founded: data.founded || data.foundedYear || data.founded_year,
      headquarters: data.headquarters || data.hq || data.location,
      socialProfiles: {
        linkedin: data.linkedin || data.linkedinUrl,
        twitter: data.twitter || data.twitterHandle,
        facebook: data.facebook || data.facebookUrl
      }
    }
  }

  private normalizeContactData(data: Record<string, any>): Record<string, any> {
    return {
      firstName: data.firstName || data.first_name || data.givenName,
      lastName: data.lastName || data.last_name || data.familyName,
      fullName: data.fullName || data.full_name || data.name,
      title: data.title || data.jobTitle || data.job_title,
      email: data.email || data.emailAddress || data.email_address,
      phone: data.phone || data.phoneNumber || data.phone_number,
      linkedinUrl: data.linkedinUrl || data.linkedin_url || data.linkedin
    }
  }
}

// ====================================
// Cache Manager
// ====================================

export class CacheManager {
  private supabase: SupabaseClient
  private memoryCache = new Map<string, { data: any; expiresAt: Date }>()

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase
  }

  private generateCacheKey(params: Record<string, any>): string {
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((acc, key) => ({ ...acc, [key]: params[key] }), {})
    
    return Buffer.from(JSON.stringify(sortedParams)).toString('base64')
  }

  async get(
    providerId: string,
    queryType: string,
    queryParams: Record<string, any>
  ): Promise<any | null> {
    const cacheKey = this.generateCacheKey({ providerId, queryType, ...queryParams })
    
    // Check memory cache first
    const memoryEntry = this.memoryCache.get(cacheKey)
    if (memoryEntry && memoryEntry.expiresAt > new Date()) {
      return memoryEntry.data
    }
    
    // Check database cache
    const { data, error } = await this.supabase.rpc('update_cache_hit', {
      p_cache_key: cacheKey
    })
    
    if (!error && data) {
      // Update memory cache
      this.memoryCache.set(cacheKey, {
        data,
        expiresAt: new Date(Date.now() + 3600000) // 1 hour
      })
      
      return data
    }
    
    return null
  }

  async set(
    providerId: string,
    queryType: string,
    queryParams: Record<string, any>,
    data: any,
    ttlSeconds = 3600
  ): Promise<void> {
    const cacheKey = this.generateCacheKey({ providerId, queryType, ...queryParams })
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000)
    
    // Update memory cache
    this.memoryCache.set(cacheKey, { data, expiresAt })
    
    // Update database cache
    await this.supabase.from('enrichment_cache').upsert({
      cache_key: cacheKey,
      provider_id: providerId,
      query_type: queryType,
      query_params: queryParams,
      cached_data: data,
      expires_at: expiresAt.toISOString()
    })
  }

  async invalidate(providerId?: string, queryType?: string): Promise<void> {
    // Clear memory cache
    if (!providerId && !queryType) {
      this.memoryCache.clear()
    } else {
      for (const key of this.memoryCache.keys()) {
        const params = JSON.parse(Buffer.from(key, 'base64').toString())
        if (
          (!providerId || params.providerId === providerId) &&
          (!queryType || params.queryType === queryType)
        ) {
          this.memoryCache.delete(key)
        }
      }
    }
    
    // Clear database cache
    let query = this.supabase.from('enrichment_cache').delete()
    
    if (providerId) {
      query = query.eq('provider_id', providerId)
    }
    
    if (queryType) {
      query = query.eq('query_type', queryType)
    }
    
    await query
  }

  // Cleanup expired entries
  async cleanup(): Promise<void> {
    // Clean memory cache
    const now = new Date()
    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.expiresAt <= now) {
        this.memoryCache.delete(key)
      }
    }
    
    // Database cleanup is handled by the clean_expired_cache() function
    await this.supabase.rpc('clean_expired_cache')
  }
}

// ====================================
// Main Enrichment Service
// ====================================

export class EnrichmentService {
  private supabase: SupabaseClient
  private registry: ProviderRegistry
  private orchestrator: EnrichmentOrchestrator
  private cache: CacheManager
  private requestQueue: Map<string, EnrichmentRequest[]> = new Map()
  private isProcessingQueue = false

  constructor(supabase?: SupabaseClient) {
    this.supabase = supabase || createClient()
    this.registry = new ProviderRegistry()
    this.orchestrator = new EnrichmentOrchestrator(this.supabase, this.registry)
    this.cache = new CacheManager(this.supabase)
    
    // Start queue processor
    this.startQueueProcessor()
    
    // Start cache cleanup
    this.startCacheCleanup()
  }

  // ====================================
  // Provider Management
  // ====================================

  registerProvider(providerId: string, adapter: EnrichmentProviderAdapter): void {
    this.registry.registerProvider(providerId, adapter)
  }

  async loadProvidersFromDatabase(): Promise<void> {
    const { data: providers, error } = await this.supabase
      .from('enrichment_providers')
      .select('*')
      .eq('is_active', true)
    
    if (error) {
      throw new Error(`Failed to load providers: ${error.message}`)
    }
    
    // Note: You would need to implement provider adapters for each provider type
    // This is a placeholder for the actual implementation
    for (const provider of providers || []) {
      // const adapter = createProviderAdapter(provider)
      // this.registerProvider(provider.id, adapter)
    }
  }

  // ====================================
  // Credit Management
  // ====================================

  async checkCredits(
    workspaceId: string,
    providerId: string,
    requiredCredits: number
  ): Promise<boolean> {
    const { data, error } = await this.supabase.rpc('check_enrichment_credits', {
      p_workspace_id: workspaceId,
      p_provider_id: providerId,
      p_required_credits: requiredCredits
    })
    
    if (error) {
      throw new Error(`Failed to check credits: ${error.message}`)
    }
    
    return data || false
  }

  async getCredits(workspaceId: string, providerId?: string): Promise<EnrichmentCredits | null> {
    let query = this.supabase
      .from('enrichment_credits')
      .select('*')
      .eq('workspace_id', workspaceId)
    
    if (providerId) {
      query = query.eq('provider_id', providerId)
    }
    
    const { data, error } = await query.single()
    
    if (error || !data) {
      return null
    }
    
    return {
      workspaceId: data.workspace_id,
      providerId: data.provider_id,
      creditsAvailable: parseFloat(data.credits_available),
      creditsUsed: parseFloat(data.credits_used),
      creditsAllocated: parseFloat(data.credits_allocated),
      resetPeriod: data.reset_period,
      autoRefill: data.auto_refill,
      autoRefillAmount: data.auto_refill_amount ? parseFloat(data.auto_refill_amount) : undefined,
      autoRefillThreshold: data.auto_refill_threshold ? parseFloat(data.auto_refill_threshold) : undefined
    }
  }

  // ====================================
  // Core Enrichment Methods
  // ====================================

  async enrichLead(request: EnrichmentRequest): Promise<EnrichmentResult> {
    // Check cache first
    const cachedResult = await this.cache.get(
      request.providerId,
      request.requestType,
      request.inputData
    )
    
    if (cachedResult) {
      return cachedResult
    }
    
    // Check credits
    const provider = await this.getProvider(request.providerId)
    const hasCredits = await this.checkCredits(
      request.workspaceId,
      request.providerId,
      provider.costPerRequest
    )
    
    if (!hasCredits) {
      throw new Error('Insufficient credits for enrichment request')
    }
    
    // Create request in database
    const { data: requestData, error: requestError } = await this.supabase.rpc(
      'create_enrichment_request',
      {
        p_workspace_id: request.workspaceId,
        p_lead_id: request.leadId,
        p_provider_id: request.providerId,
        p_request_type: request.requestType,
        p_input_data: request.inputData,
        p_priority: request.priority || 5
      }
    )
    
    if (requestError) {
      throw new Error(`Failed to create enrichment request: ${requestError.message}`)
    }
    
    // Process request
    try {
      const result = await this.orchestrator.enrichWithProvider(request)
      
      // Cache result
      await this.cache.set(
        request.providerId,
        request.requestType,
        request.inputData,
        result,
        3600 // 1 hour TTL
      )
      
      // Update request status
      await this.supabase
        .from('enrichment_requests')
        .update({
          status: 'completed',
          output_data: result.data,
          processing_time_ms: result.processingTimeMs,
          completed_at: new Date().toISOString()
        })
        .eq('id', requestData)
      
      // Store enriched data
      if (request.leadId) {
        await this.supabase.from('enriched_data').insert({
          workspace_id: request.workspaceId,
          lead_id: request.leadId,
          data_type: result.dataType,
          provider_id: request.providerId,
          data: result.data,
          confidence_score: result.confidenceScore,
          verification_status: result.verificationStatus,
          source_url: result.sourceUrl
        })
      }
      
      return result
    } catch (error: any) {
      // Update request status
      await this.supabase
        .from('enrichment_requests')
        .update({
          status: 'failed',
          error_message: error.message,
          error_code: error.code || 'UNKNOWN_ERROR',
          completed_at: new Date().toISOString()
        })
        .eq('id', requestData)
      
      throw error
    }
  }

  async enrichBatch(batchRequest: BatchEnrichmentRequest): Promise<EnrichmentResult[]> {
    const { requests, maxConcurrency = 5, stopOnError = false } = batchRequest
    const results: EnrichmentResult[] = []
    const errors: Array<{ request: EnrichmentRequest; error: Error }> = []
    
    // Process in batches
    for (let i = 0; i < requests.length; i += maxConcurrency) {
      const batch = requests.slice(i, i + maxConcurrency)
      const batchResults = await Promise.allSettled(
        batch.map(request => this.enrichLead(request))
      )
      
      for (let j = 0; j < batchResults.length; j++) {
        const result = batchResults[j]
        const request = batch[j]
        
        if (result.status === 'fulfilled') {
          results.push(result.value)
        } else {
          errors.push({ request, error: result.reason })
          
          if (stopOnError) {
            throw new Error(`Batch enrichment failed: ${result.reason.message}`)
          }
        }
      }
    }
    
    return results
  }

  async getEnrichmentHistory(
    workspaceId: string,
    leadId?: string,
    limit = 100,
    offset = 0
  ): Promise<Array<{
    request: any
    result: any
  }>> {
    let query = this.supabase
      .from('enrichment_requests')
      .select(`
        *,
        enriched_data (*)
      `)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)
    
    if (leadId) {
      query = query.eq('lead_id', leadId)
    }
    
    const { data, error } = await query
    
    if (error) {
      throw new Error(`Failed to get enrichment history: ${error.message}`)
    }
    
    return data || []
  }

  async validateEmail(email: string, providerId?: string): Promise<EmailValidationResult> {
    // Use the first available email validation provider if not specified
    const providerToUse = providerId || this.registry.getHealthyProviders('email_finder')[0]
    
    if (!providerToUse) {
      throw new Error('No email validation provider available')
    }
    
    const provider = this.registry.getProvider(providerToUse)
    if (!provider) {
      throw new Error(`Provider ${providerToUse} not found`)
    }
    
    return provider.validateEmail(email)
  }

  async findEmail(request: EmailFinderRequest, providerId?: string): Promise<string | null> {
    // Use the first available email finder provider if not specified
    const providerToUse = providerId || this.registry.getHealthyProviders('email_finder')[0]
    
    if (!providerToUse) {
      throw new Error('No email finder provider available')
    }
    
    const provider = this.registry.getProvider(providerToUse)
    if (!provider) {
      throw new Error(`Provider ${providerToUse} not found`)
    }
    
    return provider.findEmail(request)
  }

  async getCompanyInfo(
    request: CompanyEnrichmentRequest,
    providerId?: string
  ): Promise<Record<string, any>> {
    // Use the first available company data provider if not specified
    const providerToUse = providerId || this.registry.getHealthyProviders('company_data')[0]
    
    if (!providerToUse) {
      throw new Error('No company data provider available')
    }
    
    const provider = this.registry.getProvider(providerToUse)
    if (!provider) {
      throw new Error(`Provider ${providerToUse} not found`)
    }
    
    return provider.getCompanyInfo(request)
  }

  // ====================================
  // Queue Management
  // ====================================

  private async startQueueProcessor(): Promise<void> {
    setInterval(async () => {
      if (this.isProcessingQueue || this.requestQueue.size === 0) {
        return
      }
      
      this.isProcessingQueue = true
      
      try {
        for (const [workspaceId, requests] of this.requestQueue) {
          // Process requests for each workspace
          const batch = requests.splice(0, 10) // Process up to 10 at a time
          
          if (batch.length > 0) {
            await this.enrichBatch({
              requests: batch,
              maxConcurrency: 3,
              stopOnError: false
            })
          }
          
          // Remove workspace from queue if no more requests
          if (requests.length === 0) {
            this.requestQueue.delete(workspaceId)
          }
        }
      } catch (error) {
        console.error('Queue processor error:', error)
      } finally {
        this.isProcessingQueue = false
      }
    }, 5000) // Process every 5 seconds
  }

  async queueEnrichment(request: EnrichmentRequest): Promise<void> {
    const workspaceRequests = this.requestQueue.get(request.workspaceId) || []
    workspaceRequests.push(request)
    this.requestQueue.set(request.workspaceId, workspaceRequests)
  }

  // ====================================
  // Cache Cleanup
  // ====================================

  private startCacheCleanup(): void {
    // Run cleanup every hour
    setInterval(async () => {
      try {
        await this.cache.cleanup()
      } catch (error) {
        console.error('Cache cleanup error:', error)
      }
    }, 3600000) // 1 hour
  }

  // ====================================
  // Helper Methods
  // ====================================

  private async getProvider(providerId: string): Promise<EnrichmentProvider> {
    const { data, error } = await this.supabase
      .from('enrichment_providers')
      .select('*')
      .eq('id', providerId)
      .single()
    
    if (error || !data) {
      throw new Error(`Provider ${providerId} not found`)
    }
    
    return {
      id: data.id,
      name: data.name,
      type: data.type,
      apiEndpoint: data.api_endpoint,
      apiKeyRequired: data.api_key_required,
      rateLimits: data.rate_limits,
      costPerRequest: parseFloat(data.cost_per_request),
      isActive: data.is_active,
      config: data.config
    }
  }

  // ====================================
  // Health Monitoring
  // ====================================

  async getServiceHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy'
    providers: Record<string, boolean>
    queueSize: number
    cacheSize: number
  }> {
    const providerHealth: Record<string, boolean> = {}
    
    for (const [providerId] of this.registry.getAllProviders()) {
      providerHealth[providerId] = await this.registry.checkProviderHealth(providerId)
    }
    
    const healthyCount = Object.values(providerHealth).filter(h => h).length
    const totalCount = Object.keys(providerHealth).length
    
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
    if (healthyCount === 0) {
      status = 'unhealthy'
    } else if (healthyCount < totalCount) {
      status = 'degraded'
    }
    
    return {
      status,
      providers: providerHealth,
      queueSize: Array.from(this.requestQueue.values()).reduce((sum, arr) => sum + arr.length, 0),
      cacheSize: this.cache['memoryCache'].size
    }
  }
}

// Export a singleton instance
export const enrichmentService = new EnrichmentService()