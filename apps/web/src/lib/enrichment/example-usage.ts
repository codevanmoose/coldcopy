/**
 * Example usage of the Enrichment Service
 * 
 * This file demonstrates how to use the enrichment service in your application
 */

import { 
  enrichmentService,
  EnrichmentRequest,
  BatchEnrichmentRequest,
  EmailFinderRequest,
  CompanyEnrichmentRequest,
  createProviderAdapter
} from './index'

// ====================================
// 1. Initialize the service
// ====================================

async function initializeEnrichmentService() {
  // Load providers from database
  await enrichmentService.loadProvidersFromDatabase()
  
  // Or manually register providers
  const hunterProvider = {
    id: 'hunter-123',
    name: 'Hunter.io',
    type: 'email_finder' as const,
    apiEndpoint: 'https://api.hunter.io/v2',
    apiKeyRequired: true,
    rateLimits: {
      requestsPerMinute: 60,
      requestsPerHour: 500,
      requestsPerDay: 2000
    },
    costPerRequest: 0.005,
    isActive: true,
    config: {}
  }
  
  const hunterAdapter = createProviderAdapter(hunterProvider, process.env.HUNTER_API_KEY!)
  if (hunterAdapter) {
    enrichmentService.registerProvider('hunter-123', hunterAdapter)
  }
}

// ====================================
// 2. Single lead enrichment
// ====================================

async function enrichSingleLead() {
  const request: EnrichmentRequest = {
    workspaceId: 'workspace-123',
    leadId: 'lead-456',
    providerId: 'hunter-123',
    requestType: 'email_verification',
    inputData: {
      email: 'john.doe@example.com'
    },
    priority: 5
  }
  
  try {
    const result = await enrichmentService.enrichLead(request)
    console.log('Enrichment result:', result)
    
    // Check if email is valid
    if (result.dataType === 'email' && result.data.isValid) {
      console.log('Email is valid with score:', result.data.score)
    }
  } catch (error) {
    console.error('Enrichment failed:', error)
  }
}

// ====================================
// 3. Batch enrichment
// ====================================

async function enrichBatchLeads() {
  const batchRequest: BatchEnrichmentRequest = {
    requests: [
      {
        workspaceId: 'workspace-123',
        leadId: 'lead-1',
        providerId: 'hunter-123',
        requestType: 'email_finder',
        inputData: {
          firstName: 'John',
          lastName: 'Doe',
          domain: 'example.com'
        }
      },
      {
        workspaceId: 'workspace-123',
        leadId: 'lead-2',
        providerId: 'clearbit-456',
        requestType: 'company_enrichment',
        inputData: {
          domain: 'example.com'
        }
      }
    ],
    maxConcurrency: 5,
    stopOnError: false
  }
  
  const results = await enrichmentService.enrichBatch(batchRequest)
  console.log(`Enriched ${results.length} leads`)
}

// ====================================
// 4. Email validation
// ====================================

async function validateEmail() {
  try {
    const validation = await enrichmentService.validateEmail(
      'test@example.com',
      'hunter-123' // Optional: specify provider
    )
    
    console.log('Email validation result:', {
      isValid: validation.isValid,
      isDeliverable: validation.isDeliverable,
      score: validation.score,
      reason: validation.reason
    })
  } catch (error) {
    console.error('Email validation failed:', error)
  }
}

// ====================================
// 5. Email finder
// ====================================

async function findEmail() {
  const request: EmailFinderRequest = {
    firstName: 'John',
    lastName: 'Doe',
    domain: 'example.com',
    companyName: 'Example Corp'
  }
  
  try {
    const email = await enrichmentService.findEmail(request)
    if (email) {
      console.log('Found email:', email)
    } else {
      console.log('Email not found')
    }
  } catch (error) {
    console.error('Email finder failed:', error)
  }
}

// ====================================
// 6. Company enrichment
// ====================================

async function enrichCompany() {
  const request: CompanyEnrichmentRequest = {
    domain: 'example.com',
    // or
    // companyName: 'Example Corp'
  }
  
  try {
    const companyInfo = await enrichmentService.getCompanyInfo(request)
    console.log('Company info:', companyInfo)
  } catch (error) {
    console.error('Company enrichment failed:', error)
  }
}

// ====================================
// 7. Check credits
// ====================================

async function checkCredits() {
  const workspaceId = 'workspace-123'
  const providerId = 'hunter-123'
  
  // Check if we have enough credits
  const hasCredits = await enrichmentService.checkCredits(
    workspaceId,
    providerId,
    0.005 // Required credits
  )
  
  if (hasCredits) {
    console.log('Sufficient credits available')
  } else {
    console.log('Insufficient credits')
  }
  
  // Get current credit balance
  const credits = await enrichmentService.getCredits(workspaceId, providerId)
  if (credits) {
    console.log('Credits available:', credits.creditsAvailable)
    console.log('Credits used:', credits.creditsUsed)
  }
}

// ====================================
// 8. Get enrichment history
// ====================================

async function getHistory() {
  const history = await enrichmentService.getEnrichmentHistory(
    'workspace-123',
    'lead-456', // Optional: filter by lead
    50, // Limit
    0   // Offset
  )
  
  history.forEach(item => {
    console.log('Request:', item.request)
    console.log('Result:', item.result)
  })
}

// ====================================
// 9. Queue enrichment for async processing
// ====================================

async function queueEnrichment() {
  const request: EnrichmentRequest = {
    workspaceId: 'workspace-123',
    leadId: 'lead-789',
    providerId: 'clearbit-456',
    requestType: 'full_enrichment',
    inputData: {
      email: 'jane.doe@example.com'
    },
    priority: 8 // Lower priority
  }
  
  await enrichmentService.queueEnrichment(request)
  console.log('Enrichment queued for processing')
}

// ====================================
// 10. Check service health
// ====================================

async function checkHealth() {
  const health = await enrichmentService.getServiceHealth()
  
  console.log('Service status:', health.status)
  console.log('Provider health:', health.providers)
  console.log('Queue size:', health.queueSize)
  console.log('Cache size:', health.cacheSize)
}

// ====================================
// 11. Multiple provider enrichment with merging
// ====================================

async function enrichWithMultipleProviders() {
  const orchestrator = enrichmentService['orchestrator']
  
  const request: EnrichmentRequest = {
    workspaceId: 'workspace-123',
    leadId: 'lead-999',
    providerId: '', // Will be overridden
    requestType: 'contact_enrichment',
    inputData: {
      email: 'john.smith@techcorp.com'
    }
  }
  
  // Enrich with multiple providers
  const results = await orchestrator.enrichFromMultipleProviders(
    request,
    ['hunter-123', 'clearbit-456', 'apollo-789']
  )
  
  // Merge results
  if (results.length > 0) {
    const merged = orchestrator.mergeEnrichmentResults(results)
    console.log('Merged enrichment data:', merged)
  }
}

// ====================================
// Example React Hook Usage
// ====================================

/**
 * Example React hook for using the enrichment service
 */
export function useEnrichment() {
  const enrichLead = async (leadId: string, email: string) => {
    try {
      const result = await enrichmentService.enrichLead({
        workspaceId: 'current-workspace-id',
        leadId,
        providerId: 'default-provider',
        requestType: 'email_verification',
        inputData: { email }
      })
      
      return result
    } catch (error) {
      console.error('Enrichment error:', error)
      throw error
    }
  }
  
  const validateEmail = async (email: string) => {
    return enrichmentService.validateEmail(email)
  }
  
  const getCredits = async () => {
    return enrichmentService.getCredits('current-workspace-id')
  }
  
  return {
    enrichLead,
    validateEmail,
    getCredits
  }
}

// ====================================
// Next.js API Route Example
// ====================================

/**
 * Example Next.js API route handler
 */
export async function enrichmentApiHandler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  
  const { leadId, email, providerId } = req.body
  
  try {
    const result = await enrichmentService.enrichLead({
      workspaceId: req.session.workspaceId,
      leadId,
      providerId,
      requestType: 'email_enrichment',
      inputData: { email }
    })
    
    res.status(200).json(result)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
}