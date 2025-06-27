import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { generateTrackingToken } from '@/lib/email/tracking'

const unsubscribeSchema = z.object({
  token: z.string().optional(),
  trackingToken: z.string().optional(),
  leadId: z.string().optional(),
  workspaceId: z.string().optional(),
  emailId: z.string().optional(),
  reason: z.string().optional(),
  feedback: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // Parse request body
    const body = await request.json()
    const { token, trackingToken, leadId, workspaceId, emailId, reason, feedback } = unsubscribeSchema.parse(body)

    let email: string
    let workspaceIdToUse: string

    // Handle old token format (base64 encoded JSON)
    if (token) {
      try {
        const decoded = JSON.parse(Buffer.from(token, 'base64').toString())
        email = decoded.email
        workspaceIdToUse = decoded.workspace
        
        if (!email || !workspaceIdToUse) {
          return NextResponse.json({ error: 'Invalid unsubscribe token' }, { status: 400 })
        }
      } catch (e) {
        return NextResponse.json({ error: 'Invalid unsubscribe token' }, { status: 400 })
      }
    }
    // Handle new tracking format
    else if (trackingToken && leadId && workspaceId) {
      // Verify tracking token
      const expectedToken = generateTrackingToken(`unsubscribe-${leadId}-${workspaceId}`)
      if (trackingToken !== expectedToken) {
        return NextResponse.json({ error: 'Invalid or expired unsubscribe link' }, { status: 400 })
      }

      // Fetch lead email
      const { data: lead, error: leadError } = await supabase
        .from('leads')
        .select('email')
        .eq('id', leadId)
        .eq('workspace_id', workspaceId)
        .single()

      if (leadError || !lead) {
        return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
      }

      email = lead.email
      workspaceIdToUse = workspaceId
    } else {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }

    // Add to suppression list
    const { error: suppressionError } = await supabase
      .from('suppression_list')
      .upsert({
        workspace_id: workspaceIdToUse,
        email,
        reason: reason || 'unsubscribe',
        source: 'link',
        metadata: { 
          feedback,
          unsubscribed_at: new Date().toISOString(),
          ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
          user_agent: request.headers.get('user-agent'),
        },
      }, { onConflict: 'workspace_id,email' })

    if (suppressionError) {
      console.error('Error adding to suppression list:', suppressionError)
      return NextResponse.json({ error: 'Failed to process unsubscribe' }, { status: 500 })
    }

    // Update lead status if using new format
    if (leadId) {
      await supabase
        .from('leads')
        .update({
          status: 'unsubscribed',
          custom_fields: {
            unsubscribed_at: new Date().toISOString(),
            unsubscribe_reason: reason,
            unsubscribe_feedback: feedback,
          },
        })
        .eq('id', leadId)
        .eq('workspace_id', workspaceIdToUse)

      // Record unsubscribe event
      await supabase
        .from('email_events')
        .insert({
          workspace_id: workspaceIdToUse,
          lead_id: leadId,
          email_id: emailId,
          event_type: 'unsubscribed',
          metadata: {
            reason,
            feedback,
            timestamp: new Date().toISOString(),
          },
        })
    } else {
      // For old format, update all leads with this email in the workspace
      await supabase
        .from('leads')
        .update({
          status: 'unsubscribed',
          custom_fields: {
            unsubscribed_at: new Date().toISOString(),
            unsubscribe_reason: reason,
            unsubscribe_feedback: feedback,
          },
        })
        .eq('email', email)
        .eq('workspace_id', workspaceIdToUse)
    }

    // Log the unsubscribe
    await supabase
      .from('gdpr_audit_logs')
      .insert({
        action: 'email_unsubscribe',
        resource_type: 'lead',
        resource_id: leadId || email,
        metadata: {
          workspace_id: workspaceIdToUse,
          email,
          reason,
          feedback,
          method: 'api',
        },
      })

    return NextResponse.json({ 
      success: true, 
      message: 'Successfully unsubscribed',
      email,
    })
  } catch (error) {
    console.error('Error in unsubscribe API:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request data', details: error.errors }, { status: 400 })
    }
    
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // Get parameters from URL
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')
    const trackingToken = searchParams.get('t')
    const leadId = searchParams.get('l')
    const workspaceId = searchParams.get('w')

    let email: string
    let workspaceName: string

    // Handle old token format
    if (token) {
      try {
        const decoded = JSON.parse(Buffer.from(token, 'base64').toString())
        email = decoded.email
        
        const { data: workspace } = await supabase
          .from('workspaces')
          .select('name')
          .eq('id', decoded.workspace)
          .single()
        
        workspaceName = workspace?.name || 'Unknown Workspace'
      } catch (e) {
        return NextResponse.json({ error: 'Invalid unsubscribe token' }, { status: 400 })
      }
    }
    // Handle new tracking format
    else if (trackingToken && leadId && workspaceId) {
      // Verify tracking token
      const expectedToken = generateTrackingToken(`unsubscribe-${leadId}-${workspaceId}`)
      if (trackingToken !== expectedToken) {
        return NextResponse.json({ error: 'Invalid or expired unsubscribe link' }, { status: 400 })
      }

      // Fetch lead and workspace info
      const { data: lead } = await supabase
        .from('leads')
        .select('email')
        .eq('id', leadId)
        .eq('workspace_id', workspaceId)
        .single()

      const { data: workspace } = await supabase
        .from('workspaces')
        .select('name')
        .eq('id', workspaceId)
        .single()

      if (!lead || !workspace) {
        return NextResponse.json({ error: 'Invalid unsubscribe link' }, { status: 404 })
      }

      email = lead.email
      workspaceName = workspace.name
    } else {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      email,
      workspace: workspaceName,
    })
  } catch (error) {
    console.error('Error in unsubscribe GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}