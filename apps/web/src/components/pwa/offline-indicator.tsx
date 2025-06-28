'use client'

import { useState, useEffect } from 'react'
import { Wifi, WifiOff, RefreshCw, AlertTriangle } from 'lucide-react'
import { pwaManager } from '@/lib/pwa/pwa-manager'

interface OfflineIndicatorProps {
  className?: string
  showWhenOnline?: boolean
}

export function OfflineIndicator({ 
  className = '', 
  showWhenOnline = false 
}: OfflineIndicatorProps) {
  const [isOnline, setIsOnline] = useState(true)
  const [showReconnecting, setShowReconnecting] = useState(false)
  const [lastOnlineTime, setLastOnlineTime] = useState<Date | null>(null)

  useEffect(() => {
    // Initialize state
    setIsOnline(pwaManager.isOnlineState())

    // Set up network event listeners
    const handleOnline = () => {
      setIsOnline(true)
      setShowReconnecting(false)
      setLastOnlineTime(null)
    }

    const handleOffline = () => {
      setIsOnline(false)
      setLastOnlineTime(new Date())
      
      // Show reconnecting state after 5 seconds
      setTimeout(() => {
        if (!pwaManager.isOnlineState()) {
          setShowReconnecting(true)
        }
      }, 5000)
    }

    pwaManager.onOnline(handleOnline)
    pwaManager.onOffline(handleOffline)

    return () => {
      pwaManager.removeOnlineListener(handleOnline)
      pwaManager.removeOfflineListener(handleOffline)
    }
  }, [])

  // Don't render if online and showWhenOnline is false
  if (isOnline && !showWhenOnline) {
    return null
  }

  // Format offline duration
  const getOfflineDuration = (): string => {
    if (!lastOnlineTime) return ''
    
    const now = new Date()
    const diff = now.getTime() - lastOnlineTime.getTime()
    const minutes = Math.floor(diff / 60000)
    const seconds = Math.floor((diff % 60000) / 1000)
    
    if (minutes > 0) {
      return `${minutes}m ${seconds}s ago`
    }
    return `${seconds}s ago`
  }

  return (
    <div className={`
      fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-sm
      z-40 transform transition-all duration-300 ease-out
      ${className}
    `}>
      {isOnline ? (
        // Online indicator (only shown if showWhenOnline is true)
        <div className="
          bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800
          rounded-lg p-3 flex items-center gap-3
          shadow-sm
        ">
          <div className="flex-shrink-0">
            <div className="w-8 h-8 bg-green-100 dark:bg-green-800 rounded-full flex items-center justify-center">
              <Wifi className="w-4 h-4 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-green-800 dark:text-green-200">
              Connected
            </p>
            <p className="text-xs text-green-600 dark:text-green-400">
              All features are available
            </p>
          </div>
        </div>
      ) : (
        // Offline indicator
        <div className="
          bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800
          rounded-lg p-3 flex items-center gap-3
          shadow-lg backdrop-blur-sm
        ">
          <div className="flex-shrink-0">
            <div className="w-8 h-8 bg-red-100 dark:bg-red-800 rounded-full flex items-center justify-center">
              {showReconnecting ? (
                <RefreshCw className="w-4 h-4 text-red-600 dark:text-red-400 animate-spin" />
              ) : (
                <WifiOff className="w-4 h-4 text-red-600 dark:text-red-400" />
              )}
            </div>
          </div>
          
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-red-800 dark:text-red-200">
              {showReconnecting ? 'Reconnecting...' : 'No Internet Connection'}
            </p>
            <p className="text-xs text-red-600 dark:text-red-400">
              {lastOnlineTime ? 
                `Last online: ${getOfflineDuration()}` : 
                'Some features may be limited'
              }
            </p>
          </div>

          {/* Warning icon for extended offline periods */}
          {lastOnlineTime && new Date().getTime() - lastOnlineTime.getTime() > 300000 && (
            <div className="flex-shrink-0">
              <AlertTriangle className="w-4 h-4 text-red-500" />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Simple toast notification for network status changes
export function NetworkStatusToast() {
  const [isOnline, setIsOnline] = useState(true)
  const [showToast, setShowToast] = useState(false)
  const [toastMessage, setToastMessage] = useState('')

  useEffect(() => {
    // Initialize state
    setIsOnline(pwaManager.isOnlineState())

    const handleOnline = () => {
      if (!isOnline) { // Only show if we were previously offline
        setToastMessage('Connection restored')
        setShowToast(true)
        setTimeout(() => setShowToast(false), 3000)
      }
      setIsOnline(true)
    }

    const handleOffline = () => {
      setToastMessage('Connection lost')
      setShowToast(true)
      setTimeout(() => setShowToast(false), 3000)
      setIsOnline(false)
    }

    pwaManager.onOnline(handleOnline)
    pwaManager.onOffline(handleOffline)

    return () => {
      pwaManager.removeOnlineListener(handleOnline)
      pwaManager.removeOfflineListener(handleOffline)
    }
  }, [isOnline])

  if (!showToast) {
    return null
  }

  return (
    <div className="
      fixed top-4 left-1/2 transform -translate-x-1/2
      z-50 animate-in slide-in-from-top duration-300
    ">
      <div className={`
        px-4 py-2 rounded-full shadow-lg backdrop-blur-sm
        flex items-center gap-2 text-sm font-medium
        ${isOnline 
          ? 'bg-green-500/90 text-white' 
          : 'bg-red-500/90 text-white'
        }
      `}>
        {isOnline ? (
          <Wifi className="w-4 h-4" />
        ) : (
          <WifiOff className="w-4 h-4" />
        )}
        {toastMessage}
      </div>
    </div>
  )
}