import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { 
  extractReplyContent, 
  parseEmailHeaders,
  isAutoReply,
  isBounceNotification,
  calculateReplyScore,
  extractEmailAddresses,
  normalizeSubject
} from '@/lib/email/reply-detection'

// Schema for incoming email webhook
const incomingEmailSchema = z.object({
  messageId: z.string(),
  from: z.object({
    email: z.string().email(),
    name: z.string().optional(),
  }),
  to: z.array(z.object({
    email: z.string().email(),
    name: z.string().optional(),
  })),
  cc: z.array(z.object({
    email: z.string().email(),
    name: z.string().optional(),
  })).optional(),
  subject: z.string(),
  text: z.string().optional(),
  html: z.string().optional(),
  inReplyTo: z.string().optional(),
  references: z.array(z.string()).optional(),
  attachments: z.array(z.object({
    filename: z.string(),
    contentType: z.string(),
    size: z.number(),
    url: z.string().optional(),
  })).optional(),
  headers: z.record(z.string()).optional(),
  timestamp: z.string(),
})

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Parse webhook payload
    const body = await request.json()
    const emailData = incomingEmailSchema.parse(body)

    // Perform reply detection
    const emailContent = emailData.text || emailData.html || ''
    const headers = emailData.headers || {}
    
    const { replyContent, quotedContent, isReply } = extractReplyContent(emailContent)
    const isAuto = isAutoReply(headers, emailContent)
    const isBounce = isBounceNotification(headers, emailData.from.email)
    const replyScore = calculateReplyScore(emailContent, headers)
    
    // Determine email type
    let emailType: 'reply' | 'auto_reply' | 'bounce' | 'new' = 'new'
    if (isBounce) {
      emailType = 'bounce'
    } else if (isAuto) {
      emailType = 'auto_reply'
    } else if (isReply && replyScore > 40) {
      emailType = 'reply'
    }

    // Extract workspace from recipient email
    // In production, you'd map email addresses to workspaces
    const recipientEmail = emailData.to[0]?.email
    if (!recipientEmail) {
      return NextResponse.json({ error: 'No recipient found' }, { status: 400 })
    }

    // Find workspace based on email domain or specific email address
    // For now, we'll use a simplified approach
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('id')
      .single()

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }

    // Try to find the lead by email
    const { data: lead } = await supabase
      .from('leads')
      .select('id')
      .eq('workspace_id', workspace.id)
      .eq('email', emailData.from.email)
      .single()

    // Find or create thread
    let threadId: string

    if (emailData.inReplyTo) {
      // This is a reply - find the thread
      const { data: existingMessage } = await supabase
        .from('email_messages')
        .select('thread_id')
        .eq('message_id', emailData.inReplyTo)
        .single()

      if (existingMessage) {
        threadId = existingMessage.thread_id
      } else {
        // Create new thread if reply-to message not found
        const { data: thread } = await supabase
          .rpc('find_or_create_thread', {
            p_workspace_id: workspace.id,
            p_subject: emailData.subject,
            p_lead_id: lead?.id,
          })
        threadId = thread
      }
    } else {
      // New conversation
      const { data: thread } = await supabase
        .rpc('find_or_create_thread', {
          p_workspace_id: workspace.id,
          p_subject: emailData.subject,
          p_lead_id: lead?.id,
        })
      threadId = thread
    }

    // Create the message
    const { data: message, error: messageError } = await supabase
      .from('email_messages')
      .insert({
        thread_id: threadId,
        message_id: emailData.messageId,
        in_reply_to: emailData.inReplyTo,
        direction: 'inbound',
        from_email: emailData.from.email,
        from_name: emailData.from.name,
        to_emails: emailData.to.map(t => t.email),
        cc_emails: emailData.cc?.map(c => c.email) || [],
        subject: emailData.subject,
        body_text: emailData.text,
        body_html: emailData.html,
        headers: emailData.headers || {},
        attachments: emailData.attachments || [],
        received_at: emailData.timestamp,
        metadata: {
          email_type: emailType,
          is_reply: isReply,
          is_auto_reply: isAuto,
          is_bounce: isBounce,
          reply_score: replyScore,
          reply_content: replyContent,
          quoted_content: quotedContent,
        }
      })
      .select()
      .single()

    if (messageError) {
      console.error('Message creation error:', messageError)
      return NextResponse.json({ error: 'Failed to create message' }, { status: 500 })
    }

    // Create lead if doesn't exist
    if (!lead && emailData.from.email && emailType !== 'bounce') {
      const { data: newLead } = await supabase
        .from('leads')
        .insert({
          workspace_id: workspace.id,
          email: emailData.from.email,
          name: emailData.from.name,
          source: 'inbound_email',
          status: 'new',
        })
        .select()
        .single()
        
      if (newLead) {
        lead = newLead
      }
    }
    
    // Update lead status based on email type
    if (lead) {
      if (emailType === 'reply' && replyScore > 60) {
        // High-quality reply - mark as replied
        await supabase
          .from('leads')
          .update({
            status: 'replied',
            last_activity_at: new Date().toISOString(),
            engagement_score: supabase.rpc('increment_engagement_score', {
              p_lead_id: lead.id,
              p_points: 30 // High points for genuine reply
            }),
          })
          .eq('id', lead.id)
      } else if (emailType === 'bounce') {
        // Email bounced - mark as invalid
        await supabase
          .from('leads')
          .update({
            status: 'unqualified',
            custom_fields: {
              bounce_reason: 'Email bounced',
              bounced_at: new Date().toISOString(),
            }
          })
          .eq('id', lead.id)
          
        // Add to suppression list
        await supabase
          .from('suppression_list')
          .insert({
            workspace_id: workspace.id,
            email: emailData.from.email,
            reason: 'bounce',
            source: 'system',
            metadata: { message_id: emailData.messageId }
          })
      } else if (emailType === 'auto_reply') {
        // Auto-reply - just log activity
        await supabase
          .from('leads')
          .update({
            last_activity_at: new Date().toISOString(),
          })
          .eq('id', lead.id)
      }
    }

    // Log email event if this is related to a campaign
    const campaignIdMatch = emailData.headers?.['X-Campaign-ID']
    const campaignEmailId = emailData.headers?.['X-Campaign-Email-ID']
    
    if (campaignIdMatch && lead) {
      // Log appropriate event based on email type
      const eventType = emailType === 'bounce' ? 'bounced' : 
                       emailType === 'reply' ? 'replied' : 
                       emailType === 'auto_reply' ? 'auto_replied' : 'received'
                       
      await supabase
        .from('email_events')
        .insert({
          workspace_id: workspace.id,
          campaign_id: campaignIdMatch,
          lead_id: lead.id,
          event_type: eventType,
          email_id: campaignEmailId || emailData.messageId,
          metadata: {
            thread_id: threadId,
            subject: emailData.subject,
            email_type: emailType,
            reply_score: replyScore,
            is_auto_reply: isAuto,
          },
        })
        
      // Update campaign email if we have the ID
      if (campaignEmailId && emailType === 'reply') {
        await supabase
          .from('campaign_emails')
          .update({
            replied_at: new Date().toISOString(),
          })
          .eq('id', campaignEmailId)
          
        // Stop sequence if configured
        await stopSequenceIfNeeded(supabase, campaignIdMatch, lead.id)
      }
    }

    return NextResponse.json({ 
      success: true, 
      threadId,
      messageId: message.id 
    })
  } catch (error) {
    console.error('Email webhook error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid webhook data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Helper function to stop sequence when lead replies
async function stopSequenceIfNeeded(
  supabase: any,
  campaignId: string,
  leadId: string
) {
  // Check campaign settings
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('settings')
    .eq('id', campaignId)
    .single()
    
  if (campaign?.settings?.stop_on_reply) {
    // Mark campaign as completed for this lead
    await supabase
      .from('campaign_leads')
      .update({
        status: 'replied',
        completed_at: new Date().toISOString(),
      })
      .eq('campaign_id', campaignId)
      .eq('lead_id', leadId)
      
    // Cancel any scheduled emails
    await supabase
      .from('campaign_emails')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancelled_reason: 'Lead replied to campaign',
      })
      .eq('campaign_id', campaignId)
      .eq('lead_id', leadId)
      .eq('status', 'scheduled')
  }
}