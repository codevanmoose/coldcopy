import { SentimentResult } from '@/lib/ai/sentiment-analysis';

export interface PipedriveReplyHandlerConfig {
  workspaceId: string;
  enabled: boolean;
  autoCreatePersons: boolean;
  autoCreateDeals: boolean;
  autoLogActivities: boolean;
  sentimentAnalysis: {
    enabled: boolean;
    provider: 'openai' | 'anthropic';
    model?: string;
    minConfidenceThreshold: number;
  };
  creationRules: {
    persons: PersonCreationRules;
    deals: DealCreationRules;
    activities: ActivityCreationRules;
  };
  qualificationThresholds: {
    minQualificationScore: number;
    highValueThreshold: number;
    urgencyLevels: {
      low: { maxScore: number; actions: string[] };
      medium: { minScore: number; maxScore: number; actions: string[] };
      high: { minScore: number; actions: string[] };
    };
  };
  integrationSettings: {
    defaultPipelineId?: number;
    defaultStageId?: number;
    defaultOwnerId?: number;
    customFieldMappings: Record<string, string>;
    tagMappings: {
      sentiment: Record<string, string>;
      intent: Record<string, string>;
      urgency: Record<string, string>;
    };
  };
}

export interface PersonCreationRules {
  enabled: boolean;
  conditions: {
    sentiments: ('positive' | 'neutral' | 'negative')[];
    intents: ('interested' | 'meeting_request' | 'question' | 'not_interested' | 'complaint' | 'unsubscribe' | 'unclear')[];
    minConfidence: number;
    minQualificationScore: number;
  };
  skipExisting: boolean;
  updateExisting: boolean;
  requiredFields: {
    name: boolean;
    email: boolean;
    company: boolean;
    title: boolean;
  };
  enrichmentLevel: 'none' | 'basic' | 'full';
  notifications: {
    onCreation: boolean;
    onUpdate: boolean;
    recipients: string[];
  };
}

export interface DealCreationRules {
  enabled: boolean;
  conditions: {
    sentiments: ('positive' | 'neutral' | 'negative')[];
    intents: ('interested' | 'meeting_request' | 'question' | 'not_interested' | 'complaint' | 'unsubscribe' | 'unclear')[];
    minConfidence: number;
    minQualificationScore: number;
    requireExistingPerson: boolean;
  };
  valueCalculation: {
    method: 'fixed' | 'score_based' | 'company_size' | 'custom';
    baseValue: number;
    multipliers: {
      scoreRange: Array<{ min: number; max: number; multiplier: number }>;
      urgency: Record<string, number>;
      intent: Record<string, number>;
    };
  };
  stageAssignment: {
    method: 'fixed' | 'intent_based' | 'score_based';
    defaultStageId?: number;
    mappings: {
      intent: Record<string, number>;
      scoreRange: Array<{ min: number; max: number; stageId: number }>;
    };
  };
  notifications: {
    onCreation: boolean;
    highValueThreshold: number;
    recipients: string[];
  };
}

export interface ActivityCreationRules {
  enabled: boolean;
  types: {
    emailReply: {
      enabled: boolean;
      activityType: string;
      template: string;
    };
    followUp: {
      enabled: boolean;
      delayHours: number;
      conditions: {
        sentiments: string[];
        intents: string[];
        minScore: number;
      };
      activityType: string;
      template: string;
    };
    meeting: {
      enabled: boolean;
      conditions: {
        intents: string[];
        minScore: number;
      };
      activityType: string;
      template: string;
      autoSchedule: boolean;
    };
  };
  assignmentRules: {
    method: 'round_robin' | 'lead_based' | 'random' | 'fixed';
    defaultOwnerId?: number;
    teamMembers: number[];
  };
}

export interface ReplyHandlerResult {
  success: boolean;
  processed: boolean;
  replyId: string;
  leadId?: string;
  actions: ReplyHandlerAction[];
  sentiment?: SentimentResult;
  errors: string[];
  warnings: string[];
  metadata: {
    processingTime: number;
    qualified: boolean;
    highValue: boolean;
    urgencyLevel: 'low' | 'medium' | 'high';
  };
}

export interface ReplyHandlerAction {
  type: 'person_created' | 'person_updated' | 'deal_created' | 'deal_updated' | 'activity_created' | 'notification_sent' | 'enrichment_triggered';
  status: 'success' | 'failed' | 'skipped';
  entityId?: string | number;
  entityType?: 'person' | 'deal' | 'activity';
  details: Record<string, any>;
  error?: string;
  timestamp: Date;
}

export interface BatchProcessingResult {
  totalProcessed: number;
  successful: number;
  failed: number;
  skipped: number;
  results: ReplyHandlerResult[];
  summary: {
    personsCreated: number;
    personsUpdated: number;
    dealsCreated: number;
    dealsUpdated: number;
    activitiesCreated: number;
    notificationsSent: number;
    processingTimeMs: number;
  };
  errors: Array<{
    replyId: string;
    error: string;
    timestamp: Date;
  }>;
}

export interface LeadQualificationData {
  basicInfo: {
    hasName: boolean;
    hasCompany: boolean;
    hasTitle: boolean;
    hasPhone: boolean;
    emailDomain: string;
    isValidBusinessEmail: boolean;
  };
  engagementHistory: {
    totalEmails: number;
    opened: number;
    clicked: number;
    replied: number;
    lastActivity: Date;
    engagementScore: number;
  };
  companyData?: {
    size: 'startup' | 'small' | 'medium' | 'large' | 'enterprise';
    industry: string;
    revenue?: number;
    employees?: number;
    technologies: string[];
    funding?: {
      stage: string;
      amount: number;
      date: Date;
    };
  };
  enrichmentData?: {
    source: string;
    confidence: number;
    lastUpdated: Date;
    verified: boolean;
    additionalFields: Record<string, any>;
  };
}

export interface NotificationConfig {
  enabled: boolean;
  channels: ('email' | 'slack' | 'webhook' | 'in_app')[];
  triggers: {
    personCreated: boolean;
    dealCreated: boolean;
    highValueLead: boolean;
    urgentReply: boolean;
    negativeReply: boolean;
  };
  recipients: {
    emails: string[];
    slackChannels: string[];
    webhookUrls: string[];
    userIds: string[];
  };
  templates: {
    personCreated: string;
    dealCreated: string;
    highValueLead: string;
    urgentReply: string;
    negativeReply: string;
  };
}

export interface PipedriveReplyHandlerStats {
  timeRange: {
    from: Date;
    to: Date;
  };
  totalReplies: number;
  processedReplies: number;
  qualifiedReplies: number;
  actions: {
    personsCreated: number;
    personsUpdated: number;
    dealsCreated: number;
    dealsUpdated: number;
    activitiesCreated: number;
    notificationsSent: number;
  };
  sentiment: {
    positive: number;
    neutral: number;
    negative: number;
  };
  intent: Record<string, number>;
  urgency: {
    low: number;
    medium: number;
    high: number;
  };
  qualificationScores: {
    average: number;
    median: number;
    distribution: Array<{ range: string; count: number }>;
  };
  performance: {
    averageProcessingTime: number;
    successRate: number;
    errorRate: number;
    skipRate: number;
  };
  topErrors: Array<{
    error: string;
    count: number;
    lastOccurrence: Date;
  }>;
}

export interface WorkspaceReplyHandlerSettings {
  workspaceId: string;
  config: PipedriveReplyHandlerConfig;
  lastUpdated: Date;
  updatedBy: string;
  version: number;
  enabled: boolean;
  testMode: boolean;
}

// Utility types for configuration validation
export type ConfigValidationResult = {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
};

export type ConfigurationTemplate = 'conservative' | 'balanced' | 'aggressive' | 'custom';

export interface ConfigurationPreset {
  name: string;
  description: string;
  template: ConfigurationTemplate;
  config: Partial<PipedriveReplyHandlerConfig>;
  useCase: string;
  recommendedFor: string[];
}

// Event types for webhook notifications
export interface ReplyHandlerWebhookEvent {
  eventType: 'reply_processed' | 'person_created' | 'deal_created' | 'error_occurred';
  workspaceId: string;
  timestamp: Date;
  data: {
    replyId: string;
    leadId?: string;
    sentiment?: SentimentResult;
    actions: ReplyHandlerAction[];
    metadata: Record<string, any>;
  };
  version: string;
}

// Migration and upgrade types
export interface ConfigMigration {
  fromVersion: number;
  toVersion: number;
  migrate: (oldConfig: any) => PipedriveReplyHandlerConfig;
  validate: (migratedConfig: PipedriveReplyHandlerConfig) => ConfigValidationResult;
}

export const DEFAULT_REPLY_HANDLER_CONFIG: PipedriveReplyHandlerConfig = {
  workspaceId: '',
  enabled: true,
  autoCreatePersons: true,
  autoCreateDeals: false,
  autoLogActivities: true,
  sentimentAnalysis: {
    enabled: true,
    provider: 'openai',
    minConfidenceThreshold: 0.7,
  },
  creationRules: {
    persons: {
      enabled: true,
      conditions: {
        sentiments: ['positive', 'neutral'],
        intents: ['interested', 'meeting_request', 'question'],
        minConfidence: 0.6,
        minQualificationScore: 40,
      },
      skipExisting: true,
      updateExisting: true,
      requiredFields: {
        name: false,
        email: true,
        company: false,
        title: false,
      },
      enrichmentLevel: 'basic',
      notifications: {
        onCreation: true,
        onUpdate: false,
        recipients: [],
      },
    },
    deals: {
      enabled: false,
      conditions: {
        sentiments: ['positive'],
        intents: ['interested', 'meeting_request'],
        minConfidence: 0.7,
        minQualificationScore: 60,
        requireExistingPerson: true,
      },
      valueCalculation: {
        method: 'score_based',
        baseValue: 1000,
        multipliers: {
          scoreRange: [
            { min: 0, max: 50, multiplier: 0.5 },
            { min: 51, max: 75, multiplier: 1.0 },
            { min: 76, max: 100, multiplier: 2.0 },
          ],
          urgency: { low: 1.0, medium: 1.2, high: 1.5 },
          intent: { 
            interested: 1.0, 
            meeting_request: 1.5, 
            question: 0.8,
            not_interested: 0.1,
            complaint: 0.1,
            unsubscribe: 0.0,
            unclear: 0.5,
          },
        },
      },
      stageAssignment: {
        method: 'intent_based',
        mappings: {
          intent: {
            interested: 1,
            meeting_request: 2,
            question: 1,
          },
          scoreRange: [
            { min: 0, max: 50, stageId: 1 },
            { min: 51, max: 100, stageId: 2 },
          ],
        },
      },
      notifications: {
        onCreation: true,
        highValueThreshold: 5000,
        recipients: [],
      },
    },
    activities: {
      enabled: true,
      types: {
        emailReply: {
          enabled: true,
          activityType: 'email',
          template: 'Email reply received: {{subject}}',
        },
        followUp: {
          enabled: true,
          delayHours: 24,
          conditions: {
            sentiments: ['positive', 'neutral'],
            intents: ['interested', 'question'],
            minScore: 50,
          },
          activityType: 'task',
          template: 'Follow up on email reply',
        },
        meeting: {
          enabled: true,
          conditions: {
            intents: ['meeting_request'],
            minScore: 60,
          },
          activityType: 'meeting',
          template: 'Schedule meeting requested in email reply',
          autoSchedule: false,
        },
      },
      assignmentRules: {
        method: 'lead_based',
        teamMembers: [],
      },
    },
  },
  qualificationThresholds: {
    minQualificationScore: 30,
    highValueThreshold: 80,
    urgencyLevels: {
      low: { 
        maxScore: 50, 
        actions: ['log_activity'] 
      },
      medium: { 
        minScore: 51, 
        maxScore: 79, 
        actions: ['log_activity', 'create_person'] 
      },
      high: { 
        minScore: 80, 
        actions: ['log_activity', 'create_person', 'create_deal', 'send_notification'] 
      },
    },
  },
  integrationSettings: {
    customFieldMappings: {},
    tagMappings: {
      sentiment: {
        positive: 'positive-reply',
        neutral: 'neutral-reply',
        negative: 'negative-reply',
      },
      intent: {
        interested: 'interested',
        meeting_request: 'meeting-requested',
        question: 'has-questions',
        not_interested: 'not-interested',
        complaint: 'complaint',
        unsubscribe: 'unsubscribed',
        unclear: 'unclear-intent',
      },
      urgency: {
        low: 'low-priority',
        medium: 'medium-priority',
        high: 'high-priority',
      },
    },
  },
};

export const CONFIGURATION_PRESETS: ConfigurationPreset[] = [
  {
    name: 'Conservative',
    description: 'Only create persons for highly qualified, positive replies',
    template: 'conservative',
    useCase: 'Minimize false positives, only handle obvious qualified leads',
    recommendedFor: ['Small teams', 'High-touch sales'],
    config: {
      autoCreatePersons: true,
      autoCreateDeals: false,
      creationRules: {
        persons: {
          enabled: true,
          conditions: {
            sentiments: ['positive'],
            intents: ['interested', 'meeting_request'],
            minConfidence: 0.8,
            minQualificationScore: 70,
          },
          skipExisting: true,
          updateExisting: false,
          enrichmentLevel: 'full',
        } as PersonCreationRules,
      },
    },
  },
  {
    name: 'Balanced',
    description: 'Create persons for qualified replies, deals for high-intent responses',
    template: 'balanced',
    useCase: 'Good balance between automation and manual control',
    recommendedFor: ['Growing teams', 'B2B sales'],
    config: {
      autoCreatePersons: true,
      autoCreateDeals: true,
      creationRules: {
        persons: {
          enabled: true,
          conditions: {
            sentiments: ['positive', 'neutral'],
            intents: ['interested', 'meeting_request', 'question'],
            minConfidence: 0.6,
            minQualificationScore: 50,
          },
          enrichmentLevel: 'basic',
        } as PersonCreationRules,
        deals: {
          enabled: true,
          conditions: {
            sentiments: ['positive'],
            intents: ['interested', 'meeting_request'],
            minConfidence: 0.7,
            minQualificationScore: 70,
            requireExistingPerson: true,
          },
        } as DealCreationRules,
      },
    },
  },
  {
    name: 'Aggressive',
    description: 'Create persons and deals for most replies, maximize automation',
    template: 'aggressive',
    useCase: 'High-volume outreach with aggressive lead capture',
    recommendedFor: ['Large teams', 'High-volume sales'],
    config: {
      autoCreatePersons: true,
      autoCreateDeals: true,
      creationRules: {
        persons: {
          enabled: true,
          conditions: {
            sentiments: ['positive', 'neutral', 'negative'],
            intents: ['interested', 'meeting_request', 'question', 'unclear'],
            minConfidence: 0.4,
            minQualificationScore: 30,
          },
          enrichmentLevel: 'basic',
        } as PersonCreationRules,
        deals: {
          enabled: true,
          conditions: {
            sentiments: ['positive', 'neutral'],
            intents: ['interested', 'meeting_request', 'question'],
            minConfidence: 0.5,
            minQualificationScore: 40,
            requireExistingPerson: false,
          },
        } as DealCreationRules,
      },
    },
  },
];