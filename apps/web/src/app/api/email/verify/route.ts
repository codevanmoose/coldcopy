import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifyEmailAddress } from '@/lib/email/ses-client'
import { z } from 'zod'

const verifyEmailSchema = z.object({
  email: z.string().email('Invalid email address'),
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
    const { email } = verifyEmailSchema.parse(body)

    // Check if AWS credentials are configured
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      return NextResponse.json(
        { 
          error: 'AWS SES not configured',
          details: 'AWS credentials are not set up. Please configure AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables.'
        },
        { status: 500 }
      )
    }

    // Verify email address with SES
    const result = await verifyEmailAddress(email)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to verify email address' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Verification email sent to ${email}. Please check your inbox and click the verification link.`,
      email,
    })
  } catch (error) {
    console.error('Email verification error:', error)
    
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