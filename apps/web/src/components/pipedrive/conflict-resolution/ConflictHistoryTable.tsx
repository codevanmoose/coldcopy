'use client';

import React, { useState } from 'react';
import { format } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertCircle,
  CheckCircle,
  Clock,
  Search,
  Filter,
  MoreHorizontal,
  Eye,
  Download,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus
} from 'lucide-react';
import { 
  ConflictHistory, 
  ConflictType, 
  ConflictSeverity 
} from '@/lib/integrations/pipedrive/conflict-resolution';
import { cn } from '@/lib/utils';

interface ConflictHistoryTableProps {
  conflicts: ConflictHistory[];
  onViewDetails: (conflict: ConflictHistory) => void;
  onResolve?: (conflictId: string) => void;
  isLoading?: boolean;
}

export function ConflictHistoryTable({
  conflicts,
  onViewDetails,
  onResolve,
  isLoading = false
}: ConflictHistoryTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEntity, setFilterEntity] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'severity'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const getEntityIcon = (entityType: string) => {
    switch (entityType) {
      case 'person': return '👤';
      case 'organization': return '🏢';
      case 'deal': return '💼';
      case 'activity': return '📋';
      default: return '📄';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getConflictTypeLabel = (type: ConflictType) => {
    switch (type) {
      case ConflictType.FIELD_CONFLICT: return 'Field';
      case ConflictType.DELETION_CONFLICT: return 'Deletion';
      case ConflictType.CREATION_CONFLICT: return 'Creation';
      case ConflictType.RELATIONSHIP_CONFLICT: return 'Relationship';
      case ConflictType.MERGE_CONFLICT: return 'Merge';
      case ConflictType.SCHEMA_CONFLICT: return 'Schema';
      default: return 'Unknown';
    }
  };

  const getResolutionStatus = (conflict: ConflictHistory) => {
    if (!conflict.resolvedAt) {
      return { label: 'Pending', color: 'bg-yellow-100 text-yellow-800', icon: Clock };
    }
    if (conflict.resolution?.resolved) {
      return { label: 'Resolved', color: 'bg-green-100 text-green-800', icon: CheckCircle };
    }
    return { label: 'Failed', color: 'bg-red-100 text-red-800', icon: AlertCircle };
  };

  const getConfidenceTrend = (confidence: number) => {
    if (confidence >= 80) return { icon: TrendingUp, color: 'text-green-600' };
    if (confidence >= 60) return { icon: Minus, color: 'text-yellow-600' };
    return { icon: TrendingDown, color: 'text-red-600' };
  };

  const filteredConflicts = conflicts.filter(conflict => {
    if (searchTerm && !conflict.entityId.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    if (filterEntity !== 'all' && conflict.entityType !== filterEntity) {
      return false;
    }
    if (filterType !== 'all' && conflict.conflictType !== filterType) {
      return false;
    }
    if (filterStatus !== 'all') {
      const isResolved = conflict.resolvedAt && conflict.resolution?.resolved;
      if (filterStatus === 'resolved' && !isResolved) return false;
      if (filterStatus === 'pending' && isResolved) return false;
    }
    return true;
  });

  const sortedConflicts = [...filteredConflicts].sort((a, b) => {
    if (sortBy === 'date') {
      const dateA = new Date(a.detectedAt).getTime();
      const dateB = new Date(b.detectedAt).getTime();
      return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    } else {
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const severityA = severityOrder[a.resolution?.confidence || 0];
      const severityB = severityOrder[b.resolution?.confidence || 0];
      return sortOrder === 'asc' ? severityA - severityB : severityB - severityA;
    }
  });

  const calculateStats = () => {
    const total = conflicts.length;
    const resolved = conflicts.filter(c => c.resolvedAt && c.resolution?.resolved).length;
    const pending = conflicts.filter(c => !c.resolvedAt).length;
    const avgConfidence = conflicts
      .filter(c => c.resolution?.confidence)
      .reduce((sum, c) => sum + (c.resolution?.confidence || 0), 0) / resolved || 0;

    return { total, resolved, pending, avgConfidence };
  };

  const stats = calculateStats();

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <div className="text-sm text-gray-500">Total Conflicts</div>
          <div className="text-2xl font-bold">{stats.total}</div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-sm text-gray-500">Resolved</div>
          <div className="text-2xl font-bold text-green-600">{stats.resolved}</div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-sm text-gray-500">Pending</div>
          <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-sm text-gray-500">Avg. Confidence</div>
          <div className="text-2xl font-bold">{stats.avgConfidence.toFixed(1)}%</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by entity ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Select value={filterEntity} onValueChange={setFilterEntity}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Entity Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Entities</SelectItem>
            <SelectItem value="person">Person</SelectItem>
            <SelectItem value="organization">Organization</SelectItem>
            <SelectItem value="deal">Deal</SelectItem>
            <SelectItem value="activity">Activity</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Conflict Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="field_conflict">Field</SelectItem>
            <SelectItem value="deletion_conflict">Deletion</SelectItem>
            <SelectItem value="creation_conflict">Creation</SelectItem>
            <SelectItem value="relationship_conflict">Relationship</SelectItem>
            <SelectItem value="merge_conflict">Merge</SelectItem>
            <SelectItem value="schema_conflict">Schema</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="outline" size="icon">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <ScrollArea className="h-[500px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">Type</TableHead>
                <TableHead>Entity ID</TableHead>
                <TableHead>Conflict Type</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>
                  <button
                    className="flex items-center gap-1 hover:text-gray-900"
                    onClick={() => {
                      setSortBy('date');
                      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                    }}
                  >
                    Detected
                    {sortBy === 'date' && (
                      <span className="text-xs">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </button>
                </TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Resolution</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Loading conflicts...
                    </div>
                  </TableCell>
                </TableRow>
              ) : sortedConflicts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                    No conflicts found
                  </TableCell>
                </TableRow>
              ) : (
                sortedConflicts.map((conflict) => {
                  const status = getResolutionStatus(conflict);
                  const confidence = conflict.resolution?.confidence || 0;
                  const trend = getConfidenceTrend(confidence);
                  
                  return (
                    <TableRow key={conflict.id} className="hover:bg-gray-50">
                      <TableCell>
                        <span className="text-lg">{getEntityIcon(conflict.entityType)}</span>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {conflict.entityId.slice(0, 8)}...
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {getConflictTypeLabel(conflict.conflictType)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={cn("text-xs", getSeverityColor(conflict.resolution?.confidence || 'medium'))}>
                          {conflict.resolution?.confidence || 'unknown'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(conflict.detectedAt), 'MMM d, HH:mm')}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {React.createElement(status.icon, { className: "h-4 w-4" })}
                          <Badge variant="outline" className={cn("text-xs", status.color)}>
                            {status.label}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        {conflict.resolution?.strategy && (
                          <Badge variant="secondary" className="text-xs">
                            {conflict.resolution.strategy}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {conflict.resolution?.confidence && (
                          <div className="flex items-center gap-1">
                            {React.createElement(trend.icon, { className: cn("h-4 w-4", trend.color) })}
                            <span className="text-sm font-medium">{confidence}%</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => onViewDetails(conflict)}>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            {!conflict.resolvedAt && onResolve && (
                              <DropdownMenuItem onClick={() => onResolve(conflict.id)}>
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Resolve
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem>
                              <Download className="h-4 w-4 mr-2" />
                              Export
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>
    </div>
  );
}