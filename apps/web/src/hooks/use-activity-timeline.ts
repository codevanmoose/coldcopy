import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ActivityCategory } from '@/lib/integrations/pipedrive/activity-timeline';

interface UseActivityTimelineOptions {
  leadId?: string;
  campaignId?: string;
  personId?: number;
  dealId?: number;
  categories?: ActivityCategory[];
  startDate?: Date;
  endDate?: Date;
  includeThreads?: boolean;
  limit?: number;
}

interface SyncOptions {
  startDate?: Date;
  endDate?: Date;
  categories?: ActivityCategory[];
  leadIds?: string[];
  campaignIds?: string[];
  batchSize?: number;
  includeHistorical?: boolean;
  syncDirection?: 'to_pipedrive' | 'from_pipedrive' | 'bidirectional';
  conflictResolution?: 'skip' | 'overwrite' | 'merge';
}

export function useActivityTimeline(options: UseActivityTimelineOptions = {}) {
  const queryClient = useQueryClient();
  const [syncProgress, setSyncProgress] = useState<any>(null);
  const [syncing, setSyncing] = useState(false);

  // Build query key
  const queryKey = ['activity-timeline', options];

  // Fetch timeline data
  const {
    data: timeline,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (options.leadId) params.append('leadId', options.leadId);
      if (options.campaignId) params.append('campaignId', options.campaignId);
      if (options.personId) params.append('personId', options.personId.toString());
      if (options.dealId) params.append('dealId', options.dealId.toString());
      if (options.categories?.length) params.append('categories', options.categories.join(','));
      if (options.startDate) params.append('startDate', options.startDate.toISOString());
      if (options.endDate) params.append('endDate', options.endDate.toISOString());
      if (options.includeThreads !== undefined) params.append('includeThreads', options.includeThreads.toString());
      if (options.limit) params.append('limit', options.limit.toString());

      const response = await fetch(`/api/pipedrive/activity-timeline?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch timeline');
      }
      return response.json();
    },
    enabled: !!(options.leadId || options.campaignId || options.personId || options.dealId),
  });

  // Start sync mutation
  const syncMutation = useMutation({
    mutationFn: async (syncOptions: SyncOptions) => {
      const response = await fetch('/api/pipedrive/activity-timeline/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(syncOptions),
      });
      if (!response.ok) {
        throw new Error('Failed to start sync');
      }
      return response.json();
    },
    onSuccess: () => {
      setSyncing(true);
      pollSyncProgress();
    },
    onError: (error) => {
      console.error('Sync error:', error);
      setSyncing(false);
    },
  });

  // Create activity from template mutation
  const createActivityMutation = useMutation({
    mutationFn: async (data: {
      templateId: string;
      leadId: string;
      personId?: number;
      dealId?: number;
      fieldValues: Record<string, any>;
    }) => {
      const response = await fetch('/api/pipedrive/activity-timeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw new Error('Failed to create activity');
      }
      return response.json();
    },
    onSuccess: () => {
      // Invalidate timeline query to refetch
      queryClient.invalidateQueries({ queryKey });
    },
  });

  // Poll sync progress
  const pollSyncProgress = useCallback(async () => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch('/api/pipedrive/activity-timeline/sync/progress');
        const progress = await response.json();

        setSyncProgress(progress);

        if (!progress || progress.status === 'idle' || 
            (progress.totalActivities === progress.syncedActivities + progress.failedActivities)) {
          clearInterval(interval);
          setSyncing(false);
          setSyncProgress(null);
          // Refetch timeline data
          refetch();
        }
      } catch (error) {
        console.error('Error polling sync progress:', error);
        clearInterval(interval);
        setSyncing(false);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [refetch]);

  // Stream activities in real-time
  const streamActivities = useCallback(
    async (onActivity: (activity: any) => void, onError?: (error: Error) => void) => {
      // In a real implementation, this would establish a WebSocket or SSE connection
      // For now, we'll use polling as a fallback
      const pollInterval = setInterval(async () => {
        try {
          await refetch();
        } catch (error) {
          onError?.(error as Error);
        }
      }, 5000);

      return () => clearInterval(pollInterval);
    },
    [refetch]
  );

  // Get engagement analytics
  const getAnalytics = useCallback(
    async (analyticsOptions: {
      startDate: Date;
      endDate: Date;
      groupBy?: 'day' | 'week' | 'month';
    }) => {
      const params = new URLSearchParams();
      if (options.leadId) params.append('leadId', options.leadId);
      if (options.campaignId) params.append('campaignId', options.campaignId);
      params.append('startDate', analyticsOptions.startDate.toISOString());
      params.append('endDate', analyticsOptions.endDate.toISOString());
      params.append('groupBy', analyticsOptions.groupBy || 'day');

      const response = await fetch(`/api/pipedrive/activity-timeline/analytics?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch analytics');
      }
      return response.json();
    },
    [options.leadId, options.campaignId]
  );

  return {
    // Data
    activities: timeline?.activities || [],
    threads: timeline?.threads || [],
    summary: timeline?.summary || null,
    
    // Loading states
    isLoading,
    syncing,
    syncProgress,
    
    // Error state
    error,
    
    // Actions
    refetch,
    startSync: syncMutation.mutate,
    createActivity: createActivityMutation.mutate,
    streamActivities,
    getAnalytics,
    
    // Mutation states
    isSyncing: syncMutation.isPending,
    isCreatingActivity: createActivityMutation.isPending,
  };
}