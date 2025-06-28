'use client'

import { useState } from 'react'
import { Metadata } from 'next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { 
  ArrowLeft,
  MessageSquare,
  Clock,
  Users,
  Mail,
  Phone,
  BookOpen,
  Send,
  CheckCircle2,
  AlertCircle,
  ExternalLink
} from 'lucide-react'
import Link from 'next/link'

// Note: This would typically come from a metadata export, but since we're in a client component:
// export const metadata: Metadata = {
//   title: 'Contact Support | ColdCopy Help',
//   description: 'Get help from our support team - submit a ticket, browse FAQs, or schedule a call',
// }

const contactMethods = [
  {
    title: 'Submit a Support Ticket',
    description: 'Get detailed help with technical issues or account questions',
    icon: MessageSquare,
    responseTime: 'Within 24 hours',
    availability: '24/7',
    color: 'bg-blue-500',
    action: 'ticket'
  },
  {
    title: 'Schedule a Call',
    description: 'Book a personalized consultation with our team',
    icon: Phone,
    responseTime: 'Same or next day',
    availability: 'Mon-Fri 9AM-6PM EST',
    color: 'bg-green-500',
    action: 'call'
  },
  {
    title: 'Email Support',
    description: 'Send us an email for general questions and feedback',
    icon: Mail,
    responseTime: 'Within 48 hours',
    availability: '24/7',
    color: 'bg-purple-500',
    action: 'email'
  }
]

const commonIssues = [
  {
    title: 'Email delivery problems',
    description: 'Issues with emails not being sent or delivered',
    category: 'Technical',
    solutions: [
      'Check your email account connection',
      'Verify DNS settings and domain authentication',
      'Review spam filters and sender reputation'
    ]
  },
  {
    title: 'Campaign not sending',
    description: 'Campaign created but emails are not going out',
    category: 'Campaign',
    solutions: [
      'Ensure campaign is activated',
      'Check lead list and email validation',
      'Verify sending schedule settings'
    ]
  },
  {
    title: 'CSV import failed',
    description: 'Unable to import leads from CSV file',
    category: 'Data',
    solutions: [
      'Check CSV format and required columns',
      'Ensure file size is under 10MB',
      'Validate email addresses in the file'
    ]
  },
  {
    title: 'Low open rates',
    description: 'Emails are sending but not being opened',
    category: 'Performance',
    solutions: [
      'Improve subject line quality',
      'Check sender reputation',
      'Test different send times'
    ]
  }
]

const supportTeam = [
  {
    name: 'Sarah Chen',
    role: 'Head of Support',
    expertise: 'Technical issues, integrations',
    image: '/team/sarah.jpg'
  },
  {
    name: 'Mike Rodriguez',
    role: 'Customer Success',
    expertise: 'Campaign strategy, best practices',
    image: '/team/mike.jpg'
  },
  {
    name: 'Emma Wilson',
    role: 'Technical Support',
    expertise: 'Email deliverability, DNS setup',
    image: '/team/emma.jpg'
  }
]

export default function ContactPage() {
  const [activeMethod, setActiveMethod] = useState<string>('ticket')
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    category: 'technical',
    priority: 'medium',
    message: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    setIsSubmitting(false)
    setSubmitted(true)
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  if (submitted) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="text-center">
          <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold mb-4">Support Request Submitted!</h1>
          <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
            Thank you for contacting us. We've received your support request and will get back to you within 24 hours.
          </p>
          <div className="flex justify-center space-x-4">
            <Link href="/help">
              <Button>
                Back to Help Center
              </Button>
            </Link>
            <Button 
              variant="outline"
              onClick={() => {
                setSubmitted(false)
                setFormData({
                  name: '',
                  email: '',
                  subject: '',
                  category: 'technical',
                  priority: 'medium',
                  message: ''
                })
              }}
            >
              Submit Another Request
            </Button>
          </div>
        </div>
      </div>
    )
  }

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
          <Badge variant="secondary">Support</Badge>
          
          <h1 className="text-4xl font-bold tracking-tight">
            Contact Support
          </h1>
          
          <p className="text-xl text-muted-foreground">
            Get the help you need to succeed with ColdCopy. Our team is here to assist you.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-8">
          {/* Contact Methods */}
          <Card>
            <CardHeader>
              <CardTitle>How would you like to get help?</CardTitle>
              <CardDescription>
                Choose the best way to reach our support team
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {contactMethods.map((method) => (
                  <div
                    key={method.action}
                    className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                      activeMethod === method.action 
                        ? 'border-primary bg-primary/5' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => setActiveMethod(method.action)}
                  >
                    <div className={`w-10 h-10 ${method.color} rounded-lg flex items-center justify-center mb-3`}>
                      <method.icon className="h-5 w-5 text-white" />
                    </div>
                    <h3 className="font-semibold mb-1">{method.title}</h3>
                    <p className="text-sm text-muted-foreground mb-3">{method.description}</p>
                    <div className="space-y-1 text-xs">
                      <div className="flex items-center space-x-1">
                        <Clock className="h-3 w-3" />
                        <span>{method.responseTime}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Users className="h-3 w-3" />
                        <span>{method.availability}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Support Form */}
              {activeMethod === 'ticket' && (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="name">Your Name *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="email">Email Address *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="subject">Subject *</Label>
                    <Input
                      id="subject"
                      value={formData.subject}
                      onChange={(e) => handleInputChange('subject', e.target.value)}
                      placeholder="Brief description of your issue"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="category">Category</Label>
                      <select
                        id="category"
                        value={formData.category}
                        onChange={(e) => handleInputChange('category', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="technical">Technical Issue</option>
                        <option value="billing">Billing & Account</option>
                        <option value="campaign">Campaign Help</option>
                        <option value="integration">Integration Support</option>
                        <option value="feature">Feature Request</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <Label htmlFor="priority">Priority</Label>
                      <select
                        id="priority"
                        value={formData.priority}
                        onChange={(e) => handleInputChange('priority', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="low">Low - General question</option>
                        <option value="medium">Medium - Issue affecting work</option>
                        <option value="high">High - Blocking my workflow</option>
                        <option value="urgent">Urgent - System down</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="message">Message *</Label>
                    <Textarea
                      id="message"
                      value={formData.message}
                      onChange={(e) => handleInputChange('message', e.target.value)}
                      placeholder="Please describe your issue in detail. Include any error messages, steps to reproduce, and what you expected to happen."
                      rows={6}
                      required
                    />
                  </div>

                  <Button type="submit" disabled={isSubmitting} className="w-full">
                    {isSubmitting ? (
                      'Submitting...'
                    ) : (
                      <>
                        Submit Support Request
                        <Send className="h-4 w-4 ml-2" />
                      </>
                    )}
                  </Button>
                </form>
              )}

              {activeMethod === 'call' && (
                <div className="text-center py-8">
                  <h3 className="text-lg font-semibold mb-4">Schedule a Support Call</h3>
                  <p className="text-muted-foreground mb-6">
                    Book a 30-minute call with our support team to get personalized help.
                  </p>
                  <Button size="lg">
                    Book a Call
                    <ExternalLink className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              )}

              {activeMethod === 'email' && (
                <div className="text-center py-8">
                  <h3 className="text-lg font-semibold mb-4">Email Us Directly</h3>
                  <p className="text-muted-foreground mb-6">
                    Send us an email and we'll get back to you within 48 hours.
                  </p>
                  <Link href="mailto:support@coldcopy.cc">
                    <Button size="lg">
                      support@coldcopy.cc
                      <Mail className="h-4 w-4 ml-2" />
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Common Issues */}
          <Card>
            <CardHeader>
              <CardTitle>Common Issues & Solutions</CardTitle>
              <CardDescription>
                Quick fixes for the most frequent support requests
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {commonIssues.map((issue, index) => (
                  <div key={index} className="border-l-4 border-orange-500 pl-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold">{issue.title}</h3>
                      <Badge variant="outline">{issue.category}</Badge>
                    </div>
                    <p className="text-muted-foreground mb-3">{issue.description}</p>
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Try these solutions:</p>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        {issue.solutions.map((solution, solutionIndex) => (
                          <li key={solutionIndex} className="flex items-start">
                            <span className="text-orange-500 mr-2">•</span>
                            {solution}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Support Hours */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Clock className="h-5 w-5" />
                <span>Support Hours</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm">Email & Tickets</span>
                <span className="text-sm font-medium">24/7</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Phone & Live Chat</span>
                <span className="text-sm font-medium">Mon-Fri 9AM-6PM EST</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Response Time</span>
                <span className="text-sm font-medium">Within 24 hours</span>
              </div>
            </CardContent>
          </Card>

          {/* Quick Links */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <BookOpen className="h-5 w-5" />
                <span>Quick Links</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link href="/help/getting-started" className="block text-sm hover:text-primary">
                Getting Started Guide
              </Link>
              <Link href="/help/best-practices" className="block text-sm hover:text-primary">
                Email Best Practices
              </Link>
              <Link href="/help/troubleshooting" className="block text-sm hover:text-primary">
                Troubleshooting Guide
              </Link>
              <Link href="/help/api" className="block text-sm hover:text-primary">
                API Documentation
              </Link>
              <Link href="/help/billing" className="block text-sm hover:text-primary">
                Billing & Pricing
              </Link>
            </CardContent>
          </Card>

          {/* Support Team */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Users className="h-5 w-5" />
                <span>Our Support Team</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {supportTeam.map((member, index) => (
                <div key={index} className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                    <span className="text-sm font-semibold">
                      {member.name.split(' ').map(n => n[0]).join('')}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium">{member.name}</p>
                    <p className="text-xs text-muted-foreground">{member.role}</p>
                    <p className="text-xs text-muted-foreground">{member.expertise}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Emergency Contact */}
          <Card className="bg-red-50 border-red-200">
            <CardContent className="p-4">
              <div className="flex items-start space-x-3">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-red-800 mb-1">Emergency Support</h4>
                  <p className="text-sm text-red-700 mb-2">
                    For urgent issues affecting your business operations
                  </p>
                  <Link href="tel:+1-555-0123">
                    <Button variant="outline" size="sm" className="text-red-700 border-red-300">
                      Call Emergency Line
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}