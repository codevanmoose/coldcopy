'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Check } from 'lucide-react'

export default function PricingPage() {
  const [isYearly, setIsYearly] = useState(false)

  const plans = [
    {
      name: 'Starter',
      description: 'Perfect for small teams getting started',
      monthlyPrice: 29,
      yearlyPrice: 279,
      features: [
        'Up to 500 emails/month',
        '50 AI email generations',
        '1 team member',
        'Basic email tracking',
        'Email support'
      ],
      cta: 'Start free trial',
      href: '/signup?plan=starter',
      featured: false
    },
    {
      name: 'Professional',
      description: 'Ideal for growing sales teams',
      monthlyPrice: 99,
      yearlyPrice: 950,
      features: [
        'Up to 5,000 emails/month',
        '500 AI email generations',
        '5 team members',
        'Advanced analytics',
        'CRM integrations',
        'LinkedIn integration',
        'Priority support'
      ],
      cta: 'Start free trial',
      href: '/signup?plan=pro',
      featured: true
    },
    {
      name: 'Enterprise',
      description: 'For large-scale organizations',
      monthlyPrice: 299,
      yearlyPrice: 2,870,
      features: [
        'Unlimited emails',
        'Unlimited AI generations',
        'Unlimited team members',
        'White-label options',
        'Custom integrations',
        'Dedicated account manager',
        '24/7 phone support',
        'SLA guarantee'
      ],
      cta: 'Contact sales',
      href: '/contact-sales',
      featured: false
    }
  ]

  return (
    <div className="bg-black text-white font-light min-h-screen">
      {/* Navigation */}
      <nav className="absolute top-0 w-full z-30 p-6">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <Link href="/" className="flex items-center space-x-2">
            <span className="text-xl font-bold text-white">ColdCopy</span>
          </Link>
          <div className="hidden md:flex space-x-8 text-white/80">
            <Link href="/pricing" className="hover:text-white transition-colors">
              Pricing
            </Link>
            <Link href="/features" className="hover:text-white transition-colors">
              Features
            </Link>
            <Link href="/login" className="hover:text-white transition-colors">
              Login
            </Link>
          </div>
          <Link href="/signup">
            <Button className="bg-gradient-to-r from-orange-400 to-pink-400 hover:from-orange-500 hover:to-pink-500 text-white font-semibold">
              Start Free Trial
            </Button>
          </Link>
        </div>
      </nav>

      {/* Pricing Section */}
      <section className="py-24 pt-32 bg-black relative overflow-hidden">
        {/* Background elements */}
        <div className="absolute top-40 left-20 w-96 h-96 bg-indigo-900/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-purple-900/20 rounded-full blur-3xl"></div>
        
        <div className="container mx-auto px-6 relative z-10">
          {/* Section Header */}
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-light tracking-tight mb-4">
              Simple, transparent <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">pricing</span>
            </h2>
            <p className="text-gray-300 text-xl max-w-2xl mx-auto font-extralight">
              Start with a 14-day free trial. No credit card required. Scale as you grow.
            </p>
          </div>
          
          {/* Pricing Toggle */}
          <div className="flex justify-center items-center mb-12">
            <span className={`mr-3 ${!isYearly ? 'text-white' : 'text-gray-400'}`}>Monthly</span>
            <button
              onClick={() => setIsYearly(!isYearly)}
              className="relative inline-block w-12 h-6 transition duration-200 ease-in-out rounded-full bg-gray-800"
            >
              <span
                className={`absolute left-0 w-6 h-6 transition duration-100 ease-in-out transform bg-indigo-500 rounded-full ${
                  isYearly ? 'translate-x-6' : ''
                }`}
              />
            </button>
            <span className={`ml-3 ${isYearly ? 'text-white' : 'text-gray-400'}`}>
              Yearly <span className="text-xs text-indigo-400">(Save 20%)</span>
            </span>
          </div>
          
          {/* Pricing Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`p-8 rounded-2xl border transition-all flex flex-col h-full relative ${
                  plan.featured
                    ? 'bg-gradient-to-br from-indigo-900/40 to-black border-indigo-500/30 hover:border-indigo-500/60'
                    : 'bg-gradient-to-br from-gray-900 to-black border-gray-800 hover:border-indigo-500/30'
                }`}
              >
                {plan.featured && (
                  <div className="absolute top-0 right-8 bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-xs font-normal px-3 py-1 rounded-b-md">
                    MOST POPULAR
                  </div>
                )}
                <div className="mb-8">
                  <h3 className="text-xl font-normal mb-2">{plan.name}</h3>
                  <p className="text-gray-400 font-extralight text-sm mb-4">{plan.description}</p>
                  <div className="flex items-baseline">
                    <span className="text-4xl font-light">
                      ${isYearly ? Math.floor(plan.yearlyPrice / 12) : plan.monthlyPrice}
                    </span>
                    <span className="text-gray-400 ml-2 font-extralight">/month</span>
                  </div>
                  {isYearly && (
                    <p className="text-sm text-gray-400 mt-1">
                      ${plan.yearlyPrice} billed annually
                    </p>
                  )}
                </div>
                <ul className="space-y-3 mb-8 flex-grow">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start text-gray-300 font-extralight">
                      <Check className="w-5 h-5 mr-2 text-indigo-400 flex-shrink-0 mt-0.5" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link href={plan.href} className="w-full">
                  <Button
                    className={`w-full font-light rounded-md px-6 py-3 transition-all ${
                      plan.featured
                        ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:opacity-90'
                        : 'bg-transparent border border-gray-700 hover:bg-white/5'
                    }`}
                  >
                    {plan.cta}
                  </Button>
                </Link>
              </div>
            ))}
          </div>
          
          {/* FAQ Section */}
          <div className="mt-24 max-w-3xl mx-auto">
            <h3 className="text-2xl font-light mb-8 text-center">Frequently asked questions</h3>
            
            <div className="space-y-6">
              <div className="border-b border-gray-800 pb-6">
                <h4 className="text-lg font-normal mb-2">Can I change my plan later?</h4>
                <p className="text-gray-400 font-extralight">
                  Yes, you can upgrade or downgrade your plan at any time. Changes will be reflected in your next billing cycle.
                </p>
              </div>
              
              <div className="border-b border-gray-800 pb-6">
                <h4 className="text-lg font-normal mb-2">Do you offer a free trial?</h4>
                <p className="text-gray-400 font-extralight">
                  Yes, we offer a 14-day free trial on all plans. No credit card required to start.
                </p>
              </div>
              
              <div className="border-b border-gray-800 pb-6">
                <h4 className="text-lg font-normal mb-2">What counts as an AI email generation?</h4>
                <p className="text-gray-400 font-extralight">
                  Each time you use AI to generate or rewrite an email counts as one generation. Editing and sending emails doesn't count.
                </p>
              </div>
              
              <div className="border-b border-gray-800 pb-6">
                <h4 className="text-lg font-normal mb-2">Can I white-label ColdCopy for my agency?</h4>
                <p className="text-gray-400 font-extralight">
                  Yes, white-label options are available on Enterprise plans. This includes custom domains, branding, and client portals.
                </p>
              </div>
              
              <div className="border-b border-gray-800 pb-6">
                <h4 className="text-lg font-normal mb-2">What CRM integrations do you support?</h4>
                <p className="text-gray-400 font-extralight">
                  We support HubSpot, Salesforce, Pipedrive, and more. Professional and Enterprise plans include all integrations.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}