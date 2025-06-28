'use client'

import { useState, useEffect } from 'react'
import { 
  Download, 
  Bell, 
  HardDrive, 
  Wifi, 
  WifiOff, 
  Smartphone, 
  Monitor,
  RefreshCw,
  Trash2,
  Settings,
  CheckCircle,
  XCircle
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { usePWA } from './pwa-provider'
import { pwaManager } from '@/lib/pwa/pwa-manager'

interface PWASettingsProps {
  className?: string
}

export function PWASettings({ className = '' }: PWASettingsProps) {
  const {
    isInitialized,
    isOnline,
    isInstallable,
    isInstalled,
    installApp,
    sendNotification,
    clearCache
  } = usePWA()

  const [cacheStatus, setCacheStatus] = useState({
    totalCaches: 0,
    totalSize: 0,
    cacheNames: []
  })
  const [notificationPermission, setNotificationPermission] = useState<'granted' | 'denied' | 'default'>('default')
  const [isLoading, setIsLoading] = useState({
    install: false,
    notification: false,
    cache: false
  })
  const [autoCache, setAutoCache] = useState(true)
  const [pushNotifications, setPushNotifications] = useState(false)

  useEffect(() => {
    loadSettings()
    checkCacheStatus()
    checkNotificationPermission()
  }, [])

  const loadSettings = () => {
    const settings = localStorage.getItem('pwa-settings')
    if (settings) {
      const parsed = JSON.parse(settings)
      setAutoCache(parsed.autoCache ?? true)
      setPushNotifications(parsed.pushNotifications ?? false)
    }
  }

  const saveSettings = (newSettings: { autoCache?: boolean; pushNotifications?: boolean }) => {
    const currentSettings = JSON.parse(localStorage.getItem('pwa-settings') || '{}')
    const updatedSettings = { ...currentSettings, ...newSettings }
    localStorage.setItem('pwa-settings', JSON.stringify(updatedSettings))
  }

  const checkCacheStatus = async () => {
    const status = await pwaManager.getCacheStatus()
    setCacheStatus(status)
  }

  const checkNotificationPermission = () => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission)
    }
  }

  const handleInstall = async () => {
    setIsLoading(prev => ({ ...prev, install: true }))
    try {
      await installApp()
    } finally {
      setIsLoading(prev => ({ ...prev, install: false }))
    }
  }

  const handleNotificationTest = async () => {
    setIsLoading(prev => ({ ...prev, notification: true }))
    try {
      if (notificationPermission !== 'granted') {
        const permission = await pwaManager.requestNotificationPermission()
        setNotificationPermission(permission.state)
        
        if (permission.state !== 'granted') {
          return
        }
      }

      await sendNotification('Test Notification', {
        body: 'This is a test notification from ColdCopy',
        icon: '/icon-192.png',
        tag: 'test'
      })
    } finally {
      setIsLoading(prev => ({ ...prev, notification: false }))
    }
  }

  const handleClearCache = async () => {
    setIsLoading(prev => ({ ...prev, cache: true }))
    try {
      await clearCache()
      await checkCacheStatus()
    } finally {
      setIsLoading(prev => ({ ...prev, cache: false }))
    }
  }

  const handleAutoCacheToggle = (enabled: boolean) => {
    setAutoCache(enabled)
    saveSettings({ autoCache: enabled })
  }

  const handlePushNotificationsToggle = async (enabled: boolean) => {
    if (enabled && notificationPermission !== 'granted') {
      const permission = await pwaManager.requestNotificationPermission()
      setNotificationPermission(permission.state)
      
      if (permission.state !== 'granted') {
        return
      }
    }
    
    setPushNotifications(enabled)
    saveSettings({ pushNotifications: enabled })
  }

  if (!isInitialized) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            PWA Settings
          </CardTitle>
          <CardDescription>
            Progressive Web App features are not available
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Your browser doesn't support PWA features or service workers are disabled.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Installation Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="w-5 h-5" />
            App Installation
          </CardTitle>
          <CardDescription>
            Install ColdCopy as a native app for better performance
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${
                isInstalled ? 'bg-green-500' : isInstallable ? 'bg-yellow-500' : 'bg-gray-300'
              }`} />
              <div>
                <p className="font-medium">
                  {isInstalled ? 'Installed' : isInstallable ? 'Available for Installation' : 'Not Available'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {isInstalled 
                    ? 'App is installed and running in standalone mode'
                    : isInstallable 
                      ? 'App can be installed for offline access'
                      : 'Installation not supported on this device'
                  }
                </p>
              </div>
            </div>
            {isInstallable && !isInstalled && (
              <Button 
                onClick={handleInstall}
                disabled={isLoading.install}
                size="sm"
              >
                {isLoading.install ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                Install
              </Button>
            )}
          </div>

          {isInstalled && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
              <div className="flex items-center gap-2 text-green-800 dark:text-green-200">
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm font-medium">App successfully installed</span>
              </div>
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                You can access ColdCopy from your home screen or app launcher
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Network Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isOnline ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
            Network Status
          </CardTitle>
          <CardDescription>
            Monitor your connection and offline capabilities
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${
                isOnline ? 'bg-green-500' : 'bg-red-500'
              }`} />
              <div>
                <p className="font-medium">
                  {isOnline ? 'Online' : 'Offline'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {isOnline 
                    ? 'All features are available'
                    : 'Limited functionality - cached data available'
                  }
                </p>
              </div>
            </div>
            <Badge variant={isOnline ? 'default' : 'destructive'}>
              {isOnline ? 'Connected' : 'Disconnected'}
            </Badge>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Automatic Caching</p>
              <p className="text-xs text-muted-foreground">
                Cache data automatically for offline access
              </p>
            </div>
            <Switch
              checked={autoCache}
              onCheckedChange={handleAutoCacheToggle}
            />
          </div>
        </CardContent>
      </Card>

      {/* Cache Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="w-5 h-5" />
            Cache Management
          </CardTitle>
          <CardDescription>
            Manage offline data and storage usage
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 bg-muted rounded-lg">
              <p className="text-2xl font-bold">{cacheStatus.totalCaches}</p>
              <p className="text-sm text-muted-foreground">Cache Stores</p>
            </div>
            <div className="text-center p-3 bg-muted rounded-lg">
              <p className="text-2xl font-bold">{pwaManager.formatCacheSize(cacheStatus.totalSize)}</p>
              <p className="text-sm text-muted-foreground">Storage Used</p>
            </div>
          </div>

          {cacheStatus.cacheNames.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">Cache Stores:</p>
              <div className="space-y-1">
                {cacheStatus.cacheNames.map((name, index) => (
                  <div key={index} className="text-xs bg-muted px-2 py-1 rounded">
                    {name}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={checkCacheStatus}
              disabled={isLoading.cache}
            >
              <RefreshCw className={`w-4 h-4 ${isLoading.cache ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            {cacheStatus.totalSize > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleClearCache}
                disabled={isLoading.cache}
              >
                <Trash2 className="w-4 h-4" />
                Clear Cache
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Push Notifications
          </CardTitle>
          <CardDescription>
            Configure push notifications for important updates
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${
                notificationPermission === 'granted' ? 'bg-green-500' : 
                notificationPermission === 'denied' ? 'bg-red-500' : 'bg-yellow-500'
              }`} />
              <div>
                <p className="font-medium">
                  {notificationPermission === 'granted' ? 'Enabled' : 
                   notificationPermission === 'denied' ? 'Blocked' : 'Not Configured'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {notificationPermission === 'granted' 
                    ? 'Notifications are allowed'
                    : notificationPermission === 'denied'
                      ? 'Notifications are blocked by browser'
                      : 'Permission not yet requested'
                  }
                </p>
              </div>
            </div>
            <Badge variant={
              notificationPermission === 'granted' ? 'default' : 
              notificationPermission === 'denied' ? 'destructive' : 'secondary'
            }>
              {notificationPermission}
            </Badge>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Push Notifications</p>
              <p className="text-xs text-muted-foreground">
                Receive notifications for campaign updates and replies
              </p>
            </div>
            <Switch
              checked={pushNotifications && notificationPermission === 'granted'}
              onCheckedChange={handlePushNotificationsToggle}
              disabled={notificationPermission === 'denied'}
            />
          </div>

          {notificationPermission === 'granted' && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleNotificationTest}
              disabled={isLoading.notification}
            >
              {isLoading.notification ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Bell className="w-4 h-4" />
              )}
              Test Notification
            </Button>
          )}

          {notificationPermission === 'denied' && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
                <XCircle className="w-4 h-4" />
                <span className="text-sm font-medium">Notifications blocked</span>
              </div>
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                Please enable notifications in your browser settings to receive updates
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}