'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Upload,
  FileSpreadsheet,
  Database,
  Users,
  Building2,
  Briefcase,
  Calendar,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  Download,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  Pause,
  Play,
  Info,
  Zap,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import type {
  BulkSyncOptions,
  BulkSyncProgress,
  BulkSyncResult,
  BulkSyncError,
} from '@/lib/integrations/pipedrive/bulk-sync';

interface BulkSyncWizardProps {
  workspaceId: string;
  onComplete?: (result: BulkSyncResult) => void;
  onCancel?: () => void;
}

type WizardStep = 'source' | 'mapping' | 'options' | 'review' | 'syncing' | 'complete';

interface ImportData {
  persons: any[];
  organizations: any[];
  deals: any[];
  activities: any[];
}

interface SyncOptions extends BulkSyncOptions {
  source: 'file' | 'api' | 'database';
  fileFormat?: 'csv' | 'json' | 'xlsx';
  duplicateStrategy: 'skip' | 'update' | 'merge';
  syncEntities: {
    persons: boolean;
    organizations: boolean;
    deals: boolean;
    activities: boolean;
  };
}

export function BulkSyncWizard({
  workspaceId,
  onComplete,
  onCancel,
}: BulkSyncWizardProps) {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState<WizardStep>('source');
  const [importData, setImportData] = useState<ImportData>({
    persons: [],
    organizations: [],
    deals: [],
    activities: [],
  });
  const [syncOptions, setSyncOptions] = useState<SyncOptions>({
    workspaceId,
    source: 'file',
    batchSize: 50,
    maxConcurrency: 5,
    retryAttempts: 3,
    retryDelay: 1000,
    validateData: true,
    detectDuplicates: true,
    dryRun: false,
    continueOnError: true,
    duplicateStrategy: 'skip',
    syncEntities: {
      persons: true,
      organizations: true,
      deals: true,
      activities: true,
    },
  });
  const [syncProgress, setSyncProgress] = useState<{
    [key: string]: BulkSyncProgress;
  }>({});
  const [syncResult, setSyncResult] = useState<BulkSyncResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  const steps: { key: WizardStep; label: string; icon: React.ReactNode }[] = [
    { key: 'source', label: 'Data Source', icon: <Database className="h-4 w-4" /> },
    { key: 'mapping', label: 'Field Mapping', icon: <FileSpreadsheet className="h-4 w-4" /> },
    { key: 'options', label: 'Sync Options', icon: <Zap className="h-4 w-4" /> },
    { key: 'review', label: 'Review', icon: <Info className="h-4 w-4" /> },
    { key: 'syncing', label: 'Syncing', icon: <RefreshCw className="h-4 w-4" /> },
    { key: 'complete', label: 'Complete', icon: <CheckCircle2 className="h-4 w-4" /> },
  ];

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    try {
      // Parse file based on format
      const fileData = await parseFile(file, syncOptions.fileFormat || 'csv');
      setImportData(fileData);
      toast({
        title: 'File uploaded successfully',
        description: `Found ${Object.values(fileData).reduce((sum, arr) => sum + arr.length, 0)} records`,
      });
    } catch (error) {
      toast({
        title: 'Error parsing file',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [syncOptions.fileFormat, toast]);

  const handleProgressUpdate = useCallback((progress: BulkSyncProgress) => {
    setSyncProgress(prev => ({
      ...prev,
      [progress.entityType]: progress,
    }));
  }, []);

  const startSync = useCallback(async () => {
    setIsLoading(true);
    setCurrentStep('syncing');
    const controller = new AbortController();
    setAbortController(controller);

    try {
      // Filter data based on selected entities
      const dataToSync: ImportData = {
        persons: syncOptions.syncEntities.persons ? importData.persons : [],
        organizations: syncOptions.syncEntities.organizations ? importData.organizations : [],
        deals: syncOptions.syncEntities.deals ? importData.deals : [],
        activities: syncOptions.syncEntities.activities ? importData.activities : [],
      };

      // Make API call to start bulk sync
      const response = await fetch('/api/pipedrive/bulk-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: dataToSync,
          options: {
            ...syncOptions,
            progressCallback: handleProgressUpdate,
          },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error('Sync failed');
      }

      const result: BulkSyncResult = await response.json();
      setSyncResult(result);
      setCurrentStep('complete');
      
      if (onComplete) {
        onComplete(result);
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        toast({
          title: 'Sync failed',
          description: error.message,
          variant: 'destructive',
        });
      }
    } finally {
      setIsLoading(false);
      setAbortController(null);
    }
  }, [importData, syncOptions, handleProgressUpdate, onComplete, toast]);

  const cancelSync = useCallback(() => {
    if (abortController) {
      abortController.abort();
      setIsPaused(false);
      toast({
        title: 'Sync cancelled',
        description: 'The sync operation has been cancelled',
      });
    }
  }, [abortController, toast]);

  const downloadReport = useCallback(() => {
    if (!syncResult) return;

    const report = generateDetailedReport(syncResult);
    const blob = new Blob([report], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pipedrive-sync-report-${new Date().toISOString()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [syncResult]);

  const renderStepContent = () => {
    switch (currentStep) {
      case 'source':
        return <DataSourceStep 
          options={syncOptions} 
          onChange={setSyncOptions}
          onFileUpload={handleFileUpload}
          importData={importData}
          isLoading={isLoading}
        />;
      
      case 'mapping':
        return <FieldMappingStep 
          importData={importData}
          options={syncOptions}
          onChange={setSyncOptions}
        />;
      
      case 'options':
        return <SyncOptionsStep 
          options={syncOptions}
          onChange={setSyncOptions}
        />;
      
      case 'review':
        return <ReviewStep 
          importData={importData}
          options={syncOptions}
        />;
      
      case 'syncing':
        return <SyncingStep 
          progress={syncProgress}
          isPaused={isPaused}
          onPause={() => setIsPaused(true)}
          onResume={() => setIsPaused(false)}
          onCancel={cancelSync}
        />;
      
      case 'complete':
        return <CompleteStep 
          result={syncResult}
          onDownloadReport={downloadReport}
        />;
      
      default:
        return null;
    }
  };

  const canProceed = useCallback(() => {
    switch (currentStep) {
      case 'source':
        return Object.values(importData).some(arr => arr.length > 0);
      case 'mapping':
        return true; // Field mapping is optional
      case 'options':
        return true;
      case 'review':
        return !syncOptions.dryRun || true; // Can always proceed from review
      default:
        return false;
    }
  }, [currentStep, importData, syncOptions.dryRun]);

  const handleNext = useCallback(() => {
    const stepIndex = steps.findIndex(s => s.key === currentStep);
    if (stepIndex < steps.length - 1) {
      const nextStep = steps[stepIndex + 1].key;
      
      // Special handling for starting sync
      if (nextStep === 'syncing') {
        startSync();
      } else {
        setCurrentStep(nextStep);
      }
    }
  }, [currentStep, steps, startSync]);

  const handleBack = useCallback(() => {
    const stepIndex = steps.findIndex(s => s.key === currentStep);
    if (stepIndex > 0) {
      setCurrentStep(steps[stepIndex - 1].key);
    }
  }, [currentStep, steps]);

  return (
    <Card className="w-full max-w-6xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Pipedrive Bulk Import</CardTitle>
            <CardDescription>
              Import your existing data into Pipedrive
            </CardDescription>
          </div>
          <Badge variant="secondary">
            Step {steps.findIndex(s => s.key === currentStep) + 1} of {steps.length}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent>
        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => {
              const isActive = step.key === currentStep;
              const isComplete = steps.findIndex(s => s.key === currentStep) > index;
              
              return (
                <div
                  key={step.key}
                  className="flex items-center"
                >
                  <div
                    className={cn(
                      "flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors",
                      isActive
                        ? "border-primary bg-primary text-primary-foreground"
                        : isComplete
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-muted-foreground/20 text-muted-foreground"
                    )}
                  >
                    {step.icon}
                  </div>
                  <div className="ml-2">
                    <p
                      className={cn(
                        "text-sm font-medium",
                        isActive || isComplete
                          ? "text-foreground"
                          : "text-muted-foreground"
                      )}
                    >
                      {step.label}
                    </p>
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={cn(
                        "w-24 h-0.5 mx-4",
                        isComplete
                          ? "bg-primary"
                          : "bg-muted-foreground/20"
                      )}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <Separator className="mb-6" />

        {/* Step Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {renderStepContent()}
          </motion.div>
        </AnimatePresence>
      </CardContent>

      <CardFooter className="flex justify-between">
        <Button
          variant="outline"
          onClick={currentStep === 'source' ? onCancel : handleBack}
          disabled={isLoading || currentStep === 'syncing' || currentStep === 'complete'}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {currentStep === 'source' ? 'Cancel' : 'Back'}
        </Button>
        
        {currentStep !== 'syncing' && currentStep !== 'complete' && (
          <Button
            onClick={handleNext}
            disabled={!canProceed() || isLoading}
          >
            {currentStep === 'review' ? 'Start Import' : 'Next'}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}
        
        {currentStep === 'complete' && (
          <Button onClick={onCancel}>
            Close
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

// Step Components

function DataSourceStep({
  options,
  onChange,
  onFileUpload,
  importData,
  isLoading,
}: {
  options: SyncOptions;
  onChange: (options: SyncOptions) => void;
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  importData: ImportData;
  isLoading: boolean;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-4">Select Data Source</h3>
        <RadioGroup
          value={options.source}
          onValueChange={(value) => onChange({ ...options, source: value as any })}
        >
          <div className="space-y-3">
            <label className="flex items-center space-x-3 cursor-pointer">
              <RadioGroupItem value="file" />
              <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">File Upload</p>
                <p className="text-sm text-muted-foreground">
                  Import from CSV, JSON, or Excel files
                </p>
              </div>
            </label>
            
            <label className="flex items-center space-x-3 cursor-pointer">
              <RadioGroupItem value="api" />
              <Zap className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">API Connection</p>
                <p className="text-sm text-muted-foreground">
                  Connect to another CRM or data source
                </p>
              </div>
            </label>
            
            <label className="flex items-center space-x-3 cursor-pointer">
              <RadioGroupItem value="database" />
              <Database className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Database</p>
                <p className="text-sm text-muted-foreground">
                  Import directly from your database
                </p>
              </div>
            </label>
          </div>
        </RadioGroup>
      </div>

      {options.source === 'file' && (
        <div className="space-y-4">
          <div>
            <Label htmlFor="fileFormat">File Format</Label>
            <Select
              value={options.fileFormat}
              onValueChange={(value) => onChange({ ...options, fileFormat: value as any })}
            >
              <SelectTrigger id="fileFormat">
                <SelectValue placeholder="Select file format" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="csv">CSV</SelectItem>
                <SelectItem value="json">JSON</SelectItem>
                <SelectItem value="xlsx">Excel (XLSX)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
            <input
              type="file"
              id="file-upload"
              className="hidden"
              accept={getFileAccept(options.fileFormat)}
              onChange={onFileUpload}
              disabled={isLoading}
            />
            <label
              htmlFor="file-upload"
              className="cursor-pointer flex flex-col items-center"
            >
              {isLoading ? (
                <Loader2 className="h-12 w-12 text-muted-foreground animate-spin" />
              ) : (
                <Upload className="h-12 w-12 text-muted-foreground" />
              )}
              <p className="mt-2 text-sm font-medium">
                {isLoading ? 'Processing file...' : 'Click to upload or drag and drop'}
              </p>
              <p className="text-xs text-muted-foreground">
                {getFileFormatHint(options.fileFormat)}
              </p>
            </label>
          </div>
        </div>
      )}

      {/* Data Preview */}
      {Object.values(importData).some(arr => arr.length > 0) && (
        <div className="space-y-4">
          <h4 className="font-medium">Data Preview</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="flex items-center space-x-2">
                <Building2 className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">{importData.organizations.length}</p>
                  <p className="text-sm text-muted-foreground">Organizations</p>
                </div>
              </div>
            </Card>
            
            <Card className="p-4">
              <div className="flex items-center space-x-2">
                <Users className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">{importData.persons.length}</p>
                  <p className="text-sm text-muted-foreground">Persons</p>
                </div>
              </div>
            </Card>
            
            <Card className="p-4">
              <div className="flex items-center space-x-2">
                <Briefcase className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">{importData.deals.length}</p>
                  <p className="text-sm text-muted-foreground">Deals</p>
                </div>
              </div>
            </Card>
            
            <Card className="p-4">
              <div className="flex items-center space-x-2">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">{importData.activities.length}</p>
                  <p className="text-sm text-muted-foreground">Activities</p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

function FieldMappingStep({
  importData,
  options,
  onChange,
}: {
  importData: ImportData;
  options: SyncOptions;
  onChange: (options: SyncOptions) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-2">Field Mapping</h3>
        <p className="text-sm text-muted-foreground">
          Map your data fields to Pipedrive fields. We've automatically detected common fields.
        </p>
      </div>

      <Tabs defaultValue="organizations" className="w-full">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="organizations" disabled={importData.organizations.length === 0}>
            Organizations
          </TabsTrigger>
          <TabsTrigger value="persons" disabled={importData.persons.length === 0}>
            Persons
          </TabsTrigger>
          <TabsTrigger value="deals" disabled={importData.deals.length === 0}>
            Deals
          </TabsTrigger>
          <TabsTrigger value="activities" disabled={importData.activities.length === 0}>
            Activities
          </TabsTrigger>
        </TabsList>

        <TabsContent value="organizations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Organization Field Mapping</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <FieldMappingRow 
                  sourceField="Company Name"
                  targetField="name"
                  isRequired
                />
                <FieldMappingRow 
                  sourceField="Company Domain"
                  targetField="domain"
                />
                <FieldMappingRow 
                  sourceField="Address"
                  targetField="address"
                />
                <FieldMappingRow 
                  sourceField="Industry"
                  targetField="custom_field_industry"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="persons" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Person Field Mapping</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <FieldMappingRow 
                  sourceField="Full Name"
                  targetField="name"
                  isRequired
                />
                <FieldMappingRow 
                  sourceField="Email"
                  targetField="email"
                  isRequired
                />
                <FieldMappingRow 
                  sourceField="Phone"
                  targetField="phone"
                />
                <FieldMappingRow 
                  sourceField="Job Title"
                  targetField="job_title"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deals" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Deal Field Mapping</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <FieldMappingRow 
                  sourceField="Deal Name"
                  targetField="title"
                  isRequired
                />
                <FieldMappingRow 
                  sourceField="Value"
                  targetField="value"
                />
                <FieldMappingRow 
                  sourceField="Expected Close"
                  targetField="expected_close_date"
                />
                <FieldMappingRow 
                  sourceField="Stage"
                  targetField="stage_id"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activities" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Activity Field Mapping</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <FieldMappingRow 
                  sourceField="Subject"
                  targetField="subject"
                  isRequired
                />
                <FieldMappingRow 
                  sourceField="Type"
                  targetField="type"
                  isRequired
                />
                <FieldMappingRow 
                  sourceField="Due Date"
                  targetField="due_date"
                />
                <FieldMappingRow 
                  sourceField="Notes"
                  targetField="note"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function FieldMappingRow({
  sourceField,
  targetField,
  isRequired = false,
}: {
  sourceField: string;
  targetField: string;
  isRequired?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center space-x-2">
        <span className="text-sm font-medium">{sourceField}</span>
        {isRequired && (
          <Badge variant="outline" className="text-xs">
            Required
          </Badge>
        )}
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground" />
      <Select defaultValue={targetField}>
        <SelectTrigger className="w-[200px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={targetField}>{targetField}</SelectItem>
          <SelectItem value="skip">Skip this field</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

function SyncOptionsStep({
  options,
  onChange,
}: {
  options: SyncOptions;
  onChange: (options: SyncOptions) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-2">Sync Options</h3>
        <p className="text-sm text-muted-foreground">
          Configure how the import should handle duplicates and errors.
        </p>
      </div>

      <div className="space-y-6">
        {/* Entity Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Select Data to Import</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <label className="flex items-center space-x-2 cursor-pointer">
              <Checkbox
                checked={options.syncEntities.organizations}
                onCheckedChange={(checked) =>
                  onChange({
                    ...options,
                    syncEntities: { ...options.syncEntities, organizations: !!checked },
                  })
                }
              />
              <span className="text-sm font-medium">Organizations</span>
            </label>
            
            <label className="flex items-center space-x-2 cursor-pointer">
              <Checkbox
                checked={options.syncEntities.persons}
                onCheckedChange={(checked) =>
                  onChange({
                    ...options,
                    syncEntities: { ...options.syncEntities, persons: !!checked },
                  })
                }
              />
              <span className="text-sm font-medium">Persons</span>
            </label>
            
            <label className="flex items-center space-x-2 cursor-pointer">
              <Checkbox
                checked={options.syncEntities.deals}
                onCheckedChange={(checked) =>
                  onChange({
                    ...options,
                    syncEntities: { ...options.syncEntities, deals: !!checked },
                  })
                }
              />
              <span className="text-sm font-medium">Deals</span>
            </label>
            
            <label className="flex items-center space-x-2 cursor-pointer">
              <Checkbox
                checked={options.syncEntities.activities}
                onCheckedChange={(checked) =>
                  onChange({
                    ...options,
                    syncEntities: { ...options.syncEntities, activities: !!checked },
                  })
                }
              />
              <span className="text-sm font-medium">Activities</span>
            </label>
          </CardContent>
        </Card>

        {/* Duplicate Handling */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Duplicate Handling</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="detectDuplicates"
                checked={options.detectDuplicates}
                onCheckedChange={(checked) =>
                  onChange({ ...options, detectDuplicates: !!checked })
                }
              />
              <Label htmlFor="detectDuplicates" className="cursor-pointer">
                Detect duplicates before importing
              </Label>
            </div>

            {options.detectDuplicates && (
              <div className="pl-6">
                <Label htmlFor="duplicateStrategy">When duplicates are found:</Label>
                <RadioGroup
                  value={options.duplicateStrategy}
                  onValueChange={(value) =>
                    onChange({ ...options, duplicateStrategy: value as any })
                  }
                  className="mt-2 space-y-2"
                >
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <RadioGroupItem value="skip" />
                    <span className="text-sm">Skip duplicate records</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <RadioGroupItem value="update" />
                    <span className="text-sm">Update existing records</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <RadioGroupItem value="merge" />
                    <span className="text-sm">Merge data with existing records</span>
                  </label>
                </RadioGroup>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Advanced Options */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Advanced Options</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="validateData"
                checked={options.validateData}
                onCheckedChange={(checked) =>
                  onChange({ ...options, validateData: !!checked })
                }
              />
              <Label htmlFor="validateData" className="cursor-pointer">
                Validate data before importing
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="continueOnError"
                checked={options.continueOnError}
                onCheckedChange={(checked) =>
                  onChange({ ...options, continueOnError: !!checked })
                }
              />
              <Label htmlFor="continueOnError" className="cursor-pointer">
                Continue import if errors occur
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="dryRun"
                checked={options.dryRun}
                onCheckedChange={(checked) =>
                  onChange({ ...options, dryRun: !!checked })
                }
              />
              <Label htmlFor="dryRun" className="cursor-pointer">
                Test import (dry run)
              </Label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="batchSize">Batch Size</Label>
                <Select
                  value={options.batchSize?.toString()}
                  onValueChange={(value) =>
                    onChange({ ...options, batchSize: parseInt(value) })
                  }
                >
                  <SelectTrigger id="batchSize">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10 records</SelectItem>
                    <SelectItem value="25">25 records</SelectItem>
                    <SelectItem value="50">50 records</SelectItem>
                    <SelectItem value="100">100 records</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="maxConcurrency">Concurrent Requests</Label>
                <Select
                  value={options.maxConcurrency?.toString()}
                  onValueChange={(value) =>
                    onChange({ ...options, maxConcurrency: parseInt(value) })
                  }
                >
                  <SelectTrigger id="maxConcurrency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 (Slowest)</SelectItem>
                    <SelectItem value="3">3</SelectItem>
                    <SelectItem value="5">5 (Recommended)</SelectItem>
                    <SelectItem value="10">10 (Fastest)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ReviewStep({
  importData,
  options,
}: {
  importData: ImportData;
  options: SyncOptions;
}) {
  const totalRecords = Object.values(options.syncEntities)
    .map((enabled, index) => {
      if (!enabled) return 0;
      const keys = ['organizations', 'persons', 'deals', 'activities'] as const;
      return importData[keys[index]]?.length || 0;
    })
    .reduce((sum, count) => sum + count, 0);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-2">Review Import Settings</h3>
        <p className="text-sm text-muted-foreground">
          Please review your import settings before proceeding.
        </p>
      </div>

      <div className="space-y-6">
        {/* Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Import Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Total Records</span>
                <span className="font-medium">{totalRecords}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Import Mode</span>
                <Badge variant={options.dryRun ? 'secondary' : 'default'}>
                  {options.dryRun ? 'Test Run' : 'Live Import'}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Duplicate Strategy</span>
                <span className="font-medium capitalize">{options.duplicateStrategy}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Data Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Data to Import</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {options.syncEntities.organizations && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Organizations</span>
                  </div>
                  <span className="font-medium">{importData.organizations.length}</span>
                </div>
              )}
              
              {options.syncEntities.persons && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Persons</span>
                  </div>
                  <span className="font-medium">{importData.persons.length}</span>
                </div>
              )}
              
              {options.syncEntities.deals && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Deals</span>
                  </div>
                  <span className="font-medium">{importData.deals.length}</span>
                </div>
              )}
              
              {options.syncEntities.activities && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Activities</span>
                  </div>
                  <span className="font-medium">{importData.activities.length}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Import Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex items-center space-x-2">
                {options.validateData ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-muted-foreground" />
                )}
                <span>Data validation {options.validateData ? 'enabled' : 'disabled'}</span>
              </div>
              
              <div className="flex items-center space-x-2">
                {options.detectDuplicates ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-muted-foreground" />
                )}
                <span>Duplicate detection {options.detectDuplicates ? 'enabled' : 'disabled'}</span>
              </div>
              
              <div className="flex items-center space-x-2">
                {options.continueOnError ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-muted-foreground" />
                )}
                <span>Continue on error {options.continueOnError ? 'enabled' : 'disabled'}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {options.dryRun && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Test Mode</AlertTitle>
            <AlertDescription>
              This is a test run. No data will be actually imported to Pipedrive.
              The import will simulate the process and report any potential issues.
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}

function SyncingStep({
  progress,
  isPaused,
  onPause,
  onResume,
  onCancel,
}: {
  progress: { [key: string]: BulkSyncProgress };
  isPaused: boolean;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
}) {
  const calculateOverallProgress = () => {
    const progressValues = Object.values(progress);
    if (progressValues.length === 0) return 0;
    
    const totalProcessed = progressValues.reduce((sum, p) => sum + p.processed, 0);
    const totalItems = progressValues.reduce((sum, p) => sum + p.total, 0);
    
    return totalItems > 0 ? Math.round((totalProcessed / totalItems) * 100) : 0;
  };

  const overallProgress = calculateOverallProgress();

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h3 className="text-lg font-medium">Importing Data</h3>
        <p className="text-sm text-muted-foreground">
          {isPaused ? 'Import paused' : 'Please wait while we import your data...'}
        </p>
      </div>

      {/* Overall Progress */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>Overall Progress</span>
          <span className="font-medium">{overallProgress}%</span>
        </div>
        <Progress value={overallProgress} className="h-2" />
      </div>

      {/* Entity Progress */}
      <div className="space-y-4">
        {Object.entries(progress).map(([entityType, entityProgress]) => (
          <EntityProgress
            key={entityType}
            entityType={entityType}
            progress={entityProgress}
          />
        ))}
      </div>

      {/* Controls */}
      <div className="flex justify-center space-x-2">
        {isPaused ? (
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
    </div>
  );
}

function EntityProgress({
  entityType,
  progress,
}: {
  entityType: string;
  progress: BulkSyncProgress;
}) {
  const icon = {
    organization: <Building2 className="h-4 w-4" />,
    person: <Users className="h-4 w-4" />,
    deal: <Briefcase className="h-4 w-4" />,
    activity: <Calendar className="h-4 w-4" />,
  }[entityType] || <Database className="h-4 w-4" />;

  const percentage = progress.total > 0
    ? Math.round((progress.processed / progress.total) * 100)
    : 0;

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {icon}
              <span className="font-medium capitalize">{entityType}s</span>
            </div>
            <Badge variant={progress.phase === 'completed' ? 'success' : 'default'}>
              {progress.phase}
            </Badge>
          </div>

          <Progress value={percentage} className="h-2" />

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Progress</span>
              <span>{progress.processed} / {progress.total}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Success</span>
              <span className="text-green-600">{progress.successful}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Failed</span>
              <span className="text-red-600">{progress.failed}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Duplicates</span>
              <span className="text-yellow-600">{progress.duplicates}</span>
            </div>
          </div>

          {progress.errors.length > 0 && (
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground mb-1">
                Recent errors:
              </p>
              <div className="space-y-1">
                {progress.errors.slice(-3).map((error, index) => (
                  <p key={index} className="text-xs text-red-600 truncate">
                    {error.error}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function CompleteStep({
  result,
  onDownloadReport,
}: {
  result: BulkSyncResult | null;
  onDownloadReport: () => void;
}) {
  if (!result) {
    return (
      <div className="text-center py-8">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
        <p>Loading results...</p>
      </div>
    );
  }

  const successRate = result.summary.total > 0
    ? Math.round((result.summary.successful / result.summary.total) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        {result.success ? (
          <>
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
            <h3 className="text-lg font-medium">Import Completed Successfully</h3>
          </>
        ) : (
          <>
            <XCircle className="h-12 w-12 text-red-500 mx-auto" />
            <h3 className="text-lg font-medium">Import Completed with Errors</h3>
          </>
        )}
        <p className="text-sm text-muted-foreground">
          {result.success
            ? 'Your data has been successfully imported to Pipedrive.'
            : 'The import completed but some records failed to import.'}
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold">{result.summary.total}</p>
              <p className="text-sm text-muted-foreground">Total Records</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">
                {result.summary.successful}
              </p>
              <p className="text-sm text-muted-foreground">Successful</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-red-600">
                {result.summary.failed}
              </p>
              <p className="text-sm text-muted-foreground">Failed</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-yellow-600">
                {result.summary.duplicates}
              </p>
              <p className="text-sm text-muted-foreground">Duplicates</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Success Rate */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Success Rate</span>
              <span className="font-medium">{successRate}%</span>
            </div>
            <Progress value={successRate} className="h-3" />
          </div>
        </CardContent>
      </Card>

      {/* Detailed Results */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Import Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Object.entries(result.entities).map(([entityType, entities]) => {
              if (entities.length === 0) return null;
              
              const stats = {
                created: entities.filter(e => e.status === 'created').length,
                updated: entities.filter(e => e.status === 'updated').length,
                skipped: entities.filter(e => e.status === 'skipped').length,
                failed: entities.filter(e => e.status === 'failed').length,
              };

              return (
                <div key={entityType} className="flex items-center justify-between">
                  <span className="text-sm capitalize">{entityType}</span>
                  <div className="flex items-center space-x-2 text-xs">
                    <Badge variant="success">{stats.created} created</Badge>
                    {stats.updated > 0 && (
                      <Badge variant="secondary">{stats.updated} updated</Badge>
                    )}
                    {stats.skipped > 0 && (
                      <Badge variant="outline">{stats.skipped} skipped</Badge>
                    )}
                    {stats.failed > 0 && (
                      <Badge variant="destructive">{stats.failed} failed</Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Errors */}
      {result.errors.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Import Errors</AlertTitle>
          <AlertDescription>
            <ScrollArea className="h-32 mt-2">
              <div className="space-y-1">
                {result.errors.map((error, index) => (
                  <p key={index} className="text-xs">
                    {error.entityId && `[${error.entityId}] `}{error.error}
                  </p>
                ))}
              </div>
            </ScrollArea>
          </AlertDescription>
        </Alert>
      )}

      {/* Actions */}
      <div className="flex justify-center">
        <Button onClick={onDownloadReport} variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Download Report
        </Button>
      </div>
    </div>
  );
}

// Helper functions

function getFileAccept(format?: string): string {
  switch (format) {
    case 'csv':
      return '.csv';
    case 'json':
      return '.json';
    case 'xlsx':
      return '.xlsx,.xls';
    default:
      return '.csv,.json,.xlsx,.xls';
  }
}

function getFileFormatHint(format?: string): string {
  switch (format) {
    case 'csv':
      return 'CSV files with headers in the first row';
    case 'json':
      return 'JSON array of objects';
    case 'xlsx':
      return 'Excel files with data in the first sheet';
    default:
      return 'Select a file format above';
  }
}

async function parseFile(file: File, format: string): Promise<ImportData> {
  // This is a placeholder - actual implementation would parse the file
  // based on format and return structured data
  return {
    persons: [],
    organizations: [],
    deals: [],
    activities: [],
  };
}

function generateDetailedReport(result: BulkSyncResult): string {
  const lines: string[] = [];
  
  lines.push('# Pipedrive Import Report');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  
  lines.push('## Summary');
  lines.push(`- Total Records: ${result.summary.total}`);
  lines.push(`- Successful: ${result.summary.successful}`);
  lines.push(`- Failed: ${result.summary.failed}`);
  lines.push(`- Skipped: ${result.summary.skipped}`);
  lines.push(`- Duplicates: ${result.summary.duplicates}`);
  lines.push(`- Duration: ${(result.summary.duration / 1000).toFixed(2)} seconds`);
  lines.push('');
  
  // Add detailed breakdown for each entity type
  Object.entries(result.entities).forEach(([entityType, entities]) => {
    if (entities.length === 0) return;
    
    lines.push(`## ${entityType.charAt(0).toUpperCase() + entityType.slice(1)}`);
    lines.push(`Total: ${entities.length}`);
    
    const created = entities.filter(e => e.status === 'created');
    const updated = entities.filter(e => e.status === 'updated');
    const failed = entities.filter(e => e.status === 'failed');
    const skipped = entities.filter(e => e.status === 'skipped');
    
    if (created.length > 0) {
      lines.push(`### Created (${created.length})`);
      created.slice(0, 10).forEach(e => {
        lines.push(`- Local ID: ${e.localId} → Pipedrive ID: ${e.pipedriveId}`);
      });
      if (created.length > 10) {
        lines.push(`... and ${created.length - 10} more`);
      }
      lines.push('');
    }
    
    if (failed.length > 0) {
      lines.push(`### Failed (${failed.length})`);
      failed.forEach(e => {
        lines.push(`- Local ID: ${e.localId} - Error: ${e.error}`);
      });
      lines.push('');
    }
  });
  
  if (result.errors.length > 0) {
    lines.push('## Errors');
    result.errors.forEach((error, index) => {
      lines.push(`${index + 1}. ${error.error}`);
      if (error.entityId) {
        lines.push(`   Entity ID: ${error.entityId}`);
      }
    });
  }
  
  return lines.join('\n');
}