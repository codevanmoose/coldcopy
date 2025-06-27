'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Globe, 
  Palette, 
  Users, 
  Settings,
  Crown,
  CheckCircle,
  AlertTriangle,
  Info,
  Sparkles
} from 'lucide-react'
import { WhiteLabelProvider, useWhiteLabelFeatures } from '@/components/white-label/white-label-provider'
import { DomainManager } from '@/components/white-label/domain-manager'
import { BrandingCustomizer } from '@/components/white-label/branding-customizer'
import { ClientPortalBuilder } from '@/components/white-label/client-portal-builder'
import { useAuthStore } from '@/stores/auth'

export default function WhiteLabelSettingsPage() {
  return (
    <WhiteLabelProvider>
      <WhiteLabelSettingsContent />
    </WhiteLabelProvider>
  )
}

function WhiteLabelSettingsContent() {
  const { dbUser } = useAuthStore()
  const { 
    isWhiteLabelEnabled,
    hasCustomDomains,
    hasClientPortals,
    hasCustomEmailTemplates,
    hasWhiteLabelReports,
    hasAPIAccess,
    hasSSOIntegration,
    hasAdvancedAnalytics,
    hasWebhookEndpoints
  } = useWhiteLabelFeatures()

  const [activeTab, setActiveTab] = useState('overview')

  // Check if user has admin permissions
  const isAdmin = dbUser?.role === 'workspace_admin' || dbUser?.role === 'super_admin'

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">White-Label Settings</h1>
          <p className="text-muted-foreground">
            Customize your brand and manage client portals
          </p>
        </div>
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            You need admin permissions to access white-label settings.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Crown className="h-8 w-8 text-yellow-500" />
          White-Label Settings
        </h1>
        <p className="text-muted-foreground">
          Customize your brand, manage domains, and create client portals
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <Info className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="domains" className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Domains
          </TabsTrigger>
          <TabsTrigger value="branding" className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            Branding
          </TabsTrigger>
          <TabsTrigger value="portals" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Client Portals
          </TabsTrigger>
          <TabsTrigger value="advanced" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Advanced
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="space-y-6">
            <WhiteLabelOverview />
            <FeatureStatus />
            <QuickActions />
          </div>
        </TabsContent>

        <TabsContent value="domains">
          <DomainManager />
        </TabsContent>

        <TabsContent value="branding">
          <BrandingCustomizer />
        </TabsContent>

        <TabsContent value="portals">
          <ClientPortalBuilder />
        </TabsContent>

        <TabsContent value="advanced">
          <AdvancedSettings />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function WhiteLabelOverview() {
  const { 
    isWhiteLabelEnabled,
    hasCustomDomains,
    hasClientPortals,
    hasCustomEmailTemplates,
    hasWhiteLabelReports
  } = useWhiteLabelFeatures()

  const enabledFeatures = [
    hasCustomDomains && 'Custom Domains',
    hasClientPortals && 'Client Portals', 
    hasCustomEmailTemplates && 'Email Templates',
    hasWhiteLabelReports && 'White-Label Reports'
  ].filter(Boolean)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          White-Label Overview
        </CardTitle>
        <CardDescription>
          Your white-label configuration status and quick stats
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className={`h-3 w-3 rounded-full ${isWhiteLabelEnabled ? 'bg-green-500' : 'bg-gray-300'}`} />
              <Label className="font-medium">Status</Label>
            </div>
            <p className="text-sm text-muted-foreground">
              {isWhiteLabelEnabled ? 'Active' : 'Not Configured'}
            </p>
          </div>

          <div className="space-y-2">
            <Label className="font-medium">Features Enabled</Label>
            <p className="text-sm text-muted-foreground">
              {enabledFeatures.length} of 4 features active
            </p>
          </div>

          <div className="space-y-2">
            <Label className="font-medium">Plan</Label>
            <div className="flex items-center gap-2">
              <Badge variant="default">Enterprise</Badge>
              <span className="text-sm text-muted-foreground">All features included</span>
            </div>
          </div>
        </div>

        {enabledFeatures.length > 0 && (
          <div className="mt-6">
            <Label className="font-medium mb-3 block">Active Features</Label>
            <div className="flex flex-wrap gap-2">
              {enabledFeatures.map((feature) => (
                <Badge key={feature} variant="outline" className="gap-1">
                  <CheckCircle className="h-3 w-3" />
                  {feature}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {!isWhiteLabelEnabled && (
          <Alert className="mt-6">
            <Info className="h-4 w-4" />
            <AlertDescription>
              Configure your first custom domain to enable white-label features.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}

function FeatureStatus() {
  const features = useWhiteLabelFeatures()

  const featureList = [
    {
      name: 'Custom Domains',
      description: 'Use your own domain for the application',
      enabled: features.hasCustomDomains,
      icon: Globe,
    },
    {
      name: 'Client Portals',
      description: 'Create secure portals for your clients',
      enabled: features.hasClientPortals,
      icon: Users,
    },
    {
      name: 'Custom Email Templates',
      description: 'Customize all email communications',
      enabled: features.hasCustomEmailTemplates,
      icon: Palette,
    },
    {
      name: 'White-Label Reports',
      description: 'Remove ColdCopy branding from reports',
      enabled: features.hasWhiteLabelReports,
      icon: Settings,
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Feature Status</CardTitle>
        <CardDescription>
          Overview of your white-label feature availability
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {featureList.map((feature) => (
            <div key={feature.name} className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <feature.icon className="h-5 w-5 text-muted-foreground" />
                <div>
                  <h4 className="font-medium">{feature.name}</h4>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </div>
              </div>
              <Badge variant={feature.enabled ? 'default' : 'secondary'}>
                {feature.enabled ? 'Enabled' : 'Available'}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function QuickActions() {
  const { isWhiteLabelEnabled, hasCustomDomains } = useWhiteLabelFeatures()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
        <CardDescription>
          Common tasks to get started with white-labeling
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Button 
            variant="outline" 
            className="h-auto p-4 justify-start"
            onClick={() => {
              // Navigate to domains tab
              const event = new CustomEvent('tab-change', { detail: 'domains' })
              window.dispatchEvent(event)
            }}
          >
            <div className="space-y-1 text-left">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                <span className="font-medium">Add Domain</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Configure your custom domain
              </p>
            </div>
          </Button>

          <Button 
            variant="outline" 
            className="h-auto p-4 justify-start"
            disabled={!hasCustomDomains}
            onClick={() => {
              const event = new CustomEvent('tab-change', { detail: 'branding' })
              window.dispatchEvent(event)
            }}
          >
            <div className="space-y-1 text-left">
              <div className="flex items-center gap-2">
                <Palette className="h-4 w-4" />
                <span className="font-medium">Customize Branding</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Set your colors and logo
              </p>
            </div>
          </Button>

          <Button 
            variant="outline" 
            className="h-auto p-4 justify-start"
            disabled={!isWhiteLabelEnabled}
            onClick={() => {
              const event = new CustomEvent('tab-change', { detail: 'portals' })
              window.dispatchEvent(event)
            }}
          >
            <div className="space-y-1 text-left">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span className="font-medium">Create Portal</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Set up client portal access
              </p>
            </div>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function AdvancedSettings() {
  const features = useWhiteLabelFeatures()
  const [settings, setSettings] = useState({
    hideColdCopyBranding: false,
    hidePoweredBy: false,
    showSupportChat: true,
    enableWebhooks: false,
    enableSSO: false,
    enableAPI: false,
  })

  const handleSettingChange = (key: string, value: boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Advanced Configuration</CardTitle>
          <CardDescription>
            Advanced white-label settings and integrations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Hide ColdCopy Branding</Label>
                <p className="text-sm text-muted-foreground">
                  Remove ColdCopy branding from the interface
                </p>
              </div>
              <Switch
                checked={settings.hideColdCopyBranding}
                onCheckedChange={(checked) => handleSettingChange('hideColdCopyBranding', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Hide "Powered by" Text</Label>
                <p className="text-sm text-muted-foreground">
                  Remove "Powered by ColdCopy" from footers
                </p>
              </div>
              <Switch
                checked={settings.hidePoweredBy}
                onCheckedChange={(checked) => handleSettingChange('hidePoweredBy', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Show Support Chat</Label>
                <p className="text-sm text-muted-foreground">
                  Display support chat widget
                </p>
              </div>
              <Switch
                checked={settings.showSupportChat}
                onCheckedChange={(checked) => handleSettingChange('showSupportChat', checked)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Integrations</CardTitle>
          <CardDescription>
            Advanced integrations for enterprise customers
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Webhook Endpoints</Label>
                <p className="text-sm text-muted-foreground">
                  Enable webhook notifications for events
                </p>
              </div>
              <div className="flex items-center gap-2">
                {features.hasWebhookEndpoints && (
                  <Badge variant="default">Available</Badge>
                )}
                <Switch
                  checked={settings.enableWebhooks}
                  onCheckedChange={(checked) => handleSettingChange('enableWebhooks', checked)}
                  disabled={!features.hasWebhookEndpoints}
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>SSO Integration</Label>
                <p className="text-sm text-muted-foreground">
                  Single Sign-On with your identity provider
                </p>
              </div>
              <div className="flex items-center gap-2">
                {features.hasSSOIntegration && (
                  <Badge variant="default">Available</Badge>
                )}
                <Switch
                  checked={settings.enableSSO}
                  onCheckedChange={(checked) => handleSettingChange('enableSSO', checked)}
                  disabled={!features.hasSSOIntegration}
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>API Access</Label>
                <p className="text-sm text-muted-foreground">
                  Enable API access for custom integrations
                </p>
              </div>
              <div className="flex items-center gap-2">
                {features.hasAPIAccess && (
                  <Badge variant="default">Available</Badge>
                )}
                <Switch
                  checked={settings.enableAPI}
                  onCheckedChange={(checked) => handleSettingChange('enableAPI', checked)}
                  disabled={!features.hasAPIAccess}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Advanced integrations may require additional configuration. Contact support for assistance.
        </AlertDescription>
      </Alert>
    </div>
  )
}