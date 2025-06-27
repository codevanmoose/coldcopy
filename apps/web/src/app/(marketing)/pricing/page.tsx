'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const plans = [
  {
    name: 'Free',
    slug: 'free',
    description: 'Perfect for trying out ColdCopy',
    priceMonthly: 0,
    priceYearly: 0,
    features: [
      '100 emails per month',
      'Basic email templates',
      '1 workspace user',
      'Community support'
    ],
    limits: {
      emails_sent: 100,
      leads_enriched: 10,
      ai_tokens: 1000
    },
    cta: 'Get Started',
    ctaVariant: 'outline' as const,
    popular: false
  },
  {
    name: 'Starter',
    slug: 'starter',
    description: 'For individuals and small teams',
    priceMonthly: 29,
    priceYearly: 290,
    features: [
      '1,000 emails per month',
      'Advanced email templates',
      'Email tracking & analytics',
      '5 workspace users',
      'Email support',
      'Basic AI features'
    ],
    limits: {
      emails_sent: 1000,
      leads_enriched: 100,
      ai_tokens: 10000
    },
    cta: 'Start Free Trial',
    ctaVariant: 'outline' as const,
    popular: false
  },
  {
    name: 'Professional',
    slug: 'professional',
    description: 'For growing teams and businesses',
    priceMonthly: 99,
    priceYearly: 990,
    features: [
      '10,000 emails per month',
      'All email templates',
      'Advanced analytics',
      'A/B testing',
      '25 workspace users',
      'Priority support',
      'Advanced AI features',
      'CRM integrations'
    ],
    limits: {
      emails_sent: 10000,
      leads_enriched: 1000,
      ai_tokens: 100000
    },
    cta: 'Start Free Trial',
    ctaVariant: 'default' as const,
    popular: true
  },
  {
    name: 'Enterprise',
    slug: 'enterprise',
    description: 'For large organizations with custom needs',
    priceMonthly: 299,
    priceYearly: 2990,
    features: [
      'Unlimited emails',
      'Custom email templates',
      'Advanced analytics & reporting',
      'Unlimited A/B testing',
      'Unlimited workspace users',
      '24/7 phone support',
      'Custom AI training',
      'All integrations',
      'SSO & advanced security',
      'Dedicated account manager'
    ],
    limits: {
      emails_sent: null,
      leads_enriched: null,
      ai_tokens: null
    },
    cta: 'Contact Sales',
    ctaVariant: 'outline' as const,
    popular: false
  }
]

export default function PricingPage() {
  const [isYearly, setIsYearly] = useState(false)
  const router = useRouter()

  const handlePlanSelect = (planSlug: string) => {
    if (planSlug === 'enterprise') {
      // Redirect to contact sales form
      window.location.href = 'mailto:sales@coldcopy.ai?subject=Enterprise Plan Inquiry'
    } else {
      router.push(`/signup?plan=${planSlug}&billing=${isYearly ? 'yearly' : 'monthly'}`)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      {/* Header */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Simple, transparent pricing
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Choose the perfect plan for your cold email outreach needs
          </p>
          
          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-4 mb-8">
            <span className={cn(
              "text-sm font-medium",
              !isYearly && "text-gray-900",
              isYearly && "text-gray-500"
            )}>
              Monthly
            </span>
            <Switch
              checked={isYearly}
              onCheckedChange={setIsYearly}
              className="data-[state=checked]:bg-primary"
            />
            <span className={cn(
              "text-sm font-medium",
              isYearly && "text-gray-900",
              !isYearly && "text-gray-500"
            )}>
              Yearly
              <Badge variant="secondary" className="ml-2">
                Save 20%
              </Badge>
            </span>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-7xl mx-auto">
          {plans.map((plan) => {
            const price = isYearly ? plan.priceYearly : plan.priceMonthly
            const displayPrice = isYearly && price > 0 ? price / 12 : price
            
            return (
              <Card 
                key={plan.slug}
                className={cn(
                  "relative overflow-hidden transition-all duration-200 hover:shadow-lg",
                  plan.popular && "border-primary shadow-lg scale-105"
                )}
              >
                {plan.popular && (
                  <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-3 py-1 text-xs font-semibold rounded-bl-lg">
                    <Sparkles className="w-3 h-3 inline mr-1" />
                    Most Popular
                  </div>
                )}
                
                <CardHeader className="pb-6">
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <CardDescription className="mt-2">
                    {plan.description}
                  </CardDescription>
                </CardHeader>
                
                <CardContent className="pb-6">
                  <div className="mb-6">
                    <span className="text-4xl font-bold">
                      ${displayPrice}
                    </span>
                    <span className="text-gray-600 ml-2">
                      /{isYearly ? 'mo' : 'month'}
                    </span>
                    {isYearly && price > 0 && (
                      <div className="text-sm text-gray-500 mt-1">
                        ${price} billed annually
                      </div>
                    )}
                  </div>

                  <ul className="space-y-3">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start">
                        <Check className="h-5 w-5 text-green-500 mr-3 shrink-0 mt-0.5" />
                        <span className="text-sm text-gray-700">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>

                <CardFooter>
                  <Button
                    className="w-full"
                    variant={plan.ctaVariant}
                    onClick={() => handlePlanSelect(plan.slug)}
                  >
                    {plan.cta}
                  </Button>
                </CardFooter>
              </Card>
            )
          })}
        </div>

        {/* FAQ Section */}
        <div className="mt-24 max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">
            Frequently asked questions
          </h2>
          
          <div className="space-y-8">
            <div>
              <h3 className="text-lg font-semibold mb-2">
                Can I change plans later?
              </h3>
              <p className="text-gray-600">
                Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately, and we'll prorate any charges.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-2">
                What payment methods do you accept?
              </h3>
              <p className="text-gray-600">
                We accept all major credit cards (Visa, Mastercard, American Express) and ACH bank transfers for Enterprise plans.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-2">
                Do you offer a free trial?
              </h3>
              <p className="text-gray-600">
                Yes! All paid plans come with a 14-day free trial. No credit card required to start.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-2">
                What happens if I exceed my limits?
              </h3>
              <p className="text-gray-600">
                We'll notify you when you're approaching your limits. You can purchase additional tokens or upgrade your plan to continue using ColdCopy.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}