import { SESClient, SendEmailCommand, SendBulkTemplatedEmailCommand, SendRawEmailCommand } from '@aws-sdk/client-ses'

// Initialize SES client
const sesClient = new SESClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

export interface EmailOptions {
  from: {
    email: string
    name: string
  }
  to: string[]
  replyTo?: string
  subject: string
  html: string
  text: string
  tags?: Record<string, string>
  messageId?: string
  headers?: Record<string, string>
}

export interface BulkEmailOptions {
  from: {
    email: string
    name: string
  }
  template: string
  defaultTemplateData: Record<string, any>
  destinations: Array<{
    email: string
    templateData?: Record<string, any>
    tags?: Record<string, string>
  }>
  replyTo?: string
  configurationSet?: string
}

// Send single email
export async function sendEmail(options: EmailOptions) {
  const { from, to, replyTo, subject, html, text, tags, headers } = options

  try {
    // If we have custom headers, use raw email format
    if (headers && Object.keys(headers).length > 0) {
      const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substring(2)}`
      
      // Build raw email
      let rawEmail = ''
      
      // Headers
      rawEmail += `From: ${from.name} <${from.email}>\r\n`
      rawEmail += `To: ${to.join(', ')}\r\n`
      if (replyTo) rawEmail += `Reply-To: ${replyTo}\r\n`
      rawEmail += `Subject: ${subject}\r\n`
      rawEmail += `MIME-Version: 1.0\r\n`
      rawEmail += `Content-Type: multipart/alternative; boundary="${boundary}"\r\n`
      
      // Custom headers
      for (const [key, value] of Object.entries(headers)) {
        rawEmail += `${key}: ${value}\r\n`
      }
      
      rawEmail += '\r\n'
      
      // Text part
      rawEmail += `--${boundary}\r\n`
      rawEmail += `Content-Type: text/plain; charset=UTF-8\r\n`
      rawEmail += `Content-Transfer-Encoding: quoted-printable\r\n\r\n`
      rawEmail += `${text}\r\n`
      
      // HTML part
      rawEmail += `--${boundary}\r\n`
      rawEmail += `Content-Type: text/html; charset=UTF-8\r\n`
      rawEmail += `Content-Transfer-Encoding: quoted-printable\r\n\r\n`
      rawEmail += `${html}\r\n`
      
      rawEmail += `--${boundary}--\r\n`
      
      const command = new SendRawEmailCommand({
        Source: `${from.name} <${from.email}>`,
        Destinations: to,
        RawMessage: {
          Data: Buffer.from(rawEmail),
        },
        ConfigurationSetName: process.env.SES_CONFIGURATION_SET,
        Tags: tags
          ? Object.entries(tags).map(([Name, Value]) => ({ Name, Value }))
          : undefined,
      })
      
      const response = await sesClient.send(command)
      return {
        success: true,
        messageId: response.MessageId,
      }
    } else {
      // Use simple email format
      const command = new SendEmailCommand({
        Source: `${from.name} <${from.email}>`,
        Destination: {
          ToAddresses: to,
        },
        ReplyToAddresses: replyTo ? [replyTo] : undefined,
        Message: {
          Subject: {
            Data: subject,
            Charset: 'UTF-8',
          },
          Body: {
            Html: {
              Data: html,
              Charset: 'UTF-8',
            },
            Text: {
              Data: text,
              Charset: 'UTF-8',
            },
          },
        },
        ConfigurationSetName: process.env.SES_CONFIGURATION_SET,
        Tags: tags
          ? Object.entries(tags).map(([Name, Value]) => ({ Name, Value }))
          : undefined,
      })

      const response = await sesClient.send(command)
      return {
        success: true,
        messageId: response.MessageId,
      }
    }
  } catch (error) {
    console.error('SES send error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// Send bulk emails using templates
export async function sendBulkEmails(options: BulkEmailOptions) {
  const { from, template, defaultTemplateData, destinations, replyTo, configurationSet } = options

  const command = new SendBulkTemplatedEmailCommand({
    Source: `${from.name} <${from.email}>`,
    Template: template,
    DefaultTemplateData: JSON.stringify(defaultTemplateData),
    Destinations: destinations.map(dest => ({
      Destination: {
        ToAddresses: [dest.email],
      },
      ReplacementTemplateData: dest.templateData
        ? JSON.stringify(dest.templateData)
        : undefined,
      ReplacementTags: dest.tags
        ? Object.entries(dest.tags).map(([Name, Value]) => ({ Name, Value }))
        : undefined,
    })),
    ReplyToAddresses: replyTo ? [replyTo] : undefined,
    ConfigurationSetName: configurationSet || process.env.SES_CONFIGURATION_SET,
  })

  try {
    const response = await sesClient.send(command)
    return {
      success: true,
      messageIds: response.Status?.map(s => s.MessageId) || [],
    }
  } catch (error) {
    console.error('SES bulk send error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// Verify email address (for development)
export async function verifyEmailAddress(email: string) {
  // In production, use domain verification instead of email verification
  // This is only for development/sandbox mode
  const { VerifyEmailIdentityCommand } = await import('@aws-sdk/client-ses')
  
  const command = new VerifyEmailIdentityCommand({
    EmailAddress: email,
  })

  try {
    await sesClient.send(command)
    return { success: true }
  } catch (error) {
    console.error('SES verify error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}