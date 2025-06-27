/**
 * White-Label Dashboard Page
 * 
 * Main dashboard for white-label users with custom branding
 */

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";

export default function WhiteLabelDashboardPage() {
  const headersList = headers();
  const isAuthenticated = headersList.get('x-authenticated') === 'true';
  const workspaceId = headersList.get('x-workspace-id');
  
  // Redirect unauthenticated users
  if (!isAuthenticated) {
    redirect('/white-label/login?redirectTo=/white-label/dashboard');
  }

  const branding = {
    companyName: headersList.get('x-brand-company') ? 
      decodeURIComponent(headersList.get('x-brand-company')!) : 'Your Company',
    logoUrl: headersList.get('x-brand-logo') ? 
      decodeURIComponent(headersList.get('x-brand-logo')!) : null,
    primaryColor: headersList.get('x-brand-primary-color') || '#2563eb',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Welcome to {branding.companyName}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage your cold outreach campaigns and track performance
          </p>
        </div>
        <Button 
          className="px-6"
          style={{ backgroundColor: branding.primaryColor }}
        >
          New Campaign
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Campaigns</CardTitle>
            <div 
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm"
              style={{ backgroundColor: branding.primaryColor }}
            >
              📧
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12</div>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              +2 from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Emails Sent</CardTitle>
            <div 
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm"
              style={{ backgroundColor: branding.primaryColor }}
            >
              📤
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2,845</div>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              +18.2% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Response Rate</CardTitle>
            <div 
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm"
              style={{ backgroundColor: branding.primaryColor }}
            >
              📈
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">24.3%</div>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              +5.1% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversions</CardTitle>
            <div 
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm"
              style={{ backgroundColor: branding.primaryColor }}
            >
              🎯
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">89</div>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              +12.5% from last month
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Campaigns */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Recent Campaigns</CardTitle>
              <CardDescription>Your latest outreach campaigns</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { name: 'SaaS Prospects Q4', status: 'Active', sent: 450, responses: 23 },
                  { name: 'Enterprise Leads', status: 'Completed', sent: 280, responses: 15 },
                  { name: 'Product Launch', status: 'Draft', sent: 0, responses: 0 },
                  { name: 'Webinar Invites', status: 'Active', sent: 125, responses: 8 },
                ].map((campaign, i) => (
                  <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <h4 className="font-medium">{campaign.name}</h4>
                      <div className="flex items-center gap-4 mt-1 text-sm text-gray-600 dark:text-gray-400">
                        <span>Status: {campaign.status}</span>
                        <span>Sent: {campaign.sent}</span>
                        <span>Responses: {campaign.responses}</span>
                      </div>
                    </div>
                    <Button variant="outline" size="sm">
                      View
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button 
                className="w-full justify-start"
                variant="outline"
                style={{ borderColor: branding.primaryColor, color: branding.primaryColor }}
              >
                📧 Create Campaign
              </Button>
              <Button 
                className="w-full justify-start"
                variant="outline"
                style={{ borderColor: branding.primaryColor, color: branding.primaryColor }}
              >
                📊 View Analytics
              </Button>
              <Button 
                className="w-full justify-start"
                variant="outline"
                style={{ borderColor: branding.primaryColor, color: branding.primaryColor }}
              >
                👥 Manage Leads
              </Button>
              <Button 
                className="w-full justify-start"
                variant="outline"
                style={{ borderColor: branding.primaryColor, color: branding.primaryColor }}
              >
                ⚙️ Settings
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Performance Tips</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded">
                  💡 <strong>Tip:</strong> Personalize your subject lines to increase open rates by up to 50%
                </div>
                <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded">
                  📈 <strong>Best Practice:</strong> Follow up 3-5 times for optimal response rates
                </div>
                <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded">
                  🎯 <strong>Strategy:</strong> A/B test your email templates to find what works best
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Latest events from your campaigns</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { action: 'Campaign "SaaS Prospects Q4" received 3 new replies', time: '2 minutes ago', type: 'reply' },
              { action: 'Email sequence "Enterprise Leads" completed', time: '1 hour ago', type: 'complete' },
              { action: 'New lead "John Smith" added to prospects', time: '3 hours ago', type: 'lead' },
              { action: 'Campaign "Product Launch" was paused', time: '1 day ago', type: 'pause' },
            ].map((activity, i) => (
              <div key={i} className="flex items-center gap-3 p-3 border rounded-lg">
                <div 
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs"
                  style={{ backgroundColor: branding.primaryColor }}
                >
                  {activity.type === 'reply' && '💬'}
                  {activity.type === 'complete' && '✅'}
                  {activity.type === 'lead' && '👤'}
                  {activity.type === 'pause' && '⏸️'}
                </div>
                <div className="flex-1">
                  <p className="text-sm">{activity.action}</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}