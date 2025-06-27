import {
  EnrichmentProviderAdapter,
  EnrichmentRequest,
  EnrichmentResult,
  EmailValidationResult,
  EmailFinderRequest,
  CompanyEnrichmentRequest,
  EnrichmentProvider
} from '../enrichment-service'

interface ClearbitPersonResponse {
  id: string
  name: {
    fullName: string
    givenName: string
    familyName: string
  }
  email: string
  location: string
  bio: string
  site: string
  avatar: string
  employment: {
    domain: string
    name: string
    title: string
    role: string
    seniority: string
  }
  linkedin: {
    handle: string
  }
  twitter: {
    handle: string
    followers: number
  }
  github: {
    handle: string
    followers: number
  }
  facebook: {
    handle: string
  }
}

interface ClearbitCompanyResponse {
  id: string
  name: string
  legalName: string
  domain: string
  domainAliases: string[]
  site: {
    phoneNumbers: string[]
    emailAddresses: string[]
  }
  category: {
    sector: string
    industryGroup: string
    industry: string
    subIndustry: string
    sicCode: string
    naicsCode: string
  }
  tags: string[]
  description: string
  foundedYear: number
  location: string
  timeZone: string
  utcOffset: number
  geo: {
    streetNumber: string
    streetName: string
    subPremise: string
    city: string
    state: string
    stateCode: string
    postalCode: string
    country: string
    countryCode: string
    lat: number
    lng: number
  }
  logo: string
  facebook: {
    handle: string
    likes: number
  }
  linkedin: {
    handle: string
  }
  twitter: {
    handle: string
    followers: number
  }
  crunchbase: {
    handle: string
  }
  emailProvider: boolean
  type: string
  ticker: string
  identifiers: {
    usEIN: string
  }
  phone: string
  metrics: {
    alexaUsRank: number
    alexaGlobalRank: number
    employees: number
    employeesRange: string
    marketCap: number
    raised: number
    annualRevenue: number
    estimatedAnnualRevenue: string
    fiscalYearEnd: number
  }
  indexedAt: string
  tech: string[]
  techCategories: string[]
  parent: {
    domain: string
  }
  ultimateParent: {
    domain: string
  }
}

export class ClearbitProvider extends EnrichmentProviderAdapter {
  private personApiUrl = 'https://person.clearbit.com/v2/people/find'
  private companyApiUrl = 'https://company.clearbit.com/v2/companies/find'

  constructor(provider: EnrichmentProvider, apiKey: string) {
    super(provider, apiKey)
  }

  async enrichLead(request: EnrichmentRequest): Promise<EnrichmentResult> {
    const startTime = Date.now()
    
    try {
      if (request.inputData.email) {
        // Enrich person by email
        const person = await this.enrichPerson(request.inputData.email)
        
        return {
          id: crypto.randomUUID(),
          requestId: request.inputData.requestId || crypto.randomUUID(),
          provider: this.provider.name,
          dataType: 'contact_info',
          data: this.normalizePersonData(person),
          confidenceScore: 0.95,
          verificationStatus: 'verified',
          sourceUrl: `https://clearbit.com/people/${person.email}`,
          processingTimeMs: Date.now() - startTime,
          creditsUsed: this.provider.costPerRequest
        }
      } else if (request.inputData.domain || request.inputData.companyName) {
        // Enrich company
        const company = await this.getCompanyInfo({
          domain: request.inputData.domain,
          companyName: request.inputData.companyName
        })
        
        return {
          id: crypto.randomUUID(),
          requestId: request.inputData.requestId || crypto.randomUUID(),
          provider: this.provider.name,
          dataType: 'company_info',
          data: company,
          confidenceScore: 0.9,
          verificationStatus: 'verified',
          sourceUrl: `https://clearbit.com/companies/${request.inputData.domain}`,
          processingTimeMs: Date.now() - startTime,
          creditsUsed: this.provider.costPerRequest
        }
      } else {
        throw new Error('Invalid input data for Clearbit provider')
      }
    } catch (error: any) {
      return {
        id: crypto.randomUUID(),
        requestId: request.inputData.requestId || crypto.randomUUID(),
        provider: this.provider.name,
        dataType: 'contact_info',
        data: {},
        confidenceScore: 0,
        verificationStatus: 'invalid',
        processingTimeMs: Date.now() - startTime,
        creditsUsed: 0,
        error: {
          message: error.message,
          code: error.code || 'CLEARBIT_ERROR'
        }
      }
    }
  }

  async validateEmail(email: string): Promise<EmailValidationResult> {
    // Clearbit doesn't have a dedicated email validation endpoint
    // We'll use the person enrichment to validate
    try {
      const person = await this.enrichPerson(email)
      
      return {
        email: person.email,
        isValid: true,
        isDeliverable: true,
        isCatchAll: false,
        isDisposable: false,
        score: 95,
        reason: 'Email found in Clearbit database'
      }
    } catch (error) {
      return {
        email,
        isValid: false,
        isDeliverable: false,
        isCatchAll: false,
        isDisposable: false,
        score: 0,
        reason: 'Email not found in Clearbit database'
      }
    }
  }

  async findEmail(request: EmailFinderRequest): Promise<string | null> {
    // Clearbit doesn't have email finder functionality
    // This would require combining with company data
    return null
  }

  async getCompanyInfo(request: CompanyEnrichmentRequest): Promise<Record<string, any>> {
    return this.executeWithRetry(async () => {
      const params = new URLSearchParams()
      
      if (request.domain) {
        params.append('domain', request.domain)
      } else if (request.companyName) {
        params.append('name', request.companyName)
      } else {
        throw new Error('Either domain or company name is required')
      }

      const response = await fetch(
        `${this.companyApiUrl}?${params.toString()}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Accept': 'application/json'
          }
        }
      )

      if (response.status === 404) {
        return {}
      }

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error?.message || 'Company enrichment failed')
      }

      const company: ClearbitCompanyResponse = await response.json()
      return this.normalizeCompanyData(company)
    })
  }

  private async enrichPerson(email: string): Promise<ClearbitPersonResponse> {
    return this.executeWithRetry(async () => {
      const response = await fetch(
        `${this.personApiUrl}?email=${encodeURIComponent(email)}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Accept': 'application/json'
          }
        }
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error?.message || 'Person enrichment failed')
      }

      return response.json()
    })
  }

  private normalizePersonData(person: ClearbitPersonResponse): Record<string, any> {
    return {
      id: person.id,
      email: person.email,
      fullName: person.name.fullName,
      firstName: person.name.givenName,
      lastName: person.name.familyName,
      location: person.location,
      bio: person.bio,
      avatar: person.avatar,
      employment: {
        company: person.employment.name,
        domain: person.employment.domain,
        title: person.employment.title,
        role: person.employment.role,
        seniority: person.employment.seniority
      },
      socialProfiles: {
        linkedin: person.linkedin?.handle ? `https://linkedin.com/in/${person.linkedin.handle}` : null,
        twitter: person.twitter?.handle ? `https://twitter.com/${person.twitter.handle}` : null,
        github: person.github?.handle ? `https://github.com/${person.github.handle}` : null,
        facebook: person.facebook?.handle ? `https://facebook.com/${person.facebook.handle}` : null
      },
      website: person.site
    }
  }

  private normalizeCompanyData(company: ClearbitCompanyResponse): Record<string, any> {
    return {
      id: company.id,
      name: company.name,
      legalName: company.legalName,
      domain: company.domain,
      domainAliases: company.domainAliases,
      description: company.description,
      industry: company.category?.industry,
      sector: company.category?.sector,
      subIndustry: company.category?.subIndustry,
      tags: company.tags,
      foundedYear: company.foundedYear,
      location: {
        address: company.location,
        city: company.geo?.city,
        state: company.geo?.state,
        country: company.geo?.country,
        postalCode: company.geo?.postalCode,
        coordinates: {
          lat: company.geo?.lat,
          lng: company.geo?.lng
        }
      },
      logo: company.logo,
      phone: company.phone,
      employees: company.metrics?.employees,
      employeesRange: company.metrics?.employeesRange,
      revenue: company.metrics?.annualRevenue,
      estimatedRevenue: company.metrics?.estimatedAnnualRevenue,
      raised: company.metrics?.raised,
      marketCap: company.metrics?.marketCap,
      technologies: company.tech,
      techCategories: company.techCategories,
      socialProfiles: {
        linkedin: company.linkedin?.handle ? `https://linkedin.com/company/${company.linkedin.handle}` : null,
        twitter: company.twitter?.handle ? `https://twitter.com/${company.twitter.handle}` : null,
        facebook: company.facebook?.handle ? `https://facebook.com/${company.facebook.handle}` : null,
        crunchbase: company.crunchbase?.handle ? `https://crunchbase.com/organization/${company.crunchbase.handle}` : null
      },
      type: company.type,
      ticker: company.ticker,
      emailProvider: company.emailProvider,
      parent: company.parent,
      ultimateParent: company.ultimateParent
    }
  }
}