import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { AnimatedGradient } from '@/components/ui/animated-gradient'
import { PlatformStats } from '@/components/platform-stats'
import { ArrowRight, CheckCircle2, Zap, Shield, TrendingUp, Users, Mail, Brain, Menu } from 'lucide-react'

// Enable ISR with 60 second revalidation
export const revalidate = 60

export default function Home() {
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
      <section className="relative min-h-screen overflow-hidden">
        {/* Animated Gradient Background */}
        <AnimatedGradient className="absolute inset-0" />
        
        {/* Dark overlay for better text readability */}
        <div className="absolute inset-0 bg-black/10"></div>
        
        {/* Hero Content */}
        <div className="relative z-30 flex items-center justify-center min-h-screen px-6">
          <div className="max-w-5xl mx-auto text-center">
            {/* Badge */}
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-sm text-white/90 mb-8 mt-16">
              <span className="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
              AI-Powered • Multi-Channel • Enterprise Ready
            </div>
            
            {/* Main Heading */}
            <h1 className="text-5xl md:text-7xl lg:text-8xl leading-tight font-bold text-white tracking-tighter mb-6">
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
                <Button className="bg-gradient-to-r from-orange-400 to-pink-400 hover:from-orange-500 hover:to-pink-500 transition-all duration-200 transform hover:scale-105 shadow-lg shadow-orange-500/25 font-semibold text-white px-8 py-4 text-lg">
                  Start Free Trial
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/demo">
                <Button variant="outline" className="px-8 py-4 bg-white/10 backdrop-blur-sm border border-white/20 text-white font-semibold hover:bg-white/20 transition-all duration-200 text-lg">
                  Watch Demo
                </Button>
              </Link>
            </div>
            
            {/* Features Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-all duration-300">
                <div className="w-12 h-12 bg-gradient-to-br from-violet-400 to-purple-500 rounded-lg mb-4 flex items-center justify-center">
                  <Zap className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-white font-semibold text-lg mb-2">AI That Actually Works</h3>
                <p className="text-white/70 text-sm">GPT-4 and Claude write emails that sound like you, not a robot. 87% average open rate.</p>
              </div>
              
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-all duration-300">
                <div className="w-12 h-12 bg-gradient-to-br from-pink-400 to-rose-500 rounded-lg mb-4 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-white font-semibold text-lg mb-2">10x Your Reply Rate</h3>
                <p className="text-white/70 text-sm">Smart personalization based on LinkedIn, company news, and intent signals. Average 24% reply rate.</p>
              </div>
              
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-all duration-300">
                <div className="w-12 h-12 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-lg mb-4 flex items-center justify-center">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-white font-semibold text-lg mb-2">Multi-Channel Magic</h3>
                <p className="text-white/70 text-sm">Email + LinkedIn + Twitter in one workflow. Meet prospects where they are.</p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Scroll Indicator */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-30">
          <div className="flex flex-col items-center text-white/60">
            <span className="text-sm mb-2">Scroll to explore</span>
            <div className="w-6 h-10 border-2 border-white/30 rounded-full flex justify-center">
              <div className="w-1 h-3 bg-white/60 rounded-full mt-2 animate-bounce"></div>
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

      {/* Features Grid */}
      <section className="py-20 px-6 lg:px-24 bg-gradient-to-b from-black to-gray-900">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">
              Everything You Need to Scale Outbound
            </h2>
            <p className="text-xl text-white/70">
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
            <Link href="/pricing">
              <Button variant="outline" className="border-white text-white hover:bg-white hover:text-purple-600 font-semibold px-8 py-4 text-lg">
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
                <li><Link href="/features" className="hover:text-white transition-colors">Features</Link></li>
                <li><Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link></li>
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