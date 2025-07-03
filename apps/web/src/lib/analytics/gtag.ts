// Google Analytics tracking functions

export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || ''

// Check if we're in production and have a GA ID
export const isGAEnabled = () => {
  return process.env.NODE_ENV === 'production' && GA_MEASUREMENT_ID
}

// Track page views
export const pageview = (url: string) => {
  if (!isGAEnabled() || typeof window === 'undefined') return
  
  window.gtag('config', GA_MEASUREMENT_ID, {
    page_path: url,
  })
}

// Track events
export const event = ({ action, category, label, value }: {
  action: string
  category: string
  label?: string
  value?: number
}) => {
  if (!isGAEnabled() || typeof window === 'undefined') return
  
  window.gtag('event', action, {
    event_category: category,
    event_label: label,
    value: value,
  })
}

// Track user properties
export const setUserProperties = (properties: Record<string, any>) => {
  if (!isGAEnabled() || typeof window === 'undefined') return
  
  window.gtag('set', 'user_properties', properties)
}

// Common events for ColdCopy
export const trackEvents = {
  // Authentication
  signup: () => event({ action: 'signup', category: 'authentication' }),
  login: () => event({ action: 'login', category: 'authentication' }),
  logout: () => event({ action: 'logout', category: 'authentication' }),
  
  // Campaign events
  createCampaign: () => event({ action: 'create_campaign', category: 'campaigns' }),
  startCampaign: (campaignId: string) => event({ 
    action: 'start_campaign', 
    category: 'campaigns',
    label: campaignId 
  }),
  pauseCampaign: (campaignId: string) => event({ 
    action: 'pause_campaign', 
    category: 'campaigns',
    label: campaignId 
  }),
  
  // AI events
  generateEmail: (model: string) => event({ 
    action: 'generate_email', 
    category: 'ai',
    label: model 
  }),
  
  // Lead events
  importLeads: (count: number) => event({ 
    action: 'import_leads', 
    category: 'leads',
    value: count 
  }),
  enrichLead: () => event({ action: 'enrich_lead', category: 'leads' }),
  
  // Billing events
  upgradePlan: (plan: string) => event({ 
    action: 'upgrade_plan', 
    category: 'billing',
    label: plan 
  }),
  downgradePlan: (plan: string) => event({ 
    action: 'downgrade_plan', 
    category: 'billing',
    label: plan 
  }),
  
  // Feature usage
  useFeature: (feature: string) => event({ 
    action: 'use_feature', 
    category: 'features',
    label: feature 
  }),
}

// Declare gtag function type
declare global {
  interface Window {
    gtag: (...args: any[]) => void
  }
}