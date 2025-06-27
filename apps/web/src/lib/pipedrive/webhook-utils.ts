import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import type { 
  PipedriveWebhookEvent, 
  SyncOperation,
  FieldMapping 
} from '@/types/pipedrive-webhooks';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Generate a webhook secret for signature verification
 */
export function generateWebhookSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Calculate webhook signature
 */
export function calculateWebhookSignature(payload: string, secret: string): string {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  return hmac.digest('hex');
}

/**
 * Verify webhook signature
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  try {
    const expectedSignature = calculateWebhookSignature(payload, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

/**
 * Generate a unique event ID for deduplication
 */
export function generateEventId(event: PipedriveWebhookEvent): string {
  return `${event.meta.company_id}-${event.meta.object}-${event.meta.id}-${event.meta.timestamp_micro}`;
}

/**
 * Check if an event is a duplicate
 */
export async function isDuplicateEvent(eventId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('pipedrive_webhook_events')
    .select('id')
    .eq('event_id', eventId)
    .single();

  return !error && !!data;
}

/**
 * Map field values between systems
 */
export function applyFieldMappings(
  data: any,
  mappings: FieldMapping[],
  direction: 'to_pipedrive' | 'from_pipedrive'
): any {
  const result = { ...data };

  for (const mapping of mappings) {
    let sourceField: string;
    let targetField: string;

    if (direction === 'to_pipedrive') {
      if (mapping.source_system !== 'coldcopy' || mapping.target_system !== 'pipedrive') {
        continue;
      }
      sourceField = mapping.source_field;
      targetField = mapping.target_field;
    } else {
      if (mapping.source_system !== 'pipedrive' || mapping.target_system !== 'coldcopy') {
        continue;
      }
      sourceField = mapping.source_field;
      targetField = mapping.target_field;
    }

    const sourceValue = getNestedValue(data, sourceField);
    if (sourceValue !== undefined) {
      // Apply transformation if defined
      let transformedValue = sourceValue;
      if (mapping.transformation) {
        transformedValue = applyTransformation(sourceValue, mapping.transformation);
      }
      setNestedValue(result, targetField, transformedValue);
    }
  }

  return result;
}

/**
 * Get nested object value using dot notation
 */
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

/**
 * Set nested object value using dot notation
 */
function setNestedValue(obj: any, path: string, value: any): void {
  const keys = path.split('.');
  const lastKey = keys.pop()!;
  const target = keys.reduce((current, key) => {
    if (!current[key]) {
      current[key] = {};
    }
    return current[key];
  }, obj);
  target[lastKey] = value;
}

/**
 * Apply field transformation
 */
function applyTransformation(value: any, transformation: any): any {
  switch (transformation.type) {
    case 'uppercase':
      return typeof value === 'string' ? value.toUpperCase() : value;
    case 'lowercase':
      return typeof value === 'string' ? value.toLowerCase() : value;
    case 'trim':
      return typeof value === 'string' ? value.trim() : value;
    case 'date_format':
      return value ? new Date(value).toISOString() : value;
    case 'number':
      return Number(value) || 0;
    case 'boolean':
      return Boolean(value);
    case 'json_parse':
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    case 'json_stringify':
      return JSON.stringify(value);
    case 'custom':
      // Execute custom transformation function if safe
      if (transformation.function && typeof transformation.function === 'string') {
        try {
          const fn = new Function('value', transformation.function);
          return fn(value);
        } catch (error) {
          console.error('Custom transformation error:', error);
          return value;
        }
      }
      return value;
    default:
      return value;
  }
}

/**
 * Queue a sync operation
 */
export async function queueSyncOperation(
  operation: SyncOperation
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('pipedrive_sync_queue')
      .insert({
        ...operation,
        scheduled_at: new Date().toISOString(),
        status: 'pending',
        retry_count: 0,
        max_retries: 3,
      });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Calculate event processing delay
 */
export function calculateProcessingDelay(event: PipedriveWebhookEvent): number {
  const eventTime = event.meta.timestamp * 1000;
  const now = Date.now();
  return now - eventTime;
}

/**
 * Determine if an event should be processed
 */
export function shouldProcessEvent(
  event: PipedriveWebhookEvent,
  maxAgeMs: number = 24 * 60 * 60 * 1000 // 24 hours
): boolean {
  const delay = calculateProcessingDelay(event);
  return delay <= maxAgeMs;
}

/**
 * Extract changed fields from webhook event
 */
export function extractChangedFields(event: PipedriveWebhookEvent): string[] {
  if (event.meta.action !== 'updated' || !event.current || !event.previous) {
    return [];
  }

  const changedFields: string[] = [];
  const current = event.current;
  const previous = event.previous;

  for (const key of Object.keys(current)) {
    if (JSON.stringify(current[key]) !== JSON.stringify(previous[key])) {
      changedFields.push(key);
    }
  }

  return changedFields;
}

/**
 * Create activity data from webhook event
 */
export function createActivityFromEvent(event: PipedriveWebhookEvent): any {
  const baseActivity = {
    event_type: `${event.meta.object}_${event.meta.action}`,
    event_time: new Date(event.meta.timestamp * 1000).toISOString(),
    object_type: event.meta.object,
    object_id: event.meta.id,
    user_id: event.meta.user_id,
    company_id: event.meta.company_id,
  };

  if (event.meta.action === 'updated') {
    return {
      ...baseActivity,
      changed_fields: extractChangedFields(event),
      previous_values: event.previous,
      current_values: event.current,
    };
  }

  return {
    ...baseActivity,
    data: event.current || event.retry_object,
  };
}

/**
 * Validate webhook payload
 */
export function validateWebhookPayload(payload: any): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!payload.meta) {
    errors.push('Missing meta object');
  } else {
    if (!payload.meta.action) {
      errors.push('Missing meta.action');
    }
    if (!payload.meta.object) {
      errors.push('Missing meta.object');
    }
    if (!payload.meta.id) {
      errors.push('Missing meta.id');
    }
    if (!payload.meta.timestamp) {
      errors.push('Missing meta.timestamp');
    }
  }

  if (payload.meta?.action === 'updated' && !payload.previous) {
    errors.push('Missing previous data for update event');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Retry with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000
): Promise<T> {
  let lastError: Error;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      
      if (i < maxRetries - 1) {
        const delay = baseDelayMs * Math.pow(2, i);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError!;
}