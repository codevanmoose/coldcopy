import { HubSpotContacts } from '../contacts';
import { HubSpotClient } from '../client';
import { HubSpotAuth } from '../auth';
import {
  HubSpotContact,
  HubSpotBatchOperation,
  HubSpotSearchRequest,
  HubSpotSearchResponse,
  HubSpotSyncError,
  HubSpotValidationError,
} from '../types';
import { createServerClient } from '@/lib/supabase/server';

// Mock dependencies
jest.mock('../client');
jest.mock('../auth');
jest.mock('@/lib/supabase/server');

describe('HubSpotContacts', () => {
  let hubspotContacts: HubSpotContacts;
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
      limit: jest.fn().mockReturnThis(),
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

    hubspotContacts = new HubSpotContacts('workspace-123');
  });

  describe('Create Contact', () => {
    it('should create a contact successfully', async () => {
      // Arrange
      const contactData = {
        email: 'john.doe@example.com',
        firstname: 'John',
        lastname: 'Doe',
        company: 'Acme Corp',
        phone: '+1234567890',
      };

      const mockResponse: HubSpotContact = {
        id: 'contact-123',
        properties: {
          ...contactData,
          createdate: '2024-01-01T00:00:00Z',
          lastmodifieddate: '2024-01-01T00:00:00Z',
        },
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      mockClient.post.mockResolvedValue(mockResponse);

      // Act
      const contact = await hubspotContacts.createContact(contactData);

      // Assert
      expect(contact).toEqual(mockResponse);
      expect(mockClient.post).toHaveBeenCalledWith(
        '/crm/v3/objects/contacts',
        {
          properties: contactData,
        }
      );
    });

    it('should handle duplicate contact error', async () => {
      // Arrange
      const contactData = {
        email: 'existing@example.com',
        firstname: 'Existing',
        lastname: 'User',
      };

      const errorResponse = {
        status: 'error',
        message: 'Contact already exists',
        category: 'CONFLICT',
        errors: [
          {
            message: 'Contact with email already exists',
            in: 'email',
            code: 'DUPLICATE_VALUE',
          },
        ],
      };

      mockClient.post.mockRejectedValue(errorResponse);

      // Act & Assert
      await expect(hubspotContacts.createContact(contactData))
        .rejects
        .toThrow('Contact already exists');
    });

    it('should validate required fields', async () => {
      // Arrange
      const invalidData = {
        firstname: 'John',
        // Missing email
      };

      // Act & Assert
      await expect(hubspotContacts.createContact(invalidData))
        .rejects
        .toThrow(HubSpotValidationError);
    });
  });

  describe('Update Contact', () => {
    it('should update contact successfully', async () => {
      // Arrange
      const contactId = 'contact-123';
      const updateData = {
        firstname: 'Jane',
        lastname: 'Smith',
        company: 'New Company',
      };

      const mockResponse: HubSpotContact = {
        id: contactId,
        properties: {
          email: 'jane.smith@example.com',
          ...updateData,
          lastmodifieddate: '2024-01-02T00:00:00Z',
        },
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-02T00:00:00Z',
      };

      mockClient.patch.mockResolvedValue(mockResponse);

      // Act
      const contact = await hubspotContacts.updateContact(contactId, updateData);

      // Assert
      expect(contact).toEqual(mockResponse);
      expect(mockClient.patch).toHaveBeenCalledWith(
        `/crm/v3/objects/contacts/${contactId}`,
        {
          properties: updateData,
        }
      );
    });

    it('should handle contact not found error', async () => {
      // Arrange
      const contactId = 'non-existent';
      mockClient.patch.mockRejectedValue({
        status: 'error',
        message: 'Contact not found',
        category: 'OBJECT_NOT_FOUND',
      });

      // Act & Assert
      await expect(hubspotContacts.updateContact(contactId, { firstname: 'Test' }))
        .rejects
        .toThrow('Contact not found');
    });
  });

  describe('Get Contact', () => {
    it('should get contact by ID successfully', async () => {
      // Arrange
      const contactId = 'contact-123';
      const mockResponse: HubSpotContact = {
        id: contactId,
        properties: {
          email: 'john.doe@example.com',
          firstname: 'John',
          lastname: 'Doe',
          company: 'Acme Corp',
          lifecyclestage: 'lead',
        },
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      mockClient.get.mockResolvedValue(mockResponse);

      // Act
      const contact = await hubspotContacts.getContact(contactId);

      // Assert
      expect(contact).toEqual(mockResponse);
      expect(mockClient.get).toHaveBeenCalledWith(
        `/crm/v3/objects/contacts/${contactId}`,
        expect.objectContaining({
          properties: expect.any(String),
        })
      );
    });

    it('should get contact by email successfully', async () => {
      // Arrange
      const email = 'john.doe@example.com';
      const mockSearchResponse: HubSpotSearchResponse<HubSpotContact> = {
        total: 1,
        results: [
          {
            id: 'contact-123',
            properties: {
              email,
              firstname: 'John',
              lastname: 'Doe',
            },
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
          },
        ],
      };

      mockClient.post.mockResolvedValue(mockSearchResponse);

      // Act
      const contact = await hubspotContacts.getContactByEmail(email);

      // Assert
      expect(contact).toEqual(mockSearchResponse.results[0]);
      expect(mockClient.post).toHaveBeenCalledWith(
        '/crm/v3/objects/contacts/search',
        expect.objectContaining({
          filterGroups: [
            {
              filters: [
                {
                  propertyName: 'email',
                  operator: 'EQ',
                  value: email,
                },
              ],
            },
          ],
        })
      );
    });

    it('should return null when contact not found by email', async () => {
      // Arrange
      const email = 'nonexistent@example.com';
      const mockSearchResponse: HubSpotSearchResponse<HubSpotContact> = {
        total: 0,
        results: [],
      };

      mockClient.post.mockResolvedValue(mockSearchResponse);

      // Act
      const contact = await hubspotContacts.getContactByEmail(email);

      // Assert
      expect(contact).toBeNull();
    });
  });

  describe('Delete Contact', () => {
    it('should delete contact successfully', async () => {
      // Arrange
      const contactId = 'contact-123';
      mockClient.delete.mockResolvedValue(undefined);

      // Act
      await hubspotContacts.deleteContact(contactId);

      // Assert
      expect(mockClient.delete).toHaveBeenCalledWith(
        `/crm/v3/objects/contacts/${contactId}`
      );
    });

    it('should handle delete errors', async () => {
      // Arrange
      const contactId = 'contact-123';
      mockClient.delete.mockRejectedValue({
        status: 'error',
        message: 'Contact not found',
      });

      // Act & Assert
      await expect(hubspotContacts.deleteContact(contactId))
        .rejects
        .toThrow('Contact not found');
    });
  });

  describe('Batch Operations', () => {
    it('should create multiple contacts in batch', async () => {
      // Arrange
      const contactsData = [
        { email: 'contact1@example.com', firstname: 'Contact', lastname: 'One' },
        { email: 'contact2@example.com', firstname: 'Contact', lastname: 'Two' },
        { email: 'contact3@example.com', firstname: 'Contact', lastname: 'Three' },
      ];

      const mockBatchResponse: HubSpotBatchOperation<HubSpotContact> = {
        inputs: contactsData.map(data => ({ properties: data })),
        results: [
          { id: 'contact-1', status: 'COMPLETE' },
          { id: 'contact-2', status: 'COMPLETE' },
          { id: 'contact-3', status: 'COMPLETE' },
        ],
      };

      mockClient.post.mockResolvedValue(mockBatchResponse);

      // Act
      const results = await hubspotContacts.batchCreateContacts(contactsData);

      // Assert
      expect(results).toEqual(mockBatchResponse);
      expect(mockClient.post).toHaveBeenCalledWith(
        '/crm/v3/objects/contacts/batch/create',
        {
          inputs: contactsData.map(data => ({ properties: data })),
        }
      );
    });

    it('should handle partial batch failures', async () => {
      // Arrange
      const contactsData = [
        { email: 'valid@example.com', firstname: 'Valid' },
        { email: 'duplicate@example.com', firstname: 'Duplicate' },
      ];

      const mockBatchResponse: HubSpotBatchOperation<HubSpotContact> = {
        inputs: contactsData.map(data => ({ properties: data })),
        results: [
          { id: 'contact-1', status: 'COMPLETE' },
          {
            id: '',
            status: 'ERROR',
            error: {
              status: 'error',
              message: 'Duplicate contact',
              correlationId: 'correlation-123',
            },
          },
        ],
      };

      mockClient.post.mockResolvedValue(mockBatchResponse);

      // Act
      const results = await hubspotContacts.batchCreateContacts(contactsData);

      // Assert
      expect(results.results?.[0].status).toBe('COMPLETE');
      expect(results.results?.[1].status).toBe('ERROR');
    });

    it('should batch update contacts', async () => {
      // Arrange
      const updates = [
        { id: 'contact-1', properties: { company: 'New Company 1' } },
        { id: 'contact-2', properties: { company: 'New Company 2' } },
      ];

      const mockBatchResponse = {
        results: [
          { id: 'contact-1', status: 'COMPLETE' },
          { id: 'contact-2', status: 'COMPLETE' },
        ],
      };

      mockClient.post.mockResolvedValue(mockBatchResponse);

      // Act
      const results = await hubspotContacts.batchUpdateContacts(updates);

      // Assert
      expect(results).toEqual(mockBatchResponse);
      expect(mockClient.post).toHaveBeenCalledWith(
        '/crm/v3/objects/contacts/batch/update',
        {
          inputs: updates,
        }
      );
    });

    it('should respect batch size limits', async () => {
      // Arrange
      const largeContactsList = Array(150).fill(null).map((_, i) => ({
        email: `contact${i}@example.com`,
        firstname: `Contact${i}`,
      }));

      mockClient.post.mockResolvedValue({
        results: largeContactsList.slice(0, 100).map((_, i) => ({
          id: `contact-${i}`,
          status: 'COMPLETE',
        })),
      });

      // Act
      await hubspotContacts.batchCreateContacts(largeContactsList);

      // Assert
      expect(mockClient.post).toHaveBeenCalledTimes(2); // 100 + 50
    });
  });

  describe('Search Contacts', () => {
    it('should search contacts with filters', async () => {
      // Arrange
      const searchRequest: HubSpotSearchRequest = {
        filterGroups: [
          {
            filters: [
              {
                propertyName: 'lifecyclestage',
                operator: 'EQ',
                value: 'lead',
              },
              {
                propertyName: 'createdate',
                operator: 'GTE',
                value: '2024-01-01',
              },
            ],
          },
        ],
        sorts: [
          {
            propertyName: 'createdate',
            direction: 'DESCENDING',
          },
        ],
        limit: 50,
      };

      const mockSearchResponse: HubSpotSearchResponse<HubSpotContact> = {
        total: 25,
        results: Array(25).fill(null).map((_, i) => ({
          id: `contact-${i}`,
          properties: {
            email: `lead${i}@example.com`,
            lifecyclestage: 'lead',
          },
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        })),
      };

      mockClient.post.mockResolvedValue(mockSearchResponse);

      // Act
      const results = await hubspotContacts.searchContacts(searchRequest);

      // Assert
      expect(results).toEqual(mockSearchResponse);
      expect(mockClient.post).toHaveBeenCalledWith(
        '/crm/v3/objects/contacts/search',
        searchRequest
      );
    });

    it('should handle pagination in search', async () => {
      // Arrange
      const searchRequest: HubSpotSearchRequest = {
        filterGroups: [],
        limit: 100,
      };

      const firstPageResponse: HubSpotSearchResponse<HubSpotContact> = {
        total: 150,
        results: Array(100).fill(null).map((_, i) => ({
          id: `contact-${i}`,
          properties: { email: `contact${i}@example.com` },
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        })),
        paging: {
          next: {
            after: 'cursor-123',
            link: '/next-page',
          },
        },
      };

      mockClient.post.mockResolvedValue(firstPageResponse);

      // Act
      const results = await hubspotContacts.searchContacts(searchRequest);

      // Assert
      expect(results.paging?.next?.after).toBe('cursor-123');
      expect(results.results.length).toBe(100);
    });
  });

  describe('Sync Operations', () => {
    it('should sync lead to HubSpot contact', async () => {
      // Arrange
      const lead = {
        id: 'lead-123',
        email: 'lead@example.com',
        first_name: 'Lead',
        last_name: 'Test',
        company: 'Test Company',
        phone: '+1234567890',
        enrichment_data: {
          jobTitle: 'CEO',
          linkedinUrl: 'https://linkedin.com/in/lead',
        },
      };

      const mockContact: HubSpotContact = {
        id: 'contact-123',
        properties: {
          email: lead.email,
          firstname: lead.first_name,
          lastname: lead.last_name,
          company: lead.company,
          phone: lead.phone,
          jobtitle: 'CEO',
          linkedinbio: 'https://linkedin.com/in/lead',
        },
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      // Mock field mappings
      mockSupabase.select.mockResolvedValueOnce({
        data: [
          { coldcopy_field: 'enrichment_data.jobTitle', hubspot_property: 'jobtitle' },
          { coldcopy_field: 'enrichment_data.linkedinUrl', hubspot_property: 'linkedinbio' },
        ],
        error: null,
      });

      // Mock existing sync status - not found
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });

      // Mock contact creation
      mockClient.post.mockResolvedValueOnce(mockContact);

      // Mock sync status creation
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'sync-123',
          entity_id: lead.id,
          hubspot_id: mockContact.id,
          status: 'synced',
        },
        error: null,
      });

      // Act
      const syncedContact = await hubspotContacts.syncLeadToHubSpot(lead);

      // Assert
      expect(syncedContact).toEqual(mockContact);
      expect(mockClient.post).toHaveBeenCalledWith(
        '/crm/v3/objects/contacts',
        expect.objectContaining({
          properties: expect.objectContaining({
            email: lead.email,
            firstname: lead.first_name,
            lastname: lead.last_name,
            company: lead.company,
            phone: lead.phone,
            jobtitle: 'CEO',
            linkedinbio: 'https://linkedin.com/in/lead',
          }),
        })
      );
    });

    it('should update existing contact when syncing', async () => {
      // Arrange
      const lead = {
        id: 'lead-123',
        email: 'existing@example.com',
        first_name: 'Updated',
        last_name: 'Name',
      };

      const existingSyncStatus = {
        id: 'sync-123',
        entity_id: lead.id,
        hubspot_id: 'contact-456',
        status: 'synced',
        sync_hash: 'old-hash',
      };

      const updatedContact: HubSpotContact = {
        id: 'contact-456',
        properties: {
          email: lead.email,
          firstname: lead.first_name,
          lastname: lead.last_name,
        },
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-02T00:00:00Z',
      };

      // Mock sync status - found
      mockSupabase.single.mockResolvedValueOnce({
        data: existingSyncStatus,
        error: null,
      });

      // Mock field mappings
      mockSupabase.select.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      // Mock contact update
      mockClient.patch.mockResolvedValue(updatedContact);

      // Mock sync status update
      mockSupabase.single.mockResolvedValueOnce({
        data: { ...existingSyncStatus, sync_hash: 'new-hash' },
        error: null,
      });

      // Act
      const syncedContact = await hubspotContacts.syncLeadToHubSpot(lead);

      // Assert
      expect(syncedContact).toEqual(updatedContact);
      expect(mockClient.patch).toHaveBeenCalledWith(
        `/crm/v3/objects/contacts/${existingSyncStatus.hubspot_id}`,
        expect.any(Object)
      );
    });

    it('should handle sync errors and update status', async () => {
      // Arrange
      const lead = {
        id: 'lead-123',
        email: 'error@example.com',
        first_name: 'Error',
        last_name: 'Test',
      };

      // Mock sync status - not found
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });

      // Mock field mappings
      mockSupabase.select.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      // Mock contact creation failure
      mockClient.post.mockRejectedValue({
        status: 'error',
        message: 'Invalid email format',
      });

      // Mock error status creation
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'sync-123',
          entity_id: lead.id,
          status: 'error',
          error_message: 'Invalid email format',
        },
        error: null,
      });

      // Act & Assert
      await expect(hubspotContacts.syncLeadToHubSpot(lead))
        .rejects
        .toThrow(HubSpotSyncError);

      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'error',
          error_message: expect.any(String),
        })
      );
    });

    it('should sync HubSpot contact to lead', async () => {
      // Arrange
      const hubspotContact: HubSpotContact = {
        id: 'contact-123',
        properties: {
          email: 'hubspot@example.com',
          firstname: 'HubSpot',
          lastname: 'Contact',
          company: 'HubSpot Company',
          phone: '+9876543210',
          jobtitle: 'Manager',
        },
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      // Mock field mappings
      mockSupabase.select.mockResolvedValueOnce({
        data: [
          { coldcopy_field: 'enrichment_data.jobTitle', hubspot_property: 'jobtitle' },
        ],
        error: null,
      });

      // Mock lead lookup - not found
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });

      // Mock lead creation
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'lead-456',
          email: hubspotContact.properties.email,
          first_name: hubspotContact.properties.firstname,
          last_name: hubspotContact.properties.lastname,
          company: hubspotContact.properties.company,
          phone: hubspotContact.properties.phone,
          enrichment_data: {
            jobTitle: 'Manager',
          },
        },
        error: null,
      });

      // Mock sync status creation
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'sync-123',
          entity_id: 'lead-456',
          hubspot_id: hubspotContact.id,
          status: 'synced',
        },
        error: null,
      });

      // Act
      const lead = await hubspotContacts.syncHubSpotContactToLead(hubspotContact);

      // Assert
      expect(lead).toBeDefined();
      expect(lead.email).toBe(hubspotContact.properties.email);
      expect(lead.enrichment_data.jobTitle).toBe('Manager');
    });
  });

  describe('Field Mapping', () => {
    it('should apply field mappings correctly', async () => {
      // Arrange
      const mappings = [
        {
          coldcopy_field: 'custom_field_1',
          hubspot_property: 'custom_hubspot_1',
          transform_function: 'uppercase',
        },
        {
          coldcopy_field: 'tags',
          hubspot_property: 'contact_tags',
          transform_function: 'join_comma',
        },
      ];

      mockSupabase.select.mockResolvedValue({
        data: mappings,
        error: null,
      });

      const lead = {
        id: 'lead-123',
        email: 'test@example.com',
        custom_field_1: 'test value',
        tags: ['tag1', 'tag2', 'tag3'],
      };

      // Act
      const mappedData = await hubspotContacts.applyFieldMappings(lead, 'to_hubspot');

      // Assert
      expect(mappedData.custom_hubspot_1).toBe('TEST VALUE');
      expect(mappedData.contact_tags).toBe('tag1,tag2,tag3');
    });

    it('should handle nested field mappings', async () => {
      // Arrange
      const mappings = [
        {
          coldcopy_field: 'enrichment_data.company.name',
          hubspot_property: 'company',
        },
        {
          coldcopy_field: 'enrichment_data.social.twitter',
          hubspot_property: 'twitterhandle',
        },
      ];

      mockSupabase.select.mockResolvedValue({
        data: mappings,
        error: null,
      });

      const lead = {
        id: 'lead-123',
        email: 'test@example.com',
        enrichment_data: {
          company: {
            name: 'Tech Corp',
          },
          social: {
            twitter: '@techcorp',
          },
        },
      };

      // Act
      const mappedData = await hubspotContacts.applyFieldMappings(lead, 'to_hubspot');

      // Assert
      expect(mappedData.company).toBe('Tech Corp');
      expect(mappedData.twitterhandle).toBe('@techcorp');
    });
  });

  describe('Deduplication', () => {
    it('should detect and merge duplicate contacts', async () => {
      // Arrange
      const email = 'duplicate@example.com';
      const searchResponse: HubSpotSearchResponse<HubSpotContact> = {
        total: 2,
        results: [
          {
            id: 'contact-1',
            properties: { email, firstname: 'John' },
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
          },
          {
            id: 'contact-2',
            properties: { email, firstname: 'Johnny' },
            createdAt: '2024-01-02T00:00:00Z',
            updatedAt: '2024-01-02T00:00:00Z',
          },
        ],
      };

      mockClient.post.mockResolvedValue(searchResponse);

      // Act
      const duplicates = await hubspotContacts.findDuplicateContacts(email);

      // Assert
      expect(duplicates.length).toBe(2);
      expect(duplicates[0].id).toBe('contact-1');
      expect(duplicates[1].id).toBe('contact-2');
    });

    it('should merge duplicate contacts', async () => {
      // Arrange
      const primaryId = 'contact-1';
      const duplicateId = 'contact-2';

      mockClient.post.mockResolvedValue({ status: 'COMPLETE' });

      // Act
      await hubspotContacts.mergeDuplicateContacts(primaryId, duplicateId);

      // Assert
      expect(mockClient.post).toHaveBeenCalledWith(
        `/crm/v3/objects/contacts/merge`,
        {
          primaryObjectId: primaryId,
          objectIdToMerge: duplicateId,
        }
      );
    });
  });

  describe('Custom Properties', () => {
    it('should handle custom properties correctly', async () => {
      // Arrange
      const contactData = {
        email: 'custom@example.com',
        firstname: 'Custom',
        lastname: 'User',
        // Custom properties
        coldcopy_campaign_id: 'campaign-123',
        coldcopy_lead_score: 85,
        coldcopy_last_activity: '2024-01-15T10:00:00Z',
      };

      const mockResponse: HubSpotContact = {
        id: 'contact-123',
        properties: contactData,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      mockClient.post.mockResolvedValue(mockResponse);

      // Act
      const contact = await hubspotContacts.createContact(contactData);

      // Assert
      expect(contact.properties.coldcopy_campaign_id).toBe('campaign-123');
      expect(contact.properties.coldcopy_lead_score).toBe(85);
    });
  });

  describe('Error Recovery', () => {
    it('should retry on temporary failures', async () => {
      // Arrange
      const contactData = {
        email: 'retry@example.com',
        firstname: 'Retry',
        lastname: 'Test',
      };

      const successResponse: HubSpotContact = {
        id: 'contact-123',
        properties: contactData,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      // First call fails with 503, second succeeds
      mockClient.post
        .mockRejectedValueOnce({ status: 503, message: 'Service unavailable' })
        .mockResolvedValueOnce(successResponse);

      // Act
      const contact = await hubspotContacts.createContact(contactData);

      // Assert
      expect(contact).toEqual(successResponse);
      expect(mockClient.post).toHaveBeenCalledTimes(2);
    });

    it('should not retry on permanent failures', async () => {
      // Arrange
      const contactData = {
        email: 'invalid-email',
        firstname: 'Invalid',
      };

      mockClient.post.mockRejectedValue({
        status: 400,
        message: 'Invalid email format',
      });

      // Act & Assert
      await expect(hubspotContacts.createContact(contactData))
        .rejects
        .toThrow('Invalid email format');

      expect(mockClient.post).toHaveBeenCalledTimes(1); // No retry
    });
  });
});