'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  AlertCircle,
  CheckCircle,
  ExternalLink,
  Loader2,
  RefreshCw,
  Unplug,
  Key,
  Shield,
  Calendar,
  Building,
  Users,
  Mail,
  Zap,
  AlertTriangle,
} from 'lucide-react'
import { useCurrentWorkspace, usePermissions } from '@/hooks/use-user'

interface PipedriveConnection {
  id: string
  company_domain: string
  is_active: boolean
  last_sync_at: string | null
  scopes: string[]
  expires_at: string | null
  created_at: string
  updated_at: string
  token_type: 'OAuth' | 'API'
}

interface ConnectionStatus {
  connected: boolean
  company_domain?: string
  last_tested?: string
  rate_limit?: {
    remaining: number
    limit: number
    reset: number
  }
}

export default function PipedriveAuthPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentWorkspace = useCurrentWorkspace()
  const { isAdmin } = usePermissions()
  
  const [connection, setConnection] = useState<PipedriveConnection | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [testing, setTesting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  
  // API Token auth state
  const [apiToken, setApiToken] = useState('')
  const [companyDomain, setCompanyDomain] = useState('')
  const [savingApiToken, setSavingApiToken] = useState(false)

  useEffect(() => {
    // Handle OAuth callback messages
    const errorParam = searchParams.get('error')
    const successParam = searchParams.get('success')
    
    if (errorParam) {
      const errorMessages: Record<string, string> = {
        auth_failed: 'Pipedrive authorization failed. Please try again.',
        invalid_callback: 'Invalid callback parameters received.',
        invalid_state: 'Invalid security state. Please try connecting again.',
        expired_state: 'Security state expired. Please try connecting again.',
        unauthorized: 'You are not authorized to connect integrations.',
        token_exchange_failed: 'Failed to exchange authorization code for access token.',
        database_error: 'Failed to save connection. Please try again.',
        callback_failed: 'Connection callback failed. Please try again.',
        company_info_failed: 'Failed to retrieve company information from Pipedrive.',
      }
      setError(errorMessages[errorParam] || 'An unknown error occurred.')
    }
    
    if (successParam === 'connected') {
      setSuccess('Pipedrive connected successfully!')
      fetchConnectionData() // Refresh connection data
    }
  }, [searchParams])

  useEffect(() => {
    fetchConnectionData()
  }, [currentWorkspace])

  const fetchConnectionData = async () => {
    if (!currentWorkspace) return

    try {
      setLoading(true)
      
      // Fetch Pipedrive connection
      const response = await fetch(`/api/integrations/pipedrive/status?workspace_id=${currentWorkspace.workspace_id}`)
      if (response.ok) {
        const data = await response.json()
        setConnection(data.connection)
        setConnectionStatus(data.status)
      } else if (response.status !== 404) {
        setError('Failed to load connection data')
      }
    } catch (error) {
      console.error('Failed to fetch connection data:', error)
      setError('Failed to load connection data')
    } finally {
      setLoading(false)
    }
  }

  const handleConnectOAuth = async () => {
    if (!currentWorkspace) return

    setConnecting(true)
    try {
      // Initiate OAuth flow
      window.location.href = `/api/integrations/pipedrive/auth?workspace_id=${currentWorkspace.workspace_id}`
    } catch (error) {
      setError('Failed to initiate Pipedrive connection')
      setConnecting(false)
    }
  }

  const handleConnectApiToken = async () => {
    if (!currentWorkspace || !apiToken || !companyDomain) return

    setSavingApiToken(true)
    setError(null)
    
    try {
      const response = await fetch('/api/integrations/pipedrive/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: currentWorkspace.workspace_id,
          api_token: apiToken,
          company_domain: companyDomain,
        }),
      })

      if (response.ok) {
        setSuccess('Pipedrive connected successfully with API token!')
        setApiToken('')
        setCompanyDomain('')
        fetchConnectionData()
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to connect with API token')
      }
    } catch (error) {
      setError('Failed to connect with API token')
    } finally {
      setSavingApiToken(false)
    }
  }

  const handleDisconnect = async () => {
    if (!currentWorkspace || !confirm('Are you sure you want to disconnect Pipedrive? This will stop all syncing and remove your connection.')) return

    setDisconnecting(true)
    try {
      const response = await fetch('/api/integrations/pipedrive/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: currentWorkspace.workspace_id }),
      })

      if (response.ok) {
        setConnection(null)
        setConnectionStatus(null)
        setSuccess('Pipedrive disconnected successfully')
      } else {
        setError('Failed to disconnect Pipedrive')
      }
    } catch (error) {
      setError('Failed to disconnect Pipedrive')
    } finally {
      setDisconnecting(false)
    }
  }

  const handleTestConnection = async () => {
    if (!currentWorkspace || !connection) return

    setTesting(true)
    try {
      const response = await fetch('/api/integrations/pipedrive/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          workspace_id: currentWorkspace.workspace_id,
          test: true,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setConnectionStatus(data.status)
        setSuccess('Connection test successful!')
      } else {
        setError('Connection test failed')
      }
    } catch (error) {
      setError('Connection test failed')
    } finally {
      setTesting(false)
    }
  }

  const formatScope = (scope: string) => {
    return scope
      .split(':')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
  }

  const getScopeIcon = (scope: string) => {
    if (scope.includes('deals')) return <Zap className="h-4 w-4" />
    if (scope.includes('persons')) return <Users className="h-4 w-4" />
    if (scope.includes('organizations')) return <Building className="h-4 w-4" />
    if (scope.includes('activities')) return <Calendar className="h-4 w-4" />
    if (scope.includes('email')) return <Mail className="h-4 w-4" />
    return <Shield className="h-4 w-4" />
  }

  if (loading) {
    return (
      <div className="container max-w-4xl mx-auto py-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="container max-w-4xl mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Pipedrive Integration</h1>
        <p className="text-muted-foreground">
          Connect your Pipedrive CRM to sync contacts, deals, and activities
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

      {connection ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-lg">P</span>
                </div>
                <div>
                  <CardTitle>Pipedrive CRM</CardTitle>
                  <CardDescription>
                    Connected to {connection.company_domain}
                  </CardDescription>
                </div>
              </div>
              <Badge variant="default" className="flex items-center space-x-1">
                <CheckCircle className="h-3 w-3" />
                <span>Connected</span>
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Connection Details */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
              <div>
                <div className="text-sm font-medium">Company Domain</div>
                <div className="text-sm text-muted-foreground">{connection.company_domain}</div>
              </div>
              <div>
                <div className="text-sm font-medium">Connection Type</div>
                <div className="text-sm text-muted-foreground flex items-center space-x-1">
                  <Key className="h-3 w-3" />
                  <span>{connection.token_type}</span>
                </div>
              </div>
              <div>
                <div className="text-sm font-medium">Connected Since</div>
                <div className="text-sm text-muted-foreground">
                  {new Date(connection.created_at).toLocaleDateString()}
                </div>
              </div>
              <div>
                <div className="text-sm font-medium">Last Activity</div>
                <div className="text-sm text-muted-foreground">
                  {connection.last_sync_at
                    ? new Date(connection.last_sync_at).toLocaleString()
                    : 'Never'
                  }
                </div>
              </div>
            </div>

            {/* OAuth Token Expiration */}
            {connection.token_type === 'OAuth' && connection.expires_at && (
              <div className="p-4 border rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    <div>
                      <div className="text-sm font-medium">Token Expiration</div>
                      <div className="text-sm text-muted-foreground">
                        Expires on {new Date(connection.expires_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {/* Implement token refresh */}}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh Token
                  </Button>
                </div>
              </div>
            )}

            {/* Connection Status */}
            {connectionStatus && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">Connection Status</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleTestConnection}
                    disabled={testing}
                  >
                    {testing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Testing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Test Connection
                      </>
                    )}
                  </Button>
                </div>
                
                {connectionStatus.rate_limit && (
                  <div className="grid grid-cols-3 gap-4 p-4 border rounded-lg">
                    <div>
                      <div className="text-sm font-medium">API Calls Remaining</div>
                      <div className="text-2xl font-bold">
                        {connectionStatus.rate_limit.remaining}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm font-medium">Daily Limit</div>
                      <div className="text-2xl font-bold">
                        {connectionStatus.rate_limit.limit}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm font-medium">Resets At</div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(connectionStatus.rate_limit.reset * 1000).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Permissions */}
            {connection.scopes.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium">Permissions</h3>
                <div className="grid grid-cols-2 gap-2">
                  {connection.scopes.map((scope) => (
                    <div key={scope} className="flex items-center space-x-2 p-2 border rounded-lg">
                      {getScopeIcon(scope)}
                      <span className="text-sm">{formatScope(scope)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <Separator />
            
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="text-sm font-medium">Quick Actions</div>
                <div className="text-sm text-muted-foreground">
                  Manage your Pipedrive integration
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  onClick={() => window.open(`https://${connection.company_domain}.pipedrive.com`, '_blank')}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open Pipedrive
                </Button>
                <Button
                  variant="outline"
                  onClick={() => router.push('/integrations/pipedrive/mapping')}
                >
                  Field Mapping
                </Button>
                <Button
                  variant="outline"
                  onClick={() => router.push('/integrations/pipedrive/sync')}
                >
                  Sync Settings
                </Button>
              </div>
            </div>

            {/* Danger Zone */}
            {isAdmin && (
              <>
                <Separator />
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium text-destructive">Danger Zone</h3>
                    <p className="text-sm text-muted-foreground">
                      Disconnecting will stop all syncing and remove your Pipedrive connection.
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    onClick={handleDisconnect}
                    disabled={disconnecting}
                  >
                    {disconnecting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Disconnecting...
                      </>
                    ) : (
                      <>
                        <Unplug className="mr-2 h-4 w-4" />
                        Disconnect Pipedrive
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">P</span>
              </div>
              <div>
                <CardTitle>Connect Pipedrive CRM</CardTitle>
                <CardDescription>
                  Sync your contacts, deals, and activities between ColdCopy and Pipedrive
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>Two-way sync for contacts, organizations, and deals</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>Automatic activity logging and email tracking</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>Real-time updates via webhooks</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>Custom field mapping and data transformation</span>
              </div>
            </div>

            {isAdmin ? (
              <Tabs defaultValue="oauth" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="oauth">OAuth (Recommended)</TabsTrigger>
                  <TabsTrigger value="api">API Token</TabsTrigger>
                </TabsList>
                
                <TabsContent value="oauth" className="space-y-4">
                  <div className="text-sm text-muted-foreground">
                    OAuth provides secure, scoped access to your Pipedrive account with automatic token refresh.
                  </div>
                  <Button
                    onClick={handleConnectOAuth}
                    disabled={connecting}
                    className="w-full bg-green-600 hover:bg-green-700"
                  >
                    {connecting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Connect with OAuth
                      </>
                    )}
                  </Button>
                </TabsContent>
                
                <TabsContent value="api" className="space-y-4">
                  <div className="text-sm text-muted-foreground">
                    Use an API token for simple authentication. You can find your API token in Pipedrive under Settings → Personal preferences → API.
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="company-domain">Company Domain</Label>
                      <Input
                        id="company-domain"
                        placeholder="your-company"
                        value={companyDomain}
                        onChange={(e) => setCompanyDomain(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Your Pipedrive domain (e.g., if your URL is your-company.pipedrive.com, enter "your-company")
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="api-token">API Token</Label>
                      <Input
                        id="api-token"
                        type="password"
                        placeholder="Your Pipedrive API token"
                        value={apiToken}
                        onChange={(e) => setApiToken(e.target.value)}
                      />
                    </div>
                    <Button
                      onClick={handleConnectApiToken}
                      disabled={savingApiToken || !apiToken || !companyDomain}
                      className="w-full"
                    >
                      {savingApiToken ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Connecting...
                        </>
                      ) : (
                        <>
                          <Key className="mr-2 h-4 w-4" />
                          Connect with API Token
                        </>
                      )}
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            ) : (
              <div className="text-center py-8">
                <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-sm text-muted-foreground">
                  Only workspace administrators can connect integrations.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}