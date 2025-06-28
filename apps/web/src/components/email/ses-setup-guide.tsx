'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Copy, 
  ExternalLink,
  Shield,
  Mail,
  Server,
  Key
} from 'lucide-react'
import { toast } from 'sonner'

interface SESSetupGuideProps {
  onConfigurationComplete?: () => void
}

export function SESSetupGuide({ onConfigurationComplete }: SESSetupGuideProps) {
  const [activeStep, setActiveStep] = useState(1)
  const [verificationStatus, setVerificationStatus] = useState({
    domain: false,
    credentials: false,
    sending: false,
  })

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast.success(`${label} copied to clipboard`)
  }

  const steps = [
    {
      id: 1,
      title: 'AWS Account Setup',
      description: 'Create AWS account and access SES',
      completed: false,
    },
    {
      id: 2,
      title: 'Domain Verification',
      description: 'Verify your sending domain',
      completed: verificationStatus.domain,
    },
    {
      id: 3,
      title: 'Credentials Configuration',
      description: 'Set up AWS access keys',
      completed: verificationStatus.credentials,
    },
    {
      id: 4,
      title: 'Test Email Sending',
      description: 'Verify everything works',
      completed: verificationStatus.sending,
    },
  ]

  const dnsRecords = [
    {
      type: 'TXT',
      name: '_amazonses.yourdomain.com',
      value: 'verification-token-from-aws-console',
      purpose: 'Domain verification',
    },
    {
      type: 'TXT',
      name: 'yourdomain.com',
      value: 'v=spf1 include:amazonses.com ~all',
      purpose: 'SPF record for email authentication',
    },
    {
      type: 'TXT',
      name: '_dmarc.yourdomain.com',
      value: 'v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdomain.com',
      purpose: 'DMARC policy for email security',
    },
    {
      type: 'CNAME',
      name: 'selector1._domainkey.yourdomain.com',
      value: 'selector1.yourdomain.dkim.amazonses.com',
      purpose: 'DKIM signing key',
    },
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Amazon SES Setup Guide</h1>
        <p className="text-muted-foreground">
          Configure Amazon Simple Email Service for reliable email delivery
        </p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center">
            <div className="flex flex-col items-center space-y-2">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center cursor-pointer transition-colors ${
                  step.completed
                    ? 'bg-green-500 text-white'
                    : activeStep === step.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
                onClick={() => setActiveStep(step.id)}
              >
                {step.completed ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  <span className="text-sm font-medium">{step.id}</span>
                )}
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">{step.title}</p>
                <p className="text-xs text-muted-foreground">{step.description}</p>
              </div>
            </div>
            {index < steps.length - 1 && (
              <div className="w-24 h-0.5 bg-muted mx-4" />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <Card>
        <CardContent className="p-6">
          <Tabs value={activeStep.toString()} onValueChange={(v) => setActiveStep(parseInt(v))}>
            <TabsList className="grid w-full grid-cols-4">
              {steps.map((step) => (
                <TabsTrigger key={step.id} value={step.id.toString()}>
                  Step {step.id}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* Step 1: AWS Account Setup */}
            <TabsContent value="1" className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Server className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold">AWS Account Setup</h3>
                </div>
                
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    You'll need an AWS account with access to Amazon SES. New AWS accounts start in "sandbox mode" 
                    which limits sending to verified email addresses only.
                  </AlertDescription>
                </Alert>

                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center mt-0.5">1</div>
                    <div>
                      <p className="font-medium">Create AWS Account</p>
                      <p className="text-sm text-muted-foreground">
                        Sign up at <Button variant="link" className="p-0 h-auto text-primary" asChild>
                          <a href="https://aws.amazon.com/free" target="_blank" rel="noopener noreferrer">
                            aws.amazon.com/free <ExternalLink className="h-3 w-3 ml-1" />
                          </a>
                        </Button>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center mt-0.5">2</div>
                    <div>
                      <p className="font-medium">Navigate to Amazon SES</p>
                      <p className="text-sm text-muted-foreground">
                        Go to AWS Console → Services → Amazon Simple Email Service (SES)
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center mt-0.5">3</div>
                    <div>
                      <p className="font-medium">Choose Region</p>
                      <p className="text-sm text-muted-foreground">
                        Select a region close to your users. For global use, <Badge variant="secondary">us-east-1</Badge> is recommended.
                      </p>
                    </div>
                  </div>
                </div>

                <Button onClick={() => setActiveStep(2)} className="w-full">
                  Continue to Domain Verification
                </Button>
              </div>
            </TabsContent>

            {/* Step 2: Domain Verification */}
            <TabsContent value="2" className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold">Domain Verification</h3>
                </div>

                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Verify your domain to send emails from your custom domain. This improves deliverability and trust.
                  </AlertDescription>
                </Alert>

                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center mt-0.5">1</div>
                    <div>
                      <p className="font-medium">Add Domain in SES Console</p>
                      <p className="text-sm text-muted-foreground">
                        In SES Console, go to "Verified identities" → "Create identity" → "Domain"
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center mt-0.5">2</div>
                    <div>
                      <p className="font-medium">Configure DNS Records</p>
                      <p className="text-sm text-muted-foreground mb-3">
                        Add these DNS records to your domain:
                      </p>
                      
                      <div className="space-y-2">
                        {dnsRecords.map((record, index) => (
                          <div key={index} className="p-3 bg-muted rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">{record.type}</Badge>
                                <span className="text-sm font-medium">{record.purpose}</span>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => copyToClipboard(record.value, `${record.type} record`)}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                            <div className="text-xs space-y-1">
                              <div><span className="font-medium">Name:</span> {record.name}</div>
                              <div><span className="font-medium">Value:</span> {record.value}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center mt-0.5">3</div>
                    <div>
                      <p className="font-medium">Wait for Verification</p>
                      <p className="text-sm text-muted-foreground">
                        DNS propagation can take up to 72 hours. Check status in SES Console.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setActiveStep(1)}>
                    Previous
                  </Button>
                  <Button 
                    onClick={() => {
                      setVerificationStatus(prev => ({ ...prev, domain: true }))
                      setActiveStep(3)
                    }} 
                    className="flex-1"
                  >
                    Domain Verified - Continue
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* Step 3: Credentials Configuration */}
            <TabsContent value="3" className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Key className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold">AWS Credentials Configuration</h3>
                </div>

                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Create AWS access keys with SES permissions and configure them in your environment.
                  </AlertDescription>
                </Alert>

                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center mt-0.5">1</div>
                    <div>
                      <p className="font-medium">Create IAM User</p>
                      <p className="text-sm text-muted-foreground">
                        In AWS Console → IAM → Users → Create user → Attach "AmazonSESFullAccess" policy
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center mt-0.5">2</div>
                    <div>
                      <p className="font-medium">Generate Access Keys</p>
                      <p className="text-sm text-muted-foreground">
                        Click on the user → Security credentials → Create access key → Application running outside AWS
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center mt-0.5">3</div>
                    <div>
                      <p className="font-medium">Configure Environment Variables</p>
                      <p className="text-sm text-muted-foreground mb-3">
                        Add these to your .env.local file:
                      </p>
                      
                      <div className="p-3 bg-muted rounded-lg font-mono text-sm">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span>AWS_REGION=us-east-1</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => copyToClipboard('AWS_REGION=us-east-1', 'AWS Region')}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>AWS_ACCESS_KEY_ID=your_access_key_here</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => copyToClipboard('AWS_ACCESS_KEY_ID=your_access_key_here', 'Access Key ID')}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>AWS_SECRET_ACCESS_KEY=your_secret_key_here</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => copyToClipboard('AWS_SECRET_ACCESS_KEY=your_secret_key_here', 'Secret Access Key')}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>SES_CONFIGURATION_SET=coldcopy-events</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => copyToClipboard('SES_CONFIGURATION_SET=coldcopy-events', 'Configuration Set')}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center mt-0.5">4</div>
                    <div>
                      <p className="font-medium">Restart Development Server</p>
                      <p className="text-sm text-muted-foreground">
                        Stop and restart your development server to load the new environment variables.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setActiveStep(2)}>
                    Previous
                  </Button>
                  <Button 
                    onClick={() => {
                      setVerificationStatus(prev => ({ ...prev, credentials: true }))
                      setActiveStep(4)
                    }} 
                    className="flex-1"
                  >
                    Credentials Configured - Continue
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* Step 4: Test Email Sending */}
            <TabsContent value="4" className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold">Test Email Sending</h3>
                </div>

                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription>
                    Your SES configuration is ready! Test email sending to verify everything works correctly.
                  </AlertDescription>
                </Alert>

                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center mt-0.5">1</div>
                    <div>
                      <p className="font-medium">Configure Email Settings</p>
                      <p className="text-sm text-muted-foreground">
                        Go to Settings → Email and configure your sender name and email address.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center mt-0.5">2</div>
                    <div>
                      <p className="font-medium">Send Test Email</p>
                      <p className="text-sm text-muted-foreground">
                        Use the "Send Test Email" button to verify your configuration works.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center mt-0.5">3</div>
                    <div>
                      <p className="font-medium">Request Production Access</p>
                      <p className="text-sm text-muted-foreground">
                        If successful, request to move out of sandbox mode in SES Console → Account dashboard → Request production access.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setActiveStep(3)}>
                    Previous
                  </Button>
                  <Button 
                    onClick={() => {
                      setVerificationStatus(prev => ({ ...prev, sending: true }))
                      onConfigurationComplete?.()
                      toast.success('SES setup completed successfully!')
                    }} 
                    className="flex-1"
                  >
                    Setup Complete!
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Status Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Setup Status</CardTitle>
          <CardDescription>Track your progress through the SES setup process</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {steps.map((step) => (
              <div key={step.id} className="flex items-center gap-2">
                {step.completed ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-muted-foreground" />
                )}
                <div>
                  <p className="text-sm font-medium">{step.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {step.completed ? 'Completed' : 'Pending'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}