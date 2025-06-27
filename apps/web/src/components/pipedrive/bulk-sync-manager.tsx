'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Plus,
  MoreHorizontal,
  Download,
  Eye,
  Pause,
  Play,
  RotateCcw,
  Trash2,
  Search,
  Filter,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  FileSpreadsheet,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';
import { BulkSyncWizard } from './bulk-sync-wizard';
import { BulkSyncProgress } from './bulk-sync-progress';
import type { BulkSyncResult } from '@/lib/integrations/pipedrive/bulk-sync';

interface BulkSyncJob {
  id: string;
  workspaceId: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  source: 'file' | 'api' | 'database' | 'manual';
  totalRecords: number;
  processedRecords: number;
  successfulRecords: number;
  failedRecords: number;
  duplicateRecords: number;
  result?: BulkSyncResult;
  error?: string;
  createdBy: {
    id: string;
    name: string;
    email: string;
  };
}

interface BulkSyncManagerProps {
  workspaceId: string;
}

export function BulkSyncManager({ workspaceId }: BulkSyncManagerProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [syncJobs, setSyncJobs] = useState<BulkSyncJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [selectedJob, setSelectedJob] = useState<BulkSyncJob | null>(null);
  const [showProgress, setShowProgress] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    fetchSyncJobs();
    
    // Poll for updates every 5 seconds
    const interval = setInterval(fetchSyncJobs, 5000);
    return () => clearInterval(interval);
  }, [workspaceId]);

  const fetchSyncJobs = async () => {
    try {
      const response = await fetch(`/api/pipedrive/bulk-sync?workspaceId=${workspaceId}`);
      if (!response.ok) throw new Error('Failed to fetch sync jobs');
      
      const data = await response.json();
      setSyncJobs(data.jobs);
    } catch (error) {
      console.error('Error fetching sync jobs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePauseSync = async (jobId: string) => {
    try {
      const response = await fetch(`/api/pipedrive/bulk-sync/${jobId}/pause`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId }),
      });
      
      if (!response.ok) throw new Error('Failed to pause sync');
      
      toast({
        title: 'Sync paused',
        description: 'The sync operation has been paused',
      });
      
      fetchSyncJobs();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to pause sync operation',
        variant: 'destructive',
      });
    }
  };

  const handleResumeSync = async (jobId: string) => {
    try {
      const response = await fetch(`/api/pipedrive/bulk-sync/${jobId}/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId }),
      });
      
      if (!response.ok) throw new Error('Failed to resume sync');
      
      toast({
        title: 'Sync resumed',
        description: 'The sync operation has been resumed',
      });
      
      fetchSyncJobs();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to resume sync operation',
        variant: 'destructive',
      });
    }
  };

  const handleCancelSync = async (jobId: string) => {
    try {
      const response = await fetch(`/api/pipedrive/bulk-sync/${jobId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId }),
      });
      
      if (!response.ok) throw new Error('Failed to cancel sync');
      
      toast({
        title: 'Sync cancelled',
        description: 'The sync operation has been cancelled',
      });
      
      fetchSyncJobs();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to cancel sync operation',
        variant: 'destructive',
      });
    }
  };

  const handleRetrySync = async (jobId: string) => {
    try {
      const response = await fetch(`/api/pipedrive/bulk-sync/${jobId}/retry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId }),
      });
      
      if (!response.ok) throw new Error('Failed to retry sync');
      
      toast({
        title: 'Sync restarted',
        description: 'The sync operation has been restarted',
      });
      
      fetchSyncJobs();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to retry sync operation',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteSync = async (jobId: string) => {
    try {
      const response = await fetch(`/api/pipedrive/bulk-sync/${jobId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId }),
      });
      
      if (!response.ok) throw new Error('Failed to delete sync');
      
      toast({
        title: 'Sync deleted',
        description: 'The sync record has been deleted',
      });
      
      fetchSyncJobs();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete sync record',
        variant: 'destructive',
      });
    }
  };

  const downloadReport = async (job: BulkSyncJob) => {
    try {
      const response = await fetch(
        `/api/pipedrive/bulk-sync/${job.id}/report?workspaceId=${workspaceId}`
      );
      
      if (!response.ok) throw new Error('Failed to download report');
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pipedrive-sync-report-${job.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to download report',
        variant: 'destructive',
      });
    }
  };

  const getStatusIcon = (status: BulkSyncJob['status']) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'running':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'paused':
        return <Pause className="h-4 w-4 text-orange-500" />;
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'cancelled':
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
      default:
        return null;
    }
  };

  const getStatusBadgeVariant = (status: BulkSyncJob['status']) => {
    switch (status) {
      case 'pending':
        return 'secondary';
      case 'running':
        return 'default';
      case 'paused':
        return 'outline';
      case 'completed':
        return 'success';
      case 'failed':
        return 'destructive';
      case 'cancelled':
        return 'secondary';
      default:
        return 'default';
    }
  };

  const filteredJobs = syncJobs.filter(job => {
    const matchesSearch = searchQuery === '' || 
      job.id.includes(searchQuery) ||
      job.createdBy.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.createdBy.email.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || job.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const activeJobs = filteredJobs.filter(job => 
    ['pending', 'running', 'paused'].includes(job.status)
  );
  
  const completedJobs = filteredJobs.filter(job => 
    ['completed', 'failed', 'cancelled'].includes(job.status)
  );

  if (showWizard) {
    return (
      <BulkSyncWizard
        workspaceId={workspaceId}
        onComplete={(result) => {
          setShowWizard(false);
          fetchSyncJobs();
          toast({
            title: 'Import completed',
            description: `Successfully imported ${result.summary.successful} records`,
          });
        }}
        onCancel={() => setShowWizard(false)}
      />
    );
  }

  if (selectedJob && showProgress) {
    return (
      <div className="space-y-4">
        <Button
          variant="outline"
          onClick={() => {
            setSelectedJob(null);
            setShowProgress(false);
          }}
        >
          ← Back to Sync Manager
        </Button>
        
        <BulkSyncProgress
          syncId={selectedJob.id}
          workspaceId={workspaceId}
          onPause={() => handlePauseSync(selectedJob.id)}
          onResume={() => handleResumeSync(selectedJob.id)}
          onCancel={() => handleCancelSync(selectedJob.id)}
          onRetry={() => handleRetrySync(selectedJob.id)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Bulk Import Manager</CardTitle>
              <CardDescription>
                Manage your Pipedrive data imports
              </CardDescription>
            </div>
            <Button onClick={() => setShowWizard(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Import
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {/* Filters */}
          <div className="flex items-center space-x-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by ID, user name, or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Filter className="mr-2 h-4 w-4" />
                  {statusFilter === 'all' ? 'All Status' : statusFilter}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setStatusFilter('all')}>
                  All Status
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setStatusFilter('pending')}>
                  Pending
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter('running')}>
                  Running
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter('paused')}>
                  Paused
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter('completed')}>
                  Completed
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter('failed')}>
                  Failed
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter('cancelled')}>
                  Cancelled
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Jobs Table */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="text-center py-8">
              <FileSpreadsheet className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {searchQuery || statusFilter !== 'all'
                  ? 'No sync jobs found matching your criteria'
                  : 'No sync jobs yet. Click "New Import" to get started.'}
              </p>
            </div>
          ) : (
            <Tabs defaultValue="active" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="active">
                  Active ({activeJobs.length})
                </TabsTrigger>
                <TabsTrigger value="history">
                  History ({completedJobs.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="active" className="mt-4">
                <SyncJobsTable
                  jobs={activeJobs}
                  onView={(job) => {
                    setSelectedJob(job);
                    setShowProgress(true);
                  }}
                  onPause={handlePauseSync}
                  onResume={handleResumeSync}
                  onCancel={handleCancelSync}
                  onRetry={handleRetrySync}
                  onDelete={handleDeleteSync}
                  onDownloadReport={downloadReport}
                  getStatusIcon={getStatusIcon}
                  getStatusBadgeVariant={getStatusBadgeVariant}
                />
              </TabsContent>

              <TabsContent value="history" className="mt-4">
                <SyncJobsTable
                  jobs={completedJobs}
                  onView={(job) => {
                    setSelectedJob(job);
                    setShowProgress(true);
                  }}
                  onPause={handlePauseSync}
                  onResume={handleResumeSync}
                  onCancel={handleCancelSync}
                  onRetry={handleRetrySync}
                  onDelete={handleDeleteSync}
                  onDownloadReport={downloadReport}
                  getStatusIcon={getStatusIcon}
                  getStatusBadgeVariant={getStatusBadgeVariant}
                />
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface SyncJobsTableProps {
  jobs: BulkSyncJob[];
  onView: (job: BulkSyncJob) => void;
  onPause: (jobId: string) => void;
  onResume: (jobId: string) => void;
  onCancel: (jobId: string) => void;
  onRetry: (jobId: string) => void;
  onDelete: (jobId: string) => void;
  onDownloadReport: (job: BulkSyncJob) => void;
  getStatusIcon: (status: BulkSyncJob['status']) => React.ReactNode;
  getStatusBadgeVariant: (status: BulkSyncJob['status']) => any;
}

function SyncJobsTable({
  jobs,
  onView,
  onPause,
  onResume,
  onCancel,
  onRetry,
  onDelete,
  onDownloadReport,
  getStatusIcon,
  getStatusBadgeVariant,
}: SyncJobsTableProps) {
  if (jobs.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No sync jobs in this category</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Progress</TableHead>
            <TableHead>Started</TableHead>
            <TableHead>Created By</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobs.map((job) => (
            <TableRow key={job.id}>
              <TableCell className="font-mono text-xs">
                {job.id.slice(0, 8)}...
              </TableCell>
              <TableCell>
                <div className="flex items-center space-x-2">
                  {getStatusIcon(job.status)}
                  <Badge variant={getStatusBadgeVariant(job.status)}>
                    {job.status}
                  </Badge>
                </div>
              </TableCell>
              <TableCell className="capitalize">{job.source}</TableCell>
              <TableCell>
                <div className="space-y-1">
                  <div className="text-sm">
                    {job.processedRecords} / {job.totalRecords}
                  </div>
                  {job.totalRecords > 0 && (
                    <div className="text-xs text-muted-foreground">
                      {Math.round((job.processedRecords / job.totalRecords) * 100)}%
                    </div>
                  )}
                </div>
              </TableCell>
              <TableCell>
                {job.startedAt ? (
                  <div className="space-y-1">
                    <div className="text-sm">
                      {formatDistanceToNow(job.startedAt, { addSuffix: true })}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(job.startedAt).toLocaleString()}
                    </div>
                  </div>
                ) : (
                  <span className="text-muted-foreground">Not started</span>
                )}
              </TableCell>
              <TableCell>
                <div className="space-y-1">
                  <div className="text-sm">{job.createdBy.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {job.createdBy.email}
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onView(job)}>
                      <Eye className="mr-2 h-4 w-4" />
                      View Details
                    </DropdownMenuItem>
                    
                    {job.status === 'running' && (
                      <DropdownMenuItem onClick={() => onPause(job.id)}>
                        <Pause className="mr-2 h-4 w-4" />
                        Pause
                      </DropdownMenuItem>
                    )}
                    
                    {job.status === 'paused' && (
                      <DropdownMenuItem onClick={() => onResume(job.id)}>
                        <Play className="mr-2 h-4 w-4" />
                        Resume
                      </DropdownMenuItem>
                    )}
                    
                    {(job.status === 'running' || job.status === 'paused') && (
                      <DropdownMenuItem
                        onClick={() => onCancel(job.id)}
                        className="text-destructive"
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        Cancel
                      </DropdownMenuItem>
                    )}
                    
                    {job.status === 'failed' && (
                      <DropdownMenuItem onClick={() => onRetry(job.id)}>
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Retry
                      </DropdownMenuItem>
                    )}
                    
                    <DropdownMenuSeparator />
                    
                    {job.status === 'completed' && (
                      <DropdownMenuItem onClick={() => onDownloadReport(job)}>
                        <Download className="mr-2 h-4 w-4" />
                        Download Report
                      </DropdownMenuItem>
                    )}
                    
                    {['completed', 'failed', 'cancelled'].includes(job.status) && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => onDelete(job.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete Record
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}