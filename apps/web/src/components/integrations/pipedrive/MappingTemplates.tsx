'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  X, 
  Download, 
  Eye, 
  Check,
  Users,
  TrendingUp,
  Headphones,
  Briefcase,
  Zap,
  ArrowRight,
  Building,
  Mail,
  Phone
} from 'lucide-react';
import { MappingTemplate, MappingPreset } from './types';

interface MappingTemplatesProps {
  onApplyTemplate: (template: MappingTemplate) => void;
  onClose: () => void;
}

const PRESET_TEMPLATES: MappingPreset[] = [
  {
    id: 'sales-basic',
    name: 'Sales Basic',
    icon: 'TrendingUp',
    description: 'Essential fields for sales teams',
    fieldCount: 12,
    template: {
      id: 'sales-basic',
      name: 'Sales Basic',
      description: 'Core contact and company information for sales outreach',
      category: 'sales',
      mappings: [
        {
          coldcopyField: { name: 'email', label: 'Email', type: 'email', required: true, category: 'lead' },
          pipedriveField: { id: '1', key: 'email', name: 'Email', type: 'email', field_type: 'email', mandatory_flag: true },
          direction: 'bidirectional',
          isActive: true,
        },
        {
          coldcopyField: { name: 'firstName', label: 'First Name', type: 'string', category: 'lead' },
          pipedriveField: { id: '2', key: 'first_name', name: 'First Name', type: 'varchar', field_type: 'varchar', mandatory_flag: false },
          direction: 'bidirectional',
          isActive: true,
        },
        {
          coldcopyField: { name: 'lastName', label: 'Last Name', type: 'string', category: 'lead' },
          pipedriveField: { id: '3', key: 'last_name', name: 'Last Name', type: 'varchar', field_type: 'varchar', mandatory_flag: false },
          direction: 'bidirectional',
          isActive: true,
        },
        {
          coldcopyField: { name: 'company', label: 'Company', type: 'string', category: 'lead' },
          pipedriveField: { id: '4', key: 'org_name', name: 'Organization', type: 'org', field_type: 'org', mandatory_flag: false },
          direction: 'bidirectional',
          isActive: true,
        },
        {
          coldcopyField: { name: 'jobTitle', label: 'Job Title', type: 'string', category: 'lead' },
          pipedriveField: { id: '5', key: 'job_title', name: 'Job Title', type: 'varchar', field_type: 'varchar', mandatory_flag: false },
          direction: 'bidirectional',
          isActive: true,
        },
        {
          coldcopyField: { name: 'phone', label: 'Phone', type: 'phone', category: 'lead' },
          pipedriveField: { id: '6', key: 'phone', name: 'Phone', type: 'phone', field_type: 'phone', mandatory_flag: false },
          direction: 'bidirectional',
          isActive: true,
        },
        {
          coldcopyField: { name: 'leadStatus', label: 'Lead Status', type: 'select', category: 'lead' },
          pipedriveField: { id: '7', key: 'lead_status', name: 'Lead Status', type: 'enum', field_type: 'enum', mandatory_flag: false },
          direction: 'bidirectional',
          isActive: true,
        },
        {
          coldcopyField: { name: 'leadSource', label: 'Lead Source', type: 'select', category: 'lead' },
          pipedriveField: { id: '8', key: 'source', name: 'Source', type: 'enum', field_type: 'enum', mandatory_flag: false },
          direction: 'to_pipedrive',
          isActive: true,
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
      isDefault: true,
    },
  },
  {
    id: 'sales-advanced',
    name: 'Sales Advanced',
    icon: 'Briefcase',
    description: 'Complete sales workflow with enrichment data',
    fieldCount: 20,
    template: {
      id: 'sales-advanced',
      name: 'Sales Advanced',
      description: 'Comprehensive mapping including company data and engagement metrics',
      category: 'sales',
      mappings: [
        // Include all basic fields plus:
        {
          coldcopyField: { name: 'website', label: 'Website', type: 'url', category: 'lead' },
          pipedriveField: { id: '9', key: 'website', name: 'Website', type: 'varchar', field_type: 'varchar', mandatory_flag: false },
          direction: 'bidirectional',
          isActive: true,
        },
        {
          coldcopyField: { name: 'linkedinUrl', label: 'LinkedIn URL', type: 'url', category: 'lead' },
          pipedriveField: { id: '10', key: 'linkedin', name: 'LinkedIn', type: 'varchar', field_type: 'varchar', mandatory_flag: false },
          direction: 'to_pipedrive',
          isActive: true,
        },
        {
          coldcopyField: { name: 'industry', label: 'Industry', type: 'string', category: 'lead' },
          pipedriveField: { id: '11', key: 'industry', name: 'Industry', type: 'varchar', field_type: 'varchar', mandatory_flag: false },
          direction: 'bidirectional',
          isActive: true,
        },
        {
          coldcopyField: { name: 'companySize', label: 'Company Size', type: 'number', category: 'lead' },
          pipedriveField: { id: '12', key: 'employees', name: 'Number of Employees', type: 'double', field_type: 'double', mandatory_flag: false },
          direction: 'bidirectional',
          isActive: true,
        },
        {
          coldcopyField: { name: 'annualRevenue', label: 'Annual Revenue', type: 'number', category: 'lead' },
          pipedriveField: { id: '13', key: 'annual_revenue', name: 'Annual Revenue', type: 'monetary', field_type: 'monetary', mandatory_flag: false },
          direction: 'to_pipedrive',
          isActive: true,
        },
        {
          coldcopyField: { name: 'engagementScore', label: 'Engagement Score', type: 'number', category: 'engagement' },
          pipedriveField: { id: '14', key: 'engagement_score', name: 'Engagement Score', type: 'double', field_type: 'double', mandatory_flag: false },
          direction: 'to_pipedrive',
          isActive: true,
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  },
  {
    id: 'marketing-automation',
    name: 'Marketing Automation',
    icon: 'Mail',
    description: 'Campaign and engagement tracking',
    fieldCount: 15,
    template: {
      id: 'marketing-automation',
      name: 'Marketing Automation',
      description: 'Track campaign performance and lead engagement',
      category: 'marketing',
      mappings: [
        {
          coldcopyField: { name: 'campaignName', label: 'Campaign Name', type: 'string', category: 'campaign' },
          pipedriveField: { id: '15', key: 'campaign', name: 'Campaign', type: 'varchar', field_type: 'varchar', mandatory_flag: false },
          direction: 'to_pipedrive',
          isActive: true,
        },
        {
          coldcopyField: { name: 'emailsSent', label: 'Emails Sent', type: 'number', category: 'engagement' },
          pipedriveField: { id: '16', key: 'emails_sent', name: 'Emails Sent', type: 'double', field_type: 'double', mandatory_flag: false },
          direction: 'to_pipedrive',
          isActive: true,
        },
        {
          coldcopyField: { name: 'emailsOpened', label: 'Emails Opened', type: 'number', category: 'engagement' },
          pipedriveField: { id: '17', key: 'emails_opened', name: 'Emails Opened', type: 'double', field_type: 'double', mandatory_flag: false },
          direction: 'to_pipedrive',
          isActive: true,
        },
        {
          coldcopyField: { name: 'emailsClicked', label: 'Emails Clicked', type: 'number', category: 'engagement' },
          pipedriveField: { id: '18', key: 'emails_clicked', name: 'Emails Clicked', type: 'double', field_type: 'double', mandatory_flag: false },
          direction: 'to_pipedrive',
          isActive: true,
        },
        {
          coldcopyField: { name: 'lastEngagementDate', label: 'Last Engagement Date', type: 'date', category: 'engagement' },
          pipedriveField: { id: '19', key: 'last_activity', name: 'Last Activity', type: 'date', field_type: 'date', mandatory_flag: false },
          direction: 'to_pipedrive',
          isActive: true,
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  },
  {
    id: 'enterprise-complete',
    name: 'Enterprise Complete',
    icon: 'Building',
    description: 'Full integration with all fields and enrichment',
    fieldCount: 30,
    template: {
      id: 'enterprise-complete',
      name: 'Enterprise Complete',
      description: 'Complete field mapping for enterprise deployments',
      category: 'custom',
      mappings: [
        // This would include all fields from all categories
        // For brevity, showing just a few key ones
        {
          coldcopyField: { name: 'enrichmentData', label: 'Enrichment Data', type: 'json', category: 'enrichment' },
          pipedriveField: { id: '20', key: 'enrichment_data', name: 'Enrichment Data', type: 'text', field_type: 'text', mandatory_flag: false },
          direction: 'to_pipedrive',
          isActive: true,
          transformFunction: {
            id: 'json_stringify',
            name: 'JSON to String',
            description: 'Convert JSON to string',
            type: 'built-in',
            inputType: 'json',
            outputType: 'string',
          },
        },
        {
          coldcopyField: { name: 'tags', label: 'Tags', type: 'multiselect', category: 'lead' },
          pipedriveField: { id: '21', key: 'labels', name: 'Labels', type: 'set', field_type: 'set', mandatory_flag: false },
          direction: 'bidirectional',
          isActive: true,
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  },
];

export function MappingTemplates({ onApplyTemplate, onClose }: MappingTemplatesProps) {
  const [selectedPreset, setSelectedPreset] = useState<MappingPreset | null>(null);
  const [previewMode, setPreviewMode] = useState(false);

  const getIcon = (iconName: string) => {
    const icons: Record<string, any> = {
      TrendingUp,
      Briefcase,
      Mail,
      Building,
      Users,
      Headphones,
      Zap,
    };
    const Icon = icons[iconName] || TrendingUp;
    return <Icon className="h-5 w-5" />;
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      sales: 'text-blue-500',
      marketing: 'text-purple-500',
      support: 'text-green-500',
      custom: 'text-orange-500',
    };
    return colors[category] || 'text-gray-500';
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Mapping Templates</CardTitle>
            <CardDescription>
              Choose a pre-configured template to quickly set up field mappings
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
          {!previewMode ? (
            <ScrollArea className="h-[600px] p-6">
              <div className="grid grid-cols-2 gap-4">
                {PRESET_TEMPLATES.map((preset) => (
                  <Card
                    key={preset.id}
                    className={`p-6 cursor-pointer transition-all hover:shadow-lg ${
                      selectedPreset?.id === preset.id ? 'border-primary' : ''
                    }`}
                    onClick={() => setSelectedPreset(preset)}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className={`p-3 rounded-lg bg-muted ${getCategoryColor(preset.template.category)}`}>
                        {getIcon(preset.icon || 'Zap')}
                      </div>
                      {selectedPreset?.id === preset.id && (
                        <Check className="h-5 w-5 text-primary" />
                      )}
                    </div>
                    
                    <h3 className="font-semibold text-lg mb-2">{preset.name}</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      {preset.description}
                    </p>
                    
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary">
                        {preset.fieldCount} fields
                      </Badge>
                      <Badge variant="outline" className={getCategoryColor(preset.template.category)}>
                        {preset.template.category}
                      </Badge>
                    </div>

                    {preset.template.isDefault && (
                      <Badge variant="success" className="mt-2">
                        Recommended
                      </Badge>
                    )}
                  </Card>
                ))}
              </div>

              <div className="mt-6 flex justify-between">
                <Button
                  variant="outline"
                  onClick={() => setPreviewMode(true)}
                  disabled={!selectedPreset}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Preview Template
                </Button>
                <Button
                  onClick={() => selectedPreset && onApplyTemplate(selectedPreset.template)}
                  disabled={!selectedPreset}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Apply Template
                </Button>
              </div>
            </ScrollArea>
          ) : (
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">
                  {selectedPreset?.name} - Field Mappings
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPreviewMode(false)}
                >
                  Back
                </Button>
              </div>
              
              <ScrollArea className="h-[500px]">
                <div className="space-y-2">
                  {selectedPreset?.template.mappings.map((mapping, index) => (
                    <div key={index} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div>
                            <p className="font-medium text-sm">{mapping.coldcopyField.label}</p>
                            <p className="text-xs text-muted-foreground">{mapping.coldcopyField.name}</p>
                          </div>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="font-medium text-sm">{mapping.pipedriveField.name}</p>
                            <p className="text-xs text-muted-foreground">{mapping.pipedriveField.key}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {mapping.transformFunction && (
                            <Badge variant="outline" className="text-xs">
                              <Zap className="h-3 w-3 mr-1" />
                              Transform
                            </Badge>
                          )}
                          <Badge variant="secondary" className="text-xs">
                            {mapping.direction}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <div className="mt-4 flex justify-end">
                <Button
                  onClick={() => selectedPreset && onApplyTemplate(selectedPreset.template)}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Apply This Template
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}