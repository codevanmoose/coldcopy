'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { 
  Shield, Download, Trash2, FileText, Settings, 
  Mail, Cookie, Database, Clock, CheckCircle2,
  AlertCircle, Loader2, ExternalLink, Key,
  UserX, FileDown, ToggleLeft
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/use-user'
import { toast } from 'sonner'
import { DataRequestForm } from '@/components/gdpr/data-request-form'
import { ConsentManager } from '@/components/gdpr/consent-manager'
import { format } from 'date-fns'

interface DataRequest {
  id: string
  type: 'export' | 'deletion' | 'access' | 'rectification'
  status: 'pending' | 'processing' | 'completed' | 'rejected'
  created_at: string
  completed_at?: string
  download_url?: string
  rejection_reason?: string
}

interface Consent {
  id: string
  type: string
  status: boolean
  updated_at: string
}

export default function PrivacyCenterPage() {
  const { user } = useUser()
  const [loading, setLoading] = useState(true)
  const [dataRequests, setDataRequests] = useState<DataRequest[]>([])
  const [consents, setConsents] = useState<Consent[]>([])
  const [activeTab, setActiveTab] = useState('overview')
  const supabase = createClient()

  useEffect(() => {
    if (user) {
      loadPrivacyData()
    }
  }, [user])

  const loadPrivacyData = async () => {
    setLoading(true)
    try {
      // Load data requests
      const { data: requests } = await supabase
        .from('gdpr_requests')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })

      if (requests) {
        setDataRequests(requests)
      }

      // Load consents
      const { data: userConsents } = await supabase
        .from('gdpr_consents')
        .select('*')
        .eq('user_id', user?.id)

      if (userConsents) {
        setConsents(userConsents)
      }
    } catch (error) {
      console.error('Error loading privacy data:', error)
      toast.error('Failed to load privacy data')
    } finally {
      setLoading(false)
    }
  }

  const handleWithdrawAllConsents = async () => {
    try {
      const { error } = await supabase
        .from('gdpr_consents')
        .update({ status: false })
        .eq('user_id', user?.id)

      if (error) throw error

      toast.success('All consents withdrawn successfully')
      loadPrivacyData()
    } catch (error) {
      console.error('Error withdrawing consents:', error)
      toast.error('Failed to withdraw consents')
    }
  }

  const handleDownloadData = async (requestId: string, downloadUrl: string) => {
    try {
      window.open(downloadUrl, '_blank')
      toast.success('Download started')
    } catch (error) {
      console.error('Error downloading data:', error)
      toast.error('Failed to start download')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="container max-w-6xl py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Privacy Center</h1>
            <p className="text-muted-foreground">
              Manage your privacy settings and data protection rights
            </p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <FileDown className="h-5 w-5 text-muted-foreground" />
              <Badge variant="secondary">GDPR</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="font-medium">Download My Data</p>
            <p className="text-sm text-muted-foreground mt-1">
              Export all your personal data
            </p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <UserX className="h-5 w-5 text-muted-foreground" />
              <Badge variant="secondary">Right</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="font-medium">Delete My Account</p>
            <p className="text-sm text-muted-foreground mt-1">
              Request complete data deletion
            </p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <ToggleLeft className="h-5 w-5 text-muted-foreground" />
              <Badge variant="secondary">Control</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="font-medium">Manage Consents</p>
            <p className="text-sm text-muted-foreground mt-1">
              Control how we use your data
            </p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <Cookie className="h-5 w-5 text-muted-foreground" />
              <Badge variant="secondary">Cookies</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="font-medium">Cookie Settings</p>
            <p className="text-sm text-muted-foreground mt-1">
              Manage cookie preferences
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="consents">Consents</TabsTrigger>
          <TabsTrigger value="requests">Data Requests</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="rights">Your Rights</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Privacy Overview</CardTitle>
              <CardDescription>
                Your privacy settings and data protection status at a glance
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Data Collection Summary */}
              <div>
                <h3 className="font-medium mb-3">Data We Collect</h3>
                <div className="grid gap-3">
                  <div className="flex items-start gap-3">
                    <Database className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium">Account Information</p>
                      <p className="text-sm text-muted-foreground">
                        Email, name, company details, and profile settings
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium">Communication Data</p>
                      <p className="text-sm text-muted-foreground">
                        Email campaigns, templates, and engagement metrics
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Settings className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium">Usage Information</p>
                      <p className="text-sm text-muted-foreground">
                        Feature usage, preferences, and interaction data
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Active Consents */}
              <div>
                <h3 className="font-medium mb-3">Active Consents</h3>
                <div className="space-y-2">
                  {consents.filter(c => c.status).map(consent => (
                    <div key={consent.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium">{consent.type}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        Granted {format(new Date(consent.updated_at), 'MMM d, yyyy')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Recent Requests */}
              <div>
                <h3 className="font-medium mb-3">Recent Data Requests</h3>
                {dataRequests.length > 0 ? (
                  <div className="space-y-2">
                    {dataRequests.slice(0, 3).map(request => (
                      <div key={request.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium capitalize">{request.type} Request</span>
                        </div>
                        <Badge variant={
                          request.status === 'completed' ? 'default' :
                          request.status === 'processing' ? 'secondary' :
                          request.status === 'rejected' ? 'destructive' : 'outline'
                        }>
                          {request.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No data requests yet</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="consents" className="space-y-4">
          <ConsentManager />
        </TabsContent>

        <TabsContent value="requests" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Data Subject Requests</CardTitle>
              <CardDescription>
                Submit and track your data protection requests
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DataRequestForm onSuccess={loadPrivacyData} />
            </CardContent>
          </Card>

          {/* Request History */}
          {dataRequests.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Request History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {dataRequests.map(request => (
                    <div key={request.id} className="flex items-center justify-between p-4 rounded-lg border">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5">
                          {request.type === 'export' && <Download className="h-5 w-5 text-muted-foreground" />}
                          {request.type === 'deletion' && <Trash2 className="h-5 w-5 text-muted-foreground" />}
                          {request.type === 'access' && <Key className="h-5 w-5 text-muted-foreground" />}
                          {request.type === 'rectification' && <FileText className="h-5 w-5 text-muted-foreground" />}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium capitalize">{request.type} Request</p>
                          <p className="text-sm text-muted-foreground">
                            Submitted {format(new Date(request.created_at), 'MMM d, yyyy')}
                          </p>
                          {request.rejection_reason && (
                            <Alert className="mt-2">
                              <AlertCircle className="h-4 w-4" />
                              <AlertDescription>{request.rejection_reason}</AlertDescription>
                            </Alert>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={
                          request.status === 'completed' ? 'default' :
                          request.status === 'processing' ? 'secondary' :
                          request.status === 'rejected' ? 'destructive' : 'outline'
                        }>
                          {request.status}
                        </Badge>
                        {request.status === 'completed' && request.download_url && (
                          <Button
                            size="sm"
                            onClick={() => handleDownloadData(request.id, request.download_url!)}
                          >
                            <Download className="h-4 w-4 mr-1" />
                            Download
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Data Processing Activities</CardTitle>
              <CardDescription>
                How we process and use your personal data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="p-4 rounded-lg border">
                  <div className="flex items-start gap-3">
                    <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-medium">Email Campaign Management</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        We process your email data to send campaigns, track engagement, and improve deliverability.
                      </p>
                      <div className="mt-3 space-y-1">
                        <p className="text-xs"><strong>Legal Basis:</strong> Legitimate Interest</p>
                        <p className="text-xs"><strong>Retention:</strong> Until account deletion</p>
                        <p className="text-xs"><strong>Recipients:</strong> Email service providers</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-lg border">
                  <div className="flex items-start gap-3">
                    <Database className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-medium">Lead Enrichment</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        We enrich lead data with public information to improve personalization and targeting.
                      </p>
                      <div className="mt-3 space-y-1">
                        <p className="text-xs"><strong>Legal Basis:</strong> Consent</p>
                        <p className="text-xs"><strong>Retention:</strong> 2 years</p>
                        <p className="text-xs"><strong>Recipients:</strong> Data enrichment providers</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-lg border">
                  <div className="flex items-start gap-3">
                    <Settings className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-medium">Analytics & Performance</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        We analyze usage patterns to improve our service and provide better features.
                      </p>
                      <div className="mt-3 space-y-1">
                        <p className="text-xs"><strong>Legal Basis:</strong> Legitimate Interest</p>
                        <p className="text-xs"><strong>Retention:</strong> 1 year</p>
                        <p className="text-xs"><strong>Recipients:</strong> Analytics providers</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rights" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Your Data Protection Rights</CardTitle>
              <CardDescription>
                Under GDPR, you have the following rights regarding your personal data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <div className="p-4 rounded-lg bg-muted/50">
                  <h4 className="font-medium mb-2">Right to Access</h4>
                  <p className="text-sm text-muted-foreground">
                    You can request a copy of all personal data we hold about you.
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-muted/50">
                  <h4 className="font-medium mb-2">Right to Rectification</h4>
                  <p className="text-sm text-muted-foreground">
                    You can request correction of any inaccurate personal data.
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-muted/50">
                  <h4 className="font-medium mb-2">Right to Erasure</h4>
                  <p className="text-sm text-muted-foreground">
                    You can request deletion of your personal data in certain circumstances.
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-muted/50">
                  <h4 className="font-medium mb-2">Right to Data Portability</h4>
                  <p className="text-sm text-muted-foreground">
                    You can request your data in a structured, machine-readable format.
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-muted/50">
                  <h4 className="font-medium mb-2">Right to Object</h4>
                  <p className="text-sm text-muted-foreground">
                    You can object to processing based on legitimate interests or direct marketing.
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-muted/50">
                  <h4 className="font-medium mb-2">Right to Withdraw Consent</h4>
                  <p className="text-sm text-muted-foreground">
                    You can withdraw consent for data processing at any time.
                  </p>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <h4 className="font-medium">How to Exercise Your Rights</h4>
                <p className="text-sm text-muted-foreground">
                  To exercise any of these rights, you can:
                </p>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4">
                  <li>Use the request forms in the Data Requests tab</li>
                  <li>Contact our Data Protection Officer at privacy@coldcopy.ai</li>
                  <li>Submit a request through our support system</li>
                </ul>
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    We will respond to your request within 30 days. Complex requests may take up to 90 days with notice.
                  </AlertDescription>
                </Alert>
              </div>
            </CardContent>
            <CardFooter>
              <Button variant="outline" className="w-full" asChild>
                <a href="mailto:privacy@coldcopy.ai">
                  <Mail className="mr-2 h-4 w-4" />
                  Contact Data Protection Officer
                </a>
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}