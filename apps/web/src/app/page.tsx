'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { AnimatedGradient } from '@/components/ui/animated-gradient'
import { PlatformStats } from '@/components/platform-stats'
import { 
  ArrowRight, 
  CheckCircle2, 
  Check,
  Zap, 
  Shield, 
  TrendingUp, 
  Users, 
  Mail, 
  Brain, 
  Menu,
  Globe,
  BarChart3,
  Palette,
  Workflow,
  MessageSquare,
  Target,
  RefreshCw,
  Lock
} from 'lucide-react'

export default function Home() {
  const [isYearly, setIsYearly] = useState(true)
  
  const scrollToSection = (sectionId: string) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' })
  }
  
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
    <div className="bg-black font-['Inter'] overflow-x-hidden">
      {/* Navigation */}
      <nav className="absolute top-0 w-full z-30 p-6">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Mail className="h-8 w-8 text-white" />
            <span className="text-xl font-bold text-white">ColdCopy</span>
          </div>
          <div className="hidden md:flex space-x-8 text-white/80">
            <button onClick={() => scrollToSection('pricing')} className="hover:text-white transition-colors">
              Pricing
            </button>
            <button onClick={() => scrollToSection('features')} className="hover:text-white transition-colors">
              Features
            </button>
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

      {/* Hero Section */}
      <section className="relative min-h-screen overflow-hidden">
        {/* Animated Gradient Background */}
        <AnimatedGradient />
        
        {/* Dark overlay for better text readability */}
        <div className="absolute inset-0 bg-black/20"></div>
        
        {/* Hero Content */}
        <div className="relative z-20 flex items-center justify-center min-h-screen px-6 pt-24">
          <div className="max-w-5xl mx-auto text-center">
            {/* Badge */}
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-sm text-white/90 mb-8">
              <span className="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
              AI-Powered • Multi-Channel • Enterprise Ready
            </div>
            
            {/* Main Heading */}
            <h1 className="md:text-7xl lg:text-8xl leading-tight text-5xl font-bold text-white tracking-tighter mb-6 py-0">
              Turn Cold Outreach Into
              <span className="block bg-clip-text text-transparent bg-gradient-to-r from-violet-400 via-pink-400 to-cyan-400 pb-2">
                Warm Conversations
              </span>
            </h1>
            
            {/* Subheading */}
            <p className="text-xl md:text-2xl text-white/80 mb-12 max-w-3xl mx-auto leading-relaxed">
              The only sales automation platform that writes personalized emails your prospects actually want to read. 
              Powered by GPT-4 and Claude.
            </p>
            
            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
              <Link href="/signup">
                <Button className="bg-gradient-to-r from-orange-400 to-pink-400 hover:from-orange-500 hover:to-pink-500 text-white font-semibold px-8 py-6 text-lg rounded-full shadow-lg shadow-orange-500/25 transition-all duration-200 transform hover:scale-105">
                  Start Free Trial
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/demo">
                <Button variant="outline" className="px-8 py-6 bg-white/10 backdrop-blur-sm border border-white/20 text-white font-semibold hover:bg-white/20 transition-all duration-200 text-lg rounded-full">
                  Watch Demo
                </Button>
              </Link>
            </div>
            
            {/* Features Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-all duration-300">
                <div className="w-12 h-12 bg-gradient-to-br from-violet-400 to-purple-500 rounded-lg mb-4 flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                  </svg>
                </div>
                <h3 className="text-white font-semibold text-lg mb-2">Lightning Fast</h3>
                <p className="text-white/70 text-sm">AI generates personalized emails in seconds. 87% average open rate across industries.</p>
              </div>
              
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-all duration-300">
                <div className="w-12 h-12 bg-gradient-to-br from-pink-400 to-rose-500 rounded-lg mb-4 flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                </div>
                <h3 className="text-white font-semibold text-lg mb-2">Secure & Reliable</h3>
                <p className="text-white/70 text-sm">Enterprise-grade security with GDPR compliance. Your data is always protected.</p>
              </div>
              
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-all duration-300">
                <div className="w-12 h-12 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-lg mb-4 flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path>
                  </svg>
                </div>
                <h3 className="text-white font-semibold text-lg mb-2">User Focused</h3>
                <p className="text-white/70 text-sm">Intuitive interface that your team will love. No training required.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Key Benefits */}
      <section className="py-20 px-6 lg:px-24 bg-black">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">
              Why Top Sales Teams Choose ColdCopy
            </h2>
            <p className="text-xl text-white/70 max-w-3xl mx-auto">
              Stop sending generic templates. Start having real conversations.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center p-8 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/10 transition">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full mb-4">
                <Brain className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-white">AI That Actually Works</h3>
              <p className="text-white/70">
                GPT-4 and Claude write emails that sound like you, not a robot. 
                87% average open rate across all industries.
              </p>
            </div>
            
            <div className="text-center p-8 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/10 transition">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-green-400 to-green-600 rounded-full mb-4">
                <TrendingUp className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-white">10x Your Reply Rate</h3>
              <p className="text-white/70">
                Smart personalization based on LinkedIn, company news, and intent signals. 
                Average 24% reply rate.
              </p>
            </div>
            
            <div className="text-center p-8 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/10 transition">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-400 to-purple-600 rounded-full mb-4">
                <Users className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-white">Multi-Channel Magic</h3>
              <p className="text-white/70">
                Email + LinkedIn + Twitter in one workflow. 
                Meet prospects where they are, not where you want them to be.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-6 lg:px-24 bg-gradient-to-b from-black to-gray-900">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Everything You Need to Scale Outbound
            </h2>
            <p className="text-xl text-white/70 max-w-3xl mx-auto">
              From first touch to closed deal. All in one platform.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <FeatureDetailCard
              icon={Brain}
              title="Dual AI Email Writer"
              description="Leverage both GPT-4 and Claude to generate personalized emails that sound human, not robotic."
              features={[
                'Switch between AI models for different writing styles',
                'Context-aware personalization from LinkedIn and company data',
                'Smart tone adjustment based on recipient profile',
                'Built-in spam score checker'
              ]}
            />
            <FeatureDetailCard
              icon={Users}
              title="Shared Team Inbox"
              description="Collaborate seamlessly with your team on all prospect conversations in one unified inbox."
              features={[
                'Real-time collaboration with message threading',
                'Assign conversations to team members',
                'Internal notes and mentions',
                'Conversation history and context'
              ]}
            />
            <FeatureDetailCard
              icon={Globe}
              title="Multi-Channel Outreach"
              description="Reach prospects where they are with integrated email, LinkedIn, and Twitter campaigns."
              features={[
                'Unified campaign across all channels',
                'Channel-specific message optimization',
                'Automatic channel switching based on response',
                'Cross-channel analytics'
              ]}
            />
            <FeatureDetailCard
              icon={Target}
              title="Lead Enrichment"
              description="Automatically enrich leads with data from multiple sources for better personalization."
              features={[
                'Find verified email addresses',
                'Company technographics and insights',
                'Social media profiles and activity',
                'Intent signals and buying indicators'
              ]}
            />
            <FeatureDetailCard
              icon={Workflow}
              title="Smart Sequences"
              description="Create multi-step campaigns that adapt based on prospect behavior and engagement."
              features={[
                'Conditional branching based on actions',
                'A/B testing for subject lines and content',
                'Automatic stop on reply or meeting booked',
                'Time zone optimized sending'
              ]}
            />
            <FeatureDetailCard
              icon={BarChart3}
              title="Advanced Analytics"
              description="Get deep insights into campaign performance with real-time analytics and reporting."
              features={[
                'Campaign performance dashboards',
                'Reply sentiment analysis',
                'Team member performance metrics',
                'Custom report builder'
              ]}
            />
            <FeatureDetailCard
              icon={Shield}
              title="Enterprise Security"
              description="Bank-level security with GDPR compliance and advanced permission controls."
              features={[
                'SOC 2 Type II compliant',
                'End-to-end encryption',
                'Role-based access control',
                'Audit logs and compliance reports'
              ]}
            />
            <FeatureDetailCard
              icon={Palette}
              title="White-Label Ready"
              description="Make ColdCopy your own with custom branding and client portals."
              features={[
                'Custom domain and branding',
                'Client-specific workspaces',
                'Branded email templates',
                'API access for custom integrations'
              ]}
            />
            <FeatureDetailCard
              icon={RefreshCw}
              title="CRM Integration"
              description="Seamlessly sync with HubSpot, Salesforce, and other popular CRMs."
              features={[
                'Two-way data synchronization',
                'Automatic activity logging',
                'Custom field mapping',
                'Deal and pipeline updates'
              ]}
            />
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-6 lg:px-24 bg-black relative overflow-hidden">
        {/* Background elements */}
        <div className="absolute top-40 left-20 w-96 h-96 bg-indigo-900/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-purple-900/20 rounded-full blur-3xl"></div>
        
        <div className="max-w-7xl mx-auto relative z-10">
          {/* Section Header */}
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
              Simple, transparent <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">pricing</span>
            </h2>
            <p className="text-gray-300 text-xl max-w-2xl mx-auto">
              Start with a 14-day free trial. No credit card required. Scale as you grow.
            </p>
          </div>
          
          {/* Pricing Toggle */}
          <div className="flex justify-center items-center mb-12">
            <span className={`mr-3 ${!isYearly ? 'text-white' : 'text-gray-400'}`}>Monthly</span>
            <button
              onClick={() => setIsYearly(!isYearly)}
              className="relative inline-flex items-center w-14 h-7 transition duration-200 ease-in-out rounded-full bg-gray-800"
            >
              <span
                className={`absolute w-5 h-5 transition duration-100 ease-in-out transform bg-indigo-500 rounded-full ${
                  isYearly ? 'translate-x-7' : 'translate-x-1'
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
                  <div className="absolute top-0 right-8 bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-xs font-semibold px-3 py-1 rounded-b-md">
                    MOST POPULAR
                  </div>
                )}
                <div className="mb-8">
                  <h3 className="text-xl font-semibold mb-2">{plan.name}</h3>
                  <p className="text-gray-400 text-sm mb-4">{plan.description}</p>
                  <div className="flex items-baseline">
                    <span className="text-4xl font-bold">
                      ${isYearly ? Math.floor(plan.yearlyPrice / 12) : plan.monthlyPrice}
                    </span>
                    <span className="text-gray-400 ml-2">/month</span>
                  </div>
                  {isYearly && (
                    <p className="text-sm text-gray-400 mt-1">
                      ${plan.yearlyPrice} billed annually
                    </p>
                  )}
                </div>
                <ul className="space-y-3 mb-8 flex-grow">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start text-gray-300">
                      <Check className="w-5 h-5 mr-2 text-indigo-400 flex-shrink-0 mt-0.5" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link href={plan.href} className="w-full">
                  <Button
                    className={`w-full font-semibold rounded-md px-6 py-3 transition-all ${
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
        </div>
      </section>

      {/* ROI Section */}
      <section className="py-20 px-6 lg:px-24 bg-black">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-white mb-12">
            The Numbers Don't Lie
          </h2>
          
          <PlatformStats />
        </div>
      </section>

      {/* Security Badge */}
      <section className="py-12 px-6 lg:px-24 bg-white/5 backdrop-blur-sm border-y border-white/10">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-wrap justify-center items-center gap-8 text-white/60">
            <div className="flex items-center">
              <Shield className="h-5 w-5 mr-2" />
              SOC 2 Compliant
            </div>
            <div className="flex items-center">
              <Shield className="h-5 w-5 mr-2" />
              GDPR Compliant
            </div>
            <div className="flex items-center">
              <Shield className="h-5 w-5 mr-2" />
              256-bit Encryption
            </div>
            <div className="flex items-center">
              <Shield className="h-5 w-5 mr-2" />
              99.9% Uptime SLA
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 lg:px-24 bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-4">
            Ready to 10x Your Cold Outreach?
          </h2>
          <p className="text-xl mb-8 opacity-90">
            Join 500+ companies already closing more deals with less effort
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/signup">
              <Button className="bg-white text-purple-600 hover:bg-gray-100 font-semibold px-8 py-4 text-lg">
                Start Free Trial
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Button 
              onClick={() => scrollToSection('pricing')}
              variant="outline" 
              className="border-white text-white hover:bg-white hover:text-purple-600 font-semibold px-8 py-4 text-lg cursor-pointer"
            >
              View Pricing
            </Button>
          </div>
          <p className="mt-6 text-sm opacity-75">
            No credit card required • 5 minute setup • Cancel anytime
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 lg:px-24 border-t border-white/10 bg-black">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <Mail className="h-6 w-6 text-violet-400" />
                <span className="text-xl font-bold text-white">ColdCopy</span>
              </div>
              <p className="text-white/60 text-sm">
                AI-powered cold outreach that converts.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4 text-white">Product</h4>
              <ul className="space-y-2 text-sm text-white/60">
                <li><button onClick={() => scrollToSection('features')} className="hover:text-white transition-colors">Features</button></li>
                <li><button onClick={() => scrollToSection('pricing')} className="hover:text-white transition-colors">Pricing</button></li>
                <li><Link href="/integrations" className="hover:text-white transition-colors">Integrations</Link></li>
                <li><Link href="/api" className="hover:text-white transition-colors">API</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4 text-white">Company</h4>
              <ul className="space-y-2 text-sm text-white/60">
                <li><Link href="/about" className="hover:text-white transition-colors">About</Link></li>
                <li><Link href="/blog" className="hover:text-white transition-colors">Blog</Link></li>
                <li><Link href="/careers" className="hover:text-white transition-colors">Careers</Link></li>
                <li><Link href="/contact" className="hover:text-white transition-colors">Contact</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4 text-white">Legal</h4>
              <ul className="space-y-2 text-sm text-white/60">
                <li><Link href="/privacy-policy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
                <li><Link href="/terms-of-service" className="hover:text-white transition-colors">Terms of Service</Link></li>
                <li><Link href="/gdpr" className="hover:text-white transition-colors">GDPR</Link></li>
              </ul>
            </div>
          </div>
          
          <div className="pt-8 border-t border-white/10 text-center text-sm text-white/60">
            <p>&copy; 2025 ColdCopy. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="p-6 bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg hover:bg-white/10 transition">
      <h3 className="text-lg font-semibold mb-2 text-white">{title}</h3>
      <p className="text-white/70 text-sm">{description}</p>
    </div>
  )
}

function FeatureDetailCard({ 
  icon: Icon, 
  title, 
  description, 
  features 
}: { 
  icon: any; 
  title: string; 
  description: string;
  features: string[];
}) {
  return (
    <div className="group relative p-8 rounded-2xl bg-gradient-to-br from-gray-900/50 to-black border border-gray-800 hover:border-indigo-500/50 transition-all duration-300">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/0 to-purple-900/0 group-hover:from-indigo-900/10 group-hover:to-purple-900/10 rounded-2xl transition-all duration-300"></div>
      
      <div className="relative z-10">
        <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
          <Icon className="w-7 h-7 text-white" />
        </div>
        
        <h3 className="text-2xl font-semibold mb-3 text-white">{title}</h3>
        <p className="text-gray-400 mb-6">{description}</p>
        
        <ul className="space-y-2">
          {features.map((feature, idx) => (
            <li key={idx} className="flex items-start text-sm text-gray-300">
              <CheckCircle2 className="w-4 h-4 text-indigo-400 mr-2 mt-0.5 flex-shrink-0" />
              {feature}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}