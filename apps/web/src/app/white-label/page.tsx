/**
 * White-Label Landing Page
 * 
 * Default landing page for white-label domains
 */

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";

export default function WhiteLabelLandingPage() {
  const headersList = headers();
  const isAuthenticated = headersList.get('x-authenticated') === 'true';
  
  // Redirect authenticated users to dashboard
  if (isAuthenticated) {
    redirect('/white-label/dashboard');
  }

  const branding = {
    companyName: headersList.get('x-brand-company') ? 
      decodeURIComponent(headersList.get('x-brand-company')!) : 'Your Company',
    logoUrl: headersList.get('x-brand-logo') ? 
      decodeURIComponent(headersList.get('x-brand-logo')!) : null,
    primaryColor: headersList.get('x-brand-primary-color') || '#2563eb',
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="max-w-4xl mx-auto text-center">
          <div className="mb-8">
            {branding.logoUrl ? (
              <img
                src={branding.logoUrl}
                alt={`${branding.companyName} Logo`}
                className="mx-auto h-16 w-auto mb-6"
              />
            ) : (
              <div 
                className="mx-auto w-16 h-16 rounded-lg mb-6 flex items-center justify-center text-white font-bold text-xl"
                style={{ backgroundColor: branding.primaryColor }}
              >
                {branding.companyName.charAt(0)}
              </div>
            )}
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 dark:text-white mb-4">
              Welcome to {branding.companyName}
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto">
              Transform your outreach with AI-powered cold email automation. 
              Personalize at scale and convert more prospects into customers.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Button 
              size="lg" 
              className="px-8 py-3"
              style={{ backgroundColor: branding.primaryColor }}
              asChild
            >
              <a href="/white-label/signup">Get Started</a>
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="px-8 py-3"
              asChild
            >
              <a href="/white-label/login">Sign In</a>
            </Button>
          </div>

          {/* Feature Cards */}
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div 
                    className="w-8 h-8 rounded flex items-center justify-center text-white"
                    style={{ backgroundColor: branding.primaryColor }}
                  >
                    ✨
                  </div>
                  AI-Powered Personalization
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Leverage advanced AI to create personalized emails that resonate 
                  with each prospect, increasing response rates dramatically.
                </CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div 
                    className="w-8 h-8 rounded flex items-center justify-center text-white"
                    style={{ backgroundColor: branding.primaryColor }}
                  >
                    📊
                  </div>
                  Advanced Analytics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Track opens, clicks, replies, and conversions with detailed 
                  analytics to optimize your outreach campaigns.
                </CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div 
                    className="w-8 h-8 rounded flex items-center justify-center text-white"
                    style={{ backgroundColor: branding.primaryColor }}
                  >
                    ⚡
                  </div>
                  Scale Your Outreach
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Send thousands of personalized emails while maintaining 
                  high deliverability and compliance with email regulations.
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-50 dark:bg-gray-800 py-8">
        <div className="max-w-4xl mx-auto text-center px-4">
          <p className="text-gray-600 dark:text-gray-400">
            © 2024 {branding.companyName}. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}