import { createHash } from 'crypto'

interface TrackingOptions {
  workspaceId: string
  campaignId?: string
  emailId: string
  leadId: string
  baseUrl?: string
}

/**
 * Generate a tracking token for secure identification
 */
export function generateTrackingToken(data: string): string {
  return createHash('sha256')
    .update(data + process.env.TRACKING_SECRET || 'default-secret')
    .digest('hex')
    .substring(0, 16)
}

/**
 * Generate a 1x1 transparent tracking pixel
 */
export function generateTrackingPixel(options: TrackingOptions): string {
  const baseUrl = options.baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const token = generateTrackingToken(`${options.emailId}-${options.leadId}`)
  
  const params = new URLSearchParams({
    t: token,
    e: options.emailId,
    l: options.leadId,
    w: options.workspaceId,
  })
  
  if (options.campaignId) {
    params.append('c', options.campaignId)
  }
  
  const pixelUrl = `${baseUrl}/api/track/open?${params.toString()}`
  
  return `<img src="${pixelUrl}" alt="" width="1" height="1" border="0" style="display:block;width:1px;height:1px;border:0;" />`
}

/**
 * Wrap links in email content for click tracking
 */
export function wrapLinksForTracking(
  htmlContent: string,
  options: TrackingOptions
): string {
  const baseUrl = options.baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const token = generateTrackingToken(`${options.emailId}-${options.leadId}`)
  
  // Regex to match href URLs, excluding already tracked links and unsubscribe links
  const linkRegex = /<a\s+(?:[^>]*?\s+)?href=(["'])((?:https?:\/\/)?[^"']+)\1([^>]*)>/gi
  
  return htmlContent.replace(linkRegex, (match, quote, url, rest) => {
    // Skip if already a tracking link or unsubscribe link
    if (url.includes('/api/track/') || url.includes('/unsubscribe')) {
      return match
    }
    
    // Skip mailto and tel links
    if (url.startsWith('mailto:') || url.startsWith('tel:')) {
      return match
    }
    
    const params = new URLSearchParams({
      t: token,
      e: options.emailId,
      l: options.leadId,
      w: options.workspaceId,
      u: encodeURIComponent(url),
    })
    
    if (options.campaignId) {
      params.append('c', options.campaignId)
    }
    
    const trackingUrl = `${baseUrl}/api/track/click?${params.toString()}`
    
    return `<a href=${quote}${trackingUrl}${quote}${rest}>`
  })
}

/**
 * Add tracking pixel to email HTML content
 */
export function addTrackingToEmail(
  htmlContent: string,
  options: TrackingOptions
): string {
  const pixel = generateTrackingPixel(options)
  
  // Try to insert before closing body tag, otherwise append to end
  if (htmlContent.includes('</body>')) {
    return htmlContent.replace('</body>', `${pixel}</body>`)
  }
  
  return htmlContent + pixel
}

/**
 * Process email content for full tracking (pixel + links)
 */
export function processEmailForTracking(
  htmlContent: string,
  options: TrackingOptions & { trackClicks?: boolean; trackOpens?: boolean }
): string {
  let processedContent = htmlContent
  
  // Add click tracking
  if (options.trackClicks !== false) {
    processedContent = wrapLinksForTracking(processedContent, options)
  }
  
  // Add open tracking pixel
  if (options.trackOpens !== false) {
    processedContent = addTrackingToEmail(processedContent, options)
  }
  
  return processedContent
}

/**
 * Generate unsubscribe link
 */
export function generateUnsubscribeLink(options: {
  workspaceId: string
  leadId: string
  emailId?: string
  baseUrl?: string
}): string {
  const baseUrl = options.baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const token = generateTrackingToken(`unsubscribe-${options.leadId}-${options.workspaceId}`)
  
  const params = new URLSearchParams({
    t: token,
    l: options.leadId,
    w: options.workspaceId,
  })
  
  if (options.emailId) {
    params.append('e', options.emailId)
  }
  
  return `${baseUrl}/unsubscribe?${params.toString()}`
}

/**
 * Add unsubscribe footer to email
 */
export function addUnsubscribeFooter(
  htmlContent: string,
  textContent: string,
  options: {
    workspaceId: string
    leadId: string
    emailId?: string
    companyName?: string
    companyAddress?: string
  }
): { html: string; text: string } {
  const unsubscribeLink = generateUnsubscribeLink(options)
  const companyName = options.companyName || 'Our Company'
  const companyAddress = options.companyAddress || ''
  
  const htmlFooter = `
    <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e5e5; font-size: 12px; color: #666; text-align: center;">
      <p>
        This email was sent by ${companyName}${companyAddress ? ` • ${companyAddress}` : ''}<br>
        <a href="${unsubscribeLink}" style="color: #666; text-decoration: underline;">Unsubscribe</a> • 
        <a href="${unsubscribeLink}?manage=true" style="color: #666; text-decoration: underline;">Manage Preferences</a>
      </p>
    </div>
  `
  
  const textFooter = `

--
This email was sent by ${companyName}${companyAddress ? ` • ${companyAddress}` : ''}
Unsubscribe: ${unsubscribeLink}
Manage Preferences: ${unsubscribeLink}?manage=true
`
  
  // Add footer to HTML
  let finalHtml = htmlContent
  if (htmlContent.includes('</body>')) {
    finalHtml = htmlContent.replace('</body>', `${htmlFooter}</body>`)
  } else {
    finalHtml = htmlContent + htmlFooter
  }
  
  // Add footer to text
  const finalText = textContent + textFooter
  
  return { html: finalHtml, text: finalText }
}