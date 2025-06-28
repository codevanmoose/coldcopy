import { Metadata } from 'next'
import { OnboardingChecklist } from '@/components/onboarding/onboarding-checklist'
import { Button } from '@/components/ui/button'
import { ArrowLeft, BookOpen, HelpCircle } from 'lucide-react'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Getting Started | ColdCopy',
  description: 'Complete your ColdCopy setup to start sending effective cold emails',
}

export default function OnboardingPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <div className="flex items-center space-x-4 mb-6">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">
            Getting Started with ColdCopy
          </h1>
          <p className="text-lg text-muted-foreground">
            Follow this checklist to set up your cold outreach campaigns and start converting prospects into customers.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <OnboardingChecklist />
        </div>

        <div className="space-y-6">
          {/* Quick Tips Card */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <div className="flex items-center space-x-2 mb-4">
              <div className="p-2 bg-blue-100 rounded-lg">
                <HelpCircle className="h-4 w-4 text-blue-600" />
              </div>
              <h3 className="font-semibold text-blue-900">Quick Tips</h3>
            </div>
            <div className="space-y-4 text-sm text-blue-800">
              <div>
                <h4 className="font-medium mb-1">Start with small lists</h4>
                <p className="text-blue-700">
                  Import 10-50 leads initially to test your messaging and deliverability before scaling up.
                </p>
              </div>
              <div>
                <h4 className="font-medium mb-1">Personalize your emails</h4>
                <p className="text-blue-700">
                  Use AI generation with specific prompts about your prospects' industry, company size, or recent news.
                </p>
              </div>
              <div>
                <h4 className="font-medium mb-1">Monitor your metrics</h4>
                <p className="text-blue-700">
                  Keep an eye on open rates (aim for 40%+) and reply rates (aim for 10%+) to optimize performance.
                </p>
              </div>
            </div>
          </div>

          {/* Resources Card */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
            <div className="flex items-center space-x-2 mb-4">
              <div className="p-2 bg-gray-100 rounded-lg">
                <BookOpen className="h-4 w-4 text-gray-600" />
              </div>
              <h3 className="font-semibold text-gray-900">Helpful Resources</h3>
            </div>
            <div className="space-y-3">
              <Link 
                href="/help/getting-started" 
                className="block text-sm text-gray-700 hover:text-gray-900 hover:underline"
              >
                📚 Complete Setup Guide
              </Link>
              <Link 
                href="/help/email-templates" 
                className="block text-sm text-gray-700 hover:text-gray-900 hover:underline"
              >
                ✉️ Email Template Library
              </Link>
              <Link 
                href="/help/best-practices" 
                className="block text-sm text-gray-700 hover:text-gray-900 hover:underline"
              >
                🎯 Cold Email Best Practices
              </Link>
              <Link 
                href="/help/deliverability" 
                className="block text-sm text-gray-700 hover:text-gray-900 hover:underline"
              >
                📧 Improve Email Deliverability
              </Link>
              <Link 
                href="/help/analytics" 
                className="block text-sm text-gray-700 hover:text-gray-900 hover:underline"
              >
                📊 Understanding Analytics
              </Link>
            </div>
          </div>

          {/* Support Card */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <h3 className="font-semibold text-green-900 mb-3">Need Help?</h3>
            <p className="text-sm text-green-800 mb-4">
              Our team is here to help you succeed with cold outreach.
            </p>
            <div className="space-y-2">
              <Link href="/help/contact">
                <Button variant="outline" size="sm" className="w-full">
                  Contact Support
                </Button>
              </Link>
              <Link href="/help">
                <Button variant="ghost" size="sm" className="w-full">
                  Browse Help Center
                </Button>
              </Link>
            </div>
          </div>

          {/* Progress Summary */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
            <h3 className="font-semibold text-amber-900 mb-3">Your Progress</h3>
            <p className="text-sm text-amber-800 mb-4">
              Complete the required steps to unlock full platform capabilities:
            </p>
            <div className="space-y-2 text-sm text-amber-800">
              <div className="flex items-center justify-between">
                <span>Email Analytics</span>
                <span className="text-xs bg-amber-100 px-2 py-1 rounded">Locked</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Team Collaboration</span>
                <span className="text-xs bg-amber-100 px-2 py-1 rounded">Locked</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Advanced AI Features</span>
                <span className="text-xs bg-amber-100 px-2 py-1 rounded">Locked</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="mt-12 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold mb-4">
            Ready to Start Your First Campaign?
          </h2>
          <p className="text-muted-foreground mb-6">
            Once you've completed the essential setup steps, you'll be ready to create and launch your first cold email campaign.
          </p>
          <div className="flex justify-center space-x-4">
            <Link href="/campaigns/new">
              <Button size="lg">
                Create Your First Campaign
              </Button>
            </Link>
            <Link href="/help/getting-started">
              <Button variant="outline" size="lg">
                Read the Guide
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}