import { PipedriveClient } from './client';
import {
  PipedrivePerson,
  PipedriveOrganization,
  PipedriveDeal,
  PipedriveActivity,
  PipedriveApiResponse,
  PipedriveRateLimitError,
  PipedriveTokenBudgetError,
  PipedriveSyncError,
  PipedriveValidationError,
} from './types';

export interface BulkSyncOptions {
  workspaceId: string;
  batchSize?: number;
  maxConcurrency?: number;
  retryAttempts?: number;
  retryDelay?: number;
  validateData?: boolean;
  detectDuplicates?: boolean;
  dryRun?: boolean;
  continueOnError?: boolean;
  progressCallback?: (progress: BulkSyncProgress) => void;
}

export interface BulkSyncProgress {
  phase: 'preparing' | 'validating' | 'syncing' | 'completed' | 'failed';
  entityType: 'person' | 'organization' | 'deal' | 'activity';
  total: number;
  processed: number;
  successful: number;
  failed: number;
  skipped: number;
  duplicates: number;
  errors: BulkSyncError[];
  estimatedTimeRemaining?: number;
  currentBatch?: number;
  totalBatches?: number;
}

export interface BulkSyncError {
  index: number;
  entityId?: string;
  error: string;
  code?: string;
  data?: any;
}

export interface BulkSyncResult {
  success: boolean;
  summary: {
    total: number;
    successful: number;
    failed: number;
    skipped: number;
    duplicates: number;
    duration: number;
  };
  errors: BulkSyncError[];
  entities: {
    persons: SyncedEntity[];
    organizations: SyncedEntity[];
    deals: SyncedEntity[];
    activities: SyncedEntity[];
  };
}

export interface SyncedEntity {
  localId: string;
  pipedriveId: number;
  status: 'created' | 'updated' | 'skipped' | 'failed';
  error?: string;
}

export interface DuplicateStrategy {
  field: string;
  action: 'skip' | 'update' | 'merge' | 'create_new';
}

export interface DataTransformer<T> {
  transform(data: any): T;
  validate(data: T): boolean;
  sanitize(data: T): T;
}

export interface BulkSyncState {
  syncId: string;
  workspaceId: string;
  startTime: Date;
  lastCheckpoint?: Date;
  phase: BulkSyncProgress['phase'];
  progress: {
    persons: BulkSyncProgress;
    organizations: BulkSyncProgress;
    deals: BulkSyncProgress;
    activities: BulkSyncProgress;
  };
  checkpoint: {
    lastProcessedIndex: {
      persons: number;
      organizations: number;
      deals: number;
      activities: number;
    };
    processedIds: Set<string>;
  };
}

export class BulkSyncService {
  private client: PipedriveClient;
  private state: BulkSyncState | null = null;
  private abortController: AbortController | null = null;
  private rateLimitBackoff = 0;

  constructor(client: PipedriveClient) {
    this.client = client;
  }

  /**
   * Start a bulk sync operation
   */
  async startBulkSync(
    data: {
      persons?: any[];
      organizations?: any[];
      deals?: any[];
      activities?: any[];
    },
    options: BulkSyncOptions
  ): Promise<BulkSyncResult> {
    const startTime = Date.now();
    this.abortController = new AbortController();
    
    // Initialize state
    this.state = this.initializeState(options.workspaceId, data);
    
    const result: BulkSyncResult = {
      success: true,
      summary: {
        total: 0,
        successful: 0,
        failed: 0,
        skipped: 0,
        duplicates: 0,
        duration: 0,
      },
      errors: [],
      entities: {
        persons: [],
        organizations: [],
        deals: [],
        activities: [],
      },
    };

    try {
      // Phase 1: Prepare and validate data
      if (options.validateData) {
        await this.validateData(data, options);
      }

      // Phase 2: Detect duplicates if enabled
      if (options.detectDuplicates) {
        await this.detectDuplicates(data, options);
      }

      // Phase 3: Sync organizations first (as they are referenced by persons and deals)
      if (data.organizations?.length) {
        const orgResult = await this.syncOrganizations(data.organizations, options);
        result.entities.organizations = orgResult.entities;
        this.updateResultSummary(result, orgResult);
      }

      // Phase 4: Sync persons (may reference organizations)
      if (data.persons?.length) {
        const personResult = await this.syncPersons(data.persons, options);
        result.entities.persons = personResult.entities;
        this.updateResultSummary(result, personResult);
      }

      // Phase 5: Sync deals (reference persons and organizations)
      if (data.deals?.length) {
        const dealResult = await this.syncDeals(data.deals, options);
        result.entities.deals = dealResult.entities;
        this.updateResultSummary(result, dealResult);
      }

      // Phase 6: Sync activities (reference persons, organizations, and deals)
      if (data.activities?.length) {
        const activityResult = await this.syncActivities(data.activities, options);
        result.entities.activities = activityResult.entities;
        this.updateResultSummary(result, activityResult);
      }

      result.summary.duration = Date.now() - startTime;
      return result;

    } catch (error) {
      result.success = false;
      result.summary.duration = Date.now() - startTime;
      
      if (error instanceof Error) {
        result.errors.push({
          index: -1,
          error: error.message,
          code: error.name,
        });
      }
      
      throw error;
    } finally {
      this.cleanup();
    }
  }

  /**
   * Resume a previously interrupted sync
   */
  async resumeSync(
    syncId: string,
    data: {
      persons?: any[];
      organizations?: any[];
      deals?: any[];
      activities?: any[];
    },
    options: BulkSyncOptions
  ): Promise<BulkSyncResult> {
    // Load saved state from storage
    const savedState = await this.loadSyncState(syncId);
    if (!savedState) {
      throw new Error(`No saved sync state found for ID: ${syncId}`);
    }

    this.state = savedState;
    this.abortController = new AbortController();

    // Continue from last checkpoint
    return this.startBulkSync(data, options);
  }

  /**
   * Cancel an ongoing sync operation
   */
  cancelSync(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  /**
   * Get current sync progress
   */
  getProgress(): BulkSyncState | null {
    return this.state;
  }

  private async syncOrganizations(
    organizations: any[],
    options: BulkSyncOptions
  ): Promise<{
    entities: SyncedEntity[];
    summary: Pick<BulkSyncResult['summary'], 'successful' | 'failed' | 'skipped' | 'duplicates'>;
  }> {
    const entities: SyncedEntity[] = [];
    const summary = { successful: 0, failed: 0, skipped: 0, duplicates: 0 };
    
    const transformer = new OrganizationTransformer();
    const batches = this.createBatches(organizations, options.batchSize || 50);
    
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      if (this.abortController?.signal.aborted) {
        break;
      }

      const batch = batches[batchIndex];
      const batchResults = await this.processBatch(
        batch,
        async (item) => {
          try {
            // Transform and validate
            const transformed = transformer.transform(item);
            if (!transformer.validate(transformed)) {
              throw new PipedriveValidationError('Invalid organization data');
            }

            // Check for duplicates
            if (options.detectDuplicates) {
              const duplicate = await this.findDuplicateOrganization(transformed, options);
              if (duplicate) {
                summary.duplicates++;
                if (options.dryRun) {
                  return { localId: item.id, pipedriveId: duplicate.id, status: 'skipped' as const };
                }
                // Handle based on duplicate strategy
                return this.handleDuplicateOrganization(item, duplicate, options);
              }
            }

            // Create organization
            if (!options.dryRun) {
              const response = await this.client.post<PipedriveOrganization>(
                '/organizations',
                transformer.sanitize(transformed),
                { workspaceId: options.workspaceId }
              );
              
              summary.successful++;
              return {
                localId: item.id,
                pipedriveId: response.data.id,
                status: 'created' as const,
              };
            } else {
              summary.successful++;
              return {
                localId: item.id,
                pipedriveId: -1,
                status: 'skipped' as const,
              };
            }
          } catch (error) {
            summary.failed++;
            if (!options.continueOnError) {
              throw error;
            }
            return {
              localId: item.id,
              pipedriveId: -1,
              status: 'failed' as const,
              error: error instanceof Error ? error.message : 'Unknown error',
            };
          }
        },
        options
      );

      entities.push(...batchResults);
      
      // Update progress
      if (options.progressCallback && this.state) {
        this.state.progress.organizations.processed = (batchIndex + 1) * batch.length;
        this.state.progress.organizations.successful = summary.successful;
        this.state.progress.organizations.failed = summary.failed;
        this.state.progress.organizations.duplicates = summary.duplicates;
        this.state.progress.organizations.currentBatch = batchIndex + 1;
        options.progressCallback(this.state.progress.organizations);
      }
    }

    return { entities, summary };
  }

  private async syncPersons(
    persons: any[],
    options: BulkSyncOptions
  ): Promise<{
    entities: SyncedEntity[];
    summary: Pick<BulkSyncResult['summary'], 'successful' | 'failed' | 'skipped' | 'duplicates'>;
  }> {
    const entities: SyncedEntity[] = [];
    const summary = { successful: 0, failed: 0, skipped: 0, duplicates: 0 };
    
    const transformer = new PersonTransformer();
    const batches = this.createBatches(persons, options.batchSize || 50);
    
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      if (this.abortController?.signal.aborted) {
        break;
      }

      const batch = batches[batchIndex];
      const batchResults = await this.processBatch(
        batch,
        async (item) => {
          try {
            // Transform and validate
            const transformed = transformer.transform(item);
            if (!transformer.validate(transformed)) {
              throw new PipedriveValidationError('Invalid person data');
            }

            // Check for duplicates
            if (options.detectDuplicates) {
              const duplicate = await this.findDuplicatePerson(transformed, options);
              if (duplicate) {
                summary.duplicates++;
                if (options.dryRun) {
                  return { localId: item.id, pipedriveId: duplicate.id, status: 'skipped' as const };
                }
                // Handle based on duplicate strategy
                return this.handleDuplicatePerson(item, duplicate, options);
              }
            }

            // Create person
            if (!options.dryRun) {
              const response = await this.client.post<PipedrivePerson>(
                '/persons',
                transformer.sanitize(transformed),
                { workspaceId: options.workspaceId }
              );
              
              summary.successful++;
              return {
                localId: item.id,
                pipedriveId: response.data.id,
                status: 'created' as const,
              };
            } else {
              summary.successful++;
              return {
                localId: item.id,
                pipedriveId: -1,
                status: 'skipped' as const,
              };
            }
          } catch (error) {
            summary.failed++;
            if (!options.continueOnError) {
              throw error;
            }
            return {
              localId: item.id,
              pipedriveId: -1,
              status: 'failed' as const,
              error: error instanceof Error ? error.message : 'Unknown error',
            };
          }
        },
        options
      );

      entities.push(...batchResults);
      
      // Update progress
      if (options.progressCallback && this.state) {
        this.state.progress.persons.processed = (batchIndex + 1) * batch.length;
        this.state.progress.persons.successful = summary.successful;
        this.state.progress.persons.failed = summary.failed;
        this.state.progress.persons.duplicates = summary.duplicates;
        this.state.progress.persons.currentBatch = batchIndex + 1;
        options.progressCallback(this.state.progress.persons);
      }
    }

    return { entities, summary };
  }

  private async syncDeals(
    deals: any[],
    options: BulkSyncOptions
  ): Promise<{
    entities: SyncedEntity[];
    summary: Pick<BulkSyncResult['summary'], 'successful' | 'failed' | 'skipped' | 'duplicates'>;
  }> {
    const entities: SyncedEntity[] = [];
    const summary = { successful: 0, failed: 0, skipped: 0, duplicates: 0 };
    
    const transformer = new DealTransformer();
    const batches = this.createBatches(deals, options.batchSize || 30);
    
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      if (this.abortController?.signal.aborted) {
        break;
      }

      const batch = batches[batchIndex];
      const batchResults = await this.processBatch(
        batch,
        async (item) => {
          try {
            // Transform and validate
            const transformed = transformer.transform(item);
            if (!transformer.validate(transformed)) {
              throw new PipedriveValidationError('Invalid deal data');
            }

            // Check for duplicates
            if (options.detectDuplicates) {
              const duplicate = await this.findDuplicateDeal(transformed, options);
              if (duplicate) {
                summary.duplicates++;
                if (options.dryRun) {
                  return { localId: item.id, pipedriveId: duplicate.id, status: 'skipped' as const };
                }
                // Handle based on duplicate strategy
                return this.handleDuplicateDeal(item, duplicate, options);
              }
            }

            // Create deal
            if (!options.dryRun) {
              const response = await this.client.post<PipedriveDeal>(
                '/deals',
                transformer.sanitize(transformed),
                { workspaceId: options.workspaceId }
              );
              
              summary.successful++;
              return {
                localId: item.id,
                pipedriveId: response.data.id,
                status: 'created' as const,
              };
            } else {
              summary.successful++;
              return {
                localId: item.id,
                pipedriveId: -1,
                status: 'skipped' as const,
              };
            }
          } catch (error) {
            summary.failed++;
            if (!options.continueOnError) {
              throw error;
            }
            return {
              localId: item.id,
              pipedriveId: -1,
              status: 'failed' as const,
              error: error instanceof Error ? error.message : 'Unknown error',
            };
          }
        },
        options
      );

      entities.push(...batchResults);
      
      // Update progress
      if (options.progressCallback && this.state) {
        this.state.progress.deals.processed = (batchIndex + 1) * batch.length;
        this.state.progress.deals.successful = summary.successful;
        this.state.progress.deals.failed = summary.failed;
        this.state.progress.deals.duplicates = summary.duplicates;
        this.state.progress.deals.currentBatch = batchIndex + 1;
        options.progressCallback(this.state.progress.deals);
      }
    }

    return { entities, summary };
  }

  private async syncActivities(
    activities: any[],
    options: BulkSyncOptions
  ): Promise<{
    entities: SyncedEntity[];
    summary: Pick<BulkSyncResult['summary'], 'successful' | 'failed' | 'skipped' | 'duplicates'>;
  }> {
    const entities: SyncedEntity[] = [];
    const summary = { successful: 0, failed: 0, skipped: 0, duplicates: 0 };
    
    const transformer = new ActivityTransformer();
    const batches = this.createBatches(activities, options.batchSize || 50);
    
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      if (this.abortController?.signal.aborted) {
        break;
      }

      const batch = batches[batchIndex];
      const batchResults = await this.processBatch(
        batch,
        async (item) => {
          try {
            // Transform and validate
            const transformed = transformer.transform(item);
            if (!transformer.validate(transformed)) {
              throw new PipedriveValidationError('Invalid activity data');
            }

            // Create activity (activities usually don't have duplicates)
            if (!options.dryRun) {
              const response = await this.client.post<PipedriveActivity>(
                '/activities',
                transformer.sanitize(transformed),
                { workspaceId: options.workspaceId }
              );
              
              summary.successful++;
              return {
                localId: item.id,
                pipedriveId: response.data.id,
                status: 'created' as const,
              };
            } else {
              summary.successful++;
              return {
                localId: item.id,
                pipedriveId: -1,
                status: 'skipped' as const,
              };
            }
          } catch (error) {
            summary.failed++;
            if (!options.continueOnError) {
              throw error;
            }
            return {
              localId: item.id,
              pipedriveId: -1,
              status: 'failed' as const,
              error: error instanceof Error ? error.message : 'Unknown error',
            };
          }
        },
        options
      );

      entities.push(...batchResults);
      
      // Update progress
      if (options.progressCallback && this.state) {
        this.state.progress.activities.processed = (batchIndex + 1) * batch.length;
        this.state.progress.activities.successful = summary.successful;
        this.state.progress.activities.failed = summary.failed;
        this.state.progress.activities.duplicates = summary.duplicates;
        this.state.progress.activities.currentBatch = batchIndex + 1;
        options.progressCallback(this.state.progress.activities);
      }
    }

    return { entities, summary };
  }

  private async processBatch<T>(
    batch: any[],
    processor: (item: any) => Promise<SyncedEntity>,
    options: BulkSyncOptions
  ): Promise<SyncedEntity[]> {
    const maxConcurrency = options.maxConcurrency || 5;
    const results: SyncedEntity[] = [];
    
    // Process items in chunks with concurrency control
    for (let i = 0; i < batch.length; i += maxConcurrency) {
      const chunk = batch.slice(i, i + maxConcurrency);
      const promises = chunk.map(item => this.processWithRetry(item, processor, options));
      
      const chunkResults = await Promise.allSettled(promises);
      
      for (const result of chunkResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          // Error already handled in processor
          results.push({
            localId: 'unknown',
            pipedriveId: -1,
            status: 'failed',
            error: result.reason?.message || 'Unknown error',
          });
        }
      }
      
      // Add delay between chunks to respect rate limits
      if (i + maxConcurrency < batch.length) {
        await this.delay(this.rateLimitBackoff || 100);
      }
    }
    
    return results;
  }

  private async processWithRetry<T>(
    item: any,
    processor: (item: any) => Promise<T>,
    options: BulkSyncOptions
  ): Promise<T> {
    const maxRetries = options.retryAttempts || 3;
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await processor(item);
      } catch (error) {
        lastError = error as Error;
        
        if (error instanceof PipedriveRateLimitError) {
          this.rateLimitBackoff = error.retryAfter * 1000;
          await this.delay(this.rateLimitBackoff);
          continue;
        }
        
        if (error instanceof PipedriveTokenBudgetError) {
          // Can't retry token budget errors
          throw error;
        }
        
        if (attempt < maxRetries - 1) {
          const delay = (options.retryDelay || 1000) * Math.pow(2, attempt);
          await this.delay(delay);
        }
      }
    }
    
    throw lastError || new Error('Process failed after retries');
  }

  private async findDuplicateOrganization(
    org: Partial<PipedriveOrganization>,
    options: BulkSyncOptions
  ): Promise<PipedriveOrganization | null> {
    try {
      const searchResponse = await this.client.search<PipedriveOrganization>(
        {
          term: org.name || '',
          fields: 'name',
          exact: true,
          limit: 1,
        },
        { workspaceId: options.workspaceId }
      );
      
      if (searchResponse.data?.items?.length > 0) {
        return searchResponse.data.items[0].item;
      }
    } catch (error) {
      // Search failed, assume no duplicate
    }
    
    return null;
  }

  private async findDuplicatePerson(
    person: Partial<PipedrivePerson>,
    options: BulkSyncOptions
  ): Promise<PipedrivePerson | null> {
    try {
      // Search by email first
      if (person.email?.length) {
        const searchResponse = await this.client.search<PipedrivePerson>(
          {
            term: person.email[0],
            fields: 'email',
            exact: true,
            limit: 1,
          },
          { workspaceId: options.workspaceId }
        );
        
        if (searchResponse.data?.items?.length > 0) {
          return searchResponse.data.items[0].item;
        }
      }
      
      // Search by name if no email match
      if (person.name) {
        const searchResponse = await this.client.search<PipedrivePerson>(
          {
            term: person.name,
            fields: 'name',
            exact: true,
            limit: 1,
          },
          { workspaceId: options.workspaceId }
        );
        
        if (searchResponse.data?.items?.length > 0) {
          return searchResponse.data.items[0].item;
        }
      }
    } catch (error) {
      // Search failed, assume no duplicate
    }
    
    return null;
  }

  private async findDuplicateDeal(
    deal: Partial<PipedriveDeal>,
    options: BulkSyncOptions
  ): Promise<PipedriveDeal | null> {
    try {
      const searchResponse = await this.client.search<PipedriveDeal>(
        {
          term: deal.title || '',
          fields: 'title',
          exact: true,
          limit: 1,
        },
        { workspaceId: options.workspaceId }
      );
      
      if (searchResponse.data?.items?.length > 0) {
        const existingDeal = searchResponse.data.items[0].item;
        // Check if it's for the same person/org
        if (deal.person_id === existingDeal.person_id && 
            deal.org_id === existingDeal.org_id) {
          return existingDeal;
        }
      }
    } catch (error) {
      // Search failed, assume no duplicate
    }
    
    return null;
  }

  private async handleDuplicateOrganization(
    item: any,
    duplicate: PipedriveOrganization,
    options: BulkSyncOptions
  ): Promise<SyncedEntity> {
    // Default strategy: skip duplicates
    return {
      localId: item.id,
      pipedriveId: duplicate.id,
      status: 'skipped',
    };
  }

  private async handleDuplicatePerson(
    item: any,
    duplicate: PipedrivePerson,
    options: BulkSyncOptions
  ): Promise<SyncedEntity> {
    // Default strategy: skip duplicates
    return {
      localId: item.id,
      pipedriveId: duplicate.id,
      status: 'skipped',
    };
  }

  private async handleDuplicateDeal(
    item: any,
    duplicate: PipedriveDeal,
    options: BulkSyncOptions
  ): Promise<SyncedEntity> {
    // Default strategy: skip duplicates
    return {
      localId: item.id,
      pipedriveId: duplicate.id,
      status: 'skipped',
    };
  }

  private async validateData(
    data: {
      persons?: any[];
      organizations?: any[];
      deals?: any[];
      activities?: any[];
    },
    options: BulkSyncOptions
  ): Promise<void> {
    const errors: BulkSyncError[] = [];
    
    // Validate organizations
    if (data.organizations) {
      const transformer = new OrganizationTransformer();
      data.organizations.forEach((org, index) => {
        try {
          const transformed = transformer.transform(org);
          if (!transformer.validate(transformed)) {
            errors.push({
              index,
              entityId: org.id,
              error: 'Invalid organization data',
            });
          }
        } catch (error) {
          errors.push({
            index,
            entityId: org.id,
            error: error instanceof Error ? error.message : 'Validation error',
          });
        }
      });
    }
    
    // Similar validation for other entity types...
    
    if (errors.length > 0) {
      throw new PipedriveValidationError('Data validation failed', errors);
    }
  }

  private async detectDuplicates(
    data: {
      persons?: any[];
      organizations?: any[];
      deals?: any[];
      activities?: any[];
    },
    options: BulkSyncOptions
  ): Promise<void> {
    // Implement duplicate detection logic
    // This is a placeholder - actual implementation would check for duplicates
  }

  private initializeState(
    workspaceId: string,
    data: {
      persons?: any[];
      organizations?: any[];
      deals?: any[];
      activities?: any[];
    }
  ): BulkSyncState {
    const syncId = `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      syncId,
      workspaceId,
      startTime: new Date(),
      phase: 'preparing',
      progress: {
        persons: this.createProgressObject('person', data.persons?.length || 0),
        organizations: this.createProgressObject('organization', data.organizations?.length || 0),
        deals: this.createProgressObject('deal', data.deals?.length || 0),
        activities: this.createProgressObject('activity', data.activities?.length || 0),
      },
      checkpoint: {
        lastProcessedIndex: {
          persons: 0,
          organizations: 0,
          deals: 0,
          activities: 0,
        },
        processedIds: new Set(),
      },
    };
  }

  private createProgressObject(
    entityType: BulkSyncProgress['entityType'],
    total: number
  ): BulkSyncProgress {
    return {
      phase: 'preparing',
      entityType,
      total,
      processed: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      duplicates: 0,
      errors: [],
      totalBatches: Math.ceil(total / 50),
      currentBatch: 0,
    };
  }

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  private updateResultSummary(
    result: BulkSyncResult,
    batchResult: {
      summary: Pick<BulkSyncResult['summary'], 'successful' | 'failed' | 'skipped' | 'duplicates'>;
    }
  ): void {
    result.summary.successful += batchResult.summary.successful;
    result.summary.failed += batchResult.summary.failed;
    result.summary.skipped += batchResult.summary.skipped;
    result.summary.duplicates += batchResult.summary.duplicates;
    result.summary.total = result.summary.successful + result.summary.failed + result.summary.skipped;
  }

  private async loadSyncState(syncId: string): Promise<BulkSyncState | null> {
    // This would load from persistent storage
    // For now, return null
    return null;
  }

  private async saveSyncState(): Promise<void> {
    if (!this.state) return;
    // This would save to persistent storage
  }

  private cleanup(): void {
    this.state = null;
    this.abortController = null;
    this.rateLimitBackoff = 0;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Data Transformers

class OrganizationTransformer implements DataTransformer<Partial<PipedriveOrganization>> {
  transform(data: any): Partial<PipedriveOrganization> {
    return {
      name: data.name || data.company || data.organization,
      owner_id: data.ownerId || data.owner_id || 1, // Default to user 1
      address: data.address,
      visible_to: data.visible_to || '3', // Visible to entire company by default
      custom_fields: data.customFields || data.custom_fields,
    };
  }

  validate(data: Partial<PipedriveOrganization>): boolean {
    return !!(data.name && data.owner_id);
  }

  sanitize(data: Partial<PipedriveOrganization>): Partial<PipedriveOrganization> {
    const sanitized = { ...data };
    
    // Remove empty fields
    Object.keys(sanitized).forEach(key => {
      if (sanitized[key as keyof PipedriveOrganization] === null || 
          sanitized[key as keyof PipedriveOrganization] === undefined ||
          sanitized[key as keyof PipedriveOrganization] === '') {
        delete sanitized[key as keyof PipedriveOrganization];
      }
    });
    
    return sanitized;
  }
}

class PersonTransformer implements DataTransformer<Partial<PipedrivePerson>> {
  transform(data: any): Partial<PipedrivePerson> {
    const emails = Array.isArray(data.email) ? data.email : [data.email].filter(Boolean);
    const phones = Array.isArray(data.phone) ? data.phone : [data.phone].filter(Boolean);
    
    return {
      name: data.name || `${data.firstName || ''} ${data.lastName || ''}`.trim(),
      first_name: data.firstName || data.first_name,
      last_name: data.lastName || data.last_name,
      email: emails,
      phone: phones,
      org_id: data.organizationId || data.org_id,
      owner_id: data.ownerId || data.owner_id || 1,
      visible_to: data.visible_to || '3',
      custom_fields: data.customFields || data.custom_fields,
    };
  }

  validate(data: Partial<PipedrivePerson>): boolean {
    return !!(data.name || (data.first_name && data.last_name)) && 
           !!(data.email?.length || data.phone?.length);
  }

  sanitize(data: Partial<PipedrivePerson>): Partial<PipedrivePerson> {
    const sanitized = { ...data };
    
    // Remove empty arrays
    if (sanitized.email?.length === 0) delete sanitized.email;
    if (sanitized.phone?.length === 0) delete sanitized.phone;
    
    // Remove empty fields
    Object.keys(sanitized).forEach(key => {
      if (sanitized[key as keyof PipedrivePerson] === null || 
          sanitized[key as keyof PipedrivePerson] === undefined ||
          sanitized[key as keyof PipedrivePerson] === '') {
        delete sanitized[key as keyof PipedrivePerson];
      }
    });
    
    return sanitized;
  }
}

class DealTransformer implements DataTransformer<Partial<PipedriveDeal>> {
  transform(data: any): Partial<PipedriveDeal> {
    return {
      title: data.title || data.name,
      value: data.value || data.amount,
      currency: data.currency || 'USD',
      person_id: data.personId || data.person_id,
      org_id: data.organizationId || data.org_id,
      stage_id: data.stageId || data.stage_id || 1,
      pipeline_id: data.pipelineId || data.pipeline_id || 1,
      status: data.status || 'open',
      owner_id: data.ownerId || data.owner_id || 1,
      expected_close_date: data.expectedCloseDate || data.expected_close_date,
      visible_to: data.visible_to || '3',
      custom_fields: data.customFields || data.custom_fields,
    };
  }

  validate(data: Partial<PipedriveDeal>): boolean {
    return !!(data.title && data.stage_id && data.pipeline_id);
  }

  sanitize(data: Partial<PipedriveDeal>): Partial<PipedriveDeal> {
    const sanitized = { ...data };
    
    // Remove empty fields
    Object.keys(sanitized).forEach(key => {
      if (sanitized[key as keyof PipedriveDeal] === null || 
          sanitized[key as keyof PipedriveDeal] === undefined ||
          sanitized[key as keyof PipedriveDeal] === '') {
        delete sanitized[key as keyof PipedriveDeal];
      }
    });
    
    return sanitized;
  }
}

class ActivityTransformer implements DataTransformer<Partial<PipedriveActivity>> {
  transform(data: any): Partial<PipedriveActivity> {
    return {
      subject: data.subject || data.title,
      type: data.type || 'task',
      due_date: data.dueDate || data.due_date,
      due_time: data.dueTime || data.due_time,
      duration: data.duration,
      person_id: data.personId || data.person_id,
      org_id: data.organizationId || data.org_id,
      deal_id: data.dealId || data.deal_id,
      done: data.done || data.completed || false,
      note: data.note || data.description,
      owner_id: data.ownerId || data.owner_id || 1,
      custom_fields: data.customFields || data.custom_fields,
    };
  }

  validate(data: Partial<PipedriveActivity>): boolean {
    return !!(data.subject && data.type);
  }

  sanitize(data: Partial<PipedriveActivity>): Partial<PipedriveActivity> {
    const sanitized = { ...data };
    
    // Remove empty fields
    Object.keys(sanitized).forEach(key => {
      if (sanitized[key as keyof PipedriveActivity] === null || 
          sanitized[key as keyof PipedriveActivity] === undefined ||
          sanitized[key as keyof PipedriveActivity] === '') {
        delete sanitized[key as keyof PipedriveActivity];
      }
    });
    
    return sanitized;
  }
}

/**
 * Generate a detailed sync report
 */
export function generateSyncReport(result: BulkSyncResult): string {
  const report = [];
  
  report.push('# Pipedrive Bulk Sync Report');
  report.push(`Generated: ${new Date().toISOString()}`);
  report.push('');
  
  report.push('## Summary');
  report.push(`- Total Records: ${result.summary.total}`);
  report.push(`- Successful: ${result.summary.successful}`);
  report.push(`- Failed: ${result.summary.failed}`);
  report.push(`- Skipped: ${result.summary.skipped}`);
  report.push(`- Duplicates: ${result.summary.duplicates}`);
  report.push(`- Duration: ${(result.summary.duration / 1000).toFixed(2)} seconds`);
  report.push('');
  
  if (result.entities.organizations.length > 0) {
    report.push('## Organizations');
    report.push(`Processed: ${result.entities.organizations.length}`);
    const orgStats = getEntityStats(result.entities.organizations);
    report.push(`- Created: ${orgStats.created}`);
    report.push(`- Updated: ${orgStats.updated}`);
    report.push(`- Skipped: ${orgStats.skipped}`);
    report.push(`- Failed: ${orgStats.failed}`);
    report.push('');
  }
  
  if (result.entities.persons.length > 0) {
    report.push('## Persons');
    report.push(`Processed: ${result.entities.persons.length}`);
    const personStats = getEntityStats(result.entities.persons);
    report.push(`- Created: ${personStats.created}`);
    report.push(`- Updated: ${personStats.updated}`);
    report.push(`- Skipped: ${personStats.skipped}`);
    report.push(`- Failed: ${personStats.failed}`);
    report.push('');
  }
  
  if (result.entities.deals.length > 0) {
    report.push('## Deals');
    report.push(`Processed: ${result.entities.deals.length}`);
    const dealStats = getEntityStats(result.entities.deals);
    report.push(`- Created: ${dealStats.created}`);
    report.push(`- Updated: ${dealStats.updated}`);
    report.push(`- Skipped: ${dealStats.skipped}`);
    report.push(`- Failed: ${dealStats.failed}`);
    report.push('');
  }
  
  if (result.entities.activities.length > 0) {
    report.push('## Activities');
    report.push(`Processed: ${result.entities.activities.length}`);
    const activityStats = getEntityStats(result.entities.activities);
    report.push(`- Created: ${activityStats.created}`);
    report.push(`- Updated: ${activityStats.updated}`);
    report.push(`- Skipped: ${activityStats.skipped}`);
    report.push(`- Failed: ${activityStats.failed}`);
    report.push('');
  }
  
  if (result.errors.length > 0) {
    report.push('## Errors');
    result.errors.forEach((error, index) => {
      report.push(`${index + 1}. [Index: ${error.index}] ${error.error}`);
      if (error.entityId) {
        report.push(`   Entity ID: ${error.entityId}`);
      }
    });
  }
  
  return report.join('\n');
}

function getEntityStats(entities: SyncedEntity[]) {
  return {
    created: entities.filter(e => e.status === 'created').length,
    updated: entities.filter(e => e.status === 'updated').length,
    skipped: entities.filter(e => e.status === 'skipped').length,
    failed: entities.filter(e => e.status === 'failed').length,
  };
}