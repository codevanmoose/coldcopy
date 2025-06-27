import { createHash } from 'crypto';
import { diff } from 'deep-object-diff';
import { 
  PipedrivePerson, 
  PipedriveOrganization, 
  PipedriveDeal, 
  PipedriveActivity,
  ConflictResolution,
  PipedriveFieldType
} from './types';
import { supabase } from '@/lib/supabase/client';
import { AIService } from '@/lib/ai';

export interface ConflictDetectionResult {
  hasConflict: boolean;
  conflictType: ConflictType;
  conflictSeverity: ConflictSeverity;
  conflictedFields: ConflictedField[];
  conflictHash: string;
  metadata: {
    localVersion: VersionInfo;
    remoteVersion: VersionInfo;
    lastSyncedVersion?: VersionInfo;
  };
}

export interface ConflictedField {
  fieldName: string;
  fieldType: PipedriveFieldType;
  localValue: any;
  remoteValue: any;
  lastSyncedValue?: any;
  isDifferent: boolean;
  changeType: 'added' | 'modified' | 'deleted';
  priority: 'high' | 'medium' | 'low';
}

export interface VersionInfo {
  timestamp: Date;
  hash: string;
  source: 'local' | 'remote';
  userId?: string;
  changeCount: number;
}

export enum ConflictType {
  FIELD_CONFLICT = 'field_conflict',
  DELETION_CONFLICT = 'deletion_conflict',
  CREATION_CONFLICT = 'creation_conflict',
  RELATIONSHIP_CONFLICT = 'relationship_conflict',
  MERGE_CONFLICT = 'merge_conflict',
  SCHEMA_CONFLICT = 'schema_conflict'
}

export enum ConflictSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface ConflictResolutionStrategy {
  id: string;
  name: string;
  description: string;
  type: 'automatic' | 'manual' | 'ai_assisted';
  priority: number;
  conditions: ResolutionCondition[];
  actions: ResolutionAction[];
  requiresApproval: boolean;
}

export interface ResolutionCondition {
  field?: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'matches_pattern';
  value: any;
  combineWith?: 'AND' | 'OR';
}

export interface ResolutionAction {
  type: 'accept_local' | 'accept_remote' | 'merge' | 'custom' | 'ai_resolve';
  field?: string;
  mergeStrategy?: MergeStrategy;
  customResolver?: (local: any, remote: any, context: ConflictContext) => any;
}

export interface MergeStrategy {
  type: 'concatenate' | 'average' | 'sum' | 'latest' | 'earliest' | 'union' | 'intersection';
  delimiter?: string;
  unique?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ConflictContext {
  entityType: 'person' | 'organization' | 'deal' | 'activity';
  entityId: string;
  workspaceId: string;
  userId: string;
  syncDirection: 'to_pipedrive' | 'from_pipedrive' | 'bidirectional';
  lastSyncTimestamp?: Date;
  customMetadata?: Record<string, any>;
}

export interface ConflictResolutionResult {
  resolved: boolean;
  resolvedData?: any;
  strategy: string;
  confidence: number;
  requiresManualReview: boolean;
  suggestions?: ResolutionSuggestion[];
  auditLog: AuditLogEntry[];
}

export interface ResolutionSuggestion {
  field: string;
  suggestedValue: any;
  reason: string;
  confidence: number;
  source: 'ai' | 'rule' | 'history' | 'pattern';
}

export interface AuditLogEntry {
  timestamp: Date;
  action: string;
  field?: string;
  oldValue?: any;
  newValue?: any;
  reason: string;
  userId?: string;
}

export interface ConflictHistory {
  id: string;
  workspaceId: string;
  entityType: string;
  entityId: string;
  conflictType: ConflictType;
  detectedAt: Date;
  resolvedAt?: Date;
  resolution: ConflictResolutionResult;
  localSnapshot: any;
  remoteSnapshot: any;
  finalSnapshot?: any;
}

export interface OptimisticLock {
  entityType: string;
  entityId: string;
  version: number;
  lockedBy: string;
  lockedAt: Date;
  expiresAt: Date;
  lockToken: string;
}

export class ConflictResolver {
  private strategies: Map<string, ConflictResolutionStrategy> = new Map();
  private aiService: AIService;
  private lockTimeout: number = 300000; // 5 minutes

  constructor() {
    this.aiService = new AIService();
    this.initializeDefaultStrategies();
  }

  private initializeDefaultStrategies() {
    // Latest wins strategy
    this.strategies.set('latest_wins', {
      id: 'latest_wins',
      name: 'Latest Wins',
      description: 'Accept the most recently modified version',
      type: 'automatic',
      priority: 1,
      conditions: [],
      actions: [{
        type: 'custom',
        customResolver: (local, remote, context) => {
          const localTime = new Date(local.update_time || local.updated_at);
          const remoteTime = new Date(remote.update_time || remote.updated_at);
          return localTime > remoteTime ? local : remote;
        }
      }],
      requiresApproval: false
    });

    // Pipedrive wins strategy
    this.strategies.set('pipedrive_wins', {
      id: 'pipedrive_wins',
      name: 'Pipedrive Wins',
      description: 'Always accept Pipedrive version',
      type: 'automatic',
      priority: 2,
      conditions: [],
      actions: [{ type: 'accept_remote' }],
      requiresApproval: false
    });

    // ColdCopy wins strategy
    this.strategies.set('coldcopy_wins', {
      id: 'coldcopy_wins',
      name: 'ColdCopy Wins',
      description: 'Always accept ColdCopy version',
      type: 'automatic',
      priority: 3,
      conditions: [],
      actions: [{ type: 'accept_local' }],
      requiresApproval: false
    });

    // Field-level merge strategy
    this.strategies.set('field_level_merge', {
      id: 'field_level_merge',
      name: 'Field Level Merge',
      description: 'Merge at field level based on rules',
      type: 'automatic',
      priority: 4,
      conditions: [],
      actions: [{ type: 'merge' }],
      requiresApproval: true
    });

    // AI-assisted resolution
    this.strategies.set('ai_resolution', {
      id: 'ai_resolution',
      name: 'AI Resolution',
      description: 'Use AI to suggest best resolution',
      type: 'ai_assisted',
      priority: 5,
      conditions: [],
      actions: [{ type: 'ai_resolve' }],
      requiresApproval: true
    });
  }

  async detectConflicts(
    local: any,
    remote: any,
    lastSynced?: any,
    context?: ConflictContext
  ): Promise<ConflictDetectionResult> {
    const differences = diff(local, remote);
    const conflictedFields: ConflictedField[] = [];
    
    // Analyze differences
    for (const [field, value] of Object.entries(differences)) {
      const fieldInfo = this.analyzeFieldConflict(field, local[field], remote[field], lastSynced?.[field]);
      if (fieldInfo.isDifferent) {
        conflictedFields.push(fieldInfo);
      }
    }

    // Calculate conflict hash
    const conflictData = {
      local: this.normalizeForHashing(local),
      remote: this.normalizeForHashing(remote),
      fields: conflictedFields.map(f => f.fieldName).sort()
    };
    const conflictHash = createHash('sha256')
      .update(JSON.stringify(conflictData))
      .digest('hex');

    // Determine conflict type and severity
    const conflictType = this.determineConflictType(conflictedFields, local, remote);
    const conflictSeverity = this.calculateSeverity(conflictedFields, conflictType);

    return {
      hasConflict: conflictedFields.length > 0,
      conflictType,
      conflictSeverity,
      conflictedFields,
      conflictHash,
      metadata: {
        localVersion: this.createVersionInfo(local, 'local'),
        remoteVersion: this.createVersionInfo(remote, 'remote'),
        lastSyncedVersion: lastSynced ? this.createVersionInfo(lastSynced, 'remote') : undefined
      }
    };
  }

  private analyzeFieldConflict(
    fieldName: string,
    localValue: any,
    remoteValue: any,
    lastSyncedValue?: any
  ): ConflictedField {
    const fieldType = this.inferFieldType(fieldName, localValue, remoteValue);
    const isDifferent = !this.areValuesEqual(localValue, remoteValue, fieldType);
    
    let changeType: 'added' | 'modified' | 'deleted' = 'modified';
    if (localValue === undefined && remoteValue !== undefined) {
      changeType = 'added';
    } else if (localValue !== undefined && remoteValue === undefined) {
      changeType = 'deleted';
    }

    const priority = this.calculateFieldPriority(fieldName, fieldType);

    return {
      fieldName,
      fieldType,
      localValue,
      remoteValue,
      lastSyncedValue,
      isDifferent,
      changeType,
      priority
    };
  }

  private inferFieldType(fieldName: string, ...values: any[]): PipedriveFieldType {
    // Check by field name patterns
    if (fieldName.includes('email')) return PipedriveFieldType.EMAIL;
    if (fieldName.includes('phone')) return PipedriveFieldType.PHONE;
    if (fieldName.includes('date') || fieldName.includes('time')) return PipedriveFieldType.DATETIME;
    if (fieldName.includes('value') || fieldName.includes('amount')) return PipedriveFieldType.MONETARY;
    
    // Check by value types
    for (const value of values) {
      if (value === null || value === undefined) continue;
      if (typeof value === 'number') return PipedriveFieldType.INT;
      if (typeof value === 'string') {
        if (/^\d{4}-\d{2}-\d{2}/.test(value)) return PipedriveFieldType.DATETIME;
        if (/^\d+$/.test(value)) return PipedriveFieldType.INT;
        if (/^\d+\.\d+$/.test(value)) return PipedriveFieldType.DECIMAL;
      }
    }
    
    return PipedriveFieldType.VARCHAR;
  }

  private areValuesEqual(val1: any, val2: any, fieldType: PipedriveFieldType): boolean {
    if (val1 === val2) return true;
    if (val1 == null || val2 == null) return false;

    switch (fieldType) {
      case PipedriveFieldType.EMAIL:
      case PipedriveFieldType.PHONE:
        // Normalize and compare
        return this.normalizeContact(val1) === this.normalizeContact(val2);
      
      case PipedriveFieldType.DATETIME:
      case PipedriveFieldType.DATE:
        // Compare dates
        return new Date(val1).getTime() === new Date(val2).getTime();
      
      case PipedriveFieldType.MONETARY:
      case PipedriveFieldType.DECIMAL:
        // Compare with precision
        return Math.abs(parseFloat(val1) - parseFloat(val2)) < 0.01;
      
      default:
        return String(val1) === String(val2);
    }
  }

  private normalizeContact(value: string): string {
    if (typeof value !== 'string') return String(value);
    return value.toLowerCase().replace(/[^a-z0-9@.]/g, '');
  }

  private calculateFieldPriority(fieldName: string, fieldType: PipedriveFieldType): 'high' | 'medium' | 'low' {
    // High priority fields
    const highPriorityFields = ['id', 'email', 'phone', 'name', 'title', 'value', 'stage_id', 'status'];
    if (highPriorityFields.includes(fieldName)) return 'high';

    // High priority types
    const highPriorityTypes = [PipedriveFieldType.EMAIL, PipedriveFieldType.PHONE, PipedriveFieldType.MONETARY];
    if (highPriorityTypes.includes(fieldType)) return 'high';

    // Low priority fields
    const lowPriorityFields = ['notes', 'description', 'custom_fields', 'metadata'];
    if (lowPriorityFields.includes(fieldName)) return 'low';

    return 'medium';
  }

  private determineConflictType(
    conflictedFields: ConflictedField[],
    local: any,
    remote: any
  ): ConflictType {
    // Check for deletion conflicts
    if ((local.deleted || local.status === 'deleted') !== (remote.deleted || remote.status === 'deleted')) {
      return ConflictType.DELETION_CONFLICT;
    }

    // Check for creation conflicts
    if (!local.id && !remote.id) {
      return ConflictType.CREATION_CONFLICT;
    }

    // Check for relationship conflicts
    const relationshipFields = ['person_id', 'org_id', 'deal_id', 'owner_id'];
    if (conflictedFields.some(f => relationshipFields.includes(f.fieldName))) {
      return ConflictType.RELATIONSHIP_CONFLICT;
    }

    // Check for schema conflicts
    const localFields = Object.keys(local);
    const remoteFields = Object.keys(remote);
    if (localFields.length !== remoteFields.length || 
        !localFields.every(f => remoteFields.includes(f))) {
      return ConflictType.SCHEMA_CONFLICT;
    }

    return ConflictType.FIELD_CONFLICT;
  }

  private calculateSeverity(
    conflictedFields: ConflictedField[],
    conflictType: ConflictType
  ): ConflictSeverity {
    // Critical conflicts
    if (conflictType === ConflictType.DELETION_CONFLICT) return ConflictSeverity.CRITICAL;
    if (conflictType === ConflictType.SCHEMA_CONFLICT) return ConflictSeverity.HIGH;

    // Based on field priorities
    const hasHighPriorityConflict = conflictedFields.some(f => f.priority === 'high');
    const hasMediumPriorityConflict = conflictedFields.some(f => f.priority === 'medium');

    if (hasHighPriorityConflict) return ConflictSeverity.HIGH;
    if (hasMediumPriorityConflict) return ConflictSeverity.MEDIUM;

    return ConflictSeverity.LOW;
  }

  private normalizeForHashing(obj: any): any {
    if (obj === null || obj === undefined) return null;
    if (typeof obj !== 'object') return obj;
    if (obj instanceof Date) return obj.toISOString();
    if (Array.isArray(obj)) return obj.map(item => this.normalizeForHashing(item)).sort();

    const normalized: any = {};
    const keys = Object.keys(obj).sort();
    for (const key of keys) {
      // Skip metadata fields
      if (['created_at', 'updated_at', 'last_synced_at', 'sync_hash'].includes(key)) continue;
      normalized[key] = this.normalizeForHashing(obj[key]);
    }
    return normalized;
  }

  private createVersionInfo(data: any, source: 'local' | 'remote'): VersionInfo {
    const normalized = this.normalizeForHashing(data);
    const hash = createHash('sha256')
      .update(JSON.stringify(normalized))
      .digest('hex');

    return {
      timestamp: new Date(data.update_time || data.updated_at || Date.now()),
      hash,
      source,
      userId: data.updated_by || data.owner_id,
      changeCount: Object.keys(data).length
    };
  }

  async resolveConflict(
    conflict: ConflictDetectionResult,
    local: any,
    remote: any,
    strategy: string,
    context: ConflictContext
  ): Promise<ConflictResolutionResult> {
    const auditLog: AuditLogEntry[] = [];
    const startTime = new Date();

    try {
      const selectedStrategy = this.strategies.get(strategy);
      if (!selectedStrategy) {
        throw new Error(`Unknown resolution strategy: ${strategy}`);
      }

      // Check if conditions are met
      if (!this.checkConditions(selectedStrategy.conditions, conflict, context)) {
        throw new Error('Strategy conditions not met');
      }

      // Execute resolution actions
      let resolvedData = local;
      let suggestions: ResolutionSuggestion[] = [];
      let requiresManualReview = selectedStrategy.requiresApproval;

      for (const action of selectedStrategy.actions) {
        const result = await this.executeAction(
          action,
          local,
          remote,
          conflict,
          context,
          auditLog
        );

        if (result.data) {
          resolvedData = result.data;
        }
        if (result.suggestions) {
          suggestions = [...suggestions, ...result.suggestions];
        }
        if (result.requiresReview) {
          requiresManualReview = true;
        }
      }

      // Calculate confidence
      const confidence = this.calculateConfidence(conflict, resolvedData, suggestions);

      // Save to history
      await this.saveConflictHistory({
        workspaceId: context.workspaceId,
        entityType: context.entityType,
        entityId: context.entityId,
        conflictType: conflict.conflictType,
        detectedAt: startTime,
        resolvedAt: new Date(),
        resolution: {
          resolved: true,
          resolvedData,
          strategy,
          confidence,
          requiresManualReview,
          suggestions,
          auditLog
        },
        localSnapshot: local,
        remoteSnapshot: remote,
        finalSnapshot: resolvedData
      });

      return {
        resolved: true,
        resolvedData,
        strategy,
        confidence,
        requiresManualReview,
        suggestions,
        auditLog
      };
    } catch (error) {
      auditLog.push({
        timestamp: new Date(),
        action: 'resolution_failed',
        reason: error.message,
        userId: context.userId
      });

      return {
        resolved: false,
        strategy,
        confidence: 0,
        requiresManualReview: true,
        auditLog
      };
    }
  }

  private checkConditions(
    conditions: ResolutionCondition[],
    conflict: ConflictDetectionResult,
    context: ConflictContext
  ): boolean {
    if (conditions.length === 0) return true;

    let result = true;
    let combineWith: 'AND' | 'OR' = 'AND';

    for (const condition of conditions) {
      const conditionMet = this.evaluateCondition(condition, conflict, context);
      
      if (combineWith === 'AND') {
        result = result && conditionMet;
      } else {
        result = result || conditionMet;
      }

      combineWith = condition.combineWith || 'AND';
    }

    return result;
  }

  private evaluateCondition(
    condition: ResolutionCondition,
    conflict: ConflictDetectionResult,
    context: ConflictContext
  ): boolean {
    const fieldConflict = conflict.conflictedFields.find(f => f.fieldName === condition.field);
    if (!fieldConflict && condition.field) return false;

    const value = fieldConflict ? fieldConflict.localValue : context[condition.field as keyof ConflictContext];

    switch (condition.operator) {
      case 'equals':
        return value === condition.value;
      case 'not_equals':
        return value !== condition.value;
      case 'contains':
        return String(value).includes(String(condition.value));
      case 'greater_than':
        return Number(value) > Number(condition.value);
      case 'less_than':
        return Number(value) < Number(condition.value);
      case 'matches_pattern':
        return new RegExp(String(condition.value)).test(String(value));
      default:
        return false;
    }
  }

  private async executeAction(
    action: ResolutionAction,
    local: any,
    remote: any,
    conflict: ConflictDetectionResult,
    context: ConflictContext,
    auditLog: AuditLogEntry[]
  ): Promise<{ data?: any; suggestions?: ResolutionSuggestion[]; requiresReview?: boolean }> {
    switch (action.type) {
      case 'accept_local':
        auditLog.push({
          timestamp: new Date(),
          action: 'accept_local',
          reason: 'Strategy: Accept local version',
          userId: context.userId
        });
        return { data: local };

      case 'accept_remote':
        auditLog.push({
          timestamp: new Date(),
          action: 'accept_remote',
          reason: 'Strategy: Accept remote version',
          userId: context.userId
        });
        return { data: remote };

      case 'merge':
        return await this.executeMerge(local, remote, conflict, action, context, auditLog);

      case 'custom':
        if (action.customResolver) {
          const result = await action.customResolver(local, remote, context);
          auditLog.push({
            timestamp: new Date(),
            action: 'custom_resolution',
            reason: 'Custom resolver applied',
            userId: context.userId
          });
          return { data: result };
        }
        break;

      case 'ai_resolve':
        return await this.executeAIResolution(local, remote, conflict, context, auditLog);
    }

    return {};
  }

  private async executeMerge(
    local: any,
    remote: any,
    conflict: ConflictDetectionResult,
    action: ResolutionAction,
    context: ConflictContext,
    auditLog: AuditLogEntry[]
  ): Promise<{ data?: any; suggestions?: ResolutionSuggestion[]; requiresReview?: boolean }> {
    const merged = { ...local };
    const suggestions: ResolutionSuggestion[] = [];

    for (const field of conflict.conflictedFields) {
      const mergeResult = await this.mergeField(
        field,
        local[field.fieldName],
        remote[field.fieldName],
        action.mergeStrategy,
        context
      );

      if (mergeResult.value !== undefined) {
        merged[field.fieldName] = mergeResult.value;
        auditLog.push({
          timestamp: new Date(),
          action: 'merge_field',
          field: field.fieldName,
          oldValue: local[field.fieldName],
          newValue: mergeResult.value,
          reason: mergeResult.reason,
          userId: context.userId
        });
      }

      if (mergeResult.suggestion) {
        suggestions.push(mergeResult.suggestion);
      }
    }

    return { data: merged, suggestions, requiresReview: suggestions.length > 0 };
  }

  private async mergeField(
    field: ConflictedField,
    localValue: any,
    remoteValue: any,
    strategy?: MergeStrategy,
    context?: ConflictContext
  ): Promise<{ value?: any; reason: string; suggestion?: ResolutionSuggestion }> {
    // Default strategies based on field type
    if (!strategy) {
      strategy = this.getDefaultMergeStrategy(field.fieldType);
    }

    switch (strategy.type) {
      case 'latest':
        const localTime = new Date(context?.lastSyncTimestamp || 0);
        const remoteTime = new Date();
        return {
          value: localTime > remoteTime ? localValue : remoteValue,
          reason: `Selected ${localTime > remoteTime ? 'local' : 'remote'} as latest`
        };

      case 'concatenate':
        if (typeof localValue === 'string' && typeof remoteValue === 'string') {
          const delimiter = strategy.delimiter || ' ';
          return {
            value: [localValue, remoteValue].filter(Boolean).join(delimiter),
            reason: 'Concatenated string values'
          };
        }
        break;

      case 'union':
        if (Array.isArray(localValue) && Array.isArray(remoteValue)) {
          const union = [...new Set([...localValue, ...remoteValue])];
          return {
            value: strategy.unique ? union : [...localValue, ...remoteValue],
            reason: 'Created union of arrays'
          };
        }
        break;

      case 'average':
        if (typeof localValue === 'number' && typeof remoteValue === 'number') {
          return {
            value: (localValue + remoteValue) / 2,
            reason: 'Calculated average of numeric values'
          };
        }
        break;

      case 'sum':
        if (typeof localValue === 'number' && typeof remoteValue === 'number') {
          return {
            value: localValue + remoteValue,
            reason: 'Summed numeric values'
          };
        }
        break;
    }

    // If no merge possible, suggest manual review
    return {
      reason: 'Cannot automatically merge',
      suggestion: {
        field: field.fieldName,
        suggestedValue: remoteValue,
        reason: 'Automatic merge not possible for this field type',
        confidence: 0.5,
        source: 'rule'
      }
    };
  }

  private getDefaultMergeStrategy(fieldType: PipedriveFieldType): MergeStrategy {
    switch (fieldType) {
      case PipedriveFieldType.VARCHAR:
      case PipedriveFieldType.TEXT:
        return { type: 'concatenate', delimiter: ' ' };
      
      case PipedriveFieldType.INT:
      case PipedriveFieldType.DECIMAL:
      case PipedriveFieldType.MONETARY:
        return { type: 'latest' };
      
      case PipedriveFieldType.DATE:
      case PipedriveFieldType.DATETIME:
        return { type: 'latest' };
      
      case PipedriveFieldType.EMAIL:
      case PipedriveFieldType.PHONE:
        return { type: 'union', unique: true };
      
      case PipedriveFieldType.SET:
        return { type: 'union', unique: true };
      
      default:
        return { type: 'latest' };
    }
  }

  private async executeAIResolution(
    local: any,
    remote: any,
    conflict: ConflictDetectionResult,
    context: ConflictContext,
    auditLog: AuditLogEntry[]
  ): Promise<{ data?: any; suggestions?: ResolutionSuggestion[]; requiresReview?: boolean }> {
    try {
      const prompt = this.buildAIPrompt(local, remote, conflict, context);
      const aiResponse = await this.aiService.generateCompletion(prompt, {
        temperature: 0.3,
        maxTokens: 1000
      });

      const resolution = this.parseAIResponse(aiResponse);
      
      auditLog.push({
        timestamp: new Date(),
        action: 'ai_resolution',
        reason: `AI suggested resolution with ${resolution.confidence}% confidence`,
        userId: context.userId
      });

      return {
        data: resolution.resolvedData,
        suggestions: resolution.suggestions,
        requiresReview: resolution.confidence < 80
      };
    } catch (error) {
      auditLog.push({
        timestamp: new Date(),
        action: 'ai_resolution_failed',
        reason: error.message,
        userId: context.userId
      });

      return { requiresReview: true };
    }
  }

  private buildAIPrompt(
    local: any,
    remote: any,
    conflict: ConflictDetectionResult,
    context: ConflictContext
  ): string {
    return `
      Analyze the following data conflict and suggest the best resolution:

      Entity Type: ${context.entityType}
      Conflict Type: ${conflict.conflictType}
      Conflict Severity: ${conflict.conflictSeverity}

      Local Version:
      ${JSON.stringify(local, null, 2)}

      Remote Version (Pipedrive):
      ${JSON.stringify(remote, null, 2)}

      Conflicted Fields:
      ${conflict.conflictedFields.map(f => `
        - ${f.fieldName}: 
          Local: ${JSON.stringify(f.localValue)}
          Remote: ${JSON.stringify(f.remoteValue)}
          Priority: ${f.priority}
      `).join('\n')}

      Please provide:
      1. The best merged version of the data
      2. Confidence score (0-100)
      3. Explanation for each field resolution
      4. Any suggestions for manual review

      Return the response in JSON format:
      {
        "resolvedData": { ... },
        "confidence": 85,
        "fieldResolutions": {
          "fieldName": {
            "value": ...,
            "reason": "..."
          }
        },
        "suggestions": [
          {
            "field": "...",
            "suggestedValue": ...,
            "reason": "...",
            "confidence": 0.8
          }
        ]
      }
    `;
  }

  private parseAIResponse(response: string): {
    resolvedData: any;
    confidence: number;
    suggestions: ResolutionSuggestion[];
  } {
    try {
      const parsed = JSON.parse(response);
      
      const suggestions = (parsed.suggestions || []).map((s: any) => ({
        ...s,
        source: 'ai' as const
      }));

      return {
        resolvedData: parsed.resolvedData,
        confidence: parsed.confidence || 50,
        suggestions
      };
    } catch (error) {
      throw new Error('Failed to parse AI response');
    }
  }

  private calculateConfidence(
    conflict: ConflictDetectionResult,
    resolvedData: any,
    suggestions: ResolutionSuggestion[]
  ): number {
    let confidence = 100;

    // Reduce confidence based on severity
    switch (conflict.conflictSeverity) {
      case ConflictSeverity.CRITICAL:
        confidence -= 40;
        break;
      case ConflictSeverity.HIGH:
        confidence -= 30;
        break;
      case ConflictSeverity.MEDIUM:
        confidence -= 20;
        break;
      case ConflictSeverity.LOW:
        confidence -= 10;
        break;
    }

    // Reduce confidence for each unresolved suggestion
    confidence -= suggestions.length * 5;

    // Reduce confidence for complex conflict types
    if (conflict.conflictType === ConflictType.RELATIONSHIP_CONFLICT) {
      confidence -= 15;
    }

    return Math.max(0, Math.min(100, confidence));
  }

  async acquireOptimisticLock(
    entityType: string,
    entityId: string,
    userId: string
  ): Promise<OptimisticLock> {
    const lockToken = createHash('sha256')
      .update(`${entityType}:${entityId}:${userId}:${Date.now()}`)
      .digest('hex');

    const lock: OptimisticLock = {
      entityType,
      entityId,
      version: 1,
      lockedBy: userId,
      lockedAt: new Date(),
      expiresAt: new Date(Date.now() + this.lockTimeout),
      lockToken
    };

    // Store lock in database
    const { error } = await supabase
      .from('pipedrive_optimistic_locks')
      .insert(lock);

    if (error) {
      throw new Error(`Failed to acquire lock: ${error.message}`);
    }

    return lock;
  }

  async releaseLock(lockToken: string): Promise<void> {
    await supabase
      .from('pipedrive_optimistic_locks')
      .delete()
      .eq('lock_token', lockToken);
  }

  async validateLock(lockToken: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('pipedrive_optimistic_locks')
      .select('*')
      .eq('lock_token', lockToken)
      .single();

    if (error || !data) return false;

    const lock = data as OptimisticLock;
    return new Date() < new Date(lock.expiresAt);
  }

  private async saveConflictHistory(history: Omit<ConflictHistory, 'id'>): Promise<void> {
    const { error } = await supabase
      .from('pipedrive_conflict_history')
      .insert({
        ...history,
        id: createHash('sha256')
          .update(JSON.stringify(history))
          .digest('hex')
      });

    if (error) {
      console.error('Failed to save conflict history:', error);
    }
  }

  async getConflictHistory(
    workspaceId: string,
    entityType?: string,
    entityId?: string,
    limit: number = 100
  ): Promise<ConflictHistory[]> {
    let query = supabase
      .from('pipedrive_conflict_history')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('detected_at', { ascending: false })
      .limit(limit);

    if (entityType) {
      query = query.eq('entity_type', entityType);
    }

    if (entityId) {
      query = query.eq('entity_id', entityId);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch conflict history: ${error.message}`);
    }

    return data || [];
  }

  async analyzeConflictPatterns(
    workspaceId: string,
    timeRange: { start: Date; end: Date }
  ): Promise<{
    patterns: ConflictPattern[];
    recommendations: string[];
  }> {
    const history = await this.getConflictHistory(workspaceId);
    
    const patterns = this.identifyPatterns(history, timeRange);
    const recommendations = this.generateRecommendations(patterns);

    return { patterns, recommendations };
  }

  private identifyPatterns(
    history: ConflictHistory[],
    timeRange: { start: Date; end: Date }
  ): ConflictPattern[] {
    const patterns: ConflictPattern[] = [];
    
    // Group by entity type and conflict type
    const grouped = history.reduce((acc, item) => {
      const key = `${item.entityType}:${item.conflictType}`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {} as Record<string, ConflictHistory[]>);

    for (const [key, items] of Object.entries(grouped)) {
      const [entityType, conflictType] = key.split(':');
      
      patterns.push({
        entityType: entityType as any,
        conflictType: conflictType as ConflictType,
        frequency: items.length,
        averageResolutionTime: this.calculateAverageResolutionTime(items),
        commonFields: this.findCommonConflictedFields(items),
        successRate: this.calculateSuccessRate(items)
      });
    }

    return patterns.sort((a, b) => b.frequency - a.frequency);
  }

  private calculateAverageResolutionTime(items: ConflictHistory[]): number {
    const times = items
      .filter(item => item.resolvedAt)
      .map(item => new Date(item.resolvedAt!).getTime() - new Date(item.detectedAt).getTime());
    
    return times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
  }

  private findCommonConflictedFields(items: ConflictHistory[]): string[] {
    const fieldCounts: Record<string, number> = {};
    
    for (const item of items) {
      const fields = Object.keys(item.localSnapshot || {});
      for (const field of fields) {
        fieldCounts[field] = (fieldCounts[field] || 0) + 1;
      }
    }

    return Object.entries(fieldCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([field]) => field);
  }

  private calculateSuccessRate(items: ConflictHistory[]): number {
    const resolved = items.filter(item => item.resolution?.resolved).length;
    return items.length > 0 ? (resolved / items.length) * 100 : 0;
  }

  private generateRecommendations(patterns: ConflictPattern[]): string[] {
    const recommendations: string[] = [];

    for (const pattern of patterns) {
      if (pattern.successRate < 70) {
        recommendations.push(
          `Consider reviewing the resolution strategy for ${pattern.entityType} ${pattern.conflictType} conflicts (current success rate: ${pattern.successRate.toFixed(1)}%)`
        );
      }

      if (pattern.averageResolutionTime > 3600000) { // 1 hour
        recommendations.push(
          `${pattern.entityType} conflicts are taking too long to resolve (average: ${Math.round(pattern.averageResolutionTime / 60000)} minutes)`
        );
      }

      if (pattern.frequency > 50) {
        recommendations.push(
          `High frequency of ${pattern.conflictType} conflicts for ${pattern.entityType} (${pattern.frequency} occurrences). Consider implementing preventive measures.`
        );
      }
    }

    return recommendations;
  }
}

interface ConflictPattern {
  entityType: 'person' | 'organization' | 'deal' | 'activity';
  conflictType: ConflictType;
  frequency: number;
  averageResolutionTime: number;
  commonFields: string[];
  successRate: number;
}

// Export singleton instance
export const conflictResolver = new ConflictResolver();