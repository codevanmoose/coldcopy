'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { 
  Download, Trash2, FileText, Key, Mail, 
  Shield, AlertCircle, CheckCircle2, Loader2,
  Clock, FileDown
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/use-user'
import { toast } from 'sonner'

type RequestType = 'export' | 'deletion' | 'access' | 'rectification'

interface DataRequestFormProps {
  onSuccess?: () => void
}

export function DataRequestForm({ onSuccess }: DataRequestFormProps) {
  const { user } = useUser()
  const [requestType, setRequestType] = useState<RequestType>('export')
  const [details, setDetails] = useState('')
  const [loading, setLoading] = useState(false)
  const [showVerification, setShowVerification] = useState(false)
  const [verificationCode, setVerificationCode] = useState('')
  const [requestId, setRequestId] = useState<string | null>(null)
  const supabase = createClient()

  const requestTypeInfo = {
    export: {
      icon: Download,
      title: 'Export Personal Data',
      description: 'Download a copy of all your personal data in a machine-readable format',
      timeframe: '3-5 business days',
    },
    deletion: {
      icon: Trash2,
      title: 'Delete Personal Data',
      description: 'Request permanent deletion of your account and all associated data',
      timeframe: '30 days',
    },
    access: {
      icon: Key,
      title: 'Access Information',
      description: 'Get detailed information about what personal data we hold about you',
      timeframe: '1-3 business days',
    },
    rectification: {
      icon: FileText,
      title: 'Correct Personal Data',
      description: 'Request correction or update of inaccurate personal information',
      timeframe: '1-2 business days',
    },
  }

  const handleSubmit = async () => {
    if (!user) {
      toast.error('Please log in to submit a data request')
      return
    }

    setLoading(true)
    try {
      // Create the request
      const { data, error } = await supabase
        .from('gdpr_requests')
        .insert({
          user_id: user.id,
          type: requestType,
          status: 'pending',
          details,
          metadata: {
            email: user.email,
            submitted_at: new Date().toISOString(),
          },
        })
        .select()
        .single()

      if (error) throw error

      setRequestId(data.id)

      // Send verification email
      const { error: emailError } = await supabase.functions.invoke('send-email', {
        body: {
          to: user.email,
          subject: 'Verify Your Data Request',
          template: 'gdpr-verification',
          data: {
            requestType: requestTypeInfo[requestType].title,
            verificationCode: data.verification_code,
          },
        },
      })

      if (emailError) throw emailError

      setShowVerification(true)
      toast.success('Request submitted! Check your email for verification.')
    } catch (error) {
      console.error('Error submitting request:', error)
      toast.error('Failed to submit request')
    } finally {
      setLoading(false)
    }
  }

  const handleVerification = async () => {
    if (!requestId || !verificationCode) return

    setLoading(true)
    try {
      const { error } = await supabase
        .from('gdpr_requests')
        .update({ 
          verified: true,
          status: 'processing',
        })
        .eq('id', requestId)
        .eq('verification_code', verificationCode)

      if (error) throw error

      toast.success('Request verified successfully!')
      setShowVerification(false)
      onSuccess?.()
      
      // Reset form
      setRequestType('export')
      setDetails('')
      setVerificationCode('')
      setRequestId(null)
    } catch (error) {
      console.error('Error verifying request:', error)
      toast.error('Invalid verification code')
    } finally {
      setLoading(false)
    }
  }

  const CurrentIcon = requestTypeInfo[requestType].icon

  return (
    <>
      <div className="space-y-6">
        {/* Request Type Selection */}
        <div>
          <Label className="text-base font-medium mb-3 block">Select Request Type</Label>
          <RadioGroup value={requestType} onValueChange={(value) => setRequestType(value as RequestType)}>
            <div className="grid gap-3">
              {Object.entries(requestTypeInfo).map(([key, info]) => {
                const Icon = info.icon
                return (
                  <div key={key} className="relative">
                    <RadioGroupItem value={key} id={key} className="peer sr-only" />
                    <Label
                      htmlFor={key}
                      className="flex items-start gap-3 p-4 rounded-lg border cursor-pointer hover:bg-muted/50 peer-checked:border-primary peer-checked:bg-primary/5"
                    >
                      <Icon className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div className="flex-1">
                        <p className="font-medium">{info.title}</p>
                        <p className="text-sm text-muted-foreground mt-1">{info.description}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            Processing time: {info.timeframe}
                          </span>
                        </div>
                      </div>
                    </Label>
                  </div>
                )
              })}
            </div>
          </RadioGroup>
        </div>

        {/* Additional Details */}
        <div>
          <Label htmlFor="details">Additional Information (Optional)</Label>
          <Textarea
            id="details"
            placeholder={
              requestType === 'rectification' 
                ? 'Please specify what information needs to be corrected...'
                : 'Provide any additional context for your request...'
            }
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            rows={4}
            className="mt-2"
          />
        </div>

        {/* Important Notice */}
        {requestType === 'deletion' && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Warning:</strong> Account deletion is permanent and cannot be undone. 
              All your data, including campaigns, leads, and settings will be permanently deleted.
            </AlertDescription>
          </Alert>
        )}

        {/* Submit Button */}
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            You will receive an email confirmation after submission
          </div>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <CurrentIcon className="mr-2 h-4 w-4" />
                Submit Request
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Verification Dialog */}
      <Dialog open={showVerification} onOpenChange={setShowVerification}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Verify Your Request</DialogTitle>
            <DialogDescription>
              We've sent a verification code to {user?.email}. Please enter it below to confirm your request.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="code">Verification Code</Label>
              <Input
                id="code"
                placeholder="Enter 6-digit code"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                maxLength={6}
              />
            </div>
            <Alert>
              <Mail className="h-4 w-4" />
              <AlertDescription>
                Check your email for the verification code. It may take a few minutes to arrive.
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowVerification(false)}>
              Cancel
            </Button>
            <Button onClick={handleVerification} disabled={loading || verificationCode.length !== 6}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                'Verify Request'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}