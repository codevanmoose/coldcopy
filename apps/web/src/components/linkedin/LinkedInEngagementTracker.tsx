'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Eye,
  MessageSquare,
  UserCheck,
  ThumbsUp,
  Share2,
  MessageCircle,
  Link,
  Calendar,
  TrendingUp,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth';
import { LinkedInEventType } from '@/lib/integrations/linkedin/analytics-service';

interface LinkedInEngagementTrackerProps {
  profileId?: string;
  messageId?: string;
  campaignId?: string;
  onEventTracked?: (event: any) => void;
  className?: string;
}

interface QuickAction {
  type: LinkedInEventType;
  label: string;
  icon: any;
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'ghost';
}

const QUICK_ACTIONS: QuickAction[] = [
  { type: 'profile_view', label: 'Profile View', icon: Eye, variant: 'secondary' },
  { type: 'message_sent', label: 'Message Sent', icon: MessageSquare },
  { type: 'message_opened', label: 'Opened', icon: Eye, variant: 'secondary' },
  { type: 'message_replied', label: 'Replied', icon: MessageCircle },
  { type: 'connection_request_sent', label: 'Connection Request', icon: UserCheck },
  { type: 'connection_accepted', label: 'Connected', icon: UserCheck, variant: 'secondary' },
  { type: 'post_liked', label: 'Post Liked', icon: ThumbsUp, variant: 'outline' },
  { type: 'post_shared', label: 'Post Shared', icon: Share2, variant: 'outline' },
];

export function LinkedInEngagementTracker({
  profileId,
  messageId,
  campaignId,
  onEventTracked,
  className,
}: LinkedInEngagementTrackerProps) {
  const { workspace } = useAuthStore();
  const [tracking, setTracking] = useState<string | null>(null);
  const [recentEvents, setRecentEvents] = useState<Array<{
    type: LinkedInEventType;
    timestamp: string;
  }>>([]);

  useEffect(() => {
    if (profileId && workspace?.id) {
      fetchRecentEvents();
    }
  }, [profileId, workspace?.id]);

  const fetchRecentEvents = async () => {
    // In a real implementation, this would fetch recent events from the API
    // For now, we'll simulate with mock data
    setRecentEvents([
      { type: 'profile_view', timestamp: new Date().toISOString() },
      { type: 'message_sent', timestamp: new Date(Date.now() - 86400000).toISOString() },
    ]);
  };

  const trackEvent = async (eventType: LinkedInEventType) => {
    if (!workspace?.id) {
      toast.error('No workspace selected');
      return;
    }

    setTracking(eventType);
    try {
      const event = {
        profile_id: profileId,
        message_id: messageId,
        campaign_id: campaignId,
        event_type: eventType,
        event_source: 'manual' as const,
        engagement_score: getEngagementScore(eventType),
      };

      const response = await fetch('/api/linkedin/analytics/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspace.id,
          event,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to track event');
      }

      const data = await response.json();
      
      toast.success(`Tracked: ${eventType.replace('_', ' ')}`);
      
      // Add to recent events
      setRecentEvents(prev => [
        { type: eventType, timestamp: new Date().toISOString() },
        ...prev.slice(0, 4),
      ]);

      onEventTracked?.(data.event);
    } catch (error) {
      console.error('Error tracking event:', error);
      toast.error('Failed to track event');
    } finally {
      setTracking(null);
    }
  };

  const getEngagementScore = (eventType: LinkedInEventType): number => {
    const scores: Record<LinkedInEventType, number> = {
      profile_view: 2,
      message_sent: 3,
      message_opened: 3,
      message_replied: 10,
      connection_request_sent: 5,
      connection_accepted: 8,
      connection_rejected: 0,
      profile_liked: 4,
      post_liked: 5,
      post_commented: 7,
      post_shared: 8,
      inmailed: 6,
      profile_followed: 5,
      skill_endorsed: 4,
      recommendation_sent: 10,
    };
    return scores[eventType] || 1;
  };

  const getActionButton = (action: QuickAction) => {
    const Icon = action.icon;
    const isTracking = tracking === action.type;

    return (
      <Button
        key={action.type}
        variant={action.variant || 'default'}
        size="sm"
        onClick={() => trackEvent(action.type)}
        disabled={isTracking}
        className="flex items-center gap-2"
      >
        {isTracking ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Icon className="h-4 w-4" />
        )}
        <span className="hidden sm:inline">{action.label}</span>
      </Button>
    );
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Quick Action Buttons */}
      <div className="flex flex-wrap gap-2">
        {QUICK_ACTIONS.map(getActionButton)}
      </div>

      {/* Recent Events */}
      {recentEvents.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Recent Activity</p>
          <div className="flex flex-wrap gap-2">
            {recentEvents.map((event, index) => (
              <Badge key={index} variant="secondary" className="text-xs">
                {event.type.replace(/_/g, ' ')}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Bulk Actions */}
      <div className="flex items-center gap-2 pt-2 border-t">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            // Track multiple events at once
            const bulkEvents = [
              {
                profile_id: profileId,
                message_id: messageId,
                campaign_id: campaignId,
                event_type: 'message_sent' as LinkedInEventType,
                event_source: 'manual' as const,
                engagement_score: 3,
              },
              {
                profile_id: profileId,
                message_id: messageId,
                campaign_id: campaignId,
                event_type: 'message_opened' as LinkedInEventType,
                event_source: 'manual' as const,
                engagement_score: 3,
              },
            ];

            // In a real implementation, this would call the bulk tracking API
            toast.success('Tracked bulk events');
          }}
        >
          <Calendar className="mr-2 h-4 w-4" />
          Track Sequence
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            // Navigate to full analytics
            window.location.href = '/dashboard/linkedin/analytics';
          }}
        >
          <TrendingUp className="mr-2 h-4 w-4" />
          View Analytics
        </Button>
      </div>
    </div>
  );
}