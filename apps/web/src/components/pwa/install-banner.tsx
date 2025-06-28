'use client'

import { useState, useEffect } from 'react'
import { X, Download, Smartphone, Monitor } from 'lucide-react'
import { pwaManager } from '@/lib/pwa/pwa-manager'

interface InstallBannerProps {
  className?: string
}

export function InstallBanner({ className = '' }: InstallBannerProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isInstalling, setIsInstalling] = useState(false)
  const [installationStatus, setInstallationStatus] = useState({
    isInstalled: false,
    isInstallable: false,
    displayMode: 'browser'
  })

  useEffect(() => {
    checkInstallationStatus()
    setupEventListeners()
  }, [])

  const checkInstallationStatus = async () => {
    const status = await pwaManager.getInstallationStatus()
    setInstallationStatus(status)
    
    // Show banner if app is installable but not installed
    setIsVisible(status.isInstallable && !status.isInstalled)
  }

  const setupEventListeners = () => {
    const handleInstallable = () => {
      checkInstallationStatus()
    }

    const handleInstalled = () => {
      setIsVisible(false)
      setInstallationStatus(prev => ({ ...prev, isInstalled: true }))
    }

    window.addEventListener('pwa-installable', handleInstallable)
    window.addEventListener('pwa-installed', handleInstalled)

    return () => {
      window.removeEventListener('pwa-installable', handleInstallable)
      window.removeEventListener('pwa-installed', handleInstalled)
    }
  }

  const handleInstall = async () => {
    setIsInstalling(true)
    
    try {
      const result = await pwaManager.showInstallPrompt()
      
      if (result) {
        setIsVisible(false)
        // Show success message
        showInstallSuccessMessage()
      }
    } catch (error) {
      console.error('Install failed:', error)
    } finally {
      setIsInstalling(false)
    }
  }

  const showInstallSuccessMessage = () => {
    // Create temporary success message
    const message = document.createElement('div')
    message.className = 'install-success-message'
    message.innerHTML = `
      <div style="
        position: fixed;
        top: 20px;
        right: 20px;
        background: #10B981;
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 0.75rem;
        box-shadow: 0 10px 25px -5px rgba(16, 185, 129, 0.4);
        z-index: 50;
        animation: slideIn 0.3s ease-out;
      ">
        <div style="font-weight: 600;">ColdCopy Installed!</div>
        <div style="font-size: 0.875rem; opacity: 0.9;">
          You can now access ColdCopy from your home screen
        </div>
      </div>
    `

    document.body.appendChild(message)

    setTimeout(() => {
      if (document.body.contains(message)) {
        message.remove()
      }
    }, 4000)
  }

  const handleDismiss = () => {
    setIsVisible(false)
    // Remember dismissal for this session
    sessionStorage.setItem('pwa-banner-dismissed', 'true')
  }

  // Don't show if already dismissed this session
  useEffect(() => {
    const dismissed = sessionStorage.getItem('pwa-banner-dismissed')
    if (dismissed) {
      setIsVisible(false)
    }
  }, [])

  if (!isVisible) {
    return null
  }

  return (
    <div className={`
      fixed top-4 left-4 right-4 md:left-auto md:right-4 md:max-w-sm
      bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700
      rounded-xl shadow-lg z-50 p-4
      transform transition-all duration-300 ease-out
      ${className}
    `}>
      {/* Dismiss button */}
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>

      {/* Content */}
      <div className="pr-6">
        {/* Icon */}
        <div className="flex items-center justify-center w-12 h-12 bg-indigo-100 dark:bg-indigo-900 rounded-lg mb-3">
          <div className="text-indigo-600 dark:text-indigo-400">
            {installationStatus.displayMode === 'browser' ? (
              <Smartphone className="w-6 h-6" />
            ) : (
              <Monitor className="w-6 h-6" />
            )}
          </div>
        </div>

        {/* Title and description */}
        <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
          Install ColdCopy
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
          Get quick access to your cold outreach campaigns. Install ColdCopy for a native app experience.
        </p>

        {/* Features */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full mr-2"></div>
            Works offline
          </div>
          <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full mr-2"></div>
            Faster loading
          </div>
          <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full mr-2"></div>
            Push notifications
          </div>
        </div>

        {/* Install button */}
        <button
          onClick={handleInstall}
          disabled={isInstalling}
          className="
            w-full flex items-center justify-center gap-2 
            bg-indigo-600 hover:bg-indigo-700 
            disabled:bg-indigo-400 disabled:cursor-not-allowed
            text-white font-medium py-2.5 px-4 rounded-lg
            transition-colors duration-200
          "
        >
          {isInstalling ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Installing...
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              Install App
            </>
          )}
        </button>
      </div>

      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-xl transform translate-x-4 -translate-y-4 -z-10"></div>
    </div>
  )
}

// PWA Status Component
export function PWAStatus() {
  const [installationStatus, setInstallationStatus] = useState({
    isInstalled: false,
    isInstallable: false,
    displayMode: 'browser'
  })
  const [isOnline, setIsOnline] = useState(true)
  const [cacheStatus, setCacheStatus] = useState({
    totalCaches: 0,
    totalSize: 0,
    cacheNames: []
  })

  useEffect(() => {
    checkStatus()
    setupNetworkListeners()
  }, [])

  const checkStatus = async () => {
    const status = await pwaManager.getInstallationStatus()
    setInstallationStatus(status)

    const cache = await pwaManager.getCacheStatus()
    setCacheStatus(cache)

    setIsOnline(pwaManager.isOnlineState())
  }

  const setupNetworkListeners = () => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    pwaManager.onOnline(handleOnline)
    pwaManager.onOffline(handleOffline)

    return () => {
      pwaManager.removeOnlineListener(handleOnline)
      pwaManager.removeOfflineListener(handleOffline)
    }
  }

  const handleClearCache = async () => {
    const success = await pwaManager.clearCache()
    if (success) {
      setCacheStatus({ totalCaches: 0, totalSize: 0, cacheNames: [] })
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        PWA Status
      </h3>

      <div className="space-y-4">
        {/* Installation Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-300">Installation</span>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${
              installationStatus.isInstalled ? 'bg-green-500' : 'bg-gray-300'
            }`}></div>
            <span className="text-sm font-medium">
              {installationStatus.isInstalled ? 'Installed' : 'Not Installed'}
            </span>
          </div>
        </div>

        {/* Display Mode */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-300">Display Mode</span>
          <span className="text-sm font-medium capitalize">
            {installationStatus.displayMode}
          </span>
        </div>

        {/* Network Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-300">Network</span>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${
              isOnline ? 'bg-green-500' : 'bg-red-500'
            }`}></div>
            <span className="text-sm font-medium">
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>

        {/* Cache Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-300">Cache Size</span>
          <span className="text-sm font-medium">
            {pwaManager.formatCacheSize(cacheStatus.totalSize)}
          </span>
        </div>

        {/* Clear Cache Button */}
        {cacheStatus.totalSize > 0 && (
          <button
            onClick={handleClearCache}
            className="w-full mt-4 px-3 py-2 text-sm text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Clear Cache
          </button>
        )}
      </div>
    </div>
  )
}