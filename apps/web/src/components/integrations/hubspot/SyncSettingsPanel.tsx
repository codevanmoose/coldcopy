'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { 
  Save, Loader2, AlertCircle, PlayCircle, PauseCircle, RefreshCw, 
  Clock, Calendar, ArrowUpDown, CheckCircle, XCircle, BarChart3,
  Zap, Database, ArrowRight, ArrowLeft, ArrowLeftRight 
} from 'lucide-react';
import { SyncSettings, SyncHistory } from './types';
import { useToast } from '@/components/ui/use-toast';
import { format, formatDistanceToNow } from 'date-fns';

const ACTIVITY_TYPES = [
  { value: 'email_sent', label: 'Email Sent' },
  { value: 'email_opened', label: 'Email Opened' },
  { value: 'email_clicked', label: 'Email Clicked' },
  { value: 'email_replied', label: 'Email Replied' },
  { value: 'email_bounced', label: 'Email Bounced' },
  { value: 'lead_created', label: 'Lead Created' },
  { value: 'lead_updated', label: 'Lead Updated' },
  { value: 'lead_enriched', label: 'Lead Enriched' },
];

export function SyncSettingsPanel() {
  const [settings, setSettings] = useState<SyncSettings>({
    enabled: false,
    syncInterval: 30,
    syncDirection: 'bidirectional',
    autoCreateContacts: true,
    autoLogActivities: true,
    activityTypes: ['email_sent', 'email_opened', 'email_clicked', 'email_replied'],
    batchSize: 100,
    retryAttempts: 3,
    customPropertyPrefix: 'coldcopy_',
  });
  const [syncHistory, setSyncHistory] = useState<SyncHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState('settings');
  const { toast } = useToast();

  useEffect(() => {
    fetchSyncSettings();
    fetchSyncHistory();
  }, []);

  const fetchSyncSettings = async () => {
    try {
      const response = await fetch('/api/integrations/hubspot/sync/settings');
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      }
    } catch (error) {
      console.error('Error fetching sync settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to load sync settings',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSyncHistory = async () => {
    try {
      const response = await fetch('/api/integrations/hubspot/sync/history');
      if (response.ok) {
        const data = await response.json();
        setSyncHistory(data);
      }
    } catch (error) {
      console.error('Error fetching sync history:', error);
    }
  };

  const handleSaveSettings = async () => {
    try {
      setIsSaving(true);
      const response = await fetch('/api/integrations/hubspot/sync/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Sync settings saved successfully',
        });
      } else {
        throw new Error('Failed to save settings');
      }
    } catch (error) {
      console.error('Error saving sync settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to save sync settings',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleManualSync = async () => {
    try {
      setIsSyncing(true);
      const response = await fetch('/api/integrations/hubspot/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direction: settings.syncDirection }),
      });

      if (response.ok) {
        const result = await response.json();
        toast({
          title: 'Sync Started',
          description: `Sync job started. Job ID: ${result.jobId}`,
        });
        // Refresh history after a delay
        setTimeout(() => fetchSyncHistory(), 2000);
      } else {
        throw new Error('Failed to start sync');
      }
    } catch (error) {
      console.error('Error starting sync:', error);
      toast({
        title: 'Error',
        description: 'Failed to start sync',
        variant: 'destructive',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const getDirectionIcon = (direction: string) => {
    switch (direction) {
      case 'to_hubspot':
        return <ArrowRight className="h-4 w-4" />;
      case 'from_hubspot':
        return <ArrowLeft className="h-4 w-4" />;
      case 'bidirectional':
        return <ArrowLeftRight className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="success">Completed</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'in_progress':
        return <Badge variant="secondary">In Progress</Badge>;
      case 'pending':
        return <Badge variant="outline">Pending</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="history">Sync History</TabsTrigger>
          <TabsTrigger value="statistics">Statistics</TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Sync Configuration</CardTitle>
                  <CardDescription>
                    Configure how data syncs between ColdCopy and HubSpot
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={handleManualSync}
                    disabled={!settings.enabled || isSyncing}
                  >
                    {isSyncing ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <PlayCircle className="h-4 w-4 mr-2" />
                    )}
                    Sync Now
                  </Button>
                  <Button
                    onClick={handleSaveSettings}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Save Settings
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable Automatic Sync</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically sync data at regular intervals
                  </p>
                </div>
                <Switch
                  checked={settings.enabled}
                  onCheckedChange={(checked) => setSettings({ ...settings, enabled: checked })}
                />
              </div>

              <div className="space-y-2">
                <Label>Sync Direction</Label>
                <Select
                  value={settings.syncDirection}
                  onValueChange={(value: any) => setSettings({ ...settings, syncDirection: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="to_hubspot">
                      <div className="flex items-center gap-2">
                        <ArrowRight className="h-4 w-4" />
                        ColdCopy → HubSpot
                      </div>
                    </SelectItem>
                    <SelectItem value="from_hubspot">
                      <div className="flex items-center gap-2">
                        <ArrowLeft className="h-4 w-4" />
                        HubSpot → ColdCopy
                      </div>
                    </SelectItem>
                    <SelectItem value="bidirectional">
                      <div className="flex items-center gap-2">
                        <ArrowLeftRight className="h-4 w-4" />
                        Bidirectional
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Sync Interval (minutes)</Label>
                <div className="flex items-center gap-4">
                  <Slider
                    value={[settings.syncInterval]}
                    onValueChange={([value]) => setSettings({ ...settings, syncInterval: value })}
                    min={5}
                    max={360}
                    step={5}
                    className="flex-1"
                    disabled={!settings.enabled}
                  />
                  <span className="w-16 text-right font-medium">
                    {settings.syncInterval} min
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  How often to check for changes and sync data
                </p>
              </div>

              <div className="space-y-4">
                <h4 className="text-sm font-medium">Contact Settings</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Auto-create Contacts</Label>
                      <p className="text-sm text-muted-foreground">
                        Automatically create HubSpot contacts for new leads
                      </p>
                    </div>
                    <Switch
                      checked={settings.autoCreateContacts}
                      onCheckedChange={(checked) => 
                        setSettings({ ...settings, autoCreateContacts: checked })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Auto-log Activities</Label>
                      <p className="text-sm text-muted-foreground">
                        Log email activities as HubSpot engagements
                      </p>
                    </div>
                    <Switch
                      checked={settings.autoLogActivities}
                      onCheckedChange={(checked) => 
                        setSettings({ ...settings, autoLogActivities: checked })
                      }
                    />
                  </div>
                </div>
              </div>

              {settings.autoLogActivities && (
                <div className="space-y-2">
                  <Label>Activity Types to Sync</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {ACTIVITY_TYPES.map((type) => (
                      <div key={type.value} className="flex items-center space-x-2">
                        <Switch
                          checked={settings.activityTypes.includes(type.value)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSettings({
                                ...settings,
                                activityTypes: [...settings.activityTypes, type.value],
                              });
                            } else {
                              setSettings({
                                ...settings,
                                activityTypes: settings.activityTypes.filter(t => t !== type.value),
                              });
                            }
                          }}
                        />
                        <Label className="font-normal cursor-pointer">
                          {type.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <h4 className="text-sm font-medium">Advanced Settings</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Batch Size</Label>
                    <Input
                      type="number"
                      value={settings.batchSize}
                      onChange={(e) => setSettings({ ...settings, batchSize: parseInt(e.target.value) || 100 })}
                      min={10}
                      max={500}
                    />
                    <p className="text-xs text-muted-foreground">
                      Records per sync batch
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Retry Attempts</Label>
                    <Input
                      type="number"
                      value={settings.retryAttempts}
                      onChange={(e) => setSettings({ ...settings, retryAttempts: parseInt(e.target.value) || 3 })}
                      min={0}
                      max={5}
                    />
                    <p className="text-xs text-muted-foreground">
                      Failed sync retry attempts
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Custom Property Prefix</Label>
                  <Input
                    value={settings.customPropertyPrefix}
                    onChange={(e) => setSettings({ ...settings, customPropertyPrefix: e.target.value })}
                    placeholder="e.g., coldcopy_"
                  />
                  <p className="text-xs text-muted-foreground">
                    Prefix for custom properties created in HubSpot
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Sync History</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchSyncHistory}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {syncHistory.length === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No sync history available. Run your first sync to see activity here.
                  </AlertDescription>
                </Alert>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Started</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Direction</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Records</TableHead>
                      <TableHead>Duration</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {syncHistory.map((sync) => (
                      <TableRow key={sync.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-sm">
                                {format(new Date(sync.startedAt), 'MMM d, yyyy')}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(sync.startedAt), 'h:mm a')}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {sync.syncType}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getDirectionIcon(sync.direction)}
                            <span className="text-sm capitalize">
                              {sync.direction.replace('_', ' ')}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(sync.status)}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-sm">
                              <CheckCircle className="h-3 w-3 text-green-600" />
                              {sync.recordsProcessed - sync.recordsFailed}
                            </div>
                            {sync.recordsFailed > 0 && (
                              <div className="flex items-center gap-2 text-sm text-destructive">
                                <XCircle className="h-3 w-3" />
                                {sync.recordsFailed}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {sync.duration ? (
                            <span className="text-sm">
                              {Math.round(sync.duration / 1000)}s
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="statistics" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Syncs
                </CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{syncHistory.length}</div>
                <p className="text-xs text-muted-foreground">
                  All time sync operations
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Success Rate
                </CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {syncHistory.length > 0
                    ? Math.round(
                        (syncHistory.filter(s => s.status === 'completed').length / 
                         syncHistory.length) * 100
                      )
                    : 0}%
                </div>
                <p className="text-xs text-muted-foreground">
                  Successful sync operations
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Last Sync
                </CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {syncHistory.length > 0
                    ? formatDistanceToNow(new Date(syncHistory[0].startedAt), { addSuffix: true })
                    : 'Never'}
                </div>
                <p className="text-xs text-muted-foreground">
                  Most recent sync operation
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Sync Performance</CardTitle>
              <CardDescription>
                Average sync duration and record processing rate
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Average Duration</span>
                    <span className="text-sm text-muted-foreground">
                      {syncHistory.length > 0
                        ? Math.round(
                            syncHistory
                              .filter(s => s.duration)
                              .reduce((acc, s) => acc + (s.duration || 0), 0) /
                            syncHistory.filter(s => s.duration).length / 1000
                          )
                        : 0}s
                    </span>
                  </div>
                  <Progress value={65} />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Records/Second</span>
                    <span className="text-sm text-muted-foreground">
                      {syncHistory.length > 0
                        ? Math.round(
                            syncHistory
                              .filter(s => s.duration && s.recordsProcessed > 0)
                              .reduce((acc, s) => 
                                acc + (s.recordsProcessed / (s.duration! / 1000)), 0
                              ) / syncHistory.filter(s => s.duration && s.recordsProcessed > 0).length
                          )
                        : 0}
                    </span>
                  </div>
                  <Progress value={45} />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}