'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Cookie, Shield, Settings, X } from 'lucide-react'
import Link from 'next/link'

export interface CookiePreferences {
  necessary: boolean
  analytics: boolean
  marketing: boolean
  functional: boolean
}

interface CookieBannerProps {
  onAccept?: (preferences: CookiePreferences) => void
  onReject?: () => void
}

const DEFAULT_PREFERENCES: CookiePreferences = {
  necessary: true,
  analytics: false,
  marketing: false,
  functional: false,
}

export function CookieBanner({ onAccept, onReject }: CookieBannerProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [showCustomize, setShowCustomize] = useState(false)
  const [preferences, setPreferences] = useState<CookiePreferences>(DEFAULT_PREFERENCES)

  useEffect(() => {
    // Check if cookie consent has been given
    const hasConsent = localStorage.getItem('cookie-consent')
    if (!hasConsent) {
      // Small delay to ensure smooth animation
      setTimeout(() => setIsVisible(true), 500)
    }
  }, [])

  const handleAcceptAll = () => {
    const allAccepted: CookiePreferences = {
      necessary: true,
      analytics: true,
      marketing: true,
      functional: true,
    }
    savePreferences(allAccepted)
    onAccept?.(allAccepted)
  }

  const handleRejectAll = () => {
    const onlyNecessary: CookiePreferences = {
      necessary: true,
      analytics: false,
      marketing: false,
      functional: false,
    }
    savePreferences(onlyNecessary)
    onReject?.()
  }

  const handleSavePreferences = () => {
    savePreferences(preferences)
    onAccept?.(preferences)
  }

  const savePreferences = (prefs: CookiePreferences) => {
    localStorage.setItem('cookie-consent', JSON.stringify({
      preferences: prefs,
      timestamp: new Date().toISOString(),
    }))
    setIsVisible(false)
    
    // Send preferences to API
    fetch('/api/gdpr/cookies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preferences: prefs }),
    }).catch(console.error)
  }

  const togglePreference = (key: keyof CookiePreferences) => {
    if (key === 'necessary') return // Can't toggle necessary cookies
    setPreferences(prev => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  if (!isVisible) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="fixed bottom-4 left-4 right-4 z-50 max-w-6xl mx-auto"
      >
        <Card className="shadow-lg border-2">
          {!showCustomize ? (
            <>
              <CardHeader className="flex flex-row items-start gap-4">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Cookie className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <CardTitle>Cookie Preferences</CardTitle>
                  <CardDescription className="mt-2">
                    We use cookies to enhance your experience. By continuing to visit this site you agree to our use of cookies.
                    Learn more in our{' '}
                    <Link href="/privacy" className="underline hover:text-primary">
                      Privacy Policy
                    </Link>
                    .
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setIsVisible(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardFooter className="flex flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  onClick={handleRejectAll}
                  className="w-full sm:w-auto"
                >
                  Reject All
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowCustomize(true)}
                  className="w-full sm:w-auto"
                >
                  <Settings className="mr-2 h-4 w-4" />
                  Customize
                </Button>
                <Button
                  onClick={handleAcceptAll}
                  className="w-full sm:w-auto"
                >
                  Accept All
                </Button>
              </CardFooter>
            </>
          ) : (
            <>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Shield className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle>Cookie Settings</CardTitle>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowCustomize(false)}
                  >
                    Back
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="categories" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="categories">Categories</TabsTrigger>
                    <TabsTrigger value="about">About Cookies</TabsTrigger>
                  </TabsList>
                  <TabsContent value="categories" className="space-y-4 mt-4">
                    <div className="space-y-4">
                      {/* Necessary Cookies */}
                      <div className="flex items-start justify-between space-x-4 p-4 rounded-lg bg-muted/50">
                        <div className="flex-1 space-y-1">
                          <Label htmlFor="necessary" className="font-medium">
                            Necessary Cookies
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Essential for the website to function properly. These cookies ensure basic functionalities and security features.
                          </p>
                        </div>
                        <Switch
                          id="necessary"
                          checked={preferences.necessary}
                          disabled
                          className="mt-1"
                        />
                      </div>

                      {/* Analytics Cookies */}
                      <div className="flex items-start justify-between space-x-4 p-4 rounded-lg bg-muted/50">
                        <div className="flex-1 space-y-1">
                          <Label htmlFor="analytics" className="font-medium">
                            Analytics Cookies
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Help us understand how visitors interact with our website by collecting and reporting information anonymously.
                          </p>
                        </div>
                        <Switch
                          id="analytics"
                          checked={preferences.analytics}
                          onCheckedChange={() => togglePreference('analytics')}
                          className="mt-1"
                        />
                      </div>

                      {/* Marketing Cookies */}
                      <div className="flex items-start justify-between space-x-4 p-4 rounded-lg bg-muted/50">
                        <div className="flex-1 space-y-1">
                          <Label htmlFor="marketing" className="font-medium">
                            Marketing Cookies
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Used to track visitors across websites to display ads that are relevant and engaging for individual users.
                          </p>
                        </div>
                        <Switch
                          id="marketing"
                          checked={preferences.marketing}
                          onCheckedChange={() => togglePreference('marketing')}
                          className="mt-1"
                        />
                      </div>

                      {/* Functional Cookies */}
                      <div className="flex items-start justify-between space-x-4 p-4 rounded-lg bg-muted/50">
                        <div className="flex-1 space-y-1">
                          <Label htmlFor="functional" className="font-medium">
                            Functional Cookies
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Enable enhanced functionality and personalization, such as videos and live chats.
                          </p>
                        </div>
                        <Switch
                          id="functional"
                          checked={preferences.functional}
                          onCheckedChange={() => togglePreference('functional')}
                          className="mt-1"
                        />
                      </div>
                    </div>
                  </TabsContent>
                  <TabsContent value="about" className="mt-4">
                    <div className="space-y-4 text-sm">
                      <p>
                        Cookies are small text files that websites place on your device to store information about your preferences and activities.
                      </p>
                      <p>
                        We categorize cookies based on their purpose:
                      </p>
                      <ul className="list-disc list-inside space-y-1 ml-4">
                        <li><strong>Necessary:</strong> Required for basic site functions</li>
                        <li><strong>Analytics:</strong> Help us improve our site</li>
                        <li><strong>Marketing:</strong> Deliver relevant advertisements</li>
                        <li><strong>Functional:</strong> Remember your preferences</li>
                      </ul>
                      <p>
                        You can change your cookie preferences at any time by visiting our{' '}
                        <Link href="/privacy" className="underline hover:text-primary">
                          Privacy Center
                        </Link>
                        .
                      </p>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
              <CardFooter className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleRejectAll}
                  className="flex-1"
                >
                  Reject All
                </Button>
                <Button
                  onClick={handleSavePreferences}
                  className="flex-1"
                >
                  Save Preferences
                </Button>
              </CardFooter>
            </>
          )}
        </Card>
      </motion.div>
    </AnimatePresence>
  )
}