import { HubSpotClient } from './client';
import { HubSpotAuth } from './auth';
import { createServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import {
  HubSpotProperty,
  HubSpotFieldMapping,
} from './types';

export interface PropertyGroup {
  name: string;
  displayName: string;
  displayOrder: number;
  properties: HubSpotProperty[];
}

export class HubSpotPropertyManager {
  private client: HubSpotClient;
  private auth: HubSpotAuth;
  private workspaceId: string;
  private propertyCache: Map<string, HubSpotProperty[]> = new Map();

  constructor(workspaceId: string, accessToken?: string) {
    this.workspaceId = workspaceId;
    this.auth = new HubSpotAuth();
    
    if (accessToken) {
      this.client = new HubSpotClient(accessToken);
    }
  }

  /**
   * Initialize client with valid access token
   */
  private async ensureClient() {
    if (!this.client) {
      const accessToken = await this.auth.getValidAccessToken(this.workspaceId);
      this.client = new HubSpotClient(accessToken);
    }
  }

  /**
   * Get all contact properties from HubSpot
   */
  async getContactProperties(useCache = true): Promise<HubSpotProperty[]> {
    if (useCache && this.propertyCache.has('contact')) {
      return this.propertyCache.get('contact')!;
    }

    await this.ensureClient();

    const response = await this.client.get<{ results: HubSpotProperty[] }>(
      '/crm/v3/properties/contacts'
    );

    const properties = response.results;
    this.propertyCache.set('contact', properties);
    
    return properties;
  }

  /**
   * Get contact properties grouped by category
   */
  async getContactPropertyGroups(): Promise<PropertyGroup[]> {
    const properties = await this.getContactProperties();
    
    // Group properties by their group name
    const groups = new Map<string, PropertyGroup>();
    
    for (const property of properties) {
      const groupName = property.groupName || 'contactinformation';
      
      if (!groups.has(groupName)) {
        groups.set(groupName, {
          name: groupName,
          displayName: this.formatGroupName(groupName),
          displayOrder: 0,
          properties: [],
        });
      }
      
      groups.get(groupName)!.properties.push(property);
    }
    
    // Sort properties within each group
    for (const group of groups.values()) {
      group.properties.sort((a, b) => 
        (a.displayOrder || 0) - (b.displayOrder || 0)
      );
    }
    
    // Convert to array and sort groups
    return Array.from(groups.values()).sort((a, b) => {
      // Put contact information first
      if (a.name === 'contactinformation') return -1;
      if (b.name === 'contactinformation') return 1;
      return a.displayName.localeCompare(b.displayName);
    });
  }

  /**
   * Create a custom property in HubSpot
   */
  async createCustomProperty(
    name: string,
    label: string,
    type: 'string' | 'number' | 'date' | 'enumeration',
    options?: { label: string; value: string }[]
  ): Promise<HubSpotProperty> {
    await this.ensureClient();

    const propertyData: any = {
      name: `coldcopy_${name}`, // Prefix with coldcopy_ to avoid conflicts
      label,
      type,
      fieldType: type === 'string' ? 'text' : type,
      groupName: 'coldcopy_properties',
      description: `Created by ColdCopy integration`,
    };

    if (type === 'enumeration' && options) {
      propertyData.options = options;
    }

    const property = await this.client.post<HubSpotProperty>(
      '/crm/v3/properties/contacts',
      propertyData
    );

    // Clear cache
    this.propertyCache.delete('contact');

    return property;
  }

  /**
   * Get field mappings for the workspace
   */
  async getFieldMappings(): Promise<HubSpotFieldMapping[]> {
    const supabase = createServerClient(cookies());

    const { data, error } = await supabase
      .from('hubspot_field_mappings')
      .select('*')
      .eq('workspace_id', this.workspaceId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching field mappings:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Save field mappings
   */
  async saveFieldMappings(
    mappings: Omit<HubSpotFieldMapping, 'id' | 'createdAt' | 'workspaceId'>[]
  ): Promise<void> {
    const supabase = createServerClient(cookies());

    // Delete existing mappings
    await supabase
      .from('hubspot_field_mappings')
      .delete()
      .eq('workspace_id', this.workspaceId);

    // Insert new mappings
    if (mappings.length > 0) {
      const { error } = await supabase
        .from('hubspot_field_mappings')
        .insert(
          mappings.map(mapping => ({
            ...mapping,
            workspace_id: this.workspaceId,
          }))
        );

      if (error) {
        throw new Error(`Failed to save field mappings: ${error.message}`);
      }
    }
  }

  /**
   * Get available ColdCopy fields
   */
  getColdCopyFields(): Array<{ name: string; label: string; type: string }> {
    return [
      // Basic fields
      { name: 'email', label: 'Email', type: 'string' },
      { name: 'firstName', label: 'First Name', type: 'string' },
      { name: 'lastName', label: 'Last Name', type: 'string' },
      { name: 'company', label: 'Company', type: 'string' },
      { name: 'phone', label: 'Phone', type: 'string' },
      { name: 'website', label: 'Website', type: 'string' },
      { name: 'jobTitle', label: 'Job Title', type: 'string' },
      { name: 'industry', label: 'Industry', type: 'string' },
      { name: 'city', label: 'City', type: 'string' },
      { name: 'state', label: 'State/Region', type: 'string' },
      { name: 'country', label: 'Country', type: 'string' },
      
      // Engagement fields
      { name: 'lastEmailSent', label: 'Last Email Sent', type: 'date' },
      { name: 'lastEmailOpened', label: 'Last Email Opened', type: 'date' },
      { name: 'lastEmailClicked', label: 'Last Email Clicked', type: 'date' },
      { name: 'lastEmailReplied', label: 'Last Email Replied', type: 'date' },
      { name: 'emailsSent', label: 'Emails Sent', type: 'number' },
      { name: 'emailsOpened', label: 'Emails Opened', type: 'number' },
      { name: 'emailsClicked', label: 'Emails Clicked', type: 'number' },
      { name: 'emailsReplied', label: 'Emails Replied', type: 'number' },
      
      // Status fields
      { name: 'status', label: 'Lead Status', type: 'string' },
      { name: 'score', label: 'Lead Score', type: 'number' },
      { name: 'tags', label: 'Tags', type: 'string' },
      { name: 'notes', label: 'Notes', type: 'string' },
      
      // Custom fields
      { name: 'customField1', label: 'Custom Field 1', type: 'string' },
      { name: 'customField2', label: 'Custom Field 2', type: 'string' },
      { name: 'customField3', label: 'Custom Field 3', type: 'string' },
      { name: 'customField4', label: 'Custom Field 4', type: 'string' },
      { name: 'customField5', label: 'Custom Field 5', type: 'string' },
    ];
  }

  /**
   * Get suggested mappings based on field names
   */
  async getSuggestedMappings(): Promise<HubSpotFieldMapping[]> {
    const hubspotProperties = await this.getContactProperties();
    const coldcopyFields = this.getColdCopyFields();
    const suggestions: HubSpotFieldMapping[] = [];

    // Create a map of normalized HubSpot property names
    const hubspotMap = new Map<string, HubSpotProperty>();
    for (const prop of hubspotProperties) {
      const normalized = prop.name.toLowerCase().replace(/_/g, '');
      hubspotMap.set(normalized, prop);
      
      // Also check label
      const normalizedLabel = prop.label.toLowerCase().replace(/\s+/g, '');
      hubspotMap.set(normalizedLabel, prop);
    }

    // Try to match ColdCopy fields with HubSpot properties
    for (const field of coldcopyFields) {
      const normalized = field.name.toLowerCase();
      
      // Direct matches
      const directMatches: Record<string, string> = {
        'email': 'email',
        'firstname': 'firstname',
        'lastname': 'lastname',
        'company': 'company',
        'phone': 'phone',
        'website': 'website',
        'jobtitle': 'jobtitle',
        'industry': 'industry',
        'city': 'city',
        'state': 'state',
        'country': 'country',
      };

      let hubspotProperty: HubSpotProperty | undefined;
      
      if (directMatches[normalized]) {
        hubspotProperty = hubspotMap.get(directMatches[normalized]);
      } else {
        // Try to find by normalized name
        hubspotProperty = hubspotMap.get(normalized);
      }

      if (hubspotProperty) {
        suggestions.push({
          id: `suggestion-${field.name}`,
          workspaceId: this.workspaceId,
          coldcopyField: field.name,
          hubspotProperty: hubspotProperty.name,
          direction: 'bidirectional',
          createdAt: new Date(),
        });
      }
    }

    return suggestions;
  }

  /**
   * Validate field mappings
   */
  async validateMappings(
    mappings: Omit<HubSpotFieldMapping, 'id' | 'createdAt' | 'workspaceId'>[]
  ): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    const hubspotProperties = await this.getContactProperties();
    const coldcopyFields = this.getColdCopyFields();

    // Create sets for validation
    const hubspotPropNames = new Set(hubspotProperties.map(p => p.name));
    const coldcopyFieldNames = new Set(coldcopyFields.map(f => f.name));

    // Check for duplicate mappings
    const seen = new Set<string>();
    
    for (const mapping of mappings) {
      // Validate ColdCopy field exists
      if (!coldcopyFieldNames.has(mapping.coldcopyField)) {
        errors.push(`Invalid ColdCopy field: ${mapping.coldcopyField}`);
      }

      // Validate HubSpot property exists
      if (!hubspotPropNames.has(mapping.hubspotProperty)) {
        errors.push(`Invalid HubSpot property: ${mapping.hubspotProperty}`);
      }

      // Check for duplicates
      const key = `${mapping.coldcopyField}-${mapping.hubspotProperty}`;
      if (seen.has(key)) {
        errors.push(`Duplicate mapping: ${mapping.coldcopyField} -> ${mapping.hubspotProperty}`);
      }
      seen.add(key);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Format group name for display
   */
  private formatGroupName(groupName: string): string {
    const formatted = groupName
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .trim();
    
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  }
}