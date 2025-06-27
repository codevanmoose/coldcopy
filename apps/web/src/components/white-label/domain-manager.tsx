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
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { 
  Globe, 
  Plus, 
  Shield, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  Copy,
  Trash2,
  Settings,
  ExternalLink 
} from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { WhiteLabelDomain, DomainSSLStatus, DomainVerificationStatus } from '@/lib/white-label/types'
import { toast } from 'sonner'

interface DomainManagerProps {
  className?: string
}

export function DomainManager({ className }: DomainManagerProps) {
  const { dbUser } = useAuthStore()
  const queryClient = useQueryClient()
  const [isAddDomainOpen, setIsAddDomainOpen] = useState(false)
  const [newDomain, setNewDomain] = useState('')
  const [newSubdomain, setNewSubdomain] = useState('')

  // Fetch domains
  const { data: domains = [], isLoading } = useQuery({
    queryKey: ['white-label-domains', dbUser?.workspace_id],
    queryFn: async () => {
      if (!dbUser?.workspace_id) return []
      
      const response = await fetch(`/api/white-label/domains?workspaceId=${dbUser.workspace_id}`)
      if (!response.ok) throw new Error('Failed to fetch domains')
      return response.json()
    },
    enabled: !!dbUser?.workspace_id,
  })

  // Add domain mutation
  const addDomainMutation = useMutation({
    mutationFn: async ({ domain, subdomain }: { domain: string; subdomain?: string }) => {
      if (!dbUser?.workspace_id) throw new Error('No workspace ID')
      
      const response = await fetch('/api/white-label/domains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: dbUser.workspace_id,
          domain,
          subdomain,
        }),
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to add domain')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['white-label-domains'] })
      setIsAddDomainOpen(false)
      setNewDomain('')
      setNewSubdomain('')
      toast.success('Domain added successfully')
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  // Verify domain mutation
  const verifyDomainMutation = useMutation({
    mutationFn: async (domainId: string) => {
      const response = await fetch(`/api/white-label/domains/${domainId}/verify`, {
        method: 'POST',
      })
      
      if (!response.ok) throw new Error('Failed to verify domain')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['white-label-domains'] })
      toast.success('Domain verification started')
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  // Delete domain mutation
  const deleteDomainMutation = useMutation({
    mutationFn: async (domainId: string) => {
      const response = await fetch(`/api/white-label/domains/${domainId}`, {
        method: 'DELETE',
      })
      
      if (!response.ok) throw new Error('Failed to delete domain')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['white-label-domains'] })
      toast.success('Domain deleted successfully')
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  // SSL provision mutation
  const provisionSSLMutation = useMutation({
    mutationFn: async (domainId: string) => {
      const response = await fetch(`/api/white-label/domains/${domainId}/ssl`, {
        method: 'POST',
      })
      
      if (!response.ok) throw new Error('Failed to provision SSL')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['white-label-domains'] })
      toast.success('SSL provisioning started')
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const handleAddDomain = () => {
    if (!newDomain.trim()) {
      toast.error('Please enter a domain')
      return
    }

    addDomainMutation.mutate({
      domain: newDomain.trim(),
      subdomain: newSubdomain.trim() || undefined,
    })
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard')
  }

  const getStatusBadge = (status: DomainVerificationStatus | DomainSSLStatus, type: 'verification' | 'ssl') => {
    const getVariant = () => {
      switch (status) {
        case 'verified':
        case 'active':
          return 'default'
        case 'pending':
        case 'provisioning':
          return 'secondary'
        case 'failed':
        case 'expired':
          return 'destructive'
        default:
          return 'outline'
      }
    }

    const getIcon = () => {
      switch (status) {
        case 'verified':
        case 'active':
          return <CheckCircle className="h-3 w-3" />
        case 'pending':
        case 'provisioning':
          return <Clock className="h-3 w-3" />
        case 'failed':
        case 'expired':
          return <AlertCircle className="h-3 w-3" />
        default:
          return null
      }
    }

    return (
      <Badge variant={getVariant()} className="gap-1">
        {getIcon()}
        {type === 'ssl' ? 'SSL' : 'DNS'} {status}
      </Badge>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Custom Domains
            </CardTitle>
            <CardDescription>
              Manage your custom domains and SSL certificates
            </CardDescription>
          </div>
          <Dialog open={isAddDomainOpen} onOpenChange={setIsAddDomainOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Domain
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Custom Domain</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="subdomain">Subdomain (optional)</Label>
                    <Input
                      id="subdomain"
                      placeholder="app"
                      value={newSubdomain}
                      onChange={(e) => setNewSubdomain(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="domain">Domain</Label>
                    <Input
                      id="domain"
                      placeholder="yourdomain.com"
                      value={newDomain}
                      onChange={(e) => setNewDomain(e.target.value)}
                    />
                  </div>
                </div>
                {(newSubdomain || newDomain) && (
                  <Alert>
                    <AlertDescription>
                      Your full domain will be: <strong>
                        {newSubdomain ? `${newSubdomain}.${newDomain}` : newDomain}
                      </strong>
                    </AlertDescription>
                  </Alert>
                )}
                <Button 
                  onClick={handleAddDomain} 
                  disabled={addDomainMutation.isPending}
                  className="w-full"
                >
                  {addDomainMutation.isPending ? 'Adding...' : 'Add Domain'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : domains.length === 0 ? (
          <div className="text-center py-8">
            <Globe className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No domains configured</h3>
            <p className="text-muted-foreground mb-4">
              Add your first custom domain to get started with white-labeling
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {domains.map((domain: WhiteLabelDomain) => (
              <DomainCard
                key={domain.id}
                domain={domain}
                onVerify={() => verifyDomainMutation.mutate(domain.id)}
                onProvisionSSL={() => provisionSSLMutation.mutate(domain.id)}
                onDelete={() => deleteDomainMutation.mutate(domain.id)}
                onCopy={copyToClipboard}
                isVerifying={verifyDomainMutation.isPending}
                isProvisioning={provisionSSLMutation.isPending}
                isDeleting={deleteDomainMutation.isPending}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

interface DomainCardProps {
  domain: WhiteLabelDomain
  onVerify: () => void
  onProvisionSSL: () => void
  onDelete: () => void
  onCopy: (text: string) => void
  isVerifying: boolean
  isProvisioning: boolean
  isDeleting: boolean
}

function DomainCard({ 
  domain, 
  onVerify, 
  onProvisionSSL, 
  onDelete, 
  onCopy,
  isVerifying,
  isProvisioning,
  isDeleting 
}: DomainCardProps) {
  const [showDNSConfig, setShowDNSConfig] = useState(false)

  const getStatusBadge = (status: DomainVerificationStatus | DomainSSLStatus, type: 'verification' | 'ssl') => {
    const getVariant = () => {
      switch (status) {
        case 'verified':
        case 'active':
          return 'default'
        case 'pending':
        case 'provisioning':
          return 'secondary'
        case 'failed':
        case 'expired':
          return 'destructive'
        default:
          return 'outline'
      }
    }

    const getIcon = () => {
      switch (status) {
        case 'verified':
        case 'active':
          return <CheckCircle className="h-3 w-3" />
        case 'pending':
        case 'provisioning':
          return <Clock className="h-3 w-3" />
        case 'failed':
        case 'expired':
          return <AlertCircle className="h-3 w-3" />
        default:
          return null
      }
    }

    return (
      <Badge variant={getVariant()} className="gap-1">
        {getIcon()}
        {type === 'ssl' ? 'SSL' : 'DNS'} {status}
      </Badge>
    )
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="font-medium">{domain.full_domain}</h3>
              {domain.is_primary && (
                <Badge variant="outline">Primary</Badge>
              )}
              {domain.is_active && (
                <Badge variant="default">Active</Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {getStatusBadge(domain.verification_status, 'verification')}
              {getStatusBadge(domain.ssl_status, 'ssl')}
            </div>
            {domain.verified_at && (
              <p className="text-sm text-muted-foreground">
                Verified: {new Date(domain.verified_at).toLocaleDateString()}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDNSConfig(!showDNSConfig)}
            >
              <Settings className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onCopy(`https://${domain.full_domain}`)}
            >
              <Copy className="h-4 w-4" />
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

        {showDNSConfig && (
          <>
            <Separator className="my-4" />
            <DNSConfiguration
              domain={domain}
              onVerify={onVerify}
              onProvisionSSL={onProvisionSSL}
              onCopy={onCopy}
              isVerifying={isVerifying}
              isProvisioning={isProvisioning}
            />
          </>
        )}
      </CardContent>
    </Card>
  )
}

interface DNSConfigurationProps {
  domain: WhiteLabelDomain
  onVerify: () => void
  onProvisionSSL: () => void
  onCopy: (text: string) => void
  isVerifying: boolean
  isProvisioning: boolean
}

function DNSConfiguration({ 
  domain, 
  onVerify, 
  onProvisionSSL, 
  onCopy,
  isVerifying,
  isProvisioning 
}: DNSConfigurationProps) {
  return (
    <div className="space-y-4">
      <h4 className="font-medium">DNS Configuration</h4>
      
      <Tabs defaultValue="dns" className="w-full">
        <TabsList>
          <TabsTrigger value="dns">DNS Records</TabsTrigger>
          <TabsTrigger value="ssl">SSL Certificate</TabsTrigger>
        </TabsList>
        
        <TabsContent value="dns" className="space-y-4">
          {domain.verification_status !== 'verified' && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Add these DNS records to your domain provider to verify ownership.
              </AlertDescription>
            </Alert>
          )}
          
          <div className="space-y-3">
            {/* CNAME Record */}
            {domain.dns_records.cname && (
              <div className="grid grid-cols-4 gap-4 items-center p-3 bg-muted rounded-lg">
                <div className="font-mono text-sm">CNAME</div>
                <div className="font-mono text-sm">{domain.dns_records.cname.name}</div>
                <div className="font-mono text-sm break-all">{domain.dns_records.cname.value}</div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onCopy(`${domain.dns_records.cname?.name} CNAME ${domain.dns_records.cname?.value}`)}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            )}
            
            {/* TXT Records for verification */}
            {domain.dns_records.txt_records.map((record, index) => (
              <div key={index} className="grid grid-cols-4 gap-4 items-center p-3 bg-muted rounded-lg">
                <div className="font-mono text-sm">TXT</div>
                <div className="font-mono text-sm">{record.name}</div>
                <div className="font-mono text-sm break-all">{record.value}</div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onCopy(`${record.name} TXT ${record.value}`)}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
          
          <div className="flex justify-end">
            <Button
              onClick={onVerify}
              disabled={isVerifying || domain.verification_status === 'verified'}
            >
              {isVerifying ? 'Verifying...' : 'Verify Domain'}
            </Button>
          </div>
        </TabsContent>
        
        <TabsContent value="ssl" className="space-y-4">
          {domain.verification_status !== 'verified' ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Domain must be verified before SSL certificate can be provisioned.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">SSL Status</Label>
                  <p className="text-sm text-muted-foreground">{domain.ssl_status}</p>
                </div>
                {domain.expires_at && (
                  <div>
                    <Label className="text-sm font-medium">Expires</Label>
                    <p className="text-sm text-muted-foreground">
                      {new Date(domain.expires_at).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>
              
              <div className="flex justify-end">
                <Button
                  onClick={onProvisionSSL}
                  disabled={isProvisioning || domain.ssl_status === 'active'}
                >
                  {isProvisioning ? 'Provisioning...' : 'Provision SSL'}
                </Button>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}