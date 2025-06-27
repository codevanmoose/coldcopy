import { createClient } from '@/lib/supabase/server'
import { ContactSyncService } from './sync/contacts'
import { CompanySyncService } from './sync/companies'
import { DealSyncService } from './sync/deals'
import { ActivitySyncService } from './sync/activities'

export interface SyncQueueItem {
  id: string
  workspace_id: string
  object_type: 'contacts' | 'companies' | 'deals' | 'activities'
  operation: 'create' | 'update' | 'delete'
  direction: 'to_hubspot' | 'from_hubspot'
  priority: number
  data: any
  retry_count: number
  max_retries: number
  next_retry_at?: string
  created_at: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  error_message?: string
}

export class HubSpotSyncQueue {
  private readonly MAX_CONCURRENT_JOBS = 5
  private readonly RETRY_DELAYS = [60, 300, 900, 3600, 7200] // seconds: 1m, 5m, 15m, 1h, 2h
  private processing = false

  constructor(private workspaceId: string) {}

  /**
   * Add an item to the sync queue
   */
  async enqueue(
    objectType: SyncQueueItem['object_type'],
    operation: SyncQueueItem['operation'],
    direction: SyncQueueItem['direction'],
    data: any,
    priority: number = 100,
    maxRetries: number = 5
  ): Promise<string> {
    const supabase = await createClient()

    const { data: queueItem, error } = await supabase
      .from('hubspot_sync_queue')
      .insert({
        workspace_id: this.workspaceId,
        object_type: objectType,
        operation,
        direction,
        priority,
        data,
        max_retries: maxRetries,
        status: 'pending',
      })
      .select()
      .single()

    if (error || !queueItem) {
      throw new Error(`Failed to enqueue sync item: ${error?.message}`)
    }

    // Trigger queue processing if not already running
    this.processQueue().catch(console.error)

    return queueItem.id
  }

  /**
   * Process items in the sync queue
   */
  async processQueue(): Promise<void> {
    if (this.processing) return
    this.processing = true

    const supabase = await createClient()

    try {
      // Get pending items that are ready to process
      const { data: items } = await supabase
        .from('hubspot_sync_queue')
        .select('*')
        .eq('workspace_id', this.workspaceId)
        .eq('status', 'pending')
        .or(`next_retry_at.is.null,next_retry_at.lte.${new Date().toISOString()}`)
        .order('priority', { ascending: true })
        .order('created_at', { ascending: true })
        .limit(this.MAX_CONCURRENT_JOBS)

      if (!items || items.length === 0) {
        return
      }

      // Process items concurrently
      const processingPromises = items.map(item => this.processItem(item))
      await Promise.allSettled(processingPromises)

      // Continue processing if there are more items
      const { count } = await supabase
        .from('hubspot_sync_queue')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', this.workspaceId)
        .eq('status', 'pending')

      if (count && count > 0) {
        // Schedule next processing cycle
        setTimeout(() => this.processQueue().catch(console.error), 5000)
      }

    } finally {
      this.processing = false
    }
  }

  /**
   * Process a single queue item
   */
  private async processItem(item: SyncQueueItem): Promise<void> {
    const supabase = await createClient()

    try {
      // Mark as processing
      await supabase
        .from('hubspot_sync_queue')
        .update({
          status: 'processing',
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.id)

      // Execute the sync operation
      await this.executeSyncOperation(item)

      // Mark as completed
      await supabase
        .from('hubspot_sync_queue')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.id)

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error(`Sync queue item ${item.id} failed:`, error)

      const newRetryCount = item.retry_count + 1
      const shouldRetry = newRetryCount <= item.max_retries

      if (shouldRetry) {
        // Calculate next retry time with exponential backoff
        const delayIndex = Math.min(newRetryCount - 1, this.RETRY_DELAYS.length - 1)
        const delaySeconds = this.RETRY_DELAYS[delayIndex]
        const nextRetryAt = new Date(Date.now() + delaySeconds * 1000).toISOString()

        await supabase
          .from('hubspot_sync_queue')
          .update({
            status: 'pending',
            retry_count: newRetryCount,
            next_retry_at: nextRetryAt,
            error_message: errorMessage,
            updated_at: new Date().toISOString(),
          })
          .eq('id', item.id)

        console.log(`Sync item ${item.id} scheduled for retry ${newRetryCount}/${item.max_retries} at ${nextRetryAt}`)
      } else {
        // Mark as permanently failed
        await supabase
          .from('hubspot_sync_queue')
          .update({
            status: 'failed',
            error_message: errorMessage,
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', item.id)

        console.error(`Sync item ${item.id} permanently failed after ${item.max_retries} retries`)
      }
    }
  }

  /**
   * Execute the actual sync operation
   */
  private async executeSyncOperation(item: SyncQueueItem): Promise<void> {
    const { object_type, operation, direction, data } = item

    switch (object_type) {
      case 'contacts':
        const contactSync = new ContactSyncService(this.workspaceId)
        
        if (direction === 'to_hubspot') {
          if (operation === 'create') {
            await contactSync.syncSingleLeadToHubSpot(data.id)
          } else if (operation === 'update') {
            await contactSync.syncSingleLeadToHubSpot(data.id)
          } else if (operation === 'delete') {
            await contactSync.deleteMappedContact(data.id)
          }
        }
        break

      case 'companies':
        const companySync = new CompanySyncService(this.workspaceId)
        
        if (direction === 'to_hubspot') {
          if (operation === 'create' || operation === 'update') {
            await companySync.syncSingleCompanyToHubSpot(data.name)
          }
        }
        break

      case 'deals':
        const dealSync = new DealSyncService(this.workspaceId)
        
        if (direction === 'to_hubspot') {
          if (operation === 'create') {
            await dealSync.syncSingleCampaignToDeal(data.campaign_id)
          } else if (operation === 'update') {
            await dealSync.updateDealFromCampaignStats(data.campaign_id)
          }
        }
        break

      case 'activities':
        const activitySync = new ActivitySyncService(this.workspaceId)
        
        if (direction === 'to_hubspot') {
          if (operation === 'create') {
            await activitySync.syncSingleEmailEvent(data.event_id)
          }
        }
        break

      default:
        throw new Error(`Unsupported object type: ${object_type}`)
    }
  }

  /**
   * Clear completed and old failed items
   */
  async cleanupQueue(olderThanDays: number = 7): Promise<{ deleted: number }> {
    const supabase = await createClient()
    const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString()

    const { count, error } = await supabase
      .from('hubspot_sync_queue')
      .delete()
      .eq('workspace_id', this.workspaceId)
      .in('status', ['completed', 'failed'])
      .lt('updated_at', cutoffDate)

    if (error) {
      throw new Error(`Failed to cleanup queue: ${error.message}`)
    }

    return { deleted: count || 0 }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    pending: number
    processing: number
    completed: number
    failed: number
    total: number
  }> {
    const supabase = await createClient()

    const { data: stats } = await supabase
      .from('hubspot_sync_queue')
      .select('status')
      .eq('workspace_id', this.workspaceId)

    if (!stats) {
      return { pending: 0, processing: 0, completed: 0, failed: 0, total: 0 }
    }

    const counts = stats.reduce(
      (acc, item) => {
        acc[item.status as keyof typeof acc]++
        acc.total++
        return acc
      },
      { pending: 0, processing: 0, completed: 0, failed: 0, total: 0 }
    )

    return counts
  }

  /**
   * Retry failed items
   */
  async retryFailedItems(maxAge?: Date): Promise<{ retried: number }> {
    const supabase = await createClient()

    const query = supabase
      .from('hubspot_sync_queue')
      .update({
        status: 'pending',
        retry_count: 0,
        next_retry_at: null,
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq('workspace_id', this.workspaceId)
      .eq('status', 'failed')

    if (maxAge) {
      query.gte('created_at', maxAge.toISOString())
    }

    const { count, error } = await query

    if (error) {
      throw new Error(`Failed to retry items: ${error.message}`)
    }

    // Trigger queue processing
    this.processQueue().catch(console.error)

    return { retried: count || 0 }
  }

  /**
   * Cancel pending items
   */
  async cancelPendingItems(objectType?: SyncQueueItem['object_type']): Promise<{ cancelled: number }> {
    const supabase = await createClient()

    const query = supabase
      .from('hubspot_sync_queue')
      .delete()
      .eq('workspace_id', this.workspaceId)
      .eq('status', 'pending')

    if (objectType) {
      query.eq('object_type', objectType)
    }

    const { count, error } = await query

    if (error) {
      throw new Error(`Failed to cancel items: ${error.message}`)
    }

    return { cancelled: count || 0 }
  }
}

/**
 * Convenience functions for common sync operations
 */

export async function queueLeadSync(
  workspaceId: string,
  leadId: string,
  operation: 'create' | 'update' | 'delete',
  priority: number = 100
): Promise<string> {
  const queue = new HubSpotSyncQueue(workspaceId)
  return queue.enqueue('contacts', operation, 'to_hubspot', { id: leadId }, priority)
}

export async function queueCompanySync(
  workspaceId: string,
  companyName: string,
  operation: 'create' | 'update',
  priority: number = 200
): Promise<string> {
  const queue = new HubSpotSyncQueue(workspaceId)
  return queue.enqueue('companies', operation, 'to_hubspot', { name: companyName }, priority)
}

export async function queueCampaignSync(
  workspaceId: string,
  campaignId: string,
  operation: 'create' | 'update',
  priority: number = 300
): Promise<string> {
  const queue = new HubSpotSyncQueue(workspaceId)
  return queue.enqueue('deals', operation, 'to_hubspot', { campaign_id: campaignId }, priority)
}

export async function queueEmailEventSync(
  workspaceId: string,
  eventId: string,
  priority: number = 50
): Promise<string> {
  const queue = new HubSpotSyncQueue(workspaceId)
  return queue.enqueue('activities', 'create', 'to_hubspot', { event_id: eventId }, priority)
}