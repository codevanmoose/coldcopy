import { Metadata } from 'next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { 
  ArrowLeft,
  Target,
  Mail,
  TrendingUp,
  Users,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Lightbulb,
  BarChart3,
  MessageSquare,
  Shield
} from 'lucide-react'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Cold Email Best Practices | ColdCopy Help',
  description: 'Master cold email outreach with proven strategies, templates, and techniques that drive results',
}

const bestPractices = [
  {
    category: 'Email Content',
    icon: Mail,
    color: 'bg-blue-500',
    practices: [
      {
        title: 'Keep Subject Lines Under 50 Characters',
        description: 'Shorter subject lines perform better on mobile devices and avoid truncation.',
        good: '"{First Name}, quick question about {Company}"',
        bad: '"I hope this email finds you well and I wanted to reach out regarding our amazing new product that could revolutionize your business"',
        impact: '+23% open rate improvement'
      },
      {
        title: 'Personalize Beyond First Name',
        description: 'Use company-specific details, recent news, or mutual connections.',
        good: '"Saw your recent Series A announcement - congrats on the $5M raise!"',
        bad: '"Hi {First Name}, hope you\'re having a great day."',
        impact: '+35% reply rate increase'
      },
      {
        title: 'Lead with Value, Not Features',
        description: 'Focus on specific benefits and outcomes for their business.',
        good: '"Help reduce your customer acquisition cost by 40%"',
        bad: '"Our platform has advanced AI algorithms and machine learning"',
        impact: '+18% conversion boost'
      }
    ]
  },
  {
    category: 'Timing & Frequency',
    icon: Clock,
    color: 'bg-green-500',
    practices: [
      {
        title: 'Send Emails on Tuesday-Thursday',
        description: 'Mid-week sends typically see higher engagement rates.',
        good: 'Tuesday 10 AM or Wednesday 2 PM',
        bad: 'Monday mornings or Friday afternoons',
        impact: '+15% higher open rates'
      },
      {
        title: 'Follow Up 4-6 Times',
        description: 'Most replies come from follow-up emails, not the initial send.',
        good: 'Day 1, 4, 8, 15, 30, 60 sequence',
        bad: 'Send once and give up',
        impact: '80% of replies come after the 2nd email'
      },
      {
        title: 'Space Emails 3-7 Days Apart',
        description: 'Give prospects time to see and process your message.',
        good: '3-4 days for urgent, 5-7 for relationship building',
        bad: 'Daily follow-ups or waiting weeks',
        impact: 'Optimal response timing'
      }
    ]
  },
  {
    category: 'Personalization',
    icon: Users,
    color: 'bg-purple-500',
    practices: [
      {
        title: 'Research Before You Send',
        description: 'Spend 2-3 minutes researching each prospect for better results.',
        good: 'Reference their LinkedIn post, company news, or mutual connections',
        bad: 'Generic templates with no personal touches',
        impact: '+45% reply rate with research'
      },
      {
        title: 'Use Relevant Case Studies',
        description: 'Share success stories from similar companies or industries.',
        good: '"Helped a similar SaaS company increase MRR by 60% in 6 months"',
        bad: '"We help all kinds of businesses grow"',
        impact: '+28% meeting booking rate'
      },
      {
        title: 'Match Their Communication Style',
        description: 'Mirror their tone from LinkedIn posts or company communications.',
        good: 'Formal for enterprise, casual for startups',
        bad: 'One-size-fits-all tone',
        impact: 'Better rapport building'
      }
    ]
  },
  {
    category: 'Call-to-Action',
    icon: Target,
    color: 'bg-orange-500',
    practices: [
      {
        title: 'Ask for Something Small',
        description: 'Low-commitment asks get higher response rates.',
        good: '"Worth a 15-minute conversation?" or "Quick question - do you handle X internally?"',
        bad: '"Let\'s schedule a 60-minute demo next week"',
        impact: '+31% positive response rate'
      },
      {
        title: 'Give Multiple Response Options',
        description: 'Make it easy for prospects to engage at their comfort level.',
        good: '"Happy to send over a case study, or if you prefer, we could chat for 10 minutes"',
        bad: 'Single option with high commitment',
        impact: '+22% response rate'
      },
      {
        title: 'Include Social Proof',
        description: 'Mention recognizable clients or impressive metrics.',
        good: '"Trusted by companies like Stripe, Airbnb, and 500+ other SaaS businesses"',
        bad: 'No credibility indicators',
        impact: '+19% trust factor increase'
      }
    ]
  }
]

const dosDonts = [
  {
    category: 'Email Structure',
    dos: [
      'Keep emails under 150 words',
      'Use short paragraphs (1-2 sentences)',
      'Include one clear call-to-action',
      'Add a professional signature'
    ],
    donts: [
      'Write long, paragraph-heavy emails',
      'Include multiple links or attachments',
      'Use ALL CAPS or excessive exclamation points',
      'Send from a no-reply email address'
    ]
  },
  {
    category: 'Prospecting',
    dos: [
      'Target decision makers and influencers',
      'Research company size and funding stage',
      'Look for recent trigger events',
      'Verify email addresses before sending'
    ],
    donts: [
      'Spray and pray to everyone',
      'Contact the same company multiple times',
      'Ignore job titles and roles',
      'Use purchased or outdated lists'
    ]
  },
  {
    category: 'Follow-up Strategy',
    dos: [
      'Reference previous emails',
      'Add new value in each follow-up',
      'Vary your approach and angle',
      'Set clear next steps'
    ],
    donts: [
      'Send identical follow-up emails',
      'Be pushy or aggressive',
      'Follow up more than 6 times',
      'Take rejection personally'
    ]
  }
]

const metrics = [
  {
    metric: 'Open Rate',
    benchmark: '40-60%',
    icon: Mail,
    tips: ['Improve subject lines', 'Test send times', 'Clean your list']
  },
  {
    metric: 'Reply Rate',
    benchmark: '10-25%',
    icon: MessageSquare,
    tips: ['Better personalization', 'Clearer value prop', 'Softer CTA']
  },
  {
    metric: 'Meeting Booking Rate',
    benchmark: '3-8%',
    icon: Target,
    tips: ['Social proof', 'Relevant case studies', 'Easy scheduling']
  },
  {
    metric: 'Deliverability',
    benchmark: '95%+',
    icon: Shield,
    tips: ['Warm up domains', 'Monitor reputation', 'Avoid spam words']
  }
]

export default function BestPracticesPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center space-x-4 mb-6">
          <Link href="/help">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Help Center
            </Button>
          </Link>
        </div>

        <div className="space-y-4">
          <Badge variant="secondary">Best Practices</Badge>
          
          <h1 className="text-4xl font-bold tracking-tight">
            Cold Email Best Practices
          </h1>
          
          <p className="text-xl text-muted-foreground">
            Master the art of cold email outreach with proven strategies that drive measurable results.
          </p>
        </div>
      </div>

      {/* Key Metrics */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BarChart3 className="h-5 w-5" />
            <span>Industry Benchmarks</span>
          </CardTitle>
          <CardDescription>
            Target these metrics for successful cold email campaigns
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {metrics.map((metric, index) => (
              <div key={index} className="text-center p-4 border rounded-lg">
                <metric.icon className="h-8 w-8 mx-auto mb-2 text-primary" />
                <h3 className="font-semibold">{metric.metric}</h3>
                <div className="text-2xl font-bold text-green-600 my-1">
                  {metric.benchmark}
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  {metric.tips.map((tip, tipIndex) => (
                    <div key={tipIndex}>• {tip}</div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Best Practices by Category */}
      <div className="space-y-8 mb-12">
        {bestPractices.map((category, categoryIndex) => (
          <Card key={categoryIndex}>
            <CardHeader>
              <CardTitle className="flex items-center space-x-3">
                <div className={`w-10 h-10 ${category.color} rounded-lg flex items-center justify-center`}>
                  <category.icon className="h-5 w-5 text-white" />
                </div>
                <span>{category.category}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {category.practices.map((practice, practiceIndex) => (
                  <div key={practiceIndex} className="border-l-4 border-primary pl-6">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold">{practice.title}</h3>
                      <Badge variant="outline" className="text-green-600">
                        {practice.impact}
                      </Badge>
                    </div>
                    
                    <p className="text-muted-foreground mb-4">{practice.description}</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <div className="flex items-center space-x-2 mb-2">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          <span className="font-medium text-green-800">Good Example</span>
                        </div>
                        <p className="text-sm text-green-700 italic">"{practice.good}"</p>
                      </div>
                      
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <div className="flex items-center space-x-2 mb-2">
                          <XCircle className="h-4 w-4 text-red-600" />
                          <span className="font-medium text-red-800">Poor Example</span>
                        </div>
                        <p className="text-sm text-red-700 italic">"{practice.bad}"</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Do's and Don'ts */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Do's and Don'ts</CardTitle>
          <CardDescription>
            Quick reference guide for effective cold email outreach
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {dosDonts.map((category, index) => (
              <div key={index}>
                <h3 className="font-semibold mb-4 text-center">{category.category}</h3>
                
                <div className="space-y-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h4 className="font-medium text-green-800 mb-3 flex items-center">
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Do's
                    </h4>
                    <ul className="space-y-2">
                      {category.dos.map((item, itemIndex) => (
                        <li key={itemIndex} className="text-sm text-green-700 flex items-start">
                          <span className="text-green-500 mr-2">•</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <h4 className="font-medium text-red-800 mb-3 flex items-center">
                      <XCircle className="h-4 w-4 mr-2" />
                      Don'ts
                    </h4>
                    <ul className="space-y-2">
                      {category.donts.map((item, itemIndex) => (
                        <li key={itemIndex} className="text-sm text-red-700 flex items-start">
                          <span className="text-red-500 mr-2">•</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Advanced Tips */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Lightbulb className="h-5 w-5 text-yellow-500" />
            <span>Advanced Optimization Tips</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="border-l-4 border-blue-500 pl-4">
                <h4 className="font-semibold text-blue-900">A/B Testing</h4>
                <p className="text-sm text-blue-700">
                  Test subject lines, send times, and email length. Even small improvements compound over time.
                </p>
              </div>
              
              <div className="border-l-4 border-green-500 pl-4">
                <h4 className="font-semibold text-green-900">Trigger Events</h4>
                <p className="text-sm text-green-700">
                  Target companies after funding rounds, leadership changes, or product launches for higher relevance.
                </p>
              </div>
              
              <div className="border-l-4 border-purple-500 pl-4">
                <h4 className="font-semibold text-purple-900">Multi-Channel Approach</h4>
                <p className="text-sm text-purple-700">
                  Combine email with LinkedIn outreach and phone calls for 3x higher response rates.
                </p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="border-l-4 border-orange-500 pl-4">
                <h4 className="font-semibold text-orange-900">Video Personalization</h4>
                <p className="text-sm text-orange-700">
                  Record short personalized videos for high-value prospects to stand out from text-only emails.
                </p>
              </div>
              
              <div className="border-l-4 border-red-500 pl-4">
                <h4 className="font-semibold text-red-900">Reply Handling</h4>
                <p className="text-sm text-red-700">
                  Respond to all replies within 24 hours, even "not interested" ones, to maintain sender reputation.
                </p>
              </div>
              
              <div className="border-l-4 border-indigo-500 pl-4">
                <h4 className="font-semibold text-indigo-900">Seasonal Timing</h4>
                <p className="text-sm text-indigo-700">
                  Avoid sending during holidays, summer Fridays, and end-of-quarter busy periods.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Warning Section */}
      <Card className="bg-yellow-50 border-yellow-200">
        <CardContent className="p-6">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="h-6 w-6 text-yellow-600 flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-semibold text-yellow-800 mb-2">Important Legal Considerations</h3>
              <div className="text-sm text-yellow-700 space-y-2">
                <p>
                  • Always comply with CAN-SPAM, GDPR, and other applicable laws
                </p>
                <p>
                  • Include a clear unsubscribe mechanism in every email
                </p>
                <p>
                  • Respect opt-out requests immediately (within 10 business days)
                </p>
                <p>
                  • Use accurate sender information and avoid deceptive subject lines
                </p>
                <p>
                  • Consider obtaining explicit consent in stricter jurisdictions
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Next Steps */}
      <Card className="mt-8 bg-gradient-to-r from-blue-50 to-purple-50">
        <CardContent className="p-8 text-center">
          <h3 className="text-2xl font-bold mb-4">Ready to Apply These Best Practices?</h3>
          <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
            Put these strategies into action with your next campaign. Remember, small improvements in each area compound to create significantly better results.
          </p>
          
          <div className="flex justify-center space-x-4">
            <Link href="/campaigns/new">
              <Button size="lg">
                Create New Campaign
              </Button>
            </Link>
            <Link href="/help/email-templates">
              <Button variant="outline" size="lg">
                Browse Templates
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}