import { 
  createWorkflowTriggerService,
  EmailEngagementEvent,
  WorkflowTriggerConfig,
  EmailEngagementEventType 
} from './workflows';

/**
 * Example: Create a workflow trigger for email opens
 * This trigger will:
 * 1. Update the contact's engagement score
 * 2. Add them to a "Engaged Leads" list
 * 3. Create a follow-up task for sales
 */
export async function createEmailOpenTrigger(workspaceId: string) {
  const service = createWorkflowTriggerService(workspaceId);
  
  const config: Partial<WorkflowTriggerConfig> = {
    name: 'Email Open Engagement Trigger',
    description: 'Triggers when a lead opens an email from a campaign',
    enabled: true,
    eventType: 'email_opened',
    
    // Only trigger for specific campaigns
    conditions: [
      {
        field: 'metadata.campaignType',
        operator: 'equals',
        value: 'nurture'
      }
    ],
    
    actions: [
      // Update HubSpot contact property
      {
        type: 'update_property',
        config: {
          propertyName: 'engagement_level',
          propertyValue: 'warm',
          updateType: 'set'
        }
      },
      
      // Add to HubSpot list
      {
        type: 'add_to_list',
        config: {
          listId: '12345' // Your HubSpot list ID
        }
      },
      
      // Create a follow-up task
      {
        type: 'create_task',
        config: {
          subject: 'Follow up with engaged lead',
          body: 'This lead opened our nurture email. Consider reaching out.',
          priority: 'HIGH',
          dueInDays: 2,
          taskType: 'CALL'
        }
      }
    ],
    
    // Update multiple properties based on engagement
    propertyUpdates: [
      {
        propertyName: 'coldcopy_open_count',
        propertyValue: 1,
        updateType: 'increment'
      },
      {
        propertyName: 'last_email_opened',
        propertyValue: '{{timestamp}}',
        updateType: 'set'
      }
    ]
  };
  
  return await service.upsertTriggerConfig(config);
}

/**
 * Example: Create a workflow trigger for email replies
 * This trigger will:
 * 1. Move the lead to "Sales Qualified" stage
 * 2. Trigger a HubSpot workflow for immediate follow-up
 * 3. Send a Slack notification to the sales team
 */
export async function createEmailReplyTrigger(workspaceId: string) {
  const service = createWorkflowTriggerService(workspaceId);
  
  const config: Partial<WorkflowTriggerConfig> = {
    name: 'Email Reply Sales Alert',
    description: 'Immediate action when a lead replies to an email',
    enabled: true,
    eventType: 'email_replied',
    
    actions: [
      // Trigger HubSpot workflow
      {
        type: 'trigger_workflow',
        config: {
          workflowId: '67890' // Your HubSpot workflow ID
        }
      },
      
      // Update lead stage
      {
        type: 'update_property',
        config: {
          propertyName: 'lifecyclestage',
          propertyValue: 'salesqualifiedlead',
          updateType: 'set'
        }
      },
      
      // Send notification
      {
        type: 'send_notification',
        config: {
          title: 'Hot Lead Alert! 🔥',
          message: 'Lead {{leadEmail}} just replied to your campaign!',
          recipients: ['sales-team']
        }
      }
    ],
    
    propertyUpdates: [
      {
        propertyName: 'lead_score',
        propertyValue: 50,
        updateType: 'increment'
      },
      {
        propertyName: 'is_hot_lead',
        propertyValue: true,
        updateType: 'set'
      }
    ]
  };
  
  return await service.upsertTriggerConfig(config);
}

/**
 * Example: Create a multi-touch attribution trigger
 * Track engagement across multiple touchpoints
 */
export async function createMultiTouchTrigger(workspaceId: string) {
  const service = createWorkflowTriggerService(workspaceId);
  
  const config: Partial<WorkflowTriggerConfig> = {
    name: 'Multi-Touch Attribution Tracker',
    description: 'Track all email engagements for attribution',
    enabled: true,
    eventType: 'email_clicked',
    
    // Only track clicks on specific links
    conditions: [
      {
        field: 'metadata.linkType',
        operator: 'equals',
        value: 'cta'
      }
    ],
    
    propertyUpdates: [
      {
        propertyName: 'engagement_history',
        propertyValue: {
          value: '{{eventType}} on {{timestamp}}',
          separator: ' | '
        },
        updateType: 'append'
      },
      {
        propertyName: 'total_clicks',
        propertyValue: 1,
        updateType: 'increment'
      },
      {
        propertyName: 'last_cta_clicked',
        propertyValue: '{{metadata.linkUrl}}',
        updateType: 'set'
      }
    ]
  };
  
  return await service.upsertTriggerConfig(config);
}

/**
 * Example: Handle email bounces
 * Clean up your list and update contact status
 */
export async function createBounceTrigger(workspaceId: string) {
  const service = createWorkflowTriggerService(workspaceId);
  
  const config: Partial<WorkflowTriggerConfig> = {
    name: 'Email Bounce Handler',
    description: 'Handle hard and soft bounces appropriately',
    enabled: true,
    eventType: 'email_bounced',
    
    // Only act on hard bounces
    conditions: [
      {
        field: 'metadata.bounceType',
        operator: 'equals',
        value: 'hard'
      }
    ],
    
    actions: [
      {
        type: 'update_property',
        config: {
          propertyName: 'email_status',
          propertyValue: 'invalid',
          updateType: 'set'
        }
      },
      {
        type: 'add_to_list',
        config: {
          listId: '99999' // Your suppression list ID
        }
      }
    ],
    
    propertyUpdates: [
      {
        propertyName: 'do_not_email',
        propertyValue: true,
        updateType: 'set'
      },
      {
        propertyName: 'bounce_reason',
        propertyValue: '{{metadata.bounceReason}}',
        updateType: 'set'
      }
    ]
  };
  
  return await service.upsertTriggerConfig(config);
}

/**
 * Example: Process an engagement event through all configured triggers
 */
export async function processEngagementEvent(
  workspaceId: string,
  eventData: {
    type: EmailEngagementEventType;
    emailId: string;
    campaignId: string;
    leadId: string;
    leadEmail: string;
    metadata?: Record<string, any>;
  }
) {
  const service = createWorkflowTriggerService(workspaceId);
  
  const event: EmailEngagementEvent = {
    id: `evt_${Date.now()}`,
    workspaceId,
    eventType: eventData.type,
    emailId: eventData.emailId,
    campaignId: eventData.campaignId,
    leadId: eventData.leadId,
    leadEmail: eventData.leadEmail,
    timestamp: new Date(),
    metadata: eventData.metadata || {}
  };
  
  try {
    await service.processEngagementEvent(event);
    console.log(`Successfully processed ${eventData.type} event for ${eventData.leadEmail}`);
  } catch (error) {
    console.error('Error processing engagement event:', error);
    throw error;
  }
}

/**
 * Example: Test a workflow trigger
 */
export async function testWorkflowTrigger(
  workspaceId: string,
  triggerId: string
) {
  const service = createWorkflowTriggerService(workspaceId);
  
  try {
    await service.testTrigger(triggerId, {
      leadEmail: 'test@example.com',
      campaignId: 'test-campaign',
      metadata: {
        campaignType: 'nurture',
        linkType: 'cta',
        linkUrl: 'https://example.com/demo'
      }
    });
    
    console.log('Workflow trigger test completed successfully');
  } catch (error) {
    console.error('Workflow trigger test failed:', error);
    throw error;
  }
}

/**
 * Example: Bulk update contacts based on engagement
 * This could be run as a scheduled job
 */
export async function bulkUpdateEngagedContacts(workspaceId: string) {
  const service = createWorkflowTriggerService(workspaceId);
  
  // This would typically fetch from your database
  const engagedLeads = [
    { leadId: 'lead1', email: 'lead1@example.com', engagementScore: 85 },
    { leadId: 'lead2', email: 'lead2@example.com', engagementScore: 92 },
    { leadId: 'lead3', email: 'lead3@example.com', engagementScore: 78 }
  ];
  
  for (const lead of engagedLeads) {
    if (lead.engagementScore > 80) {
      const event: EmailEngagementEvent = {
        id: `bulk_${Date.now()}_${lead.leadId}`,
        workspaceId,
        eventType: 'email_clicked', // Trigger click-based workflows
        emailId: 'bulk-update',
        campaignId: 'engagement-campaign',
        leadId: lead.leadId,
        leadEmail: lead.email,
        timestamp: new Date(),
        metadata: {
          bulkUpdate: true,
          engagementScore: lead.engagementScore
        }
      };
      
      await service.processEngagementEvent(event);
    }
  }
}

/**
 * Example: Integration with your email tracking system
 */
export async function handleEmailTrackingWebhook(
  workspaceId: string,
  webhookData: {
    event: string;
    email: string;
    campaignId: string;
    leadId: string;
    timestamp: string;
    data?: any;
  }
) {
  const eventTypeMap: Record<string, EmailEngagementEventType> = {
    'email.sent': 'email_sent',
    'email.opened': 'email_opened',
    'email.clicked': 'email_clicked',
    'email.replied': 'email_replied',
    'email.bounced': 'email_bounced',
    'email.unsubscribed': 'email_unsubscribed'
  };
  
  const eventType = eventTypeMap[webhookData.event];
  if (!eventType) {
    console.warn(`Unknown webhook event type: ${webhookData.event}`);
    return;
  }
  
  await processEngagementEvent(workspaceId, {
    type: eventType,
    emailId: webhookData.data?.emailId || `email_${Date.now()}`,
    campaignId: webhookData.campaignId,
    leadId: webhookData.leadId,
    leadEmail: webhookData.email,
    metadata: webhookData.data
  });
}