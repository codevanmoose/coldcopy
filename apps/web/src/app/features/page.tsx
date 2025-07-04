'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { 
  Mail, 
  Menu, 
  Zap, 
  Users, 
  Brain, 
  Shield, 
  Globe, 
  BarChart3, 
  Palette, 
  Workflow, 
  MessageSquare, 
  Calendar,
  Target,
  Sparkles,
  Lock,
  RefreshCw,
  CheckCircle2,
  ArrowRight
} from 'lucide-react'

export default function FeaturesPage() {
  const features = [
    {
      icon: Brain,
      title: 'Dual AI Email Writer',
      description: 'Leverage both GPT-4 and Claude to generate personalized emails that sound human, not robotic.',
      details: [
        'Switch between AI models for different writing styles',
        'Context-aware personalization from LinkedIn and company data',
        'Smart tone adjustment based on recipient profile',
        'Built-in spam score checker'
      ]
    },
    {
      icon: Users,
      title: 'Shared Team Inbox',
      description: 'Collaborate seamlessly with your team on all prospect conversations in one unified inbox.',
      details: [
        'Real-time collaboration with message threading',
        'Assign conversations to team members',
        'Internal notes and mentions',
        'Conversation history and context'
      ]
    },
    {
      icon: Globe,
      title: 'Multi-Channel Outreach',
      description: 'Reach prospects where they are with integrated email, LinkedIn, and Twitter campaigns.',
      details: [
        'Unified campaign across all channels',
        'Channel-specific message optimization',
        'Automatic channel switching based on response',
        'Cross-channel analytics'
      ]
    },
    {
      icon: Target,
      title: 'Lead Enrichment',
      description: 'Automatically enrich leads with data from multiple sources for better personalization.',
      details: [
        'Find verified email addresses',
        'Company technographics and insights',
        'Social media profiles and activity',
        'Intent signals and buying indicators'
      ]
    },
    {
      icon: Workflow,
      title: 'Smart Sequences',
      description: 'Create multi-step campaigns that adapt based on prospect behavior and engagement.',
      details: [
        'Conditional branching based on actions',
        'A/B testing for subject lines and content',
        'Automatic stop on reply or meeting booked',
        'Time zone optimized sending'
      ]
    },
    {
      icon: BarChart3,
      title: 'Advanced Analytics',
      description: 'Get deep insights into campaign performance with real-time analytics and reporting.',
      details: [
        'Campaign performance dashboards',
        'Reply sentiment analysis',
        'Team member performance metrics',
        'Custom report builder'
      ]
    },
    {
      icon: Shield,
      title: 'Enterprise Security',
      description: 'Bank-level security with GDPR compliance and advanced permission controls.',
      details: [
        'SOC 2 Type II compliant',
        'End-to-end encryption',
        'Role-based access control',
        'Audit logs and compliance reports'
      ]
    },
    {
      icon: Palette,
      title: 'White-Label Ready',
      description: 'Make ColdCopy your own with custom branding and client portals.',
      details: [
        'Custom domain and branding',
        'Client-specific workspaces',
        'Branded email templates',
        'API access for custom integrations'
      ]
    },
    {
      icon: RefreshCw,
      title: 'CRM Integration',
      description: 'Seamlessly sync with HubSpot, Salesforce, and other popular CRMs.',
      details: [
        'Two-way data synchronization',
        'Automatic activity logging',
        'Custom field mapping',
        'Deal and pipeline updates'
      ]
    }
  ]

  return (
    <div className="bg-black text-white font-light min-h-screen overflow-x-hidden">
      {/* Navigation */}
      <nav className="absolute top-0 w-full z-30 p-6">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <Link href="/" className="flex items-center space-x-2">
            <Mail className="h-8 w-8 text-white" />
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
      <section className="pt-32 pb-20 relative overflow-hidden">
        {/* Background elements */}
        <div className="absolute top-0 left-0 w-full h-full">
          <div className="absolute top-40 left-20 w-96 h-96 bg-violet-900/20 rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-indigo-900/20 rounded-full blur-3xl"></div>
        </div>
        
        <div className="container mx-auto px-6 relative z-10">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-sm text-white/90 mb-8">
              <Sparkles className="w-4 h-4 mr-2" />
              Everything you need to scale outbound
            </div>
            
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tighter mb-6">
              Features that make
              <span className="block bg-clip-text text-transparent bg-gradient-to-r from-violet-400 via-pink-400 to-cyan-400">
                cold outreach warm
              </span>
            </h1>
            
            <p className="text-xl md:text-2xl text-white/80 mb-12 leading-relaxed">
              From AI-powered personalization to enterprise-grade security, 
              we've built everything you need to turn prospects into customers.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
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
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 relative">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon
              return (
                <div
                  key={index}
                  className="group relative p-8 rounded-2xl bg-gradient-to-br from-gray-900/50 to-black border border-gray-800 hover:border-indigo-500/50 transition-all duration-300"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/0 to-purple-900/0 group-hover:from-indigo-900/10 group-hover:to-purple-900/10 rounded-2xl transition-all duration-300"></div>
                  
                  <div className="relative z-10">
                    <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                      <Icon className="w-7 h-7 text-white" />
                    </div>
                    
                    <h3 className="text-2xl font-semibold mb-3">{feature.title}</h3>
                    <p className="text-gray-400 mb-6">{feature.description}</p>
                    
                    <ul className="space-y-2">
                      {feature.details.map((detail, idx) => (
                        <li key={idx} className="flex items-start text-sm text-gray-300">
                          <CheckCircle2 className="w-4 h-4 text-indigo-400 mr-2 mt-0.5 flex-shrink-0" />
                          {detail}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Platform Benefits */}
      <section className="py-20 bg-gradient-to-b from-black to-gray-900/50">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
              Why teams choose ColdCopy
            </h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto">
              Built by salespeople, for salespeople. We know what it takes to book meetings.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-400 mb-2">
                87%
              </div>
              <p className="text-gray-400">Average open rate</p>
            </div>
            <div className="text-center">
              <div className="text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-400 mb-2">
                24%
              </div>
              <p className="text-gray-400">Average reply rate</p>
            </div>
            <div className="text-center">
              <div className="text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-orange-400 to-red-400 mb-2">
                3x
              </div>
              <p className="text-gray-400">More meetings booked</p>
            </div>
            <div className="text-center">
              <div className="text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-emerald-400 mb-2">
                72%
              </div>
              <p className="text-gray-400">Time saved on outreach</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-gradient-to-br from-indigo-900/20 via-purple-900/20 to-pink-900/20 blur-3xl"></div>
        </div>
        
        <div className="container mx-auto px-6 relative z-10">
          <div className="text-center max-w-3xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
              Ready to transform your outreach?
            </h2>
            <p className="text-xl text-gray-400 mb-12">
              Join thousands of teams booking more meetings with less effort.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link href="/signup">
                <Button className="bg-gradient-to-r from-orange-400 to-pink-400 hover:from-orange-500 hover:to-pink-500 text-white font-semibold px-8 py-6 text-lg rounded-full shadow-lg shadow-orange-500/25 transition-all duration-200 transform hover:scale-105">
                  Start 14-Day Free Trial
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/pricing">
                <Button variant="outline" className="px-8 py-6 bg-white/10 backdrop-blur-sm border border-white/20 text-white font-semibold hover:bg-white/20 transition-all duration-200 text-lg rounded-full">
                  View Pricing
                </Button>
              </Link>
            </div>
            
            <p className="text-sm text-gray-500 mt-8">
              No credit card required • Cancel anytime • GDPR compliant
            </p>
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