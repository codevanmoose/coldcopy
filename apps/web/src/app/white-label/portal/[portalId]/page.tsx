/**
 * Client Portal Page
 * 
 * Public portal page for clients to view their campaign data
 */

import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../../components/ui/card";
import { Button } from "../../../../components/ui/button";
import { Badge } from "../../../../components/ui/badge";

interface ClientPortalPageProps {
  params: Promise<{
    portalId: string;
  }>;
  searchParams: Promise<{
    token?: string;
  }>;
}

export default async function ClientPortalPage({ params, searchParams }: ClientPortalPageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const headersList = await headers();
  const portalId = headersList.get('x-portal-id');
  const workspaceId = headersList.get('x-workspace-id');
  
  // Validate portal access
  if (!portalId || portalId !== resolvedParams.portalId) {
    if (resolvedSearchParams.token) {
      // Redirect to login with token
      redirect(`/white-label/portal/${resolvedParams.portalId}/login?token=${resolvedSearchParams.token}`);
    } else {
      redirect(`/white-label/portal/${resolvedParams.portalId}/login`);
    }
  }

  const branding = {
    companyName: headersList.get('x-brand-company') ? 
      decodeURIComponent(headersList.get('x-brand-company')!) : 'Your Agency',
    logoUrl: headersList.get('x-brand-logo') ? 
      decodeURIComponent(headersList.get('x-brand-logo')!) : null,
    primaryColor: headersList.get('x-brand-primary-color') || '#2563eb',
  };

  // Mock client data - in real implementation, fetch from API
  const clientData = {
    name: 'TechCorp Solutions',
    email: 'contact@techcorp.com',
    campaigns: [
      {
        id: '1',
        name: 'Q4 Lead Generation',
        status: 'Active',
        startDate: '2024-01-15',
        endDate: '2024-03-15',
        emailsSent: 1250,
        opens: 456,
        clicks: 89,
        replies: 23,
        conversions: 8,
      },
      {
        id: '2',
        name: 'Product Launch Outreach',
        status: 'Completed',
        startDate: '2024-02-01',
        endDate: '2024-02-28',
        emailsSent: 800,
        opens: 298,
        clicks: 67,
        replies: 15,
        conversions: 5,
      },
    ],
  };

  const totalEmails = clientData.campaigns.reduce((sum, c) => sum + c.emailsSent, 0);
  const totalOpens = clientData.campaigns.reduce((sum, c) => sum + c.opens, 0);
  const totalClicks = clientData.campaigns.reduce((sum, c) => sum + c.clicks, 0);
  const totalReplies = clientData.campaigns.reduce((sum, c) => sum + c.replies, 0);
  const totalConversions = clientData.campaigns.reduce((sum, c) => sum + c.conversions, 0);

  const openRate = totalEmails > 0 ? ((totalOpens / totalEmails) * 100).toFixed(1) : '0';
  const clickRate = totalEmails > 0 ? ((totalClicks / totalEmails) * 100).toFixed(1) : '0';
  const replyRate = totalEmails > 0 ? ((totalReplies / totalEmails) * 100).toFixed(1) : '0';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              {branding.logoUrl ? (
                <img
                  src={branding.logoUrl}
                  alt={`${branding.companyName} Logo`}
                  className="h-8 w-auto"
                />
              ) : (
                <div 
                  className="w-8 h-8 rounded flex items-center justify-center text-white font-bold"
                  style={{ backgroundColor: branding.primaryColor }}
                >
                  {branding.companyName.charAt(0)}
                </div>
              )}
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                  {branding.companyName} Portal
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Campaign Performance Dashboard
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {clientData.name}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {clientData.email}
                </p>
              </div>
              <Button variant="outline" size="sm">
                Download Report
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* Overview Stats */}
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
              Campaign Overview
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Total Emails
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalEmails.toLocaleString()}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Open Rate
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" style={{ color: branding.primaryColor }}>
                    {openRate}%
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {totalOpens.toLocaleString()} opens
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Click Rate
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" style={{ color: branding.primaryColor }}>
                    {clickRate}%
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {totalClicks.toLocaleString()} clicks
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Reply Rate
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" style={{ color: branding.primaryColor }}>
                    {replyRate}%
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {totalReplies.toLocaleString()} replies
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Conversions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" style={{ color: branding.primaryColor }}>
                    {totalConversions}
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {((totalConversions / totalEmails) * 100).toFixed(1)}% conversion rate
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Campaign Details */}
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
              Campaign Details
            </h2>
            <div className="space-y-4">
              {clientData.campaigns.map((campaign) => (
                <Card key={campaign.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">{campaign.name}</CardTitle>
                        <CardDescription>
                          {new Date(campaign.startDate).toLocaleDateString()} - {new Date(campaign.endDate).toLocaleDateString()}
                        </CardDescription>
                      </div>
                      <Badge 
                        variant={campaign.status === 'Active' ? 'default' : 'secondary'}
                        style={campaign.status === 'Active' ? { backgroundColor: branding.primaryColor } : undefined}
                      >
                        {campaign.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Emails Sent</p>
                        <p className="text-lg font-semibold">{campaign.emailsSent.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Opens</p>
                        <p className="text-lg font-semibold">{campaign.opens.toLocaleString()}</p>
                        <p className="text-xs text-gray-500">
                          {((campaign.opens / campaign.emailsSent) * 100).toFixed(1)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Clicks</p>
                        <p className="text-lg font-semibold">{campaign.clicks.toLocaleString()}</p>
                        <p className="text-xs text-gray-500">
                          {((campaign.clicks / campaign.emailsSent) * 100).toFixed(1)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Replies</p>
                        <p className="text-lg font-semibold">{campaign.replies.toLocaleString()}</p>
                        <p className="text-xs text-gray-500">
                          {((campaign.replies / campaign.emailsSent) * 100).toFixed(1)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Conversions</p>
                        <p className="text-lg font-semibold">{campaign.conversions.toLocaleString()}</p>
                        <p className="text-xs text-gray-500">
                          {((campaign.conversions / campaign.emailsSent) * 100).toFixed(1)}%
                        </p>
                      </div>
                      <div className="flex items-center">
                        <Button 
                          variant="outline" 
                          size="sm"
                          style={{ borderColor: branding.primaryColor, color: branding.primaryColor }}
                        >
                          View Details
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Performance Insights */}
          <Card>
            <CardHeader>
              <CardTitle>Performance Insights</CardTitle>
              <CardDescription>
                Key takeaways from your campaigns
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="font-medium">What's Working Well</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: branding.primaryColor }}
                      />
                      <span className="text-sm">High open rates indicate strong subject lines</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: branding.primaryColor }}
                      />
                      <span className="text-sm">Good reply rate shows message relevance</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: branding.primaryColor }}
                      />
                      <span className="text-sm">Consistent performance across campaigns</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <h4 className="font-medium">Optimization Opportunities</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-yellow-500" />
                      <span className="text-sm">Test different call-to-action phrases</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-yellow-500" />
                      <span className="text-sm">Experiment with send times</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-yellow-500" />
                      <span className="text-sm">Consider follow-up sequence optimization</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white dark:bg-gray-800 border-t mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              © 2024 {branding.companyName}. All rights reserved.
            </p>
            <div className="flex space-x-4">
              <a href="/portal/support" className="text-sm text-gray-600 dark:text-gray-400 hover:underline">
                Support
              </a>
              <a href="/privacy" className="text-sm text-gray-600 dark:text-gray-400 hover:underline">
                Privacy
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}