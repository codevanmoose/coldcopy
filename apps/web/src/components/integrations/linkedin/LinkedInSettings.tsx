'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Linkedin, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';
import { LinkedInIntegration, LinkedInConnectionSettings } from '@/lib/integrations/linkedin/types';

interface LinkedInSettingsProps {
  workspaceId: string;
}

export function LinkedInSettings({ workspaceId }: LinkedInSettingsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isConnecting, setIsConnecting] = useState(false);

  // Fetch LinkedIn integration status
  const { data: integration, isLoading } = useQuery({
    queryKey: ['linkedin-integration', workspaceId],
    queryFn: async () => {
      const response = await fetch(`/api/integrations/linkedin/status?workspace_id=${workspaceId}`);
      if (!response.ok) throw new Error('Failed to fetch LinkedIn status');
      const data = await response.json();
      return data.integration as LinkedInIntegration | null;
    },
  });

  // Connect LinkedIn mutation
  const connectMutation = useMutation({
    mutationFn: async () => {
      setIsConnecting(true);
      window.location.href = `/api/integrations/linkedin/connect?workspace_id=${workspaceId}`;
    },
  });

  // Disconnect LinkedIn mutation
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/integrations/linkedin/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspaceId }),
      });
      if (!response.ok) throw new Error('Failed to disconnect LinkedIn');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['linkedin-integration', workspaceId] });
      toast({
        title: 'LinkedIn Disconnected',
        description: 'Your LinkedIn integration has been disconnected.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to disconnect LinkedIn integration.',
        variant: 'destructive',
      });
    },
  });

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (settings: Partial<LinkedInConnectionSettings>) => {
      const response = await fetch('/api/integrations/linkedin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspaceId, settings }),
      });
      if (!response.ok) throw new Error('Failed to update settings');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['linkedin-integration', workspaceId] });
      toast({
        title: 'Settings Updated',
        description: 'LinkedIn settings have been updated successfully.',
      });
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!integration) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Linkedin className="h-8 w-8 text-[#0077B5]" />
            <div>
              <CardTitle>Connect LinkedIn</CardTitle>
              <CardDescription>
                Send personalized connection requests and messages through LinkedIn
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="rounded-lg bg-muted p-4">
              <h4 className="font-medium mb-2">What you'll get:</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• Send connection requests with personalized notes</li>
                <li>• Send InMails and messages to connections</li>
                <li>• Enrich leads with LinkedIn profile data</li>
                <li>• Track engagement and response rates</li>
                <li>• Sync connections for targeted outreach</li>
              </ul>
            </div>
            
            <Button
              onClick={() => connectMutation.mutate()}
              disabled={isConnecting}
              className="w-full"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting to LinkedIn...
                </>
              ) : (
                <>
                  <Linkedin className="mr-2 h-4 w-4" />
                  Connect LinkedIn Account
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Linkedin className="h-8 w-8 text-[#0077B5]" />
            <div>
              <CardTitle>LinkedIn Integration</CardTitle>
              <CardDescription>
                Connected as {integration.full_name}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <span className="text-sm text-green-500">Connected</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Account Info */}
        <div className="space-y-2">
          <Label>Account Details</Label>
          <div className="rounded-lg border p-4 space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Email</span>
              <span className="text-sm">{integration.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">LinkedIn ID</span>
              <span className="text-sm">{integration.linkedin_user_id}</span>
            </div>
            {integration.profile_url && (
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Profile</span>
                <a
                  href={integration.profile_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline flex items-center gap-1"
                >
                  View Profile
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Daily Limits */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="connection-limit">
              Daily Connection Requests: {integration.daily_connection_limit}
            </Label>
            <Slider
              id="connection-limit"
              min={10}
              max={200}
              step={10}
              value={[integration.daily_connection_limit]}
              onValueChange={(value) => {
                updateSettingsMutation.mutate({
                  dailyConnectionLimit: value[0],
                });
              }}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              LinkedIn recommends staying under 100 connections per day to avoid restrictions
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message-limit">
              Daily Messages: {integration.daily_message_limit}
            </Label>
            <Slider
              id="message-limit"
              min={10}
              max={150}
              step={10}
              value={[integration.daily_message_limit]}
              onValueChange={(value) => {
                updateSettingsMutation.mutate({
                  dailyMessageLimit: value[0],
                });
              }}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Stay under 50 messages per day for optimal deliverability
            </p>
          </div>
        </div>

        {/* Sync Settings */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="sync-enabled">Auto-sync Connections</Label>
              <p className="text-xs text-muted-foreground">
                Automatically sync your LinkedIn connections daily
              </p>
            </div>
            <Switch
              id="sync-enabled"
              checked={integration.sync_enabled}
              onCheckedChange={(checked) => {
                updateSettingsMutation.mutate({ syncEnabled: checked });
              }}
            />
          </div>
        </div>

        {/* Permissions */}
        <div className="space-y-2">
          <Label>Granted Permissions</Label>
          <div className="rounded-lg border p-4">
            <div className="flex flex-wrap gap-2">
              {integration.scopes.map((scope) => (
                <span
                  key={scope}
                  className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
                >
                  {scope}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Disconnect Button */}
        <div className="pt-4 border-t">
          <Button
            variant="destructive"
            onClick={() => {
              if (confirm('Are you sure you want to disconnect your LinkedIn account?')) {
                disconnectMutation.mutate();
              }
            }}
            disabled={disconnectMutation.isPending}
            className="w-full"
          >
            {disconnectMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Disconnecting...
              </>
            ) : (
              'Disconnect LinkedIn'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}