/**
 * GDPR Email Templates
 * Email templates for GDPR compliance notifications and requests
 */

import { GdprEmailType } from './types'

// Re-export GdprEmailType for convenience
export { GdprEmailType } from './types'

export interface EmailTemplateVariables {
  recipientName?: string
  recipientEmail: string
  workspaceName: string
  requestId?: string
  verificationLink?: string
  downloadLink?: string
  expirationDate?: string
  consentTypes?: string[]
  policyVersion?: string
  reason?: string
  supportEmail: string
  companyAddress?: string
  dataProtectionOfficerEmail?: string
}

/**
 * Get email template by type
 */
export function getEmailTemplate(
  type: GdprEmailType,
  variables: EmailTemplateVariables
): { subject: string; html: string; text: string } {
  switch (type) {
    case GdprEmailType.CONSENT_REQUEST:
      return getConsentRequestTemplate(variables)
    
    case GdprEmailType.CONSENT_CONFIRMATION:
      return getConsentConfirmationTemplate(variables)
    
    case GdprEmailType.CONSENT_WITHDRAWAL:
      return getConsentWithdrawalTemplate(variables)
    
    case GdprEmailType.DATA_REQUEST_RECEIVED:
      return getDataRequestReceivedTemplate(variables)
    
    case GdprEmailType.DATA_REQUEST_VERIFICATION:
      return getDataRequestVerificationTemplate(variables)
    
    case GdprEmailType.DATA_REQUEST_COMPLETED:
      return getDataRequestCompletedTemplate(variables)
    
    case GdprEmailType.DATA_REQUEST_REJECTED:
      return getDataRequestRejectedTemplate(variables)
    
    case GdprEmailType.DATA_EXPORT_READY:
      return getDataExportReadyTemplate(variables)
    
    case GdprEmailType.DATA_DELETION_CONFIRMATION:
      return getDataDeletionConfirmationTemplate(variables)
    
    case GdprEmailType.PRIVACY_POLICY_UPDATE:
      return getPrivacyPolicyUpdateTemplate(variables)
    
    case GdprEmailType.UNSUBSCRIBE_CONFIRMATION:
      return getUnsubscribeConfirmationTemplate(variables)
    
    default:
      throw new Error(`Unknown email template type: ${type}`)
  }
}

// ==================== Consent Templates ====================

function getConsentRequestTemplate(variables: EmailTemplateVariables) {
  const { recipientName, workspaceName, consentTypes = [], supportEmail } = variables
  const name = recipientName || 'Valued Customer'
  
  const consentList = consentTypes.join(', ')
  
  const subject = `Action Required: Please Review Your Consent Preferences - ${workspaceName}`
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #f8f9fa; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .button { display: inline-block; padding: 12px 24px; background: #007bff; color: white; text-decoration: none; border-radius: 4px; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>Consent Request from ${workspaceName}</h2>
        </div>
        <div class="content">
          <p>Dear ${name},</p>
          
          <p>We're updating our data processing practices to ensure compliance with data protection regulations. 
          We need your consent to continue processing your data for the following purposes:</p>
          
          <ul>
            ${consentTypes.map(type => `<li>${formatConsentType(type)}</li>`).join('')}
          </ul>
          
          <p>Your privacy is important to us. You can review our updated privacy policy and manage your 
          consent preferences at any time.</p>
          
          <p style="text-align: center; margin: 30px 0;">
            <a href="#" class="button">Manage Consent Preferences</a>
          </p>
          
          <p>If you have any questions about how we process your data, please don't hesitate to contact us.</p>
          
          <p>Best regards,<br>${workspaceName} Team</p>
        </div>
        <div class="footer">
          <p>This email was sent to ${variables.recipientEmail} regarding your data privacy preferences.</p>
          <p>Contact us: ${supportEmail}</p>
        </div>
      </div>
    </body>
    </html>
  `
  
  const text = `
Consent Request from ${workspaceName}

Dear ${name},

We're updating our data processing practices to ensure compliance with data protection regulations. 
We need your consent to continue processing your data for the following purposes:

${consentTypes.map(type => `- ${formatConsentType(type)}`).join('\n')}

Your privacy is important to us. You can review our updated privacy policy and manage your 
consent preferences at any time.

If you have any questions about how we process your data, please don't hesitate to contact us.

Best regards,
${workspaceName} Team

This email was sent to ${variables.recipientEmail} regarding your data privacy preferences.
Contact us: ${supportEmail}
  `
  
  return { subject, html, text }
}

function getConsentConfirmationTemplate(variables: EmailTemplateVariables) {
  const { recipientName, workspaceName, consentTypes = [], supportEmail } = variables
  const name = recipientName || 'Valued Customer'
  
  const subject = `Consent Preferences Updated - ${workspaceName}`
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #28a745; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .consent-box { background: #f8f9fa; padding: 15px; margin: 15px 0; border-radius: 4px; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>Consent Preferences Confirmed</h2>
        </div>
        <div class="content">
          <p>Dear ${name},</p>
          
          <p>Thank you for updating your consent preferences. This email confirms that we have recorded 
          your choices regarding how we process your personal data.</p>
          
          <div class="consent-box">
            <h3>Your Current Consent Preferences:</h3>
            <ul>
              ${consentTypes.map(type => `<li>${formatConsentType(type)}: <strong>Granted</strong></li>`).join('')}
            </ul>
          </div>
          
          <p>You can change these preferences at any time by visiting your account settings or contacting us directly.</p>
          
          <p>We take your privacy seriously and will only process your data in accordance with your preferences 
          and applicable data protection laws.</p>
          
          <p>Best regards,<br>${workspaceName} Team</p>
        </div>
        <div class="footer">
          <p>This confirmation was sent to ${variables.recipientEmail}</p>
          <p>Contact us: ${supportEmail}</p>
        </div>
      </div>
    </body>
    </html>
  `
  
  const text = `
Consent Preferences Confirmed

Dear ${name},

Thank you for updating your consent preferences. This email confirms that we have recorded 
your choices regarding how we process your personal data.

Your Current Consent Preferences:
${consentTypes.map(type => `- ${formatConsentType(type)}: Granted`).join('\n')}

You can change these preferences at any time by visiting your account settings or contacting us directly.

We take your privacy seriously and will only process your data in accordance with your preferences 
and applicable data protection laws.

Best regards,
${workspaceName} Team

This confirmation was sent to ${variables.recipientEmail}
Contact us: ${supportEmail}
  `
  
  return { subject, html, text }
}

function getConsentWithdrawalTemplate(variables: EmailTemplateVariables) {
  const { recipientName, workspaceName, consentTypes = [], supportEmail } = variables
  const name = recipientName || 'Valued Customer'
  
  const subject = `Consent Withdrawal Confirmed - ${workspaceName}`
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #dc3545; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .withdrawal-box { background: #fff3cd; padding: 15px; margin: 15px 0; border-radius: 4px; border: 1px solid #ffeeba; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>Consent Withdrawal Confirmed</h2>
        </div>
        <div class="content">
          <p>Dear ${name},</p>
          
          <p>We have received and processed your request to withdraw consent for the following data processing activities:</p>
          
          <div class="withdrawal-box">
            <ul>
              ${consentTypes.map(type => `<li>${formatConsentType(type)}</li>`).join('')}
            </ul>
          </div>
          
          <p><strong>What this means:</strong></p>
          <ul>
            <li>We will no longer process your data for the purposes you've withdrawn consent for</li>
            <li>Some services may become limited or unavailable</li>
            <li>We may retain certain data where we have other legal grounds to do so</li>
          </ul>
          
          <p>If you change your mind, you can grant consent again at any time through your account settings.</p>
          
          <p>Best regards,<br>${workspaceName} Team</p>
        </div>
        <div class="footer">
          <p>This confirmation was sent to ${variables.recipientEmail}</p>
          <p>Contact us: ${supportEmail}</p>
        </div>
      </div>
    </body>
    </html>
  `
  
  const text = `
Consent Withdrawal Confirmed

Dear ${name},

We have received and processed your request to withdraw consent for the following data processing activities:

${consentTypes.map(type => `- ${formatConsentType(type)}`).join('\n')}

What this means:
- We will no longer process your data for the purposes you've withdrawn consent for
- Some services may become limited or unavailable
- We may retain certain data where we have other legal grounds to do so

If you change your mind, you can grant consent again at any time through your account settings.

Best regards,
${workspaceName} Team

This confirmation was sent to ${variables.recipientEmail}
Contact us: ${supportEmail}
  `
  
  return { subject, html, text }
}

// ==================== Data Request Templates ====================

function getDataRequestReceivedTemplate(variables: EmailTemplateVariables) {
  const { recipientName, workspaceName, requestId, supportEmail } = variables
  const name = recipientName || 'Valued Customer'
  
  const subject = `Data Request Received - Reference: ${requestId}`
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #17a2b8; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .info-box { background: #e9ecef; padding: 15px; margin: 15px 0; border-radius: 4px; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>We've Received Your Data Request</h2>
        </div>
        <div class="content">
          <p>Dear ${name},</p>
          
          <p>Thank you for submitting your data request. We have received it and will process it in accordance 
          with data protection regulations.</p>
          
          <div class="info-box">
            <p><strong>Request Reference:</strong> ${requestId}</p>
            <p><strong>Expected Response Time:</strong> Within 30 days</p>
            <p><strong>Next Steps:</strong> We may need to verify your identity before processing your request</p>
          </div>
          
          <p>You will receive another email shortly with instructions on how to verify your identity. 
          This is an important security measure to protect your personal data.</p>
          
          <p>If you have any questions about your request, please reference the request ID above when contacting us.</p>
          
          <p>Best regards,<br>${workspaceName} Data Protection Team</p>
        </div>
        <div class="footer">
          <p>This email was sent to ${variables.recipientEmail}</p>
          <p>Contact us: ${supportEmail}</p>
          <p>Data Protection Officer: ${variables.dataProtectionOfficerEmail || supportEmail}</p>
        </div>
      </div>
    </body>
    </html>
  `
  
  const text = `
We've Received Your Data Request

Dear ${name},

Thank you for submitting your data request. We have received it and will process it in accordance 
with data protection regulations.

Request Reference: ${requestId}
Expected Response Time: Within 30 days
Next Steps: We may need to verify your identity before processing your request

You will receive another email shortly with instructions on how to verify your identity. 
This is an important security measure to protect your personal data.

If you have any questions about your request, please reference the request ID above when contacting us.

Best regards,
${workspaceName} Data Protection Team

This email was sent to ${variables.recipientEmail}
Contact us: ${supportEmail}
Data Protection Officer: ${variables.dataProtectionOfficerEmail || supportEmail}
  `
  
  return { subject, html, text }
}

function getDataRequestVerificationTemplate(variables: EmailTemplateVariables) {
  const { recipientName, workspaceName, requestId, verificationLink, supportEmail } = variables
  const name = recipientName || 'Valued Customer'
  
  const subject = `Action Required: Verify Your Data Request - ${requestId}`
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #ffc107; color: #333; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .button { display: inline-block; padding: 12px 24px; background: #007bff; color: white; text-decoration: none; border-radius: 4px; }
        .warning-box { background: #fff3cd; padding: 15px; margin: 15px 0; border-radius: 4px; border: 1px solid #ffeeba; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>Please Verify Your Identity</h2>
        </div>
        <div class="content">
          <p>Dear ${name},</p>
          
          <p>To protect your privacy and ensure the security of your personal data, we need to verify 
          your identity before processing your data request.</p>
          
          <p>Please click the button below to complete the verification process:</p>
          
          <p style="text-align: center; margin: 30px 0;">
            <a href="${verificationLink}" class="button">Verify My Identity</a>
          </p>
          
          <div class="warning-box">
            <p><strong>Important:</strong></p>
            <ul>
              <li>This link will expire in 48 hours</li>
              <li>Do not share this link with anyone</li>
              <li>If you didn't make this request, please contact us immediately</li>
            </ul>
          </div>
          
          <p>Once verified, we will process your request and respond within the legal timeframe.</p>
          
          <p>Best regards,<br>${workspaceName} Data Protection Team</p>
        </div>
        <div class="footer">
          <p>Request ID: ${requestId}</p>
          <p>This email was sent to ${variables.recipientEmail}</p>
          <p>Contact us: ${supportEmail}</p>
        </div>
      </div>
    </body>
    </html>
  `
  
  const text = `
Please Verify Your Identity

Dear ${name},

To protect your privacy and ensure the security of your personal data, we need to verify 
your identity before processing your data request.

Please visit the following link to complete the verification process:
${verificationLink}

Important:
- This link will expire in 48 hours
- Do not share this link with anyone
- If you didn't make this request, please contact us immediately

Once verified, we will process your request and respond within the legal timeframe.

Best regards,
${workspaceName} Data Protection Team

Request ID: ${requestId}
This email was sent to ${variables.recipientEmail}
Contact us: ${supportEmail}
  `
  
  return { subject, html, text }
}

function getDataRequestCompletedTemplate(variables: EmailTemplateVariables) {
  const { recipientName, workspaceName, requestId, downloadLink, expirationDate, supportEmail } = variables
  const name = recipientName || 'Valued Customer'
  
  const subject = `Your Data Request Has Been Completed - ${requestId}`
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #28a745; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .button { display: inline-block; padding: 12px 24px; background: #007bff; color: white; text-decoration: none; border-radius: 4px; }
        .success-box { background: #d4edda; padding: 15px; margin: 15px 0; border-radius: 4px; border: 1px solid #c3e6cb; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>Your Data Request is Ready</h2>
        </div>
        <div class="content">
          <p>Dear ${name},</p>
          
          <p>Good news! We have completed processing your data request and your information is now ready for download.</p>
          
          <div class="success-box">
            <p><strong>Request ID:</strong> ${requestId}</p>
            <p><strong>Download Available Until:</strong> ${expirationDate}</p>
          </div>
          
          <p>Click the button below to securely download your data:</p>
          
          <p style="text-align: center; margin: 30px 0;">
            <a href="${downloadLink}" class="button">Download My Data</a>
          </p>
          
          <p><strong>Please note:</strong></p>
          <ul>
            <li>The download link will expire on ${expirationDate}</li>
            <li>You can download your data up to 3 times</li>
            <li>The data is provided in a machine-readable format</li>
          </ul>
          
          <p>If you have any questions about the data provided, please don't hesitate to contact us.</p>
          
          <p>Best regards,<br>${workspaceName} Data Protection Team</p>
        </div>
        <div class="footer">
          <p>This email was sent to ${variables.recipientEmail}</p>
          <p>Contact us: ${supportEmail}</p>
        </div>
      </div>
    </body>
    </html>
  `
  
  const text = `
Your Data Request is Ready

Dear ${name},

Good news! We have completed processing your data request and your information is now ready for download.

Request ID: ${requestId}
Download Available Until: ${expirationDate}

Visit the following link to securely download your data:
${downloadLink}

Please note:
- The download link will expire on ${expirationDate}
- You can download your data up to 3 times
- The data is provided in a machine-readable format

If you have any questions about the data provided, please don't hesitate to contact us.

Best regards,
${workspaceName} Data Protection Team

This email was sent to ${variables.recipientEmail}
Contact us: ${supportEmail}
  `
  
  return { subject, html, text }
}

function getDataRequestRejectedTemplate(variables: EmailTemplateVariables) {
  const { recipientName, workspaceName, requestId, reason, supportEmail } = variables
  const name = recipientName || 'Valued Customer'
  
  const subject = `Update on Your Data Request - ${requestId}`
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #6c757d; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .reason-box { background: #f8f9fa; padding: 15px; margin: 15px 0; border-radius: 4px; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>Update on Your Data Request</h2>
        </div>
        <div class="content">
          <p>Dear ${name},</p>
          
          <p>After careful review, we are unable to process your data request at this time.</p>
          
          <div class="reason-box">
            <p><strong>Reason:</strong></p>
            <p>${reason || 'We were unable to verify your identity or confirm your relationship with the data in question.'}</p>
          </div>
          
          <p>If you believe this decision was made in error, or if you can provide additional information 
          to support your request, please contact us with reference to your request ID.</p>
          
          <p>You may also have the right to lodge a complaint with your local data protection authority 
          if you are unsatisfied with our response.</p>
          
          <p>Best regards,<br>${workspaceName} Data Protection Team</p>
        </div>
        <div class="footer">
          <p>Request ID: ${requestId}</p>
          <p>This email was sent to ${variables.recipientEmail}</p>
          <p>Contact us: ${supportEmail}</p>
          <p>Data Protection Officer: ${variables.dataProtectionOfficerEmail || supportEmail}</p>
        </div>
      </div>
    </body>
    </html>
  `
  
  const text = `
Update on Your Data Request

Dear ${name},

After careful review, we are unable to process your data request at this time.

Reason:
${reason || 'We were unable to verify your identity or confirm your relationship with the data in question.'}

If you believe this decision was made in error, or if you can provide additional information 
to support your request, please contact us with reference to your request ID.

You may also have the right to lodge a complaint with your local data protection authority 
if you are unsatisfied with our response.

Best regards,
${workspaceName} Data Protection Team

Request ID: ${requestId}
This email was sent to ${variables.recipientEmail}
Contact us: ${supportEmail}
Data Protection Officer: ${variables.dataProtectionOfficerEmail || supportEmail}
  `
  
  return { subject, html, text }
}

// ==================== Data Export/Deletion Templates ====================

function getDataExportReadyTemplate(variables: EmailTemplateVariables) {
  const { recipientName, workspaceName, downloadLink, expirationDate, supportEmail } = variables
  const name = recipientName || 'Valued Customer'
  
  const subject = `Your Data Export is Ready - ${workspaceName}`
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #007bff; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .button { display: inline-block; padding: 12px 24px; background: #28a745; color: white; text-decoration: none; border-radius: 4px; }
        .info-box { background: #e9ecef; padding: 15px; margin: 15px 0; border-radius: 4px; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>Your Data Export is Ready</h2>
        </div>
        <div class="content">
          <p>Dear ${name},</p>
          
          <p>Your personal data export has been prepared and is ready for download. This export contains 
          all the personal information we hold about you in our systems.</p>
          
          <div class="info-box">
            <p><strong>What's included:</strong></p>
            <ul>
              <li>Profile information</li>
              <li>Communication history</li>
              <li>Consent records</li>
              <li>Activity logs</li>
              <li>Any other personal data we process</li>
            </ul>
          </div>
          
          <p style="text-align: center; margin: 30px 0;">
            <a href="${downloadLink}" class="button">Download Your Data</a>
          </p>
          
          <p><strong>Important:</strong> This link will expire on ${expirationDate}. Please download 
          your data before this date.</p>
          
          <p>The data is provided in a portable, machine-readable format that you can use to transfer 
          to other services if you wish.</p>
          
          <p>Best regards,<br>${workspaceName} Team</p>
        </div>
        <div class="footer">
          <p>This email was sent to ${variables.recipientEmail}</p>
          <p>Contact us: ${supportEmail}</p>
        </div>
      </div>
    </body>
    </html>
  `
  
  const text = `
Your Data Export is Ready

Dear ${name},

Your personal data export has been prepared and is ready for download. This export contains 
all the personal information we hold about you in our systems.

What's included:
- Profile information
- Communication history
- Consent records
- Activity logs
- Any other personal data we process

Download your data here: ${downloadLink}

Important: This link will expire on ${expirationDate}. Please download your data before this date.

The data is provided in a portable, machine-readable format that you can use to transfer 
to other services if you wish.

Best regards,
${workspaceName} Team

This email was sent to ${variables.recipientEmail}
Contact us: ${supportEmail}
  `
  
  return { subject, html, text }
}

function getDataDeletionConfirmationTemplate(variables: EmailTemplateVariables) {
  const { recipientName, workspaceName, supportEmail } = variables
  const name = recipientName || 'Valued Customer'
  
  const subject = `Your Data Has Been Deleted - ${workspaceName}`
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #dc3545; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .deletion-box { background: #f8d7da; padding: 15px; margin: 15px 0; border-radius: 4px; border: 1px solid #f5c6cb; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>Data Deletion Confirmation</h2>
        </div>
        <div class="content">
          <p>Dear ${name},</p>
          
          <p>This email confirms that we have successfully deleted your personal data from our systems 
          as per your request.</p>
          
          <div class="deletion-box">
            <p><strong>What we've done:</strong></p>
            <ul>
              <li>Deleted or anonymized all your personal information</li>
              <li>Removed you from all marketing lists</li>
              <li>Cancelled any active services or subscriptions</li>
              <li>Retained only the minimum data required by law</li>
            </ul>
          </div>
          
          <p><strong>Please note:</strong></p>
          <ul>
            <li>Some anonymized data may be retained for analytics purposes</li>
            <li>We may retain certain records as required by law (e.g., financial records)</li>
            <li>Data in backup systems will be purged according to our retention schedule</li>
          </ul>
          
          <p>If you ever wish to use our services again, you'll need to create a new account.</p>
          
          <p>Thank you for having been part of our community.</p>
          
          <p>Best regards,<br>${workspaceName} Team</p>
        </div>
        <div class="footer">
          <p>This email was sent to ${variables.recipientEmail}</p>
          <p>Contact us: ${supportEmail}</p>
        </div>
      </div>
    </body>
    </html>
  `
  
  const text = `
Data Deletion Confirmation

Dear ${name},

This email confirms that we have successfully deleted your personal data from our systems 
as per your request.

What we've done:
- Deleted or anonymized all your personal information
- Removed you from all marketing lists
- Cancelled any active services or subscriptions
- Retained only the minimum data required by law

Please note:
- Some anonymized data may be retained for analytics purposes
- We may retain certain records as required by law (e.g., financial records)
- Data in backup systems will be purged according to our retention schedule

If you ever wish to use our services again, you'll need to create a new account.

Thank you for having been part of our community.

Best regards,
${workspaceName} Team

This email was sent to ${variables.recipientEmail}
Contact us: ${supportEmail}
  `
  
  return { subject, html, text }
}

// ==================== Policy Update Templates ====================

function getPrivacyPolicyUpdateTemplate(variables: EmailTemplateVariables) {
  const { recipientName, workspaceName, policyVersion, supportEmail } = variables
  const name = recipientName || 'Valued Customer'
  
  const subject = `Important: Privacy Policy Update - ${workspaceName}`
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #17a2b8; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .button { display: inline-block; padding: 12px 24px; background: #007bff; color: white; text-decoration: none; border-radius: 4px; }
        .changes-box { background: #d1ecf1; padding: 15px; margin: 15px 0; border-radius: 4px; border: 1px solid #bee5eb; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>Privacy Policy Update</h2>
        </div>
        <div class="content">
          <p>Dear ${name},</p>
          
          <p>We're writing to inform you about important updates to our Privacy Policy. These changes 
          reflect our ongoing commitment to transparency and your data protection rights.</p>
          
          <div class="changes-box">
            <p><strong>Key changes include:</strong></p>
            <ul>
              <li>Enhanced transparency about data collection and usage</li>
              <li>Updated information about your rights under data protection laws</li>
              <li>Clarified data retention and deletion policies</li>
              <li>New information about international data transfers</li>
            </ul>
          </div>
          
          <p>These changes will take effect on ${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}.</p>
          
          <p style="text-align: center; margin: 30px 0;">
            <a href="#" class="button">Review Privacy Policy</a>
          </p>
          
          <p>By continuing to use our services after this date, you agree to the updated Privacy Policy.</p>
          
          <p>If you have any questions about these changes, please don't hesitate to contact us.</p>
          
          <p>Best regards,<br>${workspaceName} Team</p>
        </div>
        <div class="footer">
          <p>Policy Version: ${policyVersion}</p>
          <p>This email was sent to ${variables.recipientEmail}</p>
          <p>Contact us: ${supportEmail}</p>
        </div>
      </div>
    </body>
    </html>
  `
  
  const text = `
Privacy Policy Update

Dear ${name},

We're writing to inform you about important updates to our Privacy Policy. These changes 
reflect our ongoing commitment to transparency and your data protection rights.

Key changes include:
- Enhanced transparency about data collection and usage
- Updated information about your rights under data protection laws
- Clarified data retention and deletion policies
- New information about international data transfers

These changes will take effect on ${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}.

By continuing to use our services after this date, you agree to the updated Privacy Policy.

If you have any questions about these changes, please don't hesitate to contact us.

Best regards,
${workspaceName} Team

Policy Version: ${policyVersion}
This email was sent to ${variables.recipientEmail}
Contact us: ${supportEmail}
  `
  
  return { subject, html, text }
}

// ==================== Unsubscribe Templates ====================

function getUnsubscribeConfirmationTemplate(variables: EmailTemplateVariables) {
  const { recipientName, workspaceName, supportEmail } = variables
  const name = recipientName || 'Valued Customer'
  
  const subject = `You've Been Unsubscribed - ${workspaceName}`
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #6c757d; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .info-box { background: #f8f9fa; padding: 15px; margin: 15px 0; border-radius: 4px; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>Unsubscribe Confirmation</h2>
        </div>
        <div class="content">
          <p>Dear ${name},</p>
          
          <p>You have been successfully unsubscribed from our marketing communications.</p>
          
          <div class="info-box">
            <p>You will no longer receive:</p>
            <ul>
              <li>Marketing emails</li>
              <li>Promotional offers</li>
              <li>Newsletter updates</li>
            </ul>
            <p><strong>Note:</strong> You may still receive important transactional emails related to your account or services.</p>
          </div>
          
          <p>We're sorry to see you go. If you unsubscribed by mistake or change your mind, you can 
          update your preferences at any time in your account settings.</p>
          
          <p>Your feedback is valuable to us. If you have a moment, we'd appreciate knowing why you 
          unsubscribed so we can improve our communications.</p>
          
          <p>Best regards,<br>${workspaceName} Team</p>
        </div>
        <div class="footer">
          <p>This email was sent to ${variables.recipientEmail}</p>
          <p>Contact us: ${supportEmail}</p>
        </div>
      </div>
    </body>
    </html>
  `
  
  const text = `
Unsubscribe Confirmation

Dear ${name},

You have been successfully unsubscribed from our marketing communications.

You will no longer receive:
- Marketing emails
- Promotional offers
- Newsletter updates

Note: You may still receive important transactional emails related to your account or services.

We're sorry to see you go. If you unsubscribed by mistake or change your mind, you can 
update your preferences at any time in your account settings.

Your feedback is valuable to us. If you have a moment, we'd appreciate knowing why you 
unsubscribed so we can improve our communications.

Best regards,
${workspaceName} Team

This email was sent to ${variables.recipientEmail}
Contact us: ${supportEmail}
  `
  
  return { subject, html, text }
}

// ==================== Helper Functions ====================

/**
 * Format consent type for display
 */
function formatConsentType(type: string): string {
  const formatMap: Record<string, string> = {
    marketing: 'Marketing Communications',
    tracking: 'Website Analytics & Tracking',
    data_processing: 'Data Processing',
    cookies: 'Cookies & Similar Technologies',
    profiling: 'Profiling & Personalization',
    third_party_sharing: 'Third-Party Data Sharing',
    newsletter: 'Newsletter Subscription',
    product_updates: 'Product Updates & Announcements',
  }
  
  return formatMap[type] || type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}