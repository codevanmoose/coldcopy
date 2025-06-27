'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  X, 
  ArrowRight, 
  ArrowLeft, 
  ArrowLeftRight,
  Zap,
  Database,
  Cloud,
  AlertCircle,
  CheckCircle,
  Clock,
  TrendingUp,
  Activity
} from 'lucide-react';
import { PipedriveFieldMapping } from './types';
import { cn } from '@/lib/utils';

interface FieldPreviewProps {
  mappings: PipedriveFieldMapping[];
  onClose: () => void;
}

// Sample data for preview
const SAMPLE_DATA = {
  lead: {
    email: 'john.doe@example.com',
    firstName: 'John',
    lastName: 'Doe',
    fullName: 'John Doe',
    company: 'Acme Corp',
    jobTitle: 'VP of Sales',
    phone: '+1 555-123-4567',
    website: 'https://acmecorp.com',
    linkedinUrl: 'https://linkedin.com/in/johndoe',
    industry: 'Technology',
    companySize: 500,
    annualRevenue: 50000000,
    location: 'San Francisco, CA',
    leadSource: 'Website',
    leadStatus: 'Qualified',
  },
  campaign: {
    campaignName: 'Q4 Outreach Campaign',
    campaignStatus: 'Active',
    sequenceStep: 3,
    campaignTags: ['enterprise', 'saas', 'decision-maker'],
  },
  engagement: {
    emailsSent: 5,
    emailsOpened: 4,
    emailsClicked: 2,
    emailsReplied: 1,
    lastEngagementDate: new Date().toISOString(),
    engagementScore: 85,
    openRate: 0.8,
    clickRate: 0.4,
  },
};

export function FieldPreview({ mappings, onClose }: FieldPreviewProps) {
  const [selectedMapping, setSelectedMapping] = useState<PipedriveFieldMapping | null>(null);
  const [previewMode, setPreviewMode] = useState<'flow' | 'table' | 'sync'>('flow');

  const getDirectionIcon = (direction: string) => {
    switch (direction) {
      case 'to_pipedrive':
        return <ArrowRight className="h-4 w-4" />;
      case 'from_pipedrive':
        return <ArrowLeft className="h-4 w-4" />;
      case 'bidirectional':
        return <ArrowLeftRight className="h-4 w-4" />;
    }
  };

  const getSampleValue = (fieldName: string, category: string) => {
    const categoryData = SAMPLE_DATA[category as keyof typeof SAMPLE_DATA];
    return categoryData?.[fieldName as keyof typeof categoryData] || 'N/A';
  };

  const applyTransform = (value: any, transform?: any): any => {
    if (!transform) return value;
    
    // Simulate transform application
    switch (transform.id) {
      case 'uppercase':
        return typeof value === 'string' ? value.toUpperCase() : value;
      case 'lowercase':
        return typeof value === 'string' ? value.toLowerCase() : value;
      case 'trim':
        return typeof value === 'string' ? value.trim() : value;
      case 'split_name':
        if (typeof value === 'string') {
          const parts = value.split(' ');
          return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
        }
        return value;
      default:
        return value;
    }
  };

  const getSyncStats = () => {
    const active = mappings.filter(m => m.isActive).length;
    const withTransforms = mappings.filter(m => m.transformFunction).length;
    const bidirectional = mappings.filter(m => m.direction === 'bidirectional').length;
    const withErrors = mappings.filter(m => m.syncErrors && m.syncErrors > 0).length;
    
    return { active, withTransforms, bidirectional, withErrors };
  };

  const stats = getSyncStats();

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-6xl max-h-[90vh] overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Field Mapping Preview</CardTitle>
            <CardDescription>
              Preview how data flows between ColdCopy and Pipedrive
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Tabs value={previewMode} onValueChange={(v: any) => setPreviewMode(v)}>
            <div className="px-6 py-2 border-b">
              <TabsList>
                <TabsTrigger value="flow">Data Flow</TabsTrigger>
                <TabsTrigger value="table">Table View</TabsTrigger>
                <TabsTrigger value="sync">Sync Analytics</TabsTrigger>
              </TabsList>
            </div>

            <ScrollArea className="h-[600px]">
              <TabsContent value="flow" className="p-6 space-y-4">
                {mappings.map((mapping) => (
                  <Card
                    key={mapping.id}
                    className={cn(
                      "p-4 cursor-pointer transition-all",
                      selectedMapping?.id === mapping.id && "border-primary"
                    )}
                    onClick={() => setSelectedMapping(mapping)}
                  >
                    <div className="grid grid-cols-3 gap-4 items-center">
                      {/* Source */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Database className="h-4 w-4 text-blue-500" />
                          <span className="font-medium">ColdCopy</span>
                        </div>
                        <div className="p-3 bg-muted rounded-lg">
                          <p className="font-medium text-sm">{mapping.coldcopyField.label}</p>
                          <p className="text-xs text-muted-foreground">{mapping.coldcopyField.name}</p>
                          <div className="mt-2">
                            <Badge variant="secondary" className="text-xs">
                              {mapping.coldcopyField.type}
                            </Badge>
                          </div>
                          <div className="mt-2 p-2 bg-background rounded border">
                            <p className="text-xs font-mono">
                              {JSON.stringify(getSampleValue(mapping.coldcopyField.name, mapping.coldcopyField.category), null, 2)}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Transform */}
                      <div className="flex flex-col items-center gap-2">
                        <div className="flex items-center gap-2">
                          {getDirectionIcon(mapping.direction)}
                          <span className="text-sm text-muted-foreground">
                            {mapping.direction.replace('_', ' ')}
                          </span>
                        </div>
                        {mapping.transformFunction && (
                          <div className="w-full p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                            <div className="flex items-center gap-2 mb-2">
                              <Zap className="h-4 w-4 text-yellow-600" />
                              <span className="font-medium text-sm">Transform</span>
                            </div>
                            <p className="text-xs">{mapping.transformFunction.name}</p>
                            <div className="mt-2 p-2 bg-background rounded border">
                              <p className="text-xs font-mono">
                                {JSON.stringify(
                                  applyTransform(
                                    getSampleValue(mapping.coldcopyField.name, mapping.coldcopyField.category),
                                    mapping.transformFunction
                                  ),
                                  null,
                                  2
                                )}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Target */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 justify-end">
                          <span className="font-medium">Pipedrive</span>
                          <Cloud className="h-4 w-4 text-green-500" />
                        </div>
                        <div className="p-3 bg-muted rounded-lg">
                          <p className="font-medium text-sm">{mapping.pipedriveField.name}</p>
                          <p className="text-xs text-muted-foreground">{mapping.pipedriveField.key}</p>
                          <div className="mt-2">
                            <Badge variant="secondary" className="text-xs">
                              {mapping.pipedriveField.field_type}
                            </Badge>
                          </div>
                          <div className="mt-2 p-2 bg-background rounded border">
                            <p className="text-xs font-mono">
                              {JSON.stringify(
                                mapping.transformFunction
                                  ? applyTransform(
                                      getSampleValue(mapping.coldcopyField.name, mapping.coldcopyField.category),
                                      mapping.transformFunction
                                    )
                                  : getSampleValue(mapping.coldcopyField.name, mapping.coldcopyField.category),
                                null,
                                2
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </TabsContent>

              <TabsContent value="table" className="p-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ColdCopy Field</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Direction</TableHead>
                      <TableHead>Transform</TableHead>
                      <TableHead>Pipedrive Field</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mappings.map((mapping) => (
                      <TableRow key={mapping.id}>
                        <TableCell className="font-medium">
                          {mapping.coldcopyField.label}
                          {mapping.coldcopyField.required && (
                            <span className="text-red-500 ml-1">*</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {mapping.coldcopyField.type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getDirectionIcon(mapping.direction)}
                            <span className="text-xs">
                              {mapping.direction.replace('_', ' ')}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {mapping.transformFunction ? (
                            <div className="flex items-center gap-1">
                              <Zap className="h-3 w-3 text-yellow-500" />
                              <span className="text-xs">
                                {mapping.transformFunction.name}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">None</span>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">
                          {mapping.pipedriveField.name}
                          {mapping.pipedriveField.mandatory_flag && (
                            <span className="text-red-500 ml-1">*</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {mapping.pipedriveField.field_type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {mapping.isActive ? (
                            <Badge variant="success" className="text-xs">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">
                              Inactive
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TabsContent>

              <TabsContent value="sync" className="p-6 space-y-6">
                <div className="grid grid-cols-4 gap-4">
                  <Card className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Active Mappings</p>
                        <p className="text-2xl font-bold">{stats.active}</p>
                      </div>
                      <Activity className="h-8 w-8 text-green-500" />
                    </div>
                  </Card>
                  <Card className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">With Transforms</p>
                        <p className="text-2xl font-bold">{stats.withTransforms}</p>
                      </div>
                      <Zap className="h-8 w-8 text-yellow-500" />
                    </div>
                  </Card>
                  <Card className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Bidirectional</p>
                        <p className="text-2xl font-bold">{stats.bidirectional}</p>
                      </div>
                      <ArrowLeftRight className="h-8 w-8 text-blue-500" />
                    </div>
                  </Card>
                  <Card className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">With Errors</p>
                        <p className="text-2xl font-bold">{stats.withErrors}</p>
                      </div>
                      <AlertCircle className="h-8 w-8 text-red-500" />
                    </div>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Field Coverage</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {['lead', 'campaign', 'engagement', 'enrichment'].map((category) => {
                        const categoryMappings = mappings.filter(m => m.coldcopyField.category === category);
                        const percentage = (categoryMappings.length / mappings.length) * 100 || 0;
                        
                        return (
                          <div key={category}>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium capitalize">{category}</span>
                              <span className="text-sm text-muted-foreground">
                                {categoryMappings.length} fields
                              </span>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary transition-all"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Recent Sync Activity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {mappings.slice(0, 5).map((mapping) => (
                        <div key={mapping.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                          <div className="flex items-center gap-3">
                            {mapping.syncErrors ? (
                              <AlertCircle className="h-4 w-4 text-red-500" />
                            ) : mapping.lastSynced ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <Clock className="h-4 w-4 text-gray-500" />
                            )}
                            <div>
                              <p className="text-sm font-medium">
                                {mapping.coldcopyField.label} → {mapping.pipedriveField.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {mapping.lastSynced 
                                  ? `Last synced: ${new Date(mapping.lastSynced).toLocaleString()}`
                                  : 'Never synced'}
                              </p>
                            </div>
                          </div>
                          {mapping.syncErrors && (
                            <Badge variant="destructive" className="text-xs">
                              {mapping.syncErrors} errors
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}