import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { enrichmentService } from '@/lib/enrichment/enrichment-service'
import { enqueueJob, JobPriority } from '@/lib/enrichment/job-processor'
import { gdprService } from '@/lib/gdpr/gdpr-service'
import { ConsentType, AuditActionCategory, LegalBasis } from '@/lib/gdpr/types'
import { z } from 'zod'

const enrichRequestSchema = z.object({
  leadIds: z.array(z.string()).min(1),
  options: z.array(z.string()).min(1),
  providerId: z.string(),
  priority: z.number().min(1).max(5).optional().default(3),
  useJobQueue: z.boolean().optional().default(true),
  webhookUrl: z.string().url().optional(),
  checkConsent: z.boolean().optional().default(true),
  legalBasis: z.enum(['consent', 'legitimate_interests', 'contract']).optional().default('legitimate_interests'),
  purpose: z.string().optional().default('lead_enrichment')
})

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse and validate request body
    const body = await request.json()
    const validatedData = enrichRequestSchema.parse(body)
    
    // Get user's workspace
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('workspace_id')
      .eq('id', user.id)
      .single()
    
    if (profileError || !profile?.workspace_id) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }

    const workspaceId = profile.workspace_id

    // Verify leads belong to workspace
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('id, email, first_name, last_name, company, title, phone, custom_fields')
      .in('id', validatedData.leadIds)
      .eq('workspace_id', workspaceId)
    
    if (leadsError || !leads) {
      return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 })
    }

    if (leads.length !== validatedData.leadIds.length) {
      return NextResponse.json({ error: 'Some leads not found or unauthorized' }, { status: 403 })
    }

    // Check data processing consent if required
    const consentResults = []
    if (validatedData.checkConsent && validatedData.legalBasis === 'consent') {
      for (const lead of leads) {
        try {
          const consentCheck = await gdprService.checkConsent({
            workspaceId,
            leadId: lead.id,
            consentTypes: [ConsentType.DATA_PROCESSING, ConsentType.PROFILING],
          })
          
          const hasDataProcessingConsent = consentCheck.consents[ConsentType.DATA_PROCESSING]?.granted
          const hasProfilingConsent = consentCheck.consents[ConsentType.PROFILING]?.granted
          
          if (!hasDataProcessingConsent || !hasProfilingConsent) {
            consentResults.push({
              leadId: lead.id,
              hasConsent: false,
              missingConsents: [
                !hasDataProcessingConsent && ConsentType.DATA_PROCESSING,
                !hasProfilingConsent && ConsentType.PROFILING,
              ].filter(Boolean),
            })
          } else {
            consentResults.push({
              leadId: lead.id,
              hasConsent: true,
            })
          }
        } catch (error) {
          console.error('Failed to check consent for lead:', lead.id, error)
          // Fail open - allow enrichment if consent check fails
          consentResults.push({
            leadId: lead.id,
            hasConsent: true,
            checkFailed: true,
          })
        }
      }
      
      // Filter out leads without consent
      const leadsWithoutConsent = consentResults.filter(r => !r.hasConsent)
      if (leadsWithoutConsent.length > 0) {
        return NextResponse.json({
          error: 'Some leads do not have data processing consent',
          leadsWithoutConsent: leadsWithoutConsent.map(r => r.leadId),
          requiresConsent: true,
        }, { status: 403 })
      }
    }

    // Calculate total credits required
    const creditsPerOption = {
      email: 1,
      phone: 2,
      company: 1,
      social: 1,
      title: 1,
      technographics: 2
    }

    const totalCreditsRequired = validatedData.options.reduce((sum, option) => {
      return sum + (creditsPerOption[option as keyof typeof creditsPerOption] || 1)
    }, 0) * leads.length

    // Check credits
    const hasCredits = await enrichmentService.checkCredits(
      workspaceId,
      validatedData.providerId,
      totalCreditsRequired
    )

    if (!hasCredits) {
      return NextResponse.json({ 
        error: 'Insufficient credits',
        required: totalCreditsRequired
      }, { status: 402 })
    }

    // Check if should use job queue or process immediately
    if (validatedData.useJobQueue && validatedData.leadIds.length > 1) {
      // Use job queue for batch processing
      const jobId = await enqueueJob(
        'batch_lead_enrichment',
        workspaceId,
        {
          leadIds: validatedData.leadIds,
          providerId: validatedData.providerId,
          enrichmentTypes: validatedData.options,
          inputData: leads.reduce((acc, lead) => {
            acc[lead.id] = {
              firstName: lead.first_name,
              lastName: lead.last_name,
              company: lead.company,
              email: lead.email,
              domain: lead.custom_fields?.domain
            }
            return acc
          }, {} as Record<string, any>)
        },
        {
          priority: validatedData.priority as JobPriority,
          maxRetries: 3,
          webhookUrl: validatedData.webhookUrl,
          tags: ['batch_enrichment', `provider:${validatedData.providerId}`]
        }
      )

      // Deduct credits immediately for queued jobs
      await supabase.rpc('use_enrichment_credits', {
        p_workspace_id: workspaceId,
        p_provider_id: validatedData.providerId,
        p_credits_used: totalCreditsRequired
      })
      
      // Log GDPR audit event for batch enrichment
      await gdprService.logAuditEvent({
        workspaceId,
        userId: user.id,
        action: 'batch_enrichment_queued',
        actionCategory: AuditActionCategory.DATA_MODIFICATION,
        resourceType: 'enrichment_job',
        resourceId: jobId,
        dataCategories: ['personal_data', 'professional_data', 'contact_data'],
        purpose: validatedData.purpose,
        legalBasis: validatedData.legalBasis as LegalBasis,
        changes: {
          leadCount: validatedData.leadIds.length,
          enrichmentTypes: validatedData.options,
          providerId: validatedData.providerId,
          consentChecked: validatedData.checkConsent,
        },
      })

      return NextResponse.json({
        success: true,
        jobId,
        message: 'Enrichment job queued for processing',
        estimatedCompletion: new Date(Date.now() + (validatedData.leadIds.length * 2000)).toISOString(),
        creditsUsed: totalCreditsRequired
      })
    }

    // Process enrichment immediately (for single leads or when job queue is disabled)
    const results = []
    const errors = []

    for (const lead of leads) {
      try {
        // Build enrichment requests based on selected options
        const enrichmentRequests = []

        if (validatedData.options.includes('email') && !lead.email) {
          enrichmentRequests.push({
            workspaceId,
            leadId: lead.id,
            providerId: validatedData.providerId,
            requestType: 'email_finder',
            inputData: {
              firstName: lead.first_name,
              lastName: lead.last_name,
              company: lead.company,
              domain: lead.custom_fields?.domain
            },
            priority: validatedData.priority
          })
        }

        if (validatedData.options.includes('phone')) {
          enrichmentRequests.push({
            workspaceId,
            leadId: lead.id,
            providerId: validatedData.providerId,
            requestType: 'phone_finder',
            inputData: {
              firstName: lead.first_name,
              lastName: lead.last_name,
              company: lead.company,
              email: lead.email
            },
            priority: validatedData.priority
          })
        }

        if (validatedData.options.includes('company') && lead.company) {
          enrichmentRequests.push({
            workspaceId,
            leadId: lead.id,
            providerId: validatedData.providerId,
            requestType: 'company_enrichment',
            inputData: {
              companyName: lead.company,
              domain: lead.custom_fields?.domain
            },
            priority: validatedData.priority
          })
        }

        if (validatedData.options.includes('social')) {
          enrichmentRequests.push({
            workspaceId,
            leadId: lead.id,
            providerId: validatedData.providerId,
            requestType: 'social_profiles',
            inputData: {
              email: lead.email,
              firstName: lead.first_name,
              lastName: lead.last_name,
              company: lead.company
            },
            priority: validatedData.priority
          })
        }

        if (validatedData.options.includes('title') && !lead.title) {
          enrichmentRequests.push({
            workspaceId,
            leadId: lead.id,
            providerId: validatedData.providerId,
            requestType: 'title_finder',
            inputData: {
              email: lead.email,
              firstName: lead.first_name,
              lastName: lead.last_name,
              company: lead.company
            },
            priority: validatedData.priority
          })
        }

        if (validatedData.options.includes('technographics') && lead.company) {
          enrichmentRequests.push({
            workspaceId,
            leadId: lead.id,
            providerId: validatedData.providerId,
            requestType: 'technographics',
            inputData: {
              company: lead.company,
              domain: lead.custom_fields?.domain
            },
            priority: validatedData.priority
          })
        }

        // Execute enrichment requests
        for (const request of enrichmentRequests) {
          try {
            const result = await enrichmentService.enrichLead(request)
            
            // Transform result to UI format
            const fieldName = request.requestType.replace(/_finder|_enrichment/, '')
            results.push({
              field: fieldName,
              oldValue: lead[fieldName as keyof typeof lead] || null,
              newValue: result.data[fieldName] || result.data,
              confidence: result.confidenceScore,
              source: result.provider,
              verified: result.verificationStatus === 'verified'
            })

            // Update lead with enriched data
            const updates: any = {}
            
            if (request.requestType === 'email_finder' && result.data.email) {
              updates.email = result.data.email
            } else if (request.requestType === 'phone_finder' && result.data.phone) {
              updates.phone = result.data.phone
            } else if (request.requestType === 'title_finder' && result.data.title) {
              updates.title = result.data.title
            } else if (request.requestType === 'company_enrichment') {
              updates.custom_fields = {
                ...lead.custom_fields,
                company_data: result.data
              }
            } else if (request.requestType === 'social_profiles') {
              updates.custom_fields = {
                ...lead.custom_fields,
                social_profiles: result.data
              }
            } else if (request.requestType === 'technographics') {
              updates.custom_fields = {
                ...lead.custom_fields,
                technographics: result.data
              }
            }

            if (Object.keys(updates).length > 0) {
              await supabase
                .from('leads')
                .update(updates)
                .eq('id', lead.id)
              
              // Log individual enrichment audit event
              await gdprService.logAuditEvent({
                workspaceId,
                userId: user.id,
                action: 'lead_enriched',
                actionCategory: AuditActionCategory.DATA_MODIFICATION,
                resourceType: 'lead',
                resourceId: lead.id,
                dataCategories: ['personal_data', 'professional_data'],
                purpose: validatedData.purpose,
                legalBasis: validatedData.legalBasis as LegalBasis,
                changes: {
                  enrichmentType: request.requestType,
                  fieldsUpdated: Object.keys(updates),
                  provider: validatedData.providerId,
                },
              })
            }
          } catch (error: any) {
            errors.push({
              leadId: lead.id,
              field: request.requestType,
              error: error.message
            })
          }
        }
      } catch (error: any) {
        errors.push({
          leadId: lead.id,
          error: error.message
        })
      }
    }

    // Deduct credits
    await supabase.rpc('use_enrichment_credits', {
      p_workspace_id: workspaceId,
      p_provider_id: validatedData.providerId,
      p_credits_used: totalCreditsRequired
    })

    return NextResponse.json({
      success: true,
      results,
      errors: errors.length > 0 ? errors : undefined,
      creditsUsed: totalCreditsRequired,
      consentChecked: validatedData.checkConsent,
      legalBasis: validatedData.legalBasis,
    })

  } catch (error) {
    console.error('Enrichment error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Invalid request data',
        details: error.errors 
      }, { status: 400 })
    }

    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Enrichment failed' 
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get providers list for UI
    const providers = [
      {
        id: 'clearbit',
        name: 'Clearbit',
        type: 'comprehensive',
        creditsPerRequest: 2,
        isActive: true,
        accuracy: 95,
        speed: 'fast'
      },
      {
        id: 'hunter',
        name: 'Hunter.io',
        type: 'email_finder',
        creditsPerRequest: 1,
        isActive: true,
        accuracy: 90,
        speed: 'fast'
      },
      {
        id: 'apollo',
        name: 'Apollo.io',
        type: 'comprehensive',
        creditsPerRequest: 2,
        isActive: true,
        accuracy: 92,
        speed: 'medium'
      }
    ]

    return NextResponse.json(providers)
  } catch (error) {
    console.error('Get providers error:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch providers' 
    }, { status: 500 })
  }
}