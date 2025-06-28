import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { workflowEngine } from '@/lib/automation/workflow-engine'

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createClient()
    
    // Get workflows that need execution
    const { data: scheduledExecutions, error } = await supabase
      .from('workflow_executions')
      .select(`
        *,
        workflows!inner(
          id,
          workspace_id,
          status,
          trigger_config,
          actions_config,
          conditions_config,
          settings
        )
      `)
      .eq('status', 'pending')
      .lte('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(50)

    if (error) {
      throw error
    }

    let executed = 0
    let failed = 0

    // Execute each workflow
    for (const execution of scheduledExecutions) {
      try {
        const workflow = execution.workflows
        
        // Skip if workflow is not active
        if (workflow.status !== 'active') {
          await supabase
            .from('workflow_executions')
            .update({ 
              status: 'skipped',
              error: { message: 'Workflow is not active' },
              completed_at: new Date().toISOString()
            })
            .eq('id', execution.id)
          continue
        }

        // Execute workflow
        await workflowEngine.executeWorkflow(
          workflow.workspace_id,
          workflow.id,
          execution.execution_context || {}
        )

        executed++
      } catch (error) {
        console.error(`Failed to execute workflow ${execution.id}:`, error)
        
        // Mark as failed
        await supabase
          .from('workflow_executions')
          .update({ 
            status: 'failed',
            error: { 
              message: error instanceof Error ? error.message : 'Unknown error',
              timestamp: new Date().toISOString()
            },
            completed_at: new Date().toISOString()
          })
          .eq('id', execution.id)
          
        failed++
      }
    }

    // Check for time-based workflow triggers
    const { data: timeBasedWorkflows } = await supabase
      .from('workflows')
      .select('*')
      .eq('status', 'active')
      .contains('trigger_config', { type: 'time_based' })

    let triggered = 0

    for (const workflow of timeBasedWorkflows || []) {
      try {
        const trigger = workflow.trigger_config as any
        const lastExecuted = workflow.last_executed_at
        
        // Check if it's time to execute based on recurring schedule
        if (trigger.conditions?.recurringSchedule) {
          const schedule = trigger.conditions.recurringSchedule
          const now = new Date()
          
          let shouldExecute = false
          
          // Simple daily check (more complex scheduling would need a proper cron parser)
          if (schedule.frequency === 'daily') {
            if (!lastExecuted || new Date(lastExecuted).toDateString() !== now.toDateString()) {
              shouldExecute = true
            }
          }
          
          if (shouldExecute) {
            await workflowEngine.executeWorkflow(workflow.workspace_id, workflow.id, {
              triggeredBy: 'scheduled',
              timestamp: now.toISOString(),
            })
            triggered++
          }
        }
      } catch (error) {
        console.error(`Failed to trigger workflow ${workflow.id}:`, error)
      }
    }

    return NextResponse.json({
      success: true,
      executed,
      failed,
      triggered,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Workflow execution cron error:', error)
    return NextResponse.json(
      { error: 'Failed to run workflow execution' },
      { status: 500 }
    )
  }
}