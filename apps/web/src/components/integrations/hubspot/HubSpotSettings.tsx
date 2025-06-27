'use client';

import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, AlertCircle, CheckCircle, RefreshCw, Settings, Unplug } from 'lucide-react';
import { ConnectionStatus } from './ConnectionStatus';
import { FieldMappingManager } from './FieldMappingManager';
import { WorkflowConfig } from './WorkflowConfig';
import { WebhookManager } from './WebhookManager';
import { SyncSettingsPanel } from './SyncSettingsPanel';
import { ErrorLogsViewer } from './ErrorLogsViewer';
import { HubSpotConnectionStatus } from './types';
import { useToast } from '@/components/ui/use-toast';

export function HubSpotSettings() {
  const [connectionStatus, setConnectionStatus] = useState<HubSpotConnectionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('connection');
  const { toast } = useToast();

  useEffect(() => {
    fetchConnectionStatus();
  }, []);

  const fetchConnectionStatus = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/integrations/hubspot/config');
      if (response.ok) {
        const data = await response.json();
        setConnectionStatus(data);
      } else if (response.status === 404) {
        setConnectionStatus({ connected: false });
      } else {
        throw new Error('Failed to fetch connection status');
      }
    } catch (error) {
      console.error('Error fetching connection status:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch HubSpot connection status',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      const response = await fetch('/api/integrations/hubspot/auth');
      const data = await response.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch (error) {
      console.error('Error initiating HubSpot connection:', error);
      toast({
        title: 'Error',
        description: 'Failed to initiate HubSpot connection',
        variant: 'destructive',
      });
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect from HubSpot? This will stop all syncing and webhooks.')) {
      return;
    }

    try {
      const response = await fetch('/api/integrations/hubspot/disconnect', {
        method: 'POST',
      });
      
      if (response.ok) {
        setConnectionStatus({ connected: false });
        toast({
          title: 'Success',
          description: 'Successfully disconnected from HubSpot',
        });
      } else {
        throw new Error('Failed to disconnect');
      }
    } catch (error) {
      console.error('Error disconnecting from HubSpot:', error);
      toast({
        title: 'Error',
        description: 'Failed to disconnect from HubSpot',
        variant: 'destructive',
      });
    }
  };

  const handleRefreshConnection = async () => {
    setIsRefreshing(true);
    await fetchConnectionStatus();
    setIsRefreshing(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">HubSpot Integration</h2>
          <p className="text-muted-foreground">
            Manage your HubSpot connection, field mappings, and sync settings
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          {connectionStatus?.connected && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefreshConnection}
                disabled={isRefreshing}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisconnect}
              >
                <Unplug className="h-4 w-4 mr-2" />
                Disconnect
              </Button>
            </>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <CardTitle>Connection Status</CardTitle>
              {connectionStatus?.connected ? (
                <Badge variant="success">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Connected
                </Badge>
              ) : (
                <Badge variant="secondary">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Not Connected
                </Badge>
              )}
            </div>
          </div>
          <CardDescription>
            {connectionStatus?.connected
              ? `Connected to HubSpot portal: ${connectionStatus.portalName || connectionStatus.hubId}`
              : 'Connect your HubSpot account to enable syncing'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!connectionStatus?.connected ? (
            <div className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Connect to HubSpot</AlertTitle>
                <AlertDescription>
                  Connect your HubSpot account to sync contacts, track engagement, and automate workflows.
                </AlertDescription>
              </Alert>
              <Button onClick={handleConnect} className="w-full sm:w-auto">
                <Settings className="h-4 w-4 mr-2" />
                Connect HubSpot Account
              </Button>
            </div>
          ) : (
            <ConnectionStatus status={connectionStatus} />
          )}
        </CardContent>
      </Card>

      {connectionStatus?.connected && (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="field-mapping">Field Mapping</TabsTrigger>
            <TabsTrigger value="workflows">Workflows</TabsTrigger>
            <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
            <TabsTrigger value="sync">Sync Settings</TabsTrigger>
            <TabsTrigger value="logs">Error Logs</TabsTrigger>
          </TabsList>

          <TabsContent value="field-mapping" className="space-y-4">
            <FieldMappingManager />
          </TabsContent>

          <TabsContent value="workflows" className="space-y-4">
            <WorkflowConfig />
          </TabsContent>

          <TabsContent value="webhooks" className="space-y-4">
            <WebhookManager />
          </TabsContent>

          <TabsContent value="sync" className="space-y-4">
            <SyncSettingsPanel />
          </TabsContent>

          <TabsContent value="logs" className="space-y-4">
            <ErrorLogsViewer />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}