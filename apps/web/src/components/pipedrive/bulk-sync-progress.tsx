'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Users,
  Building2,
  Briefcase,
  Calendar,
  ChevronDown,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  Download,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BulkSyncProgress, BulkSyncError } from '@/lib/integrations/pipedrive/bulk-sync';

interface BulkSyncProgressProps {
  syncId: string;
  workspaceId: string;
  onPause?: () => void;
  onResume?: () => void;
  onCancel?: () => void;
  onRetry?: () => void;
  className?: string;
}

interface SyncState {
  status: 'idle' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  startTime?: Date;
  endTime?: Date;
  progress: {
    persons: BulkSyncProgress;
    organizations: BulkSyncProgress;
    deals: BulkSyncProgress;
    activities: BulkSyncProgress;
  };
}

export function BulkSyncProgress({
  syncId,
  workspaceId,
  onPause,
  onResume,
  onCancel,
  onRetry,
  className,
}: BulkSyncProgressProps) {
  const [syncState, setSyncState] = useState<SyncState>({
    status: 'idle',
    progress: {
      persons: createEmptyProgress('person'),
      organizations: createEmptyProgress('organization'),
      deals: createEmptyProgress('deal'),
      activities: createEmptyProgress('activity'),
    },
  });
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Subscribe to real-time progress updates
    const eventSource = new EventSource(
      `/api/pipedrive/bulk-sync/${syncId}/progress?workspaceId=${workspaceId}`
    );

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'progress') {
        setSyncState(prev => ({
          ...prev,
          progress: {
            ...prev.progress,
            [data.entityType]: data.progress,
          },
        }));
      } else if (data.type === 'status') {
        setSyncState(prev => ({
          ...prev,
          status: data.status,
          endTime: data.endTime ? new Date(data.endTime) : undefined,
        }));
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [syncId, workspaceId]);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const calculateOverallProgress = () => {
    const progressValues = Object.values(syncState.progress);
    const totalProcessed = progressValues.reduce((sum, p) => sum + p.processed, 0);
    const totalItems = progressValues.reduce((sum, p) => sum + p.total, 0);
    
    return totalItems > 0 ? Math.round((totalProcessed / totalItems) * 100) : 0;
  };

  const getElapsedTime = () => {
    if (!syncState.startTime) return '0:00';
    
    const end = syncState.endTime || new Date();
    const elapsed = Math.floor((end.getTime() - syncState.startTime.getTime()) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getEstimatedTimeRemaining = () => {
    const overallProgress = calculateOverallProgress();
    if (overallProgress === 0 || !syncState.startTime) return 'Calculating...';
    
    const elapsed = Date.now() - syncState.startTime.getTime();
    const estimatedTotal = elapsed / (overallProgress / 100);
    const remaining = estimatedTotal - elapsed;
    
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const overallProgress = calculateOverallProgress();

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Bulk Import Progress</CardTitle>
            <CardDescription>
              Sync ID: {syncId}
            </CardDescription>
          </div>
          <Badge
            variant={
              syncState.status === 'completed' ? 'success' :
              syncState.status === 'failed' ? 'destructive' :
              syncState.status === 'paused' ? 'secondary' :
              'default'
            }
          >
            {syncState.status}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Overall Progress */}
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span>Overall Progress</span>
            <span className="font-medium">{overallProgress}%</span>
          </div>
          <Progress value={overallProgress} className="h-3" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Elapsed: {getElapsedTime()}</span>
            {syncState.status === 'running' && overallProgress > 0 && (
              <span>Est. remaining: {getEstimatedTimeRemaining()}</span>
            )}
          </div>
        </div>

        {/* Control Buttons */}
        {(syncState.status === 'running' || syncState.status === 'paused') && (
          <div className="flex justify-center space-x-2">
            {syncState.status === 'paused' ? (
              <Button onClick={onResume} variant="outline" size="sm">
                <Play className="mr-2 h-4 w-4" />
                Resume
              </Button>
            ) : (
              <Button onClick={onPause} variant="outline" size="sm">
                <Pause className="mr-2 h-4 w-4" />
                Pause
              </Button>
            )}
            <Button onClick={onCancel} variant="destructive" size="sm">
              <XCircle className="mr-2 h-4 w-4" />
              Cancel
            </Button>
          </div>
        )}

        {syncState.status === 'failed' && (
          <div className="flex justify-center space-x-2">
            <Button onClick={onRetry} variant="outline" size="sm">
              <RotateCcw className="mr-2 h-4 w-4" />
              Retry
            </Button>
            <Button variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Download Error Report
            </Button>
          </div>
        )}

        {/* Entity Progress */}
        <div className="space-y-2">
          {Object.entries(syncState.progress).map(([entityType, progress]) => (
            <EntityProgressCard
              key={entityType}
              entityType={entityType as any}
              progress={progress}
              isExpanded={expandedSections.has(entityType)}
              onToggle={() => toggleSection(entityType)}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

interface EntityProgressCardProps {
  entityType: 'person' | 'organization' | 'deal' | 'activity';
  progress: BulkSyncProgress;
  isExpanded: boolean;
  onToggle: () => void;
}

function EntityProgressCard({
  entityType,
  progress,
  isExpanded,
  onToggle,
}: EntityProgressCardProps) {
  const icon = {
    person: <Users className="h-4 w-4" />,
    organization: <Building2 className="h-4 w-4" />,
    deal: <Briefcase className="h-4 w-4" />,
    activity: <Calendar className="h-4 w-4" />,
  }[entityType];

  const label = {
    person: 'Persons',
    organization: 'Organizations',
    deal: 'Deals',
    activity: 'Activities',
  }[entityType];

  const percentage = progress.total > 0
    ? Math.round((progress.processed / progress.total) * 100)
    : 0;

  const hasErrors = progress.errors.length > 0;
  const isComplete = progress.phase === 'completed';
  const isFailed = progress.phase === 'failed';

  return (
    <Collapsible>
      <Card className={cn(
        "transition-colors",
        hasErrors && "border-red-200 dark:border-red-900",
        isComplete && !hasErrors && "border-green-200 dark:border-green-900"
      )}>
        <CollapsibleTrigger asChild>
          <button
            onClick={onToggle}
            className="w-full text-left p-4 hover:bg-muted/50 transition-colors"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {icon}
                  <span className="font-medium">{label}</span>
                  {progress.total > 0 && (
                    <Badge variant="outline" className="ml-2">
                      {progress.processed} / {progress.total}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  {isComplete && !hasErrors && (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  )}
                  {hasErrors && (
                    <AlertCircle className="h-4 w-4 text-red-500" />
                  )}
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 transition-transform",
                      isExpanded && "rotate-180"
                    )}
                  />
                </div>
              </div>

              {progress.total > 0 && (
                <div className="space-y-1">
                  <Progress value={percentage} className="h-2" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{percentage}% complete</span>
                    <div className="flex space-x-3">
                      <span className="text-green-600">
                        ✓ {progress.successful}
                      </span>
                      {progress.failed > 0 && (
                        <span className="text-red-600">
                          ✗ {progress.failed}
                        </span>
                      )}
                      {progress.skipped > 0 && (
                        <span className="text-yellow-600">
                          ⟳ {progress.skipped}
                        </span>
                      )}
                      {progress.duplicates > 0 && (
                        <span className="text-blue-600">
                          ≡ {progress.duplicates}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-4 pb-4 space-y-4 border-t">
            {/* Statistics */}
            <div className="grid grid-cols-2 gap-4 pt-4">
              <div>
                <p className="text-xs text-muted-foreground">Success Rate</p>
                <p className="text-lg font-medium">
                  {progress.total > 0
                    ? Math.round((progress.successful / progress.total) * 100)
                    : 0}%
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Processing Speed</p>
                <p className="text-lg font-medium">
                  {progress.currentBatch && progress.totalBatches
                    ? `Batch ${progress.currentBatch}/${progress.totalBatches}`
                    : 'N/A'}
                </p>
              </div>
            </div>

            {/* Errors */}
            {progress.errors.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Recent Errors</p>
                <ScrollArea className="h-32 rounded-md border p-2">
                  <div className="space-y-2">
                    {progress.errors.map((error, index) => (
                      <ErrorItem key={index} error={error} />
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Current Phase */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Current Phase</span>
              <Badge variant="outline">{progress.phase}</Badge>
            </div>
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function ErrorItem({ error }: { error: BulkSyncError }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-xs space-y-1 p-2 bg-red-50 dark:bg-red-950 rounded"
    >
      <div className="flex items-start space-x-2">
        <XCircle className="h-3 w-3 text-red-500 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <p className="font-medium text-red-700 dark:text-red-300">
            {error.entityId ? `Record ${error.entityId}` : `Index ${error.index}`}
          </p>
          <p className="text-red-600 dark:text-red-400">{error.error}</p>
          {error.code && (
            <p className="text-red-500 dark:text-red-500">Code: {error.code}</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function createEmptyProgress(entityType: BulkSyncProgress['entityType']): BulkSyncProgress {
  return {
    phase: 'preparing',
    entityType,
    total: 0,
    processed: 0,
    successful: 0,
    failed: 0,
    skipped: 0,
    duplicates: 0,
    errors: [],
  };
}