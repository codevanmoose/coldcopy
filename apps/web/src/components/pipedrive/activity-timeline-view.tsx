'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { format, formatDistanceToNow, isToday, isYesterday, startOfDay } from 'date-fns';
import { 
  Mail, 
  Phone, 
  Calendar, 
  CheckSquare, 
  FileText, 
  Linkedin, 
  MessageSquare,
  ChevronDown,
  ChevronRight,
  Filter,
  Download,
  RefreshCw,
  AlertCircle,
  TrendingUp,
  Clock,
  User,
  Building,
  Link,
  MousePointer,
  MailOpen,
  X,
  Send
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { ActivityCategory, ActivitySubType } from '@/lib/integrations/pipedrive/activity-timeline';

interface TimelineActivity {
  id: string;
  pipedriveActivityId?: number;
  category: ActivityCategory;
  subType: ActivitySubType;
  subject: string;
  description?: string;
  timestamp: Date;
  duration?: number;
  participants: {
    email: string;
    name?: string;
    role?: 'sender' | 'recipient' | 'attendee';
  }[];
  metadata: {
    campaignId?: string;
    leadId?: string;
    dealId?: number;
    personId?: number;
    orgId?: number;
    threadId?: string;
    messageId?: string;
    sequenceStep?: number;
    emailStats?: {
      opens: number;
      clicks: number;
      linkClicks: { url: string; count: number }[];
    };
    engagement: {
      score: number;
      sentiment?: 'positive' | 'neutral' | 'negative';
      intent?: 'high' | 'medium' | 'low';
    };
  };
  synced: boolean;
  syncedAt?: Date;
  error?: string;
}

interface EmailThread {
  id: string;
  subject: string;
  participants: string[];
  messageCount: number;
  firstMessageAt: Date;
  lastMessageAt: Date;
  messages: {
    id: string;
    from: string;
    to: string[];
    subject: string;
    body: string;
    timestamp: Date;
    direction: 'inbound' | 'outbound';
  }[];
  status: 'active' | 'closed' | 'archived';
  sentiment: 'positive' | 'neutral' | 'negative';
  engagementScore: number;
}

interface ActivityTimelineViewProps {
  leadId?: string;
  campaignId?: string;
  personId?: number;
  dealId?: number;
  onActivityClick?: (activity: TimelineActivity) => void;
  onThreadClick?: (thread: EmailThread) => void;
  className?: string;
}

const categoryIcons: Record<ActivityCategory, React.ElementType> = {
  [ActivityCategory.EMAIL]: Mail,
  [ActivityCategory.CALL]: Phone,
  [ActivityCategory.MEETING]: Calendar,
  [ActivityCategory.TASK]: CheckSquare,
  [ActivityCategory.NOTE]: FileText,
  [ActivityCategory.LINKEDIN]: Linkedin,
  [ActivityCategory.SMS]: MessageSquare,
  [ActivityCategory.WHATSAPP]: MessageSquare,
};

const categoryColors: Record<ActivityCategory, string> = {
  [ActivityCategory.EMAIL]: 'bg-blue-500',
  [ActivityCategory.CALL]: 'bg-green-500',
  [ActivityCategory.MEETING]: 'bg-purple-500',
  [ActivityCategory.TASK]: 'bg-yellow-500',
  [ActivityCategory.NOTE]: 'bg-gray-500',
  [ActivityCategory.LINKEDIN]: 'bg-blue-700',
  [ActivityCategory.SMS]: 'bg-teal-500',
  [ActivityCategory.WHATSAPP]: 'bg-green-600',
};

const sentimentColors = {
  positive: 'text-green-600',
  neutral: 'text-gray-600',
  negative: 'text-red-600',
};

const intentBadges = {
  high: { label: 'High Intent', className: 'bg-green-100 text-green-800' },
  medium: { label: 'Medium Intent', className: 'bg-yellow-100 text-yellow-800' },
  low: { label: 'Low Intent', className: 'bg-gray-100 text-gray-800' },
};

export function ActivityTimelineView({
  leadId,
  campaignId,
  personId,
  dealId,
  onActivityClick,
  onThreadClick,
  className,
}: ActivityTimelineViewProps) {
  const [activities, setActivities] = useState<TimelineActivity[]>([]);
  const [threads, setThreads] = useState<EmailThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<ActivityCategory[]>([]);
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'timeline' | 'threads' | 'analytics'>('timeline');
  const [timeFilter, setTimeFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [summary, setSummary] = useState<any>(null);
  const [syncProgress, setSyncProgress] = useState<any>(null);

  // Fetch timeline data
  const fetchTimeline = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (leadId) params.append('leadId', leadId);
      if (campaignId) params.append('campaignId', campaignId);
      if (personId) params.append('personId', personId.toString());
      if (dealId) params.append('dealId', dealId.toString());
      if (selectedCategories.length > 0) {
        params.append('categories', selectedCategories.join(','));
      }
      if (timeFilter !== 'all') {
        const now = new Date();
        let startDate: Date;
        switch (timeFilter) {
          case 'today':
            startDate = startOfDay(now);
            break;
          case 'week':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case 'month':
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
          default:
            startDate = new Date(0);
        }
        params.append('startDate', startDate.toISOString());
      }

      const response = await fetch(`/api/pipedrive/activity-timeline?${params}`);
      const data = await response.json();

      setActivities(data.activities || []);
      setThreads(data.threads || []);
      setSummary(data.summary);
    } catch (error) {
      console.error('Error fetching timeline:', error);
    } finally {
      setLoading(false);
    }
  }, [leadId, campaignId, personId, dealId, selectedCategories, timeFilter]);

  useEffect(() => {
    fetchTimeline();
  }, [fetchTimeline]);

  // Start sync
  const startSync = async () => {
    setSyncing(true);
    try {
      const response = await fetch('/api/pipedrive/activity-timeline/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadIds: leadId ? [leadId] : undefined,
          campaignIds: campaignId ? [campaignId] : undefined,
          includeHistorical: true,
        }),
      });

      if (response.ok) {
        // Start polling for progress
        pollSyncProgress();
      }
    } catch (error) {
      console.error('Error starting sync:', error);
      setSyncing(false);
    }
  };

  // Poll sync progress
  const pollSyncProgress = async () => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch('/api/pipedrive/activity-timeline/sync/progress');
        const progress = await response.json();

        setSyncProgress(progress);

        if (!progress || progress.totalActivities === progress.syncedActivities + progress.failedActivities) {
          clearInterval(interval);
          setSyncing(false);
          setSyncProgress(null);
          fetchTimeline(); // Refresh data
        }
      } catch (error) {
        console.error('Error polling sync progress:', error);
        clearInterval(interval);
        setSyncing(false);
      }
    }, 1000);
  };

  // Toggle thread expansion
  const toggleThread = (threadId: string) => {
    setExpandedThreads(prev => {
      const next = new Set(prev);
      if (next.has(threadId)) {
        next.delete(threadId);
      } else {
        next.add(threadId);
      }
      return next;
    });
  };

  // Group activities by date
  const groupActivitiesByDate = (activities: TimelineActivity[]) => {
    const groups: Record<string, TimelineActivity[]> = {};

    activities.forEach(activity => {
      const date = new Date(activity.timestamp);
      let key: string;

      if (isToday(date)) {
        key = 'Today';
      } else if (isYesterday(date)) {
        key = 'Yesterday';
      } else {
        key = format(date, 'MMMM d, yyyy');
      }

      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(activity);
    });

    return groups;
  };

  // Render activity icon with sub-type indicator
  const renderActivityIcon = (activity: TimelineActivity) => {
    const Icon = categoryIcons[activity.category];
    const color = categoryColors[activity.category];

    return (
      <div className="relative">
        <div className={cn('w-10 h-10 rounded-full flex items-center justify-center', color)}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        {activity.subType === ActivitySubType.EMAIL_OPENED && (
          <MailOpen className="w-4 h-4 text-blue-600 absolute -bottom-1 -right-1 bg-white rounded-full" />
        )}
        {activity.subType === ActivitySubType.EMAIL_CLICKED && (
          <MousePointer className="w-4 h-4 text-green-600 absolute -bottom-1 -right-1 bg-white rounded-full" />
        )}
        {activity.subType === ActivitySubType.EMAIL_REPLIED && (
          <Send className="w-4 h-4 text-purple-600 absolute -bottom-1 -right-1 bg-white rounded-full" />
        )}
      </div>
    );
  };

  // Render activity details
  const renderActivityDetails = (activity: TimelineActivity) => {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-sm">{activity.subject}</h4>
          <div className="flex items-center gap-2">
            {activity.metadata.engagement.intent && (
              <Badge className={intentBadges[activity.metadata.engagement.intent].className}>
                {intentBadges[activity.metadata.engagement.intent].label}
              </Badge>
            )}
            <Badge variant={activity.synced ? 'default' : 'secondary'}>
              {activity.synced ? 'Synced' : 'Pending'}
            </Badge>
          </div>
        </div>

        {activity.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">{activity.description}</p>
        )}

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {format(new Date(activity.timestamp), 'h:mm a')}
          </span>
          {activity.duration && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {activity.duration} min
            </span>
          )}
          {activity.participants.length > 0 && (
            <span className="flex items-center gap-1">
              <User className="w-3 h-3" />
              {activity.participants[0].email}
            </span>
          )}
        </div>

        {activity.metadata.emailStats && (
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1">
              <MailOpen className="w-3 h-3" />
              {activity.metadata.emailStats.opens} opens
            </span>
            <span className="flex items-center gap-1">
              <MousePointer className="w-3 h-3" />
              {activity.metadata.emailStats.clicks} clicks
            </span>
          </div>
        )}

        {activity.error && (
          <div className="flex items-center gap-2 text-xs text-red-600">
            <AlertCircle className="w-3 h-3" />
            {activity.error}
          </div>
        )}
      </div>
    );
  };

  // Render email thread
  const renderEmailThread = (thread: EmailThread) => {
    const isExpanded = expandedThreads.has(thread.id);

    return (
      <Card key={thread.id} className="mb-4">
        <CardHeader
          className="cursor-pointer"
          onClick={() => toggleThread(thread.id)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              <Mail className="w-4 h-4" />
              <h4 className="font-medium">{thread.subject}</h4>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{thread.messageCount} messages</Badge>
              <Badge className={sentimentColors[thread.sentiment]} variant="outline">
                {thread.sentiment}
              </Badge>
              <div className="flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                <span className="text-xs">{thread.engagementScore}%</span>
              </div>
            </div>
          </div>
        </CardHeader>

        {isExpanded && (
          <CardContent>
            <ScrollArea className="h-[300px]">
              <div className="space-y-4">
                {thread.messages.map((message, index) => (
                  <div
                    key={message.id}
                    className={cn(
                      'p-3 rounded-lg',
                      message.direction === 'outbound' 
                        ? 'bg-blue-50 ml-8' 
                        : 'bg-gray-50 mr-8'
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">{message.from}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(message.timestamp), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-sm">{message.body}</p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        )}
      </Card>
    );
  };

  // Render sync progress
  const renderSyncProgress = () => {
    if (!syncProgress) return null;

    const progressPercentage = Math.round(
      ((syncProgress.syncedActivities + syncProgress.failedActivities) / syncProgress.totalActivities) * 100
    );

    return (
      <Card className="mb-4">
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Syncing Activities</h4>
              <span className="text-sm text-muted-foreground">
                {progressPercentage}% complete
              </span>
            </div>
            <Progress value={progressPercentage} />
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Total: </span>
                <span className="font-medium">{syncProgress.totalActivities}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Synced: </span>
                <span className="font-medium text-green-600">{syncProgress.syncedActivities}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Failed: </span>
                <span className="font-medium text-red-600">{syncProgress.failedActivities}</span>
              </div>
            </div>
            {syncProgress.estimatedTimeRemaining > 0 && (
              <p className="text-xs text-muted-foreground">
                Estimated time remaining: {Math.ceil(syncProgress.estimatedTimeRemaining / 60)} minutes
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  // Render analytics
  const renderAnalytics = () => {
    if (!summary) return null;

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{summary.totalActivities}</div>
              <p className="text-xs text-muted-foreground">Total Activities</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{summary.engagementScore}%</div>
              <p className="text-xs text-muted-foreground">Engagement Score</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">
                {summary.lastActivity 
                  ? formatDistanceToNow(new Date(summary.lastActivity), { addSuffix: true })
                  : 'Never'
                }
              </div>
              <p className="text-xs text-muted-foreground">Last Activity</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">
                {summary.nextScheduledActivity 
                  ? format(new Date(summary.nextScheduledActivity), 'MMM d')
                  : 'None'
                }
              </div>
              <p className="text-xs text-muted-foreground">Next Activity</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Activity Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(summary.byCategory || {}).map(([category, count]) => {
                const Icon = categoryIcons[category as ActivityCategory];
                const percentage = Math.round((count as number / summary.totalActivities) * 100);
                
                return (
                  <div key={category} className="flex items-center gap-2">
                    <Icon className="w-4 h-4" />
                    <span className="text-sm flex-1">{category}</span>
                    <span className="text-sm font-medium">{count}</span>
                    <Progress value={percentage} className="w-20" />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Activity Timeline</h3>
        <div className="flex items-center gap-2">
          {/* Time filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Clock className="w-4 h-4 mr-2" />
                {timeFilter === 'all' ? 'All Time' : 
                 timeFilter === 'today' ? 'Today' :
                 timeFilter === 'week' ? 'Past Week' : 'Past Month'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setTimeFilter('all')}>All Time</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTimeFilter('today')}>Today</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTimeFilter('week')}>Past Week</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTimeFilter('month')}>Past Month</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Category filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="w-4 h-4 mr-2" />
                Filter
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Categories</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {Object.values(ActivityCategory).map(category => (
                <DropdownMenuCheckboxItem
                  key={category}
                  checked={selectedCategories.includes(category)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedCategories([...selectedCategories, category]);
                    } else {
                      setSelectedCategories(selectedCategories.filter(c => c !== category));
                    }
                  }}
                >
                  {category}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Sync button */}
          <Button
            variant="outline"
            size="sm"
            onClick={startSync}
            disabled={syncing}
          >
            <RefreshCw className={cn('w-4 h-4 mr-2', syncing && 'animate-spin')} />
            {syncing ? 'Syncing...' : 'Sync'}
          </Button>

          {/* Export button */}
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Sync progress */}
      {syncing && renderSyncProgress()}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="threads">Email Threads</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="timeline" className="space-y-4">
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupActivitiesByDate(activities)).map(([date, dateActivities]) => (
                <div key={date}>
                  <h4 className="text-sm font-medium text-muted-foreground mb-3">{date}</h4>
                  <div className="space-y-4">
                    {dateActivities.map(activity => (
                      <div
                        key={activity.id}
                        className="flex gap-4 cursor-pointer hover:bg-muted/50 p-3 rounded-lg transition-colors"
                        onClick={() => onActivityClick?.(activity)}
                      >
                        {renderActivityIcon(activity)}
                        <div className="flex-1">
                          {renderActivityDetails(activity)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="threads" className="space-y-4">
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
          ) : (
            <div>
              {threads.map(thread => renderEmailThread(thread))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="analytics">
          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-32" />
              <Skeleton className="h-48" />
            </div>
          ) : (
            renderAnalytics()
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}