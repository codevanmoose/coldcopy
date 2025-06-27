'use client'

import React, { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { 
  Users, 
  Plus, 
  Settings, 
  ExternalLink, 
  Copy, 
  Trash2, 
  Shield, 
  Eye,
  Link as LinkIcon,
  Mail,
  Calendar,
  FileText,
  BarChart3,
  User,
  Clock,
  Key
} from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { 
  WhiteLabelClientPortal, 
  ClientPortalPermissions, 
  NotificationFrequency 
} from '@/lib/white-label/types'
import { toast } from 'sonner'

interface ClientPortalBuilderProps {
  className?: string
}

const defaultPermissions: ClientPortalPermissions = {
  view_campaigns: true,
  view_analytics: false,
  download_reports: false,
  update_profile: true,
  view_invoices: false,
  manage_team: false,
}

const availableFeatures = [
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { id: 'campaigns', label: 'Campaigns', icon: Mail },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'reports', label: 'Reports', icon: FileText },
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'calendar', label: 'Calendar', icon: Calendar },
]

export function ClientPortalBuilder({ className }: ClientPortalBuilderProps) {
  const { dbUser } = useAuthStore()
  const queryClient = useQueryClient()
  const [isCreatePortalOpen, setIsCreatePortalOpen] = useState(false)
  const [selectedClient, setSelectedClient] = useState('')

  // Fetch portals
  const { data: portals = [], isLoading: portalsLoading } = useQuery({
    queryKey: ['client-portals', dbUser?.workspace_id],
    queryFn: async () => {
      if (!dbUser?.workspace_id) return []
      
      const response = await fetch(`/api/white-label/portals?workspaceId=${dbUser.workspace_id}`)
      if (!response.ok) throw new Error('Failed to fetch portals')
      return response.json()
    },
    enabled: !!dbUser?.workspace_id,
  })

  // Fetch clients/leads for portal creation
  const { data: clients = [], isLoading: clientsLoading } = useQuery({
    queryKey: ['leads', dbUser?.workspace_id],
    queryFn: async () => {
      if (!dbUser?.workspace_id) return []
      
      const response = await fetch(`/api/leads?workspaceId=${dbUser.workspace_id}`)
      if (!response.ok) throw new Error('Failed to fetch clients')
      return response.json()
    },
    enabled: !!dbUser?.workspace_id,
  })

  // Create portal mutation
  const createPortalMutation = useMutation({
    mutationFn: async (portalData: {
      clientId: string
      permissions: ClientPortalPermissions
      allowedFeatures: string[]
      customWelcomeMessage?: string
      expiresInDays: number
    }) => {
      if (!dbUser?.workspace_id) throw new Error('No workspace ID')
      
      const response = await fetch('/api/white-label/portals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: dbUser.workspace_id,
          ...portalData,
        }),
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to create portal')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-portals'] })
      setIsCreatePortalOpen(false)
      setSelectedClient('')
      toast.success('Client portal created successfully')
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  // Delete portal mutation
  const deletePortalMutation = useMutation({
    mutationFn: async (portalId: string) => {
      const response = await fetch(`/api/white-label/portals/${portalId}`, {
        method: 'DELETE',
      })
      
      if (!response.ok) throw new Error('Failed to delete portal')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-portals'] })
      toast.success('Portal deleted successfully')
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  // Update portal mutation
  const updatePortalMutation = useMutation({
    mutationFn: async ({ portalId, updates }: { 
      portalId: string
      updates: Partial<WhiteLabelClientPortal> 
    }) => {
      const response = await fetch(`/api/white-label/portals/${portalId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      
      if (!response.ok) throw new Error('Failed to update portal')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-portals'] })
      toast.success('Portal updated successfully')
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const copyPortalLink = (portal: WhiteLabelClientPortal) => {
    const url = `${window.location.origin}/portal/${portal.portal_url}?token=${portal.access_token}`
    navigator.clipboard.writeText(url)
    toast.success('Portal link copied to clipboard')
  }

  const getStatusBadge = (portal: WhiteLabelClientPortal) => {
    if (!portal.is_active) {
      return <Badge variant="secondary">Inactive</Badge>
    }
    if (portal.is_locked) {
      return <Badge variant="destructive">Locked</Badge>
    }
    if (new Date(portal.expires_at) < new Date()) {
      return <Badge variant="destructive">Expired</Badge>
    }
    return <Badge variant="default">Active</Badge>
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Client Portals
            </CardTitle>
            <CardDescription>
              Create and manage secure client portal access
            </CardDescription>
          </div>
          <Dialog open={isCreatePortalOpen} onOpenChange={setIsCreatePortalOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Create Portal
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create Client Portal</DialogTitle>
              </DialogHeader>
              <CreatePortalForm
                clients={clients}
                onSubmit={(data) => createPortalMutation.mutate(data)}
                isLoading={createPortalMutation.isPending}
                selectedClient={selectedClient}
                onClientChange={setSelectedClient}
              />
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {portalsLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : portals.length === 0 ? (
          <div className="text-center py-8">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No client portals</h3>
            <p className="text-muted-foreground mb-4">
              Create your first client portal to give clients secure access to their data
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {portals.map((portal: WhiteLabelClientPortal) => (
              <PortalCard
                key={portal.id}
                portal={portal}
                clients={clients}
                onCopyLink={() => copyPortalLink(portal)}
                onDelete={() => deletePortalMutation.mutate(portal.id)}
                onUpdate={(updates) => updatePortalMutation.mutate({ 
                  portalId: portal.id, 
                  updates 
                })}
                isUpdating={updatePortalMutation.isPending}
                isDeleting={deletePortalMutation.isPending}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

interface CreatePortalFormProps {
  clients: any[]
  onSubmit: (data: {
    clientId: string
    permissions: ClientPortalPermissions
    allowedFeatures: string[]
    customWelcomeMessage?: string
    expiresInDays: number
  }) => void
  isLoading: boolean
  selectedClient: string
  onClientChange: (clientId: string) => void
}

function CreatePortalForm({ 
  clients, 
  onSubmit, 
  isLoading, 
  selectedClient, 
  onClientChange 
}: CreatePortalFormProps) {
  const [permissions, setPermissions] = useState<ClientPortalPermissions>(defaultPermissions)
  const [allowedFeatures, setAllowedFeatures] = useState<string[]>(['dashboard', 'campaigns', 'profile'])
  const [customWelcomeMessage, setCustomWelcomeMessage] = useState('')
  const [expiresInDays, setExpiresInDays] = useState(365)

  const handlePermissionChange = (key: keyof ClientPortalPermissions, value: boolean) => {
    setPermissions(prev => ({ ...prev, [key]: value }))
  }

  const handleFeatureToggle = (featureId: string) => {
    setAllowedFeatures(prev => 
      prev.includes(featureId) 
        ? prev.filter(f => f !== featureId)
        : [...prev, featureId]
    )
  }

  const handleSubmit = () => {
    if (!selectedClient) {
      toast.error('Please select a client')
      return
    }

    onSubmit({
      clientId: selectedClient,
      permissions,
      allowedFeatures,
      customWelcomeMessage: customWelcomeMessage || undefined,
      expiresInDays,
    })
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label>Select Client</Label>
        <Select value={selectedClient} onValueChange={onClientChange}>
          <SelectTrigger>
            <SelectValue placeholder="Choose a client..." />
          </SelectTrigger>
          <SelectContent>
            {clients.map((client) => (
              <SelectItem key={client.id} value={client.id}>
                <div className="flex items-center gap-2">
                  <div>
                    <p className="font-medium">{client.first_name} {client.last_name}</p>
                    <p className="text-sm text-muted-foreground">{client.email}</p>
                  </div>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="permissions">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
          <TabsTrigger value="features">Features</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="permissions" className="space-y-4">
          <div className="space-y-4">
            <Label>Portal Permissions</Label>
            {Object.entries(defaultPermissions).map(([key, defaultValue]) => (
              <div key={key} className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium capitalize">
                    {key.replace(/_/g, ' ')}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {getPermissionDescription(key as keyof ClientPortalPermissions)}
                  </p>
                </div>
                <Switch
                  checked={permissions[key as keyof ClientPortalPermissions]}
                  onCheckedChange={(checked) => 
                    handlePermissionChange(key as keyof ClientPortalPermissions, checked)
                  }
                />
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="features" className="space-y-4">
          <div className="space-y-4">
            <Label>Available Features</Label>
            <div className="grid grid-cols-2 gap-4">
              {availableFeatures.map((feature) => (
                <div key={feature.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={feature.id}
                    checked={allowedFeatures.includes(feature.id)}
                    onCheckedChange={() => handleFeatureToggle(feature.id)}
                  />
                  <Label 
                    htmlFor={feature.id} 
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <feature.icon className="h-4 w-4" />
                    {feature.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="welcome_message">Custom Welcome Message</Label>
              <Textarea
                id="welcome_message"
                value={customWelcomeMessage}
                onChange={(e) => setCustomWelcomeMessage(e.target.value)}
                placeholder="Welcome to your personalized portal..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expires_in">Expires In (Days)</Label>
              <Select
                value={expiresInDays.toString()}
                onValueChange={(value) => setExpiresInDays(parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="90">90 days</SelectItem>
                  <SelectItem value="180">6 months</SelectItem>
                  <SelectItem value="365">1 year</SelectItem>
                  <SelectItem value="730">2 years</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end">
        <Button onClick={handleSubmit} disabled={isLoading || !selectedClient}>
          {isLoading ? 'Creating...' : 'Create Portal'}
        </Button>
      </div>
    </div>
  )
}

interface PortalCardProps {
  portal: WhiteLabelClientPortal
  clients: any[]
  onCopyLink: () => void
  onDelete: () => void
  onUpdate: (updates: Partial<WhiteLabelClientPortal>) => void
  isUpdating: boolean
  isDeleting: boolean
}

function PortalCard({ 
  portal, 
  clients, 
  onCopyLink, 
  onDelete, 
  onUpdate, 
  isUpdating, 
  isDeleting 
}: PortalCardProps) {
  const [showSettings, setShowSettings] = useState(false)
  
  const client = clients.find(c => c.id === portal.client_id)
  const portalUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/portal/${portal.portal_url}`

  const getStatusBadge = () => {
    if (!portal.is_active) {
      return <Badge variant="secondary">Inactive</Badge>
    }
    if (portal.is_locked) {
      return <Badge variant="destructive">Locked</Badge>
    }
    if (new Date(portal.expires_at) < new Date()) {
      return <Badge variant="destructive">Expired</Badge>
    }
    return <Badge variant="default">Active</Badge>
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="font-medium">
                {client ? `${client.first_name} ${client.last_name}` : 'Unknown Client'}
              </h3>
              {getStatusBadge()}
            </div>
            <p className="text-sm text-muted-foreground">
              {client?.email || 'No email'}
            </p>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Expires: {new Date(portal.expires_at).toLocaleDateString()}
              </span>
              {portal.last_accessed_at && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Last access: {new Date(portal.last_accessed_at).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSettings(!showSettings)}
            >
              <Settings className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onCopyLink}
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(portalUrl, '_blank')}
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onDelete}
              disabled={isDeleting}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {showSettings && (
          <>
            <Separator className="my-4" />
            <PortalSettings 
              portal={portal}
              onUpdate={onUpdate}
              isUpdating={isUpdating}
            />
          </>
        )}
      </CardContent>
    </Card>
  )
}

interface PortalSettingsProps {
  portal: WhiteLabelClientPortal
  onUpdate: (updates: Partial<WhiteLabelClientPortal>) => void
  isUpdating: boolean
}

function PortalSettings({ portal, onUpdate, isUpdating }: PortalSettingsProps) {
  const [localPermissions, setLocalPermissions] = useState(portal.permissions)
  const [localFeatures, setLocalFeatures] = useState(portal.allowed_features)
  const [emailNotifications, setEmailNotifications] = useState(portal.email_notifications)
  const [notificationFrequency, setNotificationFrequency] = useState(portal.notification_frequency)

  const handleSave = () => {
    onUpdate({
      permissions: localPermissions,
      allowed_features: localFeatures,
      email_notifications: emailNotifications,
      notification_frequency: notificationFrequency,
    })
  }

  const handlePermissionChange = (key: keyof ClientPortalPermissions, value: boolean) => {
    setLocalPermissions(prev => ({ ...prev, [key]: value }))
  }

  const handleFeatureToggle = (featureId: string) => {
    setLocalFeatures(prev => 
      prev.includes(featureId) 
        ? prev.filter(f => f !== featureId)
        : [...prev, featureId]
    )
  }

  return (
    <div className="space-y-4">
      <h4 className="font-medium">Portal Settings</h4>
      
      <Tabs defaultValue="permissions" className="w-full">
        <TabsList>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
          <TabsTrigger value="features">Features</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>
        
        <TabsContent value="permissions" className="space-y-3">
          {Object.entries(localPermissions).map(([key, value]) => (
            <div key={key} className="flex items-center justify-between">
              <Label className="text-sm capitalize">
                {key.replace(/_/g, ' ')}
              </Label>
              <Switch
                checked={value}
                onCheckedChange={(checked) => 
                  handlePermissionChange(key as keyof ClientPortalPermissions, checked)
                }
              />
            </div>
          ))}
        </TabsContent>
        
        <TabsContent value="features" className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {availableFeatures.map((feature) => (
              <div key={feature.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`${portal.id}-${feature.id}`}
                  checked={localFeatures.includes(feature.id)}
                  onCheckedChange={() => handleFeatureToggle(feature.id)}
                />
                <Label 
                  htmlFor={`${portal.id}-${feature.id}`}
                  className="flex items-center gap-2 cursor-pointer text-sm"
                >
                  <feature.icon className="h-3 w-3" />
                  {feature.label}
                </Label>
              </div>
            ))}
          </div>
        </TabsContent>
        
        <TabsContent value="notifications" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Email Notifications</Label>
              <p className="text-xs text-muted-foreground">
                Send email updates to the client
              </p>
            </div>
            <Switch
              checked={emailNotifications}
              onCheckedChange={setEmailNotifications}
            />
          </div>
          
          {emailNotifications && (
            <div className="space-y-2">
              <Label>Notification Frequency</Label>
              <Select
                value={notificationFrequency}
                onValueChange={(value) => setNotificationFrequency(value as NotificationFrequency)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="immediate">Immediate</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="never">Never</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </TabsContent>
      </Tabs>
      
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isUpdating} size="sm">
          {isUpdating ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  )
}

function getPermissionDescription(permission: keyof ClientPortalPermissions): string {
  const descriptions = {
    view_campaigns: 'View campaign details and status',
    view_analytics: 'Access analytics and performance data',
    download_reports: 'Download reports and data exports',
    update_profile: 'Edit profile information',
    view_invoices: 'View billing and invoice information',
    manage_team: 'Manage team members and permissions',
  }
  
  return descriptions[permission] || 'Permission description'
}