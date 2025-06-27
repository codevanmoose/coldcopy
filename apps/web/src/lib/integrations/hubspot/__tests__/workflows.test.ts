import { HubSpotWorkflows } from '../workflows';
import { HubSpotClient } from '../client';
import { HubSpotAuth } from '../auth';
import {
  HubSpotValidationError,
  HubSpotSyncError,
} from '../types';
import { createServerClient } from '@/lib/supabase/server';

// Mock dependencies
jest.mock('../client');
jest.mock('../auth');
jest.mock('@/lib/supabase/server');

describe('HubSpotWorkflows', () => {
  let hubspotWorkflows: HubSpotWorkflows;
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
      limit: jest.fn().mockReturnThis(),
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

    hubspotWorkflows = new HubSpotWorkflows('workspace-123');
  });

  describe('Create Workflow', () => {
    it('should create a contact enrollment workflow successfully', async () => {
      // Arrange
      const workflowData = {
        name: 'ColdCopy Lead Nurturing',
        type: 'CONTACT_ENROLLMENT',
        description: 'Automatically enroll new leads from ColdCopy',
        enabled: true,
        enrollmentCriteria: {
          filterGroups: [
            {
              filters: [
                {
                  propertyName: 'coldcopy_lead_source',
                  operator: 'EQ',
                  value: 'coldcopy',
                },
                {
                  propertyName: 'lifecyclestage',
                  operator: 'EQ',
                  value: 'lead',
                },
              ],
            },
          ],
        },
        actions: [
          {
            type: 'DELAY',
            delay: { timeType: 'HOURS', amount: 1 },
          },
          {
            type: 'SEND_EMAIL',
            emailId: 'template-123',
          },
          {
            type: 'SET_PROPERTY',
            propertyName: 'coldcopy_workflow_status',
            value: 'enrolled',
          },
        ],
      };

      const mockWorkflow = {
        id: 'workflow-123',
        name: workflowData.name,
        type: workflowData.type,
        enabled: workflowData.enabled,
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-15T10:00:00Z',
      };

      mockClient.post.mockResolvedValue(mockWorkflow);

      // Act
      const workflow = await hubspotWorkflows.createWorkflow(workflowData);

      // Assert
      expect(workflow).toEqual(mockWorkflow);
      expect(mockClient.post).toHaveBeenCalledWith(
        '/automation/v4/workflows',
        expect.objectContaining({
          name: workflowData.name,
          type: workflowData.type,
          enabled: workflowData.enabled,
          enrollmentCriteria: workflowData.enrollmentCriteria,
          actions: workflowData.actions,
        })
      );
    });

    it('should create a deal-based workflow', async () => {
      // Arrange
      const workflowData = {
        name: 'ColdCopy Deal Follow-up',
        type: 'DEAL_ENROLLMENT',
        description: 'Follow up on deals created from ColdCopy leads',
        enabled: true,
        enrollmentCriteria: {
          filterGroups: [
            {
              filters: [
                {
                  propertyName: 'dealstage',
                  operator: 'EQ',
                  value: 'appointmentscheduled',
                },
                {
                  propertyName: 'coldcopy_campaign_id',
                  operator: 'HAS_PROPERTY',
                  value: null,
                },
              ],
            },
          ],
        },
        actions: [
          {
            type: 'DELAY',
            delay: { timeType: 'DAYS', amount: 3 },
          },
          {
            type: 'CREATE_TASK',
            taskType: 'EMAIL',
            title: 'Follow up on ColdCopy lead',
            notes: 'This deal was created from a ColdCopy campaign',
            dueDate: { timeType: 'DAYS', amount: 1 },
          },
        ],
      };

      const mockWorkflow = {
        id: 'workflow-456',
        name: workflowData.name,
        type: workflowData.type,
        enabled: workflowData.enabled,
      };

      mockClient.post.mockResolvedValue(mockWorkflow);

      // Act
      const workflow = await hubspotWorkflows.createWorkflow(workflowData);

      // Assert
      expect(workflow).toEqual(mockWorkflow);
      expect(mockClient.post).toHaveBeenCalledWith(
        '/automation/v4/workflows',
        expect.objectContaining({
          type: 'DEAL_ENROLLMENT',
          actions: expect.arrayContaining([
            expect.objectContaining({
              type: 'CREATE_TASK',
              taskType: 'EMAIL',
            }),
          ]),
        })
      );
    });

    it('should handle workflow creation errors', async () => {
      // Arrange
      const workflowData = {
        name: 'Invalid Workflow',
        type: 'CONTACT_ENROLLMENT',
        enabled: true,
        enrollmentCriteria: {
          filterGroups: [
            {
              filters: [
                {
                  propertyName: 'invalid_property',
                  operator: 'EQ',
                  value: 'test',
                },
              ],
            },
          ],
        },
      };

      mockClient.post.mockRejectedValue({
        status: 'error',
        message: 'Invalid property name in enrollment criteria',
        category: 'VALIDATION_ERROR',
      });

      // Act & Assert
      await expect(hubspotWorkflows.createWorkflow(workflowData))
        .rejects
        .toThrow('Invalid property name in enrollment criteria');
    });
  });

  describe('Workflow Management', () => {
    it('should get all workflows', async () => {
      // Arrange
      const mockWorkflows = [
        {
          id: 'workflow-1',
          name: 'Lead Nurturing',
          type: 'CONTACT_ENROLLMENT',
          enabled: true,
          createdAt: '2024-01-15T10:00:00Z',
        },
        {
          id: 'workflow-2',
          name: 'Deal Follow-up',
          type: 'DEAL_ENROLLMENT',
          enabled: false,
          createdAt: '2024-01-16T10:00:00Z',
        },
      ];

      mockClient.get.mockResolvedValue({
        results: mockWorkflows,
        total: 2,
      });

      // Act
      const workflows = await hubspotWorkflows.getWorkflows();

      // Assert
      expect(workflows.results).toEqual(mockWorkflows);
      expect(mockClient.get).toHaveBeenCalledWith(
        '/automation/v4/workflows',
        {}
      );
    });

    it('should filter workflows by type', async () => {
      // Arrange
      const mockWorkflows = [
        {
          id: 'workflow-1',
          name: 'Contact Workflow',
          type: 'CONTACT_ENROLLMENT',
          enabled: true,
        },
      ];

      mockClient.get.mockResolvedValue({
        results: mockWorkflows,
        total: 1,
      });

      // Act
      const workflows = await hubspotWorkflows.getWorkflows({ type: 'CONTACT_ENROLLMENT' });

      // Assert
      expect(workflows.results).toEqual(mockWorkflows);
      expect(mockClient.get).toHaveBeenCalledWith(
        '/automation/v4/workflows',
        { type: 'CONTACT_ENROLLMENT' }
      );
    });

    it('should get workflow by ID', async () => {
      // Arrange
      const workflowId = 'workflow-123';
      const mockWorkflow = {
        id: workflowId,
        name: 'Test Workflow',
        type: 'CONTACT_ENROLLMENT',
        enabled: true,
        enrollmentCriteria: {
          filterGroups: [],
        },
        actions: [],
      };

      mockClient.get.mockResolvedValue(mockWorkflow);

      // Act
      const workflow = await hubspotWorkflows.getWorkflow(workflowId);

      // Assert
      expect(workflow).toEqual(mockWorkflow);
      expect(mockClient.get).toHaveBeenCalledWith(
        `/automation/v4/workflows/${workflowId}`
      );
    });

    it('should update workflow', async () => {
      // Arrange
      const workflowId = 'workflow-123';
      const updateData = {
        name: 'Updated Workflow Name',
        enabled: false,
        description: 'Updated description',
      };

      const mockUpdatedWorkflow = {
        id: workflowId,
        ...updateData,
        updatedAt: '2024-01-16T10:00:00Z',
      };

      mockClient.patch.mockResolvedValue(mockUpdatedWorkflow);

      // Act
      const workflow = await hubspotWorkflows.updateWorkflow(workflowId, updateData);

      // Assert
      expect(workflow).toEqual(mockUpdatedWorkflow);
      expect(mockClient.patch).toHaveBeenCalledWith(
        `/automation/v4/workflows/${workflowId}`,
        updateData
      );
    });

    it('should delete workflow', async () => {
      // Arrange
      const workflowId = 'workflow-123';

      mockClient.delete.mockResolvedValue(undefined);

      // Act
      await hubspotWorkflows.deleteWorkflow(workflowId);

      // Assert
      expect(mockClient.delete).toHaveBeenCalledWith(
        `/automation/v4/workflows/${workflowId}`
      );
    });
  });

  describe('Workflow Actions', () => {
    it('should enroll contact in workflow', async () => {
      // Arrange
      const workflowId = 'workflow-123';
      const contactId = 'contact-456';

      const mockEnrollment = {
        id: 'enrollment-789',
        workflowId,
        contactId,
        enrolledAt: '2024-01-15T10:00:00Z',
        status: 'ENROLLED',
      };

      mockClient.post.mockResolvedValue(mockEnrollment);

      // Act
      const enrollment = await hubspotWorkflows.enrollContact(workflowId, contactId);

      // Assert
      expect(enrollment).toEqual(mockEnrollment);
      expect(mockClient.post).toHaveBeenCalledWith(
        `/automation/v4/workflows/${workflowId}/enrollments`,
        {
          contactId,
        }
      );
    });

    it('should enroll multiple contacts in workflow', async () => {
      // Arrange
      const workflowId = 'workflow-123';
      const contactIds = ['contact-1', 'contact-2', 'contact-3'];

      const mockEnrollments = contactIds.map((contactId, index) => ({
        id: `enrollment-${index + 1}`,
        workflowId,
        contactId,
        enrolledAt: '2024-01-15T10:00:00Z',
        status: 'ENROLLED',
      }));

      mockClient.post.mockResolvedValue({
        results: mockEnrollments,
      });

      // Act
      const enrollments = await hubspotWorkflows.enrollMultipleContacts(workflowId, contactIds);

      // Assert
      expect(enrollments.results).toEqual(mockEnrollments);
      expect(mockClient.post).toHaveBeenCalledWith(
        `/automation/v4/workflows/${workflowId}/enrollments/batch`,
        {
          contactIds,
        }
      );
    });

    it('should unenroll contact from workflow', async () => {
      // Arrange
      const workflowId = 'workflow-123';
      const contactId = 'contact-456';

      mockClient.delete.mockResolvedValue(undefined);

      // Act
      await hubspotWorkflows.unenrollContact(workflowId, contactId);

      // Assert
      expect(mockClient.delete).toHaveBeenCalledWith(
        `/automation/v4/workflows/${workflowId}/enrollments/${contactId}`
      );
    });

    it('should get workflow enrollments', async () => {
      // Arrange
      const workflowId = 'workflow-123';
      const mockEnrollments = [
        {
          id: 'enrollment-1',
          contactId: 'contact-1',
          enrolledAt: '2024-01-15T10:00:00Z',
          status: 'ENROLLED',
        },
        {
          id: 'enrollment-2',
          contactId: 'contact-2',
          enrolledAt: '2024-01-15T10:01:00Z',
          status: 'COMPLETED',
        },
      ];

      mockClient.get.mockResolvedValue({
        results: mockEnrollments,
        total: 2,
      });

      // Act
      const enrollments = await hubspotWorkflows.getWorkflowEnrollments(workflowId);

      // Assert
      expect(enrollments.results).toEqual(mockEnrollments);
      expect(mockClient.get).toHaveBeenCalledWith(
        `/automation/v4/workflows/${workflowId}/enrollments`,
        {}
      );
    });

    it('should filter enrollments by status', async () => {
      // Arrange
      const workflowId = 'workflow-123';
      const status = 'ENROLLED';

      // Act
      await hubspotWorkflows.getWorkflowEnrollments(workflowId, { status });

      // Assert
      expect(mockClient.get).toHaveBeenCalledWith(
        `/automation/v4/workflows/${workflowId}/enrollments`,
        { status }
      );
    });
  });

  describe('Workflow Templates', () => {
    it('should create lead nurturing workflow template', async () => {
      // Arrange
      const templateData = {
        campaignId: 'campaign-123',
        emailTemplateIds: ['template-1', 'template-2', 'template-3'],
        delayDays: [1, 3, 7],
      };

      const mockWorkflow = {
        id: 'workflow-123',
        name: 'ColdCopy Lead Nurturing - Campaign 123',
        type: 'CONTACT_ENROLLMENT',
        enabled: true,
      };

      mockClient.post.mockResolvedValue(mockWorkflow);

      // Act
      const workflow = await hubspotWorkflows.createLeadNurturingWorkflow(templateData);

      // Assert
      expect(workflow).toEqual(mockWorkflow);
      expect(mockClient.post).toHaveBeenCalledWith(
        '/automation/v4/workflows',
        expect.objectContaining({
          name: expect.stringContaining('ColdCopy Lead Nurturing'),
          type: 'CONTACT_ENROLLMENT',
          enrollmentCriteria: expect.objectContaining({
            filterGroups: expect.arrayContaining([
              expect.objectContaining({
                filters: expect.arrayContaining([
                  expect.objectContaining({
                    propertyName: 'coldcopy_campaign_id',
                    value: 'campaign-123',
                  }),
                ]),
              }),
            ]),
          }),
          actions: expect.arrayContaining([
            expect.objectContaining({ type: 'DELAY' }),
            expect.objectContaining({ type: 'SEND_EMAIL' }),
          ]),
        })
      );
    });

    it('should create deal follow-up workflow template', async () => {
      // Arrange
      const templateData = {
        dealStage: 'appointmentscheduled',
        followUpDays: 3,
        taskTemplate: {
          title: 'Follow up on ColdCopy lead',
          notes: 'This deal originated from ColdCopy campaign',
          taskType: 'EMAIL',
        },
      };

      const mockWorkflow = {
        id: 'workflow-456',
        name: 'ColdCopy Deal Follow-up',
        type: 'DEAL_ENROLLMENT',
        enabled: true,
      };

      mockClient.post.mockResolvedValue(mockWorkflow);

      // Act
      const workflow = await hubspotWorkflows.createDealFollowUpWorkflow(templateData);

      // Assert
      expect(workflow).toEqual(mockWorkflow);
      expect(mockClient.post).toHaveBeenCalledWith(
        '/automation/v4/workflows',
        expect.objectContaining({
          name: 'ColdCopy Deal Follow-up',
          type: 'DEAL_ENROLLMENT',
          enrollmentCriteria: expect.objectContaining({
            filterGroups: expect.arrayContaining([
              expect.objectContaining({
                filters: expect.arrayContaining([
                  expect.objectContaining({
                    propertyName: 'dealstage',
                    value: 'appointmentscheduled',
                  }),
                ]),
              }),
            ]),
          }),
          actions: expect.arrayContaining([
            expect.objectContaining({ type: 'CREATE_TASK' }),
          ]),
        })
      );
    });

    it('should create contact scoring workflow template', async () => {
      // Arrange
      const templateData = {
        scoringCriteria: [
          { propertyName: 'email_opens', operator: 'GT', value: '5', points: 10 },
          { propertyName: 'email_clicks', operator: 'GT', value: '2', points: 20 },
          { propertyName: 'website_visits', operator: 'GT', value: '3', points: 15 },
        ],
        thresholds: {
          hot: 50,
          warm: 25,
          cold: 0,
        },
      };

      const mockWorkflow = {
        id: 'workflow-789',
        name: 'ColdCopy Lead Scoring',
        type: 'CONTACT_ENROLLMENT',
        enabled: true,
      };

      mockClient.post.mockResolvedValue(mockWorkflow);

      // Act
      const workflow = await hubspotWorkflows.createLeadScoringWorkflow(templateData);

      // Assert
      expect(workflow).toEqual(mockWorkflow);
      expect(mockClient.post).toHaveBeenCalledWith(
        '/automation/v4/workflows',
        expect.objectContaining({
          name: 'ColdCopy Lead Scoring',
          type: 'CONTACT_ENROLLMENT',
          actions: expect.arrayContaining([
            expect.objectContaining({
              type: 'SET_PROPERTY',
              propertyName: 'coldcopy_lead_score',
            }),
            expect.objectContaining({
              type: 'SET_PROPERTY',
              propertyName: 'coldcopy_lead_temperature',
            }),
          ]),
        })
      );
    });
  });

  describe('Workflow Triggers', () => {
    it('should trigger workflow on campaign launch', async () => {
      // Arrange
      const campaignData = {
        id: 'campaign-123',
        name: 'Q1 Outreach Campaign',
        target_audience: 'enterprise',
        expected_leads: 1000,
      };

      const workflowTemplate = {
        name: `ColdCopy Campaign Workflow - ${campaignData.name}`,
        type: 'CONTACT_ENROLLMENT',
        enabled: true,
        enrollmentCriteria: {
          filterGroups: [
            {
              filters: [
                {
                  propertyName: 'coldcopy_campaign_id',
                  operator: 'EQ',
                  value: campaignData.id,
                },
              ],
            },
          ],
        },
      };

      const mockWorkflow = {
        id: 'workflow-123',
        ...workflowTemplate,
      };

      mockClient.post.mockResolvedValue(mockWorkflow);

      // Mock workflow configuration storage
      mockSupabase.single.mockResolvedValue({
        data: {
          id: 'config-123',
          campaign_id: campaignData.id,
          workflow_id: mockWorkflow.id,
          trigger_type: 'campaign_launch',
        },
        error: null,
      });

      // Act
      const workflow = await hubspotWorkflows.triggerCampaignWorkflow(campaignData);

      // Assert
      expect(workflow).toEqual(mockWorkflow);
      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          campaign_id: campaignData.id,
          workflow_id: mockWorkflow.id,
          trigger_type: 'campaign_launch',
        })
      );
    });

    it('should trigger workflow on lead status change', async () => {
      // Arrange
      const leadData = {
        id: 'lead-123',
        email: 'test@example.com',
        status: 'qualified',
        previous_status: 'contacted',
        campaign_id: 'campaign-456',
      };

      const workflowId = 'workflow-456';

      // Mock workflow lookup
      mockSupabase.single.mockResolvedValue({
        data: {
          id: 'config-456',
          workflow_id: workflowId,
          trigger_type: 'lead_status_change',
          trigger_conditions: {
            from_status: 'contacted',
            to_status: 'qualified',
          },
        },
        error: null,
      });

      // Mock contact lookup
      mockSupabase.single.mockResolvedValue({
        data: {
          hubspot_id: 'contact-789',
        },
        error: null,
      });

      const mockEnrollment = {
        id: 'enrollment-123',
        workflowId,
        contactId: 'contact-789',
        enrolledAt: '2024-01-15T10:00:00Z',
        status: 'ENROLLED',
      };

      mockClient.post.mockResolvedValue(mockEnrollment);

      // Act
      const enrollment = await hubspotWorkflows.triggerLeadStatusWorkflow(leadData);

      // Assert
      expect(enrollment).toEqual(mockEnrollment);
      expect(mockClient.post).toHaveBeenCalledWith(
        `/automation/v4/workflows/${workflowId}/enrollments`,
        {
          contactId: 'contact-789',
        }
      );
    });

    it('should trigger workflow on email engagement', async () => {
      // Arrange
      const engagementData = {
        email: 'engaged@example.com',
        type: 'EMAIL_CLICKED',
        campaign_id: 'campaign-789',
        engagement_score: 85,
      };

      const workflowId = 'workflow-789';

      // Mock workflow lookup
      mockSupabase.single.mockResolvedValue({
        data: {
          id: 'config-789',
          workflow_id: workflowId,
          trigger_type: 'email_engagement',
          trigger_conditions: {
            engagement_types: ['EMAIL_CLICKED', 'EMAIL_REPLIED'],
            min_score: 50,
          },
        },
        error: null,
      });

      // Mock contact lookup
      mockSupabase.single.mockResolvedValue({
        data: {
          hubspot_id: 'contact-999',
        },
        error: null,
      });

      const mockEnrollment = {
        id: 'enrollment-456',
        workflowId,
        contactId: 'contact-999',
        enrolledAt: '2024-01-15T10:00:00Z',
        status: 'ENROLLED',
      };

      mockClient.post.mockResolvedValue(mockEnrollment);

      // Act
      const enrollment = await hubspotWorkflows.triggerEngagementWorkflow(engagementData);

      // Assert
      expect(enrollment).toEqual(mockEnrollment);
      expect(mockClient.post).toHaveBeenCalledWith(
        `/automation/v4/workflows/${workflowId}/enrollments`,
        {
          contactId: 'contact-999',
        }
      );
    });
  });

  describe('Workflow Analytics', () => {
    it('should get workflow performance metrics', async () => {
      // Arrange
      const workflowId = 'workflow-123';
      const mockMetrics = {
        workflowId,
        totalEnrollments: 250,
        activeEnrollments: 75,
        completedEnrollments: 150,
        droppedEnrollments: 25,
        conversionRate: 0.6,
        averageCompletionTime: 7.5, // days
        enrollmentsByDay: [
          { date: '2024-01-15', count: 50 },
          { date: '2024-01-16', count: 75 },
          { date: '2024-01-17', count: 125 },
        ],
      };

      mockClient.get.mockResolvedValue(mockMetrics);

      // Act
      const metrics = await hubspotWorkflows.getWorkflowMetrics(workflowId);

      // Assert
      expect(metrics).toEqual(mockMetrics);
      expect(mockClient.get).toHaveBeenCalledWith(
        `/automation/v4/workflows/${workflowId}/metrics`
      );
    });

    it('should get workflow performance with date range', async () => {
      // Arrange
      const workflowId = 'workflow-123';
      const dateRange = {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      };

      // Act
      await hubspotWorkflows.getWorkflowMetrics(workflowId, dateRange);

      // Assert
      expect(mockClient.get).toHaveBeenCalledWith(
        `/automation/v4/workflows/${workflowId}/metrics`,
        {
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
        }
      );
    });

    it('should compare workflow performance', async () => {
      // Arrange
      const workflowIds = ['workflow-1', 'workflow-2', 'workflow-3'];
      const mockComparison = {
        workflows: workflowIds.map((id, index) => ({
          workflowId: id,
          name: `Workflow ${index + 1}`,
          totalEnrollments: (index + 1) * 100,
          conversionRate: 0.5 + (index * 0.1),
          averageCompletionTime: 5 + index,
        })),
        bestPerforming: 'workflow-3',
        averageConversionRate: 0.633,
      };

      mockClient.post.mockResolvedValue(mockComparison);

      // Act
      const comparison = await hubspotWorkflows.compareWorkflows(workflowIds);

      // Assert
      expect(comparison).toEqual(mockComparison);
      expect(mockClient.post).toHaveBeenCalledWith(
        '/automation/v4/workflows/compare',
        {
          workflowIds,
        }
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle workflow creation validation errors', async () => {
      // Arrange
      const invalidWorkflowData = {
        name: '', // Empty name
        type: 'INVALID_TYPE',
        enabled: true,
      };

      // Act & Assert
      await expect(hubspotWorkflows.createWorkflow(invalidWorkflowData as any))
        .rejects
        .toThrow(HubSpotValidationError);
    });

    it('should handle enrollment errors gracefully', async () => {
      // Arrange
      const workflowId = 'workflow-123';
      const contactId = 'non-existent-contact';

      mockClient.post.mockRejectedValue({
        status: 'error',
        message: 'Contact not found',
        category: 'OBJECT_NOT_FOUND',
      });

      // Act & Assert
      await expect(hubspotWorkflows.enrollContact(workflowId, contactId))
        .rejects
        .toThrow('Contact not found');
    });

    it('should handle workflow not found errors', async () => {
      // Arrange
      const workflowId = 'non-existent-workflow';

      mockClient.get.mockRejectedValue({
        status: 'error',
        message: 'Workflow not found',
        category: 'OBJECT_NOT_FOUND',
      });

      // Act & Assert
      await expect(hubspotWorkflows.getWorkflow(workflowId))
        .rejects
        .toThrow('Workflow not found');
    });

    it('should retry on temporary failures', async () => {
      // Arrange
      const workflowData = {
        name: 'Retry Test Workflow',
        type: 'CONTACT_ENROLLMENT',
        enabled: true,
        enrollmentCriteria: { filterGroups: [] },
        actions: [],
      };

      const mockWorkflow = {
        id: 'workflow-123',
        name: workflowData.name,
        type: workflowData.type,
        enabled: workflowData.enabled,
      };

      // First call fails with 503, second succeeds
      mockClient.post
        .mockRejectedValueOnce({ status: 503, message: 'Service unavailable' })
        .mockResolvedValueOnce(mockWorkflow);

      // Act
      const workflow = await hubspotWorkflows.createWorkflow(workflowData);

      // Assert
      expect(workflow).toEqual(mockWorkflow);
      expect(mockClient.post).toHaveBeenCalledTimes(2);
    });

    it('should handle rate limiting', async () => {
      // Arrange
      const workflowId = 'workflow-123';
      const contactIds = Array(100).fill(null).map((_, i) => `contact-${i}`);

      mockClient.post.mockRejectedValueOnce({
        status: 429,
        message: 'Rate limit exceeded',
        retryAfter: 60,
      });

      const mockEnrollments = {
        results: contactIds.map(contactId => ({
          id: `enrollment-${contactId}`,
          workflowId,
          contactId,
          status: 'ENROLLED',
        })),
      };

      mockClient.post.mockResolvedValueOnce(mockEnrollments);

      // Act
      const enrollments = await hubspotWorkflows.enrollMultipleContacts(workflowId, contactIds);

      // Assert
      expect(enrollments).toEqual(mockEnrollments);
      expect(mockClient.post).toHaveBeenCalledTimes(2);
    });
  });

  describe('Workflow State Management', () => {
    it('should track workflow configuration in database', async () => {
      // Arrange
      const workflowData = {
        name: 'Tracked Workflow',
        type: 'CONTACT_ENROLLMENT',
        enabled: true,
        coldcopyConfig: {
          campaign_id: 'campaign-123',
          trigger_type: 'campaign_launch',
          auto_enroll: true,
        },
      };

      const mockWorkflow = {
        id: 'workflow-123',
        name: workflowData.name,
        type: workflowData.type,
        enabled: workflowData.enabled,
      };

      mockClient.post.mockResolvedValue(mockWorkflow);

      // Mock database storage
      mockSupabase.single.mockResolvedValue({
        data: {
          id: 'config-123',
          workspace_id: 'workspace-123',
          workflow_id: mockWorkflow.id,
          campaign_id: workflowData.coldcopyConfig.campaign_id,
          trigger_type: workflowData.coldcopyConfig.trigger_type,
          auto_enroll: workflowData.coldcopyConfig.auto_enroll,
        },
        error: null,
      });

      // Act
      const workflow = await hubspotWorkflows.createWorkflow(workflowData);

      // Assert
      expect(workflow).toEqual(mockWorkflow);
      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          workspace_id: 'workspace-123',
          workflow_id: mockWorkflow.id,
          campaign_id: 'campaign-123',
          trigger_type: 'campaign_launch',
          auto_enroll: true,
        })
      );
    });

    it('should sync workflow status changes', async () => {
      // Arrange
      const workflowId = 'workflow-123';
      const statusUpdate = { enabled: false };

      const mockUpdatedWorkflow = {
        id: workflowId,
        name: 'Test Workflow',
        type: 'CONTACT_ENROLLMENT',
        enabled: false,
        updatedAt: '2024-01-16T10:00:00Z',
      };

      mockClient.patch.mockResolvedValue(mockUpdatedWorkflow);

      // Mock database sync
      mockSupabase.single.mockResolvedValue({
        data: {
          id: 'config-123',
          workflow_id: workflowId,
          enabled: false,
          updated_at: '2024-01-16T10:00:00Z',
        },
        error: null,
      });

      // Act
      const workflow = await hubspotWorkflows.updateWorkflow(workflowId, statusUpdate);

      // Assert
      expect(workflow).toEqual(mockUpdatedWorkflow);
      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: false,
          updated_at: expect.any(String),
        })
      );
    });
  });
});