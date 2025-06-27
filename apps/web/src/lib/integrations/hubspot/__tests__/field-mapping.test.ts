import { HubSpotFieldMapping } from '../field-mapping';
import { HubSpotClient } from '../client';
import { HubSpotAuth } from '../auth';
import {
  HubSpotProperty,
  HubSpotFieldMapping as FieldMappingType,
  HubSpotValidationError,
} from '../types';
import { createServerClient } from '@/lib/supabase/server';

// Mock dependencies
jest.mock('../client');
jest.mock('../auth');
jest.mock('@/lib/supabase/server');

describe('HubSpotFieldMapping', () => {
  let fieldMapping: HubSpotFieldMapping;
  let mockClient: jest.Mocked<HubSpotClient>;
  let mockAuth: jest.Mocked<HubSpotAuth>;
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Supabase
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      upsert: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
    };

    (createServerClient as jest.Mock).mockReturnValue(mockSupabase);

    // Mock HubSpot client
    mockClient = {
      get: jest.fn(),
      post: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
    } as any;

    // Mock HubSpot auth
    mockAuth = {
      getIntegration: jest.fn(),
      getValidAccessToken: jest.fn(),
    } as any;

    (HubSpotClient as jest.Mock).mockImplementation(() => mockClient);
    (HubSpotAuth as jest.Mock).mockImplementation(() => mockAuth);

    fieldMapping = new HubSpotFieldMapping('workspace-123');
  });

  describe('Get HubSpot Properties', () => {
    it('should get contact properties successfully', async () => {
      // Arrange
      const mockProperties: HubSpotProperty[] = [
        {
          name: 'email',
          label: 'Email',
          type: 'string',
          fieldType: 'text',
          groupName: 'contactinformation',
          hasUniqueValue: true,
          modificationMetadata: { readOnly: true },
        },
        {
          name: 'firstname',
          label: 'First Name',
          type: 'string',
          fieldType: 'text',
          groupName: 'contactinformation',
          hasUniqueValue: false,
          modificationMetadata: { readOnly: false },
        },
        {
          name: 'company',
          label: 'Company Name',
          type: 'string',
          fieldType: 'text',
          groupName: 'contactinformation',
          hasUniqueValue: false,
          modificationMetadata: { readOnly: false },
        },
        {
          name: 'lifecyclestage',
          label: 'Lifecycle Stage',
          type: 'enumeration',
          fieldType: 'select',
          groupName: 'lead_intelligence',
          options: [
            { label: 'Subscriber', value: 'subscriber' },
            { label: 'Lead', value: 'lead' },
            { label: 'Customer', value: 'customer' },
          ],
          modificationMetadata: { readOnly: false },
        },
      ];

      mockClient.get.mockResolvedValue({ results: mockProperties });

      // Act
      const properties = await fieldMapping.getHubSpotProperties('contacts');

      // Assert
      expect(properties).toEqual(mockProperties);
      expect(mockClient.get).toHaveBeenCalledWith(
        '/crm/v3/properties/contacts',
        { archived: false }
      );
    });

    it('should get company properties successfully', async () => {
      // Arrange
      const mockProperties: HubSpotProperty[] = [
        {
          name: 'name',
          label: 'Company Name',
          type: 'string',
          fieldType: 'text',
          groupName: 'companyinformation',
          hasUniqueValue: false,
          modificationMetadata: { readOnly: false },
        },
        {
          name: 'domain',
          label: 'Company Domain Name',
          type: 'string',
          fieldType: 'text',
          groupName: 'companyinformation',
          hasUniqueValue: true,
          modificationMetadata: { readOnly: false },
        },
      ];

      mockClient.get.mockResolvedValue({ results: mockProperties });

      // Act
      const properties = await fieldMapping.getHubSpotProperties('companies');

      // Assert
      expect(properties).toEqual(mockProperties);
      expect(mockClient.get).toHaveBeenCalledWith(
        '/crm/v3/properties/companies',
        { archived: false }
      );
    });

    it('should filter out read-only properties', async () => {
      // Arrange
      const mockProperties: HubSpotProperty[] = [
        {
          name: 'email',
          label: 'Email',
          type: 'string',
          fieldType: 'text',
          groupName: 'contactinformation',
          modificationMetadata: { readOnly: true },
        },
        {
          name: 'firstname',
          label: 'First Name',
          type: 'string',
          fieldType: 'text',
          groupName: 'contactinformation',
          modificationMetadata: { readOnly: false },
        },
      ];

      mockClient.get.mockResolvedValue({ results: mockProperties });

      // Act
      const properties = await fieldMapping.getHubSpotProperties('contacts', { excludeReadOnly: true });

      // Assert
      expect(properties).toHaveLength(1);
      expect(properties[0].name).toBe('firstname');
    });

    it('should handle API errors when fetching properties', async () => {
      // Arrange
      mockClient.get.mockRejectedValue({
        status: 'error',
        message: 'Unauthorized',
        category: 'UNAUTHORIZED',
      });

      // Act & Assert
      await expect(fieldMapping.getHubSpotProperties('contacts'))
        .rejects
        .toThrow('Unauthorized');
    });
  });

  describe('Create Custom Properties', () => {
    it('should create custom property successfully', async () => {
      // Arrange
      const propertyData = {
        name: 'coldcopy_campaign_id',
        label: 'ColdCopy Campaign ID',
        type: 'string',
        fieldType: 'text',
        groupName: 'coldcopy_integration',
        description: 'ID of the ColdCopy campaign that created this contact',
      };

      const mockProperty: HubSpotProperty = {
        ...propertyData,
        displayOrder: 1,
        hasUniqueValue: false,
        modificationMetadata: { readOnly: false },
      };

      mockClient.post.mockResolvedValue(mockProperty);

      // Act
      const property = await fieldMapping.createCustomProperty('contacts', propertyData);

      // Assert
      expect(property).toEqual(mockProperty);
      expect(mockClient.post).toHaveBeenCalledWith(
        '/crm/v3/properties/contacts',
        propertyData
      );
    });

    it('should create enumeration property with options', async () => {
      // Arrange
      const propertyData = {
        name: 'coldcopy_lead_status',
        label: 'ColdCopy Lead Status',
        type: 'enumeration',
        fieldType: 'select',
        groupName: 'coldcopy_integration',
        options: [
          { label: 'New', value: 'new' },
          { label: 'Contacted', value: 'contacted' },
          { label: 'Qualified', value: 'qualified' },
          { label: 'Unqualified', value: 'unqualified' },
        ],
      };

      const mockProperty: HubSpotProperty = {
        ...propertyData,
        displayOrder: 2,
        hasUniqueValue: false,
        modificationMetadata: { readOnly: false },
      };

      mockClient.post.mockResolvedValue(mockProperty);

      // Act
      const property = await fieldMapping.createCustomProperty('contacts', propertyData);

      // Assert
      expect(property.options).toEqual(propertyData.options);
      expect(property.type).toBe('enumeration');
    });

    it('should handle property name conflicts', async () => {
      // Arrange
      const propertyData = {
        name: 'existing_property',
        label: 'Existing Property',
        type: 'string',
        fieldType: 'text',
        groupName: 'test_group',
      };

      mockClient.post.mockRejectedValue({
        status: 'error',
        message: 'Property name already exists',
        category: 'VALIDATION_ERROR',
        errors: [
          {
            message: 'A property with this name already exists',
            in: 'name',
            code: 'DUPLICATE_PROPERTY_NAME',
          },
        ],
      });

      // Act & Assert
      await expect(fieldMapping.createCustomProperty('contacts', propertyData))
        .rejects
        .toThrow('Property name already exists');
    });

    it('should validate property names', async () => {
      // Arrange
      const invalidPropertyData = {
        name: 'Invalid Property Name!', // Invalid characters
        label: 'Invalid Property',
        type: 'string',
        fieldType: 'text',
        groupName: 'test_group',
      };

      // Act & Assert
      await expect(fieldMapping.createCustomProperty('contacts', invalidPropertyData))
        .rejects
        .toThrow(HubSpotValidationError);
    });
  });

  describe('Field Mapping CRUD Operations', () => {
    it('should create field mapping successfully', async () => {
      // Arrange
      const mappingData = {
        coldcopyField: 'enrichment_data.jobTitle',
        hubspotProperty: 'jobtitle',
        direction: 'bidirectional' as const,
        transformFunction: 'capitalize',
      };

      const mockMapping: FieldMappingType = {
        id: 'mapping-123',
        workspaceId: 'workspace-123',
        coldcopyField: mappingData.coldcopyField,
        hubspotProperty: mappingData.hubspotProperty,
        direction: mappingData.direction,
        transformFunction: mappingData.transformFunction,
        createdAt: new Date('2024-01-15T10:00:00Z'),
      };

      mockSupabase.single.mockResolvedValue({
        data: mockMapping,
        error: null,
      });

      // Act
      const mapping = await fieldMapping.createMapping(mappingData);

      // Assert
      expect(mapping).toEqual(mockMapping);
      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          workspace_id: 'workspace-123',
          coldcopy_field: mappingData.coldcopyField,
          hubspot_property: mappingData.hubspotProperty,
          direction: mappingData.direction,
          transform_function: mappingData.transformFunction,
        })
      );
    });

    it('should get all mappings for workspace', async () => {
      // Arrange
      const mockMappings: FieldMappingType[] = [
        {
          id: 'mapping-1',
          workspaceId: 'workspace-123',
          coldcopyField: 'first_name',
          hubspotProperty: 'firstname',
          direction: 'bidirectional',
          createdAt: new Date('2024-01-15T10:00:00Z'),
        },
        {
          id: 'mapping-2',
          workspaceId: 'workspace-123',
          coldcopyField: 'company',
          hubspotProperty: 'company',
          direction: 'to_hubspot',
          createdAt: new Date('2024-01-15T10:01:00Z'),
        },
      ];

      mockSupabase.select.mockResolvedValue({
        data: mockMappings,
        error: null,
      });

      // Act
      const mappings = await fieldMapping.getMappings();

      // Assert
      expect(mappings).toEqual(mockMappings);
      expect(mockSupabase.from).toHaveBeenCalledWith('hubspot_field_mappings');
      expect(mockSupabase.eq).toHaveBeenCalledWith('workspace_id', 'workspace-123');
    });

    it('should get mappings by direction', async () => {
      // Arrange
      const mockMappings: FieldMappingType[] = [
        {
          id: 'mapping-1',
          workspaceId: 'workspace-123',
          coldcopyField: 'first_name',
          hubspotProperty: 'firstname',
          direction: 'to_hubspot',
          createdAt: new Date('2024-01-15T10:00:00Z'),
        },
      ];

      mockSupabase.select.mockResolvedValue({
        data: mockMappings,
        error: null,
      });

      // Act
      const mappings = await fieldMapping.getMappings({ direction: 'to_hubspot' });

      // Assert
      expect(mappings).toEqual(mockMappings);
      expect(mockSupabase.eq).toHaveBeenCalledWith('direction', 'to_hubspot');
    });

    it('should update field mapping', async () => {
      // Arrange
      const mappingId = 'mapping-123';
      const updateData = {
        direction: 'from_hubspot' as const,
        transformFunction: 'lowercase',
      };

      const updatedMapping: FieldMappingType = {
        id: mappingId,
        workspaceId: 'workspace-123',
        coldcopyField: 'first_name',
        hubspotProperty: 'firstname',
        direction: updateData.direction,
        transformFunction: updateData.transformFunction,
        createdAt: new Date('2024-01-15T10:00:00Z'),
      };

      mockSupabase.single.mockResolvedValue({
        data: updatedMapping,
        error: null,
      });

      // Act
      const mapping = await fieldMapping.updateMapping(mappingId, updateData);

      // Assert
      expect(mapping).toEqual(updatedMapping);
      expect(mockSupabase.update).toHaveBeenCalledWith({
        direction: updateData.direction,
        transform_function: updateData.transformFunction,
      });
    });

    it('should delete field mapping', async () => {
      // Arrange
      const mappingId = 'mapping-123';

      mockSupabase.single.mockResolvedValue({
        data: null,
        error: null,
      });

      // Act
      await fieldMapping.deleteMapping(mappingId);

      // Assert
      expect(mockSupabase.delete).toHaveBeenCalled();
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', mappingId);
    });
  });

  describe('Field Mapping Application', () => {
    it('should apply mappings from ColdCopy to HubSpot', async () => {
      // Arrange
      const mappings: FieldMappingType[] = [
        {
          id: 'mapping-1',
          workspaceId: 'workspace-123',
          coldcopyField: 'first_name',
          hubspotProperty: 'firstname',
          direction: 'to_hubspot',
          createdAt: new Date(),
        },
        {
          id: 'mapping-2',
          workspaceId: 'workspace-123',
          coldcopyField: 'enrichment_data.jobTitle',
          hubspotProperty: 'jobtitle',
          direction: 'bidirectional',
          transformFunction: 'capitalize',
          createdAt: new Date(),
        },
        {
          id: 'mapping-3',
          workspaceId: 'workspace-123',
          coldcopyField: 'tags',
          hubspotProperty: 'contact_tags',
          direction: 'to_hubspot',
          transformFunction: 'join_comma',
          createdAt: new Date(),
        },
      ];

      mockSupabase.select.mockResolvedValue({
        data: mappings,
        error: null,
      });

      const sourceData = {
        id: 'lead-123',
        email: 'test@example.com',
        first_name: 'john',
        last_name: 'doe',
        enrichment_data: {
          jobTitle: 'software engineer',
        },
        tags: ['tag1', 'tag2', 'tag3'],
      };

      // Act
      const mappedData = await fieldMapping.applyMappings(sourceData, 'to_hubspot');

      // Assert
      expect(mappedData).toEqual({
        email: 'test@example.com',
        lastname: 'doe',
        firstname: 'john',
        jobtitle: 'Software Engineer', // Capitalized
        contact_tags: 'tag1,tag2,tag3', // Joined with commas
      });
    });

    it('should apply mappings from HubSpot to ColdCopy', async () => {
      // Arrange
      const mappings: FieldMappingType[] = [
        {
          id: 'mapping-1',
          workspaceId: 'workspace-123',
          coldcopyField: 'first_name',
          hubspotProperty: 'firstname',
          direction: 'from_hubspot',
          createdAt: new Date(),
        },
        {
          id: 'mapping-2',
          workspaceId: 'workspace-123',
          coldcopyField: 'enrichment_data.company.name',
          hubspotProperty: 'company',
          direction: 'bidirectional',
          createdAt: new Date(),
        },
      ];

      mockSupabase.select.mockResolvedValue({
        data: mappings,
        error: null,
      });

      const hubspotData = {
        id: 'contact-123',
        properties: {
          email: 'test@example.com',
          firstname: 'John',
          lastname: 'Doe',
          company: 'Acme Corp',
        },
      };

      // Act
      const mappedData = await fieldMapping.applyMappings(hubspotData.properties, 'from_hubspot');

      // Assert
      expect(mappedData).toEqual({
        email: 'test@example.com',
        last_name: 'Doe',
        first_name: 'John',
        enrichment_data: {
          company: {
            name: 'Acme Corp',
          },
        },
      });
    });

    it('should handle nested field mapping', async () => {
      // Arrange
      const mappings: FieldMappingType[] = [
        {
          id: 'mapping-1',
          workspaceId: 'workspace-123',
          coldcopyField: 'enrichment_data.social.linkedin',
          hubspotProperty: 'linkedinbio',
          direction: 'to_hubspot',
          createdAt: new Date(),
        },
        {
          id: 'mapping-2',
          workspaceId: 'workspace-123',
          coldcopyField: 'enrichment_data.company.industry',
          hubspotProperty: 'industry',
          direction: 'to_hubspot',
          createdAt: new Date(),
        },
      ];

      mockSupabase.select.mockResolvedValue({
        data: mappings,
        error: null,
      });

      const sourceData = {
        enrichment_data: {
          social: {
            linkedin: 'https://linkedin.com/in/johndoe',
          },
          company: {
            industry: 'Technology',
          },
        },
      };

      // Act
      const mappedData = await fieldMapping.applyMappings(sourceData, 'to_hubspot');

      // Assert
      expect(mappedData.linkedinbio).toBe('https://linkedin.com/in/johndoe');
      expect(mappedData.industry).toBe('Technology');
    });

    it('should apply transform functions', async () => {
      // Arrange
      const mappings: FieldMappingType[] = [
        {
          id: 'mapping-1',
          workspaceId: 'workspace-123',
          coldcopyField: 'first_name',
          hubspotProperty: 'firstname',
          direction: 'to_hubspot',
          transformFunction: 'capitalize',
          createdAt: new Date(),
        },
        {
          id: 'mapping-2',
          workspaceId: 'workspace-123',
          coldcopyField: 'email',
          hubspotProperty: 'email',
          direction: 'to_hubspot',
          transformFunction: 'lowercase',
          createdAt: new Date(),
        },
        {
          id: 'mapping-3',
          workspaceId: 'workspace-123',
          coldcopyField: 'tags',
          hubspotProperty: 'contact_tags',
          direction: 'to_hubspot',
          transformFunction: 'join_semicolon',
          createdAt: new Date(),
        },
      ];

      mockSupabase.select.mockResolvedValue({
        data: mappings,
        error: null,
      });

      const sourceData = {
        first_name: 'john',
        email: 'JOHN.DOE@EXAMPLE.COM',
        tags: ['vip', 'enterprise', 'active'],
      };

      // Act
      const mappedData = await fieldMapping.applyMappings(sourceData, 'to_hubspot');

      // Assert
      expect(mappedData.firstname).toBe('John');
      expect(mappedData.email).toBe('john.doe@example.com');
      expect(mappedData.contact_tags).toBe('vip;enterprise;active');
    });

    it('should handle missing values gracefully', async () => {
      // Arrange
      const mappings: FieldMappingType[] = [
        {
          id: 'mapping-1',
          workspaceId: 'workspace-123',
          coldcopyField: 'missing_field',
          hubspotProperty: 'custom_field',
          direction: 'to_hubspot',
          createdAt: new Date(),
        },
        {
          id: 'mapping-2',
          workspaceId: 'workspace-123',
          coldcopyField: 'enrichment_data.missing.nested',
          hubspotProperty: 'nested_field',
          direction: 'to_hubspot',
          createdAt: new Date(),
        },
      ];

      mockSupabase.select.mockResolvedValue({
        data: mappings,
        error: null,
      });

      const sourceData = {
        existing_field: 'value',
      };

      // Act
      const mappedData = await fieldMapping.applyMappings(sourceData, 'to_hubspot');

      // Assert
      expect(mappedData.custom_field).toBeUndefined();
      expect(mappedData.nested_field).toBeUndefined();
      expect(Object.keys(mappedData)).not.toContain('custom_field');
      expect(Object.keys(mappedData)).not.toContain('nested_field');
    });
  });

  describe('Transform Functions', () => {
    it('should apply capitalize transform', () => {
      // Act
      const result = fieldMapping.applyTransform('john doe', 'capitalize');

      // Assert
      expect(result).toBe('John Doe');
    });

    it('should apply uppercase transform', () => {
      // Act
      const result = fieldMapping.applyTransform('hello world', 'uppercase');

      // Assert
      expect(result).toBe('HELLO WORLD');
    });

    it('should apply lowercase transform', () => {
      // Act
      const result = fieldMapping.applyTransform('HELLO WORLD', 'lowercase');

      // Assert
      expect(result).toBe('hello world');
    });

    it('should apply join_comma transform', () => {
      // Act
      const result = fieldMapping.applyTransform(['a', 'b', 'c'], 'join_comma');

      // Assert
      expect(result).toBe('a,b,c');
    });

    it('should apply join_semicolon transform', () => {
      // Act
      const result = fieldMapping.applyTransform(['x', 'y', 'z'], 'join_semicolon');

      // Assert
      expect(result).toBe('x;y;z');
    });

    it('should apply split_comma transform', () => {
      // Act
      const result = fieldMapping.applyTransform('a,b,c', 'split_comma');

      // Assert
      expect(result).toEqual(['a', 'b', 'c']);
    });

    it('should apply date_format transform', () => {
      // Act
      const result = fieldMapping.applyTransform('2024-01-15T10:00:00Z', 'date_format');

      // Assert
      expect(result).toBe('2024-01-15');
    });

    it('should apply boolean_to_string transform', () => {
      // Act
      const trueResult = fieldMapping.applyTransform(true, 'boolean_to_string');
      const falseResult = fieldMapping.applyTransform(false, 'boolean_to_string');

      // Assert
      expect(trueResult).toBe('true');
      expect(falseResult).toBe('false');
    });

    it('should handle invalid transform functions', () => {
      // Act
      const result = fieldMapping.applyTransform('test', 'invalid_transform' as any);

      // Assert
      expect(result).toBe('test'); // Should return original value
    });

    it('should handle null/undefined values in transforms', () => {
      // Act
      const nullResult = fieldMapping.applyTransform(null, 'capitalize');
      const undefinedResult = fieldMapping.applyTransform(undefined, 'uppercase');

      // Assert
      expect(nullResult).toBeNull();
      expect(undefinedResult).toBeUndefined();
    });
  });

  describe('Mapping Validation', () => {
    it('should validate field mapping configuration', async () => {
      // Arrange
      const validMapping = {
        coldcopyField: 'first_name',
        hubspotProperty: 'firstname',
        direction: 'bidirectional' as const,
      };

      // Act & Assert
      expect(() => fieldMapping.validateMapping(validMapping)).not.toThrow();
    });

    it('should reject invalid direction', async () => {
      // Arrange
      const invalidMapping = {
        coldcopyField: 'first_name',
        hubspotProperty: 'firstname',
        direction: 'invalid_direction' as any,
      };

      // Act & Assert
      expect(() => fieldMapping.validateMapping(invalidMapping))
        .toThrow(HubSpotValidationError);
    });

    it('should reject empty field names', async () => {
      // Arrange
      const invalidMapping = {
        coldcopyField: '',
        hubspotProperty: 'firstname',
        direction: 'to_hubspot' as const,
      };

      // Act & Assert
      expect(() => fieldMapping.validateMapping(invalidMapping))
        .toThrow(HubSpotValidationError);
    });

    it('should validate HubSpot property exists', async () => {
      // Arrange
      const mockProperties: HubSpotProperty[] = [
        {
          name: 'firstname',
          label: 'First Name',
          type: 'string',
          fieldType: 'text',
          groupName: 'contactinformation',
          modificationMetadata: { readOnly: false },
        },
      ];

      mockClient.get.mockResolvedValue({ results: mockProperties });

      const mapping = {
        coldcopyField: 'first_name',
        hubspotProperty: 'nonexistent_property',
        direction: 'to_hubspot' as const,
      };

      // Act & Assert
      await expect(fieldMapping.validateMappingWithHubSpot(mapping, 'contacts'))
        .rejects
        .toThrow(HubSpotValidationError);
    });

    it('should validate against read-only properties', async () => {
      // Arrange
      const mockProperties: HubSpotProperty[] = [
        {
          name: 'email',
          label: 'Email',
          type: 'string',
          fieldType: 'text',
          groupName: 'contactinformation',
          modificationMetadata: { readOnly: true },
        },
      ];

      mockClient.get.mockResolvedValue({ results: mockProperties });

      const mapping = {
        coldcopyField: 'email',
        hubspotProperty: 'email',
        direction: 'to_hubspot' as const,
      };

      // Act & Assert
      await expect(fieldMapping.validateMappingWithHubSpot(mapping, 'contacts'))
        .rejects
        .toThrow(HubSpotValidationError);
    });
  });

  describe('Bulk Operations', () => {
    it('should create multiple mappings in bulk', async () => {
      // Arrange
      const mappingData = [
        {
          coldcopyField: 'first_name',
          hubspotProperty: 'firstname',
          direction: 'bidirectional' as const,
        },
        {
          coldcopyField: 'last_name',
          hubspotProperty: 'lastname',
          direction: 'bidirectional' as const,
        },
        {
          coldcopyField: 'company',
          hubspotProperty: 'company',
          direction: 'to_hubspot' as const,
        },
      ];

      const mockMappings = mappingData.map((data, index) => ({
        id: `mapping-${index + 1}`,
        workspaceId: 'workspace-123',
        ...data,
        createdAt: new Date(),
      }));

      mockSupabase.select.mockResolvedValue({
        data: mockMappings,
        error: null,
      });

      // Act
      const mappings = await fieldMapping.createBulkMappings(mappingData);

      // Assert
      expect(mappings).toEqual(mockMappings);
      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            coldcopy_field: 'first_name',
            hubspot_property: 'firstname',
          }),
          expect.objectContaining({
            coldcopy_field: 'last_name',
            hubspot_property: 'lastname',
          }),
          expect.objectContaining({
            coldcopy_field: 'company',
            hubspot_property: 'company',
          }),
        ])
      );
    });

    it('should handle partial bulk creation failures', async () => {
      // Arrange
      const mappingData = [
        {
          coldcopyField: 'first_name',
          hubspotProperty: 'firstname',
          direction: 'bidirectional' as const,
        },
        {
          coldcopyField: 'invalid_field',
          hubspotProperty: 'invalid_property',
          direction: 'invalid_direction' as any,
        },
      ];

      // Act & Assert
      await expect(fieldMapping.createBulkMappings(mappingData))
        .rejects
        .toThrow(HubSpotValidationError);
    });
  });

  describe('Default Mappings', () => {
    it('should create default contact mappings', async () => {
      // Arrange
      const defaultMappings = [
        {
          coldcopyField: 'email',
          hubspotProperty: 'email',
          direction: 'bidirectional' as const,
        },
        {
          coldcopyField: 'first_name',
          hubspotProperty: 'firstname',
          direction: 'bidirectional' as const,
        },
        {
          coldcopyField: 'last_name',
          hubspotProperty: 'lastname',
          direction: 'bidirectional' as const,
        },
        {
          coldcopyField: 'company',
          hubspotProperty: 'company',
          direction: 'bidirectional' as const,
        },
        {
          coldcopyField: 'phone',
          hubspotProperty: 'phone',
          direction: 'bidirectional' as const,
        },
      ];

      mockSupabase.select.mockResolvedValue({
        data: defaultMappings.map((mapping, index) => ({
          id: `mapping-${index + 1}`,
          workspaceId: 'workspace-123',
          ...mapping,
          createdAt: new Date(),
        })),
        error: null,
      });

      // Act
      const mappings = await fieldMapping.createDefaultMappings('contacts');

      // Assert
      expect(mappings).toHaveLength(5);
      expect(mappings.find(m => m.coldcopyField === 'email')).toBeDefined();
      expect(mappings.find(m => m.coldcopyField === 'first_name')).toBeDefined();
    });

    it('should skip existing mappings when creating defaults', async () => {
      // Arrange
      const existingMappings = [
        {
          id: 'existing-1',
          workspaceId: 'workspace-123',
          coldcopyField: 'email',
          hubspotProperty: 'email',
          direction: 'bidirectional' as const,
          createdAt: new Date(),
        },
      ];

      mockSupabase.select
        .mockResolvedValueOnce({ data: existingMappings, error: null }) // Check existing
        .mockResolvedValueOnce({ data: [], error: null }); // Return created mappings

      // Act
      const mappings = await fieldMapping.createDefaultMappings('contacts');

      // Assert
      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.not.arrayContaining([
          expect.objectContaining({
            coldcopy_field: 'email',
          }),
        ])
      );
    });
  });
});