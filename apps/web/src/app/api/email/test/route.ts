import { NextRequest, NextResponse } from 'next/server'
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses'

// Test endpoint to verify email sending works
export async function POST(request: NextRequest) {
  try {
    // Check if AWS credentials are configured
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      return NextResponse.json(
        { 
          error: 'AWS SES not configured',
          details: 'AWS credentials are not set up.'
        },
        { status: 500 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { email } = body

    if (!email) {
      return NextResponse.json(
        { error: 'Email address is required' },
        { status: 400 }
      )
    }

    // Create SES client
    const sesClient = new SESClient({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    })

    // Send test email
    const command = new SendEmailCommand({
      Source: process.env.SES_FROM_EMAIL || 'noreply@coldcopy.cc',
      Destination: {
        ToAddresses: [email],
      },
      Message: {
        Subject: {
          Data: 'ColdCopy Email Test',
          Charset: 'UTF-8',
        },
        Body: {
          Html: {
            Data: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #333;">Test Email from ColdCopy</h2>
                <p style="color: #666; line-height: 1.6;">
                  Congratulations! Your email configuration is working correctly.
                </p>
                <p style="color: #666; line-height: 1.6;">
                  This test email confirms that ColdCopy can successfully send emails through Amazon SES.
                </p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                <p style="color: #999; font-size: 12px;">
                  Sent from ColdCopy - AI-Powered Cold Outreach Platform
                </p>
              </div>
            `,
            Charset: 'UTF-8',
          },
          Text: {
            Data: 'Test Email from ColdCopy\n\nCongratulations! Your email configuration is working correctly.\n\nThis test email confirms that ColdCopy can successfully send emails through Amazon SES.',
            Charset: 'UTF-8',
          },
        },
      },
    })

    const result = await sesClient.send(command)

    return NextResponse.json({
      success: true,
      message: `Test email sent successfully to ${email}`,
      messageId: result.MessageId,
    })
  } catch (error: any) {
    console.error('Email test error:', error)
    
    // Check for common SES errors
    let errorMessage = 'Failed to send test email'
    let suggestion = ''
    
    if (error.name === 'MessageRejected' || error.Code === 'MessageRejected') {
      errorMessage = 'Email address not verified'
      suggestion = 'Your SES account is in sandbox mode. You can only send emails to verified email addresses. Please verify the recipient email in AWS SES console first.'
    } else if (error.message?.includes('Email address is not verified')) {
      errorMessage = 'Recipient email not verified'
      suggestion = 'In sandbox mode, you must verify each recipient email address in AWS SES before sending.'
    } else if (error.message?.includes('Daily sending quota exceeded')) {
      errorMessage = 'Daily sending limit reached'
      suggestion = 'You have reached your daily sending limit. In sandbox mode, the limit is 200 emails per day.'
    }
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: error.message,
        code: error.Code || error.name,
        suggestion: suggestion
      },
      { status: 500 }
    )
  }
}