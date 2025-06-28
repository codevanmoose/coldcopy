import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createGdprService } from '@/lib/gdpr/gdpr-service'
import { 
  DataRetentionPolicy, 
  DeletionStrategy, 
  AuditActionCategory,
  GdprEmailType 
} from '@/lib/gdpr/types'

// Cron job secret to prevent unauthorized access
const CRON_SECRET = process.env.CRON_SECRET

// Default retention policies if none are configured
const DEFAULT_RETENTION_POLICIES: Partial<DataRetentionPolicy>[] = [
  {
    dataType: 'email_events',
    description: 'Email tracking events (opens, clicks)',
    tableName: 'email_events',
    retentionDays: 365, // 1 year
    deletionStrategy: DeletionStrategy.HARD_DELETE,
  },
  {
    dataType: 'campaign_emails',
    description: 'Campaign email records',
    tableName: 'campaign_emails',
    retentionDays: 730, // 2 years
    deletionStrategy: DeletionStrategy.ANONYMIZE,
    anonymizationFields: ['content_html', 'content_text'],
  },
  {
    dataType: 'enriched_data',
    description: 'Lead enrichment data',
    tableName: 'enriched_data',
    retentionDays: 365, // 1 year
    deletionStrategy: DeletionStrategy.SOFT_DELETE,
  },
  {
    dataType: 'gdpr_audit_logs',
    description: 'GDPR compliance audit logs',
    tableName: 'gdpr_audit_logs',
    retentionDays: 2555, // 7 years (legal requirement)
    deletionStrategy: DeletionStrategy.ARCHIVE,
  },
  {
    dataType: 'inactive_leads',
    description: 'Leads with no activity',
    tableName: 'leads',
    retentionDays: 1095, // 3 years
    deletionStrategy: DeletionStrategy.ANONYMIZE,
    anonymizationFields: ['email', 'phone', 'first_name', 'last_name'],
  },
  {
    dataType: 'unsubscribed_leads',
    description: 'Unsubscribed leads',
    tableName: 'leads',
    retentionDays: 180, // 6 months
    deletionStrategy: DeletionStrategy.HARD_DELETE,
  },
]

interface RetentionResult {
  policyId: string
  dataType: string
  recordsProcessed: number
  recordsDeleted: number
  recordsAnonymized: number
  recordsArchived: number
  errors: string[]
}

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createClient()
    const gdprService = await createGdprService()
    const results: RetentionResult[] = []
    let totalRecordsProcessed = 0
    let totalRecordsDeleted = 0
    let totalRecordsAnonymized = 0
    let totalRecordsArchived = 0

    // Get all active workspaces
    const { data: workspaces, error: workspaceError } = await supabase
      .from('workspaces')
      .select('id, name, settings')
      .eq('is_active', true)

    if (workspaceError) {
      throw workspaceError
    }

    // Process retention policies for each workspace
    for (const workspace of workspaces || []) {
      try {
        // Get workspace-specific retention policies
        const policies = await gdprService.getDataRetentionPolicies(workspace.id)
        
        // If no policies configured, use defaults based on workspace settings
        const policiesToProcess = policies.length > 0 
          ? policies 
          : DEFAULT_RETENTION_POLICIES.map(p => ({
              ...p,
              workspaceId: workspace.id,
              isActive: true,
            } as DataRetentionPolicy))

        // Process each policy
        for (const policy of policiesToProcess) {
          const result = await processRetentionPolicy(workspace.id, policy)
          results.push(result)
          
          totalRecordsProcessed += result.recordsProcessed
          totalRecordsDeleted += result.recordsDeleted
          totalRecordsAnonymized += result.recordsAnonymized
          totalRecordsArchived += result.recordsArchived
        }

        // Send notification if records were deleted
        const deletedCount = results
          .filter(r => r.recordsDeleted > 0 || r.recordsAnonymized > 0)
          .reduce((sum, r) => sum + r.recordsDeleted + r.recordsAnonymized, 0)

        if (deletedCount > 0 && workspace.settings?.notifications?.dataRetention) {
          await sendRetentionNotification(workspace.id, results)
        }
      } catch (error) {
        console.error(`Error processing retention for workspace ${workspace.id}:`, error)
        results.push({
          policyId: 'error',
          dataType: 'workspace_error',
          recordsProcessed: 0,
          recordsDeleted: 0,
          recordsAnonymized: 0,
          recordsArchived: 0,
          errors: [`Workspace ${workspace.id}: ${error instanceof Error ? error.message : 'Unknown error'}`],
        })
      }
    }

    // Log audit event
    await gdprService.logAuditEvent({
      workspaceId: 'system',
      action: 'data_retention_job_completed',
      actionCategory: AuditActionCategory.DATA_DELETION,
      resourceType: 'retention_job',
      purpose: 'Automated data retention policy enforcement',
      changes: {
        totalRecordsProcessed,
        totalRecordsDeleted,
        totalRecordsAnonymized,
        totalRecordsArchived,
        workspacesProcessed: workspaces?.length || 0,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Data retention job completed',
      summary: {
        workspacesProcessed: workspaces?.length || 0,
        policiesProcessed: results.length,
        totalRecordsProcessed,
        totalRecordsDeleted,
        totalRecordsAnonymized,
        totalRecordsArchived,
      },
      results,
      executedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Data retention job error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}

async function processRetentionPolicy(
  workspaceId: string,
  policy: DataRetentionPolicy
): Promise<RetentionResult> {
  const supabase = await createClient()
  const result: RetentionResult = {
    policyId: policy.id,
    dataType: policy.dataType,
    recordsProcessed: 0,
    recordsDeleted: 0,
    recordsAnonymized: 0,
    recordsArchived: 0,
    errors: [],
  }

  try {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - policy.retentionDays)

    switch (policy.dataType) {
      case 'email_events':
        result.recordsProcessed = await processEmailEvents(
          workspaceId,
          cutoffDate,
          policy.deletionStrategy,
          result
        )
        break

      case 'campaign_emails':
        result.recordsProcessed = await processCampaignEmails(
          workspaceId,
          cutoffDate,
          policy.deletionStrategy,
          result
        )
        break

      case 'enriched_data':
        result.recordsProcessed = await processEnrichedData(
          workspaceId,
          cutoffDate,
          policy.deletionStrategy,
          result
        )
        break

      case 'inactive_leads':
        result.recordsProcessed = await processInactiveLeads(
          workspaceId,
          cutoffDate,
          policy.deletionStrategy,
          result
        )
        break

      case 'unsubscribed_leads':
        result.recordsProcessed = await processUnsubscribedLeads(
          workspaceId,
          cutoffDate,
          policy.deletionStrategy,
          result
        )
        break

      case 'gdpr_audit_logs':
        result.recordsProcessed = await processAuditLogs(
          workspaceId,
          cutoffDate,
          policy.deletionStrategy,
          result
        )
        break

      default:
        // Generic table processing
        if (policy.tableName) {
          result.recordsProcessed = await processGenericTable(
            workspaceId,
            policy.tableName,
            cutoffDate,
            policy.deletionStrategy,
            policy.anonymizationFields,
            result
          )
        }
    }

    // Update policy execution time
    await supabase
      .from('data_retention_policies')
      .update({
        last_execution_at: new Date().toISOString(),
        next_execution_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Next day
      })
      .eq('id', policy.id)

  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : 'Unknown error')
  }

  return result
}

async function processEmailEvents(
  workspaceId: string,
  cutoffDate: Date,
  strategy: DeletionStrategy,
  result: RetentionResult
): Promise<number> {
  const supabase = await createClient()

  // Get old email events
  const { data: events, error } = await supabase
    .from('email_events')
    .select('id')
    .eq('workspace_id', workspaceId)
    .lt('created_at', cutoffDate.toISOString())
    .limit(1000)

  if (error) throw error
  if (!events || events.length === 0) return 0

  const eventIds = events.map(e => e.id)

  if (strategy === DeletionStrategy.HARD_DELETE) {
    const { count } = await supabase
      .from('email_events')
      .delete()
      .in('id', eventIds)
      .select('count')

    result.recordsDeleted = count || 0
  }

  return events.length
}

async function processCampaignEmails(
  workspaceId: string,
  cutoffDate: Date,
  strategy: DeletionStrategy,
  result: RetentionResult
): Promise<number> {
  const supabase = await createClient()

  const { data: emails, error } = await supabase
    .from('campaign_emails')
    .select('id')
    .eq('workspace_id', workspaceId)
    .lt('sent_at', cutoffDate.toISOString())
    .limit(1000)

  if (error) throw error
  if (!emails || emails.length === 0) return 0

  if (strategy === DeletionStrategy.ANONYMIZE) {
    // Anonymize email content
    const { count } = await supabase
      .from('campaign_emails')
      .update({
        content_html: '[Content removed for privacy]',
        content_text: '[Content removed for privacy]',
        subject: '[Subject removed]',
      })
      .in('id', emails.map(e => e.id))
      .select('count')

    result.recordsAnonymized = count || 0
  }

  return emails.length
}

async function processEnrichedData(
  workspaceId: string,
  cutoffDate: Date,
  strategy: DeletionStrategy,
  result: RetentionResult
): Promise<number> {
  const supabase = await createClient()

  const { data: enrichments, error } = await supabase
    .from('enriched_data')
    .select('id')
    .eq('workspace_id', workspaceId)
    .lt('created_at', cutoffDate.toISOString())
    .limit(1000)

  if (error) throw error
  if (!enrichments || enrichments.length === 0) return 0

  if (strategy === DeletionStrategy.SOFT_DELETE) {
    const { count } = await supabase
      .from('enriched_data')
      .update({ deleted_at: new Date().toISOString() })
      .in('id', enrichments.map(e => e.id))
      .select('count')

    result.recordsDeleted = count || 0
  }

  return enrichments.length
}

async function processInactiveLeads(
  workspaceId: string,
  cutoffDate: Date,
  strategy: DeletionStrategy,
  result: RetentionResult
): Promise<number> {
  const supabase = await createClient()
  const gdprService = await createGdprService()

  // Find leads with no recent activity
  const { data: inactiveLeads, error } = await supabase
    .from('leads')
    .select('id')
    .eq('workspace_id', workspaceId)
    .lt('last_activity_at', cutoffDate.toISOString())
    .is('deleted_at', null)
    .limit(100) // Process in smaller batches for leads

  if (error) throw error
  if (!inactiveLeads || inactiveLeads.length === 0) return 0

  if (strategy === DeletionStrategy.ANONYMIZE) {
    // Anonymize lead data
    for (const lead of inactiveLeads) {
      await gdprService.anonymizeData(workspaceId, lead.id)
      result.recordsAnonymized++
    }
  }

  return inactiveLeads.length
}

async function processUnsubscribedLeads(
  workspaceId: string,
  cutoffDate: Date,
  strategy: DeletionStrategy,
  result: RetentionResult
): Promise<number> {
  const supabase = await createClient()
  const gdprService = await createGdprService()

  // Find unsubscribed leads older than retention period
  const { data: unsubscribedLeads, error } = await supabase
    .from('suppression_list')
    .select('email, lead_id')
    .eq('workspace_id', workspaceId)
    .eq('suppression_type', 'unsubscribe')
    .lt('created_at', cutoffDate.toISOString())
    .limit(100)

  if (error) throw error
  if (!unsubscribedLeads || unsubscribedLeads.length === 0) return 0

  const leadIds = unsubscribedLeads
    .map(u => u.lead_id)
    .filter(Boolean) as string[]

  if (leadIds.length > 0 && strategy === DeletionStrategy.HARD_DELETE) {
    // Delete lead data
    for (const leadId of leadIds) {
      await gdprService.deleteData({
        workspaceId,
        leadId,
        deletionStrategy: DeletionStrategy.HARD_DELETE,
        reason: 'Retention policy - unsubscribed lead',
      })
      result.recordsDeleted++
    }
  }

  return unsubscribedLeads.length
}

async function processAuditLogs(
  workspaceId: string,
  cutoffDate: Date,
  strategy: DeletionStrategy,
  result: RetentionResult
): Promise<number> {
  const supabase = await createClient()

  const { data: logs, error } = await supabase
    .from('gdpr_audit_logs')
    .select('id')
    .eq('workspace_id', workspaceId)
    .lt('created_at', cutoffDate.toISOString())
    .limit(1000)

  if (error) throw error
  if (!logs || logs.length === 0) return 0

  if (strategy === DeletionStrategy.ARCHIVE) {
    // Archive old audit logs (in production, move to cold storage)
    // For now, just mark as archived
    const { count } = await supabase
      .from('gdpr_audit_logs')
      .update({ archived: true })
      .in('id', logs.map(l => l.id))
      .select('count')

    result.recordsArchived = count || 0
  }

  return logs.length
}

async function processGenericTable(
  workspaceId: string,
  tableName: string,
  cutoffDate: Date,
  strategy: DeletionStrategy,
  anonymizationFields: string[] | undefined,
  result: RetentionResult
): Promise<number> {
  const supabase = await createClient()

  // Generic processing for any table
  const { data: records, error } = await supabase
    .from(tableName)
    .select('id')
    .eq('workspace_id', workspaceId)
    .lt('created_at', cutoffDate.toISOString())
    .limit(1000)

  if (error) throw error
  if (!records || records.length === 0) return 0

  switch (strategy) {
    case DeletionStrategy.HARD_DELETE:
      const { count: deleteCount } = await supabase
        .from(tableName)
        .delete()
        .in('id', records.map(r => r.id))
        .select('count')
      result.recordsDeleted = deleteCount || 0
      break

    case DeletionStrategy.SOFT_DELETE:
      const { count: softDeleteCount } = await supabase
        .from(tableName)
        .update({ deleted_at: new Date().toISOString() })
        .in('id', records.map(r => r.id))
        .select('count')
      result.recordsDeleted = softDeleteCount || 0
      break

    case DeletionStrategy.ANONYMIZE:
      if (anonymizationFields && anonymizationFields.length > 0) {
        const updateData = anonymizationFields.reduce((acc, field) => {
          acc[field] = '[ANONYMIZED]'
          return acc
        }, {} as Record<string, string>)

        const { count: anonymizeCount } = await supabase
          .from(tableName)
          .update(updateData)
          .in('id', records.map(r => r.id))
          .select('count')
        result.recordsAnonymized = anonymizeCount || 0
      }
      break
  }

  return records.length
}

async function sendRetentionNotification(
  workspaceId: string,
  results: RetentionResult[]
): Promise<void> {
  try {
    // Get workspace admin emails
    const supabase = await createClient()
    const { data: admins } = await supabase
      .from('profiles')
      .select('email')
      .eq('workspace_id', workspaceId)
      .eq('role', 'admin')

    if (!admins || admins.length === 0) return

    // Prepare summary
    const summary = {
      totalDeleted: results.reduce((sum, r) => sum + r.recordsDeleted, 0),
      totalAnonymized: results.reduce((sum, r) => sum + r.recordsAnonymized, 0),
      totalArchived: results.reduce((sum, r) => sum + r.recordsArchived, 0),
      byDataType: results.map(r => ({
        dataType: r.dataType,
        deleted: r.recordsDeleted,
        anonymized: r.recordsAnonymized,
        archived: r.recordsArchived,
      })),
    }

    // Send notification email
    // This would integrate with your email service
    console.log('Retention notification would be sent to:', admins.map(a => a.email))
    console.log('Summary:', summary)
  } catch (error) {
    console.error('Failed to send retention notification:', error)
  }
}