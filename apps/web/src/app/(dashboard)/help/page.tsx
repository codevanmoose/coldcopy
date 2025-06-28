import { Metadata } from 'next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SearchWidget } from '@/components/help/search-widget'
import { Badge } from '@/components/ui/badge'
import { 
  BookOpen, 
  Search, 
  Star, 
  ArrowRight,
  MessageSquare,
  Mail,
  Users,
  Target,
  BarChart3,
  Settings,
  Shield,
  Zap,
  HelpCircle
} from 'lucide-react'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Help Center | ColdCopy',
  description: 'Find answers, guides, and resources to master cold email outreach with ColdCopy',
}

const categories = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    description: 'Set up your account and send your first campaign',
    icon: BookOpen,
    color: 'bg-blue-500',
    articles: [
      { title: 'Quick Start Guide', time: '5 min read', popular: true },
      { title: 'Setting Up Your Workspace', time: '3 min read' },
      { title: 'Connecting Your Email Account', time: '4 min read' },
      { title: 'Importing Your First Leads', time: '3 min read' },
      { title: 'Creating Your First Campaign', time: '8 min read', popular: true }
    ]
  },
  {
    id: 'email-campaigns',
    title: 'Email Campaigns',
    description: 'Create effective cold email sequences',
    icon: Mail,
    color: 'bg-green-500',
    articles: [
      { title: 'Campaign Best Practices', time: '10 min read', popular: true },
      { title: 'Writing High-Converting Subject Lines', time: '6 min read', popular: true },
      { title: 'Personalization Strategies', time: '8 min read' },
      { title: 'Follow-up Sequences That Work', time: '12 min read' },
      { title: 'A/B Testing Your Emails', time: '7 min read' }
    ]
  },
  {
    id: 'lead-management',
    title: 'Lead Management',
    description: 'Import, organize, and manage your prospects',
    icon: Users,
    color: 'bg-purple-500',
    articles: [
      { title: 'CSV Import Guidelines', time: '4 min read' },
      { title: 'Lead Enrichment Features', time: '6 min read' },
      { title: 'Segmenting Your Audience', time: '5 min read' },
      { title: 'Managing Lead Lists', time: '4 min read' },
      { title: 'CRM Integration Setup', time: '8 min read' }
    ]
  },
  {
    id: 'ai-features',
    title: 'AI & Personalization',
    description: 'Leverage AI for better email content',
    icon: Zap,
    color: 'bg-yellow-500',
    articles: [
      { title: 'AI Email Generation Guide', time: '7 min read', popular: true },
      { title: 'Custom AI Prompts', time: '5 min read' },
      { title: 'Personalization Variables', time: '4 min read' },
      { title: 'AI Content Optimization', time: '6 min read' },
      { title: 'Token Usage and Limits', time: '3 min read' }
    ]
  },
  {
    id: 'analytics',
    title: 'Analytics & Reporting',
    description: 'Track performance and optimize results',
    icon: BarChart3,
    color: 'bg-red-500',
    articles: [
      { title: 'Understanding Your Metrics', time: '8 min read' },
      { title: 'Email Tracking Setup', time: '5 min read' },
      { title: 'Campaign Performance Analysis', time: '10 min read' },
      { title: 'Reply Management', time: '6 min read' },
      { title: 'Export and Reporting', time: '4 min read' }
    ]
  },
  {
    id: 'team-collaboration',
    title: 'Team Features',
    description: 'Collaborate with your team effectively',
    icon: Users,
    color: 'bg-indigo-500',
    articles: [
      { title: 'Inviting Team Members', time: '3 min read' },
      { title: 'Role Permissions Guide', time: '5 min read' },
      { title: 'Shared Team Inbox', time: '7 min read' },
      { title: 'Campaign Collaboration', time: '6 min read' },
      { title: 'Workspace Management', time: '8 min read' }
    ]
  },
  {
    id: 'deliverability',
    title: 'Email Deliverability',
    description: 'Ensure your emails reach the inbox',
    icon: Shield,
    color: 'bg-orange-500',
    articles: [
      { title: 'Deliverability Best Practices', time: '12 min read', popular: true },
      { title: 'DNS Configuration Guide', time: '8 min read' },
      { title: 'Avoiding Spam Filters', time: '10 min read' },
      { title: 'Warming Up Your Domain', time: '6 min read' },
      { title: 'Handling Bounces and Complaints', time: '7 min read' }
    ]
  },
  {
    id: 'integrations',
    title: 'Integrations',
    description: 'Connect with your favorite tools',
    icon: Settings,
    color: 'bg-gray-500',
    articles: [
      { title: 'HubSpot Integration', time: '6 min read' },
      { title: 'Salesforce Setup', time: '8 min read' },
      { title: 'Zapier Automations', time: '5 min read' },
      { title: 'Gmail and Outlook Setup', time: '4 min read' },
      { title: 'API Documentation', time: '15 min read' }
    ]
  }
]

const popularArticles = [
  {
    title: 'How to Write Cold Emails That Get Replies',
    category: 'Email Campaigns',
    time: '12 min read',
    views: '15.2k views'
  },
  {
    title: 'Complete Email Deliverability Guide',
    category: 'Deliverability',
    time: '15 min read',
    views: '12.8k views'
  },
  {
    title: 'AI Email Generation: Best Practices',
    category: 'AI Features',
    time: '8 min read',
    views: '11.4k views'
  },
  {
    title: 'Setting Up Your First Campaign',
    category: 'Getting Started',
    time: '10 min read',
    views: '18.6k views'
  }
]

export default function HelpCenterPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold tracking-tight mb-4">
          ColdCopy Help Center
        </h1>
        <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
          Everything you need to master cold email outreach and grow your business
        </p>
        
        {/* Search Bar */}
        <div className="max-w-md mx-auto">
          <SearchWidget 
            placeholder="Search help articles..."
            showPopular={true}
            maxResults={8}
          />
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-6 text-center">
            <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center mx-auto mb-4">
              <MessageSquare className="h-6 w-6 text-white" />
            </div>
            <h3 className="font-semibold mb-2">Contact Support</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Get help from our team within 24 hours
            </p>
            <Link href="/help/contact">
              <Button variant="outline" size="sm">
                Contact Us
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-6 text-center">
            <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center mx-auto mb-4">
              <BookOpen className="h-6 w-6 text-white" />
            </div>
            <h3 className="font-semibold mb-2">Getting Started Guide</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Complete setup in under 15 minutes
            </p>
            <Link href="/help/getting-started">
              <Button variant="outline" size="sm">
                Start Guide
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="border-purple-200 bg-purple-50">
          <CardContent className="p-6 text-center">
            <div className="w-12 h-12 bg-purple-500 rounded-lg flex items-center justify-center mx-auto mb-4">
              <Target className="h-6 w-6 text-white" />
            </div>
            <h3 className="font-semibold mb-2">Video Tutorials</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Watch step-by-step video guides
            </p>
            <Link href="/help/videos">
              <Button variant="outline" size="sm">
                Watch Videos
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Popular Articles */}
      <div className="mb-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Popular Articles</h2>
          <Link href="/help/popular">
            <Button variant="ghost" size="sm">
              View All
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {popularArticles.map((article, index) => (
            <Card key={index} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-3">
                  <Badge variant="secondary" className="text-xs">
                    {article.category}
                  </Badge>
                  <Star className="h-4 w-4 text-yellow-500 fill-current" />
                </div>
                <h3 className="font-semibold mb-2 line-clamp-2">
                  {article.title}
                </h3>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>{article.time}</span>
                  <span>{article.views}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Categories */}
      <div className="mb-12">
        <h2 className="text-2xl font-bold mb-6">Browse by Category</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map((category) => (
            <Card key={category.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center space-x-3">
                  <div className={`w-10 h-10 ${category.color} rounded-lg flex items-center justify-center`}>
                    <category.icon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{category.title}</CardTitle>
                    <CardDescription className="text-sm">
                      {category.description}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {category.articles.slice(0, 3).map((article, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 flex-1 min-w-0">
                        {article.popular && (
                          <Star className="h-3 w-3 text-yellow-500 fill-current flex-shrink-0" />
                        )}
                        <span className="text-sm truncate">{article.title}</span>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                        {article.time}
                      </span>
                    </div>
                  ))}
                  {category.articles.length > 3 && (
                    <div className="pt-2">
                      <Link href={`/help/${category.id}`}>
                        <Button variant="ghost" size="sm" className="w-full text-sm">
                          View All {category.articles.length} Articles
                          <ArrowRight className="h-3 w-3 ml-1" />
                        </Button>
                      </Link>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Contact Section */}
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50">
        <CardContent className="p-8 text-center">
          <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <HelpCircle className="h-8 w-8 text-white" />
          </div>
          <h3 className="text-2xl font-bold mb-4">Still Need Help?</h3>
          <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
            Can't find what you're looking for? Our support team is here to help you succeed with your cold outreach campaigns.
          </p>
          <div className="flex justify-center space-x-4">
            <Link href="/help/contact">
              <Button size="lg">
                Contact Support
                <MessageSquare className="h-4 w-4 ml-2" />
              </Button>
            </Link>
            <Link href="/help/community">
              <Button variant="outline" size="lg">
                Join Community
                <Users className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </div>
          
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-muted-foreground">
              <div>
                <strong>Response Time:</strong> Within 24 hours
              </div>
              <div>
                <strong>Support Hours:</strong> Mon-Fri 9AM-6PM EST
              </div>
              <div>
                <strong>Languages:</strong> English, Spanish, French
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}