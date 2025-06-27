interface EmailTemplateData {
  recipientName?: string
  senderName: string
  content: string
  unsubscribeUrl: string
  workspaceName: string
  workspaceLogo?: string
  customCss?: string
}

export function generateEmailHtml(data: EmailTemplateData): string {
  const { recipientName, senderName, content, unsubscribeUrl, workspaceName, workspaceLogo, customCss } = data

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${workspaceName}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    /* Base styles */
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 16px;
      line-height: 1.6;
      color: #333333;
      background-color: #f4f4f4;
    }
    
    table {
      border-collapse: collapse;
      width: 100%;
    }
    
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
    }
    
    .header {
      padding: 40px 40px 20px;
      text-align: center;
      border-bottom: 1px solid #e0e0e0;
    }
    
    .logo {
      max-width: 200px;
      max-height: 50px;
      margin-bottom: 20px;
    }
    
    .content {
      padding: 40px;
    }
    
    .greeting {
      font-size: 18px;
      margin-bottom: 20px;
      color: #333333;
    }
    
    .message {
      color: #333333;
      margin-bottom: 30px;
    }
    
    .footer {
      padding: 30px 40px;
      background-color: #f8f8f8;
      text-align: center;
      font-size: 14px;
      color: #666666;
    }
    
    .unsubscribe {
      color: #666666;
      text-decoration: underline;
    }
    
    a {
      color: #6366F1;
      text-decoration: none;
    }
    
    a:hover {
      text-decoration: underline;
    }
    
    .button {
      display: inline-block;
      padding: 12px 24px;
      background-color: #6366F1;
      color: #ffffff !important;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 500;
      margin: 20px 0;
    }
    
    /* Custom CSS */
    ${customCss || ''}
    
    /* Mobile styles */
    @media only screen and (max-width: 600px) {
      .container {
        width: 100% !important;
      }
      
      .content,
      .header,
      .footer {
        padding: 20px !important;
      }
    }
  </style>
</head>
<body>
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
    <tr>
      <td>
        <div class="container">
          <!-- Header -->
          <div class="header">
            ${workspaceLogo ? `<img src="${workspaceLogo}" alt="${workspaceName}" class="logo" />` : `<h1 style="margin: 0; color: #333333;">${workspaceName}</h1>`}
          </div>
          
          <!-- Content -->
          <div class="content">
            ${recipientName ? `<p class="greeting">Hi ${recipientName},</p>` : ''}
            
            <div class="message">
              ${content}
            </div>
            
            <p style="color: #666666; margin-top: 30px;">
              Best regards,<br />
              ${senderName}
            </p>
          </div>
          
          <!-- Footer -->
          <div class="footer">
            <p style="margin: 0 0 10px 0;">
              Sent by ${workspaceName}
            </p>
            <p style="margin: 0;">
              <a href="${unsubscribeUrl}" class="unsubscribe">Unsubscribe</a>
            </p>
          </div>
        </div>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()
}

export function generateEmailText(data: EmailTemplateData): string {
  const { recipientName, senderName, content, unsubscribeUrl, workspaceName } = data
  
  // Strip HTML tags from content
  const textContent = content
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]*>/g, '')
    .replace(/\n\n+/g, '\n\n')
    .trim()
  
  return `${recipientName ? `Hi ${recipientName},\n\n` : ''}${textContent}

Best regards,
${senderName}

--
Sent by ${workspaceName}
Unsubscribe: ${unsubscribeUrl}`
}

// Trial and billing email templates
export const emailTemplates = {
  // Trial notification templates
  trialWelcome: {
    subject: 'Welcome to ColdCopy - Your 14-Day Trial Has Started!',
    html: (data: { name: string; workspaceName: string; loginUrl: string }) => `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to ColdCopy</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4;">
            <tr>
              <td align="center" style="padding: 40px 0;">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                  <tr>
                    <td style="padding: 40px;">
                      <h1 style="color: #333333; margin-bottom: 20px;">Welcome to ColdCopy, ${data.name}! 🎉</h1>
                      
                      <p style="color: #666666; font-size: 16px; line-height: 24px; margin-bottom: 20px;">
                        Your 14-day free trial for <strong>${data.workspaceName}</strong> has officially started! 
                        We're excited to help you supercharge your cold email campaigns.
                      </p>

                      <div style="background-color: #f8f9fa; border-radius: 6px; padding: 20px; margin-bottom: 30px;">
                        <h2 style="color: #333333; font-size: 18px; margin-bottom: 15px;">What you get with your trial:</h2>
                        <ul style="color: #666666; font-size: 14px; line-height: 22px; margin: 0; padding-left: 20px;">
                          <li>Send up to <strong>1,000 emails</strong> per month</li>
                          <li>Enrich up to <strong>100 leads</strong> with detailed data</li>
                          <li>Generate <strong>50 AI-powered emails</strong></li>
                          <li>Add up to <strong>3 team members</strong></li>
                          <li>Full access to analytics and tracking</li>
                        </ul>
                      </div>

                      <h3 style="color: #333333; font-size: 16px; margin-bottom: 15px;">Get started in 3 easy steps:</h3>
                      <ol style="color: #666666; font-size: 14px; line-height: 22px; margin-bottom: 30px; padding-left: 20px;">
                        <li>Import your leads or connect your CRM</li>
                        <li>Create your first email campaign with AI assistance</li>
                        <li>Launch and track your results in real-time</li>
                      </ol>

                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td align="center">
                            <a href="${data.loginUrl}" style="display: inline-block; background-color: #0066ff; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-weight: bold; font-size: 16px;">
                              Start Using ColdCopy
                            </a>
                          </td>
                        </tr>
                      </table>

                      <p style="color: #999999; font-size: 12px; text-align: center; margin-top: 30px;">
                        Need help? Reply to this email or check out our 
                        <a href="${process.env.NEXT_PUBLIC_APP_URL}/help" style="color: #0066ff;">help center</a>.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `,
  },

  trialEnding: {
    subject: (daysRemaining: number) => 
      daysRemaining === 1 
        ? 'Your ColdCopy trial ends tomorrow!' 
        : `Only ${daysRemaining} days left in your ColdCopy trial`,
    html: (data: { name: string; daysRemaining: number; upgradeUrl: string; usage: any }) => `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Trial Ending Soon</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4;">
            <tr>
              <td align="center" style="padding: 40px 0;">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                  <tr>
                    <td style="padding: 40px;">
                      <h1 style="color: #ff9800; margin-bottom: 20px;">
                        ⏰ ${data.daysRemaining === 1 ? 'Last day' : `${data.daysRemaining} days left`} in your trial!
                      </h1>
                      
                      <p style="color: #666666; font-size: 16px; line-height: 24px; margin-bottom: 20px;">
                        Hi ${data.name},
                      </p>

                      <p style="color: #666666; font-size: 16px; line-height: 24px; margin-bottom: 30px;">
                        Your ColdCopy trial is coming to an end. Don't lose access to all the powerful features 
                        that have been helping you grow your business!
                      </p>

                      ${data.usage ? `
                        <div style="background-color: #f8f9fa; border-radius: 6px; padding: 20px; margin-bottom: 30px;">
                          <h3 style="color: #333333; font-size: 16px; margin-bottom: 15px;">Your trial usage so far:</h3>
                          <ul style="color: #666666; font-size: 14px; line-height: 22px; margin: 0; padding-left: 20px;">
                            <li>Emails sent: <strong>${data.usage.emailsSent || 0}</strong></li>
                            <li>Leads enriched: <strong>${data.usage.leadsEnriched || 0}</strong></li>
                            <li>AI emails generated: <strong>${data.usage.aiGenerated || 0}</strong></li>
                          </ul>
                        </div>
                      ` : ''}

                      <div style="background-color: #fff3cd; border: 1px solid #ffeeba; border-radius: 6px; padding: 20px; margin-bottom: 30px;">
                        <h3 style="color: #856404; font-size: 16px; margin-bottom: 10px;">🎁 Special Offer</h3>
                        <p style="color: #856404; font-size: 14px; margin: 0;">
                          Upgrade now and get <strong>20% off</strong> your first month!
                        </p>
                      </div>

                      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 30px;">
                        <tr>
                          <td align="center">
                            <a href="${data.upgradeUrl}" style="display: inline-block; background-color: #ff9800; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-weight: bold; font-size: 16px;">
                              Upgrade Now & Save 20%
                            </a>
                          </td>
                        </tr>
                      </table>

                      <p style="color: #666666; font-size: 14px; line-height: 22px; text-align: center;">
                        Questions about pricing? 
                        <a href="${process.env.NEXT_PUBLIC_APP_URL}/pricing" style="color: #0066ff;">View our plans</a> 
                        or reply to this email.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `,
  },

  trialExpired: {
    subject: 'Your ColdCopy trial has expired',
    html: (data: { name: string; workspaceName: string; upgradeUrl: string }) => `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Trial Expired</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4;">
            <tr>
              <td align="center" style="padding: 40px 0;">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                  <tr>
                    <td style="padding: 40px;">
                      <h1 style="color: #dc3545; margin-bottom: 20px;">Your trial has expired</h1>
                      
                      <p style="color: #666666; font-size: 16px; line-height: 24px; margin-bottom: 20px;">
                        Hi ${data.name},
                      </p>

                      <p style="color: #666666; font-size: 16px; line-height: 24px; margin-bottom: 30px;">
                        Your 14-day trial for <strong>${data.workspaceName}</strong> has ended. 
                        To continue using ColdCopy and regain access to all features, please upgrade to a paid plan.
                      </p>

                      <div style="background-color: #f8d7da; border: 1px solid #f5c6cb; border-radius: 6px; padding: 20px; margin-bottom: 30px;">
                        <h3 style="color: #721c24; font-size: 16px; margin-bottom: 10px;">What happens now?</h3>
                        <ul style="color: #721c24; font-size: 14px; line-height: 22px; margin: 0; padding-left: 20px;">
                          <li>Your campaigns have been paused</li>
                          <li>You cannot send new emails</li>
                          <li>Lead enrichment is disabled</li>
                          <li>Your data is safe and will be restored upon upgrade</li>
                        </ul>
                      </div>

                      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 30px;">
                        <tr>
                          <td align="center">
                            <a href="${data.upgradeUrl}" style="display: inline-block; background-color: #dc3545; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-weight: bold; font-size: 16px;">
                              Upgrade to Continue
                            </a>
                          </td>
                        </tr>
                      </table>

                      <p style="color: #666666; font-size: 14px; line-height: 22px; text-align: center;">
                        Need more time to evaluate? Reply to this email and let us know.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `,
  },

  trialConverted: {
    subject: 'Welcome to ColdCopy Pro! 🎊',
    html: (data: { name: string; planName: string; features: string[] }) => `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to ColdCopy Pro</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4;">
            <tr>
              <td align="center" style="padding: 40px 0;">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                  <tr>
                    <td style="padding: 40px;">
                      <h1 style="color: #28a745; margin-bottom: 20px;">🎊 Welcome to ${data.planName}!</h1>
                      
                      <p style="color: #666666; font-size: 16px; line-height: 24px; margin-bottom: 20px;">
                        Hi ${data.name},
                      </p>

                      <p style="color: #666666; font-size: 16px; line-height: 24px; margin-bottom: 30px;">
                        Thank you for upgrading to ColdCopy ${data.planName}! Your account has been successfully upgraded 
                        and all features are now unlocked.
                      </p>

                      <div style="background-color: #d4edda; border: 1px solid #c3e6cb; border-radius: 6px; padding: 20px; margin-bottom: 30px;">
                        <h3 style="color: #155724; font-size: 16px; margin-bottom: 15px;">What's included in your plan:</h3>
                        <ul style="color: #155724; font-size: 14px; line-height: 22px; margin: 0; padding-left: 20px;">
                          ${data.features.map(feature => `<li>${feature}</li>`).join('')}
                        </ul>
                      </div>

                      <h3 style="color: #333333; font-size: 16px; margin-bottom: 15px;">What's next?</h3>
                      <ul style="color: #666666; font-size: 14px; line-height: 22px; margin-bottom: 30px; padding-left: 20px;">
                        <li>Scale up your campaigns with increased limits</li>
                        <li>Invite your team members to collaborate</li>
                        <li>Explore advanced features like A/B testing</li>
                        <li>Set up integrations with your favorite tools</li>
                      </ul>

                      <p style="color: #666666; font-size: 14px; line-height: 22px; text-align: center;">
                        Thank you for choosing ColdCopy. We're here to help you succeed!<br>
                        If you need anything, just reply to this email.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `,
  },
}