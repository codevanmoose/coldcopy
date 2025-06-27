import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/ses-client'
import { generateEmailHtml, generateEmailText } from '@/lib/email/templates'
import { processEmailForTracking, addUnsubscribeFooter, generateUnsubscribeLink } from '@/lib/email/tracking'
import { gdprService } from '@/lib/gdpr/gdpr-service'
import { ConsentType, AuditActionCategory } from '@/lib/gdpr/types'
import { z } from 'zod'
import crypto from 'crypto'

const sendEmailSchema = z.object({
  to: z.array(z.string().email()).min(1).max(50),
  subject: z.string().min(1).max(200),
  content: z.string().min(1),
  recipientNames: z.array(z.string()).optional(),
  campaignId: z.string().uuid().optional(),
  leadIds: z.array(z.string().uuid()).optional(),
  trackOpens: z.boolean().optional().default(true),
  trackClicks: z.boolean().optional().default(true),
  checkConsent: z.boolean().optional().default(true),
  consentType: z.enum(['marketing', 'newsletter', 'product_updates']).optional().default('marketing'),
})

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's workspace
    const { data: dbUser, error: userError } = await supabase
      .from('users')
      .select('*, workspace:workspaces(*)')
      .eq('id', user.id)
      .single()

    if (userError || !dbUser || !dbUser.workspace) {
      return NextResponse.json({ error: 'User workspace not found' }, { status: 404 })
    }

    // Parse and validate request body
    const body = await request.json()
    const validatedData = sendEmailSchema.parse(body)

    // Check email configuration
    const emailConfig = dbUser.workspace.settings?.email
    if (!emailConfig?.sender_email || !emailConfig?.sender_name) {
      return NextResponse.json(
        { error: 'Email configuration not set up. Please configure email settings.' },
        { status: 400 }
      )
    }

    // Check if AWS credentials are configured
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      return NextResponse.json(
        { error: 'Email service not configured. Please contact support.' },
        { status: 500 }
      )
    }

    // Send emails individually for personalization
    const results = []
    const consentProofs = []
    
    for (let i = 0; i < validatedData.to.length; i++) {
      const email = validatedData.to[i]
      const recipientName = validatedData.recipientNames?.[i]
      const leadId = validatedData.leadIds?.[i]
      
      // Check marketing consent if enabled and lead ID is provided
      if (validatedData.checkConsent && leadId) {
        try {
          const consentCheck = await gdprService.checkConsent({
            workspaceId: dbUser.workspace.id,
            leadId,
            consentTypes: [validatedData.consentType as ConsentType],
          })
          
          const hasConsent = consentCheck.consents[validatedData.consentType as ConsentType]?.granted
          
          if (!hasConsent) {
            results.push({
              email,
              success: false,
              error: 'No marketing consent',
              consentRequired: true,
            })
            continue
          }
          
          // Store consent proof
          consentProofs.push({
            leadId,
            consentType: validatedData.consentType,
            granted: true,
            checkedAt: new Date().toISOString(),
          })
        } catch (error) {
          console.error('Failed to check consent:', error)
          // Continue sending if consent check fails (fail open)
        }
      }
      
      // Check suppression list
      try {
        const isSuppressed = await gdprService.isEmailSuppressed(
          dbUser.workspace.id,
          email
        )
        
        if (isSuppressed) {
          results.push({
            email,
            success: false,
            error: 'Email is on suppression list',
            suppressed: true,
          })
          continue
        }
      } catch (error) {
        console.error('Failed to check suppression list:', error)
      }
      
      // Generate unsubscribe URL
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.coldcopy.cc'
      const unsubscribeToken = Buffer.from(
        JSON.stringify({ 
          workspace: dbUser.workspace.id, 
          email 
        })
      ).toString('base64')
      const unsubscribeUrl = `${baseUrl}/unsubscribe?token=${unsubscribeToken}`

      // Generate email content
      let htmlContent = generateEmailHtml({
        recipientName,
        senderName: emailConfig.sender_name,
        content: validatedData.content,
        unsubscribeUrl,
        workspaceName: dbUser.workspace.name,
        workspaceLogo: dbUser.workspace.branding?.logo,
        customCss: dbUser.workspace.branding?.customCss,
      })

      let textContent = generateEmailText({
        recipientName,
        senderName: emailConfig.sender_name,
        content: validatedData.content,
        unsubscribeUrl,
        workspaceName: dbUser.workspace.name,
      })

      // Create a unique email ID for tracking
      const emailId = crypto.randomUUID()
      if (!leadId) {
        const leadId = validatedData.leadIds?.[i] || crypto.randomUUID()
      }

      // Add tracking if enabled
      if (validatedData.trackOpens || validatedData.trackClicks) {
        htmlContent = processEmailForTracking(htmlContent, {
          workspaceId: dbUser.workspace.id,
          campaignId: validatedData.campaignId,
          emailId,
          leadId,
          trackOpens: validatedData.trackOpens,
          trackClicks: validatedData.trackClicks,
        })
      }

      // Add unsubscribe footer
      const contentWithFooter = addUnsubscribeFooter(
        htmlContent,
        textContent,
        {
          workspaceId: dbUser.workspace.id,
          leadId,
          emailId,
          companyName: dbUser.workspace.name,
          companyAddress: dbUser.workspace.settings?.company?.address,
        }
      )

      htmlContent = contentWithFooter.html
      textContent = contentWithFooter.text

      // Send email
      const result = await sendEmail({
        from: {
          email: emailConfig.sender_email,
          name: emailConfig.sender_name,
        },
        to: [email],
        replyTo: emailConfig.reply_to_email,
        subject: validatedData.subject,
        html: htmlContent,
        text: textContent,
        tags: {
          workspace_id: dbUser.workspace.id,
          user_id: user.id,
          campaign_id: validatedData.campaignId || 'manual',
        },
        headers: {
          ...(validatedData.campaignId ? {
            'X-Campaign-ID': validatedData.campaignId,
            'X-Campaign-Email-ID': emailId,
            'X-Lead-ID': leadId || '',
          } : {}),
          'List-Unsubscribe': `<${generateUnsubscribeLink({
            workspaceId: dbUser.workspace.id,
            leadId: leadId || emailId,
            emailId,
          })}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          'X-Auto-Response-Suppress': 'OOF, AutoReply',
          'Precedence': 'bulk',
        },
      })

      results.push({
        email,
        success: result.success,
        messageId: result.messageId,
        emailId: emailId,
        error: result.error,
      })

      // Log email event if successful
      if (result.success) {
        // Record campaign email if part of a campaign
        if (validatedData.campaignId) {
          await supabase.from('campaign_emails').insert({
            id: emailId,
            workspace_id: dbUser.workspace.id,
            campaign_id: validatedData.campaignId,
            lead_id: leadId,
            status: 'sent',
            sent_at: new Date().toISOString(),
            sent_by: user.id,
            message_id: result.messageId,
            subject: validatedData.subject,
            content_html: htmlContent,
            content_text: textContent,
            consent_proof: consentProofs.find(cp => cp.leadId === leadId),
          })
        }

        // Log email event with consent proof
        await supabase.from('email_events').insert({
          workspace_id: dbUser.workspace.id,
          campaign_id: validatedData.campaignId,
          lead_id: leadId,
          event_type: 'sent',
          email_id: emailId,
          metadata: {
            subject: validatedData.subject,
            to: email,
            message_id: result.messageId,
            tracking_enabled: {
              opens: validatedData.trackOpens,
              clicks: validatedData.trackClicks,
            },
            consent_checked: validatedData.checkConsent,
            consent_type: validatedData.consentType,
            consent_proof: consentProofs.find(cp => cp.leadId === leadId),
          },
        })
        
        // Log GDPR audit event
        await gdprService.logAuditEvent({
          workspaceId: dbUser.workspace.id,
          userId: user.id,
          action: 'email_sent',
          actionCategory: AuditActionCategory.DATA_ACCESS,
          resourceType: 'email',
          resourceId: emailId,
          dataCategories: ['email', 'personal_data'],
          purpose: validatedData.campaignId ? 'marketing_campaign' : 'transactional_email',
          legalBasis: 'consent',
          changes: {
            recipient: email,
            consentChecked: validatedData.checkConsent,
            consentProof: consentProofs.find(cp => cp.leadId === leadId),
          },
        })
      }
    }

    // Check if any emails failed
    const failedEmails = results.filter(r => !r.success)
    if (failedEmails.length === results.length) {
      return NextResponse.json(
        { error: 'All emails failed to send', details: failedEmails },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      results,
      sent: results.filter(r => r.success).length,
      failed: failedEmails.length,
      consentChecked: validatedData.checkConsent,
      suppressionChecked: true,
    })
  } catch (error) {
    console.error('Email send error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}