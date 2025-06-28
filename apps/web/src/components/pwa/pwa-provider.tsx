'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { pwaManager } from '@/lib/pwa/pwa-manager'

interface PWAContextType {
  isInitialized: boolean
  isOnline: boolean
  isInstallable: boolean
  isInstalled: boolean
  installApp: () => Promise<boolean>
  sendNotification: (title: string, options?: NotificationOptions) => Promise<boolean>
  clearCache: () => Promise<boolean>
  updateCache: (url: string) => void
}

const PWAContext = createContext<PWAContextType | null>(null)

interface PWAProviderProps {
  children: ReactNode
}

export function PWAProvider({ children }: PWAProviderProps) {
  const [isInitialized, setIsInitialized] = useState(false)
  const [isOnline, setIsOnline] = useState(true)
  const [isInstallable, setIsInstallable] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    initializePWA()
    setupEventListeners()
  }, [])

  const initializePWA = async () => {
    try {
      // Initialize PWA manager
      const initialized = await pwaManager.initialize()
      setIsInitialized(initialized)

      // Get initial status
      const status = await pwaManager.getInstallationStatus()
      setIsInstallable(status.isInstallable)
      setIsInstalled(status.isInstalled)
      setIsOnline(pwaManager.isOnlineState())

      console.log('PWA Provider: Initialized successfully', {
        initialized,
        ...status,
        isOnline: pwaManager.isOnlineState()
      })
    } catch (error) {
      console.error('PWA Provider: Initialization failed', error)
      setIsInitialized(false)
    }
  }

  const setupEventListeners = () => {
    // Network status listeners
    const handleOnline = () => {
      setIsOnline(true)
      console.log('PWA Provider: Online')
    }

    const handleOffline = () => {
      setIsOnline(false)
      console.log('PWA Provider: Offline')
    }

    // PWA event listeners
    const handleInstallable = () => {
      setIsInstallable(true)
      console.log('PWA Provider: App became installable')
    }

    const handleInstalled = () => {
      setIsInstalled(true)
      setIsInstallable(false)
      console.log('PWA Provider: App installed')
    }

    // Add event listeners
    pwaManager.onOnline(handleOnline)
    pwaManager.onOffline(handleOffline)
    
    window.addEventListener('pwa-installable', handleInstallable)
    window.addEventListener('pwa-installed', handleInstalled)

    // Cleanup function
    return () => {
      pwaManager.removeOnlineListener(handleOnline)
      pwaManager.removeOfflineListener(handleOffline)
      window.removeEventListener('pwa-installable', handleInstallable)
      window.removeEventListener('pwa-installed', handleInstalled)
    }
  }

  const installApp = async (): Promise<boolean> => {
    try {
      const result = await pwaManager.showInstallPrompt()
      console.log('PWA Provider: Install prompt result:', result)
      return result
    } catch (error) {
      console.error('PWA Provider: Install failed', error)
      return false
    }
  }

  const sendNotification = async (title: string, options?: NotificationOptions): Promise<boolean> => {
    try {
      const result = await pwaManager.sendNotification(title, options)
      console.log('PWA Provider: Notification sent:', result)
      return result
    } catch (error) {
      console.error('PWA Provider: Notification failed', error)
      return false
    }
  }

  const clearCache = async (): Promise<boolean> => {
    try {
      const result = await pwaManager.clearCache()
      console.log('PWA Provider: Cache cleared:', result)
      return result
    } catch (error) {
      console.error('PWA Provider: Cache clear failed', error)
      return false
    }
  }

  const updateCache = (url: string): void => {
    try {
      pwaManager.updateCache(url)
      console.log('PWA Provider: Cache update requested for:', url)
    } catch (error) {
      console.error('PWA Provider: Cache update failed', error)
    }
  }

  const contextValue: PWAContextType = {
    isInitialized,
    isOnline,
    isInstallable,
    isInstalled,
    installApp,
    sendNotification,
    clearCache,
    updateCache
  }

  return (
    <PWAContext.Provider value={contextValue}>
      {children}
    </PWAContext.Provider>
  )
}

// Hook to use PWA context
export function usePWA(): PWAContextType {
  const context = useContext(PWAContext)
  
  if (!context) {
    throw new Error('usePWA must be used within a PWAProvider')
  }
  
  return context
}

// Hook for network status only
export function useNetworkStatus(): { isOnline: boolean } {
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    // Initialize
    setIsOnline(pwaManager.isOnlineState())

    // Set up listeners
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    pwaManager.onOnline(handleOnline)
    pwaManager.onOffline(handleOffline)

    return () => {
      pwaManager.removeOnlineListener(handleOnline)
      pwaManager.removeOfflineListener(handleOffline)
    }
  }, [])

  return { isOnline }
}

// Hook for installation status only
export function useInstallStatus(): {
  isInstallable: boolean
  isInstalled: boolean
  installApp: () => Promise<boolean>
} {
  const [isInstallable, setIsInstallable] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    checkStatus()
    setupListeners()
  }, [])

  const checkStatus = async () => {
    const status = await pwaManager.getInstallationStatus()
    setIsInstallable(status.isInstallable)
    setIsInstalled(status.isInstalled)
  }

  const setupListeners = () => {
    const handleInstallable = () => setIsInstallable(true)
    const handleInstalled = () => {
      setIsInstalled(true)
      setIsInstallable(false)
    }

    window.addEventListener('pwa-installable', handleInstallable)
    window.addEventListener('pwa-installed', handleInstalled)

    return () => {
      window.removeEventListener('pwa-installable', handleInstallable)
      window.removeEventListener('pwa-installed', handleInstalled)
    }
  }

  const installApp = async (): Promise<boolean> => {
    return await pwaManager.showInstallPrompt()
  }

  return { isInstallable, isInstalled, installApp }
}