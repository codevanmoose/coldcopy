import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { workflowEngine } from '@/lib/automation/workflow-engine'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { workspace_id, workflow, test_data } = body
    
    if (!workspace_id || !workflow) {
      return NextResponse.json({ error: 'Workspace ID and workflow are required' }, { status: 400 })
    }

    const result = await workflowEngine.testWorkflow(
      workspace_id,
      workflow,
      test_data || {}
    )
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error testing workflow:', error)
    return NextResponse.json(
      { error: 'Failed to test workflow' },
      { status: 500 }
    )
  }
}