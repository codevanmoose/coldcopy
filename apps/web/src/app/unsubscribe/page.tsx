'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { generateTrackingToken } from '@/lib/email/tracking'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { toast } from 'sonner'
import { Mail, CheckCircle2, XCircle, Loader2, AlertCircle } from 'lucide-react'

function UnsubscribeContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [unsubscribed, setUnsubscribed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [feedback, setFeedback] = useState('')
  const [manage, setManage] = useState(false)
  const [leadInfo, setLeadInfo] = useState<{ email: string; workspace: string } | null>(null)

  const supabase = createClient()

  // Handle both old token format and new tracking format
  const oldToken = searchParams.get('token')
  const trackingToken = searchParams.get('t')
  const leadId = searchParams.get('l')
  const workspaceId = searchParams.get('w')
  const emailId = searchParams.get('e')
  const managePrefs = searchParams.get('manage') === 'true'

  useEffect(() => {
    const checkToken = async () => {
      setChecking(true)
      try {
        if (oldToken) {
          // Old format - base64 encoded JSON
          try {
            const decoded = JSON.parse(Buffer.from(oldToken, 'base64').toString())
            const { workspace, email } = decoded
            
            if (workspace && email) {
              setLeadInfo({ email, workspace })
            } else {
              setError('Invalid unsubscribe link')
            }
          } catch (e) {
            setError('Invalid unsubscribe link')
          }
        } else if (trackingToken && leadId && workspaceId) {
          // New tracking format
          const expectedToken = generateTrackingToken(`unsubscribe-${leadId}-${workspaceId}`)
          if (trackingToken !== expectedToken) {
            setError('Invalid or expired unsubscribe link')
            return
          }

          // Fetch lead info
          const { data: lead } = await supabase
            .from('leads')
            .select('email')
            .eq('id', leadId)
            .eq('workspace_id', workspaceId)
            .single()

          const { data: workspace } = await supabase
            .from('workspaces')
            .select('name')
            .eq('id', workspaceId)
            .single()

          if (lead && workspace) {
            setLeadInfo({ email: lead.email, workspace: workspace.name })
          } else {
            setError('Lead or workspace not found')
          }
        } else {
          setError('Missing required parameters')
        }

        if (managePrefs) {
          setManage(true)
        }
      } finally {
        setChecking(false)
      }
    }

    checkToken()
  }, [oldToken, trackingToken, leadId, workspaceId, managePrefs, supabase])

  const handleUnsubscribe = async () => {
    if (!leadInfo) {
      setError('Invalid unsubscribe link')
      return
    }

    setLoading(true)
    try {
      if (oldToken) {
        // Old format handling
        const decoded = JSON.parse(Buffer.from(oldToken, 'base64').toString())
        const { workspace: workspaceId, email } = decoded

        // Add to suppression list
        await supabase
          .from('suppression_list')
          .upsert({
            workspace_id: workspaceId,
            email,
            reason: reason || 'unsubscribe',
            source: 'link',
            metadata: { feedback },
          })

        // Update lead if exists
        await supabase
          .from('leads')
          .update({
            status: 'unsubscribed',
            custom_fields: {
              unsubscribed_at: new Date().toISOString(),
              unsubscribe_reason: reason,
              unsubscribe_feedback: feedback,
            },
          })
          .eq('email', email)
          .eq('workspace_id', workspaceId)
      } else if (leadId && workspaceId) {
        // New format handling
        // Update lead status
        await supabase
          .from('leads')
          .update({
            status: 'unsubscribed',
            custom_fields: {
              unsubscribed_at: new Date().toISOString(),
              unsubscribe_reason: reason,
              unsubscribe_feedback: feedback,
            },
          })
          .eq('id', leadId)
          .eq('workspace_id', workspaceId)

        // Record unsubscribe event
        await supabase
          .from('email_events')
          .insert({
            workspace_id: workspaceId,
            lead_id: leadId,
            email_id: emailId,
            event_type: 'unsubscribed',
            metadata: {
              reason,
              feedback,
              timestamp: new Date().toISOString(),
            },
          })

        // Add to suppression list
        await supabase
          .from('suppression_list')
          .insert({
            workspace_id: workspaceId,
            email: leadInfo.email,
            reason: reason || 'unsubscribe',
            source: 'link',
            metadata: { feedback },
          })
      }

      setUnsubscribed(true)
      toast.success('You have been unsubscribed successfully')
    } catch (err) {
      console.error('Unsubscribe error:', err)
      setError('Failed to unsubscribe. Please try again.')
      toast.error('Failed to unsubscribe')
    } finally {
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Processing your request...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (unsubscribed) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle2 className="h-6 w-6 text-green-600" />
          </div>
          <CardTitle>Unsubscribed Successfully</CardTitle>
          <CardDescription>
            {leadInfo?.email} has been removed from {leadInfo?.workspace}'s mailing list
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <Mail className="h-4 w-4" />
            <AlertDescription>
              You will no longer receive emails from this sender. If this was a mistake,
              you can contact the sender directly to re-subscribe.
            </AlertDescription>
          </Alert>
        </CardContent>
        <CardFooter className="flex justify-center">
          <p className="text-sm text-muted-foreground">
            This page can be closed safely
          </p>
        </CardFooter>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
            <XCircle className="h-6 w-6 text-red-600" />
          </div>
          <CardTitle>Unsubscribe Error</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>
              Please check your email for the correct link or contact support if you continue to have issues.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-muted flex items-center justify-center">
          <Mail className="h-6 w-6 text-muted-foreground" />
        </div>
        <CardTitle>
          {manage ? 'Manage Email Preferences' : 'Unsubscribe from Emails'}
        </CardTitle>
        <CardDescription>
          {manage 
            ? 'Choose which types of emails you want to receive'
            : `We're sorry to see you go. Tell us why you're unsubscribing from ${leadInfo?.workspace}.`
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!manage ? (
          <>
            <div className="space-y-3">
              <Label>Why are you unsubscribing?</Label>
              <RadioGroup value={reason} onValueChange={setReason}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="too_many" id="too_many" />
                  <Label htmlFor="too_many">Too many emails</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="not_relevant" id="not_relevant" />
                  <Label htmlFor="not_relevant">Content not relevant</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="never_signed_up" id="never_signed_up" />
                  <Label htmlFor="never_signed_up">I never signed up</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="other" id="other" />
                  <Label htmlFor="other">Other</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="feedback">Additional feedback (optional)</Label>
              <Textarea
                id="feedback"
                placeholder="Tell us how we can improve..."
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={3}
              />
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg bg-muted p-4">
              <div className="flex gap-3">
                <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">Email Preferences</p>
                  <p className="text-sm text-muted-foreground">
                    This feature is coming soon. For now, you can unsubscribe from all emails.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex gap-2">
        {manage ? (
          <>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setManage(false)}
            >
              Unsubscribe Instead
            </Button>
            <Button className="flex-1" disabled>
              Save Preferences
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => window.close()}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleUnsubscribe}
              disabled={loading || !reason}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Unsubscribing...
                </>
              ) : (
                'Unsubscribe'
              )}
            </Button>
          </>
        )}
      </CardFooter>
    </Card>
  )
}

export default function UnsubscribePage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Suspense fallback={
        <Card className="w-full max-w-md mx-auto">
          <CardContent className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      }>
        <UnsubscribeContent />
      </Suspense>
    </div>
  )
}