'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { loadStripe } from '@stripe/stripe-js'
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  CreditCard, 
  Plus, 
  MoreVertical, 
  Star,
  Trash2,
  Loader2,
  AlertCircle
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { PaymentMethod } from '@/lib/billing/types'

// Initialize Stripe
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

interface PaymentMethodManagerProps {
  workspaceId: string
  paymentMethods: PaymentMethod[]
  defaultPaymentMethodId?: string
}

interface PaymentMethodFormProps {
  workspaceId: string
  onSuccess: () => void
  onCancel: () => void
}

function PaymentMethodForm({ workspaceId, onSuccess, onCancel }: PaymentMethodFormProps) {
  const stripe = useStripe()
  const elements = useElements()
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [billingDetails, setBillingDetails] = useState({
    name: '',
    email: '',
  })

  const addPaymentMethod = useMutation({
    mutationFn: async ({ paymentMethodId }: { paymentMethodId: string }) => {
      const response = await fetch('/api/billing/payment-methods', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-workspace-id': workspaceId
        },
        body: JSON.stringify({
          paymentMethodId,
          setAsDefault: true
        })
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to add payment method')
      }
      
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-summary'] })
      onSuccess()
    },
    onError: (error: Error) => {
      setError(error.message)
    }
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!stripe || !elements) {
      return
    }

    setError(null)
    const cardElement = elements.getElement(CardElement)
    
    if (!cardElement) {
      return
    }

    // Create payment method
    const { error, paymentMethod } = await stripe.createPaymentMethod({
      type: 'card',
      card: cardElement,
      billing_details: billingDetails
    })

    if (error) {
      setError(error.message || 'An error occurred')
      return
    }

    if (paymentMethod) {
      addPaymentMethod.mutate({ paymentMethodId: paymentMethod.id })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="name">Cardholder Name</Label>
        <Input
          id="name"
          placeholder="John Doe"
          value={billingDetails.name}
          onChange={(e) => setBillingDetails({ ...billingDetails, name: e.target.value })}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="john@example.com"
          value={billingDetails.email}
          onChange={(e) => setBillingDetails({ ...billingDetails, email: e.target.value })}
          required
        />
      </div>

      <div className="space-y-2">
        <Label>Card Details</Label>
        <div className="p-3 border rounded-md">
          <CardElement
            options={{
              style: {
                base: {
                  fontSize: '16px',
                  color: '#424770',
                  '::placeholder': {
                    color: '#aab7c4',
                  },
                },
                invalid: {
                  color: '#9e2146',
                },
              },
            }}
          />
        </div>
      </div>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={addPaymentMethod.isPending}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={!stripe || addPaymentMethod.isPending}
        >
          {addPaymentMethod.isPending && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          Add Card
        </Button>
      </DialogFooter>
    </form>
  )
}

export function PaymentMethodManager({ 
  workspaceId, 
  paymentMethods, 
  defaultPaymentMethodId 
}: PaymentMethodManagerProps) {
  const queryClient = useQueryClient()
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [deleteMethodId, setDeleteMethodId] = useState<string | null>(null)

  // Set default payment method mutation
  const setDefaultMutation = useMutation({
    mutationFn: async (paymentMethodId: string) => {
      const response = await fetch(`/api/billing/payment-methods/${paymentMethodId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-workspace-id': workspaceId
        },
        body: JSON.stringify({
          setAsDefault: true
        })
      })
      
      if (!response.ok) throw new Error('Failed to update payment method')
      
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-summary'] })
    }
  })

  // Delete payment method mutation
  const deleteMutation = useMutation({
    mutationFn: async (paymentMethodId: string) => {
      const response = await fetch(`/api/billing/payment-methods/${paymentMethodId}`, {
        method: 'DELETE',
        headers: {
          'x-workspace-id': workspaceId
        }
      })
      
      if (!response.ok) throw new Error('Failed to delete payment method')
      
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-summary'] })
      setDeleteMethodId(null)
    }
  })

  const getCardBrandIcon = (brand: string | null) => {
    // In a real app, you'd have brand-specific icons
    return <CreditCard className="h-8 w-8" />
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Payment Methods</CardTitle>
              <CardDescription>
                Manage your saved payment methods
              </CardDescription>
            </div>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Payment Method
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {paymentMethods.length === 0 ? (
            <div className="text-center py-8">
              <CreditCard className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-4">
                No payment methods saved yet
              </p>
              <Button 
                variant="outline"
                onClick={() => setIsAddDialogOpen(true)}
              >
                Add Your First Card
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {paymentMethods.map((method) => (
                <div
                  key={method.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    {getCardBrandIcon(method.brand)}
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">
                          {method.brand} •••• {method.last4}
                        </p>
                        {method.id === defaultPaymentMethodId && (
                          <Badge variant="secondary">
                            <Star className="mr-1 h-3 w-3" />
                            Default
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Expires {method.expMonth}/{method.expYear}
                      </p>
                    </div>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {method.id !== defaultPaymentMethodId && (
                        <DropdownMenuItem
                          onClick={() => setDefaultMutation.mutate(method.id)}
                          disabled={setDefaultMutation.isPending}
                        >
                          <Star className="mr-2 h-4 w-4" />
                          Set as Default
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onClick={() => setDeleteMethodId(method.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Remove
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Payment Method Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Payment Method</DialogTitle>
            <DialogDescription>
              Add a new credit or debit card to your account
            </DialogDescription>
          </DialogHeader>
          
          <Elements stripe={stripePromise}>
            <PaymentMethodForm
              workspaceId={workspaceId}
              onSuccess={() => setIsAddDialogOpen(false)}
              onCancel={() => setIsAddDialogOpen(false)}
            />
          </Elements>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog 
        open={!!deleteMethodId} 
        onOpenChange={(open) => !open && setDeleteMethodId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Payment Method</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this payment method? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMethodId && deleteMutation.mutate(deleteMethodId)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}