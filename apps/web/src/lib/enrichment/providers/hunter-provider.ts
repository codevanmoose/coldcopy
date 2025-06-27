import {
  EnrichmentProviderAdapter,
  EnrichmentRequest,
  EnrichmentResult,
  EmailValidationResult,
  EmailFinderRequest,
  CompanyEnrichmentRequest,
  EnrichmentProvider
} from '../enrichment-service'

interface HunterEmailFinderResponse {
  data: {
    email: string
    score: number
    sources: Array<{
      domain: string
      uri: string
      extracted_on: string
    }>
  }
  meta: {
    params: Record<string, any>
  }
}

interface HunterEmailVerifierResponse {
  data: {
    status: 'valid' | 'invalid' | 'accept_all' | 'unknown'
    score: number
    email: string
    regexp: boolean
    gibberish: boolean
    disposable: boolean
    webmail: boolean
    mx_records: boolean
    smtp_server: boolean
    smtp_check: boolean
    accept_all: boolean
    block: boolean
    sources: any[]
  }
}

export class HunterProvider extends EnrichmentProviderAdapter {
  private baseUrl = 'https://api.hunter.io/v2'

  constructor(provider: EnrichmentProvider, apiKey: string) {
    super(provider, apiKey)
  }

  async enrichLead(request: EnrichmentRequest): Promise<EnrichmentResult> {
    const startTime = Date.now()
    
    try {
      // Determine the type of enrichment based on input data
      if (request.inputData.email) {
        // Verify email
        const validation = await this.validateEmail(request.inputData.email)
        
        return {
          id: crypto.randomUUID(),
          requestId: request.inputData.requestId || crypto.randomUUID(),
          provider: this.provider.name,
          dataType: 'email',
          data: {
            email: validation.email,
            isValid: validation.isValid,
            isDeliverable: validation.isDeliverable,
            score: validation.score,
            reason: validation.reason
          },
          confidenceScore: validation.score / 100,
          verificationStatus: validation.isValid ? 'verified' : 'invalid',
          processingTimeMs: Date.now() - startTime,
          creditsUsed: this.provider.costPerRequest
        }
      } else if (request.inputData.domain && (request.inputData.firstName || request.inputData.fullName)) {
        // Find email
        const email = await this.findEmail({
          firstName: request.inputData.firstName,
          lastName: request.inputData.lastName,
          fullName: request.inputData.fullName,
          domain: request.inputData.domain
        })
        
        return {
          id: crypto.randomUUID(),
          requestId: request.inputData.requestId || crypto.randomUUID(),
          provider: this.provider.name,
          dataType: 'email',
          data: {
            email,
            source: 'hunter.io'
          },
          confidenceScore: email ? 0.85 : 0,
          verificationStatus: email ? 'unverified' : 'invalid',
          processingTimeMs: Date.now() - startTime,
          creditsUsed: this.provider.costPerRequest
        }
      } else {
        throw new Error('Invalid input data for Hunter provider')
      }
    } catch (error: any) {
      return {
        id: crypto.randomUUID(),
        requestId: request.inputData.requestId || crypto.randomUUID(),
        provider: this.provider.name,
        dataType: 'email',
        data: {},
        confidenceScore: 0,
        verificationStatus: 'invalid',
        processingTimeMs: Date.now() - startTime,
        creditsUsed: 0,
        error: {
          message: error.message,
          code: error.code || 'HUNTER_ERROR'
        }
      }
    }
  }

  async validateEmail(email: string): Promise<EmailValidationResult> {
    return this.executeWithRetry(async () => {
      const response = await fetch(
        `${this.baseUrl}/email-verifier?email=${encodeURIComponent(email)}&api_key=${this.apiKey}`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          }
        }
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.errors?.[0]?.details || 'Email validation failed')
      }

      const result: HunterEmailVerifierResponse = await response.json()
      const { data } = result

      return {
        email: data.email,
        isValid: data.status === 'valid',
        isDeliverable: data.status === 'valid' && data.smtp_check,
        isCatchAll: data.accept_all,
        isDisposable: data.disposable,
        score: data.score,
        reason: this.getValidationReason(data)
      }
    })
  }

  async findEmail(request: EmailFinderRequest): Promise<string | null> {
    return this.executeWithRetry(async () => {
      const params = new URLSearchParams({
        domain: request.domain,
        api_key: this.apiKey!
      })

      if (request.firstName && request.lastName) {
        params.append('first_name', request.firstName)
        params.append('last_name', request.lastName)
      } else if (request.fullName) {
        const [firstName, ...lastNameParts] = request.fullName.split(' ')
        params.append('first_name', firstName)
        params.append('last_name', lastNameParts.join(' '))
      }

      if (request.companyName) {
        params.append('company', request.companyName)
      }

      const response = await fetch(
        `${this.baseUrl}/email-finder?${params.toString()}`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          }
        }
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.errors?.[0]?.details || 'Email finder failed')
      }

      const result: HunterEmailFinderResponse = await response.json()
      return result.data.email || null
    })
  }

  async getCompanyInfo(request: CompanyEnrichmentRequest): Promise<Record<string, any>> {
    // Hunter.io doesn't provide company enrichment, so we return empty data
    // This is here to satisfy the abstract class requirement
    return {}
  }

  private getValidationReason(data: HunterEmailVerifierResponse['data']): string {
    const reasons = []

    if (data.status === 'invalid') {
      if (!data.mx_records) reasons.push('No MX records found')
      if (!data.smtp_server) reasons.push('SMTP server not reachable')
      if (!data.smtp_check) reasons.push('SMTP check failed')
      if (data.gibberish) reasons.push('Email appears to be gibberish')
      if (data.disposable) reasons.push('Disposable email address')
    }

    if (data.status === 'accept_all') {
      reasons.push('Server accepts all email addresses')
    }

    if (data.status === 'unknown') {
      reasons.push('Unable to verify email')
    }

    return reasons.join(', ') || 'Valid email address'
  }
}