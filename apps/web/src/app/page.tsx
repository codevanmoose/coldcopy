import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowRight, CheckCircle2, Zap, Shield, TrendingUp, Users, Mail, Brain } from 'lucide-react'

// Enable ISR with 60 second revalidation
export const revalidate = 60

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Navigation */}
      <nav className="flex items-center justify-between p-6 lg:px-24 border-b">
        <div className="flex items-center space-x-2">
          <Mail className="h-8 w-8 text-blue-600" />
          <span className="text-2xl font-bold">ColdCopy</span>
        </div>
        <div className="flex items-center space-x-6">
          <Link href="/pricing" className="text-gray-600 hover:text-gray-900">
            Pricing
          </Link>
          <Link href="/login" className="text-gray-600 hover:text-gray-900">
            Login
          </Link>
          <Link href="/signup">
            <Button>Start Free Trial</Button>
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="flex-1 flex items-center justify-center px-6 lg:px-24 py-20 bg-gradient-to-b from-blue-50 to-white">
        <div className="max-w-6xl mx-auto text-center">
          <div className="inline-flex items-center px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-medium mb-6">
            <Zap className="h-4 w-4 mr-2" />
            AI-Powered • Multi-Channel • Enterprise Ready
          </div>
          
          <h1 className="text-5xl lg:text-7xl font-bold text-gray-900 mb-6">
            Turn Cold Outreach Into
            <span className="text-blue-600 block">Warm Conversations</span>
          </h1>
          
          <p className="text-xl lg:text-2xl text-gray-600 mb-8 max-w-3xl mx-auto">
            The only sales automation platform that writes personalized emails your prospects actually want to read. 
            Powered by GPT-4 and Claude.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Link href="/signup">
              <Button size="lg" className="text-lg px-8 py-6">
                Start Free 14-Day Trial
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/demo">
              <Button size="lg" variant="outline" className="text-lg px-8 py-6">
                Watch 3-Minute Demo
              </Button>
            </Link>
          </div>
          
          <div className="flex flex-wrap justify-center gap-6 text-sm text-gray-600">
            <div className="flex items-center">
              <CheckCircle2 className="h-5 w-5 text-green-500 mr-2" />
              No credit card required
            </div>
            <div className="flex items-center">
              <CheckCircle2 className="h-5 w-5 text-green-500 mr-2" />
              5 min setup
            </div>
            <div className="flex items-center">
              <CheckCircle2 className="h-5 w-5 text-green-500 mr-2" />
              Cancel anytime
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-12 bg-gray-50 border-y">
        <div className="max-w-6xl mx-auto px-6 lg:px-24">
          <div className="text-center mb-4">
            <p className="text-gray-600 font-medium">Trusted by 500+ high-growth companies</p>
          </div>
          <div className="flex flex-wrap justify-center items-center gap-8 opacity-60">
            {/* Placeholder for company logos */}
            <div className="text-2xl font-bold text-gray-400">TechCorp</div>
            <div className="text-2xl font-bold text-gray-400">SaaS Co</div>
            <div className="text-2xl font-bold text-gray-400">Growth Inc</div>
            <div className="text-2xl font-bold text-gray-400">Scale Up</div>
            <div className="text-2xl font-bold text-gray-400">Innovate</div>
          </div>
        </div>
      </section>

      {/* Key Benefits */}
      <section className="py-20 px-6 lg:px-24">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Why Top Sales Teams Choose ColdCopy
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Stop sending generic templates. Start having real conversations.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center p-8 rounded-xl hover:shadow-lg transition">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 text-blue-600 rounded-full mb-4">
                <Brain className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-semibold mb-3">AI That Actually Works</h3>
              <p className="text-gray-600">
                GPT-4 and Claude write emails that sound like you, not a robot. 
                87% average open rate across all industries.
              </p>
            </div>
            
            <div className="text-center p-8 rounded-xl hover:shadow-lg transition">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 text-green-600 rounded-full mb-4">
                <TrendingUp className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-semibold mb-3">10x Your Reply Rate</h3>
              <p className="text-gray-600">
                Smart personalization based on LinkedIn, company news, and intent signals. 
                Average 24% reply rate.
              </p>
            </div>
            
            <div className="text-center p-8 rounded-xl hover:shadow-lg transition">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-100 text-purple-600 rounded-full mb-4">
                <Users className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Multi-Channel Magic</h3>
              <p className="text-gray-600">
                Email + LinkedIn + Twitter in one workflow. 
                Meet prospects where they are, not where you want them to be.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-6 lg:px-24 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Everything You Need to Scale Outbound
            </h2>
            <p className="text-xl text-gray-600">
              From first touch to closed deal. All in one platform.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard 
              title="AI Email Writer"
              description="Generate personalized emails in seconds with GPT-4 and Claude"
            />
            <FeatureCard 
              title="Smart Sequences"
              description="Multi-step campaigns that stop when prospects reply"
            />
            <FeatureCard 
              title="Lead Enrichment"
              description="Find emails, phone numbers, and company insights automatically"
            />
            <FeatureCard 
              title="CRM Sync"
              description="Two-way sync with Salesforce, HubSpot, and Pipedrive"
            />
            <FeatureCard 
              title="Team Inbox"
              description="Collaborate on replies without stepping on toes"
            />
            <FeatureCard 
              title="Email Warm-up"
              description="Build sender reputation with our 10,000+ inbox network"
            />
            <FeatureCard 
              title="A/B Testing"
              description="Test subjects, copy, and send times automatically"
            />
            <FeatureCard 
              title="Deliverability Suite"
              description="Spam testing, domain monitoring, and inbox placement"
            />
            <FeatureCard 
              title="White Label"
              description="Custom domains and branding for agencies"
            />
          </div>
        </div>
      </section>

      {/* ROI Section */}
      <section className="py-20 px-6 lg:px-24">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-gray-900 mb-12">
            The Numbers Don't Lie
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8 mb-12">
            <div>
              <div className="text-5xl font-bold text-blue-600 mb-2">312%</div>
              <div className="text-gray-600">Average ROI in 90 days</div>
            </div>
            <div>
              <div className="text-5xl font-bold text-blue-600 mb-2">73%</div>
              <div className="text-gray-600">Less time spent on outreach</div>
            </div>
            <div>
              <div className="text-5xl font-bold text-blue-600 mb-2">4.2x</div>
              <div className="text-gray-600">More qualified meetings</div>
            </div>
          </div>
          
          <p className="text-lg text-gray-600 mb-8">
            Join 500+ companies that have transformed their sales process with ColdCopy
          </p>
          
          <Link href="/signup">
            <Button size="lg" className="text-lg px-8 py-6">
              Start Your Free Trial
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Security Badge */}
      <section className="py-12 px-6 lg:px-24 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-wrap justify-center items-center gap-8 text-gray-600">
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
      <section className="py-20 px-6 lg:px-24 bg-blue-600 text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-4">
            Ready to 10x Your Cold Outreach?
          </h2>
          <p className="text-xl mb-8 opacity-90">
            Join 500+ companies already closing more deals with less effort
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/signup">
              <Button size="lg" variant="secondary" className="text-lg px-8 py-6">
                Start Free Trial
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/pricing">
              <Button size="lg" variant="outline" className="text-lg px-8 py-6 text-white border-white hover:bg-white hover:text-blue-600">
                View Pricing
              </Button>
            </Link>
          </div>
          <p className="mt-6 text-sm opacity-75">
            No credit card required • 5 minute setup • Cancel anytime
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 lg:px-24 border-t">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <Mail className="h-6 w-6 text-blue-600" />
                <span className="text-xl font-bold">ColdCopy</span>
              </div>
              <p className="text-gray-600 text-sm">
                AI-powered cold outreach that converts.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><Link href="/features" className="hover:text-gray-900">Features</Link></li>
                <li><Link href="/pricing" className="hover:text-gray-900">Pricing</Link></li>
                <li><Link href="/integrations" className="hover:text-gray-900">Integrations</Link></li>
                <li><Link href="/api" className="hover:text-gray-900">API</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><Link href="/about" className="hover:text-gray-900">About</Link></li>
                <li><Link href="/blog" className="hover:text-gray-900">Blog</Link></li>
                <li><Link href="/careers" className="hover:text-gray-900">Careers</Link></li>
                <li><Link href="/contact" className="hover:text-gray-900">Contact</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><Link href="/privacy-policy" className="hover:text-gray-900">Privacy Policy</Link></li>
                <li><Link href="/terms-of-service" className="hover:text-gray-900">Terms of Service</Link></li>
                <li><Link href="/gdpr" className="hover:text-gray-900">GDPR</Link></li>
              </ul>
            </div>
          </div>
          
          <div className="pt-8 border-t text-center text-sm text-gray-600">
            <p>&copy; 2025 ColdCopy. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="p-6 bg-white rounded-lg border hover:shadow-md transition">
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-gray-600 text-sm">{description}</p>
    </div>
  )
}