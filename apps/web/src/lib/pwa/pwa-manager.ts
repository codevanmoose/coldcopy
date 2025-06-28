// PWA Manager - Handle service worker registration and PWA features
'use client'

export interface PWAInstallPrompt {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

interface NotificationPermission {
  state: 'granted' | 'denied' | 'default'
}

export class PWAManager {
  private static instance: PWAManager
  private serviceWorkerRegistration: ServiceWorkerRegistration | null = null
  private installPrompt: PWAInstallPrompt | null = null
  private isOnline = true
  private onlineCallbacks: (() => void)[] = []
  private offlineCallbacks: (() => void)[] = []

  private constructor() {
    this.initializeEventListeners()
  }

  static getInstance(): PWAManager {
    if (!PWAManager.instance) {
      PWAManager.instance = new PWAManager()
    }
    return PWAManager.instance
  }

  // Initialize PWA and service worker
  async initialize(): Promise<boolean> {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      console.log('PWA: Service workers not supported')
      return false
    }

    try {
      // Register service worker
      const registration = await this.registerServiceWorker()
      
      if (registration) {
        console.log('PWA: Service worker registered successfully')
        
        // Set up update check
        this.setupUpdateCheck(registration)
        
        // Request notification permission if not already granted
        await this.requestNotificationPermission()
        
        return true
      }
    } catch (error) {
      console.error('PWA: Failed to initialize', error)
    }

    return false
  }

  // Register service worker
  private async registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      })

      this.serviceWorkerRegistration = registration

      // Handle service worker updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New version available
              this.showUpdateNotification()
            }
          })
        }
      })

      return registration
    } catch (error) {
      console.error('PWA: Service worker registration failed', error)
      return null
    }
  }

  // Set up automatic update checking
  private setupUpdateCheck(registration: ServiceWorkerRegistration) {
    // Check for updates every 60 seconds
    setInterval(() => {
      registration.update()
    }, 60000)

    // Check for updates when page becomes visible
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        registration.update()
      }
    })
  }

  // Show update notification
  private showUpdateNotification() {
    // Create custom update notification
    const notification = document.createElement('div')
    notification.className = 'pwa-update-notification'
    notification.innerHTML = `
      <div style="
        position: fixed;
        top: 20px;
        right: 20px;
        background: #6366F1;
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 0.75rem;
        box-shadow: 0 10px 25px -5px rgba(99, 102, 241, 0.4);
        z-index: 50;
        max-width: 300px;
        animation: slideIn 0.3s ease-out;
      ">
        <div style="font-weight: 600; margin-bottom: 0.5rem;">Update Available</div>
        <div style="font-size: 0.875rem; margin-bottom: 1rem; opacity: 0.9;">
          A new version of ColdCopy is available
        </div>
        <div style="display: flex; gap: 0.5rem;">
          <button onclick="window.pwaManager.applyUpdate()" style="
            background: white;
            color: #6366F1;
            border: none;
            padding: 0.5rem 1rem;
            border-radius: 0.5rem;
            font-weight: 600;
            cursor: pointer;
            font-size: 0.875rem;
          ">Update</button>
          <button onclick="this.parentElement.parentElement.parentElement.remove()" style="
            background: transparent;
            color: white;
            border: 1px solid rgba(255,255,255,0.3);
            padding: 0.5rem 1rem;
            border-radius: 0.5rem;
            cursor: pointer;
            font-size: 0.875rem;
          ">Later</button>
        </div>
      </div>
      <style>
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      </style>
    `

    document.body.appendChild(notification)

    // Remove notification after 10 seconds if not acted upon
    setTimeout(() => {
      if (document.body.contains(notification)) {
        notification.remove()
      }
    }, 10000)
  }

  // Apply service worker update
  async applyUpdate(): Promise<void> {
    if (!this.serviceWorkerRegistration) return

    const waitingWorker = this.serviceWorkerRegistration.waiting
    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' })
      window.location.reload()
    }
  }

  // Check if app can be installed
  isInstallable(): boolean {
    return this.installPrompt !== null
  }

  // Show install prompt
  async showInstallPrompt(): Promise<boolean> {
    if (!this.installPrompt) {
      console.log('PWA: Install prompt not available')
      return false
    }

    try {
      await this.installPrompt.prompt()
      const { outcome } = await this.installPrompt.userChoice
      
      // Clear the prompt as it can only be used once
      this.installPrompt = null
      
      return outcome === 'accepted'
    } catch (error) {
      console.error('PWA: Install prompt failed', error)
      return false
    }
  }

  // Request notification permission
  async requestNotificationPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      return { state: 'denied' }
    }

    if (Notification.permission === 'granted') {
      return { state: 'granted' }
    }

    if (Notification.permission === 'denied') {
      return { state: 'denied' }
    }

    try {
      const permission = await Notification.requestPermission()
      return { state: permission }
    } catch (error) {
      console.error('PWA: Notification permission request failed', error)
      return { state: 'denied' }
    }
  }

  // Send notification
  async sendNotification(title: string, options: NotificationOptions = {}): Promise<boolean> {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      return false
    }

    try {
      const notification = new Notification(title, {
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        ...options
      })

      // Auto-close after 5 seconds
      setTimeout(() => notification.close(), 5000)

      return true
    } catch (error) {
      console.error('PWA: Notification failed', error)
      return false
    }
  }

  // Check if device is online
  isOnlineState(): boolean {
    return this.isOnline
  }

  // Add online/offline event listeners
  onOnline(callback: () => void): void {
    this.onlineCallbacks.push(callback)
  }

  onOffline(callback: () => void): void {
    this.offlineCallbacks.push(callback)
  }

  // Remove event listeners
  removeOnlineListener(callback: () => void): void {
    this.onlineCallbacks = this.onlineCallbacks.filter(cb => cb !== callback)
  }

  removeOfflineListener(callback: () => void): void {
    this.offlineCallbacks = this.offlineCallbacks.filter(cb => cb !== callback)
  }

  // Initialize event listeners
  private initializeEventListeners(): void {
    if (typeof window === 'undefined') return

    // Network status
    this.isOnline = navigator.onLine

    window.addEventListener('online', () => {
      this.isOnline = true
      this.onlineCallbacks.forEach(callback => callback())
    })

    window.addEventListener('offline', () => {
      this.isOnline = false
      this.offlineCallbacks.forEach(callback => callback())
    })

    // Install prompt
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault()
      this.installPrompt = event as any
      console.log('PWA: Install prompt available')
      
      // Dispatch custom event
      window.dispatchEvent(new CustomEvent('pwa-installable'))
    })

    // App installed
    window.addEventListener('appinstalled', () => {
      this.installPrompt = null
      console.log('PWA: App installed successfully')
      
      // Dispatch custom event
      window.dispatchEvent(new CustomEvent('pwa-installed'))
    })
  }

  // Get installation status
  async getInstallationStatus(): Promise<{
    isInstalled: boolean
    isInstallable: boolean
    displayMode: string
  }> {
    const isInstalled = window.matchMedia('(display-mode: standalone)').matches ||
                       window.matchMedia('(display-mode: fullscreen)').matches ||
                       (window.navigator as any).standalone === true

    return {
      isInstalled,
      isInstallable: this.isInstallable(),
      displayMode: window.matchMedia('(display-mode: standalone)').matches ? 'standalone' : 'browser'
    }
  }

  // Cache management
  async clearCache(): Promise<boolean> {
    try {
      if (this.serviceWorkerRegistration) {
        // Send message to service worker to clear cache
        const messageChannel = new MessageChannel()
        this.serviceWorkerRegistration.active?.postMessage(
          { type: 'CLEAR_CACHE' },
          [messageChannel.port2]
        )
      }

      // Clear browser cache
      if ('caches' in window) {
        const cacheNames = await caches.keys()
        await Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        )
      }

      return true
    } catch (error) {
      console.error('PWA: Cache clearing failed', error)
      return false
    }
  }

  // Update cache for specific URL
  updateCache(url: string): void {
    if (this.serviceWorkerRegistration) {
      this.serviceWorkerRegistration.active?.postMessage({
        type: 'CACHE_UPDATE',
        url
      })
    }
  }

  // Get cache status
  async getCacheStatus(): Promise<{
    totalCaches: number
    totalSize: number
    cacheNames: string[]
  }> {
    try {
      if (!('caches' in window)) {
        return { totalCaches: 0, totalSize: 0, cacheNames: [] }
      }

      const cacheNames = await caches.keys()
      let totalSize = 0

      for (const cacheName of cacheNames) {
        const cache = await caches.open(cacheName)
        const requests = await cache.keys()
        
        for (const request of requests) {
          try {
            const response = await cache.match(request)
            if (response) {
              const blob = await response.blob()
              totalSize += blob.size
            }
          } catch (error) {
            // Ignore errors for individual cache entries
          }
        }
      }

      return {
        totalCaches: cacheNames.length,
        totalSize,
        cacheNames
      }
    } catch (error) {
      console.error('PWA: Cache status check failed', error)
      return { totalCaches: 0, totalSize: 0, cacheNames: [] }
    }
  }

  // Format cache size for display
  formatCacheSize(bytes: number): string {
    if (bytes === 0) return '0 B'
    
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }
}

// Global instance
declare global {
  interface Window {
    pwaManager: PWAManager
  }
}

// Create global instance
if (typeof window !== 'undefined') {
  window.pwaManager = PWAManager.getInstance()
}

export const pwaManager = PWAManager.getInstance()