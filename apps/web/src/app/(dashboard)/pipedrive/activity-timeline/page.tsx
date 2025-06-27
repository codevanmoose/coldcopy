'use client';

import { useState } from 'react';
import { ActivityTimelineView } from '@/components/pipedrive/activity-timeline-view';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useActivityTimeline } from '@/hooks/use-activity-timeline';
import { ActivityCategory } from '@/lib/integrations/pipedrive/activity-timeline';
import { Calendar, Users, Target, BarChart3, Search } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

export default function ActivityTimelinePage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLead, setSelectedLead] = useState<string | undefined>();
  const [selectedCampaign, setSelectedCampaign] = useState<string | undefined>();

  // Example usage of the timeline hook
  const {
    activities,
    threads,
    summary,
    isLoading,
    syncing,
    syncProgress,
    startSync,
    getAnalytics,
  } = useActivityTimeline({
    leadId: selectedLead,
    campaignId: selectedCampaign,
    includeThreads: true,
    limit: 100,
  });

  // Handle sync button click
  const handleSync = () => {
    startSync({
      leadIds: selectedLead ? [selectedLead] : undefined,
      campaignIds: selectedCampaign ? [selectedCampaign] : undefined,
      includeHistorical: true,
      batchSize: 50,
    });
  };

  // Handle activity click
  const handleActivityClick = (activity: any) => {
    console.log('Activity clicked:', activity);
    // Navigate to Pipedrive or show activity details
  };

  // Handle thread click
  const handleThreadClick = (thread: any) => {
    console.log('Thread clicked:', thread);
    // Show thread details or conversation view
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Activity Timeline</h1>
          <p className="text-muted-foreground">
            Complete email history and activity synchronization with Pipedrive
          </p>
        </div>
        <Button onClick={handleSync} disabled={syncing}>
          {syncing ? 'Syncing...' : 'Sync with Pipedrive'}
        </Button>
      </div>

      {/* Sync Progress Alert */}
      {syncProgress && (
        <Alert>
          <AlertTitle>Sync in Progress</AlertTitle>
          <AlertDescription>
            Syncing {syncProgress.totalActivities} activities... 
            {Math.round((syncProgress.syncedActivities / syncProgress.totalActivities) * 100)}% complete
          </AlertDescription>
        </Alert>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Activities</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? <Skeleton className="h-8 w-16" /> : (summary?.totalActivities || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Across all categories
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Engagement Score</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? <Skeleton className="h-8 w-16" /> : `${summary?.engagementScore || 0}%`}
            </div>
            <p className="text-xs text-muted-foreground">
              Overall engagement level
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Email Threads</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? <Skeleton className="h-8 w-16" /> : threads.length}
            </div>
            <p className="text-xs text-muted-foreground">
              Active conversations
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sync Status</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? <Skeleton className="h-8 w-16" /> : 
                `${activities.filter(a => a.synced).length}/${activities.length}`
              }
            </div>
            <p className="text-xs text-muted-foreground">
              Activities synced
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="timeline" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="timeline">Activity Timeline</TabsTrigger>
          <TabsTrigger value="settings">Sync Settings</TabsTrigger>
          <TabsTrigger value="templates">Activity Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="timeline" className="space-y-4">
          {/* Search and Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex gap-4">
                <div className="flex-1">
                  <Label htmlFor="search">Search</Label>
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="search"
                      placeholder="Search by lead email or campaign..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>
                <div className="w-64">
                  <Label htmlFor="lead">Lead</Label>
                  <Input
                    id="lead"
                    placeholder="Select lead..."
                    value={selectedLead || ''}
                    onChange={(e) => setSelectedLead(e.target.value)}
                  />
                </div>
                <div className="w-64">
                  <Label htmlFor="campaign">Campaign</Label>
                  <Input
                    id="campaign"
                    placeholder="Select campaign..."
                    value={selectedCampaign || ''}
                    onChange={(e) => setSelectedCampaign(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Timeline View */}
          <ActivityTimelineView
            leadId={selectedLead}
            campaignId={selectedCampaign}
            onActivityClick={handleActivityClick}
            onThreadClick={handleThreadClick}
          />
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Sync Configuration</CardTitle>
              <CardDescription>
                Configure how activities are synchronized with Pipedrive
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium">Historical Sync</h3>
                  <p className="text-sm text-muted-foreground">
                    Import all historical email data from ColdCopy to Pipedrive
                  </p>
                  <Button className="mt-2" variant="outline">
                    Start Historical Sync
                  </Button>
                </div>

                <div>
                  <h3 className="text-lg font-medium">Real-time Sync</h3>
                  <p className="text-sm text-muted-foreground">
                    Automatically sync new activities as they occur
                  </p>
                  <Button className="mt-2" variant="outline">
                    Configure Real-time Sync
                  </Button>
                </div>

                <div>
                  <h3 className="text-lg font-medium">Activity Type Mapping</h3>
                  <p className="text-sm text-muted-foreground">
                    Map ColdCopy activity types to Pipedrive activity types
                  </p>
                  <Button className="mt-2" variant="outline">
                    Configure Mappings
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Activity Templates</CardTitle>
              <CardDescription>
                Create and manage templates for common activities
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Button>Create New Template</Button>
                
                <div className="text-center py-8 text-muted-foreground">
                  No templates created yet. Create your first template to streamline activity creation.
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}