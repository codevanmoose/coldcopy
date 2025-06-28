'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Settings, 
  Plus, 
  ExternalLink, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Trash2,
  TestTube,
  Zap,
  Mail,
  MessageSquare,
  Webhook,
  RefreshCw
} from 'lucide-react'
import { toast } from 'sonner'

interface IntegrationProvider {
  id: string
  name: string
  display_name: string
  description: string
  category: string
  auth_type: string
  supported_events: string[]
  supported_actions: string[]
  icon_url?: string
  website_url?: string
  connection_status: {
    connected: boolean
    active: boolean
    status: string | null
  }
}

interface WorkspaceIntegration {
  id: string
  integration_name: string
  is_active: boolean
  sync_status: string
  last_sync_at?: string
  last_error?: string
  created_at: string
  integration_providers: {
    name: string
    display_name: string
    category: string
    icon_url?: string
  }
  auth_data: {
    email?: string
    team_name?: string
    user_name?: string
    webhook_url?: string
  }
}

export function IntegrationsDashboard() {
  const [providers, setProviders] = useState<IntegrationProvider[]>([])
  const [integrations, setIntegrations] = useState<WorkspaceIntegration[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState<IntegrationProvider | null>(null)

  // Load data
  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      
      const [providersRes, integrationsRes] = await Promise.all([
        fetch('/api/integrations/providers'),
        fetch('/api/integrations')
      ])

      if (providersRes.ok) {
        const providersData = await providersRes.json()
        setProviders(providersData.providers || [])
      }

      if (integrationsRes.ok) {
        const integrationsData = await integrationsRes.json()
        setIntegrations(integrationsData.integrations || [])
      }
    } catch (error) {
      console.error('Error loading integrations:', error)
      toast.error('Failed to load integrations')
    } finally {
      setLoading(false)
    }
  }

  const categories = [
    { key: 'all', label: 'All', icon: Settings },
    { key: 'communication', label: 'Communication', icon: MessageSquare },
    { key: 'email', label: 'Email', icon: Mail },
    { key: 'automation', label: 'Automation', icon: Zap },
    { key: 'crm', label: 'CRM', icon: Settings }
  ]

  const filteredProviders = providers.filter(provider => 
    selectedCategory === 'all' || provider.category === selectedCategory
  )

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'paused':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />
      default:
        return <AlertCircle className="h-4 w-4 text-gray-400" />
    }
  }

  const getStatusBadge = (status: string, isActive: boolean) => {
    if (!isActive) {
      return <Badge variant="secondary">Disabled</Badge>
    }
    
    switch (status) {
      case 'active':
        return <Badge variant="default" className="bg-green-500">Connected</Badge>
      case 'error':
        return <Badge variant="destructive">Error</Badge>
      case 'paused':
        return <Badge variant="outline">Paused</Badge>
      default:
        return <Badge variant="secondary">Unknown</Badge>
    }
  }

  const handleConnect = (provider: IntegrationProvider) => {
    setSelectedProvider(provider)
    
    if (provider.auth_type === 'oauth2') {
      // Redirect to OAuth flow
      if (provider.name === 'slack') {
        window.location.href = `/api/integrations/slack/oauth?redirect_uri=${encodeURIComponent(window.location.origin + '/integrations/slack/callback')}`
      } else if (provider.name === 'gmail') {
        window.location.href = `/api/integrations/gmail/oauth?redirect_uri=${encodeURIComponent(window.location.origin + '/integrations/gmail/callback')}`
      }
    } else if (provider.auth_type === 'webhook') {
      setShowAddDialog(true)
    }
  }

  const handleTest = async (integration: WorkspaceIntegration) => {
    try {
      const provider = integration.integration_providers.name
      
      const response = await fetch(`/api/integrations/${provider}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ integrationId: integration.id })
      })

      const result = await response.json()

      if (result.success) {
        toast.success('Integration test successful')
      } else {
        toast.error(`Test failed: ${result.error}`)
      }
      
      // Reload integrations to get updated status
      loadData()
    } catch (error) {
      toast.error('Failed to test integration')
    }
  }

  const handleDelete = async (integration: WorkspaceIntegration) => {
    if (!confirm('Are you sure you want to delete this integration?')) {
      return
    }

    try {
      const response = await fetch('/api/integrations', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ integrationId: integration.id })
      })

      if (response.ok) {
        toast.success('Integration deleted successfully')
        loadData()
      } else {
        const error = await response.json()
        toast.error(`Failed to delete: ${error.error}`)
      }
    } catch (error) {
      toast.error('Failed to delete integration')
    }
  }

  const handleToggle = async (integration: WorkspaceIntegration) => {
    try {
      const response = await fetch('/api/integrations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          integrationId: integration.id, 
          isActive: !integration.is_active 
        })
      })

      if (response.ok) {
        toast.success(`Integration ${!integration.is_active ? 'enabled' : 'disabled'}`)
        loadData()
      } else {
        const error = await response.json()
        toast.error(`Failed to update: ${error.error}`)
      }
    } catch (error) {
      toast.error('Failed to update integration')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Integrations</h1>
          <p className="text-muted-foreground">
            Connect ColdCopy with your favorite tools and automate your workflow
          </p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Integration
        </Button>
      </div>

      <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
        <TabsList className="grid w-full grid-cols-5">
          {categories.map(category => (
            <TabsTrigger key={category.key} value={category.key}>
              <category.icon className="h-4 w-4 mr-2" />
              {category.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={selectedCategory} className="space-y-6">
          {/* Connected Integrations */}
          {integrations.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Connected Integrations</h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {integrations.map(integration => (
                  <Card key={integration.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          {integration.integration_providers.icon_url ? (
                            <img 
                              src={integration.integration_providers.icon_url} 
                              alt={integration.integration_providers.display_name}
                              className="h-8 w-8"
                            />
                          ) : (
                            <Webhook className="h-8 w-8" />
                          )}
                          <div>
                            <CardTitle className="text-base">
                              {integration.integration_name}
                            </CardTitle>
                            <CardDescription className="text-sm">
                              {integration.integration_providers.display_name}
                            </CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(integration.sync_status)}
                          <Switch 
                            checked={integration.is_active}
                            onCheckedChange={() => handleToggle(integration)}
                          />
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Status</span>
                          {getStatusBadge(integration.sync_status, integration.is_active)}
                        </div>
                        
                        {integration.auth_data.email && (
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Account</span>
                            <span className="text-sm">{integration.auth_data.email}</span>
                          </div>
                        )}
                        
                        {integration.auth_data.team_name && (
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Team</span>
                            <span className="text-sm">{integration.auth_data.team_name}</span>
                          </div>
                        )}

                        {integration.last_error && (
                          <Alert>
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription className="text-xs">
                              {integration.last_error}
                            </AlertDescription>
                          </Alert>
                        )}
                        
                        <div className="flex space-x-2">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleTest(integration)}
                            className="flex-1"
                          >
                            <TestTube className="h-3 w-3 mr-1" />
                            Test
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleDelete(integration)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Available Providers */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Available Integrations</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredProviders.map(provider => (
                <Card key={provider.id} className="relative">
                  <CardHeader>
                    <div className="flex items-center space-x-3">
                      {provider.icon_url ? (
                        <img 
                          src={provider.icon_url} 
                          alt={provider.display_name}
                          className="h-8 w-8"
                        />
                      ) : (
                        <Webhook className="h-8 w-8" />
                      )}
                      <div className="flex-1">
                        <CardTitle className="text-base">{provider.display_name}</CardTitle>
                        <CardDescription className="text-sm">
                          {provider.description}
                        </CardDescription>
                      </div>
                      {provider.connection_status.connected && (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline">{provider.category}</Badge>
                        <Badge variant="outline">{provider.auth_type}</Badge>
                      </div>
                      
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">Supported Events:</p>
                        <div className="flex flex-wrap gap-1">
                          {provider.supported_events.slice(0, 3).map(event => (
                            <Badge key={event} variant="secondary" className="text-xs">
                              {event.replace('_', ' ')}
                            </Badge>
                          ))}
                          {provider.supported_events.length > 3 && (
                            <Badge variant="secondary" className="text-xs">
                              +{provider.supported_events.length - 3} more
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex space-x-2">
                        <Button 
                          size="sm" 
                          onClick={() => handleConnect(provider)}
                          disabled={provider.connection_status.connected}
                          className="flex-1"
                        >
                          {provider.connection_status.connected ? 'Connected' : 'Connect'}
                        </Button>
                        {provider.website_url && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => window.open(provider.website_url, '_blank')}
                          >
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Add Webhook Integration Dialog */}
      {selectedProvider && selectedProvider.auth_type === 'webhook' && (
        <WebhookIntegrationDialog 
          provider={selectedProvider}
          open={showAddDialog}
          onClose={() => {
            setShowAddDialog(false)
            setSelectedProvider(null)
          }}
          onSuccess={() => {
            setShowAddDialog(false)
            setSelectedProvider(null)
            loadData()
          }}
        />
      )}
    </div>
  )
}

// Webhook Integration Dialog Component
interface WebhookIntegrationDialogProps {
  provider: IntegrationProvider
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

function WebhookIntegrationDialog({ provider, open, onClose, onSuccess }: WebhookIntegrationDialogProps) {
  const [webhookUrl, setWebhookUrl] = useState('')
  const [webhookSecret, setWebhookSecret] = useState('')
  const [zapName, setZapName] = useState('')
  const [description, setDescription] = useState('')
  const [testing, setTesting] = useState(false)
  const [creating, setCreating] = useState(false)

  const handleTest = async () => {
    if (!webhookUrl) {
      toast.error('Please enter a webhook URL')
      return
    }

    try {
      setTesting(true)
      const response = await fetch(`/api/integrations/${provider.name}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl, webhookSecret })
      })

      const result = await response.json()

      if (result.success) {
        toast.success('Webhook test successful!')
      } else {
        toast.error(`Test failed: ${result.error}`)
      }
    } catch (error) {
      toast.error('Failed to test webhook')
    } finally {
      setTesting(false)
    }
  }

  const handleCreate = async () => {
    if (!webhookUrl) {
      toast.error('Please enter a webhook URL')
      return
    }

    try {
      setCreating(true)
      const response = await fetch(`/api/integrations/${provider.name}/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhookUrl,
          webhookSecret,
          zapName: zapName || `${provider.display_name} Integration`,
          description
        })
      })

      const result = await response.json()

      if (result.success) {
        toast.success('Integration created successfully!')
        onSuccess()
      } else {
        toast.error(`Failed to create: ${result.error}`)
      }
    } catch (error) {
      toast.error('Failed to create integration')
    } finally {
      setCreating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Connect {provider.display_name}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="webhook-url">Webhook URL *</Label>
            <Input
              id="webhook-url"
              placeholder="https://hooks.zapier.com/hooks/catch/..."
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
            />
          </div>
          
          <div>
            <Label htmlFor="webhook-secret">Webhook Secret (Optional)</Label>
            <Input
              id="webhook-secret"
              type="password"
              placeholder="Optional security secret"
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
            />
          </div>
          
          <div>
            <Label htmlFor="zap-name">Integration Name</Label>
            <Input
              id="zap-name"
              placeholder={`${provider.display_name} Integration`}
              value={zapName}
              onChange={(e) => setZapName(e.target.value)}
            />
          </div>
          
          <div>
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              placeholder="Describe what this integration does..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          
          <div className="flex space-x-2">
            <Button 
              variant="outline" 
              onClick={handleTest}
              disabled={testing}
              className="flex-1"
            >
              {testing ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <TestTube className="h-4 w-4 mr-2" />
              )}
              Test
            </Button>
            <Button 
              onClick={handleCreate}
              disabled={creating}
              className="flex-1"
            >
              {creating ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Create
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}