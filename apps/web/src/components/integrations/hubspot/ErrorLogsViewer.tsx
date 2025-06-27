'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  AlertCircle, RefreshCw, Search, Filter, Download, Trash2, 
  CheckCircle, XCircle, AlertTriangle, Info, Bug, Shield,
  Calendar, Clock, User, Code, ExternalLink, Copy
} from 'lucide-react';
import { ErrorLog } from './types';
import { useToast } from '@/components/ui/use-toast';
import { format } from 'date-fns';

const ERROR_TYPES = [
  { value: 'all', label: 'All Types' },
  { value: 'auth', label: 'Authentication', icon: Shield },
  { value: 'api', label: 'API Errors', icon: Code },
  { value: 'sync', label: 'Sync Errors', icon: RefreshCw },
  { value: 'webhook', label: 'Webhook Errors', icon: AlertCircle },
  { value: 'validation', label: 'Validation Errors', icon: AlertTriangle },
];

const SEVERITY_LEVELS = [
  { value: 'all', label: 'All Severities' },
  { value: 'critical', label: 'Critical', color: 'destructive' },
  { value: 'high', label: 'High', color: 'orange' },
  { value: 'medium', label: 'Medium', color: 'yellow' },
  { value: 'low', label: 'Low', color: 'blue' },
];

export function ErrorLogsViewer() {
  const [errors, setErrors] = useState<ErrorLog[]>([]);
  const [filteredErrors, setFilteredErrors] = useState<ErrorLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedError, setSelectedError] = useState<ErrorLog | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [errorTypeFilter, setErrorTypeFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [showResolvedFilter, setShowResolvedFilter] = useState<'all' | 'resolved' | 'unresolved'>('unresolved');
  const { toast } = useToast();

  useEffect(() => {
    fetchErrorLogs();
  }, []);

  useEffect(() => {
    filterErrors();
  }, [errors, searchQuery, errorTypeFilter, severityFilter, showResolvedFilter]);

  const fetchErrorLogs = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/integrations/hubspot/errors');
      if (response.ok) {
        const data = await response.json();
        setErrors(data);
      }
    } catch (error) {
      console.error('Error fetching error logs:', error);
      toast({
        title: 'Error',
        description: 'Failed to load error logs',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filterErrors = () => {
    let filtered = [...errors];

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(error =>
        error.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
        JSON.stringify(error.details).toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Error type filter
    if (errorTypeFilter !== 'all') {
      filtered = filtered.filter(error => error.errorType === errorTypeFilter);
    }

    // Severity filter
    if (severityFilter !== 'all') {
      filtered = filtered.filter(error => error.severity === severityFilter);
    }

    // Resolved status filter
    switch (showResolvedFilter) {
      case 'resolved':
        filtered = filtered.filter(error => error.resolved);
        break;
      case 'unresolved':
        filtered = filtered.filter(error => !error.resolved);
        break;
    }

    // Sort by timestamp (newest first)
    filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    setFilteredErrors(filtered);
  };

  const handleMarkResolved = async (errorId: string) => {
    try {
      const response = await fetch(`/api/integrations/hubspot/errors/${errorId}/resolve`, {
        method: 'POST',
      });

      if (response.ok) {
        setErrors(errors.map(e => 
          e.id === errorId 
            ? { ...e, resolved: true, resolvedAt: new Date() }
            : e
        ));
        toast({
          title: 'Success',
          description: 'Error marked as resolved',
        });
      } else {
        throw new Error('Failed to mark error as resolved');
      }
    } catch (error) {
      console.error('Error marking as resolved:', error);
      toast({
        title: 'Error',
        description: 'Failed to mark error as resolved',
        variant: 'destructive',
      });
    }
  };

  const handleClearResolved = async () => {
    if (!confirm('Are you sure you want to clear all resolved errors? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch('/api/integrations/hubspot/errors/clear-resolved', {
        method: 'DELETE',
      });

      if (response.ok) {
        setErrors(errors.filter(e => !e.resolved));
        toast({
          title: 'Success',
          description: 'Resolved errors cleared',
        });
      } else {
        throw new Error('Failed to clear resolved errors');
      }
    } catch (error) {
      console.error('Error clearing resolved errors:', error);
      toast({
        title: 'Error',
        description: 'Failed to clear resolved errors',
        variant: 'destructive',
      });
    }
  };

  const handleExportLogs = () => {
    const csvContent = [
      ['Timestamp', 'Type', 'Severity', 'Message', 'Details', 'Resolved'],
      ...filteredErrors.map(error => [
        format(new Date(error.timestamp), 'yyyy-MM-dd HH:mm:ss'),
        error.errorType,
        error.severity,
        error.message,
        JSON.stringify(error.details || {}),
        error.resolved ? 'Yes' : 'No',
      ]),
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hubspot-error-logs-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <XCircle className="h-4 w-4" />;
      case 'high':
        return <AlertTriangle className="h-4 w-4" />;
      case 'medium':
        return <AlertCircle className="h-4 w-4" />;
      case 'low':
        return <Info className="h-4 w-4" />;
      default:
        return <Bug className="h-4 w-4" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'text-destructive';
      case 'high':
        return 'text-orange-600';
      case 'medium':
        return 'text-yellow-600';
      case 'low':
        return 'text-blue-600';
      default:
        return 'text-muted-foreground';
    }
  };

  const getErrorTypeIcon = (type: string) => {
    const errorType = ERROR_TYPES.find(t => t.value === type);
    return errorType?.icon ? <errorType.icon className="h-4 w-4" /> : <Bug className="h-4 w-4" />;
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
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Error Logs & Troubleshooting</CardTitle>
              <CardDescription>
                Monitor and resolve HubSpot integration errors
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchErrorLogs}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportLogs}
                disabled={filteredErrors.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              {errors.some(e => e.resolved) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearResolved}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear Resolved
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="space-y-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="search">Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search"
                    placeholder="Search error messages..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="errorType">Error Type</Label>
                <Select value={errorTypeFilter} onValueChange={setErrorTypeFilter}>
                  <SelectTrigger id="errorType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ERROR_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center gap-2">
                          {type.icon && <type.icon className="h-4 w-4" />}
                          {type.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="severity">Severity</Label>
                <Select value={severityFilter} onValueChange={setSeverityFilter}>
                  <SelectTrigger id="severity">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SEVERITY_LEVELS.map((level) => (
                      <SelectItem key={level.value} value={level.value}>
                        {level.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="status">Status</Label>
                <Select value={showResolvedFilter} onValueChange={(value: any) => setShowResolvedFilter(value)}>
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Errors</SelectItem>
                    <SelectItem value="unresolved">Unresolved Only</SelectItem>
                    <SelectItem value="resolved">Resolved Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Error Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardHeader className="p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Total Errors</p>
                  <Bug className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <p className="text-2xl font-bold">{errors.length}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Unresolved</p>
                  <AlertCircle className="h-4 w-4 text-destructive" />
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <p className="text-2xl font-bold text-destructive">
                  {errors.filter(e => !e.resolved).length}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Critical</p>
                  <XCircle className="h-4 w-4 text-destructive" />
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <p className="text-2xl font-bold">
                  {errors.filter(e => e.severity === 'critical' && !e.resolved).length}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Resolved Today</p>
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <p className="text-2xl font-bold text-green-600">
                  {errors.filter(e => 
                    e.resolved && 
                    e.resolvedAt && 
                    format(new Date(e.resolvedAt), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
                  ).length}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Error List */}
          {filteredErrors.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>No errors found</AlertTitle>
              <AlertDescription>
                {errors.length === 0 
                  ? 'No errors have been logged yet. This is good!'
                  : 'No errors match your current filters.'}
              </AlertDescription>
            </Alert>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">Timestamp</TableHead>
                    <TableHead className="w-[100px]">Type</TableHead>
                    <TableHead className="w-[100px]">Severity</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead className="w-[100px]">Status</TableHead>
                    <TableHead className="w-[120px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredErrors.map((error) => (
                    <TableRow key={error.id} className={error.resolved ? 'opacity-60' : ''}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm">
                              {format(new Date(error.timestamp), 'MMM d, yyyy')}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(error.timestamp), 'h:mm:ss a')}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getErrorTypeIcon(error.errorType)}
                          <span className="text-sm capitalize">
                            {error.errorType}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className={`flex items-center gap-2 ${getSeverityColor(error.severity)}`}>
                          {getSeverityIcon(error.severity)}
                          <span className="text-sm capitalize">
                            {error.severity}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm line-clamp-2">{error.message}</p>
                      </TableCell>
                      <TableCell>
                        {error.resolved ? (
                          <Badge variant="success">Resolved</Badge>
                        ) : (
                          <Badge variant="destructive">Open</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedError(error)}
                          >
                            View
                          </Button>
                          {!error.resolved && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleMarkResolved(error.id)}
                            >
                              Resolve
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Common Issues & Solutions */}
      <Card>
        <CardHeader>
          <CardTitle>Common Issues & Solutions</CardTitle>
          <CardDescription>
            Quick solutions for frequently encountered problems
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="border rounded-lg p-4 space-y-2">
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-destructive mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-medium">Authentication Errors</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Token expired or invalid credentials
                  </p>
                  <div className="mt-2 space-y-1">
                    <p className="text-sm">• Reconnect your HubSpot account from the Connection Status tab</p>
                    <p className="text-sm">• Ensure you have the necessary scopes/permissions</p>
                    <p className="text-sm">• Check if your HubSpot account is still active</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="border rounded-lg p-4 space-y-2">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-medium">Rate Limit Errors</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Too many API requests to HubSpot
                  </p>
                  <div className="mt-2 space-y-1">
                    <p className="text-sm">• Reduce sync frequency in Sync Settings</p>
                    <p className="text-sm">• Increase batch size to reduce API calls</p>
                    <p className="text-sm">• Enable request throttling in advanced settings</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="border rounded-lg p-4 space-y-2">
              <div className="flex items-start gap-3">
                <RefreshCw className="h-5 w-5 text-blue-600 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-medium">Sync Failures</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Data synchronization issues
                  </p>
                  <div className="mt-2 space-y-1">
                    <p className="text-sm">• Check field mappings for type mismatches</p>
                    <p className="text-sm">• Verify required fields are mapped correctly</p>
                    <p className="text-sm">• Review webhook subscriptions for conflicts</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Details Dialog */}
      {selectedError && (
        <Dialog open={!!selectedError} onOpenChange={() => setSelectedError(null)}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Error Details</DialogTitle>
              <DialogDescription>
                Full details for error {selectedError.id}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Timestamp</Label>
                  <p className="text-sm">
                    {format(new Date(selectedError.timestamp), 'PPpp')}
                  </p>
                </div>
                <div>
                  <Label>Error Type</Label>
                  <div className="flex items-center gap-2 mt-1">
                    {getErrorTypeIcon(selectedError.errorType)}
                    <span className="text-sm capitalize">{selectedError.errorType}</span>
                  </div>
                </div>
                <div>
                  <Label>Severity</Label>
                  <div className={`flex items-center gap-2 mt-1 ${getSeverityColor(selectedError.severity)}`}>
                    {getSeverityIcon(selectedError.severity)}
                    <span className="text-sm capitalize">{selectedError.severity}</span>
                  </div>
                </div>
                <div>
                  <Label>Status</Label>
                  <div className="mt-1">
                    {selectedError.resolved ? (
                      <Badge variant="success">Resolved</Badge>
                    ) : (
                      <Badge variant="destructive">Open</Badge>
                    )}
                  </div>
                </div>
              </div>

              {selectedError.resolved && selectedError.resolvedAt && (
                <div>
                  <Label>Resolved</Label>
                  <p className="text-sm">
                    {format(new Date(selectedError.resolvedAt), 'PPpp')}
                    {selectedError.resolvedBy && ` by ${selectedError.resolvedBy}`}
                  </p>
                </div>
              )}

              <div>
                <Label>Error Message</Label>
                <p className="text-sm mt-1">{selectedError.message}</p>
              </div>

              {selectedError.details && (
                <div>
                  <Label>Additional Details</Label>
                  <ScrollArea className="h-64 border rounded-lg p-4 mt-1">
                    <pre className="text-xs">
                      {JSON.stringify(selectedError.details, null, 2)}
                    </pre>
                  </ScrollArea>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(selectedError, null, 2));
                    toast({
                      title: 'Copied',
                      description: 'Error details copied to clipboard',
                    });
                  }}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Details
                </Button>
                {!selectedError.resolved && (
                  <Button
                    onClick={() => {
                      handleMarkResolved(selectedError.id);
                      setSelectedError(null);
                    }}
                  >
                    Mark as Resolved
                  </Button>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}