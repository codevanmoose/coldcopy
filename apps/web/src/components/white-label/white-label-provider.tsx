'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth'
import { 
  WhiteLabelBranding, 
  WhiteLabelSettings, 
  WhiteLabelDomain,
  BrandTheme,
  CSSCustomProperties 
} from '@/lib/white-label/types'

interface WhiteLabelContextType {
  // Data
  branding: WhiteLabelBranding | null
  settings: WhiteLabelSettings | null
  domains: WhiteLabelDomain[]
  activeDomain: WhiteLabelDomain | null
  
  // Loading states
  isLoading: boolean
  isUpdating: boolean
  
  // Actions
  updateBranding: (branding: Partial<WhiteLabelBranding>) => Promise<void>
  updateSettings: (settings: Partial<WhiteLabelSettings>) => Promise<void>
  applyTheme: (theme: BrandTheme) => void
  resetTheme: () => void
  
  // Computed values
  theme: BrandTheme | null
  cssVariables: CSSCustomProperties
  isWhiteLabelEnabled: boolean
}

const WhiteLabelContext = createContext<WhiteLabelContextType | null>(null)

export function useWhiteLabel() {
  const context = useContext(WhiteLabelContext)
  if (!context) {
    throw new Error('useWhiteLabel must be used within a WhiteLabelProvider')
  }
  return context
}

interface WhiteLabelProviderProps {
  children: React.ReactNode
  isWhiteLabel?: boolean
  workspaceId?: string | null
  domain?: string | null
  branding?: {
    companyName?: string | null
    primaryColor?: string | null
    secondaryColor?: string | null
    logoUrl?: string | null
    faviconUrl?: string | null
  } | null
  domainOverride?: string // For testing specific domain configurations
}

export function WhiteLabelProvider({ 
  children, 
  isWhiteLabel = false,
  workspaceId,
  domain,
  branding: headerBranding,
  domainOverride 
}: WhiteLabelProviderProps) {
  const { dbUser } = useAuthStore()
  const queryClient = useQueryClient()
  
  // Get current domain or use override
  const currentDomain = domainOverride || domain || (typeof window !== 'undefined' ? window.location.hostname : '')
  
  // Use workspace ID from props or auth store
  const effectiveWorkspaceId = workspaceId || dbUser?.workspace_id
  
  // Query white-label data only if not already provided via headers
  const { data: whiteLabelData, isLoading } = useQuery({
    queryKey: ['white-label', effectiveWorkspaceId, currentDomain],
    queryFn: async () => {
      if (!effectiveWorkspaceId) return null
      
      const response = await fetch(`/api/white-label?workspaceId=${effectiveWorkspaceId}&domain=${currentDomain}`)
      if (!response.ok) {
        if (response.status === 404) return null
        throw new Error('Failed to fetch white-label data')
      }
      return response.json()
    },
    enabled: !!effectiveWorkspaceId && !headerBranding,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Update branding mutation
  const updateBrandingMutation = useMutation({
    mutationFn: async (branding: Partial<WhiteLabelBranding>) => {
      if (!dbUser?.workspace_id) throw new Error('No workspace ID')
      
      const response = await fetch('/api/white-label/branding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: dbUser.workspace_id,
          branding,
        }),
      })
      
      if (!response.ok) throw new Error('Failed to update branding')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['white-label'] })
    },
  })

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (settings: Partial<WhiteLabelSettings>) => {
      if (!dbUser?.workspace_id) throw new Error('No workspace ID')
      
      const response = await fetch('/api/white-label/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: dbUser.workspace_id,
          settings,
        }),
      })
      
      if (!response.ok) throw new Error('Failed to update settings')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['white-label'] })
    },
  })

  // Use header branding data if available, otherwise use query data
  const branding = headerBranding ? {
    company_name: headerBranding.companyName || '',
    primary_color: headerBranding.primaryColor || '#2563eb',
    secondary_color: headerBranding.secondaryColor || '#64748b',
    accent_color: '#10b981',
    background_color: '#ffffff',
    text_color: '#1f2937',
    font_family: 'Inter, sans-serif',
    theme_config: {
      borderRadius: '0.5rem',
      spacing: '1rem',
      shadows: true,
      animations: true,
    },
    logo_url: headerBranding.logoUrl,
    favicon_url: headerBranding.faviconUrl,
  } as Partial<WhiteLabelBranding> : whiteLabelData?.branding || null
  
  const settings = whiteLabelData?.settings || null
  const domains = whiteLabelData?.domains || []
  const activeDomain = domains.find((d: WhiteLabelDomain) => d.is_active && d.full_domain === currentDomain) || null

  // Generate theme from branding
  const theme: BrandTheme | null = branding ? {
    colors: {
      primary: branding.primary_color || '#2563eb',
      secondary: branding.secondary_color || '#64748b',
      accent: branding.accent_color || '#10b981',
      background: branding.background_color || '#ffffff',
      text: branding.text_color || '#1f2937',
    },
    fonts: {
      family: branding.font_family || 'Inter, sans-serif',
      url: branding.font_url,
    },
    config: branding.theme_config || {
      borderRadius: '0.5rem',
      spacing: '1rem',
      shadows: true,
      animations: true,
    },
    customCSS: branding.custom_css,
  } : null

  // Generate CSS custom properties
  const cssVariables: CSSCustomProperties = theme ? {
    '--brand-primary': theme.colors.primary,
    '--brand-secondary': theme.colors.secondary,
    '--brand-accent': theme.colors.accent,
    '--brand-background': theme.colors.background,
    '--brand-text': theme.colors.text,
    '--brand-font': theme.fonts.family,
    '--brand-border-radius': theme.config.borderRadius,
    '--brand-spacing': theme.config.spacing,
  } : {}

  // Apply theme to DOM
  const applyTheme = React.useCallback((themeToApply: BrandTheme) => {
    if (typeof window === 'undefined') return

    const root = document.documentElement
    
    // Apply CSS custom properties
    const variables = {
      '--brand-primary': themeToApply.colors.primary,
      '--brand-secondary': themeToApply.colors.secondary,
      '--brand-accent': themeToApply.colors.accent,
      '--brand-background': themeToApply.colors.background,
      '--brand-text': themeToApply.colors.text,
      '--brand-font': themeToApply.fonts.family,
      '--brand-border-radius': themeToApply.config.borderRadius,
      '--brand-spacing': themeToApply.config.spacing,
    }

    Object.entries(variables).forEach(([property, value]) => {
      root.style.setProperty(property, value)
    })

    // Apply custom CSS
    if (themeToApply.customCSS) {
      let styleEl = document.getElementById('white-label-custom-css')
      if (!styleEl) {
        styleEl = document.createElement('style')
        styleEl.id = 'white-label-custom-css'
        document.head.appendChild(styleEl)
      }
      styleEl.textContent = themeToApply.customCSS
    }

    // Load custom font if provided
    if (themeToApply.fonts.url) {
      let linkEl = document.getElementById('white-label-custom-font')
      if (!linkEl) {
        linkEl = document.createElement('link')
        linkEl.id = 'white-label-custom-font'
        linkEl.rel = 'stylesheet'
        document.head.appendChild(linkEl)
      }
      ;(linkEl as HTMLLinkElement).href = themeToApply.fonts.url
    }
  }, [])

  // Reset theme
  const resetTheme = React.useCallback(() => {
    if (typeof window === 'undefined') return

    const root = document.documentElement
    
    // Remove CSS custom properties
    const properties = [
      '--brand-primary',
      '--brand-secondary', 
      '--brand-accent',
      '--brand-background',
      '--brand-text',
      '--brand-font',
      '--brand-border-radius',
      '--brand-spacing',
    ]

    properties.forEach(property => {
      root.style.removeProperty(property)
    })

    // Remove custom CSS
    const styleEl = document.getElementById('white-label-custom-css')
    if (styleEl) {
      styleEl.remove()
    }

    // Remove custom font
    const linkEl = document.getElementById('white-label-custom-font')
    if (linkEl) {
      linkEl.remove()
    }
  }, [])

  // Apply theme on mount and when theme changes
  useEffect(() => {
    if (theme && settings?.feature_flags?.custom_domains) {
      applyTheme(theme)
    } else {
      resetTheme()
    }

    return () => {
      resetTheme()
    }
  }, [theme, settings?.feature_flags?.custom_domains, applyTheme, resetTheme])

  // Check if white-label features are enabled
  const isWhiteLabelEnabled = Boolean(
    settings?.feature_flags?.custom_domains && 
    (activeDomain || domains.length > 0)
  )

  const contextValue: WhiteLabelContextType = {
    // Data
    branding,
    settings,
    domains,
    activeDomain,
    
    // Loading states
    isLoading,
    isUpdating: updateBrandingMutation.isPending || updateSettingsMutation.isPending,
    
    // Actions
    updateBranding: updateBrandingMutation.mutateAsync,
    updateSettings: updateSettingsMutation.mutateAsync,
    applyTheme,
    resetTheme,
    
    // Computed values
    theme,
    cssVariables,
    isWhiteLabelEnabled,
  }

  return (
    <WhiteLabelContext.Provider value={contextValue}>
      {children}
    </WhiteLabelContext.Provider>
  )
}

// Hook for accessing white-label theme data in components
export function useWhiteLabelTheme() {
  const { theme, cssVariables, isWhiteLabelEnabled } = useWhiteLabel()
  
  return {
    theme,
    cssVariables,
    isWhiteLabelEnabled,
    // Helper functions for theme values
    getColor: (colorKey: keyof BrandTheme['colors']) => theme?.colors[colorKey],
    getFont: () => theme?.fonts.family,
    getSpacing: () => theme?.config.spacing,
    getBorderRadius: () => theme?.config.borderRadius,
  }
}

// Hook for checking feature availability
export function useWhiteLabelFeatures() {
  const { settings, isWhiteLabelEnabled } = useWhiteLabel()
  
  const hasFeature = (feature: keyof typeof settings.feature_flags) => {
    return isWhiteLabelEnabled && settings?.feature_flags?.[feature] === true
  }

  return {
    isWhiteLabelEnabled,
    hasCustomDomains: hasFeature('custom_domains'),
    hasClientPortals: hasFeature('client_portals'),
    hasCustomEmailTemplates: hasFeature('custom_email_templates'),
    hasWhiteLabelReports: hasFeature('white_label_reports'),
    hasAPIAccess: hasFeature('api_access'),
    hasSSOIntegration: hasFeature('sso_integration'),
    hasAdvancedAnalytics: hasFeature('advanced_analytics'),
    hasWebhookEndpoints: hasFeature('webhook_endpoints'),
  }
}