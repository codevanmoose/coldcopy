'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Cloud,
  CloudOff,
  RefreshCw,
  Settings,
  Zap,
  AlertCircle,
  CheckCircle,
  Users,
  Target,
  Mail,
  Activity,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Loader2,
  Info,
  Calendar,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { SalesforceIntegration, SalesforceSyncLog } from '@/lib/integrations/salesforce/types';

interface SalesforceIntegrationProps {
  className?: string;
}

export function SalesforceIntegration({ className }: SalesforceIntegrationProps) {
  const { workspace } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [integration, setIntegration] = useState<SalesforceIntegration | null>(null);
  const [syncStatus, setSyncStatus] = useState<any>(null);
  const [syncSettings, setSyncSettings] = useState({
    sync_enabled: true,
    sync_direction: 'bidirectional' as 'to_salesforce' | 'from_salesforce' | 'bidirectional',
    sync_leads: true,
    sync_contacts: true,
    sync_accounts: true,
    sync_opportunities: true,
    sync_activities: true,
    sync_campaigns: true,
    sync_frequency_minutes: 15,
  });

  useEffect(() => {
    if (workspace?.id) {
      fetchIntegration();
      fetchSyncStatus();
    }
  }, [workspace?.id]);

  const fetchIntegration = async () => {
    if (!workspace?.id) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/salesforce/integration?workspace_id=${workspace.id}`);
      if (response.ok) {
        const data = await response.json();
        setIntegration(data.integration);
        if (data.integration) {
          setSyncSettings({
            sync_enabled: data.integration.sync_enabled,
            sync_direction: data.integration.sync_direction,
            sync_leads: data.integration.sync_leads,
            sync_contacts: data.integration.sync_contacts,
            sync_accounts: data.integration.sync_accounts,
            sync_opportunities: data.integration.sync_opportunities,
            sync_activities: data.integration.sync_activities,
            sync_campaigns: data.integration.sync_campaigns,
            sync_frequency_minutes: data.integration.sync_frequency_minutes,
          });
        }
      }
    } catch (error) {
      console.error('Error fetching Salesforce integration:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSyncStatus = async () => {
    if (!workspace?.id) return;

    try {
      const response = await fetch(`/api/salesforce/sync?workspace_id=${workspace.id}`);
      if (response.ok) {
        const data = await response.json();
        setSyncStatus(data);
      }
    } catch (error) {
      console.error('Error fetching sync status:', error);
    }
  };

  const connectSalesforce = async () => {
    if (!workspace?.id) return;

    setConnecting(true);
    try {
      const response = await fetch(
        `/api/salesforce/auth?workspace_id=${workspace.id}&action=connect`
      );
      
      if (!response.ok) {
        throw new Error('Failed to get authorization URL');
      }

      const data = await response.json();
      
      // Redirect to Salesforce OAuth
      window.location.href = data.auth_url;
    } catch (error) {
      console.error('Error connecting to Salesforce:', error);
      toast.error('Failed to connect to Salesforce');
      setConnecting(false);
    }
  };

  const disconnectSalesforce = async () => {
    if (!workspace?.id || !confirm('Are you sure you want to disconnect Salesforce?')) return;

    setLoading(true);
    try {
      const response = await fetch(
        `/api/salesforce/auth?workspace_id=${workspace.id}&action=disconnect`
      );
      
      if (!response.ok) {
        throw new Error('Failed to disconnect');
      }

      setIntegration(null);
      setSyncStatus(null);
      toast.success('Salesforce disconnected successfully');
    } catch (error) {
      console.error('Error disconnecting Salesforce:', error);
      toast.error('Failed to disconnect Salesforce');
    } finally {
      setLoading(false);
    }
  };

  const updateSyncSettings = async () => {
    if (!workspace?.id || !integration) return;

    try {
      const response = await fetch(`/api/salesforce/integration`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspace.id,
          settings: syncSettings,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update settings');
      }

      toast.success('Sync settings updated');
      fetchIntegration();
    } catch (error) {
      console.error('Error updating sync settings:', error);
      toast.error('Failed to update sync settings');
    }
  };

  const triggerSync = async (syncType: string = 'manual') => {
    if (!workspace?.id || !integration) return;

    setSyncing(true);
    try {
      const response = await fetch('/api/salesforce/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspace.id,
          sync_type: syncType,
          sync_direction: syncSettings.sync_direction,
          object_types: [
            syncSettings.sync_leads && 'Lead',
            syncSettings.sync_campaigns && 'Campaign',
            syncSettings.sync_activities && 'Task',
          ].filter(Boolean),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to trigger sync');
      }

      const data = await response.json();
      toast.success('Sync completed successfully');
      
      // Refresh sync status
      fetchSyncStatus();
    } catch (error) {
      console.error('Error triggering sync:', error);
      toast.error('Failed to sync with Salesforce');
    } finally {
      setSyncing(false);
    }
  };

  const getSyncDirectionIcon = () => {
    switch (syncSettings.sync_direction) {
      case 'to_salesforce':
        return <ArrowUp className="h-4 w-4" />;
      case 'from_salesforce':
        return <ArrowDown className="h-4 w-4" />;
      case 'bidirectional':
        return <ArrowUpDown className="h-4 w-4" />;
    }
  };

  const getSyncDirectionLabel = () => {
    switch (syncSettings.sync_direction) {
      case 'to_salesforce':
        return 'To Salesforce';
      case 'from_salesforce':
        return 'From Salesforce';
      case 'bidirectional':
        return 'Bidirectional';
    }
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Cloud className="h-6 w-6 text-blue-500" />
            </div>
            <div>
              <CardTitle>Salesforce Integration</CardTitle>
              <CardDescription>
                Sync leads, campaigns, and activities with Salesforce CRM
              </CardDescription>
            </div>
          </div>
          {integration && (
            <Badge variant={integration.is_active ? 'default' : 'secondary'}>
              {integration.is_active ? 'Connected' : 'Disconnected'}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {!integration ? (
          <div className="space-y-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Connect your Salesforce account to sync leads, campaigns, and activities
                between ColdCopy and Salesforce.
              </AlertDescription>
            </Alert>

            <Button
              onClick={connectSalesforce}
              disabled={connecting}
              className="w-full"
            >
              {connecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Cloud className="mr-2 h-4 w-4" />
                  Connect Salesforce
                </>
              )}
            </Button>
          </div>
        ) : (
          <Tabs defaultValue="sync" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="sync">Sync</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
              <TabsTrigger value="logs">Logs</TabsTrigger>
            </TabsList>

            <TabsContent value="sync" className="space-y-4">
              {/* Sync Status */}
              <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Sync Status</h4>
                  {syncStatus?.is_syncing ? (
                    <Badge variant="secondary">
                      <RefreshCw className="mr-1 h-3 w-3 animate-spin" />
                      Syncing...
                    </Badge>
                  ) : (
                    <Badge variant="outline">
                      <CheckCircle className="mr-1 h-3 w-3" />
                      Ready
                    </Badge>
                  )}
                </div>

                {syncStatus && (
                  <div className="grid gap-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Last sync:</span>
                      <span>
                        {syncStatus.last_sync_at
                          ? format(new Date(syncStatus.last_sync_at), 'MMM d, yyyy h:mm a')
                          : 'Never'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Objects pending:</span>
                      <span>{syncStatus.objects_pending || 0}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Sync Direction */}
              <div className="space-y-2">
                <Label>Sync Direction</Label>
                <div className="flex items-center gap-2 p-3 rounded-lg border bg-muted/50">
                  {getSyncDirectionIcon()}
                  <span className="font-medium">{getSyncDirectionLabel()}</span>
                  <span className="text-sm text-muted-foreground ml-auto">
                    {syncSettings.sync_direction === 'bidirectional'
                      ? 'Two-way sync'
                      : syncSettings.sync_direction === 'to_salesforce'
                      ? 'Push to Salesforce'
                      : 'Pull from Salesforce'}
                  </span>
                </div>
              </div>

              {/* Object Types */}
              <div className="space-y-2">
                <Label>Objects to Sync</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 p-3 rounded-lg border">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Leads</span>
                    {syncSettings.sync_leads && (
                      <CheckCircle className="h-4 w-4 text-green-500 ml-auto" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 p-3 rounded-lg border">
                    <Target className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Campaigns</span>
                    {syncSettings.sync_campaigns && (
                      <CheckCircle className="h-4 w-4 text-green-500 ml-auto" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 p-3 rounded-lg border">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Activities</span>
                    {syncSettings.sync_activities && (
                      <CheckCircle className="h-4 w-4 text-green-500 ml-auto" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 p-3 rounded-lg border">
                    <Activity className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Opportunities</span>
                    {syncSettings.sync_opportunities && (
                      <CheckCircle className="h-4 w-4 text-green-500 ml-auto" />
                    )}
                  </div>
                </div>
              </div>

              {/* Sync Actions */}
              <div className="flex gap-2">
                <Button
                  onClick={() => triggerSync('manual')}
                  disabled={syncing || !syncSettings.sync_enabled}
                  className="flex-1"
                >
                  {syncing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Syncing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Sync Now
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={fetchSyncStatus}
                  disabled={syncing}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="settings" className="space-y-4">
              {/* Sync Toggle */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable Sync</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically sync data with Salesforce
                  </p>
                </div>
                <Switch
                  checked={syncSettings.sync_enabled}
                  onCheckedChange={(checked) =>
                    setSyncSettings({ ...syncSettings, sync_enabled: checked })
                  }
                />
              </div>

              {/* Sync Direction */}
              <div className="space-y-2">
                <Label>Sync Direction</Label>
                <Select
                  value={syncSettings.sync_direction}
                  onValueChange={(value: any) =>
                    setSyncSettings({ ...syncSettings, sync_direction: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="to_salesforce">To Salesforce Only</SelectItem>
                    <SelectItem value="from_salesforce">From Salesforce Only</SelectItem>
                    <SelectItem value="bidirectional">Bidirectional</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Sync Frequency */}
              <div className="space-y-2">
                <Label>Sync Frequency</Label>
                <Select
                  value={String(syncSettings.sync_frequency_minutes)}
                  onValueChange={(value) =>
                    setSyncSettings({ ...syncSettings, sync_frequency_minutes: parseInt(value) })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">Every 5 minutes</SelectItem>
                    <SelectItem value="15">Every 15 minutes</SelectItem>
                    <SelectItem value="30">Every 30 minutes</SelectItem>
                    <SelectItem value="60">Every hour</SelectItem>
                    <SelectItem value="360">Every 6 hours</SelectItem>
                    <SelectItem value="1440">Daily</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Object Settings */}
              <div className="space-y-3">
                <Label>Objects to Sync</Label>
                <div className="space-y-2">
                  {[
                    { key: 'sync_leads', label: 'Leads', icon: Users },
                    { key: 'sync_campaigns', label: 'Campaigns', icon: Target },
                    { key: 'sync_activities', label: 'Activities', icon: Mail },
                    { key: 'sync_contacts', label: 'Contacts', icon: Users },
                    { key: 'sync_accounts', label: 'Accounts', icon: Activity },
                    { key: 'sync_opportunities', label: 'Opportunities', icon: Zap },
                  ].map(({ key, label, icon: Icon }) => (
                    <div key={key} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{label}</span>
                      </div>
                      <Switch
                        checked={syncSettings[key as keyof typeof syncSettings] as boolean}
                        onCheckedChange={(checked) =>
                          setSyncSettings({ ...syncSettings, [key]: checked })
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Save Settings */}
              <Button onClick={updateSyncSettings} className="w-full">
                Save Settings
              </Button>

              {/* Disconnect */}
              <div className="pt-4 border-t">
                <Button
                  variant="destructive"
                  onClick={disconnectSalesforce}
                  className="w-full"
                >
                  <CloudOff className="mr-2 h-4 w-4" />
                  Disconnect Salesforce
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="logs" className="space-y-4">
              {syncStatus?.recent_logs && syncStatus.recent_logs.length > 0 ? (
                <div className="space-y-3">
                  {syncStatus.recent_logs.map((log: SalesforceSyncLog) => (
                    <div
                      key={log.id}
                      className="rounded-lg border p-4 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={log.status === 'completed' ? 'default' : 'destructive'}
                          >
                            {log.status}
                          </Badge>
                          <span className="text-sm font-medium">
                            {log.sync_type} sync
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(log.started_at), 'MMM d, h:mm a')}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Total: </span>
                          <span className="font-medium">{log.total_records}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Success: </span>
                          <span className="font-medium text-green-600">
                            {log.created_records + log.updated_records}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Failed: </span>
                          <span className="font-medium text-red-600">
                            {log.failed_records}
                          </span>
                        </div>
                      </div>
                      {log.error_message && (
                        <Alert variant="destructive" className="mt-2">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>{log.error_message}</AlertDescription>
                        </Alert>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No sync logs available
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}