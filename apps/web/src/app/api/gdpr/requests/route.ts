import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { nanoid } from 'nanoid'

const requestSchema = z.object({
  type: z.enum(['export', 'deletion', 'access', 'rectification']),
  details: z.string().optional(),
})

const verificationSchema = z.object({
  requestId: z.string(),
  verificationCode: z.string().length(6),
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
    
    // Handle verification
    if (body.requestId && body.verificationCode) {
      const { requestId, verificationCode } = verificationSchema.parse(body)
      
      // Verify the code
      const { data: request, error } = await supabase
        .from('gdpr_requests')
        .update({ 
          verified: true,
          status: 'processing',
          verified_at: new Date().toISOString(),
        })
        .eq('id', requestId)
        .eq('user_id', user.id)
        .eq('verification_code', verificationCode)
        .eq('verified', false)
        .select()
        .single()

      if (error || !request) {
        return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 })
      }

      // Process the request based on type
      if (request.type === 'export') {
        // Queue data export job
        await supabase
          .from('gdpr_export_jobs')
          .insert({
            request_id: request.id,
            user_id: user.id,
            status: 'pending',
          })
      } else if (request.type === 'deletion') {
        // Schedule account deletion (with 30-day grace period)
        const deletionDate = new Date()
        deletionDate.setDate(deletionDate.getDate() + 30)
        
        await supabase
          .from('gdpr_deletion_requests')
          .insert({
            request_id: request.id,
            user_id: user.id,
            scheduled_for: deletionDate.toISOString(),
            status: 'scheduled',
          })
      }

      // Log the verification
      await supabase
        .from('gdpr_audit_logs')
        .insert({
          user_id: user.id,
          action: 'request_verified',
          resource_type: 'gdpr_request',
          resource_id: request.id,
          metadata: {
            request_type: request.type,
            ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
          },
        })

      return NextResponse.json({ 
        success: true, 
        message: 'Request verified successfully',
        request,
      })
    }

    // Handle new request creation
    const { type, details } = requestSchema.parse(body)

    // Check for existing pending requests of the same type
    const { data: existingRequests } = await supabase
      .from('gdpr_requests')
      .select('*')
      .eq('user_id', user.id)
      .eq('type', type)
      .in('status', ['pending', 'processing'])

    if (existingRequests && existingRequests.length > 0) {
      return NextResponse.json({ 
        error: 'You already have a pending request of this type' 
      }, { status: 400 })
    }

    // Generate verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString()

    // Create the request
    const { data: newRequest, error: createError } = await supabase
      .from('gdpr_requests')
      .insert({
        user_id: user.id,
        type,
        status: 'pending',
        details,
        verification_code: verificationCode,
        metadata: {
          email: user.email,
          submitted_at: new Date().toISOString(),
          ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
          user_agent: request.headers.get('user-agent'),
        },
      })
      .select()
      .single()

    if (createError) {
      console.error('Error creating request:', createError)
      return NextResponse.json({ error: 'Failed to create request' }, { status: 500 })
    }

    // Send verification email
    const emailResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/email/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.INTERNAL_API_KEY}`,
      },
      body: JSON.stringify({
        to: user.email,
        subject: 'Verify Your Data Request',
        template: 'gdpr-verification',
        data: {
          userName: user.user_metadata?.full_name || user.email,
          requestType: type,
          verificationCode,
          expiresIn: '24 hours',
        },
      }),
    })

    if (!emailResponse.ok) {
      console.error('Failed to send verification email')
    }

    // Log the request creation
    await supabase
      .from('gdpr_audit_logs')
      .insert({
        user_id: user.id,
        action: 'request_created',
        resource_type: 'gdpr_request',
        resource_id: newRequest.id,
        metadata: {
          request_type: type,
          details,
        },
      })

    return NextResponse.json({ 
      success: true, 
      request: newRequest,
      message: 'Request created. Please check your email for verification.' 
    })
  } catch (error) {
    console.error('Error in GDPR requests API:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request data', details: error.errors }, { status: 400 })
    }
    
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
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

    // Get request type filter from query params
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const status = searchParams.get('status')

    // Build query
    let query = supabase
      .from('gdpr_requests')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (type) {
      query = query.eq('type', type)
    }

    if (status) {
      query = query.eq('status', status)
    }

    const { data: requests, error } = await query

    if (error) {
      console.error('Error fetching requests:', error)
      return NextResponse.json({ error: 'Failed to fetch requests' }, { status: 500 })
    }

    // Check for completed export requests with download links
    const enrichedRequests = await Promise.all(
      (requests || []).map(async (request) => {
        if (request.type === 'export' && request.status === 'completed') {
          // Get download URL from export jobs
          const { data: exportJob } = await supabase
            .from('gdpr_export_jobs')
            .select('download_url, expires_at')
            .eq('request_id', request.id)
            .single()

          if (exportJob && exportJob.download_url) {
            return {
              ...request,
              download_url: exportJob.download_url,
              download_expires_at: exportJob.expires_at,
            }
          }
        }
        return request
      })
    )

    return NextResponse.json({ 
      success: true, 
      requests: enrichedRequests,
    })
  } catch (error) {
    console.error('Error in GDPR requests GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get request ID from query params
    const { searchParams } = new URL(request.url)
    const requestId = searchParams.get('id')

    if (!requestId) {
      return NextResponse.json({ error: 'Request ID required' }, { status: 400 })
    }

    // Cancel the request (only if pending)
    const { data: canceledRequest, error } = await supabase
      .from('gdpr_requests')
      .update({ 
        status: 'canceled',
        canceled_at: new Date().toISOString(),
      })
      .eq('id', requestId)
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .select()
      .single()

    if (error || !canceledRequest) {
      return NextResponse.json({ error: 'Request not found or cannot be canceled' }, { status: 404 })
    }

    // If it was a deletion request, cancel the scheduled deletion
    if (canceledRequest.type === 'deletion') {
      await supabase
        .from('gdpr_deletion_requests')
        .update({ status: 'canceled' })
        .eq('request_id', requestId)
    }

    // Log the cancellation
    await supabase
      .from('gdpr_audit_logs')
      .insert({
        user_id: user.id,
        action: 'request_canceled',
        resource_type: 'gdpr_request',
        resource_id: requestId,
        metadata: {
          request_type: canceledRequest.type,
        },
      })

    return NextResponse.json({ 
      success: true, 
      message: 'Request canceled successfully' 
    })
  } catch (error) {
    console.error('Error in GDPR requests DELETE:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}