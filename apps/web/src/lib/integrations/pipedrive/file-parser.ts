import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export interface ParsedData {
  persons: any[];
  organizations: any[];
  deals: any[];
  activities: any[];
}

export interface FileParserOptions {
  autoDetectType?: boolean;
  mappings?: {
    persons?: FieldMapping;
    organizations?: FieldMapping;
    deals?: FieldMapping;
    activities?: FieldMapping;
  };
}

export interface FieldMapping {
  [sourceField: string]: string;
}

export class FileParser {
  /**
   * Parse a file and extract data for Pipedrive import
   */
  static async parseFile(
    file: File,
    format: 'csv' | 'json' | 'xlsx',
    options: FileParserOptions = {}
  ): Promise<ParsedData> {
    switch (format) {
      case 'csv':
        return this.parseCSV(file, options);
      case 'json':
        return this.parseJSON(file, options);
      case 'xlsx':
        return this.parseExcel(file, options);
      default:
        throw new Error(`Unsupported file format: ${format}`);
    }
  }

  /**
   * Parse CSV file
   */
  private static async parseCSV(
    file: File,
    options: FileParserOptions
  ): Promise<ParsedData> {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          try {
            const data = this.categorizeData(results.data, options);
            resolve(data);
          } catch (error) {
            reject(error);
          }
        },
        error: (error) => {
          reject(new Error(`CSV parsing error: ${error.message}`));
        },
      });
    });
  }

  /**
   * Parse JSON file
   */
  private static async parseJSON(
    file: File,
    options: FileParserOptions
  ): Promise<ParsedData> {
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      // Handle different JSON structures
      if (Array.isArray(data)) {
        return this.categorizeData(data, options);
      } else if (typeof data === 'object') {
        // If already categorized
        if (data.persons || data.organizations || data.deals || data.activities) {
          return {
            persons: data.persons || [],
            organizations: data.organizations || [],
            deals: data.deals || [],
            activities: data.activities || [],
          };
        } else {
          // Single object
          return this.categorizeData([data], options);
        }
      }

      throw new Error('Invalid JSON structure');
    } catch (error) {
      throw new Error(`JSON parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Parse Excel file
   */
  private static async parseExcel(
    file: File,
    options: FileParserOptions
  ): Promise<ParsedData> {
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });

      const result: ParsedData = {
        persons: [],
        organizations: [],
        deals: [],
        activities: [],
      };

      // Check for specifically named sheets
      const sheetNames = workbook.SheetNames;
      
      // Process each sheet
      for (const sheetName of sheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet);

        // Categorize based on sheet name or data content
        const lowerSheetName = sheetName.toLowerCase();
        
        if (lowerSheetName.includes('person') || lowerSheetName.includes('contact')) {
          result.persons.push(...data);
        } else if (lowerSheetName.includes('org') || lowerSheetName.includes('company')) {
          result.organizations.push(...data);
        } else if (lowerSheetName.includes('deal') || lowerSheetName.includes('opportunity')) {
          result.deals.push(...data);
        } else if (lowerSheetName.includes('activity') || lowerSheetName.includes('task')) {
          result.activities.push(...data);
        } else if (options.autoDetectType) {
          // Auto-detect based on content
          const categorized = this.categorizeData(data, options);
          result.persons.push(...categorized.persons);
          result.organizations.push(...categorized.organizations);
          result.deals.push(...categorized.deals);
          result.activities.push(...categorized.activities);
        }
      }

      return result;
    } catch (error) {
      throw new Error(`Excel parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Categorize data into different entity types
   */
  private static categorizeData(
    data: any[],
    options: FileParserOptions
  ): ParsedData {
    const result: ParsedData = {
      persons: [],
      organizations: [],
      deals: [],
      activities: [],
    };

    if (!options.autoDetectType) {
      // If not auto-detecting, assume all data is of one type
      // User should specify in the UI which type this is
      return result;
    }

    // Auto-detect entity type based on fields
    for (const record of data) {
      const fields = Object.keys(record).map(k => k.toLowerCase());

      if (this.isPerson(fields, record)) {
        result.persons.push(this.transformPerson(record, options.mappings?.persons));
      } else if (this.isOrganization(fields, record)) {
        result.organizations.push(this.transformOrganization(record, options.mappings?.organizations));
      } else if (this.isDeal(fields, record)) {
        result.deals.push(this.transformDeal(record, options.mappings?.deals));
      } else if (this.isActivity(fields, record)) {
        result.activities.push(this.transformActivity(record, options.mappings?.activities));
      }
    }

    return result;
  }

  /**
   * Detect if record is a person
   */
  private static isPerson(fields: string[], record: any): boolean {
    const personIndicators = ['email', 'phone', 'first_name', 'last_name', 'contact', 'person'];
    const hasEmail = fields.some(f => f.includes('email'));
    const hasName = fields.some(f => f.includes('name') && !f.includes('company') && !f.includes('org'));
    const hasPersonIndicator = personIndicators.some(indicator => 
      fields.some(f => f.includes(indicator))
    );

    return hasEmail || (hasName && hasPersonIndicator);
  }

  /**
   * Detect if record is an organization
   */
  private static isOrganization(fields: string[], record: any): boolean {
    const orgIndicators = ['company', 'organization', 'org_name', 'business', 'domain'];
    return orgIndicators.some(indicator => 
      fields.some(f => f.includes(indicator))
    );
  }

  /**
   * Detect if record is a deal
   */
  private static isDeal(fields: string[], record: any): boolean {
    const dealIndicators = ['deal', 'opportunity', 'value', 'amount', 'stage', 'pipeline'];
    const hasValue = fields.some(f => f.includes('value') || f.includes('amount'));
    const hasDealIndicator = dealIndicators.some(indicator => 
      fields.some(f => f.includes(indicator))
    );

    return hasValue && hasDealIndicator;
  }

  /**
   * Detect if record is an activity
   */
  private static isActivity(fields: string[], record: any): boolean {
    const activityIndicators = ['activity', 'task', 'meeting', 'call', 'due_date', 'subject'];
    return activityIndicators.some(indicator => 
      fields.some(f => f.includes(indicator))
    );
  }

  /**
   * Transform person data
   */
  private static transformPerson(record: any, mapping?: FieldMapping): any {
    const transformed: any = {
      id: record.id || this.generateId(),
    };

    // Default field mappings
    const defaultMappings: FieldMapping = {
      email: 'email',
      phone: 'phone',
      name: 'name',
      first_name: 'firstName',
      last_name: 'lastName',
      company: 'organization',
      organization: 'organization',
      job_title: 'jobTitle',
      title: 'jobTitle',
      ...mapping,
    };

    // Apply mappings
    for (const [targetField, sourceField] of Object.entries(defaultMappings)) {
      if (record[sourceField] !== undefined) {
        transformed[targetField] = record[sourceField];
      }
    }

    // Handle email and phone as arrays
    if (transformed.email && !Array.isArray(transformed.email)) {
      transformed.email = [transformed.email];
    }
    if (transformed.phone && !Array.isArray(transformed.phone)) {
      transformed.phone = [transformed.phone];
    }

    // Generate full name if needed
    if (!transformed.name && (transformed.firstName || transformed.lastName)) {
      transformed.name = `${transformed.firstName || ''} ${transformed.lastName || ''}`.trim();
    }

    return transformed;
  }

  /**
   * Transform organization data
   */
  private static transformOrganization(record: any, mapping?: FieldMapping): any {
    const transformed: any = {
      id: record.id || this.generateId(),
    };

    const defaultMappings: FieldMapping = {
      name: 'name',
      company: 'name',
      organization: 'name',
      domain: 'domain',
      website: 'domain',
      address: 'address',
      industry: 'industry',
      employee_count: 'employeeCount',
      employees: 'employeeCount',
      ...mapping,
    };

    for (const [targetField, sourceField] of Object.entries(defaultMappings)) {
      if (record[sourceField] !== undefined) {
        transformed[targetField] = record[sourceField];
      }
    }

    return transformed;
  }

  /**
   * Transform deal data
   */
  private static transformDeal(record: any, mapping?: FieldMapping): any {
    const transformed: any = {
      id: record.id || this.generateId(),
    };

    const defaultMappings: FieldMapping = {
      title: 'title',
      name: 'title',
      deal_name: 'title',
      value: 'value',
      amount: 'value',
      currency: 'currency',
      stage: 'stage',
      pipeline: 'pipeline',
      expected_close_date: 'expectedCloseDate',
      close_date: 'expectedCloseDate',
      person_email: 'personEmail',
      contact_email: 'personEmail',
      organization_name: 'organizationName',
      company_name: 'organizationName',
      ...mapping,
    };

    for (const [targetField, sourceField] of Object.entries(defaultMappings)) {
      if (record[sourceField] !== undefined) {
        transformed[targetField] = record[sourceField];
      }
    }

    // Parse numeric values
    if (transformed.value) {
      transformed.value = parseFloat(String(transformed.value).replace(/[^0-9.-]/g, ''));
    }

    return transformed;
  }

  /**
   * Transform activity data
   */
  private static transformActivity(record: any, mapping?: FieldMapping): any {
    const transformed: any = {
      id: record.id || this.generateId(),
    };

    const defaultMappings: FieldMapping = {
      subject: 'subject',
      title: 'subject',
      type: 'type',
      activity_type: 'type',
      due_date: 'dueDate',
      due: 'dueDate',
      due_time: 'dueTime',
      duration: 'duration',
      note: 'note',
      description: 'note',
      person_email: 'personEmail',
      contact_email: 'personEmail',
      deal_title: 'dealTitle',
      ...mapping,
    };

    for (const [targetField, sourceField] of Object.entries(defaultMappings)) {
      if (record[sourceField] !== undefined) {
        transformed[targetField] = record[sourceField];
      }
    }

    // Default activity type if not specified
    if (!transformed.type) {
      transformed.type = 'task';
    }

    return transformed;
  }

  /**
   * Generate a temporary ID for tracking
   */
  private static generateId(): string {
    return `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Validate parsed data
   */
  static validateData(data: ParsedData): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Validate persons
    for (const person of data.persons) {
      if (!person.name && !person.firstName && !person.lastName) {
        errors.push('Person record missing name');
      }
      if (!person.email?.length && !person.phone?.length) {
        errors.push('Person record missing contact information (email or phone)');
      }
    }

    // Validate organizations
    for (const org of data.organizations) {
      if (!org.name) {
        errors.push('Organization record missing name');
      }
    }

    // Validate deals
    for (const deal of data.deals) {
      if (!deal.title) {
        errors.push('Deal record missing title');
      }
    }

    // Validate activities
    for (const activity of data.activities) {
      if (!activity.subject) {
        errors.push('Activity record missing subject');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}