'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Mail,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Zap,
  RefreshCw,
  FileText,
  Send
} from 'lucide-react';
import { DomainReputation, SpamAnalysisResult } from '@/lib/email-deliverability/service';

interface DeliverabilityDashboardProps {
  workspaceId: string;
}

export function DeliverabilityDashboard({ workspaceId }: DeliverabilityDashboardProps) {
  const [testEmail, setTestEmail] = useState({
    subject: '',
    body: '',
  });

  // Fetch domain reputation
  const { data: reputation, isLoading: reputationLoading, refetch: refetchReputation } = useQuery({
    queryKey: ['domain-reputation', workspaceId],
    queryFn: async () => {
      const response = await fetch(`/api/deliverability/reputation?workspace_id=${workspaceId}`);
      if (!response.ok) throw new Error('Failed to fetch reputation');
      return response.json() as Promise<DomainReputation[]>;
    },
  });

  // Fetch recommendations
  const { data: recommendations } = useQuery({
    queryKey: ['deliverability-recommendations', workspaceId],
    queryFn: async () => {
      const response = await fetch(`/api/deliverability/recommendations?workspace_id=${workspaceId}`);
      if (!response.ok) throw new Error('Failed to fetch recommendations');
      return response.json();
    },
  });

  // Spam analysis mutation
  const spamAnalysisMutation = useMutation({
    mutationFn: async (email: { subject: string; body: string }) => {
      const response = await fetch('/api/deliverability/analyze-spam', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspaceId,
          subject: email.subject,
          body_html: email.body,
          body_text: email.body.replace(/<[^>]*>/g, ''),
        }),
      });
      if (!response.ok) throw new Error('Failed to analyze spam');
      return response.json() as Promise<SpamAnalysisResult>;
    },
  });

  const getScoreColor = (score: number): string => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getRiskBadgeVariant = (risk: string): any => {
    switch (risk) {
      case 'low': return 'default';
      case 'medium': return 'secondary';
      case 'high': return 'destructive';
      case 'critical': return 'destructive';
      default: return 'outline';
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Domain Score</p>
                <p className={`text-3xl font-bold ${getScoreColor(reputation?.[0]?.overall_score || 0)}`}>
                  {reputation?.[0]?.overall_score || 0}%
                </p>
                <p className="text-xs text-muted-foreground mt-1">Overall health</p>
              </div>
              <Shield className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Delivery Rate</p>
                <p className="text-3xl font-bold">
                  {reputation?.[0]?.delivery_rate || 0}%
                </p>
                <p className="text-xs text-muted-foreground mt-1">Emails delivered</p>
              </div>
              <Mail className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Bounce Rate</p>
                <p className="text-3xl font-bold">
                  {reputation?.[0]?.bounce_rate || 0}%
                </p>
                <p className="text-xs text-muted-foreground mt-1">Emails bounced</p>
              </div>
              <TrendingDown className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Spam Rate</p>
                <p className="text-3xl font-bold">
                  {reputation?.[0]?.complaint_rate || 0}%
                </p>
                <p className="text-xs text-muted-foreground mt-1">Marked as spam</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="reputation" className="space-y-4">
        <TabsList>
          <TabsTrigger value="reputation">Domain Reputation</TabsTrigger>
          <TabsTrigger value="spam-check">Spam Checker</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
          <TabsTrigger value="authentication">Authentication</TabsTrigger>
        </TabsList>

        {/* Domain Reputation */}
        <TabsContent value="reputation" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Domain Reputation</CardTitle>
                  <CardDescription>
                    Monitor your sending domains and their reputation
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => refetchReputation()}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {reputation?.map((domain) => (
                  <div key={domain.domain} className="space-y-4 p-4 rounded-lg border">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{domain.domain}</p>
                        <div className="flex items-center gap-4 mt-2">
                          <Badge variant={domain.blacklisted ? 'destructive' : 'default'}>
                            {domain.blacklisted ? 'Blacklisted' : 'Clean'}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            Score: {domain.overall_score}/100
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Delivery Rate</p>
                        <p className="text-2xl font-bold">{domain.delivery_rate}%</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {domain.spf_valid ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500" />
                          )}
                          <span className="text-sm">SPF</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {domain.dkim_valid ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500" />
                          )}
                          <span className="text-sm">DKIM</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {domain.dmarc_valid ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500" />
                          )}
                          <span className="text-sm">DMARC</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Spam Checker */}
        <TabsContent value="spam-check" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Email Spam Checker</CardTitle>
              <CardDescription>
                Test your email content for spam triggers before sending
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Subject Line</label>
                  <Input
                    placeholder="Enter your email subject..."
                    value={testEmail.subject}
                    onChange={(e) => setTestEmail({ ...testEmail, subject: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Email Body</label>
                  <Textarea
                    placeholder="Enter your email content..."
                    rows={6}
                    value={testEmail.body}
                    onChange={(e) => setTestEmail({ ...testEmail, body: e.target.value })}
                  />
                </div>
                <Button
                  onClick={() => spamAnalysisMutation.mutate(testEmail)}
                  disabled={!testEmail.subject || !testEmail.body || spamAnalysisMutation.isPending}
                >
                  {spamAnalysisMutation.isPending ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Zap className="mr-2 h-4 w-4" />
                      Check Spam Score
                    </>
                  )}
                </Button>
              </div>

              {spamAnalysisMutation.data && (
                <div className="space-y-4 pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Spam Score</p>
                      <p className="text-sm text-muted-foreground">
                        Lower is better (0-10 scale)
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-bold">
                        {spamAnalysisMutation.data.overall_spam_score}
                      </p>
                      <Badge variant={getRiskBadgeVariant(spamAnalysisMutation.data.risk_level)}>
                        {spamAnalysisMutation.data.risk_level} risk
                      </Badge>
                    </div>
                  </div>

                  {spamAnalysisMutation.data.spam_triggers.length > 0 && (
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        <p className="font-medium mb-2">Spam Triggers Found:</p>
                        <ul className="list-disc list-inside space-y-1">
                          {spamAnalysisMutation.data.spam_triggers.map((trigger, i) => (
                            <li key={i} className="text-sm">{trigger}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-2">
                    <p className="font-medium">Inbox Placement Prediction:</p>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center p-3 rounded-lg border">
                        <p className="text-sm text-muted-foreground">Gmail</p>
                        <p className="font-medium capitalize">
                          {spamAnalysisMutation.data.inbox_placement_prediction.gmail}
                        </p>
                      </div>
                      <div className="text-center p-3 rounded-lg border">
                        <p className="text-sm text-muted-foreground">Outlook</p>
                        <p className="font-medium capitalize">
                          {spamAnalysisMutation.data.inbox_placement_prediction.outlook}
                        </p>
                      </div>
                      <div className="text-center p-3 rounded-lg border">
                        <p className="text-sm text-muted-foreground">Yahoo</p>
                        <p className="font-medium capitalize">
                          {spamAnalysisMutation.data.inbox_placement_prediction.yahoo}
                        </p>
                      </div>
                    </div>
                  </div>

                  {spamAnalysisMutation.data.recommendations.length > 0 && (
                    <div className="space-y-2">
                      <p className="font-medium">Recommendations:</p>
                      <ul className="space-y-1">
                        {spamAnalysisMutation.data.recommendations.map((rec, i) => (
                          <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                            <span>•</span>
                            <span>{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Recommendations */}
        <TabsContent value="recommendations">
          <Card>
            <CardHeader>
              <CardTitle>Deliverability Recommendations</CardTitle>
              <CardDescription>
                Action items to improve your email deliverability
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recommendations?.map((rec: any) => (
                  <div
                    key={rec.id}
                    className="p-4 rounded-lg border space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant={
                            rec.priority === 'critical' ? 'destructive' :
                            rec.priority === 'high' ? 'default' :
                            'secondary'
                          }>
                            {rec.priority}
                          </Badge>
                          <span className="font-medium">{rec.title}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {rec.description}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Impact</p>
                        <p className="font-medium">{rec.impact_score}/10</p>
                      </div>
                    </div>
                    
                    {rec.action_items && (
                      <div className="space-y-1">
                        <p className="text-sm font-medium">Action Items:</p>
                        <ul className="space-y-1">
                          {rec.action_items.map((item: string, i: number) => (
                            <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                              <CheckCircle className="h-3 w-3 mt-0.5" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {rec.estimated_improvement && (
                      <p className="text-sm text-green-600">
                        Expected improvement: {rec.estimated_improvement}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Authentication */}
        <TabsContent value="authentication">
          <Card>
            <CardHeader>
              <CardTitle>Email Authentication Setup</CardTitle>
              <CardDescription>
                Configure SPF, DKIM, and DMARC for better deliverability
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <Alert>
                  <Shield className="h-4 w-4" />
                  <AlertDescription>
                    Proper email authentication is crucial for deliverability. 
                    Add these DNS records to your domain to improve inbox placement.
                  </AlertDescription>
                </Alert>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <h4 className="font-medium">SPF Record</h4>
                    <code className="block p-3 bg-muted rounded text-sm">
                      v=spf1 include:amazonses.com ~all
                    </code>
                    <p className="text-sm text-muted-foreground">
                      Add this TXT record to your domain's DNS
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-medium">DKIM Setup</h4>
                    <p className="text-sm text-muted-foreground">
                      DKIM keys are automatically generated when you verify your domain in AWS SES
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-medium">DMARC Record</h4>
                    <code className="block p-3 bg-muted rounded text-sm">
                      v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdomain.com
                    </code>
                    <p className="text-sm text-muted-foreground">
                      Add this TXT record to _dmarc.yourdomain.com
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}