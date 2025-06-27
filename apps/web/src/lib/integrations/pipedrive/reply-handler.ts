import { PipedrivePersonsService } from './persons';
import { PipedriveDealsService } from './deals';
import { PipedriveActivitiesService } from './activities';
import { EmailReplyDetectionService, ReplyProcessingResult } from './reply-detection';
import { SentimentAnalysisService, SentimentResult } from '@/lib/ai/sentiment-analysis';
import { createServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import {
  PipedriveReplyHandlerConfig,
  ReplyHandlerResult,
  ReplyHandlerAction,
  BatchProcessingResult,
  LeadQualificationData,
  NotificationConfig,
  DEFAULT_REPLY_HANDLER_CONFIG,
  WorkspaceReplyHandlerSettings,
} from './reply-handler-types';

export class PipedriveReplyHandlerService {
  private workspaceId: string;
  private config: PipedriveReplyHandlerConfig;
  private personsService: PipedrivePersonsService;
  private dealsService: PipedriveDealsService;
  private activitiesService: PipedriveActivitiesService;
  private replyDetectionService: EmailReplyDetectionService;
  private sentimentService?: SentimentAnalysisService;

  constructor(workspaceId: string, config?: Partial<PipedriveReplyHandlerConfig>) {
    this.workspaceId = workspaceId;
    this.config = {
      ...DEFAULT_REPLY_HANDLER_CONFIG,
      ...config,
      workspaceId,
    };

    // Initialize services
    this.personsService = new PipedrivePersonsService(workspaceId);
    this.dealsService = new PipedriveDealsService(workspaceId);
    this.activitiesService = new PipedriveActivitiesService(workspaceId);
    this.replyDetectionService = new EmailReplyDetectionService(workspaceId, {
      enableSentimentAnalysis: this.config.sentimentAnalysis.enabled,
      minConfidenceThreshold: this.config.sentimentAnalysis.minConfidenceThreshold,
      minQualificationScore: this.config.qualificationThresholds.minQualificationScore,
    });
  }

  /**
   * Initialize sentiment analysis service if enabled
   */
  private async initializeSentimentService(): Promise<void> {
    if (this.config.sentimentAnalysis.enabled && !this.sentimentService) {
      this.sentimentService = new SentimentAnalysisService({
        provider: this.config.sentimentAnalysis.provider,
        apiKey: process.env.AI_API_KEY!,
        model: this.config.sentimentAnalysis.model,
        temperature: 0.3,
        maxTokens: 500,
      });
    }
  }

  /**
   * Process a single email reply and handle Pipedrive operations
   */
  async processReply(replyData: any): Promise<ReplyHandlerResult> {
    const startTime = Date.now();
    const actions: ReplyHandlerAction[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Check if handler is enabled
      if (!this.config.enabled) {
        return {
          success: false,
          processed: false,
          replyId: replyData.id,
          actions: [],
          errors: ['Reply handler is disabled'],
          warnings: [],
          metadata: {
            processingTime: Date.now() - startTime,
            qualified: false,
            highValue: false,
            urgencyLevel: 'low',
          },
        };
      }

      // Process the reply and get sentiment analysis
      const replyResult = await this.replyDetectionService.processReply(replyData);
      
      if (!replyResult.success) {
        return {
          success: false,
          processed: false,
          replyId: replyData.id,
          actions: [],
          errors: [replyResult.error || 'Failed to process reply'],
          warnings: [],
          metadata: {
            processingTime: Date.now() - startTime,
            qualified: false,
            highValue: false,
            urgencyLevel: 'low',
          },
        };
      }

      const sentiment = replyResult.sentiment;
      if (!sentiment) {
        warnings.push('Sentiment analysis not available');
      }

      // Check if reply qualifies for processing
      const qualified = sentiment ? this.isQualifyingReply(sentiment) : false;
      const highValue = sentiment ? sentiment.qualificationScore >= this.config.qualificationThresholds.highValueThreshold : false;
      const urgencyLevel = this.determineUrgencyLevel(sentiment);

      // Get lead qualification data
      const leadQualificationData = replyResult.leadInfo ? 
        await this.getLeadQualificationData(replyResult.leadInfo.id) : null;

      let personId: number | undefined;
      let dealId: number | undefined;

      // Create or update person if qualified and enabled
      if (qualified && this.config.autoCreatePersons && this.config.creationRules.persons.enabled) {
        const personResult = await this.handlePersonCreation(replyResult, sentiment, leadQualificationData);
        if (personResult) {
          actions.push(personResult.action);
          if (personResult.success) {
            personId = personResult.personId;
          } else {
            errors.push(personResult.error || 'Failed to create/update person');
          }
        }
      }

      // Create deal if conditions are met
      if (qualified && this.config.autoCreateDeals && this.config.creationRules.deals.enabled) {
        const dealConditionsMet = this.checkDealCreationConditions(sentiment, personId);
        if (dealConditionsMet) {
          const dealResult = await this.handleDealCreation(replyResult, sentiment, personId, leadQualificationData);
          if (dealResult) {
            actions.push(dealResult.action);
            if (dealResult.success) {
              dealId = dealResult.dealId;
            } else {
              errors.push(dealResult.error || 'Failed to create deal');
            }
          }
        }
      }

      // Log activities if enabled
      if (this.config.autoLogActivities && this.config.creationRules.activities.enabled) {
        const activityResults = await this.handleActivityCreation(replyResult, sentiment, personId, dealId);
        actions.push(...activityResults.map(r => r.action));
        errors.push(...activityResults.filter(r => !r.success).map(r => r.error || 'Activity creation failed'));
      }

      // Send notifications if configured
      if (this.shouldSendNotification(sentiment, qualified, highValue)) {
        const notificationResult = await this.sendNotifications(replyResult, sentiment, actions);
        if (notificationResult) {
          actions.push(notificationResult.action);
          if (!notificationResult.success) {
            errors.push(notificationResult.error || 'Failed to send notification');
          }
        }
      }

      // Mark reply as processed
      await this.replyDetectionService.markRepliesAsProcessed([replyData.id]);

      return {
        success: errors.length === 0,
        processed: true,
        replyId: replyData.id,
        leadId: replyResult.leadInfo?.id,
        actions,
        sentiment,
        errors,
        warnings,
        metadata: {
          processingTime: Date.now() - startTime,
          qualified,
          highValue,
          urgencyLevel,
        },
      };
    } catch (error) {
      console.error('Error in reply processing:', error);
      return {
        success: false,
        processed: false,
        replyId: replyData.id,
        actions,
        errors: [(error as Error).message],
        warnings,
        metadata: {
          processingTime: Date.now() - startTime,
          qualified: false,
          highValue: false,
          urgencyLevel: 'low',
        },
      };
    }
  }

  /**
   * Handle person creation or update
   */
  private async handlePersonCreation(
    replyResult: ReplyProcessingResult,
    sentiment?: SentimentResult,
    leadQualification?: LeadQualificationData
  ): Promise<{ success: boolean; personId?: number; action: ReplyHandlerAction; error?: string } | null> {
    if (!replyResult.leadInfo) return null;

    const personRules = this.config.creationRules.persons;
    
    // Check if conditions are met
    if (!this.checkPersonCreationConditions(sentiment)) {
      return null;
    }

    try {
      // Check if person already exists
      const existingPersonResult = await this.personsService.searchPersons(replyResult.leadInfo.email, {
        fields: 'email',
        exact: true,
        limit: 1,
      });

      const existingPerson = existingPersonResult.success && existingPersonResult.data?.items?.length > 0 
        ? existingPersonResult.data.items[0].item 
        : null;

      if (existingPerson && personRules.skipExisting) {
        return {
          success: true,
          personId: existingPerson.id,
          action: {
            type: 'person_updated',
            status: 'skipped',
            entityId: existingPerson.id,
            entityType: 'person',
            details: { reason: 'Person already exists and skipExisting is enabled' },
            timestamp: new Date(),
          },
        };
      }

      const personData = this.buildPersonData(replyResult.leadInfo, sentiment, leadQualification);

      if (existingPerson && personRules.updateExisting) {
        // Update existing person
        const updateResult = await this.personsService.updatePerson(existingPerson.id, personData);
        
        if (updateResult.success) {
          return {
            success: true,
            personId: updateResult.data.id,
            action: {
              type: 'person_updated',
              status: 'success',
              entityId: updateResult.data.id,
              entityType: 'person',
              details: { 
                updated_fields: Object.keys(personData),
                sentiment_score: sentiment?.qualificationScore,
                confidence: sentiment?.confidence,
              },
              timestamp: new Date(),
            },
          };
        } else {
          throw new Error('Person update failed');
        }
      } else {
        // Create new person
        const createResult = await this.personsService.createPerson(personData);
        
        if (createResult.success) {
          return {
            success: true,
            personId: createResult.data.id,
            action: {
              type: 'person_created',
              status: 'success',
              entityId: createResult.data.id,
              entityType: 'person',
              details: { 
                created_fields: Object.keys(personData),
                sentiment_score: sentiment?.qualificationScore,
                confidence: sentiment?.confidence,
                enrichment_level: personRules.enrichmentLevel,
              },
              timestamp: new Date(),
            },
          };
        } else {
          throw new Error('Person creation failed');
        }
      }
    } catch (error) {
      return {
        success: false,
        action: {
          type: 'person_created',
          status: 'failed',
          entityType: 'person',
          details: { lead_id: replyResult.leadInfo?.id },
          error: (error as Error).message,
          timestamp: new Date(),
        },
        error: (error as Error).message,
      };
    }
  }

  /**
   * Handle deal creation
   */
  private async handleDealCreation(
    replyResult: ReplyProcessingResult,
    sentiment?: SentimentResult,
    personId?: number,
    leadQualification?: LeadQualificationData
  ): Promise<{ success: boolean; dealId?: number; action: ReplyHandlerAction; error?: string } | null> {
    if (!replyResult.leadInfo) return null;

    try {
      const dealValue = this.calculateDealValue(sentiment, leadQualification);
      const stageId = this.determineStageId(sentiment);

      const dealData = {
        title: `Deal for ${replyResult.leadInfo.name || replyResult.leadInfo.email}`,
        value: dealValue,
        person_id: personId,
        stage_id: stageId,
        custom_fields: {
          sentiment: sentiment?.sentiment,
          intent: sentiment?.intent,
          qualification_score: sentiment?.qualificationScore,
          urgency: sentiment?.urgency,
          reply_id: replyResult.replyId,
          source: 'email_reply',
        },
      };

      const createResult = await this.dealsService.createDeal(dealData);
      
      if (createResult.success) {
        return {
          success: true,
          dealId: createResult.data.id,
          action: {
            type: 'deal_created',
            status: 'success',
            entityId: createResult.data.id,
            entityType: 'deal',
            details: { 
              value: dealValue,
              stage_id: stageId,
              person_id: personId,
              sentiment_score: sentiment?.qualificationScore,
            },
            timestamp: new Date(),
          },
        };
      } else {
        throw new Error('Deal creation failed');
      }
    } catch (error) {
      return {
        success: false,
        action: {
          type: 'deal_created',
          status: 'failed',
          entityType: 'deal',
          details: { 
            lead_id: replyResult.leadInfo?.id,
            person_id: personId,
          },
          error: (error as Error).message,
          timestamp: new Date(),
        },
        error: (error as Error).message,
      };
    }
  }

  /**
   * Handle activity creation
   */
  private async handleActivityCreation(
    replyResult: ReplyProcessingResult,
    sentiment?: SentimentResult,
    personId?: number,
    dealId?: number
  ): Promise<Array<{ success: boolean; activityId?: number; action: ReplyHandlerAction; error?: string }>> {
    const results: Array<{ success: boolean; activityId?: number; action: ReplyHandlerAction; error?: string }> = [];
    const activityRules = this.config.creationRules.activities;

    // Create email reply activity
    if (activityRules.types.emailReply.enabled) {
      try {
        const activityData = {
          subject: activityRules.types.emailReply.template.replace('{{subject}}', replyResult.originalEmail?.subject || 'Email Reply'),
          type: activityRules.types.emailReply.activityType,
          person_id: personId,
          deal_id: dealId,
          done: true,
          note: this.buildActivityNote(replyResult, sentiment),
        };

        const createResult = await this.activitiesService.createActivity(activityData);
        
        if (createResult.success) {
          results.push({
            success: true,
            activityId: createResult.data.id,
            action: {
              type: 'activity_created',
              status: 'success',
              entityId: createResult.data.id,
              entityType: 'activity',
              details: { 
                type: 'email_reply',
                person_id: personId,
                deal_id: dealId,
              },
              timestamp: new Date(),
            },
          });
        }
      } catch (error) {
        results.push({
          success: false,
          action: {
            type: 'activity_created',
            status: 'failed',
            entityType: 'activity',
            details: { type: 'email_reply' },
            error: (error as Error).message,
            timestamp: new Date(),
          },
          error: (error as Error).message,
        });
      }
    }

    // Create follow-up activity if conditions are met
    if (activityRules.types.followUp.enabled && this.shouldCreateFollowUpActivity(sentiment)) {
      // Implement follow-up activity creation
      // This would create a task for future follow-up
    }

    // Create meeting activity if meeting was requested
    if (activityRules.types.meeting.enabled && sentiment?.intent === 'meeting_request') {
      // Implement meeting activity creation
      // This would create a meeting activity in Pipedrive
    }

    return results;
  }

  /**
   * Check if reply qualifies for processing
   */
  private isQualifyingReply(sentiment: SentimentResult): boolean {
    return this.replyDetectionService.isQualifyingReply(sentiment);
  }

  /**
   * Check person creation conditions
   */
  private checkPersonCreationConditions(sentiment?: SentimentResult): boolean {
    if (!sentiment) return false;

    const rules = this.config.creationRules.persons;
    
    return (
      rules.conditions.sentiments.includes(sentiment.sentiment) &&
      rules.conditions.intents.includes(sentiment.intent) &&
      sentiment.confidence >= rules.conditions.minConfidence &&
      sentiment.qualificationScore >= rules.conditions.minQualificationScore
    );
  }

  /**
   * Check deal creation conditions
   */
  private checkDealCreationConditions(sentiment?: SentimentResult, personId?: number): boolean {
    if (!sentiment) return false;

    const rules = this.config.creationRules.deals;
    
    if (rules.conditions.requireExistingPerson && !personId) {
      return false;
    }

    return (
      rules.conditions.sentiments.includes(sentiment.sentiment) &&
      rules.conditions.intents.includes(sentiment.intent) &&
      sentiment.confidence >= rules.conditions.minConfidence &&
      sentiment.qualificationScore >= rules.conditions.minQualificationScore
    );
  }

  /**
   * Determine urgency level based on sentiment
   */
  private determineUrgencyLevel(sentiment?: SentimentResult): 'low' | 'medium' | 'high' {
    if (!sentiment) return 'low';

    const thresholds = this.config.qualificationThresholds.urgencyLevels;
    
    if (sentiment.qualificationScore >= thresholds.high.minScore) {
      return 'high';
    } else if (sentiment.qualificationScore >= thresholds.medium.minScore) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * Calculate deal value based on sentiment and lead data
   */
  private calculateDealValue(sentiment?: SentimentResult, leadQualification?: LeadQualificationData): number {
    const rules = this.config.creationRules.deals.valueCalculation;
    let value = rules.baseValue;

    if (!sentiment) return value;

    // Apply score-based multiplier
    if (rules.method === 'score_based' || rules.method === 'custom') {
      const scoreMultiplier = rules.multipliers.scoreRange.find(
        range => sentiment.qualificationScore >= range.min && sentiment.qualificationScore <= range.max
      );
      if (scoreMultiplier) {
        value *= scoreMultiplier.multiplier;
      }
    }

    // Apply urgency multiplier
    const urgencyMultiplier = rules.multipliers.urgency[sentiment.urgency];
    if (urgencyMultiplier) {
      value *= urgencyMultiplier;
    }

    // Apply intent multiplier
    const intentMultiplier = rules.multipliers.intent[sentiment.intent];
    if (intentMultiplier) {
      value *= intentMultiplier;
    }

    // Apply company size multiplier if available
    if (rules.method === 'company_size' && leadQualification?.companyData) {
      const sizeMultipliers = {
        startup: 0.5,
        small: 0.8,
        medium: 1.2,
        large: 1.8,
        enterprise: 2.5,
      };
      value *= sizeMultipliers[leadQualification.companyData.size] || 1.0;
    }

    return Math.round(value);
  }

  /**
   * Determine stage ID based on sentiment and configuration
   */
  private determineStageId(sentiment?: SentimentResult): number | undefined {
    if (!sentiment) return this.config.integrationSettings.defaultStageId;

    const rules = this.config.creationRules.deals.stageAssignment;
    
    if (rules.method === 'intent_based') {
      const stageId = rules.mappings.intent[sentiment.intent];
      if (stageId) return stageId;
    }

    if (rules.method === 'score_based') {
      const stageMapping = rules.mappings.scoreRange.find(
        range => sentiment.qualificationScore >= range.min && sentiment.qualificationScore <= range.max
      );
      if (stageMapping) return stageMapping.stageId;
    }

    return rules.defaultStageId || this.config.integrationSettings.defaultStageId;
  }

  /**
   * Build person data from lead info and sentiment
   */
  private buildPersonData(leadInfo: any, sentiment?: SentimentResult, leadQualification?: LeadQualificationData): any {
    const personData: any = {
      name: leadInfo.name || leadInfo.email,
      email: [leadInfo.email],
    };

    if (leadInfo.company) {
      personData.org_name = leadInfo.company;
    }

    // Add custom fields based on sentiment analysis
    if (sentiment) {
      personData.custom_fields = {
        ...this.config.integrationSettings.customFieldMappings,
        sentiment: sentiment.sentiment,
        intent: sentiment.intent,
        qualification_score: sentiment.qualificationScore,
        confidence: sentiment.confidence,
        urgency: sentiment.urgency,
        key_phrases: sentiment.keyPhrases.join(', '),
        source: 'email_reply',
        processed_at: new Date().toISOString(),
      };
    }

    return personData;
  }

  /**
   * Build activity note from reply result and sentiment
   */
  private buildActivityNote(replyResult: ReplyProcessingResult, sentiment?: SentimentResult): string {
    let note = `Email reply received from ${replyResult.originalEmail?.subject || 'unknown'}\n\n`;
    
    if (sentiment) {
      note += `Sentiment Analysis:\n`;
      note += `- Sentiment: ${sentiment.sentiment} (${Math.round(sentiment.confidence * 100)}% confidence)\n`;
      note += `- Intent: ${sentiment.intent}\n`;
      note += `- Qualification Score: ${sentiment.qualificationScore}/100\n`;
      note += `- Urgency: ${sentiment.urgency}\n`;
      
      if (sentiment.keyPhrases.length > 0) {
        note += `- Key Phrases: ${sentiment.keyPhrases.join(', ')}\n`;
      }
      
      note += `\nReasoning: ${sentiment.reasoning}\n`;
    }

    return note;
  }

  /**
   * Check if follow-up activity should be created
   */
  private shouldCreateFollowUpActivity(sentiment?: SentimentResult): boolean {
    if (!sentiment) return false;

    const rules = this.config.creationRules.activities.types.followUp;
    
    return (
      rules.conditions.sentiments.includes(sentiment.sentiment) &&
      rules.conditions.intents.includes(sentiment.intent) &&
      sentiment.qualificationScore >= rules.conditions.minScore
    );
  }

  /**
   * Check if notification should be sent
   */
  private shouldSendNotification(sentiment?: SentimentResult, qualified?: boolean, highValue?: boolean): boolean {
    // Implementation depends on notification configuration
    return qualified || highValue || (sentiment?.urgency === 'high');
  }

  /**
   * Send notifications for processed reply
   */
  private async sendNotifications(
    replyResult: ReplyProcessingResult,
    sentiment?: SentimentResult,
    actions?: ReplyHandlerAction[]
  ): Promise<{ success: boolean; action: ReplyHandlerAction; error?: string } | null> {
    // Implementation for sending notifications (email, Slack, webhook, etc.)
    // This would integrate with your notification system
    return null;
  }

  /**
   * Get lead qualification data
   */
  private async getLeadQualificationData(leadId: string): Promise<LeadQualificationData | null> {
    const supabase = createServerClient(cookies());
    
    const { data: lead } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .eq('workspace_id', this.workspaceId)
      .single();

    if (!lead) return null;

    // Build qualification data
    return {
      basicInfo: {
        hasName: !!(lead.first_name || lead.last_name),
        hasCompany: !!lead.company,
        hasTitle: !!lead.title,
        hasPhone: !!lead.phone,
        emailDomain: lead.email.split('@')[1] || '',
        isValidBusinessEmail: this.isValidBusinessEmail(lead.email),
      },
      engagementHistory: {
        totalEmails: 0, // Would need to query email history
        opened: 0,
        clicked: 0,
        replied: 1, // At least one reply since we're processing it
        lastActivity: new Date(),
        engagementScore: lead.engagement_score || 0,
      },
      companyData: lead.enrichment_data?.company,
      enrichmentData: lead.enrichment_data ? {
        source: lead.enrichment_data.source || 'unknown',
        confidence: lead.enrichment_data.confidence || 0,
        lastUpdated: new Date(lead.enrichment_data.updated_at || lead.updated_at),
        verified: lead.enrichment_data.verified || false,
        additionalFields: lead.enrichment_data,
      } : undefined,
    };
  }

  /**
   * Check if email is a valid business email
   */
  private isValidBusinessEmail(email: string): boolean {
    const domain = email.split('@')[1]?.toLowerCase();
    const personalDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com'];
    return domain ? !personalDomains.includes(domain) : false;
  }

  /**
   * Process multiple replies in batch
   */
  async batchProcessReplies(limit: number = 50): Promise<BatchProcessingResult> {
    const startTime = Date.now();
    const unprocessedReplies = await this.replyDetectionService.getUnprocessedReplies(limit);
    
    const results: ReplyHandlerResult[] = [];
    const errors: Array<{ replyId: string; error: string; timestamp: Date }> = [];
    
    let successful = 0;
    let failed = 0;
    let skipped = 0;

    // Counters for summary
    let personsCreated = 0;
    let personsUpdated = 0;
    let dealsCreated = 0;
    let dealsUpdated = 0;
    let activitiesCreated = 0;
    let notificationsSent = 0;

    for (const reply of unprocessedReplies) {
      try {
        const result = await this.processReply(reply);
        results.push(result);

        if (result.success) {
          successful++;
          
          // Count actions
          for (const action of result.actions) {
            if (action.status === 'success') {
              switch (action.type) {
                case 'person_created':
                  personsCreated++;
                  break;
                case 'person_updated':
                  personsUpdated++;
                  break;
                case 'deal_created':
                  dealsCreated++;
                  break;
                case 'deal_updated':
                  dealsUpdated++;
                  break;
                case 'activity_created':
                  activitiesCreated++;
                  break;
                case 'notification_sent':
                  notificationsSent++;
                  break;
              }
            }
          }
        } else if (result.processed) {
          failed++;
          errors.push({
            replyId: reply.id,
            error: result.errors.join(', '),
            timestamp: new Date(),
          });
        } else {
          skipped++;
        }

        // Add delay between replies to avoid rate limits
        if (unprocessedReplies.length > 1) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      } catch (error) {
        failed++;
        errors.push({
          replyId: reply.id,
          error: (error as Error).message,
          timestamp: new Date(),
        });
      }
    }

    return {
      totalProcessed: unprocessedReplies.length,
      successful,
      failed,
      skipped,
      results,
      summary: {
        personsCreated,
        personsUpdated,
        dealsCreated,
        dealsUpdated,
        activitiesCreated,
        notificationsSent,
        processingTimeMs: Date.now() - startTime,
      },
      errors,
    };
  }

  /**
   * Update configuration
   */
  async updateConfig(newConfig: Partial<PipedriveReplyHandlerConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };
    
    // Save to database
    const supabase = createServerClient(cookies());
    await supabase
      .from('pipedrive_reply_handler_settings')
      .upsert({
        workspace_id: this.workspaceId,
        config: this.config,
        last_updated: new Date().toISOString(),
        version: (this.config as any).version ? (this.config as any).version + 1 : 1,
      });

    // Update services with new configuration
    this.replyDetectionService = new EmailReplyDetectionService(this.workspaceId, {
      enableSentimentAnalysis: this.config.sentimentAnalysis.enabled,
      minConfidenceThreshold: this.config.sentimentAnalysis.minConfidenceThreshold,
      minQualificationScore: this.config.qualificationThresholds.minQualificationScore,
    });
  }

  /**
   * Get current configuration
   */
  getConfig(): PipedriveReplyHandlerConfig {
    return { ...this.config };
  }

  /**
   * Test the reply handler with sample data
   */
  async testReplyHandler(): Promise<{ success: boolean; error?: string; testResults: any }> {
    try {
      // Test sentiment analysis
      if (this.config.sentimentAnalysis.enabled) {
        await this.initializeSentimentService();
        const testConnection = await this.sentimentService?.testConnection();
        if (!testConnection) {
          return {
            success: false,
            error: 'Sentiment analysis service test failed',
            testResults: { sentimentTest: false },
          };
        }
      }

      // Test Pipedrive connections
      const personsTest = await this.personsService.getPersons({ limit: 1 });
      const dealsTest = await this.dealsService.getDeals({ limit: 1 });
      const activitiesTest = await this.activitiesService.getActivities({ limit: 1 });

      return {
        success: true,
        testResults: {
          sentimentTest: this.config.sentimentAnalysis.enabled,
          personsTest: personsTest.success,
          dealsTest: dealsTest.success,
          activitiesTest: activitiesTest.success,
          configValid: this.validateConfig().isValid,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        testResults: {},
      };
    }
  }

  /**
   * Validate current configuration
   */
  private validateConfig(): { isValid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required fields
    if (!this.config.workspaceId) {
      errors.push('Workspace ID is required');
    }

    // Check sentiment analysis configuration
    if (this.config.sentimentAnalysis.enabled) {
      if (!process.env.AI_API_KEY) {
        errors.push('AI API key is required for sentiment analysis');
      }
      if (this.config.sentimentAnalysis.minConfidenceThreshold < 0 || this.config.sentimentAnalysis.minConfidenceThreshold > 1) {
        errors.push('Confidence threshold must be between 0 and 1');
      }
    }

    // Check qualification thresholds
    if (this.config.qualificationThresholds.minQualificationScore < 0 || this.config.qualificationThresholds.minQualificationScore > 100) {
      errors.push('Qualification score must be between 0 and 100');
    }

    // Check creation rules
    if (this.config.creationRules.deals.enabled && !this.config.autoCreateDeals) {
      warnings.push('Deal creation rules are enabled but autoCreateDeals is false');
    }

    if (this.config.creationRules.persons.enabled && !this.config.autoCreatePersons) {
      warnings.push('Person creation rules are enabled but autoCreatePersons is false');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }
}