import { Metadata } from 'next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { 
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  Users,
  Mail,
  Upload,
  Target,
  Play,
  Settings,
  AlertCircle,
  Lightbulb,
  ExternalLink
} from 'lucide-react'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Getting Started Guide | ColdCopy Help',
  description: 'Complete setup guide for ColdCopy - from account creation to your first successful campaign',
}

const steps = [
  {
    id: 'workspace-setup',
    title: 'Set Up Your Workspace',
    description: 'Configure your workspace settings and preferences',
    icon: Settings,
    time: '2 minutes',
    difficulty: 'Easy',
    tasks: [
      'Choose a descriptive workspace name',
      'Set your timezone for accurate scheduling',
      'Configure basic preferences',
      'Review workspace settings'
    ],
    tips: [
      'Use your company name or team name for the workspace',
      'Double-check your timezone to ensure emails send at the right time',
      'You can always change these settings later'
    ],
    actionUrl: '/settings/workspace'
  },
  {
    id: 'email-setup',
    title: 'Connect Your Email Account',
    description: 'Set up email sending through Gmail, Outlook, or SMTP',
    icon: Mail,
    time: '5 minutes',
    difficulty: 'Medium',
    tasks: [
      'Choose your email provider (Gmail/Outlook/SMTP)',
      'Complete OAuth authentication or enter SMTP details',
      'Verify your email connection',
      'Set up sender name and signature'
    ],
    tips: [
      'Gmail and Outlook are easier to set up than custom SMTP',
      'Use app-specific passwords for enhanced security',
      'Test sending to verify your setup works correctly'
    ],
    actionUrl: '/settings/email'
  },
  {
    id: 'lead-import',
    title: 'Import Your First Leads',
    description: 'Upload your prospect list and organize your contacts',
    icon: Upload,
    time: '3 minutes',
    difficulty: 'Easy',
    tasks: [
      'Prepare your CSV file with required columns',
      'Upload your lead list',
      'Review and clean imported data',
      'Organize leads into segments'
    ],
    tips: [
      'Required columns: email, first_name, last_name, company',
      'Start with 10-50 leads to test your approach',
      'Clean your data before importing for better results'
    ],
    actionUrl: '/leads/import'
  },
  {
    id: 'campaign-creation',
    title: 'Create Your First Campaign',
    description: 'Build a multi-step email sequence that converts',
    icon: Target,
    time: '10 minutes',
    difficulty: 'Medium',
    tasks: [
      'Choose your campaign name and audience',
      'Write your first email or use AI generation',
      'Set up follow-up sequences (2-4 emails)',
      'Configure sending schedule and timing'
    ],
    tips: [
      'Keep your first email short and focused on one ask',
      'Use AI to generate personalized content at scale',
      'Space follow-ups 3-7 days apart for best results'
    ],
    actionUrl: '/campaigns/new'
  },
  {
    id: 'campaign-launch',
    title: 'Launch Your Campaign',
    description: 'Review settings and start your outreach',
    icon: Play,
    time: '2 minutes',
    difficulty: 'Easy',
    tasks: [
      'Review all campaign settings',
      'Preview your emails',
      'Double-check your lead selection',
      'Launch your campaign'
    ],
    tips: [
      'Send test emails to yourself first',
      'Start with a small batch to test performance',
      'Monitor your first sends closely'
    ],
    actionUrl: '/campaigns'
  }
]

const requirements = [
  'Active ColdCopy account',
  'Email account (Gmail, Outlook, or SMTP access)',
  'List of prospects with email addresses',
  '15-20 minutes of setup time'
]

export default function GettingStartedPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
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
          <div className="flex items-center space-x-2">
            <Badge variant="secondary">Getting Started</Badge>
            <Badge variant="outline" className="text-green-600 border-green-600">
              <Clock className="h-3 w-3 mr-1" />
              15-20 min setup
            </Badge>
          </div>
          
          <h1 className="text-4xl font-bold tracking-tight">
            Complete Setup Guide
          </h1>
          
          <p className="text-xl text-muted-foreground">
            Follow this step-by-step guide to set up ColdCopy and launch your first successful cold email campaign.
          </p>
        </div>
      </div>

      {/* Overview */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Lightbulb className="h-5 w-5 text-yellow-500" />
            <span>What You'll Accomplish</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            By the end of this guide, you'll have a fully configured ColdCopy workspace ready to send personalized cold emails that get replies.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold mb-2">What You'll Learn:</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• How to configure your workspace</li>
                <li>• Email account connection methods</li>
                <li>• Best practices for lead importing</li>
                <li>• Creating effective email sequences</li>
                <li>• Campaign launch and monitoring</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-2">Requirements:</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {requirements.map((req, index) => (
                  <li key={index} className="flex items-center space-x-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span>{req}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Steps */}
      <div className="space-y-8">
        {steps.map((step, index) => (
          <Card key={step.id} className="overflow-hidden">
            <CardHeader className="bg-muted/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
                    <step.icon className="h-6 w-6 text-primary-foreground" />
                  </div>
                  <div>
                    <CardTitle className="flex items-center space-x-2">
                      <span>Step {index + 1}: {step.title}</span>
                    </CardTitle>
                    <CardDescription>{step.description}</CardDescription>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Badge variant="outline">{step.time}</Badge>
                  <Badge variant={step.difficulty === 'Easy' ? 'secondary' : 'default'}>
                    {step.difficulty}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-4">
                  <div>
                    <h4 className="font-semibold mb-3">Tasks to Complete:</h4>
                    <ul className="space-y-2">
                      {step.tasks.map((task, taskIndex) => (
                        <li key={taskIndex} className="flex items-start space-x-2">
                          <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                          <span className="text-sm">{task}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <div className="flex items-center space-x-4 pt-4">
                    <Link href={step.actionUrl}>
                      <Button>
                        Start Step {index + 1}
                        <ExternalLink className="h-4 w-4 ml-2" />
                      </Button>
                    </Link>
                    
                    {index > 0 && (
                      <Button variant="outline" size="sm">
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Previous Step
                      </Button>
                    )}
                    
                    {index < steps.length - 1 && (
                      <Button variant="outline" size="sm">
                        Next Step
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    )}
                  </div>
                </div>
                
                <div className="bg-blue-50 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-900 mb-3 flex items-center">
                    <Lightbulb className="h-4 w-4 mr-2" />
                    Pro Tips
                  </h4>
                  <ul className="space-y-2">
                    {step.tips.map((tip, tipIndex) => (
                      <li key={tipIndex} className="text-sm text-blue-800">
                        • {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Next Steps */}
      <Card className="mt-12 bg-gradient-to-r from-green-50 to-blue-50">
        <CardContent className="p-8">
          <div className="text-center">
            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="h-8 w-8 text-white" />
            </div>
            
            <h3 className="text-2xl font-bold mb-4">Congratulations!</h3>
            <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
              You've completed the essential setup for ColdCopy. Your workspace is now ready to send effective cold email campaigns.
            </p>
            
            <div className="flex justify-center space-x-4 mb-8">
              <Link href="/analytics">
                <Button size="lg">
                  View Your Analytics
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
              <Link href="/help/best-practices">
                <Button variant="outline" size="lg">
                  Learn Best Practices
                </Button>
              </Link>
            </div>
            
            <Separator className="my-6" />
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="flex items-center justify-center space-x-2">
                <Target className="h-4 w-4 text-green-600" />
                <span>Campaign Ready</span>
              </div>
              <div className="flex items-center justify-center space-x-2">
                <Mail className="h-4 w-4 text-blue-600" />
                <span>Email Connected</span>
              </div>
              <div className="flex items-center justify-center space-x-2">
                <Users className="h-4 w-4 text-purple-600" />
                <span>Leads Imported</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Troubleshooting */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-orange-500" />
            <span>Common Issues & Solutions</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div className="border-l-4 border-orange-500 pl-4">
              <h4 className="font-semibold">Email connection fails</h4>
              <p className="text-sm text-muted-foreground">
                Ensure you're using app-specific passwords for Gmail/Outlook, or check your SMTP settings are correct.
              </p>
            </div>
            
            <div className="border-l-4 border-orange-500 pl-4">
              <h4 className="font-semibold">CSV import errors</h4>
              <p className="text-sm text-muted-foreground">
                Verify your CSV has the required columns (email, first_name, last_name, company) and proper formatting.
              </p>
            </div>
            
            <div className="border-l-4 border-orange-500 pl-4">
              <h4 className="font-semibold">Low email deliverability</h4>
              <p className="text-sm text-muted-foreground">
                Check your domain's DNS settings, warm up your email account gradually, and avoid spam trigger words.
              </p>
            </div>
          </div>
          
          <div className="pt-4">
            <Link href="/help/contact">
              <Button variant="outline">
                Still Need Help? Contact Support
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}