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
  CreditCard,
  Webhook,
  Key,
  DollarSign
} from 'lucide-react'
import { toast } from 'sonner'

interface StripeSetupGuideProps {
  onConfigurationComplete?: () => void
}

export function StripeSetupGuide({ onConfigurationComplete }: StripeSetupGuideProps) {
  const [activeStep, setActiveStep] = useState(1)
  const [verificationStatus, setVerificationStatus] = useState({
    account: false,
    products: false,
    webhooks: false,
    testing: false,
  })

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast.success(`${label} copied to clipboard`)
  }

  const steps = [
    {
      id: 1,
      title: 'Stripe Account Setup',
      description: 'Create and configure Stripe account',
      completed: false,
    },
    {
      id: 2,
      title: 'Create Products & Prices',
      description: 'Set up subscription plans',
      completed: verificationStatus.products,
    },
    {
      id: 3,
      title: 'Configure Webhooks',
      description: 'Set up webhook endpoints',
      completed: verificationStatus.webhooks,
    },
    {
      id: 4,
      title: 'Test Integration',
      description: 'Verify billing works',
      completed: verificationStatus.testing,
    },
  ]

  const subscriptionPlans = [
    {
      name: 'Starter',
      price: '$29/month',
      features: ['5,000 emails/month', '1,000 leads', 'Basic analytics'],
    },
    {
      name: 'Professional',
      price: '$99/month', 
      features: ['25,000 emails/month', '10,000 leads', 'Advanced analytics', 'A/B testing'],
    },
    {
      name: 'Enterprise',
      price: '$299/month',
      features: ['100,000 emails/month', 'Unlimited leads', 'White-label', 'Priority support'],
    },
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Stripe Billing Setup Guide</h1>
        <p className="text-muted-foreground">
          Configure Stripe for subscription billing and payment processing
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

            {/* Step 1: Account Setup */}
            <TabsContent value="1" className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold">Stripe Account Setup</h3>
                </div>
                
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    You'll need a Stripe account to process payments. Stripe handles all PCI compliance and security.
                  </AlertDescription>
                </Alert>

                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center mt-0.5">1</div>
                    <div>
                      <p className="font-medium">Create Stripe Account</p>
                      <p className="text-sm text-muted-foreground">
                        Sign up at <Button variant="link" className="p-0 h-auto text-primary" asChild>
                          <a href="https://dashboard.stripe.com/register" target="_blank" rel="noopener noreferrer">
                            dashboard.stripe.com/register <ExternalLink className="h-3 w-3 ml-1" />
                          </a>
                        </Button>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center mt-0.5">2</div>
                    <div>
                      <p className="font-medium">Complete Account Setup</p>
                      <p className="text-sm text-muted-foreground">
                        Provide business information and bank account details for payouts
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center mt-0.5">3</div>
                    <div>
                      <p className="font-medium">Get API Keys</p>
                      <p className="text-sm text-muted-foreground">
                        Go to Developers → API keys and copy your keys
                      </p>
                      
                      <div className="mt-3 p-3 bg-muted rounded-lg font-mono text-sm">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span>STRIPE_SECRET_KEY=sk_test_...</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => copyToClipboard('STRIPE_SECRET_KEY=sk_test_...', 'Secret Key')}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => copyToClipboard('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...', 'Publishable Key')}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <Button onClick={() => setActiveStep(2)} className="w-full">
                  Continue to Products Setup
                </Button>
              </div>
            </TabsContent>

            {/* Step 2: Products & Prices */}
            <TabsContent value="2" className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold">Create Products & Prices</h3>
                </div>

                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Set up your subscription plans in Stripe. You'll need to create products and recurring prices.
                  </AlertDescription>
                </Alert>

                <div className="space-y-4">
                  <div>
                    <p className="font-medium mb-3">Recommended Pricing Structure:</p>
                    <div className="grid gap-4 md:grid-cols-3">
                      {subscriptionPlans.map((plan, index) => (
                        <Card key={index}>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-lg">{plan.name}</CardTitle>
                            <div className="text-2xl font-bold text-primary">{plan.price}</div>
                          </CardHeader>
                          <CardContent>
                            <ul className="space-y-1 text-sm">
                              {plan.features.map((feature, i) => (
                                <li key={i} className="flex items-center gap-2">
                                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                                  {feature}
                                </li>
                              ))}
                            </ul>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center mt-0.5">1</div>
                      <div>
                        <p className="font-medium">Create Products</p>
                        <p className="text-sm text-muted-foreground">
                          In Stripe Dashboard → Products → Add product. Create one for each plan.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center mt-0.5">2</div>
                      <div>
                        <p className="font-medium">Add Recurring Prices</p>
                        <p className="text-sm text-muted-foreground">
                          For each product, add both monthly and yearly prices
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center mt-0.5">3</div>
                      <div>
                        <p className="font-medium">Copy Price IDs</p>
                        <p className="text-sm text-muted-foreground">
                          Copy the price IDs and update your database subscription_plans table
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setActiveStep(1)}>
                    Previous
                  </Button>
                  <Button 
                    onClick={() => {
                      setVerificationStatus(prev => ({ ...prev, products: true }))
                      setActiveStep(3)
                    }} 
                    className="flex-1"
                  >
                    Products Created - Continue
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* Step 3: Webhooks */}
            <TabsContent value="3" className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Webhook className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold">Configure Webhooks</h3>
                </div>

                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Webhooks notify your application when payments succeed, subscriptions change, etc.
                  </AlertDescription>
                </Alert>

                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center mt-0.5">1</div>
                    <div>
                      <p className="font-medium">Create Webhook Endpoint</p>
                      <p className="text-sm text-muted-foreground mb-3">
                        In Stripe Dashboard → Developers → Webhooks → Add endpoint
                      </p>
                      
                      <div className="p-3 bg-muted rounded-lg font-mono text-sm">
                        <div className="flex items-center justify-between">
                          <span>https://yourdomain.com/api/webhooks/stripe</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard('https://yourdomain.com/api/webhooks/stripe', 'Webhook URL')}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center mt-0.5">2</div>
                    <div>
                      <p className="font-medium">Select Events</p>
                      <p className="text-sm text-muted-foreground mb-3">
                        Listen for these important events:
                      </p>
                      
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {[
                          'customer.subscription.created',
                          'customer.subscription.updated', 
                          'customer.subscription.deleted',
                          'invoice.payment_succeeded',
                          'invoice.payment_failed',
                          'customer.created',
                          'payment_method.attached',
                          'payment_intent.succeeded',
                        ].map((event) => (
                          <Badge key={event} variant="outline" className="text-xs">
                            {event}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center mt-0.5">3</div>
                    <div>
                      <p className="font-medium">Copy Webhook Secret</p>
                      <p className="text-sm text-muted-foreground mb-3">
                        Add to your environment variables:
                      </p>
                      
                      <div className="p-3 bg-muted rounded-lg font-mono text-sm">
                        <div className="flex items-center justify-between">
                          <span>STRIPE_WEBHOOK_SECRET=whsec_...</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard('STRIPE_WEBHOOK_SECRET=whsec_...', 'Webhook Secret')}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setActiveStep(2)}>
                    Previous
                  </Button>
                  <Button 
                    onClick={() => {
                      setVerificationStatus(prev => ({ ...prev, webhooks: true }))
                      setActiveStep(4)
                    }} 
                    className="flex-1"
                  >
                    Webhooks Configured - Continue
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* Step 4: Testing */}
            <TabsContent value="4" className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Key className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold">Test Integration</h3>
                </div>

                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription>
                    Your Stripe integration is ready! Test the subscription flow to verify everything works.
                  </AlertDescription>
                </Alert>

                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center mt-0.5">1</div>
                    <div>
                      <p className="font-medium">Test Subscription Creation</p>
                      <p className="text-sm text-muted-foreground">
                        Go to Settings → Billing and try upgrading to a paid plan
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center mt-0.5">2</div>
                    <div>
                      <p className="font-medium">Use Test Cards</p>
                      <p className="text-sm text-muted-foreground mb-3">
                        Use Stripe's test card numbers:
                      </p>
                      
                      <div className="space-y-2">
                        <div className="p-2 bg-muted rounded text-sm">
                          <strong>Success:</strong> 4242 4242 4242 4242
                        </div>
                        <div className="p-2 bg-muted rounded text-sm">
                          <strong>Declined:</strong> 4000 0000 0000 0002
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center mt-0.5">3</div>
                    <div>
                      <p className="font-medium">Verify Webhooks</p>
                      <p className="text-sm text-muted-foreground">
                        Check Stripe Dashboard → Webhooks → Your endpoint for successful deliveries
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center mt-0.5">4</div>
                    <div>
                      <p className="font-medium">Go Live</p>
                      <p className="text-sm text-muted-foreground">
                        When ready, replace test keys with live keys for production
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
                      setVerificationStatus(prev => ({ ...prev, testing: true }))
                      onConfigurationComplete?.()
                      toast.success('Stripe setup completed successfully!')
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
          <CardDescription>Track your progress through the Stripe setup process</CardDescription>
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