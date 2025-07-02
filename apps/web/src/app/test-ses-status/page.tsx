'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import { useWorkspace } from '@/hooks/use-workspace'
import { 
  Mail, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Loader2,
  Send,
  Info,
  Shield,
  Activity
} from 'lucide-react'

interface SESStatus {
  configured: boolean
  sandboxMode: boolean
  sendingQuota: {
    max24HourSend: number
    maxSendRate: number
    sentLast24Hours: number
  }
  verifiedDomains: string[]
  verifiedEmails: string[]
  configurationSets: string[]
  suppressionList: {
    enabled: boolean
    count: number
  }
  reputation: {
    bounceRate: number
    complaintRate: number
    deliveryRate: number
  }
}

export default function TestSESStatusPage() {
  const { workspace } = useWorkspace()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [sesStatus, setSesStatus] = useState<SESStatus | null>(null)
  const [testEmail, setTestEmail] = useState('')
  const [sendingTest, setSendingTest] = useState(false)

  const checkSESStatus = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/ses-status')
      if (!response.ok) {
        throw new Error('Failed to fetch SES status')
      }
      const data = await response.json()
      setSesStatus(data)
    } catch (error) {
      console.error('SES status error:', error)
      toast({
        title: 'Error',
        description: 'Failed to fetch SES status',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const sendTestEmail = async () => {
    if (!testEmail || !workspace?.id) {
      toast({
        title: 'Error',
        description: 'Please enter an email address',
        variant: 'destructive',
      })
      return
    }

    setSendingTest(true)
    try {
      const response = await fetch('/api/email/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workspace_id: workspace.id,
          to: testEmail,
          subject: 'ColdCopy Test Email',
          body: `This is a test email from ColdCopy.

If you're receiving this, it means our email system is working correctly!

Best regards,
The ColdCopy Team`,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to send test email')
      }

      toast({
        title: 'Success!',
        description: 'Test email sent successfully',
      })
    } catch (error) {
      console.error('Send test error:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to send test email',
        variant: 'destructive',
      })
    } finally {
      setSendingTest(false)
    }
  }

  useEffect(() => {
    checkSESStatus()
  }, [])

  const getStatusBadge = (configured: boolean, sandboxMode: boolean) => {
    if (!configured) {
      return <Badge variant="destructive">Not Configured</Badge>
    }
    if (sandboxMode) {
      return <Badge variant="secondary">Sandbox Mode</Badge>
    }
    return <Badge className="bg-green-500">Production</Badge>
  }

  const getReputationColor = (rate: number, type: 'bounce' | 'complaint') => {
    if (type === 'bounce') {
      if (rate < 5) return 'text-green-600'
      if (rate < 10) return 'text-yellow-600'
      return 'text-red-600'
    } else {
      if (rate < 0.1) return 'text-green-600'
      if (rate < 0.5) return 'text-yellow-600'
      return 'text-red-600'
    }
  }

  return (
    <div className="container max-w-4xl py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Amazon SES Status</h1>
        <p className="text-gray-600">
          Check email service configuration and sending limits
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>SES Configuration</CardTitle>
          <CardDescription>
            Current status of Amazon SES email service
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : sesStatus ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  <span className="font-medium">Service Status</span>
                </div>
                {getStatusBadge(sesStatus.configured, sesStatus.sandboxMode)}
              </div>

              {sesStatus.sandboxMode && (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-yellow-800">Sandbox Mode Active</h4>
                      <p className="text-sm text-yellow-700 mt-1">
                        You can only send emails to verified addresses. Production access is pending approval (24-48 hours).
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Activity className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium">24h Send Limit</span>
                  </div>
                  <div className="text-2xl font-bold">
                    {sesStatus.sendingQuota.max24HourSend.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-500">
                    Used: {sesStatus.sendingQuota.sentLast24Hours}
                  </div>
                </div>

                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Send className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium">Send Rate</span>
                  </div>
                  <div className="text-2xl font-bold">
                    {sesStatus.sendingQuota.maxSendRate}/sec
                  </div>
                  <div className="text-sm text-gray-500">
                    Emails per second
                  </div>
                </div>

                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium">Delivery Rate</span>
                  </div>
                  <div className="text-2xl font-bold text-green-600">
                    {sesStatus.reputation.deliveryRate}%
                  </div>
                  <div className="text-sm text-gray-500">
                    Last 7 days
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-3">Verified Domains</h4>
                {sesStatus.verifiedDomains.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {sesStatus.verifiedDomains.map((domain) => (
                      <Badge key={domain} variant="outline" className="flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                        {domain}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No verified domains</p>
                )}
              </div>

              <div>
                <h4 className="font-medium mb-3">Reputation Metrics</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Bounce Rate</span>
                    <span className={`text-sm font-medium ${getReputationColor(sesStatus.reputation.bounceRate, 'bounce')}`}>
                      {sesStatus.reputation.bounceRate}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Complaint Rate</span>
                    <span className={`text-sm font-medium ${getReputationColor(sesStatus.reputation.complaintRate, 'complaint')}`}>
                      {sesStatus.reputation.complaintRate}%
                    </span>
                  </div>
                </div>
              </div>

              <Button onClick={checkSESStatus} variant="outline" className="w-full">
                <Activity className="mr-2 h-4 w-4" />
                Refresh Status
              </Button>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No SES data available
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Send Test Email</CardTitle>
          <CardDescription>
            Test email delivery with Amazon SES
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="testEmail">Recipient Email</Label>
            <Input
              id="testEmail"
              type="email"
              placeholder="test@example.com"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
            />
            {sesStatus?.sandboxMode && (
              <p className="text-sm text-yellow-600">
                <Info className="inline h-3 w-3 mr-1" />
                In sandbox mode, you can only send to verified emails
              </p>
            )}
          </div>
          
          <Button 
            onClick={sendTestEmail} 
            disabled={sendingTest || !testEmail || !workspace?.id}
            className="w-full"
          >
            {sendingTest ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending Test Email...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Send Test Email
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Production Access Checklist</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>Domain verified (coldcopy.cc)</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>DKIM records configured</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>SPF record added</span>
            </div>
            <div className="flex items-center gap-2">
              {sesStatus?.sandboxMode ? (
                <Circle className="h-4 w-4 text-yellow-500" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              )}
              <span>Production access {sesStatus?.sandboxMode ? '(pending 24-48h)' : '(approved)'}</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>Bounce handling configured</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>Complaint handling configured</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}