'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Mail, Bell, BarChart3, Share2, Shield, 
  AlertCircle, CheckCircle2, Loader2, Info,
  MessageSquare, TrendingUp, Users, Zap
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/use-user'
import { toast } from 'sonner'
import { format } from 'date-fns'

interface ConsentType {
  id: string
  category: 'marketing' | 'communication' | 'data-processing' | 'third-party'
  name: string
  description: string
  icon: any
  required: boolean
  status: boolean
  updated_at?: string
}

export function ConsentManager() {
  const { user } = useUser()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [consents, setConsents] = useState<ConsentType[]>([
    // Marketing Consents
    {
      id: 'marketing-emails',
      category: 'marketing',
      name: 'Marketing Emails',
      description: 'Receive promotional emails about new features, tips, and special offers',
      icon: Mail,
      required: false,
      status: false,
    },
    {
      id: 'product-updates',
      category: 'marketing',
      name: 'Product Updates',
      description: 'Get notified about new features, improvements, and product announcements',
      icon: Bell,
      required: false,
      status: false,
    },
    {
      id: 'newsletters',
      category: 'marketing',
      name: 'Newsletters',
      description: 'Receive our monthly newsletter with industry insights and best practices',
      icon: MessageSquare,
      required: false,
      status: false,
    },
    // Communication Consents
    {
      id: 'transactional-emails',
      category: 'communication',
      name: 'Transactional Emails',
      description: 'Essential emails about your account, billing, and service updates',
      icon: Mail,
      required: true,
      status: true,
    },
    {
      id: 'support-communications',
      category: 'communication',
      name: 'Support Communications',
      description: 'Receive responses to your support requests and helpful tips',
      icon: Users,
      required: false,
      status: true,
    },
    {
      id: 'security-alerts',
      category: 'communication',
      name: 'Security Alerts',
      description: 'Important notifications about account security and suspicious activities',
      icon: Shield,
      required: true,
      status: true,
    },
    // Data Processing Consents
    {
      id: 'usage-analytics',
      category: 'data-processing',
      name: 'Usage Analytics',
      description: 'Allow us to analyze how you use our service to improve user experience',
      icon: BarChart3,
      required: false,
      status: false,
    },
    {
      id: 'performance-monitoring',
      category: 'data-processing',
      name: 'Performance Monitoring',
      description: 'Help us monitor and improve application performance and reliability',
      icon: TrendingUp,
      required: false,
      status: false,
    },
    {
      id: 'ai-training',
      category: 'data-processing',
      name: 'AI Model Training',
      description: 'Allow anonymized data to be used for improving our AI capabilities',
      icon: Zap,
      required: false,
      status: false,
    },
    // Third-Party Sharing
    {
      id: 'integration-sharing',
      category: 'third-party',
      name: 'Integration Data Sharing',
      description: 'Share necessary data with third-party services you connect',
      icon: Share2,
      required: false,
      status: false,
    },
    {
      id: 'analytics-providers',
      category: 'third-party',
      name: 'Analytics Providers',
      description: 'Share anonymized usage data with our analytics partners',
      icon: BarChart3,
      required: false,
      status: false,
    },
  ])
  const supabase = createClient()

  useEffect(() => {
    if (user) {
      loadConsents()
    }
  }, [user])

  const loadConsents = async () => {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('gdpr_consents')
        .select('*')
        .eq('user_id', user?.id)

      if (data) {
        // Update consent statuses based on saved data
        setConsents(prev => prev.map(consent => {
          const saved = data.find(d => d.type === consent.id)
          return {
            ...consent,
            status: saved ? saved.status : consent.required ? true : false,
            updated_at: saved?.updated_at,
          }
        }))
      }
    } catch (error) {
      console.error('Error loading consents:', error)
      toast.error('Failed to load consent preferences')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleConsent = (consentId: string) => {
    setConsents(prev => prev.map(consent => 
      consent.id === consentId && !consent.required
        ? { ...consent, status: !consent.status }
        : consent
    ))
  }

  const handleSaveConsents = async () => {
    setSaving(true)
    try {
      // Prepare consent records
      const consentRecords = consents.map(consent => ({
        user_id: user?.id,
        type: consent.id,
        status: consent.status,
        category: consent.category,
        metadata: {
          name: consent.name,
          description: consent.description,
          required: consent.required,
        },
      }))

      // Upsert all consents
      const { error } = await supabase
        .from('gdpr_consents')
        .upsert(consentRecords, { onConflict: 'user_id,type' })

      if (error) throw error

      // Send consent update to API
      await fetch('/api/gdpr/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consents: consentRecords }),
      })

      toast.success('Consent preferences updated successfully')
      loadConsents() // Reload to get updated timestamps
    } catch (error) {
      console.error('Error saving consents:', error)
      toast.error('Failed to save consent preferences')
    } finally {
      setSaving(false)
    }
  }

  const handleWithdrawAll = async () => {
    setConsents(prev => prev.map(consent => ({
      ...consent,
      status: consent.required ? true : false,
    })))
  }

  const getConsentsByCategory = (category: string) => {
    return consents.filter(c => c.category === category)
  }

  const getCategoryStats = (category: string) => {
    const categoryConsents = getConsentsByCategory(category)
    const active = categoryConsents.filter(c => c.status).length
    return { total: categoryConsents.length, active }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <Card>
        <CardHeader>
          <CardTitle>Consent Management</CardTitle>
          <CardDescription>
            Control how we collect, use, and share your personal data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            {['marketing', 'communication', 'data-processing', 'third-party'].map(category => {
              const stats = getCategoryStats(category)
              return (
                <div key={category} className="p-4 rounded-lg border">
                  <p className="text-sm font-medium capitalize">{category.replace('-', ' ')}</p>
                  <p className="text-2xl font-bold mt-1">
                    {stats.active}/{stats.total}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Active consents</p>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Consent Categories */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Manage Consents</CardTitle>
              <CardDescription>
                Choose which types of data collection and communication you're comfortable with
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleWithdrawAll}
            >
              Withdraw All Optional
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="marketing" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="marketing">Marketing</TabsTrigger>
              <TabsTrigger value="communication">Communication</TabsTrigger>
              <TabsTrigger value="data-processing">Data Processing</TabsTrigger>
              <TabsTrigger value="third-party">Third Party</TabsTrigger>
            </TabsList>

            <TabsContent value="marketing" className="space-y-4 mt-6">
              <div className="space-y-4">
                {getConsentsByCategory('marketing').map(consent => {
                  const Icon = consent.icon
                  return (
                    <div key={consent.id} className="flex items-start justify-between space-x-4 p-4 rounded-lg bg-muted/50">
                      <div className="flex items-start gap-3 flex-1">
                        <Icon className="h-5 w-5 text-muted-foreground mt-0.5" />
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <Label htmlFor={consent.id} className="font-medium cursor-pointer">
                              {consent.name}
                            </Label>
                            {consent.required && (
                              <Badge variant="secondary" className="text-xs">Required</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {consent.description}
                          </p>
                          {consent.updated_at && (
                            <p className="text-xs text-muted-foreground">
                              Last updated: {format(new Date(consent.updated_at), 'MMM d, yyyy')}
                            </p>
                          )}
                        </div>
                      </div>
                      <Switch
                        id={consent.id}
                        checked={consent.status}
                        onCheckedChange={() => handleToggleConsent(consent.id)}
                        disabled={consent.required}
                        className="mt-1"
                      />
                    </div>
                  )
                })}
              </div>
            </TabsContent>

            <TabsContent value="communication" className="space-y-4 mt-6">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Some communications are required for service operation and cannot be disabled.
                </AlertDescription>
              </Alert>
              <div className="space-y-4">
                {getConsentsByCategory('communication').map(consent => {
                  const Icon = consent.icon
                  return (
                    <div key={consent.id} className="flex items-start justify-between space-x-4 p-4 rounded-lg bg-muted/50">
                      <div className="flex items-start gap-3 flex-1">
                        <Icon className="h-5 w-5 text-muted-foreground mt-0.5" />
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <Label htmlFor={consent.id} className="font-medium cursor-pointer">
                              {consent.name}
                            </Label>
                            {consent.required && (
                              <Badge variant="secondary" className="text-xs">Required</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {consent.description}
                          </p>
                          {consent.updated_at && (
                            <p className="text-xs text-muted-foreground">
                              Last updated: {format(new Date(consent.updated_at), 'MMM d, yyyy')}
                            </p>
                          )}
                        </div>
                      </div>
                      <Switch
                        id={consent.id}
                        checked={consent.status}
                        onCheckedChange={() => handleToggleConsent(consent.id)}
                        disabled={consent.required}
                        className="mt-1"
                      />
                    </div>
                  )
                })}
              </div>
            </TabsContent>

            <TabsContent value="data-processing" className="space-y-4 mt-6">
              <div className="space-y-4">
                {getConsentsByCategory('data-processing').map(consent => {
                  const Icon = consent.icon
                  return (
                    <div key={consent.id} className="flex items-start justify-between space-x-4 p-4 rounded-lg bg-muted/50">
                      <div className="flex items-start gap-3 flex-1">
                        <Icon className="h-5 w-5 text-muted-foreground mt-0.5" />
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <Label htmlFor={consent.id} className="font-medium cursor-pointer">
                              {consent.name}
                            </Label>
                            {consent.required && (
                              <Badge variant="secondary" className="text-xs">Required</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {consent.description}
                          </p>
                          {consent.updated_at && (
                            <p className="text-xs text-muted-foreground">
                              Last updated: {format(new Date(consent.updated_at), 'MMM d, yyyy')}
                            </p>
                          )}
                        </div>
                      </div>
                      <Switch
                        id={consent.id}
                        checked={consent.status}
                        onCheckedChange={() => handleToggleConsent(consent.id)}
                        disabled={consent.required}
                        className="mt-1"
                      />
                    </div>
                  )
                })}
              </div>
            </TabsContent>

            <TabsContent value="third-party" className="space-y-4 mt-6">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Third-party data sharing is only done with services you explicitly connect or authorize.
                </AlertDescription>
              </Alert>
              <div className="space-y-4">
                {getConsentsByCategory('third-party').map(consent => {
                  const Icon = consent.icon
                  return (
                    <div key={consent.id} className="flex items-start justify-between space-x-4 p-4 rounded-lg bg-muted/50">
                      <div className="flex items-start gap-3 flex-1">
                        <Icon className="h-5 w-5 text-muted-foreground mt-0.5" />
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <Label htmlFor={consent.id} className="font-medium cursor-pointer">
                              {consent.name}
                            </Label>
                            {consent.required && (
                              <Badge variant="secondary" className="text-xs">Required</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {consent.description}
                          </p>
                          {consent.updated_at && (
                            <p className="text-xs text-muted-foreground">
                              Last updated: {format(new Date(consent.updated_at), 'MMM d, yyyy')}
                            </p>
                          )}
                        </div>
                      </div>
                      <Switch
                        id={consent.id}
                        checked={consent.status}
                        onCheckedChange={() => handleToggleConsent(consent.id)}
                        disabled={consent.required}
                        className="mt-1"
                      />
                    </div>
                  )
                })}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
        <CardFooter className="flex justify-between">
          <p className="text-sm text-muted-foreground">
            Changes will take effect immediately after saving
          </p>
          <Button onClick={handleSaveConsents} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Save Preferences
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}