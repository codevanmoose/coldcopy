'use client'

import { useState, useEffect } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { toast } from 'sonner'
import { Zap, Check, Loader2, CreditCard } from 'lucide-react'

// Initialize Stripe
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

interface TokenPackage {
  id: string
  name: string
  description: string
  tokens: number
  price_cents: number
  currency: string
  features: string[]
  is_popular: boolean
}

interface PurchaseTokensDialogProps {
  onSuccess?: (tokens: number) => void
  trigger?: React.ReactNode
}

function CheckoutForm({ 
  packageId, 
  onSuccess,
  onCancel,
}: { 
  packageId: string
  onSuccess: (tokens: number) => void
  onCancel: () => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [isProcessing, setIsProcessing] = useState(false)
  const [clientSecret, setClientSecret] = useState<string>('')
  const [purchaseId, setPurchaseId] = useState<string>('')
  const [tokenAmount, setTokenAmount] = useState<number>(0)
  const supabase = createClient()

  useEffect(() => {
    // Create payment intent
    const createPaymentIntent = async () => {
      try {
        const response = await fetch('/api/tokens/purchase', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ packageId }),
        })

        const data = await response.json()
        
        if (!response.ok) {
          throw new Error(data.error || 'Failed to create payment intent')
        }

        setClientSecret(data.clientSecret)
        setPurchaseId(data.purchaseId)
        setTokenAmount(data.tokens)
      } catch (error) {
        console.error('Payment intent error:', error)
        toast.error(error instanceof Error ? error.message : 'Failed to initialize payment')
        onCancel()
      }
    }

    createPaymentIntent()
  }, [packageId, onCancel])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!stripe || !elements || !clientSecret) {
      return
    }

    setIsProcessing(true)

    try {
      // Confirm payment
      const { error: paymentError, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
      })

      if (paymentError) {
        throw new Error(paymentError.message)
      }

      if (paymentIntent.status === 'succeeded') {
        // Confirm purchase on backend
        const response = await fetch('/api/tokens/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            purchaseId,
            paymentIntentId: paymentIntent.id,
          }),
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Failed to confirm purchase')
        }

        toast.success(`Successfully added ${tokenAmount.toLocaleString()} tokens!`)
        onSuccess(tokenAmount)
      }
    } catch (error) {
      console.error('Payment error:', error)
      toast.error(error instanceof Error ? error.message : 'Payment failed')
    } finally {
      setIsProcessing(false)
    }
  }

  if (!clientSecret) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement 
        options={{
          layout: 'tabs',
        }}
      />
      
      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isProcessing}
          className="flex-1"
        >
          Cancel
        </Button>
        <Button 
          type="submit" 
          disabled={!stripe || isProcessing}
          className="flex-1"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <CreditCard className="mr-2 h-4 w-4" />
              Complete Purchase
            </>
          )}
        </Button>
      </div>
    </form>
  )
}

export function PurchaseTokensDialog({ onSuccess, trigger }: PurchaseTokensDialogProps) {
  const [open, setOpen] = useState(false)
  const [selectedPackage, setSelectedPackage] = useState<string>('')
  const [showCheckout, setShowCheckout] = useState(false)
  const supabase = createClient()

  // Fetch token packages
  const { data: packages = [], isLoading } = useQuery({
    queryKey: ['token-packages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('token_packages')
        .select('*')
        .eq('is_active', true)
        .order('price_cents', { ascending: true })

      if (error) throw error
      return data as TokenPackage[]
    },
  })

  const handlePackageSelect = () => {
    if (selectedPackage) {
      setShowCheckout(true)
    }
  }

  const handleSuccess = (tokens: number) => {
    setOpen(false)
    setShowCheckout(false)
    setSelectedPackage('')
    if (onSuccess) {
      onSuccess(tokens)
    }
  }

  const handleCancel = () => {
    setShowCheckout(false)
  }

  const selectedPackageData = packages.find(p => p.id === selectedPackage)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <Zap className="mr-2 h-4 w-4" />
            Purchase Tokens
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {showCheckout ? 'Complete Your Purchase' : 'Purchase AI Tokens'}
          </DialogTitle>
          <DialogDescription>
            {showCheckout 
              ? `You're purchasing ${selectedPackageData?.tokens.toLocaleString()} tokens for $${((selectedPackageData?.price_cents || 0) / 100).toFixed(2)}`
              : 'Select a token package that fits your needs'
            }
          </DialogDescription>
        </DialogHeader>

        {!showCheckout ? (
          <div className="space-y-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : (
              <>
                <RadioGroup value={selectedPackage} onValueChange={setSelectedPackage}>
                  <div className="grid gap-4">
                    {packages.map((pkg) => (
                      <Card 
                        key={pkg.id} 
                        className={`cursor-pointer transition-colors ${
                          selectedPackage === pkg.id ? 'border-primary' : ''
                        }`}
                        onClick={() => setSelectedPackage(pkg.id)}
                      >
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <RadioGroupItem value={pkg.id} id={pkg.id} />
                              <div>
                                <CardTitle className="text-lg">
                                  {pkg.name}
                                  {pkg.is_popular && (
                                    <Badge className="ml-2" variant="secondary">
                                      Popular
                                    </Badge>
                                  )}
                                </CardTitle>
                                <CardDescription>{pkg.description}</CardDescription>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-2xl font-bold">
                                ${(pkg.price_cents / 100).toFixed(2)}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {pkg.tokens.toLocaleString()} tokens
                              </p>
                            </div>
                          </div>
                        </CardHeader>
                        {pkg.features.length > 0 && (
                          <CardContent>
                            <div className="flex flex-wrap gap-2">
                              {pkg.features.map((feature, i) => (
                                <div key={i} className="flex items-center gap-1 text-sm">
                                  <Check className="h-3 w-3 text-green-600" />
                                  <span>{feature}</span>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        )}
                      </Card>
                    ))}
                  </div>
                </RadioGroup>

                <Alert>
                  <Zap className="h-4 w-4" />
                  <AlertDescription>
                    Tokens never expire and can be used for AI email generation, lead enrichment,
                    and other AI-powered features. 1 email ≈ 250 tokens.
                  </AlertDescription>
                </Alert>

                <div className="flex justify-end">
                  <Button 
                    onClick={handlePackageSelect}
                    disabled={!selectedPackage}
                  >
                    Continue to Payment
                  </Button>
                </div>
              </>
            )}
          </div>
        ) : (
          <Elements
            stripe={stripePromise}
            options={{
              clientSecret: '',
              appearance: {
                theme: 'stripe',
              },
            }}
          >
            <CheckoutForm
              packageId={selectedPackage}
              onSuccess={handleSuccess}
              onCancel={handleCancel}
            />
          </Elements>
        )}
      </DialogContent>
    </Dialog>
  )
}