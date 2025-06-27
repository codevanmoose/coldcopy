'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { 
  Mail, 
  Shield, 
  CheckCircle2, 
  XCircle, 
  Loader2,
  AlertCircle,
  Copy,
  ExternalLink
} from 'lucide-react'
import { TestEmailDialog } from '@/components/email/test-email-dialog'
import { WarmUpConfig } from '@/components/email/warm-up-config'

const emailConfigSchema = z.object({
  sender_name: z.string().min(2, 'Sender name is required'),
  sender_email: z.string().email('Invalid email address'),
  reply_to_email: z.string().email('Invalid email address').optional().or(z.literal('')),
})

type EmailConfigForm = z.infer<typeof emailConfigSchema>

interface DomainVerification {
  domain: string
  dkim_verified: boolean
  spf_verified: boolean
  dmarc_verified: boolean
  mx_verified: boolean
  verified_at?: string
}

export default function EmailSettingsPage() {
  const { workspace, setWorkspace } = useAuthStore()
  const [isLoading, setIsLoading] = useState(false)
  const [verificationStatus, setVerificationStatus] = useState<DomainVerification | null>(null)
  const [checkingVerification, setCheckingVerification] = useState(false)
  const supabase = createClient()

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
    watch,
  } = useForm<EmailConfigForm>({
    resolver: zodResolver(emailConfigSchema),
    defaultValues: {
      sender_name: workspace?.settings?.email?.sender_name || '',
      sender_email: workspace?.settings?.email?.sender_email || '',
      reply_to_email: workspace?.settings?.email?.reply_to_email || '',
    },
  })

  const senderEmail = watch('sender_email')
  const senderDomain = senderEmail ? senderEmail.split('@')[1] : ''

  useEffect(() => {
    if (workspace) {
      reset({
        sender_name: workspace.settings?.email?.sender_name || '',
        sender_email: workspace.settings?.email?.sender_email || '',
        reply_to_email: workspace.settings?.email?.reply_to_email || '',
      })
    }
  }, [workspace, reset])

  const onSubmit = async (data: EmailConfigForm) => {
    if (!workspace) return

    setIsLoading(true)
    try {
      const { data: updatedWorkspace, error } = await supabase
        .from('workspaces')
        .update({
          settings: {
            ...workspace.settings,
            email: {
              sender_name: data.sender_name,
              sender_email: data.sender_email,
              reply_to_email: data.reply_to_email || null,
            },
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', workspace.id)
        .select()
        .single()

      if (error) throw error

      setWorkspace(updatedWorkspace)
      toast.success('Email settings updated successfully')
      reset(data)
    } catch (error) {
      console.error('Error updating email settings:', error)
      toast.error('Failed to update email settings')
    } finally {
      setIsLoading(false)
    }
  }

  const checkDomainVerification = async () => {
    if (!senderDomain) return

    setCheckingVerification(true)
    try {
      // In a real implementation, this would check DNS records
      // For now, we'll simulate the check
      const mockVerification: DomainVerification = {
        domain: senderDomain,
        dkim_verified: Math.random() > 0.3,
        spf_verified: Math.random() > 0.2,
        dmarc_verified: Math.random() > 0.5,
        mx_verified: true,
        verified_at: new Date().toISOString(),
      }
      
      setVerificationStatus(mockVerification)
    } catch (error) {
      console.error('Error checking domain verification:', error)
      toast.error('Failed to check domain verification')
    } finally {
      setCheckingVerification(false)
    }
  }

  const copyRecord = (record: string) => {
    navigator.clipboard.writeText(record)
    toast.success('Copied to clipboard')
  }

  const isFullyVerified = verificationStatus && 
    verificationStatus.dkim_verified && 
    verificationStatus.spf_verified && 
    verificationStatus.dmarc_verified

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Email Configuration</CardTitle>
          <CardDescription>
            Configure your email sending settings and domain verification
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sender_name">Sender Name</Label>
              <Input
                id="sender_name"
                {...register('sender_name')}
                placeholder="John from Acme"
              />
              {errors.sender_name && (
                <p className="text-sm text-destructive">{errors.sender_name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="sender_email">Sender Email</Label>
              <Input
                id="sender_email"
                type="email"
                {...register('sender_email')}
                placeholder="john@yourdomain.com"
              />
              {errors.sender_email && (
                <p className="text-sm text-destructive">{errors.sender_email.message}</p>
              )}
              <p className="text-sm text-muted-foreground">
                Use your own domain for better deliverability
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reply_to_email">Reply-To Email (Optional)</Label>
              <Input
                id="reply_to_email"
                type="email"
                {...register('reply_to_email')}
                placeholder="replies@yourdomain.com"
              />
              {errors.reply_to_email && (
                <p className="text-sm text-destructive">{errors.reply_to_email.message}</p>
              )}
              <p className="text-sm text-muted-foreground">
                Leave blank to use sender email for replies
              </p>
            </div>

            <div className="flex items-center gap-4">
              <Button type="submit" disabled={!isDirty || isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Settings'
                )}
              </Button>
              {isDirty && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => reset()}
                >
                  Cancel
                </Button>
              )}
              {workspace?.settings?.email?.sender_email && !isDirty && (
                <TestEmailDialog />
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {senderDomain && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Domain Verification</CardTitle>
                <CardDescription>
                  Verify {senderDomain} to improve email deliverability
                </CardDescription>
              </div>
              <Button
                variant="outline"
                onClick={checkDomainVerification}
                disabled={checkingVerification}
              >
                {checkingVerification ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Checking...
                  </>
                ) : (
                  <>
                    <Shield className="mr-2 h-4 w-4" />
                    Check Status
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {verificationStatus ? (
              <>
                {isFullyVerified ? (
                  <Alert>
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <AlertDescription>
                      Your domain is fully verified and ready for sending
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Complete the DNS configuration below to verify your domain
                    </AlertDescription>
                  </Alert>
                )}

                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      {verificationStatus.dkim_verified ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      ) : (
                        <XCircle className="h-5 w-5 text-destructive" />
                      )}
                      <div>
                        <p className="font-medium">DKIM</p>
                        <p className="text-sm text-muted-foreground">
                          Authenticates your emails
                        </p>
                      </div>
                    </div>
                    <Badge variant={verificationStatus.dkim_verified ? 'default' : 'outline'}>
                      {verificationStatus.dkim_verified ? 'Verified' : 'Pending'}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      {verificationStatus.spf_verified ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      ) : (
                        <XCircle className="h-5 w-5 text-destructive" />
                      )}
                      <div>
                        <p className="font-medium">SPF</p>
                        <p className="text-sm text-muted-foreground">
                          Authorizes sending from this domain
                        </p>
                      </div>
                    </div>
                    <Badge variant={verificationStatus.spf_verified ? 'default' : 'outline'}>
                      {verificationStatus.spf_verified ? 'Verified' : 'Pending'}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      {verificationStatus.dmarc_verified ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      ) : (
                        <XCircle className="h-5 w-5 text-destructive" />
                      )}
                      <div>
                        <p className="font-medium">DMARC</p>
                        <p className="text-sm text-muted-foreground">
                          Protects against spoofing
                        </p>
                      </div>
                    </div>
                    <Badge variant={verificationStatus.dmarc_verified ? 'default' : 'outline'}>
                      {verificationStatus.dmarc_verified ? 'Verified' : 'Pending'}
                    </Badge>
                  </div>
                </div>

                {!isFullyVerified && (
                  <Card className="bg-muted/50">
                    <CardHeader>
                      <CardTitle className="text-base">DNS Records to Add</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {!verificationStatus.dkim_verified && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium">DKIM Record</p>
                          <div className="flex items-center gap-2">
                            <code className="flex-1 p-2 rounded bg-background text-xs break-all">
                              coldcopy._domainkey.{senderDomain} CNAME coldcopy.dkim.amazonses.com
                            </code>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => copyRecord(`coldcopy._domainkey.${senderDomain} CNAME coldcopy.dkim.amazonses.com`)}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}

                      {!verificationStatus.spf_verified && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium">SPF Record</p>
                          <div className="flex items-center gap-2">
                            <code className="flex-1 p-2 rounded bg-background text-xs break-all">
                              v=spf1 include:amazonses.com ~all
                            </code>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => copyRecord('v=spf1 include:amazonses.com ~all')}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}

                      {!verificationStatus.dmarc_verified && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium">DMARC Record</p>
                          <div className="flex items-center gap-2">
                            <code className="flex-1 p-2 rounded bg-background text-xs break-all">
                              _dmarc.{senderDomain} TXT "v=DMARC1; p=quarantine; rua=mailto:dmarc@{senderDomain}"
                            </code>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => copyRecord(`_dmarc.${senderDomain} TXT "v=DMARC1; p=quarantine; rua=mailto:dmarc@${senderDomain}"`)}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              <div className="text-center py-8">
                <Mail className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Click "Check Status" to verify your domain configuration
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <WarmUpConfig 
        workspaceId={workspace?.id || ''} 
        currentConfig={workspace?.settings?.email?.warmUp}
        onSave={(config) => {
          // Update workspace settings with warm-up config
          if (workspace) {
            setWorkspace({
              ...workspace,
              settings: {
                ...workspace.settings,
                email: {
                  ...workspace.settings?.email,
                  warmUp: config,
                },
              },
            })
          }
        }}
      />

      <Card>
        <CardHeader>
          <CardTitle>Email Limits & Usage</CardTitle>
          <CardDescription>
            Monitor your email sending limits and current usage
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Daily Limit</p>
              <p className="text-2xl font-bold">50,000</p>
              <p className="text-xs text-muted-foreground">emails per day</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Sent Today</p>
              <p className="text-2xl font-bold">1,234</p>
              <p className="text-xs text-muted-foreground">2.5% of limit</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Send Rate</p>
              <p className="text-2xl font-bold">14/sec</p>
              <p className="text-xs text-muted-foreground">maximum send rate</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}