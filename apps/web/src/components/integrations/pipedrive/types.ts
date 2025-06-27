export interface PipedriveFieldMapping {
  id: string;
  coldcopyField: ColdCopyField;
  pipedriveField: PipedriveField;
  direction: 'to_pipedrive' | 'from_pipedrive' | 'bidirectional';
  transformFunction?: TransformFunction;
  isActive: boolean;
  lastSynced?: Date;
  syncErrors?: number;
}

export interface ColdCopyField {
  name: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'email' | 'phone' | 'url' | 'text' | 'select' | 'multiselect' | 'json' | 'array';
  required?: boolean;
  category: 'lead' | 'campaign' | 'engagement' | 'custom' | 'enrichment';
  defaultValue?: any;
  validation?: FieldValidation;
  description?: string;
}

export interface PipedriveField {
  id: string;
  key: string;
  name: string;
  type: string;
  field_type: 'address' | 'date' | 'daterange' | 'double' | 'enum' | 'monetary' | 'org' | 'people' | 'phone' | 'set' | 'text' | 'time' | 'timerange' | 'user' | 'varchar' | 'varchar_auto' | 'visible_to';
  mandatory_flag: boolean;
  options?: PipedriveFieldOption[];
  group?: string;
  is_custom_field?: boolean;
  edit_flag?: boolean;
  active_flag?: boolean;
}

export interface PipedriveFieldOption {
  id: string;
  label: string;
  color?: string;
}

export interface TransformFunction {
  id: string;
  name: string;
  description: string;
  type: 'built-in' | 'custom';
  code?: string;
  inputType: string;
  outputType: string;
  parameters?: TransformParameter[];
  testCases?: TransformTestCase[];
}

export interface TransformParameter {
  name: string;
  type: string;
  required: boolean;
  defaultValue?: any;
  description?: string;
}

export interface TransformTestCase {
  input: any;
  expectedOutput: any;
  description?: string;
}

export interface FieldValidation {
  type: 'regex' | 'length' | 'range' | 'custom';
  pattern?: string;
  min?: number;
  max?: number;
  customValidator?: string;
  errorMessage?: string;
}

export interface MappingTemplate {
  id: string;
  name: string;
  description: string;
  category: 'sales' | 'marketing' | 'support' | 'custom';
  mappings: Omit<PipedriveFieldMapping, 'id' | 'lastSynced' | 'syncErrors'>[];
  createdAt: Date;
  updatedAt: Date;
  isDefault?: boolean;
}

export interface MappingPreset {
  id: string;
  name: string;
  icon?: string;
  description: string;
  fieldCount: number;
  template: MappingTemplate;
}

export interface FieldCompatibility {
  sourceType: string;
  targetType: string;
  isCompatible: boolean;
  requiresTransform: boolean;
  suggestedTransforms?: TransformFunction[];
  warning?: string;
}

export interface MappingValidationResult {
  isValid: boolean;
  errors: MappingValidationError[];
  warnings: MappingValidationWarning[];
}

export interface MappingValidationError {
  fieldName: string;
  type: 'missing_required' | 'type_mismatch' | 'invalid_transform' | 'duplicate_mapping';
  message: string;
}

export interface MappingValidationWarning {
  fieldName: string;
  type: 'data_loss' | 'performance' | 'deprecated_field';
  message: string;
}

export interface SyncConfiguration {
  enabled: boolean;
  syncInterval: number;
  syncDirection: 'to_pipedrive' | 'from_pipedrive' | 'bidirectional';
  conflictResolution: 'pipedrive_wins' | 'coldcopy_wins' | 'newest_wins' | 'manual';
  batchSize: number;
  retryAttempts: number;
  fieldMappings: PipedriveFieldMapping[];
}

export interface MappingImportExport {
  version: string;
  exportDate: Date;
  mappings: PipedriveFieldMapping[];
  templates?: MappingTemplate[];
  transformFunctions?: TransformFunction[];
}

export interface DragDropState {
  isDragging: boolean;
  draggedField: ColdCopyField | PipedriveField | null;
  draggedFrom: 'coldcopy' | 'pipedrive' | null;
  dropTarget: 'coldcopy' | 'pipedrive' | null;
}

// Built-in transform functions
export const BUILT_IN_TRANSFORMS: TransformFunction[] = [
  {
    id: 'uppercase',
    name: 'Uppercase',
    description: 'Convert text to uppercase',
    type: 'built-in',
    inputType: 'string',
    outputType: 'string',
    testCases: [{ input: 'hello', expectedOutput: 'HELLO' }]
  },
  {
    id: 'lowercase',
    name: 'Lowercase',
    description: 'Convert text to lowercase',
    type: 'built-in',
    inputType: 'string',
    outputType: 'string',
    testCases: [{ input: 'HELLO', expectedOutput: 'hello' }]
  },
  {
    id: 'trim',
    name: 'Trim',
    description: 'Remove leading and trailing whitespace',
    type: 'built-in',
    inputType: 'string',
    outputType: 'string',
    testCases: [{ input: '  hello  ', expectedOutput: 'hello' }]
  },
  {
    id: 'date_format',
    name: 'Date Format',
    description: 'Format date to specific format',
    type: 'built-in',
    inputType: 'date',
    outputType: 'string',
    parameters: [
      { name: 'format', type: 'string', required: true, defaultValue: 'YYYY-MM-DD' }
    ]
  },
  {
    id: 'number_round',
    name: 'Round Number',
    description: 'Round number to specified decimal places',
    type: 'built-in',
    inputType: 'number',
    outputType: 'number',
    parameters: [
      { name: 'decimals', type: 'number', required: false, defaultValue: 0 }
    ]
  },
  {
    id: 'currency_convert',
    name: 'Currency Conversion',
    description: 'Convert currency values',
    type: 'built-in',
    inputType: 'number',
    outputType: 'number',
    parameters: [
      { name: 'from', type: 'string', required: true },
      { name: 'to', type: 'string', required: true }
    ]
  },
  {
    id: 'phone_format',
    name: 'Phone Format',
    description: 'Format phone numbers',
    type: 'built-in',
    inputType: 'string',
    outputType: 'string',
    parameters: [
      { name: 'format', type: 'string', required: false, defaultValue: 'international' }
    ]
  },
  {
    id: 'split_name',
    name: 'Split Full Name',
    description: 'Split full name into first and last name',
    type: 'built-in',
    inputType: 'string',
    outputType: 'json',
    testCases: [
      { input: 'John Doe', expectedOutput: { firstName: 'John', lastName: 'Doe' } }
    ]
  },
  {
    id: 'combine_fields',
    name: 'Combine Fields',
    description: 'Combine multiple fields into one',
    type: 'built-in',
    inputType: 'array',
    outputType: 'string',
    parameters: [
      { name: 'separator', type: 'string', required: false, defaultValue: ' ' }
    ]
  },
  {
    id: 'json_extract',
    name: 'Extract from JSON',
    description: 'Extract value from JSON field',
    type: 'built-in',
    inputType: 'json',
    outputType: 'any',
    parameters: [
      { name: 'path', type: 'string', required: true, description: 'JSONPath expression' }
    ]
  }
];

// Field type compatibility matrix
export const FIELD_TYPE_COMPATIBILITY: Record<string, string[]> = {
  'string': ['string', 'text', 'varchar', 'varchar_auto', 'email', 'phone', 'url'],
  'number': ['number', 'double', 'monetary', 'integer'],
  'boolean': ['boolean', 'enum'],
  'date': ['date', 'daterange', 'time', 'timerange'],
  'email': ['string', 'email', 'varchar'],
  'phone': ['string', 'phone', 'varchar'],
  'url': ['string', 'url', 'varchar'],
  'select': ['enum', 'set'],
  'multiselect': ['set'],
  'json': ['json', 'text'],
  'array': ['set', 'json']
};