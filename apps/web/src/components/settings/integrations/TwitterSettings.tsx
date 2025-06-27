'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, Twitter, AlertCircle, CheckCircle, Users, MessageSquare, TrendingUp } from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import { toast } from 'sonner';
import { createClient } from '@/utils/supabase/client';
import { TwitterIntegration } from '@/lib/integrations/twitter';

export function TwitterSettings() {
  const { workspace } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [integration, setIntegration] = useState<TwitterIntegration | null>(null);
  const [stats, setStats] = useState<{
    profiles: number;
    messages: number;
    engagements: number;
  } | null>(null);
  const supabase = createClient();

  useEffect(() => {
    if (workspace?.id) {
      loadIntegration();
    }
  }, [workspace?.id]);

  const loadIntegration = async () => {
    if (!workspace?.id) return;

    try {
      // Get integration
      const { data: integrationData, error: integrationError } = await supabase
        .from('twitter_integrations')
        .select('*')
        .eq('workspace_id', workspace.id)
        .eq('is_active', true)
        .single();

      if (integrationError && integrationError.code !== 'PGRST116') {
        throw integrationError;
      }

      setIntegration(integrationData);

      // Get stats if connected
      if (integrationData) {
        const [profilesResult, messagesResult, engagementsResult] = await Promise.all([
          supabase
            .from('twitter_profiles')
            .select('id', { count: 'exact' })
            .eq('workspace_id', workspace.id),
          supabase
            .from('twitter_messages')
            .select('id', { count: 'exact' })
            .eq('workspace_id', workspace.id),
          supabase
            .from('twitter_engagements')
            .select('id', { count: 'exact' })
            .eq('workspace_id', workspace.id),
        ]);

        setStats({
          profiles: profilesResult.count || 0,
          messages: messagesResult.count || 0,
          engagements: engagementsResult.count || 0,
        });
      }
    } catch (error) {
      console.error('Failed to load Twitter integration:', error);
    }
  };

  const handleConnect = async () => {
    if (!workspace?.id) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/integrations/twitter/auth?workspace_id=${workspace.id}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to initialize Twitter authentication');
      }

      // Redirect to Twitter OAuth
      window.location.href = data.authUrl;
    } catch (error) {
      console.error('Twitter connection error:', error);
      toast.error('Failed to connect Twitter account');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!workspace?.id || !integration) return;

    setLoading(true);
    try {
      const response = await fetch('/api/integrations/twitter/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: workspace.id }),
      });

      if (!response.ok) {
        throw new Error('Failed to disconnect Twitter account');
      }

      toast.success('Twitter account disconnected');
      setIntegration(null);
      setStats(null);
    } catch (error) {
      console.error('Twitter disconnect error:', error);
      toast.error('Failed to disconnect Twitter account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Twitter className="h-5 w-5" />
            <CardTitle>Twitter/X Integration</CardTitle>
          </div>
          {integration && (
            <Badge variant="default" className="flex items-center gap-1">
              <CheckCircle className="h-3 w-3" />
              Connected
            </Badge>
          )}
        </div>
        <CardDescription>
          Connect your Twitter/X account to enable social outreach and engagement
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {integration ? (
          <>
            <div className="flex items-center gap-4">
              {integration.profile_image_url && (
                <img
                  src={integration.profile_image_url}
                  alt={integration.display_name || integration.username}
                  className="h-12 w-12 rounded-full"
                />
              )}
              <div>
                <p className="font-medium">
                  {integration.display_name || integration.username}
                </p>
                <p className="text-sm text-muted-foreground">
                  @{integration.username}
                  {integration.verified && (
                    <Badge variant="secondary" className="ml-2 text-xs">
                      Verified
                    </Badge>
                  )}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-2">
              <div className="text-center">
                <p className="text-2xl font-semibold">{integration.followers_count.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Followers</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-semibold">{stats?.messages || 0}</p>
                <p className="text-xs text-muted-foreground">Messages Sent</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-semibold">{stats?.engagements || 0}</p>
                <p className="text-xs text-muted-foreground">Engagements</p>
              </div>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Daily limits: {integration.daily_dm_limit} DMs, {integration.daily_tweet_limit} tweets, {integration.daily_follow_limit} follows
              </AlertDescription>
            </Alert>

            {stats && stats.profiles > 0 && (
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    Imported Profiles
                  </span>
                  <span className="font-medium">{stats.profiles.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    Total Messages
                  </span>
                  <span className="font-medium">{stats.messages.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    Total Engagements
                  </span>
                  <span className="font-medium">{stats.engagements.toLocaleString()}</span>
                </div>
              </div>
            )}
          </>
        ) : (
          <Alert>
            <Twitter className="h-4 w-4" />
            <AlertDescription>
              Connect your Twitter/X account to:
              <ul className="mt-2 space-y-1 text-sm">
                <li>• Send personalized direct messages</li>
                <li>• Auto-follow and engage with prospects</li>
                <li>• Monitor mentions and replies</li>
                <li>• Track social engagement metrics</li>
              </ul>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>

      <CardFooter>
        {integration ? (
          <Button
            onClick={handleDisconnect}
            variant="destructive"
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Disconnecting...
              </>
            ) : (
              'Disconnect Twitter'
            )}
          </Button>
        ) : (
          <Button
            onClick={handleConnect}
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Twitter className="mr-2 h-4 w-4" />
                Connect Twitter
              </>
            )}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}