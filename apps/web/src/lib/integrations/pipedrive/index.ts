// Core Pipedrive services
export { PipedriveClient } from './client';
export { PipedriveAuth } from './auth';
export { PipedrivePersonsService } from './persons';
export { PipedriveDealsService } from './deals';
export { PipedriveActivitiesService } from './activities';
export { ActivityTimelineService } from './activity-timeline';

// Reply handling system
export { PipedriveReplyHandlerService } from './reply-handler';
export { EmailReplyDetectionService } from './reply-detection';
export { EmailTrackingIntegrationService } from './email-tracking-integration';
export { LeadQualificationService } from './qualification-utils';

// Types and interfaces
export * from './types';
export * from './reply-handler-types';
export { ActivityCategory, ActivitySubType } from './activity-timeline';

// Sentiment analysis
export { SentimentAnalysisService, createSentimentAnalysisService } from '@/lib/ai/sentiment-analysis';
export type { SentimentResult, EmailReplyContext } from '@/lib/ai/sentiment-analysis';

// Utility functions
export {
  DEFAULT_QUALIFICATION_FACTORS,
  type QualificationScoreFactors,
  type QualificationResult,
  type LeadEnrichmentData,
} from './qualification-utils';

export {
  DEFAULT_REPLY_HANDLER_CONFIG,
  CONFIGURATION_PRESETS,
  type PipedriveReplyHandlerConfig,
  type ReplyHandlerResult,
  type BatchProcessingResult,
  type ConfigurationTemplate,
} from './reply-handler-types';

// Factory functions and utilities
export const createPipedriveReplyHandler = (
  workspaceId: string,
  config?: Partial<PipedriveReplyHandlerConfig>
) => {
  return new PipedriveReplyHandlerService(workspaceId, config);
};

export const createEmailTrackingIntegration = (workspaceId: string) => {
  return new EmailTrackingIntegrationService(workspaceId);
};

export const createLeadQualificationService = (
  workspaceId: string,
  customFactors?: Partial<QualificationScoreFactors>
) => {
  return new LeadQualificationService(workspaceId, customFactors);
};

// Configuration helpers
export const getConfigurationPreset = (template: ConfigurationTemplate) => {
  return CONFIGURATION_PRESETS.find(preset => preset.template === template);
};

export const validateReplyHandlerConfig = (config: PipedriveReplyHandlerConfig) => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Basic validation
  if (!config.workspaceId) {
    errors.push('Workspace ID is required');
  }

  // Sentiment analysis validation
  if (config.sentimentAnalysis.enabled) {
    if (config.sentimentAnalysis.minConfidenceThreshold < 0 || config.sentimentAnalysis.minConfidenceThreshold > 1) {
      errors.push('Sentiment confidence threshold must be between 0 and 1');
    }
  }

  // Qualification thresholds validation
  if (config.qualificationThresholds.minQualificationScore < 0 || config.qualificationThresholds.minQualificationScore > 100) {
    errors.push('Minimum qualification score must be between 0 and 100');
  }

  if (config.qualificationThresholds.highValueThreshold < config.qualificationThresholds.minQualificationScore) {
    warnings.push('High value threshold should be higher than minimum qualification score');
  }

  // Creation rules validation
  if (config.autoCreatePersons && !config.creationRules.persons.enabled) {
    warnings.push('Auto-create persons is enabled but person creation rules are disabled');
  }

  if (config.autoCreateDeals && !config.creationRules.deals.enabled) {
    warnings.push('Auto-create deals is enabled but deal creation rules are disabled');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
};

// Integration status checker
export const checkPipedriveIntegrationStatus = async (workspaceId: string) => {
  try {
    const auth = new PipedriveAuth();
    const integration = await auth.getIntegration(workspaceId);
    
    if (!integration) {
      return {
        connected: false,
        error: 'No Pipedrive integration found',
      };
    }

    const accessToken = await auth.getValidAccessToken(workspaceId);
    const client = new PipedriveClient(accessToken, integration.companyDomain);
    
    // Test connection with a simple API call
    const testResult = await client.get('/users/me', { workspaceId });
    
    return {
      connected: testResult.success,
      integration,
      error: testResult.success ? null : 'Failed to connect to Pipedrive API',
    };
  } catch (error) {
    return {
      connected: false,
      error: (error as Error).message,
    };
  }
};

// Reply handler setup helper
export const setupReplyHandler = async (
  workspaceId: string,
  config: PipedriveReplyHandlerConfig
) => {
  // Validate configuration
  const validation = validateReplyHandlerConfig(config);
  if (!validation.isValid) {
    throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
  }

  // Check Pipedrive integration status
  const status = await checkPipedriveIntegrationStatus(workspaceId);
  if (!status.connected) {
    throw new Error(`Pipedrive integration not available: ${status.error}`);
  }

  // Create and test the reply handler
  const replyHandler = new PipedriveReplyHandlerService(workspaceId, config);
  const testResult = await replyHandler.testReplyHandler();
  
  if (!testResult.success) {
    throw new Error(`Reply handler test failed: ${testResult.error}`);
  }

  return {
    replyHandler,
    testResult,
    warnings: validation.warnings,
  };
};

// Batch processing helper
export const processPendingReplies = async (
  workspaceId: string,
  limit: number = 50
) => {
  const emailIntegration = new EmailTrackingIntegrationService(workspaceId);
  return emailIntegration.processPendingReplies(limit);
};

// Statistics and reporting helpers
export const getReplyHandlerStats = async (workspaceId: string, days: number = 30) => {
  const emailIntegration = new EmailTrackingIntegrationService(workspaceId);
  return emailIntegration.getEmailTrackingStats(undefined, days);
};

export const getQualificationBenchmarks = async (workspaceId: string) => {
  const qualificationService = new LeadQualificationService(workspaceId);
  return qualificationService.getQualificationBenchmarks();
};

// Configuration migration helper
export const migrateReplyHandlerConfig = (
  oldConfig: any,
  targetVersion: number = 1
): PipedriveReplyHandlerConfig => {
  // Handle configuration migrations between versions
  // This would contain migration logic for breaking changes
  
  if (targetVersion === 1) {
    return {
      ...DEFAULT_REPLY_HANDLER_CONFIG,
      ...oldConfig,
      workspaceId: oldConfig.workspaceId || '',
    };
  }
  
  return oldConfig;
};

// Error handling helpers
export class PipedriveReplyHandlerError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'PipedriveReplyHandlerError';
  }
}

export const handleReplyProcessingError = (error: any) => {
  if (error instanceof PipedriveReplyHandlerError) {
    return {
      type: 'reply_handler_error',
      code: error.code,
      message: error.message,
      details: error.details,
    };
  }

  if (error.name === 'PipedriveAuthError') {
    return {
      type: 'auth_error',
      message: 'Pipedrive authentication failed. Please reconnect your account.',
      code: 'AUTH_FAILED',
    };
  }

  if (error.name === 'PipedriveRateLimitError') {
    return {
      type: 'rate_limit_error',
      message: 'Pipedrive API rate limit exceeded. Please try again later.',
      code: 'RATE_LIMITED',
      retryAfter: error.retryAfter,
    };
  }

  return {
    type: 'unknown_error',
    message: error.message || 'An unknown error occurred',
    code: 'UNKNOWN',
  };
};

// Webhook handler for external integrations
export const handleWebhookEvent = async (
  workspaceId: string,
  event: any
) => {
  const emailIntegration = new EmailTrackingIntegrationService(workspaceId);
  
  if (event.type === 'email') {
    return emailIntegration.processEmailWebhook(event.payload);
  }
  
  if (event.type === 'incoming_email') {
    return emailIntegration.processIncomingEmail(event.payload);
  }
  
  throw new Error(`Unsupported webhook event type: ${event.type}`);
};

// Export constants for easy reference
export const REPLY_HANDLER_EVENTS = {
  REPLY_PROCESSED: 'reply_processed',
  PERSON_CREATED: 'person_created',
  DEAL_CREATED: 'deal_created',
  ACTIVITY_CREATED: 'activity_created',
  ERROR_OCCURRED: 'error_occurred',
} as const;

export const QUALIFICATION_TIERS = {
  COLD: 'cold',
  WARM: 'warm',
  HOT: 'hot',
  QUALIFIED: 'qualified',
} as const;

export const SENTIMENT_TYPES = {
  POSITIVE: 'positive',
  NEUTRAL: 'neutral',
  NEGATIVE: 'negative',
} as const;

export const INTENT_TYPES = {
  INTERESTED: 'interested',
  MEETING_REQUEST: 'meeting_request',
  QUESTION: 'question',
  NOT_INTERESTED: 'not_interested',
  COMPLAINT: 'complaint',
  UNSUBSCRIBE: 'unsubscribe',
  UNCLEAR: 'unclear',
} as const;

export const URGENCY_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
} as const;