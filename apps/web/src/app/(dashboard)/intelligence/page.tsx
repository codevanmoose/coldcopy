'use client';

import { IntentDashboard } from '@/components/sales-intelligence/IntentDashboard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Code, Copy, ExternalLink } from 'lucide-react';
import { useCurrentWorkspace } from '@/hooks/use-user';
import { generateTrackingScript } from '@/lib/sales-intelligence/tracking-script';
import { useState } from 'react';
import { useToast } from '@/components/ui/use-toast';

export default function IntelligencePage() {
  const workspace = useCurrentWorkspace();
  const { toast } = useToast();
  const [showTrackingCode, setShowTrackingCode] = useState(false);
  
  if (!workspace) {
    return <div>Loading...</div>;
  }
  
  const trackingScript = generateTrackingScript(workspace.workspace_id, workspace.name);
  
  const copyToClipboard = () => {
    navigator.clipboard.writeText(trackingScript);
    toast({
      title: 'Copied!',
      description: 'Tracking script copied to clipboard',
    });
  };
  
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Sales Intelligence</h3>
        <p className="text-sm text-muted-foreground">
          Real-time buying signals and intent data to identify hot leads
        </p>
      </div>
      
      {/* Intent Dashboard */}
      <IntentDashboard workspaceId={workspace.workspace_id} />
      
      {/* Website Tracking Setup */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Website Visitor Tracking</CardTitle>
              <CardDescription>
                Install this script on your website to track visitor behavior and identify companies
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTrackingCode(!showTrackingCode)}
            >
              <Code className="mr-2 h-4 w-4" />
              {showTrackingCode ? 'Hide' : 'Show'} Tracking Code
            </Button>
          </div>
        </CardHeader>
        {showTrackingCode && (
          <CardContent>
            <div className="space-y-4">
              <div className="relative">
                <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs">
                  <code>{trackingScript}</code>
                </pre>
                <Button
                  size="sm"
                  variant="outline"
                  className="absolute top-2 right-2"
                  onClick={copyToClipboard}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Installation Instructions:</h4>
                <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                  <li>Copy the tracking script above</li>
                  <li>Paste it into your website's HTML, just before the closing &lt;/body&gt; tag</li>
                  <li>The script will automatically start tracking visitor behavior</li>
                  <li>View identified companies and engagement data in the dashboard above</li>
                </ol>
              </div>
              
              <div className="rounded-lg border bg-muted/50 p-4">
                <h4 className="text-sm font-medium mb-2">What this tracks:</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• Page views and time spent on each page</li>
                  <li>• Scroll depth and click behavior</li>
                  <li>• UTM parameters and referrer information</li>
                  <li>• Company identification from IP address</li>
                  <li>• Form submissions and content downloads</li>
                </ul>
              </div>
            </div>
          </CardContent>
        )}
      </Card>
      
      {/* Integration Partners */}
      <Card>
        <CardHeader>
          <CardTitle>Data Enrichment Partners</CardTitle>
          <CardDescription>
            Connect with leading intent data providers for deeper insights
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                name: '6sense',
                description: 'Account identification and intent data',
                status: 'coming_soon',
              },
              {
                name: 'Clearbit',
                description: 'Company and contact enrichment',
                status: 'coming_soon',
              },
              {
                name: 'Bombora',
                description: 'B2B intent data and surge alerts',
                status: 'coming_soon',
              },
            ].map((partner) => (
              <div
                key={partner.name}
                className="rounded-lg border p-4 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">{partner.name}</h4>
                  <Button size="sm" variant="ghost" disabled>
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  {partner.description}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  disabled
                  className="w-full"
                >
                  Coming Soon
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}