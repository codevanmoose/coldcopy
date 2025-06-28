import { NextRequest, NextResponse } from 'next/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { BounceHandler } from '@/lib/deliverability/bounce-handler'

export async function POST(request: NextRequest) {
  try {
    // Verify webhook authenticity (implement your verification method)
    const signature = request.headers.get('x-signature')
    const timestamp = request.headers.get('x-timestamp')
    
    // In production, verify the webhook signature
    // if (!verifyWebhookSignature(signature, timestamp, body)) {
    //   return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    // }

    const body = await request.json()
    
    // Handle different bounce event types
    const eventType = body.eventType || body.Type || body.notificationType
    
    switch (eventType) {
      case 'bounce':
      case 'Bounce':
        await handleBounceEvent(body)
        break
        
      case 'complaint':
      case 'Complaint':
        await handleComplaintEvent(body)
        break
        
      case 'delivery':
      case 'Delivery':
        await handleDeliveryEvent(body)
        break
        
      case 'open':
      case 'Open':
        await handleOpenEvent(body)
        break
        
      case 'click':
      case 'Click':
        await handleClickEvent(body)
        break
        
      default:
        console.warn('Unknown event type:', eventType)
    }

    return NextResponse.json({ status: 'processed' })

  } catch (error) {
    console.error('Bounce webhook error:', error)
    return NextResponse.json(
      { error: 'Failed to process webhook' },
      { status: 500 }
    )
  }
}

async function handleBounceEvent(data: any) {
  try {
    // Extract bounce information from different provider formats
    const bounceData = extractBounceData(data)
    
    // Get workspace ID from message metadata or database lookup
    const workspaceId = await getWorkspaceFromMessageId(bounceData.messageId)
    
    if (workspaceId) {
      await BounceHandler.processBounceEvent(bounceData, workspaceId)
    } else {
      console.warn('Could not find workspace for bounce event:', bounceData.messageId)
    }
  } catch (error) {
    console.error('Error handling bounce event:', error)
  }
}

async function handleComplaintEvent(data: any) {
  try {
    const complaintData = extractComplaintData(data)
    const workspaceId = await getWorkspaceFromMessageId(complaintData.messageId)
    
    if (workspaceId) {
      // Convert complaint to bounce format for processing
      const bounceData = {
        ...complaintData,
        bounceType: 'complaint',
        bounceSubType: 'abuse',
        diagnosticCode: 'Recipient marked email as spam'
      }
      
      await BounceHandler.processBounceEvent(bounceData, workspaceId)
    }
  } catch (error) {
    console.error('Error handling complaint event:', error)
  }
}

async function handleDeliveryEvent(data: any) {
  try {
    const deliveryData = extractDeliveryData(data)
    const workspaceId = await getWorkspaceFromMessageId(deliveryData.messageId)
    
    if (workspaceId) {
      // Update email status to delivered
      await updateEmailStatus(deliveryData.messageId, 'delivered', workspaceId)
    }
  } catch (error) {
    console.error('Error handling delivery event:', error)
  }
}

async function handleOpenEvent(data: any) {
  try {
    const openData = extractOpenData(data)
    const workspaceId = await getWorkspaceFromMessageId(openData.messageId)
    
    if (workspaceId) {
      // Record email open event
      await recordEmailEvent(openData.messageId, 'open', openData, workspaceId)
    }
  } catch (error) {
    console.error('Error handling open event:', error)
  }
}

async function handleClickEvent(data: any) {
  try {
    const clickData = extractClickData(data)
    const workspaceId = await getWorkspaceFromMessageId(clickData.messageId)
    
    if (workspaceId) {
      // Record email click event
      await recordEmailEvent(clickData.messageId, 'click', clickData, workspaceId)
    }
  } catch (error) {
    console.error('Error handling click event:', error)
  }
}

function extractBounceData(data: any): any {
  // Handle Amazon SES format
  if (data.bounce) {
    const bounce = data.bounce
    const recipient = bounce.bouncedRecipients?.[0]
    
    return {
      messageId: data.mail?.messageId,
      email: recipient?.emailAddress,
      bounceType: bounce.bounceType === 'Permanent' ? 'hard' : 'soft',
      bounceSubType: bounce.bounceSubType,
      timestamp: bounce.timestamp,
      diagnosticCode: recipient?.diagnosticCode,
      description: recipient?.status
    }
  }
  
  // Handle SendGrid format
  if (data.event === 'bounce') {
    return {
      messageId: data.sg_message_id,
      email: data.email,
      bounceType: data.type === 'bounce' ? 'hard' : 'soft',
      bounceSubType: data.reason,
      timestamp: new Date(data.timestamp * 1000).toISOString(),
      diagnosticCode: data.reason,
      description: data.reason
    }
  }
  
  // Handle Mailgun format
  if (data['event-data']?.event === 'failed') {
    const eventData = data['event-data']
    return {
      messageId: eventData.message?.headers?.['message-id'],
      email: eventData.recipient,
      bounceType: eventData.severity === 'permanent' ? 'hard' : 'soft',
      bounceSubType: eventData['delivery-status']?.code,
      timestamp: new Date(eventData.timestamp * 1000).toISOString(),
      diagnosticCode: eventData['delivery-status']?.description,
      description: eventData['delivery-status']?.message
    }
  }
  
  return data
}

function extractComplaintData(data: any): any {
  // Handle Amazon SES format
  if (data.complaint) {
    const complaint = data.complaint
    const recipient = complaint.complainedRecipients?.[0]
    
    return {
      messageId: data.mail?.messageId,
      email: recipient?.emailAddress,
      timestamp: complaint.timestamp,
      feedbackType: complaint.complaintFeedbackType,
      userAgent: complaint.userAgent
    }
  }
  
  // Handle other provider formats...
  return data
}

function extractDeliveryData(data: any): any {
  // Handle Amazon SES format
  if (data.delivery) {
    return {
      messageId: data.mail?.messageId,
      timestamp: data.delivery.timestamp,
      processingTimeMillis: data.delivery.processingTimeMillis,
      recipients: data.delivery.recipients
    }
  }
  
  return data
}

function extractOpenData(data: any): any {
  // Handle various provider formats
  if (data.event === 'open') {
    return {
      messageId: data.sg_message_id || data.messageId,
      email: data.email,
      timestamp: data.timestamp ? new Date(data.timestamp * 1000).toISOString() : new Date().toISOString(),
      userAgent: data.useragent,
      ip: data.ip
    }
  }
  
  return data
}

function extractClickData(data: any): any {
  // Handle various provider formats
  if (data.event === 'click') {
    return {
      messageId: data.sg_message_id || data.messageId,
      email: data.email,
      url: data.url,
      timestamp: data.timestamp ? new Date(data.timestamp * 1000).toISOString() : new Date().toISOString(),
      userAgent: data.useragent,
      ip: data.ip
    }
  }
  
  return data
}

async function getWorkspaceFromMessageId(messageId: string): Promise<string | null> {
  try {
    const supabase = createServerComponentClient({ cookies })
    
    // Look up the workspace ID from the email record
    const { data, error } = await supabase
      .from('campaign_emails')
      .select('workspace_id')
      .eq('message_id', messageId)
      .single()
    
    if (error || !data) {
      console.warn('Could not find workspace for message ID:', messageId)
      return null
    }
    
    return data.workspace_id
  } catch (error) {
    console.error('Error looking up workspace:', error)
    return null
  }
}

async function updateEmailStatus(messageId: string, status: string, workspaceId: string) {
  try {
    const supabase = createServerComponentClient({ cookies })
    
    const { error } = await supabase
      .from('campaign_emails')
      .update({
        status,
        delivered_at: status === 'delivered' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString()
      })
      .eq('message_id', messageId)
      .eq('workspace_id', workspaceId)
    
    if (error) {
      console.error('Error updating email status:', error)
    }
  } catch (error) {
    console.error('Error updating email status:', error)
  }
}

async function recordEmailEvent(messageId: string, eventType: string, eventData: any, workspaceId: string) {
  try {
    const supabase = createServerComponentClient({ cookies })
    
    // Record the event
    const { error } = await supabase
      .from('email_events')
      .insert({
        workspace_id: workspaceId,
        message_id: messageId,
        event_type: eventType,
        event_data: eventData,
        timestamp: eventData.timestamp || new Date().toISOString(),
        ip_address: eventData.ip,
        user_agent: eventData.userAgent
      })
    
    if (error) {
      console.error('Error recording email event:', error)
    }
    
    // Update campaign email record
    const updateData: any = {
      updated_at: new Date().toISOString()
    }
    
    if (eventType === 'open') {
      updateData.opened_at = eventData.timestamp || new Date().toISOString()
      updateData.open_count = supabase.rpc('increment_open_count', { message_id: messageId })
    } else if (eventType === 'click') {
      updateData.clicked_at = eventData.timestamp || new Date().toISOString()
      updateData.click_count = supabase.rpc('increment_click_count', { message_id: messageId })
    }
    
    const { error: updateError } = await supabase
      .from('campaign_emails')
      .update(updateData)
      .eq('message_id', messageId)
      .eq('workspace_id', workspaceId)
    
    if (updateError) {
      console.error('Error updating campaign email:', updateError)
    }
  } catch (error) {
    console.error('Error recording email event:', error)
  }
}