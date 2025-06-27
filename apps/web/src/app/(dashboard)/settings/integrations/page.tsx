'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, ExternalLink, Settings, Zap, AlertCircle, CheckCircle, Linkedin, Twitter } from 'lucide-react'
import { useCurrentWorkspace, usePermissions } from '@/hooks/use-user'
import { useSearchParams } from 'next/navigation'
import { LinkedInSettings } from '@/components/integrations/linkedin'
import { TwitterSettings } from '@/components/settings/integrations/TwitterSettings'

interface HubSpotConnection {
  id: string
  portal_id: number
  hub_domain: string
  is_active: boolean
  last_sync_at: string | null
  scopes: string[]
  created_at: string
}

interface SyncConfig {
  id: string
  object_type: string
  direction: 'to_hubspot' | 'from_hubspot' | 'bidirectional'
  is_enabled: boolean
  sync_frequency_minutes: number
  last_sync_at: string | null
}

export default function IntegrationsPage() {
  const searchParams = useSearchParams()
  const currentWorkspace = useCurrentWorkspace()
  const { isAdmin } = usePermissions()
  const [hubspotConnection, setHubSpotConnection] = useState<HubSpotConnection | null>(null)
  const [syncConfigs, setSyncConfigs] = useState<SyncConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    // Handle OAuth callback messages
    const errorParam = searchParams.get('error')
    const successParam = searchParams.get('success')
    
    if (errorParam) {
      const errorMessages: Record<string, string> = {
        hubspot_auth_failed: 'HubSpot authorization failed. Please try again.',
        linkedin_auth_failed: 'LinkedIn authorization failed. Please try again.',
        twitter_auth_failed: 'Twitter authorization failed. Please try again.',
        twitter_connection_failed: 'Failed to connect Twitter account. Please try again.',
        invalid_callback: 'Invalid callback parameters.',
        invalid_state: 'Invalid security state.',
        state_expired: 'Security state expired. Please try again.',
        unauthorized: 'You are not authorized to connect integrations.',
        token_exchange_failed: 'Failed to exchange authorization code.',
        database_error: 'Failed to save connection. Please try again.',
        callback_failed: 'Connection callback failed.',
        connection_failed: 'Failed to connect integration. Please try again.',
        no_workspace: 'No workspace found for user.',
      }
      setError(errorMessages[errorParam] || 'An unknown error occurred.')
    }
    
    if (successParam === 'hubspot_connected') {
      setSuccess('HubSpot connected successfully!')
    } else if (successParam === 'linkedin_connected') {
      setSuccess('LinkedIn connected successfully!')
    } else if (successParam === 'twitter_connected') {
      setSuccess('Twitter connected successfully!')
    }
  }, [searchParams])

  useEffect(() => {
    fetchIntegrationData()
  }, [currentWorkspace])

  const fetchIntegrationData = async () => {
    if (!currentWorkspace) return

    try {
      setLoading(true)
      
      // Fetch HubSpot connection
      const connectionResponse = await fetch(`/api/integrations/hubspot/connection?workspace_id=${currentWorkspace.workspace_id}`)
      if (connectionResponse.ok) {
        const data = await connectionResponse.json()
        setHubSpotConnection(data.connection)
      }

      // Fetch sync configurations
      const configsResponse = await fetch(`/api/integrations/hubspot/sync-configs?workspace_id=${currentWorkspace.workspace_id}`)
      if (configsResponse.ok) {
        const data = await configsResponse.json()
        setSyncConfigs(data.configs)
      }
    } catch (error) {
      console.error('Failed to fetch integration data:', error)
      setError('Failed to load integration data')
    } finally {
      setLoading(false)
    }
  }

  const handleConnectHubSpot = async () => {
    if (!currentWorkspace) return

    setConnecting(true)
    try {
      window.location.href = `/api/integrations/hubspot/connect?workspace_id=${currentWorkspace.workspace_id}`
    } catch (error) {
      setError('Failed to initiate HubSpot connection')
      setConnecting(false)
    }
  }

  const handleDisconnectHubSpot = async () => {
    if (!currentWorkspace || !confirm('Are you sure you want to disconnect HubSpot? This will stop all syncing.')) return

    try {
      const response = await fetch(`/api/integrations/hubspot/disconnect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: currentWorkspace.workspace_id }),
      })

      if (response.ok) {
        setHubSpotConnection(null)
        setSyncConfigs([])
        setSuccess('HubSpot disconnected successfully')
      } else {
        setError('Failed to disconnect HubSpot')
      }
    } catch (error) {
      setError('Failed to disconnect HubSpot')
    }
  }

  const handleToggleSync = async (configId: string, enabled: boolean) => {
    try {
      const response = await fetch(`/api/integrations/hubspot/sync-configs/${configId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_enabled: enabled }),
      })

      if (response.ok) {
        setSyncConfigs(configs => 
          configs.map(config => 
            config.id === configId ? { ...config, is_enabled: enabled } : config
          )
        )
      }
    } catch (error) {
      setError('Failed to update sync configuration')
    }
  }

  const handleTriggerSync = async (objectType: string) => {
    if (!currentWorkspace) return

    try {
      const response = await fetch('/api/integrations/hubspot/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: currentWorkspace.workspace_id,
          object_type: objectType,
        }),
      })

      if (response.ok) {
        setSuccess(`${objectType} sync initiated successfully`)
        fetchIntegrationData() // Refresh data
      } else {
        setError(`Failed to trigger ${objectType} sync`)
      }
    } catch (error) {
      setError(`Failed to trigger ${objectType} sync`)
    }
  }

  const getSyncDirectionLabel = (direction: string) => {
    switch (direction) {
      case 'to_hubspot': return 'ColdCopy → HubSpot'
      case 'from_hubspot': return 'HubSpot → ColdCopy'
      case 'bidirectional': return 'Two-way sync'
      default: return direction
    }
  }

  const getSyncDirectionColor = (direction: string) => {
    switch (direction) {
      case 'to_hubspot': return 'bg-blue-500'
      case 'from_hubspot': return 'bg-green-500'
      case 'bidirectional': return 'bg-purple-500'
      default: return 'bg-gray-500'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Integrations</h3>
        <p className="text-sm text-muted-foreground">
          Connect ColdCopy with your favorite tools and platforms
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="hubspot" className="space-y-4">
        <TabsList>
          <TabsTrigger value="hubspot">HubSpot</TabsTrigger>
          <TabsTrigger value="linkedin">LinkedIn</TabsTrigger>
          <TabsTrigger value="twitter">Twitter</TabsTrigger>
          <TabsTrigger value="pipedrive" disabled>Pipedrive</TabsTrigger>
          <TabsTrigger value="salesforce" disabled>Salesforce</TabsTrigger>
        </TabsList>

        <TabsContent value="hubspot" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-lg">H</span>
                  </div>
                  <div>
                    <CardTitle>HubSpot CRM</CardTitle>
                    <CardDescription>
                      Sync contacts, companies, deals, and activities with HubSpot
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {hubspotConnection ? (
                    <Badge variant="default" className="flex items-center space-x-1">
                      <CheckCircle className="h-3 w-3" />
                      <span>Connected</span>
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Not Connected</Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {hubspotConnection ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                    <div>
                      <div className="text-sm font-medium">Portal ID</div>
                      <div className="text-sm text-muted-foreground">{hubspotConnection.portal_id}</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium">Last Sync</div>
                      <div className="text-sm text-muted-foreground">
                        {hubspotConnection.last_sync_at
                          ? new Date(hubspotConnection.last_sync_at).toLocaleDateString()
                          : 'Never'
                        }
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium">Sync Configuration</h4>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(`https://app.hubspot.com/contacts/${hubspotConnection.portal_id}`, '_blank')}
                      >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Open HubSpot
                      </Button>
                    </div>

                    <div className="space-y-3">
                      {syncConfigs.map((config) => (
                        <div key={config.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center space-x-3">
                            <Switch
                              checked={config.is_enabled}
                              onCheckedChange={(enabled) => handleToggleSync(config.id, enabled)}
                              disabled={!isAdmin}
                            />
                            <div>
                              <div className="font-medium capitalize">
                                {config.object_type}
                              </div>
                              <div className="flex items-center space-x-2">
                                <div className={`w-2 h-2 rounded-full ${getSyncDirectionColor(config.direction)}`} />
                                <span className="text-sm text-muted-foreground">
                                  {getSyncDirectionLabel(config.direction)}
                                </span>
                                <span className="text-sm text-muted-foreground">
                                  • Every {config.sync_frequency_minutes} minutes
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            {config.last_sync_at && (
                              <span className="text-xs text-muted-foreground">
                                Last: {new Date(config.last_sync_at).toLocaleTimeString()}
                              </span>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleTriggerSync(config.object_type)}
                              disabled={!config.is_enabled || !isAdmin}
                            >
                              <Zap className="mr-1 h-3 w-3" />
                              Sync Now
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {isAdmin && (
                    <div className="flex items-center justify-between pt-4 border-t">
                      <div>
                        <div className="text-sm font-medium">Danger Zone</div>
                        <div className="text-sm text-muted-foreground">
                          Disconnect HubSpot integration
                        </div>
                      </div>
                      <Button
                        variant="destructive"
                        onClick={handleDisconnectHubSpot}
                      >
                        Disconnect
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-sm text-muted-foreground mb-4">
                    Connect your HubSpot account to sync data between ColdCopy and HubSpot CRM.
                  </div>
                  <div className="space-y-2 text-xs text-muted-foreground mb-6">
                    <div>• Sync contacts, companies, and deals</div>
                    <div>• Track email activities and engagement</div>
                    <div>• Two-way data synchronization</div>
                    <div>• Real-time updates via webhooks</div>
                  </div>
                  {isAdmin ? (
                    <Button
                      onClick={handleConnectHubSpot}
                      disabled={connecting}
                      className="bg-orange-500 hover:bg-orange-600"
                    >
                      {connecting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Connecting...
                        </>
                      ) : (
                        <>
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Connect HubSpot
                        </>
                      )}
                    </Button>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      Only workspace administrators can connect integrations.
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="linkedin" className="space-y-4">
          <LinkedInSettings workspaceId={currentWorkspace?.workspace_id || ''} />
        </TabsContent>

        <TabsContent value="twitter" className="space-y-4">
          <TwitterSettings />
        </TabsContent>

        <TabsContent value="pipedrive">
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-lg">P</span>
                </div>
                <div>
                  <CardTitle>Pipedrive</CardTitle>
                  <CardDescription>
                    Sync leads and deals with Pipedrive CRM
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <div className="text-sm text-muted-foreground">
                  Pipedrive integration coming soon!
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="salesforce">
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-lg">S</span>
                </div>
                <div>
                  <CardTitle>Salesforce</CardTitle>
                  <CardDescription>
                    Sync contacts, accounts, and opportunities with Salesforce
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <div className="text-sm text-muted-foreground">
                  Salesforce integration coming soon!
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}