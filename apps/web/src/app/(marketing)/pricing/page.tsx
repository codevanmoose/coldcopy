'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Check, Mail, Menu } from 'lucide-react'

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
      yearlyPrice: 2870,
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
          <div className="flex items-center space-x-2">
            <Mail className="h-8 w-8 text-white" />
            <span className="text-xl font-bold text-white">ColdCopy</span>
          </div>
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
          <div className="flex items-center space-x-4">
            <Link href="/signup" className="hidden sm:block">
              <Button className="bg-gradient-to-r from-orange-400 to-pink-400 hover:from-orange-500 hover:to-pink-500 text-white font-semibold">
                Start Free Trial
              </Button>
            </Link>
            <button className="md:hidden text-white">
              <Menu className="w-6 h-6" />
            </button>
          </div>
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

      {/* Footer */}
      <footer className="bg-black border-t border-gray-800 py-12 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* Company */}
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <Mail className="h-6 w-6 text-white" />
                <span className="text-lg font-bold text-white">ColdCopy</span>
              </div>
              <p className="text-gray-400 font-extralight text-sm">
                AI-powered cold outreach that converts.
              </p>
            </div>
            
            {/* Product */}
            <div>
              <h4 className="text-white font-normal text-sm mb-4">Product</h4>
              <ul className="space-y-2">
                <li><Link href="/features" className="text-gray-400 hover:text-white text-sm font-extralight">Features</Link></li>
                <li><Link href="/pricing" className="text-gray-400 hover:text-white text-sm font-extralight">Pricing</Link></li>
                <li><Link href="/integrations" className="text-gray-400 hover:text-white text-sm font-extralight">Integrations</Link></li>
                <li><Link href="/api" className="text-gray-400 hover:text-white text-sm font-extralight">API</Link></li>
              </ul>
            </div>
            
            {/* Resources */}
            <div>
              <h4 className="text-white font-normal text-sm mb-4">Resources</h4>
              <ul className="space-y-2">
                <li><Link href="/blog" className="text-gray-400 hover:text-white text-sm font-extralight">Blog</Link></li>
                <li><Link href="/docs" className="text-gray-400 hover:text-white text-sm font-extralight">Documentation</Link></li>
                <li><Link href="/templates" className="text-gray-400 hover:text-white text-sm font-extralight">Templates</Link></li>
                <li><Link href="/support" className="text-gray-400 hover:text-white text-sm font-extralight">Support</Link></li>
              </ul>
            </div>
            
            {/* Legal */}
            <div>
              <h4 className="text-white font-normal text-sm mb-4">Legal</h4>
              <ul className="space-y-2">
                <li><Link href="/privacy" className="text-gray-400 hover:text-white text-sm font-extralight">Privacy Policy</Link></li>
                <li><Link href="/terms" className="text-gray-400 hover:text-white text-sm font-extralight">Terms of Service</Link></li>
                <li><Link href="/gdpr" className="text-gray-400 hover:text-white text-sm font-extralight">GDPR</Link></li>
                <li><Link href="/security" className="text-gray-400 hover:text-white text-sm font-extralight">Security</Link></li>
              </ul>
            </div>
          </div>
          
          <div className="mt-12 pt-8 border-t border-gray-800 flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-400 text-sm font-extralight">
              © 2025 ColdCopy. All rights reserved.
            </p>
            <div className="flex space-x-6 mt-4 md:mt-0">
              <Link href="#" className="text-gray-400 hover:text-white">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
                </svg>
              </Link>
              <Link href="#" className="text-gray-400 hover:text-white">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                </svg>
              </Link>
              <Link href="#" className="text-gray-400 hover:text-white">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path fillRule="evenodd" d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" clipRule="evenodd" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}